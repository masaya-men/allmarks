'use client'

import { useEffect, useState, type ReactElement } from 'react'
import styles from './PrivateSetupDialog.module.css'

type Props = {
  readonly onCreate: (password: string, hint?: string) => Promise<boolean>
  readonly onCancel: () => void
}

export function PrivateSetupDialog({ onCreate, onCancel }: Props): ReactElement {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [hint, setHint] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (): Promise<void> => {
    if (submitting) return
    if (password.length < 4) {
      setError('Password must be at least 4 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    const ok = await onCreate(password, hint.length > 0 ? hint : undefined)
    if (!ok) {
      setSubmitting(false)
      setError('Could not create the vault. Try again.')
    }
    // On success the parent closes this dialog — no local state to reset.
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel() }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [onCancel])

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
          <button
            type="button"
            className={styles.createBtn}
            onClick={(): void => { void submit() }}
            disabled={submitting}
            data-testid="private-setup-create"
          >
            CREATE
          </button>
        </div>
      </div>
    </div>
  )
}
