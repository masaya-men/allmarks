// lib/share/board-to-share.ts
import {
  SHARE_LIMITS_V2,
  SHARE_SCHEMA_VERSION_V2,
  type ShareCardType,
  type ShareCardV2,
  type ShareDataV2,
  type TagDict,
} from './types-v2'
import type { ThemeId } from '@/lib/board/types'

export type BoardItemForShare = {
  readonly bookmarkId: string
  readonly url: string
  readonly title: string
  readonly description?: string
  readonly thumbnail?: string
  readonly aspectRatio: number
  readonly tags: ReadonlyArray<string>
  readonly cardWidth: number
}

export type TagForShare = {
  readonly id: string
  readonly name: string
  readonly color?: string
}

export type FilterForShare = {
  readonly mode: 'and' | 'or'
  readonly tagIds: ReadonlyArray<string>
}

export type BuildShareArgs = {
  readonly items: ReadonlyArray<BoardItemForShare>
  readonly tags: ReadonlyArray<TagForShare>
  readonly filter: FilterForShare | null
  readonly now: number
  readonly themeId?: ThemeId
  readonly detectType?: (url: string) => ShareCardType
}

function defaultDetectType(url: string): ShareCardType {
  if (url.includes('twitter.com') || url.includes('x.com')) return 'tweet'
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('tiktok.com')) return 'tiktok'
  if (url.includes('instagram.com')) return 'instagram'
  if (url.includes('vimeo.com')) return 'vimeo'
  if (url.includes('soundcloud.com')) return 'soundcloud'
  if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url)) return 'image'
  return 'website'
}

function truncate(s: string | undefined, max: number): string | undefined {
  if (s === undefined) return undefined
  return s.length > max ? s.slice(0, max) : s
}

export function buildShareDataFromBoard(args: BuildShareArgs): ShareDataV2 {
  const detect = args.detectType ?? defaultDetectType
  const capped = args.items.slice(0, SHARE_LIMITS_V2.MAX_CARDS)
  const cards: ShareCardV2[] = capped.map((it) => ({
    u: it.url,
    t: truncate(it.title, SHARE_LIMITS_V2.MAX_TITLE) ?? '',
    d: truncate(it.description, SHARE_LIMITS_V2.MAX_DESCRIPTION),
    th: it.thumbnail || undefined,
    ty: detect(it.url),
    cw: it.cardWidth,
    a: it.aspectRatio,
    tg: it.tags.length > 0 ? Array.from(it.tags) : undefined,
  }))

  const referencedTagIds = new Set<string>()
  cards.forEach((c) => c.tg?.forEach((id) => referencedTagIds.add(id)))
  let tagDict: TagDict | undefined
  if (referencedTagIds.size > 0) {
    const dict: Record<string, { n: string; c?: string }> = {}
    args.tags.forEach((t) => {
      if (referencedTagIds.has(t.id)) {
        dict[t.id] = t.color ? { n: t.name, c: t.color } : { n: t.name }
      }
    })
    tagDict = dict
  }

  return {
    v: SHARE_SCHEMA_VERSION_V2,
    cards,
    tags: tagDict,
    filter: args.filter ?? undefined,
    ...(args.themeId ? { theme: args.themeId } : {}),
    createdAt: args.now,
  }
}
