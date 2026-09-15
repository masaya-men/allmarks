// K3ライセンス状態のIndexedDB永続化。既存のsync-store.ts/board-config.tsと
// 同じパターン＝settingsストアの新規キーを使うだけ（DBバージョンアップ不要）。
import type { IDBPDatabase } from 'idb'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

const LICENSE_KEY = 'license'

export interface LicenseState {
  readonly kid: string
  readonly deviceId: string
  readonly scope: readonly string[]
  readonly validatedAt: number
}

interface LicenseRecord extends LicenseState {
  readonly key: typeof LICENSE_KEY
}

export async function saveLicense(db: DbLike, state: LicenseState): Promise<void> {
  const record: LicenseRecord = { key: LICENSE_KEY, ...state }
  await db.put('settings', record)
}

export async function loadLicense(db: DbLike): Promise<LicenseState | null> {
  const record = (await db.get('settings', LICENSE_KEY)) as LicenseRecord | undefined
  if (!record) return null
  const { key: _key, ...state } = record
  return state
}

export async function clearLicense(db: DbLike): Promise<void> {
  await db.delete('settings', LICENSE_KEY)
}
