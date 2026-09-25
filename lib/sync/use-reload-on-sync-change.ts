'use client'

import { useEffect } from 'react'
import { onSyncCycleFinished } from './sync-events'

/**
 * Makes a synced-in bookmark/tag/card show up on the board without a manual page reload.
 *
 * Subscribes to sync-events.ts's onSyncCycleFinished and calls `reload` whenever a completed
 * sync cycle actually wrote pulled/merged data into local IndexedDB that differs from what was
 * there before (SyncCycleResult.localChanged / SyncCycleFinishedInfo.localChanged). Skips the
 * reload entirely when a cycle finished with nothing new (dirty-write pushes, the
 * skipIfUnchanged poll fast path, not-connected/error/needs-confirmation results) — reload() is
 * a real IDB read + several setState calls, so this avoids running it on every timer poll.
 *
 * Safe against feedback loops: `reload` (lib/storage/use-board-data.ts) only reads IndexedDB, it
 * never writes, so calling it here can never itself trigger sync-signal.ts's dirty-write hook and
 * queue another sync cycle.
 *
 * Mount this once at board root (see BoardRoot.tsx, alongside <SyncEngineRunner />) with the
 * `reload` returned by useBoardData().
 */
export function useReloadOnSyncChange(reload: () => Promise<void>): void {
  useEffect(() => {
    return onSyncCycleFinished((info) => {
      if (info.localChanged) void reload()
    })
  }, [reload])
}
