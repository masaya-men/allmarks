import { describe, it, expect } from 'vitest'
import { tweetKey } from './tweet-key'

describe('tweetKey', () => {
  it('maps 1/2/3 to their landing.demo.tweetN keys', () => {
    expect(tweetKey(1)).toBe('landing.demo.tweet1')
    expect(tweetKey(2)).toBe('landing.demo.tweet2')
    expect(tweetKey(3)).toBe('landing.demo.tweet3')
  })
})
