"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bet } from "../lib/seed";
import { parseBetType, trend, timeToMinutes } from "../lib/betLogic";

const SYNC_INTERVAL_MS = 60000;

export default function Page() {
  const [bets, setBets] = useState<Bet[] | null>(null);
  const [passcode, setPasscode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [lockError, setLockError] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncNote, setSyncNote] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function loadBets() {
    return fetch("/api/bets")
      .then((r) => r.json())
      .then((d) => setBets(d.bets))
      .catch(() => {});
  }

  function runSync() {
    fetch("/api/sync")
      .then((r) => r.json())
      .then((d) => {
        if (d.updated > 0) loadBets();
        if (d.errors && d.errors.length > 0) {
          setSyncNote(`Auto-sync: ${d.errors[0]}`);
        } else if (d.updated > 0) {
          setSyncNote("");
        }
      })
      .catch(() => setSyncNote("Auto-sync unreachable"));
  }

  useEffect(() => {
    loadBets().then(() => runSync());
    const interval = setInterval(runSync, SYNC_INTERVAL_MS);

    const stored = typeof window !== "undefined" ? sessionStorage.getItem("bb_passcode") : null;
    if (stored) {
      setPasscode(stored);
      setUnlocked(true);
    }
    return () => clearInterval(interval);
  }, []);

  function tryUnlock() {
    setLockError("");
    fetch("/api/bets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode, bets: bets || [] }),
    })
      .then(async (r) => {
        if (r.ok) {
          setUnlocked(true);
          sessionStorage.setItem("bb_passcode", passcode);
        } else {
          setLockError("Wrong passcode");
        }
      })
      .catch(() => setLockError("Couldn't reach server"));
  }

  function persist(next: Bet[]) {
    setBets(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(() => {
      fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode, bets: next }),
      }).finally(() => setSaving(false));
    }, 400);
  }

  function updateBet(id: string, patch: Partial<Bet>) {
    if (!bets) return;
    persist(bets.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  // Manually editing a stat/thru value locks that bet out of auto-sync,
  // so the next sync tick won't stomp on what was just typed.
  function updateBetManually(id: string, patch: Partial<Bet>) {
    updateBet(id, { ...patch, autoEnabled: false });
  }

  function resumeAuto(id: string) {
    updateBet(id, { autoEnabled: true });
  }

  function cycleStatus(id: string, target: Bet["status"]) {
    if (!bets) return;
    const b = bets.find((x) => x.id === id);
    if (!b) return;
    updateBet(id, { status: b.status === target ? "pending" : target });
  }

  if (bets === null) {
    return (
      <main>
        <div className="loading">Loading board…</div>
      </main>
    );
  }

  const counts = { hit: 0, miss: 0, live: 0, pending: 0 } as Record<string, number>;
  bets.forEach((b) => (counts[b.status] = (counts[b.status] || 0) + 1));

  const groups: Record<string, Record<string, Bet[]>> = {};
  bets.forEach((b) => {
    groups[b.t] = groups[b.t] || {};
    groups[b.t][b.r] = groups[b.t][b.r] || [];
    groups[b.t][b.r].push(b);
  });

  return (
    <>
      <header>
        <h1>
          Bet <span>Board</span>
        </h1>
        <div className="subline">Live tournament wager tracker</div>
        <div className="summary">
          <div className="pill hit">✅ <b>{counts.hit || 0}</b></div>
          <div className="pill miss">❌ <b>{counts.miss || 0}</b></div>
          <div className="pill live">⛳ <b>{counts.live || 0}</b></div>
          <div className="pill pending">⏳ <b>{counts.pending || 0}</b></div>

          <div className="lock">
            {unlocked ? (
              <>
                <span className="unlocked">✓ editing unlocked</span>
                <Link href="/admin" className="admin-link">auto-sync setup</Link>
              </>
            ) : (
              <>
                <input
                  type="password"
                  placeholder="passcode"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && tryUnlock()}
                />
                <button onClick={tryUnlock}>Unlock</button>
              </>
            )}
          </div>
        </div>
        {lockError && <div className="lock-error">{lockError}</div>}
        {saving && <span className="saving">saving…</span>}
        {syncNote && <div className="sync-note">{syncNote}</div>}
      </header>

      <main>
        {bets.length === 0 && <div className="empty">No bets loaded.</div>}

        {Object.keys(groups).map((tourn) => (
          <div className="tourn" key={tourn}>
            <div className="tourn-head">
              <h2>{tourn}</h2>
            </div>
            {Object.keys(groups[tourn]).map((round) => {
              const items = groups[tourn][round]
                .slice()
                .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
              return (
                <div key={round}>
                  <div className="round-label">{round}</div>
                  {items.map((b) => {
                    const parsed = parseBetType(b.bet);
                    const cls = trend(parsed, b.stat, b.thru);
                    const isAuto = b.autoEnabled !== false;
                    return (
                      <div className={`card ${b.status}`} key={b.id}>
                        <div className="card-top">
                          <div className="who">
                            <div className="time">{b.time}</div>
                            <div className="player">{b.player}</div>
                            <div className="bet-text">{b.bet}</div>
                          </div>
                          <div className="status-btns">
                            <button
                              disabled={!unlocked}
                              className={`sbtn ${b.status === "hit" ? "active hit" : ""}`}
                              onClick={() => cycleStatus(b.id, "hit")}
                              title="Hit"
                            >
                              ✅
                            </button>
                            <button
                              disabled={!unlocked}
                              className={`sbtn ${b.status === "live" ? "active live" : ""}`}
                              onClick={() => cycleStatus(b.id, "live")}
                              title="Live"
                            >
                              ⛳
                            </button>
                            <button
                              disabled={!unlocked}
                              className={`sbtn ${b.status === "miss" ? "active miss" : ""}`}
                              onClick={() => cycleStatus(b.id, "miss")}
                              title="Miss"
                            >
                              ❌
                            </button>
                          </div>
                        </div>

                        <div className="scorecard">
                          <div className="sc-cell">
                            <div className="sc-label">{parsed.label}</div>
                            <div className="sc-target">{parsed.targetDisplay}</div>
                          </div>
                          <div className="sc-cell">
                            <div className="sc-label">Stat</div>
                            <input
                              disabled={!unlocked}
                              className={`sc-input trend-${cls}`}
                              type="number"
                              step="1"
                              placeholder="—"
                              value={b.stat === null || b.stat === undefined ? "" : b.stat}
                              onChange={(e) =>
                                updateBetManually(b.id, {
                                  stat: e.target.value === "" ? null : parseFloat(e.target.value),
                                })
                              }
                            />
                          </div>
                          <div className="sc-cell">
                            <div className="sc-label">Thru</div>
                            <input
                              disabled={!unlocked}
                              className="sc-input thru-input"
                              type="number"
                              min={0}
                              max={18}
                              step="1"
                              placeholder="—"
                              value={b.thru === null || b.thru === undefined ? "" : b.thru}
                              onChange={(e) =>
                                updateBetManually(b.id, {
                                  thru: e.target.value === "" ? null : parseInt(e.target.value, 10),
                                })
                              }
                            />
                          </div>
                        </div>

                        <div className="auto-row">
                          <span className={`auto-badge ${isAuto ? "on" : "off"}`}>
                            {isAuto ? "● AUTO" : "○ MANUAL"}
                          </span>
                          {unlocked && !isAuto && (
                            <button className="resume-btn" onClick={() => resumeAuto(b.id)}>
                              Resume auto
                            </button>
                          )}
                          {b.auto && (
                            <span className="detail-strip">
                              Rd {b.auto.scoreToPar !== null ? (b.auto.scoreToPar > 0 ? `+${b.auto.scoreToPar}` : b.auto.scoreToPar) : "—"}
                              {" · "}GIR {b.auto.gir ?? "—"}
                              {" · "}FW {b.auto.fairways ?? "—"}
                              {" · "}B{b.auto.birdies ?? "—"}
                              {" Bo"}{b.auto.bogeys ?? "—"}
                              {" P"}{b.auto.pars ?? "—"}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </main>
    </>
  );
}
