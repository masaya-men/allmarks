/**
 * Serializes sync cycles so overlapping triggers (background debounce/visibility/pagehide
 * triggers in sync-controller.ts, plus SyncPanel.tsx's direct "Sync now" button, mass-delete
 * "continue anyway" retry, and connectSync's first cycle) never run their Drive PATCH calls
 * concurrently against the same Drive file. Without this, pressing "Sync now" while a
 * background cycle is mid-flight starts a second concurrent cycle racing the same optimistic
 * lock, surfacing as an intermittent SyncConflictError or "drive fetch failed".
 *
 * Waiting callers are queued, not dropped: a call to `withSyncLock` made while another is in
 * flight runs its own `fn` once the earlier one settles (resolved or rejected) — it still
 * performs a fresh cycle rather than reusing the earlier one's result.
 *
 * Uses the cross-tab Web Locks API (`navigator.locks`) when available, so two open tabs also
 * serialize against each other rather than just calls within one tab. Falls back to an
 * in-tab-only module-level promise chain when `navigator.locks` is unavailable (older browsers,
 * and jsdom in tests, which doesn't implement the Web Locks API).
 */

const LOCK_NAME = 'allmarks-sync-cycle'

function hasWebLocks(): boolean {
  return typeof navigator !== 'undefined'
    && typeof navigator.locks !== 'undefined'
    && typeof navigator.locks.request === 'function'
}

// Fallback chain used only when navigator.locks is unavailable. Always settles to a resolved
// state for the NEXT waiter regardless of whether this step's `fn` threw, so one failed cycle
// never permanently blocks the queue (see the `finally` below).
let fallbackChain: Promise<void> = Promise.resolve()

async function withFallbackLock<T>(fn: () => Promise<T>): Promise<T> {
  const previous = fallbackChain
  let release: () => void = () => {}
  fallbackChain = new Promise<void>((resolve) => { release = resolve })
  try {
    await previous
    return await fn()
  } finally {
    release()
  }
}

/** Runs `fn` under an exclusive lock shared by every sync-cycle entry point. Never deadlocks:
 *  both the Web Locks path and the fallback path release the lock in a `finally`, so a `fn` that
 *  throws still lets the next queued caller proceed — it just rejects with `fn`'s own error. */
export async function withSyncLock<T>(fn: () => Promise<T>): Promise<T> {
  if (hasWebLocks()) {
    return navigator.locks.request(LOCK_NAME, { mode: 'exclusive' }, fn)
  }
  return withFallbackLock(fn)
}
