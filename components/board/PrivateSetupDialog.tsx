'use client'

import { useState, type ReactElement } from 'react'
import styles from './PrivateSetupDialog.module.css'

type Props = {
  readonly onCreate: (password: string, hint?: string) => void
  readonly onCancel: () => void
}

export function PrivateSetupDialog({ onCreate, onCancel }: Props): ReactElement {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [hint, setHint] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (): void => {
    if (password.length === 0) {
      setError('Enter a password.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    onCreate(password, hint.length > 0 ? hint : undefined)
  }

  return (
    <div
      className={styles.backdrop}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="private-setup-heading"
      data-testid="private-setup-dialog"
      data-no-capture
    >
      <div className={styles.panel} onClick={(e): void => e.stopPropagation()}>
        <div id="private-setup-heading" className={styles.heading}>SET UP PRIVATE</div>
        <label className={styles.label} htmlFor="private-setup-password">Password</label>
        <input
          id="private-setup-password"
          type="password"
          className={styles.input}
          value={password}
          onChange={(e): void => setPassword(e.target.value)}
        />
        <label className={styles.label} htmlFor="private-setup-confirm">Confirm password</label>
        <input
          id="private-setup-confirm"
          type="password"
          className={styles.input}
          value={confirm}
          onChange={(e): void => setConfirm(e.target.value)}
        />
        <label className={styles.label} htmlFor="private-setup-hint">Hint (optional)</label>
        <input
          id="private-setup-hint"
          type="text"
          className={styles.input}
          value={hint}
          onChange={(e): void => setHint(e.target.value)}
        />
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel} data-testid="private-setup-cancel">
            CANCEL
          </button>
          <button type="button" className={styles.createBtn} onClick={submit} data-testid="private-setup-create">
            CREATE
          </button>
        </div>
      </div>
    </div>
  )
}
