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

/**
 * Per-mark cover fractions (0..1) for any number of labels sitting on the runway.
 * The fill front is at progress * total px from the track's left edge; a mark at
 * lefts[i] with width widths[i] is covered from its left edge to its right edge.
 */
export function markFractions(
  progress: number,
  total: number,
  lefts: readonly number[],
  widths: readonly number[],
): number[] {
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0))
  const x = p * total
  return lefts.map((l, i) => {
    const w = widths[i] ?? 0
    return w > 0 ? Math.min(1, Math.max(0, (x - l) / w)) : x >= l ? 1 : 0
  })
}

/** Result of laying marks out along the track. */
export type MarkLayout = { readonly lefts: number[]; readonly fits: boolean }

/**
 * Places marks at their natural spot (at[i] * total px), pushed right just enough
 * that neighbours keep `gap` px apart. fits=false if the last one would run past `limit`.
 */
export function layoutMarks(
  at: readonly number[],
  widths: readonly number[],
  total: number,
  limit: number,
  gap: number,
): MarkLayout {
  const lefts: number[] = []
  let edge = -Infinity
  at.forEach((q, i) => {
    const l = Math.max(q * total, edge)
    lefts.push(l)
    edge = l + (widths[i] ?? 0) + gap
  })
  const last = lefts.length - 1
  const fits = last < 0 || lefts[last] + (widths[last] ?? 0) <= limit
  if (!fits) {
    // Pull marks back left (last to first) so the last one ends at `limit` and
    // neighbours keep `gap`; never past the track's left end.
    let right = limit
    for (let i = last; i >= 0; i--) {
      const w = widths[i] ?? 0
      lefts[i] = Math.max(0, Math.min(lefts[i], right - w))
      right = lefts[i] - gap
    }
  }
  return { lefts, fits }
}

/** Viewport width (px) at or below which marks show numbers only. */
export const MARK_COMPACT_MAX_VIEWPORT = 900
/** Minimum clear space (px) between two marks, and before the right-end label. */
export const MARK_GAP = 14

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
  const marks = Array.from(rule.querySelectorAll<HTMLElement>('[data-sr-mark]'))
  const at = marks.map((m) => Number(m.dataset.srAt ?? 0))
  let lefts: number[] = []
  let widths: number[] = []
  let lastMarks: number[] = []
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
  const applyMarks = (progress: number): void => {
    if (marks.length === 0) return
    const f = markFractions(progress, trackSpan + labelW, lefts, widths)
    f.forEach((v, i) => {
      const q = Math.round(v * 1000) / 10
      if (lastMarks[i] === q) return
      lastMarks[i] = q
      marks[i]?.style.setProperty('--sr-lf', `${q}%`)
    })
  }
  return {
    measure: () => {
      if (trk && label) {
        // label.offsetLeft - trk.offsetLeft = track width + the gap up to the label
        trackSpan = Math.max(0, label.offsetLeft - trk.offsetLeft)
        labelW = label.offsetWidth
      }
      if (marks.length > 0) {
        const total = trackSpan + labelW
        const limit = trackSpan - MARK_GAP
        const narrow = window.innerWidth <= MARK_COMPACT_MAX_VIEWPORT
        const place = (): boolean => {
          widths = marks.map((m) => m.offsetWidth)
          const lay = layoutMarks(at, widths, total, limit, MARK_GAP)
          lefts = lay.lefts
          return lay.fits
        }
        rule.removeAttribute('data-sr-compact')
        if (narrow || !place()) {
          rule.setAttribute('data-sr-compact', '')
          place()
        }
        marks.forEach((m, i) => {
          m.style.left = `${(lefts[i] ?? 0).toFixed(1)}px`
        })
        lastMarks = []
      }
      lastTrack = -1
      apply(last)
      applyMarks(last)
    },
    set: (progress: number) => {
      last = progress
      apply(progress)
      applyMarks(progress)
    },
  }
}
