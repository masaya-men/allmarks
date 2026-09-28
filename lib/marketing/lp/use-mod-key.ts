'use client'

import { useSyncExternalStore } from 'react'

/**
 * useModKey — the Mac/iOS paste-shortcut key label ("⌘" vs "Ctrl"), read
 * without ever calling setState inside an effect (task-6 ruling R22; the
 * previous `useState` + `useEffect(() => setModKey('⌘'), [])` in Hero.tsx
 * tripped `react-hooks/set-state-in-effect`).
 *
 * The value never changes during a visit, so `subscribe` is a permanent
 * no-op. `getServerSnapshot` always returns "Ctrl" so the static-export
 * prerender and the hydration pass agree; React reads the real platform via
 * `getSnapshot` right after hydration and switches to "⌘" on Apple devices
 * (decide-after-mount, same as the mock's own `modKey` swap).
 */

function subscribe(): () => void {
  return () => {}
}

function getSnapshot(): '⌘' | 'Ctrl' {
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl'
}

function getServerSnapshot(): '⌘' | 'Ctrl' {
  return 'Ctrl'
}

export function useModKey(): '⌘' | 'Ctrl' {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
