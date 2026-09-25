import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { useReloadOnSyncChange } from './use-reload-on-sync-change'
import { notifySyncCycleFinished, notifySyncCycleStarted } from './sync-events'

describe('useReloadOnSyncChange', () => {
  it('calls reload when a finished cycle reports localChanged:true', () => {
    const reload = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useReloadOnSyncChange(reload))

    act(() => {
      notifySyncCycleStarted()
      notifySyncCycleFinished({ localChanged: true })
    })

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not call reload when a finished cycle reports localChanged:false', () => {
    const reload = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useReloadOnSyncChange(reload))

    act(() => {
      notifySyncCycleStarted()
      notifySyncCycleFinished({ localChanged: false })
    })

    expect(reload).not.toHaveBeenCalled()
  })

  // notifySyncCycleFinished() with no argument at all defaults to localChanged:false
  // (sync-events.ts) — covers any caller that still emits the bare event.
  it('does not call reload when the finished event carries no info at all', () => {
    const reload = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useReloadOnSyncChange(reload))

    act(() => {
      notifySyncCycleStarted()
      notifySyncCycleFinished()
    })

    expect(reload).not.toHaveBeenCalled()
  })

  it('unsubscribes on unmount — a finished event after unmount does not call reload', () => {
    const reload = vi.fn().mockResolvedValue(undefined)
    const { unmount } = renderHook(() => useReloadOnSyncChange(reload))
    unmount()

    act(() => {
      notifySyncCycleStarted()
      notifySyncCycleFinished({ localChanged: true })
    })

    expect(reload).not.toHaveBeenCalled()
  })
})
