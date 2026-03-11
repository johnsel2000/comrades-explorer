import type { Stats, YearData, Leaderboards, SearchEntry, RunnerData } from "./types";

const BASE = "/data";

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.json();
}

export async function getStats(): Promise<Stats> {
  return fetchJSON<Stats>("stats.json");
}

export async function getYears(): Promise<YearData[]> {
  return fetchJSON<YearData[]>("years.json");
}

export async function getLeaderboards(): Promise<Leaderboards> {
  return fetchJSON<Leaderboards>("leaderboards.json");
}

export async function getSearchBucket(letter: string): Promise<SearchEntry[]> {
  const key = letter.toLowerCase().replace(/[^a-z]/, "other");
  return fetchJSON<SearchEntry[]>(`search/${key}.json`);
}

export async function getRunnerBucket(
  athleteId: string
): Promise<Record<string, RunnerData>> {
  const prefix = athleteId.substring(0, 2).toUpperCase();
  return fetchJSON<Record<string, RunnerData>>(`runners/${prefix}.json`);
}

export async function getRunner(
  athleteId: string
): Promise<RunnerData | null> {
  try {
    const normalizedId = athleteId.toUpperCase();
    const bucket = await getRunnerBucket(normalizedId);
    return bucket[normalizedId] || null;
  } catch {
    return null;
  }
}

export function formatTime(time: string): string {
  if (!time || time === "00:00:00") return "-";
  // Remove leading zeros from hours: "05:13:58" -> "5:13:58"
  return time.replace(/^0(\d)/, "$1");
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-ZA");
}
