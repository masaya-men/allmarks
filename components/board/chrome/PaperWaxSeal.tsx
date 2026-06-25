'use client'

import type { ReactElement } from 'react'
import { paperAssetUrl } from '@/lib/board/paper-assets'
import styles from './PaperWaxSeal.module.css'

/**
 * Decorative wax "A" seal + a decorative "+" stamp pinned to the board's
 * bottom-right margin — paper-atelier chrome only (Plan 2 §4.7).
 *
 * DECISION DEFAULT (flagged in the plan): the green "+" is a DECORATIVE
 * wax-pressed stamp, NOT a functional save button. It therefore has no onClick,
 * no role, is not a <button>/<a>, and is pointer-events:none like the rest of
 * this chrome. Per-card captions are intentionally absent elsewhere; this seal
 * is the only branded flourish in the bottom-right.
 *
 * The seal body is FOREST wax (--color-accent-primary) with a debossed rim and
 * an IVORY pressed "A" (the AllMarks monogram — A-motif logo, NOT M/X). The "+"
 * is GOLD PEEL (--accent-gold). All ALL-CAPS / single-glyph marks are
 * world-clear and need no i18n.
 *
 * Mounted by BoardRoot ONLY when themeId === 'paper-atelier'. Fades with the
 * chrome while the Lightbox is open via the `hidden` prop (mirrors BoardChrome).
 *
 * Asset backing (Task 7): when wax-seal-a.png is placed, the SVG seal is
 * replaced with a <span data-paper-seal> using the PNG as backgroundImage.
 * The rotated "+" stamp glyph is kept as-is. When the asset is absent → existing
 * inline SVG seal renders unchanged.
 */
export function PaperWaxSeal({ hidden }: {
  /** Mirror of BoardChrome's hidden prop — true while the Lightbox is open. */
  readonly hidden: boolean
}): ReactElement {
  const assetUrl = paperAssetUrl('wax-seal-a')

  return (
    <div
      className={hidden ? `${styles.wrap} ${styles.hidden}` : styles.wrap}
      data-testid="paper-wax-seal"
      data-hidden={hidden ? 'true' : 'false'}
      aria-hidden="true"
    >
      {/* decorative "+" stamp — NOT a button, NOT a save action */}
      <span className={styles.stamp} data-testid="paper-wax-stamp">+</span>
      {/* wax "A" seal: PNG when placed, inline SVG when absent */}
      {assetUrl !== null ? (
        <span
          data-paper-seal
          className={styles.sealImg}
          style={{ backgroundImage: `url("${assetUrl}")` }}
        />
      ) : (
        <svg
          className={styles.seal}
          viewBox="0 0 64 64"
          width="64"
          height="64"
          role="presentation"
          focusable="false"
        >
          {/* irregular wax blob — a circle with subtle drips, FOREST fill */}
          <circle cx="32" cy="32" r="27" className={styles.wax} />
          <circle cx="32" cy="32" r="27" className={styles.waxRim} />
          {/* pressed monogram "A" — IVORY, debossed look via the rim stroke */}
          <text
            x="32"
            y="42"
            textAnchor="middle"
            className={styles.monogram}
          >
            A
          </text>
        </svg>
      )}
    </div>
  )
}
