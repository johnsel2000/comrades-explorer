"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getLeaderboards, formatTime, formatNumber } from "@/lib/data";
import type { Leaderboards } from "@/lib/types";
import MedalBadge from "@/components/MedalBadge";

type Tab = "finishes" | "times" | "clubs" | "countries";
type GenderFilter = "all" | "M" | "F";

const tabs: { key: Tab; label: string }[] = [
  { key: "finishes", label: "Most Finishes" },
  { key: "times", label: "Fastest Times" },
  { key: "clubs", label: "Top Clubs" },
  { key: "countries", label: "Top Countries" },
];

function GenderToggle({
  value,
  onChange,
}: {
  value: GenderFilter;
  onChange: (v: GenderFilter) => void;
}) {
  return (
    <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg">
      {[
        { key: "all" as const, label: "All" },
        { key: "M" as const, label: "Men" },
        { key: "F" as const, label: "Women" },
      ].map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
            value === opt.key
              ? "bg-white text-comrades shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function LeaderboardsPage() {
  const [data, setData] = useState<Leaderboards | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("finishes");
  const [showCount, setShowCount] = useState(50);
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");

  useEffect(() => {
    getLeaderboards()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setShowCount(50);
  }, [activeTab, genderFilter]);

  // Filtered most finishes
  const filteredFinishes = useMemo(() => {
    if (!data) return [];
    if (genderFilter === "F") {
      return data.mostFinishesWomen;
    }
    if (genderFilter === "M") {
      const men = data.mostFinishes.filter((r) => r.gender === "M");
      return men.map((r, i) => ({ ...r, rank: i + 1 }));
    }
    return data.mostFinishes;
  }, [data, genderFilter]);

  // Filtered fastest times
  const filteredTimes = useMemo(() => {
    if (!data) return [];
    if (genderFilter === "F") {
      return data.fastestTimesWomen;
    }
    // "all" and "M" both show overall winners (which are male)
    return data.fastestTimes;
  }, [data, genderFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-gray-400">Loading leaderboards...</div>
      </div>
    );
  }

  if (!data) return null;

  const showGenderToggle = activeTab === "finishes" || activeTab === "times";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Leaderboards</h1>
      <p className="text-gray-500 mb-6">
        The all-time greats of the Comrades Marathon.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 min-w-[120px] px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-white text-comrades shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Gender filter */}
      {showGenderToggle && (
        <div className="flex items-center justify-between mb-4">
          <GenderToggle value={genderFilter} onChange={setGenderFilter} />
          {genderFilter !== "all" && activeTab === "finishes" && (
            <span className="text-xs text-gray-400">
              {filteredFinishes.length} {genderFilter === "F" ? "women" : "men"}
            </span>
          )}
        </div>
      )}

      {/* Most Finishes */}
      {activeTab === "finishes" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-12">#</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Finishes</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Years</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Best Medal</th>
                </tr>
              </thead>
              <tbody>
                {filteredFinishes.slice(0, showCount).map((r) => (
                  <tr key={r.athleteId} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2.5 text-gray-400 font-medium">{r.rank}</td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/runner?id=${r.athleteId}`}
                        className="font-medium text-gray-900 hover:text-comrades transition-colors"
                      >
                        {r.name}
                      </Link>
                      {genderFilter === "all" && r.gender === "F" && (
                        <span className="ml-1.5 text-[10px] text-pink-500 font-medium">W</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-comrades">{r.finishes}</td>
                    <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell">
                      {r.firstYear}–{r.lastYear}
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell">
                      {r.bestMedal && <MedalBadge medal={r.bestMedal} size="sm" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {showCount < filteredFinishes.length && (
            <div className="text-center py-4 border-t border-gray-100">
              <button
                onClick={() => setShowCount((c) => c + 50)}
                className="px-6 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Show more ({filteredFinishes.length - showCount} remaining)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Fastest Times */}
      {activeTab === "times" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {genderFilter === "F" && (
            <div className="px-4 py-2 bg-pink-50 border-b border-pink-100 text-xs text-pink-700 font-medium">
              Women&apos;s winning times (since 1975)
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-12">#</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Year</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Winner</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Time</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Direction</th>
                </tr>
              </thead>
              <tbody>
                {filteredTimes.slice(0, showCount).map((r) => (
                  <tr key={`${r.year}-${r.time}`} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2.5 text-gray-400 font-medium">{r.rank}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{r.year}</td>
                    <td className="px-4 py-2.5 text-gray-900">{r.name}</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-comrades">
                      {formatTime(r.time)}
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell">
                      {r.direction && (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            r.direction === "Down"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {r.direction === "Down" ? "↓" : "↑"} {r.direction}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {showCount < filteredTimes.length && (
            <div className="text-center py-4 border-t border-gray-100">
              <button
                onClick={() => setShowCount((c) => c + 50)}
                className="px-6 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Show more
              </button>
            </div>
          )}
        </div>
      )}

      {/* Top Clubs */}
      {activeTab === "clubs" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-12">#</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Club</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Total Finishes</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Unique Runners</th>
                </tr>
              </thead>
              <tbody>
                {data.topClubs.slice(0, showCount).map((r) => (
                  <tr key={r.club} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2.5 text-gray-400 font-medium">{r.rank}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{r.club}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-comrades">
                      {formatNumber(r.totalFinishes)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-500 hidden sm:table-cell">
                      {formatNumber(r.uniqueRunners)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {showCount < data.topClubs.length && (
            <div className="text-center py-4 border-t border-gray-100">
              <button
                onClick={() => setShowCount((c) => c + 50)}
                className="px-6 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Show more ({data.topClubs.length - showCount} remaining)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Top Countries */}
      {activeTab === "countries" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-12">#</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Country</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Total Finishes</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Unique Runners</th>
                </tr>
              </thead>
              <tbody>
                {data.topCountries.slice(0, showCount).map((r) => (
                  <tr key={r.country} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2.5 text-gray-400 font-medium">{r.rank}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{r.country}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-comrades">
                      {formatNumber(r.totalFinishes)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-500 hidden sm:table-cell">
                      {formatNumber(r.uniqueRunners)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {showCount < data.topCountries.length && (
            <div className="text-center py-4 border-t border-gray-100">
              <button
                onClick={() => setShowCount((c) => c + 50)}
                className="px-6 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Show more ({data.topCountries.length - showCount} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
