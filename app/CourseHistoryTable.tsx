"use client";

import { Fragment, useMemo, useState } from "react";

type PlayerRow = {
  name: string;
  app: number;
  made: number;
  avg: number;
  best: number | null;
  rounds: number;
  sgAvg: number;
};

// Manually transcribed from a "Rabbit Hole"/BetspertsGolf strokes-gained
// screenshot covering every TPC Twin Cities / 3M Open appearance,
// 2019-2025. "100" on the source sheet means a missed cut - reshaped here
// around make-cut rate and finish average since that's what actually
// drives Top N / Make Cut parlay building, with strokes gained kept as a
// secondary sort rather than the focus.
const COURSE_HISTORY: Record<string, [string, number, number, number, number | null, number, number][]> = {
  "3M Open": [
    ["Tony Finau", 7, 6, 24.9, 1, 26, 1.84],
    ["Emiliano Grillo", 6, 5, 26.5, 2, 22, 1.87],
    ["Cam Davis", 7, 5, 40.7, 10, 24, 1.27],
    ["Brice Garnett", 7, 7, 34.1, 16, 28, 0.99],
    ["Doug Ghim", 6, 4, 47.5, 16, 20, 1.26],
    ["Adam Hadwin", 6, 4, 48.7, 4, 20, 1.21],
    ["Kurt Kitayama", 2, 2, 3.5, 1, 8, 2.99],
    ["Cameron Champ", 5, 4, 31.4, 1, 18, 1.26],
    ["Sam Stevens", 3, 3, 25.3, 2, 12, 1.71],
    ["Adam Svensson", 5, 4, 40.6, 14, 18, 1.03],
    ["Lee Hodges", 4, 2, 54.3, 1, 12, 1.54],
    ["Hank Lebioda", 4, 3, 44.0, 16, 16, 1.08],
    ["Keith Mitchell", 6, 4, 53.7, 5, 20, 0.87],
    ["Sungjae Im", 4, 2, 54.3, 2, 12, 1.35],
    ["Maverick McNealy", 4, 3, 42.0, 3, 14, 1.15],
    ["Kevin Streelman", 3, 3, 33.3, 2, 12, 1.29],
    ["Taylor Moore", 2, 2, 13.0, 12, 8, 1.87],
    ["Matt Kuchar", 3, 2, 48.7, 3, 10, 1.45],
    ["Patrick Rodgers", 5, 4, 49.0, 32, 18, 0.80],
    ["Matti Schmid", 3, 3, 31.0, 12, 12, 1.13],
    ["Nick Hardy", 4, 4, 36.3, 13, 16, 0.81],
    ["Gary Woodland", 4, 3, 42.0, 11, 14, 0.87],
    ["Brian Harman", 2, 2, 24.0, 7, 8, 1.53],
    ["Max Greyserman", 2, 1, 51.0, 2, 6, 1.99],
    ["Patrick Fishburn", 2, 2, 25.0, 6, 8, 1.49],
    ["Max Homa", 3, 3, 40.3, 3, 11, 1.07],
    ["David Lipsky", 3, 2, 48.7, 3, 10, 1.10],
    ["Ben Kohles", 3, 2, 48.0, 20, 10, 0.83],
    ["Chad Ramey", 3, 3, 35.0, 24, 12, 0.88],
    ["Mackenzie Hughes", 4, 4, 42.0, 19, 16, 0.66],
    ["Takumi Kanaya", 1, 1, 7.0, 7, 4, 2.50],
    ["William Mouw", 1, 1, 7.0, 7, 4, 2.50],
    ["Taylor Pendrith", 3, 2, 57.7, 5, 10, 0.96],
    ["Tom Kim", 1, 1, 27.0, 28, 8, 1.19],
    ["Hideki Matsuyama", 2, 2, 18.5, 7, 9, 1.04],
    ["Troy Merritt", 7, 4, 62.7, 7, 22, 0.42],
    ["Zac Blair", 3, 2, 52.3, 13, 10, 0.90],
    ["Tom Hoge", 7, 4, 56.1, 4, 22, 0.40],
    ["Chris Kirk", 3, 2, 51.7, 14, 10, 0.82],
    ["Denny McCarthy", 3, 3, 40.7, 23, 12, 0.65],
    ["Billy Horschel", 1, 1, 13.0, 13, 4, 1.90],
    ["Jesper Svensson", 1, 1, 14.0, 14, 4, 1.75],
    ["Thorbjorn Olesen", 1, 1, 14.0, 14, 4, 1.75],
    ["Mac Meissner", 2, 2, 36.5, 14, 8, 0.87],
    ["Tyler Duncan", 5, 4, 60.2, 20, 17, 0.39],
    ["David Skinns", 3, 3, 45.0, 24, 12, 0.53],
    ["Pierceson Coody", 2, 2, 37.5, 3, 8, 0.74],
    ["Trace Crowe", 1, 1, 24.0, 24, 4, 1.48],
    ["Christiaan Bezuidenhout", 2, 1, 60.0, 20, 6, 0.95],
    ["Austin Eckroat", 4, 2, 63.8, 16, 12, 0.39],
    ["Brandt Snedeker", 4, 2, 66.0, 11, 12, 0.39],
    ["Andrew Putnam", 5, 2, 66.0, 11, 14, 0.33],
    ["Mark Hubbard", 3, 2, 59.0, 16, 10, 0.43],
    ["Neal Shipley", 1, 1, 37.0, 37, 4, 0.98],
    ["Fabian Gomez", 3, 1, 71.0, 13, 8, 0.39],
    ["Seamus Power", 2, 2, 32.5, 28, 10, 0.31],
    ["Garrick Higgo", 4, 3, 63.0, 13, 12, 0.26],
    ["Corey Conners", 1, 1, 46.0, 46, 4, 0.75],
    ["Beau Hossler", 7, 3, 70.9, 13, 20, 0.14],
    ["Dylan Wu", 4, 2, 52.7, 5, 12, 0.22],
    ["Jake Knapp", 1, 1, 3.0, 3, 7, 0.30],
    ["Davis Riley", 3, 1, 82.0, 46, 8, 0.25],
    ["Matthieu Pavon", 1, 1, 44.0, 44, 4, 0.50],
    ["Kevin Roy", 2, 1, 64.0, 28, 6, 0.28],
    ["Camilo Villegas", 3, 3, 54.0, 51, 12, 0.09],
    ["Joe Highsmith", 2, 1, 72.0, 44, 6, 0.16],
    ["Patton Kizzire", 7, 4, 65.3, 34, 22, 0.02],
    ["Aaron Wise", 1, 0, 100.0, null, 2, 0.08],
    ["Haotong Li", 1, 0, 100.0, null, 2, 0.01],
    ["Paul Peterson", 1, 0, 100.0, null, 2, 0.01],
    ["Preston Stout", 1, 0, 100.0, null, 2, 0.01],
    ["Ricky Castillo", 1, 0, 100.0, null, 2, 0.01],
    ["Lucas Glover", 4, 1, 76.8, 7, 10, -0.01],
    ["Justin Lower", 4, 2, 69.0, 33, 12, -0.03],
    ["Jeremy Paul", 1, 0, 100.0, null, 2, -0.49],
    ["Luke List", 5, 2, 78.0, 32, 14, -0.07],
    ["Hayden Springer", 2, 1, 79.5, 59, 6, -0.18],
    ["Stephan Jaeger", 3, 2, 65.3, 30, 10, -0.14],
    ["Jackson Suber", 1, 0, 100.0, null, 2, -0.99],
    ["Rico Hoey", 2, 2, 62.0, 57, 8, -0.26],
    ["Davis Thompson", 1, 0, 100.0, null, 4, -0.43],
    ["Luke Clanton", 2, 1, 80.5, 61, 6, -0.43],
    ["Adrien Dumont de Chassart", 1, 0, 100.0, null, 2, -1.29],
    ["Danny Walker", 1, 0, 100.0, null, 2, -1.49],
    ["Karl Vilips", 1, 0, 100.0, null, 2, -1.49],
    ["Joel Dahmen", 4, 2, 76.5, 39, 12, -0.27],
    ["Peter Malnati", 7, 2, 79.6, 11, 18, -0.18],
    ["Kevin Yu", 3, 2, 70.0, 37, 10, -0.35],
    ["Jason Day", 2, 2, 65.0, 64, 8, -0.44],
    ["Austin Smotherman", 3, 2, 59.0, 24, 10, -0.39],
    ["Max McGreevy", 3, 1, 76.7, 30, 8, -0.54],
    ["Ben James", 1, 0, 100.0, null, 2, -2.29],
    ["Gordon Sargent", 1, 0, 100.0, null, 2, -2.49],
    ["Steven Fisk", 1, 1, 74.0, 74, 4, -1.25],
    ["Zecheng Dou", 1, 0, 100.0, null, 2, -2.67],
    ["Lanto Griffin", 4, 1, 86.0, 44, 10, -0.54],
    ["Chandler Phillips", 2, 0, 100.0, null, 4, -1.64],
    ["Kris Ventura", 2, 0, 100.0, null, 6, -1.14],
    ["Adam Schenk", 6, 4, 67.5, 41, 20, 0.02],
    ["S.Y. Noh", 2, 2, 53.5, 38, 10, -0.71],
    ["Ryan Fox", 1, 0, 100.0, null, 2, -3.67],
    ["Vince Whaley", 3, 1, 85.7, 57, 8, -0.98],
    ["Nicholas Lindheim", 1, 0, 100.0, null, 3, -2.76],
    ["Michael Kim", 4, 1, 87.8, 39, 12, -0.70],
    ["Harry Higgs", 5, 1, 85.0, 25, 12, -0.76],
    ["Ben Silverman", 3, 2, 71.3, 53, 10, -0.93],
    ["Nick Dunlap", 2, 0, 100.0, null, 4, -2.64],
    ["Ben Martin", 4, 0, 100.0, null, 10, -1.11],
    ["Thomas Campbell", 1, 0, 100.0, null, 2, -5.99],
    ["Alejandro Tosti", 1, 0, 100.0, null, 2, -6.79],
    ["Erik van Rooyen", 5, 1, 91.6, 58, 12, -1.18],
    ["Ryan Brehm", 6, 2, 80.3, 31, 16, -0.92],
    ["Rafael Campos", 3, 0, 100.0, null, 6, -3.10],
    ["Will Gordon", 3, 0, 100.0, null, 10, -2.98],
  ],
};

