// lib/sync/drive-adapter.ts
// Google Drive REST v3 の薄いラッパ。access token は毎回引数で注入する
// （auth.ts の SyncTokens.accessToken を渡す想定・secret は持たない）。
// pull/merge/push のオーケストレーション・token 更新・楽観ロックの判断・
// リトライは一切しない — それは束4 の engine.ts の責務。設計 §5 / §7.4。
//
// 401 (token 失効) / 403 (容量・権限) / 404 (不在) は DriveError に status を
// 載せて投げるだけ。束4 が status を見て「refresh して再試行」「容量エラー表示」
// 等を判断する。

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
/** 同期フォルダの表示名（可視フォルダ・設計 §5）。 */
export const SYNC_FOLDER_NAME = 'AllMarks'
/** ユーザーが手で作った同名フォルダと区別するための appProperties マーカー。 */
const SYNC_MARKER_KEY = 'allmarksSync'
const SYNC_MARKER_VALUE = '1'
/** アプリの JSON ファイルの MIME。 */
export const SYNC_FILE_MIME = 'application/json'

/** Drive API 呼び出しの失敗。status は HTTP ステータス（fetch throw は 0、
 *  応答が想定外の形なら 500）。束4 が status で分岐する。 */
export class DriveError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'DriveError'
    this.status = status
  }
}

/** Drive のファイルメタ（この束が使う分だけ）。 */
export interface DriveFileMeta {
  readonly id: string
  readonly name: string
  /** バイナリファイルの現行リビジョン id。楽観ロック（設計 §7.4）に使う。 */
  readonly headRevisionId?: string
}

/**
 * RFC 2387 multipart/related。part1 = メタデータ JSON、part2 = ファイル本文。
 * boundary は呼び出し側が渡す（テストの決定性のため）。純関数。
 * boundary は呼び出し側の責任で content と衝突しないものを渡すこと（createTextFile/updateTextFile は allmarks-<randomUUID> を使うので実質衝突なし。content が JSON 文字列なら生の CRLF を含まないため区切り行も構成不能）。
 */
export function buildMultipartRelated(
  metadata: Readonly<Record<string, unknown>>,
  content: string,
  contentMime: string,
  boundary: string,
): { body: string; contentType: string } {
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${contentMime}\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`
  return { body, contentType: `multipart/related; boundary=${boundary}` }
}

/** Authorization を足して fetch。!res.ok は DriveError、fetch throw は DriveError(0)。 */
async function driveFetch(
  accessToken: string,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: { ...(init?.headers as Record<string, string> | undefined), Authorization: `Bearer ${accessToken}` },
    })
  } catch (err) {
    throw new DriveError(0, `drive fetch failed: ${err instanceof Error ? err.message : String(err)}`)
  }
  if (!res.ok) {
    let detail = ''
    try {
      detail = (await res.text()).slice(0, 300)
    } catch {
      // body 読めず — status だけで十分
    }
    throw new DriveError(res.status, `drive ${res.status}: ${detail}`)
  }
  return res
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    throw new DriveError(500, 'drive response was not JSON')
  }
}

interface DriveFileListItem {
  id?: unknown
  name?: unknown
  headRevisionId?: unknown
  appProperties?: unknown
}

/**
 * 可視フォルダ `AllMarks/` を名前 + appProperties マーカーで探す。
 * マーカー付きが複数なら id 辞書順で最小（決定的）。無ければ null。
 */
export async function findSyncFolder(accessToken: string): Promise<string | null> {
  const q =
    `name = '${SYNC_FOLDER_NAME}' and mimeType = '${FOLDER_MIME}' and trashed = false` +
    ` and appProperties has { key='${SYNC_MARKER_KEY}' and value='${SYNC_MARKER_VALUE}' }`
  const url =
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}` +
    `&fields=${encodeURIComponent('files(id,appProperties)')}&spaces=drive&pageSize=10`
  const json = await readJson(await driveFetch(accessToken, url))
  const files = (json as { files?: unknown }).files
  if (!Array.isArray(files)) return null
  const marked = files.filter((f): f is DriveFileListItem & { id: string } => {
    if (typeof f !== 'object' || f === null) return false
    const item = f as DriveFileListItem
    const props = item.appProperties
    const hasMarker =
      typeof props === 'object' && props !== null &&
      (props as Record<string, unknown>)[SYNC_MARKER_KEY] === SYNC_MARKER_VALUE
    return hasMarker && typeof item.id === 'string'
  })
  if (marked.length === 0) return null
  return marked.map((f) => f.id).sort()[0]
}

