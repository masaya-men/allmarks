// lib/sync/merge.ts
// 端末間同期の「足し算マージ」。local と remote の 2 つのスナップショットを
// id 単位で和集合にする完全な純関数群。IndexedDB / fetch / Date.now / crypto を
// 一切呼ばない。設計 §6（マージ規則）・§9（Private の id 単位マージ）・§15。
//
// base スナップショット（3-way）と衝突退避（§6.5）は束4 の engine の責務。
// ここは 2-way で「決定的（引数の順番に依存しない）」だけを保証する。
// ⚠️ 戻り値は入力レコードと同一のオブジェクト参照を含みうる（LWW で片側を丸ごと
//    採用する経路・id が片側にしか無い経路）。束4 の engine は merge の結果を
//    破壊的に変更してはいけない（result.bookmarks[i].tags.push(...) 等は
//    ローカルスナップショットを汚す）。必要なら engine 側でコピーする。
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
 *  束4 の engine がこれを 5 つの store（bookmarks/tags/cards/board-config/vault）
 *  に分解し、また組み立て直す。manifest.json は engine が別途生成する。 */
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
  // bookmarks は savedAt へのフォールバック不要: v17 migration が全既存行を
  // updatedAt = Date.parse(savedAt) で backfill 済み（tags の createdAt 相当）。
  const at = numericTime(a.updatedAt)
  const bt = numericTime(b.updatedAt)
  let winner: BookmarkRecord
  let loser: BookmarkRecord
  if (at > bt) { winner = a; loser = b }
  else if (bt > at) { winner = b; loser = a }
  else { winner = pickDeterministic(a, b); loser = winner === a ? b : a }
  // tags[] is written atomically with the Private plaintext/ciphertext state
  // (lib/private/apply-tag-change.ts). If the two sides disagree on whether
  // encryptedPayload is present, exactly one has been Private-ized/de-Private-ized
  // and its tags[] is inseparable from that state — unioning would produce a
  // record with a Private tag but plaintext fields (leaks to Drive per §9) or a
  // payload-less Private row (dropped by resolve-visibility). Take the LWW
  // winner whole; the Private toggle can lose LWW but the record stays consistent.
  // Intentional deviation from design §6.1 / plan「設計上の判断」§5, to satisfy §9 + §12.
  const privateStateDiffers =
    (a.encryptedPayload === undefined) !== (b.encryptedPayload === undefined)
  if (privateStateDiffers) return winner
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

// ── cards（設計 §6.3）─────────────────────────────────────────────────────

/** local ∪ remote（id 単位）。両方に有れば updatedAt LWW（配置は装飾）。id 昇順。 */
export function mergeCards(
  local: readonly CardRecord[],
  remote: readonly CardRecord[],
): CardRecord[] {
  const l = byId(local)
  const r = byId(remote)
  const out: CardRecord[] = []
  for (const id of new Set([...l.keys(), ...r.keys()])) {
    const a = l.get(id)
    const b = r.get(id)
    if (a && b) {
      const at = numericTime(a.updatedAt)
      const bt = numericTime(b.updatedAt)
      out.push(at > bt ? a : bt > at ? b : pickDeterministic(a, b))
    } else {
      out.push((a ?? b) as CardRecord)
    }
  }
  return out.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
}

// ── board-config（設計 §6.4）─────────────────────────────────────────────

/** まるごと 1 個 LWW。updatedAt が無ければ 0 扱い（束4 が saveBoardConfig で
 *  打つまでの間）。同値は config を安定比較して決定的に。 */
export function mergeBoardConfig(
  local: SyncBoardConfig | null,
  remote: SyncBoardConfig | null,
): SyncBoardConfig | null {
  if (!local) return remote
  if (!remote) return local
  const lt = numericTime(local.updatedAt)
  const rt = numericTime(remote.updatedAt)
  if (lt > rt) return local
  if (rt > lt) return remote
  return pickDeterministic(local, remote)
}

// ── vault（設計 §9）──────────────────────────────────────────────────────

/** 「作成一度きり・以後不変」前提。両方あれば内容は同一のはず。
 *  ⚠️ 束4 の engine へ: 両側の vault が食い違う場合（= 同期を入れる前に2台で
 *  別々に Private を設定していた）、ここで pickDeterministic すると負けた側の
 *  wrappedPrivateKey が失われ、その公開鍵で暗号化された encryptedPayload は
 *  二度と復号できなくなる（暗号文は bookmarks.json に残るのに鍵だけ消える）。
 *  さらに mergeTags は isPrivateVault タグを2つ残す（use-tags.ts は先頭1件を
 *  金庫とみなす＝配列順次第）。engine は食い違いを検知したら黙って進めず、
 *  ユーザーに選ばせる or パスワード再設定を促すこと。ここで pick するのは
 *  「engine が明示的に許した後」の最終手段。
 *  暗号文は復号しない・見ない。将来パスワード再設定（wrappedPrivateKey 変化）で
 *  LWW が要るときは PrivateVaultRecord に updatedAt を足してここで比較する。 */
export function mergeVault(
  local: PrivateVaultRecord | null,
  remote: PrivateVaultRecord | null,
): PrivateVaultRecord | null {
  if (!local) return remote
  if (!remote) return local
  if (stableStringify(local) === stableStringify(remote)) return local
  return pickDeterministic(local, remote)
}

// ── 全 store（設計 §5 / §6）──────────────────────────────────────────────

/** 2 つの SyncSnapshot を store ごとにマージする。mergeAll(L,R) と mergeAll(R,L)
 *  は deep-equal（束4 の収束保証の土台）。 */
export function mergeAll(local: SyncSnapshot, remote: SyncSnapshot): SyncSnapshot {
  return {
    bookmarks: mergeBookmarks(local.bookmarks, remote.bookmarks),
    tags: mergeTags(local.tags, remote.tags),
    cards: mergeCards(local.cards, remote.cards),
    boardConfig: mergeBoardConfig(local.boardConfig, remote.boardConfig),
    vault: mergeVault(local.vault, remote.vault),
  }
}
