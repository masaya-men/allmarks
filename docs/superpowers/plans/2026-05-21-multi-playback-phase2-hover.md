# Multi-Playback Phase 2 (Tier 2 hover) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** board のカードに 300ms マウスを留めると、そのカードがミュートで本物再生に昇格し、外すと約 0.8 秒の余韻後に停止する (同時最大 3 枚、超過時は最古を停止する LRU)。

**Architecture:** pool 管理ロジックを純粋関数 (`lib/board/playback-pool.ts`) に切り出し、その上に React state + linger タイマーを持つ薄い hook (`use-playback-pool.ts`) を載せる。300ms 判定は別 hook (`use-hover-intent.ts`)。配線は `CardsLayer` 内で完結し、既存の音つき 1 枚再生 (`audioActiveId`) とは独立した別レイヤーとして共存させる (同一カードでは音つきを優先)。本物再生は既存 `InlineMediaPlayer` を `muted` で流用する。

**Tech Stack:** Next.js 14 App Router / TypeScript strict / Vanilla CSS Modules / vitest (jsdom, renderHook+act) / playwright (`pnpm preview` = wrangler pages dev)

**仕様の真実:** [multi-playback-design](../specs/2026-05-21-multi-playback-design.md) §3 (Tier 2) / §6。 §3 の「Phase 2 実装確定」 注記が今回の確定値 (300ms / muted / 上限 3 / 0.8s linger / スクラブなし)。

**スコープ外 (今回入れない):** ホバー位置スクラブ、 Tier 1 常時モーション、 master ON/OFF スイッチ、 ファストスクロール中の昇格抑制 (= 300ms intent + マウス移動での pointerleave で実質カバーされるため YAGNI、 必要なら後フェーズ)。

---

## File Structure

**新規 (test 込み 5 file):**
- `lib/board/playback-pool.ts` — pool の純粋ロジック (promote/demote/isActive/LRU、 上限定数)
- `lib/board/playback-pool.test.ts` — pool 純粋ロジックの unit テスト
- `lib/board/use-playback-pool.ts` — pool を React state + linger タイマーで包む hook
- `lib/board/use-playback-pool.test.ts` — hook テスト (renderHook+act+fake timers、 linger 検証)
- `lib/board/use-hover-intent.ts` — 300ms hover-intent hook
- `lib/board/use-hover-intent.test.ts` — hook テスト (fake timers)

**変更:**
- `components/board/embeds/media-players.tsx` — `RenderOpts` / `InlinePlayerOpts` に `muted` を追加、 各 entry が embed に渡す
- `components/board/embeds/InlineMediaPlayer.tsx` — `muted` prop 追加
- `components/board/embeds/TweetVideoEmbed.tsx` — `<video>` に `muted` 属性 (自動再生に必須)
- `components/board/embeds/YouTubeEmbed.tsx` — iframe src に `mute=1` (muted 時)
- `components/board/embeds/VimeoEmbed.tsx` — iframe src に `muted=1` (muted 時)
- `components/board/embeds/TikTokEmbed.tsx` — Tier1 `<video>` に `muted` 属性 (Tier2 iframe は制御不可、 graceful)
- `components/board/embeds/SoundCloudEmbed.tsx` — muted 時は `setVolume(0)`
- `components/board/CardsLayer.tsx` — hover-intent + pool 配線、 ミュート再生オーバーレイ、 昇格時の枠 glow
- `components/board/CardsLayer.module.css` (存在すれば) — 枠 glow の keyframes / クラス

---

## Task 1: pool 純粋ロジック

純粋関数なので React なしで完全にテストできる。 ここを固めると LRU の挙動が保証される。

