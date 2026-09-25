'use client'

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { initDB } from '@/lib/storage/indexeddb'
import { loadLicense } from '@/lib/board/license-store'
import { isSyncUnlocked } from '@/lib/board/theme-entitlement'
import {
  activateLicenseKey, fetchDeviceCount, registerDeviceLabel, releaseDevice,
  type DeviceCount, type DeviceInfo,
} from '@/lib/board/license-activate'
import { loadSyncStatus, type SyncStatus, type SyncCycleTrace } from '@/lib/sync/sync-store'
import { runSyncCycle, connectSync, type SyncCycleResult } from '@/lib/sync/engine'
import { withSyncWritesSuppressed } from '@/lib/sync/sync-signal'
import { onSyncCycleFinished, onSyncCycleStarted, isSyncCycleInFlight } from '@/lib/sync/sync-events'
import { requestAuthCode, exchangeCode } from '@/lib/sync/auth'
import { formatLastSynced } from '@/lib/sync/format-last-sync'
import type { SyncErrorKind } from '@/lib/sync/error-kind'
import { checkLicenseForSync, type LicenseInactiveReason } from '@/lib/board/license-check'
import { navHref } from '@/lib/i18n/locale-urls'
import { SyncMassDeleteConfirmDialog } from './SyncMassDeleteConfirmDialog'
import { SyncConnectDialog, type ConnectDialogStep } from './SyncConnectDialog'
import styles from './SyncPanel.module.css'

/** The subset of `LicenseInactiveReason` that keeps the panel in its own
 *  "stopped" phase (§ below). `'no-license'` is deliberately excluded here --
 *  that reason bounces the panel back to the locked paywall view instead
 *  (`setUnlocked(false)`), it never becomes a `stopped` phase. */
type StoppedReason = Exclude<LicenseInactiveReason, 'no-license'>

type PanelPhase =
  | { readonly kind: 'disconnected' }
  | { readonly kind: 'connecting' }
  | { readonly kind: 'connect-failed' }
  | { readonly kind: 'idle'; readonly email: string | null; readonly lastSyncAt: number | undefined }
  | { readonly kind: 'syncing'; readonly email: string | null }
  | { readonly kind: 'needs-confirmation'; readonly email: string | null; readonly deletedCount: number }
  | { readonly kind: 'issue'; readonly email: string | null; readonly errorKind: SyncErrorKind; readonly detail?: string }
  | { readonly kind: 'stopped'; readonly reason: StoppedReason }

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
    return { kind: 'issue', email, errorKind: status.lastIssue.errorKind, detail: status.lastIssue.detail }
  }
  return { kind: 'idle', email, lastSyncAt: status.lastSyncAt }
}

/** Phase kinds a background sync cycle's started() signal (and the mount-time
 *  isSyncCycleInFlight() check) is allowed to override into 'syncing'. Excludes
 *  'disconnected' (nothing can be mid-cycle while not connected),
 *  'needs-confirmation'/'stopped' (their own dedicated flows own the phase
 *  until the user acts), and 'connecting'/'connect-failed' (the guided
 *  first-time setup dialog owns those -- connectSync's own first cycle must
 *  not flash the dialog away mid-flow). Only 'idle' and 'issue' -- both of
 *  which carry `email` -- can be safely swapped for 'syncing'. */
function canShowSyncingOver(phase: PanelPhase): phase is Extract<PanelPhase, { kind: 'idle' | 'issue' }> {
  return phase.kind === 'idle' || phase.kind === 'issue'
}

/** Applied once right after computing a phase from freshly-read sync-status (on mount, and inside
 *  the started-signal handler below): if a cycle is already/now in flight and the computed phase
 *  is one it may safely override (see canShowSyncingOver), show 'syncing' instead so the panel
 *  never sits on a stale "connected"/"error" phase while a background cycle the user didn't
 *  trigger is actually running. */
function withInFlightOverride(phase: PanelPhase, inFlight: boolean): PanelPhase {
  if (inFlight && canShowSyncingOver(phase)) return { kind: 'syncing', email: phase.email }
  return phase
}