const YEARS = [2025, 2024, 2023, 2022, 2021, 2020, 2019];

type YearResult = number | "MC" | "DQ" | null;

// Same source screenshot as COURSE_HISTORY above, kept year-by-year instead
// of collapsed to an average - "100" on the sheet becomes "MC" here (and
// the one "DQ" stays labeled as such), both shown in the same red as a
// missed cut everywhere else on the board. Order matches YEARS (2025 ->
// 2019). Keyed by tournament the same way COURSE_HISTORY is, in case
// another course's sheet gets added later.
const YEAR_HISTORY: Record<string, Record<string, YearResult[]>> = {
  "3M Open": {
    "Tony Finau": ["MC", 12, 7, 1, 28, 3, 23],
    "Emiliano Grillo": [20, 24, 10, 2, "MC", 3, null],
    "Cam Davis": ["MC", 19, 10, 16, 28, 12, "MC"],
    "Brice Garnett": [57, 33, 53, 31, 16, 26, 23],
    "Doug Ghim": ["MC", 24, 27, 16, "MC", 18, null],
    "Adam Hadwin": [44, "MC", "MC", 38, 6, null, 4],
    "Kurt Kitayama": [1, 6, null, null, null, null, null],
    "Cameron Champ": [28, 12, null, 16, 1, null, "MC"],
    "Sam Stevens": [2, 64, 10, null, null, null, null],
    "Adam Svensson": [14, 37, 37, "MC", null, null, 15],
    "Lee Hodges": ["MC", "MC", 1, 16, null, null, null],
    "Hank Lebioda": [null, null, "MC", 16, null, 26, 34],
    "Keith Mitchell": ["MC", 46, 5, null, 5, "MC", 66],
    "Sungjae Im": ["MC", null, "MC", 2, null, null, 15],
    "Maverick McNealy": ["MC", 3, null, 49, 16, null, null],
    "Kevin Streelman": [null, 64, 2, null, null, null, 34],
    "Taylor Moore": [14, 12, null, null, null, null, null],
    "Matt Kuchar": [null, 3, 43, null, "MC", null, null],
    "Patrick Rodgers": ["MC", 37, 37, null, 39, 32, null],
    "Matti Schmid": [61, 12, 20, null, null, null, null],
    "Nick Hardy": [28, 46, 13, 58, null, null, null],
    "Gary Woodland": [20, 37, "MC", null, 11, null, null],
    "Brian Harman": [null, null, null, null, 41, 7, null],
    "Max Greyserman": ["MC", 2, null, null, null, null, null],
    "Patrick Fishburn": [44, 6, null, null, null, null, null],
    "Max Homa": [39, null, null, null, 3, 79, null],
    "David Lipsky": [3, "MC", 43, null, null, null, null],
    "Ben Kohles": [20, 24, null, "MC", null, null, null],
    "Chad Ramey": [28, 24, 53, null, null, null, null],
    "Mackenzie Hughes": [53, 19, 30, null, null, 66, null],
    "Takumi Kanaya": [7, null, null, null, null, null, null],
    "William Mouw": [7, null, null, null, null, null, null],
    "Taylor Pendrith": [68, 5, "MC", null, null, null, null],
    "Tom Kim": [null, null, null, 28, null, null, null],
    "Hideki Matsuyama": [null, null, 30, null, null, null, 7],
    "Troy Merritt": [44, "MC", "MC", 49, 39, "MC", 7],
    "Zac Blair": [44, "MC", 13, null, null, null, null],
    "Tom Hoge": ["MC", "MC", 20, 4, "MC", 46, 23],
    "Chris Kirk": [14, null, null, "MC", 41, null, null],
    "Denny McCarthy": [null, null, null, null, 67, 32, 23],
    "Billy Horschel": [null, null, 13, null, null, null, null],
    "Jesper Svensson": [14, null, null, null, null, null, null],
    "Thorbjorn Olesen": [14, null, null, null, null, null, null],
    "Mac Meissner": [14, 59, null, null, null, null, null],
    "Tyler Duncan": [null, 53, 20, 45, "MC", null, 83],
    "David Skinns": [57, 24, null, 54, null, null, null],
    "Pierceson Coody": [3, 72, null, null, null, null, null],
    "Trace Crowe": [null, 24, null, null, null, null, null],
    "Christiaan Bezuidenhout": [20, null, "MC", null, null, null, null],
    "Austin Eckroat": [39, "MC", "MC", null, 16, null, null],
    "Brandt Snedeker": ["MC", "MC", 53, null, 11, null, null],
    "Andrew Putnam": ["MC", 19, null, 11, "MC", "MC", null],
    "Mark Hubbard": [61, null, "MC", null, 16, null, null],
    "Neal Shipley": [null, 37, null, null, null, null, null],
    "Fabian Gomez": [null, null, null, null, "MC", "MC", 13],
    "Seamus Power": [28, 37, null, null, null, null, null],
    "Garrick Higgo": [39, 37, 13, "MC", null, null, null],
    "Corey Conners": [null, null, null, null, null, 46, null],
    "Beau Hossler": ["MC", "MC", 13, "MC", 49, "MC", 34],
    "Dylan Wu": ["DQ", 53, 5, "MC", null, null, null],
    "Jake Knapp": [3, null, null, null, null, null, null],
    "Davis Riley": ["MC", 46, null, "MC", null, null, null],
    "Matthieu Pavon": [44, null, null, null, null, null, null],
    "Kevin Roy": [28, null, "MC", null, null, null, null],
    "Camilo Villegas": [null, null, 53, 58, 51, null, null],
    "Joe Highsmith": ["MC", 44, null, null, null, null, null],
    "Patton Kizzire": ["MC", "MC", "MC", 38, 39, 46, 34],
    "Aaron Wise": [null, null, null, null, null, "MC", null],
    "Haotong Li": ["MC", null, null, null, null, null, null],
    "Paul Peterson": ["MC", null, null, null, null, null, null],
    "Preston Stout": ["MC", null, null, null, null, null, null],
    "Ricky Castillo": ["MC", null, null, null, null, null, null],
    "Lucas Glover": [null, null, "MC", "MC", null, "MC", 7],
    "Justin Lower": ["MC", 33, 43, "MC", null, null, null],
    "Jeremy Paul": ["MC", null, null, null, null, null, null],
    "Luke List": ["MC", "MC", null, null, 58, 32, "MC"],
    "Hayden Springer": ["MC", 59, null, null, null, null, null],
    "Stephan Jaeger": [null, null, 30, "MC", null, null, 66],
    "Jackson Suber": ["MC", null, null, null, null, null, null],
    "Rico Hoey": [57, 67, null, null, null, null, null],
    "Davis Thompson": [null, null, "MC", null, null, null, null],
    "Luke Clanton": [61, "MC", null, null, null, null, null],
    "Adrien Dumont de Chassart": [null, "MC", null, null, null, null, null],
    "Danny Walker": ["MC", null, null, null, null, null, null],
    "Karl Vilips": ["MC", null, null, null, null, null, null],
    "Joel Dahmen": [39, "MC", "MC", null, 67, null, null],
    "Peter Malnati": ["MC", "MC", "MC", 11, "MC", "MC", 46],
    "Kevin Yu": ["MC", 73, 37, null, null, null, null],
    "Jason Day": [null, null, null, 64, null, null, 66],
    "Austin Smotherman": [null, 53, "MC", 24, null, null, null],
    "Max McGreevy": ["MC", null, 30, "MC", null, null, null],
    "Ben James": [null, "MC", null, null, null, null, null],
    "Gordon Sargent": ["MC", null, null, null, null, null, null],
    "Steven Fisk": [74, null, null, null, null, null, null],
    "Zecheng Dou": [null, null, "MC", null, null, null, null],
    "Lanto Griffin": ["MC", 44, "MC", null, "MC", null, null],
    "Chandler Phillips": ["MC", "MC", null, null, null, null, null],
    "Kris Ventura": [null, null, null, "MC", "MC", null, null],
    "Adam Schenk": ["MC", 59, null, 54, 51, 41, "MC"],
    "S.Y. Noh": [null, null, 69, 38, null, null, null],
    "Ryan Fox": [null, null, "MC", null, null, null, null],
    "Vince Whaley": [57, null, null, null, "MC", "MC", null],
    "Nicholas Lindheim": [null, "MC", null, null, null, null, null],
    "Michael Kim": [null, "MC", "MC", null, 39, "MC", null],
    "Harry Higgs": [25, null, "MC", "MC", "MC", "MC", null],
    "Ben Silverman": [61, 53, null, null, null, null, "MC"],
    "Nick Dunlap": ["MC", "MC", null, null, null, null, null],
    "Ben Martin": [null, "MC", "MC", "MC", "MC", null, null],
    "Thomas Campbell": ["MC", null, null, null, null, null, null],
    "Alejandro Tosti": [null, "MC", null, null, null, null, null],
    "Erik van Rooyen": ["MC", "MC", "MC", null, 58, "MC", null],
    "Ryan Brehm": ["MC", "MC", "MC", 31, 51, "MC", null],
    "Rafael Campos": ["MC", "MC", null, null, "MC", null, null],
    "Will Gordon": ["MC", "MC", "MC", null, null, null, null],
  },
};

