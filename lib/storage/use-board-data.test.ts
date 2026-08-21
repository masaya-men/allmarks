import { describe, it, expect, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { renderHook, waitFor } from '@testing-library/react'
import { computeAspectRatio, deriveThumbnail, useBoardData } from './use-board-data'
import { initDB, addBookmark } from './indexeddb'
import type { BookmarkRecord, CardRecord } from './indexeddb'
import { setPrivateVaultSession } from '@/lib/private/vault-session'
import { encryptJson, deriveKey, generateSalt } from '@/lib/private/crypto'

const baseBookmark: BookmarkRecord = {
  id: 'b1',
  url: 'https://example.com/article',
  title: 'Article',
  description: '',
  thumbnail: '',
  favicon: '',
  siteName: 'Example',
  type: 'website',
  savedAt: '2026-04-19T00:00:00Z',
  folderId: 'root',
  ogpStatus: 'fetched',
  tags: ['root'],
}

const baseCard: CardRecord = {
  id: 'c1',
  bookmarkId: 'b1',
  folderId: 'root',
  x: 0,
  y: 0,
  rotation: 0,
  scale: 1,
  zIndex: 0,
  gridIndex: 0,
  isManuallyPlaced: false,
  width: 240,
  height: 320,
}

describe('computeAspectRatio priority chain', () => {
  it('priority 1: user-resized card returns width/height', () => {
    const c: CardRecord = { ...baseCard, width: 400, height: 200, isUserResized: true, aspectRatio: 0.5 }
    expect(computeAspectRatio(baseBookmark, c)).toBe(2)
  })

  it('priority 1 skipped when width/height are zero → falls to cached ratio', () => {
    const c: CardRecord = { ...baseCard, width: 0, height: 0, isUserResized: true, aspectRatio: 1.5 }
    expect(computeAspectRatio(baseBookmark, c)).toBe(1.5)
  })

  it('priority 2: cached aspectRatio wins when not user-resized', () => {
    const c: CardRecord = { ...baseCard, width: 100, height: 100, isUserResized: false, aspectRatio: 1.77 }
    expect(computeAspectRatio(baseBookmark, c)).toBe(1.77)
  })

  it('priority 3: falls back to estimator when no card record', () => {
    const ratio = computeAspectRatio(baseBookmark, undefined)
    expect(typeof ratio).toBe('number')
    expect(ratio).toBeGreaterThan(0)
  })

  it('priority 3: YouTube URL estimates 16:9 when no cached ratio', () => {
    const youtubeBookmark: BookmarkRecord = {
      ...baseBookmark,
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      type: 'youtube',
    }
    const c: CardRecord = { ...baseCard, isUserResized: false, aspectRatio: 0 }
    expect(computeAspectRatio(youtubeBookmark, c)).toBeCloseTo(16 / 9, 2)
  })
})

describe('deriveThumbnail', () => {
  it('prefers the per-video YouTube CDN thumbnail over a captured og:image', () => {
    // The saved og:image is YouTube's generic white logo — we must ignore it
    // and use the real per-video thumbnail (which is what the board shows).
    const yt: BookmarkRecord = {
      ...baseBookmark,
      url: 'https://www.youtube.com/watch?v=ir_PRErPnb0',
      type: 'youtube',
      thumbnail: 'https://example.com/generic-youtube-logo.png',
    }
    expect(deriveThumbnail(yt)).toBe('https://i.ytimg.com/vi/ir_PRErPnb0/hqdefault.jpg')
  })

  it('derives the CDN thumbnail for YouTube Shorts too', () => {
    const short: BookmarkRecord = {
      ...baseBookmark,
      url: 'https://www.youtube.com/shorts/lXuk3GAQMmg',
      type: 'youtube',
      thumbnail: '',
    }
    expect(deriveThumbnail(short)).toBe('https://i.ytimg.com/vi/lXuk3GAQMmg/hqdefault.jpg')
  })

  it('keeps the captured thumbnail for non-YouTube bookmarks', () => {
    const site: BookmarkRecord = { ...baseBookmark, thumbnail: 'https://example.com/og.png' }
    expect(deriveThumbnail(site)).toBe('https://example.com/og.png')
  })

  it('returns undefined for a non-YouTube bookmark with no thumbnail', () => {
    expect(deriveThumbnail({ ...baseBookmark, thumbnail: '' })).toBeUndefined()
  })
})

describe('useBoardData — Private vault locked exclusion + decrypt overlay', () => {
  afterEach(async () => {
    setPrivateVaultSession(null)
    const databases = await indexedDB.databases()
    for (const info of databases) {
      if (info.name) indexedDB.deleteDatabase(info.name)
    }
  })

  it('items excludes a bookmark tagged with privateTagId while locked', async () => {
    const database = await initDB()
    await addBookmark(database, {
      url: 'https://example.com/normal', title: 'Normal', description: '',
      thumbnail: '', favicon: '', siteName: '', type: 'website',
    })
    const priv = await addBookmark(database, {
      url: 'https://example.com/secret', title: 'placeholder', description: '',
      thumbnail: '', favicon: '', siteName: '', type: 'website',
      tags: ['priv-1'],
    })
    // Mirror apply-tag-change's shape: plaintext fields blanked, real content
    // moved into encryptedPayload.
    await database.put('bookmarks', {
      ...priv,
      title: '', url: '', description: '', thumbnail: '', favicon: '', siteName: '',
      encryptedPayload: { iv: 'x', ciphertext: 'y' },
    })

    const { result } = renderHook(() => useBoardData('priv-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items.some((i) => i.tags.includes('priv-1'))).toBe(false)
  })

  it('items includes the decrypted bookmark once the vault session is set, and drops it again once cleared', async () => {
    const database = await initDB()
    const key = await deriveKey('pw', generateSalt(), 1000)
    const encryptedPayload = await encryptJson(key, {
      title: 'Real', url: 'https://secret.example', description: '', thumbnail: '', favicon: '', siteName: '',
    })
    const priv = await addBookmark(database, {
      url: 'https://example.com/secret', title: 'placeholder', description: '',
      thumbnail: '', favicon: '', siteName: '', type: 'website',
      tags: ['priv-1'],
    })
    await database.put('bookmarks', {
      ...priv, title: '', url: '', encryptedPayload,
    })

    setPrivateVaultSession({ tagId: 'priv-1', key })
    const { result } = renderHook(() => useBoardData('priv-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items.find((i) => i.tags.includes('priv-1'))?.title).toBe('Real')

    setPrivateVaultSession(null)
    await waitFor(() => expect(result.current.items.some((i) => i.tags.includes('priv-1'))).toBe(false))
  })
})

describe('persistThumbnail / persistTitle — Private (encrypted) record guard', () => {
  afterEach(async () => {
    setPrivateVaultSession(null)
    const databases = await indexedDB.databases()
    for (const info of databases) {
      if (info.name) indexedDB.deleteDatabase(info.name)
    }
  })

  it('persistThumbnail is a no-op on a Private (encrypted) record', async () => {
    const database = await initDB()
    const priv = await addBookmark(database, {
      url: 'https://example.com/secret', title: 'placeholder', description: '',
      thumbnail: '', favicon: '', siteName: '', type: 'website',
      tags: ['priv-1'],
    })
    await database.put('bookmarks', {
      ...priv,
      title: '', url: '', description: '', thumbnail: '', favicon: '', siteName: '',
      encryptedPayload: { iv: 'x', ciphertext: 'y' },
    })

    const { result } = renderHook(() => useBoardData('priv-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await result.current.persistThumbnail(priv.id, 'https://evil.example/leak.jpg', true)

    const stored = await database.get('bookmarks', priv.id)
    expect(stored?.thumbnail).toBe('')
    expect(stored?.encryptedPayload).toEqual({ iv: 'x', ciphertext: 'y' })
  })

  it('persistTitle is a no-op on a Private (encrypted) record', async () => {
    const database = await initDB()
    const priv = await addBookmark(database, {
      url: 'https://example.com/secret', title: 'placeholder', description: '',
      thumbnail: '', favicon: '', siteName: '', type: 'website',
      tags: ['priv-1'],
    })
    await database.put('bookmarks', {
      ...priv,
      title: '', url: '', description: '', thumbnail: '', favicon: '', siteName: '',
      encryptedPayload: { iv: 'x', ciphertext: 'y' },
    })

    const { result } = renderHook(() => useBoardData('priv-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await result.current.persistTitle(priv.id, 'Evil leaked title')

    const stored = await database.get('bookmarks', priv.id)
    expect(stored?.title).toBe('')
    expect(stored?.encryptedPayload).toEqual({ iv: 'x', ciphertext: 'y' })
  })
})
