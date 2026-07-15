'use client'

import { useSyncExternalStore } from 'react'
import { getThemeMeta } from './theme-registry'
import type { ThemeId } from './types'

function readSignature(): boolean {
  if (typeof document === 'undefined') return false
  const id = document.documentElement.getAttribute('data-theme-id')
  if (!id) return false
  // getThemeMeta indexes THEME_REGISTRY by ThemeId; an unrecognized string
  // (stale attribute, future theme id read by old code, etc.) yields
  // `undefined` at runtime rather than throwing, so guard with `?.`.
  return getThemeMeta(id as ThemeId)?.chromeMotion === 'signature'
}

function subscribe(onChange: () => void): () => void {
  if (typeof document === 'undefined') return () => {}
  const obs = new MutationObserver(onChange)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme-id'] })
  return (): void => obs.disconnect()
}

/**
 * True when the current board theme opts into signature chrome motion
 * (label scramble + RGB glitch). Reacts live to theme switches via the
 * `<html data-theme-id>` attribute (mirrors useIsPaperTheme's observer
 * idiom). SSR / no theme attribute / unknown id → false (quiet).
 */
export function useSignatureChromeMotion(): boolean {
  return useSyncExternalStore(subscribe, readSignature, () => false)
}
