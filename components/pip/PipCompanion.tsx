'use client'

import { useEffect, useRef, useState, useCallback, type ReactElement } from 'react'
import { initDB, getAllBookmarks } from '@/lib/storage/indexeddb'
import { getAllTags, addTagToBookmark } from '@/lib/storage/tags'
import { orderTagsForSave } from '@/lib/tagger/order-tags-for-save'
import { subscribeBookmarkSaved, subscribeBookmarkDeleted, postBookmarkUpdated } from '@/lib/board/channel'
import { broadcastPipOpen, broadcastPipClosed, subscribePipPresence } from '@/lib/board/pip-presence'
import { resolveThumbnail } from '@/lib/pip/resolve-thumbnail'
import { PipEmptyState } from './PipEmptyState'
import { PipStack, type PipStackCard } from './PipStack'
import styles from './PipCompanion.module.css'

export interface PipCompanionProps {
  /** Reserved for any future programmatic close path. The Document PiP
   *  window's title bar already provides Chrome's native × close, so we
   *  no longer render an in-page close button. */
  readonly onClose?: () => void
  readonly onCardClick?: (cardId: string) => void
  /** Whole-feature ON/OFF (lifted from BoardRoot). Default ON. */
  readonly quickTagEnabled?: boolean
}

export function PipCompanion({ onCardClick, quickTagEnabled }: PipCompanionProps): ReactElement {
  // Per-session card buffer — starts empty every time PiP opens. Cards
  // accumulate without a cap so the user sees every bookmark they saved
  // while the companion was visible (a "look how many you grabbed today"
  // feel). Closing the PiP loses this buffer; reopening starts fresh.
  const [cards, setCards] = useState<PipStackCard[]>([])
  // Keep a ref in sync so handleAddTag can read current cards without adding
  // `cards` to its useCallback deps (which would recreate it every render).
  const cardsRef = useRef(cards)
  useEffect(() => { cardsRef.current = cards }, [cards])

  useEffect(() => {
    const unsub = subscribeBookmarkSaved(async ({ bookmarkId }) => {
      const db = await initDB()
      const bm = await db.get('bookmarks', bookmarkId)
      if (!bm) return
      // Optimistic insert: slide-in immediately with whatever thumb is in
      // IDB (real og:image for Apple/news, X default or empty for tweets).
      // Then upgrade asynchronously via the resolver — the syndication /
      // oEmbed / CDN derive that the board does for non-OG sources.
      const [corpus, allTags] = await Promise.all([getAllBookmarks(db), getAllTags(db)])
      const initial: PipStackCard = {
        id: bm.id,
        title: bm.title,
        thumbnail: bm.thumbnail ?? '',
        favicon: bm.favicon ?? '',
        tags: orderTagsForSave(bm, corpus, allTags),
        currentTagIds: [...bm.tags],
      }
      // Append chronologically: 1, 2, 3, … each new bookmark lands on the
      // right end of the carousel and the auto-scroll inside PipStack
      // glides over to it. Re-saving an existing URL still moves it to
      // the right end (we filter the prior copy out first).
      setCards((prev) => [...prev.filter((c) => c.id !== initial.id), initial])

      const resolved = await resolveThumbnail(bm)
      if (resolved && resolved !== initial.thumbnail) {
        setCards((prev) => prev.map((c) => (c.id === bm.id ? { ...c, thumbnail: resolved } : c)))
      }
    })
    return unsub
  }, [])

  // Drop the card from the PiP buffer when the main board soft-deletes the
  // bookmark. Without this, a card the user just deleted still floats in PiP
  // for the rest of the session.
  useEffect(() => {
    const unsub = subscribeBookmarkDeleted(({ bookmarkId }) => {
      setCards((prev) => prev.filter((c) => c.id !== bookmarkId))
    })
    return unsub
  }, [])

  useEffect(() => {
    broadcastPipOpen()
    // Answer pip:query probes while we are mounted — we are the PiP, so we are open.
    const unsub = subscribePipPresence(() => {}, () => true)
    return () => {
      unsub()
      broadcastPipClosed()
    }
  }, [])

  const handleCardClick = useCallback((cardId: string) => {
    if (onCardClick) onCardClick(cardId)
  }, [onCardClick])

  const handleAddTag = useCallback(async (bookmarkId: string, tagId: string) => {
    // Skip entirely if the tag is already applied — avoids a redundant IDB
    // write and a spurious bookmark-updated broadcast (which would make an
    // open board reload for nothing).
    const already = (cardsRef.current.find((c) => c.id === bookmarkId)?.currentTagIds ?? []).includes(tagId)
    if (already) return
    const db = await initDB()
    await addTagToBookmark(db, bookmarkId, tagId)
    setCards((prev) =>
      prev.map((c) =>
        c.id === bookmarkId && !(c.currentTagIds ?? []).includes(tagId)
          ? { ...c, currentTagIds: [...(c.currentTagIds ?? []), tagId] }
          : c,
      ),
    )
    postBookmarkUpdated({ bookmarkId })
  }, [])

  return (
    <div className={styles.host}>
      {cards.length === 0 ? (
        <PipEmptyState />
      ) : (
        <PipStack
          cards={cards}
          onCardClick={handleCardClick}
          tagEnabled={quickTagEnabled !== false}
          onAddTag={handleAddTag}
        />
      )}
    </div>
  )
}
