"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bet } from "../../lib/seed";
import { Mapping, EMPTY_MAPPING } from "../../lib/mapping";
import { parseBetsText, ParseResult } from "../../lib/parseBets";

export default function AdminPage() {
  const [passcode, setPasscode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [lockError, setLockError] = useState("");
  const [bets, setBets] = useState<Bet[]>([]);
  const [mapping, setMapping] = useState<Mapping>(EMPTY_MAPPING);
  const [saveMsg, setSaveMsg] = useState("");

  const [importText, setImportText] = useState("");
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [importMsg, setImportMsg] = useState("");

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

  function previewImport() {
    setImportMsg("");
    setPreview(parseBetsText(importText));
  }

  function confirmImport() {
    if (!preview || preview.bets.length === 0) return;
    fetch("/api/bets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode, bets: preview.bets }),
    }).then((r) => {
      if (r.ok) {
        setImportMsg(`Board replaced with ${preview.bets.length} bets.`);
        setBets(preview.bets);
        setPreview(null);
        setImportText("");
      } else {
        setImportMsg("Failed to save - check passcode.");
      }
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

      <h1 style={{ marginBottom: 4 }}>Load tonight's bets</h1>
      <div className="subline" style={{ marginBottom: 12 }}>
        Paste the nightly list in the usual format - a tournament header line,
        a "Round N:" line, then one "TIME Player Name bet type:" line per bet.
        This replaces the entire board.
      </div>
      <textarea
        value={importText}
        onChange={(e) => setImportText(e.target.value)}
        placeholder={"ISCO Championship:\nRound 3:\n11:00 AM Jackson Koivun -2 or better:\n..."}
        rows={10}
        style={{
          width: "100%", background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
          color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 12,
          padding: "10px", borderRadius: 4, marginBottom: 8, resize: "vertical",
        }}
      />
      <button className="add-btn-inline" onClick={previewImport} style={{ marginRight: 8 }}>
        Preview
      </button>

      {preview && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="player" style={{ marginBottom: 8 }}>
            {preview.bets.length} bet{preview.bets.length === 1 ? "" : "s"} parsed
          </div>
          {preview.bets.map((b) => (
            <div key={b.id} className="bet-text" style={{ marginBottom: 4 }}>
              {b.t} · {b.r} · {b.time} · <b style={{ color: "var(--cream)" }}>{b.player}</b> · {b.bet}
            </div>
          ))}
          {preview.warnings.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {preview.warnings.map((w, i) => (
                <div key={i} className="lock-error" style={{ marginBottom: 4 }}>{w}</div>
              ))}
            </div>
          )}
          <button
            className="add-btn-inline"
            onClick={confirmImport}
            disabled={preview.bets.length === 0}
            style={{ marginTop: 12, width: "100%", padding: 10 }}
          >
            Replace board with these {preview.bets.length} bets
          </button>
        </div>
      )}
      {importMsg && <div className="subline" style={{ marginTop: 8 }}>{importMsg}</div>}

      <h1 style={{ marginTop: 36, marginBottom: 4 }}>Auto-sync setup</h1>
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

      <div className="subline" style={{ marginTop: 24, marginBottom: 40 }}>
        Auto-fills round score, GIR, birdies, and bogeys for every bet on the
        board, matched to players by name. Edit any stat by hand and it locks
        that bet out of auto-sync until you hit "Resume auto" on it.
      </div>
    </main>
  );
}

