# オンボーディング(初回チュートリアル)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 初回ユーザーに本物のボード上で実操作させる、リッチでインタラクティブなオンボーディングを実装する。

**Architecture:** ハイブリッド構成。「見せる」=全画面シネマ(GSAP)、「やらせる」=本物ボード上のスポットライト誘導。`OnboardingController` が純データの `steps` に従って進行し、本物のチャンネルイベント(`bookmark-saved`/`bookmark-updated`/MOTION/共有パネル)で前進する。オンボーディング中だけデモカードを十数枚仮置きし、終了時に掃除する。状態は IDB `settings` に永続化。

**Tech Stack:** Next.js 14 App Router / TypeScript strict / Vanilla CSS Modules / GSAP / idb(IndexedDB)/ vitest + fake-indexeddb / next-intl 風自前 i18n(`useI18n`)。

## Global Constraints

- **設計仕様**: `docs/superpowers/specs/2026-06-20-onboarding-design.md` が真実。逸脱しない。
- **コピーは淡々・説明調**。馴れ馴れしい二人称(「〜したね」等)禁止。
- **英語固定 chrome 語彙**: `START` / `SKIP` / `NEXT` / `TRY THIS` / `REPLAY INTRO`(verbatim、翻訳しない)。
- **i18n は15言語同期**(`messages/*.json` 全15ファイル、キー追加は全ファイルに)。新名前空間 `board.onboarding.*`。
- **IDB スキーマ bump 禁止**。ストア/インデックス増設なし。任意フィールド追加のみ可。
- **TypeScript**: `strict`、`any` 禁止(`unknown`+ガード)、return type 明示、Tailwind 禁止(Vanilla CSS Modules)。
- **z-index は魔法数字禁止** → `BOARD_Z_INDEX` 定数に追加。
- **アニメは GSAP / CSS keyframes**(Framer Motion 禁止)。`'use client'` は末端のみ。
- **可視性をアニメに依存させない**: show/hide は state の純粋関数。`fill:forwards`/`onfinish` で可視性制御しない。
- **`prefers-reduced-motion`**: シネマは静的/即時に縮退。
- **検証ゲート**(deploy 前): `rtk tsc && rtk vitest run && rtk pnpm build`。拡張は対象外(本タスクでは拡張コードは触らない)。
- **テスト IDB パターン**: `import 'fake-indexeddb/auto'` + `beforeEach` で `indexedDB.databases()` を全削除 + `initDB()`。
- **本番デプロイ**: `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true --commit-message="<ASCII>"`。

---

## File Structure

**新規作成:**
- `lib/onboarding/onboarding-state.ts` — 初回フラグの読み書き(純ロジック)
- `lib/onboarding/onboarding-demo.ts` — デモカードの注入/掃除/スイープ(純ロジック)
- `lib/onboarding/steps.ts` — シーン定義と遷移条件(純データ+純関数)
- `components/onboarding/OnboardingController.tsx` — 進行管理(末端 client)
- `components/onboarding/OnboardingController.module.css`
- `components/onboarding/OnboardingSpotlight.tsx` — 暗転+くり抜き+吹き出し
- `components/onboarding/OnboardingSpotlight.module.css`
- `components/onboarding/OnboardingStage.tsx` — シネマ(入場/フィナーレ)
- `components/onboarding/OnboardingStage.module.css`
- `components/onboarding/ExtensionSaveReenactment.tsx` — 拡張デモ(GSAP再現)
- `components/onboarding/ExtensionSaveReenactment.module.css`
- 各 `*.test.ts(x)`

**変更:**
- `lib/storage/indexeddb.ts` — `BookmarkRecord` に `onboardingDemo?: boolean` 追加 + `addBookmark` で透過
- `lib/board/constants.ts` — `BOARD_Z_INDEX.ONBOARDING` 追加
- `components/board/BoardRoot.tsx` — マウント分岐 + 起動スイープ + `data-onboarding-target` 印付け
- `components/board/ExtensionEntry.tsx` — `REPLAY INTRO` ボタン追加
- `components/bookmarklet/EmptyStateWelcome.tsx` + `.module.css` — 2回目以降の空状態を現行化(📌撤去)
- `messages/*.json`(全15) — `board.onboarding.*` 追加

---

## Phase 0 — 基盤(純ロジック・TDD)

### Task 1: `onboardingDemo` フィールド + z-index トークン

**Files:**
- Modify: `lib/storage/indexeddb.ts`(`BookmarkRecord` interface 末尾の任意フィールド群 / `addBookmark` の bookmark 構築箇所 846-852 付近)
- Modify: `lib/board/constants.ts`(`BOARD_Z_INDEX` 51-72)
- Test: `tests/lib/onboarding-demo-field.test.ts`

**Interfaces:**
- Produces: `BookmarkRecord.onboardingDemo?: boolean`(true=オンボーディングのデモカード)。`BOARD_Z_INDEX.ONBOARDING: 210`(MODAL_OVERLAY 200 より上)。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// tests/lib/onboarding-demo-field.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import type { IDBPDatabase } from 'idb'
import { initDB, addBookmark, getAllBookmarks } from '@/lib/storage/indexeddb'
import { BOARD_Z_INDEX } from '@/lib/board/constants'

let db: IDBPDatabase<unknown> | null = null
beforeEach(async () => {
  for (const info of await indexedDB.databases()) {
    if (info.name) indexedDB.deleteDatabase(info.name)
  }
})
afterEach(() => { if (db) { db.close(); db = null } })

describe('onboardingDemo field', () => {
  it('persists onboardingDemo=true through addBookmark', async () => {
    const d = await initDB()
    db = d as unknown as IDBPDatabase<unknown>
    await addBookmark(d, {
      url: 'https://example.com/a', title: 'A', description: '', thumbnail: '',
      favicon: '', siteName: '', type: 'website', onboardingDemo: true,
    })
    const all = await getAllBookmarks(d)
    expect(all[0]?.onboardingDemo).toBe(true)
  })

  it('omits onboardingDemo for normal saves', async () => {
    const d = await initDB()
    db = d as unknown as IDBPDatabase<unknown>
    await addBookmark(d, {
      url: 'https://example.com/b', title: 'B', description: '', thumbnail: '',
      favicon: '', siteName: '', type: 'website',
    })
    const all = await getAllBookmarks(d)
    expect(all[0]?.onboardingDemo).toBeUndefined()
  })

  it('ONBOARDING z-index sits above MODAL_OVERLAY', () => {
    expect(BOARD_Z_INDEX.ONBOARDING).toBeGreaterThan(BOARD_Z_INDEX.MODAL_OVERLAY)
  })
})
```

- [ ] **Step 2: 実行して失敗を確認**

Run: `rtk vitest run tests/lib/onboarding-demo-field.test.ts`
Expected: FAIL(`onboardingDemo` が型に無い / `BOARD_Z_INDEX.ONBOARDING` undefined)

- [ ] **Step 3: 実装**

`lib/storage/indexeddb.ts` の `BookmarkRecord` interface の任意フィールド群(`cardWidth?` の近く)に追加:

```ts
  /** Onboarding demo card — seeded during the first-run tutorial and swept
   *  on completion/next load. Absent on all real user bookmarks. */
  onboardingDemo?: boolean
```

`addBookmark` の `const bookmark: BookmarkRecord = { ... }` に1行追加(`tags`/`displayMode` の近く):

```ts
    onboardingDemo: input.onboardingDemo,
```

`lib/board/constants.ts` の `BOARD_Z_INDEX` に追加(`MODAL_OVERLAY` の次の行):

```ts
  ONBOARDING: 210,     // First-run tutorial overlay (above MODAL_OVERLAY)
```

(`BookmarkInput` は `Omit<BookmarkRecord, 'id'|'savedAt'|...>` なので `onboardingDemo?` は自動で input に含まれる。追加作業不要。)

- [ ] **Step 4: 実行して成功を確認**

Run: `rtk vitest run tests/lib/onboarding-demo-field.test.ts`
Expected: PASS(3 tests)

- [ ] **Step 5: コミット**

```bash
rtk git add lib/storage/indexeddb.ts lib/board/constants.ts tests/lib/onboarding-demo-field.test.ts
rtk git commit -m "feat(onboarding): add onboardingDemo bookmark field + ONBOARDING z-index"
```

---

### Task 2: `onboarding-state.ts`(初回フラグ)

**Files:**
- Create: `lib/onboarding/onboarding-state.ts`
- Test: `tests/lib/onboarding-state.test.ts`

**Interfaces:**
- Produces:
  - `isOnboardingComplete(db: DbLike): Promise<boolean>`
  - `markOnboardingComplete(db: DbLike): Promise<void>`
  - `shouldAutoStartOnboarding(db: DbLike, itemCount: number): Promise<boolean>`(= 未完了 && itemCount===0)
  - `type DbLike = IDBPDatabase<any>`

- [ ] **Step 1: 失敗するテストを書く**

```ts
// tests/lib/onboarding-state.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import type { IDBPDatabase } from 'idb'
import { initDB } from '@/lib/storage/indexeddb'
import {
  isOnboardingComplete, markOnboardingComplete, shouldAutoStartOnboarding,
} from '@/lib/onboarding/onboarding-state'

