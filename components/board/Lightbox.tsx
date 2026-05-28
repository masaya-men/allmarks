'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type ReactElement, type ReactNode } from 'react'
import { gsap } from 'gsap'
import type { BoardItem } from '@/lib/storage/use-board-data'
import type { TweetMeta, MediaSlot } from '@/lib/embed/types'
import { fetchTweetMeta } from '@/lib/embed/tweet-meta'
import { t } from '@/lib/i18n/t'
import { normalizeItem, type LightboxItem } from '@/lib/share/lightbox-item'
import type { ShareCard } from '@/lib/share/types'
import { PlaceholderCard, pickCard } from './cards'
import { cleanTitle } from '@/lib/embed/clean-title'

/** PlaceholderCard の固定 aspect ratio (= board 旧 TextCard と同じ 1.25)。
 *  webpage の Lightbox 大表示で fallback として使う。 */
const PLACEHOLDER_ASPECT = 1.25
import {
  InstagramEmbed,
  TweetVideoEmbed,
  resolveLightboxPlayer,
} from './embeds'
import { LightboxNavChevron } from './LightboxNavChevron'
import { useSmoothWheelScroll } from '@/lib/scroll/use-smooth-wheel-scroll'
import type { LightboxFlipSceneProps } from './LightboxFlipScene'
import {
  detectUrlType,
  extractInstagramShortcode,
  extractTweetId,
} from '@/lib/utils/url'
import styles from './Lightbox.module.css'

// =====================================================================
// Open / close animation tunables — tweak freely. Seconds unless noted.
//
// Goal: pure rect-to-rect spring morph (no tilt, no motion blur). The
// frame stays fully opaque the whole way; the text panel fades in after
// the frame settles (open) and out before the frame shrinks back (close).
// On close the frame lands at the source card's live rect with the source
// card's visibility restored at the same frame as unmount → "card placed
// physically back" feel, no empty-slot flash. (B-#11 polish 2026-05-11)
//
// AllMarks character knobs (deliberately distinct from the destefanis
// reference): slight back.out spring overshoot on open + heavier 8px
// backdrop blur (vs reference 6px). Soften OPEN_EASE → 'power3.out' if
// you want flat decel; sharpen CLOSE_EASE → 'power3.out' for snappier.
// =====================================================================
const OPEN_BASE_DUR = 0.5
const OPEN_DIST_DIVISOR = 2000  // px of travel that buys 1s of bonus
const OPEN_DIST_BONUS_MAX = 0.2 // …capped at this many extra seconds
// Flat decel, no spring overshoot. The earlier `back.out(0.7)` baseline
// read as a side-effect rather than character; AllMarks wants a clean
// arrival. Soften toward `power2.out` for a slower settle, sharpen
// toward `power4.out` for a more decisive arrival.
const OPEN_EASE = 'power3.out'
const OPEN_TEXT_FADE_DUR = 0.28
const OPEN_TEXT_FADE_DELAY_RATIO = 0.55 // text reveal starts at 55% of frame morph
const OPEN_BACKDROP_FADE_DUR = 0.42
const OPEN_FALLBACK_DUR = 0.42

// Close — single diagonal tween from natural rect → source card's rect.
// To make the landing swap pixel-perfect (no blink), we briefly switch
// .media's <img> styling to match the source card thumb (object-fit:
// cover + per-card border-radius) so at the moment .media lands at
// source rect, it looks identical to the source card. A short 60ms
// opacity fade right at landing covers any residual sub-pixel rounding
// difference. User-described feel: 「斜めにまっすぐ帰っていく」.
const CLOSE_FRAME_DELAY = 0.1   // wait this long after text starts fading before moving
const CLOSE_TWEEN_DUR = 0.45    // diagonal travel duration
const CLOSE_TWEEN_EASE = 'power2.out' // gentle decel into source rect
// border-radius pre-rolls inside the text-fade window, fully completing
// BEFORE position/scale motion begins at CLOSE_FRAME_DELAY. Mirrors the
// OPEN strategy where the first paint matches the source card's corner.
// Once motion starts, scale compensation in the position-tween onUpdate
// holds the *visible* radius pinned to cardRadiusValue — no animated
// corner morph during the visible shrink. Removes the perception of
// "角丸が間に合っていない" entirely (it never changes during motion).
const CLOSE_RADIUS_DUR = 0.08
const CLOSE_RADIUS_EASE = 'power2.out'
const CLOSE_REVEAL_LEAD = 0.10  // reveal source card this many seconds BEFORE landing (safety margin)
const CLOSE_FADE_DUR = 0.10     // .media opacity fade at the very end, paired with reveal lead
const CLOSE_TEXT_FADE_DUR = 0.14
const CLOSE_BACKDROP_FADE_DUR = 0.42
const CLOSE_BACKDROP_DELAY = 0.15
const CLOSE_FALLBACK_DUR = 0.3

// =====================================================================
// I-07-#5: Lightbox text mask-reveal-up.
// CSS デザイントークン (--lightbox-text-reveal-*) を root から読み、
// GSAP timeline 用の数値 / string に変換。 デフォルト値は spec 同期。
// =====================================================================
type RevealTokens = {
  readonly duration: number      // seconds
  readonly stagger: number       // seconds
  readonly pause: number         // seconds
  readonly translateY: number    // px
  readonly easing: string        // gsap easing name
}

function readRevealTokens(): RevealTokens {
  if (typeof window === 'undefined') {
    return { duration: 0.5, stagger: 0.15, pause: 0.15, translateY: 18, easing: 'power3.out' }
  }
  const root = getComputedStyle(document.documentElement)
  const parse = (name: string, fallback: number): number => {
    const raw = root.getPropertyValue(name).trim()
    if (!raw) return fallback
    const n = parseFloat(raw)
    return Number.isFinite(n) ? n : fallback
  }
  const easing = root.getPropertyValue('--lightbox-text-reveal-easing').trim() || 'power3.out'
  return {
    duration: parse('--lightbox-text-reveal-duration', 0.5),
    stagger: parse('--lightbox-text-reveal-stagger', 0.15),
    pause: parse('--lightbox-text-reveal-pause', 0.15),
    translateY: parse('--lightbox-text-reveal-translate-y', 18),
    easing,
  }
}

// I-07-#5 revised: テキストパネル全体を 1 ブロックで reveal するため、
// textEl 自身を単一の tween target として返す。 段階 stagger は撤去
// (体感が gata-gata した user feedback により方針転換 2026-05-12)。
function collectStageEls(textEl: HTMLElement): HTMLElement[] {
  return [textEl]
}

// Helper: text panel を初期状態 (不可視) にセット。 destefanis 準拠で
// translateY + opacity のみ、 clip-path mask は撤去。 reduce-motion 時は
// translate も省略、 opacity のみ 0 にする。
function setStageInitialState(els: HTMLElement[], translateY: number, prefersReduce: boolean): void {
  if (els.length === 0) return
  if (prefersReduce) {
    gsap.set(els, { opacity: 0 })
  } else {
    gsap.set(els, {
      opacity: 0,
      y: translateY,
    })
  }
}

// Helper: text panel を reveal する tween を timeline に追加する。
// destefanis 準拠で translateY + opacity のみ、 clip-path mask は撤去。
function appendRevealTimeline(
  tl: gsap.core.Timeline,
  els: HTMLElement[],
  tokens: RevealTokens,
  startAt: number,
  prefersReduce: boolean,
): void {
  if (els.length === 0) return
  const props = prefersReduce
    ? { opacity: 1, duration: tokens.duration, ease: tokens.easing, stagger: tokens.stagger }
    : {
        opacity: 1,
        y: 0,
        duration: tokens.duration,
        ease: tokens.easing,
        stagger: tokens.stagger,
      }
  tl.to(els, props, startAt)
}

function getPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// =====================================================================
// destefanis-style clone host (B-#17). We mount a single, persistent
// `<div id="lightbox-clone-host">` directly under <body> so that every
// Lightbox open/close can drop its clone there. Putting it on the body
// escapes any containing block created by ancestor `.frame` /
// `will-change` / `transform` further up the tree — which was the
// root-cause of the failed cf6b8d1 attempt in session 21.
// =====================================================================
/** Get-or-create the clone host inside the board's cards stage (the
 *  .canvasWrap region marked by data-lightbox-clone-host). Mounting
 *  inside the stage — rather than at body root — lets the canvas's
 *  overflow:hidden naturally clip any clone whose flight path crosses
 *  the dark frame's edge (including the rounded corners), so no manual
 *  clip-path mirroring is needed.
 *
 *  Returns null if the stage isn't mounted yet (defensive — Lightbox
 *  is only ever opened from inside a mounted BoardRoot, but callers
 *  must treat null as "fall back to the no-clone fade path"). */
function ensureCloneHost(): HTMLElement | null {
  const HOST_ID = 'lightbox-clone-host'
  const existing = document.getElementById(HOST_ID)
  if (existing) return existing

  const stage = document.querySelector<HTMLElement>('[data-lightbox-clone-host]')
  if (!stage) return null

  const host = document.createElement('div')
  host.id = HOST_ID
  // Full-size invisible shell inside the stage. zIndex 200 places the
  // clone between the Lightbox's dim backdrop (z 100) and the Lightbox
  // stage / frame chrome (z 300) — so the in-flight morph paints over
  // the dim (clone never darkens with the rest of the board) AND under
  // the eventual text panel + close button (no flicker at handoff).
  host.style.cssText =
    'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:200;'
  stage.appendChild(host)
  return host
}

/** Remove every clone left in the host. The host should hold at most the ONE
 *  proxy of the in-flight open/close morph; anything still there is an orphan
 *  from a morph whose GSAP onComplete got bypassed by a rapid close/reopen.
 *  Because the host lives OUTSIDE React (under .canvasWrap), such an orphan
 *  would otherwise linger on the board showing a stale thumbnail forever
 *  (user report: "前のサムネがずっと出続ける"). We sweep deterministically at the
 *  start of every morph and whenever the lightbox fully closes, so a clone can
 *  never survive into the next session regardless of interrupted animations. */
function clearCloneHost(): void {
  const host = document.getElementById('lightbox-clone-host')
  if (!host) return
  Array.from(host.children).forEach((c) => {
    gsap.killTweensOf(c)
    c.remove()
  })
}

/** Build a visual proxy of a board card at a given rect. Strips all
 *  inline style (transform, visibility:hidden the board applies to the
 *  source card while Lightbox is open, etc.), then positions the clone
 *  at the requested rect via position:absolute. The rect's top / left
 *  are expressed in the host's coordinate system (i.e. relative to
 *  .canvasWrap), NOT viewport coordinates — callers convert via
 *  toHostRelativeRect() before invoking. Only used for the open/close
 *  morph — interaction is disabled (pointer-events:none) and the clone
 *  is removed at animation end. */