**Files:**
- Create: `lib/board/playback-pool.ts`
- Test: `lib/board/playback-pool.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/board/playback-pool.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import {
  emptyPool,
  promote,
  demote,
  isActive,
  MAX_HOVER_PLAYERS,
} from './playback-pool'

describe('playback-pool', () => {
  it('starts empty', () => {
    expect(emptyPool.entries).toEqual([])
    expect(isActive(emptyPool, 'a')).toBe(false)
  })

  it('promote adds an entry and marks it active', () => {
    const s = promote(emptyPool, 'a', 1000)
    expect(isActive(s, 'a')).toBe(true)
    expect(s.entries).toHaveLength(1)
  })

  it('promote on an existing id refreshes lastActiveAt, no duplicate', () => {
    let s = promote(emptyPool, 'a', 1000)
    s = promote(s, 'a', 2000)
    expect(s.entries).toHaveLength(1)
    expect(s.entries[0]?.lastActiveAt).toBe(2000)
  })

  it('keeps at most MAX_HOVER_PLAYERS, dropping the oldest', () => {
    expect(MAX_HOVER_PLAYERS).toBe(3)
    let s = promote(emptyPool, 'a', 1000)
    s = promote(s, 'b', 2000)
    s = promote(s, 'c', 3000)
    s = promote(s, 'd', 4000) // 4th → 'a' (oldest) drops
    expect(s.entries).toHaveLength(3)
    expect(isActive(s, 'a')).toBe(false)
    expect(isActive(s, 'b')).toBe(true)
    expect(isActive(s, 'c')).toBe(true)
    expect(isActive(s, 'd')).toBe(true)
  })

  it('refreshing an entry protects it from being the LRU victim', () => {
    let s = promote(emptyPool, 'a', 1000)
    s = promote(s, 'b', 2000)
    s = promote(s, 'c', 3000)
    s = promote(s, 'a', 3500) // refresh 'a' → now 'b' is oldest
    s = promote(s, 'd', 4000) // 4th → 'b' drops, not 'a'
    expect(isActive(s, 'b')).toBe(false)
    expect(isActive(s, 'a')).toBe(true)
    expect(s.entries).toHaveLength(3)
  })

  it('demote removes an entry; demoting an absent id is a no-op', () => {
    let s = promote(emptyPool, 'a', 1000)
    s = demote(s, 'a')
    expect(isActive(s, 'a')).toBe(false)
    expect(demote(s, 'missing').entries).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npx vitest run lib/board/playback-pool.test.ts`
Expected: FAIL — cannot resolve `./playback-pool`.

- [ ] **Step 3: Write minimal implementation**

`lib/board/playback-pool.ts`:
```ts
/** Max simultaneous real hover-playback players (Phase 2 confirmed value). */
export const MAX_HOVER_PLAYERS = 3

export type PoolEntry = {
  readonly bookmarkId: string
  /** ms timestamp of the last promote; used to pick the LRU eviction victim. */
  readonly lastActiveAt: number
}

export type PlaybackPoolState = {
  readonly entries: readonly PoolEntry[]
}

export const emptyPool: PlaybackPoolState = { entries: [] }

export function isActive(state: PlaybackPoolState, bookmarkId: string): boolean {
  return state.entries.some((e) => e.bookmarkId === bookmarkId)
}

/** Add (or refresh) a player. Over capacity → drop the oldest by lastActiveAt. */
export function promote(
  state: PlaybackPoolState,
  bookmarkId: string,
  now: number,
  max: number = MAX_HOVER_PLAYERS,
): PlaybackPoolState {
  if (isActive(state, bookmarkId)) {
    return {
      entries: state.entries.map((e) =>
        e.bookmarkId === bookmarkId ? { ...e, lastActiveAt: now } : e,
      ),
    }
  }
  const next: PoolEntry[] = [...state.entries, { bookmarkId, lastActiveAt: now }]
  if (next.length <= max) return { entries: next }
  const oldest = next.reduce((a, b) => (a.lastActiveAt <= b.lastActiveAt ? a : b))
  return { entries: next.filter((e) => e.bookmarkId !== oldest.bookmarkId) }
}

export function demote(state: PlaybackPoolState, bookmarkId: string): PlaybackPoolState {
  return { entries: state.entries.filter((e) => e.bookmarkId !== bookmarkId) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npx vitest run lib/board/playback-pool.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add lib/board/playback-pool.ts lib/board/playback-pool.test.ts
rtk git commit -m "feat(board): pure playback-pool logic (3-card LRU) for hover playback"
```

