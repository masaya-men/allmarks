// components/marketing/BackgroundGrid.tsx
import type { CSSProperties } from 'react'
import styles from './BackgroundGrid.module.css'

const GRID_COLUMNS = 12
/** 縦線は 13 本(左端 + 各列の右端)。それぞれに目盛りが付く。 */
const LINE_COUNT = GRID_COLUMNS + 1

/**
 * BackgroundGrid — fixed, full-viewport 12-column grid of faint vertical
 * hairlines rendered behind all landing-page content (mock lines 23–27;
 * markup at mock line 404, ruler ticks at v11 mock line 422). Purely
 * decorative: aria-hidden and pointer-events disabled.
 *
 * `data-lp-bggrid` is a stable hook for a later task's intro animation
 * (grows the lines from `scaleY(0)` via `[data-lp-bggrid] i`) — CSS Modules
 * hash class names, so the animation can't target `styles.bggrid` directly.
 * That is also why the ruler ticks are `span`s, never `i`s: the intro must not
 * scale them.
 *
 * `data-lp-bggrid-wrap` marks the `.wrap` that ScrollRail tilts (skewX) and
 * `data-lp-rtk` marks each line's ruler tick that ScrollRail slides along the
 * line. All of the motion is written by ScrollRail's single ticker; this
 * component stays script-free.
 */
export function BackgroundGrid(): React.ReactElement {
  return (
    <div className={styles.bggrid} data-lp-bggrid aria-hidden="true">
      <div className={styles.wrap} data-lp-bggrid-wrap>
        {Array.from({ length: GRID_COLUMNS }, (_, index) => (
          <i key={index} />
        ))}
        {Array.from({ length: LINE_COUNT }, (_, k) => (
          <span key={k} className={styles.rtk} style={{ '--k': k } as CSSProperties} data-lp-rtk />
        ))}
      </div>
    </div>
  )
}
