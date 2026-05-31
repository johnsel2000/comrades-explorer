"use client";

import Link from "next/link";

interface CelebrityRunner {
  name: string;
  athleteId: string;
  famous_for: string;
  comrades_summary: string;
  highlight: string;
  wikiUrl?: string;
}

const CELEBRITIES: CelebrityRunner[] = [
  {
    name: "Alberto Salazar",
    athleteId: "029A4E77-6078-4471-A460-EF6327651101",
    famous_for: "3\u00d7 NYC Marathon winner, Boston Marathon winner, 1984 Olympian",
    comrades_summary: "3 entries (1994\u20131996), 1 finish",
    highlight: "Won the 1994 Comrades in 5:38:39 \u2014 coming out of retirement, having never raced beyond marathon distance. Said it was \"more satisfying than anything I've done.\"",
    wikiUrl: "https://en.wikipedia.org/wiki/Alberto_Salazar",
  },
  {
    name: "Yiannis Kouros",
    athleteId: "10B7ACE1-D68C-4577-A600-4138DC6ADA58",
    famous_for: "Greatest ultrarunner of all time, 24hr world record holder",
    comrades_summary: "1 entry (1998), 1 finish",
    highlight: "Ran 6:10:35 (Silver) in his only Comrades. Holds virtually every ultra world record from 100mi to 1,000mi.",
    wikiUrl: "https://en.wikipedia.org/wiki/Yiannis_Kouros",
  },
  {
    name: "Gordon Ramsay",
    athleteId: "2C8F70E5-2883-4DDF-932B-E50E3F638EBF",
    famous_for: "World-renowned celebrity chef & TV personality",
    comrades_summary: "5 entries (2000\u20132004), 3 finishes",
    highlight: "Best: 10:31:11 (2000, Bronze). Called Comrades \"my favourite race and the toughest I have ever run.\"",
  },
  {
    name: "Zola Budd Pieterse",
    athleteId: "9A265EF1-7118-4F4E-8C78-C8392FFB8ED2",
    famous_for: "Olympic runner, 1984 Olympic 3000m controversy with Mary Decker",
    comrades_summary: "4 entries (2012\u20132024), 2 finishes",
    highlight: "Earned a Gold medal in 2014, finishing 7th woman in 6:55:55. She called this one of her career highlights.",
    wikiUrl: "https://en.wikipedia.org/wiki/Zola_Budd",
  },
  {
    name: "Tim Noakes",
    athleteId: "DA52CF3E-CF7F-4438-8BC5-E5B63E9F4E96",
    famous_for: "Sports scientist, author of The Lore of Running",
    comrades_summary: "8 entries (1973\u20131985), 7 finishes",
    highlight: "Best: 6:49:00 (1973, Silver). His Comrades experiences partly inspired his Central Governor Theory of exercise physiology.",
    wikiUrl: "https://en.wikipedia.org/wiki/Tim_Noakes",
  },
  {
    name: "Kabelo Mabalane",
    athleteId: "AEBC0F33-8804-40A4-9237-9358C61C9FD0",
    famous_for: "Kwaito music star (TKZee), TV personality, pastor",
    comrades_summary: "15 entries (2006\u20132025), 13 finishes",
    highlight: "Best: 7:54:57 (2019, Bill Rowan). Wrote \"I Ran For My Life\" about how running saved him from substance abuse.",
  },
  {
    name: "Wynand Claassen",
    athleteId: "645F182A-87F4-40C4-807D-01AC86178CFE",
    famous_for: "Springbok rugby captain (1981\u201383)",
    comrades_summary: "11 entries (1985\u20132000), 11 finishes",
    highlight: "Best: 8:49:08 (1987, Bronze). His father George Claassen won the Comrades in 1961.",
  },
  {
    name: "Sam Tshabalala",
    athleteId: "D5BA88E7-513F-4AA4-A10B-1819D3E0F5AB",
    famous_for: "First black Comrades Marathon winner (1989)",
    comrades_summary: "13 finishes (1987\u20132010)",
    highlight: "Won in 5:35:51 \u2014 a deeply symbolic moment during apartheid. A railway worker who became a national hero.",
  },
  {
    name: "Mandisi Dyantyis",
    athleteId: "1992F6CE-9F56-4F29-AD05-8D372EB48BB8",
    famous_for: "Jazz musician, Laurence Olivier Award winner",
    comrades_summary: "6 entries (2018\u20132025), 3 finishes",
    highlight: "Best: 9:33:58 (2024). Runs for the Methodist Church to raise bursary funds.",
  },
  {
    name: "Ann Trason",
    athleteId: "5B73167C-8171-4DCF-B800-5AE76A5E5EDB",
    famous_for: "14\u00d7 Western States 100 winner, ultra world record holder",
    comrades_summary: "4 entries (1995\u20131999), 2 wins",
    highlight: "Won 1996 and 1997 (5:58:25). SI's 65th greatest female athlete of the 20th century. Held world records at 50mi, 100km, and 100mi.",
    wikiUrl: "https://en.wikipedia.org/wiki/Ann_Trason",
  },
  {
    name: "Camille Herron",
    athleteId: "E1BC62E1-2191-4698-9256-CDC2AD1190B6",
    famous_for: "100mi & 24hr world record holder, American ultrarunning star",
    comrades_summary: "Multiple entries (2014\u20132022), 2 wins",
    highlight: "Won 2017 (arriving with 8 weeks training on an injured knee) and 2022. First American woman to win since Trason.",
    wikiUrl: "https://en.wikipedia.org/wiki/Camille_Herron",
  },
  {
    name: "Bart Yasso",
    athleteId: "7D0C79D3-8764-47B1-BC25-C0160B3C11DF",
    famous_for: "Runner's World 'Mayor of Running', creator of Yasso 800s",
    comrades_summary: "1 entry (2010), 1 finish",
    highlight: "Ran 11:33:38 (Vic Clapham medal). Called Comrades the most profound race of his life. Has completed races on all seven continents.",
  },
  {
    name: "Bob de la Motte",
    athleteId: "CBB2B390-7EDE-4039-B8F4-BD689D4713FC",
    famous_for: "Fordyce rival, author of Runaway Comrade",
    comrades_summary: "5 entries (1981\u20131987), 3 golds",
    highlight: "Finished 2nd to Fordyce in 1984 and 1986 \u2014 his 1986 time (5:26:12) was just 2 minutes off the course record. Wrote a memoir covering apartheid-era sport.",
  },
  {
    name: "Stephen Muzhingi",
    athleteId: "7353CD81-E5E3-4BF3-BD4F-575E0F8C8235",
    famous_for: "3\u00d7 consecutive Comrades winner from Zimbabwe",
    comrades_summary: "3 wins (2009\u20132011)",
    highlight: "Former barber from Harare who won three straight \u2014 the first to achieve this since Fordyce. First Zimbabwean winner.",
    wikiUrl: "https://en.wikipedia.org/wiki/Stephen_Muzhingi",
  },
  {
    name: "Birgit Lennartz",
    athleteId: "C9B6438B-AFCA-4CB9-93E0-841EA2BD7A0C",
    famous_for: "German ultrarunning champion, IAU World Championship competitor",
    comrades_summary: "1 entry (1999), 1 win",
    highlight: "Won the 1999 women's Comrades in 6:31:03. One of Europe's top female ultrarunners of the 1990s.",
    wikiUrl: "https://en.wikipedia.org/wiki/Birgit_Lennartz",
  },
  {
    name: "Mavis Hutchison",
    athleteId: "126C8C8A-D0F2-4766-AE12-4302D7B831FE",
    famous_for: "Pioneer women's runner, first woman to run across America",
    comrades_summary: "2 wins (1965\u20131966)",
    highlight: "'The Galloping Granny' fought for women's inclusion in Comrades. In 1978, at 53, she became the first woman to run coast-to-coast across America.",
    wikiUrl: "https://en.wikipedia.org/wiki/Mavis_Hutchison",
  },
  {
    name: "Isavel Roche-Kelly",
    athleteId: "5A22BAE8-7DA5-42C4-B8FD-8B4B79AAF419",
    famous_for: "First international woman to win Comrades",
    comrades_summary: "2 wins (1980\u20131981)",
    highlight: "Irish-born runner whose 1981 time of 6:44:35 was a massive leap forward for women's performances at the race.",
  },
  {
    name: "Eleanor Greenwood",
    athleteId: "10AD14FB-466F-4C51-BA08-0F28198C864B",
    famous_for: "Western States 100 champion, 100km world record holder",
    comrades_summary: "4 entries (2011\u20132016), 1 win",
    highlight: "Won 2014, placed 2nd in 2012. Also a two-time Western States 100 champion (setting the course record in 2012).",
    wikiUrl: "https://en.wikipedia.org/wiki/Ellie_Greenwood",
  },
  {
    name: "Amby Burfoot",
    athleteId: "5D585131-B601-47EB-8059-AE79EABA02C2",
    famous_for: "1968 Boston Marathon winner, Runner\u2019s World editor-in-chief",
    comrades_summary: "2 entries (1993, 2006), 2 finishes",
    highlight: "Displays only two medals at home: his Boston winner\u2019s medal and his Comrades bronze. Wrote two of the most widely-read articles about the race.",
    wikiUrl: "https://en.wikipedia.org/wiki/Amby_Burfoot",
  },
  {
    name: "Caroline Cherry",
    athleteId: "45792395-ADFE-434A-B2A6-3A96C0D3B68D",
    famous_for: "2015 Comrades winner, Two Oceans winner",
    comrades_summary: "Multiple entries (2009\u20132026), 1 win",
    highlight: "Won 2015 in 6:12:22 under her married name Caroline W\u00f6stmann. Four consecutive Gold medals (2014\u20132016).",
    wikiUrl: "https://en.wikipedia.org/wiki/Caroline_W%C3%B6stmann",
  },
  {
    name: "Colleen De Reuck",
    athleteId: "16FB969F-C3C6-4E1F-B7C1-E1BDE28E7510",
    famous_for: "4\u00d7 Olympian (SA \u0026 USA), SA women\u2019s marathon record holder",
    comrades_summary: "2 entries (2016\u20132017), 2 finishes",
    highlight: "Debuted at age 52 in 2016, earning Gold (6:50:21). Won the US Olympic Marathon Trials at age 40. Also an Ironman World Championship age-group winner.",
    wikiUrl: "https://en.wikipedia.org/wiki/Colleen_De_Reuck",
  },
  {
    name: "Nao Kazami",
    athleteId: "673EF5A9-5C8A-4027-B78F-79C431288957",
    famous_for: "100km world record holder (6:09:14)",
    comrades_summary: "4 entries (2019\u20132026)",
    highlight: "Finished 3rd in 2019 (5:39:16) \u2014 the best-ever finish by a Japanese and Asian athlete. Trains while working full-time at an auto parts company.",
    wikiUrl: "https://en.wikipedia.org/wiki/Nao_Kazami",
  },
  {
    name: "Hoseah Tjale",
    athleteId: "4C0A7938-EB0F-4852-918E-7C0A36705618",
    famous_for: "Apartheid-era pioneer, Two Oceans \u0026 London to Brighton winner",
    comrades_summary: "14 entries (1979\u20131995), 9 Gold medals",
    highlight: "Placed 2nd twice and 3rd twice. Fordyce called him one of the greatest runners never to win. As an amateur, never received prize money.",
    wikiUrl: "https://en.wikipedia.org/wiki/Hoseah_Tjale",
  },
  {
    name: "Willie Mtolo",
    athleteId: "16D7BB73-B435-4FA3-93D4-2FCAD156F81E",
    famous_for: "1992 NYC Marathon winner, SA Sportsman of the Year",
    comrades_summary: "17 entries (1984\u20132018)",
    highlight: "First South African to win New York City Marathon (2:09:29). Runner-up at 1989 Comrades behind Tshabalala. Banned from international competition until 1992 due to apartheid.",
    wikiUrl: "https://en.wikipedia.org/wiki/Willie_Mtolo",
  },
  {
    name: "Louis Massyn",
    athleteId: "54FE2430-709B-4E32-82A7-2F9389F122C3",
    famous_for: "Most Comrades finishes ever (50)",
    comrades_summary: "52 entries (1973\u20132026), 50 finishes",
    highlight: "Completed his 50th Comrades in 2025 at age 74. Has been racing since 1973. PB of 6:25 (1981). Raises funds for children with special needs.",
  },
  {
    name: "Johannes Mosehla",
    athleteId: "921188D3-7ED4-4A98-B3F8-4B255A622710",
    famous_for: "Oldest person ever to finish the Comrades (age 83)",
    comrades_summary: "17 entries (2005\u20132026), 11 finishes",
    highlight: "Finished the 2025 race at age 83 in 11:47:10. A bricklayer from Polokwane who couldn\u2019t enter Comrades as a young man due to apartheid.",
  },
  {
    name: "Tilda Tearle",
    athleteId: "41210171-3F87-4230-B039-51D4735CEED3",
    famous_for: "1993 women\u2019s winner, Triple Green Number holder",
    comrades_summary: "34 entries (1984\u20132022), 30 finishes",
    highlight: "Progressed from 4th to 3rd to 2nd to 1st over four consecutive years before winning. 30 finishes and 10 top-10 finishes. A beloved Comrades icon.",
  },
];

export default function NotableRunnersPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Notable Runners</h1>
      <p className="text-gray-500 mb-8">
        Famous athletes from beyond the world of ultrarunning who have taken on the ultimate human race &mdash; plus ultrarunning legends who made their mark at Comrades.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CELEBRITIES.map((c) => (
          <div key={c.athleteId} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-2">
              <div>
                <Link
                  href={`/runner?id=${c.athleteId}`}
                  className="text-base font-bold text-gray-900 hover:text-comrades transition-colors"
                >
                  {c.name}
                </Link>
                <p className="text-xs text-gray-500 mt-0.5">{c.famous_for}</p>
              </div>
              {c.wikiUrl && (
                <a
                  href={c.wikiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded hover:bg-gray-200 shrink-0 ml-2"
                >
                  Wikipedia &rarr;
                </a>
              )}
            </div>
            <p className="text-sm text-comrades font-semibold mb-1">{c.comrades_summary}</p>
            <p className="text-sm text-gray-600 leading-relaxed">{c.highlight}</p>
            <Link
              href={`/runner?id=${c.athleteId}`}
              className="inline-block mt-2 text-xs text-comrades hover:underline"
            >
              View full race history &rarr;
            </Link>
          </div>
        ))}
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
