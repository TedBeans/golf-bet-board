import { normalizeName } from "./nameNorm";
import { DpwtGroupScore } from "./dpwt";

function norm(s: string): string {
  return normalizeName(s);
}

function fullName(group: DpwtGroupScore): string {
  const p = group.players[0];
  return p ? `${p.firstName} ${p.lastName}` : "";
}

function lastName(group: DpwtGroupScore): string {
  return group.players[0]?.lastName ?? "";
}

// Same tiered approach as findPlayerMatch/findOpenPlayerMatch/
// findDataGolfPlayerMatch: exact full name, exact last name, last-name
// prefix, substring, then an unambiguous token-set fallback. DP World
// Tour's data gives first/last name as separate fields rather than one
// displayName string, so fullName() joins them first.
export function findDpwtPlayerMatch(betPlayerName: string, groups: DpwtGroupScore[]): DpwtGroupScore | null {
  const target = norm(betPlayerName);
  const tokens = target.split(/\s+/).filter(Boolean);
  const lastToken = tokens[tokens.length - 1];

  let match = groups.find((g) => norm(fullName(g)) === target);
  if (match) return match;

  match = groups.find((g) => norm(lastName(g)) === lastToken);
  if (match) return match;

  match = groups.find((g) => {
    const gLast = norm(lastName(g));
    return gLast.length > 2 && lastToken.length > 2 && (gLast.startsWith(lastToken) || lastToken.startsWith(gLast));
  });
  if (match) return match;

  match = groups.find((g) => norm(fullName(g)).includes(target) || target.includes(norm(lastName(g))));
  if (match) return match;

  const candidates = groups.filter((g) => {
    const gTokens = norm(fullName(g)).split(/\s+/).filter(Boolean);
    if (gTokens.length === 0) return false;
    return tokens.every((t) => gTokens.includes(t)) || gTokens.every((gt) => tokens.includes(gt));
  });
  if (candidates.length === 1) return candidates[0];

  return null;
}