/** マーカー付きで `AllMarks/` フォルダを新規作成し、その id を返す。 */
export async function createSyncFolder(accessToken: string): Promise<string> {
  const url = `${DRIVE_API}/files?fields=id`
  const json = await readJson(await driveFetch(accessToken, url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: SYNC_FOLDER_NAME,
      mimeType: FOLDER_MIME,
      appProperties: { [SYNC_MARKER_KEY]: SYNC_MARKER_VALUE },
    }),
  }))
  const id = (json as { id?: unknown }).id
  if (typeof id !== 'string' || id.length === 0) {
    throw new DriveError(500, 'createSyncFolder: response had no id')
  }
  return id
}

/** DriveFileListItem を DriveFileMeta に写す（id/name が文字列の行のみ）。 */
function toFileMeta(raw: unknown): DriveFileMeta | null {
  if (typeof raw !== 'object' || raw === null) return null
  const item = raw as DriveFileListItem
  if (typeof item.id !== 'string' || typeof item.name !== 'string') return null
  return typeof item.headRevisionId === 'string'
    ? { id: item.id, name: item.name, headRevisionId: item.headRevisionId }
    : { id: item.id, name: item.name }
}

/** フォルダ直下の（ゴミ箱でない）ファイルを列挙。ページングは扱わない
 *  （AllMarks/ は 6 ファイル程度・設計 §5）。 */
export async function listFolderFiles(accessToken: string, folderId: string): Promise<DriveFileMeta[]> {
  const q = `'${folderId}' in parents and trashed = false`
  const url =
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}` +
    `&fields=${encodeURIComponent('files(id,name,headRevisionId)')}&spaces=drive&pageSize=100`
  const json = await readJson(await driveFetch(accessToken, url))
  const files = (json as { files?: unknown }).files
  if (!Array.isArray(files)) return []
  return files
    .map(toFileMeta)
    .filter((m): m is DriveFileMeta => m !== null)
    .sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
}

/** ファイル本文をテキストで取得（alt=media）。JSON パースは呼び出し側で。 */
export async function downloadFileText(accessToken: string, fileId: string): Promise<string> {
  const url = `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`
  return (await driveFetch(accessToken, url)).text()
}

/** 現行リビジョン id を取得（楽観ロック・設計 §7.4）。 */
export async function getHeadRevisionId(accessToken: string, fileId: string): Promise<string> {
  const url = `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=headRevisionId`
  const json = await readJson(await driveFetch(accessToken, url))
  const rev = (json as { headRevisionId?: unknown }).headRevisionId
  if (typeof rev !== 'string' || rev.length === 0) {
    throw new DriveError(500, 'getHeadRevisionId: response had no headRevisionId')
  }
  return rev
}

function metaFromUploadResponse(json: unknown, ctx: string): DriveFileMeta {
  const meta = toFileMeta(json)
  if (!meta) throw new DriveError(500, `${ctx}: response had no id/name`)
  return meta
}

/** フォルダ内に新規テキストファイルを作る（multipart・メタ + 本文）。 */
export async function createTextFile(
  accessToken: string,
  folderId: string,
  name: string,
  content: string,
): Promise<DriveFileMeta> {
  const boundary = `allmarks-${crypto.randomUUID()}`
  const { body, contentType } = buildMultipartRelated(
    { name, parents: [folderId], mimeType: SYNC_FILE_MIME },
    content, SYNC_FILE_MIME, boundary,
  )
  const url = `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=${encodeURIComponent('id,name,headRevisionId')}`
  const json = await readJson(await driveFetch(accessToken, url, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body,
  }))
  return metaFromUploadResponse(json, 'createTextFile')
}

/** 既存ファイルの本文だけ差し替える（multipart PATCH・メタは空 {}）。 */
export async function updateTextFile(
  accessToken: string,
  fileId: string,
  content: string,
): Promise<DriveFileMeta> {
  const boundary = `allmarks-${crypto.randomUUID()}`
  const { body, contentType } = buildMultipartRelated({}, content, SYNC_FILE_MIME, boundary)
  const url =
    `${DRIVE_UPLOAD_API}/files/${encodeURIComponent(fileId)}` +
    `?uploadType=multipart&fields=${encodeURIComponent('id,name,headRevisionId')}`
  const json = await readJson(await driveFetch(accessToken, url, {
    method: 'PATCH',
    headers: { 'Content-Type': contentType },
    body,
  }))
  return metaFromUploadResponse(json, 'updateTextFile')
}