let db: IDBPDatabase<unknown> | null = null
beforeEach(async () => {
  for (const info of await indexedDB.databases()) {
    if (info.name) indexedDB.deleteDatabase(info.name)
  }
})
afterEach(() => { if (db) { db.close(); db = null } })

describe('onboarding-state', () => {
  it('defaults to not complete', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    expect(await isOnboardingComplete(d)).toBe(false)
  })
  it('marks complete and persists', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await markOnboardingComplete(d)
    expect(await isOnboardingComplete(d)).toBe(true)
  })
  it('auto-starts only when incomplete AND board empty', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    expect(await shouldAutoStartOnboarding(d, 0)).toBe(true)
    expect(await shouldAutoStartOnboarding(d, 3)).toBe(false)
    await markOnboardingComplete(d)
    expect(await shouldAutoStartOnboarding(d, 0)).toBe(false)
  })
})
```

- [ ] **Step 2: 実行して失敗を確認**

Run: `rtk vitest run tests/lib/onboarding-state.test.ts`
Expected: FAIL(モジュール未作成)

- [ ] **Step 3: 実装**

```ts
// lib/onboarding/onboarding-state.ts
import type { IDBPDatabase } from 'idb'

/** Persisted under its own settings key (mirrors quick-tag-setting.ts). */
const ONBOARDING_KEY = 'onboarding-completed'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>
type Record_ = { key: string; completed: boolean }

export async function isOnboardingComplete(db: DbLike): Promise<boolean> {
  const rec = (await db.get('settings', ONBOARDING_KEY)) as Record_ | undefined
  return rec?.completed === true
}

export async function markOnboardingComplete(db: DbLike): Promise<void> {
  await db.put('settings', { key: ONBOARDING_KEY, completed: true } satisfies Record_)
}

export async function shouldAutoStartOnboarding(
  db: DbLike, itemCount: number,
): Promise<boolean> {
  if (itemCount !== 0) return false
  return !(await isOnboardingComplete(db))
}
```

- [ ] **Step 4: 実行して成功を確認**

Run: `rtk vitest run tests/lib/onboarding-state.test.ts`
Expected: PASS(3 tests)

- [ ] **Step 5: コミット**

```bash
rtk git add lib/onboarding/onboarding-state.ts tests/lib/onboarding-state.test.ts
rtk git commit -m "feat(onboarding): first-run state (complete flag + auto-start gate)"
```

---

### Task 3: `onboarding-demo.ts`(デモカード注入/掃除/スイープ)

**Files:**
- Create: `lib/onboarding/onboarding-demo.ts`
- Test: `tests/lib/onboarding-demo.test.ts`

**Interfaces:**
- Consumes: `addBookmark`, `deleteBookmark`, `getAllBookmarks`(indexeddb.ts)、`DEMO_COLLAGE`(demo-collage.ts)。
- Produces:
  - `seedOnboardingDemo(db: DbLike, count?: number): Promise<string[]>`(作成した bookmarkId 配列を返す。既存デモは先に掃除して重複防止)
  - `clearOnboardingDemo(db: DbLike): Promise<void>`(`onboardingDemo===true` の bookmark を全 hard-delete)
  - `countOnboardingDemo(db: DbLike): Promise<number>`

- [ ] **Step 1: 失敗するテストを書く**

```ts
// tests/lib/onboarding-demo.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import type { IDBPDatabase } from 'idb'
import { initDB, addBookmark, getAllBookmarks } from '@/lib/storage/indexeddb'
import {
  seedOnboardingDemo, clearOnboardingDemo, countOnboardingDemo,
} from '@/lib/onboarding/onboarding-demo'

let db: IDBPDatabase<unknown> | null = null
beforeEach(async () => {
  for (const info of await indexedDB.databases()) {
    if (info.name) indexedDB.deleteDatabase(info.name)
  }
})
afterEach(() => { if (db) { db.close(); db = null } })

describe('onboarding-demo', () => {
  it('seeds N flagged demo cards', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const ids = await seedOnboardingDemo(d, 6)
    expect(ids).toHaveLength(6)
    const all = await getAllBookmarks(d)
    expect(all.every((b) => b.onboardingDemo === true)).toBe(true)
    expect(await countOnboardingDemo(d)).toBe(6)
  })

  it('clear removes only demo cards, keeps real ones', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await addBookmark(d, {
      url: 'https://real.example', title: 'real', description: '', thumbnail: '',
      favicon: '', siteName: '', type: 'website',
    })
    await seedOnboardingDemo(d, 4)
    await clearOnboardingDemo(d)
    const all = await getAllBookmarks(d)
    expect(all).toHaveLength(1)
    expect(all[0]?.url).toBe('https://real.example')
  })

  it('re-seed clears prior demo first (no duplicates)', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await seedOnboardingDemo(d, 5)
    await seedOnboardingDemo(d, 5)
    expect(await countOnboardingDemo(d)).toBe(5)
  })
})
```

- [ ] **Step 2: 実行して失敗を確認**

Run: `rtk vitest run tests/lib/onboarding-demo.test.ts`
Expected: FAIL(モジュール未作成)

- [ ] **Step 3: 実装**

```ts
// lib/onboarding/onboarding-demo.ts
import type { IDBPDatabase } from 'idb'
import { addBookmark, deleteBookmark, getAllBookmarks } from '@/lib/storage/indexeddb'
import { DEMO_COLLAGE } from '@/lib/marketing/demo-collage'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

const DEFAULT_DEMO_COUNT = 12

/** Hard-delete every bookmark flagged onboardingDemo. */
export async function clearOnboardingDemo(db: DbLike): Promise<void> {
  const all = await getAllBookmarks(db)
  for (const b of all) {
    if (b.onboardingDemo === true) await deleteBookmark(db, b.id)
  }
}

export async function countOnboardingDemo(db: DbLike): Promise<number> {
  const all = await getAllBookmarks(db)
  return all.filter((b) => b.onboardingDemo === true).length
}

/** Seed `count` CC0 demo cards (image-type) flagged onboardingDemo.
 *  Clears any prior demo first so re-entry never duplicates. */
export async function seedOnboardingDemo(
  db: DbLike, count: number = DEFAULT_DEMO_COUNT,
): Promise<string[]> {
  await clearOnboardingDemo(db)
  const assets = DEMO_COLLAGE.slice(0, count)
  const ids: string[] = []
  for (const a of assets) {
    const rec = await addBookmark(db, {
      url: `https://allmarks.app/demo/${encodeURIComponent(a.src)}`,
      title: a.credit,
      description: '',
      thumbnail: `/${a.src}`,
      favicon: '',
      siteName: 'AllMarks',
      type: 'website',
      onboardingDemo: true,
    })
    ids.push(rec.id)
  }
  return ids
}
```

- [ ] **Step 4: 実行して成功を確認**

Run: `rtk vitest run tests/lib/onboarding-demo.test.ts`
Expected: PASS(3 tests)

- [ ] **Step 5: コミット**

```bash
rtk git add lib/onboarding/onboarding-demo.ts tests/lib/onboarding-demo.test.ts
rtk git commit -m "feat(onboarding): demo card seed/clear/sweep (CC0 collage, flagged)"
```

---

### Task 4: `steps.ts`(シーン定義 + 遷移マシン)

**Files:**
- Create: `lib/onboarding/steps.ts`
- Test: `tests/lib/onboarding-steps.test.ts`

**Interfaces:**
- Produces:
  - `type SceneKind = 'cinema' | 'handsOn'`
  - `type AdvanceTrigger = 'button' | 'saved' | 'tagged' | 'motion' | 'sharePanel'`
  - `type OnboardingScene = { id: SceneId; kind: SceneKind; advance: AdvanceTrigger; target?: OnboardingTarget }`
  - `type SceneId = 'enter'|'paste'|'tag'|'motion'|'extDemo'|'install'|'share'|'finale'`
  - `type OnboardingTarget = 'paste-zone'|'card-tag'|'motion'|'share'`
  - `const ONBOARDING_SCENES: readonly OnboardingScene[]`(8件、上記順)
  - `nextSceneId(current: SceneId): SceneId | null`(最後は null)
  - `sceneById(id: SceneId): OnboardingScene`

- [ ] **Step 1: 失敗するテストを書く**

```ts
// tests/lib/onboarding-steps.test.ts
import { describe, it, expect } from 'vitest'
import { ONBOARDING_SCENES, nextSceneId, sceneById } from '@/lib/onboarding/steps'

