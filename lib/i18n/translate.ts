import type { Messages } from './config'

/** ドット区切りキーでネストした messages から文字列を引く。欠損時はキー文字列を返す。 */
export function translate(messages: Messages, key: string): string {
  const parts = key.split('.')
  let cur: unknown = messages
  for (const p of parts) {
    if (typeof cur !== 'object' || cur === null) return key
    cur = (cur as Record<string, unknown>)[p]
  }
  return typeof cur === 'string' ? cur : key
}
