'use client'

import { useEffect, useState, type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { PasswordField } from './PasswordField'
import styles from './PrivateChangePasswordDialog.module.css'

type Props = {
  readonly onSubmit: (newPassword: string, newHint: string | undefined) => Promise<boolean>
  readonly onCancel: () => void
  /** 'vault-conflict-resolved': shown once, on the winning device, right
   *  after lib/private/vault-conflict.ts's isVaultConflictResolved first
   *  returns true — the two independently-created vaults have now
   *  converged on this one, and the user picks a single fresh password to
   *  use everywhere from now on (see this plan's copy table).
   *  'recovered': shown right after a successful unlockVaultWithRecoveryKey
   *  — the user must pick a new password before continuing. Default
   *  'change' is the pre-existing, unchanged password-change flow. */
  readonly variant?: 'change' | 'vault-conflict-resolved' | 'recovered'
}

export function PrivateChangePasswordDialog({ onSubmit, onCancel, variant = 'change' }: Props): ReactElement {
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
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
    const ok = await onSubmit(password, undefined)
    if (!ok) {
      setSubmitting(false)
      setError(t('private.errorChangeFailed'))
    }
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
      aria-labelledby="private-change-password-heading"
      data-testid="private-change-password-dialog"
      data-no-capture
    >
      <div className={styles.panel} onClick={(e): void => e.stopPropagation()}>
        <form className={styles.form} onSubmit={(e): void => { e.preventDefault(); void submit() }}>
          <div id="private-change-password-heading" className={styles.heading}>
            {t(
              variant === 'vault-conflict-resolved' ? 'private.vaultConflictResolvedHeading'
                : variant === 'recovered' ? 'private.recoveredHeading'
                : 'private.changePasswordHeading',
            )}
          </div>
          <div className={styles.explanation}>
            {t(
              variant === 'vault-conflict-resolved' ? 'private.vaultConflictResolvedBody'
                : variant === 'recovered' ? 'private.recoveredBody'
                : 'private.changePasswordExplanation',
            )}
          </div>
          <PasswordField
            id="private-change-password-new"
            label={t('private.newPasswordLabel')}
            value={password}
            onChange={setPassword}
            showLabel={t('private.showPassword')}
            hideLabel={t('private.hidePassword')}
            autoComplete="new-password"
          />
          <PasswordField
            id="private-change-password-confirm"
            label={t('private.confirmNewPasswordLabel')}
            value={confirm}
            onChange={setConfirm}
            showLabel={t('private.showPassword')}
            hideLabel={t('private.hidePassword')}
            autoComplete="new-password"
          />
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onCancel} data-testid="private-change-password-cancel">
              CANCEL
            </button>
            <button
              type="submit"
              className={styles.saveBtn}
              disabled={submitting}
              data-testid="private-change-password-save"
            >
              SAVE
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
