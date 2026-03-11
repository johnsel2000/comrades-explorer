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

logger = logging.getLogger("export_data")

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

# Statuses that count as a "finish"
NON_FINISH_KEYWORDS = {"dnf", "dns", "dq", "not started", "disqualified", "withdrawn"}


def is_finish(medal: str, time_str: str, pos: str) -> bool:
    """Determine if a result row represents a finish (not DNF/DNS)."""
    if medal and medal.lower() not in NON_FINISH_KEYWORDS:
        return True
    if time_str and ":" in time_str and time_str not in ("00:00:00", ""):
        return True
    if pos and pos.isdigit() and int(pos) > 0:
        return True
    return False


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

def export_stats(conn: sqlite3.Connection, out_dir: str):
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

    clubs = conn.execute(
        "SELECT COUNT(DISTINCT club) FROM results WHERE club != '' AND club IS NOT NULL"
    ).fetchone()[0]

    min_year = conn.execute("SELECT MIN(year) FROM results").fetchone()[0]
    max_year = conn.execute("SELECT MAX(year) FROM results").fetchone()[0]

    stats = {
        "totalResults": total_results,
        "totalFinishes": total_finishes,
        "uniqueAthletes": unique_athletes,
        "racesHeld": years_with_data,
        "countries": countries,
        "clubs": clubs,
        "yearRange": [min_year, max_year],
    }

    write_json(os.path.join(out_dir, "stats.json"), stats)
    logger.info(f"  stats.json: {json.dumps(stats, indent=2)[:200]}")


def export_years(conn: sqlite3.Connection, out_dir: str):
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

        # Get winner(s) - men (pos = 1 or smallest pos)
        winner_men = conn.execute("""
            SELECT name, time FROM results
            WHERE year = ? AND pos = '1' AND time != '' AND time IS NOT NULL
            AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
            ORDER BY time ASC LIMIT 1
        """, (year,)).fetchone()

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

        if winner_men:
            entry["winner"] = {"name": winner_men[0], "time": winner_men[1]}

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

    write_json(os.path.join(out_dir, "years.json"), years_data)
    logger.info(f"  years.json: {len(years_data)} years")


def export_leaderboards(conn: sqlite3.Connection, out_dir: str):
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
        LIMIT 200
    """).fetchall()

    for i, row in enumerate(rows):
        athlete_id, name, finishes, first_year, last_year, medals_str = row
        medal_list = [m.strip() for m in (medals_str or "").split(",") if m.strip()]
        most_finishes.append({
            "rank": i + 1,
            "athleteId": athlete_id,
            "name": name,
            "finishes": finishes,
            "firstYear": first_year,
            "lastYear": last_year,
            "bestMedal": best_medal(medal_list),
        })

    # Fastest winning times (all years, pos = 1)
    fastest_times = []
    rows = conn.execute("""
        SELECT r.year, r.name, r.time,
               COALESCE(ri.direction, '') as direction
        FROM results r
        LEFT JOIN race_info ri ON r.year = ri.year
        WHERE r.pos = '1' AND r.time != '' AND r.time IS NOT NULL
        AND r.time != '00:00:00'
        AND r.medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
        ORDER BY r.time ASC
    """).fetchall()

    seen_years = set()
    for row in rows:
        year, name, time_str, direction = row
        if year in seen_years:
            continue
        seen_years.add(year)
        fastest_times.append({
            "rank": len(fastest_times) + 1,
            "year": year,
            "name": name,
            "time": time_str,
            "direction": direction,
        })

    # Top clubs (top 200)
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
        LIMIT 200
    """).fetchall()

    for i, row in enumerate(rows):
        top_clubs.append({
            "rank": i + 1,
            "club": row[0],
            "totalFinishes": row[1],
            "uniqueRunners": row[2],
        })

    # Top countries
    top_countries = []
    rows = conn.execute("""
        SELECT country, COUNT(*) as total_finishes,
               COUNT(DISTINCT UPPER(athlete_id)) as unique_runners
        FROM results
        WHERE country != '' AND country IS NOT NULL
        AND medal != '' AND medal IS NOT NULL
        AND medal NOT IN ('DNF', 'DNS', 'Not started', 'DQ')
        GROUP BY country
        ORDER BY total_finishes DESC
    """).fetchall()

    for i, row in enumerate(rows):
        top_countries.append({
            "rank": i + 1,
            "country": row[0],
            "totalFinishes": row[1],
            "uniqueRunners": row[2],
        })

    data = {
        "mostFinishes": most_finishes,
        "fastestTimes": fastest_times,
        "topClubs": top_clubs,
        "topCountries": top_countries,
    }

    write_json(os.path.join(out_dir, "leaderboards.json"), data)
    logger.info(f"  leaderboards.json: {len(most_finishes)} runners, "
                f"{len(fastest_times)} times, {len(top_clubs)} clubs, "
                f"{len(top_countries)} countries")


def export_search_index(conn: sqlite3.Connection, out_dir: str):
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

    # Group by first letter of surname (last word of name)
    buckets = defaultdict(list)
    for row in rows:
        athlete_id, name, finishes, first_year, last_year, medals_str = row
        medal_list = [m.strip() for m in (medals_str or "").split(",") if m.strip()]
        best = best_medal(medal_list)

        # Determine bucket letter from surname (last part of name)
        parts = name.strip().split()
        surname = parts[-1] if parts else name
        letter = surname[0].lower() if surname and surname[0].isalpha() else "other"

        # Compact array format: [name, athleteId, finishes, firstYear, lastYear, bestMedalCode]
        buckets[letter].append([
            name, athlete_id, finishes, first_year, last_year, medal_to_code(best)
        ])

    total_entries = 0
    for letter, entries in sorted(buckets.items()):
        # Sort by name within each bucket
        entries.sort(key=lambda x: x[0].lower())
        filename = os.path.join(search_dir, f"{letter}.json")
        write_json(filename, entries)
        total_entries += len(entries)
        logger.info(f"  search/{letter}.json: {len(entries)} runners")

    logger.info(f"  Total search entries: {total_entries}")


def export_runner_buckets(conn: sqlite3.Connection, out_dir: str):
    """Export runner race histories grouped by UUID prefix."""
    logger.info("Exporting runner buckets...")

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
                "races": []
            }

        race = {
            "year": year,
            "time": time_str or "",
            "pos": pos or "",
            "medal": medal or "",
            "club": club or "",
            "country": country or "",
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
# Helpers
# ---------------------------------------------------------------------------
def write_json(path: str, data, indent: int | None = None):
    """Write JSON to file, creating directories as needed."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":") if indent is None else None,
                  indent=indent)


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
        export_stats(conn, str(out_dir))
        export_years(conn, str(out_dir))
        export_leaderboards(conn, str(out_dir))
        export_search_index(conn, str(out_dir))
        export_runner_buckets(conn, str(out_dir))

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
