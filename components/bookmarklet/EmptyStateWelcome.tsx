'use client'

import type { ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './EmptyStateWelcome.module.css'

type Props = {
  readonly onOpenModal: () => void
}

export function EmptyStateWelcome({ onOpenModal }: Props): ReactElement {
  const { t } = useI18n()
  return (
    <div className={styles.wrap} data-testid="empty-state-welcome">
      <div className={styles.icon}>📌</div>
      <h2 className={styles.title}>{t('board.empty.title')}</h2>
      <p className={styles.description}>{t('board.empty.description')}</p>
      <button type="button" className={styles.installBtn} onClick={onOpenModal}>
        {t('board.empty.installButton')}
      </button>
      <p className={styles.hint}>{t('board.empty.alreadyInstalled')}</p>
    </div>
  )
}
