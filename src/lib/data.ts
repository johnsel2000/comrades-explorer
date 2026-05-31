import type { Stats, YearData, Leaderboards, SearchEntry, RunnerData, InsightsData, YearDetailData, CountryDetailData, CountryListEntry, RecordsData, CountryAthletes } from "./types";

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

export async function getYearDetail(year: number): Promise<YearDetailData | null> {
  try {
    return await fetchJSON<YearDetailData>(`year/${year}.json`);
  } catch {
    return null;
  }
}

export async function getYearCountryAthletes(year: number): Promise<CountryAthletes | null> {
  try {
    return await fetchJSON<CountryAthletes>(`year/${year}-country-athletes.json`);
  } catch {
    return null;
  }
}

export async function getInsights(): Promise<InsightsData> {
  return fetchJSON<InsightsData>("insights.json");
}

export async function getCountries(): Promise<CountryListEntry[]> {
  return fetchJSON<CountryListEntry[]>("countries.json");
}

export async function getCountryDetail(slug: string): Promise<CountryDetailData | null> {
  try {
    return await fetchJSON<CountryDetailData>(`country/${slug}.json`);
  } catch {
    return null;
  }
}

export interface ClubAthlete {
  name: string;
  athleteId: string;
  time: string;
  pos: number | null;
  genderPos: number | null;
  medal: string;
  gender: string;
}

export type ClubAthletes = Record<string, ClubAthlete[]>;

export async function getClubAthletes(slug: string): Promise<ClubAthletes | null> {
  try {
    return await fetchJSON<ClubAthletes>(`club/${slug}-athletes.json`);
  } catch {
    return null;
  }
}

export interface ClubYearRanking {
  slug: string;
  name: string;
  entries: number;
  finishers: number;
  golds: number;
  silvers: number;
  dnfs: number;
  finishRate: number;
  avgTime: string | null;
  avgSeconds: number | null;
}

export async function getClubRankings(): Promise<Record<string, ClubYearRanking[]>> {
  return fetchJSON<Record<string, ClubYearRanking[]>>("club-rankings.json");
}