describe('onboarding steps', () => {
  it('has 8 scenes in the spec order', () => {
    expect(ONBOARDING_SCENES.map((s) => s.id)).toEqual([
      'enter', 'paste', 'tag', 'motion', 'extDemo', 'install', 'share', 'finale',
    ])
  })
  it('paste advances on a real save event', () => {
    expect(sceneById('paste').advance).toBe('saved')
    expect(sceneById('tag').advance).toBe('tagged')
    expect(sceneById('motion').advance).toBe('motion')
    expect(sceneById('share').advance).toBe('sharePanel')
  })
  it('nextSceneId walks the chain then ends', () => {
    expect(nextSceneId('enter')).toBe('paste')
    expect(nextSceneId('share')).toBe('finale')
    expect(nextSceneId('finale')).toBeNull()
  })
  it('hands-on scenes carry a spotlight target', () => {
    expect(sceneById('paste').target).toBe('paste-zone')
    expect(sceneById('tag').target).toBe('card-tag')
    expect(sceneById('enter').target).toBeUndefined()
  })
})
```

- [ ] **Step 2: 実行して失敗を確認**

Run: `rtk vitest run tests/lib/onboarding-steps.test.ts`
Expected: FAIL(モジュール未作成)

- [ ] **Step 3: 実装**

```ts
// lib/onboarding/steps.ts
export type SceneKind = 'cinema' | 'handsOn'
export type AdvanceTrigger = 'button' | 'saved' | 'tagged' | 'motion' | 'sharePanel'
export type SceneId =
  | 'enter' | 'paste' | 'tag' | 'motion' | 'extDemo' | 'install' | 'share' | 'finale'
export type OnboardingTarget = 'paste-zone' | 'card-tag' | 'motion' | 'share'

export type OnboardingScene = {
  readonly id: SceneId
  readonly kind: SceneKind
  readonly advance: AdvanceTrigger
  readonly target?: OnboardingTarget
}

export const ONBOARDING_SCENES: readonly OnboardingScene[] = [
  { id: 'enter',   kind: 'cinema',  advance: 'button' },
  { id: 'paste',   kind: 'handsOn', advance: 'saved',      target: 'paste-zone' },
  { id: 'tag',     kind: 'handsOn', advance: 'tagged',     target: 'card-tag' },
  { id: 'motion',  kind: 'handsOn', advance: 'motion',     target: 'motion' },
  { id: 'extDemo', kind: 'cinema',  advance: 'button' },
  { id: 'install', kind: 'handsOn', advance: 'button' },
  { id: 'share',   kind: 'handsOn', advance: 'sharePanel', target: 'share' },
  { id: 'finale',  kind: 'cinema',  advance: 'button' },
] as const

export function sceneById(id: SceneId): OnboardingScene {
  const s = ONBOARDING_SCENES.find((x) => x.id === id)
  if (!s) throw new Error(`unknown scene: ${id}`)
  return s
}

export function nextSceneId(current: SceneId): SceneId | null {
  const i = ONBOARDING_SCENES.findIndex((x) => x.id === current)
  const next = ONBOARDING_SCENES[i + 1]
  return next ? next.id : null
}
```

- [ ] **Step 4: 実行して成功を確認**

Run: `rtk vitest run tests/lib/onboarding-steps.test.ts`
Expected: PASS(4 tests)

- [ ] **Step 5: コミット**

```bash
rtk git add lib/onboarding/steps.ts tests/lib/onboarding-steps.test.ts
rtk git commit -m "feat(onboarding): scene definitions + advance state machine"
```

---

## Phase 1 — Controller と配線

### Task 5: `OnboardingController`(進行管理 + イベント前進)

**Files:**
- Create: `components/onboarding/OnboardingController.tsx`, `.module.css`
- Test: `components/onboarding/OnboardingController.test.tsx`

**Interfaces:**
- Consumes: `ONBOARDING_SCENES`/`nextSceneId`/`sceneById`(steps.ts)、`subscribeBookmarkSaved`/`subscribeBookmarkUpdated`(channel.ts)、`markOnboardingComplete`(onboarding-state.ts)、`clearOnboardingDemo`(onboarding-demo.ts)、`useI18n`。
- Props: `OnboardingControllerProps = { db: DbLike; motionEnabled: boolean; sharePanelOpen: boolean; onComplete: () => void }`
- 動作: 現在シーン state を持ち、`advance` に応じて: `button`=`NEXT`/`START`クリック、`saved`=`subscribeBookmarkSaved`、`tagged`=`subscribeBookmarkUpdated`、`motion`=`motionEnabled` が false→true、`sharePanel`=`sharePanelOpen` が false→true。最後のシーンで完了時 `clearOnboardingDemo`→`markOnboardingComplete`→`onComplete()`。`SKIP` も同じ完了処理。

このタスクでは**進行ロジックと完了処理**をテストする(各シーンの見た目は Phase 2 で差し込む。ここでは各シーンを `data-testid="scene-<id>"` のプレースホルダ div で描画する)。

- [ ] **Step 1: 失敗するテストを書く**

```tsx
// components/onboarding/OnboardingController.test.tsx
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import 'fake-indexeddb/auto'
import { initDB } from '@/lib/storage/indexeddb'
import { postBookmarkSaved, postBookmarkUpdated } from '@/lib/board/channel'
import { renderWithLocale } from '@/lib/i18n/test-utils'
import en from '@/messages/en.json'
import type { Messages } from '@/lib/i18n/config'
import { OnboardingController } from './OnboardingController'

afterEach(cleanup)
beforeEach(async () => {
  for (const info of await indexedDB.databases()) {
    if (info.name) indexedDB.deleteDatabase(info.name)
  }
})

async function setup(props: Partial<React.ComponentProps<typeof OnboardingController>> = {}) {
  const db = await initDB()
  const onComplete = vi.fn()
  const ui = (
    <OnboardingController
      db={db} motionEnabled={false} sharePanelOpen={false}
      onComplete={onComplete} {...props}
    />
  )
  renderWithLocale(ui, 'en', en as Messages)
  return { db, onComplete }
}

describe('OnboardingController', () => {
  it('starts at the enter scene', async () => {
    await setup()
    expect(screen.getByTestId('scene-enter')).not.toBeNull()
  })

  it('START advances enter -> paste', async () => {
    await setup()
    fireEvent.click(screen.getByRole('button', { name: 'START' }))
    expect(screen.getByTestId('scene-paste')).not.toBeNull()
  })

  it('a real bookmark-saved event advances the paste scene', async () => {
    await setup()
    fireEvent.click(screen.getByRole('button', { name: 'START' }))
    await act(async () => { postBookmarkSaved({ bookmarkId: 'x' }) })
    expect(screen.getByTestId('scene-tag')).not.toBeNull()
  })

  it('SKIP completes immediately', async () => {
    const { onComplete } = await setup()
    fireEvent.click(screen.getByRole('button', { name: 'SKIP' }))
    await vi.waitFor(() => expect(onComplete).toHaveBeenCalledOnce())
  })
})
```

- [ ] **Step 2: 実行して失敗を確認**

Run: `rtk vitest run components/onboarding/OnboardingController.test.tsx`
Expected: FAIL(モジュール未作成)

- [ ] **Step 3: 実装(プレースホルダ・シーンで進行のみ)**

```tsx
// components/onboarding/OnboardingController.tsx
'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { IDBPDatabase } from 'idb'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { subscribeBookmarkSaved, subscribeBookmarkUpdated } from '@/lib/board/channel'
import { markOnboardingComplete } from '@/lib/onboarding/onboarding-state'
import { clearOnboardingDemo } from '@/lib/onboarding/onboarding-demo'
import { nextSceneId, sceneById, type SceneId } from '@/lib/onboarding/steps'
import styles from './OnboardingController.module.css'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

