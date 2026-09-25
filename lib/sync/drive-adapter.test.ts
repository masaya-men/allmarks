import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  buildMultipartRelated, findSyncFolder, createSyncFolder, DriveError,
  listFolderFiles, downloadFileText, getHeadRevisionId, createTextFile, updateTextFile,
  RESUMABLE_UPLOAD_THRESHOLD_BYTES,
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
    expect(decodeURIComponent(url)).toContain("appProperties has { key='allmarksSync' and value='1' }")
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

  it('wraps a fetch throw as DriveError(0), retrying twice (2s, 5s) before giving up', async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi.fn(async () => { throw new Error('network') })
      vi.stubGlobal('fetch', fetchMock)
      const pending = expect(findSyncFolder(TOKEN)).rejects.toMatchObject({ status: 0 })
      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(5000)
      await pending
      expect(fetchMock).toHaveBeenCalledTimes(3) // initial attempt + 2 retries, then gives up
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('driveFetch retry behavior (via findSyncFolder)', () => {
  it('retries a 500 once and succeeds on the 2nd attempt without waiting the 2nd (5s) delay', async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(new Response('server error', { status: 500 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ files: [] }), { status: 200 }))
      vi.stubGlobal('fetch', fetchMock)
      const pending = findSyncFolder(TOKEN)
      await vi.advanceTimersByTimeAsync(2000)
      expect(await pending).toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('exhausts both retries on repeated 503s (2s then 5s) and rejects with the last status', async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi.fn(async () => new Response('unavailable', { status: 503 }))
      vi.stubGlobal('fetch', fetchMock)
      const pending = expect(findSyncFolder(TOKEN)).rejects.toMatchObject({ status: 503 })
      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(5000)
      await pending
      expect(fetchMock).toHaveBeenCalledTimes(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('retries 429 (rate limit) the same way as 5xx', async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ files: [] }), { status: 200 }))
      vi.stubGlobal('fetch', fetchMock)
      const pending = findSyncFolder(TOKEN)
      await vi.advanceTimersByTimeAsync(2000)
      expect(await pending).toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('never retries a plain 4xx like 401 or 404', async () => {
    const fetchMock = vi.fn(async () => new Response('nope', { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(findSyncFolder(TOKEN)).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
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

describe('listFolderFiles', () => {
  it('queries "<folderId> in parents", maps to DriveFileMeta[], and sorts by (name, id)', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      files: [
        { id: 'f2', name: 'tags.json' },
        { id: 'f1', name: 'bookmarks.json', headRevisionId: 'r1' },
        { name: 'no-id.json' },
      ],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const out = await listFolderFiles(TOKEN, 'FOLDER')
    expect(out).toEqual([
      { id: 'f1', name: 'bookmarks.json', headRevisionId: 'r1' },
      { id: 'f2', name: 'tags.json' },
    ])
    expect(decodeURIComponent(lastCall(fetchMock)[0])).toContain("'FOLDER' in parents and trashed = false")
  })

  it('throws DriveError on a non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 403 })))
    await expect(listFolderFiles(TOKEN, 'F')).rejects.toMatchObject({ status: 403 })
  })
})

describe('downloadFileText', () => {
  it('GETs alt=media and returns the raw text', async () => {
    const fetchMock = vi.fn(async () => new Response('{"bookmarks":[]}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await downloadFileText(TOKEN, 'f1')).toBe('{"bookmarks":[]}')
    expect(lastCall(fetchMock)[0]).toBe('https://www.googleapis.com/drive/v3/files/f1?alt=media')
  })

  it('throws DriveError with the HTTP status on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })))
    await expect(downloadFileText(TOKEN, 'f1')).rejects.toBeInstanceOf(DriveError)
    await expect(downloadFileText(TOKEN, 'f1')).rejects.toMatchObject({ status: 404 })
  })
})

describe('getHeadRevisionId', () => {
  it('returns the headRevisionId field', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ headRevisionId: 'rev-9' }), { status: 200 })))
    expect(await getHeadRevisionId(TOKEN, 'f1')).toBe('rev-9')
  })

  it('throws DriveError(500) when headRevisionId is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
    await expect(getHeadRevisionId(TOKEN, 'f1')).rejects.toMatchObject({ status: 500 })
  })

  it('throws DriveError(500) when a 200 response body is not JSON (readJson catch branch)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>not json</html>', { status: 200 })))
    await expect(getHeadRevisionId(TOKEN, 'f1')).rejects.toBeInstanceOf(DriveError)
    await expect(getHeadRevisionId(TOKEN, 'f1')).rejects.toMatchObject({ status: 500 })
  })
})

