// lib/onboarding/onboarding-state.ts
import type { IDBPDatabase } from 'idb'

/** Persisted under its own settings key (mirrors quick-tag-setting.ts). */
const ONBOARDING_KEY = 'onboarding-completed'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>
type Record_ = { key: string; completed: boolean }

export async function isOnboardingComplete(db: DbLike): Promise<boolean> {
  const rec = (await db.get('settings', ONBOARDING_KEY)) as Record_ | undefined
  return rec?.completed === true
}

export async function markOnboardingComplete(db: DbLike): Promise<void> {
  await db.put('settings', { key: ONBOARDING_KEY, completed: true } satisfies Record_)
}

export async function shouldAutoStartOnboarding(
  db: DbLike, itemCount: number,
): Promise<boolean> {
  if (itemCount !== 0) return false
  return !(await isOnboardingComplete(db))
}
