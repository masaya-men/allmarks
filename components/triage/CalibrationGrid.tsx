import type { ReactElement } from 'react'
import styles from './CalibrationGrid.module.css'

/**
 * Refraction calibration grid (TEMPORARY, session 78).
 *
 * A neon-yellow line grid placed between AmbientBackdrop (z-index 0)
 * and the central canvas (z-index 1) so we can see — objectively —
 * whether the canvas's SVG displacement filter (`triage-glass-refract`,
 * scale 80) is bending the lines. Without this grid, the refraction is
 * invisible against the diffuse photographic ambient backdrop.
 *
 * Activate by appending `?grid=1` to the /triage URL. Remove the
 * component + the URL gate once the refraction numbers are dialled in.
 */
export function CalibrationGrid(): ReactElement {
  return (
    <div className={styles.layer} aria-hidden="true" data-testid="calibration-grid">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="triage-cal-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" stroke="#c4ff00" strokeWidth="1.5" fill="none" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#triage-cal-grid)" />
      </svg>
    </div>
  )
}
