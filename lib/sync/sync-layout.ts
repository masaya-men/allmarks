// lib/sync/sync-layout.ts
// 同期形式 v2 の Drive 上のファイル配置（docs/superpowers/specs/2026-09-25-sync-format-v2-design.md
// §Drive layout）。純関数のみ — Drive/IndexedDB には触らない。
//
// - manifest.json → { formatVersion: 2, shardCount, updatedAt, migratedFromV1? }
// - bookmarks-<k>.json.gz / cards-<k>.json.gz（k = 0..S-1、行は fnv1a32(id) % S で割り当て）
// - tags.json.gz / board-config.json.gz / vault.json.gz
// - v2 のファイルは必ず gzip（CompressionStream が無い端末は同期しない — engine.ts の
//   SyncUnsupportedError）。素の JSON の v2 ファイルは書きも読みもしない（v1 と名前が衝突するため）
// - v1 のファイル（bookmarks.json 等）は移行元として読むだけで、v2 は一切書かない

/** 1 種類あたりのシャード数の既定値。 */
export const SHARD_COUNT_DEFAULT = 16
/** 1 シャードあたりの平均行数がこれを超えたらシャード数を倍にする（まれ）。 */
export const RESHARD_AVG_ROWS = 200

export const MANIFEST_FILE_NAME = 'manifest.json'
export const SYNC_FORMAT_VERSION = 2

/** v1 のファイル名（移行元・古いタブが書き続けるかもしれないもの）。 */
export const V1_FILE_NAMES = {
  bookmarks: 'bookmarks.json',
  tags: 'tags.json',
  cards: 'cards.json',
  boardConfig: 'board-config.json',
  vault: 'vault.json',
} as const

export type V1Key = keyof typeof V1_FILE_NAMES
export const V1_KEYS: readonly V1Key[] = ['bookmarks', 'tags', 'cards', 'boardConfig', 'vault']

/** manifest の migratedFromV1: 移行時（と、その後古いタブの書き込みを取り込んだ時）に
 *  読んだ v1 ファイルのリビジョン。 */
export type MigratedFromV1 = Partial<Record<V1Key, string>>

export interface ManifestV2 {
  readonly formatVersion: number
  readonly shardCount?: number
  readonly updatedAt?: number
  readonly migratedFromV1?: MigratedFromV1
}

export type ShardedKind = 'bookmarks' | 'cards'
export type SingleKind = 'tags' | 'boardConfig' | 'vault'
export type V2Kind = ShardedKind | SingleKind

const SINGLE_BASE: Record<SingleKind, string> = {
  tags: 'tags',
  boardConfig: 'board-config',
  vault: 'vault',
}

/** FNV-1a 32bit（UTF-8 バイト列に対して）。符号なし 32bit 整数を返す。 */
export function fnv1a32(input: string): number {
  const bytes = new TextEncoder().encode(input)
  let hash = 0x811c9dc5
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i]
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** id が入るシャード番号（0..shardCount-1）。安定 — 行を 1 つ足しても他の行は動かない。 */
export function shardIndexFor(id: string, shardCount: number): number {
  return fnv1a32(id) % shardCount
}

export function shardFileName(kind: ShardedKind, index: number): string {
  return `${kind}-${index}.json.gz`
}

export function singleFileName(kind: SingleKind): string {
  return `${SINGLE_BASE[kind]}.json.gz`
}

export interface ParsedV2Name {
  readonly kind: V2Kind
  /** シャード番号（bookmarks / cards のみ）。 */
  readonly shard?: number
}

const SHARD_NAME_RE = /^(bookmarks|cards)-(\d+)\.json\.gz$/
const SINGLE_NAME_RE = /^(tags|board-config|vault)\.json\.gz$/

/** v2 のデータファイル名（*.json.gz）なら種類を返す。v1 の名前や素の JSON は null。 */
export function parseV2FileName(name: string): ParsedV2Name | null {
  const shard = SHARD_NAME_RE.exec(name)
  if (shard) {
    const index = Number(shard[2])
    if (!Number.isSafeInteger(index)) return null
    return { kind: shard[1] as ShardedKind, shard: index }
  }
  const single = SINGLE_NAME_RE.exec(name)
  if (single) {
    const base = single[1]
    const kind: SingleKind = base === 'board-config' ? 'boardConfig' : (base as 'tags' | 'vault')
    return { kind }
  }
  return null
}

/** v1 のファイル名なら対応するキー。 */
export function v1KeyForName(name: string): V1Key | null {
  for (const key of V1_KEYS) if (V1_FILE_NAMES[key] === name) return key
  return null
}

/** 行数から必要なシャード数を決める。平均が RESHARD_AVG_ROWS を超える間、倍にする。 */
export function planShardCount(current: number, maxRows: number): number {
  let s = current >= 1 ? current : SHARD_COUNT_DEFAULT
  while (maxRows / s > RESHARD_AVG_ROWS) s *= 2
  return s
}

/** manifest がない / 壊れている時に、実在するシャードファイル名からシャード数を推定する
 *  （古いタブが manifest を v1 で上書きした場合など）。最大番号 + 1 を、既定値の
 *  2 の累乗倍に切り上げる。シャードが 1 つも無ければ既定値。 */
export function inferShardCount(names: readonly string[]): number {
  let maxIndex = -1
  for (const name of names) {
    const parsed = parseV2FileName(name)
    if (parsed?.shard !== undefined && parsed.shard > maxIndex) maxIndex = parsed.shard
  }
  let s = SHARD_COUNT_DEFAULT
  while (s < maxIndex + 1) s *= 2
  return s
}

/** manifest.json の中身を寛容に読む。オブジェクトでない / formatVersion が数でないなら null。 */
export function parseManifest(json: unknown): ManifestV2 | null {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return null
  const obj = json as Record<string, unknown>
  if (typeof obj.formatVersion !== 'number' || !Number.isFinite(obj.formatVersion)) return null
  const shardCount = typeof obj.shardCount === 'number' && Number.isSafeInteger(obj.shardCount) && obj.shardCount >= 1
    ? obj.shardCount
    : undefined
  const updatedAt = typeof obj.updatedAt === 'number' ? obj.updatedAt : undefined
  let migratedFromV1: MigratedFromV1 | undefined
  if (typeof obj.migratedFromV1 === 'object' && obj.migratedFromV1 !== null) {
    const raw = obj.migratedFromV1 as Record<string, unknown>
    const out: Partial<Record<V1Key, string>> = {}
    for (const key of V1_KEYS) {
      const rev = raw[key]
      if (typeof rev === 'string') out[key] = rev
    }
    migratedFromV1 = out
  }
  return { formatVersion: obj.formatVersion, shardCount, updatedAt, migratedFromV1 }
}

/** 2 つの migratedFromV1 が同じか（キー順に依存しない）。 */
export function sameMigratedFromV1(a: MigratedFromV1 | undefined, b: MigratedFromV1 | undefined): boolean {
  for (const key of V1_KEYS) {
    if ((a?.[key] ?? undefined) !== (b?.[key] ?? undefined)) return false
  }
  return true
}
