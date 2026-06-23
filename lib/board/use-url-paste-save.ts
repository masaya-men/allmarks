'use client'
import { useEffect, useRef, useState } from 'react'
import { initDB, getAllBookmarks, saveBookmarkDeduped } from '@/lib/storage/indexeddb'
import { extractSinglePastedUrl, isEditableTarget } from '@/lib/board/paste-url'
import { ingestPastedUrl, fetchOgpMeta, isEmbeddableType } from '@/lib/board/paste-ingest'
import { detectUrlType } from '@/lib/utils/url'
import { SAMPLE_URL } from '@/lib/onboarding/steps'

export type PasteFeedback = { readonly kind: 'loading' | 'duplicate' | null }
const DUPLICATE_MS = 1600

export function useUrlPasteSave(opts: {
  onSaved: (bookmarkId: string) => void | Promise<void>
  /** Document to listen on. Omit for the main board document; pass the PiP
   *  window's document (e.g. `hostRef.current?.ownerDocument`) to ingest
   *  pastes made while the Pop Out window is focused. */
  targetDocument?: Document | null
  /** When this ref reads true at save time AND the pasted URL is the tutorial's
   *  scripted SAMPLE_URL, the saved bookmark is flagged onboardingDemo so it's
   *  swept when the tutorial ends. A *real* link the user pastes during
   *  onboarding (any URL ≠ SAMPLE_URL) is NEVER flagged, so it survives the
   *  sweep (audit rank7 — previously every onboarding-time paste was flagged and
   *  silently deleted). */
  flagOnboardingRef?: { readonly current: boolean }
}): { feedback: PasteFeedback } {
  const [feedback, setFeedback] = useState<PasteFeedback>({ kind: null })
  const onSavedRef = useRef(opts.onSaved)
  onSavedRef.current = opts.onSaved
  // Mirror so the paste handler reads the latest onboarding flag without making
  // `opts.flagOnboardingRef` an effect dependency (the effect re-subscribes only
  // on targetDocument). `.current?.current` = the mirrored ref's live boolean.
  const flagOnboardingRef = useRef(opts.flagOnboardingRef)
  flagOnboardingRef.current = opts.flagOnboardingRef
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
        // Flag ONLY the tutorial's scripted sample paste as a demo card, so the
        // end-of-tutorial sweep removes it. A real link the user pastes while
        // onboarding is showing (url ≠ SAMPLE_URL) stays a real bookmark and is
        // never swept (audit rank7).
        const isDemoPaste = !!flagOnboardingRef.current?.current && url === SAMPLE_URL
        const save: typeof saveBookmarkDeduped = isDemoPaste
          ? (database, input, o) => saveBookmarkDeduped(database, { ...input, onboardingDemo: true }, o)
          : saveBookmarkDeduped
        const result = await ingestPastedUrl(url, { db, getAll: getAllBookmarks, save, fetchOgp: fetchOgpMeta })
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
