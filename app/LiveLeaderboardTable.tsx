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

// The popover opens on Round 1 by default - it has its own R1-R4 tabs, so
// this is just a starting point, not something that needs to track which
// round is actually live right now.
const DEFAULT_ROUND = "Round 1";

export default function LiveLeaderboardTable({ tournamentName }: { tournamentName: string }) {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { openKey, state, open, close } = useScorecardPopover();

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

  if (error) {
    return <div className="subline" style={{ marginTop: 14 }}>Leaderboard unavailable: {error}</div>;
  }
  if (!rows) {
    return <div className="subline" style={{ marginTop: 14 }}>Loading leaderboard…</div>;
  }

  const q = query.trim().toLowerCase();
  const filtered = q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
  const round = DEFAULT_ROUND;

  return (
    <div style={{ marginTop: 14 }}>
      <div className="subline" style={{ marginBottom: 8 }}>Leaderboard · {tournamentName}</div>

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
        <span style={{ fontSize: 10, color: "var(--cream-dim)", marginLeft: "auto" }}>{filtered.length} players</span>
      </div>

      <div style={{ border: "1px solid var(--line)", borderRadius: 6, background: "rgba(0,0,0,0.15)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>
          <thead>
            <tr>
              {["Pos", "Player", "Total", "Today", "Thru"].map((label, i) => (
                <th
                  key={label}
                  style={{
                    textAlign: i === 1 ? "left" : "right",
                    padding: "8px 10px", background: "rgba(0,0,0,0.25)",
                    color: "var(--cream-dim)",
                    fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", fontSize: 10,
                    whiteSpace: "nowrap", borderBottom: "1px solid var(--line)",
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const key = `lb:${r.id}`;
              const isOpen = openKey === key;
              return (
                <tr key={r.id}>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--line)", textAlign: "right", color: "var(--cream-dim)" }}>
                    {r.position ?? "—"}
                  </td>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>
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
                  <td style={{
                    padding: "6px 10px", borderBottom: "1px solid var(--line)", textAlign: "right",
                    color: r.totalToPar === null ? "var(--cream-dim)" : r.totalToPar < 0 ? "var(--clay)" : r.totalToPar > 0 ? "var(--steel)" : "var(--cream)",
                  }}>
                    {formatToPar(r.totalToPar)}
                  </td>
                  <td style={{
                    padding: "6px 10px", borderBottom: "1px solid var(--line)", textAlign: "right",
                    color: r.todayToPar === null ? "var(--cream-dim)" : r.todayToPar < 0 ? "var(--clay)" : r.todayToPar > 0 ? "var(--steel)" : "var(--cream)",
                  }}>
                    {formatToPar(r.todayToPar)}
                  </td>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--line)", textAlign: "right", color: "var(--cream-dim)" }}>
                    {formatThru(r.thru)}
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
