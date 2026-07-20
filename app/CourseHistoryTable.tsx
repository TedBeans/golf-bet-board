"use client";

import { useMemo, useState } from "react";

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
    ["Dylan Wu", 3, 2, 52.7, 5, 12, 0.22],
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
  const [query, setQuery] = useState("");
  const [minApp, setMinApp] = useState(2);
  const [sortKey, setSortKey] = useState<SortKey>("rate");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

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
        Manually transcribed from a screenshot, so spot-check a name before wagering off it if it matters.
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
              return (
                <tr key={r.name}>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--line)", color: "var(--cream)", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {r.name}
                  </td>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--line)", textAlign: "right" }}>{r.app}</td>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--line)", textAlign: "right" }}>{r.made}</td>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--line)", textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                      <div style={{ width: 46, height: 5, background: "var(--line)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${rate}%`, height: "100%", background: rateColor(rate) }} />
                      </div>
                      <span style={{ color: rateColor(rate) }}>{rate.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--line)", textAlign: "right" }}>{r.avg.toFixed(1)}</td>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--line)", textAlign: "right" }}>{r.best === null ? "—" : r.best}</td>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--line)", textAlign: "right" }}>{r.rounds}</td>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--line)", textAlign: "right", color: r.sgAvg >= 0 ? "var(--live)" : "var(--clay)" }}>
                    {r.sgAvg > 0 ? "+" : ""}{r.sgAvg.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
