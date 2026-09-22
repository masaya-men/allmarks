'use client'

import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { initDB } from '@/lib/storage/indexeddb'
import { loadLicense } from '@/lib/board/license-store'
import { isSyncUnlocked } from '@/lib/board/theme-entitlement'
import { activateLicenseKey } from '@/lib/board/license-activate'
import { loadSyncStatus, type SyncStatus } from '@/lib/sync/sync-store'
import { runSyncCycle, connectSync, type SyncCycleResult } from '@/lib/sync/engine'
import { requestAuthCode, exchangeCode } from '@/lib/sync/auth'
import { formatLastSynced } from '@/lib/sync/format-last-sync'
import type { SyncErrorKind } from '@/lib/sync/error-kind'
import { SyncMassDeleteConfirmDialog } from './SyncMassDeleteConfirmDialog'
import { SyncConnectDialog, type ConnectDialogStep } from './SyncConnectDialog'
import styles from './SyncPanel.module.css'

type PanelPhase =
  | { readonly kind: 'disconnected' }
  | { readonly kind: 'connecting' }
  | { readonly kind: 'connect-failed' }
  | { readonly kind: 'idle'; readonly email: string | null; readonly lastSyncAt: number | undefined }
  | { readonly kind: 'syncing'; readonly email: string | null }
  | { readonly kind: 'needs-confirmation'; readonly email: string | null; readonly deletedCount: number }
  | { readonly kind: 'issue'; readonly email: string | null; readonly errorKind: SyncErrorKind }

function errorKeyFor(errorKind: SyncErrorKind): string {
  switch (errorKind) {
    case 'network': return 'sync.errorOffline'
    case 'auth': return 'sync.reconnectNeeded'
    case 'storage-full': return 'sync.errorStorageFull'
    case 'corrupt': return 'sync.errorCorrupt'
    default: return 'sync.errorGeneric'
  }
}

function phaseFromStatus(status: SyncStatus): PanelPhase {
  if (!status.connected) return { kind: 'disconnected' }
  const email = status.connectedEmail ?? null
  if (status.lastIssue?.kind === 'needs-confirmation') {
    return { kind: 'needs-confirmation', email, deletedCount: status.lastIssue.deletedCount }
  }
  if (status.lastIssue?.kind === 'error') {
    return { kind: 'issue', email, errorKind: status.lastIssue.errorKind }
  }
  return { kind: 'idle', email, lastSyncAt: status.lastSyncAt }
}

function lastSyncedText(t: (key: string) => string, lastSyncAt: number | undefined): string {
  const display = formatLastSynced(lastSyncAt, Date.now())
  if (display.kind === 'never' || display.kind === 'just-now') return t('sync.lastSyncedJustNow')
  if (display.kind === 'minutes') return t('sync.lastSyncedMinutesAgo').replace('{minutes}', String(display.value))
  if (display.kind === 'hours') return t('sync.lastSyncedHoursAgo').replace('{hours}', String(display.value))
  return t('sync.lastSyncedDaysAgo').replace('{days}', String(display.value))
}

/** Which screen the guided setup dialog shows, derived from the license/phase
 *  state SyncPanel already tracks. `justCompletedSetup` distinguishes "just
 *  finished first-time setup, still idle-with-dialog-open" (→ 'done') from
 *  every later routine idle state (→ no dialog at all, handled by the caller
 *  not rendering this when modalOpen is false). */
function connectDialogStep(unlocked: boolean, phase: PanelPhase, justCompletedSetup: boolean): ConnectDialogStep {
  if (!unlocked) return { kind: 'key-entry' }
  if (phase.kind === 'connecting') return { kind: 'connecting' }
  if (phase.kind === 'connect-failed') return { kind: 'connect-failed' }
  if (justCompletedSetup && phase.kind === 'idle') return { kind: 'done' }
  return { kind: 'connect' }
}

