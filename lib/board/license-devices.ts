// lib/board/license-devices.ts
// `act:<kid>`（活性化済み端末の一覧）と `rm:<kid>`（明示的に外された端末IDの
// tombstone）の読み書き共通部品。
// 旧形式（deviceId の文字列配列）と新形式（{id,label,at}[]）の両方を読み、
// 壊れた要素は落とす。functions/activate.ts・activate-status.ts・
// api/license/status.ts・api/license/release.ts の4か所から使う。
//
// rm:<kid> がある理由（tombstone方式）: /activate はネットワーク失敗時
// fail-open（署名が本物なら端末はローカルで解錠される）なので、
// 「act:<kid> に居ない = 一度も登録されていない」を「外された」と誤判定すると、
// 登録に失敗しただけの端末が初回の日次チェックで誤って停止してしまう。
// そのため「外された」は act:<kid> に居ないことではなく、rm:<kid> に
// 明示的に載っていることだけで判定する（release.ts が書く／activate.ts が
// 再登録時に消す）。
// 設計: docs/private/2026-09-24-paddle-license-lifecycle-design.md §2.1, §2.3, §2.4, §2.5。
import { z } from 'zod'

export interface DeviceEntry {
  readonly id: string
  readonly label: string
  readonly at: number
}

const deviceEntrySchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().max(60),
  at: z.number(),
})

/**
 * `act:<kid>` の生JSON文字列（KVから読んだそのまま／null＝未登録）を
 * DeviceEntry[] に正規化する。壊れた要素（型違い・空文字id等）は黙って除外する
 * （既存の activate-status.ts の「corrupt value は count:0 として扱う」方針を踏襲）。
 */
export function parseDeviceList(raw: string | null): DeviceEntry[] {
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const devices: DeviceEntry[] = []
  for (const item of parsed) {
    if (typeof item === 'string') {
      if (item.length > 0 && item.length <= 64) devices.push({ id: item, label: '', at: 0 })
      continue
    }
    const result = deviceEntrySchema.safeParse(item)
    if (result.success) devices.push(result.data)
  }
  return devices
}

/** KV へ書き戻す形（常に新形式）にシリアライズする。 */
export function serializeDeviceList(devices: readonly DeviceEntry[]): string {
  return JSON.stringify(devices)
}

/** rm:<kid> の上限。古いものから落とす（無限に伸びないようにするだけの上限、鍵あたり同時5台なので通常は届かない）。 */
const MAX_REMOVED = 50

/**
 * `rm:<kid>` の生JSON文字列（null＝tombstoneなし）を deviceId の配列に正規化する。
 * 壊れた要素（文字列でない・空文字・長すぎる）は黙って除外する。
 */
export function parseRemovedList(raw: string | null): string[] {
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0 && item.length <= 64)
}

export function serializeRemovedList(ids: readonly string[]): string {
  return JSON.stringify(ids)
}

/** target を末尾に追加（既存の出現は除いて重複させない）し、上限を超えたら古い方から落とす。 */
export function addToRemovedList(ids: readonly string[], target: string): string[] {
  const next = [...ids.filter((id) => id !== target), target]
  return next.length > MAX_REMOVED ? next.slice(next.length - MAX_REMOVED) : next
}

export function removeFromRemovedList(ids: readonly string[], target: string): string[] {
  return ids.filter((id) => id !== target)
}
