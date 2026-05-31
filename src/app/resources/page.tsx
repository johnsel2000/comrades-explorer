"use client";

import Link from "next/link";

const SECTIONS = [
  { id: "articles", label: "Notable Articles" },
  { id: "books", label: "Books" },
  { id: "websites", label: "Websites" },
  { id: "legends", label: "Legends Wiki" },
  { id: "films", label: "Films & Docs" },
  { id: "podcasts", label: "Podcasts" },
];

interface BookEntry {
  title: string;
  author: string;
  year?: string;
  description: string;
  url?: string;
  category: string;
}

interface ArticleEntry {
  title: string;
  publication: string;
  author?: string;
  url: string;
  description: string;
  year?: string;
}

const ARTICLES: ArticleEntry[] = [
  {
    title: "The Famous Comrades Marathon",
    publication: "Runner's World",
    author: "Amby Burfoot",
    url: "https://www.runnersworld.com/races-places/a20788208/the-famous-comrades-marathon/",
    description: "The 1968 Boston Marathon winner writes about running Comrades and the famous Polly Shortts hill anecdote with Fordyce. Notably, Burfoot displays only two medals at home: his Boston winner's medal and his Comrades bronze.",
  },
  {
    title: "The Race of His Life",
    publication: "Runner's World",
    author: "Bart Yasso",
    url: "https://web.archive.org/web/20160513112358/http://rw.runnersworld.com/selects/the-race-of-his-life.html",
    description: "The 'Mayor of Running' and inventor of the famous Yasso 800s writes about his Comrades experience — calling South Africa and the Comrades his 'number one place' in the world of running.",
  },
  {
    title: "Comrades",
    publication: "Tracksmith Journal",
    url: "https://www.tracksmith.com/journal/article/comrades",
    description: "Widely considered one of the best long-read features on the race. Blends sports journalism with South African political history, exploring how the race's meaning evolved alongside the transition from apartheid.",
    year: "2022",
  },
  {
    title: "The Will to Endure",
    publication: "Tracksmith Journal",
    url: "https://www.tracksmith.com/journal/article/the-will-to-endure",
    description: "A personal essay about women in ultrarunning with Comrades as a central thread. Features Ann Trason's photo with Nelson Mandela and the author's own transformative experience running the race.",
    year: "2023",
  },
  {
    title: "The Comrades Marathon: 'You plan your life around the race'",
    publication: "ESPN",
    url: "https://www.espn.com/espn/story/_/id/23692454/comrades-marathon-running-endurance-ultramarathon-brandon-jackson",
    description: "A rich feature covering the race's WWI origins, its history with apartheid, Fordyce's anti-apartheid protest, and the three types of pain Comrades finishers endure.",
    year: "2018",
  },
  {
    title: "How South Africa's Comrades Ultramarathon Helped Immigrant Jews Belong",
    publication: "Tablet Magazine",
    url: "https://www.tabletmag.com/sections/sports/articles/comrades-south-africa",
    description: "A unique angle exploring how the Comrades became a vehicle for Jewish immigrant integration into South African society. Covers Dave Levick, the only Jewish Comrades winner (1973).",
    year: "2018",
  },
  {
    title: "UltraRunning Interview: Comrades Champion Bruce Fordyce",
    publication: "UltraRunning Magazine",
    url: "https://ultrarunning.com/features/ultrarunning-interview-comrades-champion-bruce-fordyce/",
    description: "In-depth interview with the nine-time winner. Fordyce describes 14,000 runners, a million spectators, and 3 million TV viewers. Discusses the race's apartheid history.",
  },
  {
    title: "After Winning Comrades, Camille Herron Focuses on Western States",
    publication: "Trail Runner Magazine",
    url: "https://trailrunnermag.com/people/news/winning-comrades-camille-heron-sets-sights-western-states.html",
    description: "Profile of Herron after she became the first American woman since Ann Trason (1997) to win Comrades in 2017, despite training on an injured knee.",
    year: "2017",
  },
  {
    title: "99 Years of the Ultimate Human Race",
    publication: "The Heritage Portal",
    url: "https://www.theheritageportal.co.za/article/99-years-ultimate-human-race-journey-through-comrades-history",
    description: "Historical feature including Max Trimborn, who served as the race's rooster-crower for 32 years \u2014 his recorded crow still starts the race today.",
  },
  {
    title: "The Greatest Footrace",
    publication: "Spotlight English",
    url: "https://spotlightenglish.com/good-stories/the-greatest-footrace/",
    description: "Feature for an international audience. Quotes writer Jacob Dlamini: \"The Comrades is a way to tell the history of modern South Africa.\"",
  },
  {
    title: "The Run of a Lifetime",
    publication: "Runner's Life",
    author: "Sulette Ferreira",
    url: "https://medium.com/runners-life/the-run-of-a-lifetime-9ba0121832f2",
    description: "The story of Barry Holland's quest for 50 consecutive Comrades finishes, including the dramatic 1967 finish decided by a single second.",
    year: "2024",
  },
  {
    title: "The Comrades Marathon",
    publication: "Ultrarunning History",
    author: "Davy Crockett",
    url: "https://ultrarunninghistory.com/comrades-marathon",
    description: "Comprehensive historical deep-dive covering the race from its founding. Profiles of Arthur Newton (who had to cut back on his 20-year smoking habit to train) and pioneer woman runner Mavis Hutchison.",
  },
  {
    title: "The Comrades",
    publication: "99% Invisible",
    url: "https://99percentinvisible.org/episode/the-comrades/",
    description: "Episode of the popular design/storytelling podcast exploring the Comrades Marathon's history, culture, and significance as a lens on South African society.",
  },
  {
    title: "The Race of His Life",
    publication: "Runner's World",
    author: "Bart Yasso",
    url: "https://web.archive.org/web/20160513112358/http://rw.runnersworld.com/selects/the-race-of-his-life.html",
    description: "Runner's World's 'Mayor of Running' writes about his Comrades experience \u2014 the race he called the most profound of his life. Yasso is famous for the 'Yasso 800s' marathon predictor workout.",
  },
];

