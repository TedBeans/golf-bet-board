"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import { Bet } from "../../lib/seed";
import { parseBetType, friendlyLabel } from "../../lib/betLogic";
import { computeUnitResult, formatUnits } from "../../lib/units";
import { centralDateFromISO } from "../../lib/centralTime";
import GolfFlagIcon from "../GolfFlagIcon";

const GREEN = "#4CAF6E";
const RED = "#C06A4C";
const CREAM = "#F1ECDD";
const CREAM_DIM = "#A7A08D";
const LINE = "rgba(241,236,221,0.12)";

function betCategory(bet: string): string {
  return parseBetType(bet).label; // SCORE | GIR | BIRDIES | BOGEYS | generic
}

function TooltipBox({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: "#14171B", border: "1px solid var(--line)", borderRadius: 4,
      padding: "8px 10px", fontFamily: "'JetBrains Mono',monospace", fontSize: 12,
    }}>
      <div style={{ color: CREAM_DIM, marginBottom: 4 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.value >= 0 ? GREEN : RED }}>{formatUnits(p.value)}</div>
      ))}
    </div>
  );
}

export default function AnalysisPage() {
  const [archive, setArchive] = useState<Bet[]>([]);
  const [filterPlayer, setFilterPlayer] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [barGroupBy, setBarGroupBy] = useState<"player" | "type">("player");

  useEffect(() => {
    fetch("/api/archive").then((r) => r.json()).then((d) => setArchive(d.archive || []));
  }, []);

  const players = useMemo(() => Array.from(new Set(archive.map((b) => b.player))).sort(), [archive]);
  const types = ["SCORE", "GIR", "BIRDIES", "BOGEYS", "PARS", "WINNER_SCORE"];

  const filtered = useMemo(() => {
    return archive.filter((b) => {
      if (filterPlayer !== "All" && b.player !== filterPlayer) return false;
      if (filterType !== "All" && betCategory(b.bet) !== filterType) return false;
      return true;
    });
  }, [archive, filterPlayer, filterType]);

  const lineData = useMemo(() => {
    const byDate: Record<string, number> = {};
    filtered.forEach((b) => {
      const d = b.loadedDate || (b.archivedAt ? centralDateFromISO(b.archivedAt) : "unknown");
      const u = computeUnitResult(b.oddsPrice, b.oddsUnits, b.status);
      if (u !== null) byDate[d] = (byDate[d] || 0) + u;
    });
    const dates = Object.keys(byDate).filter((d) => d !== "unknown").sort();
    let running = 0;
    return dates.map((d) => {
      running += byDate[d];
      return { date: d.slice(5), units: Math.round(running * 100) / 100 };
    });
  }, [filtered]);

  const barData = useMemo(() => {
    const groups: Record<string, { units: number; wins: number; losses: number }> = {};
    filtered.forEach((b) => {
      const key = barGroupBy === "player" ? b.player : friendlyLabel(betCategory(b.bet));
      if (!groups[key]) groups[key] = { units: 0, wins: 0, losses: 0 };
      const u = computeUnitResult(b.oddsPrice, b.oddsUnits, b.status);
      if (u !== null) groups[key].units += u;
      if (b.status === "hit") groups[key].wins += 1;
      if (b.status === "miss") groups[key].losses += 1;
    });
    return Object.keys(groups)
      .map((k) => ({ name: k, units: Math.round(groups[k].units * 100) / 100, record: `${groups[k].wins}-${groups[k].losses}` }))
      .sort((a, b) => b.units - a.units);
  }, [filtered, barGroupBy]);

  return (
    <>
      <header>
        <div className="title-row">
          <h1><GolfFlagIcon />Golf <span>Tracker</span></h1>
          <div className="header-actions">
            <Link href="/recap" className="recap-btn">Recap/Archives</Link>
          </div>
        </div>
        <div className="subline">
          Analysis <Link href="/" className="admin-link">· back to board</Link>
        </div>
      </header>

      <main>
        {archive.length === 0 && <div className="empty">No resolved rounds yet - come back once something's finished.</div>}

        {archive.length > 0 && (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              <label style={{ fontSize: 11, color: "var(--cream-dim)" }}>
                Player
                <select
                  value={filterPlayer}
                  onChange={(e) => setFilterPlayer(e.target.value)}
                  style={{
                    display: "block", marginTop: 4, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
                    color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 12,
                    padding: "6px 8px", borderRadius: 3,
                  }}
                >
                  <option value="All">All players</option>
                  {players.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 11, color: "var(--cream-dim)" }}>
                Bet type
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  style={{
                    display: "block", marginTop: 4, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
                    color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 12,
                    padding: "6px 8px", borderRadius: 3,
                  }}
                >
                  <option value="All">All types</option>
                  {types.map((t) => <option key={t} value={t}>{friendlyLabel(t)}</option>)}
                </select>
              </label>
            </div>

            <div className="round-label">Net units over time{filterPlayer !== "All" ? ` · ${filterPlayer}` : ""}{filterType !== "All" ? ` · ${friendlyLabel(filterType)}` : ""}</div>
            <div style={{ width: "100%", height: 220, marginBottom: 28 }}>
              {lineData.length > 0 ? (
                <ResponsiveContainer>
                  <LineChart data={lineData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke={LINE} vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: CREAM_DIM, fontSize: 10 }} axisLine={{ stroke: LINE }} tickLine={false} />
                    <YAxis tick={{ fill: CREAM_DIM, fontSize: 10 }} axisLine={{ stroke: LINE }} tickLine={false} />
                    <ReferenceLine y={0} stroke={LINE} />
                    <Tooltip content={<TooltipBox />} />
                    <Line type="monotone" dataKey="units" stroke="#E4BE4A" strokeWidth={2} dot={{ r: 3, fill: "#E4BE4A" }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty">No data for this filter combination.</div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div className="round-label" style={{ margin: 0 }}>Compare performance</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className={barGroupBy === "player" ? "add-btn-inline" : "recap-btn"}
                  style={{ fontSize: 10, padding: "5px 10px" }}
                  onClick={() => setBarGroupBy("player")}
                >
                  By player
                </button>
                <button
                  className={barGroupBy === "type" ? "add-btn-inline" : "recap-btn"}
                  style={{ fontSize: 10, padding: "5px 10px" }}
                  onClick={() => setBarGroupBy("type")}
                >
                  By bet type
                </button>
              </div>
            </div>
            <div style={{ width: "100%", height: Math.max(200, barData.length * 34), marginBottom: 20 }}>
              {barData.length > 0 ? (
                <ResponsiveContainer>
                  <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
                    <CartesianGrid stroke={LINE} horizontal={false} />
                    <XAxis type="number" tick={{ fill: CREAM_DIM, fontSize: 10 }} axisLine={{ stroke: LINE }} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: CREAM, fontSize: 11 }} axisLine={{ stroke: LINE }} tickLine={false} width={110} />
                    <ReferenceLine x={0} stroke={LINE} />
                    <Tooltip content={<TooltipBox />} />
                    <Bar dataKey="units" radius={[2, 2, 2, 2]}>
                      {barData.map((d, i) => <Cell key={i} fill={d.units >= 0 ? GREEN : RED} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty">No data for this filter combination.</div>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}
