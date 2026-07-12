import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  coverRect,
  mapBandToOutput,
  renderCollageCanvasToJpeg,
  type CollageCanvasCard,
  type RenderCollageCanvasInput,
} from './collage-canvas-render'

describe('coverRect', () => {
  it('should crop vertically for square image into landscape dst', () => {
    // Square image 100x100 into landscape dst 1200x630
    // scale = max(1200/100, 630/100) = max(12, 6.3) = 12
    // sw = 1200/12 = 100
    // sh = 630/12 = 52.5
    // sx = (100 - 100)/2 = 0
    // sy = (100 - 52.5)/2 = 23.75
    const result = coverRect(100, 100, 1200, 630)
    expect(result.sx).toBe(0)
    expect(result.sy).toBe(23.75)
    expect(result.sw).toBe(100)
    expect(result.sh).toBe(52.5)
  })

  it('should crop horizontally for wide image into landscape dst', () => {
    // Wide image 200x100 into landscape dst 1200x630
    // scale = max(1200/200, 630/100) = max(6, 6.3) = 6.3
    // sw = 1200/6.3 ≈ 190.476...
    // sh = 630/6.3 = 100
    // sx = (200 - 190.476...)/2 ≈ 4.762...
    // sy = (100 - 100)/2 = 0
    const result = coverRect(200, 100, 1200, 630)
    expect(result.sx).toBeCloseTo(4.762, 2)
    expect(result.sy).toBe(0)
    expect(result.sw).toBeCloseTo(190.476, 2)
    expect(result.sh).toBe(100)
  })

  it('should handle edge case with zero dimensions by returning safe zero rect', () => {
    // Edge case: zero image dimension
    const result1 = coverRect(0, 100, 1200, 630)
    expect(result1.sx).toBe(0)
    expect(result1.sy).toBe(0)
    expect(result1.sw).toBe(0)
    expect(result1.sh).toBe(0)

    // Edge case: zero dst dimension
    const result2 = coverRect(100, 100, 0, 630)
    expect(result2.sx).toBe(0)
    expect(result2.sy).toBe(0)
    expect(result2.sw).toBe(0)
    expect(result2.sh).toBe(0)
  })
})

describe('mapBandToOutput', () => {
  it('should map rect in band-space to output (1200x630) with offset and scale', () => {
    // band with non-zero offset
    // band = {x: 40, y: 120, width: 1200, height: 628}
    // pos = {x: 100, y: 200, w: 200, h: 100}
    // outW = 1200, outH = 630
    // sx = 1200/1200 = 1
    // sy = 630/628 ≈ 1.00318...
    // x = (100 - 40) * 1 = 60
    // y = (200 - 120) * 1.00318... ≈ 80.254...
    // w = 200 * 1 = 200
    // h = 100 * 1.00318... ≈ 100.318...
    const result = mapBandToOutput(
      { x: 100, y: 200, w: 200, h: 100 },
      { x: 40, y: 120, width: 1200, height: 628 },
      1200,
      630
    )
    expect(result.x).toBe(60)
    expect(result.y).toBeCloseTo(80.254, 2)
    expect(result.w).toBe(200)
    expect(result.h).toBeCloseTo(100.318, 2)
  })

  it('should handle pos at band origin', () => {
    // pos at band origin (x, y) = band origin
    // band = {x: 40, y: 120, width: 1200, height: 628}
    // pos = {x: 40, y: 120, w: 100, h: 100}
    // outW = 1200, outH = 630
    // sx = 1200/1200 = 1
    // sy = 630/628 ≈ 1.00318...
    // x = (40 - 40) * 1 = 0
    // y = (120 - 120) * 1.00318... = 0
    // w = 100 * 1 = 100
    // h = 100 * 1.00318... ≈ 100.318...
    const result = mapBandToOutput(
      { x: 40, y: 120, w: 100, h: 100 },
      { x: 40, y: 120, width: 1200, height: 628 },
      1200,
      630
    )
    expect(result.x).toBe(0)
    expect(result.y).toBeCloseTo(0, 2)
    expect(result.w).toBe(100)
    expect(result.h).toBeCloseTo(100.318, 2)
  })

  it('should apply ~1.91:1 scaling correctly for 1200x630 output', () => {
    // band exactly 1200x628 (≈1.91:1)
    // pos small rect at (600, 314, 100, 100)
    // outW = 1200, outH = 630
    // sx = 1200/1200 = 1
    // sy = 630/628 ≈ 1.00318...
    // y = (314 - 0) * 1.00318... ≈ 315.000...
    // h = 100 * 1.00318... ≈ 100.318...
    const result = mapBandToOutput(
      { x: 600, y: 314, w: 100, h: 100 },
      { x: 0, y: 0, width: 1200, height: 628 },
      1200,
      630
    )
    expect(result.x).toBe(600)
    expect(result.y).toBeCloseTo(315, 1)
    expect(result.w).toBe(100)
    expect(result.h).toBeCloseTo(100.318, 2)
  })
})

