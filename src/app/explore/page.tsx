"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  LineChart, Line, AreaChart, Area, ReferenceLine, ScatterChart, Scatter,
} from "recharts";
import { getInsights, getExplorerData, formatTime, formatNumber } from "@/lib/data";
import type { ExplorerData } from "@/lib/data";
import type { InsightsData } from "@/lib/types";
import MedalBadge from "@/components/MedalBadge";

const MEDAL_COLORS: Record<string, string> = {
  Gold: "#FFD700",
  "Wally Hayward": "#7B1FA2",
  "Isavel Roche-Kelly": "#1565C0",
  Silver: "#A8A8A8",
  "Bill Rowan": "#E65100",
  "Robert Mtshali": "#00695C",
  Bronze: "#CD7F32",
  "Vic Clapham": "#4E342E",
};

const SECTIONS = [
  { id: "christmas-tree", label: "Christmas Tree" },
  { id: "last-second", label: "Last Second" },
  { id: "family-pairs", label: "Running Together" },
  { id: "medal-rainbow", label: "Medal Rainbow" },
  { id: "iron-streaks", label: "Iron Streaks" },
  { id: "determination", label: "Determination" },
  { id: "decade-champions", label: "Decade Champions" },
  { id: "novice", label: "First-Timer Guide" },
  { id: "country-map", label: "Going Global" },
];

