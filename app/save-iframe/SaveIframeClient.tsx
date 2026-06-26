'use client'

import { useEffect, useRef, type ReactElement } from 'react'
import { useSearchParams } from 'next/navigation'
import { initDB, persistMediaSlots, getAllBookmarks, saveBookmarkDeduped } from '@/lib/storage/indexeddb'
import type { BookmarkRecord } from '@/lib/storage/indexeddb'
import { getAllTags, addTagToBookmark } from '@/lib/storage/tags'
import { loadQuickTagEnabled } from '@/lib/storage/quick-tag-setting'
import { loadBoardConfig } from '@/lib/storage/board-config'
import { orderTagsForSave } from '@/lib/tagger/order-tags-for-save'
import { detectUrlType, extractTweetId } from '@/lib/utils/url'
import { fetchTweetMeta } from '@/lib/embed/tweet-meta'
import { postBookmarkSaved, postBookmarkUpdated } from '@/lib/board/channel'
import {
  parseSaveMessage,
  parseProbeMessage,
  parseAddTagMessage,
  type SaveMessageResult,
  type StripThemeTokens,
} from '@/lib/utils/save-message'
import { subscribePipPresence, queryPipPresence } from '@/lib/board/pip-presence'

type SaveDb = Awaited<ReturnType<typeof initDB>>

/**
 * Read the active theme's resolved tokens straight off the document. Because we
 * read *computed* values (not a hardcoded palette), the strip auto-follows
 * whatever theme is active — today the dark default, later any switched theme.
 * The applied-✓ accent stays AllMarks green (semantic pill-language constant).
 */
function readThemeTokens(): StripThemeTokens {
  const cs = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string): string => {
    const got = cs.getPropertyValue(name).trim()
    return got || fallback
  }
  // On themes that define panel tokens (paper-atelier), prefer them so the
  // floating strip reads as the same parchment note as the in-app popovers.
  // The default theme leaves --paper-panel-* undefined → these resolve empty
  // and fall back to the dark canvas tokens, so the default strip is unchanged.
  return {
    bg: v('--paper-panel-surface', '') || v('--bg-dark', '#0a0a0a'),
    fg: v('--text-primary', '#f2f2f2'),
    border: v('--paper-panel-border', '') || v('--color-card-border', 'rgba(255,255,255,0.12)'),
    accent: '#28f100',
    blur: v('--glass-blur', '8px'),
  }
}

async function buildSavePayload(
  db: SaveDb,
  bookmark: BookmarkRecord,
): Promise<{
  tags: ReturnType<typeof orderTagsForSave>
  currentTagIds: string[]
  themeTokens: StripThemeTokens
  quickTagEnabled: boolean
}> {
  const [corpus, allTags, quickTagEnabled, boardConfig] = await Promise.all([
    getAllBookmarks(db),
    getAllTags(db),
    loadQuickTagEnabled(db),
    loadBoardConfig(db),
  ])
  // Apply the board's theme to THIS document before reading the strip tokens.
  // The layout's pre-paint script reads localStorage, but this iframe is
  // embedded in a third-party host page (e.g. twitter.com), so Chrome's storage
  // partitioning hides the board's first-party localStorage from it — the theme
  // hint arrives empty there. IndexedDB is the source of truth and is the SAME
  // store we just read the user's tags from, so it's the reliable signal here.
  if (typeof document !== 'undefined' && boardConfig.themeId) {
    document.documentElement.setAttribute('data-theme-id', boardConfig.themeId)
  }
  return {
    tags: orderTagsForSave(bookmark, corpus, allTags),
    currentTagIds: bookmark.tags,
    themeTokens: readThemeTokens(),
    quickTagEnabled,
  }
}