type CloneRect = { top: number; left: number; width: number; height: number }
function toHostRelativeRect(viewportRect: DOMRect, host: HTMLElement): CloneRect {
  // host is position:absolute filling .canvasWrap, so host's own
  // bounding rect == canvasWrap's. Subtracting host.top / host.left
  // converts a viewport-space rect (from getBoundingClientRect on any
  // element) into the host's local coordinate system, which is what
  // position:absolute children consume.
  const o = host.getBoundingClientRect()
  return {
    top: viewportRect.top - o.top,
    left: viewportRect.left - o.left,
    width: viewportRect.width,
    height: viewportRect.height,
  }
}
function createLightboxClone(sourceCard: HTMLElement, rect: CloneRect): HTMLElement {
  const clone = sourceCard.cloneNode(true) as HTMLElement
  // Wipe ALL inline styles inherited from the source card. This drops:
  //   - transform (gsap.set applied during drag/FLIP)
  //   - visibility:hidden the CardsLayer applies to the source while
  //     Lightbox is open (we want the clone visible)
  //   - any width/height the parent flow had baked in
  clone.style.cssText = ''
  clone.style.position = 'absolute'
  // Snap start rect to integer pixels — getBoundingClientRect() returns
  // sub-pixel floats which GSAP then interpolates between, amplifying
  // browser-side rounding jitter into the morph (session 31 Bug B-b).
  // The clone is a temporary visual proxy so 1px alignment is invisible.
  clone.style.top = `${Math.round(rect.top)}px`
  clone.style.left = `${Math.round(rect.left)}px`
  clone.style.width = `${Math.round(rect.width)}px`
  clone.style.height = `${Math.round(rect.height)}px`
  clone.style.margin = '0'
  clone.style.visibility = 'visible'
  // 7bb0529 で --card-radius / --lightbox-media-radius は 20px に統一されたが、
  // この hardcode が取りこぼされて 24px のまま残っていた → board card (20)、
  // clone (24)、 .media (20) の三者でラジアスがずれ、 user 「角丸ぷくぷく」
  // 報告の主因 (session 32)。 CSS var 参照に切り替えて将来の調整にも追従させる。
  clone.style.borderRadius = 'var(--lightbox-media-radius)'
  clone.style.overflow = 'hidden'
  clone.style.pointerEvents = 'none'
  // GPU compositing hints — force the clone onto its own paint layer so
  // the per-frame width/height reflow doesn't drag the whole canvas
  // through a layout/paint pass. willChange covers Chromium; the
  // translateZ keeps Safari honest. backfaceVisibility avoids a paint
  // flash on browsers that promote the layer mid-tween.
  clone.style.willChange = 'top, left, width, height'
  clone.style.transform = 'translateZ(0)'
  clone.style.backfaceVisibility = 'hidden'
  clone.setAttribute('aria-hidden', 'true')
  // Drop ids / refs that might collide with the source if either side
  // queries them by selector.
  clone.removeAttribute('id')
  clone.removeAttribute('data-bookmark-id')
  // Strip hover-revealed chrome that would otherwise ride along with
  // the morph (delete ×, reset ↺, resize handles). These elements
  // carry their own data-visible attribute that survives cloneNode,
  // so they'd display at the same opacity the source card had at
  // click time — i.e. fully visible on a hovered card.
  const SELECTORS_TO_STRIP = [
    '[data-testid="card-delete-button"]',
    '[data-testid="card-reset-size-button"]',
    '[data-testid^="resize-handle-"]',
  ]
  for (const sel of SELECTORS_TO_STRIP) {
    clone.querySelectorAll(sel).forEach((n) => n.remove())
  }
  return clone
}

// session 35: 文字カード専用 hybrid。 外側 clone は本家 destefanis 同様 width/height
// tween のままにし、 文字カードのときだけ内側に scale-host を仕込んで「文字も
// 一緒に拡大」 を実現する。 画像/動画カードでは img が naturally に object-fit:cover
// で fit するため scale-host 不要 (= raster 画像を scale up すると bitmap blur)。
//
// 拡大方式は CSS `zoom`。 当初 `transform: scale` を試したが、 文字が raster scale
// で描画されて 「拡大率に比例して文字がボケる」 と user 報告 (session 35 後半)。
// `zoom` は **拡大後のサイズで browser が再レイアウト + font-size を真の zoom 倍で
// 再描画** = 文字は常にベクター品質で crisp。 非公式プロパティだが Chrome / Safari
// / Firefox (2024+) / Edge 全部対応済。 子要素 absolute 座標も zoom 倍されるので
// 内部 layout は変わらず (= 等比拡大)。
function wrapCloneWithScaleHost(
  clone: HTMLElement,
  sourceW: number,
  sourceH: number,
  initialScale: number,
): HTMLElement | null {
  // PlaceholderCard 検出。 CSS modules でクラス名がハッシュ化されても
  // "placeholderCard" 部分は残る (= session 88 で旧 TextCard を統合した先)。
  const isPlaceholderCard = clone.querySelector('[class*="placeholderCard"]') !== null
  if (!isPlaceholderCard) return null
  if (sourceW <= 0 || sourceH <= 0) return null

  // session 56 Step 2 + session 88: --card-radius 上書きは撤廃済。 inner は
  // :root から --card-radius を継承し、 ::before の枠線が 4 隅まで連続する。

  // session 38 + 88: omitMeta は外して、 板 → 開く → Lightbox → 閉じる の
  // 全フローで hostname strip が一貫して見える方針。 strip 有無問わず clone と
  // .media は同じ PlaceholderCard (= 同じ DOM 構造) で layout 一致するため、
  // swap 瞬間の title jump は発生しない。

  const scaleHost = document.createElement('div')
  scaleHost.setAttribute('data-clone-scale-host', 'true')
  scaleHost.style.position = 'absolute'
  scaleHost.style.top = '0'
  scaleHost.style.left = '0'
  scaleHost.style.width = `${sourceW}px`
  scaleHost.style.height = `${sourceH}px`
  // zoom = scale ratio (browser side で再レイアウト + 文字 crisp 再描画)。
  scaleHost.style.zoom = `${initialScale}`
  scaleHost.style.pointerEvents = 'none'

  // clone の現在の子をすべて scale-host に移す。 firstChild で順次取り出し。
  while (clone.firstChild) {
    scaleHost.appendChild(clone.firstChild)
  }
  clone.appendChild(scaleHost)

  return scaleHost
}

/** Optional nav controls — when provided, chevron + dots + arrow-key
 *  nav become available. Caller (BoardRoot or SharedView) owns the
 *  index state and loop logic; Lightbox just forwards user gestures. */
type LightboxNav = {
  readonly currentIndex: number
  readonly total: number
  readonly onNav: (dir: -1 | 1) => void
  readonly onJump: (index: number) => void
}

type Props = {
  /** Either a BoardItem (my own board) or a ShareCard (received share view).
   *  Internal `view = normalizeItem(item)` collapses both into LightboxItem
   *  so all sub-components see one shape. */
  readonly item: BoardItem | ShareCard | null
  /** Clicked card's screen rect at the moment of pointer-up. Used to seed
   *  the FLIP (First-Last-Invert-Play) open animation so the lightbox grows
   *  from where the card actually was, instead of the viewport center.
   *  Stays pinned to the originally-clicked card across chevron-nav (B-#11)
   *  so close always tweens back to the source card — never to whichever
   *  card the user happened to be viewing when they hit close. */
  readonly originRect: DOMRect | null
  /** Bookmark id of the originally clicked card. Used by the close tween
   *  to look up the card's *current* DOM rect via [data-bookmark-id], so
   *  the close animation tracks pan/scroll that happened during the open
   *  session. originRect (above) is the click-time fallback for when the
   *  source card has been culled from the DOM (off-screen). (B-#11) */
  readonly sourceCardId?: string | null
  readonly onClose: () => void
  /** Fired partway through the close tween — right when .media reaches
   *  the source card's rect — to ask the parent to make the source card
   *  visible again BEFORE the lightbox unmounts. The parent should clear
   *  whatever flag was holding source visibility:hidden. The window
   *  between this call and the trailing onClose is the cross-fade
   *  window: source card is visible underneath while .media fades out
   *  on top, so the unavoidable visual mismatch between .media's <img>
   *  and the source card's <img> is masked by a continuous fade rather
   *  than a 1-frame swap (= the "明滅" the user reported). Optional
   *  for back-compat with callers that don't track a source card. */
  readonly onSourceShouldShow?: () => void
  readonly nav?: LightboxNav
  /** v13: called with (bookmarkId, mediaSlots[]) whenever a tweet meta fetch
   *  reveals slot data, so the board can render the correct hover swap
   *  next time the user is on the board. Pass through from
   *  useBoardData().persistMediaSlots. Fire-and-forget. */
  readonly persistMediaSlots?: (bookmarkId: string, mediaSlots: readonly MediaSlot[]) => Promise<void>
}

