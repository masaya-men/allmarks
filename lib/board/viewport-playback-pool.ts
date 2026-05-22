/** Pure selection for Tier 1 viewport playback: given each candidate card's
 *  current visibility ratio (0–1) and a concurrency cap, return the ids that
 *  should play, most-visible first. Cards visible by less than `minRatio` are
 *  excluded — a sliver of a card peeking at the screen edge shouldn't claim a
 *  playback slot (the user would see "nothing moving" while an off-screen card
 *  plays). Ties break by id ascending so the active set is stable. */
export function selectActivePlayers(
  ratios: ReadonlyMap<string, number>,
  cap: number,
  minRatio = 0,
): string[] {
  if (cap <= 0) return []
  return [...ratios.entries()]
    .filter(([, r]) => r > 0 && r >= minRatio)
    .sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, cap)
    .map(([id]) => id)
}
