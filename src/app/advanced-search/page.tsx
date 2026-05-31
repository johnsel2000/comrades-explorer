"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { getAdvancedSearchData, formatTime, formatNumber } from "@/lib/data";
import MedalBadge from "@/components/MedalBadge";

// Compact format: [name, id, gender, finishes, greenTier, bestMedal, bestTimeSecs, firstYear, lastYear, country]
type AthleteRow = [string, string, string, number, number, string, number, number, number, string];

interface SearchData {
  format: string[];
  medalCodes: Record<string, string>;
  data: AthleteRow[];
}

const MEDAL_CODE_TO_NAME: Record<string, string> = {
  G: "Gold",
  W: "Wally Hayward",
  I: "Isavel Roche-Kelly",
  S: "Silver",
  B: "Bill Rowan",
  R: "Robert Mtshali",
  Z: "Bronze",
  V: "Vic Clapham",
};

const MEDAL_CODE_RANK: Record<string, number> = { G: 1, W: 2, I: 3, S: 4, B: 5, R: 6, Z: 7, V: 8 };

const MEDAL_OPTIONS = [
  { code: "G", label: "Gold" },
  { code: "W", label: "Wally Hayward" },
  { code: "I", label: "Isavel Roche-Kelly" },
  { code: "S", label: "Silver" },
  { code: "B", label: "Bill Rowan" },
  { code: "R", label: "Robert Mtshali" },
  { code: "Z", label: "Bronze" },
  { code: "V", label: "Vic Clapham" },
];

const COUNTRY_NAMES: Record<string, string> = {
  ZA: "South Africa", GB: "United Kingdom", ZW: "Zimbabwe", AU: "Australia",
  US: "USA", IN: "India", BR: "Brazil", BW: "Botswana", DE: "Germany",
  SZ: "Eswatini", NA: "Namibia", LS: "Lesotho", CA: "Canada", ZM: "Zambia",
  CH: "Switzerland", RU: "Russia", JP: "Japan", NL: "Netherlands", NZ: "New Zealand",
  KE: "Kenya", FR: "France", IE: "Ireland", IT: "Italy", PT: "Portugal",
  CN: "China", ES: "Spain", BE: "Belgium", SE: "Sweden", MZ: "Mozambique",
  AT: "Austria", HK: "Hong Kong", IL: "Israel", DK: "Denmark", NO: "Norway",
  TW: "Taiwan", SG: "Singapore", MW: "Malawi", PL: "Poland", CZ: "Czech Republic",
  FI: "Finland", MX: "Mexico", AR: "Argentina", KR: "South Korea", HU: "Hungary",
  GR: "Greece", NG: "Nigeria", TH: "Thailand", CO: "Colombia", RO: "Romania",
  MY: "Malaysia", TR: "Turkey", CL: "Chile", PH: "Philippines", AE: "UAE",
  HR: "Croatia", TZ: "Tanzania", RW: "Rwanda", MU: "Mauritius", UG: "Uganda",
  ET: "Ethiopia", RE: "Réunion",
};

function secsToTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

const PAGE_SIZE = 50;

