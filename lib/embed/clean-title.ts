/**
 * Title text cleaner shared by PlaceholderCard (board) and Lightbox large
 * text display. Two passes:
 *  1) Strip `http(s)://` prefix so raw-URL titles don't dominate display.
 *  2) For X / Twitter URLs, lift the body out of the OGP boilerplate
 *     ("Xユーザーの 〜 さん:「本文」 / X" → "本文").
 *
 * The X branch must NOT match user-content 「」 quotes that appear inside a
 * tweet body — the old regex /「([\s\S]+)」/ greedy-matched any pair of 「」
 * anywhere in the title, which ate the beginning AND end of tweets whose
 * body contained a quoted phrase (B-#22 regression). The OGP boilerplate
 * always has the form "...さん: 「本文」 ..." with "さん" immediately preceding
 * the opening 「, so we anchor the match to that marker — user-content 「」
 * inside the body of a tweet is never preceded by "さん:" and is therefore
 * preserved verbatim.
 */
export function cleanTitle(title: string, url: string): string {
  let cleaned = title
  if (/^https?:\/\//i.test(cleaned)) {
    cleaned = cleaned.replace(/^https?:\/\//i, '')
  }
  if (url.includes('x.com') || url.includes('twitter.com')) {
    const m = cleaned.match(/さん[:：]\s*「([\s\S]+)」/)
    if (m) return m[1].trim()
    // Extension (`extension/twitter.js`) stores titles as `userName + ': ' +
    // head` so the board card shows e.g. 「ユライネル: マジで...」 while the
    // Lightbox uses meta.text (no prefix) plus a separate author block. Strip
    // the leading "[display name]: " so the board visual matches the Lightbox
    // body and bookmarklet-saved tweets (which never carry the prefix).
    //
    // ASCII colon requires whitespace after (so URL port syntax like
    // "example.com:8080" is left alone); full-width colon does not (display
    // names are followed by 「：」 with or without space). Name is capped at
    // 50 chars to skip pathological "long sentence: rest" matches.
    const prefixMatch = cleaned.match(/^([^:：\n]{1,50})(?::\s+|：\s*)/)
    if (prefixMatch) return cleaned.slice(prefixMatch[0].length)
  }
  return cleaned
}
