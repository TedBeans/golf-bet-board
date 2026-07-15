// Ranks the whole field ourselves, computed from cumulative score-to-par -
// deliberately not dependent on any vendor-provided "position" field (PGA
// Tour's and theopen.com's shapes for that are either absent or unconfirmed
// for our purposes), and it needs to handle ties the same way a real
// leaderboard does: two players tied for 2nd both show "T2", and the next
// player down is "4", not "3" - which matters directly for "Top 10
// (including ties)" personal bets.

export type PositionEntry = { id: string; totalToPar: number | null };

// Returns a map of id -> position label ("1", "T2", "4", ...). Players with
// no score yet (totalToPar: null - haven't teed off) are simply omitted;
// callers should treat a missing entry as "no position to show yet".
export function computePositions(entries: PositionEntry[]): Map<string, string> {
  const withScore = entries.filter(
    (e): e is { id: string; totalToPar: number } => e.totalToPar !== null && e.totalToPar !== undefined
  );
  withScore.sort((a, b) => a.totalToPar - b.totalToPar);

  const result = new Map<string, string>();
  let i = 0;
  while (i < withScore.length) {
    const score = withScore[i].totalToPar;
    let j = i;
    while (j < withScore.length && withScore[j].totalToPar === score) j++;
    const rank = i + 1; // 1-indexed position of the first player in this tied group
    const label = j - i > 1 ? `T${rank}` : `${rank}`;
    for (let k = i; k < j; k++) result.set(withScore[k].id, label);
    i = j;
  }
  return result;
}

// Numeric rank from a position label ("T7" -> 7), for comparing against a
// Top N cutoff - display/informational use only (Top N bets settle by
// hand, per TedBeans' own call, so this never drives auto-grading).
export function positionRank(label: string | null | undefined): number | null {
  if (!label) return null;
  const n = parseInt(label.replace(/^T/i, ""), 10);
  return isNaN(n) ? null : n;
}
