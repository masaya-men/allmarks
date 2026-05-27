// jsdom では canvas / Image の本格動作が無いため、 null 返却・early-return 経路のみ確認。
// 実描画の動作確認は playwright integration test で別途実施 (= Task 7)。
import { describe, it, expect } from 'vitest'
import { captureMirrorToWebP, type MirrorCaptureInput } from './capture-mirror'
import { SHARE_SCHEMA_VERSION_V2, type ShareDataV2 } from './types-v2'

const minimalShare: ShareDataV2 = {
  v: SHARE_SCHEMA_VERSION_V2,
  cards: [
    { u: 'https://example.com/a', t: 'a', ty: 'website', cw: 240, a: 1.6 },
  ],
  createdAt: Date.now(),
}

const baseInput = {
  shareData: minimalShare,
  activeTagNames: [],
  totalBoardCount: 1,
  width: 1200,
  height: 628,
  quality: 0.85,
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
