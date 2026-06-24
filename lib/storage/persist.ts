/**
 * Local-storage durability helpers.
 *
 * AllMarks keeps everything in IndexedDB (browser-local, no server). The main
 * real-world loss risks are browser eviction under storage pressure and the
 * "clear browsing data" action — NOT disk defrag, which is irrelevant to IDB.
 *
 * `navigator.storage.persist()` asks the browser to mark this origin's storage
 * as persistent, so it is exempt from automatic eviction. Browsers grant it
 * based on engagement heuristics (installed PWA, bookmarked, high engagement);
 * a denied request is not an error — we fall back to best-effort storage and
 * lean on the EXPORT backup as the safety net.
 */

export type StorageStatus = {
  /** Whether the browser exposes the StorageManager API at all. */
  readonly supported: boolean
  /** True once storage is persistent (exempt from eviction). */
  readonly persisted: boolean
  /** Bytes used by this origin (undefined if estimate unavailable). */
  readonly usageBytes?: number
  /** Bytes the origin may use (undefined if estimate unavailable). */
  readonly quotaBytes?: number
}

function storageManager(): StorageManager | null {
  if (typeof navigator === 'undefined') return null
  const sm = (navigator as Navigator & { storage?: StorageManager }).storage
  return sm ?? null
}

/**
 * Ask the browser to make this origin's storage persistent (eviction-proof).
 * Idempotent: if already persisted, returns true without re-prompting. Never
 * throws — returns false when unsupported or denied.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  const sm = storageManager()
  if (!sm || typeof sm.persist !== 'function' || typeof sm.persisted !== 'function') return false
  try {
    if (await sm.persisted()) return true
    return await sm.persist()
  } catch {
    return false
  }
}

/** Read the current persistence + usage status (for a SETTINGS readout). */
export async function getStorageStatus(): Promise<StorageStatus> {
  const sm = storageManager()
  if (!sm) return { supported: false, persisted: false }
  let persisted = false
  let usageBytes: number | undefined
  let quotaBytes: number | undefined
  try {
    if (typeof sm.persisted === 'function') persisted = await sm.persisted()
  } catch {
    persisted = false
  }
  try {
    if (typeof sm.estimate === 'function') {
      const est = await sm.estimate()
      usageBytes = est.usage
      quotaBytes = est.quota
    }
  } catch {
    // estimate unavailable — leave undefined
  }
  return { supported: true, persisted, usageBytes, quotaBytes }
}
