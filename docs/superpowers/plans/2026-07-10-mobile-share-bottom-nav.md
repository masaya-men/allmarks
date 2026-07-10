# スマホから SHARE できるようにする（N-49）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スマホ（≤640px）のボトムナビに SHARE を足し、「選ぶ → CREATE → 共有」の3手で共有リンクと 1200×630 の共有画像を作れるようにする。

**Architecture:** スマホには「並べる段」の自由編集を出さない。CREATE を押すと内部で `sharePhase='arrange'` に入り、選択カードを**画面の縦中央にある 1.91:1 の帯**へ `fitSelectionToScreen` で自動配置し、既存の `.outerFrame` をそのまま `fit:'cover'` で撮る。`computeCoverRect` は中央を切るので、切り出し結果は帯と一致する。**新しい背景描画コードはゼロ＝レプリカを作らない**（s169 のユーザー決定）。鮮明さは `dom-to-image` の `scale`（`= 1200 / 画面幅`）で確保する。

**Tech Stack:** Next.js 14 App Router / TypeScript strict / Vanilla CSS Modules / vitest + @testing-library/react / Playwright / dom-to-image-more

**正本 spec:** [docs/superpowers/specs/2026-07-10-mobile-share-bottom-nav-design.md](../specs/2026-07-10-mobile-share-bottom-nav-design.md)

## Global Constraints

- TypeScript `strict: true`。`any` 禁止（`unknown` + 型ガード）。return type は常に明示
- Tailwind 禁止・Framer Motion 禁止。CSS は `.module.css` のみ
- `console.log` を本番コードに残さない
- z-index の魔法の数値禁止。`BOARD_Z_INDEX`（`lib/board/constants.ts`）を使う
- UI の文字は**世界中に通じる英語**（`SHARE` / `SELECT ALL` / `CREATE` / `COPY LINK` / `DONE` / `RETRY`）。日本語化しない。i18n キーは足さない（既存の board chrome も英語リテラル。例: `MotionToggle.tsx:21` の `label="MOTION"`）
- 押せるものは **52px 以上**（Apple HIG 44pt 超え。`ReceiverImportBar.module.css:24` と同値）
- **デスクトップ（>640px）の描画は 1px も変えない。** 全ての新 UI は `useIsMobile()` ゲートの内側
- 共有は絶対に壊さない。撮影が失敗（`captureCollageShareImage` が `null`）しても `thumb` 無しでリンクは作る
- git コマンドは `rtk` を前置する。`--no-verify` は**絶対禁止**
- カード上限は `SHARE_LIMITS_V2.MAX_CARDS` = **100**（`lib/share/types-v2.ts:116`）
- ブランド緑 = `#28F100`

---

### Task 1: 帯の矩形と撮影倍率（純関数）

**Files:**
- Create: `lib/share/mobile-band.ts`
- Test: `lib/share/mobile-band.test.ts`

**Interfaces:**
- Consumes: `CollageFitRect`（`lib/share/collage-layout.ts:79-84`）
- Produces:
  - `SHARE_OG_ASPECT: { readonly WIDTH: 1200; readonly HEIGHT: 630 }`
  - `mobileCollageBandRect(frameW: number, frameH: number): CollageFitRect`
  - `mobileCaptureScale(frameW: number): number`

- [ ] **Step 1: Write the failing test**

`lib/share/mobile-band.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { SHARE_OG_ASPECT, mobileCollageBandRect, mobileCaptureScale } from './mobile-band'

describe('mobileCollageBandRect', () => {
  it('centres a 1.91:1 band inside a 390x844 phone frame', () => {
    const r = mobileCollageBandRect(390, 844)
    expect(r).toEqual({ x: 0, y: 319.625, width: 390, height: 204.75 })
  })

  it('matches what computeCoverRect will crop (band height = width * 630/1200)', () => {
    const r = mobileCollageBandRect(360, 640)
    expect(r.height).toBeCloseTo(189, 6)
    expect(r.y).toBeCloseTo(225.5, 6)
    expect(r.width).toBe(360)
    expect(r.x).toBe(0)
  })

  it('clamps to the frame when the band would be taller than it (landscape)', () => {
    const r = mobileCollageBandRect(844, 390)
    // 844 * 0.525 = 443.1 > 390 → clamp to the frame, no vertical offset
    expect(r.height).toBe(390)
    expect(r.y).toBe(0)
    expect(r.width).toBe(844)
  })

  it('returns an empty rect for degenerate frames', () => {
    expect(mobileCollageBandRect(0, 844)).toEqual({ x: 0, y: 0, width: 0, height: 0 })
    expect(mobileCollageBandRect(390, 0)).toEqual({ x: 0, y: 0, width: 0, height: 0 })
    expect(mobileCollageBandRect(-10, -10)).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })
})

describe('mobileCaptureScale', () => {
  it('makes the band exactly 1200 raster px wide on a phone', () => {
    expect(mobileCaptureScale(390)).toBeCloseTo(3.0769230769, 6)
    expect(390 * mobileCaptureScale(390)).toBeCloseTo(SHARE_OG_ASPECT.WIDTH, 6)
  })

  it('never downscales a frame already wider than the OG image', () => {
    expect(mobileCaptureScale(1489)).toBe(1)
    expect(mobileCaptureScale(1200)).toBe(1)
  })

  it('caps at 4 so a freak narrow frame cannot explode the canvas', () => {
    expect(mobileCaptureScale(300)).toBe(4)
    expect(mobileCaptureScale(100)).toBe(4)
  })

  it('falls back to 1 for a degenerate width', () => {
    expect(mobileCaptureScale(0)).toBe(1)
    expect(mobileCaptureScale(-5)).toBe(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
rtk npx vitest run lib/share/mobile-band.test.ts
```

Expected: FAIL — `Failed to resolve import "./mobile-band"`.

- [ ] **Step 3: Write the implementation**

`lib/share/mobile-band.ts`:

```ts
// lib/share/mobile-band.ts
// スマホの SHARE は「並べる段」を出さない代わりに、選んだカードを画面の縦中央にある
// 1.91:1 の帯へ自動配置し、.outerFrame をまるごと fit:'cover' で撮る。
// normalize-shot.ts の computeCoverRect は中央を切るので、帯が中央にある限り
// 切り出し結果は帯とぴったり一致する（= 黒帯もはみ出しも出ない）。
//
// レプリカ（画面外に組んだ 1200×630 の舞台）を作らないのが肝。背景を作り直すと
// 盤面と共有リンクが食い違う（N-54 型のバグ）を1つ増やすことになる。

import type { CollageFitRect } from './collage-layout'

/** 共有 OG 画像の寸法（X の summary_large_image が期待する 1.91:1）。 */
export const SHARE_OG_ASPECT = { WIDTH: 1200, HEIGHT: 630 } as const

/** 帯の高さ / 帯の幅 = 0.525。 */
const BAND_RATIO = SHARE_OG_ASPECT.HEIGHT / SHARE_OG_ASPECT.WIDTH

/** 撮影倍率の下限（原寸より縮めない）と上限（canvas 爆発の予防）。 */
const MIN_SCALE = 1
const MAX_SCALE = 4

const EMPTY_RECT: CollageFitRect = { x: 0, y: 0, width: 0, height: 0 }

/**
 * スマホの自動配置矩形 ＝ `.outerFrame` の縦中央にある 1.91:1 の帯。
 * 座標系は `.outerFrame`（= CollageCanvas の `.root` が `inset:0` で張る空間）。
 * スマホは `--canvas-margin: 0` なので、これは画面座標と一致する。
 */
export function mobileCollageBandRect(frameW: number, frameH: number): CollageFitRect {
  if (frameW <= 0 || frameH <= 0) return EMPTY_RECT
  const height = Math.min(frameW * BAND_RATIO, frameH)
  return { x: 0, y: (frameH - height) / 2, width: frameW, height }
}

/**
 * 帯の幅がちょうど 1200 raster px になる dom-to-image の `scale`。
 * これを渡さないと 390px 幅の raster を 3.08 倍に引き伸ばすことになり、必ずぼやける。
 */
export function mobileCaptureScale(frameW: number): number {
  if (frameW <= 0) return MIN_SCALE
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, SHARE_OG_ASPECT.WIDTH / frameW))
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
rtk npx vitest run lib/share/mobile-band.test.ts
```

Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
rtk git add lib/share/mobile-band.ts lib/share/mobile-band.test.ts
rtk git commit -m "feat(share): band rect + capture scale for the mobile collage (N-49)"
```

---

### Task 2: 撮影倍率を dom-to-image まで通す

**Files:**
- Modify: `lib/share/render-share-image.ts`
- Modify: `lib/share/capture-collage.ts`
- Test: `lib/share/render-share-image.scale.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `RenderShareImageOpts` に `readonly scale?: number`
  - `CaptureCollageOpts` に `readonly scale?: number`
  - どちらも**未指定なら今までと完全に同じ**（`scale` キーを `toJpeg` に渡さない）

