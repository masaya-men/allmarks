// lib/onboarding/onboarding-demo.ts
import type { IDBPDatabase } from 'idb'
import { addBookmark, deleteBookmark, getAllBookmarks } from '@/lib/storage/indexeddb'
import { getAllTags, deleteTagCascade } from '@/lib/storage/tags'
import { DEMO_COLLAGE } from '@/lib/marketing/demo-collage'
import type { MediaSlot } from '@/lib/embed/types'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

const DEFAULT_DEMO_COUNT = 12

// Real, long-lived Blender Foundation open movies (CC BY) — verified via YouTube
// oEmbed. Used so the MOTION scene can showcase the genuine behaviour: thumbnails
// auto-fetched, ONE plays as the muted hero, the rest crossfade story frames.
// (Big Buck Bunny aqz-KE-bpKQ is intentionally NOT here — it's the paste-scene
// sample, so reusing it would duplicate that card on the board.)
const DEMO_VIDEOS: ReadonlyArray<{ readonly id: string; readonly title: string }> = [
  { id: 'eRsGyueVLvQ', title: 'Sintel — Blender Foundation (CC BY)' },
  { id: 'R6MlUcmOul8', title: 'Tears of Steel — Blender Foundation (CC BY)' },
  { id: 'TLkA0RELQ1g', title: 'Elephants Dream — Blender Foundation (CC BY)' },
  { id: 'Y-rmzh0PI3c', title: 'Cosmos Laundromat — Blender Foundation (CC BY)' },
]

type DemoSpec = Parameters<typeof addBookmark>[1]

/** The curated, motion-rich demo board, in order: multi-image cycling cards
 *  (bundled CC0 art — move with no network), real video cards (Blender open
 *  movies — thumbnail + hero playback + frame slideshow), then static collage
 *  fill. seedOnboardingDemo() takes the first `count` of these. */
function buildDemoSpecs(): DemoSpec[] {
  const specs: DemoSpec[] = []

  // (A) multi-image cycling cards — 3 cards × 4 bundled images each.
  for (let g = 0; g < 3; g++) {
    const group = DEMO_COLLAGE.slice(g * 4, g * 4 + 4)
    if (group.length < 2) break
    const slots: MediaSlot[] = group.map((a): MediaSlot => ({ type: 'photo', url: `/${a.src}` }))
    specs.push({
      url: `https://allmarks.app/demo/multi-${g}`,
      title: group[0].credit, description: '', thumbnail: slots[0].url,
      favicon: '', siteName: 'AllMarks', type: 'website', mediaSlots: slots,
    })
  }

  // (B) video cards — real YouTube (Blender open movies).
  for (const v of DEMO_VIDEOS) {
    specs.push({
      url: `https://www.youtube.com/watch?v=${v.id}`,
      title: v.title, description: '',
      thumbnail: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
      favicon: '', siteName: 'YouTube', type: 'youtube', hasVideo: true,
    })
  }

  // (C) static collage fill — remaining bundled images for collage density.
  for (const a of DEMO_COLLAGE.slice(12)) {
    specs.push({
      url: `https://allmarks.app/demo/${encodeURIComponent(a.src)}`,
      title: a.credit, description: '', thumbnail: `/${a.src}`,
      favicon: '', siteName: 'AllMarks', type: 'website',
    })
  }

  return specs
}

/** Hard-delete everything the onboarding created — demo cards, the user's
 *  TRY-THIS / paste saves made during the tutorial, AND the demo "sample" tag
 *  (all flagged onboardingDemo). Returns how many bookmarks were removed (so
 *  callers can skip a board reload when nothing changed). Real bookmarks and
 *  real tags carry no flag and are never touched. */
export async function clearOnboardingDemo(db: DbLike): Promise<number> {
  const all = await getAllBookmarks(db)
  let removed = 0
  for (const b of all) {
    if (b.onboardingDemo === true) { await deleteBookmark(db, b.id); removed++ }
  }
  // Sweep onboarding-created tags too (cascade scrubs any lingering references
  // so no bookmark is left pointing at a deleted tag).
  const tags = await getAllTags(db)
  for (const t of tags) {
    if (t.onboardingDemo === true) await deleteTagCascade(db, t.id)
  }
  return removed
}

export async function countOnboardingDemo(db: DbLike): Promise<number> {
  const all = await getAllBookmarks(db)
  return all.filter((b) => b.onboardingDemo === true).length
}

/** Seed up to `count` motion-rich demo cards (multi-image + video + static),
 *  all flagged onboardingDemo. count<=0 (mobile) seeds nothing. Clears any prior
 *  demo first so re-entry never duplicates. Returns exactly min(count, curated). */
export async function seedOnboardingDemo(
  db: DbLike, count: number = DEFAULT_DEMO_COUNT,
): Promise<string[]> {
  await clearOnboardingDemo(db)
  const ids: string[] = []
  if (count <= 0) return ids
  const specs = buildDemoSpecs().slice(0, count)
  for (const s of specs) {
    const rec = await addBookmark(db, { ...s, onboardingDemo: true })
    ids.push(rec.id)
  }
  return ids
}