---

## Task 2: use-playback-pool hook (React state + 0.8s linger)

pool 純粋ロジックを React state で包み、 「離脱 0.8 秒後に停止」 の linger タイマーを管理する。 `promote(id)` は linger をキャンセルし、 `release(id)` は 0.8 秒後の demote を予約する。

**Files:**
- Create: `lib/board/use-playback-pool.ts`
- Test: `lib/board/use-playback-pool.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/board/use-playback-pool.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePlaybackPool, LINGER_MS } from './use-playback-pool'

describe('usePlaybackPool', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('promote marks active immediately', () => {
    const { result } = renderHook(() => usePlaybackPool())
    act(() => { result.current.promote('a') })
    expect(result.current.isActive('a')).toBe(true)
    expect(result.current.activeCount).toBe(1)
  })

  it('release keeps playing during the linger window, then stops', () => {
    const { result } = renderHook(() => usePlaybackPool())
    act(() => { result.current.promote('a') })
    act(() => { result.current.release('a') })
    // still active mid-linger
    act(() => { vi.advanceTimersByTime(LINGER_MS - 50) })
    expect(result.current.isActive('a')).toBe(true)
    // stops after the linger window
    act(() => { vi.advanceTimersByTime(100) })
    expect(result.current.isActive('a')).toBe(false)
  })

  it('promote during the linger window cancels the pending stop', () => {
    const { result } = renderHook(() => usePlaybackPool())
    act(() => { result.current.promote('a') })
    act(() => { result.current.release('a') })
    act(() => { vi.advanceTimersByTime(LINGER_MS - 50) })
    act(() => { result.current.promote('a') }) // re-enter
    act(() => { vi.advanceTimersByTime(LINGER_MS) })
    expect(result.current.isActive('a')).toBe(true)
  })

  it('caps at 3 active players (LRU eviction)', () => {
    const { result } = renderHook(() => usePlaybackPool())
    act(() => { result.current.promote('a') })
    act(() => { result.current.promote('b') })
    act(() => { result.current.promote('c') })
    act(() => { result.current.promote('d') })
    expect(result.current.activeCount).toBe(3)
    expect(result.current.isActive('a')).toBe(false)
    expect(result.current.isActive('d')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npx vitest run lib/board/use-playback-pool.test.ts`
Expected: FAIL — cannot resolve `./use-playback-pool`.

- [ ] **Step 3: Write minimal implementation**

`lib/board/use-playback-pool.ts`:
```ts
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  emptyPool,
  promote as promoteState,
  demote as demoteState,
  isActive as isActiveState,
  type PlaybackPoolState,
} from './playback-pool'

/** How long a card keeps playing after the pointer leaves (anti-thrash linger). */
export const LINGER_MS = 800

export type PlaybackPoolApi = {
  isActive: (bookmarkId: string) => boolean
  activeCount: number
  /** Start/refresh playback for a card; cancels any pending stop. */
  promote: (bookmarkId: string) => void
  /** Schedule a stop after LINGER_MS; re-promote cancels it. */
  release: (bookmarkId: string) => void
}

export function usePlaybackPool(lingerMs: number = LINGER_MS): PlaybackPoolApi {
  const [pool, setPool] = useState<PlaybackPoolState>(emptyPool)
  const lingerTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const clearLinger = useCallback((bookmarkId: string): void => {
    const t = lingerTimers.current.get(bookmarkId)
    if (t !== undefined) {
      clearTimeout(t)
      lingerTimers.current.delete(bookmarkId)
    }
  }, [])

  const promote = useCallback((bookmarkId: string): void => {
    clearLinger(bookmarkId)
    setPool((p) => promoteState(p, bookmarkId, Date.now()))
  }, [clearLinger])

  const release = useCallback((bookmarkId: string): void => {
    clearLinger(bookmarkId)
    const t = setTimeout(() => {
      lingerTimers.current.delete(bookmarkId)
      setPool((p) => demoteState(p, bookmarkId))
    }, lingerMs)
    lingerTimers.current.set(bookmarkId, t)
  }, [clearLinger, lingerMs])

  useEffect(() => {
    const timers = lingerTimers.current
    return () => {
      timers.forEach((t) => clearTimeout(t))
      timers.clear()
    }
  }, [])

  return {
    isActive: useCallback((id: string) => isActiveState(pool, id), [pool]),
    activeCount: pool.entries.length,
    promote,
    release,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npx vitest run lib/board/use-playback-pool.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add lib/board/use-playback-pool.ts lib/board/use-playback-pool.test.ts
rtk git commit -m "feat(board): usePlaybackPool hook with 0.8s anti-thrash linger"
```

