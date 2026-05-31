"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { getRecords, formatTime, formatNumber, slugifyCountry } from "@/lib/data";
import type { RecordsData } from "@/lib/types";
import RecordBadges from "@/components/RecordBadges";

const SECTIONS = [
  { id: "wally", label: "Wally Hayward" },
  { id: "winners", label: "Most Wins" },
  { id: "dominance", label: "Country Dominance" },
  { id: "heroic", label: "Heroic Seconds" },
  { id: "womenvsmen", label: "Women vs Men" },
  { id: "uncanny", label: "Uncanny Doubles" },
  { id: "margins", label: "Closest Finishes" },
  { id: "streaks", label: "Iron Streaks" },
  { id: "careers", label: "Career Spans" },
  { id: "comebacks", label: "Comebacks" },
  { id: "podiums", label: "Podium Kings" },
  { id: "improved", label: "Most Improved" },
  { id: "persistence", label: "Persistence" },
  { id: "nevergaveup", label: "Never Gave Up" },
  { id: "pioneers", label: "Women Pioneers" },
  { id: "countries", label: "Rare Nations" },
  { id: "growth", label: "Race Growth" },
];

function SectionHeader({ id, title, subtitle }: { id: string; title: string; subtitle: string }) {
  return (
    <div id={id} className="scroll-mt-20">
      <h2 className="text-xl font-bold text-gray-900 mb-1">{title}</h2>
      <p className="text-sm text-gray-500 mb-4">{subtitle}</p>
    </div>
  );
}

function StoryCard({ children, accent = "comrades" }: { children: React.ReactNode; accent?: string }) {
  const borderClass = accent === "gold" ? "border-l-yellow-500" :
    accent === "blue" ? "border-l-blue-500" :
    accent === "purple" ? "border-l-purple-500" :
    accent === "emerald" ? "border-l-emerald-500" :
    accent === "orange" ? "border-l-orange-500" :
    accent === "rose" ? "border-l-rose-500" :
    "border-l-[#1B5E20]";
  return (
    <div className={`bg-white rounded-lg border border-gray-200 border-l-4 ${borderClass} p-5 shadow-sm`}>
      {children}
    </div>
  );
}

function PosBadge({ pos }: { pos: number }) {
  const bg = pos === 1 ? "bg-yellow-100 text-yellow-800" :
    pos === 2 ? "bg-gray-100 text-gray-700" :
    pos === 3 ? "bg-amber-100 text-amber-800" :
    "bg-blue-50 text-blue-700";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ${bg}`}>
      {pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : `#${pos}`}
    </span>
  );
}

function RunnerLink({ name, athleteId }: { name: string; athleteId: string }) {
  return (
    <Link href={`/runner?id=${athleteId}`} className="text-comrades hover:underline font-medium">
      {name}
    </Link>
  );
}

function formatMargin(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (s === 0) return `${m} minute${m !== 1 ? "s" : ""}`;
  return `${m}m ${s}s`;
}

