"use client";

import { Bet } from "../lib/seed";
import { parseBetType, formatScore, friendlyLabel } from "../lib/betLogic";

type Kind = "win" | "loss" | "live" | "tbd";

// Derives a color theme purely from the title text, not from the bets
// themselves - deliberate, since "Projecting to WIN"/"Projecting to LOSE"
// pass a list of bets that are all still status "live" (nothing's settled
// yet), but the whole point of that view is showing which way they're
// leaning, so it should look green/red, not amber. Checked in this order
// so "LOSS"/"LOSE" never gets shadowed by an unrelated "WIN" substring
// (it can't - neither contains "WIN" - but LIVE is checked before WIN for
// the same reason "Projecting to WIN" and a plain "LIVE" pill both read
// unambiguously).
function kindFromTitle(title: string): Kind {
  const t = title.toUpperCase();
  if (t.includes("LOSS") || t.includes("LOSE")) return "loss";
  if (t.includes("LIVE")) return "live";
  if (t.includes("WIN")) return "win";
  return "tbd";
}

const THEME: Record<Kind, { accent: string; tint: string; tintStrong: string; border: string; glow: string; icon: string }> = {
  win: {
    accent: "var(--live)",
    tint: "rgba(76,175,110,0.08)",
    tintStrong: "rgba(76,175,110,0.18)",
    border: "rgba(76,175,110,0.35)",
    glow: "rgba(76,175,110,0.45)",
    icon: "✓", // check
  },
  loss: {
    accent: "var(--clay)",
    tint: "rgba(192,106,76,0.08)",
    tintStrong: "rgba(192,106,76,0.18)",
    border: "rgba(192,106,76,0.35)",
    glow: "rgba(192,106,76,0.4)",
    icon: "✕", // x
  },
  live: {
    accent: "var(--gold-bright)",
    tint: "rgba(228,190,74,0.08)",
    tintStrong: "rgba(228,190,74,0.2)",
    border: "rgba(228,190,74,0.4)",
    glow: "rgba(228,190,74,0.5)",
    icon: "●", // dot
  },
  tbd: {
    accent: "var(--cream-dim)",
    tint: "rgba(167,160,141,0.06)",
    tintStrong: "rgba(167,160,141,0.14)",
    border: "var(--line)",
    glow: "rgba(167,160,141,0.0)",
    icon: "○", // open circle
  },
};

