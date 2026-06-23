import { describe, it, expect } from 'vitest'
import { translate } from './translate'

const M = {
  board: { chrome: { tune: 'TUNE' }, empty: { title: 'Start bookmarking' } },
  flat: 'hi',
}

describe('translate', () => {
  it('ネストしたキーを解決する', () => {
    expect(translate(M, 'board.chrome.tune')).toBe('TUNE')
    expect(translate(M, 'board.empty.title')).toBe('Start bookmarking')
  })
  it('トップレベルのキーを解決する', () => {
    expect(translate(M, 'flat')).toBe('hi')
  })
  it('欠損キーはキー文字列をそのまま返す', () => {
    expect(translate(M, 'board.chrome.missing')).toBe('board.chrome.missing')
    expect(translate(M, 'nope')).toBe('nope')
  })
  it('途中で string に当たったら以降のキーは未解決', () => {
    expect(translate(M, 'flat.deeper')).toBe('flat.deeper')
  })

  describe('英語フォールバック (rank16)', () => {
    const FB = {
      board: { chrome: { tune: 'TUNE-EN', missing: 'Missing label (EN)' } },
      onlyEn: 'English only',
    }
    it('現ロケールに有ればフォールバックは使わない', () => {
      expect(translate(M, 'board.chrome.tune', FB)).toBe('TUNE')
    })
    it('現ロケールに無ければフォールバックを引く', () => {
      expect(translate(M, 'board.chrome.missing', FB)).toBe('Missing label (EN)')
      expect(translate(M, 'onlyEn', FB)).toBe('English only')
    })
    it('現ロケールにもフォールバックにも無ければキー文字列を返す', () => {
      expect(translate(M, 'totally.absent', FB)).toBe('totally.absent')
    })
    it('フォールバック未指定なら従来どおりキー文字列', () => {
      expect(translate(M, 'board.chrome.missing')).toBe('board.chrome.missing')
    })
  })
})