---

## Task 3: use-hover-intent hook (300ms)

`start(id)` で 300ms タイマー開始 → 満了で `onIntent(id)`。 `cancel()` でキャンセル。 連続 `start` は前のタイマーを置き換える (= カード間移動)。

**Files:**
- Create: `lib/board/use-hover-intent.ts`
- Test: `lib/board/use-hover-intent.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/board/use-hover-intent.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHoverIntent, HOVER_INTENT_MS } from './use-hover-intent'

describe('useHoverIntent', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('fires onIntent after the delay', () => {
    const onIntent = vi.fn()
    const { result } = renderHook(() => useHoverIntent(onIntent))
    act(() => { result.current.start('a') })
    expect(onIntent).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(HOVER_INTENT_MS) })
    expect(onIntent).toHaveBeenCalledWith('a')
  })

  it('cancel before the delay prevents the fire', () => {
    const onIntent = vi.fn()
    const { result } = renderHook(() => useHoverIntent(onIntent))
    act(() => { result.current.start('a') })
    act(() => { vi.advanceTimersByTime(HOVER_INTENT_MS - 50) })
    act(() => { result.current.cancel() })
    act(() => { vi.advanceTimersByTime(100) })
    expect(onIntent).not.toHaveBeenCalled()
  })

  it('a new start replaces the previous pending timer', () => {
    const onIntent = vi.fn()
    const { result } = renderHook(() => useHoverIntent(onIntent))
    act(() => { result.current.start('a') })
    act(() => { vi.advanceTimersByTime(HOVER_INTENT_MS - 50) })
    act(() => { result.current.start('b') })
    act(() => { vi.advanceTimersByTime(HOVER_INTENT_MS) })
    expect(onIntent).toHaveBeenCalledTimes(1)
    expect(onIntent).toHaveBeenCalledWith('b')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npx vitest run lib/board/use-hover-intent.test.ts`
Expected: FAIL — cannot resolve `./use-hover-intent`.

- [ ] **Step 3: Write minimal implementation**

`lib/board/use-hover-intent.ts`:
```ts
'use client'

import { useCallback, useEffect, useRef } from 'react'

/** Industry-standard hover-intent dwell (NN/g, Baymard). */
export const HOVER_INTENT_MS = 300

export type HoverIntentApi = {
  start: (bookmarkId: string) => void
  cancel: () => void
}

export function useHoverIntent(
  onIntent: (bookmarkId: string) => void,
  delayMs: number = HOVER_INTENT_MS,
): HoverIntentApi {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onIntentRef = useRef(onIntent)
  useEffect(() => { onIntentRef.current = onIntent }, [onIntent])

  const cancel = useCallback((): void => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const start = useCallback((bookmarkId: string): void => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      onIntentRef.current(bookmarkId)
    }, delayMs)
  }, [delayMs])

  useEffect(() => cancel, [cancel])

  return { start, cancel }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npx vitest run lib/board/use-hover-intent.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add lib/board/use-hover-intent.ts lib/board/use-hover-intent.test.ts
rtk git commit -m "feat(board): useHoverIntent hook (300ms dwell)"
```