export function Lightbox({ item, originRect, sourceCardId, onClose, onSourceShouldShow, nav, persistMediaSlots }: Props): ReactElement | null {
  const backdropRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  // Open/close FLIP morphs *only* the media element (not the entire .frame),
  // so the visible motion reads as "the source card image grows / shrinks
  // back" rather than "a whole 2-column lightbox container scales". The
  // .frame container has no visible chrome (no background/border) so an
  // untransformed .frame is invisible — only its children show.
  const mediaRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  // Tracks the identity from the previous render. Hoisted to the top of
  // the component (out of the nav-transition effect below) so the open
  // animation effect can also read it, and skip its fallback entry
  // animation when this is a chevron-nav (in which case the slide
  // effect handles the entry). Without that skip, the fallback's
  // `gsap.fromTo(el, { scale: 0.86, opacity: 0 }, { scale: 1, opacity: 1 })`
  // applies its FROM (scale=0.86) inline before the slide effect kills
  // the tween mid-frame — and the slide effect's fromTo never sets
  // `scale`, so the 0.86 stays in the matrix forever. Verified leak
  // (Playwright measured chev/click ratio = 0.86 exact) — 2026-05-11.
  const prevIdentityRef = useRef<string | null>(null)
  const prevNavIndexRef = useRef<number | null>(null)
  useSmoothWheelScroll(textRef, { disabled: !item })
  // closeButtonRef intentionally absent — see "No programmatic auto-focus"
  // comment near the keyboard handler below.

  // Normalize once to a slim shape. Lets Lightbox accept either a
  // BoardItem (my own board) or a ShareCard (received share view) and
  // exposes a single field set (url/title/description/thumbnail/kind)
  // to all internal sub-components.
  const view: LightboxItem | null = item ? normalizeItem(item) : null
  const isTweet = view ? detectUrlType(view.url) === 'tweet' : false
  const tweetId = isTweet && view ? extractTweetId(view.url) : null
  // Stable string ref for effect deps — using item (object) directly causes
  // the open animation to restart whenever an unrelated state update gives
  // BoardRoot's items a new array reference (e.g. thumbnail backfill).
  // identity is `${kind}:${url}` so the same hook fires for both BoardItem
  // (board side) and ShareCard (receive side) at distinct cards.
  const identity = view ? `${view.kind}:${view.url}` : null

  // Lazy-load tweet metadata when a tweet lightbox opens. Same /api/tweet-meta
  // endpoint that BoardRoot's bulk backfill hits, so the response is typically
  // already in the browser HTTP cache (s-maxage=3600 at the edge) and resolves
  // in milliseconds. We render an item-level placeholder until it lands.
  const [tweetMeta, setTweetMeta] = useState<TweetMeta | null>(null)
  useEffect(() => {
    // Clear FIRST, every time the card changes: otherwise the previous card's
    // meta (and thus its video/photo) stayed on screen until the new fetch
    // resolved — on slow/failed fetches it never updated, so left/right nav
    // showed the prior card's media while the text already changed (session 63
    // stale-media bug). With this, the media falls back to the new card's own
    // thumbnail immediately, then upgrades to its video/photo when the fetch
    // lands.
    setTweetMeta(null)
    if (!tweetId) return
    let cancelled = false
    void fetchTweetMeta(tweetId).then((meta) => {
      if (cancelled) return
      setTweetMeta(meta)
      // Phase C backfill: write mediaSlots[] to IDB so the board card
      // can render the correct hover swap + dot indicator next mount.
      // Fire-and-forget: no await, errors ignored. The persist helper
      // is idempotent so repeat fetches don't churn IDB.
      if (meta?.mediaSlots && meta.mediaSlots.length > 0 && view?.bookmarkId && persistMediaSlots) {
        void persistMediaSlots(view.bookmarkId, meta.mediaSlots)
      }
    })
    return (): void => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tweetId])

  // I-07 + mix-tweet: unified slot array driving both .media render and the
  // dot indicator. Resolution order: TweetMeta.mediaSlots (fresh from
  // syndication) → BoardItem.mediaSlots (IDB-persisted) → BoardItem.photos
  // (legacy v12 fallback, widened to photo slots) → empty (single-image /
  // text-only paths handle this).
  const tweetSlots: readonly MediaSlot[] = (() => {
    if (tweetMeta?.mediaSlots && tweetMeta.mediaSlots.length > 0) return tweetMeta.mediaSlots
    if (view?.mediaSlots && view.mediaSlots.length > 0) return view.mediaSlots
    const legacy = view?.photos ?? []
    return legacy.map((url): MediaSlot => ({ type: 'photo', url }))
  })()

  // Current slot index — drives both the .media render and the dots.
  // Renamed from tweetImageIdx (Phase 1) because the carousel may now point
  // at a video slot, not just a photo.
  const [tweetSlotIdx, setTweetSlotIdx] = useState<number>(0)
  useEffect(() => {
    setTweetSlotIdx(0)
  }, [view?.bookmarkId])

  // Mix-tweet defensive pause-sweep: after every slot change, scan .media for
  // any <video> still present and pause it. For video→photo transitions
  // React has already unmounted the <video> by the time this effect runs
  // (so the sweep is a no-op — the browser also tears down the stream on
  // unmount), but for the rare same-slot re-render path (e.g. tweetMeta
  // arrives late and triggers a parent re-render while the user is on a
  // video slot) this prevents a momentary double-play.
  //
  // Known limitation (spec §10 open problem): `key={slot-${slotIdx}}` on
  // <TweetVideoPlayer> forces remount on slot change, so currentTime is
  // reset when navigating away and back. Solving "戻ったら続きから" needs a
  // keep-mounted-hidden strategy or a restorable currentTime ref — out of
  // scope for this Task; tracked in plan §Open Items.
  useEffect(() => {
    const media = mediaRef.current
    if (!media) return
    const videos = media.querySelectorAll('video')
    videos.forEach((v) => {
      if (!v.paused) v.pause()
    })
  }, [tweetSlotIdx])

  // Lazy-load the R3F flip scene module on idle. This keeps the
  // ~250 KB three.js + @react-three/fiber payload OUT of the initial
  // bundle — first paint is unaffected — and prefetches it during the
  // browser's quiet time so by the time the user clicks any card the
  // scene is already cached and instantaneous to mount.
  const [SceneComp, setSceneComp] = useState<ComponentType<LightboxFlipSceneProps> | null>(null)
  useEffect(() => {
    let cancelled = false
    const load = (): void => {
      void import('./LightboxFlipScene').then((m) => {
        if (!cancelled) setSceneComp(() => m.default)
      }).catch(() => {
        // Module load failure → silently fall back to CSS FLIP forever.
        // No telemetry here; if it can't load the user just gets the
        // (already-rich) CSS animation instead.
      })
    }
    // requestIdleCallback fires when the main thread is quiet; lets
    // initial paint finish before we start the network fetch. Falls
    // back to setTimeout for Safari (no rIC support yet).
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }
    if (typeof w.requestIdleCallback === 'function') {
      w.requestIdleCallback(load, { timeout: 2000 })
    } else {
      setTimeout(load, 800)
    }
    return (): void => { cancelled = true }
  }, [])

  // Scene-mode coordination: when the scene is rendering, the actual
  // .frame is held at opacity 0 and close requests are ignored. The
  // ref mirror exists so requestClose's useCallback closure can read
  // the current value without becoming a re-render dep.
  const [sceneActive, setSceneActive] = useState<boolean>(false)
  const sceneActiveRef = useRef<boolean>(false)
  const [targetRectState, setTargetRectState] = useState<DOMRect | null>(null)

  // Reverse FLIP close — mirror the open animation: shrink + translate +
  // tilt + blur back to the source card's rect, fade out, then call the
  // real onClose (which unmounts the lightbox in BoardRoot). Without this
  // the lightbox just blinked away on close, which felt cheap next to
  // the rich open animation. closingRef guards against double-fire from
  // (Esc + backdrop + ✕) chains.
  const closingRef = useRef<boolean>(false)
  const requestClose = useCallback((): void => {
    // Block close while the R3F open scene is mid-tween — the .frame is
    // hidden during that ~700 ms window and would animate invisibly,
    // leaving the user staring at a paused scene with nothing happening.
    if (closingRef.current || sceneActiveRef.current) return
    closingRef.current = true
    const el = frameRef.current
    const backdrop = backdropRef.current
    if (!el) {
      onClose()
      return
    }
    // Kill any in-flight open tween so we animate from current state.
    gsap.killTweensOf(el)
    if (backdrop) gsap.killTweensOf(backdrop)

    // Prefer the source card's *current* DOM rect so the close FLIP tracks
    // any pan/scroll that happened while the lightbox was open. Falls back
    // to the click-time originRect when the source card has been culled
    // (off-screen) — and finally to the scale-only fade below. (B-#11)
    const liveSourceEl = sourceCardId
      ? document.querySelector<HTMLElement>(`[data-bookmark-id="${sourceCardId}"]`)
      : null
    const liveSourceRect = liveSourceEl?.getBoundingClientRect() ?? null
    const closeOrigin = liveSourceRect ?? originRect

    const mediaEl = mediaRef.current
    const textEl = textRef.current
    const closeEl = closeBtnRef.current

    if (closeOrigin && mediaEl) {
      // === B-#17 destefanis clone-based close ===
      // Build a fresh clone of the source card at the current .media
      // rect, hide .media, animate the clone back to the source rect.
      // border-radius は --lightbox-media-radius (= 現在 20px) で固定。
      // clone / source card / .media の三者で同じ var を参照するため morph
      // 中に角丸の jump / 連続変動は出ない。
      const mediaRect = mediaEl.getBoundingClientRect()

      // Kill any in-flight open tween on the chrome / media so close
      // takes over from the current visual state cleanly.
      gsap.killTweensOf(mediaEl)
      if (textEl) {
        gsap.killTweensOf(textEl)
        const stageEls = collectStageEls(textEl)
        if (stageEls.length > 0) gsap.killTweensOf(stageEls)
      }
      if (closeEl) gsap.killTweensOf(closeEl)

      // Stand up the close clone at .media's current rect, then hide
      // .media so the clone takes over the visual immediately. Both
      // start and end rects are converted to host-relative coords
      // because the host lives inside .canvasWrap (position:absolute)
      // rather than at body root.
      let clone: HTMLElement | null = null
      let scaleHost: HTMLElement | null = null
      const host = liveSourceEl ? ensureCloneHost() : null
      // Wipe any orphan from a prior interrupted morph before standing up ours.
      if (host) clearCloneHost()
      const closeOriginHost = host ? toHostRelativeRect(closeOrigin, host) : null
      const mediaRectHost = host ? toHostRelativeRect(mediaRect, host) : null
      if (liveSourceEl && host && mediaRectHost && closeOriginHost) {
        clone = createLightboxClone(liveSourceEl, mediaRectHost)
        // session 35: close は media 大 → source 小 に縮む。 scale-host は source 寸法
        // 固定 + 初期 scale = media/source (= 大)、 tween 中 scale = currentW/sourceW
        // で 1.0 (= source size 実寸) に着地。
        const initialScale = closeOriginHost.width > 0
          ? mediaRectHost.width / closeOriginHost.width
          : 1
        scaleHost = wrapCloneWithScaleHost(
          clone,
          closeOriginHost.width,
          closeOriginHost.height,
          initialScale,
        )
        host.appendChild(clone)
      }
      mediaEl.style.opacity = '0'
      mediaEl.style.borderRadius = ''

      const tl = gsap.timeline({
        onComplete: () => {
          if (clone && clone.parentNode) clone.remove()
          onClose()
        },
      })
      if (textEl) {
        tl.to(textEl, {
          opacity: 0,
          duration: CLOSE_TEXT_FADE_DUR,
          ease: 'power2.in',
        }, 0)
      }
      if (closeEl) {
        tl.to(closeEl, {
          opacity: 0,
          duration: CLOSE_TEXT_FADE_DUR,
          ease: 'power2.in',
        }, 0)
      }
      if (clone && closeOriginHost) {
        // session 32: modifier 案 (= 毎フレーム整数 px snap) は user 確認で
        // 「box が px 単位 discrete jump して角丸グニャグニャ感」 と判明し
        // revert。 mid-tween は float のまま smooth に伸ばし、 始終端だけ
        // 整数 snap する session 31 B-b の挙動に戻す。 user は震えの真因は
        // GSAP interpolation ではなく「別の原因」 と仮説、 別途調査要。
        const sourceW = closeOriginHost.width
        const capturedClone = clone
        const capturedScaleHost = scaleHost
        tl.to(clone, {
          top: Math.round(closeOriginHost.top),
          left: Math.round(closeOriginHost.left),
          width: Math.round(closeOriginHost.width),
          height: Math.round(closeOriginHost.height),
          duration: CLOSE_TWEEN_DUR,
          ease: CLOSE_TWEEN_EASE,
          onUpdate: () => {
            // session 35: 文字カードの hybrid scale-host を outer width に追従。
            // zoom = currentOuterW / sourceW → 大 (= media) から 1.0 (= source) へ縮む。
            // zoom で文字 crisp (= transform:scale だと raster blur)。
            if (!capturedScaleHost || sourceW <= 0) return
            const w = gsap.getProperty(capturedClone, 'width') as number
            if (typeof w === 'number' && w > 0) {
              capturedScaleHost.style.zoom = `${w / sourceW}`
            }
          },
        }, CLOSE_FRAME_DELAY)
      }
      if (backdrop) {
        tl.to(backdrop, {
          opacity: 0,
          duration: CLOSE_BACKDROP_FADE_DUR,
          ease: 'power2.in',
        }, CLOSE_BACKDROP_DELAY)
      }

      // Reveal source card a hair before the clone lands. Both are
      // visually identical (clone was made from source), so this lead
      // is just safety margin for React reflow on visibility flip.
      const landingAt = CLOSE_FRAME_DELAY + CLOSE_TWEEN_DUR
      const revealAt = Math.max(0, landingAt - CLOSE_REVEAL_LEAD)
      if (onSourceShouldShow) {
        tl.call(() => { onSourceShouldShow() }, undefined, revealAt)
      }
    } else {
      gsap.to(el, {
        scale: 0.96,
        opacity: 0,
        duration: CLOSE_FALLBACK_DUR,
        ease: 'power2.in',
        onComplete: () => onClose(),
      })
    }
  }, [onClose, originRect, sourceCardId])

  // Escape key closes
  useEffect(() => {
    if (!identity) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        requestClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [identity, requestClose])

  // Arrow nav. Skip when an INPUT/TEXTAREA/SELECT has focus to avoid
  // hijacking text editing within an embed. Esc handler intentionally
  // does NOT skip on input focus — close should always work.
  useEffect(() => {
    if (!identity) return
    const onKey = (e: KeyboardEvent): void => {
      if (closingRef.current) return
      const ae = document.activeElement
      const tag = ae?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        // Mix-tweet: nav cycles through slots (video or photo). Falls back
        // to no-op when the current tweet has zero or one slot.
        if (tweetSlots.length <= 1) return
        e.preventDefault()
        e.stopPropagation()
        if (e.key === 'ArrowDown') {
          setTweetSlotIdx((idx) => Math.min(tweetSlots.length - 1, idx + 1))
        } else {
          setTweetSlotIdx((idx) => Math.max(0, idx - 1))
        }
        return
      }

      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (!nav) return
      e.stopPropagation()
      nav.onNav(e.key === 'ArrowLeft' ? -1 : 1)
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [identity, nav, tweetSlots])

  // Mouse wheel nav. Both vertical (deltaY) and horizontal (deltaX) are
  // accepted — trackpad two-finger swipe and traditional wheel both work.
  // 280ms debounce prevents a single inertial flick from skipping multiple
  // cards. Threshold (>= 18) suppresses accidental tiny scrolls.
  const wheelLockUntilRef = useRef<number>(0)
  useEffect(() => {
    if (!identity || !nav) return
    const onWheel = (e: WheelEvent): void => {
      // Skip while a close tween is in progress: the user has committed to
      // dismissing this lightbox, so any wheel they fire in the next ~500ms
      // is residual scroll intent for the board, not nav within the
      // lightbox. Without this guard the wheel handler would invoke
      // nav.onNav() and a flash of next/prev card animation slips in.
      if (closingRef.current) return
      // Wheel over the text panel swallows nav ONLY while that panel actually
      // overflows (has a scrollbar) — then the wheel scrolls the text and never
      // flips cards, even past the scroll edge (session 56: たとえ端まで読み切っても
      // 勝手に next/prev に飛ぶのは嫌、という指摘). When the text fits (no scrollbar),
      // there's nothing to scroll, so we fall through and let left/right flip
      // cards over the text area as usual (session 63 user request).
      const target = e.target as Element | null
      if (target) {
        const scroller = target.closest<HTMLElement>('[data-card-scroll="true"]')
        if (scroller && scroller.scrollHeight > scroller.clientHeight + 1) return
      }
      const dx = e.deltaX
      const dy = e.deltaY
      const dominant = Math.abs(dx) > Math.abs(dy) ? dx : dy
      if (Math.abs(dominant) < 18) return
      const now = performance.now()
      if (now < wheelLockUntilRef.current) return
      wheelLockUntilRef.current = now + 280
      e.preventDefault()
      nav.onNav(dominant > 0 ? 1 : -1)
    }
    // passive:false because we preventDefault to suppress backdrop scroll
    window.addEventListener('wheel', onWheel, { passive: false })
    return (): void => window.removeEventListener('wheel', onWheel)
  }, [identity, nav])

  // Reset closingRef when item changes (= a new lightbox session opens
  // after a previous close completed). identity is the stable string
  // ref, so this only fires when the user opens a different card.
  useEffect(() => {
    closingRef.current = false
    // Also reset scene state on each new open so we don't carry over
    // a stale sceneActive=true from a previous session that happened
    // to unmount before its completion callback fired.
    sceneActiveRef.current = false
    setSceneActive(false)
    setTargetRectState(null)
  }, [identity])

  // Sweep the clone host whenever the lightbox fully closes (identity → null),
  // guarding against an interrupted close leaving its proxy clone orphaned on
  // the board (stale thumbnail). Sweeps ONLY when closed — never on a
  // card-to-card change — so it can't remove the open clone that the open
  // useLayoutEffect creates for a fresh session.
  useEffect(() => {
    if (!identity) clearCloneHost()
  }, [identity])
  // Final safety net: sweep on unmount (clones live outside React, so a
  // mid-morph unmount would otherwise strand one on the board).
  useEffect(() => (): void => clearCloneHost(), [])

  // Fired by the R3F scene when the open tween reaches progress=1.
  // We unmount the scene (setSceneActive false) and reveal the actual
  // .frame with a brief opacity fade so the swap is imperceptible.
  // The frame's transforms have never been touched by the scene path,
  // so it lands at the natural centred position with no jump.
  const handleSceneComplete = useCallback((): void => {
    sceneActiveRef.current = false
    setSceneActive(false)
    if (frameRef.current) {
      gsap.fromTo(
        frameRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.18, ease: 'power2.out' },
      )
    }
  }, [])

  // Open animation: FLIP from the clicked card's screen position when an
  // originRect is supplied, otherwise a scale-in fallback. Uses two
  // parallel tweens so the opacity reveal lands quickly (~0.22s) while
  // the transform (scale + position) keeps unfurling for the full
  // duration on a smoother power3.out curve. Running both at offset 0
  // of a timeline guarantees they share the exact same start frame, so
  // there is no perceptible flicker from one beating the other to the
  // first paint. .frame's CSS opacity:0 + will-change keeps the GPU
  // layer warm before the tween fires.
  useLayoutEffect(() => {
    if (!identity || !frameRef.current) return
    const el = frameRef.current
    const backdrop = backdropRef.current

    // Chevron-nav case: the lightbox is already open and the slide effect
    // below (the second useLayoutEffect, declared lower in this file) is
    // about to fire on the same identity change. If we ALSO run the
    // entry/fallback animation here, the two tweens race on the same DOM
    // node — and the fallback's `{ scale: 0.86, opacity: 0 }` FROM gets
    // written inline before the slide effect kills the to-tween, leaving
    // `scale=0.86` permanently in the transform matrix because the slide
    // tween never sets `scale`. (Symptom: every card after the first
    // chevron-nav rendered at 86% size, forever. Measured with Playwright
    // 2026-05-11: chev/click rect ratio = 0.860 exact.)
    // The first mount of any identity has prevIdentityRef.current === null
    // (set by the close cleanup below, or initial useRef default), so this
    // skip never blocks the genuine open animation.
    if (prevIdentityRef.current !== null && prevIdentityRef.current !== identity) {
      return
    }

    // R3F scene mode is currently DISABLED at the activation site
    // because the first end-to-end test left the lightbox stuck on
    // an empty backdrop (likely texture-load CORS failure leaving
    // onComplete unfired). The scene module is still lazy-loaded
    // and ready; flip the SCENE_ENABLED flag below to re-enable
    // once we've added a load timeout + texture fallback path.
    const SCENE_ENABLED = false
    if (SCENE_ENABLED && originRect && SceneComp && view?.thumbnail) {
      const targetRect = el.getBoundingClientRect()
      setTargetRectState(targetRect)
      sceneActiveRef.current = true
      setSceneActive(true)
      gsap.set(el, { opacity: 0 })
      let backdropTween: gsap.core.Tween | null = null
      if (backdrop) {
        backdropTween = gsap.fromTo(
          backdrop,
          { opacity: 0 },
          { opacity: 1, duration: 0.22, ease: 'power2.out' },
        )
      }
      return (): void => { backdropTween?.kill() }
    }

    const mediaEl = mediaRef.current
    const textEl = textRef.current
    const closeEl = closeBtnRef.current

    if (originRect && mediaEl) {
      // === B-#17 destefanis clone-based open ===
      // Strategy: lift a `cloneNode` proxy of the source card up to body
      // root, animate its width/height/top/left from source rect to the
      // .media's final rect. No transform:scale — width/height change
      // directly, so border-radius never gets GPU-resampled. While the
      // clone is in flight, .media is held opacity:0; the clone vanishes
      // and .media flips to opacity:1 at the same frame (handoff).
      const mediaRect = mediaEl.getBoundingClientRect()
      const sourceCard = sourceCardId
        ? document.querySelector<HTMLElement>(`[data-bookmark-id="${sourceCardId}"]`)
        : null
      // Prefer the source card's *live* rect over the captured originRect.
      // originRect was snapshotted at click time and won't track scroll/
      // pan that happened in the brief window before the lightbox mounted.
      const sourceRect = sourceCard ? sourceCard.getBoundingClientRect() : originRect

      const dx = (mediaRect.left + mediaRect.width / 2) - (sourceRect.left + sourceRect.width / 2)
      const dy = (mediaRect.top + mediaRect.height / 2) - (sourceRect.top + sourceRect.height / 2)
      const distance = Math.hypot(dx, dy)
      const dur = OPEN_BASE_DUR + Math.min(distance / OPEN_DIST_DIVISOR, OPEN_DIST_BONUS_MAX)

      const revealTokens = readRevealTokens()
      const prefersReduce = getPrefersReducedMotion()
      const stageEls = textEl ? collectStageEls(textEl) : []
      if (textEl) gsap.set(textEl, { opacity: 1 })
      setStageInitialState(stageEls, revealTokens.translateY, prefersReduce)
      if (closeEl) gsap.set(closeEl, { opacity: 0 })

      // Frame stays opaque; .media is invisible while the clone covers
      // its real estate. Handoff flips .media back to visible at
      // onComplete.
      gsap.set(el, { opacity: 1 })
      gsap.set(mediaEl, { opacity: 0, clearProps: 'transform' })
      mediaEl.style.borderRadius = ''

      // Convert start (source) and end (media) rects from viewport
      // coords into the host's local coords; the host lives inside
      // .canvasWrap (position:absolute), not at body root, so the
      // clone's top/left and the gsap tween's target values must be
      // expressed relative to the canvasWrap.
      let clone: HTMLElement | null = null
      const host = sourceCard ? ensureCloneHost() : null
      // Wipe any orphan from a prior interrupted morph before standing up ours.
      if (host) clearCloneHost()
      const sourceRectHost = host ? toHostRelativeRect(sourceRect, host) : null
      const mediaRectHost = host ? toHostRelativeRect(mediaRect, host) : null
      let scaleHost: HTMLElement | null = null
      if (sourceCard && host && sourceRectHost) {
        clone = createLightboxClone(sourceCard, sourceRectHost)
        // session 35: 文字カード hybrid。 内側に scale-host を仕込んで、 外側
        // width/height tween と同期で内容も拡大させる。 文字以外 (image/video) は
        // null が返り、 従来通りの挙動 (= img が自然 fit) を維持。
        scaleHost = wrapCloneWithScaleHost(clone, sourceRectHost.width, sourceRectHost.height, 1)
        host.appendChild(clone)
      }

      const tl = gsap.timeline()
      if (clone && mediaRectHost && sourceRectHost) {
        // session 32: modifier revert (= 角丸グニャグニャ報告)、 始終端 snap のみ。
        // close と対称。
        const startW = sourceRectHost.width
        const capturedClone = clone
        const capturedScaleHost = scaleHost
        tl.to(clone, {
          top: Math.round(mediaRectHost.top),
          left: Math.round(mediaRectHost.left),
          width: Math.round(mediaRectHost.width),
          height: Math.round(mediaRectHost.height),
          duration: dur,
          ease: OPEN_EASE,
          onUpdate: () => {
            // session 35: scale-host があるとき (= 文字カード) のみ、 外側 width に
            // 合わせて内側 zoom を更新。 image/video は scale-host=null = skip。
            // zoom で文字 crisp (= transform:scale だと raster blur)。
            if (!capturedScaleHost || startW <= 0) return
            const w = gsap.getProperty(capturedClone, 'width') as number
            if (typeof w === 'number' && w > 0) {
              capturedScaleHost.style.zoom = `${w / startW}`
            }
          },
          onComplete: () => {
            // Instant swap: paint .media at opacity 1 in the same
            // frame the clone is removed. For still images the two
            // are visually identical, so the swap is invisible. For
            // YouTube / video the iframe's letterbox mismatch is
            // briefly visible — addressed separately by a "play
            // button overlay" follow-up (IDEAS.md). A cross-fade
            // tween was tried here but it briefly puts both layers
            // at <100% opacity, letting the backdrop bleed through
            // (= "背景が見える" report). Instant swap avoids that.
            mediaEl.style.opacity = '1'
            const c = clone
            if (c && c.parentNode) c.remove()
          },
        }, 0)
      } else {
        // No source card found (off-screen / unmounted). Fall back to
        // a simple opacity fade on .media at the final rect.
        tl.to(mediaEl, {
          opacity: 1,
          duration: dur,
          ease: OPEN_EASE,
        }, 0)
      }

      const textStartAt = dur * 0.5 + revealTokens.pause
      appendRevealTimeline(tl, stageEls, revealTokens, textStartAt, prefersReduce)
      const chromeAt = dur * OPEN_TEXT_FADE_DELAY_RATIO
      if (closeEl) {
        tl.to(closeEl, {
          opacity: 1,
          duration: OPEN_TEXT_FADE_DUR,
          ease: 'power2.out',
        }, chromeAt)
      }
      let backdropTween: gsap.core.Tween | null = null
      if (backdrop) {
        backdropTween = gsap.fromTo(
          backdrop,
          { opacity: 0 },
          { opacity: 1, duration: OPEN_BACKDROP_FADE_DUR, ease: 'power2.out' },
        )
      }
      return (): void => {
        // Kill in-flight tweens; if the lightbox is being torn down
        // mid-open, also clean up the clone so it doesn't outlive the
        // animation. .media's opacity is left as-is — the close path
        // (or remount) will set it explicitly.
        tl.kill()
        backdropTween?.kill()
        if (clone && clone.parentNode) clone.remove()
      }
    }

    // No-originRect fallback — gentle scale-in on .frame itself, kept
    // opaque to match the main path's "no opacity drama" character.
    const tween = gsap.fromTo(
      el,
      { scale: 0.96, opacity: 0 },
      { scale: 1, opacity: 1, duration: OPEN_FALLBACK_DUR, ease: 'power2.out' },
    )
    return (): void => { tween.kill() }
    // originRect is intentionally read once at mount via the identity dep —
    // a later rect change should not retrigger the open animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity])

  // 3D physical slide on nav transition. Distinct from the FLIP open
  // animation: this only fires when identity changes WHILE the lightbox
  // is already open (not on first mount). Direction inferred from the
  // nav.currentIndex delta. Wrap-around (last → 0 or 0 → last) is
  // detected via abs(delta) > total/2 and treated as the "natural"
  // forward/back direction so the slide reads as continuous.
  //
  // The departing card is preserved as a DOM clone overlaid on the
  // backdrop, so the user sees BOTH the old card receding into the depth
  // and the new card emerging from the depth simultaneously — without
  // this clone trick, React's unmount would erase the old DOM the moment
  // identity changes, and only the entering animation would be visible.
  // prevIdentityRef + prevNavIndexRef were moved to the top of the component
  // (alongside backdropRef/frameRef) so the open useLayoutEffect can read
  // them too. Kept this comment as a breadcrumb in case anyone greps for
  // "prevIdentityRef" from the original location.
  // Tracks every in-flight snapshot clone so a new identity change can
  // wipe them all out before starting a fresh tween. Without this, fast
  // drag-scrub piles up dozens of snapshots all sliding the same way —
  // they'd pool on one side instead of staying centered.
  const activeSnapshotsRef = useRef<Set<HTMLElement>>(new Set())
  const lastTransitionAtRef = useRef<number>(0)
  useLayoutEffect(() => {
    if (!identity) {
      prevIdentityRef.current = null
      prevNavIndexRef.current = null
      return
    }
    const prevIdentity = prevIdentityRef.current
    const prevNavIndex = prevNavIndexRef.current
    prevIdentityRef.current = identity
    prevNavIndexRef.current = nav?.currentIndex ?? null

    // First mount of this identity — let the FLIP open effect handle it.
    if (prevIdentity === null) return
    // Same identity (nav did not change anything) — no-op.
    if (prevIdentity === identity) return
    // Nav prop missing — can't infer direction.
    if (!nav || prevNavIndex === null) return

    const el = frameRef.current
    const backdrop = backdropRef.current
    if (!el || !backdrop) return

    // Detect rapid-fire transitions (drag-scrub). When changes arrive
    // faster than ~120ms apart we shorten the tween dramatically so each
    // card has time to read as a flip rather than getting buried under
    // the next snapshot. Slow nav (chevron / arrow / wheel) keeps the
    // dramatic 0.7s travel.
    const now = performance.now()
    const sinceLast = now - lastTransitionAtRef.current
    const isRapid = sinceLast < 120
    lastTransitionAtRef.current = now

    // Wipe any still-animating snapshot clones before we add the next
    // one. Otherwise their long 0.7s tweens linger and accumulate on the
    // edge of the screen during a fast drag.
    for (const oldSnap of activeSnapshotsRef.current) {
      gsap.killTweensOf(oldSnap)
      oldSnap.remove()
    }
    activeSnapshotsRef.current.clear()

    const delta = nav.currentIndex - prevNavIndex
    let dir: 1 | -1
    if (Math.abs(delta) > nav.total / 2) {
      // Wrap-around: large negative delta means we wrapped forward (e.g.
      // last → 0), so visually it's still "forward" (entering from right).
      dir = delta > 0 ? -1 : 1
    } else {
      dir = delta > 0 ? 1 : -1
    }

    // --- Clone the OLD frame so it can recede while React mounts the new one. ---
    // We snapshot what the user is currently seeing, kill its iframes /
    // videos so playback doesn't ghost, then animate it backward + sideways.
    // The clone lives directly on the backdrop in the same screen rect as
    // the real frame so the visual transition is seamless.
    const snapshot = el.cloneNode(true) as HTMLElement
    snapshot.removeAttribute('id')
    snapshot.style.position = 'absolute'
    const rect = el.getBoundingClientRect()
    const backdropRect = backdrop.getBoundingClientRect()
    snapshot.style.left = `${rect.left - backdropRect.left}px`
    snapshot.style.top = `${rect.top - backdropRect.top}px`
    snapshot.style.width = `${rect.width}px`
    snapshot.style.height = `${rect.height}px`
    snapshot.style.margin = '0'
    snapshot.style.pointerEvents = 'none'
    snapshot.style.zIndex = '1'
    snapshot.style.willChange = 'transform, opacity'
    // Stop any iframe / video so the clone doesn't double-play audio.
    snapshot.querySelectorAll('iframe').forEach((f) => { (f as HTMLIFrameElement).src = 'about:blank' })
    snapshot.querySelectorAll('video').forEach((v) => {
      try { (v as HTMLVideoElement).pause() } catch { /* noop */ }
    })
    backdrop.appendChild(snapshot)

    // --- 3D slide constants ---
    // Distance is sized to viewport so cards travel from one edge to the
    // other rather than nudging a few inches — reads as a real
    // page-flip rather than a polite shuffle. 60% of the viewport width
    // gives plenty of travel without making the entering card feel
    // launched from outer space.
    //
    // In rapid mode (drag-scrub) we keep the directional travel + 3D feel
    // — cards still enter from one side and exit toward the other — but
    // shorten the duration so each transition resolves quickly. The
    // snapshot-cleanup pass above guarantees only one in-flight pair at a
    // time, so the dramatic travel won't pile up at the edge.
    // power4.out is front-loaded (high velocity at t=0 → low at t=1), so
    // even 16-30 ms of tween time covers a strongly visible chunk of the
    // travel — the user sees cards genuinely shooting off-side.
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
    const ENTER_DIST = isRapid ? Math.round(vw * 0.45) : Math.round(vw * 0.6)
    const ENTER_DEPTH = isRapid ? -200 : -380
    const LEAVE_DIST = isRapid ? Math.round(vw * 0.45) : Math.round(vw * 0.6)
    const LEAVE_DEPTH = isRapid ? -150 : -280
    const ROTATE_Y = isRapid ? 10 : 14
    const DUR = isRapid ? 0.22 : 0.7

    activeSnapshotsRef.current.add(snapshot)
    // Departing animation on the cloned snapshot.
    gsap.fromTo(
      snapshot,
      { x: 0, z: 0, rotateY: 0, opacity: 1, transformOrigin: '50% 50%' },
      {
        x: -dir * LEAVE_DIST,
        z: LEAVE_DEPTH,
        rotateY: -dir * ROTATE_Y,
        opacity: 0,
        duration: DUR,
        ease: 'power4.out',
        onComplete: () => {
          activeSnapshotsRef.current.delete(snapshot)
          snapshot.remove()
        },
      },
    )

    // Entering animation on the real (newly mounted) frame.
    gsap.killTweensOf(el)

    // I-07-#5: 新カードの stage 要素を初期化 (不可視) し、 slide 完了後に
    // reveal timeline を発火させる。 連打 (rapid) で slide が短縮されても
    // pause + reveal は token 値そのまま — 連打中は slide が次々に
    // 立ち上がり、 ここまで来ない (前 useLayoutEffect 発火で kill される)
    // ので reveal は最後の slide 完了時にしか走らない。
    const newTextEl = textRef.current
    const revealTokens = readRevealTokens()
    const prefersReduce = getPrefersReducedMotion()
    const newStageEls = newTextEl ? collectStageEls(newTextEl) : []
    // 進行中 reveal を kill (前カード残骸対策)
    if (newStageEls.length > 0) gsap.killTweensOf(newStageEls)
    setStageInitialState(newStageEls, revealTokens.translateY, prefersReduce)

    gsap.fromTo(
      el,
      {
        x: dir * ENTER_DIST,
        z: ENTER_DEPTH,
        rotateY: dir * ROTATE_Y,
        opacity: 0,
        transformOrigin: '50% 50%',
      },
      {
        x: 0,
        z: 0,
        rotateY: 0,
        opacity: 1,
        duration: DUR,
        ease: 'power4.out',
        onComplete: () => {
          // slide 着地後 + pause を待って reveal 発火。
          // gsap.delayedCall は内部でフレームに乗るので、 識別子変化や
          // 次 slide が来た場合は次の useLayoutEffect で kill される。
          const tl = gsap.timeline({ delay: revealTokens.pause })
          appendRevealTimeline(tl, newStageEls, revealTokens, 0, prefersReduce)
        },
      },
    )
  }, [identity, nav])

  // No programmatic auto-focus on open — the bare ✕ button rendered with
  // a default browser focus ring reads as an unwanted "selected" rectangle
  // around the corner. Esc still closes via the window keydown listener
  // above, and Tab from anywhere lands on the close button as the first
  // focusable element inside the lightbox, with the standard focus ring
  // shown only for that genuine keyboard nav (CSS :focus-visible).

  if (!view) return null

  const host = (() => {
    try { return new URL(view.url).hostname.replace(/^www\./, '') }
    catch { return '' }
  })()

  // Unified 2-column layout for every item type (tweet, video, image, site).
  // Tweets diverge only in what fills the .media (left) and .text (right)
  // cells — see TweetMedia and TweetText. This replaces the prior react-tweet
  // single-column branch, which couldn't play tweet videos inline.
  return (
    <>
      {/* R3F open scene — only rendered while sceneActive. The Canvas
          is a fixed-position viewport-level overlay that does its own
          tween in WebGL, then signals onComplete which fades in the
          actual lightbox content below. */}
      {sceneActive && SceneComp && originRect && targetRectState && view.thumbnail && (
        <SceneComp
          originRect={originRect}
          targetRect={targetRectState}
          thumbnail={view.thumbnail}
          onComplete={handleSceneComplete}
        />
      )}
      {/* Two-layer split (session 25): backdrop is now a pure dim
          layer (z 100) that only carries the semi-transparent black,
          opacity fade-in tween, and outside-click-to-close handler. */}
      <div
        ref={backdropRef}
        className={`${styles.backdrop} ${styles.open}`.trim()}
        onClick={(e) => { if (e.target === backdropRef.current) requestClose() }}
        data-testid="lightbox-backdrop"
        aria-hidden="true"
      />
      {/* Stage owns the perspective / centering / overflow clip and all
          interactive content (frame + nav + close). z 300 keeps it above
          the clone host (z 200) so text panel + close render in front
          of any in-flight morph clone. pointer-events:none lets clicks
          on the empty stage area fall through to the backdrop's close
          handler; .frame re-enables pointer events for its children. */}
      <div
        className={styles.stage}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lightbox-title"
        data-testid="lightbox"
      >
      {nav && nav.total > 1 && (
        <>
          <LightboxNavChevron dir="prev" onClick={() => nav.onNav(-1)} />
          <LightboxNavChevron dir="next" onClick={() => nav.onNav(1)} />
          {/* Session 39 (B-#20): LightboxNavMeter was rendered HERE inside
              `.stage` (viewport-fixed); it lived at viewport-bottom 24px
              center while ScrollMeter sat at canvas-bottom 24px center —
              two different containing blocks meant the meter "jumped"
              positions on open/close (the "ガチャガチャ" symptom). The
              meter is now rendered by `BoardRoot` in a shared canvas-
              bottom slot alongside ScrollMeter, with opacity crossfade.
              Chevrons stay here since they belong to viewport-edge nav
              hot-zones, not the meter slot. */}
        </>
      )}
      {/* Session 33: Layer 1 (= 全面 close zone)。 frame 自体のどこを
          click しても閉じる。 子の interactive 要素 (.media / source link 等)
          は stopPropagation で「閉じる」 を吸収する z-index レイヤー方式。
          closingRef が requestClose の double-fire を防ぐので、 close 押下
          → close button + frame 両方発火しても安全。 */}
      <div ref={frameRef} className={styles.frame} onClick={requestClose}>
        {/* Close button is now a child of .frame, anchored to its top-right
            corner (offset slightly above and outside via CSS). This makes
            the ✕ visually "attached" to the lightbox unit — the user reads
            it as "this ✕ closes this modal", which is the Linear / Stripe /
            Pinterest pattern. Frame's max-width + max-height are bounded
            (min(94vw, 1240px) horizontally, envelope variable vertically),
            so the ✕ never escapes the canvas regardless of viewport size
            or post content. The earlier "sibling of .frame in backdrop"
            placement (session 9) was reverted because it left the ✕
            floating in an empty corner on wide screens, with no visual
            relationship to the lightbox content (user 2026-05-11). */}
        <button
          ref={closeBtnRef}
          type="button"
          onClick={requestClose}
          className={styles.close}
          aria-label={t('board.lightbox.close')}
        >
          <span className={styles.closeIcon} aria-hidden="true">✕</span>
        </button>
        <div
          ref={mediaRef}
          className={styles.media}
          /* Session 33: 媒体 (動画 / 画像 / iframe) の click は .frame の
             close 発火を吸収する。 動画 controls / image zoom 等は内部要素が
             個別に hit を取るので機能維持。 */
          onClick={(e): void => e.stopPropagation()}
        >
          {/* key={view.url}: remount the whole left-media subtree per card so a
              reused <video>/<iframe> can't keep showing the previous card's
              frame on left/right nav (the text panel updated fine, the media
              didn't — session 63 stale-media bug). */}
          {tweetId
            ? <TweetMedia
                key={view.url}
                item={view}
                meta={tweetMeta}
                slots={tweetSlots}
                slotIdx={tweetSlotIdx}
              />
            : <LightboxMedia key={view.url} item={view} />}
          {/* I-07-#4 follow-up: multi-image dots live INSIDE .media as
              an absolutely-positioned child, centered horizontally on
              the media column (= the image itself), placed in the
              chrome-clearance zone just below the media envelope.
              `.media` keeps overflow:visible so the dots aren't clipped
              by it — descendant img/iframe/video each carry their own
              border-radius so removing .media's overflow clip is
              visually identical (per the .media comment block). */}
          {tweetId && tweetSlots.length > 1 && (
            <LightboxImageDots
              slots={tweetSlots}
              currentIdx={tweetSlotIdx}
              onJump={setTweetSlotIdx}
            />
          )}
        </div>
        {/* data-card-scroll: the window wheel handler bails over this panel, so
            the wheel scrolls the text natively and never flips to the prev/next
            card — including when you wheel past the scroll edge (session 56). */}
        <div ref={textRef} className={styles.text} data-card-scroll="true">
          {tweetId
            ? <TweetText
                item={view}
                meta={tweetMeta}
                hideBody={shouldHideTweetBody(tweetMeta, tweetSlots)}
              />
            : <DefaultText item={view} host={host} />}
        </div>
      </div>
    </div>
    </>
  )
}

/** Extract a byline + caption + date/likes/comments meta from the
 *  Instagram OGP payload that bookmarklets typically capture. The raw
 *  title looks like:
 *    "sumy - Instagram: \"<caption>\""
 *  and the raw description looks like:
 *    "April 29, 2026、410 likes, 0 comments - iamsumy: \"<caption>\""
 *  Both end up duplicated in the panel verbatim, including the giant
 *  caption block in quotes — visually it reads as a wall of repeated
 *  text. This parser strips the boilerplate ("Instagram:", the date /
 *  stats line, the surrounding quotes) so the caption renders once,
 *  with date + stats demoted to a small meta footer. Falls back to
 *  the raw strings on parse failure so we never show NOTHING. */
function cleanInstagramText(item: LightboxItem): {
  byline: string | null
  caption: string
  meta: string | null
} {
  const rawTitle = item.title ?? ''
  const rawDesc = item.description ?? ''

  // Regexes use [\s\S] in place of `.` so they match across newlines
  // without needing the `s` (dotAll) flag, which requires ES2018+ — the
  // tsconfig here doesn't quite reach that bar.
  let byline: string | null = null
  let titleCaption: string | null = null
  const titleM = rawTitle.match(
    /^([\s\S]+?)\s+[-–—]\s+Instagram\s*:\s*["“”']([\s\S]*)["“”']\s*$/i,
  )
  if (titleM) {
    byline = titleM[1].trim()
    titleCaption = titleM[2].trim()
  }

  let descCaption: string | null = null
  let meta: string | null = null
  const descM = rawDesc.match(
    /^([\s\S]+?)[、,]\s*([\d,]+\s+likes?(?:[\s\S]*?comments?)?)\s+-\s+(\S+?)\s*:\s*["“”']([\s\S]*)["“”']\s*$/i,
  )
  if (descM) {
    const date = descM[1].trim()
    const stats = descM[2].trim()
    const handle = descM[3].trim()
    descCaption = descM[4].trim()
    meta = `${date} · ${stats}`
    if (!byline) byline = handle
  }

  // Pick the longer of the two caption candidates — the OGP description
  // usually truncates earlier than the title since description has a
  // smaller crawler budget.
  const caption =
    (titleCaption?.length ?? 0) >= (descCaption?.length ?? 0)
      ? titleCaption ?? descCaption ?? rawTitle
      : descCaption ?? titleCaption ?? rawTitle

  return { byline, caption, meta }
}

function DefaultText({
  item,
  host,
  hideTitle = false,
}: {
  readonly item: LightboxItem
  readonly host: string
  /** Suppress the `<h1>` title when the title is already shown inside the
   *  large TextCard on the media side (text-only card, session 31). */
  readonly hideTitle?: boolean
}): ReactElement {
  const isInstagram = detectUrlType(item.url) === 'instagram'

  if (isInstagram) {
    const { byline, caption, meta } = cleanInstagramText(item)
    return (
      <>
        <h1 id="lightbox-title" className={styles.bylineHeading}>
          {byline ? `${byline} on Instagram` : 'Instagram'}
        </h1>
        <p className={styles.captionBody}>{caption}</p>
        <div className={styles.metaCtaGroup}>
          {meta && <div className={styles.meta}><span>{meta}</span></div>}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.sourceLink}
            onClick={(e): void => e.stopPropagation()}
          >
            {t('board.lightbox.openSource')} →
          </a>
        </div>
      </>
    )
  }

  return (
    <>
      {!hideTitle && <h1 id="lightbox-title" className={styles.title}>{item.title}</h1>}
      {item.description && <p className={styles.description}>{item.description}</p>}
      <div className={styles.metaCtaGroup}>
        <div className={styles.meta}>{host && <span>{host}</span>}</div>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.sourceLink}
          onClick={(e): void => e.stopPropagation()}
        >
          {t('board.lightbox.openSource')} →
        </a>
      </div>
    </>
  )
}

/** Left-column media for a tweet, driven by the unified mediaSlots[] array.
 *  Each slot renders either an inline `<TweetVideoPlayer>` (type='video') or a
 *  plain `<img>` (type='photo'). When the user swaps slot index, the parent
 *  Lightbox's effect (see "auto-pause on slot change") forces any playing
 *  video to pause before unmount.
 *
 *  Falls back to legacy code paths for non-slot inputs:
 *    - meta.videoUrl exists but slots is empty → single-video tweet (rare:
 *      mediaSlots resolution failed but meta still has a videoUrl)
 *    - photos only via meta.photoUrl → single-image tweet
 *    - meta.text → text-only tweet
 *
 *  Note: dots are rendered at the .frame level (sibling of .media), NOT
 *  inside this component — see I-07-#4 fix.
 */
function TweetMedia({
  item,
  meta,
  slots,
  slotIdx,
}: {
  readonly item: LightboxItem
  readonly meta: TweetMeta | null
  readonly slots: readonly MediaSlot[]
  readonly slotIdx: number
}): ReactNode {
  // Slot-driven path (v13): a non-empty slots array fully determines media.
  if (slots.length > 0) {
    const slot = slots[Math.min(slotIdx, slots.length - 1)]
    if (slot.type === 'video' && slot.videoUrl) {
      // Point the shared player at THIS slot's mp4 + poster + aspect (mix
      // tweets can have multiple slots; the carousel index picks one).
      return (
        // key by slot index so swapping images within ONE multi-media tweet
        // remounts the <video>. Card-to-card remount is handled by the keyed
        // <TweetMedia key={view.url}> upstream.
        <TweetVideoEmbed
          key={`slot-${slotIdx}`}
          item={{ url: item.url, title: item.title, thumbnail: item.thumbnail ?? undefined, mediaSlots: slots }}
          source={{ videoUrl: slot.videoUrl, posterUrl: slot.url, aspect: slot.aspect }}
          variant="lightbox"
        />
      )
    }
    if (slot.type === 'photo') {
      return <img src={slot.url} alt={item.title} />
    }
  }

  // Text-only tweet を最優先で判定 (= session 32 Fix 2-b)。 X の syndication API
  // は profile pic / embedded card preview を photoUrl に入れて返すことがあるので、
  // photoUrl 真値の有無では判定せず、 hasPhoto / hasVideo フラグで text-only を確定する。
  if (isTweetTextOnly(meta, slots)) {
    // Session 52 (B-#22 follow-up): use item.title (= the same source the
    // board's TextCard renders) instead of meta.text. The board and the
    // Lightbox both flow this through cleanTitle + pickTitleTypography, so
    // identical input guarantees identical font / line-clamp output and
    // the FLIP open animation morphs between two card visuals with the
    // same typography (no font jump on open). When item.title is empty
    // for some reason, fall back to meta.text or the cleaned title path
    // for legacy data. Full-text legibility is delivered via the tweet
    // backfill (= updates item.title with meta.text after fetch).
    const text = item.title || meta?.text || cleanTweetTitle(item.title ?? '')
    const aspect = item.aspectRatio ?? PLACEHOLDER_ASPECT
    const fakeBoardItem: BoardItem = {
      bookmarkId: item.bookmarkId ?? item.url,
      cardId: item.cardId ?? item.url,
      title: text,
      description: item.description ?? undefined,
      thumbnail: undefined,
      url: item.url,
      aspectRatio: aspect,
      gridIndex: 0,
      orderIndex: 0,
      cardWidth: item.cardWidth ?? 280,
      customCardWidth: false,
      isRead: false,
      isDeleted: false,
      tags: [],
      displayMode: null,
    }
    // session 37 phase 3 + session 88 PlaceholderCard 統合: text-only tweet も
    // 非ツイートのテキストカードと同じ LargePlaceholderCardScaler 経路。 board の
    // PlaceholderCard と media が同じ component (= PlaceholderCard + omitMeta=true)
    // になるので、 open swap の瞬間に font / hostname jump が原理的に消える。
    return <LargePlaceholderCardScaler fakeItem={fakeBoardItem} aspect={aspect} />
  }

  // Legacy fallbacks — slots が空 + hasPhoto/hasVideo は true のケース。
  if (meta?.videoUrl) {
    return (
      <TweetVideoEmbed
        item={{ url: item.url, title: item.title, thumbnail: item.thumbnail ?? undefined }}
        source={{ videoUrl: meta.videoUrl, posterUrl: meta.videoPosterUrl ?? item.thumbnail ?? undefined, aspect: meta.videoAspectRatio }}
        variant="lightbox"
      />
    )
  }
  if (meta?.photoUrl) {
    return <img src={meta.photoUrl} alt={item.title} />
  }
  // meta 失敗 + thumbnail だけ残ってる稀ケース。
  if (item.thumbnail) {
    return <img src={item.thumbnail} alt={item.title} />
  }
  return <div className={styles.placeholder}>{item.title}</div>
}

/** X の OGP `og:title` は "Xユーザーの 〜 さん:「本文」 / X" のような
 *  boilerplate 付き format。 syndication API が meta.text を返さなかった時の
 *  fallback で item.title を素のまま表示すると boilerplate が出てしまうので、
 *  「」 内の本文だけ抜き出す。 match しない (= 旧 format 等) はそのまま返す。
 *
 *  「」 マッチは `さん[:：]` 直後限定 (B-#22 regression fix)。 ユーザー本文中の
 *  引用 「...」 を boilerplate 誤検知して冒頭・末尾を消す bug を防ぐ。 詳細は
 *  `lib/embed/clean-title.ts` の同種 fix を参照。 */
function cleanTweetTitle(rawTitle: string): string {
  const m = rawTitle.match(/さん[:：]\s*「([\s\S]+)」/)
  if (m) return m[1].trim()
  return rawTitle
}

/** Tweet が 「文字だけ」 か。 photoUrl / videoUrl 単独では信頼できない —
 *  X の syndication API は profile pic / embedded card preview を photoUrl に
 *  入れて返すことがあり、 「写真ツイートではない」 のに URL だけ存在するケースが
 *  ある。 hasPhoto / hasVideo は X の正規 boolean フラグなのでこちらを真の指標と
 *  する。 slots (v13 media slots) が空 AND hasPhoto/hasVideo が false なら
 *  text-only と確定。 TweetMedia と TweetText の両方で同じ判定を共有する。 */
function isTweetTextOnly(meta: TweetMeta | null, slots: readonly MediaSlot[]): boolean {
  if (slots.length > 0) return false
  if (meta?.hasVideo) return false
  if (meta?.hasPhoto) return false
  return true
}

/** Right panel の tweet body を抑制するか。
 *
 *  Session 55 (A 番 fix): 「全 tweet 本文非表示」 だった session 52 判断を撤回し、
 *  ツイート種別ごとに表示要否を判定する。 user 報告 (= 画像 + 本文ツイートで本文が
 *  行方不明 bug) の root cause が session 52 の一律非表示だったため。
 *
 *  - text-only tweet: 本文は左カラムの LargePlaceholderCardScaler が描画済みなので、
 *    右カラム本文は重複 → 非表示維持 (= session 52 の正当な部分は残す)
 *  - media tweet で meta 未到着: 本文 fallback の item.title は OGP boilerplate
 *    (「Xユーザーの〜さん:「本文」 / X」) を含む生文字列なので、 syndication API
 *    fetch 完了まで body は隠す
 *  - media tweet で meta.text が空 (= 画像のみツイート / 動画のみツイート):
 *    空 `<p>` を出さない
 *  - それ以外 (= media + 本文あり): 右カラムに本文表示 = 新規 (= session 52 以前 + 改良) */
function shouldHideTweetBody(meta: TweetMeta | null, slots: readonly MediaSlot[]): boolean {
  if (isTweetTextOnly(meta, slots)) return true
  if (!meta) return true
  const text = (meta.text ?? '').trim()
  if (text === '') return true
  return false
}

/** Dot indicator for Lightbox carousel. Larger and more clickable than the
 *  board-side card dots — these are the primary nav mechanism (along with
 *  keyboard ↑↓). Video slots render as a ▶ triangle to communicate
 *  "this slot contains a video" without us needing a separate badge.
 *  I-07 Phase 1 + mix-tweet (v13). */
function LightboxImageDots({
  slots,
  currentIdx,
  onJump,
}: {
  readonly slots: readonly MediaSlot[]
  readonly currentIdx: number
  readonly onJump: (idx: number) => void
}): ReactNode {
  return (
    <div className={styles.lightboxImageDots} role="tablist" aria-label="メディア切替">
      {slots.map((slot, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === currentIdx}
          aria-label={slot.type === 'video'
            ? `動画 ${i + 1} / ${slots.length}`
            : `画像 ${i + 1} / ${slots.length}`}
          data-active={i === currentIdx ? 'true' : 'false'}
          data-slot-type={slot.type}
          className={styles.lightboxImageDot}
          onClick={(): void => onJump(i)}
        />
      ))}
    </div>
  )
}

/** Right-column text panel for a tweet: avatar + author name + handle, then
 *  the full tweet body. Renders item-level fallbacks (title) until syndication
 *  metadata arrives, so the panel never flashes empty. */
function TweetText({
  item,
  meta,
  hideBody = false,
}: {
  readonly item: LightboxItem
  readonly meta: TweetMeta | null
  /** Suppress the tweet body paragraph when text-only tweets render their
   *  text inside the left-side large TextCard (session 32 Fix 2). */
  readonly hideBody?: boolean
}): ReactNode {
  const authorName = meta?.authorName ?? ''
  const authorHandle = meta?.authorHandle ?? ''
  const text = meta?.text ?? item.title
  return (
    <>
      {(authorName || authorHandle || meta?.authorAvatar) && (
        <div className={styles.tweetAuthor}>
          {meta?.authorAvatar && (
            <img
              src={meta.authorAvatar}
              alt={authorName || authorHandle}
              className={styles.tweetAvatar}
            />
          )}
          <div className={styles.tweetAuthorMeta}>
            {authorName && <div className={styles.tweetAuthorName}>{authorName}</div>}
            {authorHandle && <div className={styles.tweetAuthorHandle}>@{authorHandle}</div>}
          </div>
        </div>
      )}
      {!hideBody && <p className={styles.tweetBody}>{text}</p>}
      <div className={styles.metaCtaGroup}>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.sourceLink}
          onClick={(e): void => e.stopPropagation()}
        >
          {t('board.lightbox.openSource')} →
        </a>
      </div>
    </>
  )
}

