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
};

export const SEED: Bet[] = [
  { id: "b1", t: "ISCO Championship", r: "Round 3", time: "11:00 AM", player: "Koivun", bet: "-2 or better", stat: -2, thru: 2, status: "live" },
  { id: "b2", t: "ISCO Championship", r: "Round 3", time: "11:00 AM", player: "Koivun", bet: "12+ greens", stat: 2, thru: 2, status: "live" },
  { id: "b3", t: "ISCO Championship", r: "Round 3", time: "1:30 PM", player: "Wise", bet: "12+ greens", stat: null, thru: null, status: "pending" },
  { id: "b4", t: "ISCO Championship", r: "Round 3", time: "1:40 PM", player: "Fisk", bet: "2 bogeys or less", stat: null, thru: null, status: "pending" },
  { id: "b5", t: "ISCO Championship", r: "Round 3", time: "1:50 PM", player: "Glover", bet: "-1 or better", stat: null, thru: null, status: "pending" },
  { id: "b6", t: "ISCO Championship", r: "Round 3", time: "1:50 PM", player: "Glover", bet: "2 bogeys or less", stat: null, thru: null, status: "pending" },
  { id: "b7", t: "ISCO Championship", r: "Round 3", time: "1:50 PM", player: "Chan Kim", bet: "-1 or better", stat: null, thru: null, status: "pending" },
  { id: "b8", t: "ISCO Championship", r: "Round 3", time: "1:50 PM", player: "Chan Kim", bet: "13+ greens", stat: null, thru: null, status: "pending" },
  { id: "b9", t: "Scottish Open", r: "Round 3", time: "7:13 AM", player: "Greyserman", bet: "3 birdies or less", stat: null, thru: null, status: "hit" },
  { id: "b10", t: "Scottish Open", r: "Round 3", time: "9:33 AM", player: "JT", bet: "12 greens or less", stat: 5, thru: 9, status: "live" },
  { id: "b11", t: "Scottish Open", r: "Round 3", time: "10:20 AM", player: "Reed", bet: "3 birdies or less", stat: 2, thru: 5, status: "live" },
  { id: "b12", t: "Scottish Open", r: "Round 3", time: "10:31 AM", player: "Gerard", bet: "12 greens or less", stat: 3, thru: 5, status: "live" },
  { id: "b13", t: "Scottish Open", r: "Round 3", time: "11:20 AM", player: "Yellamaraju", bet: "E or worse", stat: null, thru: null, status: "pending" },
  { id: "b14", t: "Scottish Open", r: "Round 3", time: "12:04 AM", player: "Matt Fitz", bet: "-2 or better", stat: null, thru: null, status: "pending" },
];
