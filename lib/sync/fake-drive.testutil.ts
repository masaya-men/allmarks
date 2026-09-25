// lib/sync/fake-drive.testutil.ts
// Test-only in-memory Google Drive folder that implements the drive-adapter functions engine.ts
// uses, with real headRevisionId semantics (every write bumps the file's revision). Wire it into a
// test file that does `vi.mock('./drive-adapter', ...)` with installFakeDrive(). Not imported by
// any production module.
import { vi } from 'vitest'
import {
  listFolderFiles, downloadFileText, downloadFileBytes, getHeadRevisionId,
  createTextFile, updateTextFile, createBinaryFile, updateBinaryFile, findSyncFolder, createSyncFolder, deleteFile,
  DriveError, type DriveFileMeta,
} from './drive-adapter'
import { createStreamGzipCodec, looksGzipped } from './gzip-codec'

export interface FakeDriveFile {
  readonly id: string
  readonly name: string
  rev: string
  bytes: Uint8Array
  mime: string
}

export interface FakeDriveCall {
  readonly op: 'list' | 'download' | 'rev' | 'create' | 'update' | 'delete'
  readonly name?: string
  readonly bytes?: number
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export class FakeDrive {
  readonly files = new Map<string, FakeDriveFile>()
  readonly calls: FakeDriveCall[] = []
  private seq = 0
  private revSeq = 0

  private nextRev(): string {
    this.revSeq += 1
    return `rev-${this.revSeq}`
  }

  /** Seeds (or overwrites, bumping the revision) a file directly — e.g. a v1 fixture or a stale
   *  v1 tab's write. `content` string = stored as UTF-8 text. */
  put(name: string, content: string | Uint8Array, mime = 'application/json'): FakeDriveFile {
    const bytes = typeof content === 'string' ? encoder.encode(content) : content
    const existing = this.byName(name)
    if (existing) {
      existing.bytes = bytes
      existing.rev = this.nextRev()
      return existing
    }
    this.seq += 1
    const file: FakeDriveFile = { id: `file-${this.seq}`, name, rev: this.nextRev(), bytes, mime }
    this.files.set(file.id, file)
    return file
  }

  byName(name: string): FakeDriveFile | undefined {
    for (const f of this.files.values()) if (f.name === name) return f
    return undefined
  }

  names(): string[] {
    return [...this.files.values()].map((f) => f.name).sort()
  }

  /** The decoded (gunzipped when needed) text of a file. */
  async text(name: string): Promise<string> {
    const f = this.byName(name)
    if (!f) throw new Error(`no such fake file: ${name}`)
    if (!looksGzipped(f.bytes)) return decoder.decode(f.bytes)
    const codec = createStreamGzipCodec()
    if (!codec) throw new Error('no gzip codec in this environment')
    return codec.decompress(f.bytes)
  }

  async json(name: string): Promise<unknown> {
    return JSON.parse(await this.text(name))
  }

  clearCalls(): void {
    this.calls.length = 0
  }

  callsOf(op: FakeDriveCall['op']): FakeDriveCall[] {
    return this.calls.filter((c) => c.op === op)
  }

  private get(id: string): FakeDriveFile {
    const f = this.files.get(id)
    if (!f) throw new DriveError(404, `drive 404: ${id}`)
    return f
  }

  list(): DriveFileMeta[] {
    return [...this.files.values()]
      .map((f) => ({ id: f.id, name: f.name, headRevisionId: f.rev }))
      .sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : x.id < y.id ? -1 : 1))
  }

  // ── drive-adapter implementations ──────────────────────────────────────────

  readonly listFolderFiles = async (): Promise<DriveFileMeta[]> => {
    this.calls.push({ op: 'list' })
    return this.list()
  }

  readonly downloadFileText = async (_t: string, id: string): Promise<string> => {
    const f = this.get(id)
    this.calls.push({ op: 'download', name: f.name })
    return decoder.decode(f.bytes)
  }

  readonly downloadFileBytes = async (_t: string, id: string): Promise<Uint8Array> => {
    const f = this.get(id)
    this.calls.push({ op: 'download', name: f.name })
    return new Uint8Array(f.bytes)
  }

  readonly getHeadRevisionId = async (_t: string, id: string): Promise<string> => {
    const f = this.get(id)
    this.calls.push({ op: 'rev', name: f.name })
    return f.rev
  }

  private create(name: string, bytes: Uint8Array, mime: string): DriveFileMeta {
    this.seq += 1
    const file: FakeDriveFile = { id: `file-${this.seq}`, name, rev: this.nextRev(), bytes, mime }
    this.files.set(file.id, file)
    this.calls.push({ op: 'create', name, bytes: bytes.byteLength })
    return { id: file.id, name, headRevisionId: file.rev }
  }

  private update(id: string, bytes: Uint8Array): DriveFileMeta {
    const f = this.get(id)
    f.bytes = bytes
    f.rev = this.nextRev()
    this.calls.push({ op: 'update', name: f.name, bytes: bytes.byteLength })
    return { id: f.id, name: f.name, headRevisionId: f.rev }
  }

  readonly createTextFile = async (_t: string, _folder: string, name: string, content: string): Promise<DriveFileMeta> =>
    this.create(name, encoder.encode(content), 'application/json')

  readonly updateTextFile = async (_t: string, id: string, content: string): Promise<DriveFileMeta> =>
    this.update(id, encoder.encode(content))

  readonly createBinaryFile = async (
    _t: string, _folder: string, name: string, content: Uint8Array, mime?: string,
  ): Promise<DriveFileMeta> => this.create(name, new Uint8Array(content), mime ?? 'application/gzip')

  readonly updateBinaryFile = async (_t: string, id: string, content: Uint8Array): Promise<DriveFileMeta> =>
    this.update(id, new Uint8Array(content))

  readonly deleteFile = async (_t: string, id: string): Promise<void> => {
    const f = this.get(id)
    this.files.delete(id)
    this.calls.push({ op: 'delete', name: f.name })
  }

  /** Adds a second file with an existing file's name (Drive allows duplicates) under `id`. */
  putDuplicate(id: string, name: string, content: Uint8Array, mime = 'application/gzip'): FakeDriveFile {
    const file: FakeDriveFile = { id, name, rev: this.nextRev(), bytes: content, mime }
    this.files.set(id, file)
    return file
  }
}

/** Points every mocked drive-adapter function at `drive`. The calling test file must have
 *  `vi.mock('./drive-adapter', ...)` replacing these exports with vi.fn(). */
export function installFakeDrive(drive: FakeDrive, folderId = 'folder1'): void {
  vi.mocked(findSyncFolder).mockResolvedValue(folderId)
  vi.mocked(createSyncFolder).mockResolvedValue(folderId)
  vi.mocked(listFolderFiles).mockImplementation(drive.listFolderFiles)
  vi.mocked(downloadFileText).mockImplementation(drive.downloadFileText)
  vi.mocked(downloadFileBytes).mockImplementation(drive.downloadFileBytes)
  vi.mocked(getHeadRevisionId).mockImplementation(drive.getHeadRevisionId)
  vi.mocked(createTextFile).mockImplementation(drive.createTextFile)
  vi.mocked(updateTextFile).mockImplementation(drive.updateTextFile)
  vi.mocked(createBinaryFile).mockImplementation(drive.createBinaryFile)
  vi.mocked(updateBinaryFile).mockImplementation(drive.updateBinaryFile)
  vi.mocked(deleteFile).mockImplementation(drive.deleteFile)
}
