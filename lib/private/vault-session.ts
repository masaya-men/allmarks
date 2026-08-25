'use client'

import { useSyncExternalStore } from 'react'

/** The unlocked Private vault's tag id + private key, held ONLY in this
 *  module-scoped variable — never written to IndexedDB/localStorage/
 *  sessionStorage. A full page reload or tab close resets this module's
 *  state to null, which is the entire re-lock mechanism (see spec §5.3 —
 *  intentionally no separate "lock now" code path in Phase 1).
 *
 *  Deliberately a plain module singleton (not React Context): BoardRoot
 *  (/board) and TriagePage (/triage) are two independently-mounted route
 *  trees that each need to observe the same "is Private unlocked" state
 *  without a shared ancestor. A client-side route change between them does
 *  NOT reset this module (same JS runtime) — only a hard reload does, which
 *  is the desired "stays unlocked while you navigate the app this session"
 *  behavior. */
export type PrivateVaultSession = { readonly tagId: string; readonly privateKey: CryptoKey } | null

let currentSession: PrivateVaultSession = null
const listeners = new Set<() => void>()

export function getPrivateVaultSession(): PrivateVaultSession {
  return currentSession
}

export function setPrivateVaultSession(session: PrivateVaultSession): void {
  currentSession = session
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return (): void => {
    listeners.delete(listener)
  }
}

/** Reactive read of the current session — re-renders the calling component
 *  whenever setPrivateVaultSession is called anywhere in the app. */
export function usePrivateVaultSession(): PrivateVaultSession {
  return useSyncExternalStore(subscribe, getPrivateVaultSession, () => null)
}
