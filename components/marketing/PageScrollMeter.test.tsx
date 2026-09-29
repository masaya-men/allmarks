import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { PageScrollMeter } from './PageScrollMeter'
import styles from './PageScrollMeter.module.css'

// 見立てたページ: 高さ 5000px・画面 800px(スクロールの最大 4200px)。メーターは画面の y = 74px から高さ 596px。
const PAGE_H = 5000
const VIEW_H = 800
const MAX_SCROLL = PAGE_H - VIEW_H
const TRACK_TOP = 74
const TRACK_H = 596

function setScrollY(y: number): void {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y })
}

function rectAt(top: number, height: number): DOMRect {
  return { x: 0, y: top, top, left: 0, right: 0, bottom: top + height, width: 0, height, toJSON: () => ({}) }
}

/** LP を真似た入れ物。メーターの親の中に、Problem / Features / 最後の黒い区画を置く(data-top = ページ上端からの距離)。 */
function Page({ withFeatures = true }: { withFeatures?: boolean }): React.ReactElement {
  return (
    <div>
      <PageScrollMeter />
      <section id="problem" data-top="900" />
      {withFeatures ? <section id="features" data-top="2600" /> : null}
      <section data-top="4000">
        <div data-finale-cta />
      </section>
    </div>
  )
}

/** jsdom はレイアウトを持たないので、getBoundingClientRect を data-top から作る(ページ上の位置 − scrollY)。 */
function stubRects(): void {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element): DOMRect {
    if (this.hasAttribute('data-lp-page-scroll-meter')) return rectAt(TRACK_TOP, TRACK_H)
    const docTop = Number(this.getAttribute('data-top') ?? 0)
    return rectAt(docTop - window.scrollY, 0)
  })
}

function parts(container: HTMLElement): { root: HTMLElement; fill: HTMLElement; ticks: HTMLElement[]; hit: HTMLElement } {
  const root = container.querySelector<HTMLElement>('[data-lp-page-scroll-meter]')
  if (!root) throw new Error('no meter')
  const spans = Array.from(root.querySelectorAll<HTMLElement>(':scope > span'))
  const hit = root.querySelector<HTMLElement>(':scope > div')
  if (!hit) throw new Error('no hit area')
  // 並び: 下地 / 線 / 目盛り ×3
  return { root, fill: spans[1], ticks: spans.slice(2), hit }
}

const pointer = (type: string, clientY: number): MouseEvent => new MouseEvent(type, { bubbles: true, clientY })

/** 溜めた rAF のコールバック。flushFrames() で「次のフレーム」を 1 回流す(本物の rAF と同じく、登録した時には走らない)。 */
let frames: FrameRequestCallback[] = []
function flushFrames(): void {
  const run = frames
  frames = []
  run.forEach((cb) => cb(0))
}

beforeEach(() => {
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: VIEW_H })
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: PAGE_H })
  setScrollY(0)
  frames = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
    frames.push(cb)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
  stubRects()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  // jsdom には pointer capture が無い
  Object.assign(Element.prototype, {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: vi.fn(() => false),
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(Element.prototype, 'setPointerCapture')
  Reflect.deleteProperty(Element.prototype, 'releasePointerCapture')
  Reflect.deleteProperty(Element.prototype, 'hasPointerCapture')
  Reflect.deleteProperty(window, 'scrollY')
})

