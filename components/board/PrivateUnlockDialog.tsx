'use client'

import { useState, type ReactElement } from 'react'
import styles from './PrivateUnlockDialog.module.css'

type Props = {
  readonly hint?: string
  readonly onSubmit: (password: string) => Promise<boolean>
  readonly onCancel: () => void
}

export function PrivateUnlockDialog({ hint, onSubmit, onCancel }: Props): ReactElement {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (): Promise<void> => {
    setSubmitting(true)
    const ok = await onSubmit(password)
    setSubmitting(false)
    if (!ok) setError('Wrong password.')
  }

  return (
    <div
      className={styles.backdrop}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="private-unlock-heading"
      data-testid="private-unlock-dialog"
      data-no-capture
    >
      <div className={styles.panel} onClick={(e): void => e.stopPropagation()}>
        <div id="private-unlock-heading" className={styles.heading}>UNLOCK PRIVATE</div>
        {hint && <div className={styles.hint}>{hint}</div>}
        <label className={styles.label} htmlFor="private-unlock-password">Password</label>
        <input
          id="private-unlock-password"
          type="password"
          className={styles.input}
          value={password}
          onChange={(e): void => setPassword(e.target.value)}
          onKeyDown={(e): void => { if (e.key === 'Enter') void submit() }}
        />
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel} data-testid="private-unlock-cancel">
            CANCEL
          </button>
          <button
            type="button"
            className={styles.unlockBtn}
            onClick={(): void => { void submit() }}
            disabled={submitting}
            data-testid="private-unlock-submit"
          >
            UNLOCK
          </button>
        </div>
      </div>
    </div>
  )
}
