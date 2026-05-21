'use client'

import { useCallback, useEffect, useRef } from 'react'

/** Industry-standard hover-intent dwell (NN/g, Baymard). */
export const HOVER_INTENT_MS = 300

export type HoverIntentApi = {
  start: (bookmarkId: string) => void
  cancel: () => void
}

export function useHoverIntent(
  onIntent: (bookmarkId: string) => void,
  delayMs: number = HOVER_INTENT_MS,
): HoverIntentApi {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onIntentRef = useRef(onIntent)
  useEffect(() => { onIntentRef.current = onIntent }, [onIntent])

  const cancel = useCallback((): void => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const start = useCallback((bookmarkId: string): void => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      onIntentRef.current(bookmarkId)
    }, delayMs)
  }, [delayMs])

  useEffect(() => cancel, [cancel])

  return { start, cancel }
}