describe('PageScrollMeter', () => {
  it('aria-hidden で、下地・線・3 つの目盛り・当たり判定を持つ', () => {
    const { container } = render(<Page />)
    const { root, fill, ticks, hit } = parts(container)
    expect(root.getAttribute('aria-hidden')).toBe('true')
    expect(fill).toBeTruthy()
    expect(ticks).toHaveLength(3)
    expect(hit).toBeTruthy()
  })

  it('Problem・Features・最後の黒い区画が画面の頭に来るスクロール位置に目盛りを置く', () => {
    const { container } = render(<Page />)
    const { ticks } = parts(container)
    // メーターの高さ 596px に対して 900 / 4200, 2600 / 4200, 4000 / 4200 = 127.7, 369.0, 567.6 → 整数 px に丸める
    expect(ticks.map((t) => t.style.top)).toEqual(['128px', '369px', '568px'])
    expect(ticks.map((t) => t.style.display)).toEqual(['block', 'block', 'block'])
  })

  it('ページにない区画の目盛りは出さない', () => {
    const { container } = render(<Page withFeatures={false} />)
    const { ticks } = parts(container)
    expect(ticks.map((t) => t.style.display)).toEqual(['block', 'none', 'block'])
  })

  it('線は scrollY ÷ 最大スクロールに追従する(0..1 に丸める)', () => {
    const { container } = render(<Page />)
    const { fill } = parts(container)
    expect(fill.style.transform).toBe('scaleY(0.0000)')
    const scrollTo = (y: number): void => {
      setScrollY(y)
      act(() => {
        window.dispatchEvent(new Event('scroll'))
        flushFrames()
      })
    }
    scrollTo(MAX_SCROLL / 2)
    expect(fill.style.transform).toBe('scaleY(0.5000)')
    scrollTo(MAX_SCROLL + 300)
    expect(fill.style.transform).toBe('scaleY(1.0000)')
    scrollTo(-50)
    expect(fill.style.transform).toBe('scaleY(0.0000)')
  })

  it('scroll イベントが何回来ても、次のフレームで 1 回だけ描く(rAF は 1 つだけ予約)', () => {
    render(<Page />)
    frames = []
    setScrollY(1000)
    act(() => {
      window.dispatchEvent(new Event('scroll'))
      window.dispatchEvent(new Event('scroll'))
      window.dispatchEvent(new Event('scroll'))
    })
    expect(frames).toHaveLength(1)
    act(() => {
      flushFrames()
    })
    // 描いたあとは、次の scroll でまた予約できる
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })
    expect(frames).toHaveLength(1)
  })

  it('押した位置へ瞬時にスクロールし、つまんだまま動かすと追従し、離すと終わる', () => {
    const { container } = render(<Page />)
    const { root, hit } = parts(container)
    const scrollTo = vi.mocked(window.scrollTo)

    act(() => {
      hit.dispatchEvent(pointer('pointerdown', TRACK_TOP + TRACK_H / 2))
    })
    expect(scrollTo).toHaveBeenLastCalledWith({ top: MAX_SCROLL / 2, left: 0, behavior: 'instant' })
    expect(root.classList.contains(styles.active)).toBe(true)

    act(() => {
      hit.dispatchEvent(pointer('pointermove', TRACK_TOP + TRACK_H))
    })
    expect(scrollTo).toHaveBeenLastCalledWith({ top: MAX_SCROLL, left: 0, behavior: 'instant' })

    // メーターの外へ出ても、端に丸めて追従し続ける
    act(() => {
      hit.dispatchEvent(pointer('pointermove', 0))
    })
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'instant' })

    act(() => {
      hit.dispatchEvent(pointer('pointerup', 0))
    })
    expect(root.classList.contains(styles.active)).toBe(false)
    const calls = scrollTo.mock.calls.length
    act(() => {
      hit.dispatchEvent(pointer('pointermove', TRACK_TOP + 100))
    })
    expect(scrollTo.mock.calls.length).toBe(calls)
  })

  it('マウスを乗せている間だけ線が太くなる(active)', () => {
    // CSS Modules の active が本当にクラス名として解決されている(undefined のまま素通りしていない)
    expect(typeof styles.active).toBe('string')
    expect(styles.active.length).toBeGreaterThan(0)
    const { container } = render(<Page />)
    const { root, hit } = parts(container)
    expect(root.classList.contains(styles.active)).toBe(false)
    act(() => {
      hit.dispatchEvent(new MouseEvent('pointerenter'))
    })
    expect(root.classList.contains(styles.active)).toBe(true)
    act(() => {
      hit.dispatchEvent(new MouseEvent('pointerleave'))
    })
    expect(root.classList.contains(styles.active)).toBe(false)
  })

  it('アンマウントで window のリスナーをすべて外す', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<Page />)
    const added = add.mock.calls.map(([type]) => type).filter((t) => ['scroll', 'resize', 'load'].includes(t))
    expect(added.sort()).toEqual(['load', 'resize', 'scroll'])
    unmount()
    const removed = remove.mock.calls.map(([type]) => type).filter((t) => ['scroll', 'resize', 'load'].includes(t))
    expect(removed.sort()).toEqual(['load', 'resize', 'scroll'])
  })
})
