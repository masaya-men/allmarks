import type { BookmarkRecord } from '@/lib/storage/indexeddb'

/** Twitter ハッシュタグ抽出 (= `#word` を捕捉、 空白 / 文末で区切る) */
function extractHashtags(text: string): string[] {
  const matches = text.match(/#([^\s#]+)/g) ?? []
  return matches.map((m) => m.slice(1))
}

/** URL のドメイン部分を抽出 (= 失敗時 空文字) */
function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

/**
 * bookmark 単体から「初出のタグ候補」 を抽出。
 * - Twitter / X ならハッシュタグ
 * - OGP siteName があれば最初に
 * - YouTube / Vimeo 等の siteName も拾う
 * 重複は dedupe、 順序は (siteName, ハッシュタグ) の順。
 */
export function extractCandidatesFromBookmark(b: BookmarkRecord): string[] {
  const out: string[] = []
  const push = (s: string): void => {
    if (s && !out.includes(s)) out.push(s)
  }

  if (b.siteName) push(b.siteName)

  if (b.type === 'tweet') {
    extractHashtags(b.title).forEach(push)
    extractHashtags(b.description).forEach(push)
  }

  return out
}

/**
 * 既存 bookmark 群から、 target に「関連が高そうな」 既存タグを上位に並べる。
 * - 同じドメインのブクマで頻出するタグを優先
 * - target 自身は除外
 * - target の tags に既に含まれてるものは除外
 */
export function scoreSimilarBookmarks(target: BookmarkRecord, corpus: readonly BookmarkRecord[]): string[] {
  const targetHost = hostnameOf(target.url)
  const counts = new Map<string, number>()
  for (const b of corpus) {
    if (b.id === target.id) continue
    const sameHost = targetHost && hostnameOf(b.url) === targetHost
    const weight = sameHost ? 3 : 1
    for (const t of b.tags) {
      if (target.tags.includes(t)) continue
      counts.set(t, (counts.get(t) ?? 0) + weight)
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
}
