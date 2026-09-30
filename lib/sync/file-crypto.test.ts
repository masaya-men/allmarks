import { describe, it, expect } from 'vitest'
import {
  deriveSyncFileKey, deriveSyncKeyHint, isSealed, sealSyncFile, openSyncFile,
  SyncKeyMismatchError, SyncSealOpenError, SEAL_MAGIC,
} from './file-crypto'

const enc = new TextEncoder()

async function ctx(kid: string): Promise<{ key: CryptoKey; keyHint: Uint8Array }> {
  return { key: await deriveSyncFileKey(kid), keyHint: await deriveSyncKeyHint(kid) }
}

describe('file-crypto', () => {
  it('round-trips and starts with the magic', async () => {
    const a = await ctx('kid-1')
    const plain = enc.encode('hello world')
    const sealed = await sealSyncFile(a.key, a.keyHint, 'tags.json.gz', plain)
    expect(isSealed(sealed)).toBe(true)
    expect(new TextDecoder().decode(sealed.slice(0, SEAL_MAGIC.length))).toBe('AMSE1')
    expect(Array.from(await openSyncFile(a.key, a.keyHint, 'tags.json.gz', sealed))).toEqual(Array.from(plain))
  })

  it('isSealed is false for gzip / plain bytes', () => {
    expect(isSealed(new Uint8Array([0x1f, 0x8b, 8, 0]))).toBe(false)
    expect(isSealed(enc.encode('[]'))).toBe(false)
  })

  it('same kid derives the same key on two "devices"', async () => {
    const a = await ctx('kid-1')
    const b = { key: await deriveSyncFileKey('kid-1'), keyHint: await deriveSyncKeyHint('kid-1') }
    const sealed = await sealSyncFile(a.key, a.keyHint, 'x.json.gz', enc.encode('data'))
    expect(new TextDecoder().decode(await openSyncFile(b.key, b.keyHint, 'x.json.gz', sealed))).toBe('data')
  })

  it('a different kid throws SyncKeyMismatchError', async () => {
    const a = await ctx('kid-1')
    const b = await ctx('kid-2')
    const sealed = await sealSyncFile(a.key, a.keyHint, 'x.json.gz', enc.encode('data'))
    await expect(openSyncFile(b.key, b.keyHint, 'x.json.gz', sealed)).rejects.toBeInstanceOf(SyncKeyMismatchError)
  })

  it('a tampered byte throws SyncSealOpenError', async () => {
    const a = await ctx('kid-1')
    const sealed = await sealSyncFile(a.key, a.keyHint, 'x.json.gz', enc.encode('data'))
    sealed[sealed.length - 1] ^= 0xff
    await expect(openSyncFile(a.key, a.keyHint, 'x.json.gz', sealed)).rejects.toBeInstanceOf(SyncSealOpenError)
  })

  it('a swapped file name throws SyncSealOpenError (AAD = name)', async () => {
    const a = await ctx('kid-1')
    const sealed = await sealSyncFile(a.key, a.keyHint, 'bookmarks-0.json.gz', enc.encode('data'))
    await expect(openSyncFile(a.key, a.keyHint, 'bookmarks-1.json.gz', sealed)).rejects.toBeInstanceOf(SyncSealOpenError)
  })

  it('a truncated envelope throws SyncSealOpenError', async () => {
    const a = await ctx('kid-1')
    const sealed = await sealSyncFile(a.key, a.keyHint, 'x.json.gz', enc.encode('data'))
    await expect(openSyncFile(a.key, a.keyHint, 'x.json.gz', sealed.slice(0, 10))).rejects.toBeInstanceOf(SyncSealOpenError)
  })
})
