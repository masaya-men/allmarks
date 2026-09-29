import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gsap } from 'gsap'
import { createMarquee } from './marquee'

/** gsap.ticker.add に渡された frame() をつかまえて、テストが手で1フレームずつ進める。 */
let tick: () => void
/** window.scrollY の代わり。テストが書き換えてスクロールを模擬する。 */
let scrollY: number
let inner: HTMLElement
let marquee: ReturnType<typeof createMarquee>

const originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY')

/** 常に「画面内に交差中」を返す IntersectionObserver(帯が動く条件を満たす)。 */
class IntersectingObserver {
  private readonly callback: IntersectionObserverCallback
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
  }
  observe(): void {
    this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
  unobserve(): void {}
  disconnect(): void {}
}

/** 帯の現在の x(inner.style.transform の translate3d 第1引数)。 */
function readX(): number {
  const m = /translate3d\((-?\d+(?:\.\d+)?)px/.exec(inner.style.transform)
  return m ? Number(m[1]) : 0
}

/** dy だけスクロールして1フレーム進める。 */
function scrollFrame(dy: number): void {
  scrollY += dy
  tick()
}

beforeEach(() => {
  // 上スクロールでも負にならないよう、十分下から始める。
  scrollY = 100000
  Object.defineProperty(window, 'scrollY', { get: () => scrollY, configurable: true })
  vi.spyOn(gsap.ticker, 'add').mockImplementation((cb) => {
    tick = cb as unknown as () => void
    return cb
  })
  vi.stubGlobal('IntersectionObserver', IntersectingObserver)
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: (): void => {},
    removeListener: (): void => {},
    addEventListener: (): void => {},
    removeEventListener: (): void => {},
    dispatchEvent: (): boolean => false,
  }))

  const root = document.createElement('div')
  inner = document.createElement('div')
  // 半分の幅 = 10000px。テスト中に折り返し(wrap)へ届かない十分な長さ。
  Object.defineProperty(inner, 'scrollWidth', { value: 20000, configurable: true })
  marquee = createMarquee(root, inner, 0.55)
})

afterEach(() => {
  marquee.destroy()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  if (originalScrollY) {
    Object.defineProperty(window, 'scrollY', originalScrollY)
  } else {
    Reflect.deleteProperty(window, 'scrollY')
  }
})

describe('createMarquee', () => {
  it('下へスクロールしている間、x は毎フレーム減る(右→左)', () => {
    const xs: number[] = []
    for (let i = 0; i < 8; i += 1) {
      scrollFrame(60)
      xs.push(readX())
    }
    for (let i = 1; i < xs.length; i += 1) {
      expect(xs[i]).toBeLessThan(xs[i - 1]!)
    }
  })

  it('上へスクロールしても x は減り続ける(逆向きに戻らない)', () => {
    // まず下へ動かして帯を流し、そのあと長く上へスクロールする。
    for (let i = 0; i < 10; i += 1) scrollFrame(60)
    const xs: number[] = [readX()]
    for (let i = 0; i < 30; i += 1) {
      scrollFrame(-60)
      xs.push(readX())
    }
    for (let i = 1; i < xs.length; i += 1) {
      expect(xs[i]).toBeLessThan(xs[i - 1]!)
    }
  })

  it.each([
    ['下', 1],
    ['上', -1],
  ])('%sスクロールでも、速いほど1フレームの減り方が大きい', (_label, sign) => {
    // 速さが落ち着くまで回してから、1フレームぶんの動きを測る。
    const stepAt = (speed: number): number => {
      for (let i = 0; i < 60; i += 1) scrollFrame(sign * speed)
      const before = readX()
      scrollFrame(sign * speed)
      return before - readX()
    }
    const slow = stepAt(4)
    const fast = stepAt(40)
    expect(slow).toBeGreaterThan(0)
    expect(fast).toBeGreaterThan(slow)
  })
})
