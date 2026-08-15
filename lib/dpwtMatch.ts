import { normalizeName } from "./nameNorm";

function norm(s: string): string {
  return normalizeName(s);
}

// Same tiered approach as findPlayerMatch/findOpenPlayerMatch/
// findDataGolfPlayerMatch: exact full name, exact last name, last-name
// prefix, substring, then an unambiguous token-set fallback. Works against
// the roster map seeded in Admin (see parseDpwtRosterCapture) rather than
// a live leaderboard row, since there's no single-call full-field feed
// for this tour - see lib/dpwt.ts header comment for why.
export function findDpwtPlayerId(betPlayerName: string, players: Record<string, number>): number | null {
  const target = norm(betPlayerName);
  const tokens = target.split(/\s+/).filter(Boolean);
  const lastToken = tokens[tokens.length - 1];
  const entries = Object.entries(players);

  const lastNameOf = (fullName: string) => fullName.split(/\s+/).slice(-1)[0] ?? "";

  let match = entries.find(([name]) => norm(name) === target);
  if (match) return match[1];

  match = entries.find(([name]) => norm(lastNameOf(name)) === lastToken);
  if (match) return match[1];

  match = entries.find(([name]) => {
    const nLast = norm(lastNameOf(name));
    return nLast.length > 2 && lastToken.length > 2 && (nLast.startsWith(lastToken) || lastToken.startsWith(nLast));
  });
  if (match) return match[1];

  match = entries.find(([name]) => norm(name).includes(target) || target.includes(norm(lastNameOf(name))));
  if (match) return match[1];

  const candidates = entries.filter(([name]) => {
    const nTokens = norm(name).split(/\s+/).filter(Boolean);
    if (nTokens.length === 0) return false;
    return tokens.every((t) => nTokens.includes(t)) || nTokens.every((nt) => tokens.includes(nt));
  });
  if (candidates.length === 1) return candidates[0][1];

  return null;
}
