// lib/sync/format-last-sync.ts
// Pure relative-time bucketing for SyncPanel's "last synced" line. Mirrors
// backup-reminder.ts's daysSince() pattern but with minute/hour granularity,
// since sync (unlike backup) is expected to happen within minutes.

export type LastSyncedDisplay =
  | { readonly kind: 'never' }
  | { readonly kind: 'just-now' }
  | { readonly kind: 'minutes'; readonly value: number }
  | { readonly kind: 'hours'; readonly value: number }
  | { readonly kind: 'days'; readonly value: number }

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

export function formatLastSynced(lastSyncAt: number | undefined, nowMs: number): LastSyncedDisplay {
  if (lastSyncAt === undefined) return { kind: 'never' }
  const diff = Math.max(0, nowMs - lastSyncAt)
  if (diff < MINUTE_MS) return { kind: 'just-now' }
  if (diff < HOUR_MS) return { kind: 'minutes', value: Math.floor(diff / MINUTE_MS) }
  if (diff < DAY_MS) return { kind: 'hours', value: Math.floor(diff / HOUR_MS) }
  return { kind: 'days', value: Math.floor(diff / DAY_MS) }
}
