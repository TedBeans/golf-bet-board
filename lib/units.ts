// Converts American odds (e.g. "-112", "+950") into a win multiplier -
// how many units you win per unit risked. Returns null if unparseable.
export function oddsMultiplier(oddsPrice: string | null | undefined): number | null {
  if (!oddsPrice) return null;
  const price = parseInt(oddsPrice, 10);
  if (isNaN(price)) return null;
  return price < 0 ? 100 / Math.abs(price) : price / 100;
}

// Default stake when a wager amount isn't specified, matching how
// American odds are defined: whichever side of the bet is "$100" is the
// 1-unit baseline. A favorite (-112) risks more than it pays, so the stake
// itself is scaled up (1.12 to win 1.00). An underdog (+112) risks the
// flat 1-unit baseline and pays out more (1 to win 1.12) - the stake stays
// at 1, it's the win amount that scales, not the other way around.
export function defaultUnitsToWinOne(oddsPrice: string | null | undefined): number {
  if (!oddsPrice) return 1;
  const price = parseInt(oddsPrice, 10);
  if (isNaN(price)) return 1;
  if (price >= 0) return 1;
  return Math.round((Math.abs(price) / 100) * 100) / 100;
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

// Same idea as computeUnitResult but for a parlay as a whole - status here
// can also be "push" (a manual-only outcome, never auto-derived from legs):
// half the wager pays out at the parlay's listed odds, the other half is
// simply refunded rather than lost, which is the standard meaning of a
// "half win" when one leg of a parlay turns out to have pushed.
export function computeParlayUnitResult(
  oddsPrice: string | null | undefined,
  wagerUnits: number,
  status: "pending" | "live" | "hit" | "miss" | "push"
): number | null {
  if (status === "hit" || status === "push") {
    const multiplier = oddsMultiplier(oddsPrice);
    if (multiplier === null) return null;
    const fullWin = wagerUnits * multiplier;
    return status === "push" ? fullWin / 2 : fullWin;
  }
  if (status === "miss") return -wagerUnits;
  return null;
}
