// Converts American odds (e.g. "-112", "+950") into a win multiplier -
// how many units you win per unit risked. Returns null if unparseable.
export function oddsMultiplier(oddsPrice: string | null | undefined): number | null {
  if (!oddsPrice) return null;
  const price = parseInt(oddsPrice, 10);
  if (isNaN(price)) return null;
  return price < 0 ? 100 / Math.abs(price) : price / 100;
}

// Default stake sizing when a wager amount isn't specified: risk however
// much it takes to win exactly 1 unit. A favorite (-112) costs more than
// it pays, so you risk 1.12 to win 1; an underdog (+110) pays more than it
// costs, so you only need to risk 0.91 to win 1.
export function defaultUnitsToWinOne(oddsPrice: string | null | undefined): number {
  if (!oddsPrice) return 1;
  const price = parseInt(oddsPrice, 10);
  if (isNaN(price)) return 1;
  const units = price < 0 ? Math.abs(price) / 100 : 100 / price;
  return Math.round(units * 100) / 100;
}

// Converts a resolved bet's DK price + units risked into a net unit result.
// Positive = units won, negative = units lost. Returns null for anything
// that isn't actually decided yet, or missing odds data.
export function computeUnitResult(
  oddsPrice: string | null | undefined,
  oddsUnits: string | null | undefined,
  status: string
): number | null {
  if (status !== "hit" && status !== "miss") return null;

  const units = oddsUnits ? parseFloat(oddsUnits) : null;
  if (units === null || isNaN(units)) return null;

  if (status === "miss") return -units;

  const multiplier = oddsMultiplier(oddsPrice);
  if (multiplier === null) return null;
  return units * multiplier;
}

export function formatUnits(n: number | null): string {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const rounded = Math.round(n * 100) / 100;
  return rounded > 0 ? `+${rounded}u` : `${rounded}u`;
}
