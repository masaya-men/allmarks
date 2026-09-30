'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { navHref } from '@/lib/i18n/locale-urls'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { makeCard } from '@/lib/marketing/lp/art'
import { masonry } from '@/lib/marketing/lp/masonry'
import type { MasonryLayout } from '@/lib/marketing/lp/masonry'
import { E, lerp } from '@/lib/marketing/lp/motion-math'
import { tweetKey } from '@/lib/marketing/lp/tweet-key'
import type { CardSpec } from '@/lib/marketing/lp/types'
import styles from './SyncPlan.module.css'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

/**
 * SyncPlan — the pinned laptop-to-phone Sync beat, ported from
 * docs/private/lp-v10-mock.html (markup 477–492, CSS 298–318 + 385–386/399,
 * JS 778–800). A card lands on the laptop board, travels along a straight
 * dashed line as a green dot, and lands on the phone board. Scrubbed over the
 * pinned wrapper on wide screens, over the device stage on narrow ones;
 * reduced motion draws the end state only. The mock's "paid plan" badge is
 * intentionally omitted (mock-only note).
 */

type Locale = 'ja' | 'en'

const COPY = {
  ja: {
    h2a: 'どの端末でも、',
    h2b: '同じボード。',
    body: '同期プランでは、パソコン・スマートフォン・タブレットで同じボードを使えます。データはご自身の Google ドライブに保存されます。1つのキーで5台まで使えます。',
    price: '¥500',
    priceA: '/月から(税込)',
    priceB: '基本機能はすべて無料',
    button: '料金を見る',
  },
  en: {
    h2a: 'Same board,',
    h2b: 'on every device.',
    body: 'With the Sync plan, you can use the same board on your computer, phone, and tablet. Your data is saved in your own Google Drive. One key works on up to 5 devices.',
    price: '¥500',
    priceA: '/month and up (tax incl.)',
    priceB: 'All core features are free',
    button: 'See pricing',
  },
} as const satisfies Record<Locale, Record<string, string>>

/** English design words — same in every locale. */
const LABEL_TEXT = 'Sync'
const DEVICE_LABEL = 'SYNC'

/** Mock SY (line 779): the six mini-board cards; index 0 is the one that "arrives". */
const SY: readonly CardSpec[] = [
  { art: 'grid', a: 4 / 5 },
  { art: 'truchet', a: 1 },
  { art: 'halftone', a: 3 / 4 },
  { tweet: 2, a: 1 },
  { art: 'swiss', a: 3 / 4 },
  { art: 'vinyl', a: 1 },
]
const ALL: readonly number[] = SY.map((_, i) => i)
const REST: readonly number[] = ALL.slice(1)

type Mini = {
  readonly root: HTMLElement
  readonly cards: readonly HTMLDivElement[]
  readonly cols: number
  readonly gap: number
  pre: MasonryLayout
  post: MasonryLayout
}

