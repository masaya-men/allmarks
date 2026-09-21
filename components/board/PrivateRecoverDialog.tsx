'use client'

import { useEffect, useState, type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './PrivateRecoverDialog.module.css'

type Props = {
  readonly onSubmit: (recoveryKeyInput: string) => Promise<boolean>
  readonly onCancel: () => void
}

/** 「パスワードを忘れた場合」導線から開く、復旧キー入力画面。パスワード欄と
 *  違い、長い文字列を正確に転記する場面なのでマスクしない通常のテキスト
 *  入力にする(PrivateSetupDialogのヒント欄と同じ<input type="text">)。 */
export function PrivateRecoverDialog({ onSubmit, onCancel }: Props): ReactElement {
  const { t } = useI18n()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (): Promise<void> => {
    if (submitting) return
    setSubmitting(true)
    const ok = await onSubmit(value)
    setSubmitting(false)
    if (!ok) setError(t('private.errorWrongRecoveryKey'))
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
      aria-labelledby="private-recover-heading"
      data-testid="private-recover-dialog"
      data-no-capture
    >
      <div className={styles.panel} onClick={(e): void => e.stopPropagation()}>
        <div id="private-recover-heading" className={styles.heading}>{t('private.recoverHeading')}</div>
        <div className={styles.explanation}>{t('private.recoverExplanation')}</div>
        <label className={styles.label} htmlFor="private-recover-input">{t('private.recoverInputLabel')}</label>
        <input
          id="private-recover-input"
          type="text"
          className={styles.input}
          value={value}
          onChange={(e): void => setValue(e.target.value)}
        />
        {error && <div className={styles.error} data-testid="private-recover-error">{error}</div>}
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel} data-testid="private-recover-cancel">
            CANCEL
          </button>
          <button
            type="button"
            className={styles.submitBtn}
            onClick={(): void => { void submit() }}
            disabled={submitting}
            data-testid="private-recover-submit"
          >
            UNLOCK
          </button>
        </div>
      </div>
    </div>
  )
}
