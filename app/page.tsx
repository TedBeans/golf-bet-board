"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bet } from "../lib/seed";
import { Mapping, EMPTY_MAPPING } from "../lib/mapping";
import { parseBetType, trend, smartTrend, trendClassName, timeToMinutes, friendlyLabel, formatScore, parseScoreInput, matchPlayStatus } from "../lib/betLogic";
import { positionRank } from "../lib/positions";
import { sortByPersonalOrder } from "../lib/personalOrder";
import { Parlay, ParlayLegRef, LegStatus, resolveLegStatuses, deriveParlayStatus } from "../lib/parlay";
import { computeUnitResult, formatUnits } from "../lib/units";
import HoleScorecardModal from "./HoleScorecardModal";
import GolfFlagIcon from "./GolfFlagIcon";
import UpcomingTournamentCard from "./UpcomingTournamentCard";
import WeatherStrip from "./WeatherStrip";
import CourseHistoryTable from "./CourseHistoryTable";


const SYNC_INTERVAL_MS = 60000;

// Fixed (not random) so it doesn't reshuffle on every re-render/sync tick.
const RAINDROPS = Array.from({ length: 18 }).map((_, i) => ({
  left: (i * 37) % 100,
  delay: (i * 0.41) % 2.2,
  duration: 0.7 + (i % 5) * 0.09,
}));

// A parlay leg's live status line - what shows next to the player/bet text
// while it's still in progress. Personal bet types get their own framing
// (position for Top N/Winner, match-play up/down/All Square for H2H/Tie);
// everything else falls back to the existing value-and-thru display.
function legLiveDetail(bet: Bet): string {
  const p = parseBetType(bet.bet);
  if (p.label === "TOP_N" || p.label === "WINNER") {
    return `${bet.auto?.position ?? "—"} thru ${bet.auto?.thru ?? "—"}`;
  }
  if (p.label === "MAKE_CUT") {
    const rd = bet.auto?.currentRound;
    return `${bet.auto?.position ?? "—"} · ${formatScore(bet.auto?.scoreToPar ?? null)} thru ${bet.auto?.thru ?? "—"}${rd ? ` (R${rd})` : ""}`;
  }
  if (p.label === "H2H" || p.label === "TIE") {
    const subjectThru = bet.auto?.thru ?? null;
    const opponentThru = bet.auto?.opponentThru ?? null;
    const thru = subjectThru !== null && opponentThru !== null
      ? Math.min(subjectThru, opponentThru)
      : subjectThru ?? opponentThru ?? null;
    return `${matchPlayStatus(bet.auto?.scoreToPar ?? null, bet.auto?.opponentScoreToPar ?? null)} thru ${thru ?? "—"}`;
  }
  const valueDisplay = p.label === "SCORE" || p.label === "WINNER_SCORE" ? formatScore(bet.stat) : bet.stat ?? "—";
  return `${valueDisplay} thru ${bet.thru ?? "—"}`;
}

// DataGolf make-cut % for a MAKE_CUT leg, rendered as its own column in the
// middle of the leg row (previously tacked onto the end of legLiveDetail,
// which left it stranded off in the far-right badge with a lot of dead
// space between the player name and the badge).
function legDgDetail(bet: Bet): string | null {
  const p = parseBetType(bet.bet);
  if (p.label !== "MAKE_CUT") return null;
  const dg = bet.auto?.dgCutProb;
  return dg !== null && dg !== undefined ? `${dg}%` : null;
}

// Badge color for a live personal leg - directional (currently ahead/tied/
// behind), not a final result. Non-personal legs keep using the existing
// smartTrend-driven coloring at the call site, which already handles
// SCORE/GIR/BIRDIES/etc correctly.
function legStatusClass(bet: Bet): "win" | "loss" | "live" {
  const p = parseBetType(bet.bet);
  if (p.label === "TOP_N" && p.topN !== undefined) {
    const rank = positionRank(bet.auto?.position ?? null);
    return rank !== null && rank <= p.topN ? "win" : "live";
  }
  if (p.label === "WINNER") {
    return bet.auto?.position === "1" ? "win" : "live";
  }
  if (p.label === "H2H") {
    const s = bet.auto?.scoreToPar ?? null;
    const o = bet.auto?.opponentScoreToPar ?? null;
    if (s === null || o === null) return "live";
    return s < o ? "win" : s > o ? "loss" : "live";
  }
  if (p.label === "TIE") {
    const s = bet.auto?.scoreToPar ?? null;
    const o = bet.auto?.opponentScoreToPar ?? null;
    if (s === null || o === null) return "live";
    return s === o ? "win" : "loss";
  }
  return "live";
}

