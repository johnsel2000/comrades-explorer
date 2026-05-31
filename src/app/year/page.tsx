"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { getYearDetail, getYears, getYearCountryAthletes, formatTime, formatNumber, slugifyCountry } from "@/lib/data";
import type { YearDetailData, YearData, CountryAthletes, CountryAthlete } from "@/lib/types";
import MedalBadge from "@/components/MedalBadge";
import RecordBadges from "@/components/RecordBadges";

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

const TIME_BUCKET_COLOR = "#1B5E20";

/* Special editorial notes for specific years — displayed as a prominent callout */
const YEAR_NOTES: Record<number, { title: string; body: string; linkedRunners?: { name: string; id: string }[] }> = {
  1992: {
    title: "The Only Revoked Victory in Comrades History",
    body: "Charl Mattheus crossed the line first in 5:29:49, but was subsequently disqualified after testing positive for a banned stimulant — a substance that was later removed from the prohibited list. Jetman Msuthu, who finished second on the day, was declared the winner. Msuthu never carried the winner's baton and may be the only Comrades champion who did not learn he had won on race day itself. The disqualification remains controversial: Mattheus went on to finish 2nd in 1995, win outright in 1997, and finish 2nd again in 1998 — proving beyond doubt that he was one of the finest runners of his generation.",
    linkedRunners: [
      { name: "Charl Mattheus", id: "FBEEA608-B6B8-4F59-8AAE-CDE3BBC37579" },
      { name: "Jetman Msuthu", id: "185CEF6E-BE46-4867-84B3-EF9F1C6A9330" },
    ],
  },
};

const AGE_COLORS: Record<string, string> = {
  Senior: "#1B5E20",
  "40-49": "#F57C00",
  "50-59": "#1565C0",
  "60+": "#7B1FA2",
};

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

