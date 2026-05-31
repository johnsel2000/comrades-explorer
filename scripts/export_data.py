#!/usr/bin/env python3
"""
Export Comrades Marathon SQLite data to JSON files for the static website.

Usage:
    python3 scripts/export_data.py
    python3 scripts/export_data.py --db /path/to/comrades_results.db --out public/data
"""

import argparse
import json
import logging
import os
import sqlite3
from collections import defaultdict
from pathlib import Path
from statistics import mean, median

logger = logging.getLogger("export_data")


# ---------------------------------------------------------------------------
# Gender classification
# ---------------------------------------------------------------------------

def classify_genders(conn: sqlite3.Connection) -> dict[str, str]:
    """
    Classify athletes as Male (M) or Female (F) using the gender_pos field.

    Algorithm: For each athlete with position data, the ratio gender_pos/pos
    reveals their gender. Males have gender_pos close to pos (ratio > 0.55),
    females have gender_pos much less than pos (ratio < 0.35) since women are
    a smaller fraction of the field. We vote across all years and take majority.

    For athletes with pos <= 10, use exact matching: if gender_pos == pos, male;
    if gender_pos < pos, female.

    Athletes who only ran pre-1975 (before women were allowed) are classified male.

    Returns dict mapping UPPER(athlete_id) -> 'M' or 'F'.
    """
    logger.info("Classifying athlete genders...")

    athlete_votes: dict[str, dict] = {}  # aid -> {'M': int, 'F': int}

    # Strategy 1: Ratio-based for pos > 10
    rows = conn.execute("""
        SELECT UPPER(athlete_id), CAST(pos AS INTEGER), CAST(gender_pos AS INTEGER)
        FROM results
        WHERE pos != '' AND gender_pos != ''
        AND CAST(pos AS INTEGER) > 10
        AND pos IS NOT NULL AND gender_pos IS NOT NULL AND athlete_id IS NOT NULL
    """).fetchall()

    for aid, pos, gp in rows:
        if pos == 0:
            continue
        ratio = gp / pos
        if aid not in athlete_votes:
            athlete_votes[aid] = {'M': 0, 'F': 0}
        if ratio < 0.35:
            athlete_votes[aid]['F'] += 1
        elif ratio > 0.55:
            athlete_votes[aid]['M'] += 1

    # Strategy 2: Top-10 runners (pos <= 10)
    rows = conn.execute("""
        SELECT UPPER(athlete_id), CAST(pos AS INTEGER), CAST(gender_pos AS INTEGER)
        FROM results
        WHERE pos != '' AND gender_pos != ''
        AND CAST(pos AS INTEGER) <= 10 AND CAST(pos AS INTEGER) > 0
        AND pos IS NOT NULL AND gender_pos IS NOT NULL AND athlete_id IS NOT NULL
    """).fetchall()

    for aid, pos, gp in rows:
        if aid not in athlete_votes:
            athlete_votes[aid] = {'M': 0, 'F': 0}
        if gp == pos:
            athlete_votes[aid]['M'] += 1
        elif gp < pos:
            athlete_votes[aid]['F'] += 1

    # Resolve votes
    classified = {}
    for aid, votes in athlete_votes.items():
        if votes['F'] > votes['M']:
            classified[aid] = 'F'
        elif votes['M'] > votes['F']:
            classified[aid] = 'M'
        elif votes['M'] > 0:
            classified[aid] = 'M'  # Default to male if tied

    # Strategy 3: Athletes who only ran pre-1975 (before women allowed)
    rows = conn.execute("""
        SELECT UPPER(athlete_id), MAX(year)
        FROM results
        WHERE athlete_id IS NOT NULL AND athlete_id != ''
        GROUP BY UPPER(athlete_id)
        HAVING MAX(year) < 1975
    """).fetchall()
    for aid, _ in rows:
        if aid not in classified:
            classified[aid] = 'M'

    males = sum(1 for g in classified.values() if g == 'M')
    females = sum(1 for g in classified.values() if g == 'F')
    logger.info(f"  Classified {len(classified):,} athletes: {males:,} male, {females:,} female")
    return classified

# Medal hierarchy (best to worst)
MEDAL_RANK = {
    "Gold": 1,
    "Wally Hayward": 2,
    "Isavel Roche-Kelly": 3,
    "Silver": 4,
    "Bill Rowan": 5,
    "Robert Mtshali": 6,
    "Bronze": 7,
    "Vic Clapham": 8,
}

MEDAL_CODE = {
    "Gold": "G",
    "Wally Hayward": "W",
    "Isavel Roche-Kelly": "I",
    "Silver": "S",
    "Bill Rowan": "B",
    "Robert Mtshali": "R",
    "Bronze": "Z",
    "Vic Clapham": "V",
}

# ---------------------------------------------------------------------------
# Known data corrections: athlete_id -> correct raw country name
# These fix cases where the source data has the wrong country.
# ---------------------------------------------------------------------------
ATHLETE_COUNTRY_CORRECTIONS: dict[str, str] = {
    "029A4E77-6078-4471-A460-EF6327651101": "United States of America (the)",  # Alberto Salazar (American, not SA)
}

# ---------------------------------------------------------------------------
# Known data corrections: (athlete_id, year) -> corrected medal
# Fixes cases where the recorded medal is clearly wrong.
# ---------------------------------------------------------------------------
MEDAL_CORRECTIONS: dict[tuple[str, int], str] = {
    # Bianca Caldwell 2016: time 14:14:53 with Bronze medal — over 2h past 12h cutoff.
    # Clearly a timing error; cannot have earned a medal.
    ("EE5377A6-CBFB-4E7E-8908-766E41BF7141", 2016): "",
}

# ---------------------------------------------------------------------------
# Cutoff times per era (seconds). Used to flag over-cutoff finish times.
# Runners whose finish time exceeds the cutoff likely have inaccurate data.
# ---------------------------------------------------------------------------
YEAR_CUTOFF_SECONDS: dict[int, int] = {}
# 1921-1927: 12-hour cutoff
for _y in range(1921, 1928):
    YEAR_CUTOFF_SECONDS[_y] = 12 * 3600
# 1928-2000: 11-hour cutoff (with brief exceptions)
for _y in range(1928, 2001):
    YEAR_CUTOFF_SECONDS[_y] = 11 * 3600
# 2000 was special — cutoff was extended (27 runners finished over 12h)
YEAR_CUTOFF_SECONDS[2000] = 12 * 3600 + 30 * 60  # treat as ~12:30
# 2001-2002: 11-hour cutoff
YEAR_CUTOFF_SECONDS[2001] = 11 * 3600
YEAR_CUTOFF_SECONDS[2002] = 11 * 3600
# 2003+: 12-hour cutoff
for _y in range(2003, 2030):
    YEAR_CUTOFF_SECONDS[_y] = 12 * 3600

# ---------------------------------------------------------------------------
# Club data cleaning
# Some entries have country names or junk placeholders in the club field.
# ---------------------------------------------------------------------------
_COUNTRY_AS_CLUB = {
    "U.S.A.", "USA", "U.K.", "UK", "RSA", "GREAT BRITAIN", "KENYA", "ISRAEL",
    "PERU", "MALI", "GUAM", "UAE", "AUS", "ZIM",
    "SOUTH AFRICA", "AUSTRALIA", "ENGLAND", "GERMANY", "FRANCE", "BRAZIL",
    "INDIA", "CANADA", "JAPAN", "CHINA", "RUSSIA", "ZIMBABWE", "BOTSWANA",
    "MOZAMBIQUE", "NAMIBIA", "LESOTHO", "ESWATINI", "SWAZILAND", "SCOTLAND",
    "IRELAND", "WALES", "NETHERLANDS", "NEW ZEALAND", "PORTUGAL", "SPAIN",
    "ITALY", "SWEDEN", "NORWAY", "DENMARK", "FINLAND", "BELGIUM", "SWITZERLAND",
    "AUSTRIA", "SINGAPORE", "HONG KONG", "TAIWAN", "ARGENTINA", "CHILE",
    "MEXICO", "COLOMBIA", "POLAND", "CZECH REPUBLIC", "HUNGARY", "GREECE",
    "TURKEY",
}
_JUNK_CLUBS = {"TEST", "-", "NONE", "N/A", "NA", "NIL", "NO", "SELF", "DNQ", "DNF", ".", ".."}

# Map club-as-country values to the raw country name used in the database.
# Used to infer correct country when someone entered their country in the club field.
_CLUB_TO_RAW_COUNTRY: dict[str, str] = {
    "U.S.A.": "United States of America (the)",
    "USA": "United States of America (the)",
    "U.K.": "United Kingdom",
    "UK": "United Kingdom",
    "GREAT BRITAIN": "United Kingdom",
    "ENGLAND": "United Kingdom",
    "SCOTLAND": "United Kingdom",
    "WALES": "United Kingdom",
    "AUSTRALIA": "Australia",
    "AUS": "Australia",
    "GERMANY": "Germany",
    "FRANCE": "France",
    "BRAZIL": "Brazil",
    "INDIA": "India",
    "CANADA": "Canada",
    "JAPAN": "Japan",
    "ZIMBABWE": "Zimbabwe",
    "ZIM": "Zimbabwe",
    "BOTSWANA": "Botswana",
    "MOZAMBIQUE": "Mozambique",
    "NAMIBIA": "Namibia",
    "LESOTHO": "Lesotho",
    "ESWATINI": "Eswatini",
    "SWAZILAND": "Eswatini",
    "IRELAND": "Ireland",
    "NETHERLANDS": "Netherlands",
    "NEW ZEALAND": "New Zealand",
    "PORTUGAL": "Portugal",
    "SPAIN": "Spain",
    "ITALY": "Italy",
    "SWEDEN": "Sweden",
    "NORWAY": "Norway",
    "DENMARK": "Denmark",
    "FINLAND": "Finland",
    "BELGIUM": "Belgium",
    "SWITZERLAND": "Switzerland",
    "AUSTRIA": "Austria",
    "SINGAPORE": "Singapore",
    "HONG KONG": "Hong Kong",
    "ISRAEL": "Israel",
    "PERU": "Peru",
    "TAIWAN": "Taiwan",
    "ARGENTINA": "Argentina",
    "CHILE": "Chile",
    "MEXICO": "Mexico",
    "COLOMBIA": "Colombia",
    "POLAND": "Poland",
    "CZECH REPUBLIC": "Czechia",
    "HUNGARY": "Hungary",
    "GREECE": "Greece",
    "TURKEY": "Turkey",
    # Exclude KENYA — too many SA expats train there; not reliable
    # Exclude RSA, SOUTH AFRICA — already in the right country
}


def clean_club(club: str | None) -> str:
    """Return empty string if the club value is actually a country name or junk placeholder."""
    if not club or not club.strip():
        return ""
    stripped = club.strip()
    upper = stripped.upper()
    if upper in _COUNTRY_AS_CLUB or upper in _JUNK_CLUBS:
        return ""
    return stripped


def build_club_country_corrections(conn: sqlite3.Connection) -> dict[str, str]:
    """
    Infer correct country for athletes who entered their country as their club.

    Many entries (especially 1990s) have country="South Africa" (the default) but
    list the athlete's actual country in the club field (e.g., club="GERMANY").

    Safety rules:
    1. Only correct athletes whose country is "South Africa" or blank (defaults)
    2. Only use club values in _CLUB_TO_RAW_COUNTRY (excludes KENYA, RSA, etc.)
    3. Cross-check: if the athlete has any legitimate club names (non-country,
       non-junk) in OTHER entries, they likely have real SA clubs and are genuinely
       South African — don't correct them.
    4. If the athlete already has entries with the correct country matching their
       club → confirmed foreign, correct them.

    Returns dict mapping UPPER(athlete_id) -> corrected raw country name.
    """
    logger.info("Inferring country from club-as-country entries...")

    # Find all entries where country is SA or blank and club is a country name
    rows = conn.execute("""
        SELECT UPPER(athlete_id) as uid, club, country
        FROM results
        WHERE athlete_id IS NOT NULL AND athlete_id != ''
        AND (country = 'South Africa' OR country IS NULL OR country = '')
        AND club IS NOT NULL AND club != ''
    """).fetchall()

    # Candidates: athletes with a club that maps to a foreign country
    candidates: dict[str, set[str]] = defaultdict(set)  # uid -> set of inferred raw countries
    for uid, club, _country in rows:
        upper_club = club.strip().upper()
        if upper_club in _CLUB_TO_RAW_COUNTRY:
            candidates[uid].add(_CLUB_TO_RAW_COUNTRY[upper_club])

    if not candidates:
        logger.info("  No club-country candidates found")
        return {}

    # For each candidate, check if they have any legitimate non-country clubs
    # (indicating they're actually South African with a local club)
    all_rows = conn.execute("""
        SELECT UPPER(athlete_id) as uid, club, country
        FROM results
        WHERE UPPER(athlete_id) IN ({})
        AND club IS NOT NULL AND club != ''
    """.format(",".join(f"'{uid}'" for uid in candidates))).fetchall()

    athlete_has_real_club: set[str] = set()
    athlete_has_matching_country: set[str] = set()

    for uid, club, country in all_rows:
        upper_club = club.strip().upper()
        # Check if they have a "real" club (not a country name, not junk)
        if upper_club not in _COUNTRY_AS_CLUB and upper_club not in _JUNK_CLUBS:
            # This is a genuine club name — athlete likely has SA ties
            athlete_has_real_club.add(uid)
        # Check if they have entries where country matches their club-country
        if upper_club in _CLUB_TO_RAW_COUNTRY:
            expected_raw = _CLUB_TO_RAW_COUNTRY[upper_club]
            expected_display = clean_country_name(expected_raw)
            actual_display = clean_country_name(country) if country else ""
            if actual_display == expected_display:
                athlete_has_matching_country.add(uid)

    corrections: dict[str, str] = {}
    for uid, inferred_countries in candidates.items():
        if len(inferred_countries) != 1:
            continue  # Skip ambiguous (multiple different country clubs)
        inferred = next(iter(inferred_countries))

        # Skip if already manually corrected
        if uid in ATHLETE_COUNTRY_CORRECTIONS:
            continue

        # High confidence: athlete has entries with matching correct country
        if uid in athlete_has_matching_country:
            corrections[uid] = inferred
            continue

        # Medium confidence: no real SA clubs → likely foreign
        if uid not in athlete_has_real_club:
            corrections[uid] = inferred
            continue

        # Low confidence: has real SA clubs → probably genuinely SA, skip

    logger.info(
        f"  Found {len(candidates)} candidates, "
        f"{len(corrections)} corrections "
        f"({len(athlete_has_matching_country & set(corrections))} confirmed by country match, "
        f"{len(corrections) - len(athlete_has_matching_country & set(corrections))} by no SA clubs)"
    )
    return corrections


# ---------------------------------------------------------------------------
# Country name normalization + flags
# ---------------------------------------------------------------------------

COUNTRY_DISPLAY_NAMES = {
    "Russian Federation (the)": "Russia",
    "United States of America (the)": "United States",
    "United Arab Emirates (the)": "UAE",
    "United Kingdom of Great Britain and Northern Ireland (the)": "United Kingdom",
    "Korea (the Republic of)": "South Korea",
    "Iran (Islamic Republic of)": "Iran",
    "Netherlands (the)": "Netherlands",
    "Philippines (the)": "Philippines",
    "Congo (the Democratic Republic of the)": "DR Congo",
    "Tanzania, United Republic of": "Tanzania",
    "Viet Nam": "Vietnam",
    "Czechia": "Czech Republic",
    "Taipei, Chinese": "Chinese Taipei",
    "Bolivia (Plurinational State of)": "Bolivia",
    "Venezuela (Bolivarian Republic of)": "Venezuela",
    "Lao People's Democratic Republic (the)": "Laos",
    "Moldova (the Republic of)": "Moldova",
}

COUNTRY_ISO_CODES = {
    "South Africa": "ZA", "United Kingdom": "GB", "Zimbabwe": "ZW",
    "Australia": "AU", "United States": "US", "Brazil": "BR", "India": "IN",
    "Germany": "DE", "Eswatini": "SZ", "Botswana": "BW", "Lesotho": "LS",
    "Namibia": "NA", "Canada": "CA", "Switzerland": "CH", "Zambia": "ZM",
    "New Zealand": "NZ", "Netherlands": "NL", "Russia": "RU", "Japan": "JP",
    "Portugal": "PT", "Kenya": "KE", "France": "FR", "Malawi": "MW",
    "Ireland": "IE", "Sweden": "SE", "UAE": "AE", "Austria": "AT",
    "Mozambique": "MZ", "Italy": "IT", "Belgium": "BE", "Norway": "NO",
    "Spain": "ES", "Hong Kong": "HK", "Denmark": "DK", "China": "CN",
    "Finland": "FI", "Singapore": "SG", "Czech Republic": "CZ",
    "South Korea": "KR", "Poland": "PL", "Hungary": "HU", "Romania": "RO",
    "Taiwan": "TW", "Chinese Taipei": "TW", "Nigeria": "NG", "Thailand": "TH",
    "Argentina": "AR", "Mexico": "MX", "Colombia": "CO", "Chile": "CL",
    "Israel": "IL", "Malaysia": "MY", "Philippines": "PH", "Ethiopia": "ET",
    "Uganda": "UG", "DR Congo": "CD", "Tanzania": "TZ", "Vietnam": "VN",
    "Iran": "IR", "Ukraine": "UA", "Scotland": "GB", "Greece": "GR",
    "Croatia": "HR", "Serbia": "RS", "Slovakia": "SK", "Slovenia": "SI",
    "Lithuania": "LT", "Latvia": "LV", "Estonia": "EE", "Iceland": "IS",
    "Luxembourg": "LU", "Malta": "MT", "Cyprus": "CY", "Georgia": "GE",
    "Armenia": "AM", "Azerbaijan": "AZ", "Kazakhstan": "KZ",
    "Uzbekistan": "UZ", "Belarus": "BY", "Turkey": "TR", "Egypt": "EG",
    "Morocco": "MA", "Tunisia": "TN", "Algeria": "DZ", "Ghana": "GH",
    "Cameroon": "CM", "Senegal": "SN", "Rwanda": "RW", "Eritrea": "ER",
    "Somalia": "SO", "Madagascar": "MG", "Mauritius": "MU", "Seychelles": "SC",
    "Reunion": "RE", "Angola": "AO", "Gabon": "GA", "Peru": "PE",
    "Ecuador": "EC", "Uruguay": "UY", "Paraguay": "PY", "Costa Rica": "CR",
    "Panama": "PA", "Jamaica": "JM", "Trinidad and Tobago": "TT",
    "Barbados": "BB", "Bermuda": "BM", "Puerto Rico": "PR", "Guam": "GU",
    "Nepal": "NP", "Sri Lanka": "LK", "Pakistan": "PK", "Bangladesh": "BD",
    "Myanmar": "MM", "Cambodia": "KH", "Indonesia": "ID", "Brunei": "BN",
    "Iraq": "IQ", "Jordan": "JO", "Lebanon": "LB", "Oman": "OM",
    "Qatar": "QA", "Saudi Arabia": "SA", "Kuwait": "KW", "Bahrain": "BH",
    "Palestine": "PS", "Syria": "SY", "Yemen": "YE", "Afghanistan": "AF",
    "Bolivia": "BO", "Venezuela": "VE", "Laos": "LA", "Moldova": "MD",
    "Jersey": "JE", "Guernsey": "GG", "Isle of Man": "IM", "Gibraltar": "GI",
    "Fiji": "FJ", "Papua New Guinea": "PG", "Tonga": "TO",
}


def clean_country_name(name: str) -> str:
    """Normalize formal country names to display names."""
    return COUNTRY_DISPLAY_NAMES.get(name, name)


def country_to_flag(display_name: str) -> str:
    """Convert country display name to flag emoji."""
    code = COUNTRY_ISO_CODES.get(display_name, "")
    if not code or len(code) != 2:
        return ""
    return chr(0x1F1E6 + ord(code[0]) - ord('A')) + chr(0x1F1E6 + ord(code[1]) - ord('A'))


def slugify_country(name: str) -> str:
    """Convert display name to URL slug: 'South Africa' -> 'south-africa'."""
    import re
    name = clean_country_name(name)
    slug = name.lower().strip()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')


# Statuses that count as a "finish"
NON_FINISH_KEYWORDS = {"dnf", "dns", "dq", "not started", "disqualified", "withdrawn", "uof", "started"}


def normalize_time(time_str: str) -> str:
    """Normalize the time field to one of: a valid HH:MM:SS time, 'DNF', or 'DNS'.

    The source data uses inconsistent labels for non-finishes:
      'Not started' -> 'DNS'  (same meaning, different label; 35,943 records)
      'UOF'         -> 'DNF'  (Unofficial Finish — no time/pos; 604 records, 2025 only)
      'Started'     -> 'DNF'  (started but no time; 1 record)
    """
    if not time_str:
        return ""
    upper = time_str.strip().upper()
    if upper == "NOT STARTED":
        return "DNS"
    if upper in ("UOF", "STARTED"):
        return "DNF"
    return time_str.strip()


def normalize_nonfinish_medal(time_str: str, medal: str) -> str:
    """Clear medals on non-finish entries.

    The source data has 9 records where DNF/DNS/Not started entries have
    medals assigned (e.g. Bronze on a DNS). These are clearly data errors.
    """
    if not time_str:
        return medal or ""
    normalized = normalize_time(time_str)
    if normalized in ("DNF", "DNS", "DQ"):
        return ""
    return medal or ""


def is_finish(medal: str, time_str: str, pos: str) -> bool:
    """Determine if a result row represents a finish (not DNF/DNS)."""
    if medal and medal.lower() not in NON_FINISH_KEYWORDS:
        return True
    if time_str and ":" in time_str and time_str not in ("00:00:00", ""):
        return True
    if pos and pos.isdigit() and int(pos) > 0:
        return True
    return False


import re as _re

# Lines that are part of age-category tables scraped from the website
_CATEGORY_HEADER_RE = _re.compile(
    r"^(VETERANS|MASTERS|GRANDMASTERS)\s*\(AGE\s", _re.IGNORECASE
)
_JUNK_LINE_RE = _re.compile(
    r"^(Current Best Time\b|MISCELLANEOUS TROPHIES)", _re.IGNORECASE
)
# Lines that are just a name + year (e.g., "Vladimir Kotov (Belarus) – 2001") or
# result lines like "1st  Simona Staicu (44)  Hungary  7h 01m 14s"
_RESULT_LINE_RE = _re.compile(
    r"^(\d{1,2}(?:st|nd|rd|th)\b|[A-Z][a-z]+ .+? – \d{4}$|[A-Z][a-z]+ .+?\((?:Belarus|Russia|Germany|Switzerland|USA|South Africa|Hungary|Kenya|Zimbabwe|Lesotho|UK|Brazil|Japan|India|China|Australia|France|Canada|Italy|Spain|Portugal|Netherlands|Belgium|Sweden|Norway|Denmark|Finland|Austria|Poland|Ireland|Scotland|New Zealand|Botswana|Mozambique|Namibia|Swaziland|Eswatini|Hong Kong|Singapore|Taiwan|Thailand|Czech|Romania|Ukraine|Ethiopia|Eritrea|Morocco|Tunisia|Tanzania|Uganda)\b)"
)


def generate_narrative(detail: dict) -> str:
    """Generate an original narrative for a race year from structured data."""
    year = detail["year"]
    direction = detail.get("direction", "")
    distance = detail.get("distance", "")
    weather = detail.get("weather", "")
    date = detail.get("date", "")
    race_number = detail.get("raceNumber", "")
    time_limit = detail.get("timeLimit", "")
    entries = detail.get("entries", 0)
    finishers = detail.get("finishers", 0)
    finish_rate = detail.get("finishRate", 0)
    male_finishers = detail.get("maleFinishers", 0)
    female_finishers = detail.get("femaleFinishers", 0)
    avg_time = detail.get("avgFinishTime", "")
    medals = detail.get("medals", {})
    top_men = detail.get("topMen", [])
    top_women = detail.get("topWomen", [])
    last_finisher = detail.get("lastFinisher")
    first_timers = detail.get("firstTimers", {})
    top_countries = detail.get("topCountries", [])
    same_dir = detail.get("sameDirectionComparison")
    hist_rank = detail.get("historicalRank", {})
    categories = detail.get("categoryBreakdown", [])

    dir_desc = ""
    if direction == "Up":
        dir_desc = "run in the 'up' direction from Durban to Pietermaritzburg"
    elif direction == "Down":
        dir_desc = "run in the 'down' direction from Pietermaritzburg to Durban"

    paragraphs = []

    # --- Paragraph 1: Race overview ---
    p1_parts = []
    ordinal = _ordinal(race_number)
    if ordinal:
        p1_parts.append(f"The {year} Comrades Marathon was the {ordinal} running of the race")
    else:
        p1_parts.append(f"The {year} Comrades Marathon")

    if dir_desc:
        p1_parts[-1] += f", {dir_desc}"
    if distance:
        p1_parts[-1] += f" over {distance}"
    p1_parts[-1] += "."

    if date:
        p1_parts.append(f"The race was held on {date}.")
    if weather:
        p1_parts.append(f"Conditions: {weather.rstrip('.')}.")
    if time_limit:
        p1_parts.append(f"Runners had {time_limit.lower()} to complete the course.")

    paragraphs.append(" ".join(p1_parts))

    # --- Paragraph 2: Results ---
    p2_parts = []
    winner_m = top_men[0] if top_men else None
    winner_f = top_women[0] if top_women else None

    if winner_m:
        p2_parts.append(f"{winner_m['name']} claimed the men's title in {winner_m['time']}")
        if len(top_men) >= 2:
            p2_parts[-1] += f", ahead of {top_men[1]['name']} ({top_men[1]['time']})"
            if len(top_men) >= 3:
                p2_parts[-1] += f" and {top_men[2]['name']} ({top_men[2]['time']})"
        p2_parts[-1] += "."

    if winner_f:
        p2_parts.append(f"{winner_f['name']} won the women's race in {winner_f['time']}")
        if len(top_women) >= 2:
            p2_parts[-1] += f", followed by {top_women[1]['name']} ({top_women[1]['time']})"
        p2_parts[-1] += "."

    if p2_parts:
        paragraphs.append(" ".join(p2_parts))

    # --- Paragraph 2b: Course records ---
    rc = detail.get("recordContext") or {}
    if rc:
        p_rec = []

        # Men's records
        men_recs = rc.get("menRecords", [])
        men_prev = rc.get("menPreviousRecord")
        if men_recs and winner_m:
            rec_type = "overall" if "overall" in men_recs else men_recs[0]
            rec_label = "course record" if rec_type == "overall" else f"{rec_type} record"
            if men_prev:
                if men_prev["holder"] == winner_m["name"]:
                    surname = winner_m["name"].split()[-1] if " " in winner_m["name"] else winner_m["name"]
                    p_rec.append(
                        f"{winner_m['name']}'s {winner_m['time']} broke {surname}'s own {rec_label} "
                        f"of {men_prev['time']} set in {men_prev['year']}."
                    )
                else:
                    p_rec.append(
                        f"{winner_m['name']}'s {winner_m['time']} set a new {rec_label}, "
                        f"beating {men_prev['holder']}'s {men_prev['time']} from {men_prev['year']}."
                    )

        # Women's records
        women_recs = rc.get("womenRecords", [])
        women_prev = rc.get("womenPreviousRecord")
        if women_recs and winner_f:
            rec_type = "overall" if "overall" in women_recs else women_recs[0]
            rec_label = "women's course record" if rec_type == "overall" else f"women's {rec_type} record"
            if women_prev:
                if women_prev["holder"] == winner_f["name"]:
                    p_rec.append(
                        f"{winner_f['name']}'s {winner_f['time']} broke her own {rec_label} "
                        f"of {women_prev['time']} from {women_prev['year']}."
                    )
                else:
                    p_rec.append(
                        f"{winner_f['name']} set a new {rec_label} of {winner_f['time']}, "
                        f"surpassing {women_prev['holder']}'s {women_prev['time']} from {women_prev['year']}."
                    )

        # Heroic second place
        heroic = rc.get("heroicSecond")
        if heroic:
            p_rec.append(
                f"Remarkably, runner-up {heroic['name']}'s {heroic['time']} also beat the previous record "
                f"of {heroic['brokenRecord']['time']} — a rare feat in Comrades history."
            )
        heroic_w = rc.get("womenHeroicSecond")
        if heroic_w:
            p_rec.append(
                f"Women's runner-up {heroic_w['name']}'s {heroic_w['time']} also beat the previous women's record."
            )

        # Women vs historical men
        whm = rc.get("womenWouldHaveWonMen")
        if whm and winner_f:
            p_rec.append(
                f"{winner_f['name']}'s {winner_f['time']} was faster than the men's winning time "
                f"as recently as {whm['mostRecentYear']} ({whm['mensWinner']}, {whm['mensTime']})."
            )

        if p_rec:
            paragraphs.append(" ".join(p_rec))

    # --- Uncanny double mention ---
    uncanny = rc.get("uncannyDouble") if rc else None
    if uncanny and winner_m:
        other_yr = uncanny["otherYear"]
        uncanny_same = uncanny.get("sameDirection")
        dir_note = ""
        if uncanny_same is True:
            dir_note = " — both on the same direction course"
        elif uncanny_same is False:
            dir_note = " — despite being run in opposite directions"
        paragraphs.append(
            f"In a remarkable coincidence, {winner_m['name']}'s winning time of {uncanny['time']} was "
            f"identical to the second to the winning time posted in {other_yr}{dir_note}."
        )

    # --- Paragraph 3: Field and finishers ---
    p3_parts = []
    if entries > 0 and finishers > 0:
        intl_countries = len([c for c in top_countries if c.get("country") not in ("South Africa", "", None)])
        if intl_countries > 5:
            p3_parts.append(
                f"From a field of {entries:,} entries, {finishers:,} runners crossed the finish line "
                f"({finish_rate}% completion rate), with athletes representing over {intl_countries} countries."
            )
        else:
            p3_parts.append(
                f"From a field of {entries:,} entries, {finishers:,} runners completed the course "
                f"for a {finish_rate}% finish rate."
            )

        if female_finishers > 0 and male_finishers > 0:
            fem_pct = round(female_finishers / finishers * 100, 1)
            p3_parts.append(
                f"The field comprised {male_finishers:,} men and {female_finishers:,} women ({fem_pct}% female)."
            )

        if avg_time:
            p3_parts.append(f"The average finish time was {avg_time}.")

    if p3_parts:
        paragraphs.append(" ".join(p3_parts))

    # --- Paragraph 4: Medals ---
    p4_parts = []
    gold = medals.get("Gold", 0)
    silver = medals.get("Silver", 0) + medals.get("Isavel Roche-Kelly", 0)
    bill_rowan = medals.get("Bill Rowan", 0) + medals.get("Robert Mtshali", 0)
    bronze = medals.get("Bronze", 0)
    vic_clapham = medals.get("Vic Clapham", 0)
    wally = medals.get("Wally Hayward", 0)

    medal_parts = []
    if gold > 0:
        medal_parts.append(f"{gold} Gold")
    if wally > 0:
        medal_parts.append(f"{wally} Wally Hayward")
    if silver > 0:
        medal_parts.append(f"{silver:,} Silver")
    if bill_rowan > 0:
        medal_parts.append(f"{bill_rowan:,} Bill Rowan")
    if bronze > 0:
        medal_parts.append(f"{bronze:,} Bronze")
    if vic_clapham > 0:
        medal_parts.append(f"{vic_clapham:,} Vic Clapham")

    if medal_parts:
        p4_parts.append(f"Medals awarded: {', '.join(medal_parts)}.")

    ft = first_timers
    if ft and ft.get("count", 0) > 0:
        p4_parts.append(
            f"{ft['count']:,} runners ({ft['percentage']}%) were completing their first Comrades."
        )

    if last_finisher and last_finisher.get("name"):
        p4_parts.append(
            f"The final finisher was {last_finisher['name']} in {last_finisher.get('time', '')}."
        )

    if p4_parts:
        paragraphs.append(" ".join(p4_parts))

    # --- Paragraph 5: Historical context ---
    p5_parts = []
    hr = hist_rank
    total_races = hr.get("totalRaces", 0)
    if total_races > 0:
        notable = []
        fsr = hr.get("fieldSizeRank", 0)
        frr = hr.get("finishersRank", 0)
        wtr = hr.get("winningTimeRank", 0)

        if fsr and fsr <= 5:
            notable.append(f"the {_ordinal(fsr)} largest field in race history")
        if frr and frr <= 5:
            notable.append(f"the {_ordinal(frr)} most finishers ever")
        if wtr and wtr <= 5:
            notable.append(f"the {_ordinal(wtr)} fastest winning time on record")

        if notable:
            p5_parts.append(f"This edition featured {' and '.join(notable)}.")

    if same_dir:
        prev_y = same_dir.get("previousYear")
        deltas = same_dir.get("deltas", {})
        fs_delta = deltas.get("fieldSize", {})
        fr_delta = deltas.get("finishRate", {})
        if prev_y and fs_delta:
            delta_pct = fs_delta.get("deltaPct", 0)
            if abs(delta_pct) >= 5:
                direction_word = "larger" if delta_pct > 0 else "smaller"
                p5_parts.append(
                    f"Compared to the previous {direction.lower()} run in {prev_y}, "
                    f"the field was {abs(delta_pct)}% {direction_word}."
                )

    if p5_parts:
        paragraphs.append(" ".join(p5_parts))

    # --- Paragraph 6: Age categories ---
    if categories and len(categories) >= 2:
        senior = next((c for c in categories if c["category"] == "Senior"), None)
        vets = [c for c in categories if c["category"] != "Senior"]
        if senior and vets:
            vet_total = sum(c["count"] for c in vets)
            vet_pct = round(vet_total / finishers * 100) if finishers > 0 else 0
            if vet_pct >= 20:
                paragraphs.append(
                    f"Veterans and masters athletes made up {vet_pct}% of the finishers, "
                    f"with {senior['count']:,} seniors (avg {senior['avgTime']}) "
                    f"and {vet_total:,} in the veteran categories."
                )

    return "\n\n".join(paragraphs)