const BOOKS: BookEntry[] = [
  {
    title: "The Comrades Marathon Story",
    author: "Morris Alexander",
    year: "1966 / 1976 / 1985",
    description:
      "The definitive early history by the official Comrades historian. Alexander ran 10 Comrades, earned 3 golds, and single-handedly helped save the race from extinction in 1950. The expanded 1985 edition (533 pages) covers the race's first six decades.",
    url: "https://www.amazon.co.uk/Comrades-Marathon-story-Morris-Alexander/dp/0702107093",
    category: "history",
  },
  {
    title: "Comrades Marathon: The Ultimate Human Race",
    author: "John Cameron-Dow",
    year: "2010",
    description:
      "A 10-year labour of love covering every race from 1921 to the 85th edition. Cameron-Dow, a veteran of 10 Comrades and green number holder, chronicles the race's century-long journey comprehensively.",
    url: "https://www.amazon.com/Comrades-Marathon-Ultimate-Human-Race-ebook/dp/B06XDP297Z",
    category: "history",
  },
  {
    title: "Running Alone",
    author: "Jackie Mekler",
    year: "2019",
    description:
      "The autobiography of the 5-time winner, 45 years in the making. Drawn from meticulous diaries, it covers his childhood in an orphanage, the golden era of Comrades, and world records. Published shortly before his death at 87.",
    url: "https://www.amazon.com/Running-Alone-Autobiography-Long-distance-Runner/dp/0639946690",
    category: "memoir",
  },
  {
    title: "Runaway Comrade",
    author: "Bob de la Motte",
    year: "2014",
    description:
      "Personal memoir by a 5-medal winner (including 3 golds) who had epic duels with Bruce Fordyce in the 1980s. Covers allegations, apartheid-era sport, and his emigration to Australia. Proceeds benefit black ultra-marathon runners from the 1974\u201390 era.",
    url: "https://www.amazon.com/Runaway-Comrade-Bob-Motte/dp/1502821842",
    category: "memoir",
  },
  {
    title: "Bruce Fordyce: Comrades King",
    author: "John Cameron-Dow",
    year: "2001",
    description:
      "Biography of the 9-time winner, covering his legendary streak, anti-apartheid activism, and impact on the race.",
    url: "https://www.goodreads.com/book/show/3532729-bruce-fordyce",
    category: "memoir",
  },
  {
    title: "Winged Messenger: Running Your First Comrades Marathon",
    author: "Bruce Fordyce",
    year: "2020",
    description:
      "Fordyce's guide for novices, sharing his 1976/77 training diary and the journey to his first Comrades amid apartheid-era South Africa. A blend of training guide and personal memoir.",
    url: "https://www.brucefordyce.com/winged-messenger/",
    category: "training",
  },
  {
    title: "Run the Comrades",
    author: "Bruce Fordyce",
    description:
      "Detailed preparation guide by the 9-time winner covering training, racing, rest, diet, fueling, and personal experiences with training diary excerpts.",
    url: "https://www.goodreads.com/book/show/28115649-run-the-comrades",
    category: "training",
  },
  {
    title: "Make Sure of Your Comrades Medal",
    author: "Don Oliver",
    description:
      "Classic training guide by a coach who earned 19 medals and guided thousands of novices. His philosophy of 'biteable bits and chewable chunks' \u2014 gradual progression \u2014 has helped many runners achieve their Comrades dream.",
    category: "training",
  },
  {
    title: "The Lore of Running",
    author: "Tim Noakes",
    year: "2003 (4th ed.)",
    description:
      "The \"Bible\" of running. Covers training from 10K through ultramarathon with extensive Comrades Marathon content. Noakes ran 7 Comrades himself (best: 6:49, Silver medal).",
    url: "https://www.amazon.com/Lore-Running-4th-Timothy-Noakes/dp/0873229592",
    category: "training",
  },
  {
    title: "Tea with Mr. Newton: 100,000 Miles",
    author: "Rob Hadgraft",
    description:
      "Biography of Arthur Newton, the 5-time Comrades winner who pioneered high-mileage training and set world records at 50 miles, 100 miles, and 24 hours.",
    category: "memoir",
  },
  {
    title: "I Ran For My Life",
    author: "Kabelo Mabalane",
    description:
      "The kwaito music star and 13-time Comrades finisher tells how running saved him from substance abuse and transformed his life.",
    category: "memoir",
  },
];

