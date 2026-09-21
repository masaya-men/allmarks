import type { IDBPDatabase } from 'idb'
import { runSyncCycle, type SyncCycleResult } from './engine'
import { withSyncWritesSuppressed } from './sync-signal'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

const DEFAULT_DEBOUNCE_MS = 20_000

export interface SyncController {
  markDirty(): void
  flushNow(): Promise<SyncCycleResult>
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

  function clearTimer(): void {
    if (timer !== null) { clearTimeout(timer); timer = null }
  }

  // Fix I-3: previously 3 of 4 trigger paths discarded flushNow()'s result (`void flushNow()`),
  // so the bundle's two headline safety-valve outcomes (needs-confirmation, vaultConflict:true)
  // never reached any caller on an automatic trigger. onResult now fires exactly once per actual
  // sync cycle, however it was triggered.
  async function flushNow(): Promise<SyncCycleResult> {
    clearTimer()
    if (inFlight) return inFlight
    const promise = (async () => {
      // Suppressed: runSyncCycle writes the pulled/merged snapshot back to
      // IndexedDB, which would otherwise notify itself dirty and loop
      // forever (see sync-signal.ts).
      const result = await withSyncWritesSuppressed(() => runSyncCycle(db))
      onResult?.(result)
      return result
    })()
    inFlight = promise
    try {
      return await promise
    } finally {
      if (inFlight === promise) inFlight = null
    }
  }

  function markDirty(): void {
    clearTimer()
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
