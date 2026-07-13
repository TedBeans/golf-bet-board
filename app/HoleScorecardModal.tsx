"use client";

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

function nineTotal(holes: Hole[]): number | null {
  return holes.every((h) => h.score !== null) ? holes.reduce((s, h) => s + (h.score ?? 0), 0) : null;
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
          <div key={h.hole} style={{ display: "flex", justifyContent: "center" }}>
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
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute", bottom: "calc(100% + 6px)", left: 0, zIndex: 20,
        background: "#0F1216", border: "1px solid var(--line)", borderRadius: 4,
        padding: "8px 10px", minWidth: 260, boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--cream-dim)" }}>{player}</span>
        <span onClick={onClose} style={{ fontSize: 10, color: "var(--cream-dim)", cursor: "pointer", opacity: 0.7 }}>close ✕</span>
      </div>

      {loading && <div style={{ fontSize: 11, color: "var(--cream-dim)" }}>Loading…</div>}

      {!loading && !scorecard && (
        <div style={{ fontSize: 11, color: "var(--cream-dim)", maxWidth: 240, lineHeight: 1.4 }}>
          {message || "Scorecard not available."}
        </div>
      )}

      {!loading && scorecard && (
        <div>
          <NineRow holes={scorecard.firstNine} label={scorecard.firstNineLabel} />
          <div style={{ height: 6 }} />
          <NineRow holes={scorecard.secondNine} label={scorecard.secondNineLabel} />
        </div>
      )}
    </div>
  );
}
