import { E, clamp01, isPress, lerp, wp } from './motion-math'
import { masonry, type MasonryLayout } from './masonry'
import type { CardSpec, Pt } from './types'

/* ── 追従: スクロールが決める目標 P に、表示する P が追いつく速さ ──
   目で追える速さを保ちつつ、遅れすぎて 06(SHARE → 画像 → リンクをコピー)が
   出ないまま区画が終わることがないようにする。数字を変えるのはここだけ。 */
/** 1フレームで詰める割合 = 1 − exp(−dt / この値)。フレームレートに依らず同じ手触りにするための時定数(ms)。 */
export const FEAT_FOLLOW_TAU_MS = 200
/** 遅れが小さいうちの速さの上限(段/秒)。デモを 1 段 1.25 秒より速くは進めない = 目で追える速さ。 */
export const FEAT_SPEED_BASE = 0.8
/** 遅れ(段)がこの値以下なら、速さの上限は FEAT_SPEED_BASE のまま。 */
export const FEAT_LAG_FREE = 0.35
/** 遅れが FEAT_LAG_FREE を 1 段超えるごとに、上限を何段/秒ずつ引き上げるか。速く回した時も遅れが 0.5 段前後で頭打ちになり、すぐ追いつく。 */
export const FEAT_SPEED_GAIN = 2.5
/** 1フレームの dt の上限(ms)。タブ復帰などの長い空白で一気に跳ばない。 */
export const FEAT_DT_MAX_MS = 64

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

/** カーソルが操作する対象。ホバー表示・カーソルの行き先の両方でこの名前を使う。 */
export type FeatureHover = 'motion' | 'share' | 'music' | 'design' | 'start' | 'copy'

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
  /** カーソル画像の左上から先端(クリック位置)までのずらし量。大きさに比例する(cursorTip)。 */
  tip: Pt
  /** カーソルの行き先(各対象の中心)。 */
  to: Record<FeatureHover, Pt>
}

/** カーソル画像(viewBox 24)の左上から先端(5, 2.5)までのずらし量。画像の大きさ size(px)に比例させ、先端を指す座標にぴったり合わせる。 */
export function cursorTip(size: number): Pt {
  return { x: (size * 5) / 24, y: (size * 2.5) / 24 }
}

/**
 * カーソルの操作の拍(段内の進み f)。arrive=対象の上に着く / click=押す。
 * 移動の到着・押す時刻・ホバー表示の3つが同じ値を見るので、ずれない。
 */
type Beat = { readonly arrive: number; readonly click: number }
const BEAT: Record<FeatureHover, Beat> = {
  motion: { arrive: 0.6, click: 0.7 }, // 03
  music: { arrive: 0.24, click: 0.33 }, // 04 前半
  design: { arrive: 0.66, click: 0.75 }, // 04 後半
  start: { arrive: 0.36, click: 0.45 }, // 05
  share: { arrive: 0.24, click: 0.33 }, // 06 前半
  copy: { arrive: 0.8, click: 0.89 }, // 06 後半
}

