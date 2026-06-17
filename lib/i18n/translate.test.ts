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
})