interface WikiLegend {
  name: string;
  athleteId?: string;
  wikiUrl: string;
  summary: string;
}

const LEGENDS: WikiLegend[] = [
  {
    name: "Bruce Fordyce",
    athleteId: "06767F20-DACF-49AA-BABB-A11EBBE9A77D",
    wikiUrl: "https://en.wikipedia.org/wiki/Bruce_Fordyce",
    summary: "9 wins (8 consecutive 1981\u201388, plus 1990). Down-run record holder for 21 years. Anti-apartheid activist. Founded parkrun in South Africa.",
  },
  {
    name: "Arthur Newton",
    athleteId: "27239E7D-E271-406B-AAA7-C5F7D614FA3C",
    wikiUrl: "https://en.wikipedia.org/wiki/Arthur_F._H._Newton",
    summary: "5 wins (1922\u201327). English-born, started running at 38. Pioneer of high-mileage training. World records at 50mi, 100mi, and 24hr.",
  },
  {
    name: "Wally Hayward",
    wikiUrl: "https://en.wikipedia.org/wiki/Wally_Hayward",
    summary: "5 wins (1930\u201354). Finished the 1988 Comrades at age 79. 1952 Olympian. Career spanning 59 years.",
  },
  {
    name: "Hardy Ballington",
    athleteId: "92BAFEC0-B382-4126-B9C0-C34B898DC02D",
    wikiUrl: "https://en.wikipedia.org/wiki/Comrades_Marathon",
    summary: "5 wins (1933\u201347). Dominated pre-war era and returned to win after WWII. Rival of Wally Hayward.",
  },
  {
    name: "Jackie Mekler",
    athleteId: "3FB8E79E-5BAB-4EB9-81C3-4E64B4AEC916",
    wikiUrl: "https://en.wikipedia.org/wiki/Jackie_Mekler",
    summary: "5 wins (1958\u201368). First to break the 6-hour barrier on the Up Run (5:56:32 in 1960). 10 gold medals.",
  },
  {
    name: "Gerda Steyn",
    athleteId: "ADC35239-1375-40A3-9E6C-32A8C536E32E",
    wikiUrl: "https://en.wikipedia.org/wiki/Gerda_Steyn",
    summary: "4 wins (2019\u201325). Holds both up-run (5:49:46) and down-run records. First woman sub-6h on the up run. SA marathon record holder.",
  },
  {
    name: "Alan Robb",
    athleteId: "E4340967-B3CE-4DF7-934E-147537656DC2",
    wikiUrl: "https://en.wikipedia.org/wiki/Comrades_Marathon",
    summary: "4 wins (1976\u201378, 1980). Set the course record in 1978. Dominated the late 1970s before the Fordyce era.",
  },
  {
    name: "Elena Nurgalieva",
    wikiUrl: "https://en.wikipedia.org/wiki/Elena_Nurgalieva",
    summary: "8 wins \u2014 most women's victories ever. Identical twin with Olesya (10 wins between them). Anchored Russia's 11-year winning streak.",
  },
  {
    name: "Frith van der Merwe",
    wikiUrl: "https://en.wikipedia.org/wiki/Frith_van_der_Merwe",
    summary: "3 wins (1988\u201391). First woman to break 6 hours (5:54:43 in 1989). Record stood for 34 years until Gerda Steyn.",
  },
  {
    name: "Tete Dijana",
    athleteId: "085FCC36-DBCD-4330-B1D0-42CDA43F3169",
    wikiUrl: "https://en.wikipedia.org/wiki/Comrades_Marathon",
    summary: "Holds the fastest recorded men's time (5:13:58, 2023 down run). 3-time winner.",
  },
  {
    name: "Bongmusa Mthembu",
    athleteId: "34459797-8B4D-4D1B-BD21-3AB7131C4293",
    wikiUrl: "https://en.wikipedia.org/wiki/Bongmusa_Mthembu",
    summary: "3 wins (2014\u201318). 11 gold medals. Former bricklayer from rural KwaZulu-Natal. SA 100km record holder.",
  },
  {
    name: "Stephen Muzhingi",
    athleteId: "7353CD81-E5E3-4BF3-BD4F-575E0F8C8235",
    wikiUrl: "https://en.wikipedia.org/wiki/Stephen_Muzhingi",
    summary: "3 consecutive wins (2009\u201311) from Zimbabwe. Former barber. First to win 3 straight since Fordyce.",
  },
  {
    name: "Dave Bagshaw",
    athleteId: "32909030-373B-4ABA-8202-8B4F00630014",
    wikiUrl: "https://en.wikipedia.org/wiki/Comrades_Marathon",
    summary: "3 consecutive wins (1969\u201371). Set the course record in 1969. Dominant force of the early 1970s.",
  },
  {
    name: "Vladimir Kotov",
    athleteId: "53498112-A120-4DE3-AF90-7F37067A10EC",
    wikiUrl: "https://en.wikipedia.org/wiki/Comrades_Marathon",
    summary: "3 wins (2000, 2002, 2004). Part of Russian golden era that dominated the early 2000s.",
  },
  {
    name: "Leonid Shvetsov",
    wikiUrl: "https://en.wikipedia.org/wiki/Leonid_Shvetsov",
    summary: "Holds the up-run record (5:24:49, 2008). Broke Fordyce's down-run record with 5:20:49 (2007). Two-time Olympian.",
  },
  {
    name: "Maria Bak",
    athleteId: "BAB35012-BC3D-4DD9-AB6E-8907CBC40AE1",
    wikiUrl: "https://en.wikipedia.org/wiki/Comrades_Marathon",
    summary: "3 wins (1995, 2000, 2002). Russian runner, part of the wave of Eastern European dominance.",
  },
  {
    name: "Betty Cavanagh",
    athleteId: "3D70896F-A8FB-4099-9505-1B44355FFAF1",
    wikiUrl: "https://en.wikipedia.org/wiki/Comrades_Marathon",
    summary: "4 wins (1970\u201372, 1975). Dominated the early era of women's participation.",
  },
  {
    name: "Helen Lucre",
    athleteId: "75307334-E727-486A-BE3E-C0A2B19CEE4C",
    wikiUrl: "https://en.wikipedia.org/wiki/Comrades_Marathon",
    summary: "3 consecutive wins (1985\u201387). Bridged the pioneer and modern eras of women's Comrades racing.",
  },
  {
    name: "Ann Trason",
    athleteId: "5B73167C-8171-4DCF-B800-5AE76A5E5EDB",
    wikiUrl: "https://en.wikipedia.org/wiki/Ann_Trason",
    summary: "Won Comrades 1996 & 1997. American with 20 world records and 14 Western States 100 wins. SI's 65th greatest female athlete of the 20th century.",
  },
  {
    name: "Sam Tshabalala",
    athleteId: "D5BA88E7-513F-4AA4-A10B-1819D3E0F5AB",
    wikiUrl: "https://en.wikipedia.org/wiki/Comrades_Marathon",
    summary: "First black winner (1989). Railway worker whose victory was a deeply symbolic moment during apartheid.",
  },
  {
    name: "Amby Burfoot",
    athleteId: "5D585131-B601-47EB-8059-AE79EABA02C2",
    wikiUrl: "https://en.wikipedia.org/wiki/Amby_Burfoot",
    summary: "1968 Boston Marathon winner. Runner's World editor-in-chief. Ran Comrades twice and keeps only his Boston medal and Comrades bronze at home.",
  },
  {
    name: "Bill Rowan",
    athleteId: "324F44D4-37FC-439D-9209-4E4846F87466",
    wikiUrl: "https://en.wikipedia.org/wiki/Comrades_Marathon",
    summary: "Inaugural winner (1921). WWI veteran. The Bill Rowan medal is named in his honour.",
  },
  {
    name: "Vic Clapham",
    wikiUrl: "https://en.wikipedia.org/wiki/Vic_Clapham",
    summary: "Founder of the Comrades Marathon. WW1 veteran who conceived the race to honour fallen comrades. First race held 24 May 1921.",
  },
  {
    name: "Mavis Hutchison",
    athleteId: "126C8C8A-D0F2-4766-AE12-4302D7B831FE",
    wikiUrl: "https://en.wikipedia.org/wiki/Mavis_Hutchison",
    summary: "\"The Galloping Granny.\" 2 wins (1965\u201366). Ran across America in 1978 at age 53. Pioneer who fought for women's entry.",
  },
  {
    name: "Frances Hayward",
    athleteId: "A895E657-8A92-443E-AC0F-201EB57A8395",
    wikiUrl: "https://en.wikipedia.org/wiki/Comrades_Marathon",
    summary: "First woman to complete the Comrades (1923). Ran in a time when women's participation was almost unheard of.",
  },
];

