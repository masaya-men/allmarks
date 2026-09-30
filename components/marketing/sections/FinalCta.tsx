'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { createMarquee } from '@/lib/marketing/lp/marquee'
import styles from './FinalCta.module.css'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

/**
 * FinalCta — the closing section of the AllMarks LP, ported from
 * docs/private/lp-v10-mock.html (markup 495–507; CSS 320–352 plus the
 * .kbadge/.kb-ic mobile override at 387–388; motion 801–809 for the scrub
 * timeline + header hide, and 835–844 for the circle hover grow). A
 * 12-column hairline grid draws in, the label/rule/headline reveal, and a
 * circular "OPEN THE BOARD" badge pops in. Touching it — or moving the mouse
 * into the "zone" under the headline (see layoutZone) — grows the badge into
 * a huge arc that sweeps the near-black ground white, inverting the
 * headline/links (mix-blend-mode: difference) as it passes beneath them.
 * While it is grown the whole white circle is itself the "open the board"
 * button; it shrinks again once the mouse is outside both the zone and the
 * white circle. A large outlined "AllMarks" marquee (createMarquee, shared
 * with Tape.tsx) runs along the bottom edge.
 *
 * The section itself also owns the header's hide/show: while it is on
 * screen, <html data-lp-finale="1"> hides SiteHeader (see
 * SiteHeader.module.css, task 4) so the finale reads as a full black
 * takeover with no floating light-ground header. This is a state change,
 * not an animation, so it runs in both motion modes (R20); only the
 * decorative scrub timeline below is skipped under reduced motion.
 */

/** SVG path id for the circular textPath — there is only one finale per page. */
const RING_PATH_ID = 'lp-fin-ring-path'

/** English design word — same in every locale, never `landing.cta.label` (mock line 498: literal "Start" text node, no inner span). */
export const LABEL_TEXT = 'Start'

/** English constant circling the badge (mock line 502), never translated. Trailing space matches the mock's own textLength spacing. */
const RING_TEXT = 'OPEN THE BOARD ✦ OPEN THE BOARD ✦ '

/** English wordmark repeated to build the two-half marquee loop (mock line 506). */
const MARQUEE_WORD = 'AllMarks'
const MARQUEE_REPEATS = 6

/** Matches the shared `.wrap` 12-column grid (mock line 496 / lp-art.css). */
const GRID_LINE_COUNT = 12

/** The hot "zone" reaches this far (px) past the text link's right edge. */
const ZONE_PAD_RIGHT = 64

/**
 * Position of `el` inside `root` (top-left of the border box, px), summed from
 * offsetLeft/offsetTop up the offsetParent chain. Unlike getBoundingClientRect
 * this ignores CSS transforms (the scrub timeline moves the headline spans
 * and the text link), so the result only changes when the layout does.
 */
