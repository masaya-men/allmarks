'use client'

import { useEffect, useState, type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { PasswordField } from './PasswordField'
import styles from './PrivateUnlockDialog.module.css'

type Props = {
  readonly onSubmit: (password: string) => Promise<boolean>
  readonly onCancel: () => void
  readonly hasRecoveryKey: boolean
  readonly onForgotPassword: () => void
}

export function PrivateUnlockDialog({ onSubmit, onCancel, hasRecoveryKey, onForgotPassword }: Props): ReactElement {
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (): Promise<void> => {
    setSubmitting(true)
    const ok = await onSubmit(password)
    setSubmitting(false)
    if (!ok) setError(t('private.errorWrongPassword'))
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
      aria-labelledby="private-unlock-heading"
      data-testid="private-unlock-dialog"
      data-no-capture
    >
      <div className={styles.panel} onClick={(e): void => e.stopPropagation()}>
        <form className={styles.form} onSubmit={(e): void => { e.preventDefault(); void submit() }}>
          {/* Private has no accounts/usernames — this exists only so browser
             password managers (which key "is this a login form?" off an
             autocomplete="username" field) recognize this as a real,
             save-worthy credential. Fixed value, never shown, never typed
             into (readOnly + visually hidden via .hiddenUsername). */}
          <input
            type="text"
            name="username"
            autoComplete="username"
            value="AllMarks"
            readOnly
            aria-hidden="true"
            tabIndex={-1}
            className={styles.hiddenUsername}
          />
          <div id="private-unlock-heading" className={styles.heading}>UNLOCK PRIVATE</div>
          <PasswordField
            id="private-unlock-password"
            label={t('private.passwordLabel')}
            value={password}
            onChange={setPassword}
            showLabel={t('private.showPassword')}
            hideLabel={t('private.hidePassword')}
            autoComplete="current-password"
          />
          {error && <div className={styles.error}>{error}</div>}
          {hasRecoveryKey && (
            <button
              type="button"
              className={styles.forgotPasswordLink}
              onClick={onForgotPassword}
              data-testid="private-unlock-forgot-password"
            >
              {t('private.forgotPasswordLink')}
            </button>
          )}
          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onCancel} data-testid="private-unlock-cancel">
              CANCEL
            </button>
            <button
              type="submit"
              className={styles.unlockBtn}
              disabled={submitting}
              data-testid="private-unlock-submit"
            >
              UNLOCK
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
