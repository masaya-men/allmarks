'use client'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react'
import { useRouter } from 'next/navigation'
import { fetchShare } from '@/lib/share/api-client'
import { sanitizeShareDataV2 } from '@/lib/share/validate-v2'
import { extractShareIdFromPathname } from '@/lib/share/extract-share-id'
import type { ShareDataV2 } from '@/lib/share/types-v2'
import { initDB, addBookmark, getAllBookmarks } from '@/lib/storage/indexeddb'
import { addTag, getAllTags } from '@/lib/storage/tags'
import { findDuplicates, convertSenderTagsForReceiver, type ReceiverTagLite } from '@/lib/share/import'
import { initialIncludeSet, toggleInclude, toggleSenderTag } from '@/lib/share/receiver-selection'
import { shareCardToBoardItem } from '@/lib/share/share-card-to-board-item'
import { DEFAULT_THEME_ID } from '@/lib/board/theme-registry'
import { detectUrlType } from '@/lib/utils/url'
import { CardsLayer } from '@/components/board/CardsLayer'
import { Lightbox } from '@/components/board/Lightbox'
import { BulkImportToast } from './BulkImportToast'
import styles from './SharedBoard.module.css'

/** Stable module-level no-op for every editing handler CardsLayer requires but
 *  the receiver view never uses. One shared identity keeps CardsLayer's memos
 *  from churning on every render. */
const NOOP = (): void => {}

/** Stable empty collections — passing fresh `new Set()` / `{}` inline would give
 *  CardsLayer a new reference each render and defeat its memoization. */
const EMPTY_SET: ReadonlySet<string> = new Set()
const EMPTY_OBJ: Readonly<Record<string, number>> = {}

/** Receiver-mode default tag color when the sender supplied none. */
const DEFAULT_TAG_COLOR = '#28F100'

/** Huge viewport height so CardsLayer's culling window never drops a card.
 *  The receiver board is a normal scrolling container (capped at 100 cards),
 *  not a panning canvas, so feeding a near-infinite height keeps every card
 *  mounted and lets the browser's own scroll handle visibility. Tier-1
 *  autoplay stays correct because it is driven by IntersectionObserver on the
 *  real DOM, independent of this culling math. */
const UNCULLED_VIEWPORT_H = 1e7

type BoardState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly data: ShareDataV2 }
  | {
      readonly kind: 'error'
      readonly code: 'not_found' | 'expired' | 'invalid' | 'server'
      readonly message: string
    }

