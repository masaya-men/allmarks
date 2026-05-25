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

/** 候補の由来源 — TagAddPopover の SUGGESTED ranking で confidence 推定に使う。 */
export type NewCandidateSource = 'siteName' | 'hashtag'

export interface NewCandidate {
  readonly name: string
  readonly source: NewCandidateSource
}

/**
 * bookmark 単体から「初出のタグ候補」 を 由来付きで抽出。
 * 旧 extractCandidatesFromBookmark のスーパーセット (= 同じ抽出ロジック、
 * 戻り値だけ source ラベル付き)。
 */
export function extractTypedCandidatesFromBookmark(b: BookmarkRecord): readonly NewCandidate[] {
  const out: NewCandidate[] = []
  const push = (name: string, source: NewCandidateSource): void => {
    if (name && !out.some((c) => c.name === name)) out.push({ name, source })
  }

  if (b.siteName) push(b.siteName, 'siteName')

  if (b.type === 'tweet') {
    extractHashtags(b.title).forEach((h) => push(h, 'hashtag'))
    extractHashtags(b.description).forEach((h) => push(h, 'hashtag'))
  }

  return out
}

/**
 * bookmark 単体から「初出のタグ候補」 を抽出 (= 名前のみ).
 * extractTypedCandidatesFromBookmark の wrapper、 既存呼出元の後方互換用。
 */
export function extractCandidatesFromBookmark(b: BookmarkRecord): string[] {
  return extractTypedCandidatesFromBookmark(b).map((c) => c.name)
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
