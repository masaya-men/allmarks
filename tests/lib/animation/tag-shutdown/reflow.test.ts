import { describe, it, expect, vi } from 'vitest'
import { runFlipReflow } from '@/lib/animation/tag-shutdown/reflow'

describe('runFlipReflow', () => {
  it('要素の rect 差分から transform を計算し animate.fillMode=forwards で適用', () => {
    const el = document.createElement('div')
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: vi.fn().mockReturnValueOnce({ left: 100, top: 200, width: 50, height: 50 })
                       .mockReturnValueOnce({ left: 150, top: 250, width: 50, height: 50 }),
    })
    el.animate = vi.fn().mockReturnValue({ finished: Promise.resolve() })

    const first = el.getBoundingClientRect()
    // ここで element が DOM 上で移動 (シミュレーション)
    runFlipReflow(el, first, 400, 'ease-out')

    expect(el.animate).toHaveBeenCalledWith(
      [
        { transform: 'translate(-50px, -50px)' },
        { transform: 'translate(0, 0)' },
      ],
      { duration: 400, easing: 'ease-out', fill: 'forwards' },
    )
  })

  it('rect が同じなら animate 呼ばれない (= 動かない)', () => {
    const el = document.createElement('div')
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 200, width: 50, height: 50 }),
    })
    el.animate = vi.fn()
    const first = el.getBoundingClientRect()
    runFlipReflow(el, first, 400, 'ease-out')
    expect(el.animate).not.toHaveBeenCalled()
  })
})
