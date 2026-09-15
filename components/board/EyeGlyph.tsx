// components/board/EyeGlyph.tsx
// パスワード表示/非表示トグルのアイコン。PrivateLockGlyph.tsxと同じ
// house style(アイコンライブラリ不使用・インラインSVG)。線画スタイルは
// PrivateLockGlyphのfill-evenodd技法ではなくstroke技法(こちらの方が
// hand-authorしても崩れにくい標準的な「アーモンド形+瞳の円」のシルエット)。
import type { ReactElement } from 'react'

type Props = {
  /** true = パスワードが今見えている状態(このアイコンを押すと隠れる)。
   *  false = 隠れている状態(押すと見える)。 */
  readonly visible: boolean
  readonly className?: string
}

export function EyeGlyph({ visible, className }: Props): ReactElement {
  return (
    <svg
      key={visible ? 'visible' : 'hidden'}
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M2 12C2 12 5.5 6 12 6C18.5 6 22 12 22 12C22 12 18.5 18 12 18C5.5 18 2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      {!visible && (
        <line x1="3" y1="20" x2="21" y2="4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      )}
    </svg>
  )
}
