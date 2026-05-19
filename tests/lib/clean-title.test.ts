import { describe, it, expect } from 'vitest'
import { cleanTitle } from '@/lib/embed/clean-title'

describe('cleanTitle', () => {
  describe('http(s) prefix', () => {
    it('strips https:// prefix from URL-only titles', () => {
      expect(cleanTitle('https://example.com/article', 'https://example.com/article'))
        .toBe('example.com/article')
    })
    it('strips http:// prefix as well', () => {
      expect(cleanTitle('http://foo.com', 'http://foo.com')).toBe('foo.com')
    })
    it('leaves titles without http prefix untouched (non-X)', () => {
      expect(cleanTitle('Some article', 'https://example.com/x')).toBe('Some article')
    })
  })

  describe('X / Twitter OGP boilerplate stripping', () => {
    it('extracts body from "Xユーザーの〜さん:「本文」 / X" boilerplate', () => {
      const input = 'Xユーザーのほげさん: 「これが本文だよ」 / X'
      expect(cleanTitle(input, 'https://x.com/foo/status/123')).toBe('これが本文だよ')
    })
    it('extracts body when boilerplate uses 全角コロン', () => {
      const input = 'Xユーザーのほげさん：「本文」 / X'
      expect(cleanTitle(input, 'https://x.com/foo/status/123')).toBe('本文')
    })
    it('extracts body from twitter.com URL (legacy)', () => {
      const input = 'Xユーザーのほげさん: 「短いツイート」 / X'
      expect(cleanTitle(input, 'https://twitter.com/foo/status/123')).toBe('短いツイート')
    })
    it('extracts body even if " / X" suffix is missing', () => {
      const input = 'Xユーザーのほげさん: 「本文だけ」'
      expect(cleanTitle(input, 'https://x.com/foo/status/123')).toBe('本文だけ')
    })
  })

  describe('X / Twitter user-content 「」 must NOT be stripped (B-#22 regression)', () => {
    it('preserves full tweet body when 「」 appears in user content (= mid-text quote)', () => {
      // The bug: cleanTitle used to greedy-match /「(.+)」/ and ate the
      // beginning AND end of the tweet, leaving only the inner quote.
      // The user reported tweet 2056212099488235790 where the body contains
      // a quoted phrase 「否定意見...考えようよ」 mid-tweet.
      const tweet = 'マジでキモいよなこの風潮。\n\n昔はその作品が好きなオタクだからこそ、駄目なところは徹底的に批判するのが普通だったのに、今は「否定意見なんてわざわざ言わなくても良いじゃん。ファンが見たらどう思うか考えようよ」みたいなキモい意見ばかりで、それは信者であってファンじゃねーだろと思う。'
      expect(cleanTitle(tweet, 'https://x.com/yurinel0602/status/2056212099488235790'))
        .toBe(tweet)
    })
    it('preserves text starting with 「 when no さん: prefix precedes it', () => {
      const input = '「これは引用句」 で始まるツイート本文'
      expect(cleanTitle(input, 'https://x.com/foo/status/1')).toBe(input)
    })
    it('preserves body content (unclosed 「) after the prefix-strip step (= boilerplate regex must not fire)', () => {
      // Extension-style title with unclosed 「: the [name]: prefix is stripped
      // (B-#22 follow-up — see "prefix stripping" tests below), but the
      // remaining body must be preserved verbatim including the trailing 「.
      // The OLD boilerplate regex /「(.+)」/ would have eaten the whole body
      // here too — this test guards against that regression.
      const input = 'ユライネル: マジでキモいよなこの風潮。\n\n昔はその作品が好きなオタクだからこそ、駄目なところは徹底的に批判するのが普通だったのに、今は「否定意見なんて…'
      const expectedBody = 'マジでキモいよなこの風潮。\n\n昔はその作品が好きなオタクだからこそ、駄目なところは徹底的に批判するのが普通だったのに、今は「否定意見なんて…'
      expect(cleanTitle(input, 'https://x.com/yurinel0602/status/123')).toBe(expectedBody)
    })
  })

  describe('X / Twitter extension-style "[name]: " prefix stripping (B-#22 follow-up)', () => {
    // Extension (extension/twitter.js) saves title as `userName + ': ' + head`.
    // The board card therefore shows "ユライネル: マジで..." while the Lightbox
    // uses meta.text (no prefix) and shows the author in a separate block. To
    // align the board with the Lightbox visual, strip the leading "[name]: "
    // prefix for X URLs.
    it('strips leading "[display name]: " prefix', () => {
      const input = 'ユライネル: マジでキモいよなこの風潮。'
      expect(cleanTitle(input, 'https://x.com/yurinel0602/status/1'))
        .toBe('マジでキモいよなこの風潮。')
    })
    it('strips multi-byte name prefix with whitespace tolerance', () => {
      const input = 'John Doe:   This is a tweet body'
      expect(cleanTitle(input, 'https://x.com/johndoe/status/1'))
        .toBe('This is a tweet body')
    })
    it('strips name prefix even when body itself contains another colon', () => {
      // Only the FIRST "name: " is stripped — any colon further into the body
      // (e.g. "今日: 〜" heading style) is preserved as part of the body.
      const input = 'ユライネル: 今日: ハロー'
      expect(cleanTitle(input, 'https://x.com/yurinel0602/status/1'))
        .toBe('今日: ハロー')
    })
    it('handles 全角コロン variant', () => {
      const input = 'ユライネル：マジでキモい'
      expect(cleanTitle(input, 'https://x.com/yurinel0602/status/1'))
        .toBe('マジでキモい')
    })
    it('does NOT strip prefix on non-X URLs', () => {
      const input = '田中: こんにちは'
      expect(cleanTitle(input, 'https://example.com/article')).toBe(input)
    })
    it('does NOT match when colon is too far in (= no realistic name)', () => {
      // 50+ char "name" before colon is not a real display name — leave as-is.
      const longish = 'a'.repeat(60) + ': body'
      expect(cleanTitle(longish, 'https://x.com/foo/status/1')).toBe(longish)
    })
    it('does NOT match when no space follows colon (= part of body)', () => {
      const input = 'http://example.com:8080 path'  // colon-without-space pattern
      expect(cleanTitle(input, 'https://x.com/foo/status/1'))
        .toBe('example.com:8080 path')  // http:// stripped, no name-prefix match
    })
    it('boilerplate match (さん:「」) takes precedence over prefix strip', () => {
      // OGP boilerplate path should still extract the body, not just strip prefix.
      const input = 'Xユーザーのほげさん: 「本文」 / X'
      expect(cleanTitle(input, 'https://x.com/hoge/status/1')).toBe('本文')
    })
  })

  describe('Non-X URL', () => {
    it('does NOT strip 「」 from non-X URLs even if present', () => {
      const input = 'note 記事: 「これは note の引用」 本文'
      expect(cleanTitle(input, 'https://note.com/foo/n/123')).toBe(input)
    })
  })
})
