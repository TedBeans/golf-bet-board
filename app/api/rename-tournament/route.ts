import { NextRequest, NextResponse } from "next/server";
import { redis, BETS_KEY, ARCHIVE_KEY, PARLAYS_KEY, PARLAY_ARCHIVE_KEY, MAPPING_KEY } from "../../../lib/redis";
import { Bet } from "../../../lib/seed";
import { Parlay } from "../../../lib/parlay";
import { Mapping, EMPTY_MAPPING } from "../../../lib/mapping";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// General-purpose rename, for when a tournament itself changes name mid-season
// (sponsorship swap, venue-driven rebrand, etc.) rather than the punctuation-only
// cleanup fix-tournament-names/route.ts handles. Renames `from` -> `to` wherever
// the tournament name is stored as a string (bets, archive, both parlay
// collections) AND moves its mapping.tournaments[from] config block over to `to`
// (pgaId, dpwt ids, course facts, dates, etc.) - skipping that move if `to`
// already has its own mapping entry, so a rename never silently clobbers config
// someone already set up for the new name.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { passcode, from, to } = body as { passcode: string; from: string; to: string };

  if (!passcode || passcode !== process.env.EDIT_PASSCODE) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }
  const fromClean = (from || "").trim();
  const toClean = (to || "").trim();
  if (!fromClean || !toClean) {
    return NextResponse.json({ error: "Both the old and new tournament name are required" }, { status: 400 });
  }
  if (fromClean === toClean) {
    return NextResponse.json({ error: "Old and new name are the same" }, { status: 400 });
  }

  const [bets, archive, liveParlays, parlayArchive, mapping] = await Promise.all([
    redis.get<Bet[]>(BETS_KEY),
    redis.get<Bet[]>(ARCHIVE_KEY),
    redis.get<Parlay[]>(PARLAYS_KEY),
    redis.get<Parlay[]>(PARLAY_ARCHIVE_KEY),
    redis.get<Mapping>(MAPPING_KEY),
  ]);

  let betsChanged = 0;
  let archiveChanged = 0;
  let parlayLegsChanged = 0;
  let mappingMoved = false;
  let mappingSkipped = false;

  function renameBetList(list: Bet[] | null): { list: Bet[] | null; changed: number } {
    if (!list) return { list, changed: 0 };
    let changed = 0;
    const next = list.map((b) => {
      if (b.t === fromClean) {
        changed++;
        return { ...b, t: toClean };
      }
      return b;
    });
    return { list: next, changed };
  }

  function renameParlayList(list: Parlay[] | null): { list: Parlay[] | null; changed: number } {
    if (!list) return { list, changed: 0 };
    let changed = 0;
    const next = list.map((p) => ({
      ...p,
      legs: p.legs.map((leg) => {
        if (leg.tournament === fromClean) {
          changed++;
          return { ...leg, tournament: toClean };
        }
        return leg;
      }),
    }));
    return { list: next, changed };
  }

  const betsFixed = renameBetList(bets);
  const archiveFixed = renameBetList(archive);
  const liveParlaysFixed = renameParlayList(liveParlays);
  const parlayArchiveFixed = renameParlayList(parlayArchive);

  betsChanged = betsFixed.changed;
  archiveChanged = archiveFixed.changed;
  parlayLegsChanged = liveParlaysFixed.changed + parlayArchiveFixed.changed;

  const currentMapping = mapping || EMPTY_MAPPING;
  let nextMapping = currentMapping;
  if (currentMapping.tournaments[fromClean]) {
    if (currentMapping.tournaments[toClean]) {
      // `to` already has its own config (e.g. someone pre-added it) - don't
      // overwrite it, just drop the old key so it's not left dangling.
      mappingSkipped = true;
      const { [fromClean]: _drop, ...rest } = currentMapping.tournaments;
      nextMapping = { ...currentMapping, tournaments: rest };
    } else {
      mappingMoved = true;
      const { [fromClean]: moved, ...rest } = currentMapping.tournaments;
      nextMapping = { ...currentMapping, tournaments: { ...rest, [toClean]: moved } };
    }
  }

  const writes: Promise<any>[] = [];
  if (betsFixed.changed > 0) writes.push(redis.set(BETS_KEY, betsFixed.list));
  if (archiveFixed.changed > 0) writes.push(redis.set(ARCHIVE_KEY, archiveFixed.list));
  if (liveParlaysFixed.changed > 0) writes.push(redis.set(PARLAYS_KEY, liveParlaysFixed.list));
  if (parlayArchiveFixed.changed > 0) writes.push(redis.set(PARLAY_ARCHIVE_KEY, parlayArchiveFixed.list));
  if (mappingMoved || mappingSkipped) writes.push(redis.set(MAPPING_KEY, nextMapping));
  await Promise.all(writes);

  return NextResponse.json({
    ok: true,
    from: fromClean,
    to: toClean,
    betsChanged,
    archiveChanged,
    parlayLegsChanged,
    mappingMoved,
    mappingSkipped,
  });
}
