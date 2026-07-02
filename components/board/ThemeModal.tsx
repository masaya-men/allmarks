'use client'

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import type { ThemeId, ThemeCustomization } from '@/lib/board/types'
import { type ResolvedThemeCustomization, themeAllowsPattern } from '@/lib/board/theme-customization'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { ThemePicker } from './ThemePicker'
import { ThemeCustomizeSection } from './ThemeCustomizeSection'
import styles from './ThemeModal.module.css'

export interface ThemeModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly themeId: ThemeId
  readonly onThemeChange: (id: ThemeId) => void
  /** Effective customization for the active theme, or null for fixed 'work'
   *  themes (then the CUSTOMIZE section is hidden). */
  readonly customization: ResolvedThemeCustomization | null
  /** True when the active theme sits at its byte-identical default. */
  readonly isDefaultCustomization: boolean
  /** Apply a customization patch live; null = reset the theme to defaults. */
  readonly onCustomize: (patch: ThemeCustomization | null) => void
}

/**
 * Theme picker — a right-docked, NON-blocking panel (not a dim modal). The
 * board stays fully visible and interactive behind it, so clicking a theme
 * re-themes the real board live (that IS the preview — no separate replica).
 *
 * Rendered at the board root (like {@link BookmarkletInstallModal}) so it
 * escapes the SETTINGS drawer's stacking context. The overlay is
 * pointer-events:none (board keeps panning/scrolling); only the panel itself
 * is interactive. Dismissed via × or Esc.
 *
 * Themes are grouped into PATTERN (customizable — Sound Wave, Grid; the
 * customize controls land in Phase 3) and WORKS (fixed crafted worlds — Paper).
 */
export function ThemeModal({
  isOpen,
  onClose,
  themeId,
  onThemeChange,
  customization,
  isDefaultCustomization,
  onCustomize,
}: ThemeModalProps): ReactElement | null {
  const { t } = useI18n()
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  // Bottom fade hint when the scrollable body has more content below the fold
  // (the CUSTOMIZE section can push it past the panel height). No raw scrollbar.
  const [moreBelow, setMoreBelow] = useState(false)
  const recomputeFade = useCallback((): void => {
    const el = bodyRef.current
    if (!el) return
    setMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 4)
  }, [])

  useEffect(() => {
    if (isOpen) closeBtnRef.current?.focus()
  }, [isOpen])

  // Recompute the fade when the body resizes (theme switch shows/hides the
  // CUSTOMIZE section) or the panel opens.
  useEffect(() => {
    if (!isOpen) return
    const el = bodyRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    recomputeFade()
    const ro = new ResizeObserver(recomputeFade)
    ro.observe(el)
    window.addEventListener('resize', recomputeFade)
    return (): void => {
      ro.disconnect()
      window.removeEventListener('resize', recomputeFade)
    }
  }, [isOpen, recomputeFade])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // Outside-click closes the panel. It is non-blocking (the overlay is
  // pointer-events:none, so clicks fall through to the live board behind), so a
  // pointerdown anywhere outside the panel — the board, the SETTINGS drawer,
  // empty chrome — dismisses it. The CUSTOMIZE colour picker is a native
  // <input type="color"> whose OS picker opens as a separate window (no in-page
  // pointerdown), so it never trips this; every other control lives inside the
  // panel.
  //
  // CAPTURE phase (3rd arg `true`) is REQUIRED, not bubble: a bare-board
  // pointerdown makes InteractionLayer call setPointerCapture (grab-wiggle /
  // pan), which stops the event from reaching a bubble-phase document listener
  // — so a bubble listener never fires and the panel wouldn't close on a board
  // click. A capture-phase listener runs first (document → target), before the
  // board captures the pointer, so it dismisses reliably. Same contract the
  // other canvas popovers use (see LanguageSwitcher).
  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (e: PointerEvent): void => {
      if (panelRef.current?.contains(e.target as Node)) return
      onClose()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return (): void => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className={styles.overlay} role="presentation" data-testid="theme-modal-overlay">
      <aside
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-labelledby="theme-modal-title"
        data-testid="theme-modal"
      >
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <h2 id="theme-modal-title" className={styles.title}>
              {t('board.theme.modalTitle')}
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={t('board.theme.modalCloseLabel')}
            data-testid="theme-modal-close"
          >
            ×
          </button>
        </div>

        <div className={styles.body} ref={bodyRef} onScroll={recomputeFade}>
          <section className={styles.group}>
            <div className={styles.groupLabel}>PATTERN THEMES</div>
            <ThemePicker
              themeId={themeId}
              onThemeChange={onThemeChange}
              variant="modal"
              showHeading={false}
              filterKind="pattern"
            />
          </section>

          <section className={styles.group}>
            <div className={styles.groupLabel}>WORKS</div>
            <ThemePicker
              themeId={themeId}
              onThemeChange={onThemeChange}
              variant="modal"
              showHeading={false}
              filterKind="work"
            />
          </section>
          {/* CUSTOMIZE — only for 'pattern' themes (customization non-null). */}
          {customization && (
            <ThemeCustomizeSection
              value={customization}
              isDefault={isDefaultCustomization}
              allowsPattern={themeAllowsPattern(themeId)}
              onChange={onCustomize}
            />
          )}
        </div>
        <div
          className={styles.scrollFade}
          data-visible={moreBelow ? 'true' : 'false'}
          aria-hidden="true"
        />
      </aside>
    </div>
  )
}
