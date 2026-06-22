import type { IDBPDatabase } from 'idb'
import { detectUrlType } from '@/lib/utils/url'
import { findActiveDuplicate } from '@/lib/storage/indexeddb'
import type { saveBookmarkDeduped, getAllBookmarks } from '@/lib/storage/indexeddb'
import type { AllMarksDB } from '@/lib/storage/indexeddb'

export type OgpMeta = {
  readonly title: string
  readonly description: string
  readonly image: string
  readonly siteName: string
  readonly favicon: string
}

export type IngestDeps = {
  readonly db: IDBPDatabase<AllMarksDB>
  readonly getAll: typeof getAllBookmarks
  readonly save: typeof saveBookmarkDeduped
  readonly fetchOgp: (url: string) => Promise<OgpMeta | null>
}

export type IngestResult = {
  readonly outcome: 'saved' | 'duplicate'
  readonly bookmarkId: string | null
}

const EMBEDDABLE = new Set(['tweet', 'youtube', 'tiktok', 'instagram', 'vimeo', 'soundcloud'])

/** Returns true for URL types that are rich embeds and don't need an OGP fetch. */
export function isEmbeddableType(type: import('@/lib/utils/url').UrlType): boolean {
  return EMBEDDABLE.has(type)
}

/** Server-side OGP fetch for a plain URL. Returns null on any failure so the
 *  caller falls back gracefully. */
export async function fetchOgpMeta(url: string): Promise<OgpMeta | null> {
  try {
    const res = await fetch(`/api/ogp?url=${encodeURIComponent(url)}`)
    if (!res.ok) return null
    const data = (await res.json()) as Partial<OgpMeta> & { error?: string }
    if (data.error) return null
    return {
      title: data.title ?? '',
      description: data.description ?? '',
      image: data.image ?? '',
      siteName: data.siteName ?? '',
      favicon: data.favicon ?? '',
    }
  } catch {
    return null
  }
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export async function ingestPastedUrl(url: string, deps: IngestDeps): Promise<IngestResult> {
  // Cheap pre-check to skip a wasted OGP fetch on an obvious duplicate. The
  // authoritative, atomic dedup happens inside deps.save below (one tx).
  const all = await deps.getAll(deps.db)
  if (findActiveDuplicate(all, url)) return { outcome: 'duplicate', bookmarkId: null }

  const type = detectUrlType(url)
  const isEmbeddable = EMBEDDABLE.has(type)
  let meta: OgpMeta | null = null
  if (!isEmbeddable) {
    meta = await deps.fetchOgp(url)
  }

  const result = await deps.save(deps.db, {
    url,
    title: meta?.title || (isEmbeddable ? '' : domainOf(url)),
    description: meta?.description ?? '',
    thumbnail: meta?.image ?? '',
    favicon: meta?.favicon ?? '',
    siteName: meta?.siteName ?? '',
    type,
    tags: [],
  }, { dedupe: true })
  // invalid-url is unreachable here (extractSinglePastedUrl already enforced
  // http/https), and a race could still surface 'duplicate' — both map to the
  // gentle "already saved" feedback, so anything other than a fresh save is a
  // no-op insert.
  if (result.outcome !== 'saved') return { outcome: 'duplicate', bookmarkId: null }
  return { outcome: 'saved', bookmarkId: result.bookmark.id }
}