interface FilmEntry {
  title: string;
  year: string;
  type: string;
  description: string;
  url?: string;
}

const FILMS: FilmEntry[] = [
  {
    title: "Down, A Comrades Story",
    year: "2023",
    type: "Documentary",
    description:
      "Celebrates 100 years of the race through the 2022 down run. Covers Fordyce's apartheid protest, Tshabalala's historic win, and Van Der Merwe's record. Made by two Comrades runners.",
    url: "https://stories.showmax.com/za/down-a-comrades-story-2023",
  },
  {
    title: "Comrades",
    year: "2008",
    type: "Documentary",
    description:
      "Follows 7 diverse South Africans competing in the race while telling the marathon's story as a symbol of unity. Won Best Sports Documentary at Action on Film International Film Festival 2009.",
    url: "https://www.imdb.com/title/tt1428019/",
  },
  {
    title: "The Long Run",
    year: "2001",
    type: "Feature Film",
    description:
      "Drama based around the Comrades Marathon, starring Oscar-nominee Armin Mueller-Stahl and Nthati Moshesh.",
    url: "https://en.wikipedia.org/wiki/The_Long_Run_(film)",
  },
];

interface PodcastEntry {
  title: string;
  host: string;
  description: string;
  url?: string;
}

const PODCASTS: PodcastEntry[] = [
  {
    title: "Up / Down \u2014 A Comrades Marathon Podcast",
    host: "Coach Parry (Lindsey Parry & Brad Brown)",
    description:
      "The primary dedicated Comrades podcast. Training advice, interviews with runners, race strategy, and pacing \u2014 with alternating Up and Down series for each year's direction.",
    url: "https://open.spotify.com/show/24iEAk77R7iITEQed8SpLP",
  },
  {
    title: "The Comrades (99% Invisible)",
    host: "Roman Mars",
    description:
      "Episode of the popular design/storytelling podcast exploring the Comrades Marathon's history, culture, and significance.",
    url: "https://99percentinvisible.org/episode/the-comrades/",
  },
  {
    title: "Women's Running Stories",
    host: "Cherie Turner (2× Comrades finisher)",
    description:
      "Inspiring stories from exceptional women runners. Host Cherie Turner — herself a two-time Comrades finisher — features episodes on women's running achievements worldwide, including Comrades Marathon stories.",
    url: "https://womensrunningstories.com/#listentothepodcast",
  },
  {
    title: "Camille Herron + Comrades Marathon: Dream Race",
    host: "Strides Forward (Cherie Turner)",
    description:
      "Camille Herron's journey to the 2017 Comrades after a knee injury \u2014 where she became the first American woman to win since Ann Trason.",
    url: "https://cherieturner.com/podcast/episodes/camille-herron-comrades-marathon-dream-race",
  },
];

