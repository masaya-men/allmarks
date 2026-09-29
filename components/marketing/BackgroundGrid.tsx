// components/marketing/BackgroundGrid.tsx
import styles from './BackgroundGrid.module.css'

const GRID_COLUMNS = 12

/**
 * BackgroundGrid — fixed, full-viewport 12-column grid of faint vertical
 * hairlines rendered behind all landing-page content (mock lines 23–27;
 * markup at mock line 404). Purely decorative: aria-hidden and
 * pointer-events disabled.
 *
 * `data-lp-bggrid` is a stable hook for a later task's intro animation
 * (grows the lines from `scaleY(0)` via `[data-lp-bggrid] i`) — CSS Modules
 * hash class names, so the animation can't target `styles.bggrid` directly.
 */
export function BackgroundGrid(): React.ReactElement {
  return (
    <div className={styles.bggrid} data-lp-bggrid aria-hidden="true">
      <div className={styles.wrap}>
        {Array.from({ length: GRID_COLUMNS }, (_, index) => (
          <i key={index} />
        ))}
      </div>
    </div>
  )
}
