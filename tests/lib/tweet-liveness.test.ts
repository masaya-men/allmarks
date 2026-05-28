import { describe, it, expect, vi } from 'vitest'
import { checkTweetLiveness, createCompositeFetcher } from '@/lib/board/tweet-liveness'
import type { Fetcher } from '@/lib/board/revalidate'

// Minimal response stub matching the LivenessFetch contract.
const res = (status: number, body?: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

describe('checkTweetLiveness', () => {
  it('maps HTTP 404 to gone (deleted / nonexistent)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(404))
    expect(await checkTweetLiveness('1', fetchImpl)).toEqual({ kind: 'gone' })
  })

  it('maps 200 + __typename:"Tweet" with id_str to alive', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(200, { __typename: 'Tweet', id_str: '20', text: 'hi' }))
    expect(await checkTweetLiveness('20', fetchImpl)).toEqual({ kind: 'alive' })
  })

  it('maps 200 + TweetTombstone to gone (suspended / protected / age-restricted)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(200, { __typename: 'TweetTombstone', tombstone: { text: {} } }))
    expect(await checkTweetLiveness('123', fetchImpl)).toEqual({ kind: 'gone' })
  })

  it('maps 200 + body with no __typename to gone', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(200, {}))
    expect(await checkTweetLiveness('123', fetchImpl)).toEqual({ kind: 'gone' })
  })

  it('maps 200 + Tweet WITHOUT id_str to gone (defensive)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(200, { __typename: 'Tweet' }))
    expect(await checkTweetLiveness('123', fetchImpl)).toEqual({ kind: 'gone' })
  })

  it('maps HTTP 5xx to unknown (transient)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(502))
    expect(await checkTweetLiveness('123', fetchImpl)).toEqual({ kind: 'unknown' })
  })

  it('maps a thrown fetch (network / timeout) to unknown', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network'))
    expect(await checkTweetLiveness('123', fetchImpl)).toEqual({ kind: 'unknown' })
  })

  it('queries the proxy with the encoded tweet id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(200, { __typename: 'Tweet', id_str: '20' }))
    await checkTweetLiveness('20', fetchImpl)
    expect(fetchImpl).toHaveBeenCalledWith('/api/tweet-meta?id=20')
  })
})

describe('createCompositeFetcher', () => {
  const ogp: Fetcher = async () => ({ kind: 'alive', data: { title: 'ogp' } })

  it('routes a tweet status URL to the liveness check, not OGP', async () => {
    const ogpSpy = vi.fn(ogp)
    const livenessFetch = vi.fn().mockResolvedValue(res(404))
    const fetcher = createCompositeFetcher(ogpSpy, livenessFetch)
    const result = await fetcher('https://x.com/jack/status/20')
    expect(result).toEqual({ kind: 'gone' })
    expect(ogpSpy).not.toHaveBeenCalled()
    expect(livenessFetch).toHaveBeenCalledWith('/api/tweet-meta?id=20')
  })

  it('delegates a non-tweet URL to the OGP fetcher', async () => {
    const ogpSpy = vi.fn(ogp)
    const livenessFetch = vi.fn()
    const fetcher = createCompositeFetcher(ogpSpy, livenessFetch)
    const result = await fetcher('https://example.com/article')
    expect(result).toEqual({ kind: 'alive', data: { title: 'ogp' } })
    expect(ogpSpy).toHaveBeenCalledWith('https://example.com/article')
    expect(livenessFetch).not.toHaveBeenCalled()
  })

  it('delegates an X URL with no tweet id (profile / home) to OGP', async () => {
    const ogpSpy = vi.fn(ogp)
    const livenessFetch = vi.fn()
    const fetcher = createCompositeFetcher(ogpSpy, livenessFetch)
    await fetcher('https://x.com/jack')
    expect(ogpSpy).toHaveBeenCalledWith('https://x.com/jack')
    expect(livenessFetch).not.toHaveBeenCalled()
  })
})
