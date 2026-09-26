import { E, clamp01, isPress, lerp, wp } from './motion-math'
import { masonry, type MasonryLayout } from './masonry'
import type { CardSpec, Pt } from './types'

export type FeatureTag = 'life' | 'music' | 'design'
export type FeatureCardSpec = CardSpec & { readonly tag: FeatureTag }

/** 機能紹介ボードのカード。順番に意味がある: 0=01で保存されて入る / 1=03で再生される動画 / 2=02でドラッグされる / 3=03で静止画が切り替わる動画。 */
export const FEATURE_CARDS: readonly FeatureCardSpec[] = [
  { tweet: 1, a: 1, tag: 'life' },
  { art: 'film', a: 16 / 9, tag: 'music' },
  { art: 'swiss', a: 3 / 4, tag: 'design' },
  { art: 'halftone3', a: 3 / 4, tag: 'design' },
  { art: 'truchet', a: 1, tag: 'design' },
  { tweet: 3, a: 1, tag: 'life' },
  { art: 'bars', a: 4 / 5, tag: 'music' },
  { art: 'tag', a: 3 / 4, tag: 'life' },
  { art: 'grid', a: 4 / 5, tag: 'design' },
  { art: 'vinyl', a: 1, tag: 'music' },
]
export const CARD_NEW = 0
export const CARD_FILM = 1
export const CARD_DRAG = 2
export const CARD_SLIDES = 3

export type FeatureLayouts = { A: MasonryLayout; B: MasonryLayout; C: MasonryLayout; D: MasonryLayout; E: MasonryLayout }

/** A=保存前 / B=保存後 / C=ドラッグ後 / D=music だけ / E=design だけ。 */
export function featureLayouts(W: number): FeatureLayouts {
  const n = W < 460 ? 2 : W < 760 ? 3 : 4
  const gap = W < 460 ? 8 : 10
  const oA = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  const oB = [CARD_NEW, ...oA]
  const oC = oB.filter((i) => i !== CARD_DRAG)
  oC.splice(5, 0, CARD_DRAG)
  const only = (t: FeatureTag): number[] => oC.filter((i) => FEATURE_CARDS[i].tag === t)
  return {
    A: masonry(FEATURE_CARDS, oA, W, n, gap),
    B: masonry(FEATURE_CARDS, oB, W, n, gap),
    C: masonry(FEATURE_CARDS, oC, W, n, gap),
    D: masonry(FEATURE_CARDS, only('music'), W, n, gap),
    E: masonry(FEATURE_CARDS, only('design'), W, n, gap),
  }
}

export type PillBox = { x: number; w: number }

/** 配置の計算時だけ測る値(スクロール中は測らない)。座標はパネル内。 */
export type FeatureGeometry = {
  L: FeatureLayouts
  /** ボード(fboard)の幅・高さと、パネル内でのボード枠(fbw)の左上。 */
  bw: number
  bh: number
  bx: number
  by: number
  /** 06 で画像になる時の縮み量(広い画面 .2 / 幅 560 未満 .28)。 */
  shotK: number
  pills: { all: PillBox; music: PillBox; design: PillBox }
  to: { motion: Pt; share: Pt; music: Pt; design: Pt; start: Pt; copy: Pt; rest: Pt }
}

export type CardVisual = { x: number; y: number; scale: number; opacity: number; visible: boolean }

export type FeatureState = {
  seg: number
  f: number
  cards: CardVisual[]
  /** 02 でつまんだカードの浮き(0..1)。 */
  lift: number
  newOnTop: boolean
  /** 03 で再生中の動画カードの強調(0..1)。静止画が切り替わる動画の ▶ 印の不透明度にも使う。 */
  focus: number
  playing: boolean
  motionOn: boolean
  cursor: { x: number; y: number; opacity: number; pressed: boolean }
  ring: { x: number; y: number; opacity: number; scale: number } | null
  pastePress: boolean
  pasteDone: boolean
  pillsOpacity: number
  underline: PillBox
  activeTag: 'all' | 'music' | 'design'
  startOpacity: number
  startWipe: number
  startVisible: boolean
  startPress: boolean
  frameT: number
  frameOpacity: number
  chipOpacity: number
  flash: number
  shot: number
  boardScale: number
  chipsT: number
  copied: boolean
  sharePress: boolean
  rail: number
}

