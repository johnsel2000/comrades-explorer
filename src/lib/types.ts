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
  avgFinishes: {
    all: { count: number; avgTotal: number; avgUp: number; avgDown: number };
    male: { count: number; avgTotal: number; avgUp: number; avgDown: number };
    female: { count: number; avgTotal: number; avgUp: number; avgDown: number };
  };
}

export interface YearData {
  year: number;
  finishers: number;
  totalEntries: number;
  medals: Record<string, number>;
  winner?: { name: string; time: string; athleteId?: string };
  winnerWomen?: { name: string; time: string; athleteId?: string };
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
  menRecords?: string[];    // e.g. ["overall"], ["up"], ["down"], ["overall", "up"]
  womenRecords?: string[];  // same format
}

// ---------------------------------------------------------------------------
// Year Detail types
// ---------------------------------------------------------------------------

export interface YearDetailPodiumEntry {
  pos: number;
  name: string;
  time: string;
  athleteId: string;
  medal: string;
}

export interface RecordPreviousInfo {
  time: string;
  holder: string;
  year: number;
  type: string;  // "overall" | "up" | "down"
}

export interface HeroicSecondPlace {
  name: string;
  time: string;
  athleteId: string;
  brokenRecord: RecordPreviousInfo;
}

export interface WomenWouldHaveWonMen {
  mostRecentYear: number;
  mensWinner: string;
  mensTime: string;
}

export interface UncannyDouble {
  otherYear: number;
  time: string;
  direction: string;
  sameDirection: boolean | null;
}

export interface RecordContext {
  menRecords?: string[];
  womenRecords?: string[];
  menPreviousRecord?: RecordPreviousInfo;
  womenPreviousRecord?: RecordPreviousInfo;
  heroicSecond?: HeroicSecondPlace;
  womenHeroicSecond?: HeroicSecondPlace;
  womenWouldHaveWonMen?: WomenWouldHaveWonMen;
  uncannyDouble?: UncannyDouble;
}

export interface YearDetailData {
  year: number;
  raceNumber: string;
  date: string;
  direction: string;
  distance: string;
  weather: string;
  temperature: string;
  timeLimit: string;
  cancelled: boolean;

  entries?: number;
  starters?: number;
  finishers?: number;
  finishRate?: number;
  maleFinishers?: number;
  femaleFinishers?: number;
  avgFinishTime?: string;

  medals?: Record<string, number>;
  topMen?: YearDetailPodiumEntry[];
  topWomen?: YearDetailPodiumEntry[];
  lastFinisher?: { name: string; time: string; pos: number };

  timeDistribution?: Array<{ bucket: string; count: number }>;
  categoryBreakdown?: Array<{ category: string; count: number; avgTime: string }>;
  topCountries?: Array<{ country: string; count: number }>;
  countryDataPct?: number;
  firstTimers?: { count: number; total: number; percentage: number };

  sameDirectionComparison?: {
    previousYear: number;
    direction: string;
    deltas: Record<string, {
      current: number | string;
      previous: number | string;
      delta?: number;
      deltaPct?: number;
      deltaSeconds?: number;
    }>;
  };

  historicalRank?: {
    fieldSizeRank: number;
    finishersRank: number;
    finishRateRank: number;
    winningTimeRank: number;
    winningTimeRankDir: number;
    totalRaces: number;
  };

  recordContext?: RecordContext;
  narrative?: string;
}

export interface CountryAthlete {
  name: string;
  athleteId: string;
  time: string;
  pos: number;
  genderPos: number;
  medal: string;
  gender: string;
}

export type CountryAthletes = Record<string, CountryAthlete[]>;

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
  athleteId: string;
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
  slug?: string;
  flag?: string;
}

// ---------------------------------------------------------------------------
// Country detail types
// ---------------------------------------------------------------------------

export interface CountryYearEntry {
  year: number;
  finishers: number;
  male: number;
  female: number;
  avgTime: string;
  medals: Record<string, number>;
  bestPosition: number;
}

export interface CountryTopRunner {
  name: string;
  finishes: number;
  bestTime: string;
  athleteId: string;
}

