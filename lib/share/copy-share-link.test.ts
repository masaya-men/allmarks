import { describe, it, expect, vi } from 'vitest'
import { copyShareLink } from './copy-share-link'
import type { ShareDataV2 } from './types-v2'

const share = { v: 2, cards: [], createdAt: 0 } as unknown as ShareDataV2

describe('copyShareLink', () => {
  it('copies origin + /s/<id> on success', async () => {
    const writeClipboard = vi.fn<(t: string) => Promise<void>>().mockResolvedValue(undefined)
    const res = await copyShareLink({
      buildShare: () => share,
      createShare: async () => ({ ok: true, data: { id: 'abc', expiresAt: 1 } }),
      writeClipboard,
      origin: 'https://allmarks.app',
    })
    expect(res).toEqual({ ok: true, url: 'https://allmarks.app/s/abc' })
    expect(writeClipboard).toHaveBeenCalledWith('https://allmarks.app/s/abc')
  })

  it('never generates an image (createShare receives share only, no thumb)', async () => {
    const createShare = vi.fn(async () => ({ ok: true as const, data: { id: 'x', expiresAt: 1 } }))
    await copyShareLink({ buildShare: () => share, createShare, writeClipboard: async () => {}, origin: 'https://allmarks.app' })
    expect(createShare).toHaveBeenCalledWith({ share })
  })

  it('returns not-ok when createShare fails', async () => {
    const res = await copyShareLink({
      buildShare: () => share,
      createShare: async () => ({ ok: false, error: 'server', message: 'boom' }),
      writeClipboard: async () => {},
      origin: 'https://allmarks.app',
    })
    expect(res).toEqual({ ok: false, message: 'boom' })
  })

  it('returns not-ok when clipboard write throws', async () => {
    const res = await copyShareLink({
      buildShare: () => share,
      createShare: async () => ({ ok: true, data: { id: 'abc', expiresAt: 1 } }),
      writeClipboard: async () => { throw new Error('denied') },
      origin: 'https://allmarks.app',
    })
    expect(res).toEqual({ ok: false, message: 'denied' })
  })

  it('returns not-ok when buildShare throws (button never freezes)', async () => {
    const createShare = vi.fn(async () => ({ ok: true as const, data: { id: 'x', expiresAt: 1 } }))
    const res = await copyShareLink({
      buildShare: () => { throw new Error('build failed') },
      createShare,
      writeClipboard: async () => {},
      origin: 'https://allmarks.app',
    })
    expect(res).toEqual({ ok: false, message: 'build failed' })
    expect(createShare).not.toHaveBeenCalled()
  })
})