---

## Task 4: muted オプションを media-players registry に通す

`InlineMediaPlayer` を `muted` で呼べるようにする。 既存の Tier 3 (音つき、 `muted` 省略) は無変更。

**Files:**
- Modify: `components/board/embeds/media-players.tsx`
- Modify: `components/board/embeds/InlineMediaPlayer.tsx`

- [ ] **Step 1: media-players.tsx の `RenderOpts` に `muted` を追加**

`RenderOpts` 型 (現状 28-36 行付近) に追記:
```ts
type RenderOpts = {
  readonly variant: MediaVariant
  readonly autoStart?: boolean
  readonly volume?: number
  readonly paused?: boolean
  /** Tier 2 hover playback: start muted (autoplay-policy compliant). */
  readonly muted?: boolean
}
```

- [ ] **Step 2: 各 ENTRY の render が `muted={o.muted}` を embed に渡す**

`ENTRIES` 配列内の 5 つの embed (`YouTubeEmbed` / `VimeoEmbed` / `TikTokEmbed` / `SoundCloudEmbed` / `TweetVideoEmbed`) それぞれの JSX に `muted={o.muted}` を 1 行追加する。 例 (YouTubeEmbed):
```tsx
<YouTubeEmbed
  videoId={id}
  title={i.title}
  vertical={isYoutubeShorts(i.url)}
  thumbnail={i.thumbnail}
  aspectRatio={i.aspectRatio}
  autoStart={o.variant === 'inline' && o.autoStart === true}
  volume={o.volume}
  paused={o.paused}
  muted={o.muted}
/>
```
他の 4 embed も同様に `muted={o.muted}` を追加。

- [ ] **Step 3: `InlinePlayerOpts` と `resolveInlinePlayer` に `muted` を通す**

`InlinePlayerOpts` 型 (現状 152-158 行付近):
```ts
export type InlinePlayerOpts = {
  readonly autoStart: boolean
  readonly volume?: number
  readonly paused?: boolean
  /** Tier 2 hover playback: start muted. */
  readonly muted?: boolean
}
```
`resolveInlinePlayer` の render 呼び出しに `muted: opts.muted` を追加:
```ts
return entry
  ? entry.render(item, { variant: 'inline', autoStart: opts.autoStart, volume: opts.volume, paused: opts.paused, muted: opts.muted })
  : null
```

- [ ] **Step 4: InlineMediaPlayer.tsx に `muted` prop を追加**

```tsx
export function InlineMediaPlayer({
  item,
  volume,
  paused,
  muted,
}: {
  readonly item: BoardItem
  readonly volume?: number
  readonly paused?: boolean
  /** Tier 2 hover playback: mount muted (no audio). */
  readonly muted?: boolean
}): ReactNode {
  return resolveInlinePlayer(item, { autoStart: true, volume, paused, muted })
}
```

- [ ] **Step 5: tsc + 既存テストで無回帰を確認**

Run: `rtk tsc && rtk npx vitest run`
Expected: tsc clean、 全既存テスト PASS (= muted は optional なので Tier 3 既存呼び出しに影響しない)。

- [ ] **Step 6: Commit**

```bash
rtk git add components/board/embeds/media-players.tsx components/board/embeds/InlineMediaPlayer.tsx
rtk git commit -m "feat(board): thread optional muted through inline player registry"
```

---

## Task 5: 各 embed の muted 対応

`muted` を受け取ったら音を出さずに自動再生する。 **`<video>` 要素は `muted` 属性がないとブラウザが自動再生をブロックする**点が肝 (ホバーは user gesture とみなされないため)。 iframe は URL パラメータで mute する。

