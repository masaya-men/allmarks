// lib/sync/sync-events.ts
// Tiny pub/sub so UI mounted independently of the sync engine (SyncPanel) can
// react to a background sync cycle starting/finishing, without either module
// importing the other's React tree. Distinct from sync-signal.ts, which is
// about the OPPOSITE direction (an IndexedDB write telling the controller
// "you're dirty, debounce a cycle") — this is "a cycle just started/finished,
// whoever's showing sync status should update now".
//
// engine.ts's runSyncCycle is the single entry point every trigger passes
// through (background debounce/visibility/pagehide/online listener via
// sync-controller.ts's flushNow, SyncPanel's manual "Sync now"/mass-delete
// "continue anyway", and connectSync's first cycle) — it calls
// notifySyncCycleStarted() the instant its exclusive lock is acquired, and
// notifySyncCycleFinished() in a `finally` right after, so exactly one
// started/finished pair fires per completed cycle regardless of how it was
// triggered or whether it threw. SyncPanel subscribes via onSyncCycleStarted/
// onSyncCycleFinished to refresh its displayed phase instead of only reading
// it on mount, and can also poll isSyncCycleInFlight() once on mount to catch
// a cycle that was already running before the panel existed.

type Listener = () => void

const finishedListeners = new Set<Listener>()
const startedListeners = new Set<Listener>()

// A counter, not a boolean, so overlapping/queued cycles (e.g. a second
// runSyncCycle call queued behind sync-lock.ts's exclusive lock) are tracked
// correctly: in-flight stays true until every started() has a matching
// finished(). Guarded to never go negative (a stray finished() with no
// matching started() is a no-op, not a state that reads as "in flight").
let inFlightCount = 0

/** Called by engine.ts's runSyncCycle the instant it acquires the sync lock, before running the
 *  cycle's body. */
export function notifySyncCycleStarted(): void {
  inFlightCount++
  for (const listener of startedListeners) listener()
}

/** Called by engine.ts's runSyncCycle in a `finally`, after the cycle's body settles (resolved or
 *  thrown), exactly once per notifySyncCycleStarted() call. */
export function notifySyncCycleFinished(): void {
  if (inFlightCount > 0) inFlightCount--
  for (const listener of finishedListeners) listener()
}

/** Subscribe to "a sync cycle just started". Returns an unsubscribe function (mirrors the DOM
 *  addEventListener/removeEventListener pairing so callers can just return it from a useEffect). */
export function onSyncCycleStarted(callback: Listener): () => void {
  startedListeners.add(callback)
  return (): void => { startedListeners.delete(callback) }
}

/** Subscribe to "a sync cycle just finished". Returns an unsubscribe function (mirrors the DOM
 *  addEventListener/removeEventListener pairing so callers can just return it from a useEffect). */
export function onSyncCycleFinished(callback: Listener): () => void {
  finishedListeners.add(callback)
  return (): void => { finishedListeners.delete(callback) }
}

/** True from the moment a cycle's notifySyncCycleStarted() fires until its matching
 *  notifySyncCycleFinished() fires. Lets a component mounting mid-cycle (e.g. SyncPanel opening
 *  while a background cycle triggered before it existed is still running) catch up immediately
 *  instead of waiting for that cycle's finished event. */
export function isSyncCycleInFlight(): boolean {
  return inFlightCount > 0
}