// jsdom implements no real canvas 2d context, so renderCollageCanvasToJpeg always
// hits the `if (!ctx) return null` early exit in THIS suite. What matters here is
// the safety CONTRACT: capture must never throw / never reject, even for inputs
// that would normally involve image loads and drawing — a thrown error would
// break the caller's ability to still create a share link. The per-card draw
// loop itself (cover-fit, proxy routing, off-screen skip, placeholder fallback)
// is NOT exercised by this suite — see the "mock 2d context" suite below, which
// stubs a fake canvas context so the loop actually runs. Pixel-level rasterizing
// is still verified on-device only (Task 5/7); jsdom cannot rasterize a canvas.
describe('renderCollageCanvasToJpeg (never-throw / graceful-null contract, ctx-less jsdom path)', () => {
  const band = { x: 0, y: 0, width: 1200, height: 628 }
  const toProxyUrl = (src: string): string => `/api/img?u=${encodeURIComponent(src)}`

  const baseInput = {
    band,
    width: 1200,
    height: 630,
    bgColor: '#0a0a0c',
    roundedCornersPx: 20,
    toProxyUrl,
    targetBytes: 180 * 1024,
    startQuality: 0.82,
    minQuality: 0.4,
  } as const

  it('resolves null (never throws) for a normal multi-card input', async () => {
    const cards: CollageCanvasCard[] = [
      {
        id: 'a',
        title: 'Card A',
        thumbnailUrl: 'https://example.com/a.jpg',
        url: 'https://example.com/a',
        rect: { x: 0, y: 0, w: 300, h: 200 },
      },
      {
        id: 'b',
        title: 'Card B with no thumbnail falls back to placeholder art',
        thumbnailUrl: null,
        url: 'https://example.com/b',
        rect: { x: 320, y: 0, w: 300, h: 200 },
      },
      {
        id: 'c',
        title: 'Off-screen card should be skipped',
        thumbnailUrl: 'https://example.com/c.jpg',
        url: 'https://example.com/c',
        rect: { x: -5000, y: -5000, w: 100, h: 100 },
      },
    ]
    const input: RenderCollageCanvasInput = { ...baseInput, cards }

    await expect(renderCollageCanvasToJpeg(input)).resolves.toBeNull()
  })

  it('resolves null (never throws) for an empty cards array', async () => {
    const input: RenderCollageCanvasInput = { ...baseInput, cards: [] }

    await expect(renderCollageCanvasToJpeg(input)).resolves.toBeNull()
  })

  it('resolves null (never throws) when toProxyUrl throws, given the ctx-less jsdom early exit', async () => {
    // NOTE: under jsdom, `if (!ctx) return null` fires before the per-card loop
    // ever runs, so a throwing toProxyUrl here never actually reaches the loop —
    // this only proves the ctx-less early-return path is safe. The genuine
    // "throws mid-loop, caught, resolves null" behavior is covered below in the
    // mock-ctx suite, where the loop is actually reached.
    const cards: CollageCanvasCard[] = [
      {
        id: 'a',
        title: 'Card A',
        thumbnailUrl: 'https://example.com/a.jpg',
        url: 'https://example.com/a',
        rect: { x: 0, y: 0, w: 300, h: 200 },
      },
    ]
    const input: RenderCollageCanvasInput = {
      ...baseInput,
      cards,
      toProxyUrl: (): string => {
        throw new Error('boom')
      },
    }

    await expect(renderCollageCanvasToJpeg(input)).resolves.toBeNull()
  })
})