> 実装時は各 embed の現状コードを読み、 既存の prop パターン (autoStart/volume/paused の扱い) に合わせて差し込むこと。 以下は変更方針と必須要件。

**Files:** `components/board/embeds/{TweetVideoEmbed,YouTubeEmbed,VimeoEmbed,TikTokEmbed,SoundCloudEmbed}.tsx`

- [ ] **Step 1: TweetVideoEmbed.tsx — `<video>` に muted 属性**

props に `muted?: boolean` を追加。 `<video>` 要素 (現状 197-198 行付近、 `autoPlay` / `playsInline` がある所) に `muted={muted === true}` を追加。 また volume 制御の effect (現状 128 行付近、 `videoRef.current.volume = volume/100`) は `muted` の時はスキップ (= muted 属性を尊重、 volume で上書きしない):
```tsx
<video
  ref={videoRef}
  autoPlay={variant === 'inline' && autoStart}
  playsInline
  muted={muted === true}
  ...
/>
```
volume effect 側:
```ts
if (muted === true) return // muted で自動再生中は volume を触らない
if (typeof volume === 'number' && videoRef.current) {
  videoRef.current.volume = volume / 100
}
```

- [ ] **Step 2: YouTubeEmbed.tsx — iframe src に mute=1**

props に `muted?: boolean` 追加。 iframe src を組み立てている所 (現状 `autoplay=1&enablejsapi=1`) に muted 時 `&mute=1` を付ける:
```ts
const src = `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&playsinline=1${muted ? '&mute=1' : ''}`
```
volume 制御 postMessage (現状 setVolume) は `muted` の時は送らない (= mute=1 を尊重)。

- [ ] **Step 3: VimeoEmbed.tsx — iframe src に muted=1**

