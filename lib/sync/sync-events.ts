// lib/sync/sync-events.ts
// Tiny pub/sub so UI mounted independently of the sync engine (SyncPanel) can
// react to a background sync cycle finishing, without either module
// importing the other's React tree. Distinct from sync-signal.ts, which is
// about the OPPOSITE direction (an IndexedDB write telling the controller
// "you're dirty, debounce a cycle") — this is "a cycle just finished,
// whoever's showing sync status should re-read it now".
//
// sync-controller.ts's flushNow() calls notifySyncCycleFinished() once per
// completed cycle (however it was triggered: debounce timer, visibilitychange,
// beforeunload, pagehide, the new online listener, or an explicit manual
// flushNow()). SyncPanel subscribes via onSyncCycleFinished to refresh its
// displayed phase from sync-status instead of only reading it on mount.

type Listener = () => void

const listeners = new Set<Listener>()

/** Called by sync-controller.ts after each completed sync cycle. */
export function notifySyncCycleFinished(): void {
  for (const listener of listeners) listener()
}

/** Subscribe to "a sync cycle just finished". Returns an unsubscribe function
 *  (mirrors the DOM addEventListener/removeEventListener pairing so callers
 *  can just return it from a useEffect). */
export function onSyncCycleFinished(callback: Listener): () => void {
  listeners.add(callback)
  return (): void => { listeners.delete(callback) }
}
