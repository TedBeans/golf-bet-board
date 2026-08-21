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

function pctOf(count: number | null, total: number | null): number | null {
  if (count === null || total === null || total === 0) return null;
  return (count / total) * 100;
}

function formatPct(count: number | null, total: number | null): string {
  const p = pctOf(count, total);
  return p === null ? "—" : `${p.toFixed(1)}%`;
}

const DEFAULT_ROUND = "Round 1";

const thStyle = (align: "left" | "right", sortable?: boolean): React.CSSProperties => ({
  textAlign: align, padding: "8px 8px", background: "rgba(0,0,0,0.25)",
  color: "var(--cream-dim)", fontWeight: 600, letterSpacing: "0.03em",
  textTransform: "uppercase", fontSize: 10, whiteSpace: "nowrap", borderBottom: "1px solid var(--line)",
  cursor: sortable ? "pointer" : "default", userSelect: "none",
});
const tdStyle = (align: "left" | "right"): React.CSSProperties => ({
  padding: "6px 8px", borderBottom: "1px solid var(--line)", textAlign: align, whiteSpace: "nowrap",
});

type SortDir = "asc" | "desc";
function sortArrow(active: boolean, dir: SortDir): string {
  if (!active) return "";
  return dir === "asc" ? " ▲" : " ▼";
}

