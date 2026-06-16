const CHANNEL_NAME = 'booklage'

export type BookmarkSavedMessage = {
  readonly type: 'bookmark-saved'
  readonly bookmarkId: string
}

export type BookmarkDeletedMessage = {
  readonly type: 'bookmark-deleted'
  readonly bookmarkId: string
}

export function postBookmarkSaved(payload: { bookmarkId: string }): void {
  if (typeof BroadcastChannel === 'undefined') return
  try {
    const ch = new BroadcastChannel(CHANNEL_NAME)
    ch.postMessage({ type: 'bookmark-saved', bookmarkId: payload.bookmarkId } satisfies BookmarkSavedMessage)
    ch.close()
  } catch {
    /* ignore */
  }
}

export function subscribeBookmarkSaved(
  handler: (msg: { bookmarkId: string }) => void,
): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  const ch = new BroadcastChannel(CHANNEL_NAME)
  const listener = (ev: MessageEvent): void => {
    const data = ev.data as Partial<BookmarkSavedMessage> | null
    if (!data || data.type !== 'bookmark-saved' || !data.bookmarkId) return
    handler({ bookmarkId: data.bookmarkId })
  }
  ch.addEventListener('message', listener)
  return (): void => {
    ch.removeEventListener('message', listener)
    ch.close()
  }
}

export type BookmarkUpdatedMessage = {
  readonly type: 'bookmark-updated'
  readonly bookmarkId: string
}

// Fired when an EXISTING bookmark's data changes (e.g., a tag added from the
// extension's quick-tag strip) so an open board re-reads and reflects it.
// Distinct from 'bookmark-saved' on purpose: it triggers a plain reload WITHOUT
// the new-card entrance highlight (board) or the session-buffer append (PiP),
// which are save-only reactions and would mis-fire on a mere update.
export function postBookmarkUpdated(payload: { bookmarkId: string }): void {
  if (typeof BroadcastChannel === 'undefined') return
  try {
    const ch = new BroadcastChannel(CHANNEL_NAME)
    ch.postMessage({ type: 'bookmark-updated', bookmarkId: payload.bookmarkId } satisfies BookmarkUpdatedMessage)
    ch.close()
  } catch {
    /* ignore */
  }
}

export function subscribeBookmarkUpdated(
  handler: (msg: { bookmarkId: string }) => void,
): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  const ch = new BroadcastChannel(CHANNEL_NAME)
  const listener = (ev: MessageEvent): void => {
    const data = ev.data as Partial<BookmarkUpdatedMessage> | null
    if (!data || data.type !== 'bookmark-updated' || !data.bookmarkId) return
    handler({ bookmarkId: data.bookmarkId })
  }
  ch.addEventListener('message', listener)
  return (): void => {
    ch.removeEventListener('message', listener)
    ch.close()
  }
}

// Soft-delete sibling of postBookmarkSaved. Same channel, different type so a
// single subscriber can choose which lifecycle event to react to. Used by the
// PiP companion to drop a card from its session buffer when the user deletes
// the bookmark on the main board.
export function postBookmarkDeleted(payload: { bookmarkId: string }): void {
  if (typeof BroadcastChannel === 'undefined') return
  try {
    const ch = new BroadcastChannel(CHANNEL_NAME)
    ch.postMessage({ type: 'bookmark-deleted', bookmarkId: payload.bookmarkId } satisfies BookmarkDeletedMessage)
    ch.close()
  } catch {
    /* ignore */
  }
}

export function subscribeBookmarkDeleted(
  handler: (msg: { bookmarkId: string }) => void,
): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  const ch = new BroadcastChannel(CHANNEL_NAME)
  const listener = (ev: MessageEvent): void => {
    const data = ev.data as Partial<BookmarkDeletedMessage> | null
    if (!data || data.type !== 'bookmark-deleted' || !data.bookmarkId) return
    handler({ bookmarkId: data.bookmarkId })
  }
  ch.addEventListener('message', listener)
  return (): void => {
    ch.removeEventListener('message', listener)
    ch.close()
  }
}
