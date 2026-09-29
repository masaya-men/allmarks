'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { makeCard, filmOf, slidesOf } from '@/lib/marketing/lp/art'
import { E } from '@/lib/marketing/lp/motion-math'
import { useModKey } from '@/lib/marketing/lp/use-mod-key'
import { tweetKey } from '@/lib/marketing/lp/tweet-key'
import {
  FEATURE_CARDS,
  CARD_NEW,
  CARD_FILM,
  CARD_DRAG,
  CARD_SLIDES,
  FEAT_CHAPTER_MS,
  FEAT_DT_MAX_MS,
  FEAT_FADE_MS,
  cursorTip,
  featClock,
  featureLayouts,
  featState,
  type FeatureGeometry,
  type FeatureHover,
  type FeatureState,
  type PillBox,
} from '@/lib/marketing/lp/feature-timeline'
import type { Pt } from '@/lib/marketing/lp/types'
import styles from './Features.module.css'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

/**
 * Features — the six-chapter demo, ported from docs/private/lp-v10-mock.html
 * (markup 447–476, CSS 213–297 minus the card-internal parts already in
 * ../lp-art.css, motion 680–776 + divider tween 798–799, resize 861) plus the
 * v11 cursor choreography from docs/private/lp-v11-mock.html (large green
 * cursor that stays on from 02 to 06, stops on each target to "hover" before
 * it presses, and rings green the moment it first appears).
 *
 * The section scrolls like any other. The demo board on the right plays by
 * itself, like a short video with chapters 01–06: a clock (featClock, one
 * chapter per FEAT_CHAPTER_MS) drives P, a cursor clicks, cards move, a video
 * card really plays, MOTION stops it, tags filter, an entry screen appears,
 * and the board is shared as an image. After 06 the board fades out, goes back
 * to 01 and fades in again (a loop). It runs only while the board is on screen
 * and the tab is visible, and is held while a mouse pointer is over the
 * chapter list or the board. The 01–06 list is a set of buttons: pressing one
 * jumps to the head of that chapter and keeps playing. With reduced motion
 * nothing advances by itself — each chapter shows its finished pose and the
 * list buttons switch chapters.
 *
 * All of the maths (masonry layouts, easing, waypoints, which target is
 * hovered, the clock) lives in feature-timeline.ts — this component only
 * measures geometry (at layout time, never per frame) and writes the resulting
 * FeatureState to the DOM every frame.
 */

/** English design word — same in every locale, never `landing.features.label` (mock line 448). */
const FEATURES_LABEL = 'Features'

/** English wordmark — mock's literal "AllMarks" text (pchrome watermark + entry screen). Never translated. */
const WORDMARK = 'AllMarks'

/** The demo plays only while at least this share of the board is on screen (IntersectionObserver threshold). */
const PLAY_VISIBLE_RATIO = 0.35

type StepId = 'capture' | 'layout' | 'live' | 'organize' | 'privacy' | 'share'

/** The six steps: list-button name (English, hardcoded) + i18n source for title/body. */
const STEPS: readonly { readonly num: string; readonly name: string; readonly id: StepId }[] = [
  { num: '01', name: 'Capture', id: 'capture' },
  { num: '02', name: 'Layout', id: 'layout' },
  { num: '03', name: 'Live', id: 'live' },
  { num: '04', name: 'Organize', id: 'organize' },
  { num: '05', name: 'Privacy', id: 'privacy' },
  { num: '06', name: 'Share', id: 'share' },
]

/** 06 uses landing.share.* (all one line, no split); 01–05 use landing.features.<id>.* (mock 453–458). */
function stepTitleKey(id: StepId): string {
  return id === 'share' ? 'landing.share.headline' : `landing.features.${id}.title`
}
function stepBodyKey(id: StepId): string {
  return id === 'share' ? 'landing.share.body' : `landing.features.${id}.body`
}

/** The tag filter pills (mock 466) — English design words, never translated. */
const TAGS: readonly { readonly tag: 'all' | 'music' | 'design'; readonly label: string }[] = [
  { tag: 'all', label: 'all' },
  { tag: 'music', label: 'music' },
  { tag: 'design', label: 'design' },
]