props に `muted?: boolean` 追加。 iframe src (現状 `autoplay=1`) に muted 時 `&muted=1`:
```ts
const src = `https://player.vimeo.com/video/${videoId}?autoplay=1${muted ? '&muted=1' : ''}`
```
volume 制御 postMessage は `muted` 時は送らない。

- [ ] **Step 4: TikTokEmbed.tsx — Tier1 video に muted 属性**

props に `muted?: boolean` 追加。 Tier1 の `<video>` (現状 162 行付近、 `autoPlay` / `playsInline`) に `muted={muted === true}` を追加。 Tier2 iframe は cross-origin で制御不可なので何もしない (graceful、 既存挙動のまま)。 volume effect は `muted` 時スキップ。

- [ ] **Step 5: SoundCloudEmbed.tsx — muted 時 setVolume(0)**

props に `muted?: boolean` 追加。 Widget 初期化後の音量設定 (現状 setVolume) で `muted` の時は `setVolume(0)`:
```ts
widget.setVolume(muted === true ? 0 : (controlledVolume ?? getDefaultVolume()))
```
(既存の volume 同期 effect も `muted` 時は 0 を維持)。

- [ ] **Step 6: tsc + 既存テストで無回帰確認**

Run: `rtk tsc && rtk npx vitest run`
Expected: tsc clean、 全既存テスト PASS。

- [ ] **Step 7: Commit**

```bash
rtk git add components/board/embeds/TweetVideoEmbed.tsx components/board/embeds/YouTubeEmbed.tsx components/board/embeds/VimeoEmbed.tsx components/board/embeds/TikTokEmbed.tsx components/board/embeds/SoundCloudEmbed.tsx
rtk git commit -m "feat(board): muted autoplay support across inline embeds for Tier 2"
```

---

## Task 6: CardsLayer 配線 (hover-intent + pool + ミュートオーバーレイ + 枠 glow)

CardsLayer 内で `useHoverIntent` と `usePlaybackPool` を使い、 ホバー中のカードにミュート再生を載せる。 音つき (`audioActiveId`) のカードは音つきを優先 (= ミュートを出さない)。

**Files:**
- Modify: `components/board/CardsLayer.tsx`
- Modify: `components/board/CardsLayer.module.css` (枠 glow。 存在しなければ inline style + globals の keyframes でも可)

- [ ] **Step 1: CardsLayer に hook を 2 つ追加**

CardsLayer コンポーネント本体の冒頭 (他の hook と並べて):
```tsx
import { useHoverIntent } from '@/lib/board/use-hover-intent'
import { usePlaybackPool } from '@/lib/board/use-playback-pool'
import { canPlayInline } from './embeds/InlineMediaPlayer'
// ...
const pool = usePlaybackPool()
const hoverIntent = useHoverIntent((id) => pool.promote(id))
```
(`canPlayInline` は既に import 済みなら重複させない。)

- [ ] **Step 2: 各カードラッパーの pointer ハンドラに配線**

現状 (調査済、 513-540 行付近):
```tsx
onPointerEnter={() => onHoverChange(it.bookmarkId)}
onPointerLeave={() => onHoverChange(null)}
```
を次に変更:
```tsx
onPointerEnter={() => {
  onHoverChange(it.bookmarkId)
  if (canPlayInline(it)) hoverIntent.start(it.bookmarkId)
}}
onPointerLeave={() => {
  onHoverChange(null)
  hoverIntent.cancel()
  pool.release(it.bookmarkId)
}}
```

- [ ] **Step 3: ミュート再生オーバーレイを追加**

現状の Tier 3 オーバーレイ (調査済、 565-588 行付近、 `audioActiveId === it.bookmarkId && canPlayInline(it)` の `<div>` z-index 10) の **直後** に、 Tier 2 ミュートオーバーレイを追加。 音つきが出ている同一カードでは出さない:
```tsx
{pool.isActive(it.bookmarkId) && audioActiveId !== it.bookmarkId && canPlayInline(it) && (
  <div
    data-hover-playback
    onPointerDown={(e) => e.stopPropagation()}
    style={{
      position: 'absolute',
      inset: 0,
      zIndex: 10,
      overflow: 'hidden',
      borderRadius: 'var(--card-radius, 20px)',
      pointerEvents: 'none', // ホバー中の本体クリック (Lightbox) を妨げない
    }}
  >
    <InlineMediaPlayer item={it} muted />
  </div>
)}
```
> 注: `pointerEvents: 'none'` でミュート映像はクリックを素通しし、 カード本体クリック = Lightbox の従来動作を保つ (Tier 3 オーバーレイは音量バー操作のため `auto` のまま、 ここはミュートで操作不要なので `none`)。

- [ ] **Step 4: 昇格時の枠 glow (0.1 秒の視覚反応)**

ミュート再生中のカードラッパーに `data-hover-playing` 属性を付け、 CSS で枠を光らせる。 カードラッパー `<div>` の属性に追加:
```tsx
data-hover-playing={pool.isActive(it.bookmarkId) && audioActiveId !== it.bookmarkId ? '' : undefined}
```
CSS (`CardsLayer.module.css` か該当 module。 AllMarks の音波テーマ = success-green 系 glow に揃える):
```css
[data-hover-playing] {
  box-shadow: 0 0 0 1.5px rgba(74, 222, 128, 0.55), 0 0 16px rgba(74, 222, 128, 0.28);
  transition: box-shadow 0.1s ease-out;
}
```
> glow の最終的な色味・強さは実機で確認してから微調整 (project_pill_visual_language の success-green に合わせる)。

- [ ] **Step 5: tsc + 既存テスト**

Run: `rtk tsc && rtk npx vitest run`
Expected: tsc clean、 全既存テスト PASS。

- [ ] **Step 6: Commit**

```bash
rtk git add components/board/CardsLayer.tsx components/board/CardsLayer.module.css
rtk git commit -m "feat(board): wire Tier 2 hover playback into CardsLayer (muted overlay + glow)"
```

---

## Task 7: 実機検証 (playwright) + 本番デプロイ

仕様 §8 の実機チェックを `pnpm preview` (= wrangler pages dev、 port 8788) で行う。 **検証前に古い workerd を落として新ビルドで再起動**する (session 63 の教訓)。

**Files:** 検証スクリプトは `/tmp` に書く (tracked にしない)。

- [ ] **Step 1: 新ビルド + preview 起動**

```bash
rtk pnpm build
# 既存の wrangler/workerd を落としてから:
npx wrangler pages dev out --port 8788
```

- [ ] **Step 2: playwright で検証 (本人画面 1489×2.58)**

カード投入: `http://127.0.0.1:8788/save?url=<encoded>` で動画系を 5 枚以上 (YouTube / X動画 / Vimeo 等)。 確認項目:
1. カードに 300ms ホバー → `<video>` または iframe が mount され、 **ミュート**で再生 (音が出ない)
2. 乗った直後にカードに `data-hover-playing` が付き枠が光る
3. マウスを外す → 約 0.8 秒後に再生停止、 サムネに戻る
4. 4 枚目に素早くホバー → 最古のカードが停止 (`activeCount` ≤ 3。 DOM 上の `[data-hover-playback]` が 3 個以下)
5. **右下角つまみ (br ハンドル) で引き続きリサイズできる** (= §4 必須、 268→493px 等)
6. 右下アイコン押し (Tier 3) で音つき再生 → 同一カードでミュートオーバーレイが消え音つきが優先される
7. カード本体クリックで従来どおり Lightbox が開く (ホバー再生がクリックを妨げない)

