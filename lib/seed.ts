export type AutoStats = {
  thru: number | null;
  scoreToPar: number | null;
  // Not yet wired up - these need a second PGA Tour query captured (the
  // per-player "Stats" tab), separate from the leaderboard query.
  birdies: number | null;
  bogeys: number | null;
  pars: number | null;
  eagles: number | null;
  doubleBogeys: number | null;
  gir: string | null;
  fairways: string | null;
  updatedAt: string | null;
  leaderName?: string | null; // only set for tournament-long "winning score" bets
  position?: string | null; // personal Winner/Top N bets only - live leaderboard position
                             // computed ourselves (e.g. "T7"), ties handled via lib/positions.ts
  opponentScoreToPar?: number | null; // personal H2H bets only - the opponent's score for the same scope
  opponentThru?: number | null; // personal H2H bets only - opponent's holes completed for that scope
  dgCutProb?: number | null; // personal MAKE_CUT bets only - DataGolf live model's real-time make-cut
                             // probability (0-100%), purely informational context alongside
                             // gradeMakeCut's own hit/miss logic - never used for grading itself.
                             // null if DataGolf's page couldn't be fetched/parsed or the player
                             // didn't match - non-fatal either way, see lib/datagolf.ts.
  currentRound?: number | null; // personal MAKE_CUT bets only - which round (1 or 2) thru/scoreToPar
                                 // above actually belong to. Round 1 until it's fully finished
                                 // (thru === 18), then Round 2 - prevents thru/scoreToPar from
                                 // staying frozen on a completed Round 1 once Round 2 has started.
};

export type Bet = {
  id: string;
  t: string; // tournament
  r: string; // round
  time: string;
  player: string;
  bet: string;
  stat: number | null;
  thru: number | null;
  status: "pending" | "live" | "hit" | "miss";
  autoEnabled?: boolean; // if true, sync will overwrite stat/thru/auto
  auto?: AutoStats | null; // full detail line from last successful sync
  oddsLine?: string | null; // e.g. "Under 69.5"
  oddsPrice?: string | null; // American odds price, e.g. "-112"
  sportsbook?: string | null; // e.g. "DK", "CZR" - which book these odds are from; defaults to "DK" for display if unset (legacy bets)
  oddsUnits?: string | null; // e.g. "1.12"
  loadedDate?: string; // "YYYY-MM-DD" - the day these bets were loaded onto the board
  archivedAt?: string; // ISO timestamp - when this bet moved to the recap
  personal?: boolean; // TedBeans' own tournament-long props (Winner/Top N/Make Cut/H2H) -
                       // tracked in their own "TedBeans Plays" section/recap tab, never
                       // mixed into the regular calendar/tournament recaps
  hidden?: boolean; // personal straight bets only - admin-only toggle (Bets tab) to keep a
                    // bet you only ever parlayed off the live board's straight-bets list,
                    // without affecting its sync/grading or its use as a parlay leg
  personalOrder?: number; // drag-and-drop display order among personal bets for the same
                           // tournament - unset until you actually reorder something, at
                           // which point it "crystallizes" the current order (see admin's
                           // reorder handler); falls back to array order when unset
  personalManualLive?: boolean; // personal plays only - set true when TedBeans manually forces
                                 // a status via the board's WIN/IN PROGRESS/LOSS buttons (or
                                 // admin's "Force live" bulk action). The sync route's
                                 // pending<->live auto-promotion is driven entirely by whether
                                 // any REGULAR bet in the same tournament has started - with no
                                 // regular bet loaded yet, that gate never fires, and the
                                 // demotion half would otherwise silently flip a manual click
                                 // back to pending on the very next sync pass. This flag tells
                                 // that demotion logic "this was chosen on purpose, leave it".
};

export const SEED: Bet[] = [
  { id: "b1", t: "ISCO Championship", r: "Round 3", time: "11:00 AM", player: "Koivun", bet: "-2 or better", stat: -2, thru: 2, status: "live", autoEnabled: true, auto: null },
  { id: "b2", t: "ISCO Championship", r: "Round 3", time: "11:00 AM", player: "Koivun", bet: "12+ greens", stat: 2, thru: 2, status: "live", autoEnabled: true, auto: null },
  { id: "b3", t: "ISCO Championship", r: "Round 3", time: "1:30 PM", player: "Wise", bet: "12+ greens", stat: null, thru: null, status: "pending", autoEnabled: true, auto: null },
  { id: "b4", t: "ISCO Championship", r: "Round 3", time: "1:40 PM", player: "Fisk", bet: "2 bogeys or less", stat: null, thru: null, status: "pending", autoEnabled: true, auto: null },
  { id: "b5", t: "ISCO Championship", r: "Round 3", time: "1:50 PM", player: "Glover", bet: "-1 or better", stat: null, thru: null, status: "pending", autoEnabled: true, auto: null },
  { id: "b6", t: "ISCO Championship", r: "Round 3", time: "1:50 PM", player: "Glover", bet: "2 bogeys or less", stat: null, thru: null, status: "pending", autoEnabled: true, auto: null },
  { id: "b7", t: "ISCO Championship", r: "Round 3", time: "1:50 PM", player: "Chan Kim", bet: "-1 or better", stat: null, thru: null, status: "pending", autoEnabled: true, auto: null },
  { id: "b8", t: "ISCO Championship", r: "Round 3", time: "1:50 PM", player: "Chan Kim", bet: "13+ greens", stat: null, thru: null, status: "pending", autoEnabled: true, auto: null },
  { id: "b9", t: "Scottish Open", r: "Round 3", time: "7:13 AM", player: "Greyserman", bet: "3 birdies or less", stat: null, thru: null, status: "hit", autoEnabled: true, auto: null },
  { id: "b10", t: "Scottish Open", r: "Round 3", time: "9:33 AM", player: "JT", bet: "12 greens or less", stat: 5, thru: 9, status: "live", autoEnabled: true, auto: null },
  { id: "b11", t: "Scottish Open", r: "Round 3", time: "10:20 AM", player: "Reed", bet: "3 birdies or less", stat: 2, thru: 5, status: "live", autoEnabled: true, auto: null },
  { id: "b12", t: "Scottish Open", r: "Round 3", time: "10:31 AM", player: "Gerard", bet: "12 greens or less", stat: 3, thru: 5, status: "live", autoEnabled: true, auto: null },
  { id: "b13", t: "Scottish Open", r: "Round 3", time: "11:20 AM", player: "Yellamaraju", bet: "E or worse", stat: null, thru: null, status: "pending", autoEnabled: true, auto: null },
  { id: "b14", t: "Scottish Open", r: "Round 3", time: "12:04 AM", player: "Matt Fitz", bet: "-2 or better", stat: null, thru: null, status: "pending", autoEnabled: true, auto: null },
];
