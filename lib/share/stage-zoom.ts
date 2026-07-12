/** N-58 段階2: スマホのコラージュ編集ステージのボードズーム/パンの数学と、
 *  「2本目の指が下りたらカード操作を止める」ための調停役。撮影系はこのモジュールを
 *  知らない（ボードズームは編集専用で、撮影は state 由来＝画像に無影響）。 */

/** ステージのズーム/パン状態。screen = content * scale + (tx, ty)。
 *  CSS では `transform: translate(txpx, typx) scale(scale)`（transform-origin: 0 0）に対応。 */
export type StageTransform = {
  readonly scale: number
  readonly tx: number
  readonly ty: number
}

export type StagePoint = { readonly x: number; readonly y: number }

export const IDENTITY_STAGE_TRANSFORM: StageTransform = { scale: 1, tx: 0, ty: 0 }

/** ズーム倍率の範囲。1 = 等倍（帯が画面に内接する既定の見え方）が最小。
 *  上限 6 は「100枚時の最小カード（高さ約24px）が指で掴める大きさになる」目安。
 *  実機の感触で調整するときはここだけ変える。 */
export const STAGE_ZOOM_MIN = 1
export const STAGE_ZOOM_MAX = 6

/** scale/tx/ty を「拡大したステージが常に画面全体を覆う」範囲に収める。
 *  ステージは viewport と同寸・原点(0,0)・transform-origin 0 0 なので、
 *  拡大後の範囲 [t, t + size*scale] が [0, size] を包含する条件は size*(1-scale) <= t <= 0。 */
export function clampStageTransform(
  t: StageTransform,
  viewportW: number,
  viewportH: number,
): StageTransform {
  const scale = Math.min(STAGE_ZOOM_MAX, Math.max(STAGE_ZOOM_MIN, t.scale))
  const tx = Math.min(0, Math.max(viewportW * (1 - scale), t.tx))
  const ty = Math.min(0, Math.max(viewportH * (1 - scale), t.ty))
  return { scale, tx, ty }
}

/** 2本指ピンチの現在フレームの transform。ピンチ開始時点（base/startA/startB）を
 *  基準に毎フレーム絶対計算する（増分の積み上げをしない＝誤差が溜まらない）。
 *  「開始時に2指の中点の下にあったコンテンツ点が、今の中点の下に居続ける」ように
 *  scale と translate を同時に解く。 */
export function pinchStageTransform(args: {
  readonly base: StageTransform
  readonly startA: StagePoint
  readonly startB: StagePoint
  readonly currA: StagePoint
  readonly currB: StagePoint
  readonly viewportW: number
  readonly viewportH: number
}): StageTransform {
  const d0 = Math.hypot(args.startB.x - args.startA.x, args.startB.y - args.startA.y)
  const d1 = Math.hypot(args.currB.x - args.currA.x, args.currB.y - args.currA.y)
  const factor = d0 > 0 ? d1 / d0 : 1
  const scale = Math.min(STAGE_ZOOM_MAX, Math.max(STAGE_ZOOM_MIN, args.base.scale * factor))
  const mid0 = { x: (args.startA.x + args.startB.x) / 2, y: (args.startA.y + args.startB.y) / 2 }
  const mid1 = { x: (args.currA.x + args.currB.x) / 2, y: (args.currA.y + args.currB.y) / 2 }
  const contentX = (mid0.x - args.base.tx) / args.base.scale
  const contentY = (mid0.y - args.base.ty) / args.base.scale
  return clampStageTransform(
    { scale, tx: mid1.x - contentX * scale, ty: mid1.y - contentY * scale },
    args.viewportW,
    args.viewportH,
  )
}

/** 1本指パン（余白ドラッグ）。base に (dx,dy) を足して clamp。等倍(scale 1)では
 *  clamp が原点に固定するので実質 no-op になる（＝ズーム中だけ効く）。 */
export function panStageTransform(
  base: StageTransform,
  dx: number,
  dy: number,
  viewportW: number,
  viewportH: number,
): StageTransform {
  return clampStageTransform({ scale: base.scale, tx: base.tx + dx, ty: base.ty + dy }, viewportW, viewportH)
}

/** 1本指のカード操作（移動）を、2本目の指が下りた瞬間に中断する調停役。
 *  CollageCanvas がドラッグ開始時に自分の後始末（リスナー解除）を register し、
 *  MobileArrangeGestures がピンチ開始時に cancelActive を呼ぶ。同時に生きるカード操作は
 *  常に1つ（2本目の指はピンチに化けるので2つ目のカード操作は始まらない）。 */
export type CollageGestureArbiter = {
  readonly register: (cancel: () => void) => void
  readonly clear: () => void
  readonly cancelActive: () => void
}

export function createCollageGestureArbiter(): CollageGestureArbiter {
  let active: (() => void) | null = null
  return {
    register: (cancel: () => void): void => {
      active = cancel
    },
    clear: (): void => {
      active = null
    },
    cancelActive: (): void => {
      const cancel = active
      active = null
      if (cancel) cancel()
    },
  }
}
