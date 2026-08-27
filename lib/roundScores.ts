import { redis, ROUND_SCORES_KEY_PREFIX } from "./redis";
import { PgaPlayerRow } from "./pgaMatch";
import { Bet } from "./seed";

// LOW_ROUND bets are tournament-long (no round of their own), so there's
// no single bet to just read a round number off of. Rather than guess at
// an undocumented "current round" field in the leaderboard API response
// (against this project's own rule to never do that), this derives it
// from data already on hand: the highest round number among this
// tournament's own regular/personal bets that have actually gone live or
// further - the same signal the rest of this app already treats as "the
// tournament has reached at least this point" elsewhere.
export function inferCurrentRound(tournamentName: string, bets: Bet[], archive: Bet[]): number | null {
  let maxRound: number | null = null;
  for (const b of [...bets, ...archive]) {
    if (b.t !== tournamentName || b.status === "pending") continue;
    const m = b.r.match(/(\d+)/);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (maxRound === null || n > maxRound) maxRound = n;
  }
  return maxRound;
}

// LOW_ROUND bets ("lowest 18-hole round of the tournament") need every
// player's score for every round they've played - not just today's round
// (all the live leaderboard ever shows) and not just one player's data.
// Rather than fetch each player's full scorecard individually (one API
// call per player, the same cost problem the Greens & Fairways feature
// has), this piggybacks on the leaderboard call every sync already makes
// for the whole field: the moment a player's current-round thru hits 18,
// their score for that specific round gets written here permanently,
// before the leaderboard rolls forward into showing the next round's
// score instead and that number becomes unrecoverable from the live feed.

export type RoundScoreEntry = { playerId: string; name: string; score: number };
export type RoundScoreHistory = Record<string, RoundScoreEntry[]>; // "1".."4" -> entries recorded that round

function key(tournamentId: string): string {
  return ROUND_SCORES_KEY_PREFIX + tournamentId;
}

export async function getRoundScoreHistory(tournamentId: string): Promise<RoundScoreHistory> {
  return (await redis.get<RoundScoreHistory>(key(tournamentId))) || {};
}

// Records every completed round (thru === 18) from this sync pass's
// leaderboard snapshot for the given round number - idempotent (safe to
// call every sync pass; already-recorded players for that round just get
// overwritten with the same value).
export async function recordCompletedRounds(tournamentId: string, roundNum: number, players: PgaPlayerRow[]): Promise<RoundScoreHistory> {
  const history = await getRoundScoreHistory(tournamentId);
  const roundKey = String(roundNum);
  const existing = new Map((history[roundKey] || []).map((e) => [e.playerId, e]));

  for (const p of players) {
    if (p.thru === 18 && p.score !== null) {
      existing.set(p.id, { playerId: p.id, name: p.displayName, score: p.score });
    }
  }

  history[roundKey] = Array.from(existing.values());
  await redis.set(key(tournamentId), history);
  return history;
}

export type LowRoundStanding = { minScore: number; holders: RoundScoreEntry[] } | null;

// The lowest single-round score recorded so far across every round
// tracked for this tournament, and who holds it (a tie shows every
// holder - grading for LOW_ROUND bets is always manual, same as
// WINNER_SCORE, so this is purely informational display, not something
// feeding an automatic payout split the way R1_LEADER's dead-heat divisor
// does).
export function computeLowRoundStanding(history: RoundScoreHistory): LowRoundStanding {
  const all = Object.values(history).flat();
  if (all.length === 0) return null;
  const minScore = Math.min(...all.map((e) => e.score));
  const holders = all.filter((e) => e.score === minScore);
  return { minScore, holders };
}
