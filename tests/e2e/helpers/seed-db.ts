// tests/e2e/helpers/seed-db.ts
// e2e 共通の IndexedDB seed。版数を一切固定しない:
//   1. /board を開く（アプリの initDB が現行スキーマを作る/開く）
//   2. 無版数 open でアプリが作り終えたスキーマに「接続」できるまでポーリング
//   3. readwrite でレコードを書き、reload で盤面に反映
// これにより VersionError(9)<(16) が構造的に消え、将来 DB_VERSION が上がっても
// このヘルパーは修正不要。スキーマの正本は lib/storage/indexeddb.ts だけに保つ。

import type { Page } from '@playwright/test'

export const DB_NAME = 'booklage-db'

/** アプリの現行スキーマが持つ全ストア。ポーリングの完了判定に使う（作りはしない）。 */
const REQUIRED_STORES = ['bookmarks', 'cards', 'settings', 'preferences', 'moods', 'tags'] as const

export type SeedRecord = { readonly store: string; readonly value: unknown }

/** 初回モーダル/オンボを抑止する settings/preferences の定番レコード。
 *  tests/e2e/mobile-share.spec.ts の seedBoard (L41-44) が入れている値をそのまま写した。 */
export function firstRunSuppressors(): readonly SeedRecord[] {
  const nowIso = new Date().toISOString()
  return [
    { store: 'settings', value: { key: 'onboarding-completed', completed: true } },
    { store: 'settings', value: { key: 'data-home-ack', at: nowIso } },
    { store: 'settings', value: { key: 'last-backup-at', at: nowIso } },
  ]
}

export async function seedDb(page: Page, records: readonly SeedRecord[]): Promise<void> {
  await page.goto('/board')
  await page.evaluate(
    async ({ dbName, requiredStores, rows }) => {
      const openCurrent = (): Promise<IDBDatabase> =>
        new Promise((resolve, reject) => {
          const req = indexedDB.open(dbName) // 無版数 = 既存版に接続
          req.onsuccess = (): void => resolve(req.result)
          req.onerror = (): void => reject(req.error)
        })
      const deadline = Date.now() + 15_000
      let db = await openCurrent()
      // アプリが全ストアを作り終えるまで待つ。開きっぱなしはアプリ側の
      // versionchange を塞ぐので、確認したら即 close して少し待って再接続。
      while (!requiredStores.every((s: string) => db.objectStoreNames.contains(s))) {
        db.close()
        if (Date.now() > deadline) throw new Error(`app schema not ready in 15s (has: ${Array.from(db.objectStoreNames).join(',')})`)
        await new Promise((r) => setTimeout(r, 150))
        db = await openCurrent()
      }
      db.onversionchange = (): void => db.close()
      const stores = Array.from(new Set(rows.map((r: { store: string }) => r.store)))
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(stores, 'readwrite')
        for (const r of rows) tx.objectStore(r.store).put(r.value)
        tx.oncomplete = (): void => resolve()
        tx.onerror = (): void => reject(tx.error)
        tx.onabort = (): void => reject(tx.error)
      })
      db.close()
    },
    { dbName: DB_NAME, requiredStores: REQUIRED_STORES, rows: records as { store: string; value: unknown }[] },
  )
  await page.reload()
}