export function SyncPlan({ locale }: { locale: Locale }): React.ReactElement {
  const copy = COPY[locale]
  const pricing = navHref(locale, 'pricing')
  const { t } = useI18n()
  const tRef = useRef(t)
  useEffect(() => {
    tRef.current = t
  }, [t])

  const sectionRef = useRef<HTMLElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)
  const devsRef = useRef<HTMLDivElement>(null)
  const lmbRef = useRef<HTMLDivElement>(null)
  const pmbRef = useRef<HTMLDivElement>(null)
  const laptopScrRef = useRef<HTMLDivElement>(null)
  const phoneRef = useRef<HTMLDivElement>(null)
  const slineRef = useRef<HTMLElement>(null)
  const sdotRef = useRef<HTMLElement>(null)
  const slblRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    const pin = pinRef.current
    const devs = devsRef.current
    const lmb = lmbRef.current
    const pmb = pmbRef.current
    const scr = laptopScrRef.current
    const phone = phoneRef.current
    const sline = slineRef.current
    const sdot = sdotRef.current
    const slbl = slblRef.current
    if (!section || !pin || !devs || !lmb || !pmb || !scr || !phone || !sline || !sdot || !slbl) return undefined

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let currentP = reduce ? 1 : 0
    let disposed = false
    let geo = { x0: 0, x1: 0, y: 0 }

    const build = (root: HTMLElement, cols: number, gap: number): Mini => {
      const cards = SY.map((spec) => {
        const el = makeCard(spec, {
          amb: false,
          tweetText: spec.tweet != null ? tRef.current(tweetKey(spec.tweet)) : undefined,
        })
        root.appendChild(el)
        return el
      })
      const empty: MasonryLayout = { cw: 0, slots: {} }
      return { root, cards, cols, gap, pre: empty, post: empty }
    }
    const LM = build(lmb, 3, 5)
    const PM = build(pmb, 2, 4)
    const minis = [LM, PM]

    function layout(): void {
      minis.forEach((m) => {
        const W = m.root.clientWidth
        m.pre = masonry(SY, REST, W, m.cols, m.gap)
        m.post = masonry(SY, ALL, W, m.cols, m.gap)
        m.cards.forEach((el, i) => {
          el.style.width = `${m.post.cw}px`
          el.style.height = `${m.post.cw / SY[i].a}px`
        })
      })
      const d = devs!.getBoundingClientRect()
      const a = scr!.getBoundingClientRect()
      const b = phone!.getBoundingClientRect()
      const y = Math.max(b.top + b.height * 0.2, Math.min(a.top + a.height * 0.45, b.bottom - b.height * 0.2)) - d.top
      const x0 = a.right - d.left + 10
      const x1 = b.left - d.left - 10
      geo = { x0, x1, y }
      sline!.style.left = `${x0}px`
      sline!.style.top = `${y}px`
      sline!.style.width = `${Math.max(0, x1 - x0)}px`
      slbl!.style.left = `${(x0 + x1) / 2}px`
      slbl!.style.top = `${y}px`
    }

    function render(p: number): void {
      currentP = p
      const pairs: readonly [Mini, number][] = [
        [LM, E(p, 0.04, 0.22)],
        [PM, E(p, 0.6, 0.78)],
      ]
      pairs.forEach(([m, tt]) => {
        m.cards.forEach((el, i) => {
          if (i === 0) {
            const q = m.post.slots[0]
            if (!q) return
            el.style.transform = `translate(${q.x}px, ${q.y}px) scale(${(0.9 + 0.1 * tt).toFixed(3)})`
            el.style.opacity = tt.toFixed(3)
            el.classList.toggle('just', tt > 0.98)
          } else {
            const a = m.pre.slots[i]
            const b = m.post.slots[i]
            if (!a || !b) return
            el.style.transform = `translate(${lerp(a.x, b.x, tt).toFixed(1)}px, ${lerp(a.y, b.y, tt).toFixed(1)}px)`
          }
        })
      })
      sline!.style.transform = `scaleX(${E(p, 0.22, 0.4).toFixed(3)})`
      const u = E(p, 0.4, 0.6)
      sdot!.style.opacity = (E(p, 0.38, 0.42) * (1 - E(p, 0.6, 0.64))).toFixed(3)
      sdot!.style.transform = `translate(${lerp(geo.x0, geo.x1, u).toFixed(1)}px, ${geo.y.toFixed(1)}px)`
    }

    layout()
    render(currentP)

    let ctx: ReturnType<typeof gsap.context> | undefined
    if (!reduce) {
      const wide = window.matchMedia('(min-width: 981px)').matches
      ctx = gsap.context(() => {
        const sp = { p: 0 }
        gsap.to(sp, {
          p: 1,
          ease: 'none',
          onUpdate: () => render(sp.p),
          scrollTrigger: wide
            ? { trigger: pin, start: 'top top', end: 'bottom bottom', scrub: 0.5 }
            : { trigger: devs, start: 'top 78%', end: 'bottom 45%', scrub: 0.5 },
        })
        const labelLn = section.querySelector<HTMLElement>('.label .ln')
        if (labelLn) {
          gsap.fromTo(
            labelLn,
            { scaleX: 0 },
            {
              scaleX: 1,
              duration: 0.8,
              ease: 'expo.out',
              scrollTrigger: { trigger: labelLn, start: 'top 85%', toggleActions: 'play none none reverse' },
            },
          )
        }
      }, sectionRef)
    }

    const relayout = (): void => {
      if (disposed) return
      layout()
      render(currentP)
    }
    let resizeTimer: number | undefined
    const onResize = (): void => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(relayout, 160)
    }
    window.addEventListener('resize', onResize)
    if (document.fonts?.ready) {
      void document.fonts.ready.then(relayout)
    }

    return () => {
      disposed = true
      ctx?.revert()
      window.clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      minis.forEach((m) => m.cards.forEach((el) => el.remove()))
    }
  }, [])

  return (
    <section ref={sectionRef} id="sync" className={styles.sync}>
      <div ref={pinRef} className={styles.syncPin}>
        <div className={styles.sticky}>
          <div className={`wrap ${styles.sgrid}`}>
            <div>
              <p className="label">
                <i className="ln" />
                {LABEL_TEXT}
              </p>
              <h2 className="h2">
                {copy.h2a}
                <br />
                {copy.h2b}
              </h2>
              <p className="body">{copy.body}</p>
              <div className={styles.price}>
                <span className={styles.shine} aria-hidden="true" />
                <strong>{copy.price}</strong>
                <span>
                  {copy.priceA}
                  <br />
                  {copy.priceB}
                </span>
              </div>
              <Link href={pricing} className="btn roll" data-testid="lp-sync-pricing">
                <span className="rl">
                  <span>{copy.button}</span>
                  <span aria-hidden="true">{copy.button}</span>
                </span>{' '}
                <span className="arr" aria-hidden="true">↗</span>
              </Link>
            </div>
            <div ref={devsRef} className={styles.devs} aria-hidden="true">
              <div className={styles.laptop}>
                <div ref={laptopScrRef} className={styles.lpScr}>
                  <div ref={lmbRef} className={styles.dmb} />
                </div>
                <div className={styles.lpBase} />
              </div>
              <div ref={phoneRef} className={`${styles.phone}`}>
                <div ref={pmbRef} className={`${styles.dmb} ${styles.phoneDmb}`} />
              </div>
              <i ref={slineRef} className={styles.sline} />
              <i ref={sdotRef} className={styles.sdot} />
              <span ref={slblRef} className={styles.slbl}>{DEVICE_LABEL}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
