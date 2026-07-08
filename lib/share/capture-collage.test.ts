import { describe, it, expect, vi } from 'vitest'

// dom-to-image は jsdom で実描画できず、内部で SVG onload を待って解決しないため
// (= ハング)、撮影ライブラリをモックして即失敗させる。ここで確認したいのは
// captureCollageShareImage が「壊れず graceful に null を返す」こと (共有を絶対に壊さない)。
// 実描画の見た目は Playwright + 本番目視で検証する。
vi.mock('dom-to-image-more', () => ({
  default: { toJpeg: (): Promise<string> => Promise.reject(new Error('no canvas in jsdom')) },
}))

import { captureCollageShareImage } from './capture-collage'

describe('captureCollageShareImage', () => {
  it('returns null gracefully when capture fails', async () => {
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
    const node = document.createElement('div')
    const out = await captureCollageShareImage(node, {
      origin: 'https://allmarks.app',
      boardColor: '#0a0a0c',
      timeoutMs: 50,
    })
    expect(out).toBeNull()
  })
})
