"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getRunner, getSearchBucket, formatTime, formatNumber } from "@/lib/data";
import type { RunnerData, SearchEntry } from "@/lib/types";
import MedalBadge from "@/components/MedalBadge";

interface CompareRunner {
  id: string;
  data: RunnerData;
}

const MEDAL_ORDER = ["Gold", "Wally Hayward", "Isavel Roche-Kelly", "Silver", "Bill Rowan", "Robert Mtshali", "Bronze", "Vic Clapham"];

function bestMedal(races: RunnerData["races"]): string {
  for (const m of MEDAL_ORDER) {
    if (races.some(r => r.medal === m)) return m;
  }
  return "";
}

function finishCount(races: RunnerData["races"]): number {
  return races.filter(r => r.time && !["DNS", "DNF", "Not started", "UOF"].includes(r.time)).length;
}

function bestTime(races: RunnerData["races"]): string {
  let best = "";
  for (const r of races) {
    if (!r.time || ["DNS", "DNF", "Not started", "UOF"].includes(r.time)) continue;
    if (!best || r.time < best) best = r.time;
  }
  return best;
}

function avgTimeSeconds(races: RunnerData["races"]): number | null {
  const times: number[] = [];
  for (const r of races) {
    if (!r.time || ["DNS", "DNF", "Not started", "UOF"].includes(r.time)) continue;
    const parts = r.time.split(":");
    if (parts.length === 3) {
      times.push(parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]));
    }
  }
  if (times.length === 0) return null;
  return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
}

function secondsToTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// SearchEntry tuple: [name, athleteId, finishes, startYear, endYear, bestMedal, gender]
function RunnerSearch({ label, onSelect, selectedId, initialName }: { label: string; onSelect: (id: string, name: string) => void; selectedId?: string; initialName?: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedName, setSelectedName] = useState(initialName || "");

  // Sync initialName when runner data loads async
  useEffect(() => {
    if (initialName && !selectedName) setSelectedName(initialName);
  }, [initialName, selectedName]);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      // Load buckets for all words in the query (names are stored by surname initial)
      const words = q.toLowerCase().split(/\s+/).filter(w => w.length > 0);
      const letters = new Set<string>();
      for (const word of words) {
        if (word[0].match(/[a-z]/)) letters.add(word[0]);
      }
      if (letters.size === 0 && q[0].match(/[a-z]/i)) letters.add(q[0].toLowerCase());
      const buckets = await Promise.all([...letters].map(l => getSearchBucket(l)));
      const allEntries = buckets.flat();
      // Match entries where ALL words appear in the name
      const matches = allEntries
        .filter(e => {
          const name = e[0].toLowerCase();
          return words.every(w => name.includes(w));
        })
        .sort((a, b) => {
          const aName = a[0].toLowerCase();
          const bName = b[0].toLowerCase();
          // Prefer exact starts
          const aStarts = words.some(w => aName.startsWith(w)) || aName.split(" ").some(p => words.some(w => p.startsWith(w)));
          const bStarts = words.some(w => bName.startsWith(w)) || bName.split(" ").some(p => words.some(w => p.startsWith(w)));
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return (b[2] || 0) - (a[2] || 0);
        })
        .slice(0, 15);
      setResults(matches);
    } catch { setResults([]); }
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 200);
    return () => clearTimeout(t);
  }, [query, search]);

  if (selectedId && selectedName) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 uppercase font-semibold">{label}</span>
        <span className="font-bold text-gray-900">{selectedName}</span>
        <button onClick={() => { setSelectedName(""); onSelect("", ""); setQuery(""); }} className="text-xs text-red-500 hover:text-red-700">✕ Change</button>
      </div>
    );
  }

  return (
    <div className="relative">
      <label className="block text-xs text-gray-500 uppercase font-semibold mb-1">{label}</label>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Type a runner name..."
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-comrades focus:ring-1 focus:ring-comrades outline-none"
      />
      {loading && <div className="absolute right-3 top-8 text-xs text-gray-400">Searching...</div>}
      {results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {results.map(r => (
            <button
              key={r[1]}
              onClick={() => { onSelect(r[1], r[0]); setSelectedName(r[0]); setResults([]); setQuery(""); }}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-50 last:border-0"
            >
              <span className="font-medium">{r[0]}</span>
              <span className="text-gray-400 ml-2">{r[2]} finishes</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CompareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [runner1, setRunner1] = useState<CompareRunner | null>(null);
  const [runner2, setRunner2] = useState<CompareRunner | null>(null);
  const [id1, setId1] = useState(searchParams.get("r1") || "");
  const [id2, setId2] = useState(searchParams.get("r2") || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id1 && !id2) return;
      setLoading(true);
      const [d1, d2] = await Promise.all([
        id1 ? getRunner(id1) : null,
        id2 ? getRunner(id2) : null,
      ]);
      if (d1) setRunner1({ id: id1, data: d1 });
      else setRunner1(null);
      if (d2) setRunner2({ id: id2, data: d2 });
      else setRunner2(null);
      setLoading(false);
    }
    load();
  }, [id1, id2]);

  // Update URL when both runners selected
  useEffect(() => {
    if (id1 && id2) {
      const params = new URLSearchParams();
      params.set("r1", id1);
      params.set("r2", id2);
      router.replace(`/compare?${params.toString()}`, { scroll: false });
    }
  }, [id1, id2, router]);

  const r1Finishes = runner1 ? finishCount(runner1.data.races) : 0;
  const r2Finishes = runner2 ? finishCount(runner2.data.races) : 0;
  const r1Best = runner1 ? bestTime(runner1.data.races) : "";
  const r2Best = runner2 ? bestTime(runner2.data.races) : "";
  const r1Avg = runner1 ? avgTimeSeconds(runner1.data.races) : null;
  const r2Avg = runner2 ? avgTimeSeconds(runner2.data.races) : null;
  const r1Medal = runner1 ? bestMedal(runner1.data.races) : "";
  const r2Medal = runner2 ? bestMedal(runner2.data.races) : "";

  // Find overlapping years
  const r1Years = new Set(runner1?.data.races.map(r => r.year) || []);
  const r2Years = new Set(runner2?.data.races.map(r => r.year) || []);
  const overlapping = [...r1Years].filter(y => r2Years.has(y)).sort((a, b) => a - b);

  function StatComparison({ label, v1, v2, lowerBetter }: { label: string; v1: string | number; v2: string | number; lowerBetter?: boolean }) {
    const s1 = String(v1), s2 = String(v2);
    let w1 = false, w2 = false;
    if (s1 && s2 && s1 !== "-" && s2 !== "-") {
      if (lowerBetter) { w1 = s1 < s2; w2 = s2 < s1; }
      else { w1 = s1 > s2; w2 = s2 > s1; }
    }
    return (
      <div className="grid grid-cols-3 gap-2 py-2 border-b border-gray-100 last:border-0">
        <div className={`text-right font-mono text-sm ${w1 ? "font-bold text-comrades" : "text-gray-700"}`}>{s1 || "-"}</div>
        <div className="text-center text-xs text-gray-500 font-medium self-center">{label}</div>
        <div className={`text-left font-mono text-sm ${w2 ? "font-bold text-comrades" : "text-gray-700"}`}>{s2 || "-"}</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/" className="hover:text-comrades transition-colors">Home</Link>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
        <span className="text-gray-900 font-medium">Head-to-Head</span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Head-to-Head Comparison</h1>
      <p className="text-gray-500 mb-6">Compare any two Comrades runners side by side</p>

      {/* Runner selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <RunnerSearch label="Runner 1" onSelect={(id, name) => { setId1(id); if (!id) setRunner1(null); }} selectedId={id1} initialName={runner1?.data.name} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <RunnerSearch label="Runner 2" onSelect={(id, name) => { setId2(id); if (!id) setRunner2(null); }} selectedId={id2} initialName={runner2?.data.name} />
        </div>
      </div>

      {loading && <div className="text-center text-gray-400 py-12">Loading runner data...</div>}

      {runner1 && runner2 && !loading && (
        <>
          {/* Names header */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="text-right">
              <Link href={`/runner?id=${runner1.id}`} className="text-lg font-bold text-gray-900 hover:text-comrades transition-colors">
                {runner1.data.name}
              </Link>
            </div>
            <div className="text-center text-gray-400 font-bold text-lg self-center">vs</div>
            <div className="text-left">
              <Link href={`/runner?id=${runner2.id}`} className="text-lg font-bold text-gray-900 hover:text-comrades transition-colors">
                {runner2.data.name}
              </Link>
            </div>
          </div>

          {/* Stats comparison */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Career Comparison</h3>
            <StatComparison label="Finishes" v1={r1Finishes} v2={r2Finishes} />
            <StatComparison label="Best Time" v1={formatTime(r1Best)} v2={formatTime(r2Best)} lowerBetter />
            <StatComparison label="Avg Time" v1={r1Avg ? secondsToTime(r1Avg) : "-"} v2={r2Avg ? secondsToTime(r2Avg) : "-"} lowerBetter />
            <StatComparison label="Best Medal" v1={r1Medal} v2={r2Medal} />
            <StatComparison
              label="Career Span"
              v1={runner1.data.races.length > 0 ? `${runner1.data.races[0].year}–${runner1.data.races[runner1.data.races.length - 1].year}` : "-"}
              v2={runner2.data.races.length > 0 ? `${runner2.data.races[0].year}–${runner2.data.races[runner2.data.races.length - 1].year}` : "-"}
            />
          </div>

          {/* Head-to-head in overlapping years */}
          {overlapping.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-700">
                  Head-to-Head Results ({overlapping.length} shared {overlapping.length === 1 ? "race" : "races"})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500">
                      <th className="text-center px-3 py-2 w-16">Year</th>
                      <th className="text-right px-3 py-2">Time</th>
                      <th className="text-right px-3 py-2">Medal</th>
                      <th className="text-center px-3 py-2 w-10"></th>
                      <th className="text-left px-3 py-2">Medal</th>
                      <th className="text-left px-3 py-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overlapping.map(year => {
                      const race1 = runner1.data.races.find(r => r.year === year);
                      const race2 = runner2.data.races.find(r => r.year === year);
                      const t1 = race1?.time || "";
                      const t2 = race2?.time || "";
                      const isFinish1 = t1 && !["DNS", "DNF", "Not started", "UOF"].includes(t1);
                      const isFinish2 = t2 && !["DNS", "DNF", "Not started", "UOF"].includes(t2);
                      const w1 = isFinish1 && (!isFinish2 || t1 < t2);
                      const w2 = isFinish2 && (!isFinish1 || t2 < t1);
                      return (
                        <tr key={year} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="text-center px-3 py-2">
                            <Link href={`/year?year=${year}`} className="text-comrades hover:underline font-medium">{year}</Link>
                          </td>
                          <td className={`text-right px-3 py-2 font-mono ${w1 ? "font-bold text-comrades" : isFinish1 ? "text-gray-700" : "text-gray-400"}`}>
                            {isFinish1 ? formatTime(t1) : t1}
                          </td>
                          <td className="text-right px-3 py-2">{race1?.medal && <MedalBadge medal={race1.medal} />}</td>
                          <td className="text-center px-3 py-2 text-gray-300">vs</td>
                          <td className="text-left px-3 py-2">{race2?.medal && <MedalBadge medal={race2.medal} />}</td>
                          <td className={`text-left px-3 py-2 font-mono ${w2 ? "font-bold text-comrades" : isFinish2 ? "text-gray-700" : "text-gray-400"}`}>
                            {isFinish2 ? formatTime(t2) : t2}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Win summary */}
              {(() => {
                let wins1 = 0, wins2 = 0, ties = 0;
                for (const year of overlapping) {
                  const r1 = runner1.data.races.find(r => r.year === year);
                  const r2 = runner2.data.races.find(r => r.year === year);
                  const t1 = r1?.time || "", t2 = r2?.time || "";
                  const f1 = t1 && !["DNS", "DNF", "Not started", "UOF"].includes(t1);
                  const f2 = t2 && !["DNS", "DNF", "Not started", "UOF"].includes(t2);
                  if (f1 && f2) {
                    if (t1 < t2) wins1++;
                    else if (t2 < t1) wins2++;
                    else ties++;
                  } else if (f1) wins1++;
                  else if (f2) wins2++;
                }
                return (
                  <div className="px-5 py-3 bg-gray-50/50 border-t border-gray-100 text-sm">
                    <span className={wins1 > wins2 ? "font-bold text-comrades" : "text-gray-600"}>{runner1.data.name}: {wins1}</span>
                    <span className="text-gray-400 mx-3">|</span>
                    {ties > 0 && <><span className="text-gray-500">Ties: {ties}</span><span className="text-gray-400 mx-3">|</span></>}
                    <span className={wins2 > wins1 ? "font-bold text-comrades" : "text-gray-600"}>{runner2.data.name}: {wins2}</span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Timeline visualization */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Career Timeline</h3>
            {(() => {
              const allYears = [...new Set([
                ...runner1.data.races.map(r => r.year),
                ...runner2.data.races.map(r => r.year),
              ])].sort((a, b) => a - b);

              return (
                <div className="space-y-1">
                  {allYears.map(year => {
                    const race1 = runner1.data.races.find(r => r.year === year);
                    const race2 = runner2.data.races.find(r => r.year === year);
                    const t1 = race1?.time || "";
                    const t2 = race2?.time || "";
                    const isF1 = t1 && !["DNS", "DNF", "Not started", "UOF"].includes(t1);
                    const isF2 = t2 && !["DNS", "DNF", "Not started", "UOF"].includes(t2);

                    // Normalize times to bar widths (5h = 0%, 12h = 100%)
                    const timeToWidth = (time: string) => {
                      const parts = time.split(":");
                      if (parts.length < 3) return 0;
                      const secs = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
                      return Math.min(100, Math.max(5, ((secs - 18000) / (43200 - 18000)) * 100));
                    };

                    return (
                      <div key={year} className="grid grid-cols-[1fr_50px_1fr] gap-1 items-center h-6">
                        {/* Runner 1 bar (right-aligned) */}
                        <div className="flex justify-end">
                          {isF1 && (
                            <div
                              className="h-4 rounded-l bg-comrades/70 flex items-center justify-end pr-1"
                              style={{ width: `${timeToWidth(t1)}%` }}
                              title={`${runner1.data.name}: ${formatTime(t1)} (${race1?.medal})`}
                            >
                              <span className="text-[9px] text-white font-mono truncate">{formatTime(t1)}</span>
                            </div>
                          )}
                          {race1 && !isF1 && <span className="text-[9px] text-gray-400">{t1}</span>}
                        </div>
                        {/* Year */}
                        <div className="text-center text-[10px] text-gray-500 font-mono">{year}</div>
                        {/* Runner 2 bar (left-aligned) */}
                        <div className="flex justify-start">
                          {isF2 && (
                            <div
                              className="h-4 rounded-r bg-amber-500/70 flex items-center pl-1"
                              style={{ width: `${timeToWidth(t2)}%` }}
                              title={`${runner2.data.name}: ${formatTime(t2)} (${race2?.medal})`}
                            >
                              <span className="text-[9px] text-white font-mono truncate">{formatTime(t2)}</span>
                            </div>
                          )}
                          {race2 && !isF2 && <span className="text-[9px] text-gray-400">{t2}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            <div className="flex justify-between mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-comrades/70 inline-block"></span> {runner1.data.name}</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500/70 inline-block"></span> {runner2.data.name}</span>
            </div>
          </div>
        </>
      )}

      {!runner1 && !runner2 && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">⚔️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Pick Two Runners</h3>
          <p className="text-gray-500 text-sm">Search for two athletes above to compare their Comrades careers side by side</p>
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto px-4 py-12 text-center text-gray-400">Loading...</div>}>
      <CompareContent />
    </Suspense>
  );
}
