// lib/scroll/nav-dock-math.ts
/**
 * N-05 LP ナビ格納演出の純関数層。
 * anchorTop = 本文 kicker の viewport 基準 top(px)。ヘッダーは fixed 64px。
 * 状態遷移は「範囲＋ラッチ式」: しきい値を跨いだ *範囲* で判定するため、
 * Lenis の慣性スクロールで 1 フレームに大きく飛んでも取りこぼさない。
 * 演出は3段直列（2026-07-03 ブラッシュアップ v2）:
 *   traveling(本文の姿のまま帯に乗る) → morphing(その場で衣装替え＝時間制の波)
 *   → そのまま morphing 内で「とどまり(holdPx) → スクロール駆動の横移動(dashPx)
 *   → ナビ枠に定着」。帯上の位置は anchorTop の純関数（時間制 zip は無い）。
 *   上へ戻せば同じ道を左へ帰り、帯を離れる時は横ズレ 0 の垂直帰還のみ。
 */
export type DockMode = 'armed' | 'traveling' | 'morphing'

export const NAV_DOCK = {
  /** ヘッダー高（SiteHeader.module.css .header height と一致） */
  headerH: 64,
  /** 変身の発動判定線 = ヘッダー中央 */
  dockY: 32,
  /** 帯進入の判定開始線（ヘッダー下端から 56px 下） */
  glassStart: 120,
  /** この進捗を超えたら traveler が語を引き取る（1文字ずつ乗り上がり開始） */
  glassOnAt: 0.06,
  /** morphing → traveling へ戻すヒステリシス(px) */
  releaseGap: 10,
  /** traveling → armed へ戻すヒステリシス(px) */
  restGap: 8,
  /** 1文字ごとの乗り上がり遅延(ms) */
  charDelayMs: 28,
  /** 衣装替えの波: 1文字ごとの開始遅延(ms) */
  morphCharDelayMs: 30,
  /** 衣装替え: 1文字の沈み→起き上がり全体(ms)。折り返し(1/2)で書体・ケース切替 */
  morphCharMs: 240,
  /** 変身キャンセル時の一斉逆戻し(ms)（帯を離れる垂直帰還と共用） */
  morphCancelMs: 180,
  /** morphing 進入時、凍結位置へ寄せる時間(ms)（大ジャンプでも瞬間移動しない） */
  morphAlignMs: 120,
  /** 変身後にその場へとどまるスクロール距離(px)＝「結構しっかり」 */
  holdPx: 160,
  /** 横移動（ダッシュ）を 0→1 で横断するスクロール距離(px) */
  dashPx: 140,
  /** dashEase の easeOutBack 強度（0.65 ≒ 行き過ぎ約 +1.5%） */
  dashBack: 0.65,
  /** 乗り上がりの跳ね: 1文字の弧が使う進捗幅（0..1 のうち） */
  hopSpan: 0.45,
  /** 玉のノック（squash＋リング一拍）の時間(ms) */
  knockMs: 360,
} as const

/** kicker の top から帯進入の進捗 0→1 を返す（glassStart で 0, dockY で 1）。
 *  発動判定（glassOnAt との比較）専用。CSS のスクラブには使わない。 */
export function morphProgress(anchorTop: number): number {
  const p = (NAV_DOCK.glassStart - anchorTop) / (NAV_DOCK.glassStart - NAV_DOCK.dockY)
  return Math.max(0, Math.min(1, p))
}

/** 乗り上がり波の進捗 0→1。traveler への引き継ぎ点（glassOnAt）で 0、dockY で 1。
 *  引き継ぎ瞬間に全文字オフセット 0 ＝実 kicker と完全同姿（継ぎ目レス）にするための正規化。 */
export function bandClimbProgress(anchorTop: number): number {
  const p = (morphProgress(anchorTop) - NAV_DOCK.glassOnAt) / (1 - NAV_DOCK.glassOnAt)
  return Math.max(0, Math.min(1, p))
}

/** 文字 i の跳ね（しきい値をまたぐ「ぴょこ」）0→1→0 の sin 弧。
 *  窓 [i*step, i*step + hopSpan]、step は最終文字の弧が進捗 1 で着地するよう配分。
 *  スクロール駆動（時間を使わない）＝逆走すればそのまま巻き戻る。 */
export function charHopArc(progress: number, index: number, count: number): number {
  const span = NAV_DOCK.hopSpan
  const step = count > 1 ? (1 - span) / (count - 1) : 0
  const phase = Math.max(0, Math.min(1, (progress - index * step) / span))
  return Math.sin(Math.PI * phase)
}

/** hairline（ヘッダー下端）横断の強度 0→1→0。
 *  語（高さ wordH）の中央が線 y=headerH に重なるときピーク 1、窓の端で 0。 */
export function crossGlow(anchorTop: number, wordH: number): number {
  const half = wordH / 2
  const center = NAV_DOCK.headerH - half
  const v = 1 - Math.abs(anchorTop - center) / half
  return Math.max(0, Math.min(1, v))
}

/** 変身の総時間(ms) = 最終文字の開始遅延 + 1文字分。ラベル長で決まる */
export function morphTotalMs(charCount: number): number {
  if (charCount <= 0) return NAV_DOCK.morphCharMs
  return (charCount - 1) * NAV_DOCK.morphCharDelayMs + NAV_DOCK.morphCharMs
}

/** スクロール駆動の横移動進捗 0→1。
 *  発動（dockY）から holdPx 分はその場（0）、続く dashPx 区間で線形に 1 へ。 */
export function dashProgress(anchorTop: number): number {
  const dashStartY = NAV_DOCK.dockY - NAV_DOCK.holdPx
  const p = (dashStartY - anchorTop) / NAV_DOCK.dashPx
  return Math.max(0, Math.min(1, p))
}

/** 横移動の easing（easeOutBack）: 出だし素早く、終端で僅かに行き過ぎて「はまる」。
 *  スクラブ用（逆走しても同じ曲線を戻るだけ）。dashEase(0)=0, dashEase(1)=1。 */
export function dashEase(p: number): number {
  const c1 = NAV_DOCK.dashBack
  const c3 = c1 + 1
  const u = p - 1
  return 1 + c3 * u * u * u + c1 * u * u
}

/** 現在モードと anchorTop から次モードを返す（副作用なし）。
 *  morphing 内の横移動・定着は dashProgress が担う（状態は分けない）。 */
export function nextDockMode(mode: DockMode, anchorTop: number): DockMode {
  if (mode === 'morphing') {
    return anchorTop >= NAV_DOCK.dockY + NAV_DOCK.releaseGap ? 'traveling' : 'morphing'
  }
  if (mode === 'traveling') {
    if (anchorTop <= NAV_DOCK.dockY) return 'morphing'
    if (anchorTop > NAV_DOCK.glassStart + NAV_DOCK.restGap) return 'armed'
    return 'traveling'
  }
  // armed
  return morphProgress(anchorTop) > NAV_DOCK.glassOnAt ? 'traveling' : 'armed'
}

/** 演出を有効化してよいか（mount/resize 時に評価） */
export function isDockEligible(args: {
  reducedMotion: boolean
  viewportWidth: number
  kickerText: string | null
  navLabel: string
}): boolean {
  if (args.reducedMotion) return false
  if (args.viewportWidth <= 960) return false
  if (!args.kickerText) return false
  return args.kickerText.trim().toLowerCase() === args.navLabel.trim().toLowerCase()
}
