'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  emptyPool,
  promote as promoteState,
  demote as demoteState,
  isActive as isActiveState,
  type PlaybackPoolState,
} from './playback-pool'

/** How long a card keeps playing after the pointer leaves (anti-thrash linger). */
export const LINGER_MS = 800

export type PlaybackPoolApi = {
  isActive: (bookmarkId: string) => boolean
  activeCount: number
  /** Start/refresh playback for a card; cancels any pending stop. */
  promote: (bookmarkId: string) => void
  /** Schedule a stop after LINGER_MS; re-promote cancels it. */
  release: (bookmarkId: string) => void
}

export function usePlaybackPool(lingerMs: number = LINGER_MS): PlaybackPoolApi {
  const [pool, setPool] = useState<PlaybackPoolState>(emptyPool)
  const lingerTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const clearLinger = useCallback((bookmarkId: string): void => {
    const t = lingerTimers.current.get(bookmarkId)
    if (t !== undefined) {
      clearTimeout(t)
      lingerTimers.current.delete(bookmarkId)
    }
  }, [])

  const promote = useCallback((bookmarkId: string): void => {
    clearLinger(bookmarkId)
    setPool((p) => promoteState(p, bookmarkId, Date.now()))
  }, [clearLinger])

  const release = useCallback((bookmarkId: string): void => {
    clearLinger(bookmarkId)
    const t = setTimeout(() => {
      lingerTimers.current.delete(bookmarkId)
      setPool((p) => demoteState(p, bookmarkId))
    }, lingerMs)
    lingerTimers.current.set(bookmarkId, t)
  }, [clearLinger, lingerMs])

  useEffect(() => {
    const timers = lingerTimers.current
    return () => {
      timers.forEach((t) => clearTimeout(t))
      timers.clear()
    }
  }, [])

  return {
    isActive: useCallback((id: string) => isActiveState(pool, id), [pool]),
    activeCount: pool.entries.length,
    promote,
    release,
  }
}
