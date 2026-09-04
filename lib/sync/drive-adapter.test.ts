import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  buildMultipartRelated, findSyncFolder, createSyncFolder, DriveError,
} from './drive-adapter'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const TOKEN = 'ya29.test'

/** 直近の fetch 呼び出しの [url, init] を返す。 */
function lastCall(m: ReturnType<typeof vi.fn>): [string, RequestInit] {
  return m.mock.calls[m.mock.calls.length - 1] as [string, RequestInit]
}

describe('buildMultipartRelated', () => {
  it('produces an RFC-2387 body with both parts and the boundary content-type', () => {
    const { body, contentType } = buildMultipartRelated({ name: 'x.json' }, '{"a":1}', 'application/json', 'BOUNDARY')
    expect(contentType).toBe('multipart/related; boundary=BOUNDARY')
    expect(body).toBe(
      '--BOUNDARY\r\n' +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      '{"name":"x.json"}\r\n' +
      '--BOUNDARY\r\n' +
      'Content-Type: application/json\r\n\r\n' +
      '{"a":1}\r\n' +
      '--BOUNDARY--',
    )
  })
})

describe('findSyncFolder', () => {
  it('queries by name + folder mime + not-trashed and returns the marked folder id', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      files: [
        { id: 'unmarked', appProperties: {} },
        { id: 'marked-1', appProperties: { allmarksSync: '1' } },
      ],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const id = await findSyncFolder(TOKEN)
    expect(id).toBe('marked-1')

    const [url, init] = lastCall(fetchMock)
    expect(url).toContain('https://www.googleapis.com/drive/v3/files?')
    expect(decodeURIComponent(url)).toContain("name = 'AllMarks'")
    expect(decodeURIComponent(url)).toContain("mimeType = 'application/vnd.google-apps.folder'")
    expect(decodeURIComponent(url)).toContain('trashed = false')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer ya29.test')
  })

  it('returns the lexicographically smallest id when several are marked', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      files: [
        { id: 'zzz', appProperties: { allmarksSync: '1' } },
        { id: 'aaa', appProperties: { allmarksSync: '1' } },
      ],
    }), { status: 200 })))
    expect(await findSyncFolder(TOKEN)).toBe('aaa')
  })

  it('returns null when no folder carries the marker', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      files: [{ id: 'x', appProperties: {} }],
    }), { status: 200 })))
    expect(await findSyncFolder(TOKEN)).toBeNull()
  })

  it('returns null when the folder list is empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ files: [] }), { status: 200 })))
    expect(await findSyncFolder(TOKEN)).toBeNull()
  })

  it('throws DriveError with the HTTP status on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 401 })))
    await expect(findSyncFolder(TOKEN)).rejects.toBeInstanceOf(DriveError)
    await expect(findSyncFolder(TOKEN)).rejects.toMatchObject({ status: 401 })
  })

  it('wraps a fetch throw as DriveError(0)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network') }))
    await expect(findSyncFolder(TOKEN)).rejects.toMatchObject({ status: 0 })
  })
})

describe('createSyncFolder', () => {
  it('POSTs folder metadata with the sync marker and returns the new id', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'new-folder' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const id = await createSyncFolder(TOKEN)
    expect(id).toBe('new-folder')

    const [url, init] = lastCall(fetchMock)
    expect(url).toBe('https://www.googleapis.com/drive/v3/files?fields=id')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      name: 'AllMarks',
      mimeType: 'application/vnd.google-apps.folder',
      appProperties: { allmarksSync: '1' },
    })
  })

  it('throws DriveError(500) when the response has no id', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
    await expect(createSyncFolder(TOKEN)).rejects.toMatchObject({ status: 500 })
  })
})