/** Which part of the section a mouse pointer can hold (pause) the demo from. */
type HoldZone = 'nav' | 'board'

/** What the demo is doing: playing chapters, fading the board out at the loop boundary, or fading it back in. */
type Phase = 'play' | 'out' | 'in'

export function Features(): React.ReactElement {
  const { t } = useI18n()
  // Synced via its own effect (never written during render — react-hooks/refs,
  // task-6 ruling R21) so the mount-time effect below always sees the latest
  // translator without needing `t` in its dependency array — same pattern as
  // Hero.tsx / Problem.tsx.
  const tRef = useRef(t)
  useEffect(() => {
    tRef.current = t
  }, [t])

  // Mac/iOS paste-shortcut label (R19) — the Features paste chip shows this
  // instead of the mock's hard-coded "Ctrl".
  const modKey = useModKey()

  const sectionRef = useRef<HTMLElement>(null)
  const ruleLineRef = useRef<HTMLElement>(null)
  const fnavRef = useRef<HTMLOListElement>(null)
  const fnavRefs = useRef<(HTMLButtonElement | null)[]>([])
  const railFillRef = useRef<HTMLElement>(null)
  const ftextsRef = useRef<HTMLDivElement>(null)
  const ftextRefs = useRef<(HTMLElement | null)[]>([])
  const fpanelRef = useRef<HTMLDivElement>(null)
  const fstageRef = useRef<HTMLDivElement>(null)
  const fshareRef = useRef<HTMLSpanElement>(null)
  const fmotionRef = useRef<HTMLSpanElement>(null)
  const fpasteRef = useRef<HTMLDivElement>(null)
  const fpsRef = useRef<HTMLDivElement>(null)
  const allBtnRef = useRef<HTMLButtonElement>(null)
  const musicBtnRef = useRef<HTMLButtonElement>(null)
  const designBtnRef = useRef<HTMLButtonElement>(null)
  const fpuRef = useRef<HTMLElement>(null)
  const fbwRef = useRef<HTMLDivElement>(null)
  const fboardRef = useRef<HTMLDivElement>(null)
  const frectRef = useRef<SVGRectElement>(null)
  const pchipRef = useRef<HTMLSpanElement>(null)
  const fstartRef = useRef<HTMLDivElement>(null)
  const fsbtnRef = useRef<HTMLSpanElement>(null)
  const schipsRef = useRef<HTMLDivElement>(null)
  const scpRef = useRef<HTMLSpanElement>(null)
  const fclickRef = useRef<HTMLElement>(null)
  const fringRef = useRef<HTMLElement>(null)
  const fflashRef = useRef<HTMLElement>(null)
  const fcurRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    const ruleLine = ruleLineRef.current
    const fnav = fnavRef.current
    const railFill = railFillRef.current
    const ftextsEl = ftextsRef.current
    const fpanel = fpanelRef.current
    const fstage = fstageRef.current
    const fshare = fshareRef.current
    const fmotion = fmotionRef.current
    const fpaste = fpasteRef.current
    const fps = fpsRef.current
    const allBtn = allBtnRef.current
    const musicBtn = musicBtnRef.current
    const designBtn = designBtnRef.current
    const fpu = fpuRef.current
    const fbw = fbwRef.current
    const fboard = fboardRef.current
    const frect = frectRef.current
    const pchip = pchipRef.current
    const fstart = fstartRef.current
    const fsbtn = fsbtnRef.current
    const schips = schipsRef.current
    const scp = scpRef.current
    const fclick = fclickRef.current
    const fring = fringRef.current
    const fflash = fflashRef.current
    const fcur = fcurRef.current
    const fnavEls = fnavRefs.current
    const ftextEls = ftextRefs.current

    if (
      !section || !ruleLine || !fnav || !railFill || !ftextsEl || !fpanel || !fstage || !fshare || !fmotion || !fpaste ||
      !fps || !allBtn || !musicBtn || !designBtn || !fpu || !fbw || !fboard || !frect || !pchip || !fstart || !fsbtn ||
      !schips || !scp || !fclick || !fring || !fflash || !fcur ||
      fnavEls.length !== STEPS.length || ftextEls.length !== STEPS.length ||
      fnavEls.some((el) => el === null) || ftextEls.some((el) => el === null)
    ) {
      return undefined
    }
    const navBtns = fnavEls as HTMLButtonElement[]
    const textEls = ftextEls as HTMLElement[]

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let disposed = false

    // ── board: 10 cards (mock 683–687) ──
    const fCards: HTMLDivElement[] = FEATURE_CARDS.map((spec, i) => {
      const el = makeCard(spec, {
        amb: false,
        tweetText: spec.tweet != null ? tRef.current(tweetKey(spec.tweet)) : undefined,
      })
      if (i === CARD_SLIDES) {
        const vb = document.createElement('i')
        vb.className = 'vbadge'
        vb.textContent = '▶'
        el.appendChild(vb)
      }
      if (i === CARD_FILM) {
        el.style.transition = 'box-shadow .45s'
        el.setAttribute('data-film-card', '')
      }
      fboard.appendChild(el)
      return el
    })
    const vbadgeEl = fCards[CARD_SLIDES]?.querySelector<HTMLElement>('.vbadge') ?? null
    const filmCardEl = fCards[CARD_FILM]
    const dragCardEl = fCards[CARD_DRAG]
    const newCardEl = fCards[CARD_NEW]
    const film = filmCardEl ? filmOf(filmCardEl) : null
    const slideEls = fCards[CARD_SLIDES] ? slidesOf(fCards[CARD_SLIDES]) : null
    let filmAcc = 0
    let slideT = 0
    let slideI = 0
    let livePlaying = false

    // ── geometry (measure() / ftH() — init, resize, fonts.ready ONLY; the
    //    ticker below never reads layout, only the cached `geo`) ──
    function rc(el: HTMLElement): Pt {
      const r = el.getBoundingClientRect()
      const p = fpanel!.getBoundingClientRect()
      return { x: r.left - p.left - fpanel!.clientLeft + r.width / 2, y: r.top - p.top - fpanel!.clientTop + r.height / 2 }
    }
    function measureTargets(): FeatureGeometry['to'] {
      const savedSchips = schips!.style.transform
      const savedFbw = fbw!.style.transform
      schips!.style.transform = 'none'
      fbw!.style.transform = 'none'
      const to = {
        motion: rc(fmotion!),
        share: rc(fshare!),
        music: rc(musicBtn!),
        design: rc(designBtn!),
        start: rc(fsbtn!),
        copy: rc(scp!),
      }
      schips!.style.transform = savedSchips
      fbw!.style.transform = savedFbw
      return to
    }
    function pillBox(btn: HTMLButtonElement): PillBox {
      return { x: btn.offsetLeft + 8, w: btn.offsetWidth - 16 }
    }
    function measure(): FeatureGeometry {
      const L = featureLayouts(fboard!.clientWidth)
      const cw = L.A.cw
      fCards.forEach((el, i) => {
        el.style.width = `${cw}px`
        el.style.height = `${cw / FEATURE_CARDS[i]!.a}px`
      })
      frect!.setAttribute('width', String(Math.max(0, fbw!.clientWidth - 2)))
      frect!.setAttribute('height', String(Math.max(0, fbw!.clientHeight - 2)))
      const pills = { all: pillBox(allBtn!), music: pillBox(musicBtn!), design: pillBox(designBtn!) }
      const bw = fboard!.clientWidth
      const bh = fboard!.clientHeight
      const bx = fbw!.offsetLeft
      const by = fbw!.offsetTop
      const shotK = fpanel!.clientWidth < 560 ? 0.28 : 0.2
      // The cursor image is 40px (30px on narrow screens); its tip must land on the
      // pointed-at coordinate, so the tip offset scales with the measured size.
      const tip = cursorTip(fcur!.offsetWidth || 40)
      return { L, bw, bh, bx, by, shotK, pills, tip, to: measureTargets() }
    }
    function ftH(): void {
      let m = 0
      textEls.forEach((el) => {
        m = Math.max(m, el.offsetHeight)
      })
      ftextsEl!.style.height = `${m}px`
    }

    let geo = measure()

    // ── setActive: which chapter's list button (aria-current) + text block is "on" ──
    let fActive = -1
    function setActive(k: number): void {
      if (k === fActive) return
      fActive = k
      textEls.forEach((el, i) => el.classList.toggle(styles.on!, i === k))
      navBtns.forEach((el, i) => {
        if (i === k) el.setAttribute('aria-current', 'true')
        else el.removeAttribute('aria-current')
      })
    }

    // ── setCls: mirrors the mock's setCls/fState — only classList.toggle
    //    when the boolean actually changed (mock 707) ──
    const clsState = new Map<string, boolean>()
    function setCls(el: Element, cls: string, on: boolean, key: string): void {
      if (clsState.get(key) === on) return
      clsState.set(key, on)
      el.classList.toggle(cls, on)
    }

    // ── hover: featState names the ONE target the cursor is stopped on just
    //    before it presses (or null). Only that element carries the hover
    //    class, and only class add/remove happens, and only when it changes. ──
    const hoverEls: Record<FeatureHover, HTMLElement> = {
      motion: fmotion,
      share: fshare,
      music: musicBtn,
      design: designBtn,
      start: fsbtn,
      copy: scp,
    }
    let hovered: FeatureHover | null = null
    function setHover(next: FeatureHover | null): void {
      if (next === hovered) return
      if (hovered) hoverEls[hovered].classList.remove(styles.hov!)
      if (next) hoverEls[next].classList.add(styles.hov!)
      hovered = next
    }

    // ── first appearance: the moment the cursor becomes visible, a green ring
    //    spreads once from its tip (CSS animation; the position is written only
    //    on that flip, never per frame). It plays again if the cursor hides and
    //    reappears. Not with reduced motion. ──
    let cursorShown = false
    function setCursorShown(shown: boolean, x: number, y: number): void {
      if (shown === cursorShown) return
      cursorShown = shown
      if (shown) {
        if (reduce) return
        fring!.style.setProperty('--rx', `${x.toFixed(1)}px`)
        fring!.style.setProperty('--ry', `${y.toFixed(1)}px`)
        fring!.classList.add(styles.go!)
      } else {
        fring!.classList.remove(styles.go!)
      }
    }

    // ── apply: the mock's DOM writes (741–763), driven entirely by an
    //    already-computed FeatureState — no maths here, only writes ──
    function apply(s: FeatureState): void {
      for (let i = 0; i < FEATURE_CARDS.length; i++) {
        const el = fCards[i]!
        const c = s.cards[i]!
        el.style.transform = `translate(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px) scale(${c.scale.toFixed(3)})`
        el.style.opacity = c.opacity.toFixed(3)
        el.style.visibility = c.visible ? 'visible' : 'hidden'
      }
      if (vbadgeEl) vbadgeEl.style.opacity = s.focus.toFixed(3)

      dragCardEl!.style.zIndex = s.lift > 0 ? '5' : ''
      dragCardEl!.style.boxShadow =
        s.lift > 0
          ? `0 0 0 1px rgba(15,15,15,.08),0 ${(12 + 18 * s.lift).toFixed(1)}px ${(24 + 26 * s.lift).toFixed(1)}px -12px rgba(15,15,15,${(0.22 + 0.2 * s.lift).toFixed(2)})`
          : ''

      newCardEl!.style.zIndex = s.newOnTop ? '6' : ''

      setCls(filmCardEl!, 'onair', s.focus > 0.5, 'oa')
      filmCardEl!.style.zIndex = s.focus > 0 ? '4' : ''

      // Reduced motion shows only each step's finished pose, and the cursor is a
      // moving actor, not part of the result — so it stays hidden there (as before v11).
      fcur!.style.opacity = (reduce ? 0 : s.cursor.opacity).toFixed(3)
      fcur!.style.transform = `translate(${(s.cursor.x - geo.tip.x).toFixed(1)}px,${(s.cursor.y - geo.tip.y).toFixed(1)}px)`
      setCls(fcur!, styles.press!, s.cursor.pressed, 'cpress')
      setCursorShown(s.cursor.shown, s.cursor.x, s.cursor.y)
      setHover(s.hover)

      if (s.ring) {
        fclick!.style.opacity = s.ring.opacity.toFixed(3)
        fclick!.style.transform = `translate(${s.ring.x.toFixed(1)}px,${s.ring.y.toFixed(1)}px) scale(${s.ring.scale.toFixed(3)})`
      } else {
        fclick!.style.opacity = '0'
      }

      setCls(fmotion!, styles.on!, s.motionOn, 'mo')
      setCls(fpaste!, styles.isPress!, s.pastePress, 'pr')
      setCls(fpaste!, styles.isDone!, s.pasteDone, 'dn')
      setCls(fshare!, styles.press!, s.sharePress, 'sh')
      setCls(fsbtn!, styles.press!, s.startPress, 'sb')

      fpaste!.style.opacity = (1 - s.pillsOpacity).toFixed(3)
      fps!.style.opacity = s.pillsOpacity.toFixed(3)

      fpu!.style.transform = `translateX(${s.underline.x.toFixed(1)}px) scaleX(${s.underline.w.toFixed(1)})`
      ;[allBtn!, musicBtn!, designBtn!].forEach((b) => {
        b.classList.toggle(styles.on!, b.dataset.t === s.activeTag)
      })

      fstart!.style.opacity = s.startOpacity.toFixed(3)
      fstart!.style.visibility = s.startVisible ? 'visible' : 'hidden'
      fstart!.style.clipPath = `inset(0 0 ${(s.startWipe * 100).toFixed(2)}% 0)`

      frect!.style.strokeDashoffset = (1 - s.frameT).toFixed(3)
      frect!.style.opacity = s.frameOpacity.toFixed(3)

      pchip!.style.opacity = s.chipOpacity.toFixed(3)
      pchip!.style.transform = `translateY(${(8 * (1 - s.chipOpacity)).toFixed(1)}px)`

      fflash!.style.opacity = (0.7 * s.flash).toFixed(3)

      fbw!.style.transform = `scale(${s.boardScale.toFixed(4)})`
      fbw!.style.boxShadow =
        s.shot > 0
          ? `0 0 0 ${(12 * s.shot).toFixed(1)}px #fff,0 0 0 ${(12 * s.shot + 1).toFixed(1)}px rgba(15,15,15,${(0.14 * s.shot).toFixed(3)}),0 24px 44px -20px rgba(15,15,15,${(0.35 * s.shot).toFixed(3)})`
          : ''

      schips!.style.opacity = s.chipsT.toFixed(3)
      schips!.style.transform = `translateY(${(14 * (1 - s.chipsT)).toFixed(1)}px)`
      setCls(scp!, styles.done!, s.copied, 'cp')

      railFill!.style.transform = `scaleY(${s.rail.toFixed(4)})`

      livePlaying = s.playing
    }

    // ── film + slideshow tick (mock 764–767): only while actually playing,
    //    never while the tab is hidden. dt is pre-clamped by the frame below. ──
    function liveTick(dt: number): void {
      if (!livePlaying || document.hidden) return
      if (film) {
        film.t += dt / 1000
        filmAcc += dt
        if (filmAcc >= 41) {
          filmAcc = 0
          film.draw(film.t)
          const tt = film.t % film.dur
          film.fill.style.transform = `scaleX(${(tt / film.dur).toFixed(4)})`
          film.tc.textContent = `0:${tt < 10 ? '0' : ''}${Math.floor(tt)} / 0:24`
        }
      }
      if (slideEls && slideEls.length > 0) {
        slideT += dt
        if (slideT > 1300) {
          slideT = 0
          slideI = (slideI + 1) % slideEls.length
          slideEls.forEach((c, k) => c.classList.toggle('on', k === slideI))
        }
      }
    }

    // ── the demo's position: P (0..6) = chapter number + how far into it.
    //    It is written in exactly one place (show) so the picture, the rail
    //    fill and the highlighted chapter can never disagree. With reduced
    //    motion P is only ever the finished pose of a chapter (k + 1). ──
    const LAST = STEPS.length - 1
    let P = reduce ? 1 : 0
    function show(p: number, chapter: number): void {
      P = p
      apply(featState(P, geo))
      setActive(chapter)
    }
    function fullApply(): void {
      apply(featState(P, geo))
    }

    // ── initial paint (mock 768: renderFeat(0), before the clock exists) ──
    ftH()
    show(P, 0)

    // R18: this section's own divider line (mock 798–799), motion-gated. It is
    // the only scroll-linked thing left here (the demo itself runs on a clock).
    const ctx = gsap.context(() => {
      if (!reduce) {
        gsap.fromTo(
          ruleLine,
          { scaleX: 0 },
          { scaleX: 1, ease: 'none', scrollTrigger: { trigger: ruleLine, start: 'top 92%', end: 'top 58%', scrub: 0.4 } },
        )
      }
    }, sectionRef)

    // ── hold: a mouse pointer over the chapter list or the board pauses the
    //    demo (touch / pen never do). Pressing a chapter button means "play this
    //    one", so it plays on even though the pointer is still over the list —
    //    until the pointer next enters the list or the board. ──
    const over: Record<HoldZone, boolean> = { nav: false, board: false }
    let clickedPlay = false
    const isHeld = (): boolean => (over.nav || over.board) && !clickedPlay
    function watchMouse(el: HTMLElement, zone: HoldZone): () => void {
      const enter = (e: PointerEvent): void => {
        if (e.pointerType !== 'mouse') return
        over[zone] = true
        clickedPlay = false
      }
      const leave = (e: PointerEvent): void => {
        if (e.pointerType !== 'mouse') return
        over[zone] = false
      }
      el.addEventListener('pointerenter', enter)
      el.addEventListener('pointerleave', leave)
      return () => {
        el.removeEventListener('pointerenter', enter)
        el.removeEventListener('pointerleave', leave)
      }
    }

    // ── the clock's frame. While playing: featClock advances P; when P reaches
    //    6 the board fades out (FEAT_FADE_MS), P goes back to 0 while it is
    //    invisible, and it fades back in (FEAT_FADE_MS). The fade always runs to
    //    the end even if a pointer arrives meanwhile — the hold applies to the
    //    playing part only, so the board is never left half faded. ──
    let phase: Phase = 'play'
    let phaseMs = 0
    const frame = (_time: number, deltaTime: number): void => {
      if (disposed) return
      const dt = Math.min(deltaTime > 0 ? deltaTime : 16, FEAT_DT_MAX_MS)
      if (phase === 'play') {
        if (isHeld()) return
        const c = featClock(P, dt, FEAT_CHAPTER_MS)
        show(c.P, Math.min(LAST, Math.floor(c.P)))
        liveTick(dt)
        if (c.wrapped) {
          phase = 'out'
          phaseMs = 0
        }
        return
      }
      phaseMs += dt
      const raw = phaseMs / FEAT_FADE_MS
      const u = E(raw, 0, 1)
      if (phase === 'out') {
        fstage.style.opacity = (1 - u).toFixed(3)
        if (raw >= 1) {
          show(0, 0)
          phase = 'in'
          phaseMs = 0
        }
      } else {
        fstage.style.opacity = u.toFixed(3)
        if (raw >= 1) {
          fstage.style.opacity = ''
          phase = 'play'
          phaseMs = 0
        }
      }
    }

    // ── run only while the board is on screen and the tab is visible ──
    let inView = false
    let ticking = false
    const sync = (): void => {
      const want = !disposed && inView && !document.hidden
      if (want === ticking) return
      ticking = want
      if (want) gsap.ticker.add(frame)
      else gsap.ticker.remove(frame)
    }

    // ── chapter buttons: jump to the head of chapter k (P = k) and keep playing.
    //    Reduced motion shows that chapter's finished pose (P = k + 1) instead. ──
    const jumpTo = (k: number): void => {
      phase = 'play'
      phaseMs = 0
      fstage.style.opacity = ''
      if (reduce) {
        show(k + 1, k)
        return
      }
      clickedPlay = true
      show(k, k)
    }
    const onNavClick = (e: MouseEvent): void => {
      if (!(e.target instanceof Element)) return
      const btn = e.target.closest<HTMLButtonElement>('button[data-chapter]')
      if (!btn || !fnav.contains(btn)) return
      const k = Number(btn.dataset.chapter)
      if (Number.isInteger(k) && k >= 0 && k <= LAST) jumpTo(k)
    }
    fnav.addEventListener('click', onNavClick)

    let io: IntersectionObserver | null = null
    let unwatchNav: (() => void) | null = null
    let unwatchBoard: (() => void) | null = null
    if (!reduce) {
      // isIntersecting is true for ANY overlap, so the ratio is what says "35% visible".
      io = new IntersectionObserver(
        (entries) => {
          const entry = entries[entries.length - 1]
          if (!entry) return
          inView = entry.isIntersecting && entry.intersectionRatio >= PLAY_VISIBLE_RATIO - 1e-4
          sync()
        },
        { threshold: PLAY_VISIBLE_RATIO },
      )
      io.observe(fpanel)
      document.addEventListener('visibilitychange', sync)
      unwatchNav = watchMouse(fnav, 'nav')
      unwatchBoard = watchMouse(fpanel, 'board')
    }

    // ── resize (R16, mock 861 Features slice): re-measure + full apply.
    //    ScrollTrigger re-measures itself on resize; no explicit refresh here. ──
    let resizeTimer: number | undefined
    const onResize = (): void => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        if (disposed) return
        geo = measure()
        ftH()
        fullApply()
      }, 160)
    }
    window.addEventListener('resize', onResize)

    // Features owns the page's one global ScrollTrigger.refresh() (the divider
    // tween above and the other sections' triggers) — fonts settling can
    // reflow the page without firing a resize event.
    if (document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        if (disposed) return
        geo = measure()
        ftH()
        fullApply()
        ScrollTrigger.refresh()
      })
    }

    return () => {
      disposed = true
      ctx.revert()
      gsap.ticker.remove(frame)
      io?.disconnect()
      document.removeEventListener('visibilitychange', sync)
      unwatchNav?.()
      unwatchBoard?.()
      fnav.removeEventListener('click', onNavClick)
      window.clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      setHover(null)
      fring.classList.remove(styles.go!)
      fstage.style.opacity = ''
      fCards.forEach((el) => el.remove())
    }
  }, [])

  return (
    <section ref={sectionRef} id="features" className={styles.feat}>
      <div className="wrap rule" aria-hidden="true">
        <span className="label">{FEATURES_LABEL}</span>
        <i ref={ruleLineRef as React.RefObject<HTMLElement>} />
      </div>
      <div className={styles.fbody} data-fpin>
        <div className={`wrap ${styles.fgrid}`}>
          <div className={styles.fleft}>
            <ol ref={fnavRef} className={styles.fnav}>
              {STEPS.map((step, i) => (
                <li key={step.num} className={styles.fnavLi}>
                  <button
                    type="button"
                    ref={(el) => {
                      fnavRefs.current[i] = el
                    }}
                    data-chapter={i}
                    aria-current={i === 0 ? 'true' : undefined}
                    className={styles.fnavBtn}
                  >
                    <span>{step.num}</span> {step.name}
                  </button>
                </li>
              ))}
              <li className={styles.fnavRail} aria-hidden="true">
                <i ref={railFillRef as React.RefObject<HTMLElement>} className={styles.fnavRailFill} />
              </li>
            </ol>
            <div ref={ftextsRef} className={styles.ftexts}>
              {STEPS.map((step, i) => (
                <article
                  key={step.num}
                  ref={(el) => {
                    ftextRefs.current[i] = el
                  }}
                  className={i === 0 ? `${styles.ftext} ${styles.on}` : styles.ftext}
                >
                  <p className={`label ${styles.ftextLabel}`}>
                    <i className={`ln ${styles.ftextLn}`} />
                    {step.num} — {step.name}
                  </p>
                  <h3 className={styles.fh}>
                    <span data-lp-text>{t(stepTitleKey(step.id))}</span>
                  </h3>
                  <p className={`body ${styles.ftextBody}`} data-lp-text>
                    {t(stepBodyKey(step.id))}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className={styles.fvis} aria-hidden="true">
            <div ref={fpanelRef} className={styles.fpanel}>
              <div ref={fstageRef} className={styles.fstage}>
                <div className={styles.pchrome}>
                  <span className={styles.wmS}>{WORDMARK}</span>
                  <span className={styles.fright}>
                    <span ref={fshareRef} className={styles.fshare}>
                      Share
                    </span>
                    <span ref={fmotionRef} className={`${styles.motion} ${styles.on}`}>
                      <i />
                      Motion
                    </span>
                  </span>
                </div>
                <div className={styles.slot}>
                  <div ref={fpasteRef} className={styles.paste}>
                    <span className={styles.idle}>
                      <span className={styles.kbd}>{modKey}</span>
                      <span className={styles.kbd}>V</span>
                      <span className={styles.pl} data-lp-text>
                        {t('landing.demo.pasteHint')}
                      </span>
                    </span>
                    <span className={styles.done}>
                      <span className={styles.ok}>✓</span>
                      <span data-lp-text>{t('landing.demo.saved')}</span>
                    </span>
                  </div>
                  <div ref={fpsRef} className={styles.fps}>
                    {TAGS.map((tg) => (
                      <button
                        key={tg.tag}
                        ref={tg.tag === 'all' ? allBtnRef : tg.tag === 'music' ? musicBtnRef : designBtnRef}
                        type="button"
                        tabIndex={-1}
                        data-t={tg.tag}
                        className={styles.fpsButton}
                      >
                        {tg.label}
                      </button>
                    ))}
                    <i ref={fpuRef as React.RefObject<HTMLElement>} className={styles.fpUnder} />
                  </div>
                </div>
                <div ref={fbwRef} className={styles.fbw}>
                  <div ref={fboardRef} className={styles.fboard} data-features-board />
                  <svg className={styles.frame} aria-hidden="true">
                    <rect ref={frectRef} pathLength={1} x={1} y={1} rx={13} />
                  </svg>
                  <span ref={pchipRef} className={styles.pchip} data-lp-text>
                    {t('landing.demo.inBrowser')}
                  </span>
                </div>
                <div ref={fstartRef} className={styles.fstart}>
                  <span className={styles.fsWm}>{WORDMARK}</span>
                  <span ref={fsbtnRef} className={styles.fsBtn}>
                    <span data-lp-text>{t('landing.hero.ctaPrimary')}</span> <span aria-hidden="true">↗</span>
                  </span>
                  <span className={styles.fsNote} data-lp-text>
                    {t('landing.demo.noSignup')}
                  </span>
                </div>
                <div ref={schipsRef} className={styles.schips}>
                  <span className={styles.sc} data-lp-text>
                    ↓ {t('landing.demo.saveImage')}
                  </span>
                  <span ref={scpRef} className={styles.sc}>
                    <span className="rl">
                      <span data-lp-text>{t('landing.demo.copyLink')}</span>
                      <span data-lp-text>✓ {t('landing.demo.copied')}</span>
                    </span>
                  </span>
                </div>
                <i ref={fclickRef as React.RefObject<HTMLElement>} className={styles.fclick} />
                <i ref={fringRef as React.RefObject<HTMLElement>} className={styles.fring} />
                <i ref={fflashRef as React.RefObject<HTMLElement>} className={styles.fflash} />
                <div ref={fcurRef} className={styles.fcur} data-fcur>
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M5 2.5 L5 19.5 L9.3 15.6 L12.2 22 L15.1 20.7 L12.3 14.4 L18.4 14.2 Z"
                      fill="#28F100"
                      stroke="#0f0f0f"
                      strokeWidth="1.4"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
