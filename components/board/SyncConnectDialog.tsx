'use client'

import { useEffect, type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './SyncConnectDialog.module.css'

/** The guided setup flow's current screen. Pure presentational — SyncPanel
 *  owns every business-logic decision about which step this should be
 *  (license state, PanelPhase, first-run tracking); this dialog only renders
 *  whichever step it's handed. */
export type ConnectDialogStep =
  | { readonly kind: 'key-entry' }
  | { readonly kind: 'connect' }
  | { readonly kind: 'connecting' }
  | { readonly kind: 'connect-failed' }
  | { readonly kind: 'done' }

type Props = {
  readonly step: ConnectDialogStep
  readonly keyInput: string
  readonly onKeyInputChange: (value: string) => void
  readonly onSubmitKey: () => void
  readonly keySubmitting: boolean
  readonly keyError: string | null
  readonly keyCapExceeded: boolean
  readonly onConnect: () => void
  readonly onClose: () => void
}

/**
 * Centered modal that walks a supporter through device-sync setup: paste key
 * → connect Google → wait → done. Follows the same structural/visual pattern
 * as {@link PrivateSetupDialog} (`.backdrop` + `.panel`, `z-index: 2000`).
 *
 * Dismissible (Escape / backdrop click / CANCEL) on every step except
 * `'connecting'` — that step is a critical async operation already underway,
 * so it can't be walked away from mid-flight (same idea as
 * {@link PrivateRecoveryKeyDialog}'s `hasCopiedOnce` gate, keyed here off
 * `step.kind !== 'connecting'` instead).
 */
export function SyncConnectDialog({
  step,
  keyInput,
  onKeyInputChange,
  onSubmitKey,
  keySubmitting,
  keyError,
  keyCapExceeded,
  onConnect,
  onClose,
}: Props): ReactElement {
  const { t } = useI18n()
  const dismissible = step.kind !== 'connecting'

  // Registered unconditionally (hooks can't be conditional) — the guard lives
  // inside the handler so it always reflects the *current* step, since step
  // changes over this dialog's lifetime without it unmounting.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      if (step.kind === 'connecting') return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [onClose, step.kind])

  const heading = step.kind === 'done' ? t('sync.setupDoneHeading') : t('sync.setupHeading')

  return (
    <div
      className={styles.backdrop}
      onClick={dismissible ? onClose : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-connect-dialog-heading"
      data-testid="sync-connect-dialog"
      data-no-capture
    >
      <div className={styles.panel} onClick={(e): void => e.stopPropagation()}>
        <div id="sync-connect-dialog-heading" className={styles.heading}>{heading}</div>

        {step.kind === 'key-entry' && (
          <>
            <p className={styles.explanation}>{t('sync.modalKeyIntro')}</p>
            <label className={styles.label} htmlFor="sync-key-input">{t('sync.haveKeyLabel')}</label>
            <input
              id="sync-key-input"
              type="text"
              className={styles.keyInput}
              value={keyInput}
              onChange={(e): void => onKeyInputChange(e.target.value)}
              placeholder={t('sync.keyPlaceholder')}
              data-testid="sync-key-input"
            />
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={onSubmitKey}
              disabled={keySubmitting || keyInput.trim().length === 0}
              data-testid="sync-key-submit"
            >
              {t('sync.unlockButton')}
            </button>
            {keyError && (
              <div className={styles.error} data-testid="sync-key-error">
                {keyError}
                {keyCapExceeded && (
                  <>
                    {' '}
                    <a
                      className={styles.contactLink}
                      href="/contact"
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="sync-cap-exceeded-contact"
                    >
                      {t('sync.errorCapExceededContact')}
                    </a>
                  </>
                )}
              </div>
            )}
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={onClose}
                data-testid="sync-connect-dialog-cancel"
              >
                {t('sync.setupCancel')}
              </button>
            </div>
          </>
        )}

        {step.kind === 'connect' && (
          <>
            <p className={styles.explanation}>{t('sync.connectExplanation')}</p>
            <button type="button" className={styles.primaryBtn} onClick={onConnect} data-testid="sync-connect-button">
              {t('sync.connectButton')}
            </button>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={onClose}
                data-testid="sync-connect-dialog-cancel"
              >
                {t('sync.setupCancel')}
              </button>
            </div>
          </>
        )}

        {step.kind === 'connecting' && (
          <div className={styles.connecting} data-testid="sync-connecting">
            <span className={styles.spinner} aria-hidden="true" />
            <p className={styles.connectingText}>{t('sync.connecting')}</p>
          </div>
        )}

        {step.kind === 'connect-failed' && (
          <>
            <div className={styles.error} data-testid="sync-connect-error">{t('sync.connectFailed')}</div>
            <button type="button" className={styles.primaryBtn} onClick={onConnect} data-testid="sync-connect-button">
              {t('sync.connectButton')}
            </button>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={onClose}
                data-testid="sync-connect-dialog-cancel"
              >
                {t('sync.setupCancel')}
              </button>
            </div>
          </>
        )}

        {step.kind === 'done' && (
          <div data-testid="sync-setup-done">
            <p className={styles.explanation}>{t('sync.setupDoneBody')}</p>
            <button type="button" className={styles.primaryBtn} onClick={onClose} data-testid="sync-setup-done-close">
              {t('sync.setupDoneClose')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