interface WebsiteEntry {
  name: string;
  url: string;
  description: string;
  category: string;
}

const WEBSITES: WebsiteEntry[] = [
  {
    name: "Comrades Marathon (Official)",
    url: "https://www.comrades.com/",
    description: "Official site \u2014 entry, race info, history, results, and official training plans.",
    category: "official",
  },
  {
    name: "Comrades Race History",
    url: "https://comrades.com/histories",
    description: "Official race-by-race history archive.",
    category: "official",
  },
  {
    name: "The Running Mann",
    url: "https://runningmann.co.za/",
    description: "Stuart Mann's definitive Comrades Marathon statistical analysis \u2014 innovative data journalism featuring medal distribution charts, hurricane funnel attrition visualizations, pacing analysis, and year-by-year deep dives. The gold standard for Comrades data.",
    category: "analysis",
  },
  {
    name: "Bruce Fordyce",
    url: "https://www.brucefordyce.com/",
    description: "Blog, eBooks, speaking engagements, and personal stories from the 9-time winner.",
    category: "legends",
  },
  {
    name: "Coach Parry",
    url: "https://www.coachparry.com/",
    description: "Official Comrades coach Lindsey Parry \u2014 training plans, coaching membership, and the Ultimate Comrades Resource Guide.",
    category: "training",
  },
  {
    name: "RunnersGuide (Tom Cottrell)",
    url: "https://runnersguide.blog/",
    description: "Comrades training schedules adapted from Don Oliver, course details, and race history.",
    category: "training",
  },
  {
    name: "Fordyce Fusion",
    url: "https://fordycefusion.com/",
    description: "Bruce Fordyce's training platform \u2014 personalised Comrades coaching and programmes from the 9-time winner himself.",
    category: "training",
  },
  {
    name: "Coach Norrie",
    url: "https://www.coachnorrie.co.za/",
    description: "Pacing calculator, race strategy, and course measurement details from Norrie Williamson.",
    category: "training",
  },
  {
    name: "The Marathon (Dave Jack)",
    url: "https://themarathon.co/",
    description: "60+ years of Comrades stories, history, and personalities.",
    category: "history",
  },
  {
    name: "Ultrarunning History",
    url: "https://ultrarunninghistory.com/comrades-marathon",
    description: "Deeply researched historical articles on the Comrades and its legends.",
    category: "history",
  },
  {
    name: "Modern Athlete Magazine",
    url: "https://modernathlete.co.za/",
    description: "South Africa's premier running magazine with comprehensive Comrades coverage.",
    category: "media",
  },
  {
    name: "iRunFar",
    url: "https://www.irunfar.com/",
    description: "International ultra-running news with Comrades results and analysis.",
    category: "media",
  },
  {
    name: "Comrades Marathon (Wikipedia)",
    url: "https://en.wikipedia.org/wiki/Comrades_Marathon",
    description: "Overview, history, records, and statistics.",
    category: "reference",
  },
  {
    name: "History of the Comrades Marathon",
    url: "https://en.wikipedia.org/wiki/History_of_the_Comrades_Marathon",
    description: "Detailed decade-by-decade Wikipedia history.",
    category: "reference",
  },
  {
    name: "List of Comrades Marathon Winners",
    url: "https://en.wikipedia.org/wiki/List_of_winners_of_the_Comrades_Marathon",
    description: "Complete list of men's and women's winners.",
    category: "reference",
  },
];

