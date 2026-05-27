'use client'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { useRouter } from 'next/navigation'
import { fetchShare } from '@/lib/share/api-client'
import { sanitizeShareDataV2 } from '@/lib/share/validate-v2'
import type { ShareDataV2 } from '@/lib/share/types-v2'
import { computeSkylineLayout, type SkylineCard } from '@/lib/board/skyline-layout'
import { initDB, addBookmark, getAllBookmarks } from '@/lib/storage/indexeddb'
import { findDuplicates } from '@/lib/share/import'
import { detectUrlType } from '@/lib/utils/url'
import { BulkImportToast } from './BulkImportToast'
import styles from './ReceiverLanding.module.css'

type LandingState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly data: ShareDataV2 }
  | { readonly kind: 'error'; readonly code: 'not_found' | 'expired' | 'invalid' | 'server'; readonly message: string }

type Props = { readonly shareId: string }

export function ReceiverLanding({ shareId }: Props): ReactElement {
  const [state, setState] = useState<LandingState>({ kind: 'loading' })
  const router = useRouter()
  const containerRef = useRef<HTMLElement>(null)
  const [containerWidth, setContainerWidth] = useState<number>(1200)
  const [importResult, setImportResult] = useState<{ saved: number; skipped: number } | null>(null)
  const [importing, setImporting] = useState<boolean>(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const openCard = useCallback((idx: number): void => {
    setLightboxIndex(idx)
  }, [])

  const closeLightbox = useCallback((): void => setLightboxIndex(null), [])

  const nextCard = useCallback((): void => {
    setLightboxIndex((i) => i === null ? null : Math.min(i + 1, (state.kind === 'ready' ? state.data.cards.length : 1) - 1))
  }, [state])

  const prevCard = useCallback((): void => {
    setLightboxIndex((i) => i === null ? null : Math.max(i - 1, 0))
  }, [])

  useEffect((): (() => void) | undefined => {
    if (lightboxIndex === null) return undefined
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowRight') nextCard()
      if (e.key === 'ArrowLeft') prevCard()
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex, closeLightbox, nextCard, prevCard])

  const handleBulkImport = useCallback(async (): Promise<void> => {
    if (state.kind !== 'ready') return
    setImporting(true)
    try {
      const db = await initDB()
      const existing = await getAllBookmarks(db)
      const existingUrls = new Set(existing.filter((b) => !b.isDeleted).map((b) => b.url))
      const dups = findDuplicates(state.data.cards, existingUrls)

      let saved = 0
      for (const c of state.data.cards) {
        if (dups.has(c.u)) continue
        await addBookmark(db, {
          url: c.u,
          title: c.t,
          description: c.d ?? '',
          thumbnail: c.th ?? '',
          favicon: '',
          siteName: '',
          type: detectUrlType(c.u),
          tags: [],
        })
        saved++
      }
      setImportResult({ saved, skipped: dups.size })
    } finally {
      setImporting(false)
    }
  }, [state])

  useEffect((): void => {
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
      setState({ kind: 'ready', data: parsed.data })
    })()
  }, [shareId])

  useEffect((): (() => void) | undefined => {
    if (!containerRef.current) return undefined
    const el = containerRef.current
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w && w > 0) setContainerWidth(w)
    })
    ro.observe(el)
    return (): void => ro.disconnect()
  }, [state.kind])

  const layout = useMemo(() => {
    if (state.kind !== 'ready') return null
    const cards: SkylineCard[] = state.data.cards.map((c) => ({
      id: c.u,
      width: c.cw,
      height: c.cw / c.a,
    }))
    return computeSkylineLayout({
      cards,
      containerWidth,
      gap: 16,
    })
  }, [state, containerWidth])

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
          <button
            type="button"
            className={styles.errorCta}
            onClick={(): void => router.push('/board')}
          >GO TO ALLMARKS</button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topBar}>
        <span className={styles.logo}>A</span>
        {state.data.filter && state.data.tags && (
          <span className={styles.filterContext}>
            · FILTERED: {state.data.filter.tagIds.map((id) => state.data.tags?.[id]?.n ?? '?').join(' + ')}
          </span>
        )}
      </header>
      <main className={styles.boardArea} ref={containerRef}>
        {state.data.filter && state.data.tags && (
          <div className={styles.bgTypo} aria-hidden>
            {state.data.filter.tagIds.map((id) => state.data.tags?.[id]?.n ?? '').filter(Boolean).join(' · ').toUpperCase()}
          </div>
        )}
        <div className={styles.canvas} style={{ height: layout?.totalHeight ?? 0 }}>
          {state.data.cards.map((c, idx) => {
            const pos = layout?.positions[c.u]
            if (!pos) return null
            return (
              <div
                key={c.u}
                className={styles.card}
                style={{
                  position: 'absolute',
                  left: pos.x,
                  top: pos.y,
                  width: pos.w,
                  height: pos.h,
                  cursor: 'pointer',
                }}
                onClick={(): void => openCard(idx)}
              >
                {c.th && <img src={c.th} alt="" className={styles.cardThumb} />}
                <p className={styles.cardTitle}>{c.t}</p>
                {c.tg && c.tg.length > 0 && state.data.tags && (
                  <div className={styles.cardTags}>
                    {c.tg.map((tid) => (
                      <span key={tid} className={styles.cardTag}>
                        {state.data.tags?.[tid]?.n ?? '?'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>
      <footer className={styles.stickyCta}>
        <button
          type="button"
          className={styles.ctaPrimary}
          disabled={importing}
          onClick={(): void => { void handleBulkImport() }}
          data-testid="bulk-import-btn"
        >
          {importing ? 'IMPORTING...' : `IMPORT ALL ${state.data.cards.length}`}
        </button>
        <button
          type="button"
          className={styles.ctaSecondary}
          onClick={(): void => router.push(`/s/${shareId}/triage`)}
          data-testid="triage-btn"
        >PICK ONE BY ONE</button>
      </footer>
      {lightboxIndex !== null && state.kind === 'ready' && (
        <div className={styles.lightboxBackdrop} onClick={closeLightbox}>
          <div className={styles.lightboxPanel} onClick={(e): void => e.stopPropagation()}>
            <a
              href={state.data.cards[lightboxIndex].u}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.lightboxLink}
            >
              {state.data.cards[lightboxIndex].th && (
                <img
                  src={state.data.cards[lightboxIndex].th}
                  alt={state.data.cards[lightboxIndex].t}
                  className={styles.lightboxImg}
                />
              )}
              <h2 className={styles.lightboxTitle}>{state.data.cards[lightboxIndex].t}</h2>
              {state.data.cards[lightboxIndex].d && (
                <p className={styles.lightboxDesc}>{state.data.cards[lightboxIndex].d}</p>
              )}
              <p className={styles.lightboxUrl}>{state.data.cards[lightboxIndex].u}</p>
            </a>
            <button type="button" className={styles.lightboxClose} onClick={closeLightbox}>✕</button>
          </div>
        </div>
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
