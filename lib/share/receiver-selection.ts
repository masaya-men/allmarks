/** All non-duplicate card urls start "included" (default = save). */
export function initialIncludeSet(
  cardUrls: ReadonlyArray<string>,
  duplicateUrls: ReadonlySet<string>,
): Set<string> {
  return new Set(cardUrls.filter((u) => !duplicateUrls.has(u)))
}

/** Toggle whether a card is included in the import. Returns a new Set
 *  (does not mutate the input). */
export function toggleInclude(current: ReadonlySet<string>, cardUrl: string): Set<string> {
  const next = new Set(current)
  if (next.has(cardUrl)) next.delete(cardUrl)
  else next.add(cardUrl)
  return next
}

/** Toggle one sender tag id for one card. Returns a new Map with deep-copied
 *  inner Sets (immutable — does not mutate the input map or its Sets). */
export function toggleSenderTag(
  current: ReadonlyMap<string, Set<string>>,
  cardUrl: string,
  senderTagId: string,
): Map<string, Set<string>> {
  const next = new Map<string, Set<string>>()
  for (const [k, v] of current) next.set(k, new Set(v))
  const set = next.get(cardUrl) ?? new Set<string>()
  if (set.has(senderTagId)) set.delete(senderTagId)
  else set.add(senderTagId)
  next.set(cardUrl, set)
  return next
}
