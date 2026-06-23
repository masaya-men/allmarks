import type { Messages } from './config'

/** ドット区切りキーで messages を引く。見つからない / 文字列でない場合は undefined。 */
function lookup(messages: Messages, key: string): string | undefined {
  const parts = key.split('.')
  let cur: unknown = messages
  for (const p of parts) {
    if (typeof cur !== 'object' || cur === null) return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return typeof cur === 'string' ? cur : undefined
}

/**
 * ドット区切りキーでネストした messages から文字列を引く。
 *
 * 現ロケールに無ければ `fallback`(= 英語) を引き、それも無ければ最後にキー文字列を
 * 返す。これにより翻訳もれが起きても画面に内部キー (`pages.about.hero.kicker` 等) が
 * そのまま出ず、英語にフォールバックする (rank16)。
 */
export function translate(messages: Messages, key: string, fallback?: Messages): string {
  const direct = lookup(messages, key)
  if (direct !== undefined) return direct
  if (fallback) {
    const fb = lookup(fallback, key)
    if (fb !== undefined) return fb
  }
  return key
}
