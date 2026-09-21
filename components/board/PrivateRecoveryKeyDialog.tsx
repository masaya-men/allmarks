'use client'

import { useEffect, useState, type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './PrivateRecoveryKeyDialog.module.css'

type Props = {
  readonly recoveryKey: string
  readonly onDone: () => void
}

/** セットアップ直後(新規vault作成時)、または既存vaultへの後付け発行時に
 *  一度だけ表示する。この画面を閉じたら、この復旧キーの文字列自体は
 *  どこにも平文で残らない(vault-store.tsのsetUpRecoveryKeyの戻り値以外
 *  に保存先が無い)。 */
export function PrivateRecoveryKeyDialog({ recoveryKey, onDone }: Props): ReactElement {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); onDone() }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [onDone])

  // 数秒でラベルを元に戻す — 2回目のコピーができなくなるのを避ける。
  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 2000)
    return (): void => window.clearTimeout(id)
  }, [copied])

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(recoveryKey)
      setCopied(true)
    } catch (e) {
      // 失敗したときに「コピーしました」と嘘をつかない(ラベルは元のまま)。
      console.error('[AllMarks] failed to copy the Private recovery key', e)
    }
  }

  return (
    <div
      className={styles.backdrop}
      onClick={onDone}
      role="dialog"
      aria-modal="true"
      aria-labelledby="private-recovery-key-heading"
      data-testid="private-recovery-key-dialog"
      data-no-capture
    >
      <div className={styles.panel} onClick={(e): void => e.stopPropagation()}>
        <div id="private-recovery-key-heading" className={styles.heading}>{t('private.recoveryKeyHeading')}</div>
        <div className={styles.body}>{t('private.recoveryKeyBody')}</div>
        <div className={styles.keyBox} data-testid="private-recovery-key-value">{recoveryKey}</div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.copyBtn}
            onClick={(): void => { void copy() }}
            data-testid="private-recovery-key-copy"
          >
            {copied ? t('private.recoveryKeyCopiedFeedback') : t('private.recoveryKeyCopyButton')}
          </button>
          <button type="button" className={styles.doneBtn} onClick={onDone} data-testid="private-recovery-key-done">
            {t('private.recoveryKeyDoneButton')}
          </button>
        </div>
      </div>
    </div>
  )
}