function LightboxMedia({ item }: { readonly item: LightboxItem }): ReactNode {
  // Embed components were typed against BoardItem's `string | undefined`
  // thumbnail. LightboxItem normalizes to `string | null`, so we coerce
  // here rather than weakening the embeds' prop types.
  const thumb = item.thumbnail ?? undefined
  // Board card's persisted aspect. Embeds render their pre-play poster at
  // this aspect so the lightbox grows the *same shape* the user clicked on,
  // hiding the clone→media swap (B-#17-#2). Undefined for share view.
  const aspectRatio = item.aspectRatio

  // The shared media-players registry is the single source of truth for
  // "which player renders this item" — the same one the board uses. It
  // handles youtube / tiktok / vimeo / soundcloud here (tweets render via
  // TweetMedia upstream, not LightboxMedia; mediaSlots is therefore omitted).
  // Output is identical to the old per-platform switch.
  const player = resolveLightboxPlayer({
    url: item.url,
    title: item.title,
    thumbnail: thumb,
    aspectRatio,
    mediaSlots: undefined,
  })
  if (player) return player

  // Instagram is a link-out affordance (not an inline-playable registry
  // entry), so it stays here after the registry returns null.
  if (detectUrlType(item.url) === 'instagram') {
    const shortcode = extractInstagramShortcode(item.url)
    if (shortcode) return <InstagramEmbed shortcode={shortcode} thumbnail={thumb} title={item.title} aspectRatio={aspectRatio} />
  }

  // 一般 webpage (= youtube / tiktok / instagram / tweet を除く)。
  // session 34: board と mirror 化。 thumbnail があれば Lightbox でも image
  // 表示 (= LightboxImageWithFallback)、 image load 失敗 / 256px 未満なら
  // TextCard に fallback。 thumbnail 自体無いなら最初から TextCard。
  // (session 32 の「全部 TextCard」 判断を覆して board ImageCard / TextCard と
  // 同じ routing に揃える。)
  const textAspect = aspectRatio ?? PLACEHOLDER_ASPECT
  // session 35: cardWidth は toBoardShapeForFallback の `item.cardWidth ?? 280` を
  // 使う (= source board card の実 width)。 以前ここに `cardWidth: 280` 上書きが
  // あり、 source typography (source 実 width で選択) と .media typography (280 で
  // 選択) が tier 不一致になって swap で font ジャンプしていた。 上書き削除で
  // source の実 width を素通し → animation clone と .media が同じ typography で
  // 揃う = jump 消失。
  const fakeBoardItem: BoardItem = {
    ...toBoardShapeForFallback(item, textAspect),
    title: cleanTitle(item.title, item.url),
  }
  if (item.thumbnail) {
    return (
      <LightboxImageWithFallback
        item={item}
        aspectRatio={aspectRatio}
        fakeBoardItem={fakeBoardItem}
        textAspect={textAspect}
      />
    )
  }
  return <LargePlaceholderCardScaler fakeItem={fakeBoardItem} aspect={textAspect} />
}

