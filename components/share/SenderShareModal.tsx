'use client'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import type { ShareDataV2, ShareCustomization } from '@/lib/share/types-v2'
import type { ThemeId } from '@/lib/board/types'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { ChromeDrawer } from '@/components/board/ChromeDrawer'
import styles from './SenderShareModal.module.css'
import { captureMirrorToWebP } from '@/lib/share/capture-mirror'
import { renderShareImage } from '@/lib/share/render-share-image'
import { createShare } from '@/lib/share/api-client'
import { shareImageFilename } from '@/lib/share/share-image-filename'
import { ShareMirror, type MirrorItem, type MirrorPosition } from './ShareMirror'

type ModalState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'capturing' }
  | { readonly kind: 'ready'; readonly shareUrl: string; readonly imageDataUrl: string; readonly shareId: string }
  | { readonly kind: 'error'; readonly message: string }

type Props = {
  readonly open: boolean
  readonly onClose: () => void
  /** Lazy accessor: called when SHARE confirm pressed to build the share payload. */
  readonly getShareData: () => ShareDataV2
  /** Total cards visible in current board view (= filteredItems.length). */
  readonly totalBoardCount: number
  /** Bg board's current scrollY (= viewport.y). For mirror sync scroll. */
  readonly scrollY: number
  /** Bg board's full scrollable height (= contentBounds.height). */
  readonly contentHeight: number
  /** Bg board's viewport height (= viewport.h). */
  readonly viewportHeight: number
  /** Active filter tag names for mirror top strip. Empty = no filter. */
  readonly activeTagNames: ReadonlyArray<string>
  /** Forward wheel events to bg board's pan handler. Called with raw deltaY. */
  readonly onPanY: (deltaY: number) => void
  /** Board items to display in the mirror (= filteredItems mapped from BoardRoot). */
  readonly items: ReadonlyArray<MirrorItem>
  /** Layout positions from bg board's skyline layout. */
  readonly positions: ReadonlyArray<MirrorPosition>
  /** Bg board's card-area width = effectiveLayoutWidth = viewport.w - 18. */
  readonly bgViewportWidth: number
  /** Bg board's canvas inner width = viewport.w. Used to compute mirror scale
   *  against bg's full screen width (= viewport.w + 2 * CANVAS_MARGIN_PX). */
  readonly bgCanvasWidth: number
  /** Whether the board's background typography is on. The share preview + OG
   *  image only draw the big wordmark when this is true (follows the board).
   *  Defaults true. */
  readonly bgTypoEnabled?: boolean
  /** The background typography string (= deriveBoardBgTypoText). Empty hides it. */
  readonly bgTypoText?: string
  /** Active theme id — passed through to ShareMirror for surface theming. */
  readonly themeId: ThemeId
  /** Resolved customization for pattern themes; null for fixed 'work' themes. */
  readonly custom: ShareCustomization | null
  /** Selective share entry — renders a SELECT CARDS button in the idle state.
   *  Pressing it is expected to close this modal and enter board selection
   *  mode (parent-owned). Null/undefined hides the button (archive view). */
  readonly onSelectCards?: (() => void) | null
  /** True when this modal is previewing a confirmed manual selection. */
  readonly selectionActive?: boolean
}

