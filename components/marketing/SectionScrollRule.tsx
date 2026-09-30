import type { RefObject } from 'react'
import styles from './SectionScrollRule.module.css'

/** English design word at the left end, same in every locale, never translated. */
const SCROLL_WORD = 'Scroll'

/** Ticks along the track (same 8 positions as the hero's hairlines, static here). */
const TICKS: readonly number[] = [0, 14.2857, 28.5714, 42.8571, 57.1429, 71.4286, 85.7143, 100]

/** Rolling-letter word: each letter doubled in <s> with a staggered delay. */
function Roll({ word, className }: { readonly word: string; readonly className: string }): React.ReactElement {
  return (
    <span className={className}>
      {word.split('').map((ch, i) => (
        <b key={i}>
          <s style={{ animationDelay: `${(i * 0.05).toFixed(2)}s` }}>{ch}</s>
          <s style={{ animationDelay: `${(i * 0.05).toFixed(2)}s` }}>{ch}</s>
        </b>
      ))}
    </span>
  )
}

/**
 * The bottom row of a pinned screen: "Scroll", a track, and the next section's name.
 * Drive it with createScrollRuleDriver(ruleRef.current) from lib/marketing/lp/scroll-rule.
 *
 * @param nextLabel English name of the next section (never translated).
 * @param ruleRef Ref to the root element, handed to the driver by the owner section.
 */
export function SectionScrollRule({
  nextLabel,
  ruleRef,
}: {
  readonly nextLabel: string
  readonly ruleRef: RefObject<HTMLDivElement | null>
}): React.ReactElement {
  return (
    <div ref={ruleRef} className={`wrap ${styles.rule}`} aria-hidden="true">
      <Roll word={SCROLL_WORD} className={styles.roll} />
      <span className={styles.trk} data-sr-trk>
        <i className={styles.base} />
        <i className={styles.fill} />
        {TICKS.map((left, i) => (
          <i key={i} className={styles.tk} style={{ left: `${left.toFixed(4)}%` }} />
        ))}
      </span>
      <span className={styles.next} data-sr-label>
        <Roll word={nextLabel} className={`${styles.roll} ${styles.slow}`} />
        <span className={styles.inv}>
          <Roll word={nextLabel} className={`${styles.roll} ${styles.slow}`} />
        </span>
      </span>
    </div>
  )
}
