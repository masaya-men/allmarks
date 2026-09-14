import type { IDBPDatabase } from 'idb'
import { runSyncCycle, type SyncCycleResult } from './engine'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

const DEFAULT_DEBOUNCE_MS = 20_000

export interface SyncController {
  markDirty(): void
  flushNow(): Promise<SyncCycleResult>
  start(): void
  stop(): void
}

export function createSyncController(db: DbLike, debounceMs: number = DEFAULT_DEBOUNCE_MS): SyncController {
  let timer: ReturnType<typeof setTimeout> | null = null
  let started = false

  function clearTimer(): void {
    if (timer !== null) { clearTimeout(timer); timer = null }
  }

  async function flushNow(): Promise<SyncCycleResult> {
    clearTimer()
    return runSyncCycle(db)
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

  function start(): void {
    if (started) return
    started = true
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload)
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
    }
  }

  return { markDirty, flushNow, start, stop }
}
