"use client";

import { useEffect, useState } from "react";
import HoleScorecardModal from "./HoleScorecardModal";
import { useScorecardPopover } from "./useScorecardPopover";
import { fetchFresh } from "../lib/fetchFresh";

type LeaderboardRow = {
  id: string;
  name: string;
  position: string | null;
  totalToPar: number | null;
  todayToPar: number | null;
  thru: number | null;
};

type PlayerRoundStats = {
  girCount: number | null;
  girTotal: number | null;
  fairwaysCount: number | null;
  fairwaysTotal: number | null;
};

type FieldPlayerStats = {
  id: string;
  name: string;
  rounds: Record<string, PlayerRoundStats>;
  total: PlayerRoundStats;
};

function formatToPar(n: number | null): string {
  if (n === null || n === undefined) return "—";
  if (n === 0) return "E";
  return n > 0 ? `+${n}` : `${n}`;
}

function formatThru(thru: number | null): string {
  if (thru === null || thru === undefined || thru === 0) return "—";
  if (thru === 18) return "F";
  return String(thru);
}

function formatPct(count: number | null, total: number | null): string {
  if (count === null || total === null || total === 0) return "—";
  return `${((count / total) * 100).toFixed(1)}%`;
}

const DEFAULT_ROUND = "Round 1";

const thStyle = (align: "left" | "right"): React.CSSProperties => ({
  textAlign: align, padding: "8px 10px", background: "rgba(0,0,0,0.25)",
  color: "var(--cream-dim)", fontWeight: 600, letterSpacing: "0.03em",
  textTransform: "uppercase", fontSize: 10, whiteSpace: "nowrap", borderBottom: "1px solid var(--line)",
});
const tdStyle = (align: "left" | "right"): React.CSSProperties => ({
  padding: "6px 10px", borderBottom: "1px solid var(--line)", textAlign: align,
});

