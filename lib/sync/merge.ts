// lib/sync/merge.ts
// 端末間同期の「足し算マージ」。local と remote の 2 つのスナップショットを
// id 単位で和集合にする完全な純関数群。IndexedDB / fetch / Date.now / crypto を
// 一切呼ばない。設計 §6（マージ規則）・§9（Private の id 単位マージ）・§15。
//
// base スナップショット（3-way）と衝突退避（§6.5）は束4 の engine の責務。
// ここは 2-way で「決定的（引数の順番に依存しない）」だけを保証する。
import type { BookmarkRecord, TagRecord, CardRecord } from '@/lib/storage/indexeddb'
import type { BoardConfig } from '@/lib/board/types'
import type { PrivateVaultRecord } from '@/lib/private/vault-store'

/** board-config.json の中身（設計 §5）。updatedAt は束4 が saveBoardConfig の
 *  たびに打つ。まだ配線されていない / 古いスナップショットでは undefined → 0 扱い。 */
export interface SyncBoardConfig {
  readonly config: BoardConfig
  readonly updatedAt?: number
}

/** device-sync が Drive 経由で往復させる全 store の in-memory 形（設計 §5）。
 *  束4 の engine がこれを 6 つの JSON ファイルに分解し、また組み立て直す。 */
export interface SyncSnapshot {
  readonly bookmarks: readonly BookmarkRecord[]
  readonly tags: readonly TagRecord[]
  readonly cards: readonly CardRecord[]
  readonly boardConfig: SyncBoardConfig | null
  readonly vault: PrivateVaultRecord | null
}

// ── 純ヘルパー（module-private）────────────────────────────────────────────

/** レコードの updatedAt を有限数として読む。undefined / NaN / 文字列
 *  （v17 前バックアップの復元で updatedAt 無しの行が残る・migration 再実行不可）
 *  は 0 → スタンプ済みが必ず未スタンプに勝つ。設計 §15。 */
function numericTime(x: unknown): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : 0
}

/** ISO 8601 の deletedAt を epoch ms に。文字列でない / 解釈不能なら 0。 */
function deletedAtMs(iso: unknown): number {
  if (typeof iso !== 'string') return 0
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

/** キーを再帰的にソートした JSON。決定的タイブレーク専用の安定比較キー。 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

/** 2 つのうち安定シリアライズが文字列として大きい方。引数順に依存しない。 */
function pickDeterministic<T>(a: T, b: T): T {
  return stableStringify(a) >= stableStringify(b) ? a : b
}

/** winner の順を保ちつつ loser の未含有要素を後ろに足す（重複除去）。 */
function unionOrdered(winner: readonly string[], loser: readonly string[]): string[] {
  const out = [...winner]
  for (const t of loser) if (!out.includes(t)) out.push(t)
  return out
}

/** id をキーにした Map。後勝ち（呼び出し側は同一配列内に重複 id を渡さない前提）。 */
function byId<T extends { id: string }>(rows: readonly T[]): Map<string, T> {
  const m = new Map<string, T>()
  for (const r of rows) m.set(r.id, r)
  return m
}

// ── bookmarks（設計 §6.1）──────────────────────────────────────────────────

function mergeOneBookmark(a: BookmarkRecord, b: BookmarkRecord): BookmarkRecord {
  const aDel = a.isDeleted === true
  const bDel = b.isDeleted === true

  // ケース2: どちらも墓標 → deletedAt が新しい方（同値は決定的）
  if (aDel && bDel) {
    const am = deletedAtMs(a.deletedAt)
    const bm = deletedAtMs(b.deletedAt)
    if (am > bm) return { ...a, isDeleted: true }
    if (bm > am) return { ...b, isDeleted: true }
    return { ...pickDeterministic(a, b), isDeleted: true }
  }

  // ケース3: 片方だけ墓標
  if (aDel !== bDel) {
    const tomb = aDel ? a : b
    const live = aDel ? b : a
    if (deletedAtMs(tomb.deletedAt) >= numericTime(live.updatedAt)) {
      return { ...tomb, isDeleted: true }
    }
    return live // 生存側が勝つ（tags 和集合はしない）
  }

  // ケース1: どちらも生存 → LWW（同値は決定的）＋ tags 和集合
  const at = numericTime(a.updatedAt)
  const bt = numericTime(b.updatedAt)
  let winner: BookmarkRecord
  let loser: BookmarkRecord
  if (at > bt) { winner = a; loser = b }
  else if (bt > at) { winner = b; loser = a }
  else { winner = pickDeterministic(a, b); loser = winner === a ? b : a }
  return { ...winner, tags: unionOrdered(winner.tags, loser.tags) }
}

/** local ∪ remote（id 単位）。id 昇順で返す。設計 §6.1。 */
export function mergeBookmarks(
  local: readonly BookmarkRecord[],
  remote: readonly BookmarkRecord[],
): BookmarkRecord[] {
  const l = byId(local)
  const r = byId(remote)
  const out: BookmarkRecord[] = []
  for (const id of new Set([...l.keys(), ...r.keys()])) {
    const a = l.get(id)
    const b = r.get(id)
    if (a && b) out.push(mergeOneBookmark(a, b))
    else out.push((a ?? b) as BookmarkRecord)
  }
  return out.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
}

// ── tags（設計 §6.2）──────────────────────────────────────────────────────

/** タグの時刻源。updatedAt 優先、無ければ createdAt（必須の number）を下限に。 */
function tagTime(t: TagRecord): number {
  return numericTime(t.updatedAt) || numericTime(t.createdAt)
}

function mergeOneTag(a: TagRecord, b: TagRecord): TagRecord {
  const aDel = a.isDeleted === true
  const bDel = b.isDeleted === true

  if (aDel && bDel) {
    const am = deletedAtMs(a.deletedAt)
    const bm = deletedAtMs(b.deletedAt)
    if (am > bm) return { ...a, isDeleted: true }
    if (bm > am) return { ...b, isDeleted: true }
    return { ...pickDeterministic(a, b), isDeleted: true }
  }

  if (aDel !== bDel) {
    const tomb = aDel ? a : b
    const live = aDel ? b : a
    if (deletedAtMs(tomb.deletedAt) >= tagTime(live)) return { ...tomb, isDeleted: true }
    return live
  }

  const at = tagTime(a)
  const bt = tagTime(b)
  if (at > bt) return a
  if (bt > at) return b
  return pickDeterministic(a, b)
}

/** local ∪ remote（id 単位）。id 昇順で返す。設計 §6.2。 */
export function mergeTags(
  local: readonly TagRecord[],
  remote: readonly TagRecord[],
): TagRecord[] {
  const l = byId(local)
  const r = byId(remote)
  const out: TagRecord[] = []
  for (const id of new Set([...l.keys(), ...r.keys()])) {
    const a = l.get(id)
    const b = r.get(id)
    if (a && b) out.push(mergeOneTag(a, b))
    else out.push((a ?? b) as TagRecord)
  }
  return out.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
}
