import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { loadGoogleIdentityServices as LoadFn } from './google-identity'

// モジュール先頭の `loadPromise` シングルトンがテスト間に残るので、毎回
// vi.resetModules() + 動的 import で真っさらな状態から始める。
// jsdom は <script> を実際には fetch しないので、appendChild を捕まえて
// onload / onerror を手で発火させる (lib/embed/soundcloud-widget と同じ手法)。
let appended: HTMLScriptElement[]
let load: typeof LoadFn

const fakeGoogle = { accounts: { oauth2: { initCodeClient: () => ({ requestCode() {} }) } } }

beforeEach(async () => {
  vi.resetModules()
  appended = []
  vi.spyOn(document.head, 'appendChild').mockImplementation(((node: Node): Node => {
    if (node instanceof HTMLScriptElement) appended.push(node)
    return node
  }) as typeof document.head.appendChild)
  ;({ loadGoogleIdentityServices: load } = await import('./google-identity'))
})

afterEach(() => {
  vi.restoreAllMocks()
  delete (window as { google?: unknown }).google
})

describe('loadGoogleIdentityServices', () => {
  it('injects the GIS script once and resolves window.google on load', async () => {
    const p = load()
    expect(appended).toHaveLength(1)
    expect(appended[0].src).toBe('https://accounts.google.com/gsi/client')
    expect(appended[0].async).toBe(true)

    ;(window as { google?: unknown }).google = fakeGoogle
    appended[0].onload?.(new Event('load'))
    await expect(p).resolves.toHaveProperty('accounts.oauth2')
  })

  it('shares one in-flight promise across concurrent callers (one script tag)', async () => {
    const p1 = load()
    const p2 = load()
    expect(appended).toHaveLength(1)
    expect(p1).toBe(p2)
    ;(window as { google?: unknown }).google = fakeGoogle
    appended[0].onload?.(new Event('load'))
    await expect(Promise.all([p1, p2])).resolves.toBeTruthy()
  })

  it('rejects and allows retry when the script fails to load', async () => {
    const p = load()
    appended[0].onerror?.(new Event('error'))
    await expect(p).rejects.toThrow(/load/i)

    // retry produces a fresh script tag (loadPromise was reset to null on error)
    const p2 = load()
    expect(appended).toHaveLength(2)
    ;(window as { google?: unknown }).google = fakeGoogle
    appended[1].onload?.(new Event('load'))
    await expect(p2).resolves.toBeTruthy()
  })

  it('rejects when the script loads but window.google is still missing', async () => {
    const p = load()
    appended[0].onload?.(new Event('load'))
    await expect(p).rejects.toThrow(/missing/i)
  })
})