function ordinal(n: number): string {
  if (n === 0) return "-";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function DeltaCard({
  label,
  delta,
  unit = "",
  invert = false,
}: {
  label: string;
  delta: number;
  unit?: string;
  invert?: boolean;
}) {
  const isPositive = invert ? delta < 0 : delta > 0;
  const isNegative = invert ? delta > 0 : delta < 0;
  const color = isPositive ? "text-green-700" : isNegative ? "text-red-600" : "text-gray-600";
  const sign = delta > 0 ? "+" : "";
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <div className={`text-lg font-bold ${color}`}>
        {sign}{typeof delta === "number" && Math.abs(delta) > 60 && unit === "s"
          ? `${sign ? "" : ""}${Math.round(delta / 60)}m ${Math.abs(delta % 60)}s`
          : `${delta}${unit}`}
      </div>
      <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function YearContent() {
  const searchParams = useSearchParams();
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam) : 0;

  const [data, setData] = useState<YearDetailData | null>(null);
  const [allYears, setAllYears] = useState<YearData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [countryAthletes, setCountryAthletes] = useState<CountryAthletes | null>(null);
  const [loadingAthletes, setLoadingAthletes] = useState(false);

  useEffect(() => {
    if (!year) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setSelectedCountry(null);
    setCountryAthletes(null);
    Promise.all([getYearDetail(year), getYears()])
      .then(([detail, years]) => {
        setData(detail);
        setAllYears(years.filter((y) => !y.cancelled).sort((a, b) => a.year - b.year));
      })
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-gray-400">Loading year data...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Year Not Found</h1>
        <p className="text-gray-500 mb-4">No data available for {yearParam || "this year"}.</p>
        <Link href="/years" className="inline-flex items-center px-4 py-2 bg-comrades text-white rounded-lg hover:bg-comrades-light transition-colors">
          Browse all years
        </Link>
      </div>
    );
  }

  // Find prev/next years for navigation
  const yearIndex = allYears.findIndex((y) => y.year === year);
  const prevYear = yearIndex > 0 ? allYears[yearIndex - 1].year : null;
  const nextYear = yearIndex >= 0 && yearIndex < allYears.length - 1 ? allYears[yearIndex + 1].year : null;

  // Cancelled year
  if (data.cancelled) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Link href="/years" className="hover:text-comrades transition-colors">Years</Link>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
          <span className="text-gray-900 font-medium">{data.year}</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="text-6xl font-bold text-gray-300 mb-4">{data.year}</div>
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-red-50 text-red-700 text-sm font-medium mb-4">Race Cancelled</div>
          {data.narrative && (
            <p className="text-gray-500 mt-4 max-w-lg mx-auto">{data.narrative}</p>
          )}
        </div>
        <div className="flex justify-between mt-6">
          {prevYear ? <Link href={`/year?year=${prevYear}`} className="text-sm text-gray-500 hover:text-comrades transition-colors">← {prevYear}</Link> : <span />}
          {nextYear ? <Link href={`/year?year=${nextYear}`} className="text-sm text-gray-500 hover:text-comrades transition-colors">{nextYear} →</Link> : <span />}
        </div>
      </div>
    );
  }

  const medals = data.medals || {};
  const medalOrder = ["Gold", "Wally Hayward", "Isavel Roche-Kelly", "Silver", "Bill Rowan", "Robert Mtshali", "Bronze", "Vic Clapham"];
  const medalData = medalOrder.filter((m) => medals[m] > 0).map((m) => ({ medal: m, count: medals[m] }));

  const sdc = data.sameDirectionComparison;
  const hr = data.historicalRank;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/years" className="hover:text-comrades transition-colors">Years</Link>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
        <span className="text-gray-900 font-medium">{data.year}</span>
      </div>

      {/* Hero card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold text-gray-900">{data.year}</h1>
              {data.direction && (
                <span className={`inline-flex items-center px-2.5 py-1 rounded text-sm font-medium ${
                  data.direction === "Down" ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"
                }`}>
                  {data.direction === "Down" ? "↓" : "↑"} {data.direction}
                </span>
              )}
              {data.raceNumber && (
                <span className="text-sm text-gray-400">Race #{data.raceNumber}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
              {data.date && <span>{data.date}</span>}
              {data.distance && <span>{data.distance}</span>}
              {data.timeLimit && <span>Cutoff: {data.timeLimit}</span>}
            </div>
            {data.weather && (
              <p className="text-sm text-gray-500 mt-2">
                <span className="text-gray-400">Weather:</span> {data.weather}
                {data.temperature && ` (${data.temperature})`}
              </p>
            )}
          </div>
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-6">
          {data.entries ? <StatCard label="Entries" value={formatNumber(data.entries)} /> : null}
          {data.starters ? <StatCard label="Starters" value={formatNumber(data.starters)} /> : null}
          {data.finishers ? <StatCard label="Finishers" value={formatNumber(data.finishers)} color="text-green-700" /> : null}
          {data.finishRate ? <StatCard label="Finish Rate" value={`${data.finishRate}%`} /> : null}
          {data.firstTimers ? (
            <StatCard label="First-timers" value={`${data.firstTimers.percentage}%`} sub={`${formatNumber(data.firstTimers.count)} runners`} />
          ) : null}
          {data.maleFinishers != null && data.femaleFinishers != null && data.femaleFinishers > 0 ? (
            <StatCard
              label="Gender split"
              value={`${Math.round((data.femaleFinishers / (data.finishers || 1)) * 100)}% F`}
              sub={`${formatNumber(data.maleFinishers)} M / ${formatNumber(data.femaleFinishers)} F`}
            />
          ) : null}
        </div>
      </div>

      {/* Same-direction comparison */}
      {sdc && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">
            Compared to{" "}
            <Link href={`/year?year=${sdc.previousYear}`} className="text-comrades hover:underline">
              {sdc.previousYear}
            </Link>
            <span className="text-sm font-normal text-gray-500 ml-2">
              (previous {sdc.direction} run)
            </span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
            {sdc.deltas.fieldSize && (
              <DeltaCard
                label="Field size"
                delta={sdc.deltas.fieldSize.deltaPct ? Number(sdc.deltas.fieldSize.deltaPct) : 0}
                unit="%"
              />
            )}
            {sdc.deltas.finishers && (
              <DeltaCard
                label="Finishers"
                delta={sdc.deltas.finishers.deltaPct ? Number(sdc.deltas.finishers.deltaPct) : 0}
                unit="%"
              />
            )}
            {sdc.deltas.finishRate && (
              <DeltaCard
                label="Finish rate"
                delta={Number(sdc.deltas.finishRate.delta || 0)}
                unit="pp"
              />
            )}
            {sdc.deltas.winningTime && (
              <DeltaCard
                label="Winning time"
                delta={Number(sdc.deltas.winningTime.deltaSeconds || 0)}
                unit="s"
                invert
              />
            )}
            {sdc.deltas.avgTime && (
              <DeltaCard
                label="Avg finish time"
                delta={Number(sdc.deltas.avgTime.deltaSeconds || 0)}
                unit="s"
                invert
              />
            )}
          </div>
        </div>
      )}

      {/* Special year note */}
      {YEAR_NOTES[data.year] && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 sm:p-6 mb-6">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-lg">!</div>
            <div>
              <h3 className="font-bold text-gray-900 mb-1">{YEAR_NOTES[data.year].title}</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{YEAR_NOTES[data.year].body}</p>
              {YEAR_NOTES[data.year].linkedRunners && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {YEAR_NOTES[data.year].linkedRunners!.map((r) => (
                    <Link key={r.id} href={`/runner?id=${r.id}`} className="text-xs font-medium text-comrades hover:underline">
                      View {r.name}&apos;s page →
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Podium */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Men */}
        {data.topMen && data.topMen.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-sm font-semibold text-gray-700">Top 10 Men</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="text-left px-4 py-2 w-10">#</th>
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-left px-4 py-2">Time</th>
                  <th className="text-left px-4 py-2">Medal</th>
                </tr>
              </thead>
              <tbody>
                {data.topMen.map((r, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2 text-gray-400 font-medium">{r.pos}</td>
                    <td className="px-4 py-2 font-medium text-gray-900">
                      <Link href={`/runner?id=${r.athleteId}`} className="hover:text-comrades transition-colors">
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 font-mono text-comrades font-bold">
                      <span className="inline-flex items-center">
                        {formatTime(r.time)}
                        {i === 0 && <RecordBadges records={data.recordContext?.menRecords} />}
                        {i === 1 && data.recordContext?.heroicSecond && (
                          <span className="inline-flex items-center px-1 py-px rounded text-[9px] font-bold bg-purple-100 text-purple-700 ml-1" title="Also beat previous record">*CR</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2"><MedalBadge medal={r.medal} size="sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Top Women */}
        {data.topWomen && data.topWomen.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-pink-50/50">
              <h3 className="text-sm font-semibold text-pink-700">Top Women</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="text-left px-4 py-2 w-10">#</th>
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-left px-4 py-2">Time</th>
                  <th className="text-left px-4 py-2">Medal</th>
                </tr>
              </thead>
              <tbody>
                {data.topWomen.map((r, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2 text-gray-400 font-medium">{r.pos}</td>
                    <td className="px-4 py-2 font-medium text-gray-900">
                      <Link href={`/runner?id=${r.athleteId}`} className="hover:text-comrades transition-colors">
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 font-mono text-comrades font-bold">
                      <span className="inline-flex items-center">
                        {formatTime(r.time)}
                        {i === 0 && <RecordBadges records={data.recordContext?.womenRecords} />}
                        {i === 1 && data.recordContext?.womenHeroicSecond && (
                          <span className="inline-flex items-center px-1 py-px rounded text-[9px] font-bold bg-purple-100 text-purple-700 ml-1" title="Also beat previous record">*CR</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2"><MedalBadge medal={r.medal} size="sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.lastFinisher && (
              <div className="px-5 py-2 border-t border-gray-100 text-xs text-gray-500">
                Last finisher: {data.lastFinisher.name} — {formatTime(data.lastFinisher.time)} (#{formatNumber(data.lastFinisher.pos)})
              </div>
            )}
          </div>
        )}
      </div>

      {/* Record Highlights */}
      {data.recordContext && (data.recordContext.menRecords || data.recordContext.womenRecords || data.recordContext.heroicSecond || data.recordContext.womenHeroicSecond || data.recordContext.womenWouldHaveWonMen || data.recordContext.uncannyDouble) && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border border-amber-200 p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-amber-900 mb-3 flex items-center gap-2">
            <span className="text-xl">★</span> Record Highlights
          </h2>
          <div className="space-y-2.5">
            {/* Men's record */}
            {data.recordContext.menRecords && data.recordContext.menPreviousRecord && data.topMen?.[0] && (
              <div className="flex items-start gap-2 text-sm">
                <RecordBadges records={data.recordContext.menRecords} />
                <p className="text-gray-800">
                  <span className="font-semibold">{data.topMen[0].name}</span>&apos;s{" "}
                  <span className="font-mono font-bold text-comrades">{formatTime(data.topMen[0].time)}</span>
                  {" "}broke{" "}
                  {data.recordContext.menPreviousRecord.holder === data.topMen[0].name ? (
                    <>his own {data.recordContext.menRecords.includes("overall") ? "course record" : `${data.recordContext.menRecords[0]} record`}</>
                  ) : (
                    <><span className="font-semibold">{data.recordContext.menPreviousRecord.holder}</span>&apos;s {data.recordContext.menRecords.includes("overall") ? "course record" : `${data.recordContext.menRecords[0]} record`}</>
                  )}
                  {" "}of{" "}
                  <span className="font-mono">{formatTime(data.recordContext.menPreviousRecord.time)}</span>
                  {" "}set in{" "}
                  <Link href={`/year?year=${data.recordContext.menPreviousRecord.year}`} className="text-comrades hover:underline font-medium">
                    {data.recordContext.menPreviousRecord.year}
                  </Link>.
                </p>
              </div>
            )}

            {/* Women's record */}
            {data.recordContext.womenRecords && data.recordContext.womenPreviousRecord && data.topWomen?.[0] && (
              <div className="flex items-start gap-2 text-sm">
                <RecordBadges records={data.recordContext.womenRecords} />
                <p className="text-gray-800">
                  <span className="font-semibold">{data.topWomen[0].name}</span>&apos;s{" "}
                  <span className="font-mono font-bold text-comrades">{formatTime(data.topWomen[0].time)}</span>
                  {" "}broke{" "}
                  {data.recordContext.womenPreviousRecord.holder === data.topWomen[0].name ? (
                    <>her own {data.recordContext.womenRecords.includes("overall") ? "women's course record" : `women's ${data.recordContext.womenRecords[0]} record`}</>
                  ) : (
                    <><span className="font-semibold">{data.recordContext.womenPreviousRecord.holder}</span>&apos;s {data.recordContext.womenRecords.includes("overall") ? "women's course record" : `women's ${data.recordContext.womenRecords[0]} record`}</>
                  )}
                  {" "}of{" "}
                  <span className="font-mono">{formatTime(data.recordContext.womenPreviousRecord.time)}</span>
                  {" "}set in{" "}
                  <Link href={`/year?year=${data.recordContext.womenPreviousRecord.year}`} className="text-comrades hover:underline font-medium">
                    {data.recordContext.womenPreviousRecord.year}
                  </Link>.
                </p>
              </div>
            )}

            {/* Heroic second place (men) */}
            {data.recordContext.heroicSecond && (
              <div className="flex items-start gap-2 text-sm">
                <span className="inline-flex items-center px-1 py-px rounded text-[9px] font-bold bg-purple-100 text-purple-700 mt-0.5 shrink-0">*CR</span>
                <p className="text-gray-800">
                  Runner-up <span className="font-semibold">{data.recordContext.heroicSecond.name}</span>&apos;s{" "}
                  <span className="font-mono font-bold">{formatTime(data.recordContext.heroicSecond.time)}</span>
                  {" "}also beat the previous record of{" "}
                  <span className="font-mono">{formatTime(data.recordContext.heroicSecond.brokenRecord.time)}</span>
                  {" "}— a rare feat in Comrades history.
                </p>
              </div>
            )}

            {/* Heroic second place (women) */}
            {data.recordContext.womenHeroicSecond && (
              <div className="flex items-start gap-2 text-sm">
                <span className="inline-flex items-center px-1 py-px rounded text-[9px] font-bold bg-purple-100 text-purple-700 mt-0.5 shrink-0">*CR</span>
                <p className="text-gray-800">
                  Women&apos;s runner-up <span className="font-semibold">{data.recordContext.womenHeroicSecond.name}</span>&apos;s{" "}
                  <span className="font-mono font-bold">{formatTime(data.recordContext.womenHeroicSecond.time)}</span>
                  {" "}also beat the previous women&apos;s record.
                </p>
              </div>
            )}

            {/* Women vs historical men */}
            {data.recordContext.womenWouldHaveWonMen && data.topWomen?.[0] && (
              <div className="flex items-start gap-2 text-sm">
                <span className="text-pink-500 mt-0.5 shrink-0">♀→♂</span>
                <p className="text-gray-800">
                  <span className="font-semibold">{data.topWomen[0].name}</span>&apos;s{" "}
                  <span className="font-mono font-bold">{formatTime(data.topWomen[0].time)}</span>
                  {" "}was faster than the men&apos;s winning time as recently as{" "}
                  <Link href={`/year?year=${data.recordContext.womenWouldHaveWonMen.mostRecentYear}`} className="text-comrades hover:underline font-medium">
                    {data.recordContext.womenWouldHaveWonMen.mostRecentYear}
                  </Link>
                  {" "}({data.recordContext.womenWouldHaveWonMen.mensWinner},{" "}
                  <span className="font-mono">{formatTime(data.recordContext.womenWouldHaveWonMen.mensTime)}</span>).
                </p>
              </div>
            )}

            {/* Uncanny double */}
            {data.recordContext.uncannyDouble && data.topMen?.[0] && (
              <div className="flex items-start gap-2 text-sm">
                <span className="text-indigo-500 mt-0.5 shrink-0">≡</span>
                <p className="text-gray-800">
                  <span className="font-semibold">{data.topMen[0].name}</span>&apos;s winning time of{" "}
                  <span className="font-mono font-bold">{formatTime(data.recordContext.uncannyDouble.time)}</span>
                  {" "}was identical to the second to the winning time in{" "}
                  <Link href={`/year?year=${data.recordContext.uncannyDouble.otherYear}`} className="text-comrades hover:underline font-medium">
                    {data.recordContext.uncannyDouble.otherYear}
                  </Link>
                  {data.recordContext.uncannyDouble.sameDirection === true && " — both on the same direction course"}
                  {data.recordContext.uncannyDouble.sameDirection === false && " — despite being run in opposite directions"}
                  .
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Historical rank */}
      {hr && hr.totalRaces > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Historical Ranking</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {hr.fieldSizeRank > 0 && (
              <StatCard label="Field size" value={ordinal(hr.fieldSizeRank)} sub={`of ${hr.totalRaces} races`} />
            )}
            {hr.finishersRank > 0 && (
              <StatCard label="Most finishers" value={ordinal(hr.finishersRank)} sub={`of ${hr.totalRaces} races`} />
            )}
            {hr.finishRateRank > 0 && (
              <StatCard label="Finish rate" value={ordinal(hr.finishRateRank)} sub={`of ${hr.totalRaces} races`} />
            )}
            {hr.winningTimeRank > 0 && (
              <StatCard
                label="Fastest winner"
                value={ordinal(hr.winningTimeRank)}
                sub={`of ${hr.totalRaces} races`}
                color={hr.winningTimeRank <= 3 ? "text-green-700" : "text-comrades"}
              />
            )}
            {hr.winningTimeRankDir > 0 && data.direction && (
              <StatCard
                label={`Fastest ${data.direction} winner`}
                value={ordinal(hr.winningTimeRankDir)}
                color={hr.winningTimeRankDir <= 3 ? "text-green-700" : "text-comrades"}
              />
            )}
          </div>
        </div>
      )}

      {/* Medal distribution */}
      {medalData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Medal Distribution</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={medalData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="medal" tick={{ fontSize: 10 }} tickLine={false} interval={0} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }} formatter={(v: any) => [formatNumber(v), "Runners"]} />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {medalData.map((entry) => (
                    <Cell key={entry.medal} fill={MEDAL_CHART_COLORS[entry.medal] || "#666"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Time distribution */}
      {data.timeDistribution && data.timeDistribution.some((d) => d.count > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Finish Time Distribution</h2>
          <p className="text-sm text-gray-500 mb-4">How finisher times were spread across the field</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.timeDistribution} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="bucket" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }} formatter={(v: any) => [formatNumber(v), "Finishers"]} />
                <Bar dataKey="count" fill={TIME_BUCKET_COLOR} opacity={0.7} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {data.avgFinishTime && (
            <p className="text-xs text-gray-500 mt-2">Average finish time: <span className="font-mono font-medium text-gray-700">{formatTime(data.avgFinishTime)}</span></p>
          )}
        </div>
      )}

      {/* Category breakdown */}
      {data.categoryBreakdown && data.categoryBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Age Category Breakdown</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.categoryBreakdown} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="category" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v} />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }}
                  formatter={(v: any, name: any, props: any) => [
                    `${formatNumber(v)} runners (avg ${formatTime(props.payload.avgTime)})`,
                    "Finishers"
                  ]}
                />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {data.categoryBreakdown.map((entry) => (
                    <Cell key={entry.category} fill={AGE_COLORS[entry.category] || "#666"} opacity={0.75} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Country representation */}
      {data.topCountries && data.topCountries.length > 0 && (data.countryDataPct == null || data.countryDataPct > 50) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Country Representation</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.topCountries.slice(0, 15)} layout="vertical" margin={{ top: 5, right: 10, bottom: 5, left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(v)} />
                <YAxis type="category" dataKey="country" tick={{ fontSize: 10 }} tickLine={false} width={95} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }} formatter={(v: any) => [formatNumber(v), "Finishers"]} />
                <Bar
                  dataKey="count"
                  fill="#1B5E20"
                  opacity={0.6}
                  radius={[0, 2, 2, 0]}
                  cursor="pointer"
                  onClick={(_: any, index: number) => {
                    const country = data.topCountries?.[index]?.country;
                    if (country) {
                      if (selectedCountry === country) {
                        setSelectedCountry(null);
                      } else {
                        setSelectedCountry(country);
                        if (!countryAthletes) {
                          setLoadingAthletes(true);
                          getYearCountryAthletes(year).then((ca) => {
                            setCountryAthletes(ca);
                            setLoadingAthletes(false);
                          });
                        }
                      }
                    }
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-gray-400 mt-1 mb-3">Click a bar or country below to view athletes</p>
          {data.topCountries.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {data.topCountries.slice(0, 20).map((c) => (
                <button
                  key={c.country}
                  onClick={() => {
                    if (selectedCountry === c.country) {
                      setSelectedCountry(null);
                    } else {
                      setSelectedCountry(c.country);
                      if (!countryAthletes) {
                        setLoadingAthletes(true);
                        getYearCountryAthletes(year).then((ca) => {
                          setCountryAthletes(ca);
                          setLoadingAthletes(false);
                        });
                      }
                    }
                  }}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                    selectedCountry === c.country
                      ? "bg-comrades text-white"
                      : "bg-gray-50 hover:bg-comrades/10 text-gray-600 hover:text-comrades"
                  }`}
                >
                  {c.country} <span className={selectedCountry === c.country ? "text-white/70" : "text-gray-400"}>({formatNumber(c.count)})</span>
                </button>
              ))}
            </div>
          )}

          {/* Country athlete list (expanded on click) */}
          {selectedCountry && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  {selectedCountry} — {data.year}
                  <span className="text-gray-400 font-normal ml-2">
                    ({formatNumber(data.topCountries?.find((c) => c.country === selectedCountry)?.count || 0)} finishers)
                  </span>
                </h3>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/country?name=${slugifyCountry(selectedCountry)}`}
                    className="text-xs text-comrades hover:underline"
                  >
                    View full country page →
                  </Link>
                  <button onClick={() => setSelectedCountry(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                </div>
              </div>
              {loadingAthletes ? (
                <div className="py-6 text-center text-gray-400 animate-pulse text-sm">Loading athletes...</div>
              ) : countryAthletes && countryAthletes[selectedCountry] ? (
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
                      {countryAthletes[selectedCountry].map((a: CountryAthlete, i: number) => (
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
                <div className="py-4 text-center text-gray-400 text-sm">No athlete data available for this country in {data.year}.</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Race narrative */}
      {data.narrative && data.narrative.length > 20 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Race Narrative</h2>
          <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
            {data.narrative.split(/\n\n|\r\n\r\n/).map((paragraph, i) => (
              paragraph.trim() ? <p key={i} className="mb-3">{paragraph.trim()}</p> : null
            ))}
          </div>
        </div>
      )}

      {/* Year navigation */}
      <div className="flex justify-between items-center mt-6 mb-8">
        {prevYear ? (
          <Link href={`/year?year=${prevYear}`} className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-600 hover:text-comrades bg-white border border-gray-200 rounded-lg hover:border-comrades/30 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
            {prevYear}
          </Link>
        ) : <span />}
        <Link href="/years" className="text-sm text-gray-500 hover:text-comrades transition-colors">All years</Link>
        {nextYear ? (
          <Link href={`/year?year=${nextYear}`} className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-600 hover:text-comrades bg-white border border-gray-200 rounded-lg hover:border-comrades/30 transition-colors">
            {nextYear}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>
          </Link>
        ) : <span />}
      </div>
    </div>
  );
}

export default function YearPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      }
    >
      <YearContent />
    </Suspense>
  );
}
