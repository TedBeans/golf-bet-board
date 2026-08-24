"use client";

import { useState } from "react";

// Course-specific career stats for the CURRENT field, as opposed to
// CourseHistoryTable's year-by-year finish results - a genuinely
// different shape of data (avg finish / top-N rates / strokes-gained
// breakdown at this course specifically), sourced from a DFS-style
// screenshot rather than the usual Betsperts/Ron Klos year-by-year sheet.
// Manually transcribed - see the per-tournament comment above each block
// for source notes and any known gaps.

type PerfRow = {
  name: string;
  salary: number;
  starts: number;
  avgFinish: number;
  winPct: number;
  t5Pct: number;
  t10Pct: number;
  t20Pct: number;
  t30Pct: number | null; // null = not captured (source screenshot cropped before this column)
  t40Pct: number | null;
};

type SgRow = {
  name: string;
  rounds: number;
  sgTot: number;
  sgT2G: number;
  sgOtt: number;
  sgApp: number;
  sgBs: number;
  sgArg: number;
  sgP: number;
  sgSg: number;
};

// Tour Championship is a no-cut, small-field event (see CourseFactsPanel),
// so Made Cut %/Missed Cut % are always "-" in the source data for every
// player - not stored here since it's a constant, rendered as "-" in the UI.
const PERF_DATA: Record<string, PerfRow[]> = {
  "Tour Championship": [
    { name: "Matt Fitzpatrick", salary: 7800, starts: 2, avgFinish: 12.0, winPct: 0.0, t5Pct: 0.0, t10Pct: 50.0, t20Pct: 100.0, t30Pct: 100.0, t40Pct: 100.0 },
    { name: "Justin Rose", salary: 6900, starts: 5, avgFinish: 12.6, winPct: 0.0, t5Pct: 40.0, t10Pct: 60.0, t20Pct: 60.0, t30Pct: 100.0, t40Pct: 100.0 },
    { name: "Collin Morikawa", salary: 8100, starts: 6, avgFinish: 13.3, winPct: 0.0, t5Pct: 16.7, t10Pct: 50.0, t20Pct: 66.7, t30Pct: 100.0, t40Pct: 100.0 },
    { name: "Gary Woodland", salary: 6600, starts: 4, avgFinish: 13.8, winPct: 0.0, t5Pct: 0.0, t10Pct: 25.0, t20Pct: 100.0, t30Pct: 100.0, t40Pct: 100.0 },
    { name: "Sam Burns", salary: 9200, starts: 5, avgFinish: 14.0, winPct: 0.0, t5Pct: 0.0, t10Pct: 40.0, t20Pct: 80.0, t30Pct: 100.0, t40Pct: 100.0 },
    { name: "Hideki Matsuyama", salary: 7600, starts: 10, avgFinish: 14.6, winPct: 0.0, t5Pct: 20.0, t10Pct: 40.0, t20Pct: 70.0, t30Pct: 100.0, t40Pct: 100.0 },
    { name: "Si Woo Kim", salary: 7700, starts: 2, avgFinish: 15.0, winPct: 0.0, t5Pct: 0.0, t10Pct: 50.0, t20Pct: 100.0, t30Pct: 100.0, t40Pct: 100.0 },
    { name: "Robert MacIntyre", salary: 7100, starts: 2, avgFinish: 17.0, winPct: 0.0, t5Pct: 0.0, t10Pct: 0.0, t20Pct: 100.0, t30Pct: 100.0, t40Pct: 100.0 },
    { name: "Ludvig Aberg", salary: 9700, starts: 2, avgFinish: 18.5, winPct: 0.0, t5Pct: 0.0, t10Pct: 0.0, t20Pct: 50.0, t30Pct: 100.0, t40Pct: 100.0 },
    { name: "Akshay Bhatia", salary: 6100, starts: 2, avgFinish: 19.5, winPct: 0.0, t5Pct: 0.0, t10Pct: 0.0, t20Pct: 50.0, t30Pct: 100.0, t40Pct: 100.0 },
    { name: "Tom Kim", salary: 6800, starts: 1, avgFinish: 20.0, winPct: 0.0, t5Pct: 0.0, t10Pct: 0.0, t20Pct: 100.0, t30Pct: 100.0, t40Pct: 100.0 },
    { name: "J.J. Spaun", salary: 7200, starts: 1, avgFinish: 25.0, winPct: 0.0, t5Pct: 0.0, t10Pct: 0.0, t20Pct: 0.0, t30Pct: 100.0, t40Pct: 100.0 },
    // T30%/T40% not captured for the players below - source screenshot was
    // cropped before those columns. Every player above shows 100.0 for
    // both without exception, so it's a reasonable guess these would too,
    // but left blank rather than assumed - ask Teddy for a follow-up
    // screenshot of those columns if exact values matter.
    { name: "Xander Schauffele", salary: 10000, starts: 8, avgFinish: 3.4, winPct: 12.5, t5Pct: 87.5, t10Pct: 100.0, t20Pct: 100.0, t30Pct: null, t40Pct: null },
    { name: "Wyndham Clark", salary: 9400, starts: 2, avgFinish: 5.5, winPct: 0.0, t5Pct: 50.0, t10Pct: 100.0, t20Pct: 100.0, t30Pct: null, t40Pct: null },
    { name: "Russell Henley", salary: 7500, starts: 4, avgFinish: 5.8, winPct: 0.0, t5Pct: 75.0, t10Pct: 75.0, t20Pct: 100.0, t30Pct: null, t40Pct: null },
    { name: "Scottie Scheffler", salary: 14000, starts: 6, avgFinish: 6.7, winPct: 16.7, t5Pct: 66.7, t10Pct: 83.3, t20Pct: 83.3, t30Pct: null, t40Pct: null },
    { name: "Rory McIlroy", salary: 11000, starts: 10, avgFinish: 8.4, winPct: 30.0, t5Pct: 40.0, t10Pct: 70.0, t20Pct: 90.0, t30Pct: null, t40Pct: null },
    { name: "Chris Gotterup", salary: 7900, starts: 1, avgFinish: 10.0, winPct: 0.0, t5Pct: 0.0, t10Pct: 100.0, t20Pct: 100.0, t30Pct: null, t40Pct: null },
    { name: "Adam Scott", salary: 6500, starts: 4, avgFinish: 10.8, winPct: 0.0, t5Pct: 25.0, t10Pct: 75.0, t20Pct: 75.0, t30Pct: null, t40Pct: null },
    { name: "Tommy Fleetwood", salary: 9000, starts: 5, avgFinish: 10.8, winPct: 20.0, t5Pct: 20.0, t10Pct: 40.0, t20Pct: 100.0, t30Pct: null, t40Pct: null },
    { name: "Viktor Hovland", salary: 7300, starts: 6, avgFinish: 10.8, winPct: 16.7, t5Pct: 33.3, t10Pct: 33.3, t20Pct: 100.0, t30Pct: null, t40Pct: null },
    { name: "Cameron Young", salary: 8500, starts: 2, avgFinish: 11.5, winPct: 0.0, t5Pct: 50.0, t10Pct: 50.0, t20Pct: 100.0, t30Pct: null, t40Pct: null },
    { name: "Patrick Cantlay", salary: 8900, starts: 8, avgFinish: 11.8, winPct: 12.5, t5Pct: 37.5, t10Pct: 50.0, t20Pct: 75.0, t30Pct: null, t40Pct: null },
  ],
};

