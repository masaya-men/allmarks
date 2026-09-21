'use client'

import { useEffect, type ReactElement } from 'react'
import { initDB } from '@/lib/storage/indexeddb'
import { loadSyncStatus } from '@/lib/sync/sync-store'
import { createSyncController, type SyncController } from '@/lib/sync/sync-controller'
import { setSyncMarkDirty } from '@/lib/sync/sync-signal'

const REVISIT_GAP_MS = 5 * 60 * 1000

/** Headless. Mounted once, unconditionally, at board root (regardless of
 *  whether SETTINGS/SyncPanel is open), so an already-connected device keeps
 *  syncing in the background: pull on launch here, push-ish full cycles on
 *  tab-hide/close/pagehide via the controller's own visibilitychange/
 *  beforeunload/pagehide listeners (sync-controller.ts), and a re-pull on
 *  tab-revisit after a long-enough gap (handled here, since
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

    void (async (): Promise<void> => {
      try {
        const db = await initDB()
        const status = await loadSyncStatus(db)
        if (cancelled || !status.connected) return
        controller = createSyncController(db)
        setSyncMarkDirty(controller.markDirty)
        controller.start()
        void controller.flushNow()
      } catch (e) {
        console.error('[AllMarks] sync engine failed to start', e)
      }
    })()

    function handleVisible(): void {
      if (document.visibilityState !== 'visible' || !controller) return
      void (async (): Promise<void> => {
        const db = await initDB()
        const status = await loadSyncStatus(db)
        if (cancelled || !controller) return
        if (!status.lastSyncAt || Date.now() - status.lastSyncAt >= REVISIT_GAP_MS) {
          void controller.flushNow()
        }
      })()
    }
    document.addEventListener('visibilitychange', handleVisible)

    return (): void => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisible)
      controller?.stop()
      setSyncMarkDirty(null)
    }
  }, [])

  return null
}