// Small per-row chip showing the bet's actual live status - mostly
// redundant with the modal's own color theme, except in the "Projecting
// to WIN/LOSE" views where every row is really still status "live" and
// this is the only thing on the row that says so.
function StatusChip({ status }: { status: Bet["status"] }) {
  const kind: Kind = status === "hit" ? "win" : status === "miss" ? "loss" : status === "live" ? "live" : "tbd";
  const theme = THEME[kind];
  const label = status === "hit" ? "WIN" : status === "miss" ? "LOSS" : status === "live" ? "LIVE" : "TBD";
  return (
    <span
      style={{
        fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", color: theme.accent,
        background: theme.tint, border: `1px solid ${theme.border}`, borderRadius: 10,
        padding: "2px 6px", whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// Compact filtered list of bets matching one status (Win/Loss/Live/TBD),
// shown as a full-screen overlay - same position:fixed/backdrop convention
// as HoleScorecardModal's "centered" variant. Read-only: this is for
// quickly scanning everything in one bucket without scrolling the whole
// board, not for editing anything. Color-themed by what was clicked (see
// kindFromTitle) so a glance at the header, the accent bar, and every
// row's left border all agree at once - no more parsing a wall of
// identical gray rows to figure out whether this is the win list or the
// loss list.
export default function BetFilterModal({
  title, bets, onClose,
}: {
  title: string;
  bets: Bet[];
  onClose: () => void;
}) {
  const kind = kindFromTitle(title);
  const theme = THEME[kind];

  // Grouped by tournament so a cross-tournament list (the top-level
  // pills) still reads in a sensible order, rather than one flat list
  // mixing tournaments together.
  const groups: Record<string, Bet[]> = {};
  bets.forEach((b) => {
    (groups[b.t] = groups[b.t] || []).push(b);
  });
  const tournaments = Object.keys(groups);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100, background: "rgba(8,10,14,0.72)",
        backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="filter-modal-card"
        style={{
          background: "var(--panel, #1a1a1a)", border: `1px solid ${theme.border}`, borderRadius: 10,
          maxWidth: 480, width: "100%", maxHeight: "80vh", display: "flex", flexDirection: "column",
          overflow: "hidden",
          boxShadow: `0 16px 50px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.3), 0 0 36px ${theme.glow}`,
        }}
      >
        <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`, flexShrink: 0 }} />
        <div
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 16px",
            borderBottom: `1px solid ${theme.border}`, background: `linear-gradient(135deg, ${theme.tint}, transparent 70%)`,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span
              className={kind === "live" ? "filter-modal-dot live" : undefined}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 20, height: 20, borderRadius: "50%", color: theme.accent,
                background: theme.tintStrong, border: `1px solid ${theme.border}`,
                fontSize: 11, flexShrink: 0,
              }}
            >
              {theme.icon}
            </span>
            <span style={{ fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", fontSize: 14, letterSpacing: "0.02em" }}>
              {title}
            </span>
            <span
              style={{
                fontSize: 11, fontWeight: 700, color: theme.accent, background: theme.tintStrong,
                border: `1px solid ${theme.border}`, borderRadius: 10, padding: "1px 8px",
                fontFamily: "'JetBrains Mono',monospace",
              }}
            >
              {bets.length}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)", color: "var(--cream-dim)",
              borderRadius: 5, padding: "4px 11px", cursor: "pointer", fontFamily: "'JetBrains Mono',monospace",
              fontSize: 11, transition: "color 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--cream)"; e.currentTarget.style.borderColor = theme.border; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--cream-dim)"; e.currentTarget.style.borderColor = "var(--line)"; }}
          >
            Close
          </button>
        </div>
        <div style={{ overflowY: "auto", padding: "10px 14px 14px" }}>
          {bets.length === 0 && (
            <div className="subline" style={{ padding: "16px 0", textAlign: "center" }}>Nothing in this category right now.</div>
          )}
          {tournaments.map((tourn) => (
            <div key={tourn} style={{ marginTop: 14 }}>
              <div
                className="subline"
                style={{ fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}
              >
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: theme.accent, display: "inline-block" }} />
                {tourn}
              </div>
              {groups[tourn].map((b) => {
                const parsed = parseBetType(b.bet);
                // Only Score/Tournament Score bets are a to-par figure that
                // wants the +/E/- prefix - a birdie or greens count (or any
                // other plain count) isn't "par", so it renders as a bare
                // number instead. Same distinction legLiveDetail already
                // makes for the in-progress line elsewhere on this page.
                const valueDisplay =
                  parsed.label === "SCORE" || parsed.label === "WINNER_SCORE" ? formatScore(b.stat) : b.stat ?? "—";
                return (
                  <div
                    key={b.id}
                    style={{
                      padding: "9px 11px", marginBottom: 6, borderRadius: 6,
                      background: theme.tint, border: "1px solid var(--line)", borderLeft: `3px solid ${theme.accent}`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 600 }}>{b.player}</span>
                          <StatusChip status={b.status} />
                        </div>
                        <div className="subline" style={{ marginTop: 2 }}>
                          {friendlyLabel(parsed.label, parsed.segment)} {b.bet} · {b.r}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 16, color: theme.accent }}>
                          {valueDisplay}{b.thru !== null && b.thru !== undefined ? <span style={{ color: "var(--cream-dim)", fontWeight: 400, fontSize: 12 }}> thru {b.thru}</span> : ""}
                        </div>
                        {b.oddsPrice && (
                          <div className="subline">{b.sportsbook || "DK"} {b.oddsPrice}</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
