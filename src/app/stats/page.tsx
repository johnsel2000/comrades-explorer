"use client";

import { useEffect, useState, useMemo } from "react";
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { getYears, getStats, formatNumber } from "@/lib/data";
import type { YearData, Stats } from "@/lib/types";

const MEDAL_CHART_COLORS: Record<string, string> = {
  Gold: "#FFD700",
  "Wally Hayward": "#7B1FA2",
  "Isavel Roche-Kelly": "#1565C0",
  Silver: "#A8A8A8",
  "Bill Rowan": "#E65100",
  "Robert Mtshali": "#00695C",
  Bronze: "#CD7F32",
  "Vic Clapham": "#4E342E",
};

export default function StatsPage() {
  const [years, setYears] = useState<YearData[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getYears(), getStats()])
      .then(([y, s]) => {
        setYears(y);
        setStats(s);
      })
      .finally(() => setLoading(false));
  }, []);

  const chartYears = useMemo(
    () => years.filter((y) => !y.cancelled && y.year < 2026 && y.finishers > 0),
    [years]
  );

  // Growth chart data
  const growthData = useMemo(
    () =>
      chartYears.map((y) => ({
        year: y.year,
        starters: y.starters || y.totalEntries || 0,
        finishers: y.finishers || y.officialFinishers || 0,
      })),
    [chartYears]
  );

  // Gender participation data
  const genderData = useMemo(
    () =>
      chartYears
        .filter((y) => y.year >= 1975) // Women allowed from 1975
        .map((y) => ({
          year: y.year,
          men: y.maleFinishers || 0,
          women: y.femaleFinishers || 0,
          womenPct:
            y.maleFinishers && y.femaleFinishers
              ? Math.round(
                  (y.femaleFinishers / (y.maleFinishers + y.femaleFinishers)) * 1000
                ) / 10
              : 0,
        })),
    [chartYears]
  );

  // Medal distribution data (stacked area)
  const medalData = useMemo(() => {
    const medalTypes = [
      "Gold", "Wally Hayward", "Isavel Roche-Kelly", "Silver",
      "Bill Rowan", "Robert Mtshali", "Bronze", "Vic Clapham",
    ];
    return chartYears.map((y) => {
      const entry: Record<string, number> = { year: y.year };
      for (const m of medalTypes) {
        entry[m] = y.medals[m] || 0;
      }
      return entry;
    });
  }, [chartYears]);

  // Finish rate data
  const finishRateData = useMemo(
    () =>
      chartYears
        .filter((y) => y.finishRate && y.finishRate > 0)
        .map((y) => ({
          year: y.year,
          finishRate: y.finishRate,
          direction: y.direction || "Unknown",
        })),
    [chartYears]
  );

  // Up vs Down comparison
  const directionData = useMemo(() => {
    const up = chartYears.filter((y) => y.direction === "Up" && y.finishRate);
    const down = chartYears.filter((y) => y.direction === "Down" && y.finishRate);

    const avgRate = (arr: YearData[]) =>
      arr.length > 0
        ? arr.reduce((s, y) => s + (y.finishRate || 0), 0) / arr.length
        : 0;

    const avgFinishers = (arr: YearData[]) =>
      arr.length > 0
        ? arr.reduce((s, y) => s + y.finishers, 0) / arr.length
        : 0;

    return [
      {
        direction: "Up",
        avgFinishRate: Math.round(avgRate(up) * 10) / 10,
        avgFinishers: Math.round(avgFinishers(up)),
        races: up.length,
      },
      {
        direction: "Down",
        avgFinishRate: Math.round(avgRate(down) * 10) / 10,
        avgFinishers: Math.round(avgFinishers(down)),
        races: down.length,
      },
    ];
  }, [chartYears]);

  // Fun stats
  const funStats = useMemo(() => {
    if (chartYears.length === 0) return null;

    const withRates = chartYears.filter((y) => y.finishRate && y.finishRate > 0);
    const toughest = withRates.length > 0
      ? withRates.reduce((min, y) => (y.finishRate! < min.finishRate! ? y : min))
      : null;
    const easiest = withRates.length > 0
      ? withRates.reduce((max, y) => (y.finishRate! > max.finishRate! ? y : max))
      : null;

    const biggest = chartYears.reduce((max, y) => {
      const s = y.starters || y.totalEntries || 0;
      const ms = max.starters || max.totalEntries || 0;
      return s > ms ? y : max;
    });

    const smallest = chartYears
      .filter((y) => y.year > 1930)
      .reduce((min, y) => {
        const s = y.starters || y.totalEntries || 0;
        const ms = min.starters || min.totalEntries || 0;
        return s > 0 && s < ms ? y : min;
      });

    return { toughest, easiest, biggest, smallest };
  }, [chartYears]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-gray-400">Loading stats...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Stats & Charts</h1>
        <p className="text-gray-500">
          A century of data from the world&apos;s greatest ultramarathon.
        </p>
      </div>

      {/* Fun stats cards */}
      {funStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {funStats.toughest && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs font-medium text-red-600 uppercase tracking-wide mb-1">
                Toughest Year
              </div>
              <div className="text-2xl font-bold text-gray-900">{funStats.toughest.year}</div>
              <div className="text-sm text-gray-500">
                {funStats.toughest.finishRate?.toFixed(1)}% finish rate
              </div>
            </div>
          )}
          {funStats.easiest && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">
                Highest Finish Rate
              </div>
              <div className="text-2xl font-bold text-gray-900">{funStats.easiest.year}</div>
              <div className="text-sm text-gray-500">
                {funStats.easiest.finishRate?.toFixed(1)}% finish rate
              </div>
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs font-medium text-comrades uppercase tracking-wide mb-1">
              Biggest Field
            </div>
            <div className="text-2xl font-bold text-gray-900">{funStats.biggest.year}</div>
            <div className="text-sm text-gray-500">
              {formatNumber(funStats.biggest.starters || funStats.biggest.totalEntries)} starters
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">
              Smallest Field (post-1930)
            </div>
            <div className="text-2xl font-bold text-gray-900">{funStats.smallest.year}</div>
            <div className="text-sm text-gray-500">
              {formatNumber(funStats.smallest.starters || funStats.smallest.totalEntries)} starters
            </div>
          </div>
        </div>
      )}

      {/* Gender stats cards */}
      {stats && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Gender Breakdown</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-700">{formatNumber(stats.maleAthletes)}</div>
              <div className="text-xs text-blue-600 mt-0.5">Male Athletes</div>
            </div>
            <div className="bg-pink-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-pink-700">{formatNumber(stats.femaleAthletes)}</div>
              <div className="text-xs text-pink-600 mt-0.5">Female Athletes</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-700">{formatNumber(stats.maleFinishes)}</div>
              <div className="text-xs text-blue-600 mt-0.5">Male Finishes</div>
            </div>
            <div className="bg-pink-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-pink-700">{formatNumber(stats.femaleFinishes)}</div>
              <div className="text-xs text-pink-600 mt-0.5">Female Finishes</div>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-gray-500">Women as % of all finishers</span>
              <span className="text-xs font-bold text-pink-600">
                {((stats.femaleFinishes / stats.totalFinishes) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-3 bg-blue-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-pink-400 rounded-full"
                style={{
                  width: `${(stats.femaleFinishes / stats.totalFinishes) * 100}%`,
                  marginLeft: `${((stats.totalFinishes - stats.femaleFinishes) / stats.totalFinishes) * 100}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>Men ({((stats.maleFinishes / stats.totalFinishes) * 100).toFixed(1)}%)</span>
              <span>Women ({((stats.femaleFinishes / stats.totalFinishes) * 100).toFixed(1)}%)</span>
            </div>
          </div>
        </div>
      )}

      {/* Race Growth */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Race Growth</h2>
        <p className="text-sm text-gray-500 mb-4">
          Starters and finishers from 1921 to 2025. Gaps during World War II (1941–1945) and COVID-19 (2020–2021).
        </p>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={growthData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <defs>
                <linearGradient id="gStarters" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1B5E20" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1B5E20" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gFinishers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FFD700" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#FFD700" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              />
              <Tooltip
                contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5", fontSize: "13px" }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => [
                  formatNumber(Number(value)),
                  name === "starters" ? "Starters" : "Finishers",
                ]}
              />
              <Area type="monotone" dataKey="starters" stroke="#1B5E20" strokeWidth={2} fill="url(#gStarters)" />
              <Area type="monotone" dataKey="finishers" stroke="#DAA520" strokeWidth={2} fill="url(#gFinishers)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-comrades rounded" /> Starters</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#DAA520] rounded" /> Finishers</span>
        </div>
      </div>

      {/* Women's Participation Growth */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Women&apos;s Participation</h2>
        <p className="text-sm text-gray-500 mb-4">
          Women first competed in Comrades in 1975. Their participation has grown steadily ever since.
        </p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={genderData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <defs>
                <linearGradient id="gMen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gWomen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EC4899" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#EC4899" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              />
              <Tooltip
                contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5", fontSize: "13px" }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => [
                  formatNumber(Number(value)),
                  name === "men" ? "Men" : "Women",
                ]}
              />
              <Area type="monotone" dataKey="men" stroke="#3B82F6" strokeWidth={2} fill="url(#gMen)" />
              <Area type="monotone" dataKey="women" stroke="#EC4899" strokeWidth={2} fill="url(#gWomen)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-500 rounded" /> Men</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-pink-500 rounded" /> Women</span>
        </div>
      </div>

      {/* Women's Percentage Over Time */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Women as Percentage of Finishers</h2>
        <p className="text-sm text-gray-500 mb-4">
          From a single pioneer in 1975 to nearly 20% of the field today.
        </p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={genderData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis
                domain={[0, 25]}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5", fontSize: "13px" }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [`${Number(value).toFixed(1)}%`, "Women %"]}
              />
              <Line
                type="monotone"
                dataKey="womenPct"
                stroke="#EC4899"
                strokeWidth={2}
                dot={{ r: 2, fill: "#EC4899" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Medal Distribution */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Medal Distribution Over Time</h2>
        <p className="text-sm text-gray-500 mb-4">
          How the different medal categories have grown as the field expanded.
        </p>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={medalData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              />
              <Tooltip
                contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5", fontSize: "12px" }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => [formatNumber(Number(value)), name]}
              />
              {Object.entries(MEDAL_CHART_COLORS).reverse().map(([medal, color]) => (
                <Area
                  key={medal}
                  type="monotone"
                  dataKey={medal}
                  stackId="1"
                  stroke={color}
                  fill={color}
                  fillOpacity={0.7}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
          {Object.entries(MEDAL_CHART_COLORS).map(([medal, color]) => (
            <span key={medal} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
              {medal}
            </span>
          ))}
        </div>
      </div>

      {/* Finish Rate */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Finish Rate Trends</h2>
        <p className="text-sm text-gray-500 mb-4">
          Percentage of starters who finished. Lower rates indicate tougher conditions.
        </p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={finishRateData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5", fontSize: "13px" }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [`${Number(value).toFixed(1)}%`, "Finish Rate"]}
                labelFormatter={(year) => {
                  const yd = finishRateData.find((d) => d.year === year);
                  return `${year} (${yd?.direction || "Unknown"})`;
                }}
              />
              <Line
                type="monotone"
                dataKey="finishRate"
                stroke="#1B5E20"
                strokeWidth={2}
                dot={{ r: 2, fill: "#1B5E20" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Up vs Down */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Up vs Down</h2>
        <p className="text-sm text-gray-500 mb-4">
          The Comrades alternates between &quot;Up&quot; (Durban → Pietermaritzburg) and &quot;Down&quot;
          (Pietermaritzburg → Durban) each year. How do they compare?
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {directionData.map((d) => (
            <div
              key={d.direction}
              className={`rounded-xl p-6 ${
                d.direction === "Up"
                  ? "bg-red-50 border border-red-100"
                  : "bg-blue-50 border border-blue-100"
              }`}
            >
              <div className="flex items-center gap-2 mb-4">
                <span
                  className={`text-2xl ${d.direction === "Up" ? "text-red-500" : "text-blue-500"}`}
                >
                  {d.direction === "Up" ? "↑" : "↓"}
                </span>
                <span className="text-xl font-bold text-gray-900">{d.direction} Run</span>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-gray-500">Average Finish Rate</div>
                  <div className="text-2xl font-bold text-gray-900">{d.avgFinishRate}%</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Average Finishers</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatNumber(d.avgFinishers)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Races Held</div>
                  <div className="text-2xl font-bold text-gray-900">{d.races}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
