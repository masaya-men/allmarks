'use client'
import { useEffect, useRef, useState } from 'react'
import { initDB, getAllBookmarks, saveBookmarkDeduped } from '@/lib/storage/indexeddb'
import { ingestPastedUrl, fetchOgpMeta, isEmbeddableType } from '@/lib/board/paste-ingest'
import { detectUrlType } from '@/lib/utils/url'
import { SAMPLE_URL } from '@/lib/onboarding/steps'

export type SaveOutcome = 'saved' | 'duplicate'
export type PasteFeedback = { readonly kind: 'loading' | 'duplicate' | null }
export type PerformSave = (
  url: string,
  flagDemo: boolean,
) => Promise<{ outcome: SaveOutcome; bookmarkId: string | null }>

const DUPLICATE_MS = 1600

/** Real save: opens the DB and runs the ingest pipeline (dedup / OGP / save). */
const defaultPerformSave: PerformSave = async (url, flagDemo) => {
  const db = await initDB()
  const save: typeof saveBookmarkDeduped = flagDemo
    ? (database, input, o) => saveBookmarkDeduped(database, { ...input, onboardingDemo: true }, o)
    : saveBookmarkDeduped
  const result = await ingestPastedUrl(url, { db, getAll: getAllBookmarks, save, fetchOgp: fetchOgpMeta })
  return { outcome: result.outcome, bookmarkId: result.bookmarkId }
}

/** Save core shared by every URL entry (global paste, mobile + button, input
 *  sheet, Android share receiver). Owns the feedback state machine (SAVING /
 *  duplicate pill) and the onSaved callback. Does NOT attach any paste
 *  listener — callers pass an already-validated URL to saveUrl(). */
export function useSaveUrl(opts: {
  onSaved: (bookmarkId: string) => void | Promise<void>
  /** When current is true AND the url is the tutorial SAMPLE_URL, flag the saved
   *  bookmark as an onboarding demo so the end-of-tutorial sweep removes it. */
  flagOnboardingRef?: { readonly current: boolean }
  /** Injectable for tests; defaults to the real DB-backed ingest. */
  performSave?: PerformSave
}): { feedback: PasteFeedback; saveUrl: (url: string) => Promise<SaveOutcome> } {
  const [feedback, setFeedback] = useState<PasteFeedback>({ kind: null })
  const onSavedRef = useRef(opts.onSaved)
  onSavedRef.current = opts.onSaved
  const flagOnboardingRef = useRef(opts.flagOnboardingRef)
  flagOnboardingRef.current = opts.flagOnboardingRef
  const performSaveRef = useRef(opts.performSave ?? defaultPerformSave)
  performSaveRef.current = opts.performSave ?? defaultPerformSave
  const busyRef = useRef(false)
  const dupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return (): void => {
      if (dupTimerRef.current !== null) clearTimeout(dupTimerRef.current)
    }
  }, [])

  const saveUrl = async (url: string): Promise<SaveOutcome> => {
    if (busyRef.current) return 'duplicate'
    busyRef.current = true
    // Rich embeds (tweet/youtube/…) skip the OGP fetch, so no SAVING spinner.
    if (!isEmbeddableType(detectUrlType(url))) setFeedback({ kind: 'loading' })
    try {
      const flagDemo = !!flagOnboardingRef.current?.current && url === SAMPLE_URL
      const { outcome, bookmarkId } = await performSaveRef.current(url, flagDemo)
      if (outcome === 'saved' && bookmarkId) {
        setFeedback({ kind: null })
        await onSavedRef.current(bookmarkId)
        return 'saved'
      }
      setFeedback({ kind: 'duplicate' })
      if (dupTimerRef.current !== null) clearTimeout(dupTimerRef.current)
      dupTimerRef.current = setTimeout(() => {
        dupTimerRef.current = null
        setFeedback({ kind: null })
      }, DUPLICATE_MS)
      return 'duplicate'
    } catch {
      setFeedback({ kind: null })
      return 'duplicate'
    } finally {
      busyRef.current = false
    }
  }

  return { feedback, saveUrl }
}
