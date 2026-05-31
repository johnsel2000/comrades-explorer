"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { getClubList, getClubRankings, formatNumber, formatTime } from "@/lib/data";
import type { ClubListEntry, ClubYearRanking } from "@/lib/data";

type SortKey = "name" | "totalFinishers" | "uniqueAthletes" | "totalGolds" | "totalWins" | "firstYear";
type SortDir = "asc" | "desc";

function ClubsContent() {
  const [clubs, setClubs] = useState<ClubListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("totalFinishers");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const PER_PAGE = 50;

  // Year comparison state
  const [rankings, setRankings] = useState<Record<string, ClubYearRanking[]> | null>(null);
  const [selectedCompareYear, setSelectedCompareYear] = useState<string>("");
  const [compareSort, setCompareSort] = useState<"finishers" | "golds" | "avgSeconds" | "finishRate">("finishers");

  useEffect(() => {
    getClubList()
      .then(setClubs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadRankings = async () => {
    if (rankings) return;
    const data = await getClubRankings();
    setRankings(data);
    const years = Object.keys(data).sort((a, b) => Number(b) - Number(a));
    if (years.length > 0) setSelectedCompareYear(years[0]);
  };

  const compareYears = rankings ? Object.keys(rankings).sort((a, b) => Number(b) - Number(a)) : [];
  const compareData = (rankings && selectedCompareYear && rankings[selectedCompareYear]) || [];
  const sortedCompareData = [...compareData].sort((a, b) => {
    switch (compareSort) {
      case "finishers": return b.finishers - a.finishers;
      case "golds": return b.golds - a.golds;
      case "avgSeconds": return (a.avgSeconds || 99999) - (b.avgSeconds || 99999);
      case "finishRate": return b.finishRate - a.finishRate;
      default: return 0;
    }
  });

  const filtered = useMemo(() => {
    let list = clubs;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q));
    }
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "totalFinishers": cmp = a.totalFinishers - b.totalFinishers; break;
        case "uniqueAthletes": cmp = a.uniqueAthletes - b.uniqueAthletes; break;
        case "totalGolds": cmp = a.totalGolds - b.totalGolds; break;
        case "totalWins": cmp = a.totalWins - b.totalWins; break;
        case "firstYear": cmp = a.firstYear - b.firstYear; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [clubs, search, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "name" ? "asc" : "desc"); }
    setPage(0);
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <svg className="w-3 h-3 text-gray-300 ml-1 inline" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M7 15l5 5 5-5M7 9l5-5 5 5" /></svg>;
    return sortDir === "asc"
      ? <svg className="w-3 h-3 text-comrades ml-1 inline" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M7 14l5-5 5 5" /></svg>
      : <svg className="w-3 h-3 text-comrades ml-1 inline" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5" /></svg>;
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-pulse text-gray-400">Loading clubs...</div></div>;
  }

  const displayed = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/" className="hover:text-comrades transition-colors">Home</Link>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
        <span className="text-gray-900 font-medium">Clubs</span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Running Clubs</h1>
      <p className="text-gray-500 mb-6">{formatNumber(clubs.length)} clubs have fielded Comrades finishers — click any club for its full history</p>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search clubs..."
          className="w-full sm:w-72 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-comrades focus:ring-1 focus:ring-comrades outline-none"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50/50">
                <th className="text-left px-4 py-2 cursor-pointer select-none" onClick={() => handleSort("name")}>Club <SortIcon column="name" /></th>
                <th className="text-right px-4 py-2 cursor-pointer select-none" onClick={() => handleSort("totalFinishers")}>Finishes <SortIcon column="totalFinishers" /></th>
                <th className="text-right px-4 py-2 cursor-pointer select-none" onClick={() => handleSort("uniqueAthletes")}>Athletes <SortIcon column="uniqueAthletes" /></th>
                <th className="text-right px-4 py-2 cursor-pointer select-none" onClick={() => handleSort("totalWins")}>Wins <SortIcon column="totalWins" /></th>
                <th className="text-right px-4 py-2 cursor-pointer select-none" onClick={() => handleSort("totalGolds")}>Golds <SortIcon column="totalGolds" /></th>
                <th className="text-right px-4 py-2 cursor-pointer select-none hidden sm:table-cell" onClick={() => handleSort("firstYear")}>Active <SortIcon column="firstYear" /></th>
                <th className="text-right px-4 py-2 hidden md:table-cell">Avg Time</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((c) => (
                <tr key={c.slug} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-2 font-medium text-gray-900">
                    <Link href={`/club?name=${c.slug}`} className="hover:text-comrades transition-colors">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right text-comrades font-bold">{formatNumber(c.totalFinishers)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{formatNumber(c.uniqueAthletes)}</td>
                  <td className="px-4 py-2 text-right">
                    {c.totalWins > 0 ? <span className="text-amber-600 font-bold">{c.totalWins}</span> : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {c.totalGolds > 0 ? <span className="text-amber-500 font-semibold">{c.totalGolds}</span> : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-500 text-xs hidden sm:table-cell">{c.firstYear}–{c.latestYear}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-gray-500 hidden md:table-cell">{c.avgTime ? formatTime(c.avgTime) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm">
            <span className="text-gray-500">Showing {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, filtered.length)} of {formatNumber(filtered.length)}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30">← Prev</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1} className="px-3 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30">Next →</button>
            </div>
          </div>
        )}
      </div>
      {/* Year-by-Year Club Comparison */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Club Rankings by Year</h2>
            <p className="text-sm text-gray-500">Compare clubs head-to-head in any year</p>
          </div>
          {!rankings && (
            <button onClick={loadRankings} className="px-4 py-2 bg-comrades text-white text-sm font-medium rounded-lg hover:bg-comrades/90 transition-colors">
              Load Rankings
            </button>
          )}
        </div>

        {rankings && (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <select
                value={selectedCompareYear}
                onChange={e => setSelectedCompareYear(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-comrades focus:ring-1 focus:ring-comrades outline-none"
              >
                {compareYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <div className="flex gap-1">
                {([
                  ["finishers", "Most Finishers"],
                  ["golds", "Most Golds"],
                  ["avgSeconds", "Fastest Avg"],
                  ["finishRate", "Best Finish %"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setCompareSort(key)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      compareSort === key ? "bg-comrades text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50/50">
                      <th className="text-left px-4 py-2 w-8">#</th>
                      <th className="text-left px-4 py-2">Club</th>
                      <th className="text-right px-4 py-2">Entries</th>
                      <th className="text-right px-4 py-2">Finished</th>
                      <th className="text-right px-4 py-2">Finish %</th>
                      <th className="text-right px-4 py-2">Golds</th>
                      <th className="text-right px-4 py-2">Silvers</th>
                      <th className="text-right px-4 py-2 hidden sm:table-cell">DNFs</th>
                      <th className="text-right px-4 py-2">Avg Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCompareData.slice(0, 30).map((c, i) => (
                      <tr key={c.slug} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-2 text-gray-400 font-medium">{i + 1}</td>
                        <td className="px-4 py-2 font-medium text-gray-900">
                          <Link href={`/club?name=${c.slug}`} className="hover:text-comrades transition-colors">{c.name}</Link>
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600">{formatNumber(c.entries)}</td>
                        <td className="px-4 py-2 text-right text-comrades font-bold">{formatNumber(c.finishers)}</td>
                        <td className="px-4 py-2 text-right">
                          <span className={c.finishRate >= 85 ? "text-green-600 font-semibold" : c.finishRate < 60 ? "text-red-500" : "text-gray-600"}>
                            {c.finishRate}%
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          {c.golds > 0 ? <span className="text-amber-600 font-bold">{c.golds}</span> : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-500">{c.silvers || "-"}</td>
                        <td className="px-4 py-2 text-right text-gray-400 hidden sm:table-cell">{c.dnfs || "-"}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-gray-600">{c.avgTime ? formatTime(c.avgTime) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ClubsPage() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto px-4 py-12 text-center text-gray-400">Loading...</div>}>
      <ClubsContent />
    </Suspense>
  );
}