type Props = {
  readonly db: DbLike
  readonly motionEnabled: boolean
  readonly sharePanelOpen: boolean
  readonly onComplete: () => void
}

export function OnboardingController({
  db, motionEnabled, sharePanelOpen, onComplete,
}: Props): ReactElement {
  const { t } = useI18n()
  const [sceneId, setSceneId] = useState<SceneId>('enter')
  const scene = sceneById(sceneId)
  const finishingRef = useRef(false)

  const advance = (): void => {
    const next = nextSceneId(sceneId)
    if (next === null) { void finish(); return }
    setSceneId(next)
  }

  const finish = async (): Promise<void> => {
    if (finishingRef.current) return
    finishingRef.current = true
    await clearOnboardingDemo(db)
    await markOnboardingComplete(db)
    onComplete()
  }

  // Event-driven advances. Each effect is scoped to the scene that needs it.
  useEffect(() => {
    if (scene.advance !== 'saved') return
    return subscribeBookmarkSaved(() => advance())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId])

  useEffect(() => {
    if (scene.advance !== 'tagged') return
    return subscribeBookmarkUpdated(() => advance())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId])

  useEffect(() => {
    if (scene.advance === 'motion' && motionEnabled) advance()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motionEnabled, sceneId])

  useEffect(() => {
    if (scene.advance === 'sharePanel' && sharePanelOpen) advance()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharePanelOpen, sceneId])

  const buttonLabel = sceneId === 'enter' ? 'START' : 'NEXT'

  return (
    <div className={styles.root} data-testid="onboarding-root">
      <button type="button" className={styles.skip} onClick={() => void finish()}>
        SKIP
      </button>

      {/* Placeholder scenes — Phase 2 swaps in OnboardingStage / Spotlight /
          ExtensionSaveReenactment per scene.kind. */}
      <div data-testid={`scene-${sceneId}`}>
        <p className={styles.placeholderCopy}>
          {t(`board.onboarding.${sceneId}.body`)}
        </p>
        {scene.advance === 'button' && (
          <button type="button" className={styles.advanceBtn} onClick={advance}>
            {buttonLabel}
          </button>
        )}
      </div>
    </div>
  )
}
```

```css
/* components/onboarding/OnboardingController.module.css */
.root {
  position: fixed;
  inset: 0;
  z-index: 210; /* BOARD_Z_INDEX.ONBOARDING */
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
  color: rgba(255, 255, 255, 0.9);
}
.skip {
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font: inherit;
  font-size: 11px;
  letter-spacing: 0.10em;
  cursor: pointer;
}
.skip:hover { color: rgba(255, 255, 255, 1); }
.advanceBtn {
  margin-top: 16px;
  font: inherit;
  font-size: 12px;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 10px 20px;
  cursor: pointer;
}
.placeholderCopy { text-align: center; max-width: 420px; }
```

i18n キー(`board.onboarding.<sceneId>.body`)は Task 13 で全15言語に入る。Phase 1 の段階では en/ja に最低限のダミー文を先行追加してテストを通す(Step 3.5)。

- [ ] **Step 3.5: en/ja に最小キーを追加**(Task 13 で本番コピー・残13言語)

`messages/en.json` と `messages/ja.json` の `board` 直下に `onboarding` を追加。各 sceneId に `body`(en は説明調の暫定文、ja も)。例(en):

```json
"onboarding": {
  "enter": { "body": "AllMarks turns links into a visual board." },
  "paste": { "body": "Paste a link with Cmd/Ctrl+V, or use TRY THIS." },
  "tag": { "body": "Add a tag to the card you just saved." },
  "motion": { "body": "Turn on MOTION to bring the board to life." },
  "extDemo": { "body": "With the extension, one click saves the open page and tags it." },
  "install": { "body": "Drag the AllMarks chip to your bookmarks bar to save from anywhere." },
  "share": { "body": "Open SHARE to publish your board as an image or a link." },
  "finale": { "body": "You're set. Replay this anytime from SETTINGS." }
}
```

- [ ] **Step 4: 実行して成功を確認**

Run: `rtk vitest run components/onboarding/OnboardingController.test.tsx`
Expected: PASS(4 tests)

- [ ] **Step 5: コミット**

```bash
rtk git add components/onboarding/ messages/en.json messages/ja.json
rtk git commit -m "feat(onboarding): controller with event-driven scene advance (placeholder scenes)"
```

---

### Task 6: BoardRoot 統合(マウント分岐 + 起動スイープ)

**Files:**
- Modify: `components/board/BoardRoot.tsx`(EmptyStateWelcome マウント箇所 1936-1938、初期化 effect、MOTION state、SHARE モーダル open state)
- Modify: `components/bookmarklet/EmptyStateWelcome.tsx` + `.module.css`(📌撤去・コピー現行化)
- Test: `components/bookmarklet/EmptyStateWelcome.test.tsx`(既存更新)

**Interfaces:**
- Consumes: `shouldAutoStartOnboarding`(onboarding-state.ts)、`clearOnboardingDemo`/`seedOnboardingDemo`(onboarding-demo.ts)、`OnboardingController`。
- BoardRoot に `showOnboarding: boolean` state。初回判定 effect で `shouldAutoStartOnboarding(db, items.length)` が true なら `seedOnboardingDemo(db)` → reload → `setShowOnboarding(true)`。常に起動時 sweep: `isOnboardingComplete` が true なら `clearOnboardingDemo(db)`(離脱残骸の掃除)。

- [ ] **Step 1: EmptyStateWelcome を現行化(📌撤去)**

`components/bookmarklet/EmptyStateWelcome.tsx`:

```tsx
'use client'

