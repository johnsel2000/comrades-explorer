// Data types matching our JSON exports

export interface Stats {
  totalResults: number;
  totalFinishes: number;
  uniqueAthletes: number;
  racesHeld: number;
  countries: number;
  clubs: number;
  yearRange: [number, number];
  maleAthletes: number;
  femaleAthletes: number;
  maleFinishes: number;
  femaleFinishes: number;
}

export interface YearData {
  year: number;
  finishers: number;
  totalEntries: number;
  medals: Record<string, number>;
  winner?: { name: string; time: string };
  winnerWomen?: { name: string; time: string };
  maleFinishers?: number;
  femaleFinishers?: number;
  date?: string;
  weather?: string;
  direction?: string;
  raceNumber?: string;
  distance?: string;
  cancelled?: boolean;
  starters?: number;
  officialFinishers?: number;
  entries?: number;
  finishRate?: number;
  narrativeLength?: number;
}

export interface LeaderboardRunner {
  rank: number;
  athleteId: string;
  name: string;
  finishes: number;
  firstYear: number;
  lastYear: number;
  bestMedal: string;
  gender: string;
}

export interface FastestTime {
  rank: number;
  year: number;
  name: string;
  time: string;
  direction: string;
}

export interface TopClub {
  rank: number;
  club: string;
  totalFinishes: number;
  uniqueRunners: number;
}

export interface TopCountry {
  rank: number;
  country: string;
  totalFinishes: number;
  uniqueRunners: number;
}

export interface Leaderboards {
  mostFinishes: LeaderboardRunner[];
  mostFinishesWomen: LeaderboardRunner[];
  fastestTimes: FastestTime[];
  fastestTimesWomen: FastestTime[];
  topClubs: TopClub[];
  topCountries: TopCountry[];
}

// Search index: [name, athleteId, finishes, firstYear, lastYear, bestMedalCode, gender]
export type SearchEntry = [string, string, number, number, number, string, string];

export interface RunnerRace {
  year: number;
  time: string;
  pos: string;
  medal: string;
  club: string;
  country: string;
  raceNo?: string;
  category?: string;
  categoryPos?: string;
  genderPos?: string;
}

export interface RunnerData {
  name: string;
  gender: string;
  races: RunnerRace[];
}

// Medal code to full name mapping
export const MEDAL_NAMES: Record<string, string> = {
  G: "Gold",
  W: "Wally Hayward",
  I: "Isavel Roche-Kelly",
  S: "Silver",
  B: "Bill Rowan",
  R: "Robert Mtshali",
  Z: "Bronze",
  V: "Vic Clapham",
};

export const MEDAL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Gold: { bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-300" },
  "Wally Hayward": { bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-300" },
  "Isavel Roche-Kelly": { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300" },
  Silver: { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300" },
  "Bill Rowan": { bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-300" },
  "Robert Mtshali": { bg: "bg-teal-100", text: "text-teal-800", border: "border-teal-300" },
  Bronze: { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-400" },
  "Vic Clapham": { bg: "bg-stone-200", text: "text-stone-800", border: "border-stone-400" },
};
