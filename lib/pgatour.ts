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

// ---- Tee times (not yet wired into sync - discovery/validation stage) ----
//
// We don't have a captured, confirmed tee-times query the way the three
// above were captured from real network traffic. Rather than guess a
// query name/shape and ship something fragile, this does two things a
// caller (see /api/debug-pga-teetimes) can use to find the real one:
//
// 1. introspectPgaQueryFields(): asks the API's own schema what query
//    fields exist, filtered to ones that look tee-time related. If
//    introspection is disabled server-side this comes back empty rather
//    than throwing - that's an expected, informative outcome, not a bug.
// 2. fetchPgaTeeTimesGuess(): tries a handful of plausible query shapes
//    following the same "<Thing>CompressedV3" naming convention as the
//    three confirmed queries above, and reports which ones actually
//    resolve. Once one of these (or the introspection result) turns up
//    the real field name, replace this whole section with a single
//    confirmed query the same way the other three are built, and wire the
//    result into sync to fill in bet.time automatically.
export async function introspectPgaQueryFields(): Promise<string[]> {
  const query = `query IntrospectionQuery { __schema { queryType { fields { name } } } }`;
  try {
    const json = await pgaGraphQL("IntrospectionQuery", query, {});
    const fields: { name: string }[] = json?.data?.__schema?.queryType?.fields || [];
    return fields.map((f) => f.name).filter((n) => /tee|round|time/i.test(n));
  } catch {
    return [];
  }
}

const TEE_TIME_QUERY_GUESSES: { queryName: string; fieldName: string; idArg: string }[] = [
  { queryName: "TeeTimesCompressedV3", fieldName: "teeTimesCompressedV3", idArg: "teeTimesCompressedV3Id" },
  { queryName: "TeeTimesV3", fieldName: "teeTimesV3", idArg: "id" },
  { queryName: "RoundTeeTimesV3", fieldName: "roundTeeTimesV3", idArg: "id" },
];

export async function fetchPgaTeeTimesGuess(tournamentId: string): Promise<{ queryName: string; result: any }[]> {
  const attempts: { queryName: string; result: any }[] = [];
  for (const g of TEE_TIME_QUERY_GUESSES) {
    const query = `
      query ${g.queryName}($${g.idArg}: ID!) {
        ${g.fieldName}(${g.idArg}: $${g.idArg}) {
          id
          payload
        }
      }
    `;
    try {
      const json = await pgaGraphQL(g.queryName, query, { [g.idArg]: tournamentId });
      if (json?.errors) {
        attempts.push({ queryName: g.queryName, result: { errors: json.errors } });
        continue;
      }
      const decompressed = decompressPayload(json, g.fieldName);
      attempts.push({ queryName: g.queryName, result: { success: true, sample: decompressed } });
    } catch (e: any) {
      attempts.push({ queryName: g.queryName, result: { error: e.message || String(e) } });
    }
  }
  return attempts;
}
