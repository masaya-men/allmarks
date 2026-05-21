/** Max simultaneous real hover-playback players (Phase 2 confirmed value). */
export const MAX_HOVER_PLAYERS = 3

export type PoolEntry = {
  readonly bookmarkId: string
  /** ms timestamp of the last promote; used to pick the LRU eviction victim. */
  readonly lastActiveAt: number
}

export type PlaybackPoolState = {
  readonly entries: readonly PoolEntry[]
}

export const emptyPool: PlaybackPoolState = { entries: [] }

export function isActive(state: PlaybackPoolState, bookmarkId: string): boolean {
  return state.entries.some((e) => e.bookmarkId === bookmarkId)
}

/** Add (or refresh) a player. Over capacity → drop the oldest by lastActiveAt. */
export function promote(
  state: PlaybackPoolState,
  bookmarkId: string,
  now: number,
  max: number = MAX_HOVER_PLAYERS,
): PlaybackPoolState {
  if (isActive(state, bookmarkId)) {
    return {
      entries: state.entries.map((e) =>
        e.bookmarkId === bookmarkId ? { ...e, lastActiveAt: now } : e,
      ),
    }
  }
  const next: PoolEntry[] = [...state.entries, { bookmarkId, lastActiveAt: now }]
  if (next.length <= max) return { entries: next }
  const oldest = next.reduce((a, b) => (a.lastActiveAt <= b.lastActiveAt ? a : b))
  return { entries: next.filter((e) => e.bookmarkId !== oldest.bookmarkId) }
}

export function demote(state: PlaybackPoolState, bookmarkId: string): PlaybackPoolState {
  return { entries: state.entries.filter((e) => e.bookmarkId !== bookmarkId) }
}