export default function LiveLeaderboardTable({ tournamentName }: { tournamentName: string }) {
  const [tab, setTab] = useState<"leaderboard" | "stats">("leaderboard");
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { openKey, state, open, close } = useScorecardPopover();

  const [statsRows, setStatsRows] = useState<FieldPlayerStats[] | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsRound, setStatsRound] = useState<"1" | "2" | "3" | "4" | "total">("total");

  useEffect(() => {
    let cancelled = false;
    function load() {
      fetchFresh(`/api/leaderboard?tournament=${encodeURIComponent(tournamentName)}`)
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          if (d.error) {
            setError(d.error);
            return;
          }
          setRows(d.players || []);
          setError(null);
        })
        .catch(() => {
          if (!cancelled) setError("Couldn't load leaderboard.");
        });
    }
    load();
    const interval = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tournamentName]);

  useEffect(() => {
    if (tab !== "stats") return;
    let cancelled = false;
    function load() {
      fetchFresh(`/api/leaderboard-stats?tournament=${encodeURIComponent(tournamentName)}`)
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          if (d.error) {
            setStatsError(d.error);
            return;
          }
          setStatsRows(d.players || []);
          setStatsError(null);
        })
        .catch(() => {
          if (!cancelled) setStatsError("Couldn't load Greens & Fairways stats.");
        });
    }
    load();
    const interval = setInterval(load, 3 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tab, tournamentName]);

  const q = query.trim().toLowerCase();
  const round = DEFAULT_ROUND;

  const positionById = new Map((rows || []).map((r) => [r.id, r]));

  const filteredLeaderboard = q ? (rows || []).filter((r) => r.name.toLowerCase().includes(q)) : rows || [];
  const filteredStats = q ? (statsRows || []).filter((r) => r.name.toLowerCase().includes(q)) : statsRows || [];
  const sortedStats = [...filteredStats].sort((a, b) => {
    const pa = positionById.get(a.id)?.totalToPar;
    const pb = positionById.get(b.id)?.totalToPar;
    if (pa == null && pb == null) return a.name.localeCompare(b.name);
    if (pa == null) return 1;
    if (pb == null) return -1;
    return pa - pb;
  });

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <button className={tab === "leaderboard" ? "add-btn-inline" : "recap-btn"} onClick={() => setTab("leaderboard")}>
          Leaderboard
        </button>
        <button className={tab === "stats" ? "add-btn-inline" : "recap-btn"} onClick={() => setTab("stats")}>
          Greens &amp; Fairways
        </button>
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
        {tab === "leaderboard" && (
          <span style={{ fontSize: 10, color: "var(--cream-dim)", marginLeft: "auto" }}>{filteredLeaderboard.length} players</span>
        )}
        {tab === "stats" && (
          <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
            {(["1", "2", "3", "4", "total"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setStatsRound(r)}
                style={{
                  background: statsRound === r ? "var(--gold-bright)" : "rgba(0,0,0,0.25)",
                  color: statsRound === r ? "#1a1200" : "var(--cream-dim)",
                  border: "1px solid var(--line)", borderRadius: 4, padding: "4px 9px",
                  fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600, cursor: "pointer",
                }}
              >
                {r === "total" ? "Total" : `R${r}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "leaderboard" && (
        error ? (
          <div className="subline">Leaderboard unavailable: {error}</div>
        ) : !rows ? (
          <div className="subline">Loading leaderboard…</div>
        ) : (
          <div style={{ border: "1px solid var(--line)", borderRadius: 6, background: "rgba(0,0,0,0.15)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>
              <thead>
                <tr>
                  {["Pos", "Player", "Total", "Today", "Thru"].map((label, i) => (
                    <th key={label} style={thStyle(i === 1 ? "left" : "right")}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLeaderboard.map((r) => {
                  const key = `lb:${r.id}`;
                  const isOpen = openKey === key;
                  return (
                    <tr key={r.id}>
                      <td style={{ ...tdStyle("right"), color: "var(--cream-dim)" }}>{r.position ?? "—"}</td>
                      <td style={{ ...tdStyle("left"), whiteSpace: "nowrap" }}>
                        <span style={{ position: "relative", display: "inline-block" }}>
                          <span
                            style={{
                              color: "var(--cream)", fontWeight: 600, cursor: "pointer",
                              textDecoration: "underline", textDecorationStyle: "dotted", textDecorationColor: "var(--cream-dim)",
                            }}
                            onClick={() => open(key, tournamentName, round, r.name)}
                          >
                            {r.name}
                          </span>
                          {isOpen && state && (
                            <HoleScorecardModal
                              player={r.name}
                              tournament={tournamentName}
                              initialRound={round}
                              loading={state.loading}
                              scorecard={state.scorecard}
                              position={state.position}
                              totalToPar={state.totalToPar}
                              message={state.message}
                              summary={state.summary}
                              onClose={close}
                            />
                          )}
                        </span>
                      </td>
                      <td style={{ ...tdStyle("right"), color: r.totalToPar === null ? "var(--cream-dim)" : r.totalToPar < 0 ? "var(--clay)" : r.totalToPar > 0 ? "var(--steel)" : "var(--cream)" }}>
                        {formatToPar(r.totalToPar)}
                      </td>
                      <td style={{ ...tdStyle("right"), color: r.todayToPar === null ? "var(--cream-dim)" : r.todayToPar < 0 ? "var(--clay)" : r.todayToPar > 0 ? "var(--steel)" : "var(--cream)" }}>
                        {formatToPar(r.todayToPar)}
                      </td>
                      <td style={{ ...tdStyle("right"), color: "var(--cream-dim)" }}>{formatThru(r.thru)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === "stats" && (
        statsError ? (
          <div className="subline">Greens &amp; Fairways unavailable: {statsError}</div>
        ) : !statsRows ? (
          <div className="subline">Loading Greens &amp; Fairways stats… (this fetches every player individually, may take a few seconds)</div>
        ) : (
          <div style={{ border: "1px solid var(--line)", borderRadius: 6, background: "rgba(0,0,0,0.15)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>
              <thead>
                <tr>
                  {["Pos", "Player", "Score", "GIR %", "Greens", "Fairway %", "Fairways"].map((label, i) => (
                    <th key={label} style={thStyle(i === 1 ? "left" : "right")}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedStats.map((r) => {
                  const lb = positionById.get(r.id);
                  const s = statsRound === "total" ? r.total : r.rounds[statsRound];
                  const key = `lbstats:${r.id}`;
                  const isOpen = openKey === key;
                  return (
                    <tr key={r.id}>
                      <td style={{ ...tdStyle("right"), color: "var(--cream-dim)" }}>{lb?.position ?? "—"}</td>
                      <td style={{ ...tdStyle("left"), whiteSpace: "nowrap" }}>
                        <span style={{ position: "relative", display: "inline-block" }}>
                          <span
                            style={{
                              color: "var(--cream)", fontWeight: 600, cursor: "pointer",
                              textDecoration: "underline", textDecorationStyle: "dotted", textDecorationColor: "var(--cream-dim)",
                            }}
                            onClick={() => open(key, tournamentName, round, r.name)}
                          >
                            {r.name}
                          </span>
                          {isOpen && state && (
                            <HoleScorecardModal
                              player={r.name}
                              tournament={tournamentName}
                              initialRound={round}
                              loading={state.loading}
                              scorecard={state.scorecard}
                              position={state.position}
                              totalToPar={state.totalToPar}
                              message={state.message}
                              summary={state.summary}
                              onClose={close}
                            />
                          )}
                        </span>
                      </td>
                      <td style={{ ...tdStyle("right"), color: lb?.totalToPar == null ? "var(--cream-dim)" : lb.totalToPar < 0 ? "var(--clay)" : lb.totalToPar > 0 ? "var(--steel)" : "var(--cream)" }}>
                        {formatToPar(lb?.totalToPar ?? null)}
                      </td>
                      <td style={{ ...tdStyle("right"), color: "var(--cream)" }}>{formatPct(s?.girCount ?? null, s?.girTotal ?? null)}</td>
                      <td style={{ ...tdStyle("right"), color: "var(--cream-dim)" }}>{s?.girCount ?? "—"}/{s?.girTotal ?? "—"}</td>
                      <td style={{ ...tdStyle("right"), color: "var(--cream)" }}>{formatPct(s?.fairwaysCount ?? null, s?.fairwaysTotal ?? null)}</td>
                      <td style={{ ...tdStyle("right"), color: "var(--cream-dim)" }}>{s?.fairwaysCount ?? "—"}/{s?.fairwaysTotal ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
