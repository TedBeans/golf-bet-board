// This talks to ESPN's undocumented public golf endpoints. There's no
// official contract for this data - it's the same feed ESPN's own site
// uses, but the shape can shift without notice. Every field read here is
// defensive (optional chaining, fallbacks to null) so a missing/renamed
// field degrades to "no auto data" for that stat rather than crashing sync.

export type EspnCompetitor = {
  id: string;
  name: string;
  shortName: string;
};

export async function fetchLeaderboard(eventId: string): Promise<EspnCompetitor[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/golf/pga/leaderboard/${eventId}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`ESPN leaderboard fetch failed (${res.status})`);
  const data = await res.json();
  const competitors =
    data?.events?.[0]?.competitions?.[0]?.competitors ||
    data?.competitions?.[0]?.competitors ||
    [];
  return competitors.map((c: any) => ({
    id: String(c.id ?? c.athlete?.id ?? ""),
    name: c.athlete?.displayName || c.athlete?.fullName || c.athlete?.shortName || "Unknown",
    shortName: c.athlete?.shortName || c.athlete?.displayName || "",
  }));
}

export async function fetchPlayerSummary(eventId: string, playerId: string, season: number): Promise<any> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/golf/pga/leaderboard/${eventId}/playersummary?season=${season}&player=${playerId}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`ESPN playersummary fetch failed (${res.status})`);
  return res.json();
}
