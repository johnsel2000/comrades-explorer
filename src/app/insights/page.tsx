"use client";

import { useEffect, useState, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, ScatterChart, Scatter,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Cell, ReferenceLine, ZAxis,
} from "recharts";
import Link from "next/link";
import { getInsights, formatNumber } from "@/lib/data";
import type { InsightsData } from "@/lib/types";

/* ============================================================================
   TAB & SECTION DEFINITIONS
   ============================================================================ */

type Tab = {
  id: string;
  label: string;
  icon: string;
  sections: { id: string; label: string }[];
};

const TABS: Tab[] = [
  {
    id: "performance",
    label: "Performance",
    icon: "\u{1F3C3}",
    sections: [
      { id: "attempt-curve", label: "Attempt Curve" },
      { id: "slowdown", label: "Slowdown" },
      { id: "pb", label: "Personal Best" },
      { id: "up-down", label: "Up vs Down" },
      { id: "streak-perf", label: "Streak Effect" },
      { id: "medal-cutoffs", label: "Medal Cutoffs" },
    ],
  },
  {
    id: "age-experience",
    label: "Age & Experience",
    icon: "\u{1F9D3}",
    sections: [
      { id: "age", label: "Age & Times" },
      { id: "exp-vs-age", label: "Experience vs Age" },
      { id: "age-direction", label: "Age & Direction" },
      { id: "dnf", label: "DNF Rates" },
      { id: "dropout", label: "Dropout Curve" },
    ],
  },
  {
    id: "milestones",
    label: "Milestones",
    icon: "\u{1F3AF}",
    sections: [
      { id: "green-number", label: "Green Number" },
      { id: "green-deep", label: "Green Deep Dive" },
      { id: "back-to-back", label: "Back-to-Back" },
      { id: "return", label: "The Wall" },
      { id: "retention", label: "Retention Curve" },
    ],
  },
  {
    id: "race-evolution",
    label: "Race Evolution",
    icon: "\u{1F4C8}",
    sections: [
      { id: "cutoff", label: "12-Hour Effect" },
      { id: "hour-dist", label: "Finish Times" },
      { id: "field-size", label: "Field Size" },
      { id: "gender", label: "Gender Gap" },
      { id: "countries", label: "Country Trends" },
    ],
  },
  {
    id: "countries",
    label: "Countries",
    icon: "\u{1F30D}",
    sections: [
      { id: "country-insights", label: "Country Analysis" },
      { id: "country-mean-med", label: "Mean vs Median" },
    ],
  },
];

const AGE_COLORS: Record<string, string> = {
  Senior: "#1B5E20",
  "40-49": "#F57C00",
  "50-59": "#1565C0",
  "60+": "#7B1FA2",
};

const COUNTRY_COLORS = [
  "#1B5E20", "#F57C00", "#1565C0", "#7B1FA2", "#C62828",
  "#00695C", "#4E342E", "#283593", "#558B2F", "#AD1457",
  "#37474F", "#E65100", "#0097A7", "#6A1B9A", "#33691E",
];

const HOUR_BRACKET_COLORS: Record<string, string> = {
  "Sub-6h": "#b91c1c", "6-7h": "#c2410c", "7-8h": "#d97706",
  "8-9h": "#65a30d", "9-10h": "#0891b2", "10-11h": "#2563eb", "11-12h": "#7c3aed",
};

/* ============================================================================
   SHARED COMPONENTS
   ============================================================================ */

