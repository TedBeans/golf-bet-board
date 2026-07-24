import { Bet } from "./seed";

export type ParlayLegRef = {
  betId: string; // the Bet.id this leg points to, at time of creation
  player: string;
  bet: string; // the bet description, e.g. "-2 or better"
  tournament: string;
  round: string;
  status?: "hit" | "miss" | "push" | "live" | "pending" | "unknown"; // snapshotted at archive time
};

export type Parlay = {
  id: string;
  label: string;
  legs: ParlayLegRef[];
  oddsPrice: string; // American odds, e.g. "+950"
  wagerUnits: number; // e.g. 0.5
  wagerDollars?: number; // just for display/reference
  status: "pending" | "live" | "hit" | "miss" | "push";
  loadedDate: string;
  archivedAt?: string;
  personal?: boolean; // true when every leg is a personal play (see lib/seed.ts's Bet.personal) -
                       // set automatically at creation time, tracked in its own "TedBeans Plays"
                       // sub-section rather than the regular Parlays section/recap tab
  personalOrder?: number; // drag-and-drop display order among personal parlays - same
                           // "crystallizes on first reorder" convention as Bet.personalOrder
  manualStatus?: "hit" | "miss" | "push"; // admin-only manual override (e.g. a parlay that's clearly lost
                                  // but its legs haven't all individually resolved yet, a stale parlay
                                  // Teddy just wants off the live board, or a leg that turned out to be
                                  // a push rather than a clean win/loss) - once set, sync stops
                                  // re-deriving status from the legs and leaves this alone, same
                                  // "manual click wins" convention as personalManualLive on Bet. "push"
                                  // is graded as a half win: half the wager pays out at the listed odds,
                                  // the other half is simply refunded (0), never treated as a loss.
};

export type LegStatus = { leg: ParlayLegRef; status: Bet["status"] | "unknown"; bet: Bet | null };

// Looks up each leg's current status from the live bets list or the
// archive (whichever still has it) - a parlay never fetches PGA Tour data
// itself, it just watches the bets it references.
export function resolveLegStatuses(legs: ParlayLegRef[], liveBets: Bet[], archivedBets: Bet[]): LegStatus[] {
  return legs.map((leg) => {
    const found = liveBets.find((b) => b.id === leg.betId) || archivedBets.find((b) => b.id === leg.betId) || null;
    return { leg, status: found ? found.status : "unknown", bet: found };
  });
}

export function deriveParlayStatus(legStatuses: LegStatus[]): Parlay["status"] {
  if (legStatuses.some((l) => l.status === "miss")) return "miss";
  if (legStatuses.every((l) => l.status === "hit")) return "hit";
  if (legStatuses.some((l) => l.status === "live" || l.status === "hit")) return "live";
  return "pending";
}