import type { ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './EmptyStateWelcome.module.css'

type Props = {
  readonly onOpenModal: () => void
  readonly onReplayIntro?: () => void
}

export function EmptyStateWelcome({ onOpenModal, onReplayIntro }: Props): ReactElement {
  const { t } = useI18n()
  return (
    <div className={styles.wrap} data-testid="empty-state-welcome">
      <h2 className={styles.title}>{t('board.empty.title')}</h2>
      <p className={styles.description}>{t('board.empty.description')}</p>
      <button type="button" className={styles.installBtn} onClick={onOpenModal}>
        {t('board.empty.installButton')}
      </button>
      {onReplayIntro && (
        <button type="button" className={styles.replay} onClick={onReplayIntro}>
          REPLAY INTRO
        </button>
      )}
    </div>
  )
}
```

`.module.css` の `.icon` ルールを削除し、`.replay`(素テキスト・等幅・小)を追加:

```css
.replay {
  margin-top: 14px;
  background: none;
  border: none;
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.10em;
  color: var(--color-text-tertiary);
  cursor: pointer;
}
.replay:hover { color: var(--color-text-primary); }
```

- [ ] **Step 2: empty コピーを現行化(📌撤去・貼り付け中心)**

`messages/en.json` / `ja.json` の `board.empty.*` を更新(残13言語は Task 13):

```json
"empty": {
  "title": "Your board is empty",
  "description": "Paste a link (Cmd/Ctrl+V) to save your first bookmark.",
  "installButton": "Save without the extension",
  "alreadyInstalled": "Paste a link on the board to save it"
}
```

- [ ] **Step 3: EmptyStateWelcome テスト更新**

`EmptyStateWelcome.test.tsx` の 📌 期待を削除し、`REPLAY INTRO` ボタンが `onReplayIntro` 指定時のみ出ることを追加:

```tsx
it('shows REPLAY INTRO only when handler provided', () => {
  const onReplay = vi.fn()
  renderWithLocale(<EmptyStateWelcome onOpenModal={() => {}} onReplayIntro={onReplay} />, 'ja', ja as Messages)
  fireEvent.click(screen.getByRole('button', { name: 'REPLAY INTRO' }))
  expect(onReplay).toHaveBeenCalledOnce()
})
```

- [ ] **Step 4: BoardRoot にマウント分岐 + スイープ**

`components/board/BoardRoot.tsx`:
- import 追加: `OnboardingController`、`shouldAutoStartOnboarding`/`isOnboardingComplete`(onboarding-state)、`seedOnboardingDemo`/`clearOnboardingDemo`(onboarding-demo)。
- state 追加: `const [showOnboarding, setShowOnboarding] = useState(false)`、`const [sharePanelOpen, setSharePanelOpen] = useState(false)`(SHARE モーダルの open に同期。既存 share 開閉 state があればそれを使う)。
- 初回判定 effect(`loading` 完了・`db` 準備後・**一度だけ**):

```tsx
useEffect(() => {
  if (loading || !db) return
  let cancelled = false
  void (async () => {
    if (await shouldAutoStartOnboarding(db, items.length)) {
      await seedOnboardingDemo(db)
      if (cancelled) return
      await reloadBookmarks() // 既存の再読込関数（デモを画面に反映）
      if (cancelled) return
      setShowOnboarding(true)
    } else if (await isOnboardingComplete(db)) {
      await clearOnboardingDemo(db) // 離脱残骸スイープ
    }
  })()
  return () => { cancelled = true }
  // 初回のみ: loading が false に変わった最初の一回で判定
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [loading, db])
```

(`reloadBookmarks` は BoardRoot 内の既存リロード手段名に合わせる。無ければ `bookmark-saved` で走る既存リロード経路を呼ぶ。実装時に確認。)

- マウント(現 `EmptyStateWelcome` 箇所 1936-1938 を分岐に):

```tsx
{!loading && showOnboarding && db && (
  <OnboardingController
    db={db}
    motionEnabled={motionEnabled}
    sharePanelOpen={sharePanelOpen}
    onComplete={() => setShowOnboarding(false)}
  />
)}
{!loading && !showOnboarding && items.length === 0 && (
  <EmptyStateWelcome
    onOpenModal={handleOpenBookmarkletModal}
    onReplayIntro={() => { void startOnboardingReplay() }}
  />
)}
```

- `startOnboardingReplay`(Task 7 で SETTINGS からも使う共通関数)を BoardRoot に定義:

```tsx
const startOnboardingReplay = async (): Promise<void> => {
  if (!db) return
  await seedOnboardingDemo(db)
  await reloadBookmarks()
  setShowOnboarding(true)
}
```

- `motionEnabled` は既存 MOTION state 名に合わせる(`MotionToggle` の `enabled` に渡している state)。

- [ ] **Step 5: 検証(tsc + 関連テスト)**

Run: `rtk tsc && rtk vitest run components/bookmarklet/EmptyStateWelcome.test.tsx components/board/BoardRoot`
Expected: tsc 0、テスト PASS。

- [ ] **Step 6: コミット**

```bash
rtk git add components/board/BoardRoot.tsx components/bookmarklet/EmptyStateWelcome.tsx components/bookmarklet/EmptyStateWelcome.module.css components/bookmarklet/EmptyStateWelcome.test.tsx messages/en.json messages/ja.json
rtk git commit -m "feat(onboarding): mount controller on first-run, seed demo + load sweep; modernize empty state (drop pin)"
```

---

### Task 7: SETTINGS に `REPLAY INTRO`

**Files:**
- Modify: `components/board/ExtensionEntry.tsx`(SETTINGS ドロワー、`open-bookmarklet-install` の近く)
- Modify: `components/board/BoardRoot.tsx`(`ExtensionEntry` に `onReplayIntro` を渡す)
- Test: `components/board/ExtensionEntry.test.tsx`(既存に追加)

**Interfaces:**
- `ExtensionEntry` props に `onReplayIntro?: () => void` を追加。SETTINGS ドロワー内に `data-testid="replay-intro"` の `REPLAY INTRO` ボタンを追加(押すと `onReplayIntro()`)。BoardRoot は `startOnboardingReplay` を渡す。

- [ ] **Step 1: 失敗するテストを書く**

```tsx
// ExtensionEntry.test.tsx に追加
it('REPLAY INTRO calls onReplayIntro', () => {
  const onReplay = vi.fn()
  renderWithLocale(
    <ExtensionEntry quickTagEnabled={true} onQuickTagToggle={() => {}}
      onOpenBookmarkletModal={() => {}} onReplayIntro={onReplay} />,
    'en', en as Messages,
  )
  fireEvent.click(screen.getByTestId('replay-intro'))
  expect(onReplay).toHaveBeenCalledOnce()
})
```

- [ ] **Step 2: 実行して失敗を確認**

Run: `rtk vitest run components/board/ExtensionEntry.test.tsx`
Expected: FAIL(prop / ボタン無し)

- [ ] **Step 3: 実装**

`ExtensionEntry.tsx`:
- Props 型に `readonly onReplayIntro?: () => void` 追加。
- `SAVE WITHOUT EXTENSION` ボタンの直後に追加:

```tsx
{onReplayIntro && (
  <button
    type="button"
    className={styles.drawerAction}
    data-testid="replay-intro"
    onClick={onReplayIntro}
  >
    REPLAY INTRO
  </button>
)}
```

(`styles.drawerAction` は既存の `open-bookmarklet-install` と同じクラスに合わせる。)

`BoardRoot.tsx` の `<ExtensionEntry ... />` に `onReplayIntro={() => { void startOnboardingReplay() }}` を追加。

- [ ] **Step 4: 実行して成功を確認**

Run: `rtk vitest run components/board/ExtensionEntry.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
rtk git add components/board/ExtensionEntry.tsx components/board/ExtensionEntry.test.tsx components/board/BoardRoot.tsx
rtk git commit -m "feat(onboarding): REPLAY INTRO entry in SETTINGS drawer"
```

---

## Phase 2 — ビジュアル・シーン(ビルド + 隔離レンダ目視)

> Phase 2 は GSAP/座標演出で自動ユニットテスト不可。各タスクは「実装 → `rtk tsc` → `rtk pnpm build` → 隔離レンダで Playwright スクショ → 目視」で検証する([[feedback_verify_before_claiming]])。コミットは目視 OK 後。

### Task 8: `OnboardingSpotlight`(暗転 + くり抜き + 吹き出し)

**Files:**
- Create: `components/onboarding/OnboardingSpotlight.tsx`, `.module.css`

**Interfaces:**
- Props: `{ targetSelector: string | null; caption: string; children?: ReactNode }`
- `targetSelector`(例 `[data-onboarding-target="paste-zone"]`)の要素矩形を `getBoundingClientRect` で実測し、4枚の半透明パネル(上下左右)で穴を作る(SVG mask でも可だが、4パネル方式が pointer-events 制御しやすい)。穴の中は pointer-events 透過(本物を触れる)、外は塞ぐ。`targetSelector===null`(シネマ)時は全面塞ぐ。吹き出しは穴の近傍に配置。`window.resize` と `requestAnimationFrame` ループ(短時間)で矩形追従。

- [ ] **Step 1: 実装(コンポーネント)**

```tsx
// components/onboarding/OnboardingSpotlight.tsx
'use client'

import { useEffect, useState, type ReactElement, type ReactNode } from 'react'
import styles from './OnboardingSpotlight.module.css'

type Rect = { top: number; left: number; width: number; height: number }
type Props = {
  readonly targetSelector: string | null
  readonly caption: string
  readonly children?: ReactNode
}

function measure(sel: string | null): Rect | null {
  if (!sel) return null
  const el = document.querySelector(sel)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

export function OnboardingSpotlight({ targetSelector, caption, children }: Props): ReactElement {
  const [rect, setRect] = useState<Rect | null>(() => null)

  useEffect(() => {
    let raf = 0
    const tick = (): void => {
      setRect(measure(targetSelector))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [targetSelector])

  const pad = 8
  const hole = rect
    ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : null

  return (
    <div className={styles.layer} data-testid="onboarding-spotlight">
      {hole ? (
        <>
          {/* four dim panels around the hole */}
          <div className={styles.dim} style={{ top: 0, left: 0, right: 0, height: hole.top }} />
          <div className={styles.dim} style={{ top: hole.top, left: 0, width: hole.left, height: hole.height }} />
          <div className={styles.dim} style={{ top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height }} />
          <div className={styles.dim} style={{ top: hole.top + hole.height, left: 0, right: 0, bottom: 0 }} />
          <div className={styles.ring} style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }} />
          <div
            className={styles.bubble}
            style={{ top: hole.top + hole.height + 14, left: hole.left }}
          >
            {caption}
            {children}
          </div>
        </>
      ) : (
        <div className={styles.dimFull}>
          <div className={styles.bubbleCenter}>{caption}{children}</div>
        </div>
      )}
    </div>
  )
}
```

```css
/* components/onboarding/OnboardingSpotlight.module.css */
.layer { position: fixed; inset: 0; pointer-events: none; }
.dim, .dimFull {
  position: fixed;
  background: rgba(0, 0, 0, 0.72);
  pointer-events: auto; /* block clicks outside the hole */
}
.dimFull { inset: 0; display: flex; align-items: center; justify-content: center; }
.ring {
  position: fixed;
  border: 1px solid rgba(40, 241, 0, 0.8); /* A-logo green */
  border-radius: 10px;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.15), 0 0 24px rgba(40,241,0,0.25);
  pointer-events: none;
  animation: spot-pulse 1.6s ease-in-out infinite;
}
.bubble, .bubbleCenter {
  position: fixed;
  max-width: 320px;
  padding: 12px 16px;
  background: rgba(12, 12, 12, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: rgba(255, 255, 255, 0.9);
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
  font-size: 12.5px;
  line-height: 1.7;
  pointer-events: auto;
}
.bubbleCenter { position: static; max-width: 420px; text-align: center; }
@keyframes spot-pulse {
  0%, 100% { box-shadow: 0 0 0 1px rgba(255,255,255,0.15), 0 0 18px rgba(40,241,0,0.2); }
  50%      { box-shadow: 0 0 0 1px rgba(255,255,255,0.25), 0 0 30px rgba(40,241,0,0.4); }
}
@media (prefers-reduced-motion: reduce) { .ring { animation: none; } }
```

- [ ] **Step 2: 隔離レンダで目視**

`/board` を serve(`npx -y serve out -l 4321`)→ Playwright で空ボードに `data-onboarding-target="motion"` がある状態でスポットライトを単体マウントしたテストページ、または Task 12 完了後にまとめて確認。**このタスク単体では tsc + build が通ることを確認**し、見た目はサンプル DOM で:

Run: `rtk tsc && rtk pnpm build`
Expected: tsc 0 / build OK。

- [ ] **Step 3: コミット**

```bash
rtk git add components/onboarding/OnboardingSpotlight.tsx components/onboarding/OnboardingSpotlight.module.css
rtk git commit -m "feat(onboarding): spotlight overlay (measured cutout + caption bubble)"
```

---

### Task 9: `data-onboarding-target` の印付け

**Files:**
- Modify: `components/board/MotionToggle.tsx`(ボタンに `data-onboarding-target="motion"`)
- Modify: `components/board/TopHeader.tsx`(SHARE 操作に `data-onboarding-target="share"`)
- Modify: カードの `+ TAG` ボタン(`data-onboarding-target="card-tag"`、新カードの1枚目のみ・実装時にカード部品を特定)
- Modify: ボード中央のペースト受け面(`data-onboarding-target="paste-zone"`、`InteractionLayer` か canvas のルート)

**Interfaces:**
- Produces: 上記4 DOM 属性。Spotlight が `[data-onboarding-target="..."]` で参照。

- [ ] **Step 1: 実装**

各部品の該当要素に属性を1つ足すだけ(視覚変化なし)。`paste-zone` はボードキャンバスのルート要素(`items.length===0` でも存在する領域)。`card-tag` はカードの既存「+ TAG」要素。

- [ ] **Step 2: 検証**

Run: `rtk tsc && rtk vitest run`
Expected: tsc 0 / 既存テスト PASS(属性追加のみで挙動不変)。

- [ ] **Step 3: コミット**

```bash
rtk git add components/board/
rtk git commit -m "chore(onboarding): mark spotlight targets (paste-zone/card-tag/motion/share)"
```

---

### Task 10: `OnboardingStage`(シネマ: 入場 / フィナーレ)

**Files:**
- Create: `components/onboarding/OnboardingStage.tsx`, `.module.css`

**Interfaces:**
- Props: `{ variant: 'enter' | 'finale'; caption: string; buttonLabel: string; onAdvance: () => void }`
- GSAP タイムラインで音波ライン → A形ロゴ集合 → 緑チェック点灯(`enter`)。`finale` は音波一閃 → 「準備完了」。`prefers-reduced-motion` 時は `gsap.set` で即最終状態。**可視性はマウントで確定**(アニメは装飾のみ、`fill` で可視性を作らない)。

- [ ] **Step 1: 実装**(GSAP・A形ロゴ SVG は既存 floating button の A モチーフを流用)

```tsx
// components/onboarding/OnboardingStage.tsx
'use client'

import { useEffect, useRef, type ReactElement } from 'react'
import { gsap } from 'gsap'
import styles from './OnboardingStage.module.css'

type Props = {
  readonly variant: 'enter' | 'finale'
  readonly caption: string
  readonly buttonLabel: string
  readonly onAdvance: () => void
}

export function OnboardingStage({ variant, caption, buttonLabel, onAdvance }: Props): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const wave = root.querySelectorAll('[data-anim="wave"]')
    const logo = root.querySelector('[data-anim="logo"]')
    const check = root.querySelector('[data-anim="check"]')
    const copy = root.querySelectorAll('[data-anim="copy"]')
    if (reduce) {
      gsap.set([logo, check, ...copy], { opacity: 1, scale: 1, y: 0 })
      return
    }
    const tl = gsap.timeline()
    tl.from(wave, { scaleX: 0, opacity: 0, duration: 0.6, stagger: 0.06, ease: 'power2.out' })
      .from(logo, { opacity: 0, scale: 0.8, duration: 0.5, ease: 'back.out(1.6)' }, '-=0.2')
      .from(check, { opacity: 0, scale: 0.4, duration: 0.35, ease: 'back.out(2)' }, '-=0.1')
      .from(copy, { opacity: 0, y: 12, duration: 0.4, stagger: 0.08 }, '-=0.1')
    return () => { tl.kill() }
  }, [variant])

  return (
    <div ref={rootRef} className={styles.stage} data-testid={`stage-${variant}`}>
      <div className={styles.waves}>
        {Array.from({ length: 7 }).map((_, i) => (
          <span key={i} data-anim="wave" className={styles.wave} />
        ))}
      </div>
      {variant === 'enter' && (
        <div className={styles.mark}>
          <svg data-anim="logo" className={styles.logo} viewBox="0 0 48 48" aria-hidden="true">
            <path d="M24 6 L40 42 L31 42 L24 24 L17 42 L8 42 Z" fill="#0a0a0a" stroke="rgba(255,255,255,0.85)" strokeWidth="1.5" />
          </svg>
          <span data-anim="check" className={styles.check}>✓</span>
        </div>
      )}
      <p data-anim="copy" className={styles.caption}>{caption}</p>
      <button data-anim="copy" type="button" className={styles.cta} onClick={onAdvance}>
        {buttonLabel}
      </button>
    </div>
  )
}
```

```css
/* components/onboarding/OnboardingStage.module.css */
.stage {
  position: fixed; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 18px; background: rgba(6, 6, 6, 0.96);
  font-family: ui-monospace, "SF Mono", Consolas, monospace; color: rgba(255,255,255,0.9);
}
.waves { display: flex; gap: 6px; align-items: center; height: 40px; }
.wave { width: 3px; height: 24px; background: rgba(40,241,0,0.7); border-radius: 2px; transform-origin: center; }
.mark { position: relative; display: inline-flex; }
.logo { width: 64px; height: 64px; }
.check { position: absolute; right: -10px; bottom: -6px; color: #28f100; font-size: 22px; }
.caption { max-width: 420px; text-align: center; font-size: 13px; line-height: 1.8; }
.cta {
  font: inherit; font-size: 12px; letter-spacing: 0.10em; text-transform: uppercase;
  color: rgba(255,255,255,0.95); background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.22); border-radius: 8px; padding: 10px 22px; cursor: pointer;
}
.cta:hover { background: rgba(255,255,255,0.1); }
```

- [ ] **Step 2: 隔離レンダで目視**

`rtk tsc && rtk pnpm build` → serve → Playwright で `OnboardingStage` を含むシーンをスクショ。入場演出(波→A→緑✓)が出るか確認。

- [ ] **Step 3: コミット**

```bash
rtk git add components/onboarding/OnboardingStage.tsx components/onboarding/OnboardingStage.module.css
rtk git commit -m "feat(onboarding): cinema stage (enter/finale, sound-wave + A logo + green check)"
```

---

### Task 11: `ExtensionSaveReenactment`(拡張デモ・GSAP再現)

**Files:**
- Create: `components/onboarding/ExtensionSaveReenactment.tsx`, `.module.css`

**Interfaces:**
- Props: `{ caption: string; buttonLabel: string; onAdvance: () => void }`
- 偽ブラウザ枠(アドレスバー+ツールバー)+ 動くカーソル → 拡張アイコンを押す → 緑フラッシュ(既存保存合図の色)→ 保存即タグ付け帯がスルッと降りてタグチップに緑✓。GSAP timeline ループ(または1回 + REPLAY)。`prefers-reduced-motion` は静止の最終フレーム。

- [ ] **Step 1: 実装**(構造 + GSAP。タグ帯/緑フラッシュの色は既存 `#28f100` を流用)

