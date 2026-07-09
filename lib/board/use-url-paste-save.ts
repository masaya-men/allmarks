'use client'
import { useEffect } from 'react'
import { extractSinglePastedUrl, isEditableTarget } from '@/lib/board/paste-url'
import { useSaveUrl, type PasteFeedback } from '@/lib/board/use-save-url'

export type { PasteFeedback } from '@/lib/board/use-save-url'

/** Global "paste a URL anywhere" save. Thin wrapper over useSaveUrl: attaches
 *  a document paste listener that extracts a single URL and hands it to the
 *  shared save core. Public shape ({ feedback }) is unchanged so BoardRoot and
 *  the PiP companion keep working. Desktop behavior is byte-identical: it still
 *  uses extractSinglePastedUrl (no https prepend). */
export function useUrlPasteSave(opts: {
  onSaved: (bookmarkId: string) => void | Promise<void>
  targetDocument?: Document | null
  flagOnboardingRef?: { readonly current: boolean }
}): { feedback: PasteFeedback } {
  const { feedback, saveUrl } = useSaveUrl({
    onSaved: opts.onSaved,
    flagOnboardingRef: opts.flagOnboardingRef,
  })
  const targetDocument = opts.targetDocument
  useEffect(() => {
    const doc = targetDocument ?? (typeof document !== 'undefined' ? document : null)
    if (!doc) return
    const handler = (e: ClipboardEvent): void => {
      if (isEditableTarget(e.target)) return
      const text = e.clipboardData?.getData('text/plain') ?? ''
      const url = extractSinglePastedUrl(text)
      if (!url) return
      e.preventDefault()
      void saveUrl(url)
    }
    const listener = (e: Event): void => handler(e as ClipboardEvent)
    doc.addEventListener('paste', listener)
    return (): void => doc.removeEventListener('paste', listener)
  }, [targetDocument, saveUrl])
  return { feedback }
}