const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
  /^chrome-extension:\/\//,
]

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGIN_PATTERNS.some((p) => p.test(origin))) return true
  // Test/dev hatch: explicit window-attached allowlist (set by E2E or local dev).
  const w = globalThis as { __BOOKLAGE_ALLOWED_ORIGINS__?: string[] }
  if (Array.isArray(w.__BOOKLAGE_ALLOWED_ORIGINS__) && w.__BOOKLAGE_ALLOWED_ORIGINS__.includes(origin)) return true
  return false
}

export function SaveIframeClient(): ReactElement {
  const searchParams = useSearchParams()
  const isBookmarkletFlow = searchParams.get('bookmarklet') === '1'
  const handledNonces = useRef<Set<string>>(new Set())
  const pipActiveRef = useRef<boolean>(false)
  const seenPresenceRef = useRef<boolean>(false)

  // Subscribe to PiP presence broadcasts so the iframe can answer probes
  // synchronously on subsequent calls.
  useEffect(() => {
    const unsub = subscribePipPresence((open) => {
      pipActiveRef.current = open
      seenPresenceRef.current = true
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    /**
     * Origin policy:
     *   - Extension flow (no `?bookmarklet=1`): strict — only chrome-extension://
     *     origins (plus the test-allowlist hatch) may post messages here.
     *   - Bookmarklet flow (`?bookmarklet=1`): any origin is accepted.
     *
     * Security trade-off for the bookmarklet flow:
     *   The bookmarklet runs on arbitrary user-visited pages and creates a
     *   hidden iframe pointing at /save-iframe?bookmarklet=1, then posts
     *   `booklage:probe` / `booklage:save` to it. We cannot pin a single origin.
     *   Risk: any site that iframes /save-iframe?bookmarklet=1 could write
     *   junk bookmarks to the visitor's IndexedDB. There is no data
     *   exfiltration (we only accept inbound saves; we don't read DB content
     *   back to the parent). The blast radius is "bookmarks the user can
     *   delete", which mirrors how all bookmarklets work — clicking the
     *   bookmarklet grants the host page implicit permission. v0 accepts this.
     */
    const originAllowed = (origin: string): boolean =>
      isBookmarkletFlow ? true : isAllowedOrigin(origin)

    const handler = async (ev: MessageEvent): Promise<void> => {
      if (!originAllowed(ev.origin)) return

      // Probe handling: answer with the current pipActive state. On the very
      // first probe (no presence message ever observed), lazy-query once via
      // the broadcast channel so we don't return a false negative.
      const probeParsed = parseProbeMessage(ev.data)
      if (probeParsed.ok) {
        let active = pipActiveRef.current
        if (!seenPresenceRef.current) {
          active = await queryPipPresence(80)
          pipActiveRef.current = active
          seenPresenceRef.current = true
        }
        ev.source?.postMessage(
          { type: 'booklage:probe:result', nonce: probeParsed.value.payload.nonce, pipActive: active },
          { targetOrigin: ev.origin },
        )
        return
      }

      const addTagParsed = parseAddTagMessage(ev.data)
      if (addTagParsed.ok) {
        const { bookmarkId, tagId, nonce } = addTagParsed.value.payload
        try {
          const db = await initDB()
          await addTagToBookmark(db, bookmarkId, tagId)
          // Tell any open board to re-read so the new tag shows immediately
          // (add-tag is a mutation of an existing bookmark, not a new save).
          postBookmarkUpdated({ bookmarkId })
          ev.source?.postMessage(
            { type: 'booklage:add-tag:result', nonce, ok: true },
            { targetOrigin: ev.origin },
          )
        } catch (err) {
          ev.source?.postMessage(
            { type: 'booklage:add-tag:result', nonce, ok: false, error: err instanceof Error ? err.message : String(err) },
            { targetOrigin: ev.origin },
          )
        }
        return
      }

      const parsed = parseSaveMessage(ev.data)
      if (!parsed.ok) return
      const { payload } = parsed.value

      if (handledNonces.current.has(payload.nonce)) return
      handledNonces.current.add(payload.nonce)

      const reply = (msg: SaveMessageResult): void => {
        ev.source?.postMessage(msg, { targetOrigin: ev.origin })
      }

      // Resolve PiP presence freshly for this save. The passively-maintained
      // pipActiveRef is only correct if this (offscreen) iframe was alive to
      // hear the pip-open broadcast. The offscreen doc is created on demand
      // per save, so a doc spun up AFTER PiP opened would have missed the
      // broadcast and report a false negative — which would let the extension
      // show its host-page strip on top of the PiP (the collision we fixed).
      // Actively query once (same lazy path the probe uses) when we've never
      // observed a presence message; open/close broadcasts keep the ref fresh
      // thereafter.
      let pipActiveNow = pipActiveRef.current
      if (!seenPresenceRef.current) {
        pipActiveNow = await queryPipPresence(80)
        pipActiveRef.current = pipActiveNow
        seenPresenceRef.current = true
      }

      try {
        const db = await initDB()
        // One atomic, scheme-validated, dedup-aware insert shared by every save
        // path. `dedupe` mirrors the prior gate: extension auto-save sends
        // skipIfDuplicate=true (→ gentle "Already saved" instead of a 2nd copy);
        // a manual save leaves it unset (→ always insert). The dup scan + insert
        // run in ONE transaction so two concurrent saves can't both insert.
        const result = await saveBookmarkDeduped(db, {
          url: payload.url,
          title: payload.title || payload.url,
          description: payload.description,
          thumbnail: payload.image,
          favicon: payload.favicon,
          siteName: payload.siteName,
          type: detectUrlType(payload.url),
          tags: [],
        }, { dedupe: payload.skipIfDuplicate === true })

        if (result.outcome === 'invalid-url') {
          // A non-http/https URL (e.g. a malicious site posting javascript:…)
          // is rejected before it can reach IDB. Reply with a clean error so
          // the extension shows "Failed" instead of waiting out the 8s timeout.
          reply({
            type: 'booklage:save:result',
            nonce: payload.nonce,
            ok: false,
            error: 'Unsupported URL scheme (http/https only)',
          })
          return
        }

        if (result.outcome === 'duplicate') {
          // soft-deleted bookmarks (= ユーザーがゴミ箱送り済み) は findActiveDuplicate
          // が除外するので、削除した tweet をもう一度いいねすれば再保存される。
          const savePayload = await buildSavePayload(db, result.bookmark)
          reply({
            type: 'booklage:save:result',
            nonce: payload.nonce,
            ok: true,
            bookmarkId: result.bookmark.id,
            skipped: true,
            ...savePayload,
            pipActive: pipActiveNow,
          })
          return
        }

        const bm = result.bookmark
        postBookmarkSaved({ bookmarkId: bm.id })
        const savePayload = await buildSavePayload(db, bm)
        reply({
          type: 'booklage:save:result',
          nonce: payload.nonce,
          ok: true,
          bookmarkId: bm.id,
          ...savePayload,
          pipActive: pipActiveNow,
        })

        // Phase A: fire-and-forget syndication fetch for X tweets so the
        // newly saved bookmark already has mediaSlots[] populated before
        // the user lands on the board. Offscreen iframe persists across
        // tab closes, so we don't need to block the reply on this.
        if (detectUrlType(payload.url) === 'tweet') {
          const tweetId = extractTweetId(payload.url)
          if (tweetId) {
            void fetchTweetMeta(tweetId).then((meta) => {
              if (meta?.mediaSlots && meta.mediaSlots.length > 0) {
                void persistMediaSlots(db, bm.id, meta.mediaSlots)
              }
            }).catch(() => { /* swallow — Phase B catches next mount */ })
          }
        }
      } catch (err) {
        reply({
          type: 'booklage:save:result',
          nonce: payload.nonce,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [isBookmarkletFlow])

  return <div data-testid="save-iframe-mounted" style={{ display: 'none' }} />
}
