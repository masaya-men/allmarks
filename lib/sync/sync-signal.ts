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
/** db handles whose writes are the running sync cycle's OWN writes (refcounted). */
const suppressedHandles = new Map<object, number>()
let globalDepth = 0
let queuedWhileSuppressed = false

export function setSyncMarkDirty(fn: (() => void) | null): void {
  activeMarkDirty = fn
}

/**
 * Called by every IndexedDB write (indexeddb.ts passes the db handle it went through as `source`).
 * A write through a handle currently registered by withSyncWritesSuppressed(fn, handle) is a sync
 * cycle's own write and is ignored. Any other write is a user change: it is delivered right away,
 * or — inside a legacy handle-less withSyncWritesSuppressed(fn) window — queued and delivered once
 * when that window closes. User writes are never dropped.
 */
export function notifySyncDirty(source?: object): void {
  if (source !== undefined && suppressedHandles.has(source)) return
  if (globalDepth > 0) {
    queuedWhileSuppressed = true
    return
  }
  activeMarkDirty?.()
}

/**
 * True when `source` is a db handle currently registered by withSyncWritesSuppressed(fn, handle) —
 * i.e. the write about to happen is a sync cycle's OWN write (engine.ts's runSyncCycle, or
 * sync-controller.ts's markDirty persisting its own pendingPush marker), not a new local user
 * change. indexeddb.ts's write wrapper uses this (alongside notifySyncDirty) to decide whether to
 * ALSO persist the device-local "unpushed change" marker (sync-store.ts's markPendingPush) for a
 * write — a plain user write must mark it even on a page with no SyncController registered
 * (activeMarkDirty === null there), but a sync cycle applying a pulled/merged snapshot to local
 * IndexedDB must not, or every pull would immediately flag itself as having an unpushed change.
 */
export function isSyncCycleOwnWrite(source?: object): boolean {
  return source !== undefined && suppressedHandles.has(source)
}

/**
 * Runs `fn` so that the sync cycle's own local writes don't re-trigger a sync.
 * - With `handle` (what engine.ts's runSyncCycle uses): only writes made through that db handle
 *   are ignored; user writes through any other handle still notify normally.
 * - Without `handle`: every notification during `fn` is held back and delivered once afterwards
 *   (coalesced), so a user write in that window is delayed, never lost.
 */
export async function withSyncWritesSuppressed<T>(fn: () => Promise<T>, handle?: object): Promise<T> {
  if (handle !== undefined) {
    suppressedHandles.set(handle, (suppressedHandles.get(handle) ?? 0) + 1)
    try {
      return await fn()
    } finally {
      const left = (suppressedHandles.get(handle) ?? 1) - 1
      if (left <= 0) suppressedHandles.delete(handle)
      else suppressedHandles.set(handle, left)
    }
  }
  globalDepth++
  try {
    return await fn()
  } finally {
    globalDepth--
    if (globalDepth === 0 && queuedWhileSuppressed) {
      queuedWhileSuppressed = false
      activeMarkDirty?.()
    }
  }
}
