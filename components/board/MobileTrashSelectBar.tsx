'use client'

import type { ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './MobileShareSelectBar.module.css'

type Props = {
  /** Currently selected card count. */
  readonly count: number
  /** True while viewing the TRASH filter — swaps the primary action from
   *  "Move to trash" to "Restore". */
  readonly inTrash: boolean
  /** Move the selection to trash, or restore it, depending on `inTrash`. */
  readonly onPrimary: () => void
  /** Leave TRASH-select mode and discard the selection. */
  readonly onCancel: () => void
}

/** Mobile bottom bar for the long-press multi-select TRASH flow (CardsLayer's
 *  long-press gesture enters this mode — see BoardRoot's handleEnterTrashSelect).
 *  Imports MobileShareSelectBar's own CSS module directly (not a copy) so the
 *  two bars — mutually exclusive, both replacing BoardMobileNav in the same
 *  fixed bottom slot — stay byte-identical in chrome material as either one
 *  is restyled. Unlike the SHARE bar there's no SELECT ALL row: TRASH-select
 *  is just counter + two actions. */
export function MobileTrashSelectBar({ count, inTrash, onPrimary, onCancel }: Props): ReactElement {
  const { t } = useI18n()
  return (
    <div
      className={styles.bar}
      style={{ zIndex: BOARD_Z_INDEX.TRASH_SELECT_BAR }}
      role="toolbar"
      aria-label={inTrash ? 'Restore selected cards' : 'Move selected cards to trash'}
      data-testid="mobile-trash-select-bar"
      data-no-capture
    >
      <div className={styles.meta}>
        <span className={styles.counter} data-testid="mobile-trash-select-counter">
          {t('trashSelect.count').replace('{count}', String(count))}
        </span>
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondary}
          onClick={onCancel}
          data-testid="mobile-trash-select-cancel"
        >
          {t('share.cancel')}
        </button>
        <button
          type="button"
          className={styles.primary}
          onClick={onPrimary}
          disabled={count === 0}
          data-testid="mobile-trash-select-primary"
        >
          {inTrash ? t('trashSelect.restore') : t('trashSelect.moveToTrash')}
        </button>
      </div>
    </div>
  )
}
