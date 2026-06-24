import { describe, it, expect } from 'vitest'
import { getEntryAnimation } from '@/lib/animation/tag-entry'

describe('getEntryAnimation', () => {
  it('wave テーマで CRT bootup config が返る (= fill:none / keyframes あり)', () => {
    const a = getEntryAnimation('wave')
    expect(a).toBeDefined()
    expect(a?.keyframes.length).toBeGreaterThan(0)
    expect(a?.options.fill).toBe('none')
    expect(typeof a?.staggerStepMs).toBe('number')
    expect(typeof a?.staggerCapMs).toBe('number')
  })

  it('paper-drift テーマで穏やかな drift config が返る (= fill:none、 緑 flash 無し)', () => {
    const a = getEntryAnimation('paper-drift')
    expect(a).toBeDefined()
    expect(a?.keyframes.length).toBeGreaterThan(0)
    expect(a?.options.fill).toBe('none')
    // paper drift は緑 flash / glitch を一切持たない (= 落ち着いた紙の演出)
    const serialized = JSON.stringify(a?.keyframes)
    expect(serialized).not.toContain('#28F100')
    expect(serialized.toLowerCase()).not.toContain('5aefff') // glitch cyan
  })

  it('未対応テーマ key では undefined フォールバック (= フォールバック契約維持)', () => {
    expect(getEntryAnimation('forest')).toBeUndefined()
    expect(getEntryAnimation('glitch-crt')).toBeUndefined()
  })
})
