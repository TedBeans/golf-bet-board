// Shared player-name normalization used everywhere we match a bet's
// free-text player name against an external data source (PGA Tour
// leaderboard, theopen.com, DataGolf). Golfer names regularly include
// accented/special Latin characters - Nicolai Højgaard, Ludvig Åberg,
// Adrien Dumont de Chassart, Thorbjørn Olesen, etc. - and different
// sources are inconsistent about whether they render the accented form
// or a plain-ASCII fallback. Stripping diacritics on both sides before
// comparing means the match works regardless of which form either side
// happens to use.
//
// NFD-decomposable accents (é, å, ü, ñ, ...) get stripped by the
// combining-mark regex below. A handful of Latin-extended letters don't
// decompose under NFD at all (ø, æ, ß, ...) and need an explicit map.
const SPECIAL_CHARS: Record<string, string> = {
  ø: "o", Ø: "O",
  æ: "ae", Æ: "AE",
  œ: "oe", Œ: "OE",
  ß: "ss",
  đ: "d", Đ: "D",
  ł: "l", Ł: "L",
  ð: "d", Ð: "D",
  þ: "th", Þ: "Th",
};

export function stripDiacritics(s: string): string {
  const mapped = s.replace(/[øØæÆœŒßđĐłŁðÐþÞ]/g, (c) => SPECIAL_CHARS[c] ?? c);
  return mapped.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeName(s: string): string {
  return stripDiacritics(s).toLowerCase().replace(/\./g, "").trim();
}