export function SharedBoard(): ReactElement {
  const router = useRouter()
  const [state, setState] = useState<BoardState>({ kind: 'loading' })
  const [shareId, setShareId] = useState<string | null>(null)

  // Selection state (only meaningful once state.kind === 'ready').
  const [included, setIncluded] = useState<ReadonlySet<string>>(EMPTY_SET)
  const [chosenTags, setChosenTags] = useState<ReadonlyMap<string, Set<string>>>(new Map())
  const [dups, setDups] = useState<ReadonlySet<string>>(EMPTY_SET)

  const [hovered, setHovered] = useState<string | null>(null)
  const [containerWidth, setContainerWidth] = useState<number>(1200)
  const [importing, setImporting] = useState<boolean>(false)
  const [importResult, setImportResult] = useState<{ saved: number; skipped: number } | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [lightboxRect, setLightboxRect] = useState<DOMRect | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  // ── boot: extract id ──
  useEffect((): void => {
    const extracted = extractShareIdFromPathname(window.location.pathname)
    if (!extracted.ok) {
      setState({ kind: 'error', code: 'invalid', message: 'invalid share URL' })
      return
    }
    setShareId(extracted.id)
  }, [])

  // ── boot: fetch + sanitize + duplicate scan ──
  useEffect((): void => {
    if (!shareId) return
    void (async (): Promise<void> => {
      const result = await fetchShare(shareId)
      if (!result.ok) {
        const code = result.error === 'not_found' ? 'not_found' : 'server'
        setState({ kind: 'error', code, message: result.message })
        return
      }
      const parsed = sanitizeShareDataV2(result.data.share)
      if (!parsed.ok) {
        setState({ kind: 'error', code: 'invalid', message: parsed.error })
        return
      }
      const data = parsed.data
      const db = await initDB()
      const existing = await getAllBookmarks(db)
      const existingUrls = new Set(existing.filter((b) => !b.isDeleted).map((b) => b.url))
      const duplicates = findDuplicates(data.cards, existingUrls)
      setDups(duplicates)
      setIncluded(initialIncludeSet(data.cards.map((c) => c.u), duplicates))
      setState({ kind: 'ready', data })
    })()
  }, [shareId])

  // ── container width via ResizeObserver ──
  useEffect((): (() => void) | undefined => {
    if (state.kind !== 'ready') return undefined
    const el = containerRef.current
    if (!el) return undefined
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w && w > 0) setContainerWidth(w)
    })
    ro.observe(el)
    return (): void => ro.disconnect()
  }, [state.kind])

  // ── selection toggles ──
  const onToggleInclude = useCallback((url: string): void => {
    setIncluded((s) => toggleInclude(s, url))
  }, [])
  const onToggleSenderTag = useCallback((url: string, tid: string): void => {
    setChosenTags((m) => toggleSenderTag(m, url, tid))
  }, [])

  // ── lightbox ──
  const closeLightbox = useCallback((): void => {
    setLightboxIndex(null)
    setLightboxRect(null)
  }, [])

  const onCardClick = useCallback((bookmarkId: string, originRect: DOMRect): void => {
    if (state.kind !== 'ready') return
    const idx = state.data.cards.findIndex((c) => c.u === bookmarkId)
    if (idx < 0) return
    setLightboxRect(originRect)
    setLightboxIndex(idx)
  }, [state])

  // ── derived board data ──
  const items = useMemo(
    () => (state.kind === 'ready' ? state.data.cards.map((c, i) => shareCardToBoardItem(c, i)) : []),
    [state],
  )
  const senderTagIdsByCard = useMemo(
    () =>
      new Map<string, ReadonlyArray<string>>(
        state.kind === 'ready' ? state.data.cards.map((c) => [c.u, c.tg ?? []]) : [],
      ),
    [state],
  )

  // ── bulk import (SAVE N / M) ──
  const handleSave = useCallback(async (): Promise<void> => {
    if (state.kind !== 'ready') return
    const data = state.data
    setImporting(true)
    try {
      const db = await initDB()
      // Running list of receiver tags so name-dedupe + `order` stay correct
      // across cards (two cards sharing one new sender tag create it once).
      const working: ReceiverTagLite[] = (await getAllTags(db)).map((t) => ({ id: t.id, name: t.name }))
      const senderTags = data.tags ?? {}

      let saved = 0
      for (const c of data.cards) {
        if (!included.has(c.u)) continue
        const armed = [...(chosenTags.get(c.u) ?? [])]
        const conv = convertSenderTagsForReceiver(armed, senderTags, working)

        // sender tag id → resolved receiver tag id (existing or freshly created)
        const created = new Map<string, string>()
        for (const toCreate of conv.toCreate) {
          const tag = await addTag(db, {
            name: toCreate.name,
            color: toCreate.color ?? DEFAULT_TAG_COLOR,
            order: working.length,
          })
          created.set(toCreate.senderId, tag.id)
          working.push({ id: tag.id, name: tag.name })
        }

        const finalTagIds = armed
          .map((sid) => conv.existing.get(sid) ?? created.get(sid))
          .filter((x): x is string => Boolean(x))

        await addBookmark(db, {
          url: c.u,
          title: c.t,
          description: c.d ?? '',
          thumbnail: c.th ?? '',
          favicon: '',
          siteName: '',
          type: detectUrlType(c.u),
          tags: finalTagIds,
        })
        saved++
      }
      setImportResult({ saved, skipped: dups.size })
    } finally {
      setImporting(false)
    }
  }, [state, included, chosenTags, dups])

  if (state.kind === 'loading') {
    return (
      <div className={styles.shell}>
        <p className={styles.loadingText}>LOADING SHARED COLLECTION</p>
      </div>
    )
  }

  if (state.kind === 'error') {
    const isExpired = state.code === 'not_found'
    return (
      <div className={styles.shell}>
        <div className={styles.errorBox}>
          <p className={styles.errorTitle}>
            {isExpired ? 'This share has expired or was never created' : 'Could not load share'}
          </p>
          <p className={styles.errorMessage}>{state.message}</p>
          <button type="button" className={styles.errorCta} onClick={(): void => router.push('/board')}>
            GO TO ALLMARKS
          </button>
        </div>
      </div>
    )
  }

  // ── ready ──
  const data = state.data
  // Theme is carried but not applied yet (no theme-application system on the
  // board). Default styling only.
  const themeId = data.theme ?? DEFAULT_THEME_ID
  const includeCount = included.size
  const total = data.cards.length
  const lightboxItem = lightboxIndex !== null ? (items[lightboxIndex] ?? null) : null

  return (
    <div className={styles.shell} data-theme={themeId}>
      <button
        type="button"
        className={styles.saveBtn}
        disabled={importing || includeCount === 0}
        onClick={(): void => {
          void handleSave()
        }}
        data-testid="save-selected-btn"
      >
        {importing ? 'SAVING…' : `SAVE ${includeCount} / ${total}`}
      </button>

      <div className={styles.bgTypo} aria-hidden>
        SHARED WITH YOU
      </div>

      <div className={styles.scroller} ref={containerRef}>
        <CardsLayer
          items={items}
          viewport={{ x: 0, y: 0, w: containerWidth, h: UNCULLED_VIEWPORT_H }}
          viewportWidth={containerWidth}
          cardGapPx={16}
          hoveredBookmarkId={hovered}
          onHoverChange={setHovered}
          audioActiveId={null}
          onToggleAudio={NOOP}
          audioVolume={1}
          audioPaused={false}
          onAudioVolumeChange={NOOP}
          onAudioTogglePause={NOOP}
          spaceHeld={false}
          onClick={onCardClick}
          onDrop={NOOP}
          onDelete={NOOP}
          onCardResize={NOOP}
          onCardResizeEnd={NOOP}
          onCardResetSize={NOOP}
          displayMode={'visual'}
          newlyAddedIds={EMPTY_SET}
          defaultCardWidth={320}
          customWidths={EMPTY_OBJ}
          motionEnabled={true}
          matchedBookmarkIds={null}
          receiverMode={{
            includedUrls: included,
            alreadySavedUrls: dups,
            senderTags: data.tags ?? {},
            senderTagIdsByCard,
            chosenTagsByCard: chosenTags,
            onToggleInclude,
            onToggleSenderTag,
          }}
        />
      </div>

      {lightboxItem && (
        <Lightbox item={lightboxItem} originRect={lightboxRect} onClose={closeLightbox} />
      )}

      {importResult && (
        <BulkImportToast
          saved={importResult.saved}
          skipped={importResult.skipped}
          onDismiss={(): void => {
            setImportResult(null)
            router.push('/board')
          }}
        />
      )}
    </div>
  )
}
