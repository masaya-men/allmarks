/**
 * Single choke point connecting every IndexedDB write
 * (lib/storage/indexeddb.ts's Proxy-wrapped initDB()) to the active
 * SyncController's debounce (lib/sync/sync-controller.ts), without either
 * module importing the other. Mirrors the module-singleton pattern in
 * lib/private/vault-session.ts: a plain module-scope variable is the
 * simplest way for code outside SyncEngineRunner's component tree to reach
 * the SyncController instance living inside its closure.
 *
 * Suppression exists because runSyncCycle() itself writes the pulled/merged
 * snapshot back to IndexedDB (engine.ts's applySnapshotToLocal,
 * device-id.ts, sync-store.ts's status writes). Without it, every completed
 * sync would immediately notify itself dirty again, wait out the debounce,
 * sync again, forever — even with zero user activity.
 */

let activeMarkDirty: (() => void) | null = null
let suppressDepth = 0

export function setSyncMarkDirty(fn: (() => void) | null): void {
  activeMarkDirty = fn
}

export function notifySyncDirty(): void {
  if (suppressDepth > 0) return
  activeMarkDirty?.()
}

/**
 * Wrap a sync cycle's own local-write side effects so they don't re-trigger
 * themselves. Scoped to the cycle's duration only — a genuine user edit
 * that happens to land in that window loses just its near-real-time push
 * (it still writes to IndexedDB normally, and still syncs on the next edit
 * or tab-hide/close), which is no worse than before this feature existed.
 */
export async function withSyncWritesSuppressed<T>(fn: () => Promise<T>): Promise<T> {
  suppressDepth++
  try {
    return await fn()
  } finally {
    suppressDepth--
  }
}