export function SenderShareModal({
  open,
  onClose,
  getShareData,
  totalBoardCount,
  scrollY,
  contentHeight,
  viewportHeight,
  activeTagNames,
  onPanY,
  items,
  positions,
  bgViewportWidth,
  bgCanvasWidth,
  bgTypoEnabled = true,
  bgTypoText = '',
  themeId,
  custom,
  onSelectCards = null,
  selectionActive = false,
}: Props): ReactElement | null {
  const { t } = useI18n()
  const [state, setState] = useState<ModalState>({ kind: 'idle' })
  const [copied, setCopied] = useState<boolean>(false)
  const mirrorFrameRef = useRef<HTMLDivElement | null>(null)
  const captureRef = useRef<HTMLDivElement | null>(null)

  // Reset state on close
  useEffect((): void => {
    if (!open) setState({ kind: 'idle' })
  }, [open])

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>): void => {
    e.preventDefault()
    onPanY(e.deltaY)
  }, [onPanY])

  // Compute sharedCardCount once when modal is open (lazy, same as getShareData()).
  // We derive it from getShareData() here so ShareMirror doesn't need to call it.
  const sharedCardCount = useMemo((): number => {
    if (!open) return 0
    return getShareData().cards.length
  }, [open, getShareData])

  // Cards whose skyline rect intersects the band currently shown in the 1.91:1
  // preview. Only these enter the capture DOM ⇒ the captured subtree is ~10-20
  // cards, never the full board — this is what avoids the 2026 dom-to-image
  // memory explosion (which pre-fetched EVERY card's image).
  const visibleItems = useMemo(() => {
    const band = viewportHeight
    return items.filter((it) => {
      const p = positions.find((q) => q.id === it.id)
      return p != null && p.y + p.h > scrollY - 8 && p.y < scrollY + band + 8
    })
  }, [items, positions, scrollY, viewportHeight])

  const handleShareConfirm = useCallback(async (): Promise<void> => {
    setState({ kind: 'capturing' })
    try {
      const share = getShareData()
      const captureFrame = captureRef.current?.querySelector<HTMLElement>('[data-testid="mirror-frame"]') ?? null
      let thumbDataUrl: string | null = null
      if (captureFrame) {
        thumbDataUrl = await renderShareImage(captureFrame, { width: 1200, height: 628, targetBytes: 180 * 1024, startQuality: 0.82, minQuality: 0.4 })
      }
      // Fallback: the legacy hand-drawn canvas (never let sharing break).
      if (!thumbDataUrl) {
        thumbDataUrl = await captureMirrorToWebP({
          mirrorFrame: captureFrame,
          items: visibleItems.map((it) => ({ url: it.url, title: it.title, thumbnailUrl: it.thumbnailUrl })),
          sharedCardCount: share.cards.length,
          activeTagNames,
          totalBoardCount,
          bgTypoText: bgTypoEnabled ? bgTypoText : '',
          width: 1200,
          height: 628,
          targetBytes: 180 * 1024,
          startQuality: 0.82,
          minQuality: 0.4,
        })
      }
      if (!thumbDataUrl) {
        setState({ kind: 'error', message: 'capture failed' })
        return
      }
      const result = await createShare({ share, thumb: thumbDataUrl })
      if (!result.ok) {
        setState({ kind: 'error', message: result.message })
        return
      }
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://allmarks.app'
      const shareUrl = `${origin}/s/${result.data.id}`
      setState({ kind: 'ready', shareUrl, imageDataUrl: thumbDataUrl, shareId: result.data.id })
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : 'unknown error' })
    }
  }, [getShareData, visibleItems, activeTagNames, totalBoardCount, bgTypoEnabled, bgTypoText])

  // Hand the already-generated share image (the same 1200×628 JPEG used as the
  // link's OG thumbnail) to the user as a download, so they can post it natively
  // on X — native image posts dwarf link-preview cards. The allmarks.app URL is
  // baked into the image (ShareMirror bottom strip), so it travels with the post.
  const handleSaveImage = useCallback((dataUrl: string, id: string): void => {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = shareImageFilename(id, dataUrl)
    document.body.appendChild(a)
    a.click()
    a.remove()
  }, [])

  if (!open) return null

  return (
    <>
    <ChromeDrawer
      isOpen={open}
      onClose={onClose}
      title="SHARE BOARD"
      testId="share-modal"
      closeLabel={t('board.theme.modalCloseLabel')}
    >
      <div className={styles.preview} data-testid="share-preview" onWheel={handleWheel}>
        <ShareMirror
          items={items}
          positions={positions}
          bgViewportWidth={bgViewportWidth}
          bgCanvasWidth={bgCanvasWidth}
          activeTagNames={activeTagNames}
          totalBoardCount={totalBoardCount}
          sharedCardCount={sharedCardCount}
          scrollY={scrollY}
          contentHeight={contentHeight}
          viewportHeight={viewportHeight}
          bgTypoText={bgTypoEnabled ? bgTypoText : ''}
          frameRef={mirrorFrameRef}
          themeId={themeId}
          custom={custom}
        />
      </div>

      <p className={styles.hint}>
        {selectionActive
          ? 'SELECTED CARDS ONLY · PRESS SHARE NOW WHEN READY'
          : 'SCROLL TO POSITION · PRESS SHARE NOW WHEN READY'}
      </p>

      <div className={styles.actions}>
        {state.kind === 'ready' ? (
          <>
            <div className={styles.urlRow}>
              <code className={styles.url}>{state.shareUrl}</code>
              <button
                type="button"
                className={styles.copyBtn}
                onClick={(): void => {
                  void navigator.clipboard.writeText(state.shareUrl).then((): void => {
                    setCopied(true)
                    setTimeout((): void => setCopied(false), 1500)
                  })
                }}
              >{copied ? 'COPIED' : 'COPY'}</button>
            </div>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={(): void => handleSaveImage(state.imageDataUrl, state.shareId)}
            >SAVE IMAGE</button>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={(): void => {
                const intent = `https://twitter.com/intent/tweet?url=${encodeURIComponent(state.shareUrl)}`
                window.open(intent, '_blank', 'noopener,noreferrer')
              }}
            >POST TO X</button>
          </>
        ) : state.kind === 'error' ? (
          <>
            <code className={styles.url} style={{ color: '#ff8888' }}>⚠ {state.message}</code>
            <button type="button" className={styles.primaryBtn} onClick={handleShareConfirm}>RETRY</button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={state.kind === 'capturing'}
              onClick={handleShareConfirm}
            >{state.kind === 'capturing' ? 'CAPTURING…' : 'SHARE NOW'}</button>
            {onSelectCards && state.kind === 'idle' && (
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={onSelectCards}
                data-testid="select-cards-button"
              >SELECT CARDS</button>
            )}
          </>
        )}
      </div>
    </ChromeDrawer>
    {/* Hidden 1200×628 capture node — off-screen so dom-to-image can measure it,
        but invisible to the user. Renders only visibleItems to avoid the 2026
        dom-to-image memory explosion that hit the full-board subtree. */}
    <div style={{ position: 'fixed', left: '-99999px', top: 0, width: 1200, height: 628, pointerEvents: 'none' }} aria-hidden ref={captureRef}>
      <ShareMirror
        items={visibleItems}
        positions={positions}
        bgViewportWidth={bgViewportWidth}
        bgCanvasWidth={bgCanvasWidth}
        activeTagNames={activeTagNames}
        totalBoardCount={totalBoardCount}
        sharedCardCount={sharedCardCount}
        scrollY={scrollY}
        contentHeight={contentHeight}
        viewportHeight={viewportHeight}
        bgTypoText={bgTypoEnabled ? bgTypoText : ''}
        themeId={themeId}
        custom={custom}
      />
    </div>
    </>
  )
}
