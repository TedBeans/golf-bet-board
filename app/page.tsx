"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bet } from "../lib/seed";
import { Mapping, EMPTY_MAPPING } from "../lib/mapping";
import { parseBetType, trend, timeToMinutes, friendlyLabel, formatScore, parseScoreInput } from "../lib/betLogic";

const SYNC_INTERVAL_MS = 60000;

// Fixed (not random) so it doesn't reshuffle on every re-render/sync tick.
const RAINDROPS = Array.from({ length: 18 }).map((_, i) => ({
  left: (i * 37) % 100,
  delay: (i * 0.41) % 2.2,
  duration: 0.7 + (i % 5) * 0.09,
}));

export default function Page() {
  const [bets, setBets] = useState<Bet[] | null>(null);
  const [passcode, setPasscode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [lockError, setLockError] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncNote, setSyncNote] = useState("");
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [mapping, setMapping] = useState<Mapping>(EMPTY_MAPPING);
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
        setLastSynced(new Date());
        loadBets();
        if (d.errors && d.errors.length > 0) {
          setSyncNote(`Auto-sync: ${d.errors[0]}`);
        } else {
          setSyncNote("");
        }
      })
      .catch(() => setSyncNote("Auto-sync unreachable"));
  }

  useEffect(() => {
    loadBets().then(() => runSync());
    fetch("/api/mapping").then((r) => r.json()).then((d) => setMapping(d.mapping || EMPTY_MAPPING));
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
        <div className="subline">
          Live tournament wager tracker
          {lastSynced && (
            <span className="last-synced"> · updated {lastSynced.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}</span>
          )}
        </div>
        <div className="summary">
          <div className="pill hit">WIN <b>{counts.hit || 0}</b></div>
          <div className="pill miss">LOSS <b>{counts.miss || 0}</b></div>
          <div className="pill live">LIVE <b>{counts.live || 0}</b></div>
          <div className="pill pending">TBD <b>{counts.pending || 0}</b></div>

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
            <Link href="/recap" className="admin-link">recap</Link>
          </div>
        </div>
        {lockError && <div className="lock-error">{lockError}</div>}
        {saving && <span className="saving">saving…</span>}
        {syncNote && <div className="sync-note">{syncNote}</div>}
      </header>

      <main>
        {bets.length === 0 && <div className="empty">No bets loaded.</div>}

        {Object.keys(groups).map((tourn) => {
          const tournBets = Object.values(groups[tourn]).flat();
          const tc = { hit: 0, miss: 0, live: 0, pending: 0 } as Record<string, number>;
          tournBets.forEach((b) => (tc[b.status] = (tc[b.status] || 0) + 1));
          const suspendType = mapping.tournaments[tourn]?.suspendedType || "none";
          const isSuspended = suspendType !== "none";
          return (
          <div className="tourn" key={tourn}>
            <div className="tourn-head">
              <div className="tourn-title-row">
                <h2>{tourn}</h2>
                {isSuspended && <span className="susp-badge">SUSP</span>}
              </div>
              <div className="tourn-summary">
                <span className="tsum win">WIN {tc.hit || 0}</span>
                <span className="tsum loss">LOSS {tc.miss || 0}</span>
                <span className="tsum live">LIVE {tc.live || 0}</span>
                <span className="tsum tbd">TBD {tc.pending || 0}</span>
              </div>
            </div>
            {isSuspended && (
              <div className={`suspend-overlay variant-${suspendType}`}>
                {suspendType === "fog" && (
                  <>
                    <div className="fog-sheet fs1" />
                    <div className="fog-sheet fs2" />
                    <div className="fog-sheet fs3" />
                    {RAINDROPS.map((d, i) => (
                      <div
                        key={i}
                        className="raindrop"
                        style={{ left: `${d.left}%`, animationDelay: `${d.delay}s`, animationDuration: `${d.duration}s` }}
                      />
                    ))}
                  </>
                )}
                {suspendType === "storm" && (
                  <>
                    <div className="storm-tint" />
                    {RAINDROPS.map((d, i) => (
                      <div
                        key={i}
                        className="raindrop"
                        style={{ left: `${d.left}%`, animationDelay: `${d.delay}s`, animationDuration: `${d.duration}s` }}
                      />
                    ))}
                    <div className="bolt-flash b1" />
                    <svg className="bolt-svg b1" viewBox="0 0 24 24" width="26" height="26">
                      <polygon points="13,1 5,13 11,13 9,23 19,10 12,10" fill="#EFEBE0" />
                    </svg>
                    <div className="bolt-flash b2" />
                    <svg className="bolt-svg b2" viewBox="0 0 24 24" width="20" height="20">
                      <polygon points="13,1 5,13 11,13 9,23 19,10 12,10" fill="#EFEBE0" />
                    </svg>
                  </>
                )}
                {suspendType === "dark" && (
                  <>
                    <div className="dusk-tint" />
                    <div className="moon-crescent" />
                    <div className="star" style={{ top: "20%", left: "18%" }} />
                    <div className="star" style={{ top: "38%", left: "78%" }} />
                    <div className="star" style={{ top: "58%", left: "42%" }} />
                    <div className="star" style={{ top: "16%", left: "58%" }} />
                  </>
                )}
              </div>
            )}
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
                            {b.oddsLine && (
                              <div className="odds-line">
                                {b.oddsLine} · DK {b.oddsPrice ?? "—"}
                              </div>
                            )}
                          </div>
                          <div className="status-btns">
                            {b.status === "pending" && <span className="tbd-badge">TBD</span>}
                            <button
                              disabled={!unlocked}
                              className={`sbtn win ${b.status === "hit" ? "active" : ""}`}
                              onClick={() => cycleStatus(b.id, "hit")}
                            >
                              WIN
                            </button>
                            <button
                              disabled={!unlocked}
                              className={`sbtn live ${b.status === "live" ? "active" : ""}`}
                              onClick={() => cycleStatus(b.id, "live")}
                            >
                              IN PROGRESS
                            </button>
                            <button
                              disabled={!unlocked}
                              className={`sbtn loss ${b.status === "miss" ? "active" : ""}`}
                              onClick={() => cycleStatus(b.id, "miss")}
                            >
                              LOSS
                            </button>
                          </div>
                        </div>

                        <div className="scorecard">
                          <div className="sc-cell">
                            <div className="sc-label">{friendlyLabel(parsed.label)}</div>
                            <div className="sc-target">{parsed.targetDisplay}</div>
                          </div>
                          <div className="sc-cell">
                            <div className="sc-label">{friendlyLabel(parsed.label)}</div>
                            {parsed.label === "SCORE" ? (
                              <input
                                disabled={!unlocked}
                                className={`sc-input trend-${cls}`}
                                type="text"
                                inputMode="numeric"
                                placeholder="—"
                                value={formatScore(b.stat, "")}
                                onChange={(e) => updateBetManually(b.id, { stat: parseScoreInput(e.target.value) })}
                              />
                            ) : (
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
                            )}
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
                              <span className={parsed.label === "SCORE" ? "detail-hi" : ""}>
                                Score {formatScore(b.auto.scoreToPar)}
                              </span>
                              {" · "}
                              <span className={parsed.label === "GIR" ? "detail-hi" : ""}>
                                Greens {b.auto.gir ?? "—"}
                              </span>
                              {" · "}
                              <span>Fairways {b.auto.fairways ?? "—"}</span>
                              {" · "}
                              <span className={parsed.label === "BIRDIES" ? "detail-hi" : ""}>
                                Birdies {b.auto.birdies ?? "—"}
                              </span>
                              {" · "}
                              <span className={parsed.label === "BOGEYS" ? "detail-hi" : ""}>
                                Bogeys {b.auto.bogeys ?? "—"}
                              </span>
                              {" · "}
                              <span>Pars {b.auto.pars ?? "—"}</span>
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
          );
        })}
      </main>
    </>
  );
}
