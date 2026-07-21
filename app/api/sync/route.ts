import { NextResponse } from "next/server";
import { redis, BETS_KEY, MAPPING_KEY, SYNC_LOCK_KEY, ARCHIVE_KEY, PARLAYS_KEY, PARLAY_ARCHIVE_KEY, DG_CUTLINE_KEY } from "../../../lib/redis";
import { Bet } from "../../../lib/seed";
import { Mapping } from "../../../lib/mapping";
import { Parlay, resolveLegStatuses, deriveParlayStatus } from "../../../lib/parlay";
import { fetchPgaLeaderboard, fetchPlayerScorecardStats, fetchPlayerHoleScores, fetchPgaTeeTimes, extractPgaTeeTimes, PgaTeeTimeRow } from "../../../lib/pgatour";
import { extractPlayers, findPlayerMatch, findLeader, PgaPlayerRow } from "../../../lib/pgaMatch";
import { extractScorecardStats, roundNumberFromLabel, computeSegmentStats, computeFullRoundStats } from "../../../lib/pgaScorecard";
import { fetchOpenLeaderboard, fetchOpenStatistics } from "../../../lib/theopen";
import { extractOpenPlayers, findOpenPlayerMatch, findOpenLeader, computeOpenStats, computeOpenGirFairways, OpenPlayerRow } from "../../../lib/openMatch";
import { parseBetType, autoGradeStatus, timeToMinutes, gradeMakeCut } from "../../../lib/betLogic";
import { fetchDataGolfData, findDataGolfPlayerMatch, DataGolfPlayerRow } from "../../../lib/datagolf";
import { computePositions, PositionEntry } from "../../../lib/positions";
import { nowInCentral } from "../../../lib/centralTime";

const SYNC_LOCK_MS = 45000;

