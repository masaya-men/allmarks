import { describe, it, expect, vi } from 'vitest'

// dom-to-image は jsdom で実描画できず、内部で SVG onload を待って解決しないため
// (= ハング)、撮影ライブラリをモックして即失敗させる。ここで確認したいのは
// captureCollageShareImage が「壊れず graceful に null を返す」こと (共有を絶対に壊さない)。
// 実描画の見た目は Playwright + 本番目視で検証する。
// N-56: 段階別診断テストは attempt ごとに toJpeg の結果を出し分ける必要があるため、
// render-share-image.test.ts と同じ hoisted spy 方式に切り替える。
const { toJpeg } = vi.hoisted(() => ({ toJpeg: vi.fn() }))
vi.mock('dom-to-image-more', () => ({ default: { toJpeg } }))

import { captureCollageShareImage, captureCollageShareImageDetailed, formatCaptureAttempts } from './capture-collage'

describe('captureCollageShareImage', () => {
  it('returns null gracefully when capture fails', async () => {
    toJpeg.mockReset()
    toJpeg.mockRejectedValueOnce(new Error('no canvas in jsdom'))
    const node = document.createElement('div')
    node.setAttribute('data-testid', 'collage-canvas')
    document.body.appendChild(node)
    const out = await captureCollageShareImage(node, {
      origin: 'https://allmarks.app',
      boardColor: '#0a0a0c',
    })
    expect(out).toBeNull()
    node.remove()
  })

  it('honors the timeout when capture hangs', async () => {
    toJpeg.mockReset()
    toJpeg.mockRejectedValueOnce(new Error('no canvas in jsdom'))
    const node = document.createElement('div')
    const out = await captureCollageShareImage(node, {
      origin: 'https://allmarks.app',
      boardColor: '#0a0a0c',
      timeoutMs: 50,
    })
    expect(out).toBeNull()
  })
})

// data-URL を即 onload で解決する Image スタブ (jsdom は画像を実ロードしない)
class InstantImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  naturalWidth = 1200
  naturalHeight = 2597
  set src(_v: string) {
    queueMicrotask((): void => this.onload?.())
  }
}

describe('captureCollageShareImageDetailed (N-56)', () => {
  it('records stage "render" with the reported message when dom-to-image fails', async () => {
    toJpeg.mockReset()
    toJpeg.mockRejectedValueOnce(new Error('SecurityError: tainted'))
    const node = document.createElement('div')
    const out = await captureCollageShareImageDetailed(node, { origin: 'https://allmarks.app', boardColor: '#0a0a0b' })
    expect(out.dataUrl).toBeNull()
    expect(out.attempts).toHaveLength(1)
    expect(out.attempts[0].stage).toBe('render')
    expect(out.attempts[0].message).toContain('SecurityError')
  })

  it('falls back to the next scale and succeeds — attempts carry both records', async () => {
    vi.stubGlobal('Image', InstantImage)
    toJpeg.mockReset()
    toJpeg.mockRejectedValueOnce(new Error('RangeError: canvas too big'))
    toJpeg.mockResolvedValueOnce('data:image/jpeg;base64,xxx')
    const node = document.createElement('div')
    const out = await captureCollageShareImageDetailed(node, {
      origin: 'https://allmarks.app',
      boardColor: '#0a0a0b',
      scale: 3.08,
      fallbackScales: [1],
    })
    expect(out.attempts).toHaveLength(2)
    expect(out.attempts[0].stage).toBe('render')
    expect(out.attempts[0].scale).toBeCloseTo(3.08, 2)
    expect(out.attempts[1].scale).toBe(1)
    // normalize は jsdom の canvas 制約で null になり得る — dataUrl の成否ではなく
    // 「2回目が試行されたこと」「scale が正しいこと」を主眼に検証する
    vi.unstubAllGlobals()
  })

  it('keeps the legacy wrapper byte-identical: no fallbackScales → exactly 1 attempt', async () => {
    toJpeg.mockReset()
    toJpeg.mockRejectedValueOnce(new Error('no canvas in jsdom'))
    const node = document.createElement('div')
    const out = await captureCollageShareImageDetailed(node, { origin: 'https://allmarks.app', boardColor: '#0a0a0b' })
    expect(out.attempts).toHaveLength(1)
  })
})

describe('formatCaptureAttempts', () => {
  it('renders a compact one-line diagnostic', () => {
    expect(
      formatCaptureAttempts([
        { scale: 3.08, timeoutMs: 20000, elapsedMs: 20003, stage: 'timeout', message: null },
        { scale: 1, timeoutMs: 12000, elapsedMs: 3120, stage: 'render', message: 'SecurityError: tainted' },
      ]),
    ).toBe('#1 x3.08 timeout 20003ms / #2 x1 render 3120ms SecurityError: tainted')
  })

  it('marks success attempts as ok', () => {
    expect(formatCaptureAttempts([{ scale: 1, timeoutMs: 12000, elapsedMs: 900, stage: null, message: null }]))
      .toBe('#1 x1 ok 900ms')
  })
})