function lastSyncedText(t: (key: string) => string, lastSyncAt: number | undefined): string {
  const display = formatLastSynced(lastSyncAt, Date.now())
  if (display.kind === 'never' || display.kind === 'just-now') return t('sync.lastSyncedJustNow')
  if (display.kind === 'minutes') return t('sync.lastSyncedMinutesAgo').replace('{minutes}', String(display.value))
  if (display.kind === 'hours') return t('sync.lastSyncedHoursAgo').replace('{hours}', String(display.value))
  return t('sync.lastSyncedDaysAgo').replace('{days}', String(display.value))
}

/** Puts the current device first in the expandable device list (§ design
 *  approved option A), leaving the rest in the order /activate-status
 *  returned them. Falls back to the original order if `currentId` isn't in
 *  the list at all (e.g. the count/list momentarily disagree). */
function orderedDevices(devices: readonly DeviceInfo[], currentId: string | null): readonly DeviceInfo[] {
  if (currentId === null) return devices
  const current = devices.find((d) => d.id === currentId)
  if (!current) return devices
  return [current, ...devices.filter((d) => d.id !== currentId)]
}

/** "9/20"-style registered date for a device row. `at === 0` means the
 *  timestamp is unknown (e.g. a legacy activation record) -- omit rather
 *  than show a fabricated date. */
function formatDeviceWhen(locale: string, at: number): string | null {
  if (at === 0) return null
  return new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric' }).format(new Date(at))
}

/** The key-paste-and-submit UI: label, input, submit button, and the
 *  invalid/unsupported/cap-exceeded error copy underneath. This is the same
 *  markup/behavior the locked view's guided setup dialog (`SyncConnectDialog`'s
 *  `'key-entry'` step) puts the user through, extracted here as its own small
 *  piece so the `stopped`/`device-removed` phase can show it inline in the
 *  panel (no modal -- the user is already deep in the panel, not starting
 *  fresh) without duplicating the input/button/error JSX a second time. */
