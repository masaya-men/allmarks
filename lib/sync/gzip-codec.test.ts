import { describe, it, expect, afterEach } from 'vitest'
import { createStreamGzipCodec, getGzipCodec, setGzipCodecForTesting, looksGzipped, type GzipCodec } from './gzip-codec'

afterEach(() => { setGzipCodecForTesting(undefined) })

describe('gzip codec (CompressionStream / DecompressionStream)', () => {
  it('is available in this test environment (Node >= 18 exposes the streams on globalThis)', () => {
    expect(createStreamGzipCodec()).not.toBeNull()
  })

  it('round-trips JSON text, including multibyte characters', async () => {
    const codec = createStreamGzipCodec() as GzipCodec
    const text = JSON.stringify([{ id: 'a', title: '日本語のタイトル 🎨', tags: ['x'] }, { id: 'b', title: 'x'.repeat(5000) }])
    const bytes = await codec.compress(text)
    expect(looksGzipped(bytes)).toBe(true)
    expect(bytes.byteLength).toBeLessThan(new TextEncoder().encode(text).byteLength)
    expect(await codec.decompress(bytes)).toBe(text)
  })

  it('round-trips an empty string', async () => {
    const codec = createStreamGzipCodec() as GzipCodec
    expect(await codec.decompress(await codec.compress(''))).toBe('')
  })

  it('rejects corrupt gzip data', async () => {
    const codec = createStreamGzipCodec() as GzipCodec
    const bytes = await codec.compress('hello world, hello world')
    const broken = bytes.slice(0, bytes.byteLength - 6)
    await expect(codec.decompress(broken)).rejects.toBeDefined()
  })
})

describe('getGzipCodec / setGzipCodecForTesting', () => {
  it('uses the stream codec by default', () => {
    expect(getGzipCodec()).not.toBeNull()
  })

  it('can simulate a device without CompressionStream (null) and restore the default', () => {
    setGzipCodecForTesting(null)
    expect(getGzipCodec()).toBeNull()
    setGzipCodecForTesting(undefined)
    expect(getGzipCodec()).not.toBeNull()
  })

  it('accepts an injected codec', async () => {
    const fake: GzipCodec = {
      compress: async (t) => new TextEncoder().encode(t),
      decompress: async (b) => new TextDecoder().decode(b),
    }
    setGzipCodecForTesting(fake)
    expect(getGzipCodec()).toBe(fake)
  })
})

describe('looksGzipped', () => {
  it('checks the 1f 8b magic number', () => {
    expect(looksGzipped(new Uint8Array([0x1f, 0x8b, 0]))).toBe(true)
    expect(looksGzipped(new TextEncoder().encode('[]'))).toBe(false)
    expect(looksGzipped(new Uint8Array([0x1f]))).toBe(false)
  })
})
