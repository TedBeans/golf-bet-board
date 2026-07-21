import zlib from "zlib";

// Endpoint and key captured from pgatour.com's own frontend network traffic.
// The key is a public client-side AppSync key (the "da2-" prefix is the
// standard format for these) - it's meant to be visible to any browser
// loading the site, so using the same one here is the same trust level.
const PGA_GRAPHQL_URL = "https://orchestrator.pgatour.com/graphql";
const PGA_API_KEY = "da2-gsrx5bibzb4njvhl7t37wqyl4";

const LEADERBOARD_QUERY = `
  query LeaderboardCompressedV3($leaderboardCompressedV3Id: ID!) {
    leaderboardCompressedV3(id: $leaderboardCompressedV3Id) {
      id
      payload
    }
  }
`;

const SCORECARD_STATS_QUERY = `
  query ScorecardStatsV3Compressed($scorecardStatsV3CompressedId: ID!, $playerId: ID!) {
    scorecardStatsV3Compressed(id: $scorecardStatsV3CompressedId, playerId: $playerId) {
      id
      payload
    }
  }
`;

const HOLE_SCORECARD_QUERY = `
  query ScorecardCompressedV3($tournamentId: ID!, $playerId: ID!) {
    scorecardCompressedV3(tournamentId: $tournamentId, playerId: $playerId) {
      id
      payload
    }
  }
`;

async function pgaGraphQL(operationName: string, query: string, variables: Record<string, string>): Promise<any> {
  const res = await fetch(PGA_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": PGA_API_KEY,
      "X-Pgat-Platform": "web",
      Origin: "https://www.pgatour.com",
      Referer: "https://www.pgatour.com/",
    },
    body: JSON.stringify({ operationName, query, variables }),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`PGA Tour fetch failed (${res.status})`);
  return res.json();
}

function decompressPayload(json: any, fieldName: string): any {
  const b64 = json?.data?.[fieldName]?.payload;
  if (!b64) throw new Error(`No payload field in PGA Tour response for ${fieldName} - shape may have changed`);
  const buf = Buffer.from(b64, "base64");
  const decompressed = zlib.gunzipSync(buf).toString("utf-8");
  return JSON.parse(decompressed);
}

// The tournament id is the "Rxxxxxxx" segment from the pgatour.com URL,
// e.g. pgatour.com/tournaments/2026/isco-championship/R2026518/leaderboard
// -> "R2026518"
export async function fetchPgaLeaderboard(tournamentId: string): Promise<any> {
  const json = await pgaGraphQL("LeaderboardCompressedV3", LEADERBOARD_QUERY, {
    leaderboardCompressedV3Id: tournamentId,
  });
  return decompressPayload(json, "leaderboardCompressedV3");
}

// playerId is PGA Tour's internal numeric player id (visible in the
// leaderboard payload as player.id) - not the same as ESPN's ids.
export async function fetchPlayerScorecardStats(tournamentId: string, playerId: string): Promise<any> {
  const json = await pgaGraphQL("ScorecardStatsV3Compressed", SCORECARD_STATS_QUERY, {
    scorecardStatsV3CompressedId: tournamentId,
    playerId,
  });
  return decompressPayload(json, "scorecardStatsV3Compressed");
}

// Hole-by-hole scores (hole number, par, strokes, birdie/bogey/etc status)
// for every round played so far - a completely different query from the
// two above, which only carry aggregate stats.
export async function fetchPlayerHoleScores(tournamentId: string, playerId: string): Promise<any> {
  const json = await pgaGraphQL("ScorecardCompressedV3", HOLE_SCORECARD_QUERY, {
    tournamentId,
    playerId,
  });
  return decompressPayload(json, "scorecardCompressedV3");
}

// Tee times - query captured from pgatour.com's tee-times page network
// traffic (2026-07-21), same provenance as the three queries above. Note
// it's CompressedV2, not V3 like the others - which is why the earlier
// V3-convention guesses all came back FieldUndefined. Same compressed
// payload envelope as everything else, so decompressPayload just works.
const TEE_TIMES_QUERY = `
  query TeeTimesCompressedV2($teeTimesCompressedV2Id: ID!) {
    teeTimesCompressedV2(id: $teeTimesCompressedV2Id) {
      id
      payload
    }
  }
`;

export async function fetchPgaTeeTimes(tournamentId: string): Promise<any> {
  const json = await pgaGraphQL("TeeTimesCompressedV2", TEE_TIMES_QUERY, {
    teeTimesCompressedV2Id: tournamentId,
  });
  return decompressPayload(json, "teeTimesCompressedV2");
}
