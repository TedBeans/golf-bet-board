"use client";

import { Bet } from "../lib/seed";
import { parseBetType, formatScore, friendlyLabel } from "../lib/betLogic";

// Compact filtered list of bets matching one status (Win/Loss/Live/TBD),
// shown as a full-screen overlay - same position:fixed/backdrop convention
// as HoleScorecardModal's "centered" variant. Read-only: this is for
// quickly scanning everything in one bucket without scrolling the whole
// board, not for editing anything.
export default function BetFilterModal({
  title, bets, onClose,
}: {
  title: string;
  bets: Bet[];
  onClose: () => void;
}) {
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
        position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--panel, #1a1a1a)", border: "1px solid var(--line)", borderRadius: 6,
          maxWidth: 480, width: "100%", maxHeight: "80vh", display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{title} ({bets.length})</div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "1px solid var(--line)", color: "var(--cream)", borderRadius: 4, padding: "2px 10px", cursor: "pointer", fontFamily: "'JetBrains Mono',monospace" }}
          >
            Close
          </button>
        </div>
        <div style={{ overflowY: "auto", padding: "8px 16px 16px" }}>
          {bets.length === 0 && (
            <div className="subline" style={{ padding: "16px 0" }}>Nothing in this category right now.</div>
          )}
          {tournaments.map((tourn) => (
            <div key={tourn} style={{ marginTop: 12 }}>
              <div className="subline" style={{ fontWeight: 700, marginBottom: 4 }}>{tourn}</div>
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
                  <div key={b.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{b.player}</div>
                        <div className="subline">
                          {friendlyLabel(parsed.label, parsed.segment)} {b.bet} · {b.r}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <div>{valueDisplay}{b.thru !== null && b.thru !== undefined ? ` thru ${b.thru}` : ""}</div>
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
