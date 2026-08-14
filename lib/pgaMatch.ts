import { normalizeName } from "./nameNorm";

export type PgaPlayerRow = {
  id: string;
  displayName: string;
  lastName: string;
  shortName: string;
  score: number | null; // this round's score to par
  thru: number | null; // holes completed this round (18 once finished)
  total: number | null; // cumulative tournament score to par
};

export function parseScoreToPar(s: string | null | undefined): number | null {
  if (s === null || s === undefined) return null;
  if (s === "E") return 0;
  if (s === "-" || s === "") return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

export function parseThru(s: string | null | undefined): number | null {
  if (!s) return null;
  if (s === "F") return 18;
  if (s === "-") return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

export function extractPlayers(leaderboardJson: any): PgaPlayerRow[] {
  const rows: any[] = leaderboardJson?.players || [];
  return rows
    .filter((r) => r.__typename === "PlayerRowV3")
    .map((r) => ({
      id: String(r.player?.id ?? ""),
      displayName: r.player?.displayName || "",
      lastName: r.player?.lastName || "",
      shortName: r.player?.shortName || "",
      score: parseScoreToPar(r.scoringData?.score),
      thru: parseThru(r.scoringData?.thru),
      total: parseScoreToPar(r.scoringData?.total),
    }));
}

// The player currently leading the tournament - lowest cumulative score to
// par. Used for tournament-long "winning score" bets, which track whoever
// is in 1st right now rather than any single named player.
export function findLeader(players: PgaPlayerRow[]): PgaPlayerRow | null {
  const withTotal = players.filter((p) => p.total !== null);
  if (withTotal.length === 0) return null;
  return withTotal.reduce((best, p) => ((p.total as number) < (best.total as number) ? p : best));
}


export type Round1LeaderInfo = { tiedIds: Set<string>; divisor: number; minScore: number } | null;

// Determines who's tied for the Round 1 lead across the whole field, from
// the already-fetched leaderboard snapshot alone - no extra per-player
// fetches needed. This only works within a specific window: for anyone
// who's finished a round (thru === 18), their cumulative total equals that
// round's score only when exactly one round has been played tournament-wide
// so far. So "total === score" is a cheap proxy for "we're still looking at
// Round 1 data, Round 2 hasn't started for the field yet".
//
// Returns null ("not settled, don't grade yet") if anyone with that Round-1
// signature is still mid-round (thru between 1 and 17) - the leader group
// can still change. Once nobody fits that description, returns the tied
// leader set from whoever's finished.
//
// Known limitation: a player who hasn't teed off *at all* yet shows
// total === null, thru === null - indistinguishable here from a genuine
// withdrawal/no-show. This function can't wait on a player it has no way to
// know is still coming, so a very late tee time finishing after this has
// already locked in a grade is a real (if narrow) risk. Sync re-checks
// continuously, but once a bet is graded hit/miss it's never revisited.
export function findRound1Leaders(players: PgaPlayerRow[]): Round1LeaderInfo {
  const round1Snapshot = players.filter((p) => p.total !== null && p.total === p.score);
  const stillMidRound = round1Snapshot.some((p) => p.thru !== null && p.thru < 18);
  if (stillMidRound) return null;

  const finished = round1Snapshot.filter((p) => p.thru === 18);
  if (finished.length === 0) return null;

  const minScore = Math.min(...finished.map((p) => p.total as number));
  const tied = finished.filter((p) => p.total === minScore);
  return { tiedIds: new Set(tied.map((p) => p.id)), divisor: tied.length, minScore };
}

function norm(s: string): string {
  return normalizeName(s);
}

// Matches a bet's free-text player name (e.g. "Koivun", "Chan Kim", "Matt
// Fitz") against the live leaderboard rows. Tries exact matches first, then
// progressively more forgiving fallbacks to catch nicknames, missing/extra
// tokens, and near-misses that are still obviously the same person.
export function findPlayerMatch(betPlayerName: string, players: PgaPlayerRow[]): PgaPlayerRow | null {
  const target = norm(betPlayerName);
  const tokens = target.split(/\s+/).filter(Boolean);
  const lastToken = tokens[tokens.length - 1];

  let match = players.find((p) => norm(p.displayName) === target);
  if (match) return match;

  match = players.find((p) => norm(p.lastName) === lastToken);
  if (match) return match;

  match = players.find((p) => {
    const pLast = norm(p.lastName);
    return pLast.length > 2 && lastToken.length > 2 && (pLast.startsWith(lastToken) || lastToken.startsWith(pLast));
  });
  if (match) return match;

  match = players.find((p) => norm(p.displayName).includes(target) || target.includes(norm(p.lastName)));
  if (match) return match;

  // Token-set fallback: every word in the bet's name shows up somewhere in
  // the player's full name, or vice versa - regardless of order, and
  // tolerant of a missing/extra middle name or suffix. Catches things an
  // exact or prefix match won't, as long as there's exactly one such player
  // (if it's ambiguous - e.g. two players who share a last name - this
  // deliberately refuses to guess between them).
  const candidates = players.filter((p) => {
    const pTokens = norm(p.displayName).split(/\s+/).filter(Boolean);
    if (pTokens.length === 0) return false;
    return tokens.every((t) => pTokens.includes(t)) || pTokens.every((pt) => tokens.includes(pt));
  });
  if (candidates.length === 1) return candidates[0];

  return null;
}