export function slugifyCountry(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function slugifyClub(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Club slug resolution: maps any club slug to the slug of its detail page (or null if none)
let _clubSlugMap: Map<string, string> | null = null;
export async function getClubSlugMap(): Promise<Map<string, string>> {
  if (!_clubSlugMap) {
    _clubSlugMap = new Map();
    try {
      const [slugs, redirects] = await Promise.all([
        fetchJSON<string[]>("club-slugs.json"),
        fetchJSON<Record<string, string>>("club-redirects.json").catch(() => ({})),
      ]);
      // Direct pages: slug maps to itself
      for (const s of slugs) _clubSlugMap.set(s, s);
      // Redirects: variant slug maps to canonical slug
      for (const [from, to] of Object.entries(redirects)) {
        if (!_clubSlugMap.has(from)) _clubSlugMap.set(from, to);
      }
    } catch {
      /* empty */
    }
  }
  return _clubSlugMap;
}

/** Resolve a club name to its detail page slug, or null if no page exists */
export async function resolveClubSlug(clubName: string): Promise<string | null> {
  const map = await getClubSlugMap();
  const slug = slugifyClub(clubName);
  return map.get(slug) ?? null;
}

// Kept for backward compat
export async function getValidClubSlugs(): Promise<Set<string>> {
  const map = await getClubSlugMap();
  return new Set(map.keys());
}

export interface AthleteBio {
  name: string;
  bio: string;
  wikipedia?: string;
  tags: string[];
}

let _biosCache: Record<string, AthleteBio> | null = null;

export async function getAthleteBio(athleteId: string): Promise<AthleteBio | null> {
  try {
    if (!_biosCache) {
      _biosCache = await fetchJSON<Record<string, AthleteBio>>("bios.json");
    }
    return _biosCache[athleteId.toUpperCase()] || null;
  } catch {
    return null;
  }
}

export async function getRecords(): Promise<RecordsData> {
  return fetchJSON<RecordsData>("records.json");
}

export interface ExplorerData {
  lastSecondFinishers: { year: number; finishers: number; last60s: number; last5min: number; last15min: number }[];
  familyPairs: { year: number; surname: string; runner1: { name: string; athleteId: string; time: string; medal: string }; runner2: { name: string; athleteId: string; time: string; medal: string } }[];
  medalRainbow: { name: string; athleteId: string; medalTypes: number; medals: string[]; totalFinishes: number; years: string }[];
  decadeChampions: { men: { decade: string; name: string; athleteId: string; wins: number; years: number[] }[]; women: { decade: string; name: string; athleteId: string; wins: number; years: number[] }[] };
  ironStreaks: { name: string; athleteId: string; streak: number; startYear: number; endYear: number; isActive: boolean; bestTime: string; bestMedal: string }[];
  noviceStats: { decade: string; count: number; avgTime: number; medianTime: number; dnfRate: number; medalBreakdown: Record<string, number> }[];
  percentileData: { percentile: number; time: string }[];
  countryGrowthMap: { decade: string; countries: number; internationalRunners: number; topCountries: { country: string; runners: number }[] }[];
  determination: {
    totalDnfers: number;
    b2bTotal: number;
    b2bWithPriorDnf: number;
    dnfersLaterB2b: number;
    firstDnfOutcomes: {
      cohort: number;
      neverReturned: number;
      returnedDnsOnly: number;
      returnedNeverFinished: number;
      eventuallyFinished: number;
    };
    persistenceByDnfCount: { minDnfs: number; cohort: number; persisted: number; gaveUp: number; persistedPct: number }[];
    firstAttemptDnf: {
      total: number;
      gaveUp: number;
      returnedDnsOnly: number;
      returnedNeverFinished: number;
      eventuallyFinished: number;
    };
    multiDnfNoFinish: number;
    longestDnfStreaks: { name: string; athleteId: string; streak: number; streakStart: number; streakEnd: number; totalDnfs: number; finallyFinished: boolean }[];
    topPersisters: { name: string; athleteId: string; dnfs: number; firstFinishYear: number; dnfYears: number[] }[];
    topNeverFinishers: { name: string; athleteId: string; dnfs: number; firstYear: number; lastYear: number; dnfYears: number[] }[];
  };
}

export interface ClubData {
  club: string;
  totalFinishes: number;
  uniqueRunners: number;
  goldMedals: number;
  firstYear: number;
  lastYear: number;
  topRunner: { name: string; athleteId: string; finishes: number };
}

let _explorerCache: ExplorerData | null = null;

export async function getExplorerData(): Promise<ExplorerData> {
  if (!_explorerCache) {
    _explorerCache = await fetchJSON<ExplorerData>("explorer.json");
  }
  return _explorerCache;
}

export async function getClubs(): Promise<ClubData[]> {
  return fetchJSON<ClubData[]>("clubs.json");
}

export interface ClubListEntry {
  name: string;
  slug: string;
  totalFinishers: number;
  uniqueAthletes: number;
  firstYear: number;
  latestYear: number;
  avgTime: string | null;
  yearsActive: number;
  totalGolds: number;
  totalWins: number;
}

export interface ClubDetailData {
  name: string;
  slug: string;
  overview: {
    totalFinishers: number;
    uniqueAthletes: number;
    firstYear: number;
    latestYear: number;
    avgTime: string | null;
    avgSeconds: number | null;
    yearsActive: number;
    totalGolds: number;
    totalWins: number;
  };
  yearlySeries: {
    year: number;
    finishers: number;
    male: number;
    female: number;
    avgTime: string | null;
    medals: Record<string, number>;
  }[];
  medalSummary: Record<string, number>;
  topRunners: {
    name: string;
    finishes: number;
    bestTime: string;
    athleteId: string;
    bestMedal: string;
    golds: number;
  }[];
  winnersMen: { year: number; name: string; time: string; athleteId: string }[];
  winnersWomen: { year: number; name: string; time: string; athleteId: string }[];
  podiumsMen: { year: number; name: string; pos: number; time: string; athleteId: string }[];
  podiumsWomen: { year: number; name: string; pos: number; time: string; athleteId: string }[];
}

export async function getClubList(): Promise<ClubListEntry[]> {
  return fetchJSON<ClubListEntry[]>("club-list.json");
}

export async function getClubDetail(slug: string): Promise<ClubDetailData | null> {
  try {
    return await fetchJSON<ClubDetailData>(`club/${slug}.json`);
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getAdvancedSearchData(): Promise<any> {
  return fetchJSON("advanced-search.json");
}
