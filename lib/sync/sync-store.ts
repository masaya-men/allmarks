import type { IDBPDatabase } from 'idb'
import type { SyncTokens } from './auth'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

const TOKENS_KEY = 'sync-tokens'

interface SyncTokensRecord extends SyncTokens {
  readonly key: typeof TOKENS_KEY
}

export async function saveSyncTokens(db: DbLike, tokens: SyncTokens): Promise<void> {
  const record: SyncTokensRecord = { key: TOKENS_KEY, ...tokens }
  await db.put('settings', record)
}

export async function loadSyncTokens(db: DbLike): Promise<SyncTokens | null> {
  const record = (await db.get('settings', TOKENS_KEY)) as SyncTokensRecord | undefined
  if (!record) return null
  const { key: _key, ...tokens } = record
  return tokens
}

export async function clearSyncTokens(db: DbLike): Promise<void> {
  await db.delete('settings', TOKENS_KEY)
}
