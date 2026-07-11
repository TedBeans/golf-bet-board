"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bet } from "../../lib/seed";
import { Mapping, EMPTY_MAPPING } from "../../lib/mapping";

type Competitor = { id: string; name: string; shortName: string };

function guessMatch(playerName: string, competitors: Competitor[]): Competitor | null {
  const lower = playerName.toLowerCase();
  for (const c of competitors) {
    const combined = `${c.name} ${c.shortName}`.toLowerCase();
    if (combined.includes(lower)) return c;
  }
  const tokens = lower.split(/\s+/);
  const lastToken = tokens[tokens.length - 1];
  for (const c of competitors) {
    if (c.name.toLowerCase().includes(lastToken)) return c;
  }
  return null;
}

export default function AdminPage() {
  const [passcode, setPasscode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [lockError, setLockError] = useState("");
  const [bets, setBets] = useState<Bet[]>([]);
  const [mapping, setMapping] = useState<Mapping>(EMPTY_MAPPING);
  const [eventIdInputs, setEventIdInputs] = useState<Record<string, string>>({});
  const [competitorsByTourn, setCompetitorsByTourn] = useState<Record<string, Competitor[]>>({});
  const [fetchError, setFetchError] = useState<Record<string, string>>({});
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem("bb_passcode");
    if (stored) {
      setPasscode(stored);
      setUnlocked(true);
    }
    fetch("/api/bets").then((r) => r.json()).then((d) => setBets(d.bets || []));
    fetch("/api/mapping").then((r) => r.json()).then((d) => {
      const m: Mapping = d.mapping || EMPTY_MAPPING;
      setMapping(m);
      const inputs: Record<string, string> = {};
      Object.keys(m.tournaments).forEach((t) => (inputs[t] = m.tournaments[t].eventId));
      setEventIdInputs(inputs);
    });
  }, []);

  function tryUnlock() {
    setLockError("");
    fetch("/api/mapping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode, mapping }),
    }).then((r) => {
      if (r.ok) {
        setUnlocked(true);
        sessionStorage.setItem("bb_passcode", passcode);
      } else {
        setLockError("Wrong passcode");
      }
    });
  }

  const tournaments = Array.from(new Set(bets.map((b) => b.t)));
  const playersByTourn: Record<string, string[]> = {};
  bets.forEach((b) => {
    playersByTourn[b.t] = playersByTourn[b.t] || [];
    if (!playersByTourn[b.t].includes(b.player)) playersByTourn[b.t].push(b.player);
  });

  async function fetchPlayers(tourn: string) {
    const eventId = (eventIdInputs[tourn] || "").trim();
    if (!eventId) return;
    setFetchError((p) => ({ ...p, [tourn]: "" }));
    try {
      const res = await fetch(`/api/leaderboard?eventId=${encodeURIComponent(eventId)}`);
      const data = await res.json();
      if (!res.ok) {
        setFetchError((p) => ({ ...p, [tourn]: data.error || "Fetch failed" }));
        return;
      }
      setCompetitorsByTourn((p) => ({ ...p, [tourn]: data.competitors }));
      setMapping((m) => ({
        ...m,
        tournaments: { ...m.tournaments, [tourn]: { eventId } },
      }));

      // best-guess pre-fill any unmapped players for this tournament
      setMapping((m) => {
        const next = { ...m, players: { ...m.players } };
        (playersByTourn[tourn] || []).forEach((player) => {
          if (!next.players[player]) {
            const guess = guessMatch(player, data.competitors);
            if (guess) next.players[player] = { espnId: guess.id, espnName: guess.name };
          }
        });
        return next;
      });
    } catch (e) {
      setFetchError((p) => ({ ...p, [tourn]: "Network error" }));
    }
  }

  function setPlayerMapping(player: string, espnId: string, espnName: string) {
    setMapping((m) => ({
      ...m,
      players: { ...m.players, [player]: { espnId, espnName } },
    }));
  }

  function saveMapping() {
    fetch("/api/mapping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode, mapping }),
    }).then((r) => {
      setSaveMsg(r.ok ? "Saved." : "Save failed - check passcode.");
      setTimeout(() => setSaveMsg(""), 3000);
    });
  }

  if (!unlocked) {
    return (
      <main style={{ maxWidth: 420, margin: "80px auto", textAlign: "center" }}>
        <h1>Bet <span>Board</span></h1>
        <div className="subline" style={{ marginBottom: 20 }}>Auto-sync setup</div>
        <div className="lock" style={{ justifyContent: "center" }}>
          <input
            type="password"
            placeholder="passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && tryUnlock()}
          />
          <button onClick={tryUnlock}>Unlock</button>
        </div>
        {lockError && <div className="lock-error">{lockError}</div>}
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/" className="admin-link">← back to board</Link>
      </div>
      <h1 style={{ marginBottom: 4 }}>Auto-sync setup</h1>
      <div className="subline" style={{ marginBottom: 20 }}>
        One-time per tournament. Find the ESPN event ID by opening the tournament's
        leaderboard on espn.com/golf and copying the number from the URL.
      </div>

      {tournaments.map((tourn) => (
        <div key={tourn} className="card" style={{ marginBottom: 20 }}>
          <div className="player" style={{ marginBottom: 8 }}>{tourn}</div>

          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <input
              placeholder="ESPN event ID (e.g. 401703504)"
              value={eventIdInputs[tourn] || ""}
              onChange={(e) => setEventIdInputs((p) => ({ ...p, [tourn]: e.target.value }))}
              style={{
                flex: 1, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
                color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 12,
                padding: "7px 8px", borderRadius: 3,
              }}
            />
            <button className="add-btn-inline" onClick={() => fetchPlayers(tourn)}>
              Fetch players
            </button>
          </div>
          {fetchError[tourn] && <div className="lock-error" style={{ marginBottom: 8 }}>{fetchError[tourn]}</div>}

          {(playersByTourn[tourn] || []).map((player) => {
            const competitors = competitorsByTourn[tourn] || [];
            const current = mapping.players[player];
            return (
              <div key={player} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 110, fontSize: 12 }}>{player}</div>
                <select
                  value={current?.espnId || ""}
                  onChange={(e) => {
                    const c = competitors.find((x) => x.id === e.target.value);
                    setPlayerMapping(player, e.target.value, c?.name || "");
                  }}
                  style={{
                    flex: 1, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
                    color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 12,
                    padding: "6px 8px", borderRadius: 3,
                  }}
                >
                  <option value="">— not mapped —</option>
                  {competitors.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                  {current && !competitors.find((c) => c.id === current.espnId) && (
                    <option value={current.espnId}>{current.espnName} (saved)</option>
                  )}
                </select>
              </div>
            );
          })}
        </div>
      ))}

      <button className="add-btn-inline" onClick={saveMapping} style={{ width: "100%", padding: 10 }}>
        Save mapping
      </button>
      {saveMsg && <div className="subline" style={{ marginTop: 8 }}>{saveMsg}</div>}
    </main>
  );
}
