"use client";

import Link from "next/link";

interface CorrectionSection {
  title: string;
  description: string;
  details: string[];
  impact: string;
}

const corrections: CorrectionSection[] = [
  {
    title: "Gender Classification",
    description:
      "The source data does not include a gender field. We infer gender using the ratio of each athlete's gender position to their overall position across all their races. Males have a gender position close to their overall position; females have a much lower gender position relative to overall (since women are a smaller fraction of the field). For top-10 finishers, exact matching is used. Athletes who only raced before 1975 (when women first participated) default to male.",
    details: [
      "Ratio-based classification for positions > 10 (gender_pos/pos ratio)",
      "Exact matching for top-10 finishers (gender_pos == pos means male)",
      "Pre-1975-only athletes default to male",
      "Majority vote across all years for each athlete",
    ],
    impact: "All athletes in the database",
  },
  {
    title: "Country Corrections",
    description:
      "Some athletes have incorrect country attributions in the source data. We apply manual corrections for known cases, and also infer corrections from club field data.",
    details: [
      "Alberto Salazar: Corrected from South Africa to United States (he is American, born in Cuba)",
    ],
    impact: "1 athlete manually corrected",
  },
  {
    title: "Club-to-Country Inference",
    description:
      "Many athletes (especially from the 1990s era) entered their country name in the \"club\" field instead of an actual club name. Since the database defaults unspecified countries to South Africa, these foreign athletes appear as South African. We identify these cases and correct the country field.",
    details: [
      "42 country-name patterns detected in club fields (e.g. \"ENGLAND\", \"U.S.A.\", \"GERMANY\")",
      "Only corrects athletes whose country is South Africa or blank (the default)",
      "Cross-checks against legitimate SA club names to avoid false corrections",
      "KENYA excluded due to many SA expats training there (unreliable signal)",
      "Three confidence tiers: confirmed (has matching country elsewhere), high (no SA clubs), skip (has SA clubs)",
    ],
    impact: "~227 athletes corrected to their true country",
  },
  {
    title: "Club Data Cleaning",
    description:
      "The club field contains various junk values: country names used instead of club names, placeholder text, and other non-club data. We clean these to prevent misleading club associations.",
    details: [
      "56 country-name patterns stripped from club field (e.g. \"USA\", \"RSA\", \"SOUTH AFRICA\")",
      "12 junk patterns removed (e.g. \"TEST\", \"NONE\", \"N/A\", \"-\")",
    ],
    impact: "All affected result rows have club field cleaned",
  },
  {
    title: "Medal Corrections",
    description:
      "A small number of records have medals that are clearly wrong. This includes medals assigned to non-finishers (DNF/DNS entries with Bronze or other medals) and medals on times that exceed the race cutoff.",
    details: [
      "Bianca Caldwell 2016: Recorded time of 14:14:53 with Bronze medal — over 2 hours past the 12-hour cutoff. Medal cleared.",
      "9 additional records where DNF, DNS, or \"Not started\" entries have medals assigned (e.g. Bronze on a DNS). Medals cleared automatically.",
    ],
    impact: "10 records corrected",
  },
  {
    title: "Time Field Normalization",
    description:
      "The source data uses inconsistent labels for non-finishes. We normalize these so every result has one of three values: a valid finish time (HH:MM:SS), \"DNF\" (Did Not Finish — started but dropped out), or \"DNS\" (Did Not Start). This matters for comeback stories and perseverance records: a DNS means the athlete never started, while a DNF means they tried and failed.",
    details: [
      "\"Not started\" \u2192 \"DNS\" — same meaning, different label (35,943 records across all years)",
      "\"UOF\" \u2192 \"DNF\" — appears to mean \"Unofficial Finish\"; no time or position recorded (604 records, 2025 only)",
      "\"Started\" \u2192 \"DNF\" — started but no time recorded (1 record)",
      "Comeback stories and \"Never Gave Up\" only count DNF entries, not DNS",
      "Example: Bruce Fordyce 1989 and 1999 were DNS (not DNF) — correctly excluded from comeback stories",
    ],
    impact: "36,548 records normalized for consistency",
  },
  {
    title: "Athlete ID Collision Filtering",
    description:
      "The source database has cases where two completely different athletes share the same athlete ID across distant eras. For example, a runner from the 1920s and a runner from the 2010s might share the same UUID, creating a false career span of 85+ years.",
    details: [
      "Longest career records require a minimum of 5 finishes to qualify",
      "This filters out most ID collisions, which typically have only 2-3 entries",
      "Example: \"Dean ELLIOTT\" appeared to have an 85-year career (1925 + 2010) — clearly two different people",
    ],
    impact: "Athletes with fewer than 5 finishes excluded from career span records only",
  },
  {
    title: "Country Name Normalization",
    description:
      "The source data uses formal/ISO-style country names (e.g. \"United States of America (the)\"). We normalize these to common display names for readability.",
    details: [
      "17 formal country names mapped to common names",
      "Examples: \"Russian Federation (the)\" \u2192 \"Russia\", \"Korea (the Republic of)\" \u2192 \"South Korea\"",
    ],
    impact: "Display names only — no data is lost",
  },
  {
    title: "Over-Cutoff Finish Times",
    description:
      "A small number of runners have recorded finish times that exceed the official cutoff for their race year. Most of these are from the year 2000 (27 runners) and already have no medal assigned — they were timed past the finish line but are not official finishers. We do not alter these records but they are excluded from medal counts and official finisher tallies.",
    details: [
      "Year 2000: 27 runners with times from 12:00:01 to 12:21:59 — no medals assigned (correctly handled by source data)",
      "Year 2013: 1 runner at 12:12:24 — no medal assigned",
      "Early years (1921, 1948): 1-2 runners slightly over cutoff — likely due to flexible enforcement or approximate timing in that era",
      "These records are preserved as-is but excluded from official statistics",
    ],
    impact: "~30 records — already correctly handled in source data",
  },
  {
    title: "Time Sanity Checks",
    description:
      "Finish times under 5 hours are treated as invalid data, since the fastest-ever Comrades finish is approximately 5:18. The placeholder time \"00:00:00\" is also treated as missing data.",
    details: [
      "Times under 5:00:00 excluded from performance statistics",
      "\"00:00:00\" treated as missing/invalid",
      "Slowdown curve analysis excludes deltas > 3 hours (likely injury/aging, not meaningful trend)",
    ],
    impact: "Affects statistical calculations only — raw data preserved",
  },
  {
    title: "Future Year Exclusion",
    description:
      "The source data contains entries for the upcoming race year (pre-registrations). These are excluded from all analysis since the race has not yet occurred.",
    details: [
      "All queries filter to year <= 2025",
      "2026 entries are registration data, not results",
    ],
    impact: "All 2026 records excluded from analysis",
  },
  {
    title: "Cancelled Year Handling",
    description:
      "Years when the race was not held are excluded from all performance statistics and streak calculations.",
    details: [
      "1941\u20131945: Not held due to World War II",
      "2020\u20132021: Cancelled due to the COVID-19 pandemic",
      "These years do not break consecutive finish streaks",
    ],
    impact: "7 cancelled years handled",
  },
];

