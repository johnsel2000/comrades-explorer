"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { getClubDetail, getClubAthletes, getAthleteBio, getClubSlugMap, formatTime, formatNumber } from "@/lib/data";
import type { ClubDetailData, ClubAthlete, ClubAthletes, AthleteBio } from "@/lib/data";
import MedalBadge from "@/components/MedalBadge";

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

// Notable club narratives
const CLUB_NOTES: Record<string, string> = {
  "germiston-callies-harriers": "The most decorated club in Comrades history, founded by former Scottish cross-country champion Johnnie Jackson. Based at 10 Delville Road, Germiston, the club has produced 19 victories from six extraordinary athletes: Wally Hayward (5 wins), Jackie Mekler (5 wins), Alan Robb (4 wins), Lettie van Zyl (3 wins), George Claassen (1 win at age 44 \u2014 the oldest winner at the time), and Mercer Davies (1 win). Robb\u2019s 12 Gold medals are the men\u2019s record. The broader Germiston Callies sports organisation was founded in 1906 by Scottish immigrants \u2014 railway men and miners.",
  "nedbank-running-club": "The dominant force in modern Comrades. Managed by 1991 champion Nick Bester (\u2018The Iron Man\u2019, 9 Gold medals), the club\u2019s head coach Dave Adams \u2014 a self-taught coach who started while working at Impala Platinum mines \u2014 has masterminded a dynasty. His athletes include record-holder Tete Dijana, David Gatebe (2016 down-run record 5:18:19), Edward Mothibi (2019 winner), and Camille Herron. In 2022, Nedbank swept the men\u2019s podium 1-2-3. With 13 branches across South Africa and over 4,000 members, it is the country\u2019s largest corporate running club.",
  "rand-ac": "The largest club in Comrades history by finishers. Founded in 1972 by Caspar Greeff, Ray Alborough, and Fritz Madel \u2014 initially starting from a lamppost in Northcliff, Johannesburg \u2014 Rand AC grew to 3,074 members by 1993. In 2000 they entered 823 runners, the largest single-club entry ever. Bruce Fordyce was a member \u2018on and off for ten years,\u2019 setting the 1986 down-run record while being chased by teammate Bob de la Motte. Hoseah Tjale earned the club\u2019s first Gold medal in 1980. Now based at the Old Parktonian Sports Club, their Tuesday time trials draw ~500 runners.",
  "savages-ac": "Born from a Durban soccer club in 1960, when players started running in the off-season to stay fit. Starting with 11 members, Savages grew to become the biggest club in South Africa. Home to Manie Kuhn (1967 winner \u2014 beat Tommy Malone by one second in the closest finish ever, when Malone stumbled at the tape) and Dave Bagshaw (hat trick of wins, 1969-71). Blanche Moila became the first Black female athlete to win Springbok Colours while at Savages. Based at Morningside Sports Club, Durban.",
  "durban-athletic-club": "South Africa\u2019s oldest athletic club, founded in 1879 from a gymnastics club that started on Smith Street, Durban in 1870. Members grew tired of indoor gymnastics and formed a running section. Active since the very first Comrades in 1921, the club has produced 8 winners including Hardy Ballington (5 wins) and Arthur Newton (5 wins). Based at Kings Park Athletic Stadium, with 58 Gold medals \u2014 one of the highest tallies of any club.",
  "collegians-harriers": "Based at 381 Boshoff Street, Pietermaritzburg. Originally Maritzburg Harriers (1933), the club took over organising the Comrades Marathon in 1948 and managed the race until 1981. Collegians played a vital role in negotiations to open the race to all races and genders \u2014 one of the first major sporting events in South Africa to do so. Notable members include Skonk Nicholson (SA record holder) and Mike Arbuthnot (founder of the Midmar Mile).",
  "rocky-road-runners": "Founded in 1975 by breakaway runners from Germiston Callies Harriers, based at Zoo Lake Sports Club, Parkwood, Johannesburg. Known for inclusivity during apartheid as an interracial running community. Notable members include Frith van der Merwe, Johnny Halberstadt, and Rae Bischoff (1998 women\u2019s winner). Their pre-Comrades 65km club run draws hundreds. Celebrating their 50th anniversary in 2025.",
  "hillcrest-villagers-ac": "Founded in 1977 with just 20 members in Hillcrest, KZN \u2014 right along the Comrades route. Won the Gunga Din Trophy three consecutive years (1981-83). Willie Mtolo claimed his first of two Comrades runner-up finishes in 1989 wearing Villagers colours, before going on to win the New York City Marathon. Bruce Fordyce has given training talks at the club. Their supporters are known for being \u2018by far the best and most vocal\u2019 on the entire route. Now 300+ members strong.",
  "team-vitality": "The Discovery Vitality wellness programme\u2019s running club has grown explosively since its launch, becoming one of the largest clubs by membership. It draws runners motivated by the health insurance rewards programme.",
  "westville-athletic-club": "Founded in 1974 by 10 elite athletes who trained together but belonged to different Durban-area clubs \u2014 they \u2018started out of the back of someone\u2019s car.\u2019 The Comrades down-run route passes right through Westville. Derek Preiss won the 1974 and 1975 Comrades. Derek Kay held the world 100-mile track record. Their clubhouse, opened by Bruce Fordyce in 1985, celebrated its 50th anniversary in 2024.",
  "benoni-northerns-athletic-club": "Based in Benoni, Gauteng, founded in 1981. Between 1981-88, the club averaged 12-16 Silver medals per year from ~60 Comrades entrants \u2014 an extraordinary hit rate. Home to Frith van der Merwe, who set the women\u2019s record of 5:54:43 in 1989 (standing for 34 years until Gerda Steyn broke it). Her teammate Valerie Bleazard was the fastest female novice to earn Gold. Famous for their \u2018Aches and Pains\u2019 post-Comrades party.",
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 text-center">
      <div className="text-2xl font-bold text-comrades">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function ClubContent() {
  const searchParams = useSearchParams();
  const rawSlug = searchParams.get("name") || "";
  const [resolvedSlug, setResolvedSlug] = useState(rawSlug);
  const [data, setData] = useState<ClubDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notableAthletes, setNotableAthletes] = useState<{ bio: AthleteBio; athleteId: string; finishes?: number; bestMedal?: string }[]>([]);

  useEffect(() => {
    if (!rawSlug) return;
    setLoading(true);
    // Try loading directly, then fall back to redirect map
    getClubDetail(rawSlug)
      .then((d) => { setData(d); setResolvedSlug(rawSlug); })
      .catch(async () => {
        // Try redirect
        const map = await getClubSlugMap();
        const target = map.get(rawSlug);
        if (target && target !== rawSlug) {
          try {
            const d = await getClubDetail(target);
            setData(d);
            setResolvedSlug(target);
            return;
          } catch { /* fall through */ }
        }
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [rawSlug]);

  // Load notable athletes (those with bios) from this club's roster
  useEffect(() => {
    if (!data) return;
    const allIds = [
      ...data.topRunners.map(r => ({ id: r.athleteId, finishes: r.finishes, bestMedal: r.bestMedal })),
      ...data.winnersMen.map(w => ({ id: w.athleteId, finishes: undefined, bestMedal: undefined })),
      ...data.winnersWomen.map(w => ({ id: w.athleteId, finishes: undefined, bestMedal: undefined })),
      ...data.podiumsMen.map(p => ({ id: p.athleteId, finishes: undefined, bestMedal: undefined })),
      ...data.podiumsWomen.map(p => ({ id: p.athleteId, finishes: undefined, bestMedal: undefined })),
    ];
    // Deduplicate by ID
    const seen = new Set<string>();
    const unique = allIds.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });

    Promise.all(unique.map(async (a) => {
      const bio = await getAthleteBio(a.id);
      return bio ? { bio, athleteId: a.id, finishes: a.finishes, bestMedal: a.bestMedal } : null;
    })).then(results => {
      setNotableAthletes(results.filter((r): r is NonNullable<typeof r> => r !== null));
    });
  }, [data]);

  // Year drill-down state
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [clubAthletes, setClubAthletes] = useState<ClubAthletes | null>(null);
  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [yearAthletes, setYearAthletes] = useState<ClubAthlete[]>([]);

  const handleYearClick = async (year: number) => {
    if (selectedYear === year) { setSelectedYear(null); return; }
    setSelectedYear(year);
    setLoadingAthletes(true);
    try {
      let athletes = clubAthletes;
      if (!athletes) {
        athletes = await getClubAthletes(resolvedSlug);
        setClubAthletes(athletes);
      }
      if (athletes && athletes[String(year)]) {
        setYearAthletes(athletes[String(year)]);
      } else {
        setYearAthletes([]);
      }
    } catch { setYearAthletes([]); }
    setLoadingAthletes(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-pulse text-gray-400">Loading club...</div></div>;
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Club Not Found</h1>
        <Link href="/clubs" className="text-comrades hover:underline">← Browse all clubs</Link>
      </div>
    );
  }

  const o = data.overview;
  const note = CLUB_NOTES[data.slug];

  // Medal summary for chart
  const medalData = medalOrder
    .filter(m => data.medalSummary[m] > 0)
    .map(m => ({ medal: m, count: data.medalSummary[m] }));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/" className="hover:text-comrades transition-colors">Home</Link>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
        <Link href="/clubs" className="hover:text-comrades transition-colors">Clubs</Link>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
        <span className="text-gray-900 font-medium">{data.name}</span>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-br from-comrades/5 to-comrades/10 rounded-xl border border-comrades/20 p-6 sm:p-8 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">{data.name}</h1>
        {note && (
          <p className="text-gray-600 text-sm leading-relaxed mb-4 max-w-3xl">{note}</p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          <StatCard label="Total Finishes" value={formatNumber(o.totalFinishers)} />
          <StatCard label="Athletes" value={formatNumber(o.uniqueAthletes)} />
          <StatCard label="Comrades Wins" value={o.totalWins} />
          <StatCard label="Gold Medals" value={o.totalGolds} />
          <StatCard label="Active" value={`${o.firstYear}–${o.latestYear}`} sub={`${o.yearsActive} years`} />
        </div>
      </div>

      {/* Winners */}
      {(data.winnersMen.length > 0 || data.winnersWomen.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-amber-500">🏆</span> Comrades Winners
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {data.winnersMen.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Men</h3>
                <table className="w-full text-sm">
                  <tbody>
                    {data.winnersMen.map((w, i) => (
                      <tr key={i} className="border-b border-amber-100 last:border-0">
                        <td className="py-1.5 pr-3 font-mono text-comrades font-bold">{w.year}</td>
                        <td className="py-1.5">
                          <Link href={`/runner?id=${w.athleteId}`} className="font-medium text-gray-900 hover:text-comrades transition-colors">{w.name}</Link>
                        </td>
                        <td className="py-1.5 text-right font-mono text-gray-500 text-xs">{formatTime(w.time)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {data.winnersWomen.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Women</h3>
                <table className="w-full text-sm">
                  <tbody>
                    {data.winnersWomen.map((w, i) => (
                      <tr key={i} className="border-b border-amber-100 last:border-0">
                        <td className="py-1.5 pr-3 font-mono text-comrades font-bold">{w.year}</td>
                        <td className="py-1.5">
                          <Link href={`/runner?id=${w.athleteId}`} className="font-medium text-gray-900 hover:text-comrades transition-colors">{w.name}</Link>
                        </td>
                        <td className="py-1.5 text-right font-mono text-gray-500 text-xs">{formatTime(w.time)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notable Athletes */}
      {notableAthletes.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-xs">★</span>
            Notable Athletes
          </h2>
          <div className="space-y-4">
            {notableAthletes.map((a) => (
              <div key={a.athleteId} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/runner?id=${a.athleteId}`} className="font-semibold text-gray-900 hover:text-comrades transition-colors">
                      {a.bio.name}
                    </Link>
                    {a.bio.wikipedia && (
                      <a href={a.bio.wikipedia} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs text-blue-600 hover:underline">
                        Wikipedia →
                      </a>
                    )}
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">{a.bio.bio}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {a.bio.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-comrades/10 text-comrades">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Participation Over Time */}
      {data.yearlySeries.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Participation Over Time</h2>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data.yearlySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Tooltip
                formatter={(value: any, name: any) => [formatNumber(value as number), name === "male" ? "Men" : "Women"]}
                labelFormatter={(label) => `Year ${label}`}
              />
              <Area type="monotone" dataKey="male" stackId="1" fill="#1B5E20" fillOpacity={0.6} stroke="#1B5E20" name="male" />
              <Area type="monotone" dataKey="female" stackId="1" fill="#E91E63" fillOpacity={0.6} stroke="#E91E63" name="female" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Medal Distribution */}
      {medalData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Medal Distribution</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={medalData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="medal" tick={{ fontSize: 10 }} width={100} />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Tooltip formatter={(value: any) => [formatNumber(value as number), "Finishes"]} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {medalData.map((entry) => (
                  <Cell key={entry.medal} fill={MEDAL_CHART_COLORS[entry.medal] || "#999"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Runners */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-sm font-semibold text-gray-700">Top Runners (by finishes)</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="text-left px-4 py-2">#</th>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-right px-4 py-2">Finishes</th>
                <th className="text-right px-4 py-2">Best</th>
                <th className="text-right px-4 py-2">Medal</th>
              </tr>
            </thead>
            <tbody>
              {data.topRunners.map((r, i) => (
                <tr key={r.athleteId} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-2 text-gray-400 font-medium">{i + 1}</td>
                  <td className="px-4 py-2">
                    <Link href={`/runner?id=${r.athleteId}`} className="font-medium text-gray-900 hover:text-comrades transition-colors">
                      {r.name}
                    </Link>
                    {r.golds > 0 && (
                      <span className="ml-1.5 text-[10px] text-amber-600 font-semibold">{r.golds}G</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-comrades font-bold">{r.finishes}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-gray-500">{formatTime(r.bestTime)}</td>
                  <td className="px-4 py-2 text-right"><MedalBadge medal={r.bestMedal} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Podium Finishes */}
        {(data.podiumsMen.length > 0 || data.podiumsWomen.length > 0) && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-sm font-semibold text-gray-700">Podium Finishes (Top 3)</h3>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-gray-100 text-xs text-gray-500">
                    <th className="text-left px-4 py-2">Year</th>
                    <th className="text-left px-4 py-2">Name</th>
                    <th className="text-right px-4 py-2">Pos</th>
                    <th className="text-right px-4 py-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.podiumsMen, ...data.podiumsWomen]
                    .sort((a, b) => b.year - a.year || a.pos - b.pos)
                    .map((p, i) => {
                      const isWoman = data.podiumsWomen.some(w => w.athleteId === p.athleteId && w.year === p.year);
                      return (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-4 py-1.5 font-mono text-comrades font-bold text-xs">{p.year}</td>
                          <td className="px-4 py-1.5">
                            <Link href={`/runner?id=${p.athleteId}`} className="text-gray-900 hover:text-comrades transition-colors text-xs">
                              {p.name}
                            </Link>
                            {isWoman && <span className="ml-1 text-pink-500 text-[10px]">♀</span>}
                          </td>
                          <td className="px-4 py-1.5 text-right">
                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                              p.pos === 1 ? "bg-amber-100 text-amber-700" : p.pos === 2 ? "bg-gray-100 text-gray-600" : "bg-orange-50 text-orange-600"
                            }`}>{p.pos}</span>
                          </td>
                          <td className="px-4 py-1.5 text-right font-mono text-xs text-gray-500">{formatTime(p.time)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Year-by-Year Results drill-down */}
      {data.yearlySeries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Year-by-Year Results</h2>
          <p className="text-sm text-gray-500 mb-4">Click a year to view all {data.name} athletes</p>
          <div className="flex flex-wrap gap-1.5">
            {data.yearlySeries
              .filter(ys => (ys.male + ys.female) > 0)
              .map(ys => {
                const total = ys.male + ys.female;
                const isSelected = selectedYear === ys.year;
                return (
                  <button
                    key={ys.year}
                    onClick={() => handleYearClick(ys.year)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      isSelected
                        ? "bg-comrades text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {ys.year} <span className="text-[10px] opacity-70">({total})</span>
                  </button>
                );
              })}
          </div>

          {/* Expanded athlete list */}
          {selectedYear && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">
                  {data.name} — {selectedYear} <span className="text-gray-400 font-normal">({yearAthletes.length} athletes)</span>
                </h3>
                <div className="flex items-center gap-3">
                  <Link href={`/year?year=${selectedYear}`} className="text-xs text-comrades hover:underline">View full year page →</Link>
                  <button onClick={() => setSelectedYear(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                </div>
              </div>
              {loadingAthletes ? (
                <div className="text-sm text-gray-400 animate-pulse">Loading athletes...</div>
              ) : yearAthletes.length > 0 ? (
                <div className="max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-gray-200 text-xs text-gray-500">
                        <th className="text-left px-3 py-1.5">Name</th>
                        <th className="text-right px-3 py-1.5">Pos</th>
                        <th className="text-right px-3 py-1.5">Time</th>
                        <th className="text-right px-3 py-1.5">Medal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yearAthletes.map((a, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-3 py-1.5">
                            <Link href={`/runner?id=${a.athleteId}`} className="text-gray-900 hover:text-comrades transition-colors">
                              {a.name}
                            </Link>
                            {a.gender === "F" && <span className="ml-1 text-pink-500 text-[10px]">♀</span>}
                          </td>
                          <td className="px-3 py-1.5 text-right text-gray-500 font-mono text-xs">
                            {a.pos || "-"}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-xs text-gray-600">
                            {formatTime(a.time)}
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            {a.medal ? <MedalBadge medal={a.medal} /> : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-gray-400">No athlete data available for {data.name} in {selectedYear}.</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Year-by-year medal breakdown */}
      {data.yearlySeries.length > 5 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Medals by Year</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.yearlySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="year" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              {medalOrder.map(m => (
                <Bar key={m} dataKey={`medals.${m}`} stackId="medals" fill={MEDAL_CHART_COLORS[m]} name={m} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function ClubPage() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto px-4 py-12 text-center text-gray-400">Loading...</div>}>
      <ClubContent />
    </Suspense>
  );
}
