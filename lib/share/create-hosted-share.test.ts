import { describe, it, expect, vi } from 'vitest'
import { createHostedShare } from './create-hosted-share'
import type { ShareDataV2 } from './types-v2'

const share = { v: 2, cards: [], createdAt: 0 } as unknown as ShareDataV2

describe('createHostedShare', () => {
  it('creates WITH thumb, returns /s and /og urls, and warms the og url', async () => {
    const createShare = vi.fn().mockResolvedValue({ ok: true, data: { id: 'k3p9xv', expiresAt: 1 } })
    const warm = vi.fn()
    const r = await createHostedShare({
      buildShare: () => share,
      thumb: 'data:image/jpeg;base64,AAAA',
      createShare,
      origin: 'https://allmarks.app',
      warm,
    })
    expect(createShare).toHaveBeenCalledWith({ share, thumb: 'data:image/jpeg;base64,AAAA' })
    expect(r).toEqual({ ok: true, url: 'https://allmarks.app/s/k3p9xv', ogUrl: 'https://allmarks.app/og/k3p9xv.jpg' })
    expect(warm).toHaveBeenCalledWith('https://allmarks.app/og/k3p9xv.jpg')
  })

  it('creates WITHOUT thumb (no image attached) — still returns urls', async () => {
    const createShare = vi.fn().mockResolvedValue({ ok: true, data: { id: 'abc123', expiresAt: 1 } })
    const r = await createHostedShare({ buildShare: () => share, createShare, origin: 'https://allmarks.app' })
    expect(createShare).toHaveBeenCalledWith({ share })
    expect(r).toEqual({ ok: true, url: 'https://allmarks.app/s/abc123', ogUrl: 'https://allmarks.app/og/abc123.jpg' })
  })

  it('surfaces a buildShare throw as ok:false without calling createShare', async () => {
    const createShare = vi.fn()
    const r = await createHostedShare({ buildShare: () => { throw new Error('boom') }, createShare, origin: 'x' })
    expect(r).toEqual({ ok: false, message: 'boom' })
    expect(createShare).not.toHaveBeenCalled()
  })

  it('surfaces a createShare failure message', async () => {
    const createShare = vi.fn().mockResolvedValue({ ok: false, error: 'server', message: 'too big' })
    const r = await createHostedShare({ buildShare: () => share, createShare, origin: 'x' })
    expect(r).toEqual({ ok: false, message: 'too big' })
  })
})