```tsx
// components/onboarding/ExtensionSaveReenactment.tsx
'use client'

import { useEffect, useRef, type ReactElement } from 'react'
import { gsap } from 'gsap'
import styles from './ExtensionSaveReenactment.module.css'

type Props = {
  readonly caption: string
  readonly buttonLabel: string
  readonly onAdvance: () => void
}

export function ExtensionSaveReenactment({ caption, buttonLabel, onAdvance }: Props): ReactElement {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const cursor = root.querySelector('[data-anim="cursor"]')
    const flash = root.querySelector('[data-anim="flash"]')
    const strip = root.querySelector('[data-anim="strip"]')
    const chips = root.querySelectorAll('[data-anim="chip"]')
    if (reduce) {
      gsap.set(strip, { y: 0, opacity: 1 }); gsap.set(chips, { opacity: 1 })
      return
    }
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.1 })
    tl.set(strip, { y: -12, opacity: 0 })
      .set(chips, { opacity: 0 })
      .set(flash, { opacity: 0 })
      .to(cursor, { left: '78%', top: '20%', duration: 0.8, ease: 'power2.inOut' })
      .to(cursor, { scale: 0.85, duration: 0.12, yoyo: true, repeat: 1 }) // click
      .to(flash, { opacity: 0.7, duration: 0.12, yoyo: true, repeat: 1 }, '<')
      .to(strip, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' }, '+=0.1')
      .to(chips, { opacity: 1, duration: 0.25, stagger: 0.1 }, '-=0.1')
      .to({}, { duration: 1.0 }) // hold
    return () => { tl.kill() }
  }, [])

  return (
    <div className={styles.stage} data-testid="stage-extDemo">
      <div ref={ref} className={styles.browser}>
        <div className={styles.toolbar}>
          <span className={styles.dot} /><span className={styles.dot} /><span className={styles.dot} />
          <span className={styles.url}>example.com</span>
          <span className={styles.extIcon}>A</span>
          <span data-anim="flash" className={styles.flash} />
        </div>
        <div className={styles.page} />
        <div data-anim="strip" className={styles.strip}>
          <span data-anim="chip" className={styles.chip}>design ✓</span>
          <span data-anim="chip" className={styles.chip}>ref ✓</span>
        </div>
        <span data-anim="cursor" className={styles.cursor} />
      </div>
      <p className={styles.caption}>{caption}</p>
      <button type="button" className={styles.cta} onClick={onAdvance}>{buttonLabel}</button>
    </div>
  )
}
```

