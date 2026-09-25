import { describe, it, expect } from 'vitest'
import {
  isBotUserAgent,
  parseAcceptLanguage,
  pickLocaleFromAcceptLanguage,
  resolvePreferredLocale,
  localizedTarget,
  decideLocaleRedirect,
  LOCALE_COOKIE_NAME,
} from './locale-redirect'

describe('isBotUserAgent', () => {
  it('既知の bot UA を検知する', () => {
    expect(isBotUserAgent('facebookexternalhit/1.1')).toBe(true)
    expect(isBotUserAgent('Twitterbot/1.0')).toBe(true)
    expect(isBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true)
    expect(isBotUserAgent('Some Spider Crawler')).toBe(true)
  })
  it('通常ブラウザ UA は bot 扱いしない', () => {
    expect(isBotUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120')).toBe(false)
  })
  it('UA なしは bot 扱いしない', () => {
    expect(isBotUserAgent(null)).toBe(false)
    expect(isBotUserAgent(undefined)).toBe(false)
  })
})

describe('parseAcceptLanguage / pickLocaleFromAcceptLanguage', () => {
  it('q値降順でソートする', () => {
    const parsed = parseAcceptLanguage('en;q=0.5, ja;q=0.9, fr;q=0.7')
    expect(parsed.map((p) => p.primary)).toEqual(['ja', 'fr', 'en'])
  })
  it('q値省略は 1 扱い', () => {
    const parsed = parseAcceptLanguage('ja, en;q=0.5')
    expect(parsed[0]).toEqual({ primary: 'ja', q: 1 })
  })
  it('地域サブタグは primary subtag のみ見る', () => {
    expect(pickLocaleFromAcceptLanguage('ja-JP,en-US;q=0.8')).toBe('ja')
  })
  it('非対応言語は無視して次点を見る', () => {
    expect(pickLocaleFromAcceptLanguage('xx-YY;q=0.9, ko;q=0.5')).toBe('ko')
  })
  it('対応言語が一つもなければ null', () => {
    expect(pickLocaleFromAcceptLanguage('xx-YY, zz;q=0.5')).toBeNull()
  })
  it('ヘッダなしは空配列/null', () => {
    expect(parseAcceptLanguage(null)).toEqual([])
    expect(pickLocaleFromAcceptLanguage(undefined)).toBeNull()
  })
  it('* エントリは無視する', () => {
    expect(pickLocaleFromAcceptLanguage('*, ja;q=0.5')).toBe('ja')
  })
})

describe('resolvePreferredLocale', () => {
  it('cookie が Accept-Language より優先される', () => {
    const result = resolvePreferredLocale({
      cookieHeader: `${LOCALE_COOKIE_NAME}=fr`,
      acceptLanguage: 'ja-JP,ja;q=0.9',
    })
    expect(result).toBe('fr')
  })
  it('cookie が非対応値なら Accept-Language にフォールバック', () => {
    const result = resolvePreferredLocale({
      cookieHeader: `${LOCALE_COOKIE_NAME}=xx`,
      acceptLanguage: 'ja-JP,ja;q=0.9',
    })
    expect(result).toBe('ja')
  })
  it('cookie なしなら Accept-Language を使う', () => {
    const result = resolvePreferredLocale({ cookieHeader: null, acceptLanguage: 'de;q=0.9' })
    expect(result).toBe('de')
  })
  it('他 cookie に混ざっていても正しく読む', () => {
    const result = resolvePreferredLocale({
      cookieHeader: `foo=bar; ${LOCALE_COOKIE_NAME}=es; baz=qux`,
      acceptLanguage: null,
    })
    expect(result).toBe('es')
  })
  it('どちらも無ければ null', () => {
    expect(resolvePreferredLocale({ cookieHeader: null, acceptLanguage: null })).toBeNull()
  })
})

describe('localizedTarget', () => {
  it('ルートパスをロケール接頭辞に変換する', () => {
    expect(localizedTarget('/', '', 'ja')).toBe('/ja')
  })
  it('サブパスを保ったまま変換する', () => {
    expect(localizedTarget('/pricing', '', 'de')).toBe('/de/pricing')
  })
  it('クエリ文字列をそのまま維持する', () => {
    expect(localizedTarget('/purchase', '?txn=abc123', 'fr')).toBe('/fr/purchase?txn=abc123')
  })
  it('ローカライズ対象外パスは null', () => {
    expect(localizedTarget('/board', '', 'ja')).toBeNull()
    expect(localizedTarget('/api/ogp', '', 'ja')).toBeNull()
    expect(localizedTarget('/s/abc123', '', 'ja')).toBeNull()
  })
  it('extension サブパスも変換できる', () => {
    expect(localizedTarget('/extension/privacy', '', 'ko')).toBe('/ko/extension/privacy')
  })
})

describe('decideLocaleRedirect', () => {
  const base = {
    method: 'GET',
    pathname: '/',
    search: '',
    cookieHeader: null,
    acceptLanguage: 'ja-JP,ja;q=0.9',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120',
  }

  it('日本語ブラウザ visitor をルートから /ja へ 302 させる', () => {
    expect(decideLocaleRedirect(base)).toBe('/ja')
  })
  it('英語ブラウザ visitor はリダイレクトしない', () => {
    expect(decideLocaleRedirect({ ...base, acceptLanguage: 'en-US,en;q=0.9' })).toBeNull()
  })
  it('cookie で明示的に en を選んでいれば日本語ブラウザでもリダイレクトしない', () => {
    expect(
      decideLocaleRedirect({ ...base, cookieHeader: `${LOCALE_COOKIE_NAME}=en` }),
    ).toBeNull()
  })
  it('cookie の選択がそのまま行き先になる', () => {
    expect(
      decideLocaleRedirect({ ...base, cookieHeader: `${LOCALE_COOKIE_NAME}=de`, pathname: '/pricing' }),
    ).toBe('/de/pricing')
  })
  it('非対応ブラウザ言語はリダイレクトしない', () => {
    expect(decideLocaleRedirect({ ...base, acceptLanguage: 'xx-YY' })).toBeNull()
  })
  it('POST 等 GET/HEAD 以外はリダイレクトしない', () => {
    expect(decideLocaleRedirect({ ...base, method: 'POST' })).toBeNull()
    expect(decideLocaleRedirect({ ...base, method: 'HEAD' })).toBe('/ja') // HEAD は許可
  })
  it('bot UA はリダイレクトしない', () => {
    expect(decideLocaleRedirect({ ...base, userAgent: 'Twitterbot/1.0' })).toBeNull()
  })
  it('Accept-Language ヘッダが無ければリダイレクトしない（cookie があっても）', () => {
    expect(
      decideLocaleRedirect({
        ...base,
        acceptLanguage: null,
        cookieHeader: `${LOCALE_COOKIE_NAME}=ja`,
      }),
    ).toBeNull()
  })
  it('ローカライズ対象外パスはリダイレクトしない', () => {
    expect(decideLocaleRedirect({ ...base, pathname: '/board' })).toBeNull()
    expect(decideLocaleRedirect({ ...base, pathname: '/api/ogp' })).toBeNull()
    expect(decideLocaleRedirect({ ...base, pathname: '/claim' })).toBeNull()
  })
  it('クエリ文字列を保ったまま /purchase をロケール化する', () => {
    expect(
      decideLocaleRedirect({ ...base, pathname: '/purchase', search: '?txn=abc123' }),
    ).toBe('/ja/purchase?txn=abc123')
  })
  it('既にロケール接頭辞のあるパスは対象外', () => {
    expect(decideLocaleRedirect({ ...base, pathname: '/ja/pricing' })).toBeNull()
  })
})