const SG_DATA: Record<string, SgRow[]> = {
  "Tour Championship": [
    { name: "Xander Schauffele", rounds: 32, sgTot: 1.88, sgT2G: 1.34, sgOtt: 0.33, sgApp: 0.74, sgBs: 1.06, sgArg: 0.27, sgP: 0.54, sgSg: 0.82 },
    { name: "Russell Henley", rounds: 16, sgTot: 1.39, sgT2G: 0.99, sgOtt: -0.01, sgApp: 0.78, sgBs: 0.77, sgArg: 0.22, sgP: 0.40, sgSg: 0.62 },
    { name: "Wyndham Clark", rounds: 8, sgTot: 1.31, sgT2G: 0.88, sgOtt: 0.10, sgApp: 0.52, sgBs: 0.62, sgArg: 0.27, sgP: 0.43, sgSg: 0.70 },
    { name: "Viktor Hovland", rounds: 24, sgTot: 1.10, sgT2G: 1.11, sgOtt: 0.19, sgApp: 0.93, sgBs: 1.12, sgArg: -0.01, sgP: -0.01, sgSg: -0.02 },
    { name: "Rory McIlroy", rounds: 40, sgTot: 1.05, sgT2G: 0.74, sgOtt: 0.80, sgApp: 0.07, sgBs: 0.86, sgArg: -0.12, sgP: 0.31, sgSg: 0.18 },
    { name: "Chris Gotterup", rounds: 4, sgTot: 0.82, sgT2G: 0.90, sgOtt: 0.67, sgApp: 0.59, sgBs: 1.26, sgArg: -0.36, sgP: -0.08, sgSg: -0.44 },
    { name: "Scottie Scheffler", rounds: 24, sgTot: 0.76, sgT2G: 1.31, sgOtt: 0.45, sgApp: 0.52, sgBs: 0.97, sgArg: 0.34, sgP: -0.55, sgSg: -0.21 },
    { name: "Tommy Fleetwood", rounds: 20, sgTot: 0.72, sgT2G: 0.37, sgOtt: 0.08, sgApp: 0.14, sgBs: 0.22, sgArg: 0.16, sgP: 0.35, sgSg: 0.50 },
    { name: "Adam Scott", rounds: 16, sgTot: 0.60, sgT2G: 0.28, sgOtt: -0.08, sgApp: 0.34, sgBs: 0.27, sgArg: 0.01, sgP: 0.32, sgSg: 0.33 },
    { name: "Cameron Young", rounds: 8, sgTot: 0.49, sgT2G: 0.25, sgOtt: 0.33, sgApp: 0.30, sgBs: 0.64, sgArg: -0.38, sgP: 0.23, sgSg: -0.15 },
    { name: "Collin Morikawa", rounds: 24, sgTot: 0.47, sgT2G: 1.10, sgOtt: 0.32, sgApp: 0.85, sgBs: 1.17, sgArg: -0.07, sgP: -0.63, sgSg: -0.70 },
    { name: "Justin Rose", rounds: 20, sgTot: 0.39, sgT2G: 1.10, sgOtt: 0.12, sgApp: 0.85, sgBs: 0.97, sgArg: 0.13, sgP: -0.70, sgSg: -0.57 },
    { name: "Sam Burns", rounds: 20, sgTot: 0.08, sgT2G: -0.59, sgOtt: -0.13, sgApp: -0.33, sgBs: -0.46, sgArg: -0.14, sgP: 0.68, sgSg: 0.54 },
    { name: "Matt Fitzpatrick", rounds: 8, sgTot: 0.08, sgT2G: -0.09, sgOtt: 0.31, sgApp: -0.67, sgBs: -0.35, sgArg: 0.26, sgP: 0.17, sgSg: 0.43 },
    { name: "Gary Woodland", rounds: 16, sgTot: 0.03, sgT2G: 0.20, sgOtt: 0.12, sgApp: -0.00, sgBs: 0.12, sgArg: 0.08, sgP: -0.16, sgSg: -0.09 },
    { name: "Patrick Cantlay", rounds: 32, sgTot: -0.01, sgT2G: 0.75, sgOtt: 0.16, sgApp: 0.69, sgBs: 0.85, sgArg: -0.10, sgP: -0.76, sgSg: -0.86 },
    { name: "Robert MacIntyre", rounds: 8, sgTot: -0.03, sgT2G: 0.01, sgOtt: 0.43, sgApp: -0.60, sgBs: -0.17, sgArg: 0.18, sgP: -0.04, sgSg: 0.14 },
    { name: "Si Woo Kim", rounds: 8, sgTot: -0.07, sgT2G: -0.28, sgOtt: -0.31, sgApp: -0.47, sgBs: -0.77, sgArg: 0.49, sgP: 0.21, sgSg: 0.71 },
    { name: "Tom Kim", rounds: 4, sgTot: -0.24, sgT2G: -1.06, sgOtt: -0.62, sgApp: -0.82, sgBs: -1.43, sgArg: 0.37, sgP: 0.82, sgSg: 1.19 },
    { name: "Hideki Matsuyama", rounds: 40, sgTot: -0.32, sgT2G: 0.20, sgOtt: -0.30, sgApp: 0.41, sgBs: 0.12, sgArg: 0.08, sgP: -0.51, sgSg: -0.44 },
    { name: "Ludvig Aberg", rounds: 8, sgTot: -0.53, sgT2G: -0.12, sgOtt: 0.57, sgApp: -1.12, sgBs: -0.55, sgArg: 0.43, sgP: -0.41, sgSg: 0.01 },
    { name: "Akshay Bhatia", rounds: 8, sgTot: -0.66, sgT2G: -0.38, sgOtt: -0.26, sgApp: -0.26, sgBs: -0.52, sgArg: 0.14, sgP: -0.28, sgSg: -0.14 },
    { name: "J.J. Spaun", rounds: 4, sgTot: -1.18, sgT2G: -1.10, sgOtt: -0.21, sgApp: -0.68, sgBs: -0.89, sgArg: -0.22, sgP: -0.08, sgSg: -0.30 },
    { name: "Jacob Bridgeman", rounds: 4, sgTot: -2.18, sgT2G: -1.15, sgOtt: -0.13, sgApp: -1.22, sgBs: -1.35, sgArg: 0.20, sgP: -1.04, sgSg: -0.84 },
  ],
};

