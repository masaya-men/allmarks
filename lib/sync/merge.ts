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
export function pickDeterministic<T>(a: T, b: T): T {
  return stableStringify(a) >= stableStringify(b) ? a : b
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

  // ケース1: どちらも生存 → LWW（同値は決定的）。tags[] は他フィールドと同じ
  // whole-record LWW の一部として扱う（集合和はしない）。設計 §6.1 改訂
  // (s211 ユーザー確認・memory `project_allmarks_sync_tag_merge_strategy`):
  // 集合和(G-Set)は構造的に「タグ外し」を伝播できず、かつ Private の
  // encryptedPayload/plaintext の原子性(lib/private/apply-tag-change.ts)を
  // tags[] だけ特別扱いしないと壊す(旧 C1 バグ)。record 全体の LWW に一本化
  // すると両方が自然に解決する — 業界の "field-level last-write-wins" 相当
  // (CloudKit 同期等で実例あり)。「タグを外す」操作は正しく伝播するが、
  // 未同期のまま両端末が別々のタグを足すと片方が LWW で負けて消えることがある
  // (許容済みのトレードオフ)。
  // bookmarks は savedAt へのフォールバック不要: v17 migration が全既存行を
  // updatedAt = Date.parse(savedAt) で backfill 済み（tags の createdAt 相当）。
  const at = numericTime(a.updatedAt)
  const bt = numericTime(b.updatedAt)
  if (at > bt) return a
  if (bt > at) return b
  return pickDeterministic(a, b)
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

/** 常にこの端末（local）の値を残す。ボード設定（テーマ・角の丸み・モーション・
 *  背景文字・縦横比・表示モード・フィルタ等、見た目や挙動に関する設定一式）は
 *  端末ごとに独立という方針に統一（s218 でテーマのみ先行決定、s219 で全項目に
 *  拡張 — ユーザー決定: 「見た目は端末ごとに分離するのが普通」）。実データ
 *  （ブクマ・タグ・カード配置・Private の金庫）だけが同期対象。
 *  元は themeId/themeCustomizations だけの例外扱いだったが、
 *  boardConfigFileSchema が z.record(...) の「なんでも入る箱」であるため、
 *  新しい設定を追加するたびに個別に除外を書かないと自動的に同期されてしまう
 *  構造上の弱点があった（roundedCorners が実際にこの穴を抜けて同期され続けて
 *  いた）。個別の例外を積み増す代わりに既定を反転させ、ボード設定は「同期
 *  しない」を既定にする。新規端末の初回同期（local が無い＝まだ一度もこの
 *  端末で設定していない）だけは、リモートを初期値として採用する（既存の
 *  !local 経路、変更なし）。 */
export function mergeBoardConfig(
  local: SyncBoardConfig | null,
  remote: SyncBoardConfig | null,
): SyncBoardConfig | null {
  if (!local) return remote
  return local
}

// ── vault（設計 §9）──────────────────────────────────────────────────────

/** local/remote の vault は「まるごと1個」扱い。暗号文は復号しない・見ない。
 *  **食い違い検知(束4のengine.tsのvaultRecordsDiffer)は「本当に別々の金庫」
 *  だけをconflict扱いする**(publicKeyが一致していれば同じ金庫のパスワード
 *  変更に過ぎない)。ここではその2ケースを区別する:
 *  - 同じ金庫(publicKey・tagIdが一致)・中身(wrappedPrivateKey等)が違う
 *    → パスワード変更。updatedAtが新しい方を丸ごと採用(LWW)。updatedAtが
 *    無い方(この機能より前に作られたレコード)は0扱いで必ず負ける。
 *  - それ以外(publicKeyが違う=本当に別の金庫。engineがconflict扱いする
 *    経路で、ここに来る前にvault:nullに差し替えられるので実運用では
 *    ほぼ通らないが、この関数は純関数として単体でも正しく振る舞う必要が
 *    ある) → 決定的タイブレーク(pickDeterministic)。
 *  同じ金庫の LWW で勝った側に復旧キーのラップが無く、負けた側にある場合だけ、
 *  復旧関連フィールド(recoverySalt / wrappedPrivateKeyByRecoveryKey /
 *  recoveryIterations)を勝者に引き継ぐ。引き継ぎ判定も lt/rt の数値比較だけに
 *  依存するので mergeVault(L,R) と mergeVault(R,L) は deep-equal のまま。 */
export function mergeVault(
  local: PrivateVaultRecord | null,
  remote: PrivateVaultRecord | null,
): PrivateVaultRecord | null {
  if (!local) return remote
  if (!remote) return local
  if (stableStringify(local) === stableStringify(remote)) return local
  if (local.publicKey === remote.publicKey && local.tagId === remote.tagId) {
    const lt = numericTime(local.updatedAt)
    const rt = numericTime(remote.updatedAt)
    // updatedAt が同値の場合もpickDeterministicで勝者を決め、以下の復旧キー
    // 引き継ぎを同じように適用する。引き継ぎ後もwinnerのupdatedAtは変わらない
    // ため、そのままだと次の同期で元のレコードと同値になりタイブレークに
    // 入り直す — そこで引き継ぎが効かないと1周期遅れて復旧キーが消える
    // (最終レビュー再指摘 I-B)。タイブレーク自身にも引き継ぎを適用することで
    // その周期でも復旧キーが残り、収束する。
    const winner = lt !== rt ? (lt > rt ? local : remote) : pickDeterministic(local, remote)
    const loser = winner === local ? remote : local
    // publicKey/tagId が一致 = 同じ pkcs8 を包んでいるので、負けた側の復旧
    // ラップは勝った側に対しても必ず有効。レコード丸ごとの LWW のままだと、
    // 「A が復旧キーを発行して紙に書いた直後に、まだ同期していない B が先に
    // パスワードを変更した」だけで、発行済みの復旧キーが無言で消滅する
    // (最終レビュー指摘 I-B)。捨てずに勝者へ引き継ぐ。
    if (!winner.wrappedPrivateKeyByRecoveryKey && loser.wrappedPrivateKeyByRecoveryKey) {
      return {
        ...winner,
        recoverySalt: loser.recoverySalt,
        wrappedPrivateKeyByRecoveryKey: loser.wrappedPrivateKeyByRecoveryKey,
        recoveryIterations: loser.recoveryIterations,
      }
    }
    return winner
  }
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