export default function DataQualityPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Data Quality & Corrections
        </h1>
        <p className="text-gray-500 leading-relaxed">
          Comrades Marathon Explorer uses data sourced from{" "}
          <a
            href="https://comrades.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-comrades hover:underline"
          >
            comrades.com
          </a>
          . While this data is remarkably comprehensive — covering over a century
          of racing — it contains some inconsistencies, errors, and gaps. This
          page documents every correction and inference we apply, in the
          interests of full transparency.
        </p>
      </div>

      {/* Principles */}
      <div className="mb-10 p-5 bg-emerald-50 border border-emerald-200 rounded-lg">
        <h2 className="font-semibold text-emerald-900 mb-2">Our Principles</h2>
        <ul className="space-y-2 text-sm text-emerald-800">
          <li className="flex gap-2">
            <span className="font-bold text-emerald-600 flex-shrink-0">1.</span>
            <span>
              <strong>Preserve raw data.</strong> We never modify the source
              database. All corrections are applied at export time and can be
              reversed.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-emerald-600 flex-shrink-0">2.</span>
            <span>
              <strong>Be conservative.</strong> We only correct data when we have
              high confidence that the original is wrong. When in doubt, we leave
              data as-is.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-emerald-600 flex-shrink-0">3.</span>
            <span>
              <strong>Be transparent.</strong> Every correction is documented
              here with its rationale and the number of records affected.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-emerald-600 flex-shrink-0">4.</span>
            <span>
              <strong>Err on the side of exclusion.</strong> When data is
              ambiguous, we exclude it from statistical analysis rather than
              making assumptions.
            </span>
          </li>
        </ul>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-comrades">{corrections.length}</div>
          <div className="text-xs text-gray-500 mt-1">Correction Categories</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-comrades">~37K</div>
          <div className="text-xs text-gray-500 mt-1">Records Corrected</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-comrades">0</div>
          <div className="text-xs text-gray-500 mt-1">Source Records Modified</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-comrades">100%</div>
          <div className="text-xs text-gray-500 mt-1">Reversible</div>
        </div>
      </div>

      {/* Corrections */}
      <div className="space-y-6">
        {corrections.map((c, i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="font-semibold text-gray-900">{c.title}</h3>
              <span className="flex-shrink-0 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full whitespace-nowrap">
                {c.impact}
              </span>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-3">
              {c.description}
            </p>
            <div className="bg-gray-50 rounded-md p-3">
              <ul className="space-y-1.5">
                {c.details.map((d, j) => (
                  <li
                    key={j}
                    className="text-xs text-gray-700 flex gap-2"
                  >
                    <span className="text-gray-400 flex-shrink-0">&#8226;</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div className="mt-10 pt-6 border-t border-gray-200 text-sm text-gray-500">
        <p className="mb-2">
          This page is updated whenever new corrections are applied. The
          correction logic lives in the open-source export pipeline and can be
          inspected in full.
        </p>
        <p>
          If you spot data issues or have corrections to suggest,{" "}
          we welcome contributions. The goal is to make this the most accurate
          record of Comrades Marathon history available.
        </p>
        <div className="mt-4">
          <Link
            href="/records"
            className="text-comrades hover:underline"
          >
            &larr; Back to Records & Stories
          </Link>
        </div>
      </div>
    </div>
  );
}