- [ ] **Step 3: 全テスト + tsc 最終確認**

Run: `rtk npx vitest run && rtk tsc`
Expected: 全 PASS (= 既存 686 + 新規 13 = 699 前後)、 tsc clean。

- [ ] **Step 4: 本番デプロイ**

```bash
rtk pnpm build
npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="multi-playback phase2 tier2 hover"
```
完了後 user に「`booklage.pages.dev` をハードリロードして、 動画カードにマウスを乗せると音なしで再生されるか確認してください」 と案内。

- [ ] **Step 5: ドキュメント更新 + commit**

- `docs/TODO_COMPLETED.md` に session 64 narrative 追記
- `docs/TODO.md` の「現在の状態」 を最新化
- `docs/CURRENT_GOAL.md` を次セッション (Phase 3 = Tier 1 ambient or タグ付け) 用に上書き
- `docs/private/dashboard.html` を最新化 (session-workflow ルール)
```bash
rtk git add docs/
rtk git commit -m "docs: record session 64 Tier 2 hover playback shipped"
rtk git push
```

---

## Self-Review

- **Spec coverage:** §3 Tier 2 の確定値 — 300ms (Task 3) / 0.1s 視覚反応 (Task 6 Step 4) / muted (Task 4-5) / 上限 3 LRU (Task 1-2) / 0.8s linger (Task 2) / playsinline (Task 5 既存) ✓。 §6 アーキ — `usePlaybackPool` (Task 1-2) / `useHoverIntent` (Task 3) / 既存プレイヤー流用 (Task 4-5) ✓。 §4 リサイズ死守 (Task 7 Step 2-5) ✓。 §8 unit + playwright ✓。
- **スコープ外の明示:** スクラブ / Tier 1 / master / scroll 抑制は plan 冒頭で除外宣言済。
- **Type consistency:** `promote`/`demote`/`isActive`/`PlaybackPoolState`/`PoolEntry`/`MAX_HOVER_PLAYERS` (pool) と `usePlaybackPool`/`PlaybackPoolApi`/`LINGER_MS` (hook) と `useHoverIntent`/`HoverIntentApi`/`HOVER_INTENT_MS` を全タスクで一貫使用。 `muted` prop 名を registry → InlineMediaPlayer → 各 embed で統一。
- **Placeholder scan:** なし。 Task 5/6 は現状コード依存部分を「実装時に読む」と明示しつつ、 必須要件と差し込みコードを具体提示。