describe('createTextFile', () => {
  it('POSTs a multipart body to the upload endpoint and maps the result', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      id: 'new', name: 'bookmarks.json', headRevisionId: 'r0',
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const meta = await createTextFile(TOKEN, 'FOLDER', 'bookmarks.json', '{"a":1}')
    expect(meta).toEqual({ id: 'new', name: 'bookmarks.json', headRevisionId: 'r0' })

    const [url, init] = lastCall(fetchMock)
    expect(url).toContain('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Content-Type']).toMatch(/^multipart\/related; boundary=/)
    const bodyStr = init.body as string
    expect(bodyStr).toContain('"name":"bookmarks.json"')
    expect(bodyStr).toContain('"parents":["FOLDER"]')
    expect(bodyStr).toContain('{"a":1}')
  })

  it('throws DriveError(500) when the response has no id', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
    await expect(createTextFile(TOKEN, 'FOLDER', 'bookmarks.json', '{}')).rejects.toMatchObject({ status: 500 })
  })
})

describe('updateTextFile', () => {
  it('PATCHes the upload endpoint with an empty metadata part', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      id: 'f1', name: 'bookmarks.json', headRevisionId: 'r2',
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const meta = await updateTextFile(TOKEN, 'f1', '{"b":2}')
    expect(meta.headRevisionId).toBe('r2')

    const [url, init] = lastCall(fetchMock)
    expect(url).toContain('https://www.googleapis.com/upload/drive/v3/files/f1?uploadType=multipart')
    expect(init.method).toBe('PATCH')
    const bodyStr = init.body as string
    // metadata part is an empty object
    expect(bodyStr).toContain('Content-Type: application/json; charset=UTF-8\r\n\r\n{}\r\n')
    expect(bodyStr).toContain('{"b":2}')
  })

  it('throws DriveError(500) when the response has no id', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
    await expect(updateTextFile(TOKEN, 'f1', '{}')).rejects.toMatchObject({ status: 500 })
  })
})

describe('createTextFile / updateTextFile — resumable upload for large files', () => {
  const bigContent = 'x'.repeat(RESUMABLE_UPLOAD_THRESHOLD_BYTES + 1)

  it('createTextFile switches to resumable (initiate then PUT) when content exceeds the threshold', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { Location: 'https://upload.example/session-1' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'big-id', name: 'bookmarks.json', headRevisionId: 'rev-1' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const meta = await createTextFile(TOKEN, 'FOLDER', 'bookmarks.json', bigContent)
    expect(meta).toEqual({ id: 'big-id', name: 'bookmarks.json', headRevisionId: 'rev-1' })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const [initiateUrl, initiateInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(initiateUrl).toContain('https://www.googleapis.com/upload/drive/v3/files?')
    expect(initiateUrl).toContain('uploadType=resumable')
    expect(initiateInit.method).toBe('POST')
    expect(JSON.parse(initiateInit.body as string)).toEqual({ name: 'bookmarks.json', parents: ['FOLDER'], mimeType: 'application/json' })

    const [putUrl, putInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(putUrl).toBe('https://upload.example/session-1')
    expect(putInit.method).toBe('PUT')
    expect(putInit.body).toBe(bigContent)
  })

  it('createTextFile stays on multipart (single request) when content is at/under the threshold', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'small', name: 'x.json', headRevisionId: 'r' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await createTextFile(TOKEN, 'FOLDER', 'x.json', 'small content')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(lastCall(fetchMock)[0]).toContain('uploadType=multipart')
  })

  it('updateTextFile switches to resumable (initiate then PUT) when content exceeds the threshold', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { Location: 'https://upload.example/session-2' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'f1', name: 'bookmarks.json', headRevisionId: 'rev-9' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const meta = await updateTextFile(TOKEN, 'f1', bigContent)
    expect(meta.headRevisionId).toBe('rev-9')
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const [initiateUrl, initiateInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(initiateUrl).toContain('https://www.googleapis.com/upload/drive/v3/files/f1?')
    expect(initiateUrl).toContain('uploadType=resumable')
    expect(initiateInit.method).toBe('PATCH')
    expect(JSON.parse(initiateInit.body as string)).toEqual({})

    const [putUrl, putInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(putUrl).toBe('https://upload.example/session-2')
    expect(putInit.method).toBe('PUT')
  })

  it('updateTextFile stays on multipart (single request) when content is at/under the threshold', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'f1', name: 'x.json', headRevisionId: 'r2' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await updateTextFile(TOKEN, 'f1', 'small content')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(lastCall(fetchMock)[0]).toContain('uploadType=multipart')
  })

  it('throws DriveError(500) when the resumable initiate response has no Location header', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })))
    await expect(createTextFile(TOKEN, 'FOLDER', 'bookmarks.json', bigContent)).rejects.toMatchObject({ status: 500 })
  })
})