def _ordinal(n) -> str:
    """Convert a number or string to ordinal (1st, 2nd, 3rd, etc.)."""
    if not n:
        return ""
    try:
        n = int(str(n).strip())
    except (ValueError, TypeError):
        return ""
    if 11 <= (n % 100) <= 13:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


def clean_narrative(text: str) -> str:
    """Strip age-category table sections and trophy listings from narrative text."""
    if not text:
        return text

    # ---- Phase 1: Strip concatenated trophy/record sections (2019+) ----
    # These appear as "First Men's TeamCurrent Team Best Time..." blocks
    trophy_match = _re.search(r"\n\nFirst (?:Men|Women|Veteran|Elite|Novice|KZN)", text)
    if trophy_match:
        # Check if what follows contains "Current" records
        after = text[trophy_match.start():trophy_match.start() + 200]
        if "Current" in after or "Trophy" in after:
            text = text[:trophy_match.start()]

    # ---- Phase 2: Strip VETERANS/MASTERS/GRANDMASTERS blocks ----
    lines = text.split("\n")
    cleaned = []
    skip_mode = False

    for line in lines:
        stripped = line.strip()

        # Enter skip mode when we hit a category header
        if _CATEGORY_HEADER_RE.match(stripped):
            skip_mode = True
            continue

        # In skip mode, skip junk/result lines and blank lines
        if skip_mode:
            if not stripped:
                continue
            if _JUNK_LINE_RE.match(stripped):
                continue
            # Lines that look like record holder lines: "Name (Country) – Year" or time records
            if _re.match(r"^[A-Z].*\d{4}$", stripped) and len(stripped) < 80:
                continue
            if _re.match(r"^\d{1,2}(?:st|nd|rd|th)\s", stripped):
                continue
            # Time-only lines like ": 8h 24m 00s"
            if _re.match(r"^:?\s*\d+h\s*\d+m", stripped):
                continue
            # Once we hit a real paragraph, exit skip mode
            skip_mode = False

        cleaned.append(line)

    result = "\n".join(cleaned)
    # Collapse excess blank lines
    result = _re.sub(r"\n{3,}", "\n\n", result).strip()
    return result


def best_medal(medals: list[str]) -> str:
    """Return the best medal from a list, using the hierarchy."""
    best = None
    best_rank = 999
    for m in medals:
        rank = MEDAL_RANK.get(m, 999)
        if rank < best_rank:
            best_rank = rank
            best = m
    return best or ""


def medal_to_code(medal: str) -> str:
    """Convert a medal name to a single-character code."""
    return MEDAL_CODE.get(medal, "")


# ---------------------------------------------------------------------------
# Export functions
# ---------------------------------------------------------------------------

def export_stats(conn: sqlite3.Connection, out_dir: str, gender_map: dict[str, str]):
    """Export overall statistics."""
    logger.info("Exporting stats.json...")

    total_results = conn.execute("SELECT COUNT(*) FROM results").fetchone()[0]

    # Count only finishes (exclude DNF/DNS)
    total_finishes = conn.execute("""
        SELECT COUNT(*) FROM results
        WHERE medal != '' AND medal IS NOT NULL
        AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
    """).fetchone()[0]

    unique_athletes = conn.execute(
        "SELECT COUNT(DISTINCT UPPER(athlete_id)) FROM results WHERE athlete_id != '' AND athlete_id IS NOT NULL"
    ).fetchone()[0]

    years_with_data = conn.execute(
        "SELECT COUNT(DISTINCT year) FROM results"
    ).fetchone()[0]

    countries = conn.execute(
        "SELECT COUNT(DISTINCT country) FROM results WHERE country != '' AND country IS NOT NULL"
    ).fetchone()[0]

    all_clubs = conn.execute(
        "SELECT DISTINCT club FROM results WHERE club != '' AND club IS NOT NULL"
    ).fetchall()
    clubs = sum(1 for (c,) in all_clubs if clean_club(c))

    min_year = conn.execute("SELECT MIN(year) FROM results").fetchone()[0]
    max_year = conn.execute("SELECT MAX(year) FROM results").fetchone()[0]

    # Gender breakdown
    male_athletes = sum(1 for g in gender_map.values() if g == 'M')
    female_athletes = sum(1 for g in gender_map.values() if g == 'F')

    # Count finishes by gender
    rows = conn.execute("""
        SELECT UPPER(athlete_id), COUNT(*) FROM results
        WHERE athlete_id IS NOT NULL AND athlete_id != ''
        AND medal != '' AND medal IS NOT NULL
        AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
        GROUP BY UPPER(athlete_id)
    """).fetchall()
    male_finishes = sum(cnt for aid, cnt in rows if gender_map.get(aid) == 'M')
    female_finishes = sum(cnt for aid, cnt in rows if gender_map.get(aid) == 'F')

    # Average finishes per runner by gender, broken down by direction
    directions = dict(conn.execute(
        "SELECT year, direction FROM race_info WHERE direction IS NOT NULL AND direction != ''"
    ).fetchall())

    finish_rows = conn.execute("""
        SELECT UPPER(athlete_id), year FROM results
        WHERE athlete_id IS NOT NULL AND athlete_id != ''
        AND medal != '' AND medal IS NOT NULL
        AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
        AND time IS NOT NULL AND time != '' AND time NOT IN ('DNF', 'DNS', 'DQ')
        AND time LIKE '%:%'
        AND pos IS NOT NULL AND pos != '' AND CAST(pos AS INTEGER) > 0
    """).fetchall()

    athlete_counts: dict[str, dict] = defaultdict(lambda: {"total": 0, "up": 0, "down": 0})
    for aid, yr in finish_rows:
        d = directions.get(yr, "")
        athlete_counts[aid]["total"] += 1
        if d == "Up":
            athlete_counts[aid]["up"] += 1
        elif d == "Down":
            athlete_counts[aid]["down"] += 1

    def _avg_finishes(gender_filter: str | None) -> dict:
        if gender_filter:
            runners = {a: c for a, c in athlete_counts.items() if gender_map.get(a) == gender_filter}
        else:
            runners = dict(athlete_counts)
        n = len(runners)
        if n == 0:
            return {"count": 0, "avgTotal": 0, "avgUp": 0, "avgDown": 0}
        return {
            "count": n,
            "avgTotal": round(sum(c["total"] for c in runners.values()) / n, 2),
            "avgUp": round(sum(c["up"] for c in runners.values()) / n, 2),
            "avgDown": round(sum(c["down"] for c in runners.values()) / n, 2),
        }

    avg_finishes = {
        "all": _avg_finishes(None),
        "male": _avg_finishes("M"),
        "female": _avg_finishes("F"),
    }

    stats = {
        "totalResults": total_results,
        "totalFinishes": total_finishes,
        "uniqueAthletes": unique_athletes,
        "racesHeld": years_with_data,
        "countries": countries,
        "clubs": clubs,
        "yearRange": [min_year, max_year],
        "maleAthletes": male_athletes,
        "femaleAthletes": female_athletes,
        "maleFinishes": male_finishes,
        "femaleFinishes": female_finishes,
        "avgFinishes": avg_finishes,
    }

    write_json(os.path.join(out_dir, "stats.json"), stats)
    logger.info(f"  stats.json: {json.dumps(stats, indent=2)[:300]}")


def export_years(conn: sqlite3.Connection, out_dir: str, gender_map: dict[str, str]):
    """Export per-year summary data for charts and year explorer."""
    logger.info("Exporting years.json...")

    years_data = []

    # Get all years from results
    result_years = conn.execute(
        "SELECT DISTINCT year FROM results ORDER BY year"
    ).fetchall()

    for (year,) in result_years:
        # Get race_info metadata if available
        ri = conn.execute(
            "SELECT date, weather, direction, race_number, official_distance, "
            "starters, finishers_total, entries, pct_finishers_starters, "
            "cancelled, narrative FROM race_info WHERE year = ?",
            (year,)
        ).fetchone()

        # Count finishers from results table
        finisher_count = conn.execute("""
            SELECT COUNT(*) FROM results
            WHERE year = ? AND medal != '' AND medal IS NOT NULL
            AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
        """, (year,)).fetchone()[0]

        total_count = conn.execute(
            "SELECT COUNT(*) FROM results WHERE year = ?", (year,)
        ).fetchone()[0]

        # Get winner(s) - overall (pos = 1 or smallest pos)
        winner_men = conn.execute("""
            SELECT name, time, UPPER(athlete_id) FROM results
            WHERE year = ? AND pos = '1' AND time != '' AND time IS NOT NULL
            AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
            ORDER BY time ASC LIMIT 1
        """, (year,)).fetchone()

        # Get women's winner (gender_pos = 1 among females)
        winner_women = None
        women_candidates = conn.execute("""
            SELECT UPPER(athlete_id), name, time FROM results
            WHERE year = ? AND gender_pos = '1' AND time != '' AND time IS NOT NULL
            AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
            ORDER BY time ASC
        """, (year,)).fetchall()
        for wc in women_candidates:
            if gender_map.get(wc[0]) == 'F':
                winner_women = (wc[1], wc[2], wc[0])
                break

        # Count finishers by gender
        finisher_rows = conn.execute("""
            SELECT UPPER(athlete_id) FROM results
            WHERE year = ? AND medal != '' AND medal IS NOT NULL
            AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
        """, (year,)).fetchall()
        male_finishers = sum(1 for r in finisher_rows if gender_map.get(r[0]) == 'M')
        female_finishers = sum(1 for r in finisher_rows if gender_map.get(r[0]) == 'F')

        # Get medal distribution for this year
        medals = {}
        for row in conn.execute("""
            SELECT medal, COUNT(*) FROM results
            WHERE year = ? AND medal != '' AND medal IS NOT NULL
            AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
            GROUP BY medal
        """, (year,)).fetchall():
            medals[row[0]] = row[1]

        entry = {
            "year": year,
            "finishers": finisher_count,
            "totalEntries": total_count,
            "medals": medals,
        }

        entry["maleFinishers"] = male_finishers
        entry["femaleFinishers"] = female_finishers

        if winner_men:
            entry["winner"] = {"name": winner_men[0], "time": winner_men[1], "athleteId": winner_men[2]}
        if winner_women:
            entry["winnerWomen"] = {"name": winner_women[0], "time": winner_women[1], "athleteId": winner_women[2]}

        if ri:
            date, weather, direction, race_number, distance, starters, finishers_total, \
                entries, pct, cancelled, narrative = ri
            entry["date"] = date or ""
            entry["weather"] = weather or ""
            entry["direction"] = direction or ""
            entry["raceNumber"] = race_number or ""
            entry["distance"] = distance or ""
            entry["cancelled"] = bool(cancelled)

            # Use race_info starters/finishers if available (more accurate)
            if starters and starters.isdigit():
                entry["starters"] = int(starters)
            if finishers_total and finishers_total.isdigit():
                entry["officialFinishers"] = int(finishers_total)
            if entries:
                # entries may contain commas or text
                try:
                    entry["entries"] = int(entries.replace(",", "").strip())
                except ValueError:
                    pass
            if pct:
                try:
                    entry["finishRate"] = float(pct.replace("%", "").strip())
                except ValueError:
                    pass

            # Include narrative length but not the full text (too large for this file)
            if narrative:
                entry["narrativeLength"] = len(narrative)

        years_data.append(entry)

    # ---------------------------------------------------------------
    # Compute course record flags (running best times by direction)
    # ---------------------------------------------------------------
    def _time_str_to_secs(t: str) -> int | None:
        if not t:
            return None
        parts = t.split(":")
        if len(parts) == 3:
            try:
                return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
            except ValueError:
                return None
        return None

    years_sorted = sorted(years_data, key=lambda y: y["year"])

    men_overall = None
    men_up = None
    men_down = None
    women_overall = None
    women_up = None
    women_down = None

    for y in years_sorted:
        if y.get("cancelled"):
            continue
        d = y.get("direction", "")
        records: list[str] = []

        # Men's records
        w = y.get("winner")
        if w:
            secs = _time_str_to_secs(w["time"])
            if secs and secs >= 16000:  # sanity: > ~4:26
                if men_overall is None or secs < men_overall:
                    men_overall = secs
                    records.append("overall")
                if d == "Up" and (men_up is None or secs < men_up):
                    men_up = secs
                    if "overall" not in records:
                        records.append("up")
                if d == "Down" and (men_down is None or secs < men_down):
                    men_down = secs
                    if "overall" not in records:
                        records.append("down")

        women_records: list[str] = []
        ww = y.get("winnerWomen")
        if ww:
            secs = _time_str_to_secs(ww["time"])
            if secs and secs >= 18000:  # sanity: > 5:00
                if women_overall is None or secs < women_overall:
                    women_overall = secs
                    women_records.append("overall")
                if d == "Up" and (women_up is None or secs < women_up):
                    women_up = secs
                    if "overall" not in women_records:
                        women_records.append("up")
                if d == "Down" and (women_down is None or secs < women_down):
                    women_down = secs
                    if "overall" not in women_records:
                        women_records.append("down")

        if records:
            y["menRecords"] = records
        if women_records:
            y["womenRecords"] = women_records

    record_count = sum(1 for y in years_data if y.get("menRecords") or y.get("womenRecords"))
    logger.info(f"  Course records flagged: {record_count} years with records")

    write_json(os.path.join(out_dir, "years.json"), years_data)
    logger.info(f"  years.json: {len(years_data)} years")


def export_leaderboards(conn: sqlite3.Connection, out_dir: str, gender_map: dict[str, str],
                        club_country_fixes: dict[str, str] | None = None):
    """Export leaderboard data."""
    logger.info("Exporting leaderboards.json...")

    # Most finishes (top 200)
    most_finishes = []
    rows = conn.execute("""
        SELECT UPPER(athlete_id) as uid, name, COUNT(*) as finishes,
               MIN(year) as first_year, MAX(year) as last_year,
               GROUP_CONCAT(DISTINCT medal) as medals
        FROM results
        WHERE athlete_id != '' AND athlete_id IS NOT NULL
        AND medal != '' AND medal IS NOT NULL
        AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
        GROUP BY uid
        ORDER BY finishes DESC
        LIMIT 2000
    """).fetchall()

    all_runners = []
    for row in rows:
        athlete_id, name, finishes, first_year, last_year, medals_str = row
        medal_list = [m.strip() for m in (medals_str or "").split(",") if m.strip()]
        all_runners.append({
            "athleteId": athlete_id,
            "name": name,
            "finishes": finishes,
            "firstYear": first_year,
            "lastYear": last_year,
            "bestMedal": best_medal(medal_list),
            "gender": gender_map.get(athlete_id, "M"),
        })

    # Include all runners with 30+ finishes (typically ~220), minimum 200
    cutoff = max(200, sum(1 for r in all_runners if r["finishes"] >= 30))
    for i, r in enumerate(all_runners[:cutoff]):
        most_finishes.append({**r, "rank": i + 1})

    # Get top 200 women separately
    most_finishes_women = []
    women_runners = [r for r in all_runners if r["gender"] == "F"]
    for i, r in enumerate(women_runners[:200]):
        most_finishes_women.append({**r, "rank": i + 1})

    # Fastest winning times (all years, pos = 1)
    fastest_times = []
    rows = conn.execute("""
        SELECT r.year, r.name, r.time,
               COALESCE(ri.direction, '') as direction,
               UPPER(r.athlete_id) as uid
        FROM results r
        LEFT JOIN race_info ri ON r.year = ri.year
        WHERE r.pos = '1' AND r.time != '' AND r.time IS NOT NULL
        AND r.time != '00:00:00'
        AND r.medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
        ORDER BY r.time ASC
    """).fetchall()

    seen_years = set()
    for row in rows:
        year, name, time_str, direction, uid = row
        if year in seen_years:
            continue
        seen_years.add(year)
        fastest_times.append({
            "rank": len(fastest_times) + 1,
            "year": year,
            "name": name,
            "time": time_str,
            "direction": direction,
            "athleteId": uid,
        })

    # Fastest winning times for women (gender_pos = 1 among females)
    fastest_times_women = []
    rows = conn.execute("""
        SELECT r.year, r.name, r.time,
               COALESCE(ri.direction, '') as direction,
               UPPER(r.athlete_id) as uid
        FROM results r
        LEFT JOIN race_info ri ON r.year = ri.year
        WHERE r.gender_pos = '1' AND r.time != '' AND r.time IS NOT NULL
        AND r.time != '00:00:00'
        AND r.medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
        ORDER BY r.time ASC
    """).fetchall()

    seen_years_w = set()
    for row in rows:
        year, name, time_str, direction, uid = row
        if gender_map.get(uid) != 'F':
            continue
        if year in seen_years_w:
            continue
        seen_years_w.add(year)
        fastest_times_women.append({
            "rank": len(fastest_times_women) + 1,
            "year": year,
            "name": name,
            "time": time_str,
            "direction": direction,
            "athleteId": uid,
        })

    # Top clubs (top 200) — excluding country-as-club and junk placeholders
    top_clubs = []
    rows = conn.execute("""
        SELECT club, COUNT(*) as total_finishes,
               COUNT(DISTINCT UPPER(athlete_id)) as unique_runners
        FROM results
        WHERE club != '' AND club IS NOT NULL
        AND medal != '' AND medal IS NOT NULL
        AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
        GROUP BY club
        ORDER BY total_finishes DESC
    """).fetchall()

    rank = 0
    for row in rows:
        if not clean_club(row[0]):
            continue  # skip country names and junk placeholders
        rank += 1
        top_clubs.append({
            "rank": rank,
            "club": row[0],
            "totalFinishes": row[1],
            "uniqueRunners": row[2],
        })
        if rank >= 200:
            break

    # Top countries — use same logic as export_country_details for consistency
    club_fixes = club_country_fixes or {}
    top_countries = []
    country_rows = conn.execute("""
        SELECT UPPER(athlete_id), country
        FROM results
        WHERE medal != '' AND medal IS NOT NULL
        AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
        AND time IS NOT NULL AND time != '' AND time LIKE '%:%'
        AND time NOT IN ('DNF', 'DNS', 'DQ', '00:00:00')
        AND pos IS NOT NULL AND pos != '' AND CAST(pos AS INTEGER) > 0
        AND year <= 2025
    """).fetchall()

    # Build athlete -> primary country (most common non-empty country)
    athlete_country_counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for uid, country in country_rows:
        if country and country.strip():
            athlete_country_counts[uid][country] += 1
    athlete_primary_country: dict[str, str] = {}
    for uid, cc in athlete_country_counts.items():
        athlete_primary_country[uid] = max(cc, key=cc.get)

    # Count finishes per effective country (with corrections applied, grouped by cleaned name)
    country_finish_counts: dict[str, int] = defaultdict(int)
    country_unique_runners: dict[str, set] = defaultdict(set)
    for uid, country in country_rows:
        if uid in ATHLETE_COUNTRY_CORRECTIONS:
            effective = ATHLETE_COUNTRY_CORRECTIONS[uid]
        elif uid in club_fixes:
            effective = club_fixes[uid]
        elif country and country.strip():
            effective = country
        else:
            effective = athlete_primary_country.get(uid, "")
        if not effective:
            continue
        # Group by cleaned name to merge variants like "Netherlands" / "Netherlands (the)"
        cleaned = clean_country_name(effective)
        country_finish_counts[cleaned] += 1
        country_unique_runners[cleaned].add(uid)

    exclude_countries = {"", "ANA", "International"}
    sorted_countries = sorted(country_finish_counts.items(), key=lambda x: -x[1])
    rank = 0
    for display, total in sorted_countries:
        if display in exclude_countries:
            continue
        rank += 1
        top_countries.append({
            "rank": rank,
            "country": display,
            "slug": slugify_country(display),
            "flag": country_to_flag(display),
            "totalFinishes": total,
            "uniqueRunners": len(country_unique_runners[display]),
        })

    data = {
        "mostFinishes": most_finishes,
        "mostFinishesWomen": most_finishes_women,
        "fastestTimes": fastest_times,
        "fastestTimesWomen": fastest_times_women,
        "topClubs": top_clubs,
        "topCountries": top_countries,
    }

    write_json(os.path.join(out_dir, "leaderboards.json"), data)
    logger.info(f"  leaderboards.json: {len(most_finishes)} runners, "
                f"{len(fastest_times)} times (men), {len(fastest_times_women)} times (women), "
                f"{len(top_clubs)} clubs, {len(top_countries)} countries")


def export_search_index(conn: sqlite3.Connection, out_dir: str, gender_map: dict[str, str]):
    """Export search index split by first letter of surname."""
    logger.info("Exporting search index...")

    search_dir = os.path.join(out_dir, "search")
    os.makedirs(search_dir, exist_ok=True)

    # Build athlete data (normalize athlete_id to uppercase to merge case variants)
    rows = conn.execute("""
        SELECT UPPER(athlete_id) as uid, name,
               COUNT(*) as finishes,
               MIN(year) as first_year,
               MAX(year) as last_year,
               GROUP_CONCAT(DISTINCT medal) as medals
        FROM results
        WHERE athlete_id != '' AND athlete_id IS NOT NULL
        AND medal != '' AND medal IS NOT NULL
        AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
        GROUP BY uid
        ORDER BY name
    """).fetchall()

    # Also find all distinct name variants per athlete (for athletes with multiple names)
    name_variants = conn.execute("""
        SELECT UPPER(athlete_id) as uid, GROUP_CONCAT(DISTINCT name) as names
        FROM results
        WHERE athlete_id != '' AND athlete_id IS NOT NULL
        GROUP BY uid
        HAVING COUNT(DISTINCT name) > 1
    """).fetchall()
    variant_map: dict[str, list[str]] = {}
    for uid, names_str in name_variants:
        variant_map[uid] = [n.strip() for n in names_str.split(",") if n.strip()]

    # Group by first letter of surname (last word of name)
    buckets = defaultdict(list)
    seen: set[tuple[str, str]] = set()  # (athlete_id, name) to avoid duplicates
    for row in rows:
        athlete_id, name, finishes, first_year, last_year, medals_str = row
        medal_list = [m.strip() for m in (medals_str or "").split(",") if m.strip()]
        best = best_medal(medal_list)
        gender = gender_map.get(athlete_id, "")
        entry_data = [finishes, first_year, last_year, medal_to_code(best), gender]

        # Add primary name
        all_names = [name]
        # Add any alternate names for this athlete
        if athlete_id in variant_map:
            for alt in variant_map[athlete_id]:
                if alt != name and (athlete_id, alt) not in seen:
                    all_names.append(alt)

        for n in all_names:
            key = (athlete_id, n)
            if key in seen:
                continue
            seen.add(key)
            parts = n.strip().split()
            surname = parts[-1] if parts else n
            letter = surname[0].lower() if surname and surname[0].isalpha() else "other"
            buckets[letter].append([n, athlete_id] + entry_data)

    total_entries = 0
    for letter, entries in sorted(buckets.items()):
        # Sort by name within each bucket
        entries.sort(key=lambda x: x[0].lower())
        filename = os.path.join(search_dir, f"{letter}.json")
        write_json(filename, entries)
        total_entries += len(entries)
        logger.info(f"  search/{letter}.json: {len(entries)} runners")

    logger.info(f"  Total search entries: {total_entries}")


def export_runner_buckets(conn: sqlite3.Connection, out_dir: str, gender_map: dict[str, str],
                          club_country_fixes: dict[str, str] | None = None):
    """Export runner race histories grouped by UUID prefix."""
    logger.info("Exporting runner buckets...")
    club_country_fixes = club_country_fixes or {}

    runners_dir = os.path.join(out_dir, "runners")
    os.makedirs(runners_dir, exist_ok=True)

    # Get all results grouped by athlete (normalize athlete_id to uppercase)
    rows = conn.execute("""
        SELECT UPPER(athlete_id) as uid, name, year, time, pos, medal, club, country,
               category, category_pos, gender_pos, race_no
        FROM results
        WHERE athlete_id != '' AND athlete_id IS NOT NULL
        ORDER BY uid, year
    """).fetchall()

    # Group into buckets by first 2 chars of UUID
    buckets = defaultdict(dict)
    for row in rows:
        athlete_id, name, year, time_str, pos, medal, club, country, \
            category, category_pos, gender_pos, race_no = row

        prefix = athlete_id[:2].upper()

        if athlete_id not in buckets[prefix]:
            buckets[prefix][athlete_id] = {
                "name": name,
                "gender": gender_map.get(athlete_id, ""),
                "races": []
            }

        # Determine country: manual corrections > club-inferred > original
        raw_country = ATHLETE_COUNTRY_CORRECTIONS.get(
            athlete_id,
            club_country_fixes.get(athlete_id, country or "")
        )
        # Normalize time and medal
        norm_time = normalize_time(time_str or "")
        corrected_medal = MEDAL_CORRECTIONS.get((athlete_id, year), medal or "")
        corrected_medal = normalize_nonfinish_medal(norm_time, corrected_medal)
        race = {
            "year": year,
            "time": norm_time,
            "pos": pos or "",
            "medal": corrected_medal,
            "club": clean_club(club),
            "country": clean_country_name(raw_country),
        }
        if race_no:
            race["raceNo"] = race_no
        if category:
            race["category"] = category
        if category_pos:
            race["categoryPos"] = category_pos
        if gender_pos:
            race["genderPos"] = gender_pos

        buckets[prefix][athlete_id]["races"].append(race)
        # Update name to the latest
        buckets[prefix][athlete_id]["name"] = name

    total_files = 0
    for prefix, athletes in sorted(buckets.items()):
        filename = os.path.join(runners_dir, f"{prefix}.json")
        write_json(filename, athletes)
        total_files += 1

    logger.info(f"  {total_files} bucket files written")


# ---------------------------------------------------------------------------
# Insights helpers
# ---------------------------------------------------------------------------

def normalize_category(cat: str) -> str | None:
    """Normalize varying age category formats across years."""
    if not cat:
        return None
    cat = cat.strip()
    if cat == "Senior":
        return "Senior"
    if cat in ("40", "40 to 49", "40-49"):
        return "40-49"
    if cat in ("50", "50 to 59", "50-59"):
        return "50-59"
    if cat in ("60", "60+", "60-69", "70+"):
        return "60+"
    return None  # Wheelchair, other edge cases


class RecordTracker:
    """Tracks running best (course record) with previous holder info."""

    def __init__(self):
        self.best_secs: int | None = None
        self.best_holder: str = ""
        self.best_year: int = 0

    def check(self, secs: int, holder: str, year: int) -> dict | None:
        """Check if secs sets a new record.

        Returns:
            - ``False`` (no record set)
            - ``{}`` (first-ever record, no previous)
            - ``{time, holder, year}`` (broke previous record)
        """
        if self.best_secs is None or secs < self.best_secs:
            prev: dict | bool = {}
            if self.best_secs is not None:
                prev = {
                    "time": seconds_to_time(self.best_secs),
                    "holder": self.best_holder,
                    "year": self.best_year,
                }
            self.best_secs = secs
            self.best_holder = holder
            self.best_year = year
            return prev  # {} for first-ever, dict for broken record
        return False  # type: ignore[return-value]  # Not a record


def time_to_seconds(time_str: str) -> int | None:
    """Convert HH:MM:SS to total seconds."""
    if not time_str or ":" not in time_str or time_str == "00:00:00":
        return None
    parts = time_str.split(":")
    if len(parts) != 3:
        return None
    try:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    except (ValueError, IndexError):
        return None


def seconds_to_time(secs: int) -> str:
    """Convert total seconds to HH:MM:SS."""
    h = secs // 3600
    m = (secs % 3600) // 60
    s = secs % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


def _parse_distance_km(dist_str: str) -> float | None:
    """Parse official_distance string from race_info into km.

    Handles formats like:
    - "54 M", "54.0 M" → miles to km
    - "86.700 km", "89.208 kms" → km
    - "889.518 km (...)" → divide by 10 (typo fix)
    - "86.7 kms (53miles 890 yards)" → km part
    """
    import re
    s = dist_str.strip().lower()
    # Try extracting numeric + unit
    m = re.match(r"([\d.]+)\s*(m|miles?|km|kms?)", s)
    if not m:
        return None
    val = float(m.group(1))
    unit = m.group(2)
    if unit in ("m", "mile", "miles"):
        return val * 1.60934
    elif unit in ("km", "kms"):
        # Sanity: if > 200 km it's likely a typo (e.g. 889.518 → 88.9518)
        if val > 200:
            val = val / 10
        return val
    return None


