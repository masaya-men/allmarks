// lib/sync/error-kind.ts
// Classifies a thrown error from a sync cycle into a UI-relevant bucket, so
// SyncPanel can show "reconnect", "storage full", "corrupt data", "offline",
// or a generic retry message without importing engine.ts's error classes
// (that would create a circular import: engine.ts needs this file to
// classify what it catches). Duck-types on `.name`/`.status` instead of
// `instanceof` for exactly that reason.

export type SyncErrorKind = 'network' | 'auth' | 'storage-full' | 'corrupt' | 'other'

export function classifySyncError(err: unknown): SyncErrorKind {
  if (!(err instanceof Error)) return 'other'
  if (err.name === 'SyncCorruptDataError') return 'corrupt'
  if (err.name === 'SyncNotConnectedError' || err.name === 'GauthError') return 'auth'
  if (err.name === 'DriveError') {
    const status = (err as Error & { status?: unknown }).status
    if (status === 0) return 'network'
    if (status === 401) return 'auth'
    if (status === 403 && /storageQuotaExceeded|quotaExceeded/i.test(err.message)) return 'storage-full'
    return 'other'
  }
  return 'other'
}
