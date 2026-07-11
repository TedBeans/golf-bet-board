"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bet } from "../../lib/seed";
import { Mapping, EMPTY_MAPPING } from "../../lib/mapping";

export default function AdminPage() {
  const [passcode, setPasscode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [lockError, setLockError] = useState("");
  const [bets, setBets] = useState<Bet[]>([]);
  const [mapping, setMapping] = useState<Mapping>(EMPTY_MAPPING);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem("bb_passcode");
    if (stored) {
      setPasscode(stored);
      setUnlocked(true);
    }
    fetch("/api/bets").then((r) => r.json()).then((d) => setBets(d.bets || []));
    fetch("/api/mapping").then((r) => r.json()).then((d) => setMapping(d.mapping || EMPTY_MAPPING));
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

  function setTournamentId(tourn: string, pgaId: string) {
    setMapping((m) => ({
      ...m,
      tournaments: { ...m.tournaments, [tourn]: { pgaId } },
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
    <main style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/" className="admin-link">← back to board</Link>
      </div>
      <h1 style={{ marginBottom: 4 }}>Auto-sync setup</h1>
      <div className="subline" style={{ marginBottom: 20 }}>
        One number per tournament. Open the tournament's leaderboard on pgatour.com
        and copy the "Rxxxxxxx" segment from the URL - for example
        pgatour.com/tournaments/2026/isco-championship/<b>R2026518</b>/leaderboard.
      </div>

      {tournaments.map((tourn) => (
        <div key={tourn} className="card" style={{ marginBottom: 14 }}>
          <div className="player" style={{ marginBottom: 8 }}>{tourn}</div>
          <input
            placeholder="e.g. R2026518"
            value={mapping.tournaments[tourn]?.pgaId || ""}
            onChange={(e) => setTournamentId(tourn, e.target.value)}
            style={{
              width: "100%", background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
              color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
              padding: "8px 10px", borderRadius: 3,
            }}
          />
        </div>
      ))}

      <button className="add-btn-inline" onClick={saveMapping} style={{ width: "100%", padding: 10 }}>
        Save mapping
      </button>
      {saveMsg && <div className="subline" style={{ marginTop: 8 }}>{saveMsg}</div>}

      <div className="subline" style={{ marginTop: 24 }}>
        Currently auto-fills: round score, for bets like "-2 or better" or "E or worse."
        Greens/birdies/bogeys bets still need manual entry - that's next.
      </div>
    </main>
  );
}