export default function LiveLeaderboardTable({ tournamentName }: { tournamentName: string }) {
  const [tab, setTab] = useState<"leaderboard" | "stats">("leaderboard");
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { openKey, state, open, close, openPlayer } = useScorecardPopover();

  const [statsRows, setStatsRows] = useState<FieldPlayerStats[] | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsFetchedAt, setStatsFetchedAt] = useState<string | null>(null);
  const [statsRefreshing, setStatsRefreshing] = useState(false);
  const [statsRound, setStatsRound] = useState<"1" | "2" | "3" | "4" | "total">("total");

  const [lbSort, setLbSort] = useState<{ col: "pos" | "player" | "total" | "today" | "thru"; dir: SortDir }>({ col: "pos", dir: "asc" });
  const [statsSort, setStatsSort] = useState<{ col: "pos" | "player" | "score" | "gir" | "fairways"; dir: SortDir }>({ col: "pos", dir: "asc" });

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

  function loadStats(refresh: boolean) {
    if (refresh) setStatsRefreshing(true);
    const url = `/api/leaderboard-stats?tournament=${encodeURIComponent(tournamentName)}${refresh ? "&refresh=1" : ""}`;
    return fetchFresh(url)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setStatsError(d.error);
          return;
        }
        setStatsRows(d.players || []);
        setStatsFetchedAt(d.fetchedAt || null);
        setStatsError(null);
      })
      .catch(() => setStatsError("Couldn't load Greens & Fairways stats."))
      .finally(() => setStatsRefreshing(false));
  }

  useEffect(() => {
    if (tab !== "stats" || statsRows !== null || statsError !== null) return;
    loadStats(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, tournamentName]);

  const q = query.trim().toLowerCase();
  const round = DEFAULT_ROUND;

  const positionById = new Map((rows || []).map((r) => [r.id, r]));
  const posRank = (p: string | null): number => {
    if (!p) return 9999;
    const n = parseInt(p.replace(/^T/, ""), 10);
    return isNaN(n) ? 9999 : n;
  };

  function toggleSort<T extends string>(
    current: { col: T; dir: SortDir },
    setter: (v: { col: T; dir: SortDir }) => void,
    col: T,
    defaultDir: SortDir = "asc"
  ) {
    if (current.col === col) {
      setter({ col, dir: current.dir === "asc" ? "desc" : "asc" });
    } else {
      setter({ col, dir: defaultDir });
    }
  }

  const filteredLeaderboard = q ? (rows || []).filter((r) => r.name.toLowerCase().includes(q)) : rows || [];
  const sortedLeaderboard = [...filteredLeaderboard].sort((a, b) => {
    const dir = lbSort.dir === "asc" ? 1 : -1;
    switch (lbSort.col) {
      case "player": return a.name.localeCompare(b.name) * dir;
      case "total": return ((a.totalToPar ?? 999) - (b.totalToPar ?? 999)) * dir;
      case "today": return ((a.todayToPar ?? 999) - (b.todayToPar ?? 999)) * dir;
      case "thru": return ((a.thru ?? -1) - (b.thru ?? -1)) * dir;
      default: return (posRank(a.position) - posRank(b.position)) * dir;
    }
  });

  const filteredStats = q ? (statsRows || []).filter((r) => r.name.toLowerCase().includes(q)) : statsRows || [];
  const sortedStats = [...filteredStats].sort((a, b) => {
    const dir = statsSort.dir === "asc" ? 1 : -1;
    const la = positionById.get(a.id);
    const lb = positionById.get(b.id);
    const sa = statsRound === "total" ? a.total : a.rounds[statsRound];
    const sb = statsRound === "total" ? b.total : b.rounds[statsRound];
    switch (statsSort.col) {
      case "player": return a.name.localeCompare(b.name) * dir;
      case "score": return ((la?.totalToPar ?? 999) - (lb?.totalToPar ?? 999)) * dir;
      case "gir": return ((pctOf(sa?.girCount ?? null, sa?.girTotal ?? null) ?? -1) - (pctOf(sb?.girCount ?? null, sb?.girTotal ?? null) ?? -1)) * dir;
      case "fairways": return ((pctOf(sa?.fairwaysCount ?? null, sa?.fairwaysTotal ?? null) ?? -1) - (pctOf(sb?.fairwaysCount ?? null, sb?.fairwaysTotal ?? null) ?? -1)) * dir;
      default: return (posRank(la?.position ?? null) - posRank(lb?.position ?? null)) * dir;
    }
  });

  // Single hoisted popover instance, rendered outside both scrollable
  // table wrappers so a horizontally-scrolled ancestor can never clip it -
  // see HoleScorecardModal's "centered" variant doc comment for why.

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
          <div style={{ display: "flex", gap: 4, marginLeft: "auto", alignItems: "center" }}>
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
            <button
              onClick={() => loadStats(true)}
              disabled={statsRefreshing}
              title="This normally refreshes once a day around 7pm Central - use this to force it sooner"
              style={{
                background: "rgba(0,0,0,0.25)", color: "var(--cream-dim)", border: "1px solid var(--line)",
                borderRadius: 4, padding: "4px 9px", fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
                cursor: statsRefreshing ? "default" : "pointer", opacity: statsRefreshing ? 0.5 : 1,
              }}
            >
              {statsRefreshing ? "…" : "↻"}
            </button>
          </div>
        )}
      </div>
      {tab === "stats" && statsFetchedAt && (
        <div className="subline" style={{ marginTop: -4, marginBottom: 8 }}>
          Updated {new Date(statsFetchedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          {" "}· refreshes once daily around 7pm Central · tap a column header to sort · scroll sideways for more
        </div>
      )}

      {tab === "leaderboard" && (
        error ? (
          <div className="subline">Leaderboard unavailable: {error}</div>
        ) : !rows ? (
          <div className="subline">Loading leaderboard…</div>
        ) : (
          <div style={{ border: "1px solid var(--line)", borderRadius: 6, background: "rgba(0,0,0,0.15)", overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 420, borderCollapse: "collapse", fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>
              <thead>
                <tr>
                  <th style={thStyle("right", true)} onClick={() => toggleSort(lbSort, setLbSort, "pos")}>Pos{sortArrow(lbSort.col === "pos", lbSort.dir)}</th>
                  <th style={thStyle("left", true)} onClick={() => toggleSort(lbSort, setLbSort, "player")}>Player{sortArrow(lbSort.col === "player", lbSort.dir)}</th>
                  <th style={thStyle("right", true)} onClick={() => toggleSort(lbSort, setLbSort, "total")}>Total{sortArrow(lbSort.col === "total", lbSort.dir)}</th>
                  <th style={thStyle("right", true)} onClick={() => toggleSort(lbSort, setLbSort, "today")}>Today{sortArrow(lbSort.col === "today", lbSort.dir)}</th>
                  <th style={thStyle("right", true)} onClick={() => toggleSort(lbSort, setLbSort, "thru")}>Thru{sortArrow(lbSort.col === "thru", lbSort.dir)}</th>
                </tr>
              </thead>
              <tbody>
                {sortedLeaderboard.map((r) => {
                  const key = `lb:${r.id}`;
                  return (
                    <tr key={r.id}>
                      <td style={{ ...tdStyle("right"), color: "var(--cream-dim)" }}>{r.position ?? "—"}</td>
                      <td style={{ ...tdStyle("left") }}>
                        <span
                          style={{
                            color: "var(--cream)", fontWeight: 600, cursor: "pointer",
                            textDecoration: "underline", textDecorationStyle: "dotted", textDecorationColor: "var(--cream-dim)",
                          }}
                          onClick={() => open(key, tournamentName, round, r.name)}
                        >
                          {r.name}
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
          <div style={{ border: "1px solid var(--line)", borderRadius: 6, background: "rgba(0,0,0,0.15)", overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse", fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>
              <thead>
                <tr>
                  <th style={thStyle("right", true)} onClick={() => toggleSort(statsSort, setStatsSort, "pos")}>Pos{sortArrow(statsSort.col === "pos", statsSort.dir)}</th>
                  <th style={thStyle("left", true)} onClick={() => toggleSort(statsSort, setStatsSort, "player")}>Player{sortArrow(statsSort.col === "player", statsSort.dir)}</th>
                  <th style={thStyle("right", true)} onClick={() => toggleSort(statsSort, setStatsSort, "score")}>Score{sortArrow(statsSort.col === "score", statsSort.dir)}</th>
                  <th style={thStyle("right", true)} onClick={() => toggleSort(statsSort, setStatsSort, "gir")}>GIR %{sortArrow(statsSort.col === "gir", statsSort.dir)}</th>
                  <th style={thStyle("right")}>Greens</th>
                  <th style={thStyle("right", true)} onClick={() => toggleSort(statsSort, setStatsSort, "fairways")}>Fairway %{sortArrow(statsSort.col === "fairways", statsSort.dir)}</th>
                  <th style={thStyle("right")}>Fairways</th>
                </tr>
              </thead>
              <tbody>
                {sortedStats.map((r) => {
                  const lb = positionById.get(r.id);
                  const s = statsRound === "total" ? r.total : r.rounds[statsRound];
                  const key = `lbstats:${r.id}`;
                  return (
                    <tr key={r.id}>
                      <td style={{ ...tdStyle("right"), color: "var(--cream-dim)" }}>{lb?.position ?? "—"}</td>
                      <td style={{ ...tdStyle("left") }}>
                        <span
                          style={{
                            color: "var(--cream)", fontWeight: 600, cursor: "pointer",
                            textDecoration: "underline", textDecorationStyle: "dotted", textDecorationColor: "var(--cream-dim)",
                          }}
                          onClick={() => open(key, tournamentName, round, r.name)}
                        >
                          {r.name}
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

      {openKey && state && openPlayer && (
        <HoleScorecardModal
          variant="centered"
          player={openPlayer}
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
    </div>
  );
}
