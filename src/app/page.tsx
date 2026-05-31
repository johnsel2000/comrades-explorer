"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { getStats, getYears, getLeaderboards, getRecords, formatNumber, formatTime } from "@/lib/data";
import type { Stats, YearData, Leaderboards, RecordsData } from "@/lib/types";

function QuickSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    },
    [query, router]
  );

  return (
    <form onSubmit={handleSubmit} className="relative max-w-xl mx-auto">
      <svg
        className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
        fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for any runner... e.g. 'Bruce Fordyce'"
        className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-300 bg-white text-base focus:outline-none focus:ring-2 focus:ring-comrades/30 focus:border-comrades transition-all"
      />
      <button
        type="submit"
        className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-comrades text-white rounded-lg text-sm font-medium hover:bg-comrades-light transition-colors"
      >
        Search
      </button>
    </form>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl sm:text-3xl font-bold text-comrades">{value}</div>
      <div className="text-sm font-medium text-gray-600 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

interface FeatureCardProps {
  href: string;
  icon: string;
  title: string;
  description: string;
  accent?: string;
}

function FeatureCard({ href, icon, title, description, accent = "comrades" }: FeatureCardProps) {
  const borderClass = accent === "gold" ? "hover:border-yellow-400"
    : accent === "rose" ? "hover:border-rose-400"
    : accent === "purple" ? "hover:border-purple-400"
    : accent === "blue" ? "hover:border-blue-400"
    : accent === "orange" ? "hover:border-orange-400"
    : accent === "emerald" ? "hover:border-emerald-400"
    : "hover:border-comrades";
  return (
    <Link
      href={href}
      className={`bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-all group ${borderClass}`}
    >
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-base font-semibold text-gray-900 group-hover:text-comrades transition-colors">{title}</div>
      <div className="text-sm text-gray-500 mt-1 leading-relaxed">{description}</div>
    </Link>
  );
}

interface StoryTeaserProps {
  href: string;
  label: string;
  headline: string;
  detail: string;
  accent: string;
}

function StoryTeaser({ href, label, headline, detail, accent }: StoryTeaserProps) {
  const bgClass = accent === "gold" ? "bg-yellow-50 border-yellow-200"
    : accent === "rose" ? "bg-rose-50 border-rose-200"
    : accent === "orange" ? "bg-orange-50 border-orange-200"
    : accent === "purple" ? "bg-purple-50 border-purple-200"
    : "bg-emerald-50 border-emerald-200";
  const labelClass = accent === "gold" ? "text-yellow-700"
    : accent === "rose" ? "text-rose-600"
    : accent === "orange" ? "text-orange-600"
    : accent === "purple" ? "text-purple-600"
    : "text-emerald-600";
  return (
    <Link href={href} className={`block rounded-xl border p-4 hover:shadow-md transition-all ${bgClass}`}>
      <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${labelClass}`}>{label}</div>
      <div className="text-sm font-semibold text-gray-900">{headline}</div>
      <div className="text-xs text-gray-600 mt-1">{detail}</div>
    </Link>
  );
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [years, setYears] = useState<YearData[]>([]);
  const [leaderboards, setLeaderboards] = useState<Leaderboards | null>(null);
  const [records, setRecords] = useState<RecordsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStats(), getYears(), getLeaderboards(), getRecords()])
      .then(([s, y, l, r]) => {
        setStats(s);
        setYears(y);
        setLeaderboards(l);
        setRecords(r);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!stats || !leaderboards) return null;

  const chartData = years
    .filter((y) => !y.cancelled && y.year < 2026)
    .map((y) => ({
      year: y.year,
      starters: y.starters || y.totalEntries || 0,
      finishers: y.finishers || y.officialFinishers || 0,
    }));

  const topRunner = leaderboards.mostFinishes[0];
  const fastestTime = leaderboards.fastestTimes[0];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      {/* ============================================================ */}
      {/* HERO */}
      {/* ============================================================ */}
      <div className="text-center space-y-4 pt-6 pb-2">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">
          Comrades Marathon <span className="text-comrades">Explorer</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
          Every runner, every race, every story — from the first 34 finishers in 1921
          to over 18,000 in 2025. Explore a century of the world&apos;s greatest ultramarathon.
        </p>

        {/* Quick search */}
        <div className="pt-2">
          <QuickSearch />
        </div>
      </div>

      {/* ============================================================ */}
      {/* HEADLINE STATS */}
      {/* ============================================================ */}
      <div className="bg-gradient-to-r from-comrades/5 via-emerald-50 to-comrades/5 rounded-2xl border border-comrades/10 py-6 px-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
          <StatCard
            label="Total Finishes"
            value={`${(stats.totalFinishes / 1000).toFixed(0)}K+`}
          />
          <StatCard
            label="Unique Athletes"
            value={`${((stats.maleAthletes + stats.femaleAthletes) / 1000).toFixed(0)}K`}
          />
          <StatCard
            label="Races Held"
            value={String(stats.racesHeld)}
            sub={`${stats.yearRange[0]}–${stats.yearRange[1]}`}
          />
          <StatCard
            label="Countries"
            value={String(stats.countries)}
          />
          <StatCard
            label="Years of History"
            value={String(stats.yearRange[1] - stats.yearRange[0] + 1)}
          />
        </div>
      </div>

      {/* ============================================================ */}
      {/* STORY TEASERS — the hook */}
      {/* ============================================================ */}
      {records && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Stories You Won&apos;t Believe</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StoryTeaser
              href="/records#wally"
              label="20-Year Comeback"
              headline="Won in 1930. Won again in 1950."
              detail="Wally Hayward's legend spans five victories and 59 years of Comrades history."
              accent="gold"
            />
            <StoryTeaser
              href="/records#nevergaveup"
              label="Never Gave Up"
              headline={`${records.neverGaveUp[0]?.dnfCount} DNFs before a finish`}
              detail={`${records.neverGaveUp[0]?.name} failed to finish ${records.neverGaveUp[0]?.dnfCount} times — then finally crossed the line in ${records.neverGaveUp[0]?.finishYear}.`}
              accent="orange"
            />
            <StoryTeaser
              href="/records#margins"
              label="Photo Finish"
              headline={`Won by ${records.narrowestMargins[0]?.marginSeconds === 1 ? "1 second" : `${records.narrowestMargins[0]?.marginSeconds} seconds`}`}
              detail={`After 90km of racing in ${records.narrowestMargins[0]?.year}, ${records.narrowestMargins[0]?.winner} beat ${records.narrowestMargins[0]?.runnerUp} by a heartbeat.`}
              accent="rose"
            />
            <StoryTeaser
              href="/records#pioneers"
              label="Women Pioneers"
              headline="Alone in a field of men"
              detail="Frances Hayward finished in 1923. It was 42 years before another woman would."
              accent="purple"
            />
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* FEATURED RECORDS */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href={`/runner?id=${topRunner.athleteId}`}
          className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow group"
        >
          <div className="text-xs font-medium text-comrades uppercase tracking-wide mb-2">
            Most Finishes Ever
          </div>
          <div className="text-xl font-bold text-gray-900 group-hover:text-comrades transition-colors">
            {topRunner.name}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl font-bold text-comrades">{topRunner.finishes}</span>
            <span className="text-sm text-gray-500">
              finishes ({topRunner.firstYear}–{topRunner.lastYear})
            </span>
          </div>
        </Link>

        <Link
          href="/leaderboards"
          className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow group"
        >
          <div className="text-xs font-medium text-comrades uppercase tracking-wide mb-2">
            Fastest Winning Time
          </div>
          <div className="text-xl font-bold text-gray-900 group-hover:text-comrades transition-colors">{fastestTime.name}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl font-bold text-comrades">
              {formatTime(fastestTime.time)}
            </span>
            <span className="text-sm text-gray-500">
              in {fastestTime.year} ({fastestTime.direction})
            </span>
          </div>
        </Link>

        {records && records.consecutiveFinishes[0] && (
          <Link
            href="/records#streaks"
            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow group"
          >
            <div className="text-xs font-medium text-comrades uppercase tracking-wide mb-2">
              Iron Streak Record
            </div>
            <div className="text-xl font-bold text-gray-900 group-hover:text-comrades transition-colors">
              {records.consecutiveFinishes[0].name}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-bold text-comrades">{records.consecutiveFinishes[0].streak}</span>
              <span className="text-sm text-gray-500">
                consecutive finishes ({records.consecutiveFinishes[0].startYear}–{records.consecutiveFinishes[0].endYear})
              </span>
            </div>
          </Link>
        )}
      </div>

      {/* ============================================================ */}
      {/* GROWTH CHART */}
      {/* ============================================================ */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            From 34 Finishers to 18,000+
          </h2>
          <Link
            href="/years"
            className="text-xs text-comrades hover:underline"
          >
            View all years &rarr;
          </Link>
        </div>
        <div className="h-64 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <defs>
                <linearGradient id="colorStarters" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1B5E20" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1B5E20" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorFinishers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FFD700" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#FFD700" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#e5e5e5" }}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid #e5e5e5",
                  fontSize: "13px",
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => [
                  formatNumber(Number(value)),
                  name === "starters" ? "Starters" : "Finishers",
                ]}
              />
              <Area
                type="monotone"
                dataKey="starters"
                stroke="#1B5E20"
                strokeWidth={2}
                fill="url(#colorStarters)"
                name="starters"
              />
              <Area
                type="monotone"
                dataKey="finishers"
                stroke="#DAA520"
                strokeWidth={2}
                fill="url(#colorFinishers)"
                name="finishers"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-comrades rounded" /> Starters
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#DAA520] rounded" /> Finishers
          </span>
        </div>
      </div>

      {/* ============================================================ */}
      {/* EXPLORE — feature cards */}
      {/* ============================================================ */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Explore</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureCard
            href="/search"
            icon="🔍"
            title="Runner Search"
            description="Look up any runner across 100+ years. See their complete race history, medals, times, and career stats."
          />
          <FeatureCard
            href="/years"
            icon="📅"
            title="Year-by-Year"
            description="Dive into any race year — see podiums, medal distributions, weather, field size, and historical context."
            accent="blue"
          />
          <FeatureCard
            href="/leaderboards"
            icon="🏆"
            title="Leaderboards"
            description="Most finishes, fastest times, top clubs, and dominant women's performers. Who are the all-time greats?"
            accent="gold"
          />
          <FeatureCard
            href="/countries"
            icon="🌍"
            title="Country Explorer"
            description={`Athletes from ${stats.countries} countries have finished Comrades. Explore each nation's history and top performers.`}
            accent="emerald"
          />
          <FeatureCard
            href="/insights"
            icon="📊"
            title="Data Insights"
            description="The green number effect, Up vs Down analysis, medal clustering, and hidden patterns in a century of race data."
            accent="purple"
          />
          <FeatureCard
            href="/records"
            icon="⚡"
            title="Records & Stories"
            description="Wally Hayward's 20-year comeback, 1-second margins, iron streaks, women pioneers, and athletes who never gave up."
            accent="orange"
          />
        </div>
      </div>

      {/* ============================================================ */}
      {/* BOTTOM CTA */}
      {/* ============================================================ */}
      <div className="bg-comrades rounded-2xl p-8 text-center text-white">
        <h2 className="text-2xl font-bold mb-2">Find Your Runner</h2>
        <p className="text-white/80 mb-5 max-w-lg mx-auto">
          Whether it&apos;s you, a friend, or a family member — search our database
          of {formatNumber(stats.totalFinishes)}+ finishes to find their complete Comrades history.
        </p>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 px-6 py-3 bg-white text-comrades rounded-xl font-semibold hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          Search Runners
        </Link>
      </div>
    </div>
  );
}