const WEBSITE_CATEGORIES: Record<string, string> = {
  official: "Official",
  analysis: "Analysis & Data",
  legends: "Athletes",
  training: "Training & Coaching",
  history: "History & Stories",
  media: "Running Media",
  reference: "Reference",
};

const BOOK_CATEGORIES: Record<string, string> = {
  history: "History",
  memoir: "Autobiography & Memoir",
  training: "Training & Preparation",
};

function categoryBadge(cat: string, labels: Record<string, string>) {
  const colors: Record<string, string> = {
    history: "bg-amber-100 text-amber-800",
    memoir: "bg-blue-100 text-blue-800",
    training: "bg-green-100 text-green-800",
    official: "bg-[#1B5E20]/10 text-[#1B5E20]",
    analysis: "bg-indigo-100 text-indigo-800",
    legends: "bg-purple-100 text-purple-800",
    media: "bg-pink-100 text-pink-800",
    reference: "bg-gray-100 text-gray-700",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors[cat] || "bg-gray-100 text-gray-600"}`}>
      {labels[cat] || cat}
    </span>
  );
}

export default function ResourcesPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Resources</h1>
      <p className="text-gray-500 mb-6">
        Books, websites, films, podcasts, and articles to explore the world of the Comrades Marathon.
      </p>

      {/* Section nav */}
      <div className="flex flex-wrap gap-2 mb-10 pb-4 border-b border-gray-200">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="px-3 py-1.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 hover:bg-comrades/10 hover:text-comrades transition-colors"
          >
            {s.label}
          </a>
        ))}
      </div>

      <div className="space-y-12">
        {/* ============================================================ */}
        {/* NOTABLE ARTICLES */}
        {/* ============================================================ */}
        <section>
          <div id="articles" className="scroll-mt-20">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Notable Articles</h2>
            <p className="text-sm text-gray-500 mb-4">The best feature writing about the Comrades Marathon from around the world</p>
          </div>

          <div className="space-y-3">
            {ARTICLES.map((a) => (
              <a
                key={a.url}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-comrades hover:shadow-sm transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded group-hover:bg-comrades/10 group-hover:text-comrades transition-colors">
                      {a.publication}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 group-hover:text-comrades text-sm transition-colors">
                        {a.title}
                      </span>
                      <span className="text-gray-300 text-xs shrink-0">&rarr;</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {a.author && <>{a.author}</>}
                      {a.author && a.year && <> &middot; </>}
                      {a.year && <>{a.year}</>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{a.description}</p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* ============================================================ */}
        {/* BOOKS */}
        {/* ============================================================ */}
        <section>
          <div id="books" className="scroll-mt-20">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Books</h2>
            <p className="text-sm text-gray-500 mb-4">Essential reading for Comrades enthusiasts</p>
          </div>

          {Object.entries(BOOK_CATEGORIES).map(([catKey, catLabel]) => {
            const booksInCat = BOOKS.filter((b) => b.category === catKey);
            if (booksInCat.length === 0) return null;
            return (
              <div key={catKey} className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">{catLabel}</h3>
                <div className="space-y-3">
                  {booksInCat.map((b) => (
                    <div key={b.title} className="bg-white rounded-lg border border-gray-200 p-4 flex gap-4 items-start">
                      <div className="shrink-0 w-10 h-12 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-lg">
                        📖
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {b.url ? (
                            <a
                              href={b.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-gray-900 hover:text-comrades transition-colors"
                            >
                              {b.title}
                            </a>
                          ) : (
                            <span className="font-semibold text-gray-900">{b.title}</span>
                          )}
                          {categoryBadge(b.category, BOOK_CATEGORIES)}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          by {b.author}
                          {b.year && <> &middot; {b.year}</>}
                        </p>
                        <p className="text-sm text-gray-600 mt-1 leading-relaxed">{b.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        {/* ============================================================ */}
        {/* WEBSITES */}
        {/* ============================================================ */}
        <section>
          <div id="websites" className="scroll-mt-20">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Websites &amp; Online Resources</h2>
            <p className="text-sm text-gray-500 mb-4">The best places online for Comrades Marathon information</p>
          </div>

          {Object.entries(WEBSITE_CATEGORIES).map(([catKey, catLabel]) => {
            const sitesInCat = WEBSITES.filter((w) => w.category === catKey);
            if (sitesInCat.length === 0) return null;
            return (
              <div key={catKey} className="mb-5">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">{catLabel}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sitesInCat.map((w) => (
                    <a
                      key={w.url}
                      href={w.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-white rounded-lg border border-gray-200 p-4 hover:border-comrades hover:shadow-sm transition-all group"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900 group-hover:text-comrades text-sm">{w.name}</span>
                        <span className="text-gray-300 text-xs">&rarr;</span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{w.description}</p>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        {/* ============================================================ */}
        {/* LEGENDS WIKI */}
        {/* ============================================================ */}
        <section>
          <div id="legends" className="scroll-mt-20">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Comrades Legends</h2>
            <p className="text-sm text-gray-500 mb-4">Wikipedia and profile pages for the greatest Comrades runners</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {LEGENDS.map((l) => (
              <div key={l.name} className="bg-white rounded-lg border border-gray-200 p-4 flex items-start gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full bg-comrades/10 flex items-center justify-center text-comrades text-sm font-bold">
                  {l.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {l.athleteId ? (
                      <Link
                        href={`/runner?id=${l.athleteId}`}
                        className="font-semibold text-gray-900 hover:text-comrades transition-colors text-sm"
                      >
                        {l.name}
                      </Link>
                    ) : (
                      <span className="font-semibold text-gray-900 text-sm">{l.name}</span>
                    )}
                    <a
                      href={l.wikiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded hover:bg-gray-200"
                    >
                      Wikipedia &rarr;
                    </a>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{l.summary}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================ */}
        {/* FILMS & DOCUMENTARIES */}
        {/* ============================================================ */}
        <section>
          <div id="films" className="scroll-mt-20">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Films &amp; Documentaries</h2>
            <p className="text-sm text-gray-500 mb-4">Watch the Comrades story unfold on screen</p>
          </div>

          <div className="space-y-3">
            {FILMS.map((f) => (
              <div key={f.title} className="bg-white rounded-lg border border-gray-200 p-4 flex gap-4 items-start">
                <div className="shrink-0 w-10 h-12 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-lg">
                  🎬
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {f.url ? (
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-gray-900 hover:text-comrades transition-colors"
                      >
                        {f.title}
                      </a>
                    ) : (
                      <span className="font-semibold text-gray-900">{f.title}</span>
                    )}
                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">{f.type}</span>
                    <span className="text-xs text-gray-400">{f.year}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================ */}
        {/* PODCASTS */}
        {/* ============================================================ */}
        <section>
          <div id="podcasts" className="scroll-mt-20">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Podcasts</h2>
            <p className="text-sm text-gray-500 mb-4">Listen to Comrades stories and training advice</p>
          </div>

          <div className="space-y-3">
            {PODCASTS.map((p) => (
              <div key={p.title} className="bg-white rounded-lg border border-gray-200 p-4 flex gap-4 items-start">
                <div className="shrink-0 w-10 h-12 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-lg">
                  🎙️
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.url ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-gray-900 hover:text-comrades transition-colors"
                      >
                        {p.title}
                      </a>
                    ) : (
                      <span className="font-semibold text-gray-900">{p.title}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{p.host}</p>
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">{p.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Back link */}
      <div className="text-center mt-10 mb-8">
        <Link href="/" className="text-sm text-gray-500 hover:text-comrades transition-colors">
          &larr; Back to home
        </Link>
      </div>
    </div>
  );
}
