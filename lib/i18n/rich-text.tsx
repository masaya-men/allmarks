import Link from 'next/link'
import type { ReactNode } from 'react'

/** `[[表示テキスト|token]]` トークンの解決先。 */
export type RichLinkTarget = { href: string }

const TOKEN_PATTERN = /\[\[([^|\]]+)\|([^\]]+)\]\]/g

/**
 * 翻訳文字列内の `[[表示テキスト|token]]` を実際のリンクに変換する。
 * href が `mailto:` / `#`(ページ内アンカー)なら plain `<a>`、`http(s)://` なら
 * 新規タブの外部 `<a>`、それ以外は内部 `next/link`。token が links に無ければ
 * ラベルだけプレーンテキストとして返す(壊れた表記で例外にしない)。
 * Terms/Privacy/Contact/FAQ/Refund の本文リンクをこの1関数に集約する。
 */
export function renderLinkedText(
  text: string,
  links: Record<string, RichLinkTarget>,
  linkClassName?: string,
): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let key = 0
  TOKEN_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TOKEN_PATTERN.exec(text)) !== null) {
    const [full, label, token] = match
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const target = links[token]
    if (!target) {
      nodes.push(label)
    } else if (target.href.startsWith('mailto:') || target.href.startsWith('#')) {
      nodes.push(
        <a key={`rt-${key++}`} href={target.href} className={linkClassName}>
          {label}
        </a>,
      )
    } else if (target.href.startsWith('http://') || target.href.startsWith('https://')) {
      nodes.push(
        <a key={`rt-${key++}`} href={target.href} target="_blank" rel="noopener noreferrer" className={linkClassName}>
          {label}
        </a>,
      )
    } else {
      nodes.push(
        <Link key={`rt-${key++}`} href={target.href} className={linkClassName}>
          {label}
        </Link>,
      )
    }
    lastIndex = match.index + full.length
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}
