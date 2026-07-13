"use client";

type Hole = { hole: number; par: number; score: number | null; status?: string | null };
type Scorecard = { firstNine: Hole[]; firstNineLabel: string; secondNine: Hole[]; secondNineLabel: string };

export default function HoleScorecardModal({
  player,
  loading,
  scorecard,
  message,
  onClose,
}: {
  player: string;
  loading: boolean;
  scorecard: Scorecard | null;
  message?: string;
  onClose: () => void;
}) {
  function nineTotal(holes: Hole[]): number | null {
    return holes.every((h) => h.score !== null) ? holes.reduce((s, h) => s + (h.score ?? 0), 0) : null;
  }

  function scoreClass(h: Hole): string {
    if (h.score === null) return "";
    if (h.score < h.par) return "pace-good";
    if (h.score > h.par) return "pace-bad";
    return "";
  }

  function renderNine(holes: Hole[], label: string, showTotal2 = false, secondTotal?: number | null, secondPar?: number) {
    const par = holes.reduce((s, h) => s + h.par, 0);
    const total = nineTotal(holes);
    const cols = showTotal2 ? holes.length + 2 : holes.length + 1;
    return (
      <>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, textAlign: "center", marginBottom: 4 }}>
          <div style={{ color: "var(--cream-dim)" }}>HOLE</div>
          {holes.map((h) => <div key={h.hole} style={{ color: "var(--cream-dim)" }}>{h.hole}</div>)}
          <div style={{ color: "var(--cream-dim)" }}>{label}</div>
          {showTotal2 && <div style={{ color: "var(--cream-dim)" }}>TOT</div>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, textAlign: "center", marginBottom: 2 }}>
          <div style={{ color: "var(--cream-dim)" }}>PAR</div>
          {holes.map((h) => <div key={h.hole}>{h.par}</div>)}
          <div>{par}</div>
          {showTotal2 && <div>{secondPar !== undefined ? par + secondPar : "—"}</div>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, textAlign: "center", marginBottom: showTotal2 ? 0 : 16 }}>
          <div style={{ color: "var(--cream-dim)" }}>SCORE</div>
          {holes.map((h) => <div key={h.hole} className={scoreClass(h)}>{h.score ?? "—"}</div>)}
          <div>{total ?? "—"}</div>
          {showTotal2 && <div>{total !== null && secondTotal !== null && secondTotal !== undefined ? total + secondTotal : "—"}</div>}
        </div>
      </>
    );
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ maxWidth: 480, width: "100%", maxHeight: "80vh", overflowY: "auto" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div className="player" style={{ fontSize: 16 }}>{player}</div>
          <button className="recap-btn" onClick={onClose}>Close</button>
        </div>

        {loading && <div className="subline">Loading scorecard…</div>}

        {!loading && !scorecard && (
          <div className="subline" style={{ textTransform: "none", letterSpacing: 0, lineHeight: 1.5 }}>
            {message || "Scorecard not available."}
          </div>
        )}

        {!loading && scorecard && (
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>
            {renderNine(scorecard.firstNine, scorecard.firstNineLabel)}
            <div style={{ marginBottom: 16 }} />
            {renderNine(
              scorecard.secondNine,
              scorecard.secondNineLabel,
              true,
              nineTotal(scorecard.firstNine),
              scorecard.firstNine.reduce((s, h) => s + h.par, 0)
            )}
          </div>
        )}
      </div>
    </div>
  );
}
