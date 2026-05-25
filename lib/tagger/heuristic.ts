import type { BookmarkTagger, BookmarkTaggerContext, BookmarkTaggerInput, TagSuggestion } from './types'

const DOMAIN_TO_KEYWORD: Record<string, string[]> = {
  'github.com': ['code', 'dev', 'programming'],
  'gitlab.com': ['code', 'dev'],
  'stackoverflow.com': ['code', 'dev'],
  'youtube.com': ['video', 'music'],
  'youtu.be': ['video', 'music'],
  'vimeo.com': ['video', 'film'],
  'tiktok.com': ['video'],
  'twitter.com': ['social'],
  'x.com': ['social'],
  'instagram.com': ['photo', 'photography', 'social'],
  'medium.com': ['article', 'writing'],
  'substack.com': ['article', 'writing'],
  'figma.com': ['design'],
  'dribbble.com': ['design'],
  'behance.net': ['design'],
  'pinterest.com': ['design', 'photo'],
  'unsplash.com': ['photo', 'photography'],
  'flickr.com': ['photo', 'photography'],
}

function hostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

/** Hashtag literal extractor: `#xxx` patterns lifted out of title/desc/siteName.
 *  Covers ASCII + Latin extended + CJK + most non-ASCII letters via Unicode
 *  property escape `\p{L}`. Returns lowercased names without the `#`. */
function extractHashtags(text: string): string[] {
  const matches = text.match(/#([\p{L}\p{N}_]+)/gu) ?? []
  return matches.map((m) => m.slice(1).toLowerCase())
}

export class HeuristicTagger implements BookmarkTagger {
  constructor(private ctx: BookmarkTaggerContext) {}

  async suggest(input: BookmarkTaggerInput): Promise<TagSuggestion[]> {
    const suggestions: TagSuggestion[] = []
    const host = hostname(input.url)
    const haystack = (input.title + ' ' + input.description + ' ' + input.siteName).toLowerCase()
    const haystackWords = haystack.split(/\W+/).filter((w) => w.length >= 3)
    const hashtagSet = new Set(extractHashtags(input.title + ' ' + input.description + ' ' + input.siteName))

    const domainKeywords = DOMAIN_TO_KEYWORD[host] ?? []
    const tags = this.ctx.tags

    for (const tag of tags) {
      const tagName = tag.name.toLowerCase()
      // Hashtag exact match: highest confidence (= explicit user signal,
      // e.g. a tweet body literally tagged `#design`)
      if (hashtagSet.has(tagName)) {
        suggestions.push({ tagId: tag.id, confidence: 0.95, reason: 'hashtag' })
        continue
      }
      // Domain match: high confidence
      if (domainKeywords.some((kw) => kw === tagName || tagName.includes(kw) || kw.includes(tagName))) {
        suggestions.push({ tagId: tag.id, confidence: 0.8, reason: 'domain' })
        continue
      }
      // Keyword match in title/description/siteName (symmetric: word substring of tag name or tag name substring of haystack)
      if (tagName.length >= 3 && (haystack.includes(tagName) || haystackWords.some((w) => tagName.includes(w)))) {
        suggestions.push({ tagId: tag.id, confidence: 0.5, reason: 'keyword' })
      }
    }

    // De-duplicate by tagId, keep highest confidence
    const byId = new Map<string, TagSuggestion>()
    for (const s of suggestions) {
      const prev = byId.get(s.tagId)
      if (!prev || prev.confidence < s.confidence) byId.set(s.tagId, s)
    }
    return Array.from(byId.values()).sort((a, b) => b.confidence - a.confidence)
  }
}