function KeyEntryFields({
  keyInput, onKeyInputChange, onSubmit, submitting, error, capExceeded, t,
}: {
  readonly keyInput: string
  readonly onKeyInputChange: (value: string) => void
  readonly onSubmit: () => void
  readonly submitting: boolean
  readonly error: string | null
  readonly capExceeded: boolean
  readonly t: (key: string) => string
}): ReactElement {
  return (
    <>
      <label className={styles.label} htmlFor="sync-key-input">{t('sync.haveKeyLabel')}</label>
      <div className={styles.keyRow}>
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
          className={styles.unlockBtn}
          onClick={onSubmit}
          disabled={submitting || keyInput.trim().length === 0}
          data-testid="sync-key-submit"
        >
          {t('sync.unlockButton')}
        </button>
      </div>
      {error && (
        <div className={styles.error} data-testid="sync-key-error">
          {error}
          {capExceeded && (
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
    </>
  )
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
  const { t, locale } = useI18n()
  const [unlocked, setUnlocked] = useState<boolean | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [capExceeded, setCapExceeded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [phase, setPhase] = useState<PanelPhase>({ kind: 'disconnected' })
  const [modalOpen, setModalOpen] = useState(false)
  // True for the duration of a manual sync cycle THIS panel itself triggered (handleSyncNow /
  // handleMassDeleteContinue) -- during which `phase.kind` is 'syncing', the exact same visual
  // state a cycle started elsewhere also shows via the onSyncCycleStarted handler below. The
  // finished-signal handler needs to tell the two apart: for a manual cycle, applyResult (called
  // right after runSyncCycle resolves, in the same function) is the authority on the final phase
  // and the generic status-re-read below must defer to it; for anything else, the re-read is the
  // only thing that will ever update the phase. A plain `phase.kind === 'syncing'` check can't
  // distinguish the two, since a background cycle now also produces that same kind.
  const manualCycleInFlightRef = useRef(false)
  // Set the instant handleConnect's connectSync call resolves, so the very
  // next phase transition (idle/connect-failed/whatever applyResult lands on)
  // is recognized as "the guided first-time flow just finished" rather than a
  // routine "Sync now" click. handleSyncNow/mass-delete handlers never touch
  // this -- only handleConnect does.
  const [justCompletedSetup, setJustCompletedSetup] = useState(false)
  // "X/5 devices used" in the connected/idle view. Best-effort only --
  // fetchDeviceCount never throws and returns null on any failure, in which
  // case this just stays null and the count line doesn't render (never shows
  // a stale or guessed number).
  const [deviceCount, setDeviceCount] = useState<DeviceCount | null>(null)
  // kid + this device's own id, needed to call releaseDevice (the server
  // confirms the caller is itself an activated device before honoring a
  // removal). Set alongside deviceCount, wherever a license read happens.
  const [licenseIds, setLicenseIds] = useState<{ readonly kid: string; readonly deviceId: string } | null>(null)
  // The "端末 3/5台 ▾" toggle in the idle connected view (design option A) --
  // collapsed by default, expands to the device list below it.
  const [deviceListOpen, setDeviceListOpen] = useState(false)
  // Two-step remove: the device id whose "remove" button is currently
  // showing the amber "click again to remove" confirm state, or null.
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // On-device sync diagnostics ("sync.diagnostics" toggle, collapsed by default): the most
  // recent sync cycle's step-by-step timeline (sync-status's lastCycleTrace, engine.ts's
  // traceStep). Loaded on mount alongside the phase, and refreshed every time a cycle finishes
  // (background or manual) via the onSyncCycleFinished subscription below and applyResult's own
  // re-reads -- never via an extra loadSyncStatus call of its own, so it never disturbs the
  // existing mocked-call-sequence assumptions the phase-loading effects already rely on.
  const [lastCycleTrace, setLastCycleTrace] = useState<SyncCycleTrace | undefined>(undefined)
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)

  useEffect(() => {
    return (): void => {
      if (confirmTimerRef.current !== null) clearTimeout(confirmTimerRef.current)
    }
  }, [])

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
        if (isUnlocked && state) {
          setLicenseIds({ kid: state.kid, deviceId: state.deviceId })
          void fetchDeviceCount(state.kid).then(async (dc) => {
            if (cancelled) return
            setDeviceCount(dc)
            // Self-heal (once per mount): if this device is missing from
            // its own device list, or listed with an empty label (e.g. a
            // legacy `act:<kid>` entry, or the license/device-id rows
            // themselves having been overwritten by an old backup restore —
            // see lib/storage/backup.ts's DEVICE_LOCAL_SETTINGS_KEYS), ask
            // the server to (re)register/relabel it, then re-fetch the list.
            // registerDeviceLabel never throws.
            if (!dc) return
            const mine = dc.devices.find((d) => d.id === state.deviceId)
            const needsSelfHeal = !mine || mine.label === ''
            if (!needsSelfHeal) return
            await registerDeviceLabel(state.kid, state.deviceId)
            if (cancelled) return
            const refreshed = await fetchDeviceCount(state.kid)
            if (!cancelled) setDeviceCount(refreshed)
          })
        }
      } catch (e) {
        console.error('[AllMarks] failed to load sync license state', e)
        if (!cancelled) setUnlocked(false)
        return
      }
      if (!isUnlocked) return
      // License gate (checked once per mount, throttled internally to one
      // network call per 24h -- see license-check.ts): a license that's
      // unlocked in shape (valid signature, right scope) can still be
      // ended/removed/unconfirmed-too-long. Surface that as the panel's own
      // `stopped` phase instead of proceeding to the normal connect/idle
      // flow. Never throws, so no try/catch needed here.
      const licenseCheck = await checkLicenseForSync(db)
      if (cancelled) return
      if (!licenseCheck.allowed) {
        if (licenseCheck.reason === 'no-license') {
          setUnlocked(false)
          return
        }
        setPhase({ kind: 'stopped', reason: licenseCheck.reason })
        return
      }
      // Separate try/catch: a status-read failure here is not a license-read
      // failure. Falling into the same catch as above would incorrectly bounce
      // an already-unlocked user onto the locked paywall view (regression the
      // plan explicitly forbids) — instead stay unlocked and degrade to the
      // connect flow with no cached status.
      try {
        const status = await loadSyncStatus(db)
        if (!cancelled) {
          setPhase(withInFlightOverride(phaseFromStatus(status), isSyncCycleInFlight()))
          setLastCycleTrace(status.lastCycleTrace)
        }
      } catch (e) {
        console.error('[AllMarks] failed to load sync status', e)
        if (!cancelled) setPhase({ kind: 'disconnected' })
      }
    })()
    return (): void => { cancelled = true }
  }, [])

  // Refresh the displayed phase whenever a sync cycle finishes -- a background one (auto debounce,
  // tab-hide, the new online listener) or this panel's own manual one, now that engine.ts emits
  // this signal for every cycle regardless of trigger. Defers to manualCycleInFlightRef for a
  // manual cycle (applyResult, called right after runSyncCycle resolves in the same function, is
  // the authority on its final phase -- this generic re-read must not race it), and never clobbers
  // the guided-setup dialog ('connecting'/'connect-failed'), the mass-delete-confirmation, or the
  // license-gated "stopped" phase, which only their own dedicated handlers may leave.
  useEffect(() => {
    if (!unlocked) return
    const unsubscribe = onSyncCycleFinished(() => {
      void (async (): Promise<void> => {
        const db = await initDB()
        const status = await loadSyncStatus(db)
        setLastCycleTrace(status.lastCycleTrace)
        setPhase((current) => {
          if (
            manualCycleInFlightRef.current ||
            current.kind === 'needs-confirmation' || current.kind === 'stopped' ||
            current.kind === 'connecting' || current.kind === 'connect-failed'
          ) {
            return current
          }
          return phaseFromStatus(status)
        })
      })()
    })
    return unsubscribe
  }, [unlocked])

  // Companion to the finished-cycle refresh above: as soon as ANY sync cycle starts (background
  // debounce/tab-hide/online listener, or a manual cycle triggered elsewhere -- e.g. another open
  // instance of this panel), show the 'syncing' phase immediately instead of waiting for it to
  // finish. Guarded the same way as the mount-time isSyncCycleInFlight() check
  // (canShowSyncingOver): only overrides 'idle'/'issue', never the phases another dedicated flow
  // already owns. A no-op when already 'syncing' avoids a redundant re-render.
  useEffect(() => {
    if (!unlocked) return
    const unsubscribe = onSyncCycleStarted(() => {
      setPhase((current) => {
        if (current.kind === 'syncing') return current
        return withInFlightOverride(current, true)
      })
    })
    return unsubscribe
  }, [unlocked])

  const applyResult = useCallback(async (result: SyncCycleResult, fallbackEmail: string | null): Promise<void> => {
    if (result.status === 'synced') {
      const db = await initDB()
      const status = await loadSyncStatus(db)
      setPhase({ kind: 'idle', email: status.connectedEmail ?? fallbackEmail, lastSyncAt: status.lastSyncAt })
      setLastCycleTrace(status.lastCycleTrace)
    } else if (result.status === 'needs-confirmation') {
      setPhase({ kind: 'needs-confirmation', email: fallbackEmail, deletedCount: result.deletedCount ?? 0 })
    } else if (result.status === 'error') {
      // Re-read the stored issue so its diagnostic detail (engine.ts buildIssueDetail) shows too.
      const db = await initDB()
      const status = await loadSyncStatus(db)
      const detail = status.lastIssue?.kind === 'error' ? status.lastIssue.detail : undefined
      setPhase({ kind: 'issue', email: fallbackEmail, errorKind: result.errorKind ?? 'other', detail })
      setLastCycleTrace(status.lastCycleTrace)
    } else if (result.status === 'license-inactive') {
      if (result.licenseReason === 'no-license') {
        setUnlocked(false)
      } else if (result.licenseReason) {
        setPhase({ kind: 'stopped', reason: result.licenseReason })
      } else {
        // Defensive fallback only -- runSyncCycle always pairs this status
        // with a licenseReason. Never silently treats a blocked sync as a
        // plain Drive disconnect if we can help it, but there's nothing more
        // specific to show without a reason.
        setPhase({ kind: 'disconnected' })
      }
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
      // Suppressed: connectSync's own first cycle writes the pulled/merged snapshot back to
      // IndexedDB (same reason sync-controller.ts's flushNow() suppresses runSyncCycle — see
      // sync-signal.ts), which would otherwise mark sync dirty again and schedule a redundant
      // background cycle right on top of this one.
      const result = await withSyncWritesSuppressed(() => connectSync(db, tokens))
      setJustCompletedSetup(true)
      await applyResult(result, null)
    } catch (e) {
      console.error('[AllMarks] connect flow failed', e)
      setPhase({ kind: 'connect-failed' })
    }
  }, [applyResult])

  const handleSyncNow = useCallback(async (email: string | null): Promise<void> => {
    setPhase({ kind: 'syncing', email })
    manualCycleInFlightRef.current = true
    try {
      const db = await initDB()
      // Suppressed: see the connectSync call above — this cycle's own writes must not
      // re-mark sync dirty and schedule another overlapping cycle right behind it.
      const result = await withSyncWritesSuppressed(() => runSyncCycle(db))
      await applyResult(result, email)
    } catch (e) {
      console.error('[AllMarks] manual sync failed', e)
      setPhase({ kind: 'issue', email, errorKind: 'other' })
    } finally {
      manualCycleInFlightRef.current = false
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
    manualCycleInFlightRef.current = true
    try {
      const db = await initDB()
      // Suppressed: see handleConnect above.
      const result = await withSyncWritesSuppressed(() => runSyncCycle(db, { bypassMassDeleteGuard: true }))
      await applyResult(result, email)
    } catch (e) {
      console.error('[AllMarks] confirmed sync failed', e)
      setPhase({ kind: 'issue', email, errorKind: 'other' })
    } finally {
      manualCycleInFlightRef.current = false
    }
  }, [applyResult])

  // Two-step remove for a device row in the expandable list. First click
  // just arms the confirm state (amber "click again to remove", reverting on
  // its own after 3s); the second click while still armed actually calls
  // releaseDevice. A failed release reverts the button silently -- no new
  // error copy, per the approved design (option A).
  const handleRemoveClick = useCallback((targetId: string): void => {
    if (confirmTimerRef.current !== null) {
      clearTimeout(confirmTimerRef.current)
      confirmTimerRef.current = null
    }
    if (confirmingId !== targetId) {
      setConfirmingId(targetId)
      confirmTimerRef.current = setTimeout(() => {
        setConfirmingId((current) => (current === targetId ? null : current))
        confirmTimerRef.current = null
      }, 3000)
      return
    }
    setConfirmingId(null)
    if (!licenseIds) return
    void releaseDevice(licenseIds.kid, licenseIds.deviceId, targetId).then((ok) => {
      if (!ok) return
      setDeviceCount((prev) => (prev
        ? { count: prev.count - 1, max: prev.max, devices: prev.devices.filter((d) => d.id !== targetId) }
        : prev))
    })
  }, [confirmingId, licenseIds])

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
        const licenseState = await loadLicense(db)
        if (licenseState) {
          setLicenseIds({ kid: licenseState.kid, deviceId: licenseState.deviceId })
          void fetchDeviceCount(licenseState.kid).then(setDeviceCount)
        }
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
          {deviceCount && (
            <p className={styles.note}>
              <button
                type="button"
                className={styles.toggle}
                onClick={(): void => setDeviceListOpen((open) => !open)}
                aria-expanded={deviceListOpen}
                data-testid="sync-device-count"
              >
                {`${t('sync.deviceCount').replace('{count}', String(deviceCount.count)).replace('{max}', String(deviceCount.max))} ${deviceListOpen ? '▴' : '▾'}`}
              </button>
            </p>
          )}
          {deviceCount && deviceListOpen && (
            <ul className={`${styles.list} ${styles.hover}`} data-testid="sync-device-list">
              {orderedDevices(deviceCount.devices, licenseIds?.deviceId ?? null).map((d) => {
                const isMe = d.id === licenseIds?.deviceId
                const displayName = d.label.length > 0 ? d.label : t('sync.unknownDevice')
                const whenText = isMe ? null : formatDeviceWhen(locale, d.at)
                const isConfirming = confirmingId === d.id
                return (
                  <li key={d.id} className={styles.row} data-testid={`sync-device-row-${d.id}`}>
                    <span className={styles.hd} />
                    <span className={styles.name}>{displayName}</span>
                    {isMe ? (
                      <span className={styles.me}>{t('sync.thisDevice')}</span>
                    ) : (
                      <>
                        {whenText && <span className={styles.when}>{whenText}</span>}
                        <button
                          type="button"
                          className={isConfirming ? `${styles.rm} ${styles.confirm}` : styles.rm}
                          onClick={(): void => handleRemoveClick(d.id)}
                          data-testid={`sync-device-remove-${d.id}`}
                        >
                          {isConfirming ? t('sync.removeDeviceConfirm') : t('sync.removeDevice')}
                        </button>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
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
          {phase.detail && <p className={styles.note} data-testid="sync-issue-detail">{phase.detail}</p>}
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
      {phase.kind === 'stopped' && phase.reason === 'ended' && (
        <>
          <p className={styles.body} data-testid="sync-stopped-ended">{t('sync.stoppedEnded')}</p>
          <a
            className={styles.contactLink}
            href={navHref(locale, 'pricing')}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="sync-pricing-link"
          >
            {t('sync.seePricing')}
          </a>
        </>
      )}
      {phase.kind === 'stopped' && phase.reason === 'device-removed' && (
        <>
          <p className={styles.body} data-testid="sync-stopped-device-removed">{t('sync.stoppedDeviceRemoved')}</p>
          <KeyEntryFields
            keyInput={keyInput}
            onKeyInputChange={setKeyInput}
            onSubmit={(): void => { void submit() }}
            submitting={submitting}
            error={error}
            capExceeded={capExceeded}
            t={t}
          />
        </>
      )}
      {phase.kind === 'stopped' && phase.reason === 'grace-expired' && (
        <p className={styles.body} data-testid="sync-stopped-grace-expired">{t('sync.stoppedGraceExpired')}</p>
      )}
      {/* On-device sync diagnostics (last cycle's step timeline) -- visible in any phase except
          'disconnected' (this whole block is already inside the unlocked branch, so "locked" is
          already excluded), collapsed by default, same toggle pattern as the device-count list
          above. Hidden entirely until a cycle has actually produced a trace to show. */}
      {phase.kind !== 'disconnected' && lastCycleTrace && (
        <p className={styles.note}>
          <button
            type="button"
            className={styles.toggle}
            onClick={(): void => setDiagnosticsOpen((open) => !open)}
            aria-expanded={diagnosticsOpen}
            data-testid="sync-diagnostics-toggle"
          >
            {`${t('sync.diagnostics')} ${diagnosticsOpen ? '▴' : '▾'}`}
          </button>
        </p>
      )}
      {phase.kind !== 'disconnected' && lastCycleTrace && diagnosticsOpen && (
        <div data-testid="sync-diagnostics-trace">
          <p className={styles.note}>
            {`${new Date(lastCycleTrace.startedAt).toLocaleTimeString(locale)} · ${(lastCycleTrace.totalMs / 1000).toFixed(1)}s total`}
          </p>
          {lastCycleTrace.steps.map((step, i) => {
            const statusText = step.ok ? '✓' : (step.note ? `✗ ${step.note}` : '✗')
            return (
              <p className={styles.note} key={i}>
                {`${step.name} ${(step.ms / 1000).toFixed(1)}s ${statusText}`}
              </p>
            )
          })}
        </div>
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
