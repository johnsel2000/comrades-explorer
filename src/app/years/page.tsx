"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getYears, formatTime, formatNumber } from "@/lib/data";
import type { YearData } from "@/lib/types";
import RecordBadges from "@/components/RecordBadges";

type DirectionFilter = "all" | "Up" | "Down";

function WinnerLink({ winner }: { winner: { name: string; athleteId?: string; time: string } }) {
  if (winner.athleteId) {
    return (
      <Link
        href={`/runner?id=${winner.athleteId}`}
        className="font-medium text-comrades hover:underline transition-colors"
      >
        {winner.name}
      </Link>
    );
  }
  return <span className="font-medium">{winner.name}</span>;
}

export default function YearsPage() {
  const [years, setYears] = useState<YearData[]>([]);
  const [loading, setLoading] = useState(true);
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("all");

  useEffect(() => {
    getYears()
      .then((data) => setYears(data.sort((a, b) => b.year - a.year)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (directionFilter === "all") return years;
    return years.filter((y) => y.direction === directionFilter);
  }, [years, directionFilter]);

  const raceCount = years.filter((y) => !y.cancelled).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-gray-400">Loading years...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Race History</h1>
      <p className="text-gray-500 mb-6">
        {raceCount} races from {years[years.length - 1]?.year} to {years[0]?.year}.
      </p>

      {/* Direction filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg">
          {[
            { key: "all" as const, label: "All" },
            { key: "Up" as const, label: "↑ Up", color: "text-red-600" },
            { key: "Down" as const, label: "↓ Down", color: "text-blue-600" },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setDirectionFilter(opt.key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                directionFilter === opt.key
                  ? "bg-white text-comrades shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <span className="text-xs text-gray-400">
          {filtered.length} {directionFilter === "all" ? "years" : `${directionFilter.toLowerCase()} runs`}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Year</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Dir</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  <span className="sm:hidden">Winners</span>
                  <span className="hidden sm:inline">Winner</span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Time</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Women&apos;s Winner</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Finishers</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Rate</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((y) => (
                <tr
                  key={y.year}
                  className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${
                    y.cancelled ? "opacity-40" : ""
                  }`}
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/year?year=${y.year}`}
                      className="font-bold text-comrades hover:underline"
                    >
                      {y.year}
                    </Link>
                    {y.raceNumber && (
                      <span className="text-[10px] text-gray-400 ml-1.5 hidden xl:inline">#{y.raceNumber}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 hidden sm:table-cell">
                    {y.cancelled ? (
                      <span className="text-xs text-red-500 font-medium">Cancelled</span>
                    ) : y.direction ? (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          y.direction === "Down"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {y.direction === "Down" ? "↓" : "↑"}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {y.cancelled ? (
                      <span className="text-gray-400 italic text-xs">Cancelled</span>
                    ) : y.winner ? (
                      <div>
                        <WinnerLink winner={y.winner} />
                        {/* On mobile, show women's winner stacked below */}
                        {y.winnerWomen && (
                          <div className="sm:hidden mt-1.5 pt-1.5 border-t border-gray-100">
                            <span className="text-[10px] text-pink-500 font-semibold uppercase tracking-wider mr-1">W</span>
                            <WinnerLink winner={y.winnerWomen} />
                            <span className="text-gray-400 font-mono text-[11px] ml-1">{formatTime(y.winnerWomen.time)}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-gray-600 hidden md:table-cell">
                    {y.winner ? (
                      <span className="inline-flex items-center">
                        {formatTime(y.winner.time)}
                        <RecordBadges records={y.menRecords} />
                      </span>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700 hidden sm:table-cell">
                    {y.winnerWomen ? (
                      <span className="inline-flex items-center flex-wrap">
                        <WinnerLink winner={y.winnerWomen} />
                        <span className="text-gray-400 font-mono ml-1.5 text-xs">{formatTime(y.winnerWomen.time)}</span>
                        <RecordBadges records={y.womenRecords} />
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-comrades">
                    {y.cancelled ? "-" : formatNumber(y.finishers)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-500 hidden sm:table-cell">
                    {y.finishRate ? `${y.finishRate}%` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