function offsetWithin(el: HTMLElement, root: HTMLElement): { left: number; top: number } {
  let left = 0
  let top = 0
  let node: HTMLElement | null = el
  while (node && node !== root) {
    left += node.offsetLeft
    top += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  return { left, top }
}

export function FinalCta(): React.ReactElement {
  const { t } = useI18n()

  const sectionRef = useRef<HTMLElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const gridLineRefs = useRef<(HTMLElement | null)[]>([])
  const labelRef = useRef<HTMLParagraphElement>(null)
  const lineRef = useRef<HTMLElement>(null)
  const headlineRef = useRef<HTMLHeadingElement>(null)
  const ctaWrapperRef = useRef<HTMLDivElement>(null)
  const circleRef = useRef<HTMLAnchorElement>(null)
  const textLinkRef = useRef<HTMLAnchorElement>(null)
  const zoneRef = useRef<HTMLAnchorElement>(null)
  const marqueeRootRef = useRef<HTMLDivElement>(null)
  const marqueeInnerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    const sticky = stickyRef.current
    const label = labelRef.current
    const line = lineRef.current
    const headline = headlineRef.current
    const ctaWrapper = ctaWrapperRef.current
    const circle = circleRef.current
    const textLink = textLinkRef.current
    const zone = zoneRef.current
    const marqueeRoot = marqueeRootRef.current
    const marqueeInner = marqueeInnerRef.current
    const gridLines = gridLineRefs.current

    if (
      !section || !sticky || !label || !line || !headline || !ctaWrapper || !circle || !textLink || !zone ||
      !marqueeRoot || !marqueeInner ||
      gridLines.length !== GRID_LINE_COUNT || gridLines.some((el) => el === null)
    ) {
      return undefined
    }
    const gridEls = gridLines as HTMLElement[]

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Scoped to this section's own headline — `.ml` is the shared masking
    // wrapper (lp-art.css); `> span` is the inner text span the mock
    // animates (mock's own `.fin-h .ml > span` selector, scoped here from
    // `headline` instead of a document-wide query).
    const headlineSpans = headline.querySelectorAll<HTMLElement>('.ml > span')

    // ── header hide (R20, always) + scrub timeline (motion-gated) ──
    const ctx = gsap.context(() => {
      // R20: state change, not an animation — created regardless of
      // prefers-reduced-motion. Cleanup (below) always removes the attribute.
      ScrollTrigger.create({
        trigger: section,
        start: 'top 60px',
        end: 'bottom top',
        onToggle: (self) => {
          if (self.isActive) {
            document.documentElement.setAttribute('data-lp-finale', '1')
          } else {
            document.documentElement.removeAttribute('data-lp-finale')
          }
        },
      })

      if (!reduce) {
        const tl = gsap.timeline({
          scrollTrigger: { trigger: section, start: 'top 30%', end: '+=90%', scrub: 0.5 },
        })
        tl.fromTo(gridEls, { scaleY: 0 }, { scaleY: 1, ease: 'none', stagger: 0.03, duration: 0.5 }, 0)
          .fromTo(label, { autoAlpha: 0 }, { autoAlpha: 1, ease: 'none', duration: 0.15 }, 0.08)
          .fromTo(line, { scaleX: 0 }, { scaleX: 1, ease: 'none', duration: 0.4 }, 0.12)
          .fromTo(
            headlineSpans,
            { yPercent: 105 },
            { yPercent: 0, ease: 'none', duration: 0.3, stagger: 0.08 },
            0.4,
          )
          .fromTo(
            circle,
            { scale: 0, rotation: -120 },
            { scale: 1, rotation: 0, ease: 'none', duration: 0.25 },
            0.62,
          )
          .fromTo(textLink, { autoAlpha: 0, x: -10 }, { autoAlpha: 1, x: 0, ease: 'none', duration: 0.2 }, 0.74)
      }
      // Under reduced motion no timeline is created at all: none of these
      // elements ever receive an inline scaleY(0)/autoAlpha(0)/yPercent(105)
      // "from" state, so their static CSS (already the finished pose) is
      // what renders from first paint — same pattern as Problem.tsx/R17.
    }, sectionRef)

    // ── circle hover/focus: grows into a huge arc (mock 835–844) ──
    let isHot = false
    // The current --big: the white circle's radius is the badge's radius ×
    // bigScale. finGeo writes it; the pointer hit-test below reads it.
    let bigScale = 0
    function finGeo(): void {
      // Reading rects here is an interaction (hover/focus), not a scroll
      // tick — the ruling explicitly allows it. Non-null assertions below:
      // TS control-flow narrowing from the guard above doesn't persist into
      // nested function declarations (same reasoning as Hero.tsx's `board!`).
      const st = sticky!.getBoundingClientRect()
      const b = circle!.getBoundingClientRect()
      const cx = b.left + b.width / 2 - st.left
      const cy = b.top + b.height / 2 - st.top
      // Distance from the badge centre to the sticky stage's top-right
      // corner — the radius that lets the circle's edge pass just short of
      // that corner, so only its top-right arc ever crosses the screen.
      const tr = Math.hypot(st.width - cx, cy)
      bigScale = Math.max(5, (tr * 0.74) / (circle!.offsetWidth / 2))
      section!.style.setProperty('--big', bigScale.toFixed(2))
    }
    function addHot(): void {
      if (isHot) return
      isHot = true
      finGeo()
      section!.classList.add(styles.hot!)
      // Mirrors .hot as a plain attribute (state, not animation) for tests.
      section!.setAttribute('data-hot', '1')
    }
    function removeHot(): void {
      if (!isHot) return
      isHot = false
      section!.classList.remove(styles.hot!)
      section!.removeAttribute('data-hot')
    }

    // ── the "zone": a transparent /board link that also triggers .hot ──
    // A rectangle in stage-local coordinates (origin = .finSt's top-left, so
    // it doesn't depend on scroll): from the headline's bottom edge to the
    // stage's bottom edge, and from the stage's left edge to the text link's
    // right edge + ZONE_PAD_RIGHT. Measured only at layout time (mount,
    // resize, fonts ready), never while scrolling.
    let zoneTop = 0
    let zoneW = 0
    function layoutZone(): void {
      const h = offsetWithin(headline!, sticky!)
      const l = offsetWithin(textLink!, sticky!)
      zoneTop = h.top + headline!.offsetHeight
      zoneW = Math.min(sticky!.clientWidth, l.left + textLink!.offsetWidth + ZONE_PAD_RIGHT)
      zone!.style.top = zoneTop + 'px'
      zone!.style.width = zoneW + 'px'
      zone!.style.height = Math.max(0, sticky!.clientHeight - zoneTop) + 'px'
    }
    layoutZone()

    const onPointerEnter = (e: PointerEvent): void => {
      if (e.pointerType !== 'mouse') return
      addHot()
    }
    // Hot starts when the mouse is in the zone and ends only once it is
    // outside BOTH the zone and the grown white circle (centre = badge
    // centre, radius = badge radius × the current --big). Rects are read here
    // on pointer moves (an interaction), never on scroll ticks.
    const onStageMove = (e: PointerEvent): void => {
      if (e.pointerType !== 'mouse') return
      const st = sticky!.getBoundingClientRect()
      const px = e.clientX - st.left
      const py = e.clientY - st.top
      if (px >= 0 && px <= zoneW && py >= zoneTop && py <= st.height) {
        addHot()
        return
      }
      if (!isHot) return
      const b = circle!.getBoundingClientRect()
      const r = (circle!.offsetWidth / 2) * bigScale
      if (Math.hypot(e.clientX - (b.left + b.width / 2), e.clientY - (b.top + b.height / 2)) > r) {
        removeHot()
      }
    }
    const onStageLeave = (): void => {
      removeHot()
    }
    const onFocusIn = (): void => {
      addHot()
    }
    const onFocusOut = (): void => {
      removeHot()
    }
    ctaWrapper.addEventListener('pointerenter', onPointerEnter)
    ctaWrapper.addEventListener('focusin', onFocusIn)
    ctaWrapper.addEventListener('focusout', onFocusOut)
    sticky.addEventListener('pointermove', onStageMove)
    sticky.addEventListener('pointerleave', onStageLeave)

    // ── outlined "AllMarks" marquee (lib/marketing/lp/marquee.ts, shared with Tape.tsx) ──
    let disposed = false
    const marquee = createMarquee(marqueeRoot, marqueeInner, 0.55)

    function relayout(): void {
      if (disposed) return
      marquee.measure()
      layoutZone()
    }
    let resizeTimer: number | undefined
    const onResize = (): void => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(relayout, 160)
    }
    window.addEventListener('resize', onResize)

    if (document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        relayout()
      })
    }

    return () => {
      disposed = true
      ctx.revert()
      // R20: cleanup always removes the attribute, regardless of which
      // branch of the toggle it was last set by.
      document.documentElement.removeAttribute('data-lp-finale')
      ctaWrapper.removeEventListener('pointerenter', onPointerEnter)
      ctaWrapper.removeEventListener('focusin', onFocusIn)
      ctaWrapper.removeEventListener('focusout', onFocusOut)
      sticky.removeEventListener('pointermove', onStageMove)
      sticky.removeEventListener('pointerleave', onStageLeave)
      removeHot()
      window.clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      marquee.destroy()
    }
  }, [])

  const headlineLines = t('landing.cta.headline').split('\n')

  return (
    // data-lp-fin / data-lp-fingrid: hooks for ScrollRail (measures this section — its top is where the
    // rail's progress reaches 1 — and tilts the grid's .wrap in step with the background grid).
    <section ref={sectionRef} className={styles.fin} data-lp-fin>
      <div ref={stickyRef} className={styles.finSt}>
        <div className={styles.finGrid} aria-hidden="true">
          <div className={`wrap ${styles.finGridWrap}`} data-lp-fingrid>
            {Array.from({ length: GRID_LINE_COUNT }, (_, i) => (
              <i
                key={i}
                ref={(el) => {
                  gridLineRefs.current[i] = el
                }}
              />
            ))}
          </div>
        </div>

        <div className={`wrap ${styles.finIn}`}>
          <p ref={labelRef} className={`label ${styles.blend}`}>
            <i className="ln" />
            {LABEL_TEXT}
          </p>
          <i ref={lineRef as React.RefObject<HTMLElement>} className={`${styles.finLine} ${styles.blend}`} />
          <h2 ref={headlineRef} className={`${styles.finH} ${styles.blend}`}>
            {headlineLines.map((line, i) => (
              <span className="ml" key={i}>
                <span data-lp-text>{line}</span>
              </span>
            ))}
          </h2>
          <div ref={ctaWrapperRef} className={styles.finCta} data-finale-cta>
            <Link
              ref={circleRef}
              href="/board"
              className={styles.kbadge}
              aria-label={t('landing.hero.ctaPrimary')}
            >
              <span className={styles.kbBg} />
              <span className={styles.kbRing} aria-hidden="true">
                <svg viewBox="0 0 200 200">
                  <defs>
                    <path id={RING_PATH_ID} d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
                  </defs>
                  <text>
                    <textPath href={`#${RING_PATH_ID}`} textLength={489} lengthAdjust="spacing">
                      {RING_TEXT}
                    </textPath>
                  </text>
                </svg>
              </span>
              <span className={styles.kbIc} aria-hidden="true">↗</span>
            </Link>
            <Link ref={textLinkRef} href="/board" className={`${styles.finLink} ${styles.blend}`} data-lp-text>
              {t('landing.cta.button')}
            </Link>
          </div>
        </div>

        {/* Hot zone (see layoutZone): a transparent /board link, placed after
            .finIn and outside [data-finale-cta] on purpose. Its size is set by
            the effect, so it is 0×0 until then. */}
        <Link ref={zoneRef} href="/board" tabIndex={-1} aria-hidden="true" className={styles.finZone} />

        <div ref={marqueeRootRef} className={styles.finTk} aria-hidden="true">
          <div ref={marqueeInnerRef} className={styles.finTkIn}>
            {Array.from({ length: MARQUEE_REPEATS }, (_, i) => (
              <span key={i}>{MARQUEE_WORD}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
