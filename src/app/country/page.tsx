"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { getCountryDetail, getYearCountryAthletes, formatTime, formatNumber } from "@/lib/data";
import type { CountryDetailData, CountryAthlete } from "@/lib/types";
import MedalBadge from "@/components/MedalBadge";
import GreenNumberBadge from "@/components/GreenNumberBadge";

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

const medalOrder = ["Gold", "Wally Hayward", "Isavel Roche-Kelly", "Silver", "Bill Rowan", "Robert Mtshali", "Bronze", "Vic Clapham"];

function StatCard({
  label,
  value,
  sub,
  color = "text-comrades",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function CountryContent() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("name") || "";

  const [data, setData] = useState<CountryDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [yearAthletes, setYearAthletes] = useState<CountryAthlete[] | null>(null);
  const [loadingYearAthletes, setLoadingYearAthletes] = useState(false);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getCountryDetail(slug)
      .then(setData)
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-gray-400">Loading country data...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 text-center">
        <div className="text-6xl mb-4">🌍</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Country Not Found</h1>
        <p className="text-gray-500 mb-4">
          We couldn&apos;t find data for this country.
        </p>
        <Link
          href="/countries"
          className="inline-flex items-center px-4 py-2 bg-comrades text-white rounded-lg hover:bg-comrades-light transition-colors"
        >
          Browse all countries
        </Link>
      </div>
    );
  }

  const ov = data.overview;
  const series = data.yearlySeries;
  const hasMultipleYears = series.length >= 3;

  // Participation data for area chart
  const participationData = series.map((y) => ({
    year: y.year,
    male: y.male,
    female: y.female,
    total: y.finishers,
  }));

  // Gender percentage data for line chart
  const genderData = series
    .filter((y) => y.finishers > 0)
    .map((y) => ({
      year: y.year,
      femalePct: y.female > 0 ? Math.round((y.female / y.finishers) * 1000) / 10 : 0,
    }));
  const hasGenderData = genderData.some((d) => d.femalePct > 0);

  // Medal data per year for stacked bar chart
  const medalYearData = series
    .filter((y) => Object.keys(y.medals).length > 0)
    .map((y) => {
      const row: Record<string, number | string> = { year: y.year };
      for (const m of medalOrder) {
        row[m] = y.medals[m] || 0;
      }
      return row;
    });

  // Medal summary for display
  const medalSummaryEntries = medalOrder
    .filter((m) => data.medalSummary[m] > 0)
    .map((m) => ({ medal: m, count: data.medalSummary[m] }));
  const totalMedals = medalSummaryEntries.reduce((sum, e) => sum + e.count, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/countries" className="hover:text-comrades transition-colors">Countries</Link>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
        <span className="text-gray-900 font-medium">{data.flag} {data.name}</span>
      </div>

      {/* Hero card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <span className="text-5xl">{data.flag}</span>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{data.name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Comrades Marathon participation since {ov.firstYear}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total Finishers" value={formatNumber(ov.totalFinishers)} />
          <StatCard label="Unique Athletes" value={formatNumber(ov.uniqueAthletes)} />
          <StatCard label="Years Active" value={ov.yearsActive} sub={`${ov.firstYear}–${ov.latestYear}`} />
          <StatCard label="Average Time" value={formatTime(ov.avgTime)} />
          <StatCard
            label="Per Athlete"
            value={(ov.totalFinishers / ov.uniqueAthletes).toFixed(1)}
            sub="avg finishes"
          />
          <StatCard
            label="Total Medals"
            value={formatNumber(totalMedals)}
            sub={`${medalSummaryEntries.length} types`}
          />
        </div>
      </div>

      {/* Participation Over Time */}
      {hasMultipleYears && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Participation Over Time</h2>
          <p className="text-sm text-gray-500 mb-4">Male and female finishers by year</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={participationData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: any) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v} />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }}
                  formatter={(v: any, name: any) => [formatNumber(v), name === "male" ? "Men" : "Women"]}
                  labelFormatter={(l: any) => `Year: ${l}`}
                />
                <Area type="monotone" dataKey="male" stackId="1" stroke="#1565C0" fill="#1565C0" fillOpacity={0.4} name="male" />
                <Area type="monotone" dataKey="female" stackId="1" stroke="#E91E63" fill="#E91E63" fillOpacity={0.4} name="female" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Small country fallback: table instead of chart */}
      {!hasMultipleYears && series.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Yearly Results</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-xs text-gray-500">
                <th className="text-left px-4 py-2">Year</th>
                <th className="text-right px-4 py-2">Finishers</th>
                <th className="text-right px-4 py-2">Men</th>
                <th className="text-right px-4 py-2">Women</th>
                <th className="text-right px-4 py-2">Avg Time</th>
              </tr>
            </thead>
            <tbody>
              {series.map((y) => (
                <tr key={y.year} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-2 font-medium">
                    <Link href={`/year?year=${y.year}`} className="hover:text-comrades transition-colors">{y.year}</Link>
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-comrades">{formatNumber(y.finishers)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{formatNumber(y.male)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{formatNumber(y.female)}</td>
                  <td className="px-4 py-2 text-right font-mono text-gray-600">{formatTime(y.avgTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Year-by-Year Results (clickable years) */}
      {series.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Year-by-Year Results</h2>
          <p className="text-sm text-gray-500 mb-4">Click a year to view all {data.name} athletes</p>
          <div className="flex flex-wrap gap-2">
            {series.map((y) => (
              <button
                key={y.year}
                onClick={() => {
                  if (selectedYear === y.year) {
                    setSelectedYear(null);
                    setYearAthletes(null);
                  } else {
                    setSelectedYear(y.year);
                    setYearAthletes(null);
                    setLoadingYearAthletes(true);
                    getYearCountryAthletes(y.year).then((ca) => {
                      if (ca && ca[data.name]) {
                        setYearAthletes(ca[data.name]);
                      } else {
                        setYearAthletes([]);
                      }
                      setLoadingYearAthletes(false);
                    });
                  }
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded transition-colors ${
                  selectedYear === y.year
                    ? "bg-comrades text-white"
                    : "bg-gray-50 hover:bg-comrades/10 text-gray-600 hover:text-comrades"
                }`}
              >
                {y.year} <span className={selectedYear === y.year ? "text-white/70" : "text-gray-400"}>({formatNumber(y.finishers)})</span>
              </button>
            ))}
          </div>

          {/* Expanded athlete list for selected year */}
          {selectedYear && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  {data.name} — {selectedYear}
                  <span className="text-gray-400 font-normal ml-2">
                    ({formatNumber(series.find((y) => y.year === selectedYear)?.finishers || 0)} finishers)
                  </span>
                </h3>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/year?year=${selectedYear}`}
                    className="text-xs text-comrades hover:underline"
                  >
                    View full year page →
                  </Link>
                  <button onClick={() => { setSelectedYear(null); setYearAthletes(null); }} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                </div>
              </div>
              {loadingYearAthletes ? (
                <div className="py-6 text-center text-gray-400 animate-pulse text-sm">Loading athletes...</div>
              ) : yearAthletes && yearAthletes.length > 0 ? (
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-gray-200 text-xs text-gray-500">
                        <th className="text-left py-2 pr-3">Pos</th>
                        <th className="text-left py-2 pr-3">Name</th>
                        <th className="text-left py-2 pr-3">Time</th>
                        <th className="text-left py-2 pr-3">Gender Pos</th>
                        <th className="text-left py-2 pr-3">Medal</th>
                        <th className="text-left py-2">Gender</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yearAthletes.map((a: CountryAthlete, i: number) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="py-1.5 pr-3 text-gray-400 font-medium">{a.pos > 0 ? `#${formatNumber(a.pos)}` : "-"}</td>
                          <td className="py-1.5 pr-3 font-medium text-gray-900">
                            <Link href={`/runner?id=${a.athleteId}`} className="hover:text-comrades transition-colors">
                              {a.name}
                            </Link>
                          </td>
                          <td className="py-1.5 pr-3 font-mono text-comrades">{formatTime(a.time)}</td>
                          <td className="py-1.5 pr-3 text-gray-500">{a.genderPos > 0 ? `#${formatNumber(a.genderPos)}` : "-"}</td>
                          <td className="py-1.5 pr-3"><MedalBadge medal={a.medal} size="sm" /></td>
                          <td className="py-1.5 text-gray-400">{a.gender === "F" ? "♀" : "♂"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-4 text-center text-gray-400 text-sm">No athlete data available for {data.name} in {selectedYear}.</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Gender Trend */}
      {hasGenderData && hasMultipleYears && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Female Participation Trend</h2>
          <p className="text-sm text-gray-500 mb-4">Percentage of female finishers over time</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={genderData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: any) => `${v}%`} />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }}
                  formatter={(v: any) => [`${v}%`, "Female %"]}
                  labelFormatter={(l: any) => `Year: ${l}`}
                />
                <Line type="monotone" dataKey="femalePct" stroke="#E91E63" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Medals Over Time */}
      {medalYearData.length >= 3 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Medal Distribution Over Time</h2>
          <p className="text-sm text-gray-500 mb-4">Breakdown of medal types earned each year</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={medalYearData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: any) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v} />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }}
                  formatter={(v: any, name: any) => [formatNumber(v), name]}
                  labelFormatter={(l: any) => `Year: ${l}`}
                />
                {medalOrder.map((m) => (
                  <Bar key={m} dataKey={m} stackId="medals" fill={MEDAL_CHART_COLORS[m]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Medal Summary */}
      {medalSummaryEntries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Medal Summary</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {medalSummaryEntries.map((e) => (
              <div key={e.medal} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                <MedalBadge medal={e.medal} />
                <div>
                  <div className="font-bold text-gray-900">{formatNumber(e.count)}</div>
                  <div className="text-[10px] text-gray-500">{Math.round((e.count / totalMedals) * 100)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Runners */}
      {data.topRunners.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Top Runners</h2>
            <p className="text-sm text-gray-500">Most finishes from {data.name}</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-xs text-gray-500">
                <th className="text-left px-4 py-2 w-10">#</th>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-right px-4 py-2">Finishes</th>
                <th className="text-right px-4 py-2">Best Time</th>
              </tr>
            </thead>
            <tbody>
              {data.topRunners.map((r, i) => (
                <tr key={r.athleteId} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-2.5 text-gray-400 font-medium">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/runner?id=${r.athleteId}`}
                      className="font-medium text-gray-900 hover:text-comrades transition-colors"
                    >
                      {r.name}
                    </Link>
                    {r.finishes >= 10 && (
                      <span className="ml-1.5"><GreenNumberBadge finishes={r.finishes} size="sm" /></span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-comrades">{r.finishes}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-600">{formatTime(r.bestTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Podium Finishes — Men and Women side by side */}
      {(data.podiumsMen.length > 0 || data.podiumsWomen.length > 0) && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Podium Finishes</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Men's Podiums */}
            {data.podiumsMen.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                  <h3 className="text-sm font-semibold text-gray-700">Men&apos;s Top 3</h3>
                  <p className="text-xs text-gray-500">Overall position</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500">
                      <th className="text-left px-4 py-2">Year</th>
                      <th className="text-left px-4 py-2">Name</th>
                      <th className="text-center px-4 py-2">Pos</th>
                      <th className="text-right px-4 py-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.podiumsMen.map((p, i) => (
                      <tr key={`m-${p.year}-${p.pos}-${i}`} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-2 font-medium">
                          <Link href={`/year?year=${p.year}`} className="hover:text-comrades transition-colors">{p.year}</Link>
                        </td>
                        <td className="px-4 py-2">
                          <Link href={`/runner?id=${p.athleteId}`} className="font-medium text-gray-900 hover:text-comrades transition-colors">
                            {p.name}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            p.pos === 1 ? "bg-yellow-100 text-yellow-800" :
                            p.pos === 2 ? "bg-gray-100 text-gray-700" :
                            "bg-amber-100 text-amber-800"
                          }`}>
                            {p.pos}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-comrades font-bold">{formatTime(p.time)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Women's Podiums */}
            {data.podiumsWomen.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-pink-50/50">
                  <h3 className="text-sm font-semibold text-pink-700">Women&apos;s Top 3</h3>
                  <p className="text-xs text-gray-500">Gender position</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500">
                      <th className="text-left px-4 py-2">Year</th>
                      <th className="text-left px-4 py-2">Name</th>
                      <th className="text-center px-4 py-2">Pos</th>
                      <th className="text-right px-4 py-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.podiumsWomen.map((p, i) => (
                      <tr key={`w-${p.year}-${p.pos}-${i}`} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-2 font-medium">
                          <Link href={`/year?year=${p.year}`} className="hover:text-comrades transition-colors">{p.year}</Link>
                        </td>
                        <td className="px-4 py-2">
                          <Link href={`/runner?id=${p.athleteId}`} className="font-medium text-gray-900 hover:text-comrades transition-colors">
                            {p.name}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            p.pos === 1 ? "bg-yellow-100 text-yellow-800" :
                            p.pos === 2 ? "bg-gray-100 text-gray-700" :
                            "bg-amber-100 text-amber-800"
                          }`}>
                            {p.pos}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-comrades font-bold">{formatTime(p.time)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Back link */}
      <div className="text-center mt-6 mb-8">
        <Link href="/countries" className="text-sm text-gray-500 hover:text-comrades transition-colors">
          ← All countries
        </Link>
      </div>
    </div>
  );
}

export default function CountryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      }
    >
      <CountryContent />
    </Suspense>
  );
}
