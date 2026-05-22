/** Rotating-spotlight playback state. Only `cap` cards play (move) at once; the
 *  rest hold their still thumbnail (cheap to composite). The live set rotates so
 *  every visible video eventually gets a turn — this keeps a dense board feeling
 *  alive while bounding the GPU compositing cost to a fixed number of live video
 *  surfaces, which is the one lever a web app has over 4K fill-rate limits.
 *
 *  - `live`  : currently-playing ids, oldest-first (front = next to retire).
 *  - `waiting`: candidates queued for their turn, front = next to promote. */
export type SpotlightState = {
  readonly live: readonly string[]
  readonly waiting: readonly string[]
}

export const EMPTY_SPOTLIGHT: SpotlightState = { live: [], waiting: [] }

/** Reconcile the state to the current candidate set + cap. Runs whenever the
 *  visible/eligible candidates change (scroll, motion toggle, unplayable). Drops
 *  ids that are no longer candidates, enqueues brand-new ones (in the order the
 *  set yields them — the pool yields most-visible first), trims `live` down to
 *  `cap`, then fills any empty live slots from the front of the queue. */
export function reconcileSpotlight(
  prev: SpotlightState,
  candidates: ReadonlySet<string>,
  cap: number,
): SpotlightState {
  const n = Math.max(0, Math.floor(cap))
  const live = prev.live.filter((id) => candidates.has(id))
  const waiting = prev.waiting.filter((id) => candidates.has(id) && !live.includes(id))
  for (const id of candidates) {
    if (!live.includes(id) && !waiting.includes(id)) waiting.push(id)
  }
  // Over cap (e.g. cap lowered / motion off): retire oldest live back to the
  // FRONT of the queue so it replays soonest when room frees up.
  while (live.length > n) waiting.unshift(live.shift() as string)
  // Under cap: fill from the front of the queue.
  while (live.length < n && waiting.length > 0) live.push(waiting.shift() as string)
  return { live, waiting }
}

/** Advance one slot: retire the oldest live card and promote a waiting one. The
 *  card to promote is chosen by `pickIndex(waitingLength)` — defaults to 0 (the
 *  front, i.e. deterministic round-robin, used by tests). The hook passes a
 *  random index so the next-to-play feels unpredictable rather than a fixed
 *  cycle. The retired card is appended to the back AFTER the pick, so it is never
 *  the one promoted this turn (no instant repeat). No-op when nobody is waiting
 *  or the live set isn't full (≤ cap candidates → everyone plays). */
export function rotateSpotlight(
  prev: SpotlightState,
  cap: number,
  pickIndex: (waitingLength: number) => number = () => 0,
): SpotlightState {
  const n = Math.max(0, Math.floor(cap))
  if (prev.waiting.length === 0 || prev.live.length < n || n === 0) return prev
  const live = prev.live.slice()
  const waiting = prev.waiting.slice()
  const retired = live.shift() as string
  const i = Math.min(waiting.length - 1, Math.max(0, Math.floor(pickIndex(waiting.length))))
  const promoted = waiting.splice(i, 1)[0] as string
  live.push(promoted)
  waiting.push(retired)
  return { live, waiting }
}
