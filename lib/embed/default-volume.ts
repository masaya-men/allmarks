/**
 * Shared default volume preference for every inline player in the app —
 * SoundCloud, YouTube, Vimeo, and Twitter/X HTML5 videos. Persisted to
 * localStorage so a user who turns the volume down on one card sees the
 * same level when they open the next one (across reloads too).
 *
 * Default is 50 because users have repeatedly reported that fresh-load
 * playback at platform-default (= 100 for YouTube/Vimeo, ~80 for
 * SoundCloud, 100 for X) is jarringly loud, especially when opening cards
 * back-to-back in the lightbox.
 *
 * TikTok is intentionally not part of this list because the TikTok embed
 * iframe doesn't expose volume control to outside callers, so we can't
 * honor the preference there.
 */
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'allmarks.player.defaultVolume'
const VOLUME_EVENT = 'allmarks:volume-change'
export const DEFAULT_PLAYER_VOLUME = 50

/** Read the persisted default volume (0–100). Returns 50 when storage is
 *  unavailable (SSR / private mode), missing, or contains an out-of-range
 *  value. Never throws. */
export function getDefaultVolume(): number {
  if (typeof window === 'undefined') return DEFAULT_PLAYER_VOLUME
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === null) return DEFAULT_PLAYER_VOLUME
    const num = Number.parseInt(stored, 10)
    if (Number.isNaN(num) || num < 0 || num > 100) return DEFAULT_PLAYER_VOLUME
    return num
  } catch {
    return DEFAULT_PLAYER_VOLUME
  }
}

/** Persist a new default volume and notify any open `useDefaultVolume`
 *  hooks on the same page so multiple cards stay in sync without needing
 *  a reload. */
export function setDefaultVolume(value: number): void {
  if (typeof window === 'undefined') return
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  try {
    window.localStorage.setItem(STORAGE_KEY, String(clamped))
  } catch {
    // Quota / disabled storage — fall through, in-memory event still works.
  }
  window.dispatchEvent(new CustomEvent(VOLUME_EVENT, { detail: clamped }))
}

/** React hook returning [volume, setVolume]. The hook is kept in sync
 *  with localStorage changes from other components via a custom event
 *  (the native `storage` event only fires cross-tab, not in-page). */
export function useDefaultVolume(): readonly [number, (v: number) => void] {
  const [volume, setVolumeState] = useState<number>(() => getDefaultVolume())
  useEffect(() => {
    const handler = (e: Event): void => {
      if (e instanceof CustomEvent && typeof e.detail === 'number') {
        setVolumeState(e.detail)
      }
    }
    window.addEventListener(VOLUME_EVENT, handler)
    return () => window.removeEventListener(VOLUME_EVENT, handler)
  }, [])
  const setter = (v: number): void => {
    setDefaultVolume(v)
    // Local update is also done by the event, but doing it eagerly
    // keeps the slider thumb responsive during fast drags where the
    // event round-trip would otherwise lag a tick.
    setVolumeState(Math.max(0, Math.min(100, Math.round(v))))
  }
  return [volume, setter] as const
}