/** 右パネルで h1 を抑制すべきか — Lightbox で左に大 TextDisplay を描画する
 *  item では h1 と左カードの title が重複するので suppress。 session 32 user 決定:
 *  一般 webpage は OG image 有無に関わらず全部大 TextDisplay → 常に true。
 *  専用 embed (YouTube/TikTok/Instagram) と tweet は別経路なので false。 */
function shouldRenderLargePlaceholderCard(item: LightboxItem): boolean {
  const urlType = detectUrlType(item.url)
  if (urlType === 'youtube' || urlType === 'tiktok' || urlType === 'instagram') return false
  if (urlType === 'vimeo' || urlType === 'soundcloud') return false
  if (urlType === 'tweet') return false
  return true
}

/** Lightbox 用に LightboxItem を BoardItem 互換形に詰め直す。 pickCard 判定と
 *  大 TextCard 描画の両方で同じ fake item を使う。 cardWidth は board 側で
 *  rendering されていたものをそのまま保ち、 Lightbox 側で transform:scale して
 *  拡大表示することで「写真のように board card を拡大」 (session 32) を実現。 */
function toBoardShapeForFallback(item: LightboxItem, aspectRatio: number): BoardItem {
  return {
    bookmarkId: item.bookmarkId ?? item.url,
    cardId: item.cardId ?? item.url,
    title: item.title,
    description: item.description ?? undefined,
    thumbnail: item.thumbnail ?? undefined,
    url: item.url,
    aspectRatio,
    gridIndex: 0,
    orderIndex: 0,
    cardWidth: item.cardWidth ?? 280,
    customCardWidth: false,
    isRead: false,
    isDeleted: false,
    tags: [],
    displayMode: null,
  }
}

