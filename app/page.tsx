"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bet } from "../lib/seed";
import { Mapping, EMPTY_MAPPING } from "../lib/mapping";
import { parseBetType, trend, smartTrend, trendClassName, timeToMinutes, friendlyLabel, formatScore, parseScoreInput } from "../lib/betLogic";
import { positionRank } from "../lib/positions";
import { Parlay, resolveLegStatuses, deriveParlayStatus } from "../lib/parlay";
import { computeUnitResult, formatUnits } from "../lib/units";
import HoleScorecardModal from "./HoleScorecardModal";
import GolfFlagIcon from "./GolfFlagIcon";
import UpcomingTournamentCard from "./UpcomingTournamentCard";

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
  const [saving, setSaving] = useState(false);
  const [syncNote, setSyncNote] = useState("");
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);
  const [mapping, setMapping] = useState<Mapping>(EMPTY_MAPPING);
  const [archive, setArchive] = useState<Bet[]>([]);
  const [liveParlays, setLiveParlays] = useState<Parlay[]>([]);
  const [scorecardModal, setScorecardModal] = useState<{ betId: string; player: string; loading: boolean; scorecard: any | null; message?: string } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openScorecard(betId: string, tourn: string, round: string, player: string) {
    if (scorecardModal?.betId === betId) {
      setScorecardModal(null);
      return;
    }
    setScorecardModal({ betId, player, loading: true, scorecard: null });
    fetch(`/api/scorecard?tournament=${encodeURIComponent(tourn)}&round=${encodeURIComponent(round)}&player=${encodeURIComponent(player)}`)
      .then((r) => r.json())
      .then((d) => {
        setScorecardModal({
          betId,
          player: d.player || player,
          loading: false,
          scorecard: d.scorecard || null,
          message: d.message || d.error,
        });
      })
      .catch(() => setScorecardModal({ betId, player, loading: false, scorecard: null, message: "Couldn't load scorecard." }));
  }

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

  function loadParlaysAndArchive() {
    fetch("/api/archive").then((r) => r.json()).then((d) => setArchive(d.archive || []));
    fetch("/api/parlays").then((r) => r.json()).then((d) => setLiveParlays(d.parlays || []));
  }

  useEffect(() => {
    loadBets().then(() => runSync());
    fetch("/api/mapping").then((r) => r.json()).then((d) => setMapping(d.mapping || EMPTY_MAPPING));
    loadParlaysAndArchive();
    const interval = setInterval(runSync, SYNC_INTERVAL_MS);
    const parlayInterval = setInterval(loadParlaysAndArchive, SYNC_INTERVAL_MS);
    const staleCheck = setInterval(() => setTick((t) => t + 1), 30000);

    const stored = typeof window !== "undefined" ? sessionStorage.getItem("bb_passcode") : null;
    if (stored) {
      setPasscode(stored);
      setUnlocked(true);
    }
    return () => {
      clearInterval(interval);
      clearInterval(parlayInterval);
      clearInterval(staleCheck);
    };
  }, []);

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

  const regularBets = bets.filter((b) => !b.personal);
  const personalBets = bets.filter((b) => b.personal);
  const regularParlays = liveParlays.filter((p) => !p.personal);
  const personalParlays = liveParlays.filter((p) => p.personal);

  const groups: Record<string, Record<string, Bet[]>> = {};
  regularBets.forEach((b) => {
    groups[b.t] = groups[b.t] || {};
    groups[b.t][b.r] = groups[b.t][b.r] || [];
    groups[b.t][b.r].push(b);
  });

  // Personal plays are tournament-long, not per-round, so they're grouped
  // by tournament only - never by b.r (which is always the same constant
  // "TedBeans Plays" label for every one of them, see lib/parsePersonal.ts).
  const personalGroups: Record<string, Bet[]> = {};
  personalBets.forEach((b) => {
    (personalGroups[b.t] = personalGroups[b.t] || []).push(b);
  });

  const tournamentOrder = Object.keys(groups).sort((a, b) => {
    const earliestA = Math.min(...Object.values(groups[a]).flat().map((bet) => timeToMinutes(bet.time)));
    const earliestB = Math.min(...Object.values(groups[b]).flat().map((bet) => timeToMinutes(bet.time)));
    return earliestA - earliestB;
  });

  return (
    <>
      <header>
        <div className="title-row">
          <h1>
            <GolfFlagIcon />Golf <span>Tracker</span>
          </h1>
          <div className="header-actions">
            {unlocked ? (
              <>
                <span className="unlocked">✓ unlocked</span>
                <Link href="/admin" className="recap-btn">Setup</Link>
              </>
            ) : (
              <Link href="/admin" className="tedbeans-btn">TedBeans</Link>
            )}
            <Link href="/recap" className="recap-btn">Recap/Archives</Link>
            <Link href="/analysis" className="recap-btn">Analysis</Link>
          </div>
        </div>
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
        </div>
        {saving && <span className="saving">saving…</span>}
        {syncNote && <div className="sync-note">{syncNote}</div>}
        {lastSynced && Date.now() - lastSynced.getTime() > 5 * 60 * 1000 && (
          <div className="stale-warning">
            ⚠ Auto-sync hasn't checked in for {Math.round((Date.now() - lastSynced.getTime()) / 60000)} min - stats may be stale.
          </div>
        )}
      </header>

      <main>
        {bets.length === 0 && (
          <>
            <div className="empty">No bets loaded. Upcoming events:</div>
            {Object.entries(mapping.tournaments)
              .filter(([, tm]) => tm.upcoming)
              .map(([name, tm]) => <UpcomingTournamentCard key={name} name={name} meta={tm} />)}
          </>
        )}

        {tournamentOrder.map((tourn) => {
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
                    const cls = trendClassName(parsed, b.stat, b.thru);
                    const isAuto = b.autoEnabled !== false;
                    return (
                      <div className={`card ${b.status}`} key={b.id}>
                        <div className="card-top">
                          <div className="who">
                            <div className="time">{b.time}</div>
                            <div style={{ position: "relative", display: "inline-block" }}>
                              <div
                                className="player"
                                style={{ cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted", textDecorationColor: "var(--cream-dim)" }}
                                onClick={() => openScorecard(b.id, tourn, b.r, b.player)}
                              >
                                {b.player}
                              </div>
                              {scorecardModal?.betId === b.id && (
                                <HoleScorecardModal
                                  player={scorecardModal.player}
                                  loading={scorecardModal.loading}
                                  scorecard={scorecardModal.scorecard}
                                  message={scorecardModal.message}
                                  onClose={() => setScorecardModal(null)}
                                />
                              )}
                            </div>
                            <div className="bet-text">{b.bet}</div>
                            {b.oddsLine && (
                              <div className="odds-line">
                                {b.oddsLine} · {b.sportsbook || "DK"} {b.oddsPrice ?? "—"}
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
                            <div className="sc-label">{friendlyLabel(parsed.label, parsed.segment)}</div>
                            <div className="sc-target">{parsed.targetDisplay}</div>
                          </div>
                          <div className="sc-cell">
                            <div className="sc-label">{friendlyLabel(parsed.label, parsed.segment)}</div>
                            {parsed.label === "SCORE" ? (
                              <input
                                disabled={!unlocked}
                                className={`sc-input ${cls}`}
                                type="text"
                                inputMode="numeric"
                                placeholder="—"
                                value={formatScore(b.stat, "")}
                                onChange={(e) => updateBetManually(b.id, { stat: parseScoreInput(e.target.value) })}
                              />
                            ) : (
                              <input
                                disabled={!unlocked}
                                className={`sc-input ${cls}`}
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
                          {b.auto && parsed.label === "WINNER_SCORE" && (
                            <span className="detail-strip">
                              <span className="detail-hi">
                                Leader {b.auto.leaderName ? `(${b.auto.leaderName}) ` : ""}{formatScore(b.auto.scoreToPar)}
                              </span>
                              {" · "}
                              <span>Thru {b.auto.thru ?? "—"}</span>
                            </span>
                          )}
                          {b.auto && parsed.label !== "WINNER_SCORE" && (
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

        {regularParlays.length > 0 && (
          <div className="tourn">
            <div className="tourn-head">
              <h2>Parlays</h2>
              <span className="subline" style={{ marginTop: 0, textTransform: "none", letterSpacing: 0 }}>
                Tracked separately from straight-bet units
              </span>
            </div>
            {regularParlays.map((p) => {
              const legStatuses = resolveLegStatuses(p.legs, bets, archive);
              const status = deriveParlayStatus(legStatuses);
              return (
                <div className={`card ${status}`} key={p.id}>
                  <div className="card-top">
                    <div className="who">
                      <div className="player">{p.label}</div>
                      <div className="bet-text">{p.oddsPrice} · {p.wagerUnits}u</div>
                    </div>
                    <span className={`sbtn ${status === "hit" ? "win active" : status === "miss" ? "loss active" : status === "live" ? "live active" : ""}`} style={{ cursor: "default" }}>
                      {status === "hit" ? "WIN" : status === "miss" ? "LOSS" : status === "live" ? "IN PROGRESS" : "TBD"}
                    </span>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    {legStatuses.map((ls, i) => {
                      if (ls.status === "live" && ls.bet) {
                        const legParsed = parseBetType(ls.bet.bet);
                        const legTrend = smartTrend(legParsed, ls.bet.stat, ls.bet.thru);
                        const valueDisplay = legParsed.label === "SCORE" || legParsed.label === "WINNER_SCORE"
                          ? formatScore(ls.bet.stat)
                          : ls.bet.stat ?? "—";
                        return (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                            <span style={{ color: "var(--cream-dim)" }}>{ls.leg.player} · {ls.leg.bet}</span>
                            <span className={`tsum ${legTrend === "good" ? "win" : legTrend === "bad" ? "loss" : legTrend === "warn" ? "live" : "tbd"}`}>
                              LIVE | {valueDisplay} thru {ls.bet.thru ?? "—"}
                            </span>
                          </div>
                        );
                      }
                      return (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                          <span style={{ color: "var(--cream-dim)" }}>{ls.leg.player} · {ls.leg.bet}</span>
                          <span className={
                            ls.status === "hit" ? "tsum win" : ls.status === "miss" ? "tsum loss" : "tsum tbd"
                          }>
                            {ls.status === "hit" ? "WIN" : ls.status === "miss" ? "LOSS" : "TBD"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {(personalBets.length > 0 || personalParlays.length > 0) && (
          <div className="tourn">
            <div className="tourn-head">
              <h2>TedBeans Plays</h2>
              <span className="subline" style={{ marginTop: 0, textTransform: "none", letterSpacing: 0 }}>
                Personal props - tracked separately from straight bets/parlays and excluded from the regular recaps
              </span>
            </div>

            {Object.keys(personalGroups).map((tourn) => (
              <div key={tourn}>
                <div className="round-label">{tourn}</div>
                {personalGroups[tourn].map((b) => {
                  const parsed = parseBetType(b.bet);
                  const posRank = positionRank(b.auto?.position ?? null);
                  const inTopN = parsed.label === "TOP_N" && parsed.topN !== undefined && posRank !== null && posRank <= parsed.topN;
                  const cutLine = mapping.tournaments[tourn]?.cutLine;
                  return (
                    <div className={`card ${b.status}`} key={b.id}>
                      <div className="card-top">
                        <div className="who">
                          <div style={{ position: "relative", display: "inline-block" }}>
                            <div
                              className="player"
                              style={{ cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted", textDecorationColor: "var(--cream-dim)" }}
                              onClick={() =>
                                openScorecard(
                                  b.id,
                                  tourn,
                                  parsed.h2hScope === "round" && parsed.h2hRoundNum ? `Round ${parsed.h2hRoundNum}` : b.r,
                                  b.player
                                )
                              }
                            >
                              {b.player}
                            </div>
                            {scorecardModal?.betId === b.id && (
                              <HoleScorecardModal
                                player={scorecardModal.player}
                                loading={scorecardModal.loading}
                                scorecard={scorecardModal.scorecard}
                                message={scorecardModal.message}
                                onClose={() => setScorecardModal(null)}
                              />
                            )}
                          </div>
                          <div className="bet-text">{b.bet}</div>
                          {b.oddsPrice && (
                            <div className="odds-line">{b.sportsbook || "DK"} {b.oddsPrice} · {b.oddsUnits}u</div>
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
                      <div className="auto-row">
                        <span className="detail-strip">
                          {parsed.label === "MAKE_CUT" ? (
                            <>
                              Round 1 {formatScore(b.auto?.scoreToPar ?? null)} thru {b.auto?.thru ?? "—"}
                              {" · "}
                              {cutLine !== undefined ? `Cut line ${formatScore(cutLine)}` : "cut line not set yet"}
                            </>
                          ) : parsed.label === "H2H" || parsed.label === "TIE" ? (
                            <>
                              {b.player} {formatScore(b.auto?.scoreToPar ?? null)} vs {parsed.h2hOpponent}{" "}
                              {formatScore(b.auto?.opponentScoreToPar ?? null)}
                              {" · "}thru {b.auto?.thru ?? "—"}/{b.auto?.opponentThru ?? "—"}
                            </>
                          ) : (
                            <>
                              <span className={inTopN ? "detail-hi" : ""}>
                                Position {b.auto?.position ?? "—"} ({formatScore(b.auto?.scoreToPar ?? null)})
                              </span>
                              {" · "}thru {b.auto?.thru ?? "—"}
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {personalParlays.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div className="round-label">Parlays</div>
                {personalParlays.map((p) => {
                  const legStatuses = resolveLegStatuses(p.legs, bets, archive);
                  const status = deriveParlayStatus(legStatuses);
                  return (
                    <div className={`card ${status}`} key={p.id}>
                      <div className="card-top">
                        <div className="who">
                          <div className="player">{p.label}</div>
                          <div className="bet-text">{p.oddsPrice} · {p.wagerUnits}u</div>
                        </div>
                        <span className={`sbtn ${status === "hit" ? "win active" : status === "miss" ? "loss active" : status === "live" ? "live active" : ""}`} style={{ cursor: "default" }}>
                          {status === "hit" ? "WIN" : status === "miss" ? "LOSS" : status === "live" ? "IN PROGRESS" : "TBD"}
                        </span>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        {legStatuses.map((ls, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                            <span style={{ color: "var(--cream-dim)" }}>{ls.leg.player} · {ls.leg.bet}</span>
                            <span className={
                              ls.status === "hit" ? "tsum win" : ls.status === "miss" ? "tsum loss" : ls.status === "live" ? "tsum live" : "tsum tbd"
                            }>
                              {ls.status === "hit" ? "WIN" : ls.status === "miss" ? "LOSS" : ls.status === "live" ? "LIVE" : "TBD"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
