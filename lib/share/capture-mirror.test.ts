// jsdom では canvas / Image の本格動作が無いため、 null 返却・early-return 経路のみ確認。
// 実描画の動作確認は playwright integration test で別途実施 (= Task 7)。
import { describe, it, expect } from 'vitest'
import { captureMirrorToWebP, wrapTextToLines, type MirrorCaptureInput } from './capture-mirror'

// Fake measure: every char is 10px wide → maxWidth N px ⇒ floor(N/10) chars/line.
const measure10 = (s: string): number => Array.from(s).length * 10

const baseInput = {
  items: [],
  sharedCardCount: 0,
  activeTagNames: [],
  totalBoardCount: 0,
  width: 1200,
  height: 628,
  targetBytes: 180 * 1024,
  startQuality: 0.82,
  minQuality: 0.4,
} as const

describe('captureMirrorToWebP', () => {
  it('returns null when mirrorFrame is null', async () => {
    const result = await captureMirrorToWebP({
      ...baseInput,
      mirrorFrame: null,
    } as MirrorCaptureInput)
    expect(result).toBeNull()
  })

  it('returns null when canvas getContext fails (= jsdom path)', async () => {
    // jsdom returns null from getContext('2d'), so any element triggers null
    const el = document.createElement('div')
    el.style.width = '600px'
    el.style.height = '314px'
    document.body.appendChild(el)
    const result = await captureMirrorToWebP({
      ...baseInput,
      mirrorFrame: el,
    })
    // In jsdom, this hits one of: getContext null, or toBlob unsupported
    expect(result).toBeNull()
  })
})

describe('wrapTextToLines (CJK-safe text-card wrapping)', () => {
  it('breaks CJK text with NO spaces by character so it never overflows', () => {
    // The real bug: Japanese/Chinese tweet bodies have no spaces.
    const cjk = 'あいうえおかきくけこさしすせそ' // 15 chars, 10px each
    const lines = wrapTextToLines(measure10, cjk, 40, 3) // 4 chars/line, 3 lines
    expect(lines.length).toBeLessThanOrEqual(3)
    // Every line must fit (incl. a trailing ellipsis on the truncated last line).
    for (const l of lines) expect(measure10(l)).toBeLessThanOrEqual(40)
    expect(lines[0]).toBe('あいうえ')
  })

  it('ellipsizes the last line when the text is truncated', () => {
    const cjk = 'あいうえおかきくけこさしすせそ' // 15 chars
    const lines = wrapTextToLines(measure10, cjk, 40, 2) // only 2 lines fit ~8 chars
    expect(lines.length).toBe(2)
    expect(lines[lines.length - 1].endsWith('…')).toBe(true)
    for (const l of lines) expect(measure10(l)).toBeLessThanOrEqual(40)
  })

  it('wraps Latin text at spaces (word boundaries) when possible', () => {
    const lines = wrapTextToLines(measure10, 'hello world foo', 70, 5) // 7 chars/line
    expect(lines).toEqual(['hello', 'world', 'foo'])
  })

  it('does not overflow on a long URL with no spaces', () => {
    const url = 'https://t.co/YshVBHbghM'
    const lines = wrapTextToLines(measure10, url, 60, 4)
    for (const l of lines) expect(measure10(l)).toBeLessThanOrEqual(60)
  })

  it('keeps short text on a single line with no ellipsis', () => {
    const lines = wrapTextToLines(measure10, 'Recent', 200, 3)
    expect(lines).toEqual(['Recent'])
  })

  it('returns [] for non-positive maxLines / maxWidth', () => {
    expect(wrapTextToLines(measure10, 'x', 100, 0)).toEqual([])
    expect(wrapTextToLines(measure10, 'x', 0, 3)).toEqual([])
  })
})
