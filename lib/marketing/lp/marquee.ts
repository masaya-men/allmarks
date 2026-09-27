import { gsap } from 'gsap'

/**
 * 流れる文字の帯(見本 850–858 行の Marquee/mqFrame)。右から左へ流れ、
 * スクロールの速さで加速し、上へ戻すと逆向きに流れる。
 *
 * 見本はティッカー関数と速度状態(mqY/mqV)を全インスタンスで共有していたが、
 * ここでは呼び出し側ごとに完全に独立させる(インスタンスごとに own ticker /
 * own 速度状態を持つ)。
 */
export function createMarquee(el: HTMLElement, inner: HTMLElement, base: number): { measure(): void; destroy(): void } {
  let x = 0
  let w = 0
  let dir = -1
  let on = true
  let lastY = window.scrollY
  let v = 0

  function measure(): void {
    w = inner.scrollWidth / 2
  }
  measure()

  const io = new IntersectionObserver((entries) => {
    on = entries[0].isIntersecting
  }, { rootMargin: '60px' })
  io.observe(el)

  function frame(): void {
    const y = window.scrollY
    const d = y - lastY
    lastY = y
    v += (d - v) * 0.14
    if (!on || !w) return
    if (Math.abs(v) > 0.6) dir = v > 0 ? -1 : 1
    const step = base + Math.min(24, Math.abs(v) * 0.45)
    x += dir * step
    if (x <= -w) x += w
    if (x > 0) x -= w
    inner.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0)'
  }

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!reduce) gsap.ticker.add(frame)

  return {
    measure,
    destroy(): void {
      gsap.ticker.remove(frame)
      io.disconnect()
    },
  }
}
