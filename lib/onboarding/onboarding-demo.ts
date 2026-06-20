// lib/onboarding/onboarding-demo.ts
import type { IDBPDatabase } from 'idb'
import { addBookmark, deleteBookmark, getAllBookmarks } from '@/lib/storage/indexeddb'
import { DEMO_COLLAGE } from '@/lib/marketing/demo-collage'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

const DEFAULT_DEMO_COUNT = 12

/** Hard-delete every bookmark flagged onboardingDemo. Returns how many were
 *  removed (so callers can skip a board reload when nothing changed). */
export async function clearOnboardingDemo(db: DbLike): Promise<number> {
  const all = await getAllBookmarks(db)
  let removed = 0
  for (const b of all) {
    if (b.onboardingDemo === true) { await deleteBookmark(db, b.id); removed++ }
  }
  return removed
}

export async function countOnboardingDemo(db: DbLike): Promise<number> {
  const all = await getAllBookmarks(db)
  return all.filter((b) => b.onboardingDemo === true).length
}

/** Seed `count` CC0 demo cards (image-type) flagged onboardingDemo.
 *  Clears any prior demo first so re-entry never duplicates. */
export async function seedOnboardingDemo(
  db: DbLike, count: number = DEFAULT_DEMO_COUNT,
): Promise<string[]> {
  await clearOnboardingDemo(db)
  const assets = DEMO_COLLAGE.slice(0, count)
  const ids: string[] = []
  for (const a of assets) {
    const rec = await addBookmark(db, {
      url: `https://allmarks.app/demo/${encodeURIComponent(a.src)}`,
      title: a.credit,
      description: '',
      thumbnail: `/${a.src}`,
      favicon: '',
      siteName: 'AllMarks',
      type: 'website',
      onboardingDemo: true,
    })
    ids.push(rec.id)
  }
  return ids
}
