/** Pure selection for Tier 1 viewport playback: given each candidate card's
 *  current visibility ratio (0–1) and a concurrency cap, return the ids that
 *  should play, most-visible first. Off-screen (ratio <= 0) cards are excluded.
 *  Ties break by id ascending so the active set is stable across recomputes. */
export function selectActivePlayers(
  ratios: ReadonlyMap<string, number>,
  cap: number,
): string[] {
  if (cap <= 0) return []
  return [...ratios.entries()]
    .filter(([, r]) => r > 0)
    .sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, cap)
    .map(([id]) => id)
}