def _pace_to_display(sec_per_km: float) -> str:
    """Convert pace in seconds/km to M:SS/km display string."""
    m = int(sec_per_km // 60)
    s = int(sec_per_km % 60)
    return f"{m}:{s:02d}/km"


def get_valid_race_years(conn: sqlite3.Connection) -> list[int]:
    """Get sorted list of years where a race actually happened (not cancelled)."""
    cancelled = set()
    for row in conn.execute("SELECT year FROM race_info WHERE cancelled = 1").fetchall():
        cancelled.add(row[0])
    all_years = sorted(set(
        r[0] for r in conn.execute("SELECT DISTINCT year FROM results").fetchall()
    ))
    return [y for y in all_years if y not in cancelled]


def is_consecutive_race_year(y1: int, y2: int, valid_years: list[int]) -> bool:
    """Check if y2 is the next race year after y1 (handling cancelled years)."""
    try:
        idx = valid_years.index(y1)
        return idx + 1 < len(valid_years) and valid_years[idx + 1] == y2
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Insights export
# ---------------------------------------------------------------------------

def export_insights(conn: sqlite3.Connection, out_dir: str, gender_map: dict[str, str]):
    """Export pre-computed statistical insights."""
    logger.info("Exporting insights.json...")

    valid_years = get_valid_race_years(conn)
    # Exclude 2026 (entries only, race hasn't happened)
    valid_years = [y for y in valid_years if y <= 2025]

    # Build direction map and distance map from race_info
    direction_map = {}
    distance_km_map: dict[int, float] = {}
    for row in conn.execute("SELECT year, direction, official_distance FROM race_info WHERE direction IS NOT NULL AND direction != ''"):
        direction_map[row[0]] = row[1]
        dist_str = (row[2] or "").strip()
        if dist_str:
            dist_km = _parse_distance_km(dist_str)
            if dist_km and 50 < dist_km < 120:  # sanity check
                distance_km_map[row[0]] = dist_km

    # ---------------------------------------------------------------
    # Step 1: Build per-athlete attempt sequences (reused by many insights)
    # ---------------------------------------------------------------
    logger.info("  Building athlete attempt sequences...")
    rows = conn.execute("""
        SELECT UPPER(athlete_id) as uid, year, medal, time, pos, category
        FROM results
        WHERE athlete_id IS NOT NULL AND athlete_id != ''
        AND year <= 2025
        ORDER BY UPPER(athlete_id), year
    """).fetchall()

    # Group by athlete
    athlete_attempts: dict[str, list[dict]] = defaultdict(list)
    for uid, year, medal, time_str, pos, category in rows:
        finished = is_finish(medal or "", time_str or "", pos or "")
        secs = time_to_seconds(time_str or "") if finished else None
        athlete_attempts[uid].append({
            "year": year,
            "finished": finished,
            "medal": medal or "",
            "time_secs": secs,
            "category": category or "",
        })

    logger.info(f"  {len(athlete_attempts):,} athletes with attempt sequences")

    # ---------------------------------------------------------------
    # Insight 1: Green Number Effect
    # ---------------------------------------------------------------
    logger.info("  Computing green number effect...")
    # For each attempt, count how many finishes the athlete had before it
    nth_potential = defaultdict(lambda: {"attempts": 0, "finishes": 0})

    for uid, attempts in athlete_attempts.items():
        finish_count = 0
        for att in attempts:
            potential_nth = finish_count + 1  # If they finish, this would be their Nth
            if potential_nth <= 30:
                nth_potential[potential_nth]["attempts"] += 1
                if att["finished"]:
                    nth_potential[potential_nth]["finishes"] += 1
            if att["finished"]:
                finish_count += 1

    green_number_data = []
    for nth in range(1, 31):
        d = nth_potential[nth]
        rate = round(d["finishes"] / d["attempts"] * 100, 1) if d["attempts"] > 0 else 0
        green_number_data.append({
            "nth": nth,
            "attempts": d["attempts"],
            "finishes": d["finishes"],
            "rate": rate,
        })

    # Summary
    def get_rate(nth):
        d = nth_potential[nth]
        return round(d["finishes"] / d["attempts"] * 100, 1) if d["attempts"] > 0 else 0

    green_summary = {
        "rateAttempting10th": get_rate(10),
        "rateAttempting11th": get_rate(11),
        "effectSize10": round(get_rate(10) - get_rate(11), 1),
        "rateAttempting20th": get_rate(20),
        "rateAttempting21st": get_rate(21),
        "effectSize20": round(get_rate(20) - get_rate(21), 1),
    }

    # ---------------------------------------------------------------
    # Insight 2: Back-to-Back Medal Analysis
    # ---------------------------------------------------------------
    logger.info("  Computing back-to-back analysis...")

    first_time_finishers = 0
    returned_next_race = 0
    returned_and_finished = 0
    consecutive_attempts = 0
    consecutive_finishes = 0
    non_consecutive_attempts = 0
    non_consecutive_finishes = 0

    streak_counts = defaultdict(int)  # streak_length -> count of athletes who had that max streak

    for uid, attempts in athlete_attempts.items():
        # First-timer return analysis
        first_finish_idx = None
        for i, att in enumerate(attempts):
            if att["finished"]:
                first_finish_idx = i
                break

        if first_finish_idx is not None:
            first_time_finishers += 1
            first_year = attempts[first_finish_idx]["year"]
            # Check if they came back the next race year
            for j in range(first_finish_idx + 1, len(attempts)):
                next_year = attempts[j]["year"]
                if is_consecutive_race_year(first_year, next_year, valid_years):
                    returned_next_race += 1
                    if attempts[j]["finished"]:
                        returned_and_finished += 1
                    break

        # Consecutive vs non-consecutive finish rates
        # Also track streaks
        current_streak = 0
        max_streak = 0
        for i, att in enumerate(attempts):
            is_consec = False
            if i > 0:
                prev_year = attempts[i - 1]["year"]
                this_year = att["year"]
                is_consec = is_consecutive_race_year(prev_year, this_year, valid_years)
                # Did the previous attempt result in a finish?
                prev_finished = attempts[i - 1]["finished"]

                if is_consec and prev_finished:
                    consecutive_attempts += 1
                    if att["finished"]:
                        consecutive_finishes += 1
                elif i > 0:  # Not consecutive or prev didn't finish
                    non_consecutive_attempts += 1
                    if att["finished"]:
                        non_consecutive_finishes += 1

            # Track consecutive finish streaks
            if att["finished"]:
                if i == 0 or not is_consec:
                    current_streak = 1
                else:
                    if attempts[i - 1]["finished"]:
                        current_streak += 1
                    else:
                        current_streak = 1
            else:
                current_streak = 0
            max_streak = max(max_streak, current_streak)

        if max_streak >= 2:
            streak_counts[max_streak] += 1

    # ------- First-timer B2B rate by year, with direction context -------
    # Build per-year first-timer sets
    first_finish_year_map: dict[str, int] = {}  # uid -> first finish year
    for uid, attempts in athlete_attempts.items():
        for att in attempts:
            if att["finished"]:
                first_finish_year_map[uid] = att["year"]
                break

    # Group first-timers by year
    first_timers_by_year: dict[int, list[str]] = defaultdict(list)
    for uid, yr in first_finish_year_map.items():
        first_timers_by_year[yr].append(uid)

    # For each year, check how many first-timers came back and finished the next race year
    # Build a set of finisher UIDs per year for quick lookup
    finishers_by_year: dict[int, set[str]] = defaultdict(set)
    for uid, attempts in athlete_attempts.items():
        for att in attempts:
            if att["finished"]:
                finishers_by_year[att["year"]].add(uid)

    b2b_by_year = []
    for yr in sorted(first_timers_by_year.keys()):
        if yr < 1975:
            continue
        # Find next race year
        try:
            idx = valid_years.index(yr)
        except ValueError:
            continue
        if idx + 1 >= len(valid_years):
            continue
        next_yr = valid_years[idx + 1]

        ft_list = first_timers_by_year[yr]
        ft_count = len(ft_list)
        came_back = sum(1 for uid in ft_list if uid in finishers_by_year[next_yr])
        b2b_rate = round(came_back / ft_count * 100, 1) if ft_count > 0 else 0

        dir_this = direction_map.get(yr, "")
        dir_next = direction_map.get(next_yr, "")
        same_dir = dir_this == dir_next if dir_this and dir_next else None

        b2b_by_year.append({
            "year": yr,
            "nextYear": next_yr,
            "firstTimers": ft_count,
            "cameBack": came_back,
            "b2bRate": b2b_rate,
            "direction": dir_this,
            "nextDirection": dir_next,
            "sameDirection": same_dir,
        })

    # Compute medal effect: pre-2016 vs 2016+
    pre_medal = [e for e in b2b_by_year if e["year"] < 2016 and e["year"] >= 1975]
    medal_era = [e for e in b2b_by_year if e["year"] >= 2016]
    pre_medal_clean = [e for e in b2b_by_year if 2010 <= e["year"] <= 2015]
    medal_era_clean = [e for e in b2b_by_year if 2016 <= e["year"] <= 2018]  # exclude 2019→2022 COVID gap

    # Same-dir vs different-dir averages
    same_dir_entries = [e for e in b2b_by_year if e["sameDirection"] is True]
    diff_dir_entries = [e for e in b2b_by_year if e["sameDirection"] is False]

    back_to_back = {
        "firstTimerReturn": {
            "totalFirstTimeFinishers": first_time_finishers,
            "returnedNextRace": returned_next_race,
            "returnRate": round(returned_next_race / first_time_finishers * 100, 1) if first_time_finishers > 0 else 0,
            "returnedAndFinished": returned_and_finished,
            "returnFinishRate": round(returned_and_finished / returned_next_race * 100, 1) if returned_next_race > 0 else 0,
        },
        "consecutiveVsNon": {
            "consecutiveAttempts": consecutive_attempts,
            "consecutiveFinishRate": round(consecutive_finishes / consecutive_attempts * 100, 1) if consecutive_attempts > 0 else 0,
            "nonConsecutiveAttempts": non_consecutive_attempts,
            "nonConsecutiveFinishRate": round(non_consecutive_finishes / non_consecutive_attempts * 100, 1) if non_consecutive_attempts > 0 else 0,
        },
        "streakDistribution": sorted(
            [{"streakLength": k, "count": v} for k, v in streak_counts.items()],
            key=lambda x: x["streakLength"]
        ),
        # New: year-by-year first-timer B2B rates with direction context
        "b2bByYear": b2b_by_year,
        "medalEffect": {
            "preMedalAvg": round(mean([e["b2bRate"] for e in pre_medal]), 1) if pre_medal else 0,
            "medalEraAvg": round(mean([e["b2bRate"] for e in medal_era]), 1) if medal_era else 0,
            "preCleanAvg": round(mean([e["b2bRate"] for e in pre_medal_clean]), 1) if pre_medal_clean else 0,
            "medalCleanAvg": round(mean([e["b2bRate"] for e in medal_era_clean]), 1) if medal_era_clean else 0,
        },
        "directionEffect": {
            "sameDirAvg": round(mean([e["b2bRate"] for e in same_dir_entries]), 1) if same_dir_entries else 0,
            "diffDirAvg": round(mean([e["b2bRate"] for e in diff_dir_entries]), 1) if diff_dir_entries else 0,
            "sameDirCount": len(same_dir_entries),
            "diffDirCount": len(diff_dir_entries),
        },
    }

    # ---------------------------------------------------------------
    # Insight 3: Slowdown Curve
    # ---------------------------------------------------------------
    logger.info("  Computing slowdown curve...")
    # For each athlete, compute time deltas between consecutive finishes
    transition_deltas: dict[int, list[int]] = defaultdict(list)  # nth -> list of deltas

    for uid, attempts in athlete_attempts.items():
        finish_times = []
        for att in attempts:
            if att["finished"] and att["time_secs"] is not None:
                finish_times.append(att["time_secs"])

        for i in range(1, min(len(finish_times), 21)):  # Up to 20 transitions
            delta = finish_times[i] - finish_times[i - 1]
            # Filter extreme outliers (>3 hours delta likely injury/age, not meaningful)
            if abs(delta) < 10800:
                transition_deltas[i].append(delta)

    slowdown_curve = []
    for i in range(1, 21):
        deltas = transition_deltas.get(i, [])
        if len(deltas) >= 50:  # Minimum sample size
            avg_delta = round(mean(deltas))
            slowdown_curve.append({
                "transition": f"{i}→{i+1}",
                "fromNth": i,
                "toNth": i + 1,
                "avgDeltaSeconds": avg_delta,
                "count": len(deltas),
            })

    # ---------------------------------------------------------------
    # Insight 4: Average Finish Times by Age Category
    # ---------------------------------------------------------------
    logger.info("  Computing average times by age...")
    # By year and category
    age_time_data: dict[tuple[int, str], list[int]] = defaultdict(list)
    age_time_overall: dict[str, list[int]] = defaultdict(list)

    for uid, attempts in athlete_attempts.items():
        for att in attempts:
            if att["finished"] and att["time_secs"] is not None:
                norm_cat = normalize_category(att["category"])
                if norm_cat:
                    age_time_data[(att["year"], norm_cat)].append(att["time_secs"])
                    age_time_overall[norm_cat].append(att["time_secs"])

    # Group by decade for cleaner visualization
    decade_data: dict[tuple[int, str], list[int]] = defaultdict(list)
    for (year, cat), times in age_time_data.items():
        decade = (year // 10) * 10
        decade_data[(decade, cat)].extend(times)

    categories = ["Senior", "40-49", "50-59", "60+"]
    avg_times_by_decade = []
    for decade in sorted(set(d for d, _ in decade_data.keys())):
        entry = {"decade": decade}
        for cat in categories:
            times = decade_data.get((decade, cat), [])
            if len(times) >= 20:
                entry[cat] = seconds_to_time(round(mean(times)))
                entry[f"{cat}Seconds"] = round(mean(times))
        if len(entry) > 1:  # Has at least one category
            avg_times_by_decade.append(entry)

    avg_times_overall = {}
    for cat in categories:
        times = age_time_overall.get(cat, [])
        if times:
            avg_times_overall[cat] = {
                "avgTime": seconds_to_time(round(mean(times))),
                "avgSeconds": round(mean(times)),
                "count": len(times),
            }

    # ---------------------------------------------------------------
    # Insight 5: Medal Distribution by Age
    # ---------------------------------------------------------------
    logger.info("  Computing medal distribution by age...")
    medal_by_age: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

    for uid, attempts in athlete_attempts.items():
        for att in attempts:
            if att["finished"] and att["medal"] in MEDAL_RANK:
                norm_cat = normalize_category(att["category"])
                if norm_cat:
                    medal_by_age[norm_cat][att["medal"]] += 1

    # Convert to percentages
    medals_by_age_pct = {}
    medal_names = ["Gold", "Wally Hayward", "Isavel Roche-Kelly", "Silver",
                   "Bill Rowan", "Robert Mtshali", "Bronze", "Vic Clapham"]
    for cat in categories:
        total = sum(medal_by_age[cat].values())
        if total > 0:
            medals_by_age_pct[cat] = {
                m: round(medal_by_age[cat].get(m, 0) / total * 100, 1)
                for m in medal_names
            }
            medals_by_age_pct[cat]["total"] = total

    # ---------------------------------------------------------------
    # Insight 6: Up vs Down Performance (with pace-based analysis)
    # ---------------------------------------------------------------
    logger.info("  Computing up vs down performance (pace-adjusted)...")
    runner_up_times: dict[str, list[int]] = defaultdict(list)
    runner_down_times: dict[str, list[int]] = defaultdict(list)
    runner_up_paces: dict[str, list[float]] = defaultdict(list)
    runner_down_paces: dict[str, list[float]] = defaultdict(list)

    # Compute avg Up and Down distances
    up_distances = [d for y, d in distance_km_map.items() if direction_map.get(y) == "Up"]
    down_distances = [d for y, d in distance_km_map.items() if direction_map.get(y) == "Down"]
    avg_up_dist = round(mean(up_distances), 2) if up_distances else 0
    avg_down_dist = round(mean(down_distances), 2) if down_distances else 0

    for uid, attempts in athlete_attempts.items():
        for att in attempts:
            if att["finished"] and att["time_secs"] is not None:
                d = direction_map.get(att["year"])
                dist_km = distance_km_map.get(att["year"])
                if d == "Up":
                    runner_up_times[uid].append(att["time_secs"])
                    if dist_km:
                        runner_up_paces[uid].append(att["time_secs"] / dist_km)
                elif d == "Down":
                    runner_down_times[uid].append(att["time_secs"])
                    if dist_km:
                        runner_down_paces[uid].append(att["time_secs"] / dist_km)

    # Runners who have done both (by time)
    both_runners = set(runner_up_times.keys()) & set(runner_down_times.keys())
    faster_on_down = 0
    faster_on_up = 0
    up_avgs = []
    down_avgs = []

    for uid in both_runners:
        avg_up = mean(runner_up_times[uid])
        avg_down = mean(runner_down_times[uid])
        up_avgs.append(avg_up)
        down_avgs.append(avg_down)
        if avg_down < avg_up:
            faster_on_down += 1
        else:
            faster_on_up += 1

    # Runners who have pace data for both directions
    both_pace_runners = set(runner_up_paces.keys()) & set(runner_down_paces.keys())
    faster_on_down_pace = 0
    faster_on_up_pace = 0
    up_pace_avgs = []
    down_pace_avgs = []

    for uid in both_pace_runners:
        avg_up_pace = mean(runner_up_paces[uid])
        avg_down_pace = mean(runner_down_paces[uid])
        up_pace_avgs.append(avg_up_pace)
        down_pace_avgs.append(avg_down_pace)
        if avg_down_pace < avg_up_pace:
            faster_on_down_pace += 1
        else:
            faster_on_up_pace += 1

    avg_up_pace_val = round(mean(up_pace_avgs), 1) if up_pace_avgs else 0
    avg_down_pace_val = round(mean(down_pace_avgs), 1) if down_pace_avgs else 0

    up_vs_down = {
        "runnersWithBoth": len(both_runners),
        "avgUpTime": seconds_to_time(round(mean(up_avgs))) if up_avgs else "",
        "avgDownTime": seconds_to_time(round(mean(down_avgs))) if down_avgs else "",
        "avgUpSeconds": round(mean(up_avgs)) if up_avgs else 0,
        "avgDownSeconds": round(mean(down_avgs)) if down_avgs else 0,
        "avgDifferenceSeconds": round(mean(up_avgs) - mean(down_avgs)) if up_avgs else 0,
        "fasterOnDown": round(faster_on_down / len(both_runners) * 100, 1) if both_runners else 0,
        "fasterOnUp": round(faster_on_up / len(both_runners) * 100, 1) if both_runners else 0,
        # Pace-based fields
        "avgUpDistanceKm": avg_up_dist,
        "avgDownDistanceKm": avg_down_dist,
        "distanceDifferenceKm": round(avg_down_dist - avg_up_dist, 2),
        "distanceDifferencePct": round((avg_down_dist - avg_up_dist) / avg_up_dist * 100, 1) if avg_up_dist else 0,
        "runnersWithBothPace": len(both_pace_runners),
        "avgUpPace": avg_up_pace_val,
        "avgUpPaceDisplay": _pace_to_display(avg_up_pace_val) if avg_up_pace_val else "",
        "avgDownPace": avg_down_pace_val,
        "avgDownPaceDisplay": _pace_to_display(avg_down_pace_val) if avg_down_pace_val else "",
        "paceDifferenceSecKm": round(avg_up_pace_val - avg_down_pace_val, 1) if avg_up_pace_val else 0,
        "fasterOnDownByPace": round(faster_on_down_pace / len(both_pace_runners) * 100, 1) if both_pace_runners else 0,
        "fasterOnUpByPace": round(faster_on_up_pace / len(both_pace_runners) * 100, 1) if both_pace_runners else 0,
    }

    # ---------------------------------------------------------------
    # Insight 7: DNF Rates by Attempt Number
    # ---------------------------------------------------------------
    logger.info("  Computing DNF rates by attempt number...")
    attempt_stats = defaultdict(lambda: {"total": 0, "dnfs": 0})

    for uid, attempts in athlete_attempts.items():
        for i, att in enumerate(attempts):
            attempt_num = i + 1
            if attempt_num <= 30:
                attempt_stats[attempt_num]["total"] += 1
                if not att["finished"]:
                    attempt_stats[attempt_num]["dnfs"] += 1

    dnf_by_attempt = []
    for n in range(1, 31):
        d = attempt_stats[n]
        if d["total"] >= 50:
            dnf_by_attempt.append({
                "attemptNumber": n,
                "total": d["total"],
                "dnfs": d["dnfs"],
                "dnfRate": round(d["dnfs"] / d["total"] * 100, 1),
            })

    # ---------------------------------------------------------------
    # Insight 8: Return Rates ("The Second Comrades Wall")
    # ---------------------------------------------------------------
    logger.info("  Computing return rates...")
    never_returned = 0
    gap_distribution = defaultdict(int)
    longest_gap = {"name": "", "gapYears": 0, "athleteId": ""}

    # Need name lookup
    name_lookup = {}
    for uid, attempts in athlete_attempts.items():
        if attempts:
            name_lookup[uid] = ""  # Will get from DB

    # Get names
    name_rows = conn.execute("""
        SELECT UPPER(athlete_id) as uid, name
        FROM results
        WHERE athlete_id IS NOT NULL AND athlete_id != ''
        GROUP BY uid
    """).fetchall()
    for uid, name in name_rows:
        name_lookup[uid] = name

    total_finishers = 0
    returned_counts = {"within1": 0, "within2": 0, "within3": 0, "after3": 0}

    for uid, attempts in athlete_attempts.items():
        # Find first finish
        first_finish_year = None
        for att in attempts:
            if att["finished"]:
                first_finish_year = att["year"]
                break
        if first_finish_year is None:
            continue

        total_finishers += 1

        # Find the next appearance after first finish
        found_return = False
        for att in attempts:
            if att["year"] > first_finish_year:
                gap = att["year"] - first_finish_year
                found_return = True
                if gap <= 1:
                    returned_counts["within1"] += 1
                elif gap <= 2:
                    returned_counts["within2"] += 1
                elif gap <= 3:
                    returned_counts["within3"] += 1
                else:
                    returned_counts["after3"] += 1
                break

        if not found_return:
            # Check if their only finish was in the last 2 years — exclude from "never returned"
            if first_finish_year < 2024:
                never_returned += 1

        # Find longest gap between any two consecutive appearances for comeback analysis
        years_appeared = [a["year"] for a in attempts]
        for i in range(1, len(years_appeared)):
            gap = years_appeared[i] - years_appeared[i - 1]
            if gap > longest_gap["gapYears"]:
                longest_gap = {
                    "name": name_lookup.get(uid, ""),
                    "gapYears": gap,
                    "athleteId": uid,
                }
            if gap >= 2:
                gap_bucket = min(gap, 15)  # Cap at 15+
                gap_distribution[gap_bucket] += 1

    return_rates = {
        "totalFinishers": total_finishers,
        "neverReturned": {"count": never_returned, "pct": round(never_returned / total_finishers * 100, 1) if total_finishers > 0 else 0},
        "returnedWithin1Year": {"count": returned_counts["within1"], "pct": round(returned_counts["within1"] / total_finishers * 100, 1) if total_finishers > 0 else 0},
        "returnedWithin2Years": {"count": returned_counts["within2"], "pct": round(returned_counts["within2"] / total_finishers * 100, 1) if total_finishers > 0 else 0},
        "returnedWithin3Years": {"count": returned_counts["within3"], "pct": round(returned_counts["within3"] / total_finishers * 100, 1) if total_finishers > 0 else 0},
        "returnedAfter3PlusYears": {"count": returned_counts["after3"], "pct": round(returned_counts["after3"] / total_finishers * 100, 1) if total_finishers > 0 else 0},
    }

    comeback = {
        "longestGapReturn": longest_gap,
        "gapDistribution": sorted(
            [{"gap": k, "count": v} for k, v in gap_distribution.items()],
            key=lambda x: x["gap"]
        ),
    }

    # ---------------------------------------------------------------
    # Insight 9: Country Participation Trends (last 20 years)
    # ---------------------------------------------------------------
    logger.info("  Computing country trends...")
    recent_years = [y for y in valid_years if y >= 2005]

    country_by_year = defaultdict(lambda: defaultdict(int))
    for uid, attempts in athlete_attempts.items():
        for att in attempts:
            if att["finished"] and att["year"] in recent_years:
                # Need country — not in attempt data, so query
                pass

    # Separate query for country data (more efficient)
    country_rows = conn.execute("""
        SELECT year, country, COUNT(*) as cnt
        FROM results
        WHERE year >= 2005 AND year <= 2025
        AND medal != '' AND medal IS NOT NULL
        AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
        AND country != '' AND country IS NOT NULL
        GROUP BY year, country
    """).fetchall()

    country_totals = defaultdict(int)
    country_year_data = defaultdict(lambda: defaultdict(int))
    for year, country, cnt in country_rows:
        country_totals[country] += cnt
        country_year_data[year][country] = cnt

    # Top 15 countries by total finishes in this period
    top_countries = sorted(country_totals.items(), key=lambda x: -x[1])[:15]
    top_country_names = [c for c, _ in top_countries]

    country_trends = {
        "countries": top_country_names,
        "data": [
            {"year": y, **{c: country_year_data[y].get(c, 0) for c in top_country_names}}
            for y in sorted(recent_years)
        ],
    }

    # ---------------------------------------------------------------
    # Insight 10: The 12-Hour Effect (Cutoff Change Impact)
    # ---------------------------------------------------------------
    logger.info("  Computing 12-hour cutoff effect...")
    # Build cutoff map from race_info
    cutoff_map = {}
    for row in conn.execute("SELECT year, time_limit FROM race_info WHERE time_limit IS NOT NULL AND time_limit != ''"):
        cutoff_map[row[0]] = row[1]

    # Count finishers in the 11-12 hour window per year (those who would've missed under 11h cutoff)
    vic_clapham_window = []
    for year in sorted(valid_years):
        cutoff = cutoff_map.get(year, "")
        total_finishers = 0
        in_window = 0  # Finished between 11:00:00 and 12:00:00
        sub_11 = 0  # Finished under 11 hours
        for uid, attempts in athlete_attempts.items():
            for att in attempts:
                if att["year"] == year and att["finished"] and att["time_secs"] is not None:
                    total_finishers += 1
                    if att["time_secs"] >= 39600:  # 11 hours in seconds
                        in_window += 1
                    else:
                        sub_11 += 1
        if total_finishers > 0:
            vic_clapham_window.append({
                "year": year,
                "cutoff": cutoff,
                "totalFinishers": total_finishers,
                "inWindow": in_window,
                "sub11": sub_11,
                "windowPct": round(in_window / total_finishers * 100, 1) if total_finishers > 0 else 0,
            })

    # More efficient: query directly for the window stats
    # Re-do with direct query for speed
    vic_clapham_window = []
    for year in sorted(valid_years):
        cutoff = cutoff_map.get(year, "")
        row_data = conn.execute("""
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN time != '' AND time NOT LIKE '%DNF%' AND time NOT LIKE '%DNS%' AND time NOT LIKE '%DQ%' AND time NOT LIKE '%Not%' THEN 1 ELSE 0 END) as finishers
            FROM results WHERE year = ?
        """, (year,)).fetchone()
        total_entries = row_data[0]

        # Get finishers with times
        time_rows = conn.execute("""
            SELECT time FROM results
            WHERE year = ? AND medal != '' AND medal IS NOT NULL
            AND medal NOT IN ('DNF', 'DNS', 'DQ', 'Not started')
            AND time != '' AND time IS NOT NULL
        """, (year,)).fetchall()

        finishers = 0
        in_window = 0
        for (t,) in time_rows:
            secs = time_to_seconds(t)
            if secs is not None:
                finishers += 1
                if secs >= 39600:  # >= 11 hours
                    in_window += 1

        if finishers > 0:
            finish_rate = round(finishers / total_entries * 100, 1) if total_entries > 0 else 0
            vic_clapham_window.append({
                "year": year,
                "cutoff": cutoff,
                "totalEntries": total_entries,
                "finishers": finishers,
                "finishRate": finish_rate,
                "inWindow": in_window,
                "windowPct": round(in_window / finishers * 100, 1),
            })

    # Summary stats
    era_11h = [d for d in vic_clapham_window if d["cutoff"] == "11 Hours"]
    era_12h = [d for d in vic_clapham_window if d["cutoff"] == "12 Hours" and d["year"] >= 2003]
    avg_finish_rate_11h = round(mean([d["finishRate"] for d in era_11h]), 1) if era_11h else 0
    avg_finish_rate_12h = round(mean([d["finishRate"] for d in era_12h]), 1) if era_12h else 0
    avg_window_pct = round(mean([d["windowPct"] for d in era_12h]), 1) if era_12h else 0

    cutoff_effect = {
        "byYear": vic_clapham_window,
        "summary": {
            "avgFinishRate11h": avg_finish_rate_11h,
            "avgFinishRate12h": avg_finish_rate_12h,
            "finishRateBoost": round(avg_finish_rate_12h - avg_finish_rate_11h, 1),
            "avgVicClaphamPct": avg_window_pct,
        },
    }

    # ---------------------------------------------------------------
    # Insight 11: Gender Gap Over Time
    # ---------------------------------------------------------------
    logger.info("  Computing gender gap analysis...")
    gender_by_year: dict[int, dict] = defaultdict(lambda: {
        "maleFinishers": 0, "femaleFinishers": 0,
        "maleTotalSecs": 0, "femaleTotalSecs": 0,
        "maleCount": 0, "femaleCount": 0,  # Only those with valid times
    })

    for uid, attempts in athlete_attempts.items():
        g = gender_map.get(uid, "M")
        for att in attempts:
            if att["finished"]:
                year = att["year"]
                if g == "M":
                    gender_by_year[year]["maleFinishers"] += 1
                    if att["time_secs"] is not None:
                        gender_by_year[year]["maleTotalSecs"] += att["time_secs"]
                        gender_by_year[year]["maleCount"] += 1
                else:
                    gender_by_year[year]["femaleFinishers"] += 1
                    if att["time_secs"] is not None:
                        gender_by_year[year]["femaleTotalSecs"] += att["time_secs"]
                        gender_by_year[year]["femaleCount"] += 1

    gender_trends = []
    for year in sorted(valid_years):
        d = gender_by_year[year]
        total = d["maleFinishers"] + d["femaleFinishers"]
        if total == 0:
            continue
        entry = {
            "year": year,
            "femalePct": round(d["femaleFinishers"] / total * 100, 1),
            "femaleFinishers": d["femaleFinishers"],
            "maleFinishers": d["maleFinishers"],
        }
        if d["maleCount"] > 0:
            entry["maleAvgTime"] = seconds_to_time(round(d["maleTotalSecs"] / d["maleCount"]))
            entry["maleAvgSecs"] = round(d["maleTotalSecs"] / d["maleCount"])
        if d["femaleCount"] > 0:
            entry["femaleAvgTime"] = seconds_to_time(round(d["femaleTotalSecs"] / d["femaleCount"]))
            entry["femaleAvgSecs"] = round(d["femaleTotalSecs"] / d["femaleCount"])
        if d["maleCount"] > 0 and d["femaleCount"] > 0:
            entry["gapMinutes"] = round((d["femaleTotalSecs"] / d["femaleCount"] - d["maleTotalSecs"] / d["maleCount"]) / 60, 1)
        gender_trends.append(entry)

    # Find first year women participated
    first_female_year = min((e["year"] for e in gender_trends if e["femalePct"] > 0), default=1975)
    latest = gender_trends[-1] if gender_trends else {}

    gender_gap = {
        "trends": gender_trends,
        "summary": {
            "firstFemaleYear": first_female_year,
            "latestFemalePct": latest.get("femalePct", 0),
            "latestGapMinutes": latest.get("gapMinutes", 0),
            "peakFemalePct": max((e["femalePct"] for e in gender_trends), default=0),
        },
    }

    # ---------------------------------------------------------------
    # Insight 12: Personal Best Timing — which finish produces PBs?
    # ---------------------------------------------------------------
    logger.info("  Computing personal best timing...")
    pb_at_nth = defaultdict(int)  # nth_finish -> count of athletes with PB there
    total_pb_athletes = 0

    for uid, attempts in athlete_attempts.items():
        finish_times = []
        for att in attempts:
            if att["finished"] and att["time_secs"] is not None:
                finish_times.append(att["time_secs"])

        if len(finish_times) >= 2:  # Need at least 2 finishes to have a meaningful PB
            total_pb_athletes += 1
            best_idx = finish_times.index(min(finish_times))
            nth = best_idx + 1  # 1-indexed
            if nth <= 20:
                pb_at_nth[nth] += 1

    pb_distribution = []
    for nth in range(1, 21):
        count = pb_at_nth.get(nth, 0)
        if total_pb_athletes > 0:
            pb_distribution.append({
                "nth": nth,
                "count": count,
                "pct": round(count / total_pb_athletes * 100, 1),
            })

    personal_best = {
        "distribution": pb_distribution,
        "totalAthletes": total_pb_athletes,
        "mostCommonPbFinish": max(pb_distribution, key=lambda x: x["count"])["nth"] if pb_distribution else 1,
    }

    # ---------------------------------------------------------------
    # Insight 13: The Dropout Curve — career length distribution
    # ---------------------------------------------------------------
    logger.info("  Computing dropout curve (career length distribution)...")
    career_lengths = defaultdict(int)  # total_finishes -> count of athletes

    for uid, attempts in athlete_attempts.items():
        finish_count = sum(1 for a in attempts if a["finished"])
        if finish_count >= 1:
            bucket = min(finish_count, 30)  # Cap at 30+
            career_lengths[bucket] += 1

    dropout_curve = []
    for n in range(1, 31):
        count = career_lengths.get(n, 0)
        dropout_curve.append({
            "totalFinishes": n,
            "athleteCount": count,
            "label": f"{n}+" if n == 30 else str(n),
        })

    # What % are one-and-done?
    total_finishing_athletes = sum(career_lengths.values())
    one_and_done = career_lengths.get(1, 0)
    five_plus = sum(v for k, v in career_lengths.items() if k >= 5)

    dropout_data = {
        "distribution": dropout_curve,
        "summary": {
            "totalFinishingAthletes": total_finishing_athletes,
            "oneAndDonePct": round(one_and_done / total_finishing_athletes * 100, 1) if total_finishing_athletes > 0 else 0,
            "oneAndDoneCount": one_and_done,
            "fivePlusPct": round(five_plus / total_finishing_athletes * 100, 1) if total_finishing_athletes > 0 else 0,
            "fivePlusCount": five_plus,
            "tenPlusPct": round(sum(v for k, v in career_lengths.items() if k >= 10) / total_finishing_athletes * 100, 1) if total_finishing_athletes > 0 else 0,
            "tenPlusCount": sum(v for k, v in career_lengths.items() if k >= 10),
        },
    }

    # ---------------------------------------------------------------
    # Insight 14: Field Size vs Finish Rate
    # ---------------------------------------------------------------
    logger.info("  Computing field size vs finish rate...")
    field_vs_finish = []
    for year in sorted(valid_years):
        row_data = conn.execute("""
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN medal != '' AND medal IS NOT NULL
                       AND medal NOT IN ('DNF', 'DNS', 'DQ', 'Not started') THEN 1 ELSE 0 END) as finishers
            FROM results WHERE year = ?
        """, (year,)).fetchone()
        total_entries = row_data[0]
        finishers = row_data[1] or 0
        cutoff = cutoff_map.get(year, "")
        if total_entries > 0:
            field_vs_finish.append({
                "year": year,
                "entries": total_entries,
                "finishers": finishers,
                "finishRate": round(finishers / total_entries * 100, 1),
                "cutoff": cutoff,
            })

    # ---------------------------------------------------------------
    # Insight 15: Medal Cutoff Clustering (post-2003, 12h era)
    # ---------------------------------------------------------------
    logger.info("  Computing medal cutoff clustering...")

    cutoff_rows = conn.execute("""
        SELECT time, medal FROM results
        WHERE medal != '' AND medal IS NOT NULL
        AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
        AND time IS NOT NULL AND time != '' AND time LIKE '%:%'
        AND pos IS NOT NULL AND pos != '' AND CAST(pos AS INTEGER) > 0
        AND year >= 2003
    """).fetchall()

    # 2-minute buckets for the distribution chart (5h - 12h05)
    from collections import Counter
    minute_counts = Counter()
    cutoff_total = 0
    for time_str, medal in cutoff_rows:
        secs = time_to_seconds(time_str)
        if secs is None or secs < 18000 or secs > 43500:
            continue
        minute = secs // 60
        minute_counts[minute] += 1
        cutoff_total += 1

    # Build 2-minute bucket distribution
    finish_distribution = []
    for bucket_start in range(300, 721, 2):  # 5:00 to 12:01 in 2-min steps
        h = bucket_start // 60
        m = bucket_start % 60
        count = minute_counts.get(bucket_start, 0) + minute_counts.get(bucket_start + 1, 0)
        finish_distribution.append({
            "time": f"{h}:{m:02d}",
            "minutes": bucket_start,
            "count": count,
        })

    # Medal boundary cliff-edge analysis
    medal_boundaries = [
        {"boundary": "Gold → Wally Hayward", "cutoffTime": "6:00", "cutoffMin": 360},
        {"boundary": "Wally Hayward → Silver", "cutoffTime": "7:30", "cutoffMin": 450},
        {"boundary": "Silver → Bill Rowan", "cutoffTime": "9:00", "cutoffMin": 540},
        {"boundary": "Bill Rowan → Bronze", "cutoffTime": "10:00", "cutoffMin": 600},
        {"boundary": "Bronze → Vic Clapham", "cutoffTime": "11:00", "cutoffMin": 660},
        {"boundary": "Vic Clapham → DNF", "cutoffTime": "12:00", "cutoffMin": 720},
    ]

    boundary_stats = []
    for b in medal_boundaries:
        cm = b["cutoffMin"]
        before_15 = sum(minute_counts.get(m, 0) for m in range(cm - 15, cm))
        after_15 = sum(minute_counts.get(m, 0) for m in range(cm, cm + 15))
        before_5 = sum(minute_counts.get(m, 0) for m in range(cm - 5, cm))
        after_5 = sum(minute_counts.get(m, 0) for m in range(cm, cm + 5))
        # Minute-by-minute for last 5 before and first 2 after
        minute_detail = []
        for m in range(cm - 5, cm + 2):
            h = m // 60
            mi = m % 60
            minute_detail.append({
                "time": f"{h}:{mi:02d}",
                "count": minute_counts.get(m, 0),
                "isCutoff": m == cm,
            })
        boundary_stats.append({
            "boundary": b["boundary"],
            "cutoffTime": b["cutoffTime"],
            "before15": before_15,
            "after15": after_15,
            "before5": before_5,
            "after5": after_5,
            "ratio": round(before_15 / after_15, 1) if after_15 > 0 else 0,
            "minuteDetail": minute_detail,
        })

    medal_cutoff_clustering = {
        "era": "2003-present (12h cutoff)",
        "totalFinishes": cutoff_total,
        "distribution": finish_distribution,
        "boundaries": boundary_stats,
    }

    # ---------------------------------------------------------------
    # Insight 16: Country Insights (performance, gender, medals)
    # ---------------------------------------------------------------
    logger.info("  Computing country insights...")

    # Fetch all finisher data with country info
    country_perf_rows = conn.execute("""
        SELECT UPPER(athlete_id) as uid, country, time, medal, year, pos, gender_pos
        FROM results
        WHERE medal != '' AND medal IS NOT NULL
        AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
        AND time IS NOT NULL AND time != '' AND time LIKE '%:%'
        AND time NOT IN ('DNF', 'DNS', 'DQ', '00:00:00')
        AND pos IS NOT NULL AND pos != '' AND CAST(pos AS INTEGER) > 0
        AND country IS NOT NULL AND country != ''
        AND year <= 2025
    """).fetchall()

    # Aggregate per country
    country_stats_raw: dict[str, dict] = defaultdict(lambda: {
        "finishers": 0, "total_secs": 0, "athletes": set(),
        "male_count": 0, "female_count": 0,
        "male_secs": 0, "female_secs": 0, "male_time_count": 0, "female_time_count": 0,
        "medals": defaultdict(int), "years": defaultdict(int),
        "top10_count": 0, "top3_count": 0,
    })

    for uid, country, time_str, medal, year, pos, gender_pos in country_perf_rows:
        secs = time_to_seconds(time_str)
        if secs is None or secs < 18000:  # sanity check: < 5h is invalid
            continue
        cs = country_stats_raw[country]
        cs["finishers"] += 1
        cs["total_secs"] += secs
        cs["athletes"].add(uid)
        cs["medals"][medal] += 1
        cs["years"][year] += 1

        pos_int = int(pos) if pos.isdigit() else 999
        if pos_int <= 10:
            cs["top10_count"] += 1
        if pos_int <= 3:
            cs["top3_count"] += 1

        # Gender classification
        gender = gender_map.get(uid, "M")
        if gender == "F":
            cs["female_count"] += 1
            cs["female_secs"] += secs
            cs["female_time_count"] += 1
        else:
            cs["male_count"] += 1
            cs["male_secs"] += secs
            cs["male_time_count"] += 1

    # Exclude special categories
    exclude_countries = {"", "ANA", "International"}
    min_finishers = 100

    # ---- 1. Country Performance Rankings (by avg time) ----
    country_performance = []
    for country, cs in country_stats_raw.items():
        if country in exclude_countries or cs["finishers"] < min_finishers:
            continue
        avg_secs = cs["total_secs"] // cs["finishers"]
        elite_medals = sum(cs["medals"].get(m, 0) for m in ["Gold", "Wally Hayward", "Isavel Roche-Kelly", "Silver"])
        country_performance.append({
            "country": clean_country_name(country),
            "finishers": cs["finishers"],
            "athletes": len(cs["athletes"]),
            "avgTime": seconds_to_time(avg_secs),
            "avgSeconds": avg_secs,
            "maleAvgTime": seconds_to_time(cs["male_secs"] // cs["male_time_count"]) if cs["male_time_count"] > 0 else None,
            "maleAvgSeconds": cs["male_secs"] // cs["male_time_count"] if cs["male_time_count"] > 0 else None,
            "femaleAvgTime": seconds_to_time(cs["female_secs"] // cs["female_time_count"]) if cs["female_time_count"] > 0 else None,
            "femaleAvgSeconds": cs["female_secs"] // cs["female_time_count"] if cs["female_time_count"] > 0 else None,
            "femalePct": round(cs["female_count"] / cs["finishers"] * 100, 1),
            "elitePct": round(elite_medals / cs["finishers"] * 100, 1),
            "top10Count": cs["top10_count"],
            "top3Count": cs["top3_count"],
            "finishesPerAthlete": round(cs["finishers"] / len(cs["athletes"]), 1) if len(cs["athletes"]) > 0 else 0,
        })

    # Sort by avg time (fastest first)
    country_performance.sort(key=lambda x: x["avgSeconds"])

    # ---- 2. Gender Balance by Country ----
    country_gender = []
    for country, cs in country_stats_raw.items():
        if country in exclude_countries or cs["finishers"] < min_finishers:
            continue
        # Gender speed gap
        gender_gap_mins = None
        if cs["male_time_count"] >= 20 and cs["female_time_count"] >= 20:
            m_avg = cs["male_secs"] / cs["male_time_count"]
            f_avg = cs["female_secs"] / cs["female_time_count"]
            gender_gap_mins = round((f_avg - m_avg) / 60, 1)
        country_gender.append({
            "country": clean_country_name(country),
            "finishers": cs["finishers"],
            "femalePct": round(cs["female_count"] / cs["finishers"] * 100, 1),
            "femaleCount": cs["female_count"],
            "maleCount": cs["male_count"],
            "genderGapMinutes": gender_gap_mins,
        })
    country_gender.sort(key=lambda x: -x["femalePct"])

    # ---- 3. Medal Quality by Country ----
    country_medals = []
    for country, cs in country_stats_raw.items():
        if country in exclude_countries or cs["finishers"] < min_finishers:
            continue
        total = cs["finishers"]
        gold_pct = round(cs["medals"].get("Gold", 0) / total * 100, 2)
        elite = sum(cs["medals"].get(m, 0) for m in ["Gold", "Wally Hayward", "Isavel Roche-Kelly"])
        silver_plus = elite + sum(cs["medals"].get(m, 0) for m in ["Silver", "Bill Rowan", "Robert Mtshali"])
        country_medals.append({
            "country": clean_country_name(country),
            "finishers": total,
            "goldPct": gold_pct,
            "goldCount": cs["medals"].get("Gold", 0),
            "elitePct": round(elite / total * 100, 1),
            "silverPlusPct": round(silver_plus / total * 100, 1),
            "bronzePct": round(cs["medals"].get("Bronze", 0) / total * 100, 1),
            "vicClaphamPct": round(cs["medals"].get("Vic Clapham", 0) / total * 100, 1),
        })
    country_medals.sort(key=lambda x: -x["elitePct"])

    # ---- 4. Best Year by Country (proportional dominance) ----
    # For each country, find their best year by average position
    # Use years with decent representation (20+ finishers from that country)
    country_best_years = []
    for country, cs in country_stats_raw.items():
        if country in exclude_countries or cs["finishers"] < min_finishers:
            continue
        # Re-query for per-year stats for this country
        year_rows = conn.execute("""
            SELECT year, COUNT(*) as cnt,
                   AVG(CAST(pos AS INTEGER)) as avg_pos
            FROM results
            WHERE country = ?
            AND medal != '' AND medal IS NOT NULL
            AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
            AND time IS NOT NULL AND time != '' AND time LIKE '%:%'
            AND pos IS NOT NULL AND pos != '' AND CAST(pos AS INTEGER) > 0
            AND year <= 2025
            GROUP BY year
            HAVING cnt >= 5
            ORDER BY avg_pos ASC
        """, (country,)).fetchall()
        if year_rows:
            best = year_rows[0]
            country_best_years.append({
                "country": clean_country_name(country),
                "bestYear": best[0],
                "finishersInYear": best[1],
                "avgPosition": round(best[2], 0),
            })

    # ---- 5. International growth timeline ----
    intl_growth = []
    for year in sorted(valid_years):
        yr_rows = conn.execute("""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN country != 'South Africa' AND country IS NOT NULL AND country != '' THEN 1 ELSE 0 END) as intl,
                COUNT(DISTINCT CASE WHEN country != 'South Africa' AND country IS NOT NULL AND country != '' THEN country END) as num_countries
            FROM results
            WHERE year = ?
            AND medal != '' AND medal IS NOT NULL
            AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
            AND time IS NOT NULL AND time != '' AND time LIKE '%:%'
            AND pos IS NOT NULL AND pos != '' AND CAST(pos AS INTEGER) > 0
        """, (year,)).fetchone()
        if yr_rows and yr_rows[0] > 0:
            intl_growth.append({
                "year": year,
                "total": yr_rows[0],
                "international": yr_rows[1],
                "intlPct": round(yr_rows[1] / yr_rows[0] * 100, 1),
                "countries": yr_rows[2],
            })

    # ---- 6. Country performance scatter data ----
    # For top countries: avg time vs female % (for scatter plot)
    country_scatter = []
    for cp in country_performance[:30]:
        country_scatter.append({
            "country": cp["country"],
            "avgSeconds": cp["avgSeconds"],
            "avgTime": cp["avgTime"],
            "femalePct": cp["femalePct"],
            "finishers": cp["finishers"],
            "elitePct": cp["elitePct"],
        })

    country_insights = {
        "performance": country_performance[:30],
        "genderBalance": country_gender[:30],
        "medalQuality": country_medals[:20],
        "bestYears": country_best_years,
        "internationalGrowth": intl_growth,
        "scatter": country_scatter,
    }

    logger.info(f"    Country insights: {len(country_performance)} countries with 100+ finishers")
    if country_performance:
        logger.info(f"    Fastest avg: {country_performance[0]['country']} ({country_performance[0]['avgTime']})")

    # ---------------------------------------------------------------
    # Insight 17: Performance by Attempt Number (avg/median time curve)
    # ---------------------------------------------------------------
    logger.info("  Computing performance by attempt number...")
    attempt_times: dict[int, list[int]] = defaultdict(list)
    attempt_improved: dict[int, dict] = defaultdict(lambda: {"improved": 0, "total": 0, "delta_sum": 0})

    for uid, attempts in athlete_attempts.items():
        finish_count = 0
        prev_secs = None
        for att in attempts:
            if att["finished"] and att["time_secs"] is not None and att["time_secs"] >= 18000:
                finish_count += 1
                if finish_count <= 30:
                    attempt_times[finish_count].append(att["time_secs"])
                    if prev_secs is not None and finish_count <= 20:
                        attempt_improved[finish_count]["total"] += 1
                        delta = att["time_secs"] - prev_secs
                        attempt_improved[finish_count]["delta_sum"] += delta
                        if att["time_secs"] < prev_secs:
                            attempt_improved[finish_count]["improved"] += 1
                prev_secs = att["time_secs"] if att["finished"] and att["time_secs"] else prev_secs

    performance_by_attempt = []
    for n in range(1, 26):
        times = attempt_times.get(n, [])
        if not times:
            continue
        sorted_t = sorted(times)
        avg_s = round(mean(sorted_t))
        med_s = sorted_t[len(sorted_t) // 2]
        imp = attempt_improved.get(n, {"improved": 0, "total": 0, "delta_sum": 0})
        imp_pct = round(imp["improved"] / imp["total"] * 100, 1) if imp["total"] > 0 else None
        avg_delta = round(imp["delta_sum"] / imp["total"]) if imp["total"] > 0 else None
        performance_by_attempt.append({
            "attempt": n,
            "avgSeconds": avg_s,
            "avgTime": seconds_to_time(avg_s),
            "medianSeconds": med_s,
            "medianTime": seconds_to_time(med_s),
            "count": len(times),
            "improvedPct": imp_pct,
            "avgDeltaSeconds": avg_delta,
        })

    # ---------------------------------------------------------------
    # Insight 18: Experience vs Age Cross-Tab
    # ---------------------------------------------------------------
    logger.info("  Computing experience vs age cross-tab...")
    age_exp_buckets: dict[tuple[str, str], list[int]] = defaultdict(list)
    AGE_CATS_ORDERED = ["Senior", "40-49", "50-59", "60+"]
    EXP_BUCKETS = [
        ("1st", 1, 1), ("2-3", 2, 3), ("4-5", 4, 5),
        ("6-10", 6, 10), ("11-20", 11, 20), ("21+", 21, 999),
    ]

    for uid, attempts in athlete_attempts.items():
        finish_count = 0
        for att in attempts:
            if att["finished"] and att["time_secs"] is not None and att["time_secs"] >= 18000:
                finish_count += 1
                cat = normalize_category(att["category"])
                if cat:
                    for label, lo, hi in EXP_BUCKETS:
                        if lo <= finish_count <= hi:
                            age_exp_buckets[(cat, label)].append(att["time_secs"])
                            break

    experience_vs_age = []
    for cat in AGE_CATS_ORDERED:
        for label, _, _ in EXP_BUCKETS:
            times = age_exp_buckets.get((cat, label), [])
            if len(times) >= 20:  # only include if enough data
                avg_s = round(mean(times))
                experience_vs_age.append({
                    "ageCategory": cat,
                    "attemptBucket": label,
                    "avgSeconds": avg_s,
                    "avgTime": seconds_to_time(avg_s),
                    "count": len(times),
                })

    # ---------------------------------------------------------------
    # Insight 19: Age × Direction — Pace-adjusted analysis
    # ---------------------------------------------------------------
    logger.info("  Computing age × direction analysis (pace-adjusted)...")
    age_dir_data: dict[str, dict] = defaultdict(lambda: {
        "up_times": [], "down_times": [],
        "up_paces": [], "down_paces": [],
        "up_runners": defaultdict(list), "down_runners": defaultdict(list),
        "up_pace_runners": defaultdict(list), "down_pace_runners": defaultdict(list),
    })

    for uid, attempts in athlete_attempts.items():
        for att in attempts:
            if att["finished"] and att["time_secs"] is not None and att["time_secs"] >= 18000:
                cat = normalize_category(att["category"])
                d = direction_map.get(att["year"])
                dist_km = distance_km_map.get(att["year"])
                if cat and d in ("Up", "Down"):
                    if d == "Up":
                        age_dir_data[cat]["up_times"].append(att["time_secs"])
                        age_dir_data[cat]["up_runners"][uid].append(att["time_secs"])
                        if dist_km:
                            pace = att["time_secs"] / dist_km
                            age_dir_data[cat]["up_paces"].append(pace)
                            age_dir_data[cat]["up_pace_runners"][uid].append(pace)
                    else:
                        age_dir_data[cat]["down_times"].append(att["time_secs"])
                        age_dir_data[cat]["down_runners"][uid].append(att["time_secs"])
                        if dist_km:
                            pace = att["time_secs"] / dist_km
                            age_dir_data[cat]["down_paces"].append(pace)
                            age_dir_data[cat]["down_pace_runners"][uid].append(pace)

    age_direction_reversal = []
    for cat in AGE_CATS_ORDERED:
        ad = age_dir_data.get(cat)
        if not ad or not ad["up_times"] or not ad["down_times"]:
            continue
        avg_up = round(mean(ad["up_times"]))
        avg_down = round(mean(ad["down_times"]))
        gap_min = round((avg_up - avg_down) / 60, 1)

        # Paired analysis by time: runners who did both directions in this age cat
        both_uids = set(ad["up_runners"].keys()) & set(ad["down_runners"].keys())
        faster_down_count = 0
        for buid in both_uids:
            if mean(ad["down_runners"][buid]) < mean(ad["up_runners"][buid]):
                faster_down_count += 1

        # Pace-based analysis
        avg_up_pace = round(mean(ad["up_paces"]), 1) if ad["up_paces"] else 0
        avg_down_pace = round(mean(ad["down_paces"]), 1) if ad["down_paces"] else 0
        pace_gap = round(avg_up_pace - avg_down_pace, 1)

        # Paired analysis by pace
        both_pace_uids = set(ad["up_pace_runners"].keys()) & set(ad["down_pace_runners"].keys())
        faster_down_pace_count = 0
        for buid in both_pace_uids:
            if mean(ad["down_pace_runners"][buid]) < mean(ad["up_pace_runners"][buid]):
                faster_down_pace_count += 1

        age_direction_reversal.append({
            "ageCategory": cat,
            "avgUpSeconds": avg_up,
            "avgUpTime": seconds_to_time(avg_up),
            "avgDownSeconds": avg_down,
            "avgDownTime": seconds_to_time(avg_down),
            "gapMinutes": gap_min,
            "pairedRunners": len(both_uids),
            "fasterOnDownPct": round(faster_down_count / len(both_uids) * 100, 1) if both_uids else 0,
            "upCount": len(ad["up_times"]),
            "downCount": len(ad["down_times"]),
            # Pace-based fields
            "avgUpPace": avg_up_pace,
            "avgUpPaceDisplay": _pace_to_display(avg_up_pace) if avg_up_pace else "",
            "avgDownPace": avg_down_pace,
            "avgDownPaceDisplay": _pace_to_display(avg_down_pace) if avg_down_pace else "",
            "paceGapSecKm": pace_gap,
            "pairedPaceRunners": len(both_pace_uids),
            "fasterOnDownByPacePct": round(faster_down_pace_count / len(both_pace_uids) * 100, 1) if both_pace_uids else 0,
        })

    # ---------------------------------------------------------------
    # Insight 20: Green Number Deep Dive (slowdown + DNF paradox)
    # ---------------------------------------------------------------
    logger.info("  Computing green number deep dive...")
    milestone_buckets: dict[str, dict] = {}
    MILESTONES = [
        ("Finishes 1-5", 1, 5),
        ("Finishes 6-9", 6, 9),
        ("Green Number (10)", 10, 10),
        ("Finishes 11-15", 11, 15),
        ("Finishes 16-19", 16, 19),
        ("Double Green (20)", 20, 20),
        ("Finishes 21+", 21, 999),
    ]
    for label, _, _ in MILESTONES:
        milestone_buckets[label] = {"times": [], "attempts": 0, "dnfs": 0}

    pre_green_times = []
    post_green_times = []
    pre_green_attempts = 0
    pre_green_dnfs = 0
    post_green_attempts = 0
    post_green_dnfs = 0

    for uid, attempts in athlete_attempts.items():
        finish_count = 0
        for att in attempts:
            is_fin = att["finished"]
            secs = att["time_secs"]

            # Track pre/post green number stats for athletes who earned it
            if finish_count < 10:
                # Count attempts toward earning green number
                pass  # tracked in milestone buckets below
            # After earning green number
            if finish_count >= 10:
                post_green_attempts += 1
                if not is_fin:
                    post_green_dnfs += 1
                elif secs and secs >= 18000:
                    post_green_times.append(secs)

            if is_fin:
                finish_count += 1
                if secs and secs >= 18000:
                    for label, lo, hi in MILESTONES:
                        if lo <= finish_count <= hi:
                            milestone_buckets[label]["times"].append(secs)
                            break
                    if finish_count <= 9:
                        pre_green_times.append(secs)

            # Track attempt/DNF for milestone buckets
            for label, lo, hi in MILESTONES:
                if lo <= (finish_count + (0 if is_fin else 1)) <= hi:
                    milestone_buckets[label]["attempts"] += 1
                    if not is_fin:
                        milestone_buckets[label]["dnfs"] += 1
                    break

    # Also compute for athletes who never earned green number
    non_green_attempts = 0
    non_green_dnfs = 0
    for uid, attempts in athlete_attempts.items():
        fc = sum(1 for a in attempts if a["finished"])
        if fc < 10:
            for att in attempts:
                non_green_attempts += 1
                if not att["finished"]:
                    non_green_dnfs += 1

    green_deep_dive_milestones = []
    for label, _, _ in MILESTONES:
        mb = milestone_buckets[label]
        avg_s = round(mean(mb["times"])) if mb["times"] else None
        med_s = sorted(mb["times"])[len(mb["times"]) // 2] if mb["times"] else None
        dnf_rate = round(mb["dnfs"] / mb["attempts"] * 100, 1) if mb["attempts"] > 0 else 0
        green_deep_dive_milestones.append({
            "label": label,
            "avgSeconds": avg_s,
            "avgTime": seconds_to_time(avg_s) if avg_s else None,
            "medianSeconds": med_s,
            "medianTime": seconds_to_time(med_s) if med_s else None,
            "count": len(mb["times"]),
            "dnfRate": dnf_rate,
        })

    # DNF journey for runners who earned green: per-runner pre vs post green DNF rates
    green_runners_pre_dnf_rates = []
    green_runners_post_dnf_rates = []
    green_runners_zero_dnf_count = 0
    green_runner_count = 0
    for uid, attempts in athlete_attempts.items():
        finish_count = 0
        pre_attempts = 0
        pre_dnfs = 0
        post_attempts = 0
        post_dnfs = 0
        for att in attempts:
            if finish_count < 10:
                pre_attempts += 1
                if not att["finished"]:
                    pre_dnfs += 1
            else:
                post_attempts += 1
                if not att["finished"]:
                    post_dnfs += 1
            if att["finished"]:
                finish_count += 1
        if finish_count >= 10:
            green_runner_count += 1
            pre_rate = round(pre_dnfs / pre_attempts * 100, 1) if pre_attempts > 0 else 0
            green_runners_pre_dnf_rates.append(pre_rate)
            if pre_dnfs == 0:
                green_runners_zero_dnf_count += 1
            if post_attempts > 0:
                post_rate = round(post_dnfs / post_attempts * 100, 1)
                green_runners_post_dnf_rates.append(post_rate)

    green_number_deep_dive = {
        "preGreenAvgSeconds": round(mean(pre_green_times)) if pre_green_times else 0,
        "preGreenAvgTime": seconds_to_time(round(mean(pre_green_times))) if pre_green_times else "",
        "postGreenAvgSeconds": round(mean(post_green_times)) if post_green_times else 0,
        "postGreenAvgTime": seconds_to_time(round(mean(post_green_times))) if post_green_times else "",
        "slowdownMinutes": round((mean(post_green_times) - mean(pre_green_times)) / 60, 1) if pre_green_times and post_green_times else 0,
        "postGreenDnfRate": round(post_green_dnfs / post_green_attempts * 100, 1) if post_green_attempts else 0,
        "nonGreenDnfRate": round(non_green_dnfs / non_green_attempts * 100, 1) if non_green_attempts else 0,
        "byMilestone": green_deep_dive_milestones,
        # DNF journey: pre vs post green for green number runners
        "dnfJourney": {
            "greenRunners": green_runner_count,
            "avgPreGreenDnfRate": round(mean(green_runners_pre_dnf_rates), 1) if green_runners_pre_dnf_rates else 0,
            "avgPostGreenDnfRate": round(mean(green_runners_post_dnf_rates), 1) if green_runners_post_dnf_rates else 0,
            "zeroPreDnfPct": round(green_runners_zero_dnf_count / green_runner_count * 100, 1) if green_runner_count else 0,
            "preGreenTotalAttempts": pre_green_attempts if True else 0,  # reuse
            "preGreenTotalDnfs": sum(1 for r in green_runners_pre_dnf_rates if r > 0),
            "postGreenTotalAttempts": post_green_attempts,
            "postGreenTotalDnfs": post_green_dnfs,
            "aggregatePreRate": round(sum(green_runners_pre_dnf_rates) / len(green_runners_pre_dnf_rates), 1) if green_runners_pre_dnf_rates else 0,
            "aggregatePostRate": round(sum(green_runners_post_dnf_rates) / len(green_runners_post_dnf_rates), 1) if green_runners_post_dnf_rates else 0,
        },
    }

    # ---------------------------------------------------------------
    # Insight 21: Streak Length vs Performance
    # ---------------------------------------------------------------
    logger.info("  Computing streak vs performance...")
    STREAK_BUCKETS = [
        ("1 (one-off)", 1, 1), ("2-3", 2, 3), ("4-6", 4, 6),
        ("7-10", 7, 10), ("11-15", 11, 15), ("16+", 16, 999),
    ]
    streak_times: dict[str, list[int]] = defaultdict(list)

    for uid, attempts in athlete_attempts.items():
        # Find longest streak of consecutive finishes across race years
        finish_years = sorted(set(
            att["year"] for att in attempts if att["finished"]
        ))
        if not finish_years:
            continue
        # Calculate longest consecutive streak
        best_streak = 1
        cur_streak = 1
        for i in range(1, len(finish_years)):
            # Check if there was a race year between these two
            gap_years = [y for y in valid_years if finish_years[i-1] < y < finish_years[i]]
            if not gap_years:
                cur_streak += 1
                best_streak = max(best_streak, cur_streak)
            else:
                cur_streak = 1

        # Collect all finish times for this runner
        runner_times = [a["time_secs"] for a in attempts if a["finished"] and a["time_secs"] and a["time_secs"] >= 18000]
        if not runner_times:
            continue

        for label, lo, hi in STREAK_BUCKETS:
            if lo <= best_streak <= hi:
                streak_times[label].extend(runner_times)
                break

    streak_performance = []
    for label, _, _ in STREAK_BUCKETS:
        times = streak_times.get(label, [])
        if times:
            avg_s = round(mean(times))
            sorted_t = sorted(times)
            med_s = sorted_t[len(sorted_t) // 2]
            streak_performance.append({
                "streakBucket": label,
                "avgSeconds": avg_s,
                "avgTime": seconds_to_time(avg_s),
                "medianSeconds": med_s,
                "medianTime": seconds_to_time(med_s),
                "count": len(times),
            })

    # ---------------------------------------------------------------
    # Insight 22: Country Mean vs Median Times
    # ---------------------------------------------------------------
    logger.info("  Computing country mean vs median...")
    country_all_times: dict[str, list[int]] = defaultdict(list)
    for uid, country, time_str, medal, year, pos, gender_pos in country_perf_rows:
        secs = time_to_seconds(time_str)
        if secs and secs >= 18000 and country not in exclude_countries:
            country_all_times[clean_country_name(country)].append(secs)

    country_mean_median = []
    for cname, times in country_all_times.items():
        if len(times) < 100:
            continue
        sorted_t = sorted(times)
        avg_s = round(mean(sorted_t))
        med_s = sorted_t[len(sorted_t) // 2]
        gap_s = avg_s - med_s
        gap_pct = round(gap_s / med_s * 100, 1)
        country_mean_median.append({
            "country": cname,
            "meanSeconds": avg_s,
            "meanTime": seconds_to_time(avg_s),
            "medianSeconds": med_s,
            "medianTime": seconds_to_time(med_s),
            "gapSeconds": gap_s,
            "gapPct": gap_pct,
            "count": len(times),
        })
    country_mean_median.sort(key=lambda x: x["meanSeconds"])

    # ---------------------------------------------------------------
    # Insight 23: Finish Hour Bracket Distribution by Decade
    # ---------------------------------------------------------------
    logger.info("  Computing finish hour distribution...")
    HOUR_BRACKETS = [
        ("Sub-6h", 0, 21600), ("6-7h", 21600, 25200), ("7-8h", 25200, 28800),
        ("8-9h", 28800, 32400), ("9-10h", 32400, 36000), ("10-11h", 36000, 39600),
        ("11-12h", 39600, 43200),
    ]
    hour_overall: dict[str, int] = defaultdict(int)
    hour_by_decade: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    total_finishes_for_hours = 0

    for uid, attempts in athlete_attempts.items():
        for att in attempts:
            if att["finished"] and att["time_secs"] and att["time_secs"] >= 18000:
                secs = att["time_secs"]
                decade = (att["year"] // 10) * 10
                for label, lo, hi in HOUR_BRACKETS:
                    if lo <= secs < hi:
                        hour_overall[label] += 1
                        hour_by_decade[decade][label] += 1
                        total_finishes_for_hours += 1
                        break
                else:
                    # > 12h
                    hour_overall["11-12h"] += 1
                    hour_by_decade[decade]["11-12h"] += 1
                    total_finishes_for_hours += 1

    finish_hour_dist = {
        "overall": [
            {"bracket": label, "count": hour_overall.get(label, 0),
             "pct": round(hour_overall.get(label, 0) / total_finishes_for_hours * 100, 1) if total_finishes_for_hours else 0}
            for label, _, _ in HOUR_BRACKETS
        ],
        "byDecade": sorted([
            {
                "decade": dec,
                "total": sum(counts.values()),
                **{label: round(counts.get(label, 0) / sum(counts.values()) * 100, 1) if sum(counts.values()) > 0 else 0
                   for label, _, _ in HOUR_BRACKETS}
            }
            for dec, counts in hour_by_decade.items()
            if sum(counts.values()) >= 100
        ], key=lambda x: x["decade"]),
    }

    # ---------------------------------------------------------------
    # Insight 24: Retention Curve (% reaching Nth finish)
    # ---------------------------------------------------------------
    logger.info("  Computing retention curves...")
    # Overall: of all athletes who finished at least once, what % reached 2, 3, ..., 30?
    finish_count_dist: dict[int, int] = defaultdict(int)
    first_finish_decade: dict[str, int] = {}

    for uid, attempts in athlete_attempts.items():
        fc = sum(1 for a in attempts if a["finished"])
        if fc > 0:
            finish_count_dist[fc] += 1
            first_year = min(a["year"] for a in attempts if a["finished"])
            first_finish_decade[uid] = (first_year // 10) * 10

    total_ever_finished = sum(finish_count_dist.values())
    retention_overall = []
    for n in range(1, 31):
        reached = sum(cnt for fc, cnt in finish_count_dist.items() if fc >= n)
        retention_overall.append({
            "nthFinish": n,
            "reached": reached,
            "pct": round(reached / total_ever_finished * 100, 1) if total_ever_finished else 0,
        })

    # By first-finish decade
    decade_finish_counts: dict[int, dict[int, int]] = defaultdict(lambda: defaultdict(int))
    for uid, attempts in athlete_attempts.items():
        fc = sum(1 for a in attempts if a["finished"])
        if fc > 0:
            dec = first_finish_decade[uid]
            decade_finish_counts[dec][fc] += 1

    retention_by_decade = []
    for dec in sorted(decade_finish_counts.keys()):
        if dec >= 2020:
            continue  # too recent for meaningful retention data
        dist = decade_finish_counts[dec]
        total_dec = sum(dist.values())
        if total_dec < 100:
            continue
        decade_data = []
        for n in range(1, 21):
            reached = sum(cnt for fc, cnt in dist.items() if fc >= n)
            decade_data.append({
                "nthFinish": n,
                "pct": round(reached / total_dec * 100, 1),
            })
        retention_by_decade.append({
            "decade": f"{dec}s",
            "totalAthletes": total_dec,
            "data": decade_data,
        })

    retention_curve = {
        "overall": retention_overall,
        "byDecade": retention_by_decade,
    }

    # ---------------------------------------------------------------
    # Assemble and write insights.json
    # ---------------------------------------------------------------
    insights = {
        "greenNumberEffect": {
            "finishRateByNthPotentialFinish": green_number_data,
            "summary": green_summary,
        },
        "backToBack": back_to_back,
        "slowdownCurve": slowdown_curve,
        "avgTimesByAge": {
            "byDecade": avg_times_by_decade,
            "overall": avg_times_overall,
        },
        "medalsByAge": medals_by_age_pct,
        "upVsDown": up_vs_down,
        "dnfByAttempt": dnf_by_attempt,
        "returnRates": return_rates,
        "comebackKids": comeback,
        "countryTrends": country_trends,
        "cutoffEffect": cutoff_effect,
        "genderGap": gender_gap,
        "personalBest": personal_best,
        "dropoutCurve": dropout_data,
        "fieldVsFinish": field_vs_finish,
        "medalCutoffClustering": medal_cutoff_clustering,
        "countryInsights": country_insights,
        "performanceByAttempt": performance_by_attempt,
        "experienceVsAge": experience_vs_age,
        "ageDirectionReversal": age_direction_reversal,
        "greenNumberDeepDive": green_number_deep_dive,
        "streakPerformance": streak_performance,
        "countryMeanMedian": country_mean_median,
        "finishHourDistribution": finish_hour_dist,
        "retentionCurve": retention_curve,
    }

    write_json(os.path.join(out_dir, "insights.json"), insights)
    logger.info(f"  insights.json written")
    logger.info(f"    Green number effect: 10th={green_summary['rateAttempting10th']}% vs 11th={green_summary['rateAttempting11th']}% (diff={green_summary['effectSize10']}pp)")
    logger.info(f"    Back-to-back return rate: {back_to_back['firstTimerReturn']['returnRate']}%")
    logger.info(f"    Slowdown curve: {len(slowdown_curve)} transitions")
    logger.info(f"    Up vs Down: {up_vs_down['runnersWithBoth']:,} dual-direction runners, {up_vs_down['fasterOnDown']}% faster on Down")


def _safe_int(val) -> int:
    """Safely parse an integer from potentially messy data."""
    if not val:
        return 0
    try:
        return int(str(val).replace(",", "").strip())
    except (ValueError, TypeError):
        return 0


def _safe_float(val) -> float:
    """Safely parse a float from potentially messy data."""
    if not val:
        return 0
    try:
        return float(str(val).replace("%", "").replace(",", "").strip())
    except (ValueError, TypeError):
        return 0


# ---------------------------------------------------------------------------
# Year Detail Export
# ---------------------------------------------------------------------------

def export_year_details(conn: sqlite3.Connection, out_dir: str, gender_map: dict[str, str],
                        club_country_fixes: dict[str, str] | None = None):
    """Export per-year detail JSON files to year/{year}.json."""
    logger.info("Exporting year detail files...")
    club_fixes = club_country_fixes or {}

    year_dir = os.path.join(out_dir, "year")
    os.makedirs(year_dir, exist_ok=True)

    # Get all race years (exclude 2026 — future)
    all_years = [r[0] for r in conn.execute(
        "SELECT DISTINCT year FROM results WHERE year <= 2025 ORDER BY year"
    ).fetchall()]

    # Build race_info lookup
    race_info = {}
    for row in conn.execute("""
        SELECT year, date, weather, temperature, direction, race_number, official_distance,
               time_limit, starters, finishers_total, entries, pct_finishers_starters,
               cancelled, narrative
        FROM race_info WHERE year <= 2025
    """).fetchall():
        race_info[row[0]] = {
            "date": row[1] or "", "weather": row[2] or "", "temperature": row[3] or "",
            "direction": row[4] or "", "raceNumber": row[5] or "", "distance": row[6] or "",
            "timeLimit": row[7] or "",
            "starters": int(row[8]) if row[8] and str(row[8]).isdigit() else 0,
            "officialFinishers": int(row[9]) if row[9] and str(row[9]).isdigit() else 0,
            "entries": _safe_int(row[10]),
            "finishRate": _safe_float(row[11]),
            "cancelled": bool(row[12]),
            "narrative": row[13] or "",
        }

    # Pre-compute first finish year per athlete (single pass for first-timer detection)
    logger.info("  Pre-computing first finish years...")
    first_finish_year: dict[str, int] = {}
    for row in conn.execute("""
        SELECT UPPER(athlete_id), MIN(year) FROM results
        WHERE athlete_id IS NOT NULL AND athlete_id != ''
        AND medal != '' AND medal IS NOT NULL
        AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
        GROUP BY UPPER(athlete_id)
    """).fetchall():
        first_finish_year[row[0]] = row[1]

    # Pre-compute per-year stats for historical ranking
    logger.info("  Pre-computing per-year stats for ranking...")
    year_stats_for_rank = []
    for year in all_years:
        ri = race_info.get(year, {})
        if ri.get("cancelled"):
            continue

        # Count finishers
        fc = conn.execute("""
            SELECT COUNT(*) FROM results
            WHERE year = ? AND medal != '' AND medal IS NOT NULL
            AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
        """, (year,)).fetchone()[0]

        tc = conn.execute("SELECT COUNT(*) FROM results WHERE year = ?", (year,)).fetchone()[0]

        # Get winning time
        winner_row = conn.execute("""
            SELECT time FROM results
            WHERE year = ? AND pos = '1' AND time != '' AND time IS NOT NULL
            AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
            ORDER BY time ASC LIMIT 1
        """, (year,)).fetchone()
        winning_secs = time_to_seconds(winner_row[0]) if winner_row else None

        # Compute average finish time
        all_times = conn.execute("""
            SELECT time FROM results
            WHERE year = ? AND medal != '' AND medal IS NOT NULL
            AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
            AND time != '' AND time IS NOT NULL
        """, (year,)).fetchall()
        valid_secs = [s for t in all_times if (s := time_to_seconds(t[0])) is not None]
        avg_secs = round(mean(valid_secs)) if valid_secs else None

        fr = round(fc / tc * 100, 1) if tc > 0 else 0

        year_stats_for_rank.append({
            "year": year,
            "direction": ri.get("direction", ""),
            "entries": tc,
            "finishers": fc,
            "finishRate": fr,
            "winningSecs": winning_secs,
            "avgSecs": avg_secs,
        })

    # Compute ranks
    def rank_by(items, key, reverse=False):
        """Rank items by key. Returns dict year -> rank (1-indexed)."""
        valid = [(it["year"], it[key]) for it in items if it[key] is not None]
        valid.sort(key=lambda x: x[1], reverse=reverse)
        return {y: i + 1 for i, (y, _) in enumerate(valid)}

    field_size_rank = rank_by(year_stats_for_rank, "entries", reverse=True)
    finishers_rank = rank_by(year_stats_for_rank, "finishers", reverse=True)
    finish_rate_rank = rank_by(year_stats_for_rank, "finishRate", reverse=True)
    winning_time_rank = rank_by(year_stats_for_rank, "winningSecs", reverse=False)  # Lower is better

    # Winning time rank within same direction
    by_dir: dict[str, list] = defaultdict(list)
    for it in year_stats_for_rank:
        if it["direction"]:
            by_dir[it["direction"]].append(it)
    winning_time_rank_dir = {}
    for d, items in by_dir.items():
        r = rank_by(items, "winningSecs", reverse=False)
        winning_time_rank_dir.update(r)

    total_races = len([y for y in year_stats_for_rank if not race_info.get(y["year"], {}).get("cancelled")])

    # Build year stats lookup for same-direction comparisons
    year_stats_lookup = {it["year"]: it for it in year_stats_for_rank}

    # Build direction history for same-direction comparison
    direction_history = []
    for year in sorted(all_years):
        ri = race_info.get(year, {})
        if not ri.get("cancelled") and ri.get("direction"):
            direction_history.append((year, ri["direction"]))

    # ---------------------------------------------------------------
    # Build running course record tracker for record context
    # ---------------------------------------------------------------
    men_overall_rt = RecordTracker()
    men_up_rt = RecordTracker()
    men_down_rt = RecordTracker()
    women_overall_rt = RecordTracker()
    women_up_rt = RecordTracker()
    women_down_rt = RecordTracker()

    # Pre-build men's winning time by year for "women would have won men's" check
    men_winners_by_year: dict[int, tuple[str, int, str]] = {}
    for yr in all_years:
        ri_tmp = race_info.get(yr, {})
        if ri_tmp.get("cancelled"):
            continue
        winner_row = conn.execute("""
            SELECT name, time FROM results
            WHERE year = ? AND pos = '1' AND time != '' AND time IS NOT NULL
            AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
            ORDER BY time ASC LIMIT 1
        """, (yr,)).fetchone()
        if winner_row:
            secs = time_to_seconds(winner_row[1])
            if secs and secs >= 16000:
                men_winners_by_year[yr] = (winner_row[0], secs, winner_row[1])

    # Pre-build winner time history for uncanny double detection
    # {athlete_id: [(year, time_str, secs, direction), ...]}
    winner_time_history: dict[str, list[tuple]] = defaultdict(list)
    for yr in all_years:
        ri_tmp = race_info.get(yr, {})
        if ri_tmp.get("cancelled"):
            continue
        d = ri_tmp.get("direction", "").strip().title()
        winner_rows_tmp = conn.execute("""
            SELECT UPPER(athlete_id), time FROM results
            WHERE year = ? AND pos = '1' AND time != '' AND time IS NOT NULL
            AND time LIKE '%:%' AND medal NOT IN ('DNF','DNS','Not started','DQ')
            LIMIT 1
        """, (yr,)).fetchall()
        for uid, t in winner_rows_tmp:
            s = time_to_seconds(t)
            if s and s >= 16000:
                winner_time_history[uid].append((yr, t, s, d))

    logger.info(f"  Generating {len(all_years)} year detail files...")

    for year in all_years:
        ri = race_info.get(year, {})

        # If cancelled, minimal file
        if ri.get("cancelled"):
            # Generate narrative for cancelled years
            cancel_reasons = {
                1941: "The race was not held due to World War II.",
                1942: "The race was not held due to World War II.",
                1943: "The race was not held due to World War II.",
                1944: "The race was not held due to World War II.",
                1945: "The race was not held due to World War II. The race would return in 1946 after the war ended.",
                2020: "The race was cancelled due to the global COVID-19 pandemic, the first cancellation since World War II.",
                2021: "The race was cancelled for a second consecutive year due to the ongoing COVID-19 pandemic.",
            }
            narrative = cancel_reasons.get(year, "The race was not held this year.")
            detail = {
                "year": year,
                "raceNumber": ri.get("raceNumber", ""),
                "date": ri.get("date", ""),
                "direction": ri.get("direction", ""),
                "distance": ri.get("distance", ""),
                "weather": ri.get("weather", ""),
                "temperature": ri.get("temperature", ""),
                "timeLimit": ri.get("timeLimit", ""),
                "cancelled": True,
                "narrative": narrative,
            }
            write_json(os.path.join(year_dir, f"{year}.json"), detail)
            continue

        # ---- Key stats ----
        finisher_rows = conn.execute("""
            SELECT UPPER(athlete_id), name, time, pos, medal, club, country, category, gender_pos
            FROM results
            WHERE year = ? AND medal != '' AND medal IS NOT NULL
            AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
            AND time IS NOT NULL AND time != '' AND time NOT IN ('DNF', 'DNS', 'DQ')
            AND time LIKE '%:%'
            AND pos IS NOT NULL AND pos != '' AND CAST(pos AS INTEGER) > 0
            ORDER BY CAST(pos AS INTEGER) ASC
        """, (year,)).fetchall()

        total_entries = conn.execute(
            "SELECT COUNT(*) FROM results WHERE year = ?", (year,)
        ).fetchone()[0]

        finisher_count = len(finisher_rows)
        male_count = sum(1 for r in finisher_rows if gender_map.get(r[0]) == 'M')
        female_count = sum(1 for r in finisher_rows if gender_map.get(r[0]) == 'F')

        # Average finish time
        valid_times = [s for r in finisher_rows if (s := time_to_seconds(r[2] or "")) is not None]
        avg_finish_time = seconds_to_time(round(mean(valid_times))) if valid_times else ""

        finish_rate = round(finisher_count / total_entries * 100, 1) if total_entries > 0 else 0

        # ---- Podium ----
        top_men = []
        top_women = []
        for uid, name, time_str, pos, medal_val, club, country, category, _gpos in finisher_rows:
            corrected_medal_val = MEDAL_CORRECTIONS.get((uid, year), medal_val)
            entry = {
                "pos": int(pos) if pos and pos.isdigit() else 0,
                "name": name,
                "time": time_str or "",
                "athleteId": uid,
                "medal": corrected_medal_val,
            }
            g = gender_map.get(uid, "M")
            if g == "M" and len(top_men) < 10:
                top_men.append(entry)
            elif g == "F" and len(top_women) < 5:
                top_women.append(entry)
            if len(top_men) >= 10 and len(top_women) >= 5:
                break

        # ---- Last finisher ----
        last_finisher = None
        if finisher_rows:
            last = finisher_rows[-1]
            last_finisher = {"name": last[1], "time": last[2] or "", "pos": int(last[3]) if last[3] and last[3].isdigit() else 0}

        # ---- Record context ----
        this_direction = ri.get("direction", "")
        record_context: dict = {}

        # Men's records
        winner_m = top_men[0] if top_men else None
        if winner_m:
            m_secs = time_to_seconds(winner_m["time"])
            if m_secs and m_secs >= 16000:
                men_records_list: list[str] = []
                men_prev_record: dict | None = None

                prev = men_overall_rt.check(m_secs, winner_m["name"], year)
                if prev is not False:
                    men_records_list.append("overall")
                    if prev:  # has previous (not first-ever)
                        men_prev_record = {**prev, "type": "overall"}

                if this_direction == "Up":
                    prev_up = men_up_rt.check(m_secs, winner_m["name"], year)
                    if prev_up is not False and "overall" not in men_records_list:
                        men_records_list.append("up")
                        if prev_up and not men_prev_record:
                            men_prev_record = {**prev_up, "type": "up"}
                    elif prev_up is not False:
                        pass  # already tracked as overall
                elif this_direction == "Down":
                    prev_dn = men_down_rt.check(m_secs, winner_m["name"], year)
                    if prev_dn is not False and "overall" not in men_records_list:
                        men_records_list.append("down")
                        if prev_dn and not men_prev_record:
                            men_prev_record = {**prev_dn, "type": "down"}
                    elif prev_dn is not False:
                        pass

                if men_records_list:
                    record_context["menRecords"] = men_records_list
                if men_prev_record:
                    record_context["menPreviousRecord"] = men_prev_record

                # Heroic second place (men)
                if len(top_men) >= 2 and men_prev_record:
                    s2_secs = time_to_seconds(top_men[1]["time"])
                    prev_rec_secs = time_to_seconds(men_prev_record["time"])
                    if s2_secs and prev_rec_secs and s2_secs < prev_rec_secs:
                        record_context["heroicSecond"] = {
                            "name": top_men[1]["name"],
                            "time": top_men[1]["time"],
                            "athleteId": top_men[1]["athleteId"],
                            "brokenRecord": men_prev_record,
                        }

        # Women's records
        winner_f = top_women[0] if top_women else None
        if winner_f:
            f_secs = time_to_seconds(winner_f["time"])
            if f_secs and f_secs >= 18000:
                women_records_list: list[str] = []
                women_prev_record: dict | None = None

                prev = women_overall_rt.check(f_secs, winner_f["name"], year)
                if prev is not False:
                    women_records_list.append("overall")
                    if prev:
                        women_prev_record = {**prev, "type": "overall"}

                if this_direction == "Up":
                    prev_up = women_up_rt.check(f_secs, winner_f["name"], year)
                    if prev_up is not False and "overall" not in women_records_list:
                        women_records_list.append("up")
                        if prev_up and not women_prev_record:
                            women_prev_record = {**prev_up, "type": "up"}
                    elif prev_up is not False:
                        pass
                elif this_direction == "Down":
                    prev_dn = women_down_rt.check(f_secs, winner_f["name"], year)
                    if prev_dn is not False and "overall" not in women_records_list:
                        women_records_list.append("down")
                        if prev_dn and not women_prev_record:
                            women_prev_record = {**prev_dn, "type": "down"}
                    elif prev_dn is not False:
                        pass

                if women_records_list:
                    record_context["womenRecords"] = women_records_list
                if women_prev_record:
                    record_context["womenPreviousRecord"] = women_prev_record

                # Heroic second place (women)
                if len(top_women) >= 2 and women_prev_record:
                    s2_secs = time_to_seconds(top_women[1]["time"])
                    prev_rec_secs = time_to_seconds(women_prev_record["time"])
                    if s2_secs and prev_rec_secs and s2_secs < prev_rec_secs:
                        record_context["womenHeroicSecond"] = {
                            "name": top_women[1]["name"],
                            "time": top_women[1]["time"],
                            "athleteId": top_women[1]["athleteId"],
                            "brokenRecord": women_prev_record,
                        }

                # Women's time vs historical men
                if f_secs:
                    for check_yr in sorted(men_winners_by_year.keys(), reverse=True):
                        if check_yr < year:
                            m_name, m_secs_val, m_time = men_winners_by_year[check_yr]
                            if m_secs_val > f_secs:
                                record_context["womenWouldHaveWonMen"] = {
                                    "mostRecentYear": check_yr,
                                    "mensWinner": m_name,
                                    "mensTime": m_time,
                                }
                                break

        # Uncanny double: men's winner ran identical time in another year
        if winner_m:
            uid_m = winner_m["athleteId"]
            if uid_m in winner_time_history:
                for oy, ot, os_val, od in winner_time_history[uid_m]:
                    if oy != year and ot == winner_m["time"] and os_val % 60 != 0:
                        record_context["uncannyDouble"] = {
                            "otherYear": oy,
                            "time": ot,
                            "direction": od,
                            "sameDirection": od == this_direction if od and this_direction else None,
                        }
                        break  # take first match

        # ---- Medal distribution ----
        medals = {}
        for r in finisher_rows:
            m = MEDAL_CORRECTIONS.get((r[0], year), r[4])
            if m:
                medals[m] = medals.get(m, 0) + 1

        # ---- Time distribution histogram ----
        time_buckets = {"Sub 6h": 0, "6-7h": 0, "7-8h": 0, "8-9h": 0, "9-10h": 0, "10-11h": 0, "11-12h": 0}
        for r in finisher_rows:
            secs = time_to_seconds(r[2] or "")
            if secs is not None:
                if secs < 21600:
                    time_buckets["Sub 6h"] += 1
                elif secs < 25200:
                    time_buckets["6-7h"] += 1
                elif secs < 28800:
                    time_buckets["7-8h"] += 1
                elif secs < 32400:
                    time_buckets["8-9h"] += 1
                elif secs < 36000:
                    time_buckets["9-10h"] += 1
                elif secs < 39600:
                    time_buckets["10-11h"] += 1
                else:
                    time_buckets["11-12h"] += 1

        time_distribution = [{"bucket": k, "count": v} for k, v in time_buckets.items()]

        # ---- Category breakdown ----
        cat_data: dict[str, dict] = defaultdict(lambda: {"count": 0, "total_secs": 0, "time_count": 0})
        for r in finisher_rows:
            norm_cat = normalize_category(r[7] or "")
            if norm_cat:
                cat_data[norm_cat]["count"] += 1
                secs = time_to_seconds(r[2] or "")
                if secs is not None:
                    cat_data[norm_cat]["total_secs"] += secs
                    cat_data[norm_cat]["time_count"] += 1

        category_breakdown = []
        for cat in ["Senior", "40-49", "50-59", "60+"]:
            d = cat_data.get(cat)
            if d and d["count"] > 0:
                avg_t = seconds_to_time(round(d["total_secs"] / d["time_count"])) if d["time_count"] > 0 else ""
                category_breakdown.append({"category": cat, "count": d["count"], "avgTime": avg_t})

        # ---- Top countries (with corrections applied) ----
        country_counts: dict[str, int] = defaultdict(int)
        for r in finisher_rows:
            uid = r[0]
            raw_c = r[6]
            if uid in ATHLETE_COUNTRY_CORRECTIONS:
                c = clean_country_name(ATHLETE_COUNTRY_CORRECTIONS[uid])
            elif uid in club_fixes:
                c = clean_country_name(club_fixes[uid])
            elif raw_c:
                c = clean_country_name(raw_c)
            else:
                c = ""
            if c:
                country_counts[c] += 1
        top_countries = sorted(
            [{"country": c, "count": n} for c, n in country_counts.items()],
            key=lambda x: -x["count"]
        )[:20]

        # ---- First-timers ----
        first_timer_count = 0
        for r in finisher_rows:
            uid = r[0]
            if first_finish_year.get(uid) == year:
                first_timer_count += 1
        first_timers = {
            "count": first_timer_count,
            "total": finisher_count,
            "percentage": round(first_timer_count / finisher_count * 100, 1) if finisher_count > 0 else 0,
        }

        # ---- Same-direction comparison ----
        same_dir_comparison = None
        this_direction = ri.get("direction", "")
        if this_direction:
            # Find the previous year with the same direction
            prev_year = None
            for py, pd in reversed(direction_history):
                if pd == this_direction and py < year:
                    prev_year = py
                    break

            if prev_year and prev_year in year_stats_lookup:
                curr = year_stats_lookup.get(year)
                prev = year_stats_lookup.get(prev_year)
                if curr and prev:
                    # Get winning times
                    curr_winner = conn.execute("""
                        SELECT time FROM results
                        WHERE year = ? AND pos = '1' AND time != '' AND time IS NOT NULL
                        AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
                        ORDER BY time ASC LIMIT 1
                    """, (year,)).fetchone()
                    prev_winner = conn.execute("""
                        SELECT time FROM results
                        WHERE year = ? AND pos = '1' AND time != '' AND time IS NOT NULL
                        AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
                        ORDER BY time ASC LIMIT 1
                    """, (prev_year,)).fetchone()

                    curr_win_secs = time_to_seconds(curr_winner[0]) if curr_winner else None
                    prev_win_secs = time_to_seconds(prev_winner[0]) if prev_winner else None

                    same_dir_comparison = {
                        "previousYear": prev_year,
                        "direction": this_direction,
                        "deltas": {
                            "fieldSize": {
                                "current": curr["entries"],
                                "previous": prev["entries"],
                                "delta": curr["entries"] - prev["entries"],
                                "deltaPct": round((curr["entries"] - prev["entries"]) / prev["entries"] * 100, 1) if prev["entries"] > 0 else 0,
                            },
                            "finishers": {
                                "current": curr["finishers"],
                                "previous": prev["finishers"],
                                "delta": curr["finishers"] - prev["finishers"],
                                "deltaPct": round((curr["finishers"] - prev["finishers"]) / prev["finishers"] * 100, 1) if prev["finishers"] > 0 else 0,
                            },
                            "finishRate": {
                                "current": curr["finishRate"],
                                "previous": prev["finishRate"],
                                "delta": round(curr["finishRate"] - prev["finishRate"], 1),
                            },
                        },
                    }
                    if curr_win_secs and prev_win_secs:
                        same_dir_comparison["deltas"]["winningTime"] = {
                            "current": curr_winner[0] if curr_winner else "",
                            "previous": prev_winner[0] if prev_winner else "",
                            "deltaSeconds": curr_win_secs - prev_win_secs,
                        }
                    if curr["avgSecs"] and prev["avgSecs"]:
                        same_dir_comparison["deltas"]["avgTime"] = {
                            "current": seconds_to_time(curr["avgSecs"]),
                            "previous": seconds_to_time(prev["avgSecs"]),
                            "deltaSeconds": curr["avgSecs"] - prev["avgSecs"],
                        }

        # ---- Historical rank ----
        historical_rank = {
            "fieldSizeRank": field_size_rank.get(year, 0),
            "finishersRank": finishers_rank.get(year, 0),
            "finishRateRank": finish_rate_rank.get(year, 0),
            "winningTimeRank": winning_time_rank.get(year, 0),
            "winningTimeRankDir": winning_time_rank_dir.get(year, 0),
            "totalRaces": total_races,
        }

        # ---- Assemble ----
        detail = {
            "year": year,
            "raceNumber": ri.get("raceNumber", ""),
            "date": ri.get("date", ""),
            "direction": this_direction,
            "distance": ri.get("distance", ""),
            "weather": ri.get("weather", ""),
            "temperature": ri.get("temperature", ""),
            "timeLimit": ri.get("timeLimit", ""),
            "cancelled": False,

            "entries": total_entries,
            "starters": ri.get("starters", 0),
            "finishers": finisher_count,
            "finishRate": finish_rate,
            "maleFinishers": male_count,
            "femaleFinishers": female_count,
            "avgFinishTime": avg_finish_time,

            "medals": medals,
            "topMen": top_men,
            "topWomen": top_women,
            "lastFinisher": last_finisher,

            "timeDistribution": time_distribution,
            "categoryBreakdown": category_breakdown,
            "topCountries": top_countries,
            "firstTimers": first_timers,

            "sameDirectionComparison": same_dir_comparison,
            "historicalRank": historical_rank,
            "recordContext": record_context if record_context else None,
            "narrative": "",  # placeholder, generated below
        }

        # Add country coverage metric so frontend can decide whether to show chart
        total_with_country = sum(1 for c, n in country_counts.items())
        country_runners_total = sum(n for c, n in country_counts.items())
        detail["countryDataPct"] = round(country_runners_total / finisher_count * 100, 1) if finisher_count > 0 else 0

        # Generate original narrative from structured data
        detail["narrative"] = generate_narrative(detail)

        write_json(os.path.join(year_dir, f"{year}.json"), detail)

        # ---- Country-athletes JSON (separate file, loaded on demand) ----
        if country_runners_total > 0:  # generate for any year with country data
            country_athletes: dict[str, list] = defaultdict(list)
            for r in finisher_rows:
                uid = r[0]
                raw_c = r[6]
                gender_pos_val = r[8]
                if uid in ATHLETE_COUNTRY_CORRECTIONS:
                    c = clean_country_name(ATHLETE_COUNTRY_CORRECTIONS[uid])
                elif uid in club_fixes:
                    c = clean_country_name(club_fixes[uid])
                elif raw_c:
                    c = clean_country_name(raw_c)
                else:
                    c = ""
                if not c:
                    continue
                corrected_medal = MEDAL_CORRECTIONS.get((r[0], year), r[4])
                country_athletes[c].append({
                    "name": r[1],
                    "athleteId": uid,
                    "time": r[2] or "",
                    "pos": int(r[3]) if r[3] and str(r[3]).isdigit() else 0,
                    "genderPos": int(gender_pos_val) if gender_pos_val and str(gender_pos_val).isdigit() else 0,
                    "medal": corrected_medal or "",
                    "gender": gender_map.get(uid, "M"),
                })
            write_json(os.path.join(year_dir, f"{year}-country-athletes.json"), dict(country_athletes))

    logger.info(f"  {len(all_years)} year detail files written to year/")


# ---------------------------------------------------------------------------
# Country Detail Export
# ---------------------------------------------------------------------------

def export_country_details(conn: sqlite3.Connection, out_dir: str, gender_map: dict[str, str],
                           club_country_fixes: dict[str, str] | None = None):
    """Export per-country detail JSON files to country/{slug}.json and countries.json."""
    logger.info("Exporting country details...")
    club_country_fixes = club_country_fixes or {}

    country_dir = os.path.join(out_dir, "country")
    os.makedirs(country_dir, exist_ok=True)

    # Query ALL finisher rows (including those with empty country)
    rows = conn.execute("""
        SELECT UPPER(athlete_id), name, COALESCE(country, ''), year, time, medal, pos, gender_pos
        FROM results
        WHERE medal != '' AND medal IS NOT NULL
        AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
        AND time IS NOT NULL AND time != '' AND time LIKE '%:%'
        AND time NOT IN ('DNF', 'DNS', 'DQ', '00:00:00')
        AND pos IS NOT NULL AND pos != '' AND CAST(pos AS INTEGER) > 0
        AND year <= 2025
    """).fetchall()

    # Build a map of athlete -> most common (non-empty) country
    # so we can attribute blank-country rows to the right country
    athlete_country_counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for uid, _name, country, _year, _time, _medal, _pos, _gp in rows:
        if country and country.strip():
            athlete_country_counts[uid][country] += 1

    athlete_primary_country: dict[str, str] = {}
    for uid, cc in athlete_country_counts.items():
        athlete_primary_country[uid] = max(cc, key=cc.get)

    # Group by CLEANED country name, attributing blank-country rows to athlete's primary country
    # Also apply manual corrections and club-inferred corrections
    country_data: dict[str, list] = defaultdict(list)
    for uid, name, country, year, time_str, medal, pos, gp in rows:
        # Priority: manual corrections > club-inferred > actual country > primary country
        if uid in ATHLETE_COUNTRY_CORRECTIONS:
            effective_country = ATHLETE_COUNTRY_CORRECTIONS[uid]
        elif uid in club_country_fixes:
            effective_country = club_country_fixes[uid]
        elif country and country.strip():
            effective_country = country
        else:
            effective_country = athlete_primary_country.get(uid, "")
        if not effective_country:
            continue  # athlete has NO country data at all
        # Group by cleaned name to merge variants like "Netherlands" / "Netherlands (the)"
        cleaned = clean_country_name(effective_country)
        country_data[cleaned].append({
            "uid": uid, "name": name, "year": year,
            "time": time_str, "medal": medal, "pos": pos, "gp": gp,
        })

    exclude = {"", "ANA", "International"}
    countries_listing = []
    slug_check: dict[str, str] = {}  # slug -> display name (collision check)

    for display_name, entries in country_data.items():
        if display_name in exclude:
            continue

        slug = slugify_country(display_name)
        flag = country_to_flag(display_name)

        # Collision check
        if slug in slug_check and slug_check[slug] != display_name:
            logger.warning(f"  Slug collision: '{slug}' for '{display_name}' and '{slug_check[slug]}'")
        slug_check[slug] = display_name

        total_finishers = len(entries)
        unique_athletes = len(set(e["uid"] for e in entries))
        years_present = sorted(set(e["year"] for e in entries))
        first_year = years_present[0]
        latest_year = years_present[-1]

        all_secs = [s for e in entries if (s := time_to_seconds(e["time"])) and s >= 18000]
        avg_seconds = round(mean(all_secs)) if all_secs else None
        avg_time = seconds_to_time(avg_seconds) if avg_seconds else None

        # --- Year-by-year series ---
        year_groups: dict[int, list] = defaultdict(list)
        for e in entries:
            year_groups[e["year"]].append(e)

        yearly_series = []
        for yr in sorted(year_groups.keys()):
            yr_entries = year_groups[yr]
            yr_finishers = len(yr_entries)

            males = sum(1 for e in yr_entries if gender_map.get(e["uid"]) != "F")
            females = sum(1 for e in yr_entries if gender_map.get(e["uid"]) == "F")

            yr_secs = [s for e in yr_entries if (s := time_to_seconds(e["time"])) and s >= 18000]
            yr_avg = seconds_to_time(round(mean(yr_secs))) if yr_secs else None

            medals_yr: dict[str, int] = defaultdict(int)
            for e in yr_entries:
                medals_yr[e["medal"]] += 1

            positions = [int(e["pos"]) for e in yr_entries if e["pos"].isdigit()]
            best_pos = min(positions) if positions else None

            yearly_series.append({
                "year": yr,
                "finishers": yr_finishers,
                "male": males,
                "female": females,
                "avgTime": yr_avg,
                "medals": dict(medals_yr),
                "bestPosition": best_pos,
            })

        # --- Medal summary ---
        medal_summary: dict[str, int] = defaultdict(int)
        for e in entries:
            medal_summary[e["medal"]] += 1

        # --- Top runners (by finish count) ---
        athlete_stats: dict[str, dict] = defaultdict(lambda: {
            "name": "", "finishes": 0, "bestTime": "99:99:99", "uid": "",
        })
        for e in entries:
            a = athlete_stats[e["uid"]]
            a["name"] = e["name"]
            a["uid"] = e["uid"]
            a["finishes"] += 1
            if e["time"] < a["bestTime"]:
                a["bestTime"] = e["time"]

        top_runners = sorted(athlete_stats.values(), key=lambda x: (-x["finishes"], x["bestTime"]))[:10]
        top_runners_out = [{
            "name": r["name"],
            "finishes": r["finishes"],
            "bestTime": r["bestTime"],
            "athleteId": r["uid"],
        } for r in top_runners]

        # --- Podium finishes (pos <= 3 for men, gender_pos <= 3 for women) ---
        podiums_men = []
        podiums_women = []
        for e in entries:
            pos_int = int(e["pos"]) if e["pos"].isdigit() else 999
            gp_int = int(e["gp"]) if (e["gp"] and str(e["gp"]).isdigit()) else 999
            gender = gender_map.get(e["uid"], "M")
            if gender == "F":
                if gp_int <= 3:
                    podiums_women.append({
                        "year": e["year"],
                        "name": e["name"],
                        "pos": gp_int,
                        "overallPos": pos_int,
                        "time": e["time"],
                        "athleteId": e["uid"],
                    })
            else:
                if pos_int <= 3:
                    podiums_men.append({
                        "year": e["year"],
                        "name": e["name"],
                        "pos": pos_int,
                        "time": e["time"],
                        "athleteId": e["uid"],
                    })
        podiums_men.sort(key=lambda x: (x["year"], x["pos"]))
        podiums_women.sort(key=lambda x: (x["year"], x["pos"]))

        country_detail = {
            "name": display_name,
            "slug": slug,
            "flag": flag,
            "overview": {
                "totalFinishers": total_finishers,
                "uniqueAthletes": unique_athletes,
                "firstYear": first_year,
                "latestYear": latest_year,
                "avgTime": avg_time,
                "avgSeconds": avg_seconds,
                "yearsActive": len(years_present),
            },
            "yearlySeries": yearly_series,
            "medalSummary": dict(medal_summary),
            "topRunners": top_runners_out,
            "podiumsMen": podiums_men,
            "podiumsWomen": podiums_women,
        }

        write_json(os.path.join(country_dir, f"{slug}.json"), country_detail)

        countries_listing.append({
            "name": display_name,
            "slug": slug,
            "flag": flag,
            "totalFinishers": total_finishers,
            "uniqueAthletes": unique_athletes,
            "firstYear": first_year,
            "latestYear": latest_year,
            "avgTime": avg_time,
            "yearsActive": len(years_present),
        })

    countries_listing.sort(key=lambda x: -x["totalFinishers"])
    write_json(os.path.join(out_dir, "countries.json"), countries_listing)
    logger.info(f"  {len(countries_listing)} country files + countries.json written")


# ---------------------------------------------------------------------------
# Records & Stories
# ---------------------------------------------------------------------------

def export_records(conn: sqlite3.Connection, out_dir: str, gender_map: dict[str, str]):
    """Export records.json with remarkable stories and records from the dataset."""
    logger.info("Exporting records.json...")

    race_years = get_valid_race_years(conn)

    # ------------------------------------------------------------------
    # Build athlete -> primary country lookup (most common non-empty country)
    # Used throughout records to ensure every athlete has a country.
    # ------------------------------------------------------------------
    _country_rows = conn.execute("""
        SELECT UPPER(athlete_id), country FROM results
        WHERE country IS NOT NULL AND country != '' AND year <= 2025
    """).fetchall()
    _athlete_country_counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for _uid, _c in _country_rows:
        _athlete_country_counts[_uid][_c] += 1
    athlete_primary_country: dict[str, str] = {}
    for _uid, _cc in _athlete_country_counts.items():
        athlete_primary_country[_uid] = clean_country_name(max(_cc, key=_cc.get))

    # ------------------------------------------------------------------
    # 1. All-time winners and gap between wins
    # ------------------------------------------------------------------
    winners_rows = conn.execute("""
        SELECT UPPER(athlete_id) as uid, name, year, time, country
        FROM results
        WHERE CAST(pos AS INTEGER) = 1 AND pos != ''
        AND medal NOT IN ('DNF','DNS','Not started','DQ')
        AND year <= 2025
        ORDER BY year
    """).fetchall()

    # Group by athlete
    winner_map: dict[str, dict] = {}
    for uid, name, year, time_str, country in winners_rows:
        gender = gender_map.get(uid, "M")
        if uid not in winner_map:
            winner_map[uid] = {"name": name, "uid": uid, "gender": gender,
                               "country": athlete_primary_country.get(uid, clean_country_name(country or "")),
                               "years": [], "times": []}
        winner_map[uid]["years"].append(year)
        winner_map[uid]["times"].append(time_str)

    # Also get women's winners (gender_pos=1)
    women_winners_rows = conn.execute("""
        SELECT UPPER(athlete_id) as uid, name, year, time, country
        FROM results
        WHERE CAST(gender_pos AS INTEGER) = 1
        AND gender_pos IS NOT NULL AND gender_pos != ''
        AND medal NOT IN ('DNF','DNS','Not started','DQ')
        AND year <= 2025
        ORDER BY year
    """).fetchall()
    for uid, name, year, time_str, country in women_winners_rows:
        if gender_map.get(uid) != "F":
            continue
        if uid not in winner_map:
            winner_map[uid] = {"name": name, "uid": uid, "gender": "F",
                               "country": athlete_primary_country.get(uid, clean_country_name(country or "")),
                               "years": [], "times": []}
        if year not in winner_map[uid]["years"]:
            winner_map[uid]["years"].append(year)
            winner_map[uid]["times"].append(time_str)

    # Build remarkable winners list
    remarkable_winners = []
    for uid, w in winner_map.items():
        years = sorted(w["years"])
        if len(years) < 2:
            continue
        max_gap = max(years[i+1] - years[i] for i in range(len(years)-1))
        span = years[-1] - years[0]
        remarkable_winners.append({
            "name": w["name"], "athleteId": uid, "gender": w["gender"],
            "country": w["country"],
            "wins": len(years), "years": years, "times": w["times"],
            "maxGap": max_gap, "span": span,
        })
    remarkable_winners.sort(key=lambda x: (-x["maxGap"], -x["wins"]))

    # ------------------------------------------------------------------
    # 2. Longest career spans
    # Require at least 5 finishes to filter out ID collisions where two
    # different athletes share the same athlete_id across distant eras.
    # ------------------------------------------------------------------
    career_rows = conn.execute("""
        SELECT UPPER(athlete_id) as uid, name,
               MIN(year) as first_year, MAX(year) as last_year,
               COUNT(*) as total_races
        FROM results
        WHERE athlete_id IS NOT NULL AND athlete_id != ''
        AND medal NOT IN ('DNF','DNS','Not started','DQ')
        AND time IS NOT NULL AND time != '' AND time LIKE '%:%'
        AND year <= 2025
        GROUP BY UPPER(athlete_id)
        HAVING COUNT(*) >= 5
        ORDER BY (MAX(year) - MIN(year)) DESC
        LIMIT 20
    """).fetchall()

    longest_careers = [{
        "name": name, "athleteId": uid,
        "firstYear": fy, "lastYear": ly,
        "span": ly - fy, "totalRaces": tr,
    } for uid, name, fy, ly, tr in career_rows]

    # ------------------------------------------------------------------
    # 3. Most consecutive finishes
    # ------------------------------------------------------------------
    all_finish_rows = conn.execute("""
        SELECT UPPER(athlete_id) as uid, name, year
        FROM results
        WHERE medal NOT IN ('DNF','DNS','Not started','DQ')
        AND time IS NOT NULL AND time != '' AND time LIKE '%:%'
        AND year <= 2025
        ORDER BY uid, year
    """).fetchall()

    athlete_finish_years: dict[str, tuple[str, list[int]]] = {}
    for uid, name, year in all_finish_rows:
        if uid not in athlete_finish_years:
            athlete_finish_years[uid] = (name, [])
        athlete_finish_years[uid] = (name, athlete_finish_years[uid][1] + [year])

    race_years_set = set(race_years)

    def longest_streak(years: list[int]) -> tuple[int, int, int]:
        """Return (streak_len, start_year, end_year) of longest consecutive finish streak."""
        if not years:
            return (0, 0, 0)
        sorted_yrs = sorted(set(years))
        best = (1, sorted_yrs[0], sorted_yrs[0])
        cur_start = sorted_yrs[0]
        cur_len = 1
        for i in range(1, len(sorted_yrs)):
            # Check if there were race years between this and previous
            gap_years = [y for y in race_years if sorted_yrs[i-1] < y < sorted_yrs[i]]
            if not gap_years:
                # Consecutive race years
                cur_len += 1
                if cur_len > best[0]:
                    best = (cur_len, cur_start, sorted_yrs[i])
            else:
                cur_start = sorted_yrs[i]
                cur_len = 1
        return best

    streaks = []
    for uid, (name, years) in athlete_finish_years.items():
        streak_len, start, end = longest_streak(years)
        if streak_len >= 25:
            streaks.append({
                "name": name, "athleteId": uid,
                "streak": streak_len, "startYear": start, "endYear": end,
                "totalFinishes": len(years),
            })
    streaks.sort(key=lambda x: -x["streak"])
    streaks = streaks[:15]

    # ------------------------------------------------------------------
    # 4. Narrowest winning margins
    # ------------------------------------------------------------------
    margin_rows = conn.execute("""
        SELECT r1.year, r1.name, r1.time, r2.name, r2.time
        FROM results r1
        JOIN results r2 ON r1.year = r2.year
        WHERE CAST(r1.pos AS INTEGER) = 1 AND CAST(r2.pos AS INTEGER) = 2
        AND r1.time LIKE '%:%' AND r2.time LIKE '%:%'
        AND r1.medal NOT IN ('DNF','DNS','Not started','DQ')
        AND r2.medal NOT IN ('DNF','DNS','Not started','DQ')
        AND r1.year <= 2025
        ORDER BY r1.year
    """).fetchall()

    margins = []
    for year, w_name, w_time, r_name, r_time in margin_rows:
        ws = time_to_seconds(w_time)
        rs = time_to_seconds(r_time)
        if ws and rs:
            margin_sec = rs - ws
            margins.append({
                "year": year,
                "winner": w_name, "winnerTime": w_time,
                "runnerUp": r_name, "runnerUpTime": r_time,
                "marginSeconds": margin_sec,
            })
    margins.sort(key=lambda x: x["marginSeconds"])
    narrowest_margins = margins[:10]
    widest_margins = sorted(margins, key=lambda x: -x["marginSeconds"])[:5]

    # ------------------------------------------------------------------
    # 5. Comeback stories (DNF then podium)
    # Only use actual DNFs (time='DNF'), NOT DNS/Not started.
    # For women, use gender_pos (not overall pos) since a woman
    # winning the women's race typically finishes ~20th-30th overall.
    # ------------------------------------------------------------------
    dnf_rows = conn.execute("""
        SELECT UPPER(athlete_id) as uid, name, year
        FROM results
        WHERE time = 'DNF'
        AND athlete_id IS NOT NULL AND athlete_id != ''
        AND year <= 2025
    """).fetchall()
    dnf_athletes: dict[str, list[int]] = defaultdict(list)
    for uid, name, year in dnf_rows:
        dnf_athletes[uid].append(year)

    # Men's comebacks: DNF then overall pos <= 3
    top_finish_rows = conn.execute("""
        SELECT UPPER(athlete_id) as uid, name, year, time,
               CAST(pos AS INTEGER) as p, CAST(gender_pos AS INTEGER) as gp
        FROM results
        WHERE CAST(pos AS INTEGER) <= 3 AND CAST(pos AS INTEGER) > 0
        AND medal NOT IN ('','DNF','DNS','Not started','DQ')
        AND time LIKE '%:%'
        AND year <= 2025
        ORDER BY uid, year
    """).fetchall()

    # Women's comebacks: DNF then gender_pos <= 3
    women_top_rows = conn.execute("""
        SELECT UPPER(athlete_id) as uid, name, year, time,
               CAST(pos AS INTEGER) as p, CAST(gender_pos AS INTEGER) as gp
        FROM results
        WHERE CAST(gender_pos AS INTEGER) <= 3 AND CAST(gender_pos AS INTEGER) > 0
        AND medal NOT IN ('','DNF','DNS','Not started','DQ')
        AND time LIKE '%:%'
        AND year <= 2025
        ORDER BY uid, year
    """).fetchall()

    comebacks = []

    # Men's comebacks (overall podium)
    for uid, name, year, time_str, pos, gp in top_finish_rows:
        if gender_map.get(uid) == "F":
            continue  # women handled separately
        if uid in dnf_athletes:
            prior_dnfs = [y for y in dnf_athletes[uid] if y < year]
            if prior_dnfs:
                comebacks.append({
                    "name": name, "athleteId": uid,
                    "gender": "M",
                    "dnfYear": max(prior_dnfs),
                    "comebackYear": year,
                    "comebackPos": pos,
                    "comebackGenderPos": pos,
                    "comebackTime": time_str,
                })

    # Women's comebacks (gender podium)
    for uid, name, year, time_str, pos, gp in women_top_rows:
        if gender_map.get(uid) != "F":
            continue
        if uid in dnf_athletes:
            prior_dnfs = [y for y in dnf_athletes[uid] if y < year]
            if prior_dnfs:
                comebacks.append({
                    "name": name, "athleteId": uid,
                    "gender": "F",
                    "dnfYear": max(prior_dnfs),
                    "comebackYear": year,
                    "comebackPos": gp,  # gender position (what matters for women)
                    "comebackGenderPos": gp,
                    "overallPos": pos,
                    "comebackTime": time_str,
                })

    # Keep only the best comeback per athlete
    comebacks.sort(key=lambda x: (x["comebackPos"], x["comebackYear"]))
    seen_athletes: set[str] = set()
    unique_comebacks = []
    for c in comebacks:
        if c["athleteId"] not in seen_athletes:
            seen_athletes.add(c["athleteId"])
            unique_comebacks.append(c)
    comebacks = unique_comebacks[:15]

    # ------------------------------------------------------------------
    # 6. Most podium finishes
    # ------------------------------------------------------------------
    podium_rows = conn.execute("""
        SELECT UPPER(athlete_id) as uid, name, year, CAST(pos AS INTEGER), time
        FROM results
        WHERE CAST(pos AS INTEGER) <= 3 AND CAST(pos AS INTEGER) > 0
        AND medal NOT IN ('DNF','DNS','Not started','DQ')
        AND year <= 2025
        ORDER BY year
    """).fetchall()
    podium_athletes: dict[str, dict] = {}
    for uid, name, year, pos, time_str in podium_rows:
        if uid not in podium_athletes:
            podium_athletes[uid] = {"name": name, "uid": uid, "podiums": []}
        podium_athletes[uid]["podiums"].append({"year": year, "pos": pos, "time": time_str})

    # Also women's podiums (gender_pos <= 3)
    women_podium_rows = conn.execute("""
        SELECT UPPER(athlete_id) as uid, name, year, CAST(gender_pos AS INTEGER), time
        FROM results
        WHERE CAST(gender_pos AS INTEGER) <= 3 AND CAST(gender_pos AS INTEGER) > 0
        AND medal NOT IN ('DNF','DNS','Not started','DQ')
        AND year <= 2025
        ORDER BY year
    """).fetchall()
    for uid, name, year, gpos, time_str in women_podium_rows:
        if gender_map.get(uid) != "F":
            continue
        if uid not in podium_athletes:
            podium_athletes[uid] = {"name": name, "uid": uid, "podiums": []}
        # Avoid dupes (a woman might be in both queries for very early races)
        if not any(p["year"] == year for p in podium_athletes[uid]["podiums"]):
            podium_athletes[uid]["podiums"].append({"year": year, "pos": gpos, "time": time_str})

    repeat_podiums = []
    for uid, data in podium_athletes.items():
        if len(data["podiums"]) >= 3:
            podiums = sorted(data["podiums"], key=lambda x: x["year"])
            repeat_podiums.append({
                "name": data["name"], "athleteId": uid,
                "gender": gender_map.get(uid, "M"),
                "count": len(podiums),
                "podiums": podiums,
                "span": podiums[-1]["year"] - podiums[0]["year"],
            })
    repeat_podiums.sort(key=lambda x: (-x["count"], -x["span"]))
    repeat_podiums = repeat_podiums[:15]

    # ------------------------------------------------------------------
    # 7. Most improved (biggest time improvement first race → best race)
    # ------------------------------------------------------------------
    improvement_rows = conn.execute("""
        SELECT UPPER(athlete_id) as uid, name, year, time
        FROM results
        WHERE medal NOT IN ('DNF','DNS','Not started','DQ')
        AND time IS NOT NULL AND time != '' AND time LIKE '%:%'
        AND time NOT IN ('00:00:00','DNF','DNS')
        AND year <= 2025
        ORDER BY uid, year
    """).fetchall()

    athlete_times: dict[str, list[tuple]] = defaultdict(list)
    for uid, name, year, time_str in improvement_rows:
        secs = time_to_seconds(time_str)
        if secs and secs >= 18000:
            athlete_times[uid].append((name, year, time_str, secs))

    most_improved = []
    for uid, records in athlete_times.items():
        if len(records) < 3:
            continue
        first = records[0]
        best = min(records, key=lambda x: x[3])
        improvement = first[3] - best[3]
        if improvement > 10800:  # > 3 hours improvement
            most_improved.append({
                "name": first[0], "athleteId": uid,
                "firstYear": first[1], "firstTime": first[2],
                "bestYear": best[1], "bestTime": best[2],
                "improvementSeconds": improvement,
                "totalRaces": len(records),
            })
    most_improved.sort(key=lambda x: -x["improvementSeconds"])
    most_improved = most_improved[:12]

    # ------------------------------------------------------------------
    # 8. Wally Hayward's full record
    # ------------------------------------------------------------------
    hayward_rows = conn.execute("""
        SELECT year, time, pos, medal, gender_pos, category
        FROM results
        WHERE name LIKE '%HAYWARD%' AND name LIKE '%Wally%'
        AND year <= 2025
        ORDER BY year
    """).fetchall()
    wally_hayward = [{
        "year": y, "time": t, "pos": p, "medal": m,
        "genderPos": gp, "category": c,
    } for y, t, p, m, gp, c in hayward_rows]

    # ------------------------------------------------------------------
    # 9. Won after many attempts
    # ------------------------------------------------------------------
    winner_uids = set(w["uid"] for w in winner_map.values())
    won_after_many = []
    for uid in winner_uids:
        if uid in athlete_times:
            records = sorted(athlete_times[uid], key=lambda x: x[1])
            win_years = winner_map[uid]["years"]
            first_win = min(win_years)
            races_before_win = len([r for r in records if r[1] < first_win])
            if races_before_win >= 4:
                won_after_many.append({
                    "name": winner_map[uid]["name"],
                    "athleteId": uid,
                    "gender": winner_map[uid]["gender"],
                    "racesBeforeWin": races_before_win,
                    "firstWinYear": first_win,
                    "totalWins": len(win_years),
                })
    won_after_many.sort(key=lambda x: -x["racesBeforeWin"])
    won_after_many = won_after_many[:10]

    # ------------------------------------------------------------------
    # 10. Unusual countries (single finisher)
    # ------------------------------------------------------------------
    country_firsts_rows = conn.execute("""
        SELECT country, MIN(year) as first_year, name, UPPER(athlete_id),
               COUNT(DISTINCT UPPER(athlete_id)) as total_athletes
        FROM results
        WHERE country IS NOT NULL AND country != ''
        AND medal NOT IN ('DNF','DNS','Not started','DQ')
        AND time IS NOT NULL AND time != '' AND time LIKE '%:%'
        AND year <= 2025
        GROUP BY country
        HAVING total_athletes <= 3
        ORDER BY first_year DESC
    """).fetchall()

    # For each small country, get the actual first finisher details
    unusual_countries = []
    for raw_country, first_year, name, uid, total_athletes in country_firsts_rows:
        display = clean_country_name(raw_country)
        if display in ("", "ANA", "International"):
            continue
        # Get first finisher's details
        first_row = conn.execute("""
            SELECT name, year, time, pos, UPPER(athlete_id)
            FROM results
            WHERE country = ? AND year = ?
            AND medal NOT IN ('DNF','DNS','Not started','DQ')
            AND time IS NOT NULL AND time != '' AND time LIKE '%:%'
            ORDER BY CAST(pos AS INTEGER)
            LIMIT 1
        """, (raw_country, first_year)).fetchone()
        if first_row:
            unusual_countries.append({
                "country": display,
                "flag": country_to_flag(display),
                "totalAthletes": total_athletes,
                "pioneer": first_row[0],
                "pioneerYear": first_row[1],
                "pioneerTime": first_row[2],
                "pioneerPos": first_row[3],
                "pioneerAthleteId": first_row[4],
            })
    unusual_countries = unusual_countries[:20]

    # ------------------------------------------------------------------
    # 11. Race growth over time
    # ------------------------------------------------------------------
    growth_rows = conn.execute("""
        SELECT year,
               COUNT(*) as finishers,
               COUNT(DISTINCT UPPER(athlete_id)) as athletes
        FROM results
        WHERE medal NOT IN ('DNF','DNS','Not started','DQ')
        AND time IS NOT NULL AND time != '' AND time LIKE '%:%'
        AND year <= 2025
        GROUP BY year
        ORDER BY year
    """).fetchall()

    race_growth = [{"year": y, "finishers": f, "athletes": a} for y, f, a in growth_rows]

    # ------------------------------------------------------------------
    # 12. Repeat winners (most wins overall)
    # ------------------------------------------------------------------
    repeat_winners = sorted(
        [w for w in remarkable_winners],
        key=lambda x: (-x["wins"], x["years"][0])
    )[:15]

    # ------------------------------------------------------------------
    # 13. Women pioneers — milestone timeline
    # ------------------------------------------------------------------
    women_all_rows = conn.execute("""
        SELECT year, name, UPPER(athlete_id), pos, time, medal, gender_pos, country
        FROM results
        WHERE year <= 2025
        AND medal NOT IN ('DNF','DNS','Not started','DQ')
        AND time IS NOT NULL AND time != '' AND time LIKE '%:%'
        AND athlete_id IS NOT NULL AND athlete_id != ''
        ORDER BY year, CAST(pos AS INTEGER)
    """).fetchall()

    women_by_year: dict[int, list[dict]] = defaultdict(list)
    for y, n, uid, p, t, m, gp, co in women_all_rows:
        if gender_map.get(uid) == "F":
            women_by_year[y].append({
                "name": n, "athleteId": uid, "pos": p, "time": t,
                "medal": m, "genderPos": gp, "country": athlete_primary_country.get(uid, clean_country_name(co or "")),
            })

    women_milestones = []

    # First woman ever
    for year in sorted(women_by_year.keys()):
        w = women_by_year[year][0]
        women_milestones.append({
            "year": year, "type": "first",
            "title": "First woman to finish Comrades",
            "description": f"Finished in a field of men, 42 years before the next woman",
            "name": w["name"], "athleteId": w["athleteId"],
            "time": w["time"], "pos": w["pos"],
        })
        break

    # Mavis Hutchison's return (get her full history)
    mavis_uid = "126C8C8A-D0F2-4766-AE12-4302D7B831FE"
    mavis_years = sorted(y for y in women_by_year
                         if any(w["athleteId"] == mavis_uid for w in women_by_year[y]))
    if mavis_years:
        women_milestones.append({
            "year": mavis_years[0], "type": "return",
            "title": "The 42-year gap ends",
            "description": f"Ran {len(mavis_years)} times ({mavis_years[0]}–{mavis_years[-1]})",
            "name": "Mavis HUTCHISON", "athleteId": mavis_uid,
            "time": women_by_year[mavis_years[0]][0]["time"] if women_by_year[mavis_years[0]] else "",
            "pos": women_by_year[mavis_years[0]][0]["pos"] if women_by_year[mavis_years[0]] else "",
        })

    # Betty Cavanagh — first women's race winner 1975
    betty_uid = "3D70896F-A8FB-4099-9505-1B44355FFAF1"
    betty_years = sorted(y for y in women_by_year
                         if any(w["athleteId"] == betty_uid for w in women_by_year[y]))
    if betty_years:
        women_milestones.append({
            "year": betty_years[0], "type": "pioneer",
            "title": "Betty Cavanagh joins the fight",
            "description": f"Ran {len(betty_years)} times ({betty_years[0]}–{betty_years[-1]}), first women's race winner in 1975",
            "name": "Betty CAVANAGH", "athleteId": betty_uid,
            "time": women_by_year[betty_years[0]][0]["time"] if women_by_year[betty_years[0]] else "",
            "pos": women_by_year[betty_years[0]][0]["pos"] if women_by_year[betty_years[0]] else "",
        })

    # First year with multiple women
    for year in sorted(women_by_year.keys()):
        if len(women_by_year[year]) >= 2:
            women_milestones.append({
                "year": year, "type": "growth",
                "title": f"First year with multiple women",
                "description": f"{len(women_by_year[year])} women finished — no longer alone",
                "name": "", "athleteId": "", "time": "", "pos": "",
            })
            break

    # Isavel Roche-Kelly — first sub-7h, medal named after her
    isavel_uid = "5A22BAE8-7DA5-42C4-B8FD-8B4B79AAF419"
    isavel_years = sorted(y for y in women_by_year
                          if any(w["athleteId"] == isavel_uid for w in women_by_year[y]))
    if isavel_years:
        isavel_entry = next(w for w in women_by_year[isavel_years[0]] if w["athleteId"] == isavel_uid)
        women_milestones.append({
            "year": isavel_years[0], "type": "record",
            "title": "Isavel Roche-Kelly — a medal named in her honour",
            "description": f"Won women's race in {isavel_years[0]} & {isavel_years[1] if len(isavel_years) > 1 else ''}, first woman sub-7 hours. The Isavel Roche-Kelly medal is named after her",
            "name": "Isavel ROCHE-KELLY", "athleteId": isavel_uid,
            "time": isavel_entry["time"], "pos": isavel_entry["pos"],
        })

    # First women's Gold
    for year in sorted(women_by_year.keys()):
        golds = [w for w in women_by_year[year] if w["medal"] == "Gold"]
        if golds:
            women_milestones.append({
                "year": year, "type": "gold",
                "title": "First women's Gold medal",
                "description": "",
                "name": golds[0]["name"], "athleteId": golds[0]["athleteId"],
                "time": golds[0]["time"], "pos": golds[0]["pos"],
            })
            break

    # Frith van der Merwe — first sub-6h
    for year in sorted(women_by_year.keys()):
        for w in women_by_year[year]:
            parts = w["time"].split(":")
            if len(parts) == 3 and int(parts[0]) < 6:
                women_milestones.append({
                    "year": year, "type": "record",
                    "title": "First woman under 6 hours",
                    "description": "",
                    "name": w["name"], "athleteId": w["athleteId"],
                    "time": w["time"], "pos": w["pos"],
                })
                break
        else:
            continue
        break

    # 100+ women
    for year in sorted(women_by_year.keys()):
        if len(women_by_year[year]) >= 100:
            women_milestones.append({
                "year": year, "type": "growth",
                "title": "100+ women finishers in a single race",
                "description": f"{len(women_by_year[year])} women finished",
                "name": "", "athleteId": "", "time": "", "pos": "",
            })
            break

    # 1000+ women
    for year in sorted(women_by_year.keys()):
        if len(women_by_year[year]) >= 1000:
            women_milestones.append({
                "year": year, "type": "growth",
                "title": "1,000+ women finishers",
                "description": f"{len(women_by_year[year]):,} women finished",
                "name": "", "athleteId": "", "time": "", "pos": "",
            })
            break

    # First international women's winner
    for year in sorted(women_by_year.keys()):
        winners = [w for w in women_by_year[year] if w.get("genderPos") == "1"]
        for w in winners:
            if w["country"] and w["country"] != "South Africa":
                women_milestones.append({
                    "year": year, "type": "international",
                    "title": f"First international women's champion",
                    "description": f"From {w['country']}",
                    "name": w["name"], "athleteId": w["athleteId"],
                    "time": w["time"], "pos": w["pos"],
                })
                break
        else:
            continue
        break

    # Gerda Steyn — current record holder
    gerda_rows = [(y, w) for y in sorted(women_by_year.keys())
                  for w in women_by_year[y] if "STEYN" in w["name"] and "GERDA" in w["name"].upper()]
    if gerda_rows:
        fastest = min(gerda_rows, key=lambda x: x[1]["time"])
        women_milestones.append({
            "year": fastest[0], "type": "record",
            "title": "Women's course record",
            "description": f"Won {sum(1 for y, w in gerda_rows if w.get('genderPos') == '1')} times",
            "name": fastest[1]["name"], "athleteId": fastest[1]["athleteId"],
            "time": fastest[1]["time"], "pos": fastest[1]["pos"],
        })

    # Sort by year
    women_milestones.sort(key=lambda x: x["year"])

    # Also compute yearly women's participation for a growth summary
    women_growth = []
    for year in sorted(women_by_year.keys()):
        women_growth.append({
            "year": year,
            "count": len(women_by_year[year]),
        })

    women_firsts = {
        "milestones": women_milestones,
        "growth": women_growth,
    }

    # ------------------------------------------------------------------
    # 13. Never Gave Up: most DNFs before first-ever finish
    # ------------------------------------------------------------------
    dnf_rows = conn.execute("""
        SELECT UPPER(athlete_id), year
        FROM results
        WHERE time = 'DNF'
        AND athlete_id IS NOT NULL AND athlete_id != ''
        AND year <= 2025
    """).fetchall()

    finish_detail_rows = conn.execute("""
        SELECT UPPER(athlete_id), year, name, time, pos, medal
        FROM results
        WHERE medal NOT IN ('DNF','DNS','Not started','DQ')
        AND time IS NOT NULL AND time != '' AND time LIKE '%:%'
        AND athlete_id IS NOT NULL AND athlete_id != ''
        AND year <= 2025
        ORDER BY year
    """).fetchall()

    # Build first finish per athlete
    first_finish_map: dict[str, tuple] = {}  # uid -> (year, name, time, pos, medal)
    total_finish_count: dict[str, int] = defaultdict(int)
    for uid, year, name, time_str, pos, medal in finish_detail_rows:
        total_finish_count[uid] += 1
        if uid not in first_finish_map:
            first_finish_map[uid] = (year, name, time_str, pos, medal)

    # Count DNFs before first finish
    dnf_years_before: dict[str, list[int]] = defaultdict(list)
    for uid, year in dnf_rows:
        if uid in first_finish_map and year < first_finish_map[uid][0]:
            dnf_years_before[uid].append(year)

    never_gave_up = []
    for uid, dnf_yrs in dnf_years_before.items():
        if len(dnf_yrs) < 3:
            continue
        year, name, time_str, pos, medal = first_finish_map[uid]
        never_gave_up.append({
            "name": name,
            "athleteId": uid,
            "gender": gender_map.get(uid, "M"),
            "dnfCount": len(dnf_yrs),
            "dnfYears": sorted(dnf_yrs),
            "finishYear": year,
            "finishTime": time_str,
            "finishPos": int(pos) if pos and pos.isdigit() else 0,
            "finishMedal": medal or "",
            "totalFinishes": total_finish_count[uid],
        })

    never_gave_up.sort(key=lambda x: (-x["dnfCount"], x["finishYear"]))
    never_gave_up = never_gave_up[:20]
    logger.info(f"  Never gave up: {len(never_gave_up)} athletes with 3+ DNFs before first finish")

    # ------------------------------------------------------------------
    # Heroic second places & Women faster than historical men
    # ------------------------------------------------------------------

    # Build direction map from race_info
    dir_rows = conn.execute("""
        SELECT year, direction FROM race_info
        WHERE year <= 2025 AND direction IS NOT NULL AND direction != ''
    """).fetchall()
    direction_map: dict[int, str] = {int(r[0]): r[1].strip().title() for r in dir_rows if r[1]}

    # Get top-2 men per year (pos 1 & 2) and top-2 women (gender_pos 1 & 2)
    top2_men_rows = conn.execute("""
        SELECT UPPER(athlete_id), name, year, time, CAST(pos AS INTEGER) as p
        FROM results
        WHERE CAST(pos AS INTEGER) IN (1, 2)
        AND medal NOT IN ('DNF','DNS','Not started','DQ')
        AND time IS NOT NULL AND time != '' AND time LIKE '%:%'
        AND year <= 2025
        ORDER BY year, p
    """).fetchall()

    top2_women_rows = conn.execute("""
        SELECT UPPER(athlete_id), name, year, time, CAST(gender_pos AS INTEGER) as gp
        FROM results
        WHERE CAST(gender_pos AS INTEGER) IN (1, 2)
        AND gender_pos IS NOT NULL AND gender_pos != ''
        AND medal NOT IN ('DNF','DNS','Not started','DQ')
        AND time IS NOT NULL AND time != '' AND time LIKE '%:%'
        AND year <= 2025
        ORDER BY year, gp
    """).fetchall()

    # Group men by year {year: [(uid, name, time, pos), ...]}
    men_by_year: dict[int, list[tuple]] = defaultdict(list)
    for uid, name, yr, t, p in top2_men_rows:
        if p in (1, 2) and len(men_by_year[yr]) < 2:
            men_by_year[yr].append((uid, name, t, p))

    # Group women by year
    women_by_year: dict[int, list[tuple]] = defaultdict(list)
    for uid, name, yr, t, gp in top2_women_rows:
        if gender_map.get(uid) == "F" and gp in (1, 2) and len(women_by_year[yr]) < 2:
            women_by_year[yr].append((uid, name, t, gp))

    # Build men's winners lookup (year -> (name, secs, time_str))
    men_win_lookup: dict[int, tuple[str, int, str]] = {}
    for yr, runners in men_by_year.items():
        if runners:
            w_name, w_time, _ = runners[0][1], runners[0][2], runners[0][3]
            w_secs = time_to_seconds(w_time)
            if w_secs and w_secs >= 16000:
                men_win_lookup[yr] = (w_name, w_secs, w_time)

    # Track records across years chronologically
    m_overall = RecordTracker()
    m_up = RecordTracker()
    m_down = RecordTracker()
    w_overall = RecordTracker()
    w_up = RecordTracker()
    w_down = RecordTracker()

    heroic_seconds: list[dict] = []
    women_vs_historical_men: list[dict] = []

    for yr in sorted(set(list(men_by_year.keys()) + list(women_by_year.keys()))):
        this_dir = direction_map.get(yr, "")
        men = men_by_year.get(yr, [])
        women = women_by_year.get(yr, [])

        # --- Men's records ---
        if men:
            w_uid, w_name, w_time, w_pos = men[0]
            w_secs = time_to_seconds(w_time)
            if w_secs and w_secs >= 16000:
                men_prev: dict | None = None
                rec_types: list[str] = []

                prev = m_overall.check(w_secs, w_name, yr)
                if prev is not False:
                    rec_types.append("overall")
                    if prev:
                        men_prev = {**prev, "type": "overall"}

                if this_dir == "Up":
                    prev_u = m_up.check(w_secs, w_name, yr)
                    if prev_u is not False and "overall" not in rec_types:
                        rec_types.append("up")
                        if prev_u and not men_prev:
                            men_prev = {**prev_u, "type": "up"}
                    elif prev_u is not False:
                        pass
                elif this_dir == "Down":
                    prev_d = m_down.check(w_secs, w_name, yr)
                    if prev_d is not False and "overall" not in rec_types:
                        rec_types.append("down")
                        if prev_d and not men_prev:
                            men_prev = {**prev_d, "type": "down"}
                    elif prev_d is not False:
                        pass

                # Check heroic second
                if len(men) >= 2 and men_prev and rec_types:
                    s2_uid, s2_name, s2_time, s2_pos = men[1]
                    s2_secs = time_to_seconds(s2_time)
                    prev_secs = time_to_seconds(men_prev["time"])
                    if s2_secs and prev_secs and s2_secs < prev_secs:
                        heroic_seconds.append({
                            "year": yr,
                            "direction": this_dir,
                            "gender": "M",
                            "winner": w_name,
                            "winnerTime": w_time,
                            "winnerAthleteId": w_uid,
                            "runnerUp": s2_name,
                            "runnerUpTime": s2_time,
                            "runnerUpAthleteId": s2_uid,
                            "previousRecord": men_prev["time"],
                            "previousHolder": men_prev["holder"],
                            "previousYear": men_prev["year"],
                            "recordType": rec_types[0],
                            "marginSeconds": s2_secs - w_secs,
                        })

        # --- Women's records ---
        if women:
            fw_uid, fw_name, fw_time, fw_pos = women[0]
            fw_secs = time_to_seconds(fw_time)
            if fw_secs and fw_secs >= 18000:
                women_prev: dict | None = None
                wrec_types: list[str] = []

                prev = w_overall.check(fw_secs, fw_name, yr)
                if prev is not False:
                    wrec_types.append("overall")
                    if prev:
                        women_prev = {**prev, "type": "overall"}

                if this_dir == "Up":
                    prev_u = w_up.check(fw_secs, fw_name, yr)
                    if prev_u is not False and "overall" not in wrec_types:
                        wrec_types.append("up")
                        if prev_u and not women_prev:
                            women_prev = {**prev_u, "type": "up"}
                    elif prev_u is not False:
                        pass
                elif this_dir == "Down":
                    prev_d = w_down.check(fw_secs, fw_name, yr)
                    if prev_d is not False and "overall" not in wrec_types:
                        wrec_types.append("down")
                        if prev_d and not women_prev:
                            women_prev = {**prev_d, "type": "down"}
                    elif prev_d is not False:
                        pass

                # Check heroic second (women)
                if len(women) >= 2 and women_prev and wrec_types:
                    s2w_uid, s2w_name, s2w_time, s2w_pos = women[1]
                    s2w_secs = time_to_seconds(s2w_time)
                    prev_w_secs = time_to_seconds(women_prev["time"])
                    if s2w_secs and prev_w_secs and s2w_secs < prev_w_secs:
                        heroic_seconds.append({
                            "year": yr,
                            "direction": this_dir,
                            "gender": "F",
                            "winner": fw_name,
                            "winnerTime": fw_time,
                            "winnerAthleteId": fw_uid,
                            "runnerUp": s2w_name,
                            "runnerUpTime": s2w_time,
                            "runnerUpAthleteId": s2w_uid,
                            "previousRecord": women_prev["time"],
                            "previousHolder": women_prev["holder"],
                            "previousYear": women_prev["year"],
                            "recordType": wrec_types[0],
                            "marginSeconds": s2w_secs - fw_secs,
                        })

                # Women vs historical men: find most recent men's year where women's time < men's time
                for check_yr in sorted(men_win_lookup.keys(), reverse=True):
                    if check_yr < yr:
                        m_name, m_secs_val, m_time = men_win_lookup[check_yr]
                        if m_secs_val > fw_secs:
                            women_vs_historical_men.append({
                                "year": yr,
                                "direction": this_dir,
                                "womenWinner": fw_name,
                                "womenTime": fw_time,
                                "womenAthleteId": fw_uid,
                                "beatenMenYear": check_yr,
                                "beatenMenWinner": m_name,
                                "beatenMenTime": m_time,
                            })
                            break

    heroic_seconds.sort(key=lambda x: x["year"])
    women_vs_historical_men.sort(key=lambda x: x["year"])
    logger.info(f"  Heroic second places: {len(heroic_seconds)}")
    logger.info(f"  Women faster than historical men: {len(women_vs_historical_men)}")

    # ------------------------------------------------------------------
    # Uncanny Doubles: same athlete, identical or near-identical times
    # ------------------------------------------------------------------
    all_finishes = conn.execute("""
        SELECT UPPER(athlete_id), name, year, time, pos
        FROM results
        WHERE medal NOT IN ('DNF','DNS','Not started','DQ')
        AND time IS NOT NULL AND time != '' AND time LIKE '%:%:%'
        AND athlete_id IS NOT NULL AND athlete_id != ''
        AND year <= 2025
        ORDER BY UPPER(athlete_id), year
    """).fetchall()

    athlete_finishes: dict[str, list[tuple]] = defaultdict(list)
    for uid, name, yr, t, pos in all_finishes:
        athlete_finishes[uid].append((yr, t, name, pos))

    uncanny_doubles: list[dict] = []
    for uid, entries in athlete_finishes.items():
        if len(entries) < 2:
            continue
        for i in range(len(entries)):
            for j in range(i + 1, len(entries)):
                y1, t1, name, p1 = entries[i]
                y2, t2, _, p2 = entries[j]
                s1 = time_to_seconds(t1)
                s2 = time_to_seconds(t2)
                if s1 is None or s2 is None:
                    continue
                diff = abs(s1 - s2)
                # Skip rounded-minute times (likely imprecise 1970s timing)
                if s1 % 60 == 0 and s2 % 60 == 0:
                    continue
                if diff > 5:
                    continue
                # Only sub-8h (competitive times)
                if s1 >= 8 * 3600:
                    continue
                d1 = direction_map.get(y1, "")
                d2 = direction_map.get(y2, "")
                uncanny_doubles.append({
                    "name": name,
                    "athleteId": uid,
                    "year1": y1,
                    "time1": t1,
                    "pos1": int(p1) if p1 and str(p1).isdigit() else 0,
                    "dir1": d1,
                    "year2": y2,
                    "time2": t2,
                    "pos2": int(p2) if p2 and str(p2).isdigit() else 0,
                    "dir2": d2,
                    "diffSeconds": diff,
                    "sameDirection": d1 == d2 if d1 and d2 else None,
                    "yearGap": y2 - y1,
                })

    # Sort: exact matches first, then by time (fastest first)
    uncanny_doubles.sort(key=lambda x: (x["diffSeconds"], time_to_seconds(x["time1"]) or 99999))
    logger.info(f"  Uncanny doubles: {len(uncanny_doubles)} pairs (≤5s, sub-8h, non-rounded)")

    # ------------------------------------------------------------------
    # Country Dominance: winning streaks, podium sweeps, eras
    # ------------------------------------------------------------------
    # Build direction map for this section
    dir_rows = conn.execute(
        "SELECT year, direction FROM race_info WHERE direction IS NOT NULL AND direction != ''"
    ).fetchall()
    dominance_dir_map: dict[int, str] = {int(r[0]): r[1] for r in dir_rows}

    # Get men's and women's winners per year with countries
    men_winners_rows = conn.execute("""
        SELECT year, UPPER(athlete_id) as uid, name, time, country
        FROM results
        WHERE CAST(pos AS INTEGER) = 1
        AND medal NOT IN ('DNF','DNS','Not started','DQ')
        AND year <= 2025
        ORDER BY year
    """).fetchall()

    women_winners_rows = conn.execute("""
        SELECT year, UPPER(athlete_id) as uid, name, time, country
        FROM results
        WHERE CAST(gender_pos AS INTEGER) = 1
        AND year <= 2025
        AND athlete_id IS NOT NULL AND athlete_id != ''
        AND medal NOT IN ('DNF','DNS','Not started','DQ')
        ORDER BY year
    """).fetchall()
    # Filter to actual women using gender_map
    women_winners_rows = [r for r in women_winners_rows if gender_map.get(r[1]) == 'F']

    def build_winner_list(rows):
        """Build list of (year, country, name, time, athleteId) with cleaned countries."""
        result = []
        for yr, uid, name, time_str, raw_country in rows:
            c = ""
            if uid in ATHLETE_COUNTRY_CORRECTIONS:
                c = clean_country_name(ATHLETE_COUNTRY_CORRECTIONS[uid])
            elif uid in athlete_primary_country:
                c = athlete_primary_country[uid]
            elif raw_country:
                c = clean_country_name(raw_country)
            if not c:
                c = "South Africa"  # pre-1990s blanks are almost certainly SA
            result.append((int(yr), c, name, time_str or "", uid))
        return result

    men_winners = build_winner_list(men_winners_rows)
    women_winners = build_winner_list(women_winners_rows)

    def find_streaks(winners):
        """Find consecutive winning streaks by country. Returns list of streak dicts."""
        if not winners:
            return []
        streaks_list = []
        i = 0
        while i < len(winners):
            country = winners[i][1]
            start_year = winners[i][0]
            streak_winners = [winners[i]]
            j = i + 1
            while j < len(winners) and winners[j][1] == country:
                streak_winners.append(winners[j])
                j += 1
            end_year = streak_winners[-1][0]
            length = len(streak_winners)
            if length >= 2:
                # Find unique athletes in streak
                athletes = []
                seen = set()
                for _, _, name, _, uid in streak_winners:
                    if uid not in seen:
                        athletes.append({"name": name, "athleteId": uid})
                        seen.add(uid)
                streaks_list.append({
                    "country": country,
                    "startYear": start_year,
                    "endYear": end_year,
                    "length": length,
                    "athletes": athletes,
                    "years": [w[0] for w in streak_winners],
                })
            i = j
        streaks_list.sort(key=lambda x: -x["length"])
        return streaks_list

    men_streaks = find_streaks(men_winners)
    women_streaks = find_streaks(women_winners)

    # Get top-3 per year for podium sweep detection
    men_top3_rows = conn.execute("""
        SELECT year, UPPER(athlete_id) as uid, CAST(pos AS INTEGER) as p, name, country
        FROM results
        WHERE CAST(pos AS INTEGER) BETWEEN 1 AND 3
        AND medal NOT IN ('DNF','DNS','Not started','DQ')
        AND year <= 2025
        ORDER BY year, p
    """).fetchall()

    women_top3_rows = conn.execute("""
        SELECT year, UPPER(athlete_id) as uid, CAST(gender_pos AS INTEGER) as gp, name, country
        FROM results
        WHERE CAST(gender_pos AS INTEGER) BETWEEN 1 AND 3
        AND year <= 2025
        AND athlete_id IS NOT NULL AND athlete_id != ''
        AND medal NOT IN ('DNF','DNS','Not started','DQ')
        ORDER BY year, gp
    """).fetchall()
    women_top3_rows = [r for r in women_top3_rows if gender_map.get(r[1]) == 'F']

    def find_podium_sweeps(top3_rows, is_women=False):
        """Find years where one country had all top 3."""
        by_year: dict[int, list] = defaultdict(list)
        for yr, uid, pos, name, raw_country in top3_rows:
            c = ""
            if uid in ATHLETE_COUNTRY_CORRECTIONS:
                c = clean_country_name(ATHLETE_COUNTRY_CORRECTIONS[uid])
            elif uid in athlete_primary_country:
                c = athlete_primary_country[uid]
            elif raw_country:
                c = clean_country_name(raw_country)
            if not c:
                c = "South Africa"
            by_year[int(yr)].append((pos, name, c, uid))

        sweeps = []
        for yr in sorted(by_year.keys()):
            entries = by_year[yr]
            if len(entries) >= 3:
                # Take top 3 by position
                entries.sort(key=lambda x: x[0])
                top3 = entries[:3]
                countries = [e[2] for e in top3]
                if len(set(countries)) == 1:
                    sweeps.append({
                        "year": yr,
                        "country": countries[0],
                        "athletes": [{"name": e[1], "athleteId": e[3], "pos": e[0]} for e in top3],
                    })
        return sweeps

    men_sweeps = find_podium_sweeps(men_top3_rows)
    women_sweeps = find_podium_sweeps(women_top3_rows, is_women=True)

    # Winner timeline for visualization: year -> {men: country, women: country}
    winner_timeline = []
    men_by_year = {w[0]: (w[1], w[2], w[4]) for w in men_winners}  # year -> (country, name, uid)
    women_by_year = {w[0]: (w[1], w[2], w[4]) for w in women_winners}
    for yr in sorted(set(list(men_by_year.keys()) + list(women_by_year.keys()))):
        entry: dict = {"year": yr}
        if yr in men_by_year:
            mc, mn, mu = men_by_year[yr]
            entry["menCountry"] = mc
            entry["menWinner"] = mn
            entry["menAthleteId"] = mu
        if yr in women_by_year:
            wc, wn, wu = women_by_year[yr]
            entry["womenCountry"] = wc
            entry["womenWinner"] = wn
            entry["womenAthleteId"] = wu
        winner_timeline.append(entry)

    # Foreign breakthroughs
    first_foreign_men = None
    for yr, c, name, t, uid in men_winners:
        if c != "South Africa":
            first_foreign_men = {"year": yr, "country": c, "name": name, "time": t, "athleteId": uid}
            break
    first_foreign_women = None
    for yr, c, name, t, uid in women_winners:
        if c != "South Africa":
            first_foreign_women = {"year": yr, "country": c, "name": name, "time": t, "athleteId": uid}
            break

    # Wins by country summary
    men_wins_by_country: dict[str, int] = defaultdict(int)
    for _, c, _, _, _ in men_winners:
        men_wins_by_country[c] += 1
    women_wins_by_country: dict[str, int] = defaultdict(int)
    for _, c, _, _, _ in women_winners:
        women_wins_by_country[c] += 1

    country_dominance = {
        "menStreaks": men_streaks[:20],
        "womenStreaks": women_streaks[:20],
        "menSweeps": men_sweeps,
        "womenSweeps": women_sweeps,
        "winnerTimeline": winner_timeline,
        "firstForeignMen": first_foreign_men,
        "firstForeignWomen": first_foreign_women,
        "menWinsByCountry": sorted(
            [{"country": c, "wins": n} for c, n in men_wins_by_country.items()],
            key=lambda x: -x["wins"]
        ),
        "womenWinsByCountry": sorted(
            [{"country": c, "wins": n} for c, n in women_wins_by_country.items()],
            key=lambda x: -x["wins"]
        ),
    }
    logger.info(f"  Country dominance: {len(men_streaks)} men's streaks, {len(women_streaks)} women's streaks, "
                f"{len(men_sweeps)} men's sweeps, {len(women_sweeps)} women's sweeps")

    # ------------------------------------------------------------------
    # Assemble records.json
    # ------------------------------------------------------------------
    records = {
        "wallyHayward": wally_hayward,
        "remarkableWinners": remarkable_winners[:15],
        "repeatWinners": repeat_winners,
        "longestCareers": longest_careers,
        "consecutiveFinishes": streaks,
        "narrowestMargins": narrowest_margins,
        "widestMargins": widest_margins,
        "comebacks": comebacks,
        "repeatPodiums": repeat_podiums,
        "mostImproved": most_improved,
        "wonAfterMany": won_after_many,
        "unusualCountries": unusual_countries,
        "raceGrowth": race_growth,
        "womenPioneers": women_firsts,
        "neverGaveUp": never_gave_up,
        "heroicSeconds": heroic_seconds,
        "womenVsHistoricalMen": women_vs_historical_men,
        "uncannyDoubles": uncanny_doubles,
        "countryDominance": country_dominance,
    }

    write_json(os.path.join(out_dir, "records.json"), records)
    logger.info(f"  records.json written ({len(remarkable_winners)} remarkable winners, "
                f"{len(streaks)} streaks, {len(comebacks)} comebacks)")


# ---------------------------------------------------------------------------
# Club Detail Pages
# ---------------------------------------------------------------------------

# Club name normalization: map raw club strings to canonical names
# This handles corporate clubs with many regional branches, merged clubs, etc.
CLUB_GROUPS: dict[str, list[str]] = {
    # Corporate / sponsored clubs with regional branches
    "Nedbank Running Club": ["NEDBANK"],
    "Team Vitality": ["TEAM VITALITY", "TEAM VITALITY -", "TEAM VITALITY CLUB", "TEAM VITALITY ATLETIC"],
}

def _normalize_club_name(raw: str) -> str:
    """Normalize a club name, grouping known variants."""
    upper = raw.upper().strip()
    for canonical, prefixes in CLUB_GROUPS.items():
        for prefix in prefixes:
            if upper.startswith(prefix):
                return canonical
    # Otherwise, title-case the raw name for display
    # but keep common abbreviations uppercase
    result = raw.strip()
    if result.isupper():
        # Title case it but keep "AC", "RC" etc
        words = result.split()
        titled = []
        keep_upper = {"AC", "RC", "AAC", "AA", "CC", "AFC", "ABC"}
        for w in words:
            if w in keep_upper or (len(w) <= 3 and w.isalpha() and w.isupper()):
                titled.append(w)
            elif w.startswith("(") or w.startswith("-"):
                titled.append(w)
            else:
                titled.append(w.title())
        result = " ".join(titled)
    return result


def _slugify_club(name: str) -> str:
    """Generate a URL-safe slug from a club name."""
    import re
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug


def export_club_details(conn: sqlite3.Connection, out_dir: str, gender_map: dict[str, str]):
    """Export per-club detail JSON files to club/{slug}.json and club-list.json."""
    logger.info("Exporting club details...")

    club_dir = os.path.join(out_dir, "club")
    os.makedirs(club_dir, exist_ok=True)

    # Query all finisher rows with club info
    rows = conn.execute("""
        SELECT UPPER(athlete_id), name, COALESCE(club, ''), year, time, medal, pos, gender_pos
        FROM results
        WHERE club IS NOT NULL AND club != ''
        AND medal != '' AND medal IS NOT NULL
        AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
        AND time IS NOT NULL AND time != '' AND time LIKE '%:%'
        AND time NOT IN ('DNF', 'DNS', 'DQ', '00:00:00')
        AND pos IS NOT NULL AND pos != '' AND CAST(pos AS INTEGER) > 0
        AND year <= 2025
    """).fetchall()

    # Group by normalized club name
    club_data: dict[str, list] = defaultdict(list)
    for uid, name, club, year, time_str, medal, pos, gp in rows:
        normalized = _normalize_club_name(club)
        club_data[normalized].append({
            "uid": uid, "name": name, "year": year,
            "time": time_str, "medal": medal, "pos": pos, "gp": gp,
        })

    # Only export clubs with at least 50 finishes
    MIN_FINISHES = 50
    clubs_listing = []

    for display_name, entries in club_data.items():
        if len(entries) < MIN_FINISHES:
            continue
        if not display_name or display_name.lower() in ("unknown", "none", ""):
            continue

        slug = _slugify_club(display_name)
        total_finishers = len(entries)
        unique_athletes = len(set(e["uid"] for e in entries))
        years_present = sorted(set(e["year"] for e in entries))
        first_year = years_present[0]
        latest_year = years_present[-1]

        all_secs = [s for e in entries if (s := time_to_seconds(e["time"])) and s >= 18000]
        avg_seconds = round(mean(all_secs)) if all_secs else None
        avg_time = seconds_to_time(avg_seconds) if avg_seconds else None

        # --- Year-by-year series ---
        year_groups: dict[int, list] = defaultdict(list)
        for e in entries:
            year_groups[e["year"]].append(e)

        yearly_series = []
        for yr in sorted(year_groups.keys()):
            yr_entries = year_groups[yr]
            yr_finishers = len(yr_entries)
            males = sum(1 for e in yr_entries if gender_map.get(e["uid"]) != "F")
            females = sum(1 for e in yr_entries if gender_map.get(e["uid"]) == "F")
            yr_secs = [s for e in yr_entries if (s := time_to_seconds(e["time"])) and s >= 18000]
            yr_avg = seconds_to_time(round(mean(yr_secs))) if yr_secs else None

            medals_yr: dict[str, int] = defaultdict(int)
            for e in yr_entries:
                medals_yr[e["medal"]] += 1

            yearly_series.append({
                "year": yr,
                "finishers": yr_finishers,
                "male": males,
                "female": females,
                "avgTime": yr_avg,
                "medals": dict(medals_yr),
            })

        # --- Medal summary ---
        medal_summary: dict[str, int] = defaultdict(int)
        for e in entries:
            medal_summary[e["medal"]] += 1

        # --- Top runners (by finish count) ---
        athlete_stats: dict[str, dict] = defaultdict(lambda: {
            "name": "", "finishes": 0, "bestTime": "99:99:99", "uid": "",
            "medals": defaultdict(int), "years": [],
        })
        for e in entries:
            a = athlete_stats[e["uid"]]
            a["name"] = e["name"]
            a["uid"] = e["uid"]
            a["finishes"] += 1
            a["medals"][e["medal"]] += 1
            a["years"].append(e["year"])
            if e["time"] < a["bestTime"]:
                a["bestTime"] = e["time"]

        top_runners = sorted(athlete_stats.values(), key=lambda x: (-x["finishes"], x["bestTime"]))[:20]
        top_runners_out = [{
            "name": r["name"],
            "finishes": r["finishes"],
            "bestTime": r["bestTime"],
            "athleteId": r["uid"],
            "bestMedal": best_medal(list(r["medals"].keys())),
            "golds": r["medals"].get("Gold", 0),
        } for r in top_runners]

        # --- Winners (pos=1 for men, gender_pos=1 for women) ---
        winners_men = []
        winners_women = []
        podiums_men = []
        podiums_women = []
        for e in entries:
            pos_int = int(e["pos"]) if e["pos"].isdigit() else 999
            gp_int = int(e["gp"]) if (e["gp"] and str(e["gp"]).isdigit()) else 999
            gender = gender_map.get(e["uid"], "M")
            if gender == "F":
                if gp_int == 1:
                    winners_women.append({"year": e["year"], "name": e["name"], "time": e["time"], "athleteId": e["uid"]})
                if gp_int <= 3:
                    podiums_women.append({"year": e["year"], "name": e["name"], "pos": gp_int, "time": e["time"], "athleteId": e["uid"]})
            else:
                if pos_int == 1:
                    winners_men.append({"year": e["year"], "name": e["name"], "time": e["time"], "athleteId": e["uid"]})
                if pos_int <= 3:
                    podiums_men.append({"year": e["year"], "name": e["name"], "pos": pos_int, "time": e["time"], "athleteId": e["uid"]})
        winners_men.sort(key=lambda x: x["year"])
        winners_women.sort(key=lambda x: x["year"])
        podiums_men.sort(key=lambda x: (x["year"], x["pos"]))
        podiums_women.sort(key=lambda x: (x["year"], x["pos"]))

        # --- Gold medals count ---
        total_golds = medal_summary.get("Gold", 0)

        club_detail = {
            "name": display_name,
            "slug": slug,
            "overview": {
                "totalFinishers": total_finishers,
                "uniqueAthletes": unique_athletes,
                "firstYear": first_year,
                "latestYear": latest_year,
                "avgTime": avg_time,
                "avgSeconds": avg_seconds,
                "yearsActive": len(years_present),
                "totalGolds": total_golds,
                "totalWins": len(winners_men) + len(winners_women),
            },
            "yearlySeries": yearly_series,
            "medalSummary": dict(medal_summary),
            "topRunners": top_runners_out,
            "winnersMen": winners_men,
            "winnersWomen": winners_women,
            "podiumsMen": podiums_men,
            "podiumsWomen": podiums_women,
        }

        write_json(os.path.join(club_dir, f"{slug}.json"), club_detail)

        clubs_listing.append({
            "name": display_name,
            "slug": slug,
            "totalFinishers": total_finishers,
            "uniqueAthletes": unique_athletes,
            "firstYear": first_year,
            "latestYear": latest_year,
            "avgTime": avg_time,
            "yearsActive": len(years_present),
            "totalGolds": total_golds,
            "totalWins": len(winners_men) + len(winners_women),
        })

    clubs_listing.sort(key=lambda x: -x["totalFinishers"])
    write_json(os.path.join(out_dir, "club-list.json"), clubs_listing)
    logger.info(f"  {len(clubs_listing)} club files + club-list.json written")


def export_club_year_athletes(conn: sqlite3.Connection, out_dir: str, gender_map: dict[str, str]):
    """Export per-club athlete lists keyed by year to club/{slug}-athletes.json.

    Only generates files for clubs that already have a detail page (i.e. a
    corresponding {slug}.json file in public/data/club/).
    """
    logger.info("Exporting club year-athlete files...")

    club_dir = os.path.join(out_dir, "club")

    # Discover which club slugs have detail pages
    existing_slugs: set[str] = set()
    if os.path.isdir(club_dir):
        for fname in os.listdir(club_dir):
            if fname.endswith(".json") and not fname.endswith("-athletes.json"):
                existing_slugs.add(fname[:-5])  # strip .json
    if not existing_slugs:
        logger.info("  No existing club detail files found, skipping")
        return

    # Query all finisher rows with club info (same query as export_club_details)
    rows = conn.execute("""
        SELECT UPPER(athlete_id), name, COALESCE(club, ''), year, time, medal, pos, gender_pos
        FROM results
        WHERE club IS NOT NULL AND club != ''
        AND medal != '' AND medal IS NOT NULL
        AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
        AND time IS NOT NULL AND time != '' AND time LIKE '%:%'
        AND time NOT IN ('DNF', 'DNS', 'DQ', '00:00:00')
        AND pos IS NOT NULL AND pos != '' AND CAST(pos AS INTEGER) > 0
        AND year <= 2025
    """).fetchall()

    # Group by normalized club name -> slug, then by year
    # slug -> year -> list of athlete entries
    club_year_athletes: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))

    for uid, name, club, year, time_str, medal, pos, gp in rows:
        normalized = _normalize_club_name(club)
        if not normalized:
            continue
        slug = _slugify_club(normalized)
        if not slug or slug not in existing_slugs:
            continue

        corrected_medal = MEDAL_CORRECTIONS.get((uid, year), medal or "")
        pos_int = int(pos) if pos and str(pos).isdigit() else None
        gp_int = int(gp) if gp and str(gp).isdigit() else None

        club_year_athletes[slug][str(year)].append({
            "name": name,
            "athleteId": uid,
            "time": time_str or "",
            "pos": pos_int,
            "genderPos": gp_int,
            "medal": corrected_medal,
            "gender": gender_map.get(uid, "M"),
        })

    # Sort athletes within each year by pos, then write files
    files_written = 0
    for slug, years_dict in club_year_athletes.items():
        for yr_key in years_dict:
            years_dict[yr_key].sort(key=lambda a: (a["pos"] if a["pos"] is not None else 999999))
        write_json(os.path.join(club_dir, f"{slug}-athletes.json"), dict(years_dict))
        files_written += 1

    logger.info(f"  {files_written} club-athletes files written")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def write_json(path: str, data, indent: int | None = None):
    """Write JSON to file, creating directories as needed."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":") if indent is None else None,
                  indent=indent)


def export_explorer_features(conn: sqlite3.Connection, out_dir: str,
                              gender_map: dict[str, str],
                              club_country_fixes: dict[str, str]):
    """Export explorer.json and clubs.json with advanced feature data."""
    logger.info("Exporting explorer features (explorer.json, clubs.json)...")

    valid_years = get_valid_race_years(conn)
    valid_years = [y for y in valid_years if y <= 2025]
    most_recent_year = max(valid_years) if valid_years else 2025

    # Fetch all results for reuse
    all_rows = conn.execute("""
        SELECT UPPER(athlete_id) as uid, name, year, time, medal, pos, gender_pos,
               country, club
        FROM results
        WHERE athlete_id IS NOT NULL AND athlete_id != '' AND year <= 2025
        ORDER BY year, uid
    """).fetchall()

    explorer = {}

    # ------------------------------------------------------------------
    # 1. lastSecondFinishers — per year (2003+), count finishers in
    #    final 60s, final 5min, final 15min of the 12-hour cutoff
    # ------------------------------------------------------------------
    logger.info("  Computing lastSecondFinishers...")
    cutoff_seconds = 12 * 3600  # 43200
    last_second_data = []
    year_finish_times: dict[int, list[int]] = defaultdict(list)

    for uid, name, year, time_str, medal_val, pos, gp, country, club in all_rows:
        if year < 2003:
            continue
        if not is_finish(medal_val, time_str, pos):
            continue
        secs = time_to_seconds(time_str)
        if secs is not None and 0 < secs <= cutoff_seconds:
            year_finish_times[year].append(secs)

    for year in sorted(year_finish_times.keys()):
        times = year_finish_times[year]
        total = len(times)
        # last 60s: 11:59:00 (42940) to 11:59:59 (43199)
        last_60s = sum(1 for t in times if 42940 <= t <= 43199)
        # last 5min: 11:55:00 (42900) to 11:59:59 (43199)
        last_5min = sum(1 for t in times if 42900 <= t <= 43199)
        # last 15min: 11:45:00 (42300) to 11:59:59 (43199)
        last_15min = sum(1 for t in times if 42300 <= t <= 43199)
        last_second_data.append({
            "year": year,
            "finishers": total,
            "last60s": last_60s,
            "last5min": last_5min,
            "last15min": last_15min,
        })

    explorer["lastSecondFinishers"] = last_second_data

    # ------------------------------------------------------------------
    # 2. familyPairs — same surname, same year, exact same time
    # ------------------------------------------------------------------
    logger.info("  Computing familyPairs...")

    def extract_surname(name: str) -> str:
        """Extract surname as everything after the first space."""
        parts = name.split(" ", 1)
        return parts[1].strip() if len(parts) > 1 else name.strip()

    # Group finishers by (year, surname, time)
    year_surname_time: dict[tuple[int, str, str], list[tuple]] = defaultdict(list)
    for uid, name, year, time_str, medal_val, pos, gp, country, club in all_rows:
        if not is_finish(medal_val, time_str, pos):
            continue
        if not time_str or ":" not in time_str:
            continue
        surname = extract_surname(name)
        if not surname:
            continue
        year_surname_time[(year, surname, time_str)].append(
            (uid, name, time_str, medal_val)
        )

    family_pairs = []
    for (year, surname, time_str), runners in year_surname_time.items():
        if len(runners) < 2:
            continue
        # Generate all pairs of DIFFERENT athletes
        seen_pairs = set()
        for i in range(len(runners)):
            for j in range(i + 1, len(runners)):
                uid_i, name_i, t_i, m_i = runners[i]
                uid_j, name_j, t_j, m_j = runners[j]
                if uid_i == uid_j:
                    continue
                pair_key = tuple(sorted([uid_i, uid_j]))
                if pair_key in seen_pairs:
                    continue
                seen_pairs.add(pair_key)
                family_pairs.append({
                    "year": year,
                    "surname": surname,
                    "runner1": {"name": name_i, "athleteId": uid_i, "time": t_i, "medal": m_i},
                    "runner2": {"name": name_j, "athleteId": uid_j, "time": t_j, "medal": m_j},
                })

    family_pairs.sort(key=lambda x: -x["year"])
    explorer["familyPairs"] = family_pairs[:200]

    # ------------------------------------------------------------------
    # 3. medalRainbow — athletes with the most different medal types
    # ------------------------------------------------------------------
    logger.info("  Computing medalRainbow...")
    athlete_medals: dict[str, dict] = {}  # uid -> {name, medals set, total, years set}
    for uid, name, year, time_str, medal_val, pos, gp, country, club in all_rows:
        if not is_finish(medal_val, time_str, pos):
            continue
        if uid not in athlete_medals:
            athlete_medals[uid] = {"name": name, "medals": set(), "total": 0, "years": set()}
        athlete_medals[uid]["total"] += 1
        athlete_medals[uid]["years"].add(year)
        if medal_val and medal_val in MEDAL_RANK:
            athlete_medals[uid]["medals"].add(medal_val)

    rainbow_list = []
    for uid, info in athlete_medals.items():
        if len(info["medals"]) >= 2:
            rainbow_list.append({
                "name": info["name"],
                "athleteId": uid,
                "medalTypes": len(info["medals"]),
                "medals": sorted(info["medals"], key=lambda m: MEDAL_RANK.get(m, 999)),
                "totalFinishes": info["total"],
                "years": len(info["years"]),
            })

    rainbow_list.sort(key=lambda x: (-x["medalTypes"], -x["totalFinishes"]))
    explorer["medalRainbow"] = rainbow_list[:50]

    # ------------------------------------------------------------------
    # 4. decadeChampions — most wins per decade (men: pos='1', women: gender_pos='1')
    # ------------------------------------------------------------------
    logger.info("  Computing decadeChampions...")
    men_wins: dict[str, dict[str, dict]] = defaultdict(lambda: defaultdict(lambda: {"name": "", "wins": 0, "years": []}))
    women_wins: dict[str, dict[str, dict]] = defaultdict(lambda: defaultdict(lambda: {"name": "", "wins": 0, "years": []}))

    for uid, name, year, time_str, medal_val, pos, gp, country, club in all_rows:
        if not is_finish(medal_val, time_str, pos):
            continue
        decade = f"{(year // 10) * 10}s"
        # Men's winner: pos='1'
        if pos and pos.strip() == "1":
            men_wins[decade][uid]["name"] = name
            men_wins[decade][uid]["wins"] += 1
            men_wins[decade][uid]["years"].append(year)
        # Women's winner: gender_pos='1' and classified female
        if gp and gp.strip() == "1" and gender_map.get(uid) == "F":
            women_wins[decade][uid]["name"] = name
            women_wins[decade][uid]["wins"] += 1
            women_wins[decade][uid]["years"].append(year)

    def decade_sort_key(d: str) -> int:
        return int(d.rstrip("s"))

    men_decade_champs = []
    for decade in sorted(men_wins.keys(), key=decade_sort_key):
        if not men_wins[decade]:
            continue
        top_uid = max(men_wins[decade], key=lambda u: men_wins[decade][u]["wins"])
        info = men_wins[decade][top_uid]
        men_decade_champs.append({
            "decade": decade,
            "name": info["name"],
            "athleteId": top_uid,
            "wins": info["wins"],
            "years": sorted(info["years"]),
        })

    women_decade_champs = []
    for decade in sorted(women_wins.keys(), key=decade_sort_key):
        if not women_wins[decade]:
            continue
        top_uid = max(women_wins[decade], key=lambda u: women_wins[decade][u]["wins"])
        info = women_wins[decade][top_uid]
        women_decade_champs.append({
            "decade": decade,
            "name": info["name"],
            "athleteId": top_uid,
            "wins": info["wins"],
            "years": sorted(info["years"]),
        })

    explorer["decadeChampions"] = {
        "men": men_decade_champs,
        "women": women_decade_champs,
    }

    # ------------------------------------------------------------------
    # 5. ironStreaks — top 50 consecutive finish streaks (expanded)
    # ------------------------------------------------------------------
    logger.info("  Computing ironStreaks...")
    athlete_finish_data: dict[str, dict] = {}  # uid -> {name, finishes: [(year, time, medal)]}
    for uid, name, year, time_str, medal_val, pos, gp, country, club in all_rows:
        if not is_finish(medal_val, time_str, pos):
            continue
        if uid not in athlete_finish_data:
            athlete_finish_data[uid] = {"name": name, "finishes": []}
        athlete_finish_data[uid]["finishes"].append((year, time_str, medal_val))

    race_years_set = set(valid_years)

    def find_all_streaks(finishes: list[tuple[int, str, str]]) -> list[tuple[int, int, int, list[tuple[int, str, str]]]]:
        """Find all consecutive finish streaks. Returns list of (length, start, end, finish_list)."""
        if not finishes:
            return []
        sorted_f = sorted(finishes, key=lambda x: x[0])
        streaks_found = []
        cur_start = 0
        for i in range(1, len(sorted_f)):
            prev_year = sorted_f[i - 1][0]
            this_year = sorted_f[i][0]
            gap_years = [y for y in valid_years if prev_year < y < this_year]
            if gap_years:
                # Break: record current streak
                streak_finishes = sorted_f[cur_start:i]
                streaks_found.append((len(streak_finishes), streak_finishes[0][0], streak_finishes[-1][0], streak_finishes))
                cur_start = i
        # Final streak
        streak_finishes = sorted_f[cur_start:]
        streaks_found.append((len(streak_finishes), streak_finishes[0][0], streak_finishes[-1][0], streak_finishes))
        return streaks_found

    all_streaks = []
    for uid, info in athlete_finish_data.items():
        streaks = find_all_streaks(info["finishes"])
        for length, start, end, finishes in streaks:
            if length < 5:
                continue
            times_secs = [time_to_seconds(t) for _, t, _ in finishes if time_to_seconds(t) is not None]
            medals_list = [m for _, _, m in finishes if m and m in MEDAL_RANK]
            is_active = end >= most_recent_year
            all_streaks.append({
                "name": info["name"],
                "athleteId": uid,
                "streak": length,
                "startYear": start,
                "endYear": end,
                "isActive": is_active,
                "bestTime": seconds_to_time(min(times_secs)) if times_secs else "",
                "bestMedal": best_medal(medals_list),
            })

    all_streaks.sort(key=lambda x: (-x["streak"], x["startYear"]))
    explorer["ironStreaks"] = all_streaks[:50]

    # ------------------------------------------------------------------
    # 6. clubStats — top 100 clubs by total finishes -> clubs.json
    # ------------------------------------------------------------------
    logger.info("  Computing clubStats...")
    club_data: dict[str, dict] = {}  # club_name -> {finishes, runners set, golds, years, runner_counts}
    for uid, name, year, time_str, medal_val, pos, gp, country, club in all_rows:
        if not club or not club.strip():
            continue
        if not is_finish(medal_val, time_str, pos):
            continue
        c = club.strip()
        if c not in club_data:
            club_data[c] = {
                "finishes": 0, "runners": set(), "golds": 0,
                "firstYear": year, "lastYear": year,
                "runner_counts": defaultdict(lambda: {"count": 0, "name": ""}),
            }
        cd = club_data[c]
        cd["finishes"] += 1
        cd["runners"].add(uid)
        if medal_val == "Gold":
            cd["golds"] += 1
        if year < cd["firstYear"]:
            cd["firstYear"] = year
        if year > cd["lastYear"]:
            cd["lastYear"] = year
        cd["runner_counts"][uid]["count"] += 1
        cd["runner_counts"][uid]["name"] = name

    club_stats = []
    for club_name, cd in club_data.items():
        # Find top runner
        top_uid = max(cd["runner_counts"], key=lambda u: cd["runner_counts"][u]["count"])
        top_info = cd["runner_counts"][top_uid]
        club_stats.append({
            "club": club_name,
            "totalFinishes": cd["finishes"],
            "uniqueRunners": len(cd["runners"]),
            "goldMedals": cd["golds"],
            "firstYear": cd["firstYear"],
            "lastYear": cd["lastYear"],
            "topRunner": {"name": top_info["name"], "athleteId": top_uid, "finishes": top_info["count"]},
        })

    club_stats.sort(key=lambda x: -x["totalFinishes"])
    club_stats = club_stats[:100]
    write_json(os.path.join(out_dir, "clubs.json"), club_stats)
    logger.info(f"  Wrote clubs.json with {len(club_stats)} clubs")

    # ------------------------------------------------------------------
    # 7. noviceStats — first-timer performance by decade
    # ------------------------------------------------------------------
    logger.info("  Computing noviceStats...")
    # Find each athlete's first year (attempt)
    athlete_first_year: dict[str, int] = {}
    athlete_first_result: dict[str, tuple] = {}  # uid -> (year, time, medal, pos)
    for uid, name, year, time_str, medal_val, pos, gp, country, club in all_rows:
        if uid not in athlete_first_year or year < athlete_first_year[uid]:
            athlete_first_year[uid] = year
            athlete_first_result[uid] = (year, time_str, medal_val, pos)

    # Group first-timers by decade
    novice_by_decade: dict[str, dict] = defaultdict(lambda: {
        "count": 0, "times": [], "dnf_count": 0, "medal_counts": defaultdict(int)
    })
    for uid, (year, time_str, medal_val, pos) in athlete_first_result.items():
        decade = f"{(year // 10) * 10}s"
        nd = novice_by_decade[decade]
        nd["count"] += 1
        finished = is_finish(medal_val, time_str, pos)
        if finished:
            secs = time_to_seconds(time_str)
            if secs is not None and secs > 0:
                nd["times"].append(secs)
            if medal_val and medal_val in MEDAL_RANK:
                nd["medal_counts"][medal_val] += 1
        else:
            nd["dnf_count"] += 1

    novice_stats = []
    for decade in sorted(novice_by_decade.keys(), key=lambda d: int(d.rstrip("s"))):
        nd = novice_by_decade[decade]
        times = nd["times"]
        total = nd["count"]
        novice_stats.append({
            "decade": decade,
            "count": total,
            "avgTime": round(mean(times)) if times else None,
            "medianTime": round(median(times)) if times else None,
            "dnfRate": round(nd["dnf_count"] / total * 100, 1) if total > 0 else 0,
            "medalBreakdown": dict(nd["medal_counts"]),
        })

    explorer["noviceStats"] = novice_stats

    # ------------------------------------------------------------------
    # 8. percentileData — all-time finish time percentiles
    # ------------------------------------------------------------------
    logger.info("  Computing percentileData...")
    all_finish_times = []
    for uid, name, year, time_str, medal_val, pos, gp, country, club in all_rows:
        if not is_finish(medal_val, time_str, pos):
            continue
        secs = time_to_seconds(time_str)
        if secs is not None and secs > 0:
            all_finish_times.append(secs)

    all_finish_times.sort()
    percentiles_wanted = [1, 5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95, 99]
    percentile_data = []
    n = len(all_finish_times)
    if n > 0:
        for p in percentiles_wanted:
            idx = int(p / 100 * n)
            if idx >= n:
                idx = n - 1
            percentile_data.append({
                "percentile": p,
                "time": seconds_to_time(all_finish_times[idx]),
            })

    explorer["percentileData"] = percentile_data

    # ------------------------------------------------------------------
    # 9. countryGrowthMap — unique countries and international runners per decade
    # ------------------------------------------------------------------
    logger.info("  Computing countryGrowthMap...")
    decade_country_data: dict[str, dict] = defaultdict(lambda: {
        "countries": set(), "intl_runners": set(), "country_runner_counts": defaultdict(set)
    })
    for uid, name, year, time_str, medal_val, pos, gp, country, club in all_rows:
        if not is_finish(medal_val, time_str, pos):
            continue
        if not country or not country.strip():
            continue
        display_country = clean_country_name(country.strip())
        decade = f"{(year // 10) * 10}s"
        dcd = decade_country_data[decade]
        dcd["countries"].add(display_country)
        dcd["country_runner_counts"][display_country].add(uid)
        if display_country not in ("South Africa",):
            dcd["intl_runners"].add(uid)

    country_growth = []
    for decade in sorted(decade_country_data.keys(), key=lambda d: int(d.rstrip("s"))):
        dcd = decade_country_data[decade]
        # Top countries by unique runner count
        top_countries = sorted(
            [{"country": c, "runners": len(uids)} for c, uids in dcd["country_runner_counts"].items()],
            key=lambda x: -x["runners"]
        )[:10]
        country_growth.append({
            "decade": decade,
            "countries": len(dcd["countries"]),
            "internationalRunners": len(dcd["intl_runners"]),
            "topCountries": top_countries,
        })

    explorer["countryGrowthMap"] = country_growth

    # ------------------------------------------------------------------
    # 10. determination — DNF careers, comebacks, and quitters
    # ------------------------------------------------------------------
    logger.info("  Computing determination stats...")

    # Build per-athlete history: aid -> [(year, status)], status in {finish, dnf, dns}
    history: dict[str, list[tuple[int, str]]] = defaultdict(list)
    athlete_name: dict[str, str] = {}
    for uid, name, year, time_str, medal_val, pos, gp, country, club in all_rows:
        if uid not in athlete_name:
            athlete_name[uid] = name
        if is_finish(medal_val, time_str, pos):
            status = "finish"
        elif time_str == "DNF":
            status = "dnf"
        else:
            status = "dns"
        history[uid].append((year, status))
    for uid in history:
        history[uid].sort(key=lambda x: x[0])

    # Q1 — DNF before back-to-back
    b2b_total = 0
    b2b_with_prior_dnf = 0
    dnfers_who_later_b2b = 0
    dnfers_total = 0
    for uid, h in history.items():
        has_dnf = any(s == "dnf" for _, s in h)
        if has_dnf:
            dnfers_total += 1
        finish_years = sorted({y for y, s in h if s == "finish"})
        first_b2b_year = None
        for i in range(len(finish_years) - 1):
            if finish_years[i + 1] == finish_years[i] + 1:
                first_b2b_year = finish_years[i]
                break
        if first_b2b_year is not None:
            b2b_total += 1
            if any(s == "dnf" and y < first_b2b_year for y, s in h):
                b2b_with_prior_dnf += 1
            if has_dnf:
                first_dnf = min(y for y, s in h if s == "dnf")
                later_finishes = sorted({y for y, s in h if s == "finish" and y > first_dnf})
                for i in range(len(later_finishes) - 1):
                    if later_finishes[i + 1] == later_finishes[i] + 1:
                        dnfers_who_later_b2b += 1
                        break

    # Q2 — first DNF outcome buckets
    q2_total = 0
    q2_never = 0
    q2_dns_only = 0
    q2_dnf_only = 0
    q2_eventually_finished = 0
    for uid, h in history.items():
        dnf_years = [y for y, s in h if s == "dnf"]
        if not dnf_years:
            continue
        q2_total += 1
        first_dnf = min(dnf_years)
        after = [(y, s) for y, s in h if y > first_dnf]
        if not after:
            q2_never += 1
            continue
        had_finish = any(s == "finish" for _, s in after)
        had_dnf = any(s == "dnf" for _, s in after)
        if had_finish:
            q2_eventually_finished += 1
        elif had_dnf:
            q2_dnf_only += 1
        else:
            q2_dns_only += 1

    # Q3 — persistence by DNF count
    persistence_buckets: list[dict] = []
    for min_dnfs in (1, 2, 3, 5, 7):
        cohort = 0
        persisted = 0
        for uid, h in history.items():
            dnf_count = sum(1 for _, s in h if s == "dnf")
            if dnf_count < min_dnfs:
                continue
            cohort += 1
            if any(s == "finish" for _, s in h):
                persisted += 1
        if cohort > 0:
            persistence_buckets.append({
                "minDnfs": min_dnfs,
                "cohort": cohort,
                "persisted": persisted,
                "gaveUp": cohort - persisted,
                "persistedPct": round(persisted / cohort * 1000) / 10,
            })

    # First-attempt-DNF outcome (full 4-way breakdown)
    fad_total = 0
    fad_gave_up = 0            # no future entry
    fad_returned_dns_only = 0  # entered but never started again
    fad_returned_no_finish = 0 # started again, never finished
    fad_finished = 0           # eventually finished
    for uid, h in history.items():
        if not h or h[0][1] != "dnf":
            continue
        fad_total += 1
        after = h[1:]
        if not after:
            fad_gave_up += 1
            continue
        had_finish = any(s == "finish" for _, s in after)
        had_start = any(s in ("dnf", "finish") for _, s in after)
        if had_finish:
            fad_finished += 1
        elif had_start:
            fad_returned_no_finish += 1
        else:
            fad_returned_dns_only += 1

    # Multi-DNF runners who never finished
    multi_dnf_no_finish = 0
    for uid, h in history.items():
        dnfs = sum(1 for _, s in h if s == "dnf")
        if dnfs >= 2 and not any(s == "finish" for _, s in h):
            multi_dnf_no_finish += 1

    # Longest consecutive year-over-year DNF streaks (both groups)
    longest_streaks: list[dict] = []
    for uid, h in history.items():
        # only DNF years up until (and excluding) any first finish
        dnf_years_pre_finish: list[int] = []
        for y, s in h:
            if s == "finish":
                break
            if s == "dnf":
                dnf_years_pre_finish.append(y)
        if not dnf_years_pre_finish:
            continue
        longest = cur = 1
        run_start = dnf_years_pre_finish[0]
        best_run_start = run_start
        best_run_end = run_start
        for i in range(1, len(dnf_years_pre_finish)):
            if dnf_years_pre_finish[i] == dnf_years_pre_finish[i - 1] + 1:
                cur += 1
                if cur > longest:
                    longest = cur
                    best_run_start = dnf_years_pre_finish[i] - cur + 1
                    best_run_end = dnf_years_pre_finish[i]
            else:
                cur = 1
        finally_finished = any(s == "finish" for _, s in h)
        total_dnfs = sum(1 for _, s in h if s == "dnf")
        longest_streaks.append({
            "name": athlete_name[uid],
            "athleteId": uid,
            "streak": longest,
            "streakStart": best_run_start,
            "streakEnd": best_run_end,
            "totalDnfs": total_dnfs,
            "finallyFinished": finally_finished,
        })
    longest_streaks.sort(key=lambda x: (-x["streak"], -x["totalDnfs"]))
    longest_streaks = longest_streaks[:30]

    # Top persisters: most DNFs before a first finish (and current never-finishers)
    top_persisters: list[dict] = []
    top_never_finishers: list[dict] = []
    for uid, h in history.items():
        dnfs_before_first_finish = 0
        first_finish_year = None
        for y, s in h:
            if s == "finish":
                first_finish_year = y
                break
            if s == "dnf":
                dnfs_before_first_finish += 1
        if first_finish_year is not None and dnfs_before_first_finish >= 3:
            dnf_years = [y for y, s in h if s == "dnf" and y < first_finish_year]
            top_persisters.append({
                "name": athlete_name[uid],
                "athleteId": uid,
                "dnfs": dnfs_before_first_finish,
                "firstFinishYear": first_finish_year,
                "dnfYears": dnf_years,
            })
        if first_finish_year is None:
            total_dnfs = sum(1 for _, s in h if s == "dnf")
            if total_dnfs >= 5:
                dnf_years = [y for y, s in h if s == "dnf"]
                top_never_finishers.append({
                    "name": athlete_name[uid],
                    "athleteId": uid,
                    "dnfs": total_dnfs,
                    "firstYear": dnf_years[0],
                    "lastYear": dnf_years[-1],
                    "dnfYears": dnf_years,
                })
    top_persisters.sort(key=lambda x: (-x["dnfs"], x["firstFinishYear"]))
    top_persisters = top_persisters[:25]
    top_never_finishers.sort(key=lambda x: (-x["dnfs"], -x["lastYear"]))
    top_never_finishers = top_never_finishers[:25]

    explorer["determination"] = {
        "totalDnfers": dnfers_total,
        "b2bTotal": b2b_total,
        "b2bWithPriorDnf": b2b_with_prior_dnf,
        "dnfersLaterB2b": dnfers_who_later_b2b,
        "firstDnfOutcomes": {
            "cohort": q2_total,
            "neverReturned": q2_never,
            "returnedDnsOnly": q2_dns_only,
            "returnedNeverFinished": q2_dnf_only,
            "eventuallyFinished": q2_eventually_finished,
        },
        "persistenceByDnfCount": persistence_buckets,
        "firstAttemptDnf": {
            "total": fad_total,
            "gaveUp": fad_gave_up,
            "returnedDnsOnly": fad_returned_dns_only,
            "returnedNeverFinished": fad_returned_no_finish,
            "eventuallyFinished": fad_finished,
        },
        "multiDnfNoFinish": multi_dnf_no_finish,
        "longestDnfStreaks": longest_streaks,
        "topPersisters": top_persisters,
        "topNeverFinishers": top_never_finishers,
    }

    # ------------------------------------------------------------------
    # Write explorer.json
    # ------------------------------------------------------------------
    write_json(os.path.join(out_dir, "explorer.json"), explorer)
    logger.info(f"  Wrote explorer.json")


def main():
    parser = argparse.ArgumentParser(description="Export Comrades data to JSON")
    parser.add_argument("--db", default="../comrades_results.db",
                        help="Path to SQLite database")
    parser.add_argument("--out", default="../comrades-explorer/public/data",
                        help="Output directory for JSON files")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(level=level, format="%(asctime)s %(levelname)-5s %(message)s",
                        datefmt="%Y-%m-%d %H:%M:%S")

    db_path = Path(args.db).resolve()
    out_dir = Path(args.out).resolve()
    logger.info(f"Database: {db_path}")
    logger.info(f"Output:   {out_dir}")

    os.makedirs(out_dir, exist_ok=True)

    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA journal_mode=WAL")

    try:
        gender_map = classify_genders(conn)
        club_country_fixes = build_club_country_corrections(conn)
        export_stats(conn, str(out_dir), gender_map)
        export_years(conn, str(out_dir), gender_map)
        export_leaderboards(conn, str(out_dir), gender_map, club_country_fixes)
        export_search_index(conn, str(out_dir), gender_map)
        export_runner_buckets(conn, str(out_dir), gender_map, club_country_fixes)
        export_insights(conn, str(out_dir), gender_map)
        export_year_details(conn, str(out_dir), gender_map, club_country_fixes)
        export_country_details(conn, str(out_dir), gender_map, club_country_fixes)
        export_records(conn, str(out_dir), gender_map)
        export_club_details(conn, str(out_dir), gender_map)
        export_club_year_athletes(conn, str(out_dir), gender_map)
        export_explorer_features(conn, str(out_dir), gender_map, club_country_fixes)

        # Print total size
        total_size = 0
        for root, dirs, files in os.walk(str(out_dir)):
            for f in files:
                total_size += os.path.getsize(os.path.join(root, f))
        logger.info(f"\nTotal data size: {total_size / 1024 / 1024:.1f} MB")

    finally:
        conn.close()

    logger.info("Done!")


if __name__ == "__main__":
    main()
