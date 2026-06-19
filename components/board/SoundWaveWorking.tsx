import { type ReactElement } from 'react'
import styles from './SoundWaveWorking.module.css'

/** Theme-driven "working" motif. Default = sound-wave bars. Add a theme id →
 *  element branch here to restyle for future themes. */
export function SoundWaveWorking({ themeId }: { readonly themeId: string }): ReactElement {
  void themeId // only the default exists today; switch on themeId when themes grow
  return (
    <svg data-testid="sound-wave-working" className={styles.wave} viewBox="0 0 64 24" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} x={4 + i * 8} y="2" width="4" height="20" rx="2" style={{ animationDelay: `${i * 90}ms` }} />
      ))}
    </svg>
  )
}
