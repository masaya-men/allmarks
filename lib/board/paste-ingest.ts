import type { IDBPDatabase } from 'idb'
import { detectUrlType } from '@/lib/utils/url'
import type { addBookmark, getAllBookmarks } from '@/lib/storage/indexeddb'
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
  readonly add: typeof addBookmark
  readonly fetchOgp: (url: string) => Promise<OgpMeta | null>
}

export type IngestResult = {
  readonly outcome: 'saved' | 'duplicate'
  readonly bookmarkId: string | null
}

const EMBEDDABLE = new Set(['tweet', 'youtube', 'tiktok', 'instagram', 'vimeo', 'soundcloud'])

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
  const all = await deps.getAll(deps.db)
  const existing = all.find((b) => b.url === url && !b.isDeleted)
  if (existing) return { outcome: 'duplicate', bookmarkId: null }

  const type = detectUrlType(url)
  const isEmbeddable = EMBEDDABLE.has(type)
  let meta: OgpMeta | null = null
  if (!isEmbeddable) {
    meta = await deps.fetchOgp(url)
  }

  const created = await deps.add(deps.db, {
    url,
    title: meta?.title || (isEmbeddable ? '' : domainOf(url)),
    description: meta?.description ?? '',
    thumbnail: meta?.image ?? '',
    favicon: meta?.favicon ?? '',
    siteName: meta?.siteName ?? '',
    type,
    tags: [],
  })
  return { outcome: 'saved', bookmarkId: created.id }
}
