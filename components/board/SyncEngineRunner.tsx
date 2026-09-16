'use client'

import { useEffect, type ReactElement } from 'react'
import { initDB } from '@/lib/storage/indexeddb'
import { loadSyncStatus } from '@/lib/sync/sync-store'
import { createSyncController, type SyncController } from '@/lib/sync/sync-controller'

const REVISIT_GAP_MS = 5 * 60 * 1000

/** Headless. Mounted once, unconditionally, at board root (regardless of
 *  whether SETTINGS/SyncPanel is open), so an already-connected device keeps
 *  syncing in the background: pull on launch here, push-ish full cycles on
 *  tab-hide/close via the controller's own visibilitychange/beforeunload
 *  listeners (sync-controller.ts, unchanged), and a re-pull on tab-revisit
 *  after a long-enough gap (handled here, since sync-controller.ts only
 *  reacts to 'hidden', not 'visible'). Renders nothing — SyncPanel is the
 *  only visible surface for sync state, reading it back via sync-store on
 *  its own next mount/read. Wiring markDirty() into write paths for
 *  near-real-time cross-tab sync is deliberately out of scope (see
 *  docs/CURRENT_GOAL.md's "★検討事項"). */
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
    }
  }, [])

  return null
}
