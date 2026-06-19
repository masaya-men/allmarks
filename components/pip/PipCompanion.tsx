'use client'

import { useEffect, useRef, useState, useCallback, type ReactElement } from 'react'
import { initDB, getAllBookmarks, type TagRecord } from '@/lib/storage/indexeddb'
import { getAllTags, addTagToBookmark, addTag } from '@/lib/storage/tags'
import { orderTagsForSave } from '@/lib/tagger/order-tags-for-save'
import { subscribeBookmarkSaved, subscribeBookmarkDeleted, postBookmarkUpdated, postBookmarkSaved } from '@/lib/board/channel'
import { broadcastPipOpen, broadcastPipClosed, subscribePipPresence } from '@/lib/board/pip-presence'
import { resolveThumbnail } from '@/lib/pip/resolve-thumbnail'
import { pipDisplayThumbnail } from '@/lib/pip/pip-thumbnail'
import { useUrlPasteSave } from '@/lib/board/use-url-paste-save'
import { DEFAULT_THEME_ID } from '@/lib/board/theme-registry'
import { TagAddPopover } from '@/components/board/TagAddPopover'
import { PasteSaveFeedback } from '@/components/board/PasteSaveFeedback'
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
  // Keep a ref in sync so handleAddExisting can read current cards without
  // adding `cards` to its useCallback deps (which would recreate it every render).
  const cardsRef = useRef(cards)
  useEffect(() => { cardsRef.current = cards }, [cards])

  // Paste-to-save inside the PiP window. Listen on the PiP window's OWN
  // document (the host node's ownerDocument, resolved after mount) and reuse
  // the board's ingest. A saved paste broadcasts bookmark-saved, which the
  // subscribeBookmarkSaved effect below appends + auto-scrolls to — so the
  // pasted card lands at the front, ready for +TAG. No direct buffer insert
  // here (that would double the card with the broadcast append).
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [pipDoc, setPipDoc] = useState<Document | null>(null)
  useEffect(() => { setPipDoc(hostRef.current?.ownerDocument ?? null) }, [])
  const { feedback: pasteFeedback } = useUrlPasteSave({
    onSaved: (bookmarkId) => postBookmarkSaved({ bookmarkId }),
    targetDocument: pipDoc,
  })

  // Full tag master — feeds the popover's ALL TAGS section and the case-
  // insensitive dedupe in handleAddNew. Loaded on mount and refreshed whenever
  // a bookmark is saved (a fresh save may have introduced new tags elsewhere).
  const [allTags, setAllTags] = useState<TagRecord[]>([])
  const allTagsRef = useRef(allTags)
  useEffect(() => { allTagsRef.current = allTags }, [allTags])

  // Tag menu is rendered as a PiP-window-level overlay (a sibling of the
  // carousel inside .host), NOT inside PipCard — the carousel's nested
  // overflow:hidden (.host / .stage / .scroller) clips anything a card tries
  // to pop out. `tagMenuFor` holds the bookmark id whose menu is open;
  // `tagMenuClosing` drives TagAddPopover's exit animation before unmount.
  const [tagMenuFor, setTagMenuFor] = useState<string | null>(null)
  const [tagMenuClosing, setTagMenuClosing] = useState(false)

  // Hover leave-grace for the tag panel — matches the board / TUNE drawer
  // (700ms). Leaving the panel schedules a close; re-entering cancels it.
  const tagLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTagLeave = useCallback(() => {
    if (tagLeaveTimer.current) { clearTimeout(tagLeaveTimer.current); tagLeaveTimer.current = null }
  }, [])
  const handleOpenTags = useCallback((bookmarkId: string) => {
    clearTagLeave()
    setTagMenuClosing(false)
    setTagMenuFor(bookmarkId)
  }, [clearTagLeave])
  const beginCloseTagMenu = useCallback(() => { clearTagLeave(); setTagMenuClosing(true) }, [clearTagLeave])
  const finishCloseTagMenu = useCallback(() => {
    setTagMenuFor(null)
    setTagMenuClosing(false)
  }, [])
  const scheduleCloseTagMenu = useCallback(() => {
    clearTagLeave()
    tagLeaveTimer.current = setTimeout(() => { tagLeaveTimer.current = null; setTagMenuClosing(true) }, 700)
  }, [clearTagLeave])
  const cancelCloseTagMenu = useCallback(() => {
    clearTagLeave()
    setTagMenuClosing((c) => (c ? false : c))
  }, [clearTagLeave])
  useEffect(() => clearTagLeave, [clearTagLeave])

  useEffect(() => {
    void (async () => {
      const db = await initDB()
      setAllTags(await getAllTags(db))
    })()
  }, [])

  useEffect(() => {
    const unsub = subscribeBookmarkSaved(async ({ bookmarkId }) => {
      const db = await initDB()
      const bm = await db.get('bookmarks', bookmarkId)
      if (!bm) return
      // Optimistic insert: slide-in immediately with whatever thumb is in
      // IDB (real og:image for Apple/news, X default or empty for tweets).
      // Then upgrade asynchronously via the resolver — the syndication /
      // oEmbed / CDN derive that the board does for non-OG sources.
      const [corpus, freshTags] = await Promise.all([getAllBookmarks(db), getAllTags(db)])
      // Refresh the picker's tag master — a save elsewhere may have created tags.
      setAllTags(freshTags)
      const ordered = orderTagsForSave(bm, corpus, freshTags)
      const initial: PipStackCard = {
        id: bm.id,
        title: bm.title,
        // No-image sites fall back to the same placeholder artwork the board
        // uses (pickPlaceholderImage), so the PiP card matches the board.
        thumbnail: pipDisplayThumbnail(bm.thumbnail ?? '', bm.url),
        favicon: bm.favicon ?? '',
        currentTagIds: [...bm.tags],
        // Relevant-first existing tags, capped at the industry-standard 5 —
        // the popover renders these as its SUGGESTED row.
        suggestedEntries: ordered
          .slice(0, 5)
          .map((t) => ({ kind: 'existing' as const, tagId: t.id })),
      }
      // Append chronologically: 1, 2, 3, … each new bookmark lands on the
      // right end of the carousel and the auto-scroll inside PipStack
      // glides over to it. Re-saving an existing URL still moves it to
      // the right end (we filter the prior copy out first).
      setCards((prev) => [...prev.filter((c) => c.id !== initial.id), initial])

      const resolved = pipDisplayThumbnail(await resolveThumbnail(bm), bm.url)
      if (resolved !== initial.thumbnail) {
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
      // If the deleted card's tag menu is open, close it — otherwise the
      // overlay would dangle pointing at a card that no longer exists.
      setTagMenuFor((cur) => (cur === bookmarkId ? null : cur))
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

  const handleAddExisting = useCallback(async (bookmarkId: string, tagId: string) => {
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

  // Create-or-reuse a tag by name, then attach it. Mirrors the board's
  // create logic: trim, case-insensitive dedupe against the tag master
  // (reuse if found), else mint a new tag with the AllMarks green.
  const handleAddNew = useCallback(async (bookmarkId: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const db = await initDB()
    const existing = allTagsRef.current.find((t) => t.name.toLowerCase() === trimmed.toLowerCase())
    const target = existing ?? (await addTag(db, { name: trimmed, color: '#28F100', order: allTagsRef.current.length }))
    await addTagToBookmark(db, bookmarkId, target.id)
    const fresh = await getAllTags(db)
    setAllTags(fresh)
    setCards((prev) =>
      prev.map((c) =>
        c.id === bookmarkId && !(c.currentTagIds ?? []).includes(target.id)
          ? { ...c, currentTagIds: [...(c.currentTagIds ?? []), target.id] }
          : c,
      ),
    )
    postBookmarkUpdated({ bookmarkId })
  }, [])

  const menuCard = tagMenuFor !== null ? cards.find((c) => c.id === tagMenuFor) : undefined

  return (
    <div className={styles.host} ref={hostRef}>
      <PasteSaveFeedback feedback={pasteFeedback} themeId={DEFAULT_THEME_ID} />
      {cards.length === 0 ? (
        <PipEmptyState />
      ) : (
        <PipStack
          cards={cards}
          onCardClick={handleCardClick}
          tagEnabled={quickTagEnabled !== false}
          onOpenTags={handleOpenTags}
        />
      )}
      {tagMenuFor && menuCard && (
        <>
          {/* Transparent full-window catcher: keeps the card VISIBLE behind it
              (no dimming) while still letting a click anywhere off the panel
              dismiss the menu — the PiP window can't use TagAddPopover's
              document-level outside-click, so this is the dismiss surface. */}
          <div
            className={styles.tagCatcher}
            data-testid="pip-tag-catcher"
            onPointerDown={beginCloseTagMenu}
          />
          {/* The menu occupies only a side sub-region so the card stays in
              view; the menu scrolls internally (compact = single column). */}
          <div
            className={styles.tagPanel}
            data-testid="pip-tag-overlay"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseEnter={cancelCloseTagMenu}
            onMouseLeave={scheduleCloseTagMenu}
          >
            <TagAddPopover
              compact
              allTags={allTags}
              currentTagIds={menuCard.currentTagIds ?? []}
              suggestedEntries={menuCard.suggestedEntries ?? []}
              closing={tagMenuClosing}
              onExited={finishCloseTagMenu}
              onAddExisting={(tagId) => { void handleAddExisting(tagMenuFor, tagId) }}
              onAddNew={(name) => { void handleAddNew(tagMenuFor, name); beginCloseTagMenu() }}
              onClose={beginCloseTagMenu}
            />
          </div>
        </>
      )}
    </div>
  )
}
