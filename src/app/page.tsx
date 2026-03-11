"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { getStats, getYears, getLeaderboards, formatNumber, formatTime } from "@/lib/data";
import type { Stats, YearData, Leaderboards } from "@/lib/types";
import MedalBadge from "@/components/MedalBadge";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 text-center hover:shadow-md transition-shadow">
      <div className="text-3xl font-bold text-comrades">{value}</div>
      <div className="text-sm font-medium text-gray-600 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

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
        placeholder="Search for a runner... e.g. 'Dave Rogers'"
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

function GrowthChart({ years }: { years: YearData[] }) {
  const chartData = years
    .filter((y) => !y.cancelled && y.year < 2026)
    .map((y) => ({
      year: y.year,
      starters: y.starters || y.totalEntries || 0,
      finishers: y.finishers || y.officialFinishers || 0,
    }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        100+ Years of Comrades
      </h2>
      <div className="h-72">
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
  );
}

function RecordCards({ leaderboards, years }: { leaderboards: Leaderboards; years: YearData[] }) {
  const topRunner = leaderboards.mostFinishes[0];
  const fastestTime = leaderboards.fastestTimes[0];

  // Find biggest field
  const biggestField = years
    .filter((y) => !y.cancelled && y.year < 2026)
    .reduce(
      (max, y) => {
        const starters = y.starters || y.totalEntries || 0;
        return starters > max.starters ? { year: y.year, starters } : max;
      },
      { year: 0, starters: 0 }
    );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Link
        href={`/runner?id=${topRunner.athleteId}`}
        className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow group"
      >
        <div className="text-xs font-medium text-comrades uppercase tracking-wide mb-2">
          Most Finishes
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
        <MedalBadge medal={topRunner.bestMedal} size="sm" />
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
        <div className="text-xs font-medium text-comrades uppercase tracking-wide mb-2">
          Fastest Winning Time
        </div>
        <div className="text-xl font-bold text-gray-900">{fastestTime.name}</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-2xl font-bold text-comrades">
            {formatTime(fastestTime.time)}
          </span>
          <span className="text-sm text-gray-500">
            in {fastestTime.year} ({fastestTime.direction})
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
        <div className="text-xs font-medium text-comrades uppercase tracking-wide mb-2">
          Biggest Field
        </div>
        <div className="text-2xl font-bold text-comrades">
          {formatNumber(biggestField.starters)}
        </div>
        <div className="text-sm text-gray-500 mt-1">
          starters in {biggestField.year}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [years, setYears] = useState<YearData[]>([]);
  const [leaderboards, setLeaderboards] = useState<Leaderboards | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStats(), getYears(), getLeaderboards()])
      .then(([s, y, l]) => {
        setStats(s);
        setYears(y);
        setLeaderboards(l);
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

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Hero */}
      <div className="text-center space-y-3 pt-4 pb-2">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900">
          Comrades Marathon <span className="text-comrades">Explorer</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto">
          Explore 100+ years of the world&apos;s greatest ultramarathon.
          Search runners, discover records, and dive into the data.
        </p>
      </div>

      {/* Quick search */}
      <QuickSearch />

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <StatCard
          label="Total Finishes"
          value={`${(stats.totalFinishes / 1000).toFixed(0)}K+`}
          sub={`of ${formatNumber(stats.totalResults)} entries`}
        />
        <StatCard
          label="Men"
          value={`${(stats.maleAthletes / 1000).toFixed(0)}K`}
          sub={`${formatNumber(stats.maleFinishes)} finishes`}
        />
        <StatCard
          label="Women"
          value={`${(stats.femaleAthletes / 1000).toFixed(0)}K`}
          sub={`${formatNumber(stats.femaleFinishes)} finishes`}
        />
        <StatCard
          label="Years of Data"
          value={String(stats.racesHeld)}
          sub={`${stats.yearRange[0]}–${stats.yearRange[1]}`}
        />
        <StatCard
          label="Countries"
          value={String(stats.countries)}
        />
      </div>

      {/* Growth chart */}
      <GrowthChart years={years} />

      {/* Featured records */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Records & Highlights</h2>
        <RecordCards leaderboards={leaderboards} years={years} />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4">
        <Link
          href="/search"
          className="bg-comrades text-white rounded-xl p-5 hover:bg-comrades-light transition-colors"
        >
          <div className="text-lg font-semibold">Search Runners</div>
          <div className="text-sm text-white/80 mt-1">
            Find any runner from 100+ years of results
          </div>
        </Link>
        <Link
          href="/leaderboards"
          className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
        >
          <div className="text-lg font-semibold text-gray-900">Leaderboards</div>
          <div className="text-sm text-gray-500 mt-1">
            Most finishes, fastest times, top clubs
          </div>
        </Link>
        <Link
          href="/stats"
          className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
        >
          <div className="text-lg font-semibold text-gray-900">Stats & Charts</div>
          <div className="text-sm text-gray-500 mt-1">
            Race growth, medal trends, finish rates
          </div>
        </Link>
      </div>
    </div>
  );
}
