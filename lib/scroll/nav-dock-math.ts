// lib/scroll/nav-dock-math.ts
/**
 * N-05 LP ナビ格納演出の純関数層。
 * anchorTop = 本文 kicker の viewport 基準 top(px)。ヘッダーは fixed 64px。
 * 状態遷移は「範囲＋ラッチ式」: しきい値を跨いだ *範囲* で判定するため、
 * Lenis の慣性スクロールで 1 フレームに大きく飛んでも取りこぼさない。
 * 演出は3段直列（2026-07-03 ブラッシュアップ）:
 *   traveling(本文の姿のまま帯に乗る) → morphing(その場で衣装替え・時間制)
 *   → docked(zip)。morphing → docked の昇格はタイマーのみ（スクロールでは進まない）。
 */
export type DockMode = 'armed' | 'traveling' | 'morphing' | 'docked'

export const NAV_DOCK = {
  /** ヘッダー高（SiteHeader.module.css .header height と一致） */
  headerH: 64,
  /** 着地判定線 = ヘッダー中央 */
  dockY: 32,
  /** 帯進入の判定開始線（ヘッダー下端から 56px 下） */
  glassStart: 120,
  /** この進捗を超えたら traveler が語を引き取る（1文字ずつ乗り上がり開始） */
  glassOnAt: 0.06,
  /** docked/morphing → traveling へ戻すヒステリシス(px) */
  releaseGap: 10,
  /** traveling → armed へ戻すヒステリシス(px) */
  restGap: 8,
  /** ダッシュ（しゅっ→バウンド着地）の時間(ms) */
  zipMs: 460,
  /** 上スクロールで本文へ帰る時間(ms) */
  returnMs: 300,
  /** 1文字ごとの乗り上がり遅延(ms) */
  charDelayMs: 28,
  /** 衣装替えの波: 1文字ごとの開始遅延(ms) */
  morphCharDelayMs: 30,
  /** 衣装替え: 1文字の沈み→起き上がり全体(ms)。折り返し(1/2)で font-family 切替 */
  morphCharMs: 240,
  /** 変身キャンセル時の一斉逆戻し(ms) */
  morphCancelMs: 180,
  /** morphing 進入時、凍結位置へ寄せる時間(ms)（大ジャンプでも瞬間移動しない） */
  morphAlignMs: 120,
} as const

/** kicker の top から帯進入の進捗 0→1 を返す（glassStart で 0, dockY で 1）。
 *  発動判定（glassOnAt との比較）専用。CSS のスクラブには使わない。 */
export function morphProgress(anchorTop: number): number {
  const p = (NAV_DOCK.glassStart - anchorTop) / (NAV_DOCK.glassStart - NAV_DOCK.dockY)
  return Math.max(0, Math.min(1, p))
}

/** 変身の総時間(ms) = 最終文字の開始遅延 + 1文字分。ラベル長で決まる */
export function morphTotalMs(charCount: number): number {
  if (charCount <= 0) return NAV_DOCK.morphCharMs
  return (charCount - 1) * NAV_DOCK.morphCharDelayMs + NAV_DOCK.morphCharMs
}

/** 現在モードと anchorTop から次モードを返す（副作用なし）。
 *  morphing → docked はここでは起きない（コンポーネントの完了タイマーが進める）。 */
export function nextDockMode(mode: DockMode, anchorTop: number): DockMode {
  if (mode === 'docked') {
    return anchorTop >= NAV_DOCK.dockY + NAV_DOCK.releaseGap ? 'traveling' : 'docked'
  }
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