```css
/* components/onboarding/ExtensionSaveReenactment.module.css */
.stage {
  position: fixed; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 18px;
  background: rgba(6,6,6,0.96); color: rgba(255,255,255,0.9);
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
}
.browser {
  position: relative; width: min(560px, 86vw); aspect-ratio: 16/10;
  background: rgba(18,18,18,0.96); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 12px; overflow: hidden;
}
.toolbar { position: relative; display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.dot { width: 9px; height: 9px; border-radius: 50%; background: rgba(255,255,255,0.18); }
.url { flex: 1; font-size: 11px; color: rgba(255,255,255,0.5); text-align: center; }
.extIcon { width: 22px; height: 22px; display: grid; place-items: center; border-radius: 6px; background: rgba(40,241,0,0.15); color: #28f100; font-weight: 700; }
.flash { position: absolute; right: 10px; top: 8px; width: 26px; height: 26px; border-radius: 8px; background: #28f100; opacity: 0; }
.page { height: 60%; background: repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0 12px, transparent 12px 24px); }
.strip { position: absolute; left: 50%; top: 44px; transform: translateX(-50%); display: flex; gap: 8px; }
.chip { padding: 6px 12px; border-radius: 999px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); color: #28f100; font-size: 11px; }
.cursor { position: absolute; left: 30%; top: 70%; width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 2px rgba(0,0,0,0.4); }
.caption { max-width: 440px; text-align: center; font-size: 13px; line-height: 1.8; }
.cta { font: inherit; font-size: 12px; letter-spacing: 0.10em; text-transform: uppercase; color: rgba(255,255,255,0.95); background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.22); border-radius: 8px; padding: 10px 22px; cursor: pointer; }
```

- [ ] **Step 2: 隔離レンダで目視**(カーソル移動→緑フラッシュ→タグ帯降下)

`rtk tsc && rtk pnpm build` → serve → Playwright スクショ(複数フレーム)。

- [ ] **Step 3: コミット**

```bash
rtk git add components/onboarding/ExtensionSaveReenactment.tsx components/onboarding/ExtensionSaveReenactment.module.css
rtk git commit -m "feat(onboarding): extension save re-enactment (cursor + green flash + tag strip, GSAP)"
```

---

### Task 12: シーンを Controller に差し込む(ハンズオン振り付け)

**Files:**
- Modify: `components/onboarding/OnboardingController.tsx`(プレースホルダ描画を実シーンに差し替え)
- Modify: `lib/utils/bookmarklet.ts` 周辺は触らない。サンプルURL定数は `lib/onboarding/steps.ts` か controller 内に定義。

**Interfaces:**
- Consumes: `OnboardingStage`(enter/finale)、`ExtensionSaveReenactment`(extDemo)、`OnboardingSpotlight`(paste/tag/motion/install/share)、`BookmarkletInstallModal` の中身(install シーンで設置チップ)。
- `enter`/`finale`/`extDemo` は `OnboardingStage`/`ExtensionSaveReenactment` を全画面で。`handsOn` は `OnboardingSpotlight targetSelector={SELECTOR[scene.target]}`。`paste` シーンの吹き出しに `TRY THIS` ボタン(押すと用意した公開URLを `useUrlPasteSave` 相当の取り込みに流す → `bookmark-saved` で前進)。

- [ ] **Step 1: TRY THIS のサンプル取り込み手段を確認/用意**

`useUrlPasteSave`(paste-to-save、session 113)の取り込み関数を direct 呼び出しできるか確認。できなければ `addBookmark` + `postBookmarkSaved` で同等の保存を行う薄いヘルパー `saveSampleBookmark(db, url)` を controller 内に用意(埋め込み系URLを渡す)。サンプルURL定数:

```ts
const SAMPLE_URL = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' // public, long-lived
```

- [ ] **Step 2: Controller のシーン分岐を実装**

`OnboardingController.tsx` のプレースホルダ部分を置換:

```tsx
const TARGET_SELECTOR: Record<string, string> = {
  'paste-zone': '[data-onboarding-target="paste-zone"]',
  'card-tag': '[data-onboarding-target="card-tag"]',
  'motion': '[data-onboarding-target="motion"]',
  'share': '[data-onboarding-target="share"]',
}

// in render:
if (scene.kind === 'cinema') {
  if (sceneId === 'extDemo') {
    return wrap(<ExtensionSaveReenactment caption={body} buttonLabel="NEXT" onAdvance={advance} />)
  }
  return wrap(
    <OnboardingStage
      variant={sceneId === 'finale' ? 'finale' : 'enter'}
      caption={body}
      buttonLabel={sceneId === 'enter' ? 'START' : 'NEXT'}
      onAdvance={advance}
    />,
  )
}
// handsOn
return wrap(
  <OnboardingSpotlight
    targetSelector={scene.target ? TARGET_SELECTOR[scene.target] : null}
    caption={body}
  >
    {sceneId === 'paste' && (
      <button type="button" className={styles.tryThis} onClick={() => void saveSample()}>
        TRY THIS
      </button>
    )}
    {sceneId === 'install' && <BookmarkletInstallChip />}
    {(scene.advance === 'button') && (
      <button type="button" className={styles.advanceBtn} onClick={advance}>NEXT</button>
    )}
  </OnboardingSpotlight>,
)
```

`wrap` は `SKIP` ボタン込みのルート div。`body = t('board.onboarding.' + sceneId + '.body')`。`BookmarkletInstallChip` は `BookmarkletInstallModal` のドラッグチップ部分を小コンポーネントに切り出して流用(install シーンで設置チップを見せる)。`install` シーンは設置検知不能なので `NEXT` で抜ける(`scene.advance==='button'`)。

