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
  oddsPrice?: string | null; // DK price only, e.g. "-112"
  oddsUnits?: string | null; // e.g. "1.12"
  loadedDate?: string; // "YYYY-MM-DD" - the day these bets were loaded onto the board
  archivedAt?: string; // ISO timestamp - when this bet moved to the recap
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
