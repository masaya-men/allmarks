import { describe, it, expect } from 'vitest'
import { parseBookmarksFile, parseTagsFile, parseCardsFile, parseBoardConfigFile, parseVaultFile } from './snapshot-schema'

const VALID_BOOKMARK = {
  id: 'b1', url: 'https://example.com', title: 't', description: '', thumbnail: '', favicon: '',
  siteName: '', type: 'website', savedAt: '2026-01-01T00:00:00.000Z', ogpStatus: 'fetched', tags: [],
}
const VALID_TAG = { id: 'tag1', name: 'n', color: '#fff', order: 0, createdAt: 1 }
const VALID_CARD = {
  id: 'c1', bookmarkId: 'b1', folderId: 'f1', x: 0, y: 0, rotation: 0, scale: 1,
  zIndex: 1, gridIndex: 0, isManuallyPlaced: false, width: 100, height: 100,
}
const VALID_VAULT = {
  key: 'private-vault', tagId: 'tag1', salt: 's', iterations: 600000,
  publicKey: 'pk', wrappedPrivateKey: { iv: 'iv', ciphertext: 'ct' },
}

describe('snapshot-schema', () => {
  it('accepts a valid bookmarks array', () => {
    const result = parseBookmarksFile([VALID_BOOKMARK])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toHaveLength(1)
  })

  it('rejects a bookmarks payload that is not an array', () => {
    const result = parseBookmarksFile({ not: 'an array' })
    expect(result.ok).toBe(false)
  })

  it('rejects a bookmark missing a required field', () => {
    const { id: _id, ...broken } = VALID_BOOKMARK
    const result = parseBookmarksFile([broken])
    expect(result.ok).toBe(false)
  })

  it('keeps unknown extra fields on a bookmark (forward compatibility)', () => {
    const result = parseBookmarksFile([{ ...VALID_BOOKMARK, futureField: 'x' }])
    expect(result.ok).toBe(true)
    if (result.ok) expect((result.value[0] as unknown as Record<string, unknown>).futureField).toBe('x')
  })

  it('accepts a valid tags array', () => {
    expect(parseTagsFile([VALID_TAG]).ok).toBe(true)
  })

  it('accepts a valid cards array', () => {
    expect(parseCardsFile([VALID_CARD]).ok).toBe(true)
  })

  it('accepts a board-config file (loose inner config)', () => {
    const result = parseBoardConfigFile({ config: { themeId: 'dotted-notebook' }, updatedAt: 1 })
    expect(result.ok).toBe(true)
  })

  it('rejects a board-config file missing "config"', () => {
    expect(parseBoardConfigFile({ updatedAt: 1 }).ok).toBe(false)
  })

  it('accepts a valid vault file', () => {
    expect(parseVaultFile(VALID_VAULT).ok).toBe(true)
  })

  it('rejects a vault file with the wrong key literal', () => {
    expect(parseVaultFile({ ...VALID_VAULT, key: 'wrong' }).ok).toBe(false)
  })
})
