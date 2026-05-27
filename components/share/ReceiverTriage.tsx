'use client'
import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { useRouter } from 'next/navigation'
import { fetchShare } from '@/lib/share/api-client'
import { sanitizeShareDataV2 } from '@/lib/share/validate-v2'
import { findDuplicates, convertSenderTagsForReceiver } from '@/lib/share/import'
import { extractShareIdFromPathname } from '@/lib/share/extract-share-id'
import { initDB, addBookmark, getAllBookmarks } from '@/lib/storage/indexeddb'
import { getAllTags, addTag } from '@/lib/storage/tags'
import { useTags } from '@/lib/storage/use-tags'
import { detectUrlType } from '@/lib/utils/url'
import { BulkImportToast } from './BulkImportToast'
import type { ShareDataV2, ShareCardV2 } from '@/lib/share/types-v2'
import styles from './ReceiverTriage.module.css'

type TriageState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly queue: ReadonlyArray<ShareCardV2>; readonly data: ShareDataV2 }
  | { readonly kind: 'empty' }
  | { readonly kind: 'error'; readonly message: string }

export function ReceiverTriage(): ReactElement {
  const router = useRouter()
  const [state, setState] = useState<TriageState>({ kind: 'loading' })
  const [shareId, setShareId] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [savedCount, setSavedCount] = useState(0)
  const [armedTagIds, setArmedTagIds] = useState<ReadonlySet<string>>(() => new Set())
  const [showSummary, setShowSummary] = useState<boolean>(false)
  const { tags: receiverTags } = useTags()

  useEffect((): void => {
    const extracted = extractShareIdFromPathname(window.location.pathname)
    if (!extracted.ok) {
      setState({ kind: 'error', message: 'invalid share URL' })
      return
    }
    setShareId(extracted.id)
  }, [])

  // Fetch share + filter duplicates
  useEffect((): void => {
    if (!shareId) return
    void (async (): Promise<void> => {
      const result = await fetchShare(shareId)
      if (!result.ok) {
        setState({ kind: 'error', message: result.message })
        return
      }
      const parsed = sanitizeShareDataV2(result.data.share)
      if (!parsed.ok) {
        setState({ kind: 'error', message: parsed.error })
        return
      }
      const db = await initDB()
      const existing = await getAllBookmarks(db)
      const existingUrls = new Set(existing.filter((b) => !b.isDeleted).map((b) => b.url))
      const dups = findDuplicates(parsed.data.cards, existingUrls)
      const queue = parsed.data.cards.filter((c) => !dups.has(c.u))
      if (queue.length === 0) {
        setState({ kind: 'empty' })
        return
      }
      setState({ kind: 'ready', queue, data: parsed.data })
    })()
  }, [shareId])

  const handleYes = useCallback(async (): Promise<void> => {
    if (state.kind !== 'ready') return
    const current = state.queue[index]
    if (!current) return
    const db = await initDB()
    const receiverTags = await getAllTags(db)
    const conversion = convertSenderTagsForReceiver(
      Array.from(armedTagIds),
      state.data.tags ?? {},
      receiverTags,
    )
    const newlyCreatedIds = new Map<string, string>()
    for (const t of conversion.toCreate) {
      const newTag = await addTag(db, {
        name: t.name,
        color: t.color ?? '#28F100',
        order: receiverTags.length + newlyCreatedIds.size,
      })
      newlyCreatedIds.set(t.senderId, newTag.id)
    }
    const finalTagIds: string[] = []
    for (const senderId of armedTagIds) {
      const existingId = conversion.existing.get(senderId)
      if (existingId) {
        finalTagIds.push(existingId)
        continue
      }
      const created = newlyCreatedIds.get(senderId)
      if (created) {
        finalTagIds.push(created)
        continue
      }
    }
    await addBookmark(db, {
      url: current.u,
      title: current.t,
      description: current.d ?? '',
      thumbnail: current.th ?? '',
      favicon: '',
      siteName: '',
      type: detectUrlType(current.u),
      tags: finalTagIds,
    })
    setSavedCount((n) => n + 1)
    setIndex((i) => i + 1)
  }, [state, index, armedTagIds])

  const handleNo = useCallback((): void => {
    setIndex((i) => i + 1)
  }, [])

  useEffect((): void => {
    if (state.kind !== 'ready') return
    if (index >= state.queue.length && !showSummary) {
      setShowSummary(true)
    }
  }, [state, index, showSummary])

  if (state.kind === 'loading') {
    return <div className={styles.shell}><p className={styles.status}>LOADING</p></div>
  }
  if (state.kind === 'empty') {
    return (
      <div className={styles.shell}>
        <p className={styles.status}>ALL CARDS ALREADY IN YOUR ALLMARKS</p>
        <button type="button" className={styles.cta} onClick={(): void => router.push('/board')}>GO TO BOARD</button>
      </div>
    )
  }
  if (state.kind === 'error') {
    return <div className={styles.shell}><p className={styles.status}>ERROR: {state.message}</p></div>
  }

  const current = state.queue[index]
  if (!current) {
    return (
      <div className={styles.shell}>
        <p className={styles.status}>FINISHED · {savedCount} SAVED</p>
        {showSummary && (
          <BulkImportToast
            saved={savedCount}
            skipped={0}
            onDismiss={(): void => router.push('/board')}
          />
        )}
      </div>
    )
  }

  const senderTagsForCard = current.tg ?? []
  const senderTagDict = state.data.tags ?? {}

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.progress}>{index + 1} OF {state.queue.length}</span>
        <span className={styles.savedHint}>{savedCount} SAVED</span>
      </header>

      <main className={styles.cardArea}>
        <div className={styles.card}>
          {current.th && <img src={current.th} alt="" className={styles.cardImg} />}
          <h2 className={styles.cardTitle}>{current.t}</h2>
          {current.d && <p className={styles.cardDesc}>{current.d}</p>}
          <p className={styles.cardUrl}>{current.u}</p>
        </div>
      </main>

      <div className={styles.tagSuggestions}>
        {senderTagsForCard.length > 0 && (
          <p className={styles.tagLabel}>SENDER&apos;S TAGS - TAP TO ACCEPT</p>
        )}
        <div className={styles.tagStrip}>
          {senderTagsForCard.map((tid) => {
            const tag = senderTagDict[tid]
            if (!tag) return null
            const isArmed = armedTagIds.has(tid)
            return (
              <button
                key={`sender-${tid}`}
                type="button"
                className={`${styles.tagChip} ${isArmed ? styles.tagChipArmed : ''}`}
                onClick={(): void => {
                  setArmedTagIds((prev) => {
                    const next = new Set(prev)
                    if (next.has(tid)) next.delete(tid)
                    else next.add(tid)
                    return next
                  })
                }}
              >
                {tag.n}
              </button>
            )
          })}
        </div>
        {receiverTags.length > 0 && (
          <>
            <p className={`${styles.tagLabel} ${styles.tagLabelReceiver}`}>YOUR TAGS</p>
            <div className={styles.tagStrip}>
              {receiverTags.map((t) => {
                const isArmed = armedTagIds.has(t.id)
                return (
                  <button
                    key={`receiver-${t.id}`}
                    type="button"
                    className={`${styles.tagChip} ${styles.tagChipReceiver} ${isArmed ? styles.tagChipArmedReceiver : ''}`}
                    onClick={(): void => {
                      setArmedTagIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(t.id)) next.delete(t.id)
                        else next.add(t.id)
                        return next
                      })
                    }}
                  >
                    {t.name}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      <footer className={styles.actions}>
        <button type="button" className={styles.btnNo} onClick={handleNo}>NO · SKIP</button>
        <button type="button" className={styles.btnYes} onClick={(): void => { void handleYes() }}>YES · SAVE</button>
      </footer>
    </div>
  )
}
