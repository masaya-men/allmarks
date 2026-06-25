'use client'

import type { CSSProperties, ReactElement } from 'react'
import { paperAssetUrl } from '@/lib/board/paper-assets'
import styles from './PaperFramePlate.module.css'

/**
 * Decorative "ALLMARKS MK-1 / ARCHIVE" engraved plate pinned to the board's
 * bottom-left margin — paper-atelier chrome only (Plan 2 §4.7). It is pure
 * decoration: aria-hidden, pointer-events:none, no role, no handlers. Mounted
 * by BoardRoot ONLY when themeId === 'paper-atelier', as a sibling of
 * <BoardChrome/>. Fades with the rest of the chrome while the Lightbox is open
 * (the parent passes `hidden`, mirroring BoardChrome's hidden prop).
 *
 * The ALL-CAPS technical labels (ALLMARKS MK-1 / ARCHIVE) are intentionally
 * hardcoded world-clear English — no i18n sentence is involved. The maker label
 * uses --font-mono (untouched on paper) so it reads as an engraved spec plate.
 *
 * NOTE: the visually-similar 'ALLMARKS · MK-1' string in TunePresetColumn.tsx
 * (L48-50) is an UNRELATED TUNE column maker label with its own getByText test.
 * This component is identified ONLY by data-testid="paper-frame-plate" to avoid
 * a text collision.
 *
 * Asset backing (Task 7): when mk1-plate.png is placed, the wrapper receives
 * `data-paper-plate` + a backgroundImage style; the CSS modifier drops the
 * baked-in background/border/box-shadow (the PNG bakes those) and sets
 * background-size:100% 100%. Text spans stay rendered on top (PNG is text-free).
 * When the asset is absent → current CSS plate renders unchanged.
 */
export function PaperFramePlate({ hidden }: {
  /** Mirror of BoardChrome's hidden prop — true while the Lightbox is open, so
   *  the plate fades out with the rest of the chrome. */
  readonly hidden: boolean
}): ReactElement {
  const assetUrl = paperAssetUrl('mk1-plate')
  const plateStyle: CSSProperties | undefined = assetUrl !== null
    ? { backgroundImage: `url("${assetUrl}")` }
    : undefined

  return (
    <div
      className={hidden ? `${styles.plate} ${styles.hidden}` : styles.plate}
      data-testid="paper-frame-plate"
      data-hidden={hidden ? 'true' : 'false'}
      data-paper-plate={assetUrl !== null ? 'true' : undefined}
      style={plateStyle}
      aria-hidden="true"
    >
      <span className={styles.title}>ALLMARKS MK-1</span>
      <span className={styles.rule} />
      <span className={styles.sub}>ARCHIVE</span>
    </div>
  )
}
