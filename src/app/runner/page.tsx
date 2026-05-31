"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getRunner, getAthleteBio, getClubSlugMap, formatTime, formatNumber, slugifyCountry, slugifyClub } from "@/lib/data";
import type { AthleteBio } from "@/lib/data";
import type { RunnerData, RunnerRace } from "@/lib/types";
import MedalBadge from "@/components/MedalBadge";
import GreenNumberBadge from "@/components/GreenNumberBadge";
import { MEDAL_COLORS } from "@/lib/types";

type SortKey = "year" | "pos" | "time" | "medal";
type SortDir = "asc" | "desc";

function RunnerContent() {
  const searchParams = useSearchParams();
  const athleteId = searchParams.get("id") || "";

  const [runner, setRunner] = useState<RunnerData | null>(null);
  const [bio, setBio] = useState<AthleteBio | null>(null);
  const [clubSlugMap, setClubSlugMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("year");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    if (!athleteId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      getRunner(athleteId),
      getAthleteBio(athleteId),
      getClubSlugMap(),
    ]).then(([r, b, csm]) => {
      setRunner(r);
      setBio(b);
      setClubSlugMap(csm);
    }).finally(() => setLoading(false));
  }, [athleteId]);

  const stats = useMemo(() => {
    if (!runner) return null;

    const finishes = runner.races.filter(
      (r) => r.medal && !["DNF", "DNS", "Not started", "DQ"].includes(r.medal)
    );
    const times = finishes
      .map((r) => r.time)
      .filter((t) => t && t !== "00:00:00" && t.includes(":"));

    const bestTime = times.length > 0 ? times.sort()[0] : null;

    const medalRank: Record<string, number> = {
      Gold: 1, "Wally Hayward": 2, "Isavel Roche-Kelly": 3,
      Silver: 4, "Bill Rowan": 5, "Robert Mtshali": 6,
      Bronze: 7, "Vic Clapham": 8,
    };

    let bestMedal = "";
    let bestMedalRank = 999;
    for (const r of finishes) {
      const rank = medalRank[r.medal] || 999;
      if (rank < bestMedalRank) {
        bestMedalRank = rank;
        bestMedal = r.medal;
      }
    }

    const countries = [...new Set(finishes.map((r) => r.country).filter(Boolean))];
    const clubs = [...new Set(finishes.map((r) => r.club).filter(Boolean))];
    const years = finishes.map((r) => r.year).sort((a, b) => a - b);

    // Get race number (consistent across all entries)
    const raceNos = [...new Set(runner.races.map((r) => r.raceNo).filter(Boolean))];

    return {
      totalFinishes: finishes.length,
      totalRaces: runner.races.length,
      bestTime,
      bestMedal,
      firstYear: years[0] || null,
      lastYear: years[years.length - 1] || null,
      countries,
      clubs,
      raceNo: raceNos[raceNos.length - 1] || null,
      bestPos: finishes
        .map((r) => (r.pos && r.pos !== "" ? parseInt(r.pos) : Infinity))
        .filter((p) => !isNaN(p) && p > 0)
        .sort((a, b) => a - b)[0] || null,
      bestGenderPos: runner.gender === "F"
        ? finishes
            .map((r) => (r.genderPos && r.genderPos !== "" ? parseInt(r.genderPos) : Infinity))
            .filter((p) => !isNaN(p) && p > 0)
            .sort((a, b) => a - b)[0] || null
        : null,
    };
  }, [runner]);

  const sortedRaces = useMemo(() => {
    if (!runner) return [];
    const races = [...runner.races];

    races.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "year":
          cmp = a.year - b.year;
          break;
        case "pos":
          if (runner.gender === "F") {
            cmp = (parseInt(a.genderPos || "") || 99999) - (parseInt(b.genderPos || "") || 99999);
          } else {
            cmp = (parseInt(a.pos) || 99999) - (parseInt(b.pos) || 99999);
          }
          break;
        case "time":
          cmp = (a.time || "99:99:99").localeCompare(b.time || "99:99:99");
          break;
        case "medal": {
          const medalRank: Record<string, number> = {
            Gold: 1, "Wally Hayward": 2, "Isavel Roche-Kelly": 3,
            Silver: 4, "Bill Rowan": 5, "Robert Mtshali": 6,
            Bronze: 7, "Vic Clapham": 8, DNF: 9, DNS: 10,
          };
          cmp = (medalRank[a.medal] || 99) - (medalRank[b.medal] || 99);
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return races;
  }, [runner, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "year" ? "desc" : "asc");
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) {
      return <svg className="w-3 h-3 text-gray-300 ml-1 inline" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M7 15l5 5 5-5M7 9l5-5 5 5" /></svg>;
    }
    return sortDir === "asc"
      ? <svg className="w-3 h-3 text-comrades ml-1 inline" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M7 14l5-5 5 5" /></svg>
      : <svg className="w-3 h-3 text-comrades ml-1 inline" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5" /></svg>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-gray-400">Loading runner data...</div>
      </div>
    );
  }

  if (!runner || !stats) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 text-center">
        <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.12a9 9 0 0 1 15 0" />
        </svg>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Runner Not Found</h1>
        <p className="text-gray-500 mb-4">
          We couldn&apos;t find a runner with this ID.
        </p>
        <Link
          href="/search"
          className="inline-flex items-center px-4 py-2 bg-comrades text-white rounded-lg hover:bg-comrades-light transition-colors"
        >
          Search for a runner
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/search" className="hover:text-comrades transition-colors">Search</Link>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
        <span className="text-gray-900 font-medium">{runner.name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">{runner.name}</h1>
          {runner.gender && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                runner.gender === "F"
                  ? "bg-pink-100 text-pink-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {runner.gender === "F" ? "Women" : "Men"}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
          {stats.raceNo && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded font-mono font-medium text-xs ${
              stats.totalFinishes >= 10
                ? "bg-green-100 text-green-800 border border-green-400"
                : "bg-comrades/10 text-comrades"
            }`}>
              #{stats.raceNo}
            </span>
          )}
          <GreenNumberBadge finishes={stats.totalFinishes} size="md" showLabel />
          {stats.countries.length > 0 && (
            <span>
              {stats.countries.map((c, i) => (
                <span key={c}>
                  {i > 0 && ", "}
                  <Link
                    href={`/country?name=${slugifyCountry(c)}`}
                    className="hover:text-comrades transition-colors"
                  >
                    {c}
                  </Link>
                </span>
              ))}
            </span>
          )}
          {stats.clubs.length > 0 && (
            <>
              <span className="text-gray-300">|</span>
              <span>{stats.clubs[stats.clubs.length - 1]}</span>
            </>
          )}
          <span className="text-gray-300">|</span>
          <Link href={`/compare?r1=${athleteId}`} className="text-comrades hover:underline text-xs font-medium">
            ⚔️ Compare
          </Link>
        </div>

        {/* Stats cards */}
        <div className={`grid grid-cols-2 ${runner.gender === "F" ? "sm:grid-cols-5" : "sm:grid-cols-4"} gap-4 mt-6`}>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-comrades">{stats.totalFinishes}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {stats.totalFinishes === 1 ? "Finish" : "Finishes"}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-comrades">
              {stats.bestTime ? formatTime(stats.bestTime) : "-"}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Best Time</div>
          </div>
          {runner.gender === "F" && (
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className={`text-2xl font-bold ${stats.bestGenderPos && stats.bestGenderPos <= 3 ? "text-yellow-600" : "text-comrades"}`}>
                {stats.bestGenderPos ? `#${stats.bestGenderPos}` : "-"}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Best Women&apos;s Pos</div>
            </div>
          )}
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            {stats.bestMedal ? (
              <div className="flex justify-center mb-0.5">
                <MedalBadge medal={stats.bestMedal} />
              </div>
            ) : (
              <div className="text-2xl font-bold text-gray-300">-</div>
            )}
            <div className="text-xs text-gray-500 mt-0.5">Best Medal</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-comrades">
              {stats.firstYear && stats.lastYear
                ? `${stats.lastYear - stats.firstYear}y`
                : "-"}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {stats.firstYear && stats.lastYear
                ? `${stats.firstYear}–${stats.lastYear}`
                : "Span"}
            </div>
          </div>
        </div>
      </div>

      {/* Bio (for notable athletes) */}
      {bio && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border border-amber-200 p-5 mb-6">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-sm mt-0.5">
              ★
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="font-semibold text-gray-900 text-sm">Notable Athlete</span>
                {bio.wikipedia && (
                  <a
                    href={bio.wikipedia}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] px-1.5 py-0.5 bg-white/70 text-gray-500 rounded hover:bg-white hover:text-comrades transition-colors border border-amber-200"
                  >
                    Wikipedia →
                  </a>
                )}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed mb-2">{bio.bio}</p>
              <div className="flex flex-wrap gap-1.5">
                {bio.tags.map((tag) => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 bg-white/80 text-amber-800 rounded-full border border-amber-200 font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Race history table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Race History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th
                  className="text-left px-4 py-2.5 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                  onClick={() => handleSort("year")}
                >
                  Year <SortIcon column="year" />
                </th>
                <th
                  className="text-left px-4 py-2.5 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                  onClick={() => handleSort("pos")}
                >
                  {runner.gender === "F" ? "Gender Pos" : "Pos"} <SortIcon column="pos" />
                </th>
                <th
                  className="text-left px-4 py-2.5 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                  onClick={() => handleSort("time")}
                >
                  Time <SortIcon column="time" />
                </th>
                <th
                  className="text-left px-4 py-2.5 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                  onClick={() => handleSort("medal")}
                >
                  Medal <SortIcon column="medal" />
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600 hidden sm:table-cell">
                  Club
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600 hidden md:table-cell">
                  Category
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRaces.map((race: RunnerRace, i: number) => {
                const isDNF = ["DNF", "DNS", "Not started", "DQ"].includes(race.medal);
                return (
                  <tr
                    key={`${race.year}-${i}`}
                    className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${isDNF ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      <Link href={`/year?year=${race.year}`} className="hover:text-comrades transition-colors">
                        {race.year}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {runner.gender === "F" ? (
                        <>
                          {race.genderPos && race.genderPos !== "0" ? (
                            <span className={`font-medium ${parseInt(race.genderPos) <= 3 ? "text-yellow-700" : ""}`}>
                              {formatNumber(parseInt(race.genderPos))}
                            </span>
                          ) : "-"}
                          {race.pos && race.pos !== "0" && (
                            <span className="text-gray-400 text-xs ml-1.5">
                              (#{formatNumber(parseInt(race.pos))})
                            </span>
                          )}
                        </>
                      ) : (
                        race.pos && race.pos !== "0" ? formatNumber(parseInt(race.pos)) : "-"
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-gray-700">
                      {formatTime(race.time)}
                    </td>
                    <td className="px-4 py-2.5">
                      {isDNF ? (
                        <span className="text-xs text-gray-400 font-medium">{race.medal}</span>
                      ) : race.medal && MEDAL_COLORS[race.medal] ? (
                        <MedalBadge medal={race.medal} size="sm" />
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell truncate max-w-[200px]">
                      {race.club ? (() => {
                        const resolved = clubSlugMap.get(slugifyClub(race.club));
                        return resolved ? (
                          <Link href={`/club?name=${resolved}`} className="hover:text-comrades transition-colors">
                            {race.club}
                          </Link>
                        ) : (
                          <span>{race.club}</span>
                        );
                      })() : "-"}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 hidden md:table-cell">
                      {race.category || "-"}
                      {race.categoryPos && (
                        <span className="text-gray-400 ml-1">(#{race.categoryPos})</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function RunnerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      }
    >
      <RunnerContent />
    </Suspense>
  );
}