const thStyle = (align: "left" | "right"): React.CSSProperties => ({
  textAlign: align, padding: "7px 6px", background: "rgba(0,0,0,0.25)",
  color: "var(--cream-dim)", fontWeight: 600, letterSpacing: "0.03em",
  textTransform: "uppercase", fontSize: 9.5, whiteSpace: "nowrap", borderBottom: "1px solid var(--line)",
  cursor: "pointer", userSelect: "none",
});
const tdStyle = (align: "left" | "right"): React.CSSProperties => ({
  padding: "5px 6px", borderBottom: "1px solid var(--line)", textAlign: align, whiteSpace: "nowrap", fontSize: 11.5,
});

function fmt(n: number | null, decimals = 1): string {
  return n === null ? "—" : n.toFixed(decimals);
}
function fmtSigned(n: number): string {
  return n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2);
}
function sgColor(n: number): string {
  if (n > 0.05) return "var(--clay)";
  if (n < -0.05) return "var(--steel)";
  return "var(--cream-dim)";
}

type SortDir = "asc" | "desc";
function arrow(active: boolean, dir: SortDir) {
  return active ? (dir === "asc" ? " ▲" : " ▼") : "";
}

export default function FieldCourseStatsTable({ tournamentName }: { tournamentName: string }) {
  const perfRows = PERF_DATA[tournamentName];
  const sgRows = SG_DATA[tournamentName];
  const [tab, setTab] = useState<"perf" | "sg">("perf");
  const [perfSort, setPerfSort] = useState<{ col: keyof PerfRow; dir: SortDir }>({ col: "avgFinish", dir: "asc" });
  const [sgSort, setSgSort] = useState<{ col: keyof SgRow; dir: SortDir }>({ col: "sgTot", dir: "desc" });

  if (!perfRows && !sgRows) return null;

  function togglePerfSort(col: keyof PerfRow) {
    setPerfSort((prev) => (prev.col === col ? { col, dir: prev.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" }));
  }
  function toggleSgSort(col: keyof SgRow) {
    setSgSort((prev) => (prev.col === col ? { col, dir: prev.dir === "asc" ? "desc" : "asc" } : { col, dir: "desc" }));
  }

  const sortedPerf = perfRows
    ? [...perfRows].sort((a, b) => {
        const dir = perfSort.dir === "asc" ? 1 : -1;
        const av = a[perfSort.col], bv = b[perfSort.col];
        if (typeof av === "string" || typeof bv === "string") return String(av).localeCompare(String(bv)) * dir;
        return (((av as number) ?? 999) - ((bv as number) ?? 999)) * dir;
      })
    : [];

  const sortedSg = sgRows
    ? [...sgRows].sort((a, b) => {
        const dir = sgSort.dir === "asc" ? 1 : -1;
        const av = a[sgSort.col], bv = b[sgSort.col];
        if (typeof av === "string" || typeof bv === "string") return String(av).localeCompare(String(bv)) * dir;
        return ((av as number) - (bv as number)) * dir;
      })
    : [];

  return (
    <div style={{ marginTop: 14 }}>
      <div className="subline" style={{ marginBottom: 8 }}>Field course stats at this venue</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <button className={tab === "perf" ? "add-btn-inline" : "recap-btn"} onClick={() => setTab("perf")}>
          Course Performance
        </button>
        <button className={tab === "sg" ? "add-btn-inline" : "recap-btn"} onClick={() => setTab("sg")}>
          Strokes Gained
        </button>
      </div>

      {tab === "perf" && (
        perfRows ? (
          <div style={{ border: "1px solid var(--line)", borderRadius: 6, background: "rgba(0,0,0,0.15)", overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 680, borderCollapse: "collapse", fontFamily: "'JetBrains Mono',monospace" }}>
              <thead>
                <tr>
                  <th style={thStyle("left")} onClick={() => togglePerfSort("name")}>Player{arrow(perfSort.col === "name", perfSort.dir)}</th>
                  <th style={thStyle("right")} onClick={() => togglePerfSort("salary")}>Salary{arrow(perfSort.col === "salary", perfSort.dir)}</th>
                  <th style={thStyle("right")} onClick={() => togglePerfSort("starts")}>Starts{arrow(perfSort.col === "starts", perfSort.dir)}</th>
                  <th style={thStyle("right")} onClick={() => togglePerfSort("avgFinish")}>Avg{arrow(perfSort.col === "avgFinish", perfSort.dir)}</th>
                  <th style={thStyle("right")} onClick={() => togglePerfSort("winPct")}>Win%{arrow(perfSort.col === "winPct", perfSort.dir)}</th>
                  <th style={thStyle("right")} onClick={() => togglePerfSort("t5Pct")}>T5%{arrow(perfSort.col === "t5Pct", perfSort.dir)}</th>
                  <th style={thStyle("right")} onClick={() => togglePerfSort("t10Pct")}>T10%{arrow(perfSort.col === "t10Pct", perfSort.dir)}</th>
                  <th style={thStyle("right")} onClick={() => togglePerfSort("t20Pct")}>T20%{arrow(perfSort.col === "t20Pct", perfSort.dir)}</th>
                  <th style={thStyle("right")} onClick={() => togglePerfSort("t30Pct")}>T30%{arrow(perfSort.col === "t30Pct", perfSort.dir)}</th>
                  <th style={thStyle("right")} onClick={() => togglePerfSort("t40Pct")}>T40%{arrow(perfSort.col === "t40Pct", perfSort.dir)}</th>
                </tr>
              </thead>
              <tbody>
                {sortedPerf.map((r) => (
                  <tr key={r.name}>
                    <td style={{ ...tdStyle("left"), color: "var(--cream)", fontWeight: 600 }}>{r.name}</td>
                    <td style={{ ...tdStyle("right"), color: "var(--cream-dim)" }}>${(r.salary / 100).toFixed(0)}00</td>
                    <td style={{ ...tdStyle("right"), color: "var(--cream-dim)" }}>{r.starts}</td>
                    <td style={{ ...tdStyle("right"), color: "var(--cream)" }}>{fmt(r.avgFinish)}</td>
                    <td style={tdStyle("right")}>{fmt(r.winPct)}</td>
                    <td style={tdStyle("right")}>{fmt(r.t5Pct)}</td>
                    <td style={tdStyle("right")}>{fmt(r.t10Pct)}</td>
                    <td style={tdStyle("right")}>{fmt(r.t20Pct)}</td>
                    <td style={tdStyle("right")}>{fmt(r.t30Pct)}</td>
                    <td style={tdStyle("right")}>{fmt(r.t40Pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="subline">No course performance data for this tournament yet.</div>
        )
      )}

      {tab === "sg" && (
        sgRows ? (
          <div style={{ border: "1px solid var(--line)", borderRadius: 6, background: "rgba(0,0,0,0.15)", overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 620, borderCollapse: "collapse", fontFamily: "'JetBrains Mono',monospace" }}>
              <thead>
                <tr>
                  <th style={thStyle("left")} onClick={() => toggleSgSort("name")}>Player{arrow(sgSort.col === "name", sgSort.dir)}</th>
                  <th style={thStyle("right")} onClick={() => toggleSgSort("rounds")}>Rds{arrow(sgSort.col === "rounds", sgSort.dir)}</th>
                  <th style={thStyle("right")} onClick={() => toggleSgSort("sgTot")}>TOT{arrow(sgSort.col === "sgTot", sgSort.dir)}</th>
                  <th style={thStyle("right")} onClick={() => toggleSgSort("sgT2G")}>T2G{arrow(sgSort.col === "sgT2G", sgSort.dir)}</th>
                  <th style={thStyle("right")} onClick={() => toggleSgSort("sgOtt")}>OTT{arrow(sgSort.col === "sgOtt", sgSort.dir)}</th>
                  <th style={thStyle("right")} onClick={() => toggleSgSort("sgApp")}>APP{arrow(sgSort.col === "sgApp", sgSort.dir)}</th>
                  <th style={thStyle("right")} onClick={() => toggleSgSort("sgBs")}>BS{arrow(sgSort.col === "sgBs", sgSort.dir)}</th>
                  <th style={thStyle("right")} onClick={() => toggleSgSort("sgArg")}>ARG{arrow(sgSort.col === "sgArg", sgSort.dir)}</th>
                  <th style={thStyle("right")} onClick={() => toggleSgSort("sgP")}>P{arrow(sgSort.col === "sgP", sgSort.dir)}</th>
                  <th style={thStyle("right")} onClick={() => toggleSgSort("sgSg")}>SG{arrow(sgSort.col === "sgSg", sgSort.dir)}</th>
                </tr>
              </thead>
              <tbody>
                {sortedSg.map((r) => (
                  <tr key={r.name}>
                    <td style={{ ...tdStyle("left"), color: "var(--cream)", fontWeight: 600 }}>{r.name}</td>
                    <td style={{ ...tdStyle("right"), color: "var(--cream-dim)" }}>{r.rounds}</td>
                    <td style={{ ...tdStyle("right"), color: sgColor(r.sgTot), fontWeight: 600 }}>{fmtSigned(r.sgTot)}</td>
                    <td style={{ ...tdStyle("right"), color: sgColor(r.sgT2G) }}>{fmtSigned(r.sgT2G)}</td>
                    <td style={{ ...tdStyle("right"), color: sgColor(r.sgOtt) }}>{fmtSigned(r.sgOtt)}</td>
                    <td style={{ ...tdStyle("right"), color: sgColor(r.sgApp) }}>{fmtSigned(r.sgApp)}</td>
                    <td style={{ ...tdStyle("right"), color: sgColor(r.sgBs) }}>{fmtSigned(r.sgBs)}</td>
                    <td style={{ ...tdStyle("right"), color: sgColor(r.sgArg) }}>{fmtSigned(r.sgArg)}</td>
                    <td style={{ ...tdStyle("right"), color: sgColor(r.sgP) }}>{fmtSigned(r.sgP)}</td>
                    <td style={{ ...tdStyle("right"), color: sgColor(r.sgSg) }}>{fmtSigned(r.sgSg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="subline">No strokes-gained data for this tournament yet.</div>
        )
      )}
      <div className="subline" style={{ marginTop: 6 }}>
        Made Cut / Missed Cut % omitted - Tour Championship is a no-cut event, so every player shows "-" for both in the source data.
      </div>
    </div>
  );
}
