'use client'

import { useEffect, type ReactElement } from 'react'
import { initDB } from '@/lib/storage/indexeddb'
import { loadSyncStatus } from '@/lib/sync/sync-store'
import { createSyncController, type SyncController } from '@/lib/sync/sync-controller'
import { setSyncMarkDirty } from '@/lib/sync/sync-signal'

/** How often to poll for remote changes while the tab is visible. Each poll runs the engine's
 *  skipIfUnchanged fast path (engine.ts's isRemoteUnchanged): one cheap Drive folder listing, no
 *  downloads, unless something actually changed remotely — so a short interval here is safe. */
const POLL_INTERVAL_MS = 30_000

/** Headless. Mounted once, unconditionally, at board root (regardless of
 *  whether SETTINGS/SyncPanel is open), so an already-connected device keeps
 *  syncing in the background: pull on launch here, push-ish full cycles on
 *  tab-hide/close/pagehide via the controller's own visibilitychange/
 *  beforeunload/pagehide listeners (sync-controller.ts), an immediate
 *  skip-if-unchanged check on tab-revisit, and a skip-if-unchanged poll every
 *  POLL_INTERVAL_MS while the tab stays visible (both handled here, since
 *  sync-controller.ts only reacts to 'hidden', not 'visible'). Renders
 *  nothing — SyncPanel is the only visible surface for sync state, reading
 *  it back via sync-store on its own next mount/read.
 *
 *  Registers this mount's controller.markDirty as the active target of
 *  lib/sync/sync-signal.ts's notifySyncDirty() — indexeddb.ts's initDB()
 *  wraps every write so it calls notifySyncDirty() automatically, which
 *  resets this controller's debounce timer. This is how near-real-time
 *  sync is wired up without instrumenting every write call site by hand. */
export function SyncEngineRunner(): ReactElement | null {
  useEffect(() => {
    let cancelled = false
    let controller: SyncController | null = null
    let pollTimer: ReturnType<typeof setInterval> | null = null

    function startPolling(): void {
      if (pollTimer !== null) return
      pollTimer = setInterval(() => {
        if (!controller) return
        void controller.flushNow({ skipIfUnchanged: true })
      }, POLL_INTERVAL_MS)
    }
    function stopPolling(): void {
      if (pollTimer !== null) { clearInterval(pollTimer); pollTimer = null }
    }

    void (async (): Promise<void> => {
      try {
        const db = await initDB()
        const status = await loadSyncStatus(db)
        if (cancelled || !status.connected) return
        controller = createSyncController(db)
        setSyncMarkDirty(controller.markDirty)
        controller.start()
        void controller.flushNow()
        if (document.visibilityState === 'visible') startPolling()
      } catch (e) {
        console.error('[AllMarks] sync engine failed to start', e)
      }
    })()

    // Sooner pickup: no more "only re-check after a 5-minute gap" — every return to the tab
    // triggers an immediate skip-if-unchanged check (cheap: one Drive listing, no downloads
    // unless something actually changed), and polling resumes for as long as the tab stays
    // visible. Polling pauses the instant the tab goes hidden.
    function handleVisible(): void {
      if (!controller) return
      if (document.visibilityState === 'visible') {
        void controller.flushNow({ skipIfUnchanged: true })
        startPolling()
      } else {
        stopPolling()
      }
    }
    document.addEventListener('visibilitychange', handleVisible)

    // The evidence behind this task's whole bundle: some Drive fetches fail as a genuine
    // network error (browser CORS/net::ERR_FAILED when truly offline), which classifySyncError
    // buckets as 'network' and SyncPanel then shows as "offline, will sync automatically when
    // back online" — but nothing was actually listening for the browser telling us we're back
    // online again. This is that listener: as soon as connectivity returns, flush right away
    // instead of waiting for the next debounced write or tab-hide.
    function handleOnline(): void {
      if (!controller) return
      void controller.flushNow()
    }
    window.addEventListener('online', handleOnline)

    return (): void => {
      cancelled = true
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisible)
      window.removeEventListener('online', handleOnline)
      controller?.stop()
      setSyncMarkDirty(null)
    }
  }, [])

  return null
}