/** user 提案 (session 32) の clone 案: board の source card を cloneNode で
 *  そのままコピーし、 `.imageBox` の中に置いて transform:scale で拡大表示する。
 *  「写真のように board card を拡大」 を pixel identical で実現。 source card が
 *  DOM にない (= share view 等) 場合は LargePlaceholderCardScaler に fallback。
 *  inner の `--card-radius` を 0 上書きして、 scale で TextCard root の radius
 *  が拡大される問題 (= user 「丸さすら違う」 報告) を回避 — 視覚 radius は
 *  outer .imageBox の var(--lightbox-media-radius) と overflow:hidden で確定する。 */
function LargeBoardCardClone({
  item,
  fakeItem,
  aspect,
}: {
  readonly item: LightboxItem
  readonly fakeItem: BoardItem
  readonly aspect: number
}): ReactElement {
  const boxRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [useFallback, setUseFallback] = useState<boolean>(false)

  useLayoutEffect(() => {
    if (useFallback) return
    const box = boxRef.current
    const inner = innerRef.current
    if (!box || !inner) return

    const bookmarkId = item.bookmarkId
    if (!bookmarkId) { setUseFallback(true); return }
    const source = document.querySelector<HTMLElement>(`[data-bookmark-id="${bookmarkId}"]`)
    if (!source) { setUseFallback(true); return }

    const sourceRect = source.getBoundingClientRect()
    const boardW = sourceRect.width
    const boardH = sourceRect.height
    if (boardW <= 0 || boardH <= 0) { setUseFallback(true); return }

    const clone = source.cloneNode(true) as HTMLElement
    clone.style.cssText = ''
    clone.style.position = 'absolute'
    clone.style.top = '0'
    clone.style.left = '0'
    clone.style.width = `${boardW}px`
    clone.style.height = `${boardH}px`
    clone.style.margin = '0'
    clone.style.visibility = 'visible'
    clone.style.transformOrigin = 'top left'
    clone.style.pointerEvents = 'none'
    clone.style.setProperty('--card-radius', '0')
    inner.appendChild(clone)

    // hover-revealed chrome を strip (= open animation clone と同じ)。
    const SELECTORS_TO_STRIP = [
      '[data-testid="card-delete-button"]',
      '[data-testid="card-reset-size-button"]',
      '[data-testid^="resize-handle-"]',
    ]
    for (const sel of SELECTORS_TO_STRIP) {
      clone.querySelectorAll(sel).forEach((n) => n.remove())
    }

    const update = (): void => {
      const w = box.offsetWidth
      if (w <= 0) return
      const scale = w / boardW
      clone.style.transform = `scale(${scale})`
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(box)

    return (): void => {
      observer.disconnect()
      clone.remove()
    }
  }, [item.bookmarkId, useFallback])

  if (useFallback) {
    return <LargePlaceholderCardScaler fakeItem={fakeItem} aspect={aspect} />
  }

  return (
    <div
      ref={boxRef}
      className={styles.imageBox}
      style={{ ['--item-aspect' as string]: aspect } as React.CSSProperties}
    >
      <div ref={innerRef} style={{ position: 'relative', width: '100%', height: '100%' }} />
    </div>
  )
}

/** share view 等で source card DOM が無いとき用の fallback。 board と同じ
 *  cardWidth で TextCard を再描画 + ResizeObserver で wrapper scale。
 *  session 36: boardW は source DOM の **実 rendering width** を `getBoundingClientRect()`
 *  で実測する。 fakeItem.cardWidth は IDB 保存値 (= user resize していなければ default
 *  280) で、 size slider で全体 width が変わっているケース (tier 1=200 等) では
 *  実 rendering width と一致しない。 一致しない状態で TextCard 再描画すると、
 *  typography mode (= pickTitleTypography の cardWidth ベース判定) が swap 瞬間に
 *  変わって title 「かくっ」 jump を生む (session 36 調査で根本原因と判明)。
 *  source DOM が無い (share view / culling) ときは fakeItem.cardWidth に fallback。 */
function LargePlaceholderCardScaler({
  fakeItem,
  aspect,
}: {
  readonly fakeItem: BoardItem
  readonly aspect: number
}): ReactElement {
  const boxRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const boardW = useMemo<number>(() => {
    if (typeof document === 'undefined') return fakeItem.cardWidth
    const source = document.querySelector<HTMLElement>(`[data-bookmark-id="${fakeItem.bookmarkId}"]`)
    if (!source) return fakeItem.cardWidth
    const w = source.getBoundingClientRect().width
    return w > 0 ? w : fakeItem.cardWidth
  }, [fakeItem.bookmarkId, fakeItem.cardWidth])
  const boardH = boardW / aspect

  useLayoutEffect(() => {
    const box = boxRef.current
    const inner = innerRef.current
    if (!box || !inner) return
    const update = (): void => {
      const w = box.offsetWidth
      if (w <= 0) return
      const scale = w / boardW
      // session 35: transform:scale → zoom。 transform:scale は raster blur (= 文字
      // 「画質荒い」 user 報告)、 zoom は browser が再レイアウト + 文字 crisp 再描画。
      inner.style.zoom = `${scale}`
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(box)
    return (): void => observer.disconnect()
  }, [boardW])

  return (
    <div
      ref={boxRef}
      className={styles.imageBox}
      style={{ ['--item-aspect' as string]: aspect } as React.CSSProperties}
    >
      <div
        ref={innerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${boardW}px`,
          height: `${boardH}px`,
          // session 56 Step 1: session 34 当時の `--card-radius: '0'` 上書きを撤廃。
          // 当時は --card-radius=24px / --lightbox-media-radius=20px の不一致対策
          // だったが、 session 22 で両方 20px に揃ったので不要。 inner は :root から
          // --card-radius:20px を継承し、 zoom 後の視覚 radius が board と同じ proportion
          // (= 50px 視覚) になる。 結果として ::before の枠線が 4 隅まで連続する。
          // 副作用: 外 .imageBox の 20px clip と中 body の 50px curve の差で角に三日月の
          // 透けゾーンが出る可能性あり (= 実機確認待ち)。
        } as React.CSSProperties}
      >
        <PlaceholderCard
          item={fakeItem}
          cardWidth={boardW}
          cardHeight={boardH}
          displayMode="visual"
        />
      </div>
    </div>
  )
}

/** ImageCard 経路で thumbnail を <img> 描画するが、 load 失敗時 OR load 成功
 *  しても image が小さすぎる (= favicon / icon サイズ) 場合は大 PlaceholderCard へ
 *  fallback する。 board の ImageCard が PlaceholderCard に落ちる挙動と等価 +
 *  Lightbox 拡大時に荒い favicon が巨大表示される問題への対策。 */
function LightboxImageWithFallback({
  item,
  aspectRatio,
  fakeBoardItem,
  textAspect,
}: {
  readonly item: LightboxItem
  readonly aspectRatio: number | undefined
  readonly fakeBoardItem: BoardItem
  readonly textAspect: number
}): ReactElement {
  const [shouldFallback, setShouldFallback] = useState<boolean>(false)
  const handleError = useCallback((): void => { setShouldFallback(true) }, [])
  // 256px 未満の image は favicon / icon サイズと判定して TextCard fallback。
  // Lightbox の .media は 600px 強の幅で描画するため、 256px 未満を拡大すると
  // 露骨に荒くなる (user 報告の「巨大な荒い favicon」 の根本原因)。
  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>): void => {
      const img = e.currentTarget
      if (img.naturalWidth > 0 && img.naturalHeight > 0
        && img.naturalWidth < 256 && img.naturalHeight < 256) {
        setShouldFallback(true)
      }
    },
    [],
  )

  if (shouldFallback) {
    return <LargePlaceholderCardScaler fakeItem={fakeBoardItem} aspect={textAspect} />
  }
  if (aspectRatio) {
    return (
      <div
        className={styles.imageBox}
        style={{ ['--item-aspect' as string]: aspectRatio } as React.CSSProperties}
      >
        <img src={item.thumbnail!} alt={item.title} onError={handleError} onLoad={handleLoad} />
      </div>
    )
  }
  return <img src={item.thumbnail!} alt={item.title} onError={handleError} onLoad={handleLoad} />
}
