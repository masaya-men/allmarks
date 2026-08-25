import { describe, it, expect } from 'vitest'
import { resolvePrivateVisibility } from './resolve-visibility'
import { generateEcdhKeyPair, encryptWithPublicKey } from './crypto'
import type { BookmarkRecord } from '@/lib/storage/indexeddb'
import type { PrivateVaultSession } from './vault-session'

function makeBookmark(overrides: Partial<BookmarkRecord>): BookmarkRecord {
  return {
    id: 'b1', url: 'https://example.com', title: 't', description: '', thumbnail: '',
    favicon: '', siteName: '', type: 'website', savedAt: new Date().toISOString(),
    ogpStatus: 'fetched', tags: [], ...overrides,
  }
}

describe('private/resolve-visibility', () => {
  it('passes through untagged bookmarks unchanged regardless of lock state', async () => {
    const b = makeBookmark({ tags: [] })
    const result = await resolvePrivateVisibility([b], 'priv-1', null)
    expect(result).toEqual([b])
  })

  it('returns everything unchanged when no Private tag exists yet (privateTagId null)', async () => {
    const b = makeBookmark({ tags: ['other-tag'] })
    const result = await resolvePrivateVisibility([b], null, null)
    expect(result).toEqual([b])
  })

  it('drops Private-tagged bookmarks entirely when locked', async () => {
    const b = makeBookmark({
      tags: ['priv-1'], title: '',
      encryptedPayload: { ephemeralPublicKey: 'e', iv: 'x', ciphertext: 'y' },
    })
    const result = await resolvePrivateVisibility([b], 'priv-1', null)
    expect(result).toEqual([])
  })

  it('decrypts and overlays Private-tagged bookmarks when unlocked', async () => {
    const pair = await generateEcdhKeyPair()
    const session: PrivateVaultSession = { tagId: 'priv-1', privateKey: pair.privateKey }
    const encryptedPayload = await encryptWithPublicKey(pair.publicKey, {
      title: 'Real Title', url: 'https://secret.example', description: 'd', thumbnail: 'th', favicon: 'f', siteName: 's',
    })
    const b = makeBookmark({ tags: ['priv-1'], title: '', url: '', encryptedPayload })
    const [result] = await resolvePrivateVisibility([b], 'priv-1', session)
    expect(result.title).toBe('Real Title')
    expect(result.url).toBe('https://secret.example')
  })

  it('drops a Private-tagged bookmark that fails to decrypt (fail closed, not garbage)', async () => {
    const pair = await generateEcdhKeyPair()
    const wrongPair = await generateEcdhKeyPair()
    const session: PrivateVaultSession = { tagId: 'priv-1', privateKey: wrongPair.privateKey }
    const encryptedPayload = await encryptWithPublicKey(pair.publicKey, {
      title: 'x', url: 'y', description: '', thumbnail: '', favicon: '', siteName: '',
    })
    const b = makeBookmark({ tags: ['priv-1'], title: '', encryptedPayload })
    const result = await resolvePrivateVisibility([b], 'priv-1', session)
    expect(result).toEqual([])
  })

  it('drops a Private-tagged bookmark that has no encryptedPayload, even when unlocked (fail closed)', async () => {
    const pair = await generateEcdhKeyPair()
    const session: PrivateVaultSession = { tagId: 'priv-1', privateKey: pair.privateKey }
    const b = makeBookmark({ tags: ['priv-1'] })
    const result = await resolvePrivateVisibility([b], 'priv-1', session)
    expect(result).toEqual([])
  })
})