function ExploreContent() {
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [explorer, setExplorer] = useState<ExplorerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [familyPage, setFamilyPage] = useState(0);
  const FAMILY_PER_PAGE = 20;

  useEffect(() => {
    Promise.all([getInsights(), getExplorerData()])
      .then(([i, e]) => { setInsights(i); setExplorer(e); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading) {
      const hash = window.location.hash.slice(1);
      if (hash) {
        setTimeout(() => {
          document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-gray-400">Loading explorer data...</div>
      </div>
    );
  }

  const clustering = insights?.medalCutoffClustering;
  const lastSecond = explorer?.lastSecondFinishers;
  const familyPairs = explorer?.familyPairs;
  const medalRainbow = explorer?.medalRainbow;
  const ironStreaks = explorer?.ironStreaks;
  const decades = explorer?.decadeChampions;
  const novice = explorer?.noviceStats;
  const countryGrowth = explorer?.countryGrowthMap;
  const percentiles = explorer?.percentileData;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Deep Dives</h1>
      <p className="text-gray-500 mb-6">Hidden patterns, remarkable stories, and insights from 100 years of data</p>

      {/* Section nav */}
      <div className="flex flex-wrap gap-2 mb-8">
        {SECTIONS.map(s => (
          <a key={s.id} href={`#${s.id}`} className="px-3 py-1.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700 hover:bg-comrades/10 hover:text-comrades transition-colors">
            {s.label}
          </a>
        ))}
      </div>

      {/* ==================== CHRISTMAS TREE ==================== */}
      <section id="christmas-tree" className="mb-12 scroll-mt-20">
        <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          🎄 The Christmas Tree Effect
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Medal chasing creates dramatic spikes in finisher density just before each cutoff.
          <span className="text-gray-400 ml-1">
            Concept by <a href="https://runningmann.co.za/tag/comrades-stats/" target="_blank" rel="noopener noreferrer" className="text-comrades hover:underline">Stuart Mann / The Running Mann</a>
          </span>
        </p>

        {clustering && (
          <>
            {/* Full distribution chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Finishers per 2-Minute Bucket ({clustering.era})</h3>
              <div className="h-64 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={clustering.distribution} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="time" tick={{ fontSize: 9 }} interval={14} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => [formatNumber(v as number), "Finishers"]} labelFormatter={(l) => `Time: ${l}`} />
                    {/* Reference lines at medal boundaries */}
                    <ReferenceLine x="6:00" stroke="#FFD700" strokeDasharray="3 3" label={{ value: "Gold", fontSize: 9, fill: "#FFD700" }} />
                    <ReferenceLine x="7:30" stroke="#A8A8A8" strokeDasharray="3 3" label={{ value: "Silver", fontSize: 9, fill: "#A8A8A8" }} />
                    <ReferenceLine x="9:00" stroke="#E65100" strokeDasharray="3 3" label={{ value: "Bill Rowan", fontSize: 9, fill: "#E65100" }} />
                    <ReferenceLine x="10:00" stroke="#CD7F32" strokeDasharray="3 3" label={{ value: "Bronze", fontSize: 9, fill: "#CD7F32" }} />
                    <ReferenceLine x="11:00" stroke="#4E342E" strokeDasharray="3 3" label={{ value: "Vic Clapham", fontSize: 9, fill: "#4E342E" }} />
                    <Bar dataKey="count" fill="#1B5E20" radius={[1, 1, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Boundary detail cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {clustering.boundaries
                .filter((b: { boundary: string }) => !b.boundary.includes("DNF"))
                .map((b: { boundary: string; cutoffTime: string; before5: number; after5: number; ratio: number; minuteDetail: { time: string; count: number; isCutoff: boolean }[] }) => (
                <div key={b.boundary} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="text-xs font-semibold text-gray-500 mb-1">{b.boundary}</div>
                  <div className="text-lg font-bold text-gray-900 mb-2">Cutoff: {b.cutoffTime}</div>
                  <div className="flex gap-4 text-sm mb-3">
                    <div>
                      <div className="text-comrades font-bold">{formatNumber(b.before5)}</div>
                      <div className="text-[10px] text-gray-500">5 min before</div>
                    </div>
                    <div>
                      <div className="text-gray-600 font-bold">{formatNumber(b.after5)}</div>
                      <div className="text-[10px] text-gray-500">5 min after</div>
                    </div>
                    <div>
                      <div className="text-amber-600 font-bold">{b.ratio.toFixed(1)}×</div>
                      <div className="text-[10px] text-gray-500">ratio</div>
                    </div>
                  </div>
                  {/* Mini bar chart of minute detail */}
                  <div className="flex items-end gap-px h-12">
                    {b.minuteDetail.map((m: { time: string; count: number; isCutoff: boolean }) => {
                      const maxCount = Math.max(...b.minuteDetail.map((x: { count: number }) => x.count));
                      const h = maxCount > 0 ? (m.count / maxCount) * 100 : 0;
                      return (
                        <div key={m.time} className="flex-1 flex flex-col items-center">
                          <div
                            className={`w-full rounded-t ${m.isCutoff ? "bg-red-500" : "bg-comrades/60"}`}
                            style={{ height: `${h}%` }}
                            title={`${m.time}: ${formatNumber(m.count)} finishers`}
                          />
                          <div className={`text-[7px] mt-0.5 ${m.isCutoff ? "text-red-500 font-bold" : "text-gray-400"}`}>
                            {m.time.split(":").pop()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ==================== LAST SECOND FINISHERS ==================== */}
      <section id="last-second" className="mb-12 scroll-mt-20">
        <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          ⏱️ The Final Countdown
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          How many runners cross the line in the dying seconds? The drama of the 12-hour cutoff.
        </p>

        {lastSecond && lastSecond.length > 0 && (
          <>
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Runners Finishing in Final Minutes (12h Cutoff Era)</h3>
              <div className="h-64 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={lastSecond} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="last15min" name="Last 15 min" fill="#1B5E20" opacity={0.3} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="last5min" name="Last 5 min" fill="#1B5E20" opacity={0.6} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="last60s" name="Last 60 sec" fill="#d32f2f" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Summary stats */}
            {(() => {
              const totals = lastSecond.reduce((acc, y) => ({
                last60: acc.last60 + y.last60s,
                last5: acc.last5 + y.last5min,
                last15: acc.last15 + y.last15min,
                finishers: acc.finishers + y.finishers,
              }), { last60: 0, last5: 0, last15: 0, finishers: 0 });
              const maxYear = lastSecond.reduce((max, y) => y.last60s > max.last60s ? y : max, lastSecond[0]);
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">{formatNumber(totals.last60)}</div>
                    <div className="text-xs text-gray-500">Total in final 60 seconds</div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                    <div className="text-2xl font-bold text-comrades">{formatNumber(totals.last5)}</div>
                    <div className="text-xs text-gray-500">Total in final 5 minutes</div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                    <div className="text-2xl font-bold text-comrades">{(totals.last15 / totals.finishers * 100).toFixed(1)}%</div>
                    <div className="text-xs text-gray-500">Finish in final 15 min</div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                    <div className="text-2xl font-bold text-amber-600">{maxYear.year}</div>
                    <div className="text-xs text-gray-500">Most dramatic ({maxYear.last60s} in 60s)</div>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </section>

      {/* ==================== FAMILY PAIRS ==================== */}
      <section id="family-pairs" className="mb-12 scroll-mt-20">
        <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          👫 Running Together
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Runners with the same surname who crossed the line within 2 seconds of each other — couples, siblings, and families finishing hand-in-hand.
        </p>

        {familyPairs && familyPairs.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50/50">
                    <th className="text-left px-4 py-2">Year</th>
                    <th className="text-left px-4 py-2">Runner 1</th>
                    <th className="text-left px-4 py-2">Runner 2</th>
                    <th className="text-left px-4 py-2">Time</th>
                    <th className="text-left px-4 py-2">Medal</th>
                  </tr>
                </thead>
                <tbody>
                  {familyPairs.slice(familyPage * FAMILY_PER_PAGE, (familyPage + 1) * FAMILY_PER_PAGE).map((p: { year: number; surname: string; diff?: number; runner1: { name: string; athleteId: string; time: string; medal: string }; runner2: { name: string; athleteId: string; time: string; medal: string } }, i: number) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-2">
                        <Link href={`/year?year=${p.year}`} className="text-comrades hover:underline font-medium">{p.year}</Link>
                      </td>
                      <td className="px-4 py-2">
                        <Link href={`/runner?id=${p.runner1.athleteId}`} className="hover:text-comrades transition-colors">
                          {p.runner1.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2">
                        <Link href={`/runner?id=${p.runner2.athleteId}`} className="hover:text-comrades transition-colors">
                          {p.runner2.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2 font-mono text-comrades">
                        {formatTime(p.runner1.time)}
                        {(p.diff ?? 0) > 0 && <span className="text-[10px] text-gray-400 ml-1">(+{p.diff}s)</span>}
                      </td>
                      <td className="px-4 py-2"><MedalBadge medal={p.runner1.medal} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {familyPairs.length > FAMILY_PER_PAGE && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm">
                <span className="text-gray-500">{formatNumber(familyPairs.length)} pairs found</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFamilyPage(p => Math.max(0, p - 1))}
                    disabled={familyPage === 0}
                    className="px-3 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                  >← Prev</button>
                  <button
                    onClick={() => setFamilyPage(p => p + 1)}
                    disabled={(familyPage + 1) * FAMILY_PER_PAGE >= familyPairs.length}
                    className="px-3 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                  >Next →</button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ==================== MEDAL RAINBOW ==================== */}
      <section id="medal-rainbow" className="mb-12 scroll-mt-20">
        <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          🌈 Medal Rainbow
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Athletes who&apos;ve collected the most different medal types across their career. Only one runner has ever earned all medal types.
        </p>

        {medalRainbow && medalRainbow.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50/50">
                    <th className="text-left px-4 py-2 w-8">#</th>
                    <th className="text-left px-4 py-2">Name</th>
                    <th className="text-center px-4 py-2">Types</th>
                    <th className="text-left px-4 py-2">Medals Earned</th>
                    <th className="text-center px-4 py-2">Finishes</th>
                  </tr>
                </thead>
                <tbody>
                  {medalRainbow.slice(0, 25).map((r, i) => (
                    <tr key={r.athleteId} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i === 0 ? "bg-amber-50/50" : ""}`}>
                      <td className="px-4 py-2 text-gray-400 font-medium">{i + 1}</td>
                      <td className="px-4 py-2 font-medium">
                        <Link href={`/runner?id=${r.athleteId}`} className="text-gray-900 hover:text-comrades transition-colors">
                          {r.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-sm ${
                          r.medalTypes >= 6 ? "bg-amber-100 text-amber-800" :
                          r.medalTypes >= 5 ? "bg-purple-100 text-purple-800" :
                          "bg-gray-100 text-gray-700"
                        }`}>{r.medalTypes}</span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {r.medals.map(m => (
                            <MedalBadge key={m} medal={m} />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-center text-gray-600">{r.totalFinishes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ==================== IRON STREAKS ==================== */}
      <section id="iron-streaks" className="mb-12 scroll-mt-20">
        <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          🔗 Iron Streaks
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          The longest consecutive finish streaks — athletes who came back year after year without missing a beat.
        </p>

        {ironStreaks && ironStreaks.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50/50">
                    <th className="text-left px-4 py-2 w-8">#</th>
                    <th className="text-left px-4 py-2">Name</th>
                    <th className="text-center px-4 py-2">Streak</th>
                    <th className="text-left px-4 py-2">Years</th>
                    <th className="text-left px-4 py-2">Best Time</th>
                    <th className="text-left px-4 py-2">Best Medal</th>
                    <th className="text-center px-4 py-2">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {ironStreaks.map((s, i) => (
                    <tr key={s.athleteId} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-2 text-gray-400 font-medium">{i + 1}</td>
                      <td className="px-4 py-2 font-medium">
                        <Link href={`/runner?id=${s.athleteId}`} className="text-gray-900 hover:text-comrades transition-colors">
                          {s.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-comrades/10 text-comrades font-bold text-sm">
                          {s.streak}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-600 text-xs">{s.startYear}–{s.endYear}</td>
                      <td className="px-4 py-2 font-mono text-comrades">{s.bestTime ? formatTime(s.bestTime) : "-"}</td>
                      <td className="px-4 py-2">{s.bestMedal ? <MedalBadge medal={s.bestMedal} /> : "-"}</td>
                      <td className="px-4 py-2 text-center">
                        {s.isActive && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">Active</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ==================== DETERMINATION ==================== */}
      <section id="determination" className="mb-12 scroll-mt-20">
        <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          💪 Determination
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          What happens after the medal slips away? Comrades is the rare race where the people who keep failing — and keep coming back — are part of its soul.
        </p>

        {explorer?.determination && (() => {
          const d = explorer.determination;
          const fad = d.firstAttemptDnf;
          const fdo = d.firstDnfOutcomes;

          // Pie-style stacked bar helper
          const SegmentBar = ({ segments, total }: { segments: { label: string; value: number; color: string }[]; total: number }) => (
            <div>
              <div className="flex w-full h-7 rounded overflow-hidden border border-gray-200">
                {segments.map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center justify-center text-[10px] font-medium text-white"
                    style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
                    title={`${s.label}: ${formatNumber(s.value)} (${((s.value / total) * 100).toFixed(1)}%)`}
                  >
                    {(s.value / total) > 0.06 ? `${((s.value / total) * 100).toFixed(0)}%` : ""}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs">
                {segments.map((s) => (
                  <div key={s.label} className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
                    <span className="text-gray-700 flex-1">{s.label}</span>
                    <span className="font-semibold text-gray-900">{formatNumber(s.value)}</span>
                    <span className="text-gray-400">{((s.value / total) * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          );

          return (
            <div className="space-y-6">
              {/* Top KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                  <div className="text-2xl font-bold text-comrades">{formatNumber(d.totalDnfers)}</div>
                  <div className="text-xs text-gray-500">Athletes with ≥1 DNF</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-600">{formatNumber(d.dnfersLaterB2b)}</div>
                  <div className="text-xs text-gray-500">DNF&apos;d, later went back-to-back</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                  <div className="text-2xl font-bold text-rose-600">{formatNumber(d.multiDnfNoFinish)}</div>
                  <div className="text-xs text-gray-500">2+ DNFs, never finished</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                  <div className="text-2xl font-bold text-amber-600">{d.longestDnfStreaks[0]?.streak ?? 0}</div>
                  <div className="text-xs text-gray-500">Longest consecutive DNF streak</div>
                </div>
              </div>

              {/* First-attempt DNF outcomes */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800">First attempt was a DNF — what happened next?</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Of {formatNumber(fad.total)} runners whose debut Comrades ended in a DNF: 56% came back; 39% eventually crossed a finish line.
                </p>
                <SegmentBar
                  total={fad.total}
                  segments={[
                    { label: "Eventually finished a Comrades", value: fad.eventuallyFinished, color: "#1B5E20" },
                    { label: "Started again, never finished", value: fad.returnedNeverFinished, color: "#E65100" },
                    { label: "Entered again but never started (DNS only)", value: fad.returnedDnsOnly, color: "#A8A8A8" },
                    { label: "Gave up — never entered again", value: fad.gaveUp, color: "#7F1D1D" },
                  ]}
                />
              </div>

              {/* First-DNF outcomes (career-wide) */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800">Outcome after a runner&apos;s very first DNF (any year of career)</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Cohort: every athlete who ever DNF&apos;d ({formatNumber(fdo.cohort)}).
                  Slightly cheerier picture than first-attempts — many runners already had a finish to their name before their first DNF.
                </p>
                <SegmentBar
                  total={fdo.cohort}
                  segments={[
                    { label: "Came back and eventually finished", value: fdo.eventuallyFinished, color: "#1B5E20" },
                    { label: "Returned, started again, never finished", value: fdo.returnedNeverFinished, color: "#E65100" },
                    { label: "Returned but never started (DNS only)", value: fdo.returnedDnsOnly, color: "#A8A8A8" },
                    { label: "Never returned", value: fdo.neverReturned, color: "#7F1D1D" },
                  ]}
                />
              </div>

              {/* Persistence by DNF count */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-1">Persistence pays off</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Share of runners who eventually finished, by how many DNFs they had. The more times they failed and showed up again, the more likely they were to get the medal.
                </p>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={d.persistenceByDnfCount.map((b) => ({
                        label: `${b.minDnfs}+`,
                        persistedPct: b.persistedPct,
                        cohort: b.cohort,
                      }))}
                      margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} label={{ value: "Minimum DNFs", position: "insideBottom", offset: -2, fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <Tooltip
                        formatter={(v, _name, item) => {
                          const payload = item?.payload as { cohort: number } | undefined;
                          const cohort = payload?.cohort ?? 0;
                          return [`${(v as number).toFixed(1)}%  (${formatNumber(cohort)} runners)`, "Eventually finished"];
                        }}
                        labelFormatter={(l) => `${l} DNFs`}
                      />
                      <Bar dataKey="persistedPct" fill="#1B5E20" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Longest consecutive DNF streaks — the persistent triers */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-5 pb-3">
                  <h3 className="text-sm font-semibold text-gray-800">The Persistent — longest consecutive DNF streaks</h3>
                  <p className="text-xs text-gray-500">
                    Year after year, they came back to the start line and didn&apos;t make it. Some eventually crossed the line; some are still trying. Either way, that&apos;s a kind of greatness too.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-y border-gray-100 text-xs text-gray-500 bg-gray-50/50">
                        <th className="text-left px-4 py-2">Runner</th>
                        <th className="text-left px-4 py-2">Years</th>
                        <th className="text-right px-4 py-2">Consecutive DNFs</th>
                        <th className="text-right px-4 py-2">Total DNFs</th>
                        <th className="text-left px-4 py-2">Outcome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.longestDnfStreaks.slice(0, 15).map((r) => (
                        <tr key={r.athleteId} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-4 py-2">
                            <Link href={`/runner?id=${r.athleteId}`} className="hover:text-comrades transition-colors font-medium">
                              {r.name}
                            </Link>
                          </td>
                          <td className="px-4 py-2 text-gray-500">{r.streakStart}–{r.streakEnd}</td>
                          <td className="px-4 py-2 text-right font-mono font-bold text-comrades">{r.streak}</td>
                          <td className="px-4 py-2 text-right font-mono text-gray-600">{r.totalDnfs}</td>
                          <td className="px-4 py-2">
                            {r.finallyFinished ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                ✓ Eventually finished
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                                Still trying / never finished
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Two columns: triumph and tribute */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top persisters who eventually finished */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="p-5 pb-3 bg-emerald-50/40">
                    <h3 className="text-sm font-semibold text-gray-800">🏆 Triumph after years of failure</h3>
                    <p className="text-xs text-gray-500">Most DNFs before a first Comrades finish.</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-y border-gray-100 text-xs text-gray-500 bg-gray-50/50">
                        <th className="text-left px-4 py-2">Runner</th>
                        <th className="text-right px-4 py-2">DNFs</th>
                        <th className="text-right px-4 py-2">Finished</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.topPersisters.slice(0, 10).map((r) => (
                        <tr key={r.athleteId} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-4 py-2">
                            <Link href={`/runner?id=${r.athleteId}`} className="hover:text-comrades transition-colors font-medium">
                              {r.name}
                            </Link>
                          </td>
                          <td className="px-4 py-2 text-right font-mono font-bold text-comrades">{r.dnfs}</td>
                          <td className="px-4 py-2 text-right">
                            <Link href={`/year?year=${r.firstFinishYear}`} className="text-emerald-700 hover:underline font-mono">
                              {r.firstFinishYear}
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Tribute to those still trying */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="p-5 pb-3 bg-amber-50/40">
                    <h3 className="text-sm font-semibold text-gray-800">🫶 Still showing up</h3>
                    <p className="text-xs text-gray-500">Runners with the most DNFs and not (yet) a finish. They start every year anyway.</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-y border-gray-100 text-xs text-gray-500 bg-gray-50/50">
                        <th className="text-left px-4 py-2">Runner</th>
                        <th className="text-right px-4 py-2">DNFs</th>
                        <th className="text-right px-4 py-2">Years</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.topNeverFinishers.slice(0, 10).map((r) => (
                        <tr key={r.athleteId} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-4 py-2">
                            <Link href={`/runner?id=${r.athleteId}`} className="hover:text-comrades transition-colors font-medium">
                              {r.name}
                            </Link>
                          </td>
                          <td className="px-4 py-2 text-right font-mono font-bold text-comrades">{r.dnfs}</td>
                          <td className="px-4 py-2 text-right text-gray-500 text-xs">{r.firstYear}–{r.lastYear}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-xs text-gray-400 italic">
                DNF reporting is reliable from 1985 onward; earlier years recorded DNFs only sporadically.
              </p>
            </div>
          );
        })()}
      </section>

      {/* ==================== DECADE CHAMPIONS ==================== */}
      <section id="decade-champions" className="mb-12 scroll-mt-20">
        <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          👑 Decade Champions
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          The dominant runners of each era — from Arthur Newton in the 1920s to Tete Dijana today.
        </p>

        {decades && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Men */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-blue-50/50">
                <h3 className="text-sm font-semibold text-gray-700">Men</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {decades.men.filter(d => d.wins >= 2).map(d => (
                  <div key={d.decade} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-mono text-gray-400 mr-2">{d.decade}</span>
                      <Link href={`/runner?id=${d.athleteId}`} className="font-medium text-gray-900 hover:text-comrades transition-colors">
                        {d.name}
                      </Link>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{d.years.join(", ")}</span>
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-comrades/10 text-comrades font-bold text-xs">
                        {d.wins}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Women */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-pink-50/50">
                <h3 className="text-sm font-semibold text-gray-700">Women</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {decades.women.filter(d => d.wins >= 2).map(d => (
                  <div key={d.decade} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-mono text-gray-400 mr-2">{d.decade}</span>
                      <Link href={`/runner?id=${d.athleteId}`} className="font-medium text-gray-900 hover:text-comrades transition-colors">
                        {d.name}
                      </Link>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{d.years.join(", ")}</span>
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-comrades/10 text-comrades font-bold text-xs">
                        {d.wins}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ==================== NOVICE GUIDE ==================== */}
      <section id="novice" className="mb-12 scroll-mt-20">
        <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          🎓 First-Timer Guide
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          What to expect on your first Comrades, based on decades of first-timer data.
        </p>

        {novice && novice.length > 0 && (
          <>
            {/* Percentile table */}
            {percentiles && percentiles.length > 0 && (
              <div className="bg-gradient-to-r from-comrades/5 to-amber-50 rounded-xl border border-gray-200 p-5 mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Where Would Your Time Rank? (All-Time Percentiles)</h3>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {percentiles.map(p => (
                    <div key={p.percentile} className="bg-white/70 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-comrades">{formatTime(p.time)}</div>
                      <div className="text-[10px] text-gray-500">Top {p.percentile}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">First-Timer Performance by Decade</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500">
                      <th className="text-left px-3 py-2">Decade</th>
                      <th className="text-right px-3 py-2">First-Timers</th>
                      <th className="text-right px-3 py-2">Avg Time</th>
                      <th className="text-right px-3 py-2">Median</th>
                      <th className="text-right px-3 py-2">DNF Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {novice.map(n => {
                      const avgH = Math.floor(n.avgTime / 3600);
                      const avgM = Math.floor((n.avgTime % 3600) / 60);
                      const medH = Math.floor(n.medianTime / 3600);
                      const medM = Math.floor((n.medianTime % 3600) / 60);
                      return (
                        <tr key={n.decade} className="border-b border-gray-50">
                          <td className="px-3 py-2 font-medium">{n.decade}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{formatNumber(n.count)}</td>
                          <td className="px-3 py-2 text-right font-mono text-comrades">{avgH}:{String(avgM).padStart(2, "0")}</td>
                          <td className="px-3 py-2 text-right font-mono text-gray-600">{medH}:{String(medM).padStart(2, "0")}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{(n.dnfRate * 100).toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ==================== COUNTRY GROWTH MAP ==================== */}
      <section id="country-map" className="mb-12 scroll-mt-20">
        <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          🌍 Going Global
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          From a local South African race to a global phenomenon — how international participation has grown decade by decade.
        </p>

        {countryGrowth && countryGrowth.length > 0 && (
          <>
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">International Participation Growth</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={countryGrowth} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="decade" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="countries" name="Countries" fill="#1B5E20" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="internationalRunners" name="International Runners" fill="#F57C00" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {countryGrowth.map(d => (
                <div key={d.decade} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="text-lg font-bold text-gray-900 mb-1">{d.decade}</div>
                  <div className="text-sm text-gray-500 mb-2">{d.countries} countries · {formatNumber(d.internationalRunners)} international runners</div>
                  <div className="flex flex-wrap gap-1">
                    {d.topCountries.slice(0, 5).map(c => (
                      <span key={c.country} className="text-[10px] px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
                        {c.country} ({c.runners})
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto px-4 py-12 text-center text-gray-400">Loading...</div>}>
      <ExploreContent />
    </Suspense>
  );
}