// One leg row, shared between the regular Parlays section and the TedBeans
// Plays parlays sub-section - both need identical live-status rendering.
type ScorecardModalState = { betId: string; tournament: string; round: string; player: string; loading: boolean; scorecard: any | null; position?: string | null; totalToPar?: number | null; message?: string } | null;

function LegRow({
  ls,
  parlayId,
  openScorecard,
  scorecardModal,
  setScorecardModal,
}: {
  ls: LegStatus;
  parlayId: string;
  openScorecard: (betId: string, tourn: string, round: string, player: string) => void;
  scorecardModal: ScorecardModalState;
  setScorecardModal: (v: ScorecardModalState) => void;
}) {
  // H2H/Tie legs know their own scope from the bet phrase itself - for a
  // round-scoped matchup, that's more useful to click into than the leg's
  // stored round label (which for a personal play is always the constant
  // "TedBeans Plays" bucket, not a real round).
  //
  // Personal MAKE_CUT bets are similar but tracked differently: bet.r stays
  // on that same constant (it doubles as a grouping/archiving key elsewhere
  // - see admin's archived-rounds view - so it's deliberately never
  // overwritten), but sync now stamps the round that's actually live onto
  // bet.auto.currentRound. Without this, clicking a name always opened
  // Round 1's scorecard even once Round 2 was underway.
  const parsedLegBet = parseBetType(ls.leg.bet);
  const round =
    parsedLegBet.h2hScope === "round" && parsedLegBet.h2hRoundNum
      ? `Round ${parsedLegBet.h2hRoundNum}`
      : parsedLegBet.label === "MAKE_CUT" && ls.bet?.auto?.currentRound
      ? `Round ${ls.bet.auto.currentRound}`
      : ls.leg.round;

  // The same underlying bet can be a leg in more than one parlay (e.g. a
  // Tournament H2H bet included in both a 2-way and a 7-way matchup
  // parlay) - keying the popover on betId alone meant clicking one
  // instance opened every instance of that same leg at once. Scoping the
  // key to this specific parlay+leg+role keeps each clickable name
  // independent, even when the underlying bet repeats elsewhere.
  const subjectKey = `${parlayId}:${ls.leg.betId}:subject`;
  const isSubjectOpen = scorecardModal?.betId === subjectKey;

  const subjectSpan = (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span
        style={{ cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted", textDecorationColor: "var(--cream-dim)" }}
        onClick={() => openScorecard(subjectKey, ls.leg.tournament, round, ls.leg.player)}
      >
        {ls.leg.player}
      </span>
      {isSubjectOpen && scorecardModal && (
        <HoleScorecardModal
          player={scorecardModal.player}
          tournament={scorecardModal.tournament}
          initialRound={scorecardModal.round}
          loading={scorecardModal.loading}
          scorecard={scorecardModal.scorecard}
          position={scorecardModal.position}
          totalToPar={scorecardModal.totalToPar}
          message={scorecardModal.message}
          onClose={() => setScorecardModal(null)}
        />
      )}
    </span>
  );

  // For H2H/Tie legs, rebuild the bet phrase from its parsed pieces so the
  // opponent's name can be its own clickable span too, rather than being
  // stuck inside a single plain-text string.
  let betPhraseNode: React.ReactNode = ls.leg.bet;
  if ((parsedLegBet.label === "H2H" || parsedLegBet.label === "TIE") && parsedLegBet.h2hOpponent) {
    const verb = parsedLegBet.label === "H2H" ? "H2H vs" : "Tie vs";
    const scopeText = parsedLegBet.h2hScope === "round" ? `(Round ${parsedLegBet.h2hRoundNum})` : "(Tournament)";
    const opponentName = parsedLegBet.h2hOpponent;
    const opponentKey = `${parlayId}:${ls.leg.betId}:opponent`;
    const isOpponentOpen = scorecardModal?.betId === opponentKey;

    const opponentSpan = (
      <span style={{ position: "relative", display: "inline-block" }}>
        <span
          style={{ cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted", textDecorationColor: "var(--cream-dim)" }}
          onClick={() => openScorecard(opponentKey, ls.leg.tournament, round, opponentName)}
        >
          {opponentName}
        </span>
        {isOpponentOpen && scorecardModal && (
          <HoleScorecardModal
            player={scorecardModal.player}
            tournament={scorecardModal.tournament}
            initialRound={scorecardModal.round}
            loading={scorecardModal.loading}
            scorecard={scorecardModal.scorecard}
            position={scorecardModal.position}
            totalToPar={scorecardModal.totalToPar}
            message={scorecardModal.message}
            onClose={() => setScorecardModal(null)}
          />
        )}
      </span>
    );

    betPhraseNode = (
      <>
        {verb} {opponentSpan} {scopeText}
      </>
    );
  }

  if (ls.status === "live" && ls.bet) {
    const badgeClass = ls.bet.personal
      ? legStatusClass(ls.bet)
      : (() => {
          const t = smartTrend(parseBetType(ls.bet!.bet), ls.bet!.stat, ls.bet!.thru);
          return t === "good" ? "win" : t === "bad" ? "loss" : t === "warn" ? "live" : "tbd";
        })();
    const dgDetail = legDgDetail(ls.bet);
    const dgValue = ls.bet.auto?.dgCutProb;
    return (
      <div className={`leg-row ${dgDetail ? "" : "no-dg"}`}>
        <span className="leg-name">{subjectSpan} · {betPhraseNode}</span>
        {dgDetail && (
          <span className="leg-dg" style={{ color: dgValue !== null && dgValue !== undefined ? dgColor(dgValue) : "var(--cream-dim)" }}>{dgDetail}</span>
        )}
        <span className={`leg-badge tsum ${badgeClass}`}>
          LIVE | {legLiveDetail(ls.bet)}
        </span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
      <span style={{ color: "var(--cream-dim)" }}>{subjectSpan} · {betPhraseNode}</span>
      <span className={ls.status === "hit" ? "tsum win" : ls.status === "miss" ? "tsum loss" : "tsum tbd"}>
        {ls.status === "hit" ? "WIN" : ls.status === "miss" ? "LOSS" : "TBD"}
      </span>
    </div>
  );
}

// Red (0%) -> yellow (50%) -> green (100%) interpolation for DataGolf
// make-cut %, reusing the same three colors already used for
// loss/live/win badges elsewhere so it reads consistently with the rest
// of the board's palette.
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function dgColor(pct: number): string {
  const CLAY: [number, number, number] = [192, 106, 76]; // var(--clay), 0%
  const GOLD: [number, number, number] = [228, 190, 74]; // var(--gold-bright), 50%
  const LIVE: [number, number, number] = [76, 175, 110]; // var(--live), 100%
  const p = Math.max(0, Math.min(100, pct)) / 100;
  const [c1, c2, t] = p <= 0.5 ? [CLAY, GOLD, p / 0.5] : [GOLD, LIVE, (p - 0.5) / 0.5];
  const r = Math.round(lerp(c1[0], c2[0], t as number));
  const g = Math.round(lerp(c1[1], c2[1], t as number));
  const b = Math.round(lerp(c1[2], c2[2], t as number));
  return `rgb(${r}, ${g}, ${b})`;
}

function parlayHasMakeCutLeg(p: Parlay): boolean {
  return p.legs.some((leg) => parseBetType(leg.bet).label === "MAKE_CUT");
}

// Aggregate cutline distribution (DataGolf's "odds the cutline lands at
// +1/+2/+3...") shown once at the top of a Make Cut parlay card - numbers
// and percentages only, no player names (that's covered per-leg already
// via legDgDetail).
function CutlineStrip({ probs }: { probs: { score: number; prob: number }[] }) {
  if (probs.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 20,
        margin: "4px 0 12px",
        padding: "8px 12px",
        border: "1px solid rgba(228,190,74,0.25)",
        borderRadius: 6,
        background: "rgba(228,190,74,0.06)",
      }}
    >
      <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--cream-dim)" }}>Cutline</span>
      {probs.map((c) => (
        <span key={c.score} style={{ fontSize: 14, fontWeight: 700, color: "var(--gold-bright)" }}>
          {formatScore(c.score)} <span>{c.prob}%</span>
        </span>
      ))}
    </div>
  );
}

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
  const [expandedWeather, setExpandedWeather] = useState<Set<string>>(new Set());
  const [cutlineProbs, setCutlineProbs] = useState<{ score: number; prob: number }[]>([]);
  const [scorecardModal, setScorecardModal] = useState<{ betId: string; tournament: string; round: string; player: string; loading: boolean; scorecard: any | null; position?: string | null; totalToPar?: number | null; message?: string } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openScorecard(betId: string, tourn: string, round: string, player: string) {
    if (scorecardModal?.betId === betId) {
      setScorecardModal(null);
      return;
    }
    setScorecardModal({ betId, tournament: tourn, round, player, loading: true, scorecard: null });
    fetch(`/api/scorecard?tournament=${encodeURIComponent(tourn)}&round=${encodeURIComponent(round)}&player=${encodeURIComponent(player)}`)
      .then((r) => r.json())
      .then((d) => {
        setScorecardModal({
          betId,
          tournament: tourn,
          round,
          player: d.player || player,
          loading: false,
          scorecard: d.scorecard || null,
          position: d.position ?? null,
          totalToPar: d.totalToPar ?? null,
          message: d.message || d.error,
        });
      })
      .catch(() => setScorecardModal({ betId, tournament: tourn, round, player, loading: false, scorecard: null, message: "Couldn't load scorecard." }));
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
    fetch("/api/parlays").then((r) => r.json()).then((d) => {
      setLiveParlays(d.parlays || []);
      setCutlineProbs(d.cutlineProbs || []);
    });
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
    const newStatus = b.status === target ? "pending" : target;
    const patch: Partial<Bet> = { status: newStatus };
    // See lib/seed.ts's personalManualLive comment - without this, a
    // manual click on a personal play (with no regular bet loaded yet for
    // that tournament) gets silently reverted by sync's demotion logic
    // within the next ~45s-1min.
    if (b.personal) patch.personalManualLive = newStatus !== "pending";
    updateBet(id, patch);
  }

  if (bets === null) {
    return (
      <main>
        <div className="loading">Loading board…</div>
      </main>
    );
  }

  const counts = { hit: 0, miss: 0, live: 0, pending: 0 } as Record<string, number>;
  // TedBeans plays are tracked in their own section with their own
  // win/loss framing - they never factor into this top-level summary,
  // same as they're already excluded from the regular recaps.
  bets.filter((b) => !b.personal).forEach((b) => (counts[b.status] = (counts[b.status] || 0) + 1));

  const regularBets = bets.filter((b) => !b.personal);
  // hidden is an admin-only display toggle - the bet still exists, still
  // syncs, and still works as a parlay leg (see LegRow/legLiveDetail above,
  // which pull straight from bets/archive regardless of hidden), it's just
  // suppressed from this standalone straight-bets list.
  const personalBets = sortByPersonalOrder(bets.filter((b) => b.personal && !b.hidden));
  const regularParlays = liveParlays.filter((p) => !p.personal);
  const personalParlays = sortByPersonalOrder(liveParlays.filter((p) => p.personal));

  const groups: Record<string, Record<string, Bet[]>> = {};
  regularBets.forEach((b) => {
    groups[b.t] = groups[b.t] || {};
    groups[b.t][b.r] = groups[b.t][b.r] || [];
    groups[b.t][b.r].push(b);
  });

  // Personal plays are tournament-long, not per-round, so they're grouped
  // by tournament only - never by b.r (which is always the same constant
  // "TedBeans Plays" label for every one of them, see lib/parsePersonal.ts).
  // personalBets is already sorted by drag-and-drop order above, and
  // Object.keys/array push both preserve insertion order, so each group
  // comes out already in the right display order too.
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
        {regularBets.length === 0 && (
          <>
            <div className="empty">
              {bets.length === 0 ? "No bets loaded. Upcoming events:" : "No official round bets loaded yet. Upcoming events:"}
            </div>
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
          const tm = mapping.tournaments[tourn];
          const hasCoords = tm?.latitude !== undefined && tm?.longitude !== undefined;
          const hasCourseHistory = !!tm; // CourseHistoryTable renders null if no data for this tournament
          const showWeatherSection = hasCoords || hasCourseHistory;
          const weatherOpen = expandedWeather.has(tourn);
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
            {showWeatherSection && (
              <div style={{ marginBottom: 10 }}>
                <span
                  className="subline"
                  style={{ cursor: "pointer", display: "inline-block" }}
                  onClick={() =>
                    setExpandedWeather((prev) => {
                      const next = new Set(prev);
                      if (next.has(tourn)) next.delete(tourn);
                      else next.add(tourn);
                      return next;
                    })
                  }
                >
                  Weather + Course History {weatherOpen ? "▾" : "▸"}
                </span>
                {weatherOpen && (
                  <div style={{ marginTop: 8 }}>
                    {hasCoords && (
                      <WeatherStrip
                        latitude={tm!.latitude}
                        longitude={tm!.longitude}
                        startDate={tm!.startDate}
                        endDate={tm!.endDate}
                        compact
                      />
                    )}
                    <CourseHistoryTable tournamentName={tourn} />
                  </div>
                )}
              </div>
            )}
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
                            <div className="time">{b.time || "Tee time TBD"}</div>
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
                                  tournament={scorecardModal.tournament}
                                  initialRound={scorecardModal.round}
                                  loading={scorecardModal.loading}
                                  scorecard={scorecardModal.scorecard}
                                  position={scorecardModal.position}
                                  totalToPar={scorecardModal.totalToPar}
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
                                type="text"
                                inputMode="numeric"
                                placeholder="—"
                                value={b.stat === null || b.stat === undefined ? "" : String(b.stat)}
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
                              type="text"
                              inputMode="numeric"
                              placeholder="—"
                              value={b.thru === null || b.thru === undefined ? "" : String(b.thru)}
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
                              <span>Eagles {b.auto.eagles ?? "—"}</span>
                              {" · "}
                              <span className={parsed.label === "BOGEYS" ? "detail-hi" : ""}>
                                Bogeys {b.auto.bogeys ?? "—"}
                              </span>
                              {" · "}
                              <span>Doubles+ {b.auto.doubleBogeys ?? "—"}</span>
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
                    {parlayHasMakeCutLeg(p) && <CutlineStrip probs={cutlineProbs} />}
                    {legStatuses.map((ls, i) => (
                      <LegRow key={i} ls={ls} parlayId={p.id} openScorecard={openScorecard} scorecardModal={scorecardModal} setScorecardModal={setScorecardModal} />
                    ))}
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
                                  parsed.h2hScope === "round" && parsed.h2hRoundNum
                                    ? `Round ${parsed.h2hRoundNum}`
                                    : parsed.label === "MAKE_CUT" && b.auto?.currentRound
                                    ? `Round ${b.auto.currentRound}`
                                    : b.r,
                                  b.player
                                )
                              }
                            >
                              {b.player}
                            </div>
                            {scorecardModal?.betId === b.id && (
                              <HoleScorecardModal
                                player={scorecardModal.player}
                                tournament={scorecardModal.tournament}
                                initialRound={scorecardModal.round}
                                loading={scorecardModal.loading}
                                scorecard={scorecardModal.scorecard}
                                position={scorecardModal.position}
                                totalToPar={scorecardModal.totalToPar}
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
                              Position {b.auto?.position ?? "—"} · Round {b.auto?.currentRound ?? 1} {formatScore(b.auto?.scoreToPar ?? null)} thru {b.auto?.thru ?? "—"}
                              {" · "}
                              {cutLine !== undefined ? `Cut line ${formatScore(cutLine)}` : "cut line not set yet"}
                              {b.auto?.dgCutProb !== null && b.auto?.dgCutProb !== undefined && (
                                <>{" · "}DataGolf {b.auto.dgCutProb}% to make cut</>
                              )}
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
                        {parlayHasMakeCutLeg(p) && <CutlineStrip probs={cutlineProbs} />}
                        {legStatuses.map((ls, i) => (
                          <LegRow key={i} ls={ls} parlayId={p.id} openScorecard={openScorecard} scorecardModal={scorecardModal} setScorecardModal={setScorecardModal} />
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
