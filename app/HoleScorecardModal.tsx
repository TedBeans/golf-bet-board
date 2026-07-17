"use client";

import { useEffect, useState } from "react";

type Hole = { hole: number; par: number; score: number | null; status?: string | null };
type Scorecard = { firstNine: Hole[]; firstNineLabel: string; secondNine: Hole[]; secondNineLabel: string };

function symbolClass(h: Hole): string {
  if (h.score === null || !h.status) return "par";
  switch (h.status) {
    case "EAGLE":
    case "ALBATROSS":
      return "eagle";
    case "BIRDIE":
      return "birdie";
    case "BOGEY":
      return "bogey";
    case "DOUBLE_BOGEY":
    case "TRIPLE_BOGEY":
    case "OTHER":
      return "double";
    default:
      return "par";
  }
}

// Same to-par formatting used everywhere else on the board ("E" for even,
// "+3" over, "-2" under) - kept local rather than importing from
// lib/betLogic to avoid pulling that module's server-oriented dependencies
// into this small client component.
function formatToPar(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n === 0) return "E";
  return n > 0 ? `+${n}` : `${n}`;
}

function nineTotal(holes: Hole[]): number | null {
  return holes.every((h) => h.score !== null) ? holes.reduce((s, h) => s + (h.score ?? 0), 0) : null;
}

// Pulls the leading digit out of a round label ("Round 2" -> 2). Falls
// back to 1 for anything that doesn't have a digit in it (e.g. personal
// plays' constant "TedBeans Plays" label, before currentRound is known).
function roundNumFromLabel(label: string): number {
  const m = (label || "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 1;
}

function NineRow({ holes, label }: { holes: Hole[]; label: string }) {
  const cols = holes.length + 1;
  const total = nineTotal(holes);
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, marginBottom: 2 }}>
        {holes.map((h) => (
          <div key={h.hole} style={{ textAlign: "center", fontSize: 9, color: "var(--cream-dim)", opacity: 0.7 }}>{h.hole}</div>
        ))}
        <div />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, alignItems: "center" }}>
        {holes.map((h) => (
          <div key={h.hole} style={{ display: "flex", justifyContent: "center", padding: "0 2px" }}>
            <span className={`golf-sym ${symbolClass(h)}`}>{h.score ?? "—"}</span>
          </div>
        ))}
        <div style={{ textAlign: "center", fontSize: 11, color: "var(--cream-dim)" }}>
          {label} {total ?? "—"}
        </div>
      </div>
    </>
  );
}

export default function HoleScorecardModal({
  player,
  tournament,
  initialRound,
  loading,
  scorecard,
  position,
  totalToPar,
  message,
  onClose,
}: {
  player: string;
  tournament: string;
  initialRound: string;
  loading: boolean;
  scorecard: Scorecard | null;
  position?: string | null;
  totalToPar?: number | null;
  message?: string;
  onClose: () => void;
}) {
  const hasStandings = (position !== undefined && position !== null) || (totalToPar !== undefined && totalToPar !== null);
  const scoreColor = totalToPar === null || totalToPar === undefined ? "var(--cream)" : totalToPar < 0 ? "var(--clay)" : totalToPar > 0 ? "var(--steel)" : "var(--cream)";

  const initialRoundNum = roundNumFromLabel(initialRound);
  const [selectedRoundNum, setSelectedRoundNum] = useState(initialRoundNum);
  // Only set once a different round tab has actually been clicked - while
  // null, the modal just shows whatever the parent already fetched
  // (scorecard/loading/message props), avoiding a redundant refetch of the
  // round it opened with.
  const [override, setOverride] = useState<{ loading: boolean; scorecard: Scorecard | null; message?: string } | null>(null);

  // A fresh player/tournament/round was opened (not just a tab click on the
  // same popover) - reset back to that bet's own current round rather than
  // keeping whatever round a previously-viewed player happened to be left
  // on.
  useEffect(() => {
    setSelectedRoundNum(roundNumFromLabel(initialRound));
    setOverride(null);
  }, [player, tournament, initialRound]);

  function selectRound(n: number) {
    setSelectedRoundNum(n);
    if (n === initialRoundNum) {
      setOverride(null);
      return;
    }
    setOverride({ loading: true, scorecard: null });
    fetch(`/api/scorecard?tournament=${encodeURIComponent(tournament)}&round=${encodeURIComponent(`Round ${n}`)}&player=${encodeURIComponent(player)}`)
      .then((r) => r.json())
      .then((d) => setOverride({ loading: false, scorecard: d.scorecard || null, message: d.message || d.error }))
      .catch(() => setOverride({ loading: false, scorecard: null, message: "Couldn't load scorecard." }));
  }

  const activeLoading = override ? override.loading : loading;
  const activeScorecard = override ? override.scorecard : scorecard;
  const activeMessage = override ? override.message : message;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute", bottom: "calc(100% - 6px)", left: 28, zIndex: 20,
        background: "#0F1216", border: "1px solid var(--line)", borderRadius: 4,
        padding: "10px 12px", minWidth: 300, boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: hasStandings ? 4 : 6, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--cream)", whiteSpace: "nowrap" }}>{player}</span>
          <div style={{ display: "flex", gap: 3 }}>
            {[1, 2, 3, 4].map((n) => {
              const active = n === selectedRoundNum;
              return (
                <button
                  key={n}
                  onClick={() => selectRound(n)}
                  style={{
                    fontFamily: "'Oswald',sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                    padding: "2px 6px", borderRadius: 3, cursor: "pointer",
                    border: `1px solid ${active ? "var(--gold-bright)" : "var(--line)"}`,
                    background: active ? "rgba(228,190,74,0.12)" : "transparent",
                    color: active ? "var(--gold-bright)" : "var(--cream-dim)",
                  }}
                >
                  R{n}
                </button>
              );
            })}
          </div>
        </div>
        <span onClick={onClose} style={{ fontSize: 10, color: "var(--cream-dim)", cursor: "pointer", opacity: 0.7, whiteSpace: "nowrap" }}>close ✕</span>
      </div>

      {hasStandings && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 20, fontWeight: 700, color: scoreColor }}>
            {formatToPar(totalToPar)}
          </span>
          {position !== undefined && position !== null && (
            <span style={{ fontSize: 12, color: "var(--cream-dim)" }}>Position {position}</span>
          )}
        </div>
      )}

      {activeLoading && <div style={{ fontSize: 11, color: "var(--cream-dim)" }}>Loading…</div>}

      {!activeLoading && !activeScorecard && (
        <div style={{ fontSize: 11, color: "var(--cream-dim)", maxWidth: 270, lineHeight: 1.4 }}>
          {activeMessage || "Scorecard not available."}
        </div>
      )}

      {!activeLoading && activeScorecard && (
        <div>
          <NineRow holes={activeScorecard.firstNine} label={activeScorecard.firstNineLabel} />
          <div style={{ height: 6 }} />
          <NineRow holes={activeScorecard.secondNine} label={activeScorecard.secondNineLabel} />
        </div>
      )}
    </div>
  );
}
