/**
 * SoundCloud Widget API loader + minimal typings.
 *
 * SoundCloud's player iframe responds to JS commands from the parent
 * window, but only after we load their Widget API script
 * (`w.soundcloud.com/player/api.js`) which injects a `window.SC.Widget`
 * factory. The factory wraps any SoundCloud iframe in an object that
 * speaks postMessage with the iframe behind the scenes — we don't have
 * to deal with the message format directly.
 *
 * We lazy-load the script the first time a SoundCloud embed mounts so a
 * board with zero SoundCloud cards never pays the script cost.
 */

export type SoundCloudWidget = {
  bind: (event: string, callback: () => void) => void
  unbind: (event: string) => void
  setVolume: (value: number) => void
  getVolume: (callback: (value: number) => void) => void
  play: () => void
  pause: () => void
}

type SoundCloudGlobal = {
  Widget: {
    (iframe: HTMLIFrameElement): SoundCloudWidget
    Events: {
      READY: string
      PLAY: string
      PAUSE: string
      FINISH: string
    }
  }
}

declare global {
  interface Window {
    SC?: SoundCloudGlobal
  }
}

const SCRIPT_SRC = 'https://w.soundcloud.com/player/api.js'
let loadPromise: Promise<SoundCloudGlobal> | null = null

/** Inject the Widget API script (once per page) and resolve with the
 *  global `window.SC` once it's available. Safe to call concurrently —
 *  multiple callers share the same promise. */
export function loadSoundCloudWidget(): Promise<SoundCloudGlobal> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('SoundCloud Widget API requires a browser environment'))
  }
  if (window.SC) return Promise.resolve(window.SC)
  if (loadPromise) return loadPromise

  loadPromise = new Promise<SoundCloudGlobal>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = (): void => {
      if (window.SC) {
        resolve(window.SC)
      } else {
        loadPromise = null
        reject(new Error('SoundCloud Widget API loaded but window.SC is missing'))
      }
    }
    script.onerror = (): void => {
      loadPromise = null
      reject(new Error('Failed to load SoundCloud Widget API script'))
    }
    document.head.appendChild(script)
  })
  return loadPromise
}