export function SyncPanel(): ReactElement | null {
  const { t } = useI18n()
  const [unlocked, setUnlocked] = useState<boolean | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [capExceeded, setCapExceeded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [phase, setPhase] = useState<PanelPhase>({ kind: 'disconnected' })
  const [modalOpen, setModalOpen] = useState(false)
  // Set the instant handleConnect's connectSync call resolves, so the very
  // next phase transition (idle/connect-failed/whatever applyResult lands on)
  // is recognized as "the guided first-time flow just finished" rather than a
  // routine "Sync now" click. handleSyncNow/mass-delete handlers never touch
  // this -- only handleConnect does.
  const [justCompletedSetup, setJustCompletedSetup] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async (): Promise<void> => {
      let db: Awaited<ReturnType<typeof initDB>>
      let isUnlocked: boolean
      try {
        db = await initDB()
        const state = await loadLicense(db)
        isUnlocked = isSyncUnlocked(state)
        if (cancelled) return
        setUnlocked(isUnlocked)
      } catch (e) {
        console.error('[AllMarks] failed to load sync license state', e)
        if (!cancelled) setUnlocked(false)
        return
      }
      if (!isUnlocked) return
      // Separate try/catch: a status-read failure here is not a license-read
      // failure. Falling into the same catch as above would incorrectly bounce
      // an already-unlocked user onto the locked paywall view (regression the
      // plan explicitly forbids) — instead stay unlocked and degrade to the
      // connect flow with no cached status.
      try {
        const status = await loadSyncStatus(db)
        if (!cancelled) setPhase(phaseFromStatus(status))
      } catch (e) {
        console.error('[AllMarks] failed to load sync status', e)
        if (!cancelled) setPhase({ kind: 'disconnected' })
      }
    })()
    return (): void => { cancelled = true }
  }, [])

  const applyResult = useCallback(async (result: SyncCycleResult, fallbackEmail: string | null): Promise<void> => {
    if (result.status === 'synced') {
      const db = await initDB()
      const status = await loadSyncStatus(db)
      setPhase({ kind: 'idle', email: status.connectedEmail ?? fallbackEmail, lastSyncAt: status.lastSyncAt })
    } else if (result.status === 'needs-confirmation') {
      setPhase({ kind: 'needs-confirmation', email: fallbackEmail, deletedCount: result.deletedCount ?? 0 })
    } else if (result.status === 'error') {
      setPhase({ kind: 'issue', email: fallbackEmail, errorKind: result.errorKind ?? 'other' })
    } else {
      setPhase({ kind: 'disconnected' })
    }
  }, [])

  const handleConnect = useCallback(async (): Promise<void> => {
    setPhase({ kind: 'connecting' })
    try {
      const code = await requestAuthCode()
      const tokens = await exchangeCode(code)
      const db = await initDB()
      const result = await connectSync(db, tokens)
      setJustCompletedSetup(true)
      await applyResult(result, null)
    } catch (e) {
      console.error('[AllMarks] connect flow failed', e)
      setPhase({ kind: 'connect-failed' })
    }
  }, [applyResult])

  const handleSyncNow = useCallback(async (email: string | null): Promise<void> => {
    setPhase({ kind: 'syncing', email })
    try {
      const db = await initDB()
      const result = await runSyncCycle(db)
      await applyResult(result, email)
    } catch (e) {
      console.error('[AllMarks] manual sync failed', e)
      setPhase({ kind: 'issue', email, errorKind: 'other' })
    }
  }, [applyResult])

  const handleMassDeleteCancel = useCallback(async (email: string | null): Promise<void> => {
    try {
      const db = await initDB()
      const status = await loadSyncStatus(db)
      setPhase({ kind: 'idle', email: status.connectedEmail ?? email, lastSyncAt: status.lastSyncAt })
    } catch {
      setPhase({ kind: 'idle', email, lastSyncAt: undefined })
    }
  }, [])

  const handleMassDeleteContinue = useCallback(async (email: string | null): Promise<void> => {
    setPhase({ kind: 'syncing', email })
    try {
      const db = await initDB()
      const result = await runSyncCycle(db, { bypassMassDeleteGuard: true })
      await applyResult(result, email)
    } catch (e) {
      console.error('[AllMarks] confirmed sync failed', e)
      setPhase({ kind: 'issue', email, errorKind: 'other' })
    }
  }, [applyResult])

  const submit = async (): Promise<void> => {
    if (submitting) return
    const cleaned = keyInput.replace(/\s+/g, '')
    if (cleaned.length === 0) return
    setSubmitting(true)
    setError(null)
    setCapExceeded(false)
    try {
      const db = await initDB()
      const result = await activateLicenseKey(db, cleaned)
      setSubmitting(false)
      if (result.status === 'unlocked') {
        setUnlocked(true)
        const status = await loadSyncStatus(db)
        setPhase(phaseFromStatus(status))
        return
      }
      if (result.status === 'invalid-key') setError(t('sync.errorInvalidKey'))
      else if (result.status === 'unsupported') setError(t('sync.errorUnsupported'))
      else if (result.status === 'cap-exceeded') {
        setError(t('sync.errorCapExceeded'))
        setCapExceeded(true)
      }
    } catch (e) {
      console.error('[AllMarks] failed to activate sync license key', e)
      setSubmitting(false)
      setError(t('sync.errorActivateFailed'))
    }
  }

  if (unlocked === null) return null

  const closeModal = (): void => { setModalOpen(false); setJustCompletedSetup(false) }

  if (!unlocked) {
    return (
      <div data-testid="sync-locked">
        <p className={styles.body}>{t('sync.lockedExplanation')}</p>
        <span className={styles.soon} aria-disabled="true" data-testid="sync-become-supporter">
          {`${t('sync.becomeSupporter')} (${t('board.settings.comingSoon')})`}
        </span>
        <button
          type="button"
          className={styles.unlockBtn}
          onClick={(): void => setModalOpen(true)}
          data-testid="sync-start-button"
        >
          {t('sync.startButton')}
        </button>
        {modalOpen && (
          <SyncConnectDialog
            step={connectDialogStep(unlocked, phase, justCompletedSetup)}
            keyInput={keyInput}
            onKeyInputChange={setKeyInput}
            onSubmitKey={(): void => { void submit() }}
            keySubmitting={submitting}
            keyError={error}
            keyCapExceeded={capExceeded}
            onConnect={(): void => { void handleConnect() }}
            onClose={closeModal}
          />
        )}
      </div>
    )
  }

  // The four phases the guided-setup dialog covers. Written explicitly
  // (rather than inferred) so the dialog-open condition below never
  // silently drifts out of sync with connectDialogStep's own branching.
  const dialogCoversPhase =
    phase.kind === 'disconnected' ||
    phase.kind === 'connecting' ||
    phase.kind === 'connect-failed' ||
    phase.kind === 'idle'

  return (
    <div data-testid="sync-unlocked">
      {(phase.kind === 'disconnected' || phase.kind === 'connect-failed') && !modalOpen && (
        <button
          type="button"
          className={styles.unlockBtn}
          onClick={(): void => setModalOpen(true)}
          data-testid="sync-start-button"
        >
          {t('sync.startButton')}
        </button>
      )}
      {phase.kind === 'idle' && !(justCompletedSetup && modalOpen) && (
        <>
          <div className={styles.status} data-testid="sync-connected-status">
            <span className={styles.statusDot} />
            {phase.email ? t('sync.connectedAs').replace('{email}', phase.email) : t('sync.connectedGeneric')}
          </div>
          <p className={styles.note} data-testid="sync-last-synced">{lastSyncedText(t, phase.lastSyncAt)}</p>
          <button type="button" className={styles.unlockBtn} onClick={(): void => { void handleSyncNow(phase.email) }} data-testid="sync-now-button">
            {t('sync.syncNowButton')}
          </button>
        </>
      )}
      {phase.kind === 'syncing' && (
        <div className={styles.status} data-testid="sync-in-progress">
          <span className={styles.statusDot} data-pending="true" />
          {t('sync.syncingNow')}
        </div>
      )}
      {phase.kind === 'needs-confirmation' && (
        <SyncMassDeleteConfirmDialog
          count={phase.deletedCount}
          onCancel={(): void => { void handleMassDeleteCancel(phase.email) }}
          onConfirm={(): void => { void handleMassDeleteContinue(phase.email) }}
        />
      )}
      {phase.kind === 'issue' && (
        <>
          <div className={styles.error} data-testid="sync-issue">{t(errorKeyFor(phase.errorKind))}</div>
          {phase.errorKind === 'auth' ? (
            <button type="button" className={styles.unlockBtn} onClick={(): void => { void handleConnect() }} data-testid="sync-reconnect-button">
              {t('sync.reconnectButton')}
            </button>
          ) : (
            <button type="button" className={styles.unlockBtn} onClick={(): void => { void handleSyncNow(phase.email) }} data-testid="sync-now-button">
              {t('sync.syncNowButton')}
            </button>
          )}
        </>
      )}
      {modalOpen && dialogCoversPhase && (
        <SyncConnectDialog
          step={connectDialogStep(unlocked, phase, justCompletedSetup)}
          keyInput={keyInput}
          onKeyInputChange={setKeyInput}
          onSubmitKey={(): void => { void submit() }}
          keySubmitting={submitting}
          keyError={error}
          keyCapExceeded={capExceeded}
          onConnect={(): void => { void handleConnect() }}
          onClose={closeModal}
        />
      )}
    </div>
  )
}
