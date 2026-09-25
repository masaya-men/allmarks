import type { IDBPDatabase } from 'idb'
import { runSyncCycle, type SyncCycleResult } from './engine'
import { withSyncWritesSuppressed } from './sync-signal'
import { markPendingPush } from './sync-store'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

/** Quiet period after the last local write before a sync cycle runs (sync format v2: uploads are
 *  now a few KB, so a short debounce keeps devices within ~10s of each other). */
export const DEFAULT_DEBOUNCE_MS = 3_000

export interface SyncCycleOpts {
  readonly skipIfUnchanged?: boolean
}

export interface SyncController {
  markDirty(): void
  flushNow(opts?: SyncCycleOpts): Promise<SyncCycleResult>
  start(): void
  stop(): void
}

export function createSyncController(
  db: DbLike,
  debounceMs: number = DEFAULT_DEBOUNCE_MS,
  onResult?: (result: SyncCycleResult) => void,
): SyncController {
  let timer: ReturnType<typeof setTimeout> | null = null
  let started = false
  // Fix I-4: shared in-flight promise so overlapping triggers (debounce timer, visibilitychange,
  // beforeunload, a manual flushNow()) never start a second concurrent runSyncCycle — they all
  // share the result of whichever cycle is already running.
  let inFlight: Promise<SyncCycleResult> | null = null
  // A local write that landed while a cycle was already running: that cycle may have read local
  // data before the write, so another (debounced) cycle is scheduled once it finishes.
  let dirtyWhileInFlight = false

  function clearTimer(): void {
    if (timer !== null) { clearTimeout(timer); timer = null }
  }

  // Fix I-3: previously 3 of 4 trigger paths discarded flushNow()'s result (`void flushNow()`),
  // so the bundle's two headline safety-valve outcomes (needs-confirmation, vaultConflict:true)
  // never reached any caller on an automatic trigger. onResult now fires exactly once per actual
  // sync cycle, however it was triggered.
  async function flushNow(opts: SyncCycleOpts = {}): Promise<SyncCycleResult> {
    clearTimer()
    if (inFlight) return inFlight
    const promise = (async () => {
      // runSyncCycle suppresses its OWN IndexedDB writes (through `db`) itself, so the
      // pulled/merged snapshot it writes back never re-triggers a sync — while a user write made
      // meanwhile (through any other handle) still reaches markDirty (see sync-signal.ts).
      // Note: runSyncCycle itself emits sync-events.ts's started/finished signals.
      const result = await runSyncCycle(db, opts)
      onResult?.(result)
      return result
    })()
    inFlight = promise
    try {
      return await promise
    } finally {
      if (inFlight === promise) inFlight = null
      if (dirtyWhileInFlight) {
        dirtyWhileInFlight = false
        markDirty()
      }
    }
  }

  function markDirty(): void {
    clearTimer()
    if (inFlight) dirtyWhileInFlight = true
    // Persist "unpushed local change" so a poll never skips it, even across a reload or a failed
    // cycle (sync-status pendingPush). Written through this controller's own handle, suppressed
    // so the marker write itself doesn't count as a user change. Best-effort.
    void withSyncWritesSuppressed(() => markPendingPush(db), db).catch(() => undefined)
    timer = setTimeout(() => { void flushNow() }, debounceMs)
  }

  function handleVisibilityChange(): void {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      void flushNow()
    }
  }

  function handleBeforeUnload(): void {
    void flushNow()
  }

  // pagehide is the more reliable "page is going away" signal on mobile
  // Safari, where beforeunload is known not to fire on app-switch/tab-close.
  // Safe to fire alongside visibilitychange/beforeunload — flushNow()'s
  // inFlight guard already dedupes overlapping triggers.
  function handlePageHide(): void {
    void flushNow()
  }

  function start(): void {
    if (started) return
    started = true
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload)
      window.addEventListener('pagehide', handlePageHide)
    }
  }

  function stop(): void {
    if (!started) return
    started = false
    clearTimer()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }

  return { markDirty, flushNow, start, stop }
}
