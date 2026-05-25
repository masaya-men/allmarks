import type { TagRecord } from '@/lib/storage/indexeddb'

export type TagReason = 'domain' | 'keyword' | 'embedding' | 'llm' | 'hashtag'

export interface TagSuggestion {
  readonly tagId: string
  readonly confidence: number
  readonly reason: TagReason
}

export interface BookmarkTaggerInput {
  readonly url: string
  readonly title: string
  readonly description: string
  readonly siteName: string
}

export interface BookmarkTagger {
  suggest(input: BookmarkTaggerInput): Promise<TagSuggestion[]>
}

export interface BookmarkTaggerContext {
  readonly tags: ReadonlyArray<TagRecord>
}