function StatCard({
  label, value, sub, color = "text-comrades",
}: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function SectionHeader({ id, title, subtitle }: { id: string; title: string; subtitle: string }) {
  return (
    <div id={id} className="scroll-mt-20">
      <h2 className="text-xl font-bold text-gray-900 mb-1">{title}</h2>
      <p className="text-sm text-gray-500 mb-4">{subtitle}</p>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 mb-6">{children}</div>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ============================================================================
   MAIN PAGE
   ============================================================================ */

export default function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("performance");

  useEffect(() => {
    getInsights().then(setData).finally(() => setLoading(false));
  }, []);

  // Sync active tab from URL hash on mount
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      for (const tab of TABS) {
        if (tab.sections.some((s) => s.id === hash)) {
          setActiveTab(tab.id);
          setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" }), 100);
          break;
        }
      }
    }
  }, []);

  const medalAgeData = useMemo(() => {
    if (!data) return [];
    const categories = ["Senior", "40-49", "50-59", "60+"];
    const medals = ["Gold", "Wally Hayward", "Silver", "Bill Rowan", "Bronze", "Vic Clapham"];
    return categories.map((cat) => {
      const d = data.medalsByAge[cat] || {};
      return { category: cat, ...Object.fromEntries(medals.map((m) => [m, d[m] || 0])) };
    });
  }, [data]);

  const countryChartData = useMemo(() => {
    if (!data) return { withSA: [] as Record<string, number | string>[], withoutSA: [] as Record<string, number | string>[], countries: [] as string[] };
    const others = data.countryTrends.countries.filter((c) => c !== "South Africa");
    return {
      withSA: data.countryTrends.data,
      withoutSA: data.countryTrends.data.map((d) => {
        const entry: Record<string, number | string> = { year: d.year };
        for (const c of others) entry[c] = d[c] || 0;
        return entry;
      }),
      countries: others,
    };
  }, [data]);

  // Experience vs Age heatmap data
  const expAgeMatrix = useMemo(() => {
    if (!data) return [];
    return data.experienceVsAge;
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-gray-400">Loading insights...</div>
      </div>
    );
  }

  if (!data) return null;

  const gn = data.greenNumberEffect;
  const bb = data.backToBack;
  const sc = data.slowdownCurve;
  const uvd = data.upVsDown;
  const rr = data.returnRates;
  const ce = data.cutoffEffect;
  const gg = data.genderGap;
  const pb = data.personalBest;
  const dc = data.dropoutCurve;
  const fvf = data.fieldVsFinish;
  const mcc = data.medalCutoffClustering;
  const ci = data.countryInsights;
  const pba = data.performanceByAttempt;
  const gndd = data.greenNumberDeepDive;
  const sp = data.streakPerformance;
  const adr = data.ageDirectionReversal;
  const cmm = data.countryMeanMedian;
  const fhd = data.finishHourDistribution;
  const rc = data.retentionCurve;

  const currentTab = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Insights & Analysis</h1>
      <p className="text-gray-500 mb-6">
        Deep dives into 100+ years of Comrades Marathon data — {TABS.reduce((a, t) => a + t.sections.length, 0)} analyses across {TABS.length} themes.
      </p>

      {/* ===== TAB BAR ===== */}
      <div className="flex gap-1 mb-4 border-b border-gray-200 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-comrades text-comrades"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== SECTION NAV PILLS ===== */}
      <div className="flex flex-wrap gap-2 mb-8">
        {currentTab.sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="px-3 py-1.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 hover:bg-comrades/10 hover:text-comrades transition-colors"
          >
            {s.label}
          </a>
        ))}
      </div>

      {/* ================================================================== */}
      {/* TAB: PERFORMANCE                                                   */}
      {/* ================================================================== */}
      {activeTab === "performance" && (
        <>
          {/* ----- Performance by Attempt Number ----- */}
          <Card>
            <SectionHeader
              id="attempt-curve"
              title="The Performance Curve"
              subtitle="How does finish time change across a runner's career? Average and median times by attempt number."
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatCard label="1st attempt avg" value={pba[0]?.avgTime || ""} color="text-gray-600" />
              <StatCard label="Peak (attempt 6)" value={pba[5]?.avgTime || ""} color="text-green-700" />
              <StatCard label="Improvement 1→6" value={pba[0] && pba[5] ? `${Math.round((pba[0].avgSeconds - pba[5].avgSeconds) / 60)} min` : ""} sub="average" color="text-green-700" />
              <StatCard label="Improve on 2nd" value={pba[1]?.improvedPct ? `${pba[1].improvedPct}%` : ""} sub="of runners" color="text-blue-600" />
            </div>
            <div className="h-72 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pba.filter((d) => d.attempt <= 20)} margin={{ top: 5, right: 30, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="attempt" tick={{ fontSize: 11 }} tickLine={false} label={{ value: "Finish number", position: "insideBottom", offset: -2, fontSize: 11, fill: "#999" }} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} domain={["dataMin - 300", "dataMax + 300"]}
                    tickFormatter={(v) => { const h = Math.floor(v / 3600); const m = Math.floor((v % 3600) / 60); return `${h}:${String(m).padStart(2, "0")}`; }} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }}
                    formatter={(v: any, name: any) => [name === "avgSeconds" ? `Avg: ${Math.floor(v / 3600)}:${String(Math.floor((v % 3600) / 60)).padStart(2, "0")}` : `Med: ${Math.floor(v / 3600)}:${String(Math.floor((v % 3600) / 60)).padStart(2, "0")}`, ""]}
                    labelFormatter={(n) => `Finish #${n}`} />
                  <Line type="monotone" dataKey="avgSeconds" stroke="#1B5E20" strokeWidth={2} dot={{ r: 3 }} name="avgSeconds" />
                  <Line type="monotone" dataKey="medianSeconds" stroke="#F57C00" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 5" name="medianSeconds" />
                  <ReferenceLine x={10} stroke="#16a34a" strokeDasharray="3 3" label={{ value: "Green #", position: "top", fontSize: 10, fill: "#16a34a" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#1B5E20] inline-block"></span> Mean</span>
              <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#F57C00] inline-block border-dashed"></span> Median</span>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Runners improve rapidly through their first 5-6 finishes, peaking around attempt 6. After that, aging gradually wins — but the slowdown is remarkably gentle for attempts 6-15. The gap between mean and median narrows with experience as the field becomes more homogeneous.
            </p>
          </Card>

          {/* ----- Slowdown Curve ----- */}
          <Card>
            <SectionHeader id="slowdown" title="The Slowdown Curve" subtitle="How does a runner's pace change over their career? Negative = getting faster, positive = slowing down." />
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sc} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="transition" tick={{ fontSize: 10 }} tickLine={false} interval={0} angle={-45} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v > 0 ? "+" : ""}${Math.round(v / 60)}m`} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }}
                    formatter={(v: any) => [`${v < 0 ? "-" : "+"}${(Math.abs(v) / 60).toFixed(1)} minutes`, "Avg change"]}
                    labelFormatter={(t) => `Finish ${t}`} />
                  <ReferenceLine y={0} stroke="#666" />
                  <Bar dataKey="avgDeltaSeconds" radius={[2, 2, 0, 0]}>
                    {sc.map((entry) => (<Cell key={entry.transition} fill={entry.avgDeltaSeconds < 0 ? "#16a34a" : "#F57C00"} opacity={0.75} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Runners get ~10 minutes faster between their 1st and 2nd Comrades, then gradually slow down with each subsequent run. By the 10th finish, the average runner is ~7 minutes slower per race.
            </p>
          </Card>

          {/* ----- Personal Best ----- */}
          <Card>
            <SectionHeader id="pb" title="When Do Runners Peak?" subtitle={`Among ${formatNumber(pb.totalAthletes)} runners with 2+ finishes, which finish number produces their personal best?`} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatCard label="Most common PB finish" value={`#${pb.mostCommonPbFinish}`} sub="The 2nd Comrades is where most runners peak" color="text-green-700" />
              <StatCard label="PB on 1st finish" value={`${pb.distribution[0]?.pct || 0}%`} sub="Never beat their debut" />
              <StatCard label="PB on 2nd finish" value={`${pb.distribution[1]?.pct || 0}%`} sub="Improved with experience" color="text-green-700" />
              <StatCard label="PB on 3rd or later" value={`${(100 - (pb.distribution[0]?.pct || 0) - (pb.distribution[1]?.pct || 0)).toFixed(1)}%`} sub="Kept getting faster" />
            </div>
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pb.distribution.filter((d) => d.nth <= 15)} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="nth" tick={{ fontSize: 11 }} tickLine={false} label={{ value: "Finish number", position: "insideBottom", offset: -2, fontSize: 11, fill: "#999" }} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }} formatter={(v: any) => [`${v}%`, "Runners with PB here"]} labelFormatter={(n) => `Finish #${n}`} />
                  <Bar dataKey="pct" radius={[2, 2, 0, 0]}>
                    {pb.distribution.filter((d) => d.nth <= 15).map((entry) => (
                      <Cell key={entry.nth} fill={entry.nth === pb.mostCommonPbFinish ? "#16a34a" : "#1B5E20"} opacity={entry.nth === pb.mostCommonPbFinish ? 1 : 0.5} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* ----- Up vs Down ----- */}
          <Card>
            <SectionHeader id="up-down" title="Up vs Down Performance" subtitle={`Comparing ${formatNumber(uvd.runnersWithBothPace || uvd.runnersWithBoth)} runners who've done both directions — adjusted for distance.`} />
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
              <p className="text-xs text-amber-800">
                <strong>Distance matters:</strong> Down runs average {uvd.avgDownDistanceKm} km vs {uvd.avgUpDistanceKm} km for Up — a {uvd.distanceDifferenceKm} km ({uvd.distanceDifferencePct}%) difference. Raw finishing times are misleading, so we compare <strong>pace (time per km)</strong> for a fair comparison.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <StatCard label="Up pace" value={uvd.avgUpPaceDisplay} color="text-red-600" />
              <StatCard label="Down pace" value={uvd.avgDownPaceDisplay} color="text-blue-600" />
              <StatCard label="Faster on Down" value={`${uvd.fasterOnDownByPace}%`} sub="by pace (sec/km)" color="text-blue-600" />
              <StatCard label="Pace gap" value={`${uvd.paceDifferenceSecKm} sec/km`} sub="Up slower than Down" />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">By raw time (misleading)</div>
                <div className="text-sm font-semibold">{uvd.fasterOnDown}% faster on Down</div>
                <div className="text-xs text-gray-400">Up {uvd.avgUpTime} vs Down {uvd.avgDownTime} ({Math.round(uvd.avgDifferenceSeconds / 60)} min gap)</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="text-xs text-blue-600 mb-1">By pace (distance-adjusted)</div>
                <div className="text-sm font-semibold text-blue-700">{uvd.fasterOnDownByPace}% faster on Down</div>
                <div className="text-xs text-blue-500">Up {uvd.avgUpPaceDisplay} vs Down {uvd.avgDownPaceDisplay} ({uvd.paceDifferenceSecKm} sec/km gap)</div>
              </div>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                <strong>Key insight:</strong> When we account for distance, the Down advantage is far more pronounced — {uvd.fasterOnDownByPace}% of runners are faster by pace vs just {uvd.fasterOnDown}% by raw time. The longer Down distance was masking how much faster runners truly move on the downhill route.
              </p>
            </div>
          </Card>

          {/* ----- Streak Performance ----- */}
          <Card>
            <SectionHeader id="streak-perf" title="Streak Length & Performance" subtitle="Do runners with longer consecutive finish streaks run faster? (All finish times grouped by runner's longest streak)" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              <StatCard label="One-off runners" value={sp[0]?.avgTime || ""} sub={`${formatNumber(sp[0]?.count || 0)} finishes`} color="text-gray-600" />
              <StatCard label="Streak 7-10" value={sp.find((s) => s.streakBucket === "7-10")?.avgTime || ""} sub={`${formatNumber(sp.find((s) => s.streakBucket === "7-10")?.count || 0)} finishes`} color="text-green-700" />
              <StatCard label="Streak 16+" value={sp.find((s) => s.streakBucket === "16+")?.avgTime || ""} sub={`${formatNumber(sp.find((s) => s.streakBucket === "16+")?.count || 0)} finishes`} color="text-green-700" />
            </div>
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sp} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="streakBucket" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} domain={["dataMin - 600", "dataMax + 600"]}
                    tickFormatter={(v) => { const h = Math.floor(v / 3600); const m = Math.floor((v % 3600) / 60); return `${h}:${String(m).padStart(2, "0")}`; }} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }}
                    formatter={(v: any) => [`${Math.floor(v / 3600)}:${String(Math.floor((v % 3600) / 60)).padStart(2, "0")}`, "Avg time"]}
                    labelFormatter={(b) => `Longest streak: ${b}`} />
                  <Bar dataKey="avgSeconds" radius={[2, 2, 0, 0]}>
                    {sp.map((entry, i) => (<Cell key={entry.streakBucket} fill={i === 0 ? "#9ca3af" : "#1B5E20"} opacity={0.3 + i * 0.12} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Runners with longer streaks are dramatically faster — a {sp[0] && sp[sp.length - 1] ? Math.round((sp[0].avgSeconds - sp[sp.length - 1].avgSeconds) / 60) : 0}-minute gap between one-off runners and those with 16+ consecutive finishes. This reflects both selection bias (faster runners stick around) and the training consistency that comes with regular participation.
            </p>
          </Card>

          {/* ----- Medal Cutoff Clustering ----- */}
          {mcc && (
            <Card>
              <div id="medal-cutoffs" className="scroll-mt-20">
                <h2 className="text-xl font-bold text-gray-900 mb-1">The Medal Cutoff Effect</h2>
                <p className="text-sm text-gray-500 mb-3">Runners cluster dramatically just before each medal cutoff — a phenomenon dubbed &ldquo;The Christmas Tree Effect&rdquo; by data journalist Stuart Mann.</p>
              </div>
              <div className="flex flex-wrap gap-3 mb-4">
                {mcc.boundaries.slice(0, 3).map((b) => (
                  <div key={b.boundary} className="p-3 bg-gray-50 rounded-lg flex-1 min-w-[140px]">
                    <div className="text-xs font-semibold text-gray-500">{b.boundary.split(" \u2192 ")[0]} cutoff</div>
                    <div className="text-lg font-bold text-comrades">{b.ratio.toFixed(1)}×</div>
                    <div className="text-[10px] text-gray-500">more finishers before vs after</div>
                  </div>
                ))}
              </div>
              <Link href="/explore#christmas-tree" className="inline-flex items-center gap-1.5 px-4 py-2 bg-comrades/10 text-comrades text-sm font-medium rounded-lg hover:bg-comrades/20 transition-colors">
                View full Christmas Tree analysis →
              </Link>
            </Card>
          )}
        </>
      )}

      {/* ================================================================== */}
      {/* TAB: AGE & EXPERIENCE                                              */}
      {/* ================================================================== */}
      {activeTab === "age-experience" && (
        <>
          {/* ----- Age & Performance ----- */}
          <Card>
            <SectionHeader id="age" title="Age & Performance" subtitle="How age category affects finish times and medal distribution." />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {(["Senior", "40-49", "50-59", "60+"] as const).map((cat) => {
                const d = data.avgTimesByAge.overall[cat];
                return d ? (
                  <StatCard key={cat} label={cat} value={d.avgTime} sub={`${formatNumber(d.count)} finishes`} color={`text-[${AGE_COLORS[cat]}]`} />
                ) : null;
              })}
            </div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Medal Distribution by Age Category</h3>
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={medalAgeData} layout="vertical" margin={{ top: 5, right: 10, bottom: 5, left: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 12 }} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }} formatter={(v: any) => [`${v}%`, ""]} />
                  <Bar dataKey="Gold" stackId="a" fill="#FFD700" />
                  <Bar dataKey="Wally Hayward" stackId="a" fill="#FFC107" />
                  <Bar dataKey="Silver" stackId="a" fill="#C0C0C0" />
                  <Bar dataKey="Bill Rowan" stackId="a" fill="#90A4AE" />
                  <Bar dataKey="Bronze" stackId="a" fill="#CD7F32" />
                  <Bar dataKey="Vic Clapham" stackId="a" fill="#795548" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* ----- Experience vs Age Cross-Tab ----- */}
          <Card>
            <SectionHeader id="exp-vs-age" title="Experience Beats Youth" subtitle="Average finish time by age category and attempt number. Does an experienced 50-year-old beat a first-time Senior?" />
            {expAgeMatrix.length > 0 && (() => {
              const ages = ["Senior", "40-49", "50-59", "60+"];
              const buckets = ["1st", "2-3", "4-5", "6-10", "11-20", "21+"];
              const allSecs = expAgeMatrix.map((e) => e.avgSeconds);
              const minSecs = Math.min(...allSecs);
              const maxSecs = Math.max(...allSecs);

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left p-2 text-xs text-gray-500">Age \ Attempt</th>
                        {buckets.map((b) => (<th key={b} className="p-2 text-xs text-gray-500 text-center">{b}</th>))}
                      </tr>
                    </thead>
                    <tbody>
                      {ages.map((age) => (
                        <tr key={age} className="border-t border-gray-100">
                          <td className="p-2 font-medium text-gray-700">{age}</td>
                          {buckets.map((bucket) => {
                            const cell = expAgeMatrix.find((e) => e.ageCategory === age && e.attemptBucket === bucket);
                            if (!cell) return <td key={bucket} className="p-2 text-center text-gray-300">—</td>;
                            const pct = (cell.avgSeconds - minSecs) / (maxSecs - minSecs);
                            const r = Math.round(220 - pct * 180);
                            const g = Math.round(240 - pct * 60);
                            const b2 = Math.round(220 - pct * 180);
                            return (
                              <td key={bucket} className="p-2 text-center" style={{ backgroundColor: `rgb(${r},${g},${b2})` }}>
                                <div className="font-mono text-xs font-semibold">{cell.avgTime.substring(0, 5)}</div>
                                <div className="text-[9px] text-gray-500">{formatNumber(cell.count)}</div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-xs text-green-800">
                <strong>Key insight:</strong> A 40-49 year old on their 6-10th attempt runs faster than a first-time Senior. Experience is a more powerful predictor of performance than age category alone. The darkest cells (fastest times) cluster in the upper-right — young and experienced — but the difference between age groups shrinks dramatically with experience.
              </p>
            </div>
          </Card>

          {/* ----- Age × Direction (Pace-adjusted) ----- */}
          <Card>
            <SectionHeader id="age-direction" title="Age × Direction by Pace" subtitle="How does the Up vs Down pace gap change with age? Pace (sec/km) accounts for the different distances." />
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={adr} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="ageCategory" tick={{ fontSize: 12 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                    domain={["dataMin - 10", "dataMax + 10"]}
                    tickFormatter={(v) => { const m = Math.floor(v / 60); const s = Math.floor(v % 60); return `${m}:${String(s).padStart(2, "0")}`; }}
                    label={{ value: "sec/km", angle: -90, position: "insideLeft", fontSize: 10, fill: "#999" }} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }}
                    formatter={(v: any, name: any) => {
                      const m = Math.floor(v / 60);
                      const s = Math.floor(v % 60);
                      return [`${m}:${String(s).padStart(2, "0")}/km`, name === "avgUpPace" ? "Up pace" : "Down pace"];
                    }} />
                  <Bar dataKey="avgUpPace" fill="#dc2626" opacity={0.7} name="avgUpPace" />
                  <Bar dataKey="avgDownPace" fill="#2563eb" opacity={0.7} name="avgDownPace" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-600/70 inline-block"></span> Up pace</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-600/70 inline-block"></span> Down pace</span>
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {adr.map((a) => (
                <div key={a.ageCategory} className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">{a.ageCategory}</div>
                  <div className="text-lg font-bold text-blue-600">
                    +{a.paceGapSecKm} sec/km
                  </div>
                  <div className="text-[10px] text-gray-400">
                    Up slower by pace
                  </div>
                  <div className="text-[10px] text-blue-500 mt-1">
                    {a.fasterOnDownByPacePct}% faster on Down
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="p-2 text-left text-gray-500">Age</th>
                    <th className="p-2 text-center text-red-600">Up pace</th>
                    <th className="p-2 text-center text-blue-600">Down pace</th>
                    <th className="p-2 text-center text-gray-500">Gap</th>
                    <th className="p-2 text-center text-gray-500">% Down faster (pace)</th>
                    <th className="p-2 text-center text-gray-400">% Down faster (time)</th>
                  </tr>
                </thead>
                <tbody>
                  {adr.map((a) => (
                    <tr key={a.ageCategory} className="border-b border-gray-100">
                      <td className="p-2 font-medium">{a.ageCategory}</td>
                      <td className="p-2 text-center text-red-600">{a.avgUpPaceDisplay}</td>
                      <td className="p-2 text-center text-blue-600">{a.avgDownPaceDisplay}</td>
                      <td className="p-2 text-center font-semibold">+{a.paceGapSecKm}s/km</td>
                      <td className="p-2 text-center font-semibold text-blue-600">{a.fasterOnDownByPacePct}%</td>
                      <td className="p-2 text-center text-gray-400">{a.fasterOnDownPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                <strong>Distance-corrected insight:</strong> When adjusted for the ~2.5% longer Down route, <em>all</em> age groups run a faster pace on the downhill direction. What previously appeared as a &quot;reversal&quot; for 60+ runners was an artifact of comparing raw times over different distances. The real pattern: the pace gap narrows with age (from {adr[0]?.paceGapSecKm || 0} sec/km for Seniors to {adr[adr.length - 1]?.paceGapSecKm || 0} sec/km for 60+), suggesting older runners lose some of their downhill advantage — but it never fully reverses.
              </p>
            </div>
          </Card>

          {/* ----- DNF Rates ----- */}
          <Card>
            <SectionHeader id="dnf" title="DNF Rates by Experience" subtitle="Does experience reduce your chance of not finishing?" />
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.dnfByAttempt.filter((d) => d.attemptNumber <= 25)} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="attemptNumber" tick={{ fontSize: 11 }} tickLine={false} label={{ value: "Attempt number", position: "insideBottom", offset: -2, fontSize: 11, fill: "#999" }} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }}
                    formatter={(v: any) => [`${v}%`, "DNF rate"]} labelFormatter={(n) => `Attempt #${n}`} />
                  <ReferenceLine x={10} stroke="#16a34a" strokeDasharray="3 3" label={{ value: "Green #", position: "top", fontSize: 10, fill: "#16a34a" }} />
                  <ReferenceLine x={20} stroke="#16a34a" strokeDasharray="3 3" label={{ value: "Double", position: "top", fontSize: 10, fill: "#16a34a" }} />
                  <Line type="monotone" dataKey="dnfRate" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* ----- Dropout Curve ----- */}
          <Card>
            <SectionHeader id="dropout" title="The Dropout Curve" subtitle="How many Comrades do runners finish in their career? Most are one-and-done." />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatCard label="One-and-done" value={`${dc.summary.oneAndDonePct}%`} sub={`${formatNumber(dc.summary.oneAndDoneCount)} runners`} color="text-red-600" />
              <StatCard label="5+ finishes" value={`${dc.summary.fivePlusPct}%`} sub={`${formatNumber(dc.summary.fivePlusCount)} runners`} />
              <StatCard label="10+ finishes (Green #)" value={`${dc.summary.tenPlusPct}%`} sub={`${formatNumber(dc.summary.tenPlusCount)} runners`} color="text-green-700" />
              <StatCard label="Total finishers" value={formatNumber(dc.summary.totalFinishingAthletes)} sub="Unique athletes with 1+ finish" />
            </div>
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dc.distribution.filter((d) => d.totalFinishes <= 20)} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="totalFinishes" tick={{ fontSize: 11 }} tickLine={false} label={{ value: "Career finishes", position: "insideBottom", offset: -2, fontSize: 11, fill: "#999" }} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }}
                    formatter={(v: any) => [formatNumber(v), "Athletes"]} labelFormatter={(n) => `${n} career finishes`} />
                  <ReferenceLine x={10} stroke="#16a34a" strokeDasharray="3 3" label={{ value: "Green #", position: "top", fontSize: 10, fill: "#16a34a" }} />
                  <Bar dataKey="athleteCount" radius={[2, 2, 0, 0]}>
                    {dc.distribution.filter((d) => d.totalFinishes <= 20).map((entry) => (
                      <Cell key={entry.totalFinishes} fill={entry.totalFinishes >= 10 ? "#16a34a" : "#1B5E20"} opacity={entry.totalFinishes >= 10 ? 0.8 : 0.5} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}

      {/* ================================================================== */}
      {/* TAB: MILESTONES                                                    */}
      {/* ================================================================== */}
      {activeTab === "milestones" && (
        <>
          {/* ----- Green Number Effect ----- */}
          <Card>
            <SectionHeader id="green-number" title="The Green Number Effect"
              subtitle="At 10 finishes you earn a permanent green race number — one of Comrades' most coveted milestones. Does this incentive show up in the data?" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatCard label="10th attempt finish rate" value={`${gn.summary.rateAttempting10th}%`} color="text-green-700" />
              <StatCard label="11th attempt finish rate" value={`${gn.summary.rateAttempting11th}%`} color="text-gray-600" />
              <StatCard label="Motivational boost" value={`+${gn.summary.effectSize10}pp`} sub="10th vs 11th" color="text-green-700" />
              <StatCard label="20th vs 21st boost" value={`+${gn.summary.effectSize20}pp`} sub="Double green effect" color="text-green-700" />
            </div>
            <div className="h-72 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gn.finishRateByNthPotentialFinish} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="nth" tick={{ fontSize: 11 }} tickLine={false}
                    label={{ value: "Potential Nth finish", position: "insideBottom", offset: -2, fontSize: 11, fill: "#999" }} />
                  <YAxis domain={[50, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }}
                    formatter={(value: any) => [`${value}%`, "Finish rate"]}
                    labelFormatter={(nth) => `Attempt for ${nth}${nth === 1 ? "st" : nth === 2 ? "nd" : nth === 3 ? "rd" : "th"} finish`} />
                  <ReferenceLine x={10} stroke="#16a34a" strokeDasharray="3 3" label={{ value: "Green #", position: "top", fontSize: 10, fill: "#16a34a" }} />
                  <ReferenceLine x={20} stroke="#16a34a" strokeDasharray="3 3" label={{ value: "Double", position: "top", fontSize: 10, fill: "#16a34a" }} />
                  <Bar dataKey="rate" radius={[2, 2, 0, 0]}>
                    {gn.finishRateByNthPotentialFinish.map((entry) => (
                      <Cell key={entry.nth} fill={entry.nth === 10 || entry.nth === 20 ? "#16a34a" : entry.nth === 11 || entry.nth === 21 ? "#dc2626" : "#1B5E20"}
                        opacity={entry.nth === 10 || entry.nth === 20 ? 1 : entry.nth === 11 || entry.nth === 21 ? 0.7 : 0.5} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              The green bars at positions 10 and 20 show a clear spike in finish rate — runners pushing harder to earn their green number. The red bars show the drop-off immediately after, when the incentive is gone.
            </p>
          </Card>

          {/* ----- Green Number Deep Dive ----- */}
          <Card>
            <SectionHeader id="green-deep" title="Green Number Deep Dive"
              subtitle="What happens to performance and DNF rates across the journey to green — and after earning it?" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatCard label="Pre-green avg" value={gndd.preGreenAvgTime} sub="Finishes 1-9" color="text-blue-600" />
              <StatCard label="Post-green avg" value={gndd.postGreenAvgTime} sub="Finishes 11+" color="text-amber-600" />
              <StatCard label="Slowdown" value={`+${gndd.slowdownMinutes} min`} sub="after earning green" color="text-amber-600" />
              <StatCard label="Post-green DNF" value={`${gndd.postGreenDnfRate}%`} sub={`vs ${gndd.nonGreenDnfRate}% non-green`} color="text-red-600" />
            </div>
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gndd.byMilestone} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} interval={0} angle={-25} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                    domain={["dataMin - 300", "dataMax + 300"]}
                    tickFormatter={(v) => { const h = Math.floor(v / 3600); const m = Math.floor((v % 3600) / 60); return `${h}:${String(m).padStart(2, "0")}`; }} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }}
                    formatter={(v: any, name: any) => {
                      if (name === "avgSeconds") return [`${Math.floor(v / 3600)}:${String(Math.floor((v % 3600) / 60)).padStart(2, "0")}`, "Avg time"];
                      return [`${v}%`, "DNF rate"];
                    }} />
                  <Bar dataKey="avgSeconds" radius={[2, 2, 0, 0]}>
                    {gndd.byMilestone.map((entry, i) => (
                      <Cell key={entry.label} fill={entry.label.includes("Green") || entry.label.includes("Double") ? "#16a34a" : "#1B5E20"}
                        opacity={entry.label.includes("Green") || entry.label.includes("Double") ? 1 : 0.5} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* DNF Journey: before vs after green */}
            <h3 className="text-sm font-semibold text-gray-700 mt-6 mb-2">DNF on the Road to Green</h3>
            <p className="text-xs text-gray-500 mb-3">
              Of {formatNumber(gndd.dnfJourney.greenRunners)} runners who earned green, how did their DNF behaviour change before vs after?
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <StatCard label="Pre-green DNF rate" value={`${gndd.dnfJourney.avgPreGreenDnfRate}%`} sub="avg per runner" color="text-green-700" />
              <StatCard label="Post-green DNF rate" value={`${gndd.dnfJourney.avgPostGreenDnfRate}%`} sub="avg per runner" color="text-red-600" />
              <StatCard label="Zero DNFs to green" value={`${gndd.dnfJourney.zeroPreDnfPct}%`} sub="reached 10 without a single DNF" color="text-green-700" />
              <StatCard label="DNF rate increase" value={`${Math.round((gndd.dnfJourney.avgPostGreenDnfRate - gndd.dnfJourney.avgPreGreenDnfRate) * 10) / 10}pp`} sub="after earning green" color="text-red-600" />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                <div className="text-xs text-green-700 font-semibold mb-1">Before green (finishes 1-9)</div>
                <div className="text-lg font-bold text-green-800">{gndd.dnfJourney.avgPreGreenDnfRate}% DNF rate</div>
                <div className="text-[10px] text-green-600">{gndd.dnfJourney.zeroPreDnfPct}% had zero DNFs on the path</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                <div className="text-xs text-red-700 font-semibold mb-1">After green (finish 10+)</div>
                <div className="text-lg font-bold text-red-800">{gndd.dnfJourney.avgPostGreenDnfRate}% DNF rate</div>
                <div className="text-[10px] text-red-600">~{Math.round(gndd.dnfJourney.avgPostGreenDnfRate / (gndd.dnfJourney.avgPreGreenDnfRate || 1))}× higher than pre-green</div>
              </div>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-800">
                <strong>The DNF paradox:</strong> Runners chasing green are remarkably resilient — {gndd.dnfJourney.zeroPreDnfPct}% reach 10 finishes without a single DNF. But after earning it, DNF rates jump to {gndd.dnfJourney.avgPostGreenDnfRate}%. The green number shifts motivation from &quot;must finish&quot; to &quot;want to participate&quot; — runners keep entering even in years when fitness, injury, or conditions work against them.
              </p>
            </div>
          </Card>

          {/* ----- Back-to-Back ----- */}
          <Card>
            <SectionHeader id="back-to-back" title="The Back-to-Back Medal" subtitle="A relatively recent incentive — the back-to-back medal is awarded to runners who finish in the year immediately following their first Comrades finish. Did it change behaviour?" />
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
              <p className="text-xs text-blue-800">
                <strong>Medal history:</strong> The back-to-back medal is a recent addition to Comrades, rewarding runners who finish their second successive race in the year immediately after their first. Many runners are also motivated by the desire to complete both directions (Up and Down).
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatCard label="First-timers who return" value={`${bb.firstTimerReturn.returnRate}%`}
                sub={`${formatNumber(bb.firstTimerReturn.returnedNextRace)} of ${formatNumber(bb.firstTimerReturn.totalFirstTimeFinishers)}`} />
              <StatCard label="Return finish rate" value={`${bb.firstTimerReturn.returnFinishRate}%`} sub="When they do return" />
              <StatCard label="Pre-medal B2B rate" value={`${bb.medalEffect.preCleanAvg}%`}
                sub="2010-2015 first-timers" />
              <StatCard label="Medal-era B2B rate" value={`${bb.medalEffect.medalCleanAvg}%`}
                sub="2016-2019 first-timers" color="text-green-700" />
            </div>

            <h3 className="text-sm font-semibold text-gray-700 mb-2">First-Timer Back-to-Back Rate by Year</h3>
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bb.b2bByYear.filter((d) => d.year >= 1985)} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="year" tick={{ fontSize: 9 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} domain={[0, 80]} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }}
                    formatter={(v: any, name: any) => [`${v}%`, "B2B rate"]}
                    labelFormatter={(yr) => {
                      const d = bb.b2bByYear.find((e) => e.year === yr);
                      return d ? `${yr} (${d.direction}) → ${d.nextYear} (${d.nextDirection})` : `${yr}`;
                    }} />
                  <ReferenceLine x={2016} stroke="#16a34a" strokeDasharray="5 5" label={{ value: "Medal introduced", position: "top", fontSize: 9, fill: "#16a34a" }} />
                  <Bar dataKey="b2bRate" radius={[2, 2, 0, 0]}>
                    {bb.b2bByYear.filter((d) => d.year >= 1985).map((entry) => (
                      <Cell key={entry.year}
                        fill={entry.year >= 2016 ? "#16a34a" : entry.sameDirection ? "#f59e0b" : "#1B5E20"}
                        opacity={0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#1B5E20]/70 inline-block"></span> Pre-medal (different direction)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500/70 inline-block"></span> Same direction year-pair</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-600/70 inline-block"></span> Medal era (2016+)</span>
            </div>

            <h3 className="text-sm font-semibold text-gray-700 mt-6 mb-2">Direction & Motivation</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Different-direction pairs</div>
                <div className="text-lg font-bold text-green-700">{bb.directionEffect.diffDirAvg}%</div>
                <div className="text-[10px] text-gray-400">{bb.directionEffect.diffDirCount} year-pairs</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-200">
                <div className="text-xs text-amber-700 mb-1">Same-direction pairs</div>
                <div className="text-lg font-bold text-amber-700">{bb.directionEffect.sameDirAvg}%</div>
                <div className="text-[10px] text-amber-500">{bb.directionEffect.sameDirCount} year-pairs (small sample)</div>
              </div>
            </div>

            <h3 className="text-sm font-semibold text-gray-700 mt-4 mb-2">Consecutive Finish Streak Distribution</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bb.streakDistribution.filter((d) => d.streakLength <= 20)} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="streakLength" tick={{ fontSize: 11 }} tickLine={false} label={{ value: "Streak length", position: "insideBottom", offset: -2, fontSize: 11, fill: "#999" }} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }}
                    formatter={(v: any) => [formatNumber(v), "Runners"]} labelFormatter={(v) => `${v} consecutive finishes`} />
                  <Bar dataKey="count" fill="#1B5E20" opacity={0.7} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-xs text-green-800">
                <strong>Did the medal work?</strong> Comparing 2010-2015 (pre-medal) to 2016-2019 (medal era, pre-COVID), first-timer B2B rates rose from {bb.medalEffect.preCleanAvg}% to {bb.medalEffect.medalCleanAvg}%. Same-direction year-pairs ({bb.directionEffect.sameDirAvg}%) actually show a <em>higher</em> B2B rate than different-direction pairs ({bb.directionEffect.diffDirAvg}%), though the sample is small ({bb.directionEffect.sameDirCount} pairs). This suggests the desire to &quot;run both directions&quot; may be less of a factor than simple momentum and the medal incentive.
              </p>
            </div>
          </Card>

          {/* ----- The Wall (Return Rates) ----- */}
          <Card>
            <SectionHeader id="return" title="The Second Comrades Wall" subtitle="After finishing their first Comrades, how many runners come back?" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              <StatCard label="Never returned" value={`${rr.neverReturned.pct}%`} sub={`${formatNumber(rr.neverReturned.count)} runners`} color="text-red-600" />
              <StatCard label="Returned within 1 year" value={`${rr.returnedWithin1Year.pct}%`} sub={`${formatNumber(rr.returnedWithin1Year.count)} runners`} color="text-green-700" />
              <StatCard label="Returned 3+ years later" value={`${rr.returnedAfter3PlusYears.pct}%`} sub={`${formatNumber(rr.returnedAfter3PlusYears.count)} runners`} />
            </div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Comeback Gap Distribution</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.comebackKids.gapDistribution.filter((d) => d.gap <= 20)} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="gap" tick={{ fontSize: 11 }} tickLine={false} label={{ value: "Years away", position: "insideBottom", offset: -2, fontSize: 11, fill: "#999" }} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }}
                    formatter={(v: any) => [formatNumber(v), "Runners"]} labelFormatter={(g) => `${g} year gap`} />
                  <Bar dataKey="count" fill="#1B5E20" opacity={0.7} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* ----- Retention Curve ----- */}
          <Card>
            <SectionHeader id="retention" title="The Retention Curve" subtitle="Of all athletes who ever finished, what percentage reached each milestone? Broken down by the decade of their first finish." />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatCard label="Reach 2nd finish" value={`${rc.overall[1]?.pct || 0}%`} sub={`${formatNumber(rc.overall[1]?.reached || 0)} athletes`} />
              <StatCard label="Reach 5th finish" value={`${rc.overall[4]?.pct || 0}%`} sub={`${formatNumber(rc.overall[4]?.reached || 0)} athletes`} />
              <StatCard label="Reach 10th (Green #)" value={`${rc.overall[9]?.pct || 0}%`} sub={`${formatNumber(rc.overall[9]?.reached || 0)} athletes`} color="text-green-700" />
              <StatCard label="Reach 20th" value={`${rc.overall[19]?.pct || 0}%`} sub={`${formatNumber(rc.overall[19]?.reached || 0)} athletes`} color="text-green-700" />
            </div>
            <div className="h-72 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart margin={{ top: 5, right: 30, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="nthFinish" type="number" domain={[1, 20]} tick={{ fontSize: 11 }} tickLine={false}
                    label={{ value: "Nth finish", position: "insideBottom", offset: -2, fontSize: 11, fill: "#999" }} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }}
                    formatter={(v: any, name: any) => [`${v}%`, name]} labelFormatter={(n) => `Finish #${n}`} />
                  <ReferenceLine x={10} stroke="#16a34a" strokeDasharray="3 3" />
                  <Line data={rc.overall.filter((d) => d.nthFinish <= 20)} type="monotone" dataKey="pct" stroke="#1B5E20" strokeWidth={3} dot={false} name="Overall" />
                  {rc.byDecade.map((dec, i) => (
                    <Line key={dec.decade} data={dec.data} type="monotone" dataKey="pct"
                      stroke={COUNTRY_COLORS[i % COUNTRY_COLORS.length]} strokeWidth={1.5} dot={false} name={dec.decade}
                      strokeDasharray={i % 2 === 0 ? undefined : "5 3"} opacity={0.7} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#1B5E20] inline-block" style={{ height: 3 }}></span> Overall</span>
              {rc.byDecade.map((dec, i) => (
                <span key={dec.decade} className="flex items-center gap-1">
                  <span className="w-4 h-0.5 inline-block" style={{ backgroundColor: COUNTRY_COLORS[i % COUNTRY_COLORS.length], height: 2 }}></span>
                  {dec.decade} ({formatNumber(dec.totalAthletes)})
                </span>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* ================================================================== */}
      {/* TAB: RACE EVOLUTION                                                */}
      {/* ================================================================== */}
      {activeTab === "race-evolution" && (
        <>
          {/* ----- 12-Hour Cutoff Effect ----- */}
          <Card>
            <SectionHeader id="cutoff" title="The 12-Hour Effect"
              subtitle="The race cutoff was 11 hours from 1928-1999 (trial 12h in 2000), then permanently 12 hours from 2003. How did this change the race?" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatCard label="Vic Clapham window" value={`${ce.summary.avgVicClaphamPct}%`} sub="of modern finishers in 11-12h" color="text-amber-700" />
              <StatCard label="11h era avg finish rate" value={`${ce.summary.avgFinishRate11h}%`} sub="1928-1999" color="text-blue-600" />
              <StatCard label="12h era avg finish rate" value={`${ce.summary.avgFinishRate12h}%`} sub="2003-present" color="text-green-700" />
              <StatCard label="Medal introduced" value="2000" sub="Vic Clapham for 11-12h" />
            </div>
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ce.byYear.filter((d) => d.cutoff === "12 Hours" && d.year >= 2003)} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="year" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }}
                    formatter={(v: any) => [`${v}%`, "In 11-12h window"]} labelFormatter={(y) => `${y}`} />
                  <Bar dataKey="windowPct" fill="#92400e" opacity={0.7} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* ----- Finish Hour Distribution ----- */}
          <Card>
            <SectionHeader id="hour-dist" title="When Runners Finish" subtitle="Distribution of finish times by hour bracket — and how it has shifted over the decades as the race democratized." />
            <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 mb-6">
              {fhd.overall.map((h) => (
                <div key={h.bracket} className="text-center p-2 rounded-lg" style={{ backgroundColor: `${HOUR_BRACKET_COLORS[h.bracket]}15` }}>
                  <div className="text-sm font-bold" style={{ color: HOUR_BRACKET_COLORS[h.bracket] }}>{h.pct}%</div>
                  <div className="text-[10px] text-gray-500">{h.bracket}</div>
                </div>
              ))}
            </div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Shift by Decade (% of finishers in each bracket)</h3>
            <div className="h-72 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fhd.byDecade} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="decade" tick={{ fontSize: 11 }} tickLine={false} tickFormatter={(v) => `${v}s`} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }}
                    formatter={(v: any, name: any) => [`${v}%`, name]} labelFormatter={(d) => `${d}s`} />
                  {["Sub-6h", "6-7h", "7-8h", "8-9h", "9-10h", "10-11h", "11-12h"].map((bracket) => (
                    <Bar key={bracket} dataKey={bracket} stackId="a" fill={HOUR_BRACKET_COLORS[bracket]} name={bracket} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
              {Object.entries(HOUR_BRACKET_COLORS).map(([label, color]) => (
                <span key={label} className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: color }}></span> {label}
                </span>
              ))}
            </div>
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                <strong>The democratization of Comrades:</strong> In the 1970s-80s, the 8-10h brackets dominated. By the 2020s, 10-11h is the single largest bracket (33.5%), with the 11-12h Vic Clapham window creating an entirely new finisher cohort. The sub-6h Gold bracket has always been tiny (&lt;1%).
              </p>
            </div>
          </Card>

          {/* ----- Field Size vs Finish Rate ----- */}
          <Card>
            <SectionHeader id="field-size" title="Field Size vs Finish Rate" subtitle="Does a bigger field make it harder to finish? Every dot is a race year." />
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="entries" type="number" tick={{ fontSize: 11 }} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
                    label={{ value: "Entries", position: "insideBottom", offset: -2, fontSize: 11, fill: "#999" }} />
                  <YAxis dataKey="finishRate" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`}
                    label={{ value: "Finish rate", angle: -90, position: "insideLeft", fontSize: 11, fill: "#999" }} />
                  <ZAxis dataKey="year" range={[40, 40]} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }}
                    formatter={(v: any, name: any) => [name === "entries" ? formatNumber(v) : `${v}%`, name === "entries" ? "Entries" : "Finish rate"]}
                    labelFormatter={() => ""} />
                  <Scatter data={fvf.filter((d) => d.cutoff === "11 Hours")} fill="#1565C0" opacity={0.7} name="11h era" />
                  <Scatter data={fvf.filter((d) => d.cutoff === "12 Hours")} fill="#F57C00" opacity={0.7} name="12h era" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-700/70 inline-block"></span> 11h era</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500/70 inline-block"></span> 12h era</span>
            </div>
          </Card>

          {/* ----- Gender Gap ----- */}
          <Card>
            <SectionHeader id="gender" title="The Gender Gap"
              subtitle="Women first ran Comrades in 1923 (Frances Hayward) but were only officially allowed from 1975. How has participation and performance evolved?" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatCard label="First female finisher" value={gg.summary.firstFemaleYear} />
              <StatCard label="Latest female %" value={`${gg.summary.latestFemalePct}%`} sub="of finishers" color="text-pink-600" />
              <StatCard label="Peak female %" value={`${gg.summary.peakFemalePct}%`} />
              <StatCard label="Current time gap" value={`${gg.summary.latestGapMinutes} min`} sub="women vs men avg" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Female Participation Over Time <span className="font-normal text-gray-400">(from 1975, when women were officially allowed)</span></h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={gg.trends.filter((d) => d.year >= 1975 && d.femalePct > 0)} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="year" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }}
                    formatter={(v: any) => [`${v}%`, "Female finishers"]} />
                  <Area type="monotone" dataKey="femalePct" fill="#ec4899" fillOpacity={0.2} stroke="#ec4899" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <h3 className="text-sm font-semibold text-gray-700 mt-4 mb-2">Gender Time Gap (minutes) <span className="font-normal text-gray-400">(from 1975)</span></h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={gg.trends.filter((d) => d.year >= 1975 && d.gapMinutes !== undefined && d.gapMinutes !== null)} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="year" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}m`} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }}
                    formatter={(v: any) => [`${v} minutes`, "Gap (women slower)"]} />
                  <Line type="monotone" dataKey="gapMinutes" stroke="#7B1FA2" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* ----- Country Trends ----- */}
          <Card>
            <SectionHeader id="countries" title="International Participation Trends"
              subtitle="Top participating countries over the last 20 years (excluding South Africa for scale)." />
            <div className="h-72 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={countryChartData.withoutSA.filter((d) => (d.year as number) >= 2003)} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="year" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }} />
                  {countryChartData.countries.slice(0, 10).map((c, i) => (
                    <Line key={c} type="monotone" dataKey={c} stroke={COUNTRY_COLORS[i]} strokeWidth={1.5} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
              {countryChartData.countries.slice(0, 10).map((c, i) => (
                <span key={c} className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: COUNTRY_COLORS[i] }}></span> {c}
                </span>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* ================================================================== */}
      {/* TAB: COUNTRIES                                                     */}
      {/* ================================================================== */}
      {activeTab === "countries" && (
        <>
          {/* ----- Country Insights ----- */}
          {ci && (
            <Card>
              <SectionHeader id="country-insights" title="Country Performance & Demographics"
                subtitle="How different nations compare in speed, medal quality, and gender balance. Countries with 100+ finishers." />

              {/* Fastest countries */}
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Fastest Countries (by average time)</h3>
              <div className="h-64 sm:h-72 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ci.performance.slice(0, 15)} layout="vertical" margin={{ top: 5, right: 10, bottom: 5, left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false}
                      tickFormatter={(v) => { const h = Math.floor(v / 3600); const m = Math.floor((v % 3600) / 60); return `${h}:${String(m).padStart(2, "0")}`; }} />
                    <YAxis type="category" dataKey="country" tick={{ fontSize: 11 }} tickLine={false} width={75} />
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }}
                      formatter={(v: any) => [`${Math.floor(v / 3600)}:${String(Math.floor((v % 3600) / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`, "Avg time"]} />
                    <Bar dataKey="avgSeconds" fill="#1B5E20" opacity={0.7} radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Medal Quality table */}
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Medal Quality Distribution</h3>
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left p-2">Country</th>
                      <th className="p-2 text-right">Finishers</th>
                      <th className="p-2 text-right">Gold %</th>
                      <th className="p-2 text-right">Elite %</th>
                      <th className="p-2 text-right">Silver+ %</th>
                      <th className="p-2 text-right">Bronze %</th>
                      <th className="p-2 text-right">Vic Clapham %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ci.medalQuality.slice(0, 15).map((c) => (
                      <tr key={c.country} className="border-b border-gray-100">
                        <td className="p-2 font-medium">{c.country}</td>
                        <td className="p-2 text-right text-gray-500">{formatNumber(c.finishers)}</td>
                        <td className="p-2 text-right font-mono">{c.goldPct}%</td>
                        <td className="p-2 text-right font-mono text-amber-700">{c.elitePct}%</td>
                        <td className="p-2 text-right font-mono">{c.silverPlusPct}%</td>
                        <td className="p-2 text-right font-mono">{c.bronzePct}%</td>
                        <td className="p-2 text-right font-mono text-gray-500">{c.vicClaphamPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Gender balance */}
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Female Participation by Country</h3>
              <div className="h-64 sm:h-72 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ci.genderBalance.filter((c) => c.finishers >= 200).slice(0, 15)} layout="vertical" margin={{ top: 5, right: 10, bottom: 5, left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="country" tick={{ fontSize: 11 }} tickLine={false} width={75} />
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }}
                      formatter={(v: any) => [`${v}%`, "Female %"]} />
                    <Bar dataKey="femalePct" fill="#ec4899" opacity={0.7} radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* International growth */}
              <h3 className="text-sm font-semibold text-gray-700 mb-2">International Growth</h3>
              <div className="h-64 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ci.internationalGrowth} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="year" tick={{ fontSize: 10 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }}
                      formatter={(v: any, name: any) => [name === "intlPct" ? `${v}%` : v, name === "intlPct" ? "International %" : "Countries"]} />
                    <Area type="monotone" dataKey="intlPct" fill="#1B5E20" fillOpacity={0.2} stroke="#1B5E20" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* ----- Mean vs Median by Country ----- */}
          <Card>
            <SectionHeader id="country-mean-med" title="Mean vs Median Finish Times" subtitle="Countries where the mean and median diverge reveal different runner profiles. Positive gap = right-skewed (slower outliers pull mean up)." />
            <div className="h-72 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cmm.slice(0, 20)} layout="vertical" margin={{ top: 5, right: 10, bottom: 5, left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} tickFormatter={(v) => `${v > 0 ? "+" : ""}${Math.round(v / 60)}m`}
                    label={{ value: "Mean - Median gap (minutes)", position: "insideBottom", offset: -2, fontSize: 11, fill: "#999" }} />
                  <YAxis type="category" dataKey="country" tick={{ fontSize: 11 }} tickLine={false} width={80} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }}
                    formatter={(v: any, name: any, props: any) => {
                      const entry = props.payload;
                      return [`Mean: ${entry.meanTime} | Median: ${entry.medianTime} | Gap: ${entry.gapPct > 0 ? "+" : ""}${entry.gapPct}%`, ""];
                    }} />
                  <ReferenceLine x={0} stroke="#666" />
                  <Bar dataKey="gapSeconds" radius={[2, 2, 2, 2]}>
                    {cmm.slice(0, 20).map((entry) => (
                      <Cell key={entry.country} fill={entry.gapSeconds > 0 ? "#F57C00" : "#1B5E20"} opacity={0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#1B5E20]/70 inline-block"></span> Mean faster (elite tail pulls mean down)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#F57C00]/70 inline-block"></span> Median faster (slow tail pulls mean up)</span>
            </div>
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                <strong>What this reveals:</strong> Most countries have a negative gap (mean faster than median) because the hard 12h cutoff truncates the right tail — there are no 15-hour finishers to pull the mean up, but there are sub-6h runners pulling it down. Countries with a positive gap (like Lesotho) have unusually fast medians, meaning their typical runner is elite.
              </p>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
