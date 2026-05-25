import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import {
  useTweetVideoFrames,
  __resetTweetVideoFramesForTests,
} from '@/lib/board/use-tweet-video-frames'
import { extractVideoFrames } from '@/lib/board/extract-video-frames'

vi.mock('@/lib/board/extract-video-frames', () => ({
  extractVideoFrames: vi.fn(),
  // computeSeekSeconds is also exported from the same module; the hook doesn't
  // call it directly but the mock factory must replace EVERY named export.
  computeSeekSeconds: vi.fn(),
}))

const mockExtract = vi.mocked(extractVideoFrames)

const URL_A = 'https://video.twimg.com/a.mp4'
const URL_B = 'https://video.twimg.com/b.mp4'
const URL_C = 'https://video.twimg.com/c.mp4'

describe('useTweetVideoFrames', () => {
  beforeEach(() => {
    __resetTweetVideoFramesForTests()
    mockExtract.mockReset()
  })

  it('returns [] until extraction succeeds, then the 3 data URLs', async () => {
    mockExtract.mockResolvedValueOnce(['a', 'b', 'c'])
    const { result } = renderHook(() =>
      useTweetVideoFrames('id1', URL_A, true),
    )
    expect(result.current).toEqual([])
    await waitFor(() => expect(result.current).toEqual(['a', 'b', 'c']))
    expect(mockExtract).toHaveBeenCalledOnce()
    expect(mockExtract).toHaveBeenCalledWith({
      src: `/api/tweet-video?url=${encodeURIComponent(URL_A)}`,
      fractions: [0, 0.25, 0.5],
    })
  })

  it('returns cached frames instantly on a second hook with the same id', async () => {
    mockExtract.mockResolvedValueOnce(['a', 'b', 'c'])
    const first = renderHook(() => useTweetVideoFrames('id2', URL_A, true))
    await waitFor(() => expect(first.result.current.length).toBe(3))

    mockExtract.mockClear()
    const second = renderHook(() => useTweetVideoFrames('id2', URL_A, true))
    expect(second.result.current).toEqual(['a', 'b', 'c'])
    expect(mockExtract).not.toHaveBeenCalled()
  })

  it('does nothing while enabled=false (cards out of view do not decode)', async () => {
    mockExtract.mockResolvedValueOnce(['a', 'b', 'c'])
    const { result } = renderHook(() =>
      useTweetVideoFrames('id3', URL_A, false),
    )
    expect(result.current).toEqual([])
    // Give microtasks a tick; the hook must NOT have invoked the extractor.
    await act(async () => { await Promise.resolve() })
    expect(mockExtract).not.toHaveBeenCalled()
  })

  it('runs extractions one at a time — later cards wait for the slot', async () => {
    const resolvers: Array<(v: readonly string[]) => void> = []
    mockExtract.mockImplementation(
      () => new Promise<readonly string[]>((resolve) => { resolvers.push(resolve) }),
    )

    renderHook(() => useTweetVideoFrames('id4', URL_A, true))
    renderHook(() => useTweetVideoFrames('id5', URL_B, true))
    renderHook(() => useTweetVideoFrames('id6', URL_C, true))

    // Only the first runs immediately; the rest are queued.
    await waitFor(() => expect(mockExtract).toHaveBeenCalledTimes(1))

    // Let the first finish — the second must now start.
    await act(async () => {
      resolvers[0]?.(['a1', 'a2', 'a3'])
      await Promise.resolve()
      await Promise.resolve()
    })
    await waitFor(() => expect(mockExtract).toHaveBeenCalledTimes(2))

    // ...and the same again for the third.
    await act(async () => {
      resolvers[1]?.(['b1', 'b2', 'b3'])
      await Promise.resolve()
      await Promise.resolve()
    })
    await waitFor(() => expect(mockExtract).toHaveBeenCalledTimes(3))

    // Drain the final pending promise so vitest doesn't hang on teardown.
    resolvers[2]?.(['c1', 'c2', 'c3'])
  })

  it('keeps frames=[] on extraction failure (poster-only fallback)', async () => {
    mockExtract.mockRejectedValueOnce(new Error('decode failed'))
    const { result } = renderHook(() =>
      useTweetVideoFrames('id7', URL_A, true),
    )
    expect(result.current).toEqual([])
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(result.current).toEqual([])
  })
})
