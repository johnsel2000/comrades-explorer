"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLeaderboards, formatTime, formatNumber } from "@/lib/data";
import type { Leaderboards } from "@/lib/types";
import MedalBadge from "@/components/MedalBadge";

type Tab = "finishes" | "times" | "clubs" | "countries";

const tabs: { key: Tab; label: string }[] = [
  { key: "finishes", label: "Most Finishes" },
  { key: "times", label: "Fastest Times" },
  { key: "clubs", label: "Top Clubs" },
  { key: "countries", label: "Top Countries" },
];

export default function LeaderboardsPage() {
  const [data, setData] = useState<Leaderboards | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("finishes");
  const [showCount, setShowCount] = useState(50);

  useEffect(() => {
    getLeaderboards()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setShowCount(50);
  }, [activeTab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-gray-400">Loading leaderboards...</div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Leaderboards</h1>
      <p className="text-gray-500 mb-6">
        The all-time greats of the Comrades Marathon.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-6 overflow-x-auto">
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
                {data.mostFinishes.slice(0, showCount).map((r) => (
                  <tr key={r.athleteId} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2.5 text-gray-400 font-medium">{r.rank}</td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/runner?id=${r.athleteId}`}
                        className="font-medium text-gray-900 hover:text-comrades transition-colors"
                      >
                        {r.name}
                      </Link>
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
          {showCount < data.mostFinishes.length && (
            <div className="text-center py-4 border-t border-gray-100">
              <button
                onClick={() => setShowCount((c) => c + 50)}
                className="px-6 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Show more ({data.mostFinishes.length - showCount} remaining)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Fastest Times */}
      {activeTab === "times" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
                {data.fastestTimes.slice(0, showCount).map((r) => (
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
          {showCount < data.fastestTimes.length && (
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