// The suite above only ever reaches `if (!ctx) return null` — jsdom has no real
// canvas 2d context, so the per-card draw loop (cover-fit, proxy routing,
// off-screen skip, placeholder fallback) had ZERO coverage. This suite stubs
// document.createElement('canvas') to return a spy-backed fake 2D context (same
// idea as capture-collage.test.ts's InstantImage stub for `new Image()`, applied
// here to the canvas side too) so the loop actually runs and its control flow can
// be asserted directly. `canvas.toBlob` is intentionally left unimplemented, so
// the final encode step still resolves null — only the DRAW-LOOP behavior is
// under test here, independent of the final encoded output.
describe('renderCollageCanvasToJpeg (mock 2d context — draw loop coverage)', () => {
  type FakeCtx2D = {
    save: ReturnType<typeof vi.fn>
    restore: ReturnType<typeof vi.fn>
    fillRect: ReturnType<typeof vi.fn>
    drawImage: ReturnType<typeof vi.fn>
    clip: ReturnType<typeof vi.fn>
    beginPath: ReturnType<typeof vi.fn>
    moveTo: ReturnType<typeof vi.fn>
    arcTo: ReturnType<typeof vi.fn>
    closePath: ReturnType<typeof vi.fn>
    fillText: ReturnType<typeof vi.fn>
    measureText: ReturnType<typeof vi.fn>
    createLinearGradient: ReturnType<typeof vi.fn>
    fillStyle: string
    font: string
    textAlign: string
    textBaseline: string
  }

  function makeFakeCtx(): FakeCtx2D {
    return {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      clip: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      arcTo: vi.fn(),
      closePath: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn((s: string) => ({ width: s.length * 6 })),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
    }
  }

  // Records `start:<src>` when an Image's src is set and `end:<src>` right
  // before its onload fires (in a queued microtask, like capture-collage.test.ts's
  // InstantImage) — lets a test prove the per-card loop truly awaits each image
  // one at a time (sequential `start,end,start,end`) rather than firing all loads
  // in parallel (which would interleave as `start,start,end,end`).
  let loadEvents: string[] = []
  class SequentialImage {
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    naturalWidth = 400
    naturalHeight = 300
    crossOrigin = ''
    private _src = ''
    get src(): string {
      return this._src
    }
    set src(v: string) {
      this._src = v
      loadEvents.push(`start:${v}`)
      queueMicrotask((): void => {
        loadEvents.push(`end:${v}`)
        this.onload?.()
      })
    }
  }

  let fakeCtx: FakeCtx2D

  beforeEach(() => {
    loadEvents = []
    fakeCtx = makeFakeCtx()
    vi.stubGlobal('Image', SequentialImage)
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: unknown) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: vi.fn(() => fakeCtx as unknown as CanvasRenderingContext2D),
          // toBlob intentionally absent: canvasToJpeg's `typeof toBlob !== 'function'`
          // guard makes the final encode resolve null — irrelevant to this suite.
        } as unknown as HTMLCanvasElement
      }
      return realCreateElement(tagName as keyof HTMLElementTagNameMap, options as ElementCreationOptions)
    }) as typeof document.createElement)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  const band = { x: 0, y: 0, width: 1200, height: 630 }
  const baseInput = {
    band,
    width: 1200,
    height: 630,
    bgColor: '#0a0a0c',
    roundedCornersPx: 20,
    targetBytes: 180 * 1024,
    startQuality: 0.82,
    minQuality: 0.4,
  } as const

  it('(a) draws each on-screen thumbnailed card — the loop runs, and images load sequentially not in parallel', async () => {
    const toProxyUrl = vi.fn((src: string): string => `/api/img?u=${encodeURIComponent(src)}`)
    const cards: CollageCanvasCard[] = [
      {
        id: 'a',
        title: 'Card A',
        thumbnailUrl: 'https://example.com/a.jpg',
        url: 'https://example.com/a',
        rect: { x: 0, y: 0, w: 300, h: 200 },
      },
      {
        id: 'b',
        title: 'Card B',
        thumbnailUrl: 'https://example.com/b.jpg',
        url: 'https://example.com/b',
        rect: { x: 320, y: 0, w: 300, h: 200 },
      },
    ]
    const input: RenderCollageCanvasInput = { ...baseInput, toProxyUrl, cards }

    await renderCollageCanvasToJpeg(input)

    // Both cards actually reached ctx.drawImage — the loop ran, not just the
    // early `if (!ctx) return null` exit.
    expect(fakeCtx.drawImage).toHaveBeenCalledTimes(2)

    const proxiedA = '/api/img?u=' + encodeURIComponent('https://example.com/a.jpg')
    const proxiedB = '/api/img?u=' + encodeURIComponent('https://example.com/b.jpg')
    // Sequential: card B's image load does not START until card A's has fully
    // ENDed. A Promise.all-style parallel implementation would produce
    // [start:A, start:B, end:A, end:B] instead — this ordering is exactly the
    // "one at a time" memory-safety contract the renderer's docstring promises.
    expect(loadEvents).toEqual([`start:${proxiedA}`, `end:${proxiedA}`, `start:${proxiedB}`, `end:${proxiedB}`])
  })

  it('(b) routes a thumbnailed card through toProxyUrl, and does NOT proxy a card with no thumbnail', async () => {
    const toProxyUrl = vi.fn((src: string): string => `/api/img?u=${encodeURIComponent(src)}`)
    const cards: CollageCanvasCard[] = [
      {
        id: 'a',
        title: 'Card A',
        thumbnailUrl: 'https://example.com/a.jpg',
        url: 'https://example.com/a',
        rect: { x: 0, y: 0, w: 300, h: 200 },
      },
      {
        id: 'b',
        title: 'Card B no thumbnail',
        thumbnailUrl: null,
        url: 'https://example.com/b',
        rect: { x: 320, y: 0, w: 300, h: 200 },
      },
    ]
    const input: RenderCollageCanvasInput = { ...baseInput, toProxyUrl, cards }

    await renderCollageCanvasToJpeg(input)

    expect(toProxyUrl).toHaveBeenCalledTimes(1)
    expect(toProxyUrl).toHaveBeenCalledWith('https://example.com/a.jpg')
  })

  it('(c) skips a fully off-screen card entirely: no drawImage and no proxy call for it', async () => {
    const toProxyUrl = vi.fn((src: string): string => `/api/img?u=${encodeURIComponent(src)}`)
    const cards: CollageCanvasCard[] = [
      {
        id: 'onscreen',
        title: 'Visible card',
        thumbnailUrl: 'https://example.com/vis.jpg',
        url: 'https://example.com/vis',
        rect: { x: 0, y: 0, w: 300, h: 200 },
      },
      {
        id: 'off',
        title: 'Off-screen card',
        thumbnailUrl: 'https://example.com/off.jpg',
        url: 'https://example.com/off',
        // Fully outside the 1200x630 output — mapBandToOutput leaves it far negative.
        rect: { x: -5000, y: -5000, w: 100, h: 100 },
      },
    ]
    const input: RenderCollageCanvasInput = { ...baseInput, toProxyUrl, cards }

    await renderCollageCanvasToJpeg(input)

    // Only the on-screen card reached drawImage / the proxy — the off-screen
    // card's `return` before any image load fired.
    expect(fakeCtx.drawImage).toHaveBeenCalledTimes(1)
    expect(toProxyUrl).toHaveBeenCalledTimes(1)
    expect(toProxyUrl).toHaveBeenCalledWith('https://example.com/vis.jpg')
    expect(toProxyUrl).not.toHaveBeenCalledWith('https://example.com/off.jpg')
  })

  it('(d) still draws a no-thumbnail card via the placeholder-art branch, not a silent no-op', async () => {
    const toProxyUrl = vi.fn((src: string): string => `/api/img?u=${encodeURIComponent(src)}`)
    const cards: CollageCanvasCard[] = [
      {
        id: 'noThumb',
        title: 'No thumbnail card',
        thumbnailUrl: null,
        url: 'https://example.com/no-thumb',
        rect: { x: 0, y: 0, w: 300, h: 200 },
      },
    ]
    const input: RenderCollageCanvasInput = { ...baseInput, toProxyUrl, cards }

    await renderCollageCanvasToJpeg(input)

    // Placeholder art image drew (drawImage fires for the generated-art image),
    // and its scrim gradient (readability treatment) ran too — this card was not
    // silently skipped just because it has no thumbnail.
    expect(fakeCtx.drawImage).toHaveBeenCalledTimes(1)
    expect(fakeCtx.createLinearGradient).toHaveBeenCalledTimes(1)
    // Placeholder art is a same-origin static asset — never routed through the proxy.
    expect(toProxyUrl).not.toHaveBeenCalled()
  })

  it('(e) never rejects when toProxyUrl throws INSIDE the per-card loop (loop is actually reached here)', async () => {
    // Unlike the ctx-less suite above, the loop genuinely runs here (ctx is
    // truthy), so a throwing toProxyUrl exercises the real catch path: drawCard
    // throws synchronously while building the proxied URL, the awaited drawCard
    // promise rejects, and the outer try/catch in renderCollageCanvasToJpeg must
    // still resolve null instead of propagating an unhandled rejection.
    const cards: CollageCanvasCard[] = [
      {
        id: 'a',
        title: 'Card A',
        thumbnailUrl: 'https://example.com/a.jpg',
        url: 'https://example.com/a',
        rect: { x: 0, y: 0, w: 300, h: 200 },
      },
    ]
    const input: RenderCollageCanvasInput = {
      ...baseInput,
      cards,
      toProxyUrl: (): string => {
        throw new Error('boom')
      },
    }

    await expect(renderCollageCanvasToJpeg(input)).resolves.toBeNull()
    // The throw happened before any drawImage for this card could run.
    expect(fakeCtx.drawImage).not.toHaveBeenCalled()
  })
})