// No searchParams/cookies/headers used here, which means Next.js could
// otherwise treat this as a static candidate and Vercel's edge could cache
// the response - exactly the kind of silent staleness that's invisible
// until you compare two fetches mid-round and get different answers for
// the same URL. Force it dynamic and uncacheable at every layer: this is
// the actual grading engine, not just a debug route.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Belt-and-suspenders: the exports above stop Next.js/its own fetch cache
// from serving anything stale, but an explicit Cache-Control header is
// what a CDN edge layer in front of the function actually respects -
// route-level dynamic/fetchCache exports don't necessarily reach that far.
function noCacheJson(body: any, init?: { status?: number }) {
  return NextResponse.json(body, {
    ...init,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

// Triggered by the browser (not a server cron - see README) roughly once a
// minute while the board is open. No passcode required: this route only
// recomputes values from the tournament mapping already saved server-side,
// it can't accept arbitrary bet data from the caller.
//
// Because every open tab triggers its own sync call, a friend group with
// many tabs open at once could otherwise multiply real PGA Tour requests.
// This lock collapses all of that into one shared fetch per ~45s window,
// regardless of how many people are watching.
export async function GET() {
  const now = Date.now();
  const lastSync = await redis.get<number>(SYNC_LOCK_KEY);
  if (lastSync && now - lastSync < SYNC_LOCK_MS) {
    return noCacheJson({ ok: true, updated: 0, errors: [], skipped: true });
  }
  await redis.set(SYNC_LOCK_KEY, now);

  const [bets, mapping] = await Promise.all([
    redis.get<Bet[]>(BETS_KEY),
    redis.get<Mapping>(MAPPING_KEY),
  ]);

  // Auto-fill tee times for any regular bet loaded without one.
  // Runs once per sync pass; at most one fetch per tournament+round.
  // PGA-sourced tournaments only - The Open uses its own feed.
  const teeTimeCache = new Map<string, PgaTeeTimeRow[]>();
  let teeTimesChanged = false;
  function normTT(s: string): string {
    return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
  }
  function matchTeeTime(name: string, rows: PgaTeeTimeRow[]): PgaTeeTimeRow | null {
    const t = normTT(name);
    let m = rows.find(r => normTT(r.displayName) === t);
    if (m) return m;
    const tLast = t.split(" ").pop()!;
    const byLast = rows.filter(r => normTT(r.lastName) === tLast);
    if (byLast.length === 1) return byLast[0];
    m = rows.find(r => normTT(r.displayName).startsWith(t) || t.startsWith(normTT(r.displayName)));
    if (m) return m;
    return rows.find(r => normTT(r.displayName).includes(t) || t.includes(normTT(r.displayName))) || null;
  }
  for (const b of bets) {
    if (b.personal || b.time) continue;
    const tm = mapping.tournaments?.[b.t];
    if (!tm?.pgaId || tm.dataSource === "theopen") continue;
    const roundNum = parseInt((b.r || "").match(/(\d+)/)?.[1] || "0", 10);
    if (!roundNum) continue;
    const key = `${tm.pgaId}:${roundNum}`;
    if (!teeTimeCache.has(key)) {
      try {
        const payload = await fetchPgaTeeTimes(tm.pgaId);
        teeTimeCache.set(key, extractPgaTeeTimes(payload, roundNum));
      } catch { teeTimeCache.set(key, []); }
    }
    const match = matchTeeTime(b.player, teeTimeCache.get(key) || []);
    if (match) {
      b.time = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(match.teeTimeMs));
      teeTimesChanged = true;
    }
  }
  if (teeTimesChanged) await redis.set(BETS_KEY, bets);

  if (!bets || !mapping) {
    return noCacheJson({ ok: true, updated: 0, errors: ["Nothing to sync yet"] });
  }

  const errors: string[] = [];
  const leaderboardCache = new Map<string, PgaPlayerRow[]>();
  const scorecardCache = new Map<string, any>();
  let openPlayersCache: OpenPlayerRow[] | null = null;
  // Lazily fetched - only GIR bets need the statistics feed at all, so
  // there's no reason to fetch it on every sync pass for tournaments/bets
  // that never touch it.
  let openStatsCache: any | null = null;
  // Lazily fetched, at most once per sync pass, regardless of how many
  // personal MAKE_CUT bets need it. undefined = not attempted yet this
  // pass; null = attempted and failed (page structure changed, request
  // blocked, etc - treated as "no data available" for the rest of this
  // pass rather than retried per-bet). Purely informational context
  // alongside gradeMakeCut's own hit/miss logic below - a failure here
  // never blocks or affects actual grading.
  let dataGolfCache: DataGolfPlayerRow[] | null | undefined = undefined;
  async function getDataGolfCutProb(playerName: string): Promise<number | null> {
    if (dataGolfCache === undefined) {
      try {
        const data = await fetchDataGolfData();
        dataGolfCache = data.players;
        // Persisted separately from the in-memory cache so /api/parlays can
        // serve the last-known distribution even between sync passes - a
        // fetch failure just leaves the previously-cached value in place
        // rather than wiping it out (same "fail silently, keep last good
        // value" approach as dgCutProb on individual bets). Stamped with
        // when it was fetched so a stale value (e.g. still sitting here
        // from a tournament that already finished, since datagolf.com's
        // live-model page doesn't rotate to the next event on any
        // predictable schedule we can rely on) can be told apart from a
        // genuinely current one - see the freshness check in
        // /api/parlays/route.ts.
        if (data.cutlineProbs.length > 0) {
          await redis.set(DG_CUTLINE_KEY, { cutlineProbs: data.cutlineProbs, fetchedAt: new Date().toISOString() });
        }
      } catch {
        dataGolfCache = null;
      }
    }
    if (!dataGolfCache) return null;
    const match = findDataGolfPlayerMatch(playerName, dataGolfCache);
    return match ? match.cutProb : null;
  }
  // Field-wide position rankings for personal Winner/Top N bets - computed
  // once per tournament per sync pass (several personal bets often share
  // the same tournament), not once per bet.
  const positionsCache = new Map<string, Map<string, string>>();
  let updatedCount = 0;
  const { dateStr: todayCentral, minutes: nowMinutes, dateTimeStr: nowCentralDT } = nowInCentral();

  // Shared round-stat lookups for personal plays (Make Cut, H2H) - both
  // return a specific round's thru/score-to-par (or the tournament-wide
  // cumulative total when roundNum is null), regardless of which round is
  // "currently active" tournament-wide, unlike a leaderboard row's own
  // score/thru fields. theopen.com already has this per hole in the cached
  // leaderboard payload; PGA Tour needs the same hole-by-hole fetch the
  // Front 9/Back 9 branch below already uses, cached the same way.
  async function getOpenRoundStat(openPlayers: OpenPlayerRow[], playerName: string, roundNum: number | null) {
    const row = findOpenPlayerMatch(playerName, openPlayers);
    if (!row) return null;
    if (roundNum === null) {
      const agg = computeOpenStats(row, null);
      return { id: row.id, thru: agg.holesPlayed || null, scoreToPar: agg.holesPlayed > 0 ? agg.totalToPar : null };
    }
    const r = computeOpenStats(row, roundNum);
    return { id: row.id, thru: r.thru, scoreToPar: r.scoreToPar };
  }

  async function getPgaRoundStat(tournamentId: string, pgaPlayers: PgaPlayerRow[], playerName: string, roundNum: number | null) {
    const row = findPlayerMatch(playerName, pgaPlayers);
    if (!row) return null;
    if (roundNum === null) {
      return { id: row.id, thru: null as number | null, scoreToPar: row.total };
    }
    const key = `holes:${tournamentId}:${row.id}`;
    let holeJson = scorecardCache.get(key);
    if (holeJson === undefined) {
      try {
        holeJson = await fetchPlayerHoleScores(tournamentId, row.id);
      } catch {
        holeJson = null;
      }
      scorecardCache.set(key, holeJson);
    }
    if (!holeJson) return { id: row.id, thru: null as number | null, scoreToPar: null as number | null };
    const stats = computeFullRoundStats(holeJson, roundNum);
    return { id: row.id, thru: stats?.thru ?? null, scoreToPar: stats?.scoreToPar ?? null };
  }

  // Auto-lift any suspension whose resume time has already passed, so both
  // the overlay and the fetch-blocking clear on their own.
  let mappingChanged = false;
  for (const key of Object.keys(mapping.tournaments)) {
    const tm = mapping.tournaments[key];
    if (tm.suspendedType && tm.suspendedType !== "none" && tm.suspendedUntil && nowCentralDT >= tm.suspendedUntil) {
      tm.suspendedType = "none";
      mappingChanged = true;
    }
  }
  if (mappingChanged) {
    await redis.set(MAPPING_KEY, mapping);
  }

  // Bets loaded before the recap feature existed have no loadedDate at all.
  // Backfill with today's Central date now, while they're still live, so
  // that whenever they do finish (even after midnight, like a suspended
  // round) they archive under the day they were actually played, not
  // whatever day happens to be current when they finally resolve.
  let loadedDateBackfilled = false;
  for (const bet of bets) {
    if (!bet.loadedDate) {
      bet.loadedDate = todayCentral;
      loadedDateBackfilled = true;
    }
  }

  for (const bet of bets) {
    if (bet.autoEnabled === false) continue;

    // Auto-promote TBD -> IN PROGRESS once its scheduled tee time (Central)
    // arrives - this is what actually opens the door to fetching for it.
    if (!bet.personal && bet.status === "pending") {
      const teeMinutes = timeToMinutes(bet.time);
      const dateReached = !bet.loadedDate || todayCentral >= bet.loadedDate;
      if (dateReached && nowMinutes >= teeMinutes) {
        bet.status = "live";
        updatedCount += 1;
      }
    }

    // Personal plays have no single tee time of their own - instead, they
    // promote the moment any REGULAR bet for the same tournament has
    // itself already gone live (or further, hit/miss) this sync pass,
    // which only happens once that bet's own tee time has actually passed.
    // Until then they stay TBD and are skipped below (no fetch wasted on a
    // tournament that hasn't teed off yet). This deliberately checks the
    // other bets already in this array rather than tracking a separate
    // "tournament start time" field - the tee times you paste in every
    // night already are that signal.
    //
    // This also self-corrects the other direction: a personal bet already
    // sitting at "live" (from before this gate existed, or from manually
    // clicking IN PROGRESS) gets reset to TBD if the tournament genuinely
    // hasn't started yet. That's a one-time fix for anything created before
    // this logic shipped - but it means a deliberate early "IN PROGRESS"
    // click won't stick until the real gate fires either. Never touches a
    // bet you've already settled by hand (hit/miss), only pending/live.
    if (bet.personal && (bet.status === "pending" || bet.status === "live")) {
      const started = bets.some((b) => b.t === bet.t && !b.personal && b.status !== "pending");
      if (started && bet.status === "pending") {
        bet.status = "live";
        updatedCount += 1;
      } else if (!started && bet.status === "live" && !bet.personalManualLive) {
        bet.status = "pending";
        updatedCount += 1;
      }
    }

    if (bet.status === "hit" || bet.status === "miss") continue; // already decided - stop pulling for it
    if (bet.status === "pending") continue; // hasn't teed off yet - nothing to fetch

    const tournamentMap = mapping.tournaments[bet.t];
    if (!tournamentMap?.pgaId) continue;
    if (tournamentMap.suspendedType && tournamentMap.suspendedType !== "none") continue; // play stopped - nothing new to fetch
    const tournamentId = tournamentMap.pgaId;

    try {
      const parsed = parseBetType(bet.bet);

      // Personal plays: a completely separate handling path, but reusing
      // the exact same leaderboard/openPlayers caches as everything else
      // below (same tournament, same dataSource) rather than fetching
      // anything twice.
      if (bet.personal) {
        const useOpen = tournamentMap.dataSource === "theopen";

        if (useOpen) {
          if (!openPlayersCache) {
            const raw = await fetchOpenLeaderboard();
            openPlayersCache = extractOpenPlayers(raw);
          }
        } else if (!leaderboardCache.get(tournamentId)) {
          const raw = await fetchPgaLeaderboard(tournamentId);
          leaderboardCache.set(tournamentId, extractPlayers(raw));
        }
        const openPlayers = useOpen ? openPlayersCache! : null;
        const pgaPlayers = useOpen ? null : leaderboardCache.get(tournamentId)!;

        if (parsed.label === "WINNER" || parsed.label === "TOP_N") {
          // Live position only - both settle by hand per TedBeans' own
          // call, never auto-graded.
          let positions = positionsCache.get(bet.t);
          if (!positions) {
            const entries: PositionEntry[] = useOpen
              ? openPlayers!.map((p) => {
                  const s = computeOpenStats(p, null);
                  return { id: p.id, totalToPar: s.holesPlayed > 0 ? s.totalToPar : null };
                })
              : pgaPlayers!.map((p) => ({ id: p.id, totalToPar: p.total }));
            positions = computePositions(entries);
            positionsCache.set(bet.t, positions);
          }

          const stat = useOpen
            ? await getOpenRoundStat(openPlayers!, bet.player, null)
            : await getPgaRoundStat(tournamentId, pgaPlayers!, bet.player, null);
          if (!stat) {
            errors.push(`${bet.player}: no match on leaderboard (personal play)`);
            continue;
          }

          bet.thru = stat.thru;
          bet.stat = stat.scoreToPar;
          bet.auto = {
            thru: stat.thru,
            scoreToPar: stat.scoreToPar,
            birdies: null, bogeys: null, pars: null, eagles: null, doubleBogeys: null, gir: null, fairways: null,
            updatedAt: new Date().toISOString(),
            position: positions.get(stat.id) ?? null,
          };
          updatedCount += 1;
          continue;
        }

        if (parsed.label === "MAKE_CUT") {
          // Position is informational only (not used for grading - see
          // gradeMakeCut below), but useful context for how safely inside
          // or outside the cut line someone currently sits.
          let positions = positionsCache.get(bet.t);
          if (!positions) {
            const entries: PositionEntry[] = useOpen
              ? openPlayers!.map((p) => {
                  const s = computeOpenStats(p, null);
                  return { id: p.id, totalToPar: s.holesPlayed > 0 ? s.totalToPar : null };
                })
              : pgaPlayers!.map((p) => ({ id: p.id, totalToPar: p.total }));
            positions = computePositions(entries);
            positionsCache.set(bet.t, positions);
          }

          const r1 = useOpen
            ? await getOpenRoundStat(openPlayers!, bet.player, 1)
            : await getPgaRoundStat(tournamentId, pgaPlayers!, bet.player, 1);
          const r2 = useOpen
            ? await getOpenRoundStat(openPlayers!, bet.player, 2)
            : await getPgaRoundStat(tournamentId, pgaPlayers!, bet.player, 2);

          if (!r1) {
            errors.push(`${bet.player}: no match on leaderboard (personal play)`);
            continue;
          }

          const dgCutProb = await getDataGolfCutProb(bet.player);

          // Once Round 1 is fully complete, the more useful "current" line
          // is Round 2's progress - not Round 1's frozen final line. This
          // used to always show r1 regardless of r2, which is how you'd
          // get something like "thru 24" (an 18+6 mashup baked into a
          // single stat that was actually still just Round 1's numbers)
          // once Round 2 got underway, and also why the scorecard popover
          // (which reads bet.r) kept opening Round 1's card even mid Round
          // 2.
          const roundOneFinished = r1.thru === 18;
          const activeRound = roundOneFinished && r2 ? 2 : 1;
          const active = activeRound === 2 ? r2! : r1;

          bet.thru = active.thru;
          bet.stat = active.scoreToPar;
          bet.auto = {
            thru: active.thru,
            scoreToPar: active.scoreToPar,
            birdies: null, bogeys: null, pars: null, eagles: null, doubleBogeys: null, gir: null, fairways: null,
            updatedAt: new Date().toISOString(),
            position: positions.get(active.id) ?? null,
            dgCutProb,
            currentRound: activeRound,
          };

          const graded = gradeMakeCut(
            { thru: r1.thru, scoreToPar: r1.scoreToPar },
            { thru: r2?.thru ?? null, scoreToPar: r2?.scoreToPar ?? null },
            tournamentMap.cutLine
          );
          if (graded) bet.status = graded;

          updatedCount += 1;
          continue;
        }

        if (parsed.label === "H2H" || parsed.label === "TIE") {
          const roundNum = parsed.h2hScope === "round" ? parsed.h2hRoundNum ?? null : null;
          const opponentName = parsed.h2hOpponent || "";

          const subjectStat = useOpen
            ? await getOpenRoundStat(openPlayers!, bet.player, roundNum)
            : await getPgaRoundStat(tournamentId, pgaPlayers!, bet.player, roundNum);
          const opponentStat = useOpen
            ? await getOpenRoundStat(openPlayers!, opponentName, roundNum)
            : await getPgaRoundStat(tournamentId, pgaPlayers!, opponentName, roundNum);

          if (!subjectStat || !opponentStat) {
            errors.push(`${bet.player} vs ${opponentName}: couldn't match both players on the leaderboard`);
            continue;
          }

          bet.thru = subjectStat.thru;
          bet.stat = subjectStat.scoreToPar;
          bet.auto = {
            thru: subjectStat.thru,
            scoreToPar: subjectStat.scoreToPar,
            birdies: null, bogeys: null, pars: null, eagles: null, doubleBogeys: null, gir: null, fairways: null,
            updatedAt: new Date().toISOString(),
            opponentScoreToPar: opponentStat.scoreToPar,
            opponentThru: opponentStat.thru,
          };

          // Round scope: both already fetched for that exact round, so
          // just check both are thru 18. Tournament scope: needs both
          // players to have finished round 4 specifically - a player who
          // missed the cut never reaches round 4, so a missed-cut pairing
          // simply never auto-grades here (safer than guessing at a "made
          // the cut" signal neither feed reliably exposes) and needs
          // settling by hand, same as Winner/Top N already do.
          const FINAL_ROUND = 4;
          let bothFinished: boolean;
          if (parsed.h2hScope === "round") {
            bothFinished = subjectStat.thru === 18 && opponentStat.thru === 18;
          } else {
            const subjectFinal = useOpen
              ? await getOpenRoundStat(openPlayers!, bet.player, FINAL_ROUND)
              : await getPgaRoundStat(tournamentId, pgaPlayers!, bet.player, FINAL_ROUND);
            const opponentFinal = useOpen
              ? await getOpenRoundStat(openPlayers!, opponentName, FINAL_ROUND)
              : await getPgaRoundStat(tournamentId, pgaPlayers!, opponentName, FINAL_ROUND);
            bothFinished = subjectFinal?.thru === 18 && opponentFinal?.thru === 18;
          }

          if (bothFinished && subjectStat.scoreToPar !== null && opponentStat.scoreToPar !== null) {
            if (parsed.label === "TIE") {
              // Here an exact tie IS the win condition - unlike H2H, there's
              // no ambiguity to leave unresolved: any inequality is an
              // unambiguous, immediate loss.
              bet.status = subjectStat.scoreToPar === opponentStat.scoreToPar ? "hit" : "miss";
            } else if (subjectStat.scoreToPar < opponentStat.scoreToPar) {
              bet.status = "hit";
            } else if (subjectStat.scoreToPar > opponentStat.scoreToPar) {
              bet.status = "miss";
            }
            // H2H exact tie: most books push (refund) a head-to-head rather
            // than lose it, and there's no "push" status here yet - leave
            // it for you to settle by hand rather than guessing it as a loss.
          }

          updatedCount += 1;
          continue;
        }

        // Unrecognized personal bet type - shouldn't happen given the
        // parser, but leave it alone rather than guessing at anything.
        continue;
      }

      if (tournamentMap.dataSource === "theopen") {
        // theopen.com's own feed: score/birdies/bogeys/pars are derived
        // directly from hole-by-hole strokes vs par - no second call
        // needed. GIR/Fairways come from a separate `statistics` feed
        // (confirmed shape - see computeOpenGirFairways in
        // lib/openMatch.ts), fetched lazily below only when a GIR bet
        // actually needs it.
        if (!openPlayersCache) {
          const raw = await fetchOpenLeaderboard();
          openPlayersCache = extractOpenPlayers(raw);
        }
        const players = openPlayersCache;

        if (parsed.label === "WINNER_SCORE") {
          const leader = findOpenLeader(players);
          if (!leader) {
            errors.push(`${bet.t}: couldn't find a tournament leader (theopen)`);
            continue;
          }
          const leaderStats = computeOpenStats(leader.player, roundNumberFromLabel(bet.r));
          bet.thru = leaderStats.thru;
          bet.stat = leader.totalToPar;
          bet.auto = {
            thru: leaderStats.thru,
            scoreToPar: leader.totalToPar,
            birdies: null, bogeys: null, pars: null, eagles: null, doubleBogeys: null, gir: null, fairways: null,
            updatedAt: new Date().toISOString(),
            leaderName: leader.player.displayName,
          };
          updatedCount += 1;
          continue;
        }

        const row = findOpenPlayerMatch(bet.player, players);
        if (!row) {
          errors.push(`${bet.player}: no match on theopen.com leaderboard`);
          continue;
        }
        const roundNum = roundNumberFromLabel(bet.r);
        const holeRange: [number, number] | undefined =
          parsed.segment === "front9" ? [1, 9] : parsed.segment === "back9" ? [10, 18] : undefined;
        const stats = computeOpenStats(row, roundNum, holeRange);

        let girFairways: { gir: string | null; girCount: number | null; fairways: string | null; fairwaysCount: number | null } = {
          gir: null,
          girCount: null,
          fairways: null,
          fairwaysCount: null,
        };
        // Fetched for every straight bet on a theopen.com tournament, not
        // just GIR bets - it's useful context for any bet on that player's
        // round, and the statistics feed itself is cached once per
        // tournament per sync pass regardless of how many bets use it.
        if (!openStatsCache) {
          openStatsCache = await fetchOpenStatistics();
        }
        girFairways = computeOpenGirFairways(row, roundNum, openStatsCache);

        bet.thru = stats.thru;
        bet.auto = {
          thru: stats.thru,
          scoreToPar: stats.scoreToPar,
          birdies: stats.birdies,
          bogeys: stats.bogeys,
          pars: stats.pars,
          eagles: stats.eagles,
          doubleBogeys: stats.doubleBogeys,
          gir: girFairways.gir,
          fairways: girFairways.fairways,
          updatedAt: new Date().toISOString(),
        };

        if (parsed.label === "SCORE" && stats.scoreToPar !== null) {
          bet.stat = stats.scoreToPar;
        } else if (parsed.label === "BIRDIES") {
          bet.stat = stats.birdiesOrBetter;
        } else if (parsed.label === "BOGEYS") {
          bet.stat = stats.bogeysOrWorse;
        } else if (parsed.label === "PARS") {
          bet.stat = stats.pars;
        } else if (parsed.label === "GIR" && girFairways.girCount !== null) {
          bet.stat = girFairways.girCount;
        }

        if (bet.status === "live") {
          const graded = autoGradeStatus(parsed, bet.stat, bet.thru);
          if (graded) bet.status = graded;
        }

        updatedCount += 1;
        continue;
      }

      let players = leaderboardCache.get(tournamentId);
      if (!players) {
        const raw = await fetchPgaLeaderboard(tournamentId);
        players = extractPlayers(raw);
        leaderboardCache.set(tournamentId, players);
      }

      // Tournament-long "winning score" bets track whoever is currently in
      // 1st place, not a specific named player - no scorecard fetch needed,
      // and never auto-graded (see autoGradeStatus), so this just updates
      // the live number for you to eyeball and settle by hand.
      if (parsed.label === "WINNER_SCORE") {
        const leader = findLeader(players);
        if (!leader) {
          errors.push(`${bet.t}: couldn't find a tournament leader`);
          continue;
        }
        bet.thru = leader.thru;
        bet.stat = leader.total;
        bet.auto = {
          thru: leader.thru,
          scoreToPar: leader.total,
          birdies: null,
          bogeys: null,
          pars: null,
          eagles: null,
          doubleBogeys: null,
          gir: null,
          fairways: null,
          updatedAt: new Date().toISOString(),
          leaderName: leader.displayName,
        };
        updatedCount += 1;
        continue;
      }

      const row = findPlayerMatch(bet.player, players);
      if (!row) {
        errors.push(`${bet.player}: no match on leaderboard`);
        continue;
      }

      const roundNum = roundNumberFromLabel(bet.r);

      // Front 9 / Back 9 score bets need literal hole numbers 1-9 or
      // 10-18, which the round-aggregate scorecard call doesn't have -
      // this needs the same hole-by-hole data the scorecard popover uses.
      if (parsed.segment) {
        const holeKey = `holes:${tournamentId}:${row.id}`;
        let holeJson = scorecardCache.get(holeKey);
        if (holeJson === undefined) {
          try {
            holeJson = await fetchPlayerHoleScores(tournamentId, row.id);
          } catch {
            holeJson = null;
          }
          scorecardCache.set(holeKey, holeJson);
        }
        const segStats = holeJson ? computeSegmentStats(holeJson, roundNum, parsed.segment) : null;

        bet.thru = segStats?.thru ?? null;
        bet.stat = segStats?.scoreToPar ?? null;
        bet.auto = {
          thru: segStats?.thru ?? null,
          scoreToPar: segStats?.scoreToPar ?? null,
          birdies: null, bogeys: null, pars: null, eagles: null, doubleBogeys: null, gir: null, fairways: null,
          updatedAt: new Date().toISOString(),
        };

        if (bet.status === "live") {
          const graded = autoGradeStatus(parsed, bet.stat, bet.thru);
          if (graded) bet.status = graded;
        }
        updatedCount += 1;
        continue;
      }

      const scorecardKey = `${tournamentId}:${row.id}`;
      let scorecardJson = scorecardCache.get(scorecardKey);
      if (scorecardJson === undefined) {
        try {
          scorecardJson = await fetchPlayerScorecardStats(tournamentId, row.id);
        } catch {
          scorecardJson = null; // don't let a scorecard failure block the score-only bets
        }
        scorecardCache.set(scorecardKey, scorecardJson);
      }
      const scorecard = scorecardJson ? extractScorecardStats(scorecardJson, roundNum) : null;

      bet.thru = row.thru;
      bet.auto = {
        thru: row.thru,
        scoreToPar: row.score,
        birdies: scorecard?.birdies ?? null,
        bogeys: scorecard?.bogeys ?? null,
        pars: scorecard?.pars ?? null,
        eagles: scorecard?.eagles ?? null,
        doubleBogeys: scorecard?.doubleBogeys ?? null,
        gir: scorecard?.gir ?? null,
        fairways: scorecard?.fairways ?? null,
        updatedAt: new Date().toISOString(),
      };

      if (parsed.label === "SCORE" && row.score !== null) {
        bet.stat = row.score;
      } else if (parsed.label === "GIR" && scorecard?.girCount !== null && scorecard?.girCount !== undefined) {
        bet.stat = scorecard.girCount;
      } else if (parsed.label === "BIRDIES" && scorecard?.birdiesOrBetter !== null && scorecard?.birdiesOrBetter !== undefined) {
        // "Birdies or better" bets also count eagles/albatrosses.
        bet.stat = scorecard.birdiesOrBetter;
      } else if (parsed.label === "BOGEYS" && scorecard?.bogeysOrWorse !== null && scorecard?.bogeysOrWorse !== undefined) {
        // "Bogeys or worse" bets also count double-bogeys and up.
        bet.stat = scorecard.bogeysOrWorse;
      } else if (parsed.label === "PARS" && scorecard?.pars !== null && scorecard?.pars !== undefined) {
        bet.stat = scorecard.pars;
      }

      // Only progress a bet forward automatically while it's still live -
      // never overwrite a status you set by hand. (Pending bets already
      // got skipped above, before they ever reach here.)
      if (bet.status === "live") {
        const graded = autoGradeStatus(parsed, bet.stat, bet.thru);
        if (graded) bet.status = graded;
      }

      updatedCount += 1;
    } catch (e: any) {
      errors.push(`${bet.player}: ${e.message || "sync failed"}`);
    }
  }

  // Once every bet in a tournament+round is decided (win or loss), file the
  // whole round away to the recap automatically - but not until the day
  // it was actually played is over, so you can review the full day's
  // record on the live board before it moves to the recap.
  const groupMap: Record<string, Bet[]> = {};
  for (const b of bets) {
    const key = `${b.t}|||${b.r}`;
    (groupMap[key] = groupMap[key] || []).push(b);
  }
  const remaining: Bet[] = [];
  const toArchive: Bet[] = [];
  const archivedAt = new Date().toISOString();
  for (const key of Object.keys(groupMap)) {
    const groupBets = groupMap[key];
    const allDecided = groupBets.every((b) => b.status === "hit" || b.status === "miss");
    const groupDate = groupBets.find((b) => b.loadedDate)?.loadedDate;
    const dayIsOver = !groupDate || groupDate < todayCentral;
    if (allDecided && dayIsOver) {
      groupBets.forEach((b) => toArchive.push({ ...b, archivedAt }));
    } else {
      remaining.push(...groupBets);
    }
  }

  let finalBets = bets;
  let archivedCount = 0;
  if (toArchive.length > 0) {
    const existingArchive = (await redis.get<Bet[]>(ARCHIVE_KEY)) || [];
    await redis.set(ARCHIVE_KEY, [...existingArchive, ...toArchive]);
    finalBets = remaining;
    archivedCount = toArchive.length;
  }

  if (updatedCount > 0 || archivedCount > 0 || loadedDateBackfilled) {
    await redis.set(BETS_KEY, finalBets);
  }

  // Parlays never fetch anything themselves - just re-check each leg
  // against the live bets (post-sync) and the bet archive (which may have
  // just grown above), then file away any parlay that's now fully decided.
  const liveParlays = (await redis.get<Parlay[]>(PARLAYS_KEY)) || [];
  if (liveParlays.length > 0) {
    const archiveForLegs = (await redis.get<Bet[]>(ARCHIVE_KEY)) || [];

    const stillOpen: Parlay[] = [];
    const nowDecided: Parlay[] = [];
    for (const p of liveParlays) {
      if (p.manualStatus) {
        p.status = p.manualStatus;
      } else {
        const legStatuses = resolveLegStatuses(p.legs, finalBets, archiveForLegs);
        p.status = deriveParlayStatus(legStatuses);
      }
      if (p.status === "hit" || p.status === "miss" || p.status === "push") {
        nowDecided.push({ ...p, archivedAt: new Date().toISOString() });
      } else {
        stillOpen.push(p);
      }
    }
    if (nowDecided.length > 0) {
      const existingParlayArchive = (await redis.get<Parlay[]>(PARLAY_ARCHIVE_KEY)) || [];
      await redis.set(PARLAY_ARCHIVE_KEY, [...existingParlayArchive, ...nowDecided]);
    }
    await redis.set(PARLAYS_KEY, stillOpen);
  }

  return noCacheJson({ ok: true, updated: updatedCount, archived: archivedCount, errors });
}