function formatImprovement(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m} minutes`;
  return `${h}h ${m}m`;
}

export default function RecordsPage() {
  const [data, setData] = useState<RecordsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRecords().then((d) => { setData(d); setLoading(false); });
  }, []);

  // Scroll to hash anchor after content loads (browser fires too early on async pages)
  useEffect(() => {
    if (!loading && data && window.location.hash) {
      const id = window.location.hash.slice(1);
      const el = document.getElementById(id);
      if (el) {
        // Small delay to ensure layout is complete
        setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 100);
      }
    }
  }, [loading, data]);

  if (loading || !data) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-200 rounded w-96" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
            {[...Array(6)].map((_, i) => <div key={i} className="h-48 bg-gray-100 rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  const wally = data.wallyHayward;
  const firstWin = wally.find(r => r.pos === "1");
  const lastRace = wally[wally.length - 1];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Records & Stories</h1>
        <p className="text-gray-500">
          A century of extraordinary human achievement — the stories behind the numbers
        </p>
      </div>

      {/* Section nav */}
      <div className="flex flex-wrap gap-2 mb-10 pb-4 border-b border-gray-200">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="px-3 py-1.5 text-xs font-medium rounded-full border border-gray-200 text-gray-600 hover:bg-comrades/10 hover:text-comrades hover:border-comrades/30 transition-colors"
          >
            {s.label}
          </a>
        ))}
      </div>

      <div className="space-y-12">
        {/* ============================================================ */}
        {/* WALLY HAYWARD */}
        {/* ============================================================ */}
        <section>
          <SectionHeader
            id="wally"
            title="🏆 The Legend of Wally Hayward"
            subtitle="Won in 1930, returned 20 years later, and won four more times"
          />
          <StoryCard accent="gold">
            <div className="space-y-4">
              <p className="text-gray-700 leading-relaxed">
                Wally Hayward first won the Comrades Marathon in <strong>1930</strong> with a
                time of {formatTime(wally[0]?.time || "")}. He then disappeared from the race for
                {" "}<strong>20 years</strong> — through the Great Depression, World War II, and
                the dawn of the apartheid era. When he returned in <strong>1950</strong>, he
                didn&apos;t just finish — he <em>won again</em>, an astonishing 1 hour 35 minutes
                faster than his first victory. He went on to win three more times, setting a
                course record of {formatTime("05:52:30")} in 1953 at the age of 44.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Even more remarkably, Hayward returned to race at age <strong>79</strong> in 1988
                and <strong>80</strong> in 1989, earning Bronze medals both times. His career
                spans <strong>59 years</strong> of Comrades history.
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="py-2 pr-4">Year</th>
                      <th className="py-2 pr-4">Position</th>
                      <th className="py-2 pr-4">Time</th>
                      <th className="py-2 pr-4">Medal</th>
                      <th className="py-2">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wally.map((r, i) => {
                      const gap = i > 0 ? r.year - wally[i-1].year : 0;
                      return [
                        gap > 2 && (
                          <tr key={`gap-${r.year}`}>
                            <td colSpan={5} className="py-1 text-center text-xs text-gray-400 italic">
                              — {gap} year gap —
                            </td>
                          </tr>
                        ),
                        <tr key={r.year} className="border-b border-gray-100">
                          <td className="py-2 pr-4 font-medium">{r.year}</td>
                          <td className="py-2 pr-4">
                            {r.pos === "1" ? <PosBadge pos={1} /> :
                              <span className="text-gray-500">#{formatNumber(parseInt(r.pos))}</span>}
                          </td>
                          <td className="py-2 pr-4 font-mono text-sm">{formatTime(r.time)}</td>
                          <td className="py-2 pr-4">{r.medal}</td>
                          <td className="py-2 text-gray-500">{r.category}</td>
                        </tr>
                      ];
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </StoryCard>
        </section>

        {/* ============================================================ */}
        {/* REPEAT WINNERS */}
        {/* ============================================================ */}
        <section>
          <SectionHeader
            id="winners"
            title="👑 Most Race Wins"
            subtitle="The athletes who dominated across eras"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.repeatWinners.slice(0, 10).map((w) => (
              <StoryCard key={w.athleteId} accent={w.wins >= 8 ? "gold" : w.wins >= 5 ? "purple" : "blue"}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <RunnerLink name={w.name} athleteId={w.athleteId} />
                    <div className="text-xs text-gray-500 mt-0.5">
                      {[w.country, w.gender === "F" ? "Women's" : ""].filter(Boolean).join(" · ") || ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-comrades">{w.wins}</div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wide">wins</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {w.years.map((y, i) => (
                    <span key={y} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-50 text-yellow-800 text-xs font-medium">
                      🏆 {y}
                      {i > 0 && w.years[i] - w.years[i-1] > 5 && (
                        <span className="text-[9px] text-yellow-600">({w.years[i] - w.years[i-1]}yr gap)</span>
                      )}
                    </span>
                  ))}
                </div>
                {w.span > 10 && (
                  <div className="mt-2 text-xs text-gray-500">
                    Winning span: {w.span} years ({w.years[0]}–{w.years[w.years.length - 1]})
                  </div>
                )}
              </StoryCard>
            ))}
          </div>
        </section>

        {/* ============================================================ */}
        {/* COUNTRY DOMINANCE */}
        {/* ============================================================ */}
        {data.countryDominance && (
          <section>
            <SectionHeader
              id="dominance"
              title="🌍 Country Dominance"
              subtitle="Which nations have owned the Comrades Marathon"
            />

            {/* SA dominance headline */}
            <StoryCard accent="gold">
              <p className="text-gray-700 mb-4 leading-relaxed">
                The Comrades Marathon has been overwhelmingly a <strong>South African story</strong>.
                SA athletes have won the men&apos;s race <strong>{data.countryDominance.menWinsByCountry.find(c => c.country === "South Africa")?.wins || 0} times</strong> and
                the women&apos;s race <strong>{data.countryDominance.womenWinsByCountry.find(c => c.country === "South Africa")?.wins || 0} times</strong>.
                {data.countryDominance.firstForeignMen && (
                  <> The first non-South African men&apos;s winner didn&apos;t arrive until <strong>{data.countryDominance.firstForeignMen.year}</strong> —{" "}
                  <Link href={`/runner?id=${data.countryDominance.firstForeignMen.athleteId}`} className="text-comrades hover:underline font-semibold">
                    {data.countryDominance.firstForeignMen.name}
                  </Link> from {data.countryDominance.firstForeignMen.country}, some 52 years after the race began.</>
                )}
              </p>

              {/* Wins by country - men and women side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Men&apos;s Wins by Country</h4>
                  <div className="space-y-1.5">
                    {data.countryDominance.menWinsByCountry.map((c) => {
                      const maxWins = data.countryDominance.menWinsByCountry[0]?.wins || 1;
                      return (
                        <div key={c.country} className="flex items-center gap-2">
                          <Link
                            href={`/country?name=${slugifyCountry(c.country)}`}
                            className="text-xs text-gray-700 hover:text-comrades w-28 truncate shrink-0"
                          >
                            {c.country}
                          </Link>
                          <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                            <div
                              className="bg-[#1B5E20]/70 h-full rounded-full transition-all"
                              style={{ width: `${Math.max((c.wins / maxWins) * 100, 2)}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-gray-600 w-8 text-right">{c.wins}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Women&apos;s Wins by Country</h4>
                  <div className="space-y-1.5">
                    {data.countryDominance.womenWinsByCountry.map((c) => {
                      const maxWins = data.countryDominance.womenWinsByCountry[0]?.wins || 1;
                      return (
                        <div key={c.country} className="flex items-center gap-2">
                          <Link
                            href={`/country?name=${slugifyCountry(c.country)}`}
                            className="text-xs text-gray-700 hover:text-comrades w-28 truncate shrink-0"
                          >
                            {c.country}
                          </Link>
                          <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                            <div
                              className="bg-pink-500/60 h-full rounded-full transition-all"
                              style={{ width: `${Math.max((c.wins / maxWins) * 100, 2)}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-gray-600 w-8 text-right">{c.wins}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </StoryCard>

            {/* Winning Streaks */}
            <div className="mt-4 space-y-4">
              <h3 className="text-base font-bold text-gray-900">Winning Streaks</h3>

              {/* Men's streaks */}
              <StoryCard accent="blue">
                <h4 className="text-sm font-semibold text-gray-800 mb-3">♂ Men&apos;s Consecutive Wins by Country</h4>
                <div className="space-y-3">
                  {data.countryDominance.menStreaks.map((s, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                        s.country === "South Africa" ? "bg-[#1B5E20]" :
                        s.country === "Russia" ? "bg-red-600" :
                        s.country === "Zimbabwe" ? "bg-yellow-600" :
                        "bg-gray-600"
                      }`}>
                        {s.length}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/country?name=${slugifyCountry(s.country)}`}
                            className="font-semibold text-gray-900 hover:text-comrades text-sm"
                          >
                            {s.country}
                          </Link>
                          <span className="text-xs text-gray-400">{s.startYear}–{s.endYear}</span>
                          <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">
                            {s.length} consecutive wins
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {s.athletes.slice(0, 5).map((a, j) => (
                            <span key={a.athleteId}>
                              {j > 0 && ", "}
                              <Link href={`/runner?id=${a.athleteId}`} className="hover:text-comrades">{a.name}</Link>
                            </span>
                          ))}
                          {s.athletes.length > 5 && <span className="text-gray-400"> +{s.athletes.length - 5} more</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </StoryCard>

              {/* Women's streaks */}
              <StoryCard accent="rose">
                <h4 className="text-sm font-semibold text-gray-800 mb-3">♀ Women&apos;s Consecutive Wins by Country</h4>
                <div className="space-y-3">
                  {data.countryDominance.womenStreaks.map((s, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                        s.country === "South Africa" ? "bg-[#1B5E20]" :
                        s.country === "Russia" ? "bg-red-600" :
                        s.country === "United States" ? "bg-blue-700" :
                        s.country === "Germany" ? "bg-gray-800" :
                        "bg-gray-600"
                      }`}>
                        {s.length}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/country?name=${slugifyCountry(s.country)}`}
                            className="font-semibold text-gray-900 hover:text-comrades text-sm"
                          >
                            {s.country}
                          </Link>
                          <span className="text-xs text-gray-400">{s.startYear}–{s.endYear}</span>
                          <span className="text-xs px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded">
                            {s.length} consecutive wins
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {s.athletes.slice(0, 5).map((a, j) => (
                            <span key={a.athleteId}>
                              {j > 0 && ", "}
                              <Link href={`/runner?id=${a.athleteId}`} className="hover:text-comrades">{a.name}</Link>
                            </span>
                          ))}
                          {s.athletes.length > 5 && <span className="text-gray-400"> +{s.athletes.length - 5} more</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </StoryCard>

              {/* Podium Sweeps */}
              {(() => {
                const nonSaMenSweeps = data.countryDominance.menSweeps.filter(s => s.country !== "South Africa");
                const nonSaWomenSweeps = data.countryDominance.womenSweeps.filter(s => s.country !== "South Africa");
                const saMenSweepCount = data.countryDominance.menSweeps.filter(s => s.country === "South Africa").length;
                const saWomenSweepCount = data.countryDominance.womenSweeps.filter(s => s.country === "South Africa").length;
                return (
                  <StoryCard accent="purple">
                    <h4 className="text-sm font-semibold text-gray-800 mb-2">Podium Sweeps — All Top 3 from One Country</h4>
                    <p className="text-gray-600 text-sm mb-3 leading-relaxed">
                      South Africa has swept the men&apos;s podium an astonishing <strong>{saMenSweepCount} times</strong> and
                      the women&apos;s podium <strong>{saWomenSweepCount} times</strong>.
                      No other country has ever swept the men&apos;s podium — but Russia matched the feat on the women&apos;s
                      side <strong>{nonSaWomenSweeps.length} times</strong>, all powered by the Nurgalieva sisters and their compatriots.
                    </p>
                    {nonSaWomenSweeps.length > 0 && (
                      <div className="mb-3">
                        <h5 className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-2">
                          Non-SA Women&apos;s Podium Sweeps
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {nonSaWomenSweeps.map((s) => (
                            <div key={s.year} className="bg-purple-50 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1.5">
                                <Link href={`/year?year=${s.year}`} className="font-bold text-purple-800 hover:underline">{s.year}</Link>
                                <span className="text-xs text-purple-600">
                                  <Link href={`/country?name=${slugifyCountry(s.country)}`} className="hover:underline">{s.country}</Link>
                                </span>
                              </div>
                              <div className="text-xs text-gray-600 space-y-0.5">
                                {s.athletes.map((a) => (
                                  <div key={a.athleteId} className="flex items-center gap-1.5">
                                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                      a.pos === 1 ? "bg-yellow-200 text-yellow-800" :
                                      a.pos === 2 ? "bg-gray-200 text-gray-700" :
                                      "bg-amber-200 text-amber-800"
                                    }`}>{a.pos}</span>
                                    <Link href={`/runner?id=${a.athleteId}`} className="hover:text-comrades">{a.name}</Link>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {nonSaMenSweeps.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">
                          Non-SA Men&apos;s Podium Sweeps
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {nonSaMenSweeps.map((s) => (
                            <div key={s.year} className="bg-blue-50 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1.5">
                                <Link href={`/year?year=${s.year}`} className="font-bold text-blue-800 hover:underline">{s.year}</Link>
                                <span className="text-xs text-blue-600">
                                  <Link href={`/country?name=${slugifyCountry(s.country)}`} className="hover:underline">{s.country}</Link>
                                </span>
                              </div>
                              <div className="text-xs text-gray-600 space-y-0.5">
                                {s.athletes.map((a) => (
                                  <div key={a.athleteId} className="flex items-center gap-1.5">
                                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                      a.pos === 1 ? "bg-yellow-200 text-yellow-800" :
                                      a.pos === 2 ? "bg-gray-200 text-gray-700" :
                                      "bg-amber-200 text-amber-800"
                                    }`}>{a.pos}</span>
                                    <Link href={`/runner?id=${a.athleteId}`} className="hover:text-comrades">{a.name}</Link>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </StoryCard>
                );
              })()}

              {/* Winner Timeline */}
              <StoryCard>
                <h4 className="text-sm font-semibold text-gray-800 mb-2">Winner Timeline</h4>
                <p className="text-xs text-gray-500 mb-3">Click any year to view that race. Coloured cells = non-South African winner.</p>
                <div className="overflow-x-auto">
                  {(() => {
                    const tl = data.countryDominance.winnerTimeline;
                    // Group into decades
                    const decades: Record<string, typeof tl> = {};
                    for (const e of tl) {
                      const dec = `${Math.floor(e.year / 10) * 10}s`;
                      if (!decades[dec]) decades[dec] = [];
                      decades[dec].push(e);
                    }
                    const countryColor = (c?: string) => {
                      if (!c) return "bg-gray-100 text-gray-300";
                      if (c === "South Africa") return "bg-[#1B5E20]/15 text-[#1B5E20]";
                      if (c === "Russia") return "bg-red-100 text-red-700 font-semibold";
                      if (c === "Zimbabwe") return "bg-yellow-100 text-yellow-700 font-semibold";
                      if (c === "New Zealand") return "bg-gray-800 text-white font-semibold";
                      if (c === "Germany") return "bg-gray-200 text-gray-800 font-semibold";
                      if (c === "Poland") return "bg-red-50 text-red-600 font-semibold";
                      if (c === "United States") return "bg-blue-100 text-blue-700 font-semibold";
                      if (c === "Netherlands") return "bg-orange-100 text-orange-700 font-semibold";
                      if (c === "United Kingdom") return "bg-blue-200 text-blue-800 font-semibold";
                      return "bg-purple-100 text-purple-700 font-semibold";
                    };
                    const countryAbbr = (c?: string) => {
                      if (!c) return "";
                      if (c === "South Africa") return "SA";
                      if (c === "Russia") return "RUS";
                      if (c === "Zimbabwe") return "ZIM";
                      if (c === "New Zealand") return "NZ";
                      if (c === "Germany") return "GER";
                      if (c === "Poland") return "POL";
                      if (c === "United States") return "USA";
                      if (c === "Netherlands") return "NED";
                      if (c === "United Kingdom") return "GBR";
                      return c.slice(0, 3).toUpperCase();
                    };
                    return (
                      <table className="w-full text-[11px] border-collapse">
                        <thead>
                          <tr>
                            <th className="text-left text-xs text-gray-500 pr-2 py-1 w-14">Decade</th>
                            <th className="text-left text-[10px] text-gray-400 py-1" colSpan={2}>Winners by year (coloured = foreign winner)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(decades).map(([dec, entries]) => (
                            <tr key={dec} className="border-t border-gray-100">
                              <td className="text-xs font-semibold text-gray-500 pr-2 py-2 align-top whitespace-nowrap">{dec}</td>
                              <td className="py-2" colSpan={2}>
                                <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(entries.length, 10)}, minmax(0, 1fr))` }}>
                                  {entries.map((e) => {
                                    const isForeignMen = e.menCountry && e.menCountry !== "South Africa";
                                    const isForeignWomen = e.womenCountry && e.womenCountry !== "South Africa";
                                    return (
                                      <Link
                                        key={e.year}
                                        href={`/year?year=${e.year}`}
                                        className="block rounded overflow-hidden border border-gray-100 hover:border-comrades hover:shadow transition-all"
                                        title={`${e.year}${e.menWinner ? `\n♂ ${e.menWinner} (${e.menCountry})` : ""}${e.womenWinner ? `\n♀ ${e.womenWinner} (${e.womenCountry})` : ""}`}
                                      >
                                        <div className="text-center text-[10px] text-gray-500 bg-gray-50 py-0.5 font-medium border-b border-gray-100">
                                          {String(e.year).slice(-2)}
                                        </div>
                                        <div className={`text-center py-1 text-[9px] leading-tight ${countryColor(e.menCountry)}`}>
                                          {isForeignMen ? countryAbbr(e.menCountry) : e.menCountry ? "♂" : "—"}
                                        </div>
                                        {e.womenCountry !== undefined && (
                                          <div className={`text-center py-1 text-[9px] leading-tight border-t border-gray-100/50 ${countryColor(e.womenCountry)}`}>
                                            {isForeignWomen ? countryAbbr(e.womenCountry) : e.womenCountry ? "♀" : "—"}
                                          </div>
                                        )}
                                      </Link>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-3 mt-3 text-[10px] text-gray-500 flex-wrap border-t border-gray-100 pt-2">
                  <span>Top = Men, Bottom = Women</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#1B5E20]/15 inline-block border" /> SA</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-100 inline-block border border-red-200" /> Russia</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-100 inline-block border border-yellow-200" /> Zimbabwe</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-100 inline-block border border-orange-200" /> Netherlands</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-200 inline-block border" /> Germany</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-100 inline-block border border-blue-200" /> USA</span>
                </div>
              </StoryCard>
            </div>
          </section>
        )}

        {/* ============================================================ */}
        {/* HEROIC SECOND PLACES */}
        {/* ============================================================ */}
        {data.heroicSeconds && data.heroicSeconds.length > 0 && (
          <section>
            <SectionHeader
              id="heroic"
              title="🥈 Record-Breaking Second Places"
              subtitle="They broke the record too — but still lost"
            />
            <StoryCard accent="purple">
              <p className="text-gray-700 mb-4 leading-relaxed">
                Imagine running faster than any human in history over this distance — and <em>still losing</em>.
                These runners-up broke the previous course or direction record with their times, only to
                find the winner had gone even faster. A rare and bittersweet feat in Comrades history.
              </p>
              <div className="space-y-4">
                {data.heroicSeconds.map((h) => (
                  <div key={`${h.year}-${h.gender}`} className="p-4 bg-gradient-to-r from-purple-50 to-white rounded-lg border border-purple-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Link href={`/year?year=${h.year}`} className="text-lg font-bold text-comrades hover:underline">
                        {h.year}
                      </Link>
                      {h.direction && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          h.direction === "Down" ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"
                        }`}>
                          {h.direction === "Down" ? "↓" : "↑"} {h.direction}
                        </span>
                      )}
                      <RecordBadges records={[h.recordType]} />
                      {h.gender === "F" && (
                        <span className="text-[10px] bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded font-medium">Women&apos;s</span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-100">
                        <div className="text-[10px] text-yellow-700 uppercase tracking-wide font-medium mb-1">🥇 Winner</div>
                        <div className="font-semibold">
                          <RunnerLink name={h.winner} athleteId={h.winnerAthleteId} />
                        </div>
                        <div className="font-mono text-comrades font-bold">{formatTime(h.winnerTime)}</div>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                        <div className="text-[10px] text-purple-700 uppercase tracking-wide font-medium mb-1">🥈 Runner-up <span className="text-purple-500">(also beat old record)</span></div>
                        <div className="font-semibold">
                          <RunnerLink name={h.runnerUp} athleteId={h.runnerUpAthleteId} />
                        </div>
                        <div className="font-mono font-bold text-purple-700">{formatTime(h.runnerUpTime)}</div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      Previous record: <span className="font-mono">{formatTime(h.previousRecord)}</span> by {h.previousHolder} ({h.previousYear})
                      {" · "}Margin: <span className="font-medium">{formatMargin(h.marginSeconds)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </StoryCard>
          </section>
        )}

        {/* ============================================================ */}
        {/* WOMEN VS HISTORICAL MEN */}
        {/* ============================================================ */}
        {data.womenVsHistoricalMen && data.womenVsHistoricalMen.length > 0 && (
          <section>
            <SectionHeader
              id="womenvsmen"
              title="♀→♂ Women Faster Than History's Men"
              subtitle="When women's winning times surpassed men's champions of years past"
            />
            <StoryCard accent="rose">
              <p className="text-gray-700 mb-4 leading-relaxed">
                The narrowing of the gender gap at Comrades is best illustrated by these moments: women&apos;s
                winning times that would have beaten the men&apos;s winner in earlier years. This is not about
                a head-to-head comparison in the same year — it&apos;s about how far women&apos;s elite performance
                has come, measured against the full arc of Comrades history.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="py-2 pr-4">Year</th>
                      <th className="py-2 pr-4">Women&apos;s Winner</th>
                      <th className="py-2 pr-4">Time</th>
                      <th className="py-2 pr-4">Faster than men&apos;s winner in</th>
                      <th className="py-2 pr-4">Men&apos;s Winner</th>
                      <th className="py-2">Men&apos;s Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.womenVsHistoricalMen.map((w) => (
                      <tr key={w.year} className="border-b border-gray-100 hover:bg-pink-50/30 transition-colors">
                        <td className="py-2 pr-4">
                          <Link href={`/year?year=${w.year}`} className="text-comrades hover:underline font-medium">
                            {w.year}
                          </Link>
                          {w.direction && (
                            <span className={`ml-1 text-[10px] ${w.direction === "Down" ? "text-blue-500" : "text-red-500"}`}>
                              {w.direction === "Down" ? "↓" : "↑"}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4 font-medium text-pink-700">{w.womenWinner}</td>
                        <td className="py-2 pr-4 font-mono font-bold text-pink-700">{formatTime(w.womenTime)}</td>
                        <td className="py-2 pr-4">
                          <Link href={`/year?year=${w.beatenMenYear}`} className="text-comrades hover:underline">
                            {w.beatenMenYear}
                          </Link>
                        </td>
                        <td className="py-2 pr-4 text-gray-600">{w.beatenMenWinner}</td>
                        <td className="py-2 font-mono text-gray-500">{formatTime(w.beatenMenTime)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.womenVsHistoricalMen.length > 0 && (
                <div className="mt-4 p-3 bg-pink-50 rounded-lg text-sm text-pink-800">
                  <strong>Latest:</strong> In {data.womenVsHistoricalMen[data.womenVsHistoricalMen.length - 1].year},{" "}
                  {data.womenVsHistoricalMen[data.womenVsHistoricalMen.length - 1].womenWinner}&apos;s{" "}
                  {formatTime(data.womenVsHistoricalMen[data.womenVsHistoricalMen.length - 1].womenTime)} was faster
                  than the men&apos;s winner as recently as{" "}
                  {data.womenVsHistoricalMen[data.womenVsHistoricalMen.length - 1].beatenMenYear}.
                </div>
              )}
            </StoryCard>
          </section>
        )}

        {/* ============================================================ */}
        {/* UNCANNY DOUBLES */}
        {/* ============================================================ */}
        {data.uncannyDoubles && data.uncannyDoubles.length > 0 && (() => {
          const exact = data.uncannyDoubles.filter(d => d.diffSeconds === 0);
          const near = data.uncannyDoubles.filter(d => d.diffSeconds > 0 && d.diffSeconds <= 3);
          // Show sub-7h near misses to keep it focused
          const nearElite = near.filter(d => {
            const parts = d.time1.split(':');
            return parts.length === 3 && parseInt(parts[0]) < 7;
          });
          return (
          <section>
            <SectionHeader
              id="uncanny"
              title="≡ Uncanny Doubles"
              subtitle="Same athlete, (nearly) identical times across different years"
            />
            <StoryCard accent="purple">
              <p className="text-gray-700 mb-4 leading-relaxed">
                Over 90 kilometres of hills, weather, and the chaos of race day, finishing with
                the same time — to the second — in a different year is almost beyond belief. Yet it
                has happened. Bruce Fordyce won both the 1985 and 1987 Comrades in{" "}
                <strong>{formatTime("05:37:01")}</strong> — both Up runs, two years apart, identical
                to the second. And Claude Moshiywa posted <strong>{formatTime("05:50:18")}</strong> in
                2006 and <strong>{formatTime("05:50:19")}</strong> in 2022 — one second apart across{" "}
                <em>sixteen years</em>.
              </p>

              {/* Exact matches */}
              <h4 className="text-sm font-semibold text-gray-700 mb-2 mt-2">Identical Times ({exact.length} pairs)</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="py-2 pr-3">Runner</th>
                      <th className="py-2 pr-3">Year</th>
                      <th className="py-2 pr-3">Time</th>
                      <th className="py-2 pr-3">Pos</th>
                      <th className="py-2 pr-3">Year</th>
                      <th className="py-2 pr-3">Time</th>
                      <th className="py-2 pr-3">Pos</th>
                      <th className="py-2 pr-3 text-right">Diff</th>
                      <th className="py-2 text-right">Gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exact.map((d, i) => (
                      <tr key={i} className={`border-b border-gray-100 ${d.diffSeconds === 0 ? "bg-purple-50/50" : ""}`}>
                        <td className="py-2 pr-3">
                          <RunnerLink name={d.name} athleteId={d.athleteId} />
                        </td>
                        <td className="py-2 pr-3">
                          <Link href={`/year?year=${d.year1}`} className="text-comrades hover:underline">
                            {d.year1}
                          </Link>
                          {d.dir1 && (
                            <span className={`ml-1 text-[10px] ${d.dir1 === "Down" ? "text-blue-500" : "text-red-500"}`}>
                              {d.dir1 === "Down" ? "↓" : "↑"}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 font-mono font-medium">{formatTime(d.time1)}</td>
                        <td className="py-2 pr-3 text-gray-500">{d.pos1 > 0 ? `#${d.pos1}` : "-"}</td>
                        <td className="py-2 pr-3">
                          <Link href={`/year?year=${d.year2}`} className="text-comrades hover:underline">
                            {d.year2}
                          </Link>
                          {d.dir2 && (
                            <span className={`ml-1 text-[10px] ${d.dir2 === "Down" ? "text-blue-500" : "text-red-500"}`}>
                              {d.dir2 === "Down" ? "↓" : "↑"}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 font-mono font-medium">{formatTime(d.time2)}</td>
                        <td className="py-2 pr-3 text-gray-500">{d.pos2 > 0 ? `#${d.pos2}` : "-"}</td>
                        <td className="py-2 pr-3 text-right">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${
                            d.diffSeconds === 0 ? "bg-purple-100 text-purple-800" :
                            d.diffSeconds <= 2 ? "bg-indigo-100 text-indigo-800" :
                            "bg-blue-50 text-blue-700"
                          }`}>
                            {d.diffSeconds === 0 ? "EXACT" : `${d.diffSeconds}s`}
                          </span>
                        </td>
                        <td className="py-2 text-right text-gray-400 text-xs">
                          {d.yearGap}yr
                          {d.sameDirection === true && " · same dir"}
                          {d.sameDirection === false && " · opp dir"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Near misses (1-3 seconds, sub-7h) */}
              {nearElite.length > 0 && (
                <>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 mt-6">Near Misses — 1 to 3 Seconds Apart (sub-7h)</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-500">
                          <th className="py-2 pr-3">Runner</th>
                          <th className="py-2 pr-3">Year</th>
                          <th className="py-2 pr-3">Time</th>
                          <th className="py-2 pr-3">Pos</th>
                          <th className="py-2 pr-3">Year</th>
                          <th className="py-2 pr-3">Time</th>
                          <th className="py-2 pr-3">Pos</th>
                          <th className="py-2 pr-3 text-right">Diff</th>
                          <th className="py-2 text-right">Gap</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nearElite.map((d, i) => (
                          <tr key={`near-${i}`} className="border-b border-gray-100">
                            <td className="py-2 pr-3">
                              <RunnerLink name={d.name} athleteId={d.athleteId} />
                            </td>
                            <td className="py-2 pr-3">
                              <Link href={`/year?year=${d.year1}`} className="text-comrades hover:underline">{d.year1}</Link>
                              {d.dir1 && <span className={`ml-1 text-[10px] ${d.dir1 === "Down" ? "text-blue-500" : "text-red-500"}`}>{d.dir1 === "Down" ? "↓" : "↑"}</span>}
                            </td>
                            <td className="py-2 pr-3 font-mono font-medium">{formatTime(d.time1)}</td>
                            <td className="py-2 pr-3 text-gray-500">{d.pos1 > 0 ? `#${d.pos1}` : "-"}</td>
                            <td className="py-2 pr-3">
                              <Link href={`/year?year=${d.year2}`} className="text-comrades hover:underline">{d.year2}</Link>
                              {d.dir2 && <span className={`ml-1 text-[10px] ${d.dir2 === "Down" ? "text-blue-500" : "text-red-500"}`}>{d.dir2 === "Down" ? "↓" : "↑"}</span>}
                            </td>
                            <td className="py-2 pr-3 font-mono font-medium">{formatTime(d.time2)}</td>
                            <td className="py-2 pr-3 text-gray-500">{d.pos2 > 0 ? `#${d.pos2}` : "-"}</td>
                            <td className="py-2 pr-3 text-right">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${
                                d.diffSeconds <= 1 ? "bg-indigo-100 text-indigo-800" : "bg-blue-50 text-blue-700"
                              }`}>
                                {d.diffSeconds}s
                              </span>
                            </td>
                            <td className="py-2 text-right text-gray-400 text-xs">
                              {d.yearGap}yr
                              {d.sameDirection === true && " · same dir"}
                              {d.sameDirection === false && " · opp dir"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </StoryCard>
          </section>
          );
        })()}

        {/* ============================================================ */}
        {/* NARROWEST MARGINS */}
        {/* ============================================================ */}
        <section>
          <SectionHeader
            id="margins"
            title="⏱️ Closest Finishes"
            subtitle="Photo finishes after 90km of racing"
          />
          <StoryCard accent="orange">
            <p className="text-gray-700 mb-4 leading-relaxed">
              In 1967, after nearly 6 hours of running across 90 kilometres of KwaZulu-Natal
              hills, <strong>Manie Kuhn</strong> beat <strong>Tommy Malone</strong> by just{" "}
              <strong>one single second</strong> — {formatTime(data.narrowestMargins[0]?.winnerTime || "")} to{" "}
              {formatTime(data.narrowestMargins[0]?.runnerUpTime || "")}. In the modern era,
              {" "}<strong>Tete Dijana</strong> and <strong>Piet Wiersma</strong> have fought two
              razor-thin battles — 3 seconds in 2023, and 5 seconds in 2025.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="py-2 pr-4">Year</th>
                    <th className="py-2 pr-4">Winner</th>
                    <th className="py-2 pr-4">Time</th>
                    <th className="py-2 pr-4">Runner-Up</th>
                    <th className="py-2 pr-4">Time</th>
                    <th className="py-2 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {data.narrowestMargins.map((m) => (
                    <tr key={m.year} className="border-b border-gray-100">
                      <td className="py-2 pr-4">
                        <Link href={`/year?year=${m.year}`} className="text-comrades hover:underline font-medium">
                          {m.year}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 font-medium">{m.winner}</td>
                      <td className="py-2 pr-4 font-mono text-sm">{formatTime(m.winnerTime)}</td>
                      <td className="py-2 pr-4">{m.runnerUp}</td>
                      <td className="py-2 pr-4 font-mono text-sm">{formatTime(m.runnerUpTime)}</td>
                      <td className="py-2 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                          m.marginSeconds <= 5 ? "bg-red-100 text-red-800" :
                          m.marginSeconds <= 30 ? "bg-orange-100 text-orange-800" :
                          "bg-blue-50 text-blue-700"
                        }`}>
                          {formatMargin(m.marginSeconds)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.widestMargins.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-100">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Biggest Winning Margins</h4>
                <div className="space-y-1">
                  {data.widestMargins.slice(0, 3).map((m) => (
                    <div key={m.year} className="text-sm text-gray-600">
                      <span className="font-medium">{m.year}:</span> {m.winner} won by{" "}
                      <strong>{formatMargin(m.marginSeconds)}</strong> over {m.runnerUp}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </StoryCard>
        </section>

        {/* ============================================================ */}
        {/* CONSECUTIVE FINISHES */}
        {/* ============================================================ */}
        <section>
          <SectionHeader
            id="streaks"
            title="🔗 Iron Streaks"
            subtitle="Never missed a year, never failed to finish"
          />
          <StoryCard accent="emerald">
            <p className="text-gray-700 mb-4 leading-relaxed">
              These athletes finished the Comrades Marathon every single year for decades — never
              missing a race, never failing to cross the finish line. <strong>{data.consecutiveFinishes[0]?.name}</strong> holds
              the record with <strong>{data.consecutiveFinishes[0]?.streak} consecutive finishes</strong> from{" "}
              {data.consecutiveFinishes[0]?.startYear} to {data.consecutiveFinishes[0]?.endYear} — nearly
              half a century of ultramarathon finishing.
            </p>
            <div className="space-y-3">
              {data.consecutiveFinishes.slice(0, 10).map((s, i) => (
                <div key={s.athleteId} className="flex items-center gap-3">
                  <div className="w-7 text-right text-sm font-bold text-gray-400">{i + 1}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <RunnerLink name={s.name} athleteId={s.athleteId} />
                      <span className="text-xs text-gray-400">{s.startYear}–{s.endYear}</span>
                    </div>
                    <div className="relative h-5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full flex items-center justify-end pr-2"
                        style={{ width: `${(s.streak / data.consecutiveFinishes[0].streak) * 100}%` }}
                      >
                        <span className="text-[10px] font-bold text-white">{s.streak}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </StoryCard>
        </section>

        {/* ============================================================ */}
        {/* LONGEST CAREERS */}
        {/* ============================================================ */}
        <section>
          <SectionHeader
            id="careers"
            title="📅 Longest Careers"
            subtitle="Spanning decades of racing history"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.longestCareers.slice(0, 10).map((c) => (
              <StoryCard key={c.athleteId}>
                <div className="flex items-start justify-between">
                  <div>
                    <RunnerLink name={c.name} athleteId={c.athleteId} />
                    <div className="text-sm text-gray-500 mt-1">
                      {c.firstYear} → {c.lastYear}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-comrades">{c.span}</div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wide">year span</div>
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  {c.totalRaces} race{c.totalRaces !== 1 ? "s" : ""} across {c.span} years
                </div>
              </StoryCard>
            ))}
          </div>
        </section>

        {/* ============================================================ */}
        {/* COMEBACKS */}
        {/* ============================================================ */}
        <section>
          <SectionHeader
            id="comebacks"
            title="💪 Greatest Comebacks"
            subtitle="DNF'd one year, on the podium the next"
          />
          <StoryCard accent="rose">
            <p className="text-gray-700 mb-4 leading-relaxed">
              There is no lonelier feeling than failing to finish the Comrades Marathon — the
              dreaded <strong>DNF</strong>. But these athletes turned failure into fuel,
              coming back to claim a podium finish. Ann Ashworth DNF&apos;d in 2017, then came
              back to <em>win the women&apos;s race</em> in 2018. Jaroslaw Janicki DNF&apos;d in
              1998 and won the very next year.
            </p>
            <div className="space-y-3">
              {data.comebacks.map((c) => (
                <div key={c.athleteId} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0">
                    <PosBadge pos={c.comebackPos} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <RunnerLink name={c.name} athleteId={c.athleteId} />
                      {c.gender === "F" && (
                        <span className="text-[10px] bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded font-medium">
                          Women&apos;s
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-0.5">
                      DNF in <span className="font-medium text-red-600">{c.dnfYear}</span>
                      {" → "}
                      {c.comebackPos === 1
                        ? (c.gender === "F" ? "Won women's race" : "Won")
                        : `${c.gender === "F" ? "Women's" : ""} #${c.comebackPos}`}{" "}
                      in <span className="font-medium text-emerald-600">{c.comebackYear}</span>
                      {" "}({formatTime(c.comebackTime)})
                      {c.overallPos && c.gender === "F" && (
                        <span className="text-gray-400 text-xs ml-1">
                          (#{formatNumber(c.overallPos)} overall)
                        </span>
                      )}
                    </div>
                  </div>
                  {c.comebackYear - c.dnfYear === 1 && (
                    <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                      Next year!
                    </span>
                  )}
                </div>
              ))}
            </div>
          </StoryCard>
        </section>

        {/* ============================================================ */}
        {/* REPEAT PODIUMS */}
        {/* ============================================================ */}
        <section>
          <SectionHeader
            id="podiums"
            title="🏅 Podium Royalty"
            subtitle="Athletes with the most top-3 finishes across multiple years"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.repeatPodiums.slice(0, 8).map((p) => (
              <StoryCard key={p.athleteId} accent={p.count >= 10 ? "gold" : "blue"}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <RunnerLink name={p.name} athleteId={p.athleteId} />
                    <div className="text-xs text-gray-500 mt-0.5">
                      {p.gender === "F" ? "Women's podiums" : "Overall podiums"} · {p.span} year span
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-comrades">{p.count}</div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wide">podiums</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {p.podiums.map((pd) => (
                    <span key={pd.year} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      pd.pos === 1 ? "bg-yellow-50 text-yellow-800" :
                      pd.pos === 2 ? "bg-gray-100 text-gray-600" :
                      "bg-amber-50 text-amber-800"
                    }`}>
                      {pd.pos === 1 ? "🥇" : pd.pos === 2 ? "🥈" : "🥉"} {pd.year}
                    </span>
                  ))}
                </div>
              </StoryCard>
            ))}
          </div>
        </section>

        {/* ============================================================ */}
        {/* MOST IMPROVED */}
        {/* ============================================================ */}
        <section>
          <SectionHeader
            id="improved"
            title="📈 Most Improved"
            subtitle="The biggest gap between first race and personal best"
          />
          <StoryCard accent="blue">
            <p className="text-gray-700 mb-4 leading-relaxed">
              Every Comrades runner knows the feeling of crossing the finish line wondering if they
              can do better. These athletes took that to the extreme — improving by{" "}
              <strong>hours</strong> between their first attempt and their personal best.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="py-2 pr-4">Runner</th>
                    <th className="py-2 pr-4">First Race</th>
                    <th className="py-2 pr-4">First Time</th>
                    <th className="py-2 pr-4">Best Time</th>
                    <th className="py-2 pr-4">Best Year</th>
                    <th className="py-2 text-right">Improvement</th>
                  </tr>
                </thead>
                <tbody>
                  {data.mostImproved.map((m) => (
                    <tr key={m.athleteId} className="border-b border-gray-100">
                      <td className="py-2 pr-4">
                        <RunnerLink name={m.name} athleteId={m.athleteId} />
                        <div className="text-[10px] text-gray-400">{m.totalRaces} races</div>
                      </td>
                      <td className="py-2 pr-4 text-gray-500">{m.firstYear}</td>
                      <td className="py-2 pr-4 font-mono text-red-600">{formatTime(m.firstTime)}</td>
                      <td className="py-2 pr-4 font-mono text-emerald-600 font-medium">{formatTime(m.bestTime)}</td>
                      <td className="py-2 pr-4 text-gray-500">{m.bestYear}</td>
                      <td className="py-2 text-right">
                        <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-bold">
                          −{formatImprovement(m.improvementSeconds)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </StoryCard>
        </section>

        {/* ============================================================ */}
        {/* WON AFTER MANY ATTEMPTS */}
        {/* ============================================================ */}
        <section>
          <SectionHeader
            id="persistence"
            title="🎯 Persistence Pays Off"
            subtitle="Athletes who ran many times before winning"
          />
          <StoryCard accent="purple">
            <p className="text-gray-700 mb-4 leading-relaxed">
              Some champions are born. Others are made through years of perseverance.{" "}
              <strong>{data.wonAfterMany[0]?.name}</strong> ran the Comrades{" "}
              <strong>{data.wonAfterMany[0]?.racesBeforeWin} times</strong> before finally winning in{" "}
              {data.wonAfterMany[0]?.firstWinYear}. That&apos;s over a decade of finishing behind
              other runners before breaking through to claim the ultimate prize.
            </p>
            <div className="space-y-3">
              {data.wonAfterMany.map((w) => (
                <div key={w.athleteId} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <span className="text-sm font-bold text-purple-700">{w.racesBeforeWin}</span>
                  </div>
                  <div className="flex-1">
                    <RunnerLink name={w.name} athleteId={w.athleteId} />
                    <div className="text-sm text-gray-500">
                      {w.racesBeforeWin} races before first win in {w.firstWinYear}
                      {w.totalWins > 1 && ` · ${w.totalWins} total wins`}
                      {w.gender === "F" && " · Women's"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </StoryCard>
        </section>

        {/* ============================================================ */}
        {/* NEVER GAVE UP */}
        {/* ============================================================ */}
        <section>
          <SectionHeader
            id="nevergaveup"
            title="🔥 Never Gave Up"
            subtitle="Athletes who DNF'd again and again — but kept coming back until they finished"
          />
          <StoryCard accent="orange">
            <p className="text-gray-700 mb-4 leading-relaxed">
              The Comrades Marathon breaks even the toughest athletes. But these runners refused to let
              a DNF define them. <strong>{data.neverGaveUp[0]?.name}</strong> entered the Comrades{" "}
              <strong>{data.neverGaveUp[0]?.dnfCount} times</strong> and failed to finish every single
              time — {data.neverGaveUp[0]?.dnfYears[0]} through{" "}
              {data.neverGaveUp[0]?.dnfYears[data.neverGaveUp[0].dnfYears.length - 1]}. But in{" "}
              <strong>{data.neverGaveUp[0]?.finishYear}</strong>, they finally crossed the line in{" "}
              {formatTime(data.neverGaveUp[0]?.finishTime || "")}, earning a hard-won{" "}
              {data.neverGaveUp[0]?.finishMedal}. That&apos;s the spirit of Comrades.
            </p>
            <div className="space-y-4">
              {data.neverGaveUp.map((a) => (
                <div key={a.athleteId} className="p-4 bg-gradient-to-r from-orange-50 to-white rounded-lg border border-orange-100">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <RunnerLink name={a.name} athleteId={a.athleteId} />
                        {a.gender === "F" && (
                          <span className="text-[10px] bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded font-medium">
                            Women&apos;s
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <div className="text-2xl font-bold text-orange-600">{a.dnfCount}</div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wide">DNFs first</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {a.dnfYears.map((y) => (
                      <span key={y} className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[10px] font-medium">
                        ✗ {y}
                      </span>
                    ))}
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                      ✓ {a.finishYear}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    First finish: {formatTime(a.finishTime)} · {a.finishMedal}
                    {a.totalFinishes > 1 && (
                      <span className="text-emerald-600 font-medium"> · {a.totalFinishes} total finishes since</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </StoryCard>
        </section>

        {/* ============================================================ */}
        {/* WOMEN PIONEERS */}
        {/* ============================================================ */}
        <section>
          <SectionHeader
            id="pioneers"
            title="🌟 Women Pioneers"
            subtitle="A century of milestones — from lone pioneer to thousands strong"
          />
          <StoryCard accent="rose">
            <p className="text-gray-700 mb-4 leading-relaxed">
              In <strong>1923</strong>, just two years after the first Comrades Marathon,
              Frances Hayward became the first woman to complete the race — alone in a field of men.
              It would be <strong>42 years</strong> before another woman would finish. From that
              solitary beginning, women have fought for every milestone — and today make up a growing
              share of the field.
            </p>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[27px] top-0 bottom-0 w-0.5 bg-rose-200" />

              <div className="space-y-4">
                {data.womenPioneers.milestones.map((m, i) => {
                  const icon = m.type === "first" ? "🌅" :
                    m.type === "return" ? "🔄" :
                    m.type === "pioneer" ? "💪" :
                    m.type === "growth" ? "📈" :
                    m.type === "record" ? "⚡" :
                    m.type === "gold" ? "🥇" :
                    m.type === "international" ? "🌍" : "⭐";
                  const bgClass = m.type === "record" ? "bg-purple-50 border-purple-100" :
                    m.type === "gold" ? "bg-yellow-50 border-yellow-100" :
                    m.type === "growth" ? "bg-emerald-50 border-emerald-100" :
                    "bg-rose-50 border-rose-100";

                  return (
                    <div key={`${m.year}-${m.type}-${i}`} className="relative flex gap-3 ml-1">
                      {/* Timeline dot */}
                      <div className="relative z-10 flex-shrink-0 w-[46px] flex items-center justify-center">
                        <span className="text-lg">{icon}</span>
                      </div>
                      {/* Card */}
                      <div className={`flex-1 p-3 rounded-lg border ${bgClass}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-bold text-rose-600 uppercase tracking-wide mb-0.5">
                              {m.year}
                            </div>
                            <div className="font-semibold text-sm text-gray-900">{m.title}</div>
                            {m.name && (
                              <div className="mt-1">
                                <RunnerLink name={m.name} athleteId={m.athleteId} />
                                {m.time && (
                                  <span className="text-xs text-gray-500 ml-1.5">
                                    {formatTime(m.time)}
                                    {m.pos && ` · pos #${formatNumber(parseInt(m.pos))}`}
                                  </span>
                                )}
                              </div>
                            )}
                            {m.description && (
                              <div className="text-xs text-gray-500 mt-0.5">{m.description}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Women's participation growth chart */}
            {data.womenPioneers.growth.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-100">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Women&apos;s Participation Growth</h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.womenPioneers.growth} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                      <Tooltip
                        formatter={(value: any) => [formatNumber(value), "Women Finishers"]}
                        labelFormatter={(label: any) => `Year: ${label}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#e11d48"
                        fill="#e11d48"
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </StoryCard>
        </section>

        {/* ============================================================ */}
        {/* UNUSUAL COUNTRIES */}
        {/* ============================================================ */}
        <section>
          <SectionHeader
            id="countries"
            title="🌍 Rare Nations"
            subtitle="Countries with just 1–3 athletes who have ever finished Comrades"
          />
          <StoryCard>
            <p className="text-gray-700 mb-4 leading-relaxed">
              While South Africa dominates the field, pioneers from the most unexpected corners of
              the globe have made the pilgrimage to KwaZulu-Natal. These athletes represent the
              truly global spirit of Comrades.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.unusualCountries.map((c) => (
                <div key={c.country} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                  <span className="text-2xl">{c.flag || "🏳️"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{c.country}</div>
                    <div className="text-xs text-gray-500">
                      <RunnerLink name={c.pioneer} athleteId={c.pioneerAthleteId} />
                      {" "}({c.pioneerYear}) · {formatTime(c.pioneerTime)}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {c.totalAthletes} athlete{c.totalAthletes > 1 ? "s" : ""}
                  </div>
                </div>
              ))}
            </div>
          </StoryCard>
        </section>

        {/* ============================================================ */}
        {/* RACE GROWTH */}
        {/* ============================================================ */}
        <section>
          <SectionHeader
            id="growth"
            title="📊 A Century of Growth"
            subtitle={`From ${data.raceGrowth[0]?.finishers} finishers in ${data.raceGrowth[0]?.year} to ${formatNumber(data.raceGrowth[data.raceGrowth.length - 1]?.finishers || 0)} in ${data.raceGrowth[data.raceGrowth.length - 1]?.year}`}
          />
          <StoryCard>
            <p className="text-gray-700 mb-4 leading-relaxed">
              What started with just <strong>{data.raceGrowth[0]?.finishers} finishers</strong> in{" "}
              {data.raceGrowth[0]?.year} has grown into one of the world&apos;s largest
              ultramarathons, with over <strong>{formatNumber(data.raceGrowth[data.raceGrowth.length - 1]?.finishers || 0)}</strong> finishers
              in {data.raceGrowth[data.raceGrowth.length - 1]?.year} — a <strong>thousand-fold</strong> increase
              over a century.
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.raceGrowth} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                  <Tooltip
                    formatter={(value: any) => [formatNumber(value), "Finishers"]}
                    labelFormatter={(label: any) => `Year: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="finishers"
                    stroke="#1B5E20"
                    fill="#1B5E20"
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </StoryCard>
        </section>
      </div>
    </div>
  );
}