function AdvancedSearchContent() {
  const [searchData, setSearchData] = useState<SearchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Filters
  const [nameQuery, setNameQuery] = useState("");
  const [gender, setGender] = useState<"" | "M" | "F">("");
  const [medalAtLeast, setMedalAtLeast] = useState("");
  const [minFinishes, setMinFinishes] = useState<number | "">("");
  const [maxFinishes, setMaxFinishes] = useState<number | "">("");
  const [greenNumber, setGreenNumber] = useState<"" | "any" | "1" | "2" | "3" | "4" | "5">("");
  const [country, setCountry] = useState("");
  const [yearFrom, setYearFrom] = useState<number | "">("");
  const [yearTo, setYearTo] = useState<number | "">("");
  const [maxTimeSecs, setMaxTimeSecs] = useState<number | "">("");
  const [sortBy, setSortBy] = useState<"finishes" | "time" | "name" | "year">("finishes");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  useEffect(() => {
    getAdvancedSearchData()
      .then(setSearchData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // Extract unique countries for dropdown
  const countryOptions = useMemo(() => {
    if (!searchData) return [];
    const counts: Record<string, number> = {};
    for (const r of searchData.data) {
      const c = r[9];
      if (c) counts[c] = (counts[c] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => ({ code, label: COUNTRY_NAMES[code] || code, count }));
  }, [searchData]);

  // Apply filters
  const filtered = useMemo(() => {
    if (!searchData) return [];
    setPage(0);
    const nameLower = nameQuery.toLowerCase().trim();
    const nameWords = nameLower.split(/\s+/).filter(w => w.length > 0);

    return searchData.data.filter((r) => {
      // Name filter - all words must appear
      if (nameWords.length > 0) {
        const n = r[0].toLowerCase();
        if (!nameWords.every(w => n.includes(w))) return false;
      }
      // Gender
      if (gender && r[2] !== gender) return false;
      // Medal (at least this good)
      if (medalAtLeast) {
        const rank = MEDAL_CODE_RANK[r[5]];
        const target = MEDAL_CODE_RANK[medalAtLeast];
        if (!rank || rank > target) return false;
      }
      // Finishes
      if (minFinishes !== "" && r[3] < minFinishes) return false;
      if (maxFinishes !== "" && r[3] > maxFinishes) return false;
      // Green number
      if (greenNumber === "any" && r[4] < 1) return false;
      if (greenNumber && greenNumber !== "any" && r[4] < parseInt(greenNumber)) return false;
      // Country
      if (country && r[9] !== country) return false;
      // Year range
      if (yearFrom !== "" && r[8] < yearFrom) return false; // last year before filter start
      if (yearTo !== "" && r[7] > yearTo) return false;     // first year after filter end
      // Max time (best time must be ≤)
      if (maxTimeSecs !== "" && (r[6] === 0 || r[6] > maxTimeSecs)) return false;
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchData, nameQuery, gender, medalAtLeast, minFinishes, maxFinishes, greenNumber, country, yearFrom, yearTo, maxTimeSecs]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortBy) {
        case "finishes": return (a[3] - b[3]) * dir;
        case "time": return ((a[6] || 99999) - (b[6] || 99999)) * dir;
        case "name": return a[0].localeCompare(b[0]) * dir;
        case "year": return (a[8] - b[8]) * dir;
        default: return 0;
      }
    });
    return arr;
  }, [filtered, sortBy, sortDir]);

  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

  const hasAnyFilter = nameQuery || gender || medalAtLeast || minFinishes !== "" || maxFinishes !== "" ||
    greenNumber || country || yearFrom !== "" || yearTo !== "" || maxTimeSecs !== "";

  const clearAll = () => {
    setNameQuery(""); setGender(""); setMedalAtLeast(""); setMinFinishes(""); setMaxFinishes("");
    setGreenNumber(""); setCountry(""); setYearFrom(""); setYearTo(""); setMaxTimeSecs("");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="animate-spin w-8 h-8 border-2 border-comrades border-t-transparent rounded-full" />
        <div className="text-gray-500 text-sm">Loading 132,880 athletes...</div>
      </div>
    );
  }

  if (error || !searchData) {
    return <div className="max-w-4xl mx-auto px-4 py-12 text-center text-red-500">Failed to load search data.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/" className="hover:text-comrades transition-colors">Home</Link>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
        <span className="text-gray-900 font-medium">Advanced Search</span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Advanced Search</h1>
      <p className="text-gray-500 mb-6 text-sm">
        Filter {formatNumber(searchData.data.length)} Comrades finishers by any combination of criteria
      </p>

      {/* Filter Panel */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Name</label>
            <input
              type="text"
              value={nameQuery}
              onChange={e => setNameQuery(e.target.value)}
              placeholder="Any part of name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-comrades focus:ring-1 focus:ring-comrades outline-none"
            />
          </div>

          {/* Gender */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Gender</label>
            <select value={gender} onChange={e => setGender(e.target.value as "" | "M" | "F")}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-comrades outline-none bg-white">
              <option value="">All</option>
              <option value="M">Men</option>
              <option value="F">Women</option>
            </select>
          </div>

          {/* Medal */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Medal (at least)</label>
            <select value={medalAtLeast} onChange={e => setMedalAtLeast(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-comrades outline-none bg-white">
              <option value="">Any</option>
              {MEDAL_OPTIONS.map(m => <option key={m.code} value={m.code}>{m.label}</option>)}
            </select>
          </div>

          {/* Country */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Country</label>
            <select value={country} onChange={e => setCountry(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-comrades outline-none bg-white">
              <option value="">All countries</option>
              {countryOptions.map(c => <option key={c.code} value={c.code}>{c.label} ({formatNumber(c.count)})</option>)}
            </select>
          </div>

          {/* Min Finishes */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Min Finishes</label>
            <input type="number" min={1} value={minFinishes} onChange={e => setMinFinishes(e.target.value ? parseInt(e.target.value) : "")}
              placeholder="e.g. 10"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-comrades outline-none" />
          </div>

          {/* Max Finishes */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Max Finishes</label>
            <input type="number" min={1} value={maxFinishes} onChange={e => setMaxFinishes(e.target.value ? parseInt(e.target.value) : "")}
              placeholder="e.g. 5"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-comrades outline-none" />
          </div>

          {/* Green Number */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Green Number</label>
            <select value={greenNumber} onChange={e => setGreenNumber(e.target.value as typeof greenNumber)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-comrades outline-none bg-white">
              <option value="">Any</option>
              <option value="any">Green Number (10+)</option>
              <option value="2">Double Green (20+)</option>
              <option value="3">Triple Green (30+)</option>
              <option value="4">Quadruple Green (40+)</option>
              <option value="5">Quintuple Green (50+)</option>
            </select>
          </div>

          {/* Best Time (max) */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Best Time (faster than)</label>
            <select value={maxTimeSecs} onChange={e => setMaxTimeSecs(e.target.value ? parseInt(e.target.value) : "")}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-comrades outline-none bg-white">
              <option value="">Any</option>
              <option value={21600}>Sub 6:00 (Gold)</option>
              <option value={23400}>Sub 6:30</option>
              <option value={25200}>Sub 7:00</option>
              <option value={27000}>Sub 7:30 (Silver)</option>
              <option value={28800}>Sub 8:00</option>
              <option value={32400}>Sub 9:00 (Bill Rowan)</option>
              <option value={36000}>Sub 10:00 (Bronze)</option>
              <option value={39600}>Sub 11:00 (Vic Clapham)</option>
            </select>
          </div>

          {/* Year From */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Active From Year</label>
            <input type="number" min={1921} max={2026} value={yearFrom}
              onChange={e => setYearFrom(e.target.value ? parseInt(e.target.value) : "")}
              placeholder="e.g. 2000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-comrades outline-none" />
          </div>

          {/* Year To */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Active To Year</label>
            <input type="number" min={1921} max={2026} value={yearTo}
              onChange={e => setYearTo(e.target.value ? parseInt(e.target.value) : "")}
              placeholder="e.g. 2025"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-comrades outline-none" />
          </div>

          {/* Sort */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Sort By</label>
            <select value={`${sortBy}-${sortDir}`} onChange={e => {
              const [s, d] = e.target.value.split("-") as [typeof sortBy, typeof sortDir];
              setSortBy(s); setSortDir(d);
            }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-comrades outline-none bg-white">
              <option value="finishes-desc">Most finishes first</option>
              <option value="finishes-asc">Fewest finishes first</option>
              <option value="time-asc">Fastest time first</option>
              <option value="time-desc">Slowest time first</option>
              <option value="name-asc">Name A→Z</option>
              <option value="name-desc">Name Z→A</option>
              <option value="year-desc">Most recent first</option>
              <option value="year-asc">Oldest first</option>
            </select>
          </div>

          {/* Clear */}
          <div className="flex items-end">
            {hasAnyFilter && (
              <button onClick={clearAll}
                className="w-full px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                ✕ Clear All Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results summary */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-600">
          {hasAnyFilter ? (
            <><span className="font-bold text-comrades">{formatNumber(sorted.length)}</span> athletes match your criteria</>
          ) : (
            <span className="text-gray-400">Use the filters above to search {formatNumber(searchData.data.length)} athletes</span>
          )}
        </div>
        {totalPages > 1 && (
          <div className="text-xs text-gray-400">
            Page {page + 1} of {formatNumber(totalPages)}
          </div>
        )}
      </div>

      {/* Results table */}
      {(hasAnyFilter || page > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50/50">
                  <th className="text-left px-4 py-2">#</th>
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-center px-3 py-2">Gender</th>
                  <th className="text-right px-3 py-2">Finishes</th>
                  <th className="text-left px-3 py-2">Best Time</th>
                  <th className="text-left px-3 py-2">Best Medal</th>
                  <th className="text-left px-3 py-2">Country</th>
                  <th className="text-right px-3 py-2">Active</th>
                </tr>
              </thead>
              <tbody>
                {pageData.map((r, i) => (
                  <tr key={r[1]} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2 text-gray-400 text-xs">{page * PAGE_SIZE + i + 1}</td>
                    <td className="px-4 py-2">
                      <Link href={`/runner?id=${r[1]}`} className="font-medium text-gray-900 hover:text-comrades transition-colors">
                        {r[0]}
                      </Link>
                      {r[4] >= 1 && (
                        <span className={`ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          r[4] >= 3 ? "bg-green-700 text-white" : r[4] >= 2 ? "bg-green-600 text-white" : "bg-green-500 text-white"
                        }`}>
                          {r[4] >= 5 ? "5×GN" : r[4] >= 4 ? "4×GN" : r[4] >= 3 ? "3×GN" : r[4] >= 2 ? "2×GN" : "GN"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs ${r[2] === "F" ? "text-pink-500" : "text-blue-500"}`}>
                        {r[2] === "F" ? "♀" : "♂"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-comrades">{r[3]}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-600">
                      {r[6] > 0 ? formatTime(secsToTime(r[6])) : "-"}
                    </td>
                    <td className="px-3 py-2"><MedalBadge medal={MEDAL_CODE_TO_NAME[r[5]] || ""} /></td>
                    <td className="px-3 py-2 text-xs text-gray-500">{COUNTRY_NAMES[r[9]] || r[9] || "-"}</td>
                    <td className="px-3 py-2 text-right text-xs text-gray-400">{r[7]}–{r[8]}</td>
                  </tr>
                ))}
                {pageData.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No athletes match your criteria</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm">
              <span className="text-gray-500">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {formatNumber(sorted.length)}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setPage(0)} disabled={page === 0}
                  className="px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 text-xs">⟨⟨</button>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="px-3 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30">← Prev</button>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}
                  className="px-3 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30">Next →</button>
                <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}
                  className="px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 text-xs">⟩⟩</button>
              </div>
            </div>
          )}
        </div>
      )}

      {!hasAnyFilter && page === 0 && (
        <div className="bg-gradient-to-br from-comrades/5 to-amber-50 rounded-xl border border-comrades/20 p-8 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Explore 132,880 Comrades Finishers</h2>
          <p className="text-sm text-gray-600 max-w-lg mx-auto mb-4">
            Use the filters above to slice and dice the data. Try some examples:
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { label: "Women with Gold medals", fn: () => { setGender("F"); setMedalAtLeast("G"); } },
              { label: "Green Number holders", fn: () => { setGreenNumber("any"); } },
              { label: "Sub-6 hour runners", fn: () => { setMaxTimeSecs(21600); } },
              { label: "Triple Green Number women", fn: () => { setGender("F"); setGreenNumber("3"); } },
              { label: "Runners from Japan", fn: () => { setCountry("JP"); } },
              { label: "1920s–1930s pioneers", fn: () => { setYearFrom(1921); setYearTo(1939); } },
            ].map(ex => (
              <button key={ex.label} onClick={() => { clearAll(); ex.fn(); }}
                className="px-3 py-1.5 text-xs font-medium text-comrades bg-white border border-comrades/30 rounded-full hover:bg-comrades/10 transition-colors">
                {ex.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdvancedSearchPage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-12 text-center text-gray-400">Loading...</div>}>
      <AdvancedSearchContent />
    </Suspense>
  );
}