/** ホバー表示の窓: 対象の上に着いてから、押し込み(isPress)が始まる直前まで。通過中・押している間・押した後・離れた後は false。 */
function isHover(f: number, b: Beat): boolean {
  return f >= b.arrive && f < b.click && !isPress(f, b.click)
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
  /** x, y = カーソルの先端(クリック位置)。shown = 最初に現れた瞬間の緑の輪を出す目安(見えている間 true)。 */
  cursor: { x: number; y: number; opacity: number; pressed: boolean; shown: boolean }
  ring: { x: number; y: number; opacity: number; scale: number } | null
  /** 今ホバー表示する対象(0 か 1 つだけ)。対象の上で止まってから押すまでの間だけ。 */
  hover: FeatureHover | null
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

/** 02 の終わりにドラッグしたカードが着く位置(パネル内)。03 のカーソルの出発点になる。 */
function dragEnd(g: FeatureGeometry): Pt {
  const s = g.L.C.slots[CARD_DRAG]
  const cw = g.L.A.cw
  return { x: g.bx + s.x + cw * 0.5, y: g.by + s.y + cw * 0.45 }
}

export function featState(Pin: number, g: FeatureGeometry): FeatureState {
  const P = Math.max(0, Math.min(6, Pin))
  let seg = 0
  let rawf = 0
  if (P > 0) { seg = Math.min(5, Math.ceil(P) - 1); rawf = P - seg }
  /* 段落が切り替わった直後から動き出し、最後の2割は止めて見せる */
  const f = clamp01((rawf - 0.08) / 0.72)
  const { A, B, C, D, E: EL } = g.L
  const n = FEATURE_CARDS.length
  const pos: Pt[] = new Array<Pt>(n)
  const op: number[] = new Array<number>(n).fill(1)
  const sc: number[] = new Array<number>(n).fill(1)
  const cw = A.cw
  const slot = (L: MasonryLayout, i: number): Pt => ({ x: L.slots[i].x, y: L.slots[i].y })
  const mix = (L1: MasonryLayout, L2: MasonryLayout, i: number, t: number): Pt => ({
    x: lerp(L1.slots[i].x, L2.slots[i].x, t),
    y: lerp(L1.slots[i].y, L2.slots[i].y, t),
  })
  let lift = 0, curOp = 0, clickT = -1, pillsOp = 0, frameT = 0, frameOp = 0, chipOp = 0
  let shot = 0, chipsT = 0, dim = 0, focus = 0, ua = 0, ub = 0, startOp = 0, startWipe = 0, flash = 0
  let cur: Pt | null = null
  let hover: FeatureHover | null = null
  let motionOn = seg < 2, pastePress = false, pasteDone = false, sharePress = false, startPress = false, copied = false, playing = false

  /* カーソルは 02 の始めに現れ、06 の終わりまで出しっぱなし。各段は「前の段の終わりの位置」から動き出す。
     どの操作も「止まっている → 動く → 対象の上で止まる(ホバー)→ 押す(波紋)→ 結果を見せて止まる」の順。 */
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
    /* 02: カーソルが現れ、カードの上で一拍おいてから、つかんで並べ替える */
    const t1 = E(f, 0.44, 0.86)
    for (let i = 0; i < n; i++) pos[i] = mix(B, C, i, t1)
    lift = E(f, 0.36, 0.44) * (1 - E(f, 0.86, 0.94))
    sc[CARD_DRAG] = 1 + 0.035 * lift
    curOp = E(f, 0, 0.06)
    const c2 = pos[CARD_DRAG]
    const g1 = E(f, 0.02, 0.3)
    cur = { x: g.bx + lerp(g.bw * 0.92, c2.x + cw * 0.5, g1), y: g.by + lerp(g.bh * 0.92, c2.y + cw * 0.45, g1) }
  } else if (seg === 2) {
    /* 03: 1本が本当に再生され(ほかの動画は静止画が切り替わる)→ カーソルが MOTION へ → 乗って止まる → 押すと全部止まる */
    for (let i = 0; i < n; i++) pos[i] = slot(C, i)
    playing = f > 0.04 && f < 0.7
    motionOn = f < 0.7
    focus = E(f, 0.02, 0.1) * (1 - E(f, 0.74, 0.84))
    dim = 0.4 * focus
    sc[CARD_FILM] = 1 + 0.03 * focus
    const e1 = dragEnd(g)
    curOp = 1
    cur = wp(f, [[0.34, e1.x, e1.y], [BEAT.motion.arrive, g.to.motion.x, g.to.motion.y]])
    clickT = BEAT.motion.click
    if (isHover(f, BEAT.motion)) hover = 'motion'
  } else if (seg === 3) {
    /* 04: MOTION の位置から music へ → 乗って止まる → 押す → 並び替え → design へ → 乗って止まる → 押す */
    pillsOp = E(f, 0, 0.1)
    curOp = 1
    cur = wp(f, [
      [0.04, g.to.motion.x, g.to.motion.y],
      [BEAT.music.arrive, g.to.music.x, g.to.music.y],
      [0.54, g.to.music.x, g.to.music.y],
      [BEAT.design.arrive, g.to.design.x, g.to.design.y],
    ])
    clickT = f < 0.5 ? BEAT.music.click : BEAT.design.click
    hover = isHover(f, BEAT.music) ? 'music' : isHover(f, BEAT.design) ? 'design' : null
    ua = E(f, 0.34, 0.44)
    ub = E(f, 0.76, 0.86)
    const mo = E(f, 0.35, 0.45), mm = E(f, 0.43, 0.59), no = E(f, 0.77, 0.85), nn = E(f, 0.83, 0.96)
    for (let i = 0; i < n; i++) {
      const tg = FEATURE_CARDS[i].tag
      if (tg === 'music') { pos[i] = mix(C, D, i, mm); op[i] = 1 - no; sc[i] = 1 - 0.05 * no }
      else if (tg === 'design') { pos[i] = no > 0 ? slot(EL, i) : slot(C, i); op[i] = no > 0 ? nn : 1 - mo; sc[i] = no > 0 ? 0.95 + 0.05 * nn : 1 - 0.05 * mo }
      else { pos[i] = slot(C, i); op[i] = 1 - mo; sc[i] = 1 - 0.05 * mo }
    }
  } else if (seg === 4) {
    /* 05: design の位置から入口の「ボードを開く」へ → 乗って止まる → 押すだけで登録画面なしでボードが開く → このブラウザに保存 */
    const bk = E(f, 0.04, 0.18), fi = E(f, 0.1, 0.24)
    pillsOp = 1 - E(f, 0, 0.1)
    ua = 1
    ub = 1
    for (let i = 0; i < n; i++) {
      if (FEATURE_CARDS[i].tag === 'design') pos[i] = mix(EL, C, i, bk)
      else { pos[i] = slot(C, i); op[i] = fi; sc[i] = 0.95 + 0.05 * fi }
    }
    startOp = E(f, 0, 0.12)
    startWipe = E(f, 0.49, 0.63)
    curOp = 1
    cur = wp(f, [[0.08, g.to.design.x, g.to.design.y], [BEAT.start.arrive, g.to.start.x, g.to.start.y]])
    clickT = BEAT.start.click
    startPress = isPress(f, BEAT.start.click)
    if (isHover(f, BEAT.start)) hover = 'start'
    frameT = E(f, 0.65, 0.83)
    frameOp = 1
    chipOp = E(f, 0.79, 0.91)
  } else {
    /* 06: 入口ボタンの位置から SHARE へ → 乗って止まる → 押すとボードが1枚の画像に → 「リンクをコピー」へ → 乗って止まる → 押す。
       段の終わりに向けて(rawf 0.9〜1)カーソルは消える */
    for (let i = 0; i < n; i++) pos[i] = slot(C, i)
    frameT = 1
    frameOp = 1 - E(f, 0, 0.1)
    chipOp = frameOp
    curOp = 1 - E(rawf, 0.9, 1)
    cur = wp(f, [
      [0.03, g.to.start.x, g.to.start.y],
      [BEAT.share.arrive, g.to.share.x, g.to.share.y],
      [0.59, g.to.share.x, g.to.share.y],
      [BEAT.copy.arrive, g.to.copy.x, g.to.copy.y],
    ])
    clickT = f < 0.5 ? BEAT.share.click : BEAT.copy.click
    hover = isHover(f, BEAT.share) ? 'share' : isHover(f, BEAT.copy) ? 'copy' : null
    sharePress = isPress(f, BEAT.share.click)
    flash = Math.sin(Math.PI * clamp01((f - 0.35) / 0.08))
    shot = E(f, 0.37, 0.55)
    chipsT = E(f, 0.55, 0.63)
    copied = f > 0.9
  }

  const cards: CardVisual[] = FEATURE_CARDS.map((_, i) => {
    const o = op[i] * (i === CARD_FILM || i === CARD_SLIDES ? 1 : 1 - dim)
    return { x: pos[i].x, y: pos[i].y, scale: sc[i], opacity: o, visible: o >= 0.01 }
  })
  const rp = clickT >= 0 && cur ? clamp01((f - clickT) / 0.09) : 0
  const ring = cur && rp > 0 && rp < 1 ? { x: cur.x, y: cur.y, opacity: 1 - rp, scale: 0.4 + 1.3 * rp } : null
  const pa = g.pills
  return {
    seg, f, cards, lift, newOnTop: seg === 0, focus, playing, motionOn,
    cursor: {
      x: cur ? cur.x : 0,
      y: cur ? cur.y : 0,
      opacity: curOp,
      pressed: lift > 0.5 || (clickT >= 0 && isPress(f, clickT)),
      shown: cur !== null && curOp > 0.02,
    },
    ring, hover, pastePress, pasteDone, pillsOpacity: pillsOp,
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

/** featTarget の逆: 章 chapter(0..5)が始まる時の固定区間の進み(0..1)。featTarget(featChapterProgress(i)) === i。 */
export function featChapterProgress(chapter: number): number { return (chapter + 0.2) / 6.6 }

/** 遅れ lag(段。正負どちらでも)のときの、追従の速さの上限(段/秒)。遅れが大きいほど速い(FEAT_LAG_FREE までは一定)。 */
export function featSpeedCap(lag: number): number {
  return FEAT_SPEED_BASE + FEAT_SPEED_GAIN * Math.max(0, Math.abs(lag) - FEAT_LAG_FREE)
}

/**
 * 表示位置 cur を目標 target へ 1 フレームぶん進めて返す(dtMs は gsap.ticker のミリ秒)。
 * 遅れの 1 − exp(−dt/τ) だけ詰めるが、速さは featSpeedCap を超えない。目標は追い越さず、常に途中の状態を通る。
 */
export function featFollow(cur: number, target: number, dtMs: number): number {
  const dt = Math.max(0, Math.min(dtMs, FEAT_DT_MAX_MS))
  const d = target - cur
  const want = d * (1 - Math.exp(-dt / FEAT_FOLLOW_TAU_MS))
  const cap = (featSpeedCap(d) * dt) / 1000
  return cur + Math.max(-cap, Math.min(cap, want))
}
