'use client'

import { useEffect, useState, type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { PasswordField } from './PasswordField'
import styles from './PrivateSetupDialog.module.css'

type Props = {
  readonly onCreate: (password: string, hint?: string) => Promise<boolean>
  readonly onCancel: () => void
}

export function PrivateSetupDialog({ onCreate, onCancel }: Props): ReactElement {
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [hint, setHint] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (): Promise<void> => {
    if (submitting) return
    if (password.length < 4) {
      setError(t('private.errorTooShort'))
      return
    }
    if (password !== confirm) {
      setError(t('private.errorMismatch'))
      return
    }
    setSubmitting(true)
    const ok = await onCreate(password, hint.length > 0 ? hint : undefined)
    if (!ok) {
      setSubmitting(false)
      setError(t('private.errorCreateFailed'))
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
        <div className={styles.explanation} data-testid="private-setup-explanation">
          {t('private.setupExplanation')}
        </div>
        <PasswordField
          id="private-setup-password"
          label={t('private.passwordLabel')}
          value={password}
          onChange={setPassword}
          showLabel={t('private.showPassword')}
          hideLabel={t('private.hidePassword')}
        />
        <PasswordField
          id="private-setup-confirm"
          label={t('private.confirmPasswordLabel')}
          value={confirm}
          onChange={setConfirm}
          showLabel={t('private.showPassword')}
          hideLabel={t('private.hidePassword')}
        />
        <label className={styles.label} htmlFor="private-setup-hint">{t('private.hintLabel')}</label>
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