type SortKey = "name" | "app" | "made" | "rate" | "avg" | "best" | "rounds" | "sgAvg";

function rateOf(r: PlayerRow): number {
  return r.app > 0 ? (r.made / r.app) * 100 : 0;
}

function rateColor(r: number): string {
  if (r >= 70) return "var(--live)";
  if (r >= 40) return "var(--gold-bright)";
  return "var(--clay)";
}

// Renders only for tournaments we actually have a transcribed sheet for -
// returns null otherwise, so adding this to the upcoming-tournament card
// is a no-op for every other event until more course-history data gets
// added to COURSE_HISTORY above.
export default function CourseHistoryTable({ tournamentName }: { tournamentName: string }) {
  const raw = COURSE_HISTORY[tournamentName];
  const yearHistory = YEAR_HISTORY[tournamentName] || {};
  const [query, setQuery] = useState("");
  const [minApp, setMinApp] = useState(2);
  const [sortKey, setSortKey] = useState<SortKey>("rate");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [openPlayer, setOpenPlayer] = useState<string | null>(null);

  const allRows: PlayerRow[] = useMemo(
    () => (raw || []).map(([name, app, made, avg, best, rounds, sgAvg]) => ({ name, app, made, avg, best, rounds, sgAvg })),
    [raw]
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let filtered = allRows.filter((r) => r.app >= minApp && r.name.toLowerCase().includes(q));
    filtered = filtered.slice().sort((a, b) => {
      const av = sortKey === "rate" ? rateOf(a) : (a as any)[sortKey];
      const bv = sortKey === "rate" ? rateOf(b) : (b as any)[sortKey];
      const avn = av === null ? (sortKey === "best" ? 9999 : av) : av;
      const bvn = bv === null ? (sortKey === "best" ? 9999 : bv) : bv;
      if (typeof avn === "string") return sortDir * avn.localeCompare(bvn);
      return sortDir * (avn - bvn);
    });
    return filtered;
  }, [allRows, query, minApp, sortKey, sortDir]);

  if (!raw) return null;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1) as 1 | -1);
    else { setSortKey(key); setSortDir(key === "name" ? 1 : -1); }
  }

  const columns: { key: SortKey; label: string }[] = [
    { key: "name", label: "Player" },
    { key: "app", label: "Apps" },
    { key: "made", label: "Made" },
    { key: "rate", label: "Cut rate" },
    { key: "avg", label: "Avg finish" },
    { key: "best", label: "Best finish" },
    { key: "rounds", label: "Rounds" },
    { key: "sgAvg", label: "SG/round" },
  ];

  return (
    <div style={{ marginTop: 14 }}>
      <div className="subline" style={{ marginBottom: 8 }}>Course history · {tournamentName}</div>
      <div style={{ fontSize: 11, color: "var(--cream-dim)", lineHeight: 1.5, marginBottom: 10, maxWidth: 640 }}>
        Every appearance 2019-2025, reshaped around make-cut rate and finish average - strokes gained kept as a secondary sort.
        Data from Betsperts/Ron Klos.
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <input
          type="text"
          placeholder="Search player…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)", color: "var(--cream)",
            fontFamily: "'JetBrains Mono',monospace", fontSize: 12, padding: "6px 10px", borderRadius: 4, minWidth: 180,
          }}
        />
        <select
          value={minApp}
          onChange={(e) => setMinApp(parseInt(e.target.value, 10))}
          style={{
            background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)", color: "var(--cream)",
            fontFamily: "'JetBrains Mono',monospace", fontSize: 11, padding: "6px 8px", borderRadius: 4,
          }}
        >
          <option value={0}>All sample sizes</option>
          <option value={2}>2+ appearances</option>
          <option value={3}>3+ appearances</option>
          <option value={5}>5+ appearances</option>
        </select>
        <span style={{ fontSize: 10, color: "var(--cream-dim)", marginLeft: "auto" }}>{rows.length} players</span>
      </div>

      <div style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: 6, background: "rgba(0,0,0,0.15)", maxHeight: 420 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  style={{
                    textAlign: c.key === "name" ? "left" : "right",
                    padding: "8px 10px", background: "rgba(0,0,0,0.25)",
                    color: sortKey === c.key ? "var(--gold-bright)" : "var(--cream-dim)",
                    fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", fontSize: 10,
                    cursor: "pointer", whiteSpace: "nowrap", borderBottom: "1px solid var(--line)",
                    position: "sticky", top: 0,
                  }}
                >
                  {c.label}{sortKey === c.key ? (sortDir === 1 ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const rate = rateOf(r);
              const history = yearHistory[r.name];
              const isOpen = openPlayer === r.name;
              return (
                <Fragment key={r.name}>
                  <tr>
                    <td
                      onClick={() => history && setOpenPlayer(isOpen ? null : r.name)}
                      style={{
                        padding: "6px 10px", borderBottom: isOpen ? "none" : "1px solid var(--line)", color: "var(--cream)", fontWeight: 600, whiteSpace: "nowrap",
                        cursor: history ? "pointer" : "default",
                        textDecoration: history ? "underline" : "none", textDecorationStyle: "dotted", textDecorationColor: "var(--cream-dim)",
                      }}
                    >
                      {r.name}
                    </td>
                    <td style={{ padding: "6px 10px", borderBottom: isOpen ? "none" : "1px solid var(--line)", textAlign: "right" }}>{r.app}</td>
                    <td style={{ padding: "6px 10px", borderBottom: isOpen ? "none" : "1px solid var(--line)", textAlign: "right" }}>{r.made}</td>
                    <td style={{ padding: "6px 10px", borderBottom: isOpen ? "none" : "1px solid var(--line)", textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                        <div style={{ width: 46, height: 5, background: "var(--line)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${rate}%`, height: "100%", background: rateColor(rate) }} />
                        </div>
                        <span style={{ color: rateColor(rate) }}>{rate.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td style={{ padding: "6px 10px", borderBottom: isOpen ? "none" : "1px solid var(--line)", textAlign: "right" }}>{r.avg.toFixed(1)}</td>
                    <td style={{ padding: "6px 10px", borderBottom: isOpen ? "none" : "1px solid var(--line)", textAlign: "right" }}>{r.best === null ? "—" : r.best}</td>
                    <td style={{ padding: "6px 10px", borderBottom: isOpen ? "none" : "1px solid var(--line)", textAlign: "right" }}>{r.rounds}</td>
                    <td style={{ padding: "6px 10px", borderBottom: isOpen ? "none" : "1px solid var(--line)", textAlign: "right", color: r.sgAvg >= 0 ? "var(--live)" : "var(--clay)" }}>
                      {r.sgAvg > 0 ? "+" : ""}{r.sgAvg.toFixed(2)}
                    </td>
                  </tr>
                  {isOpen && history && (
                    <tr>
                      <td colSpan={8} style={{ padding: "4px 10px 12px", borderBottom: "1px solid var(--line)", background: "rgba(0,0,0,0.15)" }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {YEARS.map((year, i) => {
                            const val = history[i];
                            if (val === undefined || val === null) return null;
                            const missed = val === "MC" || val === "DQ";
                            return (
                              <div
                                key={year}
                                style={{
                                  minWidth: 46, textAlign: "center", padding: "5px 8px", borderRadius: 5,
                                  border: `1px solid ${missed ? "rgba(192,106,76,0.4)" : "var(--line)"}`,
                                  background: missed ? "rgba(192,106,76,0.08)" : "rgba(228,190,74,0.05)",
                                }}
                              >
                                <div style={{ fontSize: 9, color: "var(--cream-dim)" }}>{year}</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: missed ? "var(--clay)" : "var(--cream)" }}>
                                  {missed ? val : val}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
