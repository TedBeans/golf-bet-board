// Mirrors lib/pgaMatch.ts, but for theopen.com's feed shape. The key
// structural difference: PGA Tour's leaderboard only ever reflects "the
// current round" for its per-round score/thru fields, whereas theopen.com's
// `traditional` feed gives an explicit rounds[] array (one entry per round,
// each with its own teeTime and hole-by-hole info[]) - so callers here must
// say which round number they care about, matching the bet's own round.

export type TheOpenPlayerRow = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  status: number | null; // meaning unconfirmed - everyone reads 1 pre-tournament; capture a live/cut/WD example to decode
  hole: number | null; // current hole in progress, straight from the feed
  sortValue: number | null; // leaderboard rank - lower is better, used for findLeader
  roundScoreToPar: number | null; // derived for the requested round - see deriveRoundFromInfo
  roundThru: number | null; // holes completed in the requested round
  totalToPar: number | null; // tournament cumulative - straight passthrough of the feed's `total` field (frequently null pre-live)
};

// The feed marks an unplayed hole with playerStrokes: 0 (never a dash or
// null, unlike PGA Tour's "-" convention) - so "played" here just means
// playerStrokes > 0. Once a round is complete this naturally yields thru
// = 18 and scoreToPar = the real total, no separate "F" flag needed.
function deriveRoundFromInfo(info: any[]): { scoreToPar: number | null; thru: number | null } {
  let played = 0;
  let toPar = 0;
  for (const h of info || []) {
    const strokes = h?.playerStrokes;
    if (typeof strokes === "number" && strokes > 0) {
      played += 1;
      toPar += strokes - (h.holePar ?? 0);
    }
  }
  if (played === 0) return { scoreToPar: null, thru: null };
  return { scoreToPar: toPar, thru: played };
}

export function extractTheOpenPlayers(traditionalJson: any, roundNumber: number): TheOpenPlayerRow[] {
  const rows: any[] = traditionalJson?.players || [];
  return rows.map((r) => {
    const round = (r.rounds || []).find((rd: any) => rd.id === roundNumber);
    const derived = round ? deriveRoundFromInfo(round.info) : { scoreToPar: null, thru: null };
    const firstName = r.firstName || "";
    const lastName = r.lastName || "";
    return {
      id: String(r.id ?? ""),
      firstName,
      lastName,
      displayName: `${firstName} ${lastName}`.trim(),
      status: typeof r.status === "number" ? r.status : null,
      hole: typeof r.hole === "number" ? r.hole : null,
      sortValue: typeof r.position?.sortValue === "number" ? r.position.sortValue : null,
      roundScoreToPar: derived.scoreToPar,
      roundThru: derived.thru,
      totalToPar: typeof r.total === "number" ? r.total : null,
    };
  });
}

// Same rank as findLeader in pgaMatch.ts, but The Open's feed doesn't
// reliably populate `total` pre-live, so this ranks by position.sortValue
// (1 = current leader) instead - which the feed already computes for us
// and should stay populated throughout, unlike a derived total that would
// require every prior round's info[] to be fully and correctly played out.
export function findTheOpenLeader(players: TheOpenPlayerRow[]): TheOpenPlayerRow | null {
  const withSort = players.filter((p) => p.sortValue !== null);
  if (withSort.length === 0) return null;
  return withSort.reduce((best, p) => ((p.sortValue as number) < (best.sortValue as number) ? p : best));
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\./g, "").trim();
}

// Same matching strategy as pgaMatch.ts's findPlayerMatch: exact full-name
// match first, then last-name-only, then prefix fallback for nicknames.
export function findTheOpenPlayerMatch(betPlayerName: string, players: TheOpenPlayerRow[]): TheOpenPlayerRow | null {
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
