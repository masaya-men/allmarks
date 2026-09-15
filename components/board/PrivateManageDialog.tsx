'use client'

import { useEffect, type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './PrivateManageDialog.module.css'

type Props = {
  readonly hint?: string
  readonly onChangePassword: () => void
  readonly onDone: () => void
}

/** 金庫が既に解錠済みのときにSETTINGSのPRIVATEから開く管理画面。
 *  今のところ「パスワードを変更する」導線だけを持つ(ロック機能等は
 *  スコープ外・YAGNI)。 */
export function PrivateManageDialog({ hint, onChangePassword, onDone }: Props): ReactElement {
  const { t } = useI18n()

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); onDone() }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [onDone])

  return (
    <div
      className={styles.backdrop}
      onClick={onDone}
      role="dialog"
      aria-modal="true"
      aria-labelledby="private-manage-heading"
      data-testid="private-manage-dialog"
      data-no-capture
    >
      <div className={styles.panel} onClick={(e): void => e.stopPropagation()}>
        <div id="private-manage-heading" className={styles.heading}>{t('private.manageHeading')}</div>
        <div className={styles.status}>
          <span className={styles.statusDot} />
          {t('private.unlockedStatus')}
        </div>
        {hint && <div className={styles.hint}>{t('private.manageHintPrefix').replace('{hint}', hint)}</div>}
        <button type="button" className={styles.changeBtn} onClick={onChangePassword} data-testid="private-manage-change-password">
          {t('private.changePasswordButton')}
        </button>
        <div className={styles.actions}>
          <button type="button" className={styles.doneBtn} onClick={onDone} data-testid="private-manage-done">
            {t('private.doneButton')}
          </button>
        </div>
      </div>
    </div>
  )
}
