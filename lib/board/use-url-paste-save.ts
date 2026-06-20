'use client'
import { useEffect, useRef, useState } from 'react'
import { initDB, addBookmark, getAllBookmarks } from '@/lib/storage/indexeddb'
import { extractSinglePastedUrl, isEditableTarget } from '@/lib/board/paste-url'
import { ingestPastedUrl, fetchOgpMeta, isEmbeddableType } from '@/lib/board/paste-ingest'
import { detectUrlType } from '@/lib/utils/url'

export type PasteFeedback = { readonly kind: 'loading' | 'duplicate' | null }
const DUPLICATE_MS = 1600

export function useUrlPasteSave(opts: {
  onSaved: (bookmarkId: string) => void | Promise<void>
  /** Document to listen on. Omit for the main board document; pass the PiP
   *  window's document (e.g. `hostRef.current?.ownerDocument`) to ingest
   *  pastes made while the Pop Out window is focused. */
  targetDocument?: Document | null
  /** When this ref reads true at save time, the saved bookmark is flagged
   *  onboardingDemo so it's swept when the tutorial ends (a paste made while the
   *  first-run onboarding is showing is tutorial content, not a real bookmark). */
  flagOnboardingRef?: { readonly current: boolean }
}): { feedback: PasteFeedback } {
  const [feedback, setFeedback] = useState<PasteFeedback>({ kind: null })
  const onSavedRef = useRef(opts.onSaved)
  onSavedRef.current = opts.onSaved
  const busyRef = useRef(false)
  const dupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const targetDocument = opts.targetDocument

  useEffect(() => {
    const doc = targetDocument ?? (typeof document !== 'undefined' ? document : null)
    if (!doc) return
    const handler = async (e: ClipboardEvent): Promise<void> => {
      if (busyRef.current) return
      if (isEditableTarget(e.target)) return
      const text = e.clipboardData?.getData('text/plain') ?? ''
      const url = extractSinglePastedUrl(text)
      if (!url) return
      e.preventDefault()
      busyRef.current = true
      if (!isEmbeddableType(detectUrlType(url))) setFeedback({ kind: 'loading' })
      try {
        const db = await initDB()
        // Flag onboarding-time pastes so the tutorial sweep removes them and the
        // user's real board is never affected.
        const add: typeof addBookmark = opts.flagOnboardingRef?.current
          ? (database, input) => addBookmark(database, { ...input, onboardingDemo: true })
          : addBookmark
        const result = await ingestPastedUrl(url, { db, getAll: getAllBookmarks, add, fetchOgp: fetchOgpMeta })
        if (result.outcome === 'saved' && result.bookmarkId) {
          setFeedback({ kind: null })
          await onSavedRef.current(result.bookmarkId)
        } else {
          setFeedback({ kind: 'duplicate' })
          if (dupTimerRef.current !== null) clearTimeout(dupTimerRef.current)
          dupTimerRef.current = setTimeout(() => {
            dupTimerRef.current = null
            setFeedback({ kind: null })
          }, DUPLICATE_MS)
        }
      } catch {
        setFeedback({ kind: null })
      } finally {
        busyRef.current = false
      }
    }
    const listener = (e: Event): void => { void handler(e as ClipboardEvent) }
    doc.addEventListener('paste', listener)
    return (): void => {
      doc.removeEventListener('paste', listener)
      if (dupTimerRef.current !== null) {
        clearTimeout(dupTimerRef.current)
        dupTimerRef.current = null
      }
    }
  }, [targetDocument])

  return { feedback }
}
