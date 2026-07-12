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

function norm(s: string): string {
  return s.toLowerCase().replace(/\./g, "").trim();
}

// Matches a bet's free-text player name (e.g. "Koivun", "Chan Kim", "Matt
// Fitz") against the live leaderboard rows. Tries exact matches first, then
// falls back to last-name prefix matching to catch common nicknames.
export function findPlayerMatch(betPlayerName: string, players: PgaPlayerRow[]): PgaPlayerRow | null {
  const target = norm(betPlayerName);
  const tokens = target.split(/\s+/);
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
  return match || null;
}
