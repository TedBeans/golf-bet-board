// Shared ordering helper for TedBeans' drag-and-drop reordering of personal
// bets and personal parlays. personalOrder stays unset until you actually
// drag something - at that point the admin reorder handler "crystallizes"
// the current display order into explicit personalOrder values for every
// item in that list, so nothing ever silently reshuffles on its own.
export function sortByPersonalOrder<T extends { personalOrder?: number }>(items: T[]): T[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      const ao = a.item.personalOrder ?? Number.MAX_SAFE_INTEGER;
      const bo = b.item.personalOrder ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return a.i - b.i; // stable tie-break by original array position when neither has been ordered yet
    })
    .map(({ item }) => item);
}