export interface CountryPodium {
  year: number;
  name: string;
  pos: number;
  overallPos?: number;
  time: string;
  athleteId: string;
}

export interface CountryDetailData {
  name: string;
  slug: string;
  flag: string;
  overview: {
    totalFinishers: number;
    uniqueAthletes: number;
    firstYear: number;
    latestYear: number;
    avgTime: string;
    avgSeconds: number;
    yearsActive: number;
  };
  yearlySeries: CountryYearEntry[];
  medalSummary: Record<string, number>;
  topRunners: CountryTopRunner[];
  podiumsMen: CountryPodium[];
  podiumsWomen: CountryPodium[];
}

export interface CountryListEntry {
  name: string;
  slug: string;
  flag: string;
  totalFinishers: number;
  uniqueAthletes: number;
  firstYear: number;
  latestYear: number;
  avgTime: string;
  yearsActive: number;
}

// ---------------------------------------------------------------------------
// Records & Stories types
// ---------------------------------------------------------------------------

export interface RecordsData {
  wallyHayward: Array<{
    year: number; time: string; pos: string; medal: string;
    genderPos: string; category: string;
  }>;
  remarkableWinners: Array<{
    name: string; athleteId: string; gender: string; country: string;
    wins: number; years: number[]; times: string[];
    maxGap: number; span: number;
  }>;
  repeatWinners: Array<{
    name: string; athleteId: string; gender: string; country: string;
    wins: number; years: number[]; times: string[];
    maxGap: number; span: number;
  }>;
  longestCareers: Array<{
    name: string; athleteId: string;
    firstYear: number; lastYear: number; span: number; totalRaces: number;
  }>;
  consecutiveFinishes: Array<{
    name: string; athleteId: string;
    streak: number; startYear: number; endYear: number; totalFinishes: number;
  }>;
  narrowestMargins: Array<{
    year: number;
    winner: string; winnerTime: string;
    runnerUp: string; runnerUpTime: string;
    marginSeconds: number;
  }>;
  widestMargins: Array<{
    year: number;
    winner: string; winnerTime: string;
    runnerUp: string; runnerUpTime: string;
    marginSeconds: number;
  }>;
  comebacks: Array<{
    name: string; athleteId: string; gender: string;
    dnfYear: number; comebackYear: number;
    comebackPos: number; comebackGenderPos: number;
    overallPos?: number; comebackTime: string;
  }>;
  repeatPodiums: Array<{
    name: string; athleteId: string; gender: string;
    count: number; span: number;
    podiums: Array<{ year: number; pos: number; time: string }>;
  }>;
  mostImproved: Array<{
    name: string; athleteId: string;
    firstYear: number; firstTime: string;
    bestYear: number; bestTime: string;
    improvementSeconds: number; totalRaces: number;
  }>;
  wonAfterMany: Array<{
    name: string; athleteId: string; gender: string;
    racesBeforeWin: number; firstWinYear: number; totalWins: number;
  }>;
  unusualCountries: Array<{
    country: string; flag: string; totalAthletes: number;
    pioneer: string; pioneerYear: number; pioneerTime: string;
    pioneerPos: string; pioneerAthleteId: string;
  }>;
  raceGrowth: Array<{
    year: number; finishers: number; athletes: number;
  }>;
  womenPioneers: {
    milestones: Array<{
      year: number; type: string;
      title: string; description: string;
      name: string; athleteId: string;
      time: string; pos: string;
    }>;
    growth: Array<{ year: number; count: number }>;
  };
  neverGaveUp: Array<{
    name: string; athleteId: string; gender: string;
    dnfCount: number; dnfYears: number[];
    finishYear: number; finishTime: string;
    finishPos: number; finishMedal: string;
    totalFinishes: number;
  }>;
  heroicSeconds: Array<{
    year: number;
    direction: string;
    gender: string;
    winner: string;
    winnerTime: string;
    winnerAthleteId: string;
    runnerUp: string;
    runnerUpTime: string;
    runnerUpAthleteId: string;
    previousRecord: string;
    previousHolder: string;
    previousYear: number;
    recordType: string;
    marginSeconds: number;
  }>;
  womenVsHistoricalMen: Array<{
    year: number;
    direction: string;
    womenWinner: string;
    womenTime: string;
    womenAthleteId: string;
    beatenMenYear: number;
    beatenMenWinner: string;
    beatenMenTime: string;
  }>;
  countryDominance: {
    menStreaks: Array<{
      country: string;
      startYear: number;
      endYear: number;
      length: number;
      athletes: Array<{ name: string; athleteId: string }>;
      years: number[];
    }>;
    womenStreaks: Array<{
      country: string;
      startYear: number;
      endYear: number;
      length: number;
      athletes: Array<{ name: string; athleteId: string }>;
      years: number[];
    }>;
    menSweeps: Array<{
      year: number;
      country: string;
      athletes: Array<{ name: string; athleteId: string; pos: number }>;
    }>;
    womenSweeps: Array<{
      year: number;
      country: string;
      athletes: Array<{ name: string; athleteId: string; pos: number }>;
    }>;
    winnerTimeline: Array<{
      year: number;
      menCountry?: string;
      menWinner?: string;
      menAthleteId?: string;
      womenCountry?: string;
      womenWinner?: string;
      womenAthleteId?: string;
    }>;
    firstForeignMen: { year: number; country: string; name: string; time: string; athleteId: string } | null;
    firstForeignWomen: { year: number; country: string; name: string; time: string; athleteId: string } | null;
    menWinsByCountry: Array<{ country: string; wins: number }>;
    womenWinsByCountry: Array<{ country: string; wins: number }>;
  };
  uncannyDoubles: Array<{
    name: string;
    athleteId: string;
    year1: number;
    time1: string;
    pos1: number;
    dir1: string;
    year2: number;
    time2: string;
    pos2: number;
    dir2: string;
    diffSeconds: number;
    sameDirection: boolean | null;
    yearGap: number;
  }>;
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

// ---------------------------------------------------------------------------
// Insights types
// ---------------------------------------------------------------------------

export interface InsightsData {
  greenNumberEffect: {
    finishRateByNthPotentialFinish: Array<{
      nth: number;
      attempts: number;
      finishes: number;
      rate: number;
    }>;
    summary: {
      rateAttempting10th: number;
      rateAttempting11th: number;
      effectSize10: number;
      rateAttempting20th: number;
      rateAttempting21st: number;
      effectSize20: number;
    };
  };
  backToBack: {
    firstTimerReturn: {
      totalFirstTimeFinishers: number;
      returnedNextRace: number;
      returnRate: number;
      returnedAndFinished: number;
      returnFinishRate: number;
    };
    consecutiveVsNon: {
      consecutiveAttempts: number;
      consecutiveFinishRate: number;
      nonConsecutiveAttempts: number;
      nonConsecutiveFinishRate: number;
    };
    streakDistribution: Array<{ streakLength: number; count: number }>;
    b2bByYear: Array<{
      year: number;
      nextYear: number;
      firstTimers: number;
      cameBack: number;
      b2bRate: number;
      direction: string;
      nextDirection: string;
      sameDirection: boolean | null;
    }>;
    medalEffect: {
      preMedalAvg: number;
      medalEraAvg: number;
      preCleanAvg: number;
      medalCleanAvg: number;
    };
    directionEffect: {
      sameDirAvg: number;
      diffDirAvg: number;
      sameDirCount: number;
      diffDirCount: number;
    };
  };
  slowdownCurve: Array<{
    transition: string;
    fromNth: number;
    toNth: number;
    avgDeltaSeconds: number;
    count: number;
  }>;
  avgTimesByAge: {
    byDecade: Array<Record<string, number | string>>;
    overall: Record<string, { avgTime: string; avgSeconds: number; count: number }>;
  };
  medalsByAge: Record<string, Record<string, number>>;
  upVsDown: {
    runnersWithBoth: number;
    avgUpTime: string;
    avgDownTime: string;
    avgUpSeconds: number;
    avgDownSeconds: number;
    avgDifferenceSeconds: number;
    fasterOnDown: number;
    fasterOnUp: number;
    // Pace-based fields
    avgUpDistanceKm: number;
    avgDownDistanceKm: number;
    distanceDifferenceKm: number;
    distanceDifferencePct: number;
    runnersWithBothPace: number;
    avgUpPace: number;
    avgUpPaceDisplay: string;
    avgDownPace: number;
    avgDownPaceDisplay: string;
    paceDifferenceSecKm: number;
    fasterOnDownByPace: number;
    fasterOnUpByPace: number;
  };
  dnfByAttempt: Array<{
    attemptNumber: number;
    total: number;
    dnfs: number;
    dnfRate: number;
  }>;
  returnRates: {
    totalFinishers: number;
    neverReturned: { count: number; pct: number };
    returnedWithin1Year: { count: number; pct: number };
    returnedWithin2Years: { count: number; pct: number };
    returnedWithin3Years: { count: number; pct: number };
    returnedAfter3PlusYears: { count: number; pct: number };
  };
  comebackKids: {
    longestGapReturn: { name: string; gapYears: number; athleteId: string };
    gapDistribution: Array<{ gap: number; count: number }>;
  };
  countryTrends: {
    countries: string[];
    data: Array<Record<string, number | string>>;
  };
  cutoffEffect: {
    byYear: Array<{
      year: number;
      cutoff: string;
      totalEntries: number;
      finishers: number;
      finishRate: number;
      inWindow: number;
      windowPct: number;
    }>;
    summary: {
      avgFinishRate11h: number;
      avgFinishRate12h: number;
      finishRateBoost: number;
      avgVicClaphamPct: number;
    };
  };
  genderGap: {
    trends: Array<{
      year: number;
      femalePct: number;
      femaleFinishers: number;
      maleFinishers: number;
      maleAvgTime?: string;
      maleAvgSecs?: number;
      femaleAvgTime?: string;
      femaleAvgSecs?: number;
      gapMinutes?: number;
    }>;
    summary: {
      firstFemaleYear: number;
      latestFemalePct: number;
      latestGapMinutes: number;
      peakFemalePct: number;
    };
  };
  personalBest: {
    distribution: Array<{
      nth: number;
      count: number;
      pct: number;
    }>;
    totalAthletes: number;
    mostCommonPbFinish: number;
  };
  dropoutCurve: {
    distribution: Array<{
      totalFinishes: number;
      athleteCount: number;
      label: string;
    }>;
    summary: {
      totalFinishingAthletes: number;
      oneAndDonePct: number;
      oneAndDoneCount: number;
      fivePlusPct: number;
      fivePlusCount: number;
      tenPlusPct: number;
      tenPlusCount: number;
    };
  };
  fieldVsFinish: Array<{
    year: number;
    entries: number;
    finishers: number;
    finishRate: number;
    cutoff: string;
  }>;
  medalCutoffClustering: {
    era: string;
    totalFinishes: number;
    distribution: Array<{
      time: string;
      minutes: number;
      count: number;
    }>;
    boundaries: Array<{
      boundary: string;
      cutoffTime: string;
      before15: number;
      after15: number;
      before5: number;
      after5: number;
      ratio: number;
      minuteDetail: Array<{
        time: string;
        count: number;
        isCutoff: boolean;
      }>;
    }>;
  };
  countryInsights: {
    performance: Array<{
      country: string;
      finishers: number;
      athletes: number;
      avgTime: string;
      avgSeconds: number;
      maleAvgTime: string | null;
      maleAvgSeconds: number | null;
      femaleAvgTime: string | null;
      femaleAvgSeconds: number | null;
      femalePct: number;
      elitePct: number;
      top10Count: number;
      top3Count: number;
      finishesPerAthlete: number;
    }>;
    genderBalance: Array<{
      country: string;
      finishers: number;
      femalePct: number;
      femaleCount: number;
      maleCount: number;
      genderGapMinutes: number | null;
    }>;
    medalQuality: Array<{
      country: string;
      finishers: number;
      goldPct: number;
      goldCount: number;
      elitePct: number;
      silverPlusPct: number;
      bronzePct: number;
      vicClaphamPct: number;
    }>;
    bestYears: Array<{
      country: string;
      bestYear: number;
      finishersInYear: number;
      avgPosition: number;
    }>;
    internationalGrowth: Array<{
      year: number;
      total: number;
      international: number;
      intlPct: number;
      countries: number;
    }>;
    scatter: Array<{
      country: string;
      avgSeconds: number;
      avgTime: string;
      femalePct: number;
      finishers: number;
      elitePct: number;
    }>;
  };
  performanceByAttempt: Array<{
    attempt: number;
    avgSeconds: number;
    avgTime: string;
    medianSeconds: number;
    medianTime: string;
    count: number;
    improvedPct: number | null;
    avgDeltaSeconds: number | null;
  }>;
  experienceVsAge: Array<{
    ageCategory: string;
    attemptBucket: string;
    avgSeconds: number;
    avgTime: string;
    count: number;
  }>;
  ageDirectionReversal: Array<{
    ageCategory: string;
    avgUpSeconds: number;
    avgUpTime: string;
    avgDownSeconds: number;
    avgDownTime: string;
    gapMinutes: number;
    pairedRunners: number;
    fasterOnDownPct: number;
    upCount: number;
    downCount: number;
    // Pace-based fields
    avgUpPace: number;
    avgUpPaceDisplay: string;
    avgDownPace: number;
    avgDownPaceDisplay: string;
    paceGapSecKm: number;
    pairedPaceRunners: number;
    fasterOnDownByPacePct: number;
  }>;
  greenNumberDeepDive: {
    preGreenAvgSeconds: number;
    preGreenAvgTime: string;
    postGreenAvgSeconds: number;
    postGreenAvgTime: string;
    slowdownMinutes: number;
    postGreenDnfRate: number;
    nonGreenDnfRate: number;
    byMilestone: Array<{
      label: string;
      avgSeconds: number | null;
      avgTime: string | null;
      medianSeconds: number | null;
      medianTime: string | null;
      count: number;
      dnfRate: number;
    }>;
    dnfJourney: {
      greenRunners: number;
      avgPreGreenDnfRate: number;
      avgPostGreenDnfRate: number;
      zeroPreDnfPct: number;
      preGreenTotalAttempts: number;
      preGreenTotalDnfs: number;
      postGreenTotalAttempts: number;
      postGreenTotalDnfs: number;
      aggregatePreRate: number;
      aggregatePostRate: number;
    };
  };
  streakPerformance: Array<{
    streakBucket: string;
    avgSeconds: number;
    avgTime: string;
    medianSeconds: number;
    medianTime: string;
    count: number;
  }>;
  countryMeanMedian: Array<{
    country: string;
    meanSeconds: number;
    meanTime: string;
    medianSeconds: number;
    medianTime: string;
    gapSeconds: number;
    gapPct: number;
    count: number;
  }>;
  finishHourDistribution: {
    overall: Array<{
      bracket: string;
      count: number;
      pct: number;
    }>;
    byDecade: Array<{
      decade: number;
      total: number;
      [key: string]: number;
    }>;
  };
  retentionCurve: {
    overall: Array<{
      nthFinish: number;
      reached: number;
      pct: number;
    }>;
    byDecade: Array<{
      decade: string;
      totalAthletes: number;
      data: Array<{
        nthFinish: number;
        pct: number;
      }>;
    }>;
  };
}

// ---------------------------------------------------------------------------
// Green Number tiers
// ---------------------------------------------------------------------------

export type GreenNumberTier = "green" | "double" | "triple" | "quad" | "quintuple" | null;

export function getGreenNumberTier(finishes: number): GreenNumberTier {
  if (finishes >= 50) return "quintuple";
  if (finishes >= 40) return "quad";
  if (finishes >= 30) return "triple";
  if (finishes >= 20) return "double";
  if (finishes >= 10) return "green";
  return null;
}

export const GREEN_NUMBER_LABELS: Record<string, string> = {
  green: "Green Number",
  double: "Double Green",
  triple: "Triple Green",
  quad: "Quadruple Green",
  quintuple: "Quintuple Green",
};

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
