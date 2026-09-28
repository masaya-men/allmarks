import type { TweetIndex } from './types'

/**
 * Maps a card spec's `tweet` index (1|2|3) to its i18n message key. Shared by
 * every section that renders tweet-style demo cards (Hero, Problem, Features)
 * so the 1→tweet1 / 2→tweet2 / 3→tweet3 mapping is declared exactly once.
 */
export function tweetKey(i: TweetIndex): 'landing.demo.tweet1' | 'landing.demo.tweet2' | 'landing.demo.tweet3' {
  if (i === 1) return 'landing.demo.tweet1'
  if (i === 2) return 'landing.demo.tweet2'
  return 'landing.demo.tweet3'
}
