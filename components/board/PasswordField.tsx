// components/board/PasswordField.tsx
'use client'

import { useState, type ReactElement } from 'react'
import { EyeGlyph } from './EyeGlyph'
import styles from './PasswordField.module.css'

type Props = {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly onEnter?: () => void
  /** 目のマークのaria-label。非表示中(押すと見える)のときの文言。 */
  readonly showLabel: string
  /** 目のマークのaria-label。表示中(押すと隠れる)のときの文言。 */
  readonly hideLabel: string
}

/** ラベル+パスワード入力+表示/非表示トグルの共通コンポーネント。
 *  PrivateSetupDialog/PrivateUnlockDialog/PrivateChangePasswordDialogの
 *  全パスワード欄(計5箇所)がこれを使う。 */
export function PasswordField({ id, label, value, onChange, onEnter, showLabel, hideLabel }: Props): ReactElement {
  const [visible, setVisible] = useState(false)
  return (
    <>
      <label className={styles.label} htmlFor={id}>{label}</label>
      <div className={styles.wrapper}>
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className={styles.input}
          value={value}
          onChange={(e): void => onChange(e.target.value)}
          onKeyDown={onEnter ? (e): void => { if (e.key === 'Enter') onEnter() } : undefined}
        />
        <button
          type="button"
          className={styles.toggle}
          onClick={(): void => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
        >
          <EyeGlyph visible={visible} />
        </button>
      </div>
    </>
  )
}