export function featState(Pin: number, g: FeatureGeometry): FeatureState {
  const P = Math.max(0, Math.min(6, Pin))
  let seg = 0
  let f = 0
  if (P > 0) { seg = Math.min(5, Math.ceil(P) - 1); f = P - seg }
  /* 段落が切り替わった直後から動き出し、最後の2割は止めて見せる */
  f = clamp01((f - 0.08) / 0.72)
  const { A, B, C, D, E: EL } = g.L
  const n = FEATURE_CARDS.length
  const pos: Pt[] = new Array<Pt>(n)
  const op: number[] = new Array<number>(n).fill(1)
  const sc: number[] = new Array<number>(n).fill(1)
  const cw = A.cw
  const R = g.to.rest
  const slot = (L: MasonryLayout, i: number): Pt => ({ x: L.slots[i].x, y: L.slots[i].y })
  const mix = (L1: MasonryLayout, L2: MasonryLayout, i: number, t: number): Pt => ({
    x: lerp(L1.slots[i].x, L2.slots[i].x, t),
    y: lerp(L1.slots[i].y, L2.slots[i].y, t),
  })
  let lift = 0, curOp = 0, clickT = -1, pillsOp = 0, frameT = 0, frameOp = 0, chipOp = 0
  let shot = 0, chipsT = 0, dim = 0, focus = 0, ua = 0, ub = 0, startOp = 0, startWipe = 0, flash = 0
  let cur: Pt | null = null
  let motionOn = seg < 2, pastePress = false, pasteDone = false, sharePress = false, startPress = false, copied = false, playing = false

  if (seg === 0) {
    const t = E(f, 0.12, 0.85)
    for (let i = 1; i < n; i++) pos[i] = mix(A, B, i, t)
    const b0 = B.slots[0]
    pos[0] = { x: lerp(g.bw / 2 - cw / 2, b0.x, t), y: lerp(-cw * 0.9, b0.y, t) }
    op[0] = E(f, 0.12, 0.3)
    sc[0] = lerp(0.55, 1, t)
    pastePress = f > 0.03 && f < 0.1
    pasteDone = f > 0.5
  } else if (seg === 1) {
    const t1 = E(f, 0.22, 0.8)
    for (let i = 0; i < n; i++) pos[i] = mix(B, C, i, t1)
    lift = E(f, 0.1, 0.2) * (1 - E(f, 0.8, 0.9))
    sc[CARD_DRAG] = 1 + 0.035 * lift
    curOp = E(f, 0, 0.08) * (1 - E(f, 0.88, 0.98))
    const c2 = pos[CARD_DRAG]
    const g1 = E(f, 0, 0.18)
    cur = { x: g.bx + lerp(g.bw * 0.92, c2.x + cw * 0.5, g1), y: g.by + lerp(g.bh * 0.92, c2.y + cw * 0.45, g1) }
  } else if (seg === 2) {
    /* 1本が本当に再生され、ほかの動画は静止画が切り替わる → カーソルが MOTION を押すと全部止まる */
    for (let i = 0; i < n; i++) pos[i] = slot(C, i)
    playing = f > 0.04 && f < 0.66
    motionOn = f < 0.66
    focus = E(f, 0.02, 0.1) * (1 - E(f, 0.7, 0.8))
    dim = 0.4 * focus
    sc[CARD_FILM] = 1 + 0.03 * focus
    curOp = E(f, 0.38, 0.44) * (1 - E(f, 0.8, 0.9))
    cur = wp(f, [[0.38, R.x, R.y], [0.6, g.to.motion.x, g.to.motion.y]])
    clickT = 0.64
  } else if (seg === 3) {
    /* カーソルが music → design を順に押す */
    pillsOp = E(f, 0, 0.1)
    curOp = E(f, 0.02, 0.08) * (1 - E(f, 0.82, 0.92))
    cur = wp(f, [[0.02, R.x, R.y], [0.16, g.to.music.x, g.to.music.y], [0.42, g.to.music.x, g.to.music.y], [0.56, g.to.design.x, g.to.design.y]])
    clickT = f < 0.4 ? 0.18 : 0.58
    ua = E(f, 0.19, 0.3)
    ub = E(f, 0.59, 0.7)
    const mo = E(f, 0.2, 0.32), mm = E(f, 0.3, 0.48), no = E(f, 0.6, 0.7), nn = E(f, 0.68, 0.88)
    for (let i = 0; i < n; i++) {
      const tg = FEATURE_CARDS[i].tag
      if (tg === 'music') { pos[i] = mix(C, D, i, mm); op[i] = 1 - no; sc[i] = 1 - 0.05 * no }
      else if (tg === 'design') { pos[i] = no > 0 ? slot(EL, i) : slot(C, i); op[i] = no > 0 ? nn : 1 - mo; sc[i] = no > 0 ? 0.95 + 0.05 * nn : 1 - 0.05 * mo }
      else { pos[i] = slot(C, i); op[i] = 1 - mo; sc[i] = 1 - 0.05 * mo }
    }
  } else if (seg === 4) {
    /* 入口の画面で「ボードを開く」を押すだけ → 登録画面なしでボードが開く → このブラウザに保存 */
    const bk = E(f, 0.04, 0.18), fi = E(f, 0.1, 0.24)
    pillsOp = 1 - E(f, 0, 0.1)
    ua = 1
    ub = 1
    for (let i = 0; i < n; i++) {
      if (FEATURE_CARDS[i].tag === 'design') pos[i] = mix(EL, C, i, bk)
      else { pos[i] = slot(C, i); op[i] = fi; sc[i] = 0.95 + 0.05 * fi }
    }
    startOp = E(f, 0, 0.12)
    startWipe = E(f, 0.44, 0.58)
    curOp = E(f, 0.14, 0.2) * (1 - E(f, 0.58, 0.68))
    cur = wp(f, [[0.14, R.x, R.y], [0.34, g.to.start.x, g.to.start.y]])
    clickT = 0.4
    startPress = isPress(f, 0.4)
    frameT = E(f, 0.6, 0.82)
    frameOp = 1
    chipOp = E(f, 0.76, 0.9)
  } else {
    /* カーソルが SHARE を押す → ボードが1枚の画像に → 「リンクをコピー」を押す */
    for (let i = 0; i < n; i++) pos[i] = slot(C, i)
    frameT = 1
    frameOp = 1 - E(f, 0, 0.1)
    chipOp = frameOp
    curOp = E(f, 0.02, 0.08) * (1 - E(f, 0.86, 0.95))
    cur = wp(f, [[0.02, R.x, R.y], [0.16, g.to.share.x, g.to.share.y], [0.5, g.to.share.x, g.to.share.y], [0.7, g.to.copy.x, g.to.copy.y]])
    clickT = f < 0.5 ? 0.2 : 0.74
    sharePress = isPress(f, 0.2)
    flash = Math.sin(Math.PI * clamp01((f - 0.22) / 0.08))
    shot = E(f, 0.24, 0.46)
    chipsT = E(f, 0.46, 0.56)
    copied = f > 0.76
  }

  const cards: CardVisual[] = FEATURE_CARDS.map((_, i) => {
    const o = op[i] * (i === CARD_FILM || i === CARD_SLIDES ? 1 : 1 - dim)
    return { x: pos[i].x, y: pos[i].y, scale: sc[i], opacity: o, visible: o >= 0.01 }
  })
  const rp = clickT >= 0 && cur ? clamp01((f - clickT) / 0.07) : 0
  const ring = cur && rp > 0 && rp < 1 ? { x: cur.x, y: cur.y, opacity: 1 - rp, scale: 0.4 + 1.3 * rp } : null
  const pa = g.pills
  return {
    seg, f, cards, lift, newOnTop: seg === 0, focus, playing, motionOn,
    cursor: { x: cur ? cur.x : 0, y: cur ? cur.y : 0, opacity: curOp, pressed: lift > 0.5 || (clickT >= 0 && isPress(f, clickT)) },
    ring, pastePress, pasteDone, pillsOpacity: pillsOp,
    underline: { x: lerp(lerp(pa.all.x, pa.music.x, ua), pa.design.x, ub), w: lerp(lerp(pa.all.w, pa.music.w, ua), pa.design.w, ub) },
    activeTag: ub >= 0.5 ? 'design' : ua >= 0.5 ? 'music' : 'all',
    startOpacity: startOp, startWipe, startVisible: startOp > 0.01 && startWipe < 0.999, startPress,
    frameT, frameOpacity: frameOp, chipOpacity: chipOp,
    flash, shot, boardScale: 1 - g.shotK * shot, chipsT, copied, sharePress,
    rail: P / 6,
  }
}

/** 固定区間の進み(0..1)→ P(0..6)。見本と同じずらし(-0.2)と伸ばし(6.6)。 */
export function featTarget(progress: number): number { return Math.max(0, Math.min(6, progress * 6.6 - 0.2)) }