- [ ] **Step 3: 拡張導入済み出し分け**

`install` シーンで `document.documentElement.getAttribute('data-booklage-extension')` が真なら設置チップを出さず「拡張は検出済み。ブックマークレットや貼り付けでも保存できます」の文面に切替(`board.onboarding.installDetected.body`)。

- [ ] **Step 4: 通し隔離レンダ + 目視**

serve → Playwright で初回フロー全体を踏破(START → サンプル保存で前進 → タグ → MOTION → extDemo NEXT → install NEXT → SHARE 開いて前進 → finale → 完了)。各シーンのスクショ。**ユーザー実機確認はここで1回まとめて出す**。

Run: `rtk tsc && rtk vitest run && rtk pnpm build`
Expected: tsc 0 / vitest PASS / build OK。

- [ ] **Step 5: コミット**

```bash
rtk git add components/onboarding/ messages/en.json messages/ja.json
rtk git commit -m "feat(onboarding): wire real scenes (cinema + spotlight + sample TRY THIS + install chip)"
```

---

## Phase 3 — i18n / 縮退 / モバイル / 仕上げ

### Task 13: i18n 全15言語

**Files:**
- Modify: `messages/*.json`(全15)。`board.onboarding.*`(各 sceneId の `body` + `installDetected.body` + `share` 等の補助文)+ Task 6 で更新した `board.empty.*`。
- Test: 既存 i18n パリティテストがあれば緑。無ければ簡易キー存在テスト追加。

**Interfaces:** 全15ファイルで `board.onboarding` のキー集合が一致。chrome 語彙(START/SKIP/NEXT/TRY THIS/REPLAY INTRO)はコード側の literal なので翻訳不要。

- [ ] **Step 1: en/ja を確定**(淡々・説明調、§Global Constraints)。
- [ ] **Step 2: 残13言語へ並列翻訳**(サブエージェント or 手作業)。固定語彙・プレースホルダ verbatim。
- [ ] **Step 3: パリティ確認**

```bash
cd "c:/Users/masay/Desktop/マイコラージュ" && node -e "
const ls=['en','ja','ar','de','es','fr','it','ko','nl','pt','ru','th','tr','vi','zh'];
const k=o=>Object.keys(o.board.onboarding).sort().join(',');
const base=k(require('./messages/en.json'));
for(const l of ls){const v=k(require('./messages/'+l+'.json')); if(v!==base) throw new Error('parity '+l)}
console.log('onboarding parity OK')"
```
Expected: `onboarding parity OK`

- [ ] **Step 4: コミット**

```bash
rtk git add messages/
rtk git commit -m "i18n(onboarding): board.onboarding.* across 15 languages"
```

---

### Task 14: reduced-motion + モバイル縮約版

**Files:**
- Modify: `components/onboarding/OnboardingController.tsx`(モバイル判定 → 縮約フロー)
- 各シーン CSS に `@media (prefers-reduced-motion: reduce)`(Task 10/11 で済み、確認のみ)

**Interfaces:** モバイル(`window.matchMedia('(max-width: 768px)')`)では `enter → paste → finale` の3シーンに縮約(extDemo/install/share/motion を飛ばす)。`steps.ts` に `mobileSceneIds: readonly SceneId[]` を追加し、controller がモバイル時はそれを使う。

- [ ] **Step 1: `steps.ts` にモバイル系列追加 + テスト**

```ts
export const MOBILE_SCENE_IDS: readonly SceneId[] = ['enter', 'paste', 'finale'] as const
export function nextSceneIdIn(seq: readonly SceneId[], current: SceneId): SceneId | null {
  const i = seq.indexOf(current); const n = seq[i + 1]; return n ?? null
}
```

テスト(`onboarding-steps.test.ts` に追加):

```ts
it('mobile sequence is enter->paste->finale', () => {
  expect([...MOBILE_SCENE_IDS]).toEqual(['enter','paste','finale'])
  expect(nextSceneIdIn(MOBILE_SCENE_IDS, 'paste')).toBe('finale')
  expect(nextSceneIdIn(MOBILE_SCENE_IDS, 'finale')).toBeNull()
})
```

- [ ] **Step 2: controller がモバイル系列を使う**

`const seq = isMobile ? MOBILE_SCENE_IDS : ONBOARDING_SCENES.map(s=>s.id)`、`advance` は `nextSceneIdIn(seq, sceneId)`。`isMobile` はマウント時 `matchMedia` で1回確定。

- [ ] **Step 3: 検証**

Run: `rtk tsc && rtk vitest run components/onboarding lib/onboarding tests/lib/onboarding-steps.test.ts`
Expected: PASS。

- [ ] **Step 4: 隔離レンダ(モバイル幅 375)で目視** → 3シーンで完結すること。

- [ ] **Step 5: コミット**

```bash
rtk git add lib/onboarding/steps.ts components/onboarding/OnboardingController.tsx tests/lib/onboarding-steps.test.ts
rtk git commit -m "feat(onboarding): reduced-motion fallbacks + mobile 3-scene sequence"
```

---

### Task 15: 通し検証 + 本番反映

**Files:** なし(検証 + deploy)

- [ ] **Step 1: 全ゲート**

```bash
cd "c:/Users/masay/Desktop/マイコラージュ" && rtk tsc && rtk vitest run && rtk pnpm build
```
Expected: tsc 0 / vitest 全 PASS / build OK。

- [ ] **Step 2: 本番ボードで初回フロー実機確認**(ユーザー)

新規プロファイル/`onboarding-completed` 未設定の状態で `allmarks.app/board` → 自動オンボーディング → 全シーン踏破 → 完了後デモカードが消え、貼った1枚＋タグが残ることを確認。SETTINGS の REPLAY INTRO も確認。

- [ ] **Step 3: デプロイ**

```bash
cd "c:/Users/masay/Desktop/マイコラージュ" && npx wrangler whoami && npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true --commit-message="onboarding first-run tutorial"
```

- [ ] **Step 4: ドキュメント更新 + コミット**

`docs/TODO.md`「現在の状態」更新、`docs/CURRENT_GOAL.md` 次セッション化、`docs/TODO_COMPLETED.md` に narrative 追記。

```bash
rtk git add docs/ && rtk git commit -m "docs: onboarding shipped (session 115/116)" && rtk git push
```

---

## Self-Review(計画 vs 仕様)

**1. Spec coverage:**
- §2 8シーン → Task 4(定義)+ 10/11/12(描画)。✓
- §3 デモカード seed/sweep → Task 3 + 6。✓
- §4.1 部品 → Task 2/3/4/5/8/10/11。✓
- §4.2 本物イベント前進 + 属性印 → Task 5 + 9 + 12。✓
- §4.3 サンプルURL → Task 12。✓
- §4.4 z-index → Task 1。✓
- §5 i18n → Task 5(暫定)+ 13(全15)。✓
- §6 エッジ(reduced-motion/モバイル/拡張済み/スキップ/再生) → Task 14 + 12(拡張済み)+ 5(スキップ)+ 6/7(再生)。✓
- §7 スコープ(共有=開くだけ)→ Task 9/12(SHARE は開いたら前進、`SHARE NOW` 押させない)。✓
- §9 EmptyStateWelcome 現行化 → Task 6。✓

**2. Placeholder scan:** プレースホルダ無し。Phase 2 の視覚タスクは「実装コード + 隔離レンダ目視」で、`fill in later` は無い(具体コード提示済み)。

**3. Type consistency:** `seedOnboardingDemo`/`clearOnboardingDemo`/`countOnboardingDemo`、`isOnboardingComplete`/`markOnboardingComplete`/`shouldAutoStartOnboarding`、`sceneById`/`nextSceneId`/`nextSceneIdIn`、`OnboardingScene.advance ∈ {button,saved,tagged,motion,sharePanel}`、`OnboardingTarget ∈ {paste-zone,card-tag,motion,share}` — 全タスクで一貫。`onboardingDemo?: boolean` を Task 1 で追加し 3/6 で使用。

**留意(実装時に確認する既存名)**: BoardRoot の MOTION state 名(`MotionToggle.enabled` に渡す state)、ボード再読込関数名(`reloadBookmarks` 相当)、SHARE モーダル open state 名、`ExtensionEntry` のドロワーアクション CSS クラス名、カードの「+ TAG」要素。これらは Task 6/7/9/12 着手時に grep で確定してから配線する(推測で書かない)。
