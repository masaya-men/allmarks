/**
 * Pure + DOM helpers for the per-section scroll rule (SectionScrollRule).
 * The rule's "runway" is: track (incl. the gap up to the label) + label.
 * Section pin progress 0..1 fills the track first, then flows into the label.
 */

/** Result of splitting one 0..1 progress across the track and the label. */
export type ScrollRuleSplit = { readonly track: number; readonly label: number }

/**
 * Maps pin progress onto the two segments (both 0..1).
 * track = share of the track span filled; label = share of the label covered.
 */
export function scrollRuleSplit(progress: number, trackSpan: number, labelW: number): ScrollRuleSplit {
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0))
  const total = trackSpan + labelW
  if (total <= 0) return { track: p, label: p }
  const x = p * total
  const track = trackSpan > 0 ? Math.min(1, x / trackSpan) : 1
  const label = labelW > 0 ? Math.min(1, Math.max(0, (x - trackSpan) / labelW)) : 0
  return { track, label }
}

/** Handle returned by createScrollRuleDriver. */
export type ScrollRuleDriver = {
  /** Re-measure the cached track/label widths (call on refresh/resize/fonts). */
  readonly measure: () => void
  /** Apply a 0..1 pin progress (writes CSS variables only; no layout reads). */
  readonly set: (progress: number) => void
}

/** Binds to a rule element rendered by SectionScrollRule (found via data attributes). */
export function createScrollRuleDriver(rule: HTMLElement): ScrollRuleDriver {
  const trk = rule.querySelector<HTMLElement>('[data-sr-trk]')
  const label = rule.querySelector<HTMLElement>('[data-sr-label]')
  let trackSpan = 0
  let labelW = 0
  let last = 0
  let lastTrack = -1
  let lastLabel = -1
  const apply = (progress: number): void => {
    const s = scrollRuleSplit(progress, trackSpan, labelW)
    if (s.track === lastTrack && s.label === lastLabel) return
    lastTrack = s.track
    lastLabel = s.label
    rule.style.setProperty('--sr-fill', s.track.toFixed(4))
    rule.style.setProperty('--sr-lf', `${(s.label * 100).toFixed(2)}%`)
  }
  return {
    measure: () => {
      if (trk && label) {
        // label.offsetLeft - trk.offsetLeft = track width + the gap up to the label
        trackSpan = Math.max(0, label.offsetLeft - trk.offsetLeft)
        labelW = label.offsetWidth
      }
      lastTrack = -1
      apply(last)
    },
    set: (progress: number) => {
      last = progress
      apply(progress)
    },
  }
}