> **なぜこれが要るか:** `dom-to-image-more` は `canvas.width = width * scale` / `ctx.scale(scale, scale)` する（`node_modules/dom-to-image-more/src/dom-to-image-more.js:316, 328-330`）。既定は 1。SVG はベクタなので拡大時に再ラスタライズされ、内部の `<img>` は元バイトの解像度で焼ける。doc comment も "to reduce fuzzy images"（同 `:83`）。

- [ ] **Step 1: Write the failing test**

`lib/share/render-share-image.scale.test.ts`:

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest'

const { toJpeg } = vi.hoisted(() => ({ toJpeg: vi.fn() }))
vi.mock('dom-to-image-more', () => ({ default: { toJpeg } }))

import { renderShareImage } from './render-share-image'

const TINY_JPEG = 'data:image/jpeg;base64,AAAA'

describe('renderShareImage — scale passthrough', () => {
  beforeEach(() => {
    toJpeg.mockReset()
    toJpeg.mockResolvedValue(TINY_JPEG)
  })

  it('forwards scale to dom-to-image when provided', async () => {
    const node = document.createElement('div')
    await renderShareImage(node, {
      width: 390, height: 844, targetBytes: 8 * 1024 * 1024,
      startQuality: 0.94, minQuality: 0.94, scale: 3.0769,
    })
    expect(toJpeg).toHaveBeenCalledOnce()
    const opts = toJpeg.mock.calls[0]?.[1] as Record<string, unknown>
    expect(opts.scale).toBe(3.0769)
    expect(opts.width).toBe(390)
    expect(opts.height).toBe(844)
  })

  it('omits scale entirely when not provided (desktop path unchanged)', async () => {
    const node = document.createElement('div')
    await renderShareImage(node, {
      width: 1489, height: 679, targetBytes: 8 * 1024 * 1024,
      startQuality: 0.94, minQuality: 0.94,
    })
    const opts = toJpeg.mock.calls[0]?.[1] as Record<string, unknown>
    expect('scale' in opts).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
rtk npx vitest run lib/share/render-share-image.scale.test.ts
```

Expected: FAIL — `expect(opts.scale).toBe(3.0769)` → `undefined`（`scale` は `RenderShareImageOpts` に無いので tsc も赤）。

- [ ] **Step 3: Write the implementation**

`lib/share/render-share-image.ts` の `RenderShareImageOpts` に追記（`rewriteImageSrc` の直後）:

```ts
  /** dom-to-image の出力 canvas 倍率（`canvas.width = width * scale`）。省略時は 1
   *  ＝ライブラリ既定。スマホは `1200 / 画面幅` を渡し、切り出す帯が原寸 1200px の
   *  raster になるようにする（渡さないと引き伸ばしでぼやける）。 */
  readonly scale?: number
```

同ファイルの `baseOpts` 組み立てに 1 行足す（`if (opts.bgColor) …` の直後）:

```ts
    if (typeof opts.scale === 'number') baseOpts.scale = opts.scale
```

`lib/share/capture-collage.ts` の `CaptureCollageOpts` に追記（`fit` の直後）:

```ts
  /** 撮影 canvas の倍率。スマホは `mobileCaptureScale(画面幅)` を渡す。省略時は 1。 */
  readonly scale?: number
```

同ファイルの `renderShareImage(node, { … })` 呼び出しに 1 行足す（`rewriteImageSrc` の直後）:

```ts
      ...(typeof opts.scale === 'number' ? { scale: opts.scale } : {}),
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
rtk npx vitest run lib/share/render-share-image.scale.test.ts lib/share/
```

Expected: PASS — 新規 2 件、既存の share テストは全緑のまま。

- [ ] **Step 5: Commit**

```bash
rtk git add lib/share/render-share-image.ts lib/share/capture-collage.ts lib/share/render-share-image.scale.test.ts
rtk git commit -m "feat(share): let the capture pick its own raster scale (N-49)"
```

---

### Task 3: ボトムナビに SHARE を足し、MOTION を外す

**Files:**
- Modify: `components/board/BoardMobileNav.tsx`
- Test: `components/board/BoardMobileNav.test.tsx`（新規）

**Interfaces:**
- Consumes: なし
- Produces: `BoardMobileNavProps` から `motionOn` / `onToggleMotion` が**消え**、`onShare: () => void` が**増える**。タブ順は `TAG / THEME / SHARE / CORNERS / MORE`。testid は `mobile-nav-share`

> SHARE タブに `data-active` は付けない。共有中はナビ自体が引っ込むので点く瞬間が無い（spec §2.2）。

- [ ] **Step 1: Write the failing test**

`components/board/BoardMobileNav.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { BoardMobileNav } from './BoardMobileNav'

const noop = (): void => {}
const baseProps = {
  onTag: noop, tagActive: false,
  onThemes: noop, themesActive: false,
  onShare: noop,
  cornersRounded: true, onToggleCorners: noop,
  onSettings: noop, settingsActive: false,
}

describe('BoardMobileNav', () => {
  it('shows five tabs in the order TAG / THEME / SHARE / CORNERS / MORE', () => {
    render(<BoardMobileNav {...baseProps} />)
    const labels = screen.getAllByRole('button').map((b) => b.textContent)
    expect(labels).toEqual(['TAG', 'THEME', 'SHARE', 'CORNERS', 'MORE'])
  })

  it('no longer hosts MOTION (it moved into the MORE panel)', () => {
    render(<BoardMobileNav {...baseProps} />)
    expect(screen.queryByTestId('mobile-nav-motion')).toBeNull()
  })

  it('fires onShare when SHARE is tapped', () => {
    const onShare = vi.fn()
    render(<BoardMobileNav {...baseProps} onShare={onShare} />)
    fireEvent.click(screen.getByTestId('mobile-nav-share'))
    expect(onShare).toHaveBeenCalledOnce()
  })

  it('does not mark SHARE active (the nav hides during share mode)', () => {
    render(<BoardMobileNav {...baseProps} />)
    expect(screen.getByTestId('mobile-nav-share').getAttribute('data-active')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
rtk npx vitest run components/board/BoardMobileNav.test.tsx
```

Expected: FAIL — `onShare` は型に無く、`mobile-nav-share` も存在しない。

- [ ] **Step 3: Write the implementation**

`components/board/BoardMobileNav.tsx`:

1. doc comment を更新: `Hosts TAG / THEME / SHARE / CORNERS / MORE.`
2. `BoardMobileNavProps` から `motionOn` / `onToggleMotion` を削除し、`onThemes`/`themesActive` の直後に追加:

```ts
  /** Enter SHARE select mode (BoardRoot's handleEnterSelectMode). No active
   *  state: the nav unmounts while a share stage is running. */
  readonly onShare: () => void
```

3. `MotionIcon` を削除し、代わりに `ShareIcon` を追加（`ThemeIcon` の直後）:

```tsx
/** SHARE = the universal export glyph (a tray with an arrow leaving it). Same
 *  22px / 1.6-stroke line language as the other tabs; no filled SaaS icon. */
function ShareIcon({ className }: IconProps): ReactElement {
  return (
    <svg className={className} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 14V3.5" />
      <path d="M7.5 7L11 3.5 14.5 7" />
      <path d="M5 11.5v6a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5v-6" />
    </svg>
  )
}
```

4. 関数シグネチャの分割代入から `motionOn` / `onToggleMotion` を外し `onShare` を足す。
5. MOTION の `<button>` ブロックを丸ごと削除し、THEME と CORNERS の**間**に:

```tsx
      <button
        type="button"
        className={styles.tab}
        onClick={onShare}
        data-testid="mobile-nav-share"
      >
        <ShareIcon className={styles.icon} />
        <span className={styles.tabLabel}>SHARE</span>
      </button>
```

CSS は変更不要（`.tab` は `flex: 1 1 0` なので 5 枠のまま等分される）。

- [ ] **Step 4: Run the test to verify it passes**

```bash
rtk npx vitest run components/board/BoardMobileNav.test.tsx
```

Expected: PASS — 4 tests。（この時点で `BoardRoot.tsx` は `motionOn` を渡していて tsc が赤い。Task 8 で解消する。**この Task は vitest のみで判定する。**）

- [ ] **Step 5: Commit**

```bash
rtk git add components/board/BoardMobileNav.tsx components/board/BoardMobileNav.test.tsx
rtk git commit -m "feat(board): put SHARE in the mobile bottom nav, move MOTION out (N-49)"
```

---

### Task 4: MOTION を MORE パネルへ降ろす

**Files:**
- Modify: `components/board/ExtensionEntry.tsx`
- Test: `components/board/ExtensionEntry.motion.test.tsx`（新規）

**Interfaces:**
- Consumes: なし
- Produces: `ExtensionEntryProps` に `readonly motion?: { readonly enabled: boolean; readonly onToggle: () => void }`。**渡された時だけ** VIEW セクションを描く（BoardRoot は `isMobile` の時だけ渡す＝デスクトップの SETTINGS ドロワーは 1 行も増えない）

> 既存の `.group` / `.groupLabel` / `.toggleRow` / `.toggleLabel` / `.toggle`（`ExtensionEntry.module.css`）を再利用する。**新しい CSS は書かない。**
> ラベルは i18n キーではなく英語リテラル `MOTION`（`MotionToggle.tsx:21` と同じ語）。
>
> **モバイルで本当に開くか（確認済）:** `ExtensionEntry` のトリガーは `TopHeader` の内側で、`TopHeader.module.css:65` は 640px 以下で `display:none`。しかしドロワー本体の `ChromeDrawer` は `createPortal(…, document.body)` する（`ChromeDrawer.tsx:68-88`）ので、トリガーが不可視でもパネルは body に出る。MORE はスマホで機能する。

- [ ] **Step 1: Write the failing test**

`components/board/ExtensionEntry.motion.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ExtensionEntry } from './ExtensionEntry'

const noop = (): void => {}
const baseProps = {
  quickTagEnabled: false, onQuickTagToggle: noop,
  onOpenBookmarkletModal: noop,
  isOpen: true, onOpenChange: noop,
  themeId: 'grid-paper' as const, // ThemeId = 'dotted-notebook' | 'grid-paper' | 'paper-atelier'
  onOpenThemeModal: noop,
  customWidthCount: 0, onResetCardSizes: noop, onSortNewestFirst: noop,
}

describe('ExtensionEntry — MOTION row', () => {
  it('is absent when no motion prop is passed (desktop)', () => {
    render(<ExtensionEntry {...baseProps} />)
    expect(screen.queryByTestId('settings-motion-toggle')).toBeNull()
  })

  it('renders a MOTION toggle reflecting the current state when passed (mobile)', () => {
    render(<ExtensionEntry {...baseProps} motion={{ enabled: true, onToggle: noop }} />)
    const box = screen.getByTestId('settings-motion-toggle') as HTMLInputElement
    expect(box.checked).toBe(true)
  })

  it('fires onToggle when tapped', () => {
    const onToggle = vi.fn()
    render(<ExtensionEntry {...baseProps} motion={{ enabled: false, onToggle }} />)
    fireEvent.click(screen.getByTestId('settings-motion-toggle'))
    expect(onToggle).toHaveBeenCalledOnce()
  })
})
```

> `themeId: 'wave'` が実在するか不安なら `getThemeMeta` の既定テーマ ID を `lib/board/` から確認して置き換える。テーマ名は本 Task の主題ではない。

- [ ] **Step 2: Run the test to verify it fails**

```bash
rtk npx vitest run components/board/ExtensionEntry.motion.test.tsx
```

Expected: FAIL — `motion` は `ExtensionEntryProps` に存在しない。

- [ ] **Step 3: Write the implementation**

`components/board/ExtensionEntry.tsx`:

1. `ExtensionEntryProps` の末尾に追加:

```ts
  /** Mobile only: MOTION lives here because the bottom nav gave its slot to
   *  SHARE (N-49). BoardRoot passes this only when `useIsMobile()` is true, so
   *  the desktop drawer — which already has MOTION in the top chrome — is
   *  byte-identical. */
  readonly motion?: { readonly enabled: boolean; readonly onToggle: () => void }
```

2. 分割代入に `motion,` を足す。
3. SAVING セクション（`<section className={styles.group}>` … `</section>`、`ExtensionEntry.tsx:192-214`）の**直後**に:

```tsx
        {/* ── VIEW ──────────────────────────────────────────────────────────
            Mobile only. MOTION used to be a bottom-nav tab; SHARE took that
            slot (N-49). It is a set-once display preference, so a drawer row
            is the right home. Desktop keeps its top-chrome MotionToggle and
            never renders this section (BoardRoot passes no `motion` prop). */}
        {motion && (
          <section className={styles.group}>
            <div className={styles.groupLabel}>VIEW</div>
            <label className={styles.toggleRow}>
              <span className={styles.toggleLabel}>MOTION</span>
              <input
                type="checkbox"
                className={styles.toggle}
                checked={motion.enabled}
                onChange={(): void => motion.onToggle()}
                data-testid="settings-motion-toggle"
              />
            </label>
          </section>
        )}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
rtk npx vitest run components/board/ExtensionEntry.motion.test.tsx
```

Expected: PASS — 3 tests。

- [ ] **Step 5: Commit**

```bash
rtk git add components/board/ExtensionEntry.tsx components/board/ExtensionEntry.motion.test.tsx
rtk git commit -m "feat(board): host MOTION in the MORE panel on mobile (N-49)"
```

---

### Task 5: スマホの選択バー

**Files:**
- Create: `components/board/MobileShareSelectBar.tsx`
- Create: `components/board/MobileShareSelectBar.module.css`
- Test: `components/board/MobileShareSelectBar.test.tsx`

**Interfaces:**
- Consumes: `BOARD_Z_INDEX.SHARE_SELECT_BAR`、`SHARE_LIMITS_V2.MAX_CARDS`
- Produces: `MobileShareSelectBar({ count, onSelectAll, onCreate, onCancel })`。testid: `mobile-share-select-bar` / `mobile-select-counter` / `mobile-select-all` / `mobile-select-cancel` / `mobile-select-create`

> 390px 幅に 52px のボタン3つは窮屈なので **2段**。1段目に「n / 100 SELECTED」と `SELECT ALL`、2段目に `CANCEL`(flex 1) と `CREATE (n)`(flex 2)。素材は `ReceiverImportBar.module.css` と同じ。

- [ ] **Step 1: Write the failing test**

`components/board/MobileShareSelectBar.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MobileShareSelectBar } from './MobileShareSelectBar'

const noop = (): void => {}
const baseProps = { count: 0, onSelectAll: noop, onCreate: noop, onCancel: noop }

describe('MobileShareSelectBar', () => {
  it('shows the counter against the shared 100-card cap', () => {
    render(<MobileShareSelectBar {...baseProps} count={7} />)
    expect(screen.getByTestId('mobile-select-counter').textContent).toBe('7 / 100 SELECTED')
  })

  it('disables CREATE at zero and labels it with the count', () => {
    const { rerender } = render(<MobileShareSelectBar {...baseProps} count={0} />)
    expect((screen.getByTestId('mobile-select-create') as HTMLButtonElement).disabled).toBe(true)
    rerender(<MobileShareSelectBar {...baseProps} count={3} />)
    const btn = screen.getByTestId('mobile-select-create') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    expect(btn.textContent).toBe('CREATE (3)')
  })

  it('fires each callback', () => {
    const onSelectAll = vi.fn(); const onCreate = vi.fn(); const onCancel = vi.fn()
    render(<MobileShareSelectBar count={2} onSelectAll={onSelectAll} onCreate={onCreate} onCancel={onCancel} />)
    fireEvent.click(screen.getByTestId('mobile-select-all'))
    fireEvent.click(screen.getByTestId('mobile-select-create'))
    fireEvent.click(screen.getByTestId('mobile-select-cancel'))
    expect(onSelectAll).toHaveBeenCalledOnce()
    expect(onCreate).toHaveBeenCalledOnce()
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('keeps itself out of the share capture', () => {
    render(<MobileShareSelectBar {...baseProps} />)
    expect(screen.getByTestId('mobile-share-select-bar').hasAttribute('data-no-capture')).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
rtk npx vitest run components/board/MobileShareSelectBar.test.tsx
```

Expected: FAIL — `Failed to resolve import "./MobileShareSelectBar"`.

- [ ] **Step 3: Write the implementation**

`components/board/MobileShareSelectBar.tsx`:

```tsx
'use client'

import type { ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import { SHARE_LIMITS_V2 } from '@/lib/share/types-v2'
import styles from './MobileShareSelectBar.module.css'

type Props = {
  /** Currently selected card count. */
  readonly count: number
  /** Add every visible (filtered) card up to the cap, board order. */
  readonly onSelectAll: () => void
  /** Auto-arrange into the capture band, shoot it, mint the hosted /s link. */
  readonly onCreate: () => void
  /** Leave selection mode and discard the selection. */
  readonly onCancel: () => void
}

/** SHARE stage 1 on phones (≤640px). Two rows, because 390px cannot hold three
 *  52px buttons side by side. Same chrome material as BoardMobileNav /
 *  ReceiverImportBar so the board's touch surfaces read as one system. Phones
 *  never see the arrange stage, so CREATE — not ARRANGE — is the primary. */
export function MobileShareSelectBar({ count, onSelectAll, onCreate, onCancel }: Props): ReactElement {
  return (
    <div
      className={styles.bar}
      style={{ zIndex: BOARD_Z_INDEX.SHARE_SELECT_BAR }}
      role="toolbar"
      aria-label="Select cards to share"
      data-testid="mobile-share-select-bar"
      data-no-capture
    >
      <div className={styles.meta}>
        <span className={styles.counter} data-testid="mobile-select-counter">
          {count} / {SHARE_LIMITS_V2.MAX_CARDS} SELECTED
        </span>
        <button type="button" className={styles.textBtn} onClick={onSelectAll} data-testid="mobile-select-all">
          SELECT ALL
        </button>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={onCancel} data-testid="mobile-select-cancel">
          CANCEL
        </button>
        <button
          type="button"
          className={styles.primary}
          onClick={onCreate}
          disabled={count === 0}
          data-testid="mobile-select-create"
        >
          CREATE ({count})
        </button>
      </div>
    </div>
  )
}
```

`components/board/MobileShareSelectBar.module.css`:

```css
/* SHARE stage 1 on phones. Same material as BoardMobileNav / ReceiverImportBar:
   dark neutral glass, hairline top edge, safe-area padding, monospace pinned so
   a theme's serif override (paper-atelier) cannot leak in. */
.bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px));
  background: rgba(9, 9, 11, 0.9);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px) saturate(1.1);
  -webkit-backdrop-filter: blur(20px) saturate(1.1);
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
}

.meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.counter {
  font-size: 11px;
  letter-spacing: 0.12em;
  color: rgba(255, 255, 255, 0.62);
  white-space: nowrap;
}

/* SELECT ALL is a quiet text action, not a third slab. 32px tall is fine for a
   secondary target sitting above two 52px primaries. */
.textBtn {
  min-height: 32px;
  padding: 0 8px;
  font: inherit;
  font-size: 11px;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.78);
  background: none;
  border: 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.actions {
  display: flex;
  gap: 10px;
}

/* 52px clears Apple's 44pt minimum with room for the press spring. */
.secondary,
.primary {
  min-height: 52px;
  font: inherit;
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-radius: 6px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 120ms ease, opacity 200ms ease;
}

.secondary {
  flex: 1;
  color: rgba(255, 255, 255, 0.78);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.primary {
  flex: 2;
  color: #28f100;
  background: rgba(40, 241, 0, 0.12);
  border: 1px solid rgba(40, 241, 0, 0.4);
}

.primary:disabled {
  opacity: 0.38;
  cursor: default;
}

.secondary:active,
.primary:active:not(:disabled) {
  transform: scale(0.985);
}

@media (prefers-reduced-motion: reduce) {
  .secondary,
  .primary {
    transition: none;
  }

  .secondary:active,
  .primary:active:not(:disabled) {
    transform: none;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
rtk npx vitest run components/board/MobileShareSelectBar.test.tsx
```

Expected: PASS — 4 tests。

- [ ] **Step 5: Commit**

```bash
rtk git add components/board/MobileShareSelectBar.tsx components/board/MobileShareSelectBar.module.css components/board/MobileShareSelectBar.test.tsx
rtk git commit -m "feat(board): mobile SHARE select bar (N-49)"
```

---

### Task 6: 出来上がりシート（プレビュー＋ネイティブ共有）

**Files:**
- Create: `components/board/MobileShareResult.tsx`
- Create: `components/board/MobileShareResult.module.css`
- Test: `components/board/MobileShareResult.test.tsx`

**Interfaces:**
- Consumes: `dataUrlToFile` / `canWebShareFiles`（`lib/share/share-actions.ts`）、`ShareCreateState`（`components/board/ShareToast.tsx` の既存 export）、`BOARD_Z_INDEX.SHARE_TOAST`
- Produces:

```ts
export type MobileShareResultProps = {
  readonly imageUrl: string | null
  readonly shareUrl: string | null
  readonly createState: ShareCreateState
  readonly onCopyLink: () => Promise<boolean>
  readonly onRetry: () => void
  readonly onDone: () => void
}
```

分岐（spec §4.4）:

| 条件 | 出すもの |
|---|---|
| `createState === 'error'` | プレビュー無し・`RETRY` / `DONE` |
| `navigator.share` あり ＆ 画像あり ＆ `canWebShareFiles` 真 | `SHARE`（`{files,url}`）/ `COPY LINK` / `DONE` |
| `navigator.share` あり ＆ files 不可 | `SHARE`（`{url}` のみ）/ `COPY LINK` / `DONE` |
| `navigator.share` 無し | `COPY LINK` / `DONE` |
| `imageUrl === null` | プレビュー `<img>` を描かない |

`navigator.share()` が投げた場合（`AbortError` ＝ ユーザーがシートを閉じた、を含む）は**何も表示しない**。

- [ ] **Step 1: Write the failing test**

`components/board/MobileShareResult.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MobileShareResult } from './MobileShareResult'

const IMG = 'data:image/jpeg;base64,AAAA'
const URL_ = 'https://allmarks.app/s/abc123'
const baseProps = {
  imageUrl: IMG,
  shareUrl: URL_,
  createState: 'idle' as const,
  onCopyLink: async (): Promise<boolean> => true,
  onRetry: (): void => {},
  onDone: (): void => {},
}

/** jsdom has neither navigator.share nor navigator.canShare. */
function stubNavigator(share: unknown, canShare?: unknown): void {
  if (share === undefined) Reflect.deleteProperty(navigator, 'share')
  else Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true })
  if (canShare === undefined) Reflect.deleteProperty(navigator, 'canShare')
  else Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true, writable: true })
}

afterEach(() => stubNavigator(undefined, undefined))

describe('MobileShareResult', () => {
  it('shares the image file and the link when the platform accepts files', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    stubNavigator(share, () => true)
    render(<MobileShareResult {...baseProps} />)
    fireEvent.click(screen.getByTestId('mobile-share-native'))
    await waitFor(() => expect(share).toHaveBeenCalledOnce())
    const arg = share.mock.calls[0]?.[0] as { files?: File[]; url?: string }
    expect(arg.files?.[0]?.type).toBe('image/jpeg')
    expect(arg.url).toBe(URL_)
  })

  it('falls back to a link-only share when files are refused', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    stubNavigator(share, () => false)
    render(<MobileShareResult {...baseProps} />)
    fireEvent.click(screen.getByTestId('mobile-share-native'))
    await waitFor(() => expect(share).toHaveBeenCalledOnce())
    expect(share.mock.calls[0]?.[0]).toEqual({ url: URL_ })
  })

  it('hides SHARE entirely when the platform has no Web Share', () => {
    stubNavigator(undefined, undefined)
    render(<MobileShareResult {...baseProps} />)
    expect(screen.queryByTestId('mobile-share-native')).toBeNull()
    expect(screen.getByTestId('mobile-share-copy')).toBeTruthy()
  })

  it('swallows an aborted share (user closed the OS sheet)', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'))
    stubNavigator(share, () => true)
    render(<MobileShareResult {...baseProps} />)
    fireEvent.click(screen.getByTestId('mobile-share-native'))
    await waitFor(() => expect(share).toHaveBeenCalledOnce())
    expect(screen.queryByTestId('mobile-share-error')).toBeNull()
  })

  it('drops the preview when the capture failed, but keeps sharing alive', () => {
    stubNavigator(vi.fn(), () => true)
    render(<MobileShareResult {...baseProps} imageUrl={null} />)
    expect(screen.queryByTestId('mobile-share-preview')).toBeNull()
    expect(screen.getByTestId('mobile-share-native')).toBeTruthy()
    expect(screen.getByTestId('mobile-share-copy')).toBeTruthy()
  })

  it('offers RETRY and no preview when the link could not be created', () => {
    stubNavigator(vi.fn(), () => true)
    const onRetry = vi.fn()
    render(<MobileShareResult {...baseProps} createState="error" shareUrl={null} onRetry={onRetry} />)
    expect(screen.queryByTestId('mobile-share-preview')).toBeNull()
    expect(screen.queryByTestId('mobile-share-native')).toBeNull()
    fireEvent.click(screen.getByTestId('mobile-share-retry'))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('confirms a copy', async () => {
    stubNavigator(undefined, undefined)
    render(<MobileShareResult {...baseProps} />)
    fireEvent.click(screen.getByTestId('mobile-share-copy'))
    await waitFor(() => expect(screen.getByTestId('mobile-share-copy').textContent).toBe('LINK COPIED'))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
rtk npx vitest run components/board/MobileShareResult.test.tsx
```

Expected: FAIL — `Failed to resolve import "./MobileShareResult"`.

- [ ] **Step 3: Write the implementation**

`components/board/MobileShareResult.tsx`:

```tsx
'use client'

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import { canWebShareFiles, dataUrlToFile } from '@/lib/share/share-actions'
import type { ShareCreateState } from './ShareToast'
import styles from './MobileShareResult.module.css'

const FILENAME = 'allmarks-collage.jpg'

export type MobileShareResultProps = {
  /** The captured 1200×630 JPEG data-URL, or null when the capture failed. */
  readonly imageUrl: string | null
  /** The hosted /s link, or null while the create is still failing. */
  readonly shareUrl: string | null
  /** 'error' switches the sheet to RETRY / DONE. */
  readonly createState: ShareCreateState
  /** Copy the /s link. Resolves true on success. */
  readonly onCopyLink: () => Promise<boolean>
  /** Re-run capture + create after a failure. */
  readonly onRetry: () => void
  /** Leave SHARE mode entirely. */
  readonly onDone: () => void
}

type CopyState = 'idle' | 'copied' | 'error'

/** True when this browser exposes Web Share at all. Read at render (not module
 *  scope) so a test can install it after import. */
function hasWebShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

/** SHARE stage 2 on phones: no arrange, no free placement — just the picture we
 *  are about to publish, and the one tap that publishes it. Web Share hands the
 *  OS sheet both the image file and the link, so X / Instagram / LINE all appear
 *  without us building a button for each. Platforms that refuse files still get
 *  the link; platforms without Web Share fall back to COPY LINK. */
export function MobileShareResult(props: MobileShareResultProps): ReactElement {
  const { imageUrl, shareUrl, createState, onCopyLink, onRetry, onDone } = props

  const [copyState, setCopyState] = useState<CopyState>('idle')
  const timerRef = useRef<number | null>(null)
  useEffect((): (() => void) => (): void => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
  }, [])

  const handleCopy = useCallback(async (): Promise<void> => {
    const ok = await onCopyLink()
    setCopyState(ok ? 'copied' : 'error')
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout((): void => setCopyState('idle'), 1600)
  }, [onCopyLink])

  const handleNativeShare = useCallback(async (): Promise<void> => {
    if (!shareUrl || !hasWebShare()) return
    const file = imageUrl ? dataUrlToFile(imageUrl, FILENAME) : null
    try {
      if (file && canWebShareFiles(navigator, file)) {
        await navigator.share({ files: [file], url: shareUrl })
      } else {
        await navigator.share({ url: shareUrl })
      }
    } catch {
      // AbortError (the user dismissed the OS sheet) and every other failure are
      // silent: the link is already made and COPY LINK is right there.
    }
  }, [imageUrl, shareUrl])

  const failed = createState === 'error'

  return (
    <div
      className={styles.sheet}
      style={{ zIndex: BOARD_Z_INDEX.SHARE_TOAST }}
      role="dialog"
      aria-label="Your collage link"
      data-testid="mobile-share-result"
    >
      {failed ? (
        <>
          <span className={styles.error} data-testid="mobile-share-error">COULDN&apos;T CREATE THE LINK</span>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={onRetry} data-testid="mobile-share-retry">RETRY</button>
            <button type="button" className={styles.ghost} onClick={onDone} data-testid="mobile-share-done">DONE</button>
          </div>
        </>
      ) : (
        <>
          {imageUrl && (
            /* eslint-disable-next-line @next/next/no-img-element -- a data-URL, not a remote asset */
            <img className={styles.preview} src={imageUrl} alt="Your collage" data-testid="mobile-share-preview" />
          )}
          <span className={styles.status} data-testid="mobile-share-ready">
            <span className={styles.dot} />LINK READY
          </span>
          <div className={styles.actions}>
            {hasWebShare() && (
              <button
                type="button"
                className={styles.primary}
                onClick={(): void => { void handleNativeShare() }}
                data-testid="mobile-share-native"
              >SHARE</button>
            )}
            <button
              type="button"
              className={styles.secondary}
              onClick={(): void => { void handleCopy() }}
              data-testid="mobile-share-copy"
            >
              {copyState === 'copied' ? 'LINK COPIED' : copyState === 'error' ? "COULDN'T COPY" : 'COPY LINK'}
            </button>
            <button type="button" className={styles.ghost} onClick={onDone} data-testid="mobile-share-done">DONE</button>
          </div>
        </>
      )}
    </div>
  )
}
```

`components/board/MobileShareResult.module.css`:

```css
/* SHARE stage 2 on phones. A bottom sheet: the picture we are about to publish,
   then the actions. Same glass as BoardMobileNav / MobileShareSelectBar. */
.sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 12px calc(12px + env(safe-area-inset-bottom, 0px));
  background: rgba(9, 9, 11, 0.94);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px) saturate(1.1);
  -webkit-backdrop-filter: blur(20px) saturate(1.1);
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  animation: sheetUp 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes sheetUp {
  from { transform: translateY(100%); }
  to { transform: none; }
}

/* The preview IS the shared image — same 1.91:1 the OG card uses. */
.preview {
  display: block;
  width: 100%;
  aspect-ratio: 1200 / 630;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  letter-spacing: 0.14em;
  color: #28f100;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #28f100;
}

.error {
  font-size: 11px;
  letter-spacing: 0.14em;
  color: #ff6a5e;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.primary,
.secondary,
.ghost {
  min-height: 52px;
  font: inherit;
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-radius: 6px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 120ms ease, opacity 200ms ease;
}

.primary {
  color: #28f100;
  background: rgba(40, 241, 0, 0.12);
  border: 1px solid rgba(40, 241, 0, 0.4);
}

.secondary {
  color: rgba(255, 255, 255, 0.82);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.ghost {
  color: rgba(255, 255, 255, 0.62);
  background: none;
  border: 0;
}

.primary:active,
.secondary:active,
.ghost:active {
  transform: scale(0.985);
}

@media (prefers-reduced-motion: reduce) {
  .sheet { animation: none; }

  .primary,
  .secondary,
  .ghost {
    transition: none;
  }

  .primary:active,
  .secondary:active,
  .ghost:active {
    transform: none;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
rtk npx vitest run components/board/MobileShareResult.test.tsx
```

Expected: PASS — 7 tests。

- [ ] **Step 5: Commit**

```bash
rtk git add components/board/MobileShareResult.tsx components/board/MobileShareResult.module.css components/board/MobileShareResult.test.tsx
rtk git commit -m "feat(board): mobile SHARE result sheet with native Web Share (N-49)"
```

---

### Task 7: 回転ノブを指で触れるようにする（タブレット）＋ 撮影から外す

**Files:**
- Modify: `components/board/CollageCanvas.tsx:226-230`
- Modify: `components/board/CollageCanvas.module.css:39-67`
- Test: `components/board/CollageCanvas.test.tsx`（既存に追記）

**Interfaces:**
- Consumes: なし
- Produces: 回転ノブ `[data-testid="collage-rotate-<id>"]` が `data-no-capture` を持つ

> **順序が命。** 先に `data-no-capture` を付けてから CSS を開ける。逆にすると、常時表示になった瞬間に**タブレットの共有画像へノブが焼き付く**。今は hover 依存なので、撮影の瞬間ポインタが CREATE の上にあり、たまたま隠れているだけ（`BoardRoot.module.css:20-25` の `[data-capturing] [data-no-capture]{visibility:hidden}` は付いていない要素には効かない）。

- [ ] **Step 1: Write the failing test**

`components/board/CollageCanvas.test.tsx` の末尾の `describe` 内に追記（既存のレンダリングヘルパー／props をそのファイルの流儀で再利用すること）:

```tsx
  it('keeps the rotate knob out of the share capture', () => {
    // Touch devices show the knob at rest (no hover), so it MUST be excluded
    // from the capture or it bakes into the shared image.
    const { container } = renderCanvas() // ← 既存ヘルパー名に合わせる
    const knob = container.querySelector('[data-testid^="collage-rotate-"]')
    expect(knob).not.toBeNull()
    expect(knob?.hasAttribute('data-no-capture')).toBe(true)
  })
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
rtk npx vitest run components/board/CollageCanvas.test.tsx
```

Expected: FAIL — `expected false to be true`（`data-no-capture` が無い）。

- [ ] **Step 3: Write the implementation**

`components/board/CollageCanvas.tsx`、回転ノブの `<div>`（`:226`）に属性を1つ足す:

```tsx
            <div
              className={styles.rotateHandle}
              data-testid={`collage-rotate-${id}`}
              data-no-capture
              onPointerDown={(e): void => handleRotatePointerDown(e, id)}
            >
```

`components/board/CollageCanvas.module.css`、`.element:hover .rotateHandle` ブロックの直後に:

```css
/* Touch surfaces have no hover, so the knob would be unreachable forever
   (N-49 blocker b). Show it at rest there. It carries data-no-capture, so the
   SHARE screenshot still never sees it. */
@media (hover: none) {
  .rotateHandle {
    opacity: 1;
    pointer-events: auto;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
rtk npx vitest run components/board/CollageCanvas.test.tsx
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
rtk git add components/board/CollageCanvas.tsx components/board/CollageCanvas.module.css components/board/CollageCanvas.test.tsx
rtk git commit -m "fix(share): let fingers reach the rotate knob, keep it out of the shot (N-49)"
```

---

### Task 8: BoardRoot の配線

**Files:**
- Modify: `components/board/BoardRoot.tsx`

**Interfaces:**
- Consumes: Task 1 の `mobileCollageBandRect` / `mobileCaptureScale`、Task 2 の `scale`、Task 3 の `onShare`、Task 4 の `motion`、Task 5 の `MobileShareSelectBar`、Task 6 の `MobileShareResult`
- Produces: `handleMobileCreateShare(): Promise<void>`

このタスクは配線のみで、新しいロジックは `handleMobileCreateShare` だけ。**`sharePhase` に新しい値は足さない。**

- [ ] **Step 1: import を足す**

`BoardRoot.tsx` の既存 import 群に:

```ts
import { MobileShareSelectBar } from '@/components/board/MobileShareSelectBar'
import { MobileShareResult } from '@/components/board/MobileShareResult'
import { mobileCollageBandRect, mobileCaptureScale } from '@/lib/share/mobile-band'
```

- [ ] **Step 2: `handleMobileCreateShare` を書く**

`handleCreateHostedShare`（`:2408`）の**直後**に置く:

```tsx
  // スマホの CREATE。並べる段を「見せる編集画面」ではなく「撮るための一瞬の状態」として使う:
  //   1. 選択カードを画面中央の 1.91:1 の帯へ自動配置し sharePhase='arrange' に入る
  //   2. paint を 2 フレーム待ってから .outerFrame を fit:'cover' で撮る
  //      → computeCoverRect は中央を切るので、切り出し結果は帯と一致する（黒帯ゼロ）
  //   3. その JPEG を thumb にして /s 共有を作る
  // 撮影が失敗しても thumb 無しで作成する（＝共有を絶対に壊さない）。
  // タイトル（ワードマーク）は載せない: スマホの盤面はそもそも描いていないので、
  // 載せると盤面と共有リンクが食い違う（BoardRoot の bgTypo は !isMobile ゲート）。
  const handleMobileCreateShare = useCallback(async (): Promise<void> => {
    if (selectedIds.size === 0) return
    const frame = boardFrameRef.current
    const box = frame?.getBoundingClientRect()
    const frameW = box?.width ?? viewport.w
    const frameH = box?.height ?? viewport.h

    // 帯 = 画面に内接する中央の 1.91:1 矩形 = cover 切り出しが残す矩形そのもの。
    const band = mobileCollageBandRect(frameW, frameH)

    const chosen = lightboxNavItems.filter((it) => selectedIds.has(it.bookmarkId))
    const cards = chosen.map((it) => {
      const w = customWidths[it.bookmarkId] ?? cardWidthPx
      return { id: it.bookmarkId, width: w, height: itemSkylineHeight(it, w) }
    })
    setCollagePositions(fitSelectionToScreen(cards, band))
    setCollageOrder(chosen.map((it) => it.bookmarkId))
    setCollageRotations({})
    setShareTitle(null)
    setCapturedImageUrl(null)
    setHostedShareUrl(null)
    setSharePhase('arrange')
    setShareCreateState('creating')

    let thumb: string | null = null
    if (frame && typeof requestAnimationFrame === 'function') {
      setCapturing(true)
      // 帯の描画と data-capturing の CSS が確実に paint されてから撮る。
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
      try {
        thumb = await captureCollageShareImage(frame, {
          origin: shareOrigin(),
          boardColor: deriveCaptureBoardColor(),
          fit: 'cover',
          // 帯の幅（画面幅ではない）を渡す — 切り出す帯が原寸 1200px の raster になる。
          scale: mobileCaptureScale(band.width),
        })
      } finally {
        setCapturing(false)
      }
    }
    setCapturedImageUrl(thumb)

    const res = await createHostedShare({
      buildShare: buildArrangeShare,
      thumb: thumb ?? undefined,
      createShare,
      origin: shareOrigin(),
      warm: (u: string): void => { void fetch(u).catch((): void => {}) },
    })
    if (res.ok) {
      setHostedShareUrl(res.url)
      setShareCreateState('idle')
    } else {
      setShareCreateState('error')
    }
  }, [
    selectedIds, lightboxNavItems, customWidths, cardWidthPx,
    viewport.w, viewport.h, buildArrangeShare, deriveCaptureBoardColor,
  ])
```

- [ ] **Step 3: ボトムナビとフローティング「+」を共有中に隠す**

`:2908` の条件に `sharePhase === null` を足し、`motionOn`/`onToggleMotion` を `onShare` に差し替える:

```tsx
      {isMobile && !lightboxItemId && !showOnboarding && !tagMode && sharePhase === null && (
        <BoardMobileNav
          onTag={handleEnterTagMode}
          tagActive={tagMode}
          onThemes={() => setActiveDrawer(activeDrawer === 'themes' ? null : 'themes')}
          themesActive={activeDrawer === 'themes'}
          onShare={handleEnterSelectMode}
          cornersRounded={roundedCorners}
          onToggleCorners={handleToggleRoundedCorners}
          onSettings={() => setActiveDrawer(activeDrawer === 'settings' ? null : 'settings')}
          settingsActive={activeDrawer === 'settings'}
        />
      )}
```

`:2928` の「+」ボタンの条件 `sharePhase !== 'arrange'` を `sharePhase === null` に締める（選択中も隠す）。同ブロックのコメントも「SHARE のどの段でも隠す」に直す。

- [ ] **Step 4: MORE パネルへ MOTION を渡す**

`ExtensionEntry`（`:2980`）の props に 1 行:

```tsx
                motion={isMobile ? { enabled: motionEnabled, onToggle: handleToggleMotion } : undefined}
```

- [ ] **Step 5: 下部バーを分岐する**

`:3468-3513` を次に置き換える:

```tsx
      {sharePhase === 'select' && !isMobile && (
        <ShareSelectBar
          count={selectedIds.size}
          onSelectAll={handleSelectAll}
          onShare={handleEnterArrange}
          onCancel={handleExitShareMode}
        />
      )}
      {/* Phones skip the arrange stage entirely: CREATE arranges into the
          capture band, shoots it, and mints the link in one tap (N-49). */}
      {sharePhase === 'select' && isMobile && (
        <MobileShareSelectBar
          count={selectedIds.size}
          onSelectAll={handleSelectAll}
          onCreate={(): void => { void handleMobileCreateShare() }}
          onCancel={handleExitShareMode}
        />
      )}
      {sharePhase === 'arrange' && (
        <>
          <CollageCanvas
            items={lightboxNavItems.filter((it) => selectedIds.has(it.bookmarkId))}
            positions={collagePositions}
            order={collageOrder}
            onMove={(id, x, y): void => setCollagePositions((p) => moveElement(p, id, x, y))}
            onResize={(id, corner, w): void => setCollagePositions((p) => resizeElementFromCorner(p, id, corner, w))}
            onGrab={(id): void => setCollageOrder((o) => bringToFront(o, id))}
            rotations={collageRotations}
            onRotate={(id, deg): void => setCollageRotations((r) => ({ ...r, [id]: deg }))}
            maxCardWidth={effectiveLayoutWidth}
            displayMode={displayMode}
            paper={themeMeta.decorations === true}
            roundedCorners={roundedCorners}
            title={
              shareTitle
                ? { config: shareTitle, defaultText: deriveBoardBgTypoText(activeFilter, tags), onChange: setShareTitle }
                : undefined
            }
          />
          {/* Operation bar — hidden from the SHARE capture (data-no-capture) so it
              never appears baked into the shared image, but stays on screen. */}
          <div data-no-capture>
            {isMobile ? (
              // While 'creating' nothing renders here: ShareCreatingIndicator
              // portals to document.body and covers the forming collage.
              (hostedShareUrl !== null || shareCreateState === 'error') && (
                <MobileShareResult
                  imageUrl={capturedImageUrl}
                  shareUrl={hostedShareUrl}
                  createState={shareCreateState}
                  onCopyLink={handleShareCopyLink}
                  onRetry={(): void => { void handleMobileCreateShare() }}
                  onDone={handleExitShareMode}
                />
              )
            ) : (
              <ShareToast
                count={selectedIds.size}
                createState={shareCreateState}
                onCreate={(): void => { void handleCreateHostedShare() }}
                shareUrl={hostedShareUrl}
                onCopyLink={handleShareCopyLink}
                onPostToX={handlePostToX}
                onSaveImage={capturedImageUrl ? handleSaveShareImage : undefined}
                onReselect={handleShareReselect}
                onDone={handleExitShareMode}
              />
            )}
          </div>
        </>
      )}
```

- [ ] **Step 6: 型と単体テストを通す**

```bash
rtk tsc --noEmit
rtk npx vitest run
```

Expected: tsc エラー 0。vitest 全緑（Task 1〜7 の新規テスト分だけ増える）。

`handleMobileCreateShare` の deps に警告が出たら、`items` を使っていないことを確認する（`buildArrangeShare` が内部で読む）。

- [ ] **Step 7: 古くなったコメントを直す**

`components/board/TopHeader.module.css:60-64` のコメントが `BoardMobileNav: FILTER / TAG / THEME / MOTION / SETTINGS` と、二重に古い（FILTER は s178 で上部ヘッダーへ、MOTION は本 Task で MORE へ）。実態に合わせる:

```css
/* Mobile (≤640px): the top action row is removed entirely — the board controls
   live in the bottom nav (BoardMobileNav: TAG / THEME / SHARE / CORNERS / MORE)
   and FILTER sits in the top-right header. TITLE / TUNE / POP OUT are
   desktop-only for v1 (arrangement / an unsupported phone API). Desktop (>640px)
   keeps every action. */
```

`SHARE` を「desktop-only」の列から外すこと — それが本 Task の主題。

- [ ] **Step 8: Commit**

```bash
rtk git add components/board/BoardRoot.tsx
rtk git commit -m "feat(board): wire mobile SHARE end to end (N-49)"
```

---

### Task 9: e2e — スマホの共有フローと帯の充填

**Files:**
- Create: `tests/e2e/mobile-share.spec.ts`

**Interfaces:**
- Consumes: Task 3/5/6/8 の testid
- Produces: なし

> **カードのタップ選択は Playwright で駆動できない**（`handleSelectPointerDown` が `setPointerCapture` を呼び、合成ポインタは拒否される。memory `reference_board_card_click_pointer_capture`）。`SELECT ALL` 経由で確認する（memory `reference_playwright_board_share_verify`）。
> **`functions/api/share/create.ts` は Pages Function で `next dev` には存在しない**（`tests/e2e/board-share-polish.spec.ts:176-185` の注記）。`page.route` で 200 を返す。
> **黒帯が無いことは最終画像の寸法では証明できない**（`contain` でも `cover` でも 1200×630）。撮影後も `sharePhase==='arrange'` のままなので、`[data-testid^="collage-el-"]` の実座標が帯に収まり左右端まで届いていることを DOM で測る。

- [ ] **Step 1: Write the failing test**

`tests/e2e/mobile-share.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test'

const DB_NAME = 'booklage-db'
const SEED_COUNT = 6

/** Seed cards + the acks that suppress every first-run modal. Mirrors
 *  tests/e2e/mobile-save.spec.ts (memory: reference_playwright_board_share_verify). */
async function seedBoard(page: Page): Promise<void> {
  await page.goto('/board')
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  await page.waitForTimeout(400)
  await page.evaluate(
    async ({ dbName, seedCount }) => {
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(dbName)
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction(['bookmarks', 'cards', 'settings'], 'readwrite')
          const bStore = tx.objectStore('bookmarks')
          const cStore = tx.objectStore('cards')
          const sStore = tx.objectStore('settings')
          sStore.put({ key: 'onboarding-completed', completed: true })
          const nowIso = new Date().toISOString()
          sStore.put({ key: 'data-home-ack', at: nowIso })
          sStore.put({ key: 'last-backup-at', at: nowIso })
          for (let i = 0; i < seedCount; i++) {
            bStore.put({
              id: `seed-b-${i}`, url: `https://example.com/${i}`, title: `Seed ${i}`,
              description: '', thumbnail: '', favicon: '', siteName: '', type: 'website',
              savedAt: nowIso, tags: [], displayMode: null, ogpStatus: 'fetched',
              sizePreset: 'S', orderIndex: i, linkStatus: 'alive',
            })
            cStore.put({
              id: `seed-c-${i}`, bookmarkId: `seed-b-${i}`, folderId: '',
              x: 0, y: 0, rotation: 0, scale: 1, zIndex: 0, gridIndex: i,
              isManuallyPlaced: false, width: 240, height: 180,
            })
          }
          tx.oncomplete = () => { db.close(); resolve() }
          tx.onerror = () => { db.close(); reject(tx.error) }
        }
        req.onerror = () => reject(req.error)
      })
    },
    { dbName: DB_NAME, seedCount: SEED_COUNT },
  )
  await page.reload()
  await page.locator('[data-bookmark-id]').first().waitFor({ timeout: 15_000 })
}

/** functions/api/share/create.ts is a Pages Function; it does not exist under
 *  `next dev`. Fulfil it so the flow reaches LINK READY. */
async function stubCreate(page: Page, id = 'e2eshare'): Promise<void> {
  await page.route('**/api/share/create', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id }) }),
  )
  // The post-create cache warm hits /og/<id>.jpg, which also does not exist.
  await page.route('**/og/*.jpg', (route) => route.fulfill({ status: 200, contentType: 'image/jpeg', body: '' }))
}

test.describe('mobile SHARE — phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true })

  test('bottom nav hosts SHARE, and entering select mode clears the chrome', async ({ page }) => {
    await seedBoard(page)

    const nav = page.locator('[data-testid="board-mobile-nav"]')
    await expect(nav).toBeVisible()
    await expect(page.locator('[data-testid="mobile-nav-motion"]')).toHaveCount(0)

    await page.locator('[data-testid="mobile-nav-share"]').click()

    await expect(page.locator('[data-testid="mobile-share-select-bar"]')).toBeVisible()
    await expect(nav).toHaveCount(0)
    await expect(page.locator('[data-testid="mobile-save-button"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="mobile-select-counter"]')).toHaveText('0 / 100 SELECTED')
  })

  test('SELECT ALL → CREATE arranges into the centred 1.91:1 band and yields a link', async ({ page }) => {
    await seedBoard(page)
    await stubCreate(page)

    await page.locator('[data-testid="mobile-nav-share"]').click()
    await page.locator('[data-testid="mobile-select-all"]').click()
    await expect(page.locator('[data-testid="mobile-select-counter"]')).toHaveText(`${SEED_COUNT} / 100 SELECTED`)

    await page.locator('[data-testid="mobile-select-create"]').click()

    const sheet = page.locator('[data-testid="mobile-share-result"]')
    await expect(sheet).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('[data-testid="mobile-share-ready"]')).toBeVisible()
    await expect(page.locator('[data-testid="mobile-share-copy"]')).toBeVisible()

    // The collage is still mounted (sharePhase stays 'arrange'), so the band can
    // be measured directly. This — not the final image's size — is what proves
    // there are no letterbox bars: contain would leave the sides empty.
    const band = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('[data-testid^="collage-el-"]'))
      const rects = els.map((el) => el.getBoundingClientRect())
      return {
        count: rects.length,
        left: Math.min(...rects.map((r) => r.left)),
        right: Math.max(...rects.map((r) => r.right)),
        top: Math.min(...rects.map((r) => r.top)),
        bottom: Math.max(...rects.map((r) => r.bottom)),
        vw: window.innerWidth,
        vh: window.innerHeight,
      }
    })
    expect(band.count).toBe(SEED_COUNT)

    const bandH = band.vw * (630 / 1200)
    const bandTop = (band.vh - bandH) / 2
    // Cards reach both side edges (no left/right letterbox).
    expect(band.left).toBeLessThanOrEqual(1)
    expect(band.right).toBeGreaterThanOrEqual(band.vw - 1)
    // …and stay inside the band that cover-cropping will keep.
    expect(band.top).toBeGreaterThanOrEqual(bandTop - 1)
    expect(band.bottom).toBeLessThanOrEqual(bandTop + bandH + 1)
  })

  test('the preview is a real 1200x630 image', async ({ page }) => {
    await seedBoard(page)
    await stubCreate(page)
    await page.locator('[data-testid="mobile-nav-share"]').click()
    await page.locator('[data-testid="mobile-select-all"]').click()
    await page.locator('[data-testid="mobile-select-create"]').click()

    const preview = page.locator('[data-testid="mobile-share-preview"]')
    await expect(preview).toBeVisible({ timeout: 30_000 })
    const dims = await preview.evaluate((el) => {
      const img = el as HTMLImageElement
      return { w: img.naturalWidth, h: img.naturalHeight, src: img.src.slice(0, 22) }
    })
    expect(dims).toEqual({ w: 1200, h: 630, src: 'data:image/jpeg;base64' })
  })
})

test.describe('desktop SHARE — unchanged', () => {
  test.use({ viewport: { width: 1489, height: 679 } })

  test('still uses the arrange stage with ShareSelectBar → ShareToast', async ({ page }) => {
    await seedBoard(page)
    await page.locator('[data-testid="share-pill"]').click()
    await expect(page.locator('[data-testid="select-share-button"]')).toBeVisible()
    await expect(page.locator('[data-testid="mobile-share-select-bar"]')).toHaveCount(0)
    await page.locator('[data-testid="select-all-button"]').click()
    await page.locator('[data-testid="select-share-button"]').click()
    await expect(page.locator('[data-testid="share-toast-create"]')).toBeVisible()
  })
})
```

> `mobile-save-button` の testid が違う場合は `components/board/MobileSaveButton.tsx` を読んで合わせる。

- [ ] **Step 2: Run the test to verify it fails, then passes**

```bash
rtk npx playwright test tests/e2e/mobile-share.spec.ts
```

Task 8 まで済んでいれば PASS するはず。落ちた場合は**修正を実装側に入れる**（テストの期待値を緩めない）。特に:

- `mobile-share-result` が出ない → `handleMobileCreateShare` の分岐か `stubCreate` の URL パターン
- `band.left > 1` → `mobileCollageBandRect` が `x: 0` を返しているのに `fitSelectionToScreen` が中央寄せしている可能性。少数カード（6枚）は水平中央寄せされる仕様（`collage-layout.ts:169-170`）なので、**この assert は 6 枚では成立しない可能性が高い**。その場合は `SEED_COUNT` を 24 に増やして行が埋まるようにする

- [ ] **Step 3: Commit**

```bash
rtk git add tests/e2e/mobile-share.spec.ts
rtk git commit -m "test(e2e): mobile SHARE flow + band fill + desktop non-regression (N-49)"
```

---

### Task 10: 総合検証とデプロイ

**Files:** なし（検証のみ）

- [ ] **Step 1: 型・単体・ビルド**

```bash
rtk tsc --noEmit
rtk npx vitest run
rtk pnpm build
```

Expected: tsc 0 / vitest 全緑（2215 + 新規 ~26）/ `out/` 生成。
（`rtk next build` ではなく `pnpm build` — memory `reference_pnpm_build_required`）

- [ ] **Step 2: e2e フルスイート**

```bash
rtk npx playwright test
```

Expected: 既存の緑（19 前後）＋ 新規 4。`board-b0.spec.ts` の腐り（N-53）は既知の別件。

- [ ] **Step 3: デプロイ**

```bash
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true
```

`--branch=master` は必須（無いとプレビュー URL になり、ユーザーの IndexedDB が別 origin で空に見える）。

- [ ] **Step 4: 受け取り画面を確認する（恒久ルール）**

盤面の見た目は変えていないが、**ボードを触ったら受け取り画面も見る**（memory `feedback_board_change_check_receiver`）。`allmarks.app` でスマホから共有リンクを作り、その `/s/<id>` をスマホで開いて、カード・スクロール・下部 IMPORT バーが s184 のままかを見る。

- [ ] **Step 5: ユーザーに実機確認を依頼する**

自動では確認できないものだけを渡す:

1. 選択モードで**指スクロールが生きているか**（`setPointerCapture` と `touch-action: pan-y` の同居）
2. `SHARE` を押して出た OS シートで、**X / Instagram / LINE が画像とリンクをどう拾うか**
3. 出来た画像で**カードの文字が読めるか**（`scale` が効いているか＝ぼやけていないか）
4. 低スペック端末で撮影が落ちないか（落ちてもプレビュー無しで共有は成立する）
5. タブレットの並べる段で**回転ノブが指で掴めるか**、かつ**共有画像にノブが写っていないか**

- [ ] **Step 6: TODO / CURRENT_GOAL を更新して commit**

`docs/TODO.md` の N-49 を完了に、`docs/TODO_COMPLETED.md` に narrative を追記、`docs/CURRENT_GOAL.md` を次セッション（N-54 → N-51 の残り → N-50）に書き換える。`docs/private/dashboard.html` も最新化する。

```bash
rtk git add docs/
rtk git commit -m "docs: s185 wrap-up — mobile SHARE shipped (N-49)"
```

---

## Self-Review

**Spec coverage**

| spec | task |
|---|---|
| §2.1 並べる段を出さない | 8（`handleMobileCreateShare` が arrange を撮影用の一瞬の状態としてのみ使う） |
| §2.2 ナビ 5 枠・MOTION 降格 | 3 / 4 / 8 |
| §2.3 プレビュー＋3ボタン | 6 |
| §3.2 帯を cover で撮る | 1 / 8 |
| §3.3 純関数 | 1 |
| §3.4 `scale` 配線 | 2 |
| §4.1 状態機械 | 8 |
| §4.2 CREATE ハンドラ | 8 |
| §4.3 選択バー | 5 |
| §4.4 結果シート 5 分岐 | 6 |
| §4.5 重なり・ナビと「+」を隠す | 8 |
| §5 回転ノブ ＋ `data-no-capture` | 7 |
| §8 テスト | 1,2,3,4,5,6,7,9,10 |
| §9 未検証の前提 | 2（scale の単体固定）/ 10 Step 5（目視） |

**Type consistency**

- `CollageFitRect` は `collage-layout.ts` の既存 export を再利用（新しい型を作らない）
- `ShareCreateState` は `ShareToast.tsx` の既存 export を再利用
- `mobileCollageBandRect` / `mobileCaptureScale` の名前は Task 1・8・9 で一致
- `MobileShareResult` の prop 名（`imageUrl` / `shareUrl` / `createState` / `onCopyLink` / `onRetry` / `onDone`）は Task 6・8 で一致
- `MobileShareSelectBar` の prop 名（`count` / `onSelectAll` / `onCreate` / `onCancel`）は Task 5・8 で一致

**書いた後に潰した穴**

- ~~`themeId: 'wave'`~~ → 実在するのは `'dotted-notebook' | 'grid-paper' | 'paper-atelier'`（`lib/board/types.ts:3`）。Task 4 を `'grid-paper'` に修正済み
- ~~「MORE パネルがモバイルで開くか」~~ → `ChromeDrawer` が `createPortal(…, document.body)`（`ChromeDrawer.tsx:68-88`）。トリガーが `display:none` の中にあってもパネルは出る。**MOTION の置き場を作り直す必要はない**
- ~~`mobile-save-button` の testid~~ → 実在確認済み（`MobileSaveButton.tsx:50`）。`share-pill` も実在（`board-share-polish.spec.ts` が使用中）

**残る既知の穴（実装中に潰す）**

- Task 9 の「カードが左右端まで届く」assert は、**少数カードだと `fitSelectionToScreen` が水平中央寄せする**ので成立しない可能性が高い（`collage-layout.ts:169-170`）。Task 9 Step 2 に対処を書いてある（`SEED_COUNT` を 24 に増やして行を埋める）
- `mobileCollageBandRect` が `x: 0, width: frameW` を返しても、`fitSelectionToScreen` は行が埋まらない限り左右に余白を残す。**帯の左右端まで本当に埋まるのは多数カードのときだけ** — これは仕様どおり（少数カードを巨大化させない）であって、黒帯とは別物。共有画像の左右が地色になるのは「カードが少ないから」で、`contain` のレターボックスではない
