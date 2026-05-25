/**
 * FLIP (First-Last-Invert-Play) reflow を 1 要素に対して実行。
 *
 * 使い方:
 * 1. 並び替え前に各要素の rect を取得 (first)
 * 2. 並び替え (= DOM 上で位置変化)
 * 3. この関数を呼ぶ (= 内部で last rect を取得、 差分を逆方向 transform で適用 → 0 に向かって animate)
 *
 * @param el 要素
 * @param first 並び替え前の getBoundingClientRect() 結果
 * @param duration アニメ時間 (ms)、 default 400
 * @param easing easing 名、 default 'cubic-bezier(0.4, 0, 0.2, 1)'
 * @returns Animation Promise (完了で resolve)
 */
export function runFlipReflow(
  el: HTMLElement,
  first: DOMRect,
  duration = 400,
  easing = 'cubic-bezier(0.4, 0, 0.2, 1)',
): Promise<void> {
  const last = el.getBoundingClientRect()
  const dx = first.left - last.left
  const dy = first.top - last.top
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
    return Promise.resolve()
  }
  const anim = el.animate(
    [
      { transform: `translate(${dx}px, ${dy}px)` },
      { transform: 'translate(0, 0)' },
    ],
    { duration, easing, fill: 'forwards' },
  )
  return anim.finished.then(() => undefined).catch(() => undefined)
}
