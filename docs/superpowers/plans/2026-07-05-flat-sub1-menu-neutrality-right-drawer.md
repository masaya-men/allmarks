# フラット化 サブ① — メニュー中立化＋右ドロワー統一 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 盤面の大パネル4種（TUNE / SETTINGS / SHARE / テーマ選択）を共通の「右ドロワー」基盤に統一し、全メニューからテーマ着せ替え（paper 装飾）を外して中立 chrome に固定する。

**Architecture:** 現状は4パネルが各自 overlay+panel+開閉+アニメを独立実装（共通土台なし）。THEMES（`ThemeModal`）の実績ある右ドック shell を汎用コンポーネント `ChromeDrawer` に抽出し、4パネルの「中身」を子として流し込む。開閉状態は `BoardRoot` の単一 `activeDrawer` に集約（＝同時に1枚だけ）。メニュー中立化は、各パネル/ポップ/ヘッダ chrome の `html[data-theme-id='paper-atelier']` スコープCSS・テーマトークン参照・`useIsPaperTheme` JS分岐を削除して行う。盤面（カード/背景/メーター/モーション/装飾）はテーマ可変のまま無変更。

**Tech Stack:** Next.js 14 App Router / TypeScript strict / Vanilla CSS Modules / React 18 / vitest + @testing-library/react / Playwright（実機検証）/ Cloudflare Pages（static export）。

## Global Constraints

- TypeScript `strict: true`。`any` 禁止（`unknown`＋型ガード）。Return type 明示。（CLAUDE.md）
- スタイルは Vanilla CSS + CSS Modules のみ。**Tailwind 禁止**。z-index は `lib/board/constants.ts` の `BOARD_Z_INDEX` 定数で管理（魔法の数値禁止）。
- アニメーションは CSS keyframes / GSAP のみ。**Framer Motion 禁止**。
- `console.log` を本番コードに残さない。
- **`DEFAULT_THEME_ID` は変更しない**（`dotted-notebook` のまま。白フラット default はサブ②）。
- UI 表記は globally-clear な英語（既存ラベル TUNE/SETTINGS/SHARE 等はそのまま）。ユーザー向け文言変更なし。
- **byte-identical の範囲は「盤面のみ」**（カード/背景/メーター/モーション/明暗）。メニューは中立化で意図的に変わる（＝byte-identical 対象外）。
- テストは `data-testid` ベース選択（CSS module クラス名非依存）。既存 testid を維持する。
- デプロイ前に `rtk tsc && rtk vitest run && rtk pnpm build` が緑。デプロイは `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`。
- 応答/コミット文言は ASCII（wrangler が日本語 commit body を拒否する既知事象は wrangler 側のみだが、git commit は英語で書く）。
- 親 spec: `docs/superpowers/specs/2026-07-05-flat-theme-and-theme-boundary-design.md` / サブ① spec: `docs/superpowers/specs/2026-07-05-flat-sub1-menu-neutrality-right-drawer-design.md`。

---

## File Structure（このサブで触るファイル）

**新規作成:**
- `components/board/ChromeDrawer.tsx` — 共通右ドロワー基盤（overlay + panel + header + scroll body + scrollFade + 開閉制御）
- `components/board/ChromeDrawer.module.css` — 中立サーフェスCSS（現行 ThemeModal の neutral 値を移植）
- `components/board/ChromeDrawer.test.tsx` — 基盤の開閉/Esc/外側クリック テスト

**改変:**
- `lib/board/constants.ts` — `BOARD_Z_INDEX.CHROME_DRAWER` 追加
- `components/board/ThemeModal.tsx` / `.module.css` — 中身を ChromeDrawer に載せ替え、自前 shell CSS 削除
- `components/board/ExtensionEntry.tsx` / `.module.css` — ChromeDrawer 化、portal/measure/hover 撤去、click 化、外部 `isOpen`/`onToggle` 化
- `components/share/SenderShareModal.tsx` / `.module.css` — ChromeDrawer 化（中央モーダル→右ドロワー、~400px リフロー）
- `components/board/TuneTrigger.tsx` / `.module.css` — ChromeDrawer 化、hover→click、外部制御、scramble を isOpen 駆動へ
- `components/board/BoardRoot.tsx` — `activeDrawer` 状態一本化、4トリガーの配線変更
- 中立化（Task 6）で paper スコープ削除: `TuneTrigger.module.css` / `ExtensionEntry.module.css` / `ThemeModal.module.css` / `ThemePicker.module.css` / `ThemeCustomizeSection.module.css` / `TunePresetColumn.module.css` / `FilterPill.module.css` / `TagAddPopover/TagAddPopover.module.css` / `ChromeButton.module.css` / `LanguageSwitcher.module.css` / `TopHeader.module.css`、JS分岐: `ChromeButton.tsx` / `TuneTrigger.tsx` / `FilterPill.tsx`
- `tests/e2e/board-theme.spec.ts` — 右ドロワー統一後の DOM に更新

**触らない（盤面＝テーマ可変を維持）:** `ScrollMeter.*` / `scrollmeter/RulerTrack.*` / `CardNode.*` / `CardSlideshow.*` / `BoardBackgroundTypography.*` / `chrome/PaperFramePlate` / `chrome/PaperWaxSeal` / `decorations/` / `TagIndicatorStrip`（カードのタグ washi）/ `Lightbox`（盤面）/ `ShareMirror`（共有画像＝盤面表現）/ globals.css の paper 盤面トークン（fiber/wordmark/plate/wax）。`--paper-panel-*` トークン定義（`app/globals.css:523-529`）は PiP/SaveToast が参照中のため**削除しない**。

---

## Task 1: ChromeDrawer 共通基盤

**Files:**
- Create: `components/board/ChromeDrawer.tsx`
- Create: `components/board/ChromeDrawer.module.css`
- Test: `components/board/ChromeDrawer.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface ChromeDrawerProps {
    readonly isOpen: boolean
    readonly onClose: () => void
    readonly title: string
    /** panel の data-testid。overlay=`${testId}-overlay` / close=`${testId}-close` を派生。 */
    readonly testId: string
    readonly children: ReactNode
  }
  export function ChromeDrawer(props: ChromeDrawerProps): ReactElement | null
  ```
- Consumes: なし（新規土台）。

- [ ] **Step 1: 失敗するテストを書く**

`components/board/ChromeDrawer.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactElement } from 'react'
import { ChromeDrawer } from './ChromeDrawer'

function firePointerDown(el: Element): void {
  el.dispatchEvent(new Event('pointerdown', { bubbles: true }))
}

function renderDrawer(isOpen: boolean, onClose = vi.fn()): { onClose: ReturnType<typeof vi.fn> } {
  render(
    <ChromeDrawer isOpen={isOpen} onClose={onClose} title="TEST PANEL" testId="test-drawer">
      <div data-testid="drawer-child">hello</div>
    </ChromeDrawer>,
  )
  return { onClose }
}

describe('ChromeDrawer', () => {
  it('renders nothing when closed', () => {
    renderDrawer(false)
    expect(screen.queryByTestId('test-drawer')).toBeNull()
  })

  it('renders title and children when open', () => {
    renderDrawer(true)
    expect(screen.getByTestId('test-drawer')).toBeTruthy()
    expect(screen.getByText('TEST PANEL')).toBeTruthy()
    expect(screen.getByTestId('drawer-child')).toBeTruthy()
  })

  it('closes on Escape', () => {
    const { onClose } = renderDrawer(true)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on pointerdown outside the panel', () => {
    const { onClose } = renderDrawer(true)
    firePointerDown(document.body)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does NOT close on pointerdown inside the panel', () => {
    const { onClose } = renderDrawer(true)
    firePointerDown(screen.getByTestId('drawer-child'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes when the close button is clicked', () => {
    const { onClose } = renderDrawer(true)
    fireEvent.click(screen.getByTestId('test-drawer-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: テストが落ちるのを確認**

Run: `rtk vitest run components/board/ChromeDrawer.test.tsx`
Expected: FAIL（`ChromeDrawer` が存在しない）

- [ ] **Step 3: ChromeDrawer を実装**

`components/board/ChromeDrawer.tsx`（開閉制御は `ThemeModal.tsx` の実績パターンを踏襲: Esc=window keydown、外側クリック=document capture-phase pointerdown、open 時 close ボタン focus、scrollFade は内部管理）:
```tsx
'use client'

import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import styles from './ChromeDrawer.module.css'

export interface ChromeDrawerProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly title: string
  readonly testId: string
  readonly children: ReactNode
}

export function ChromeDrawer({ isOpen, onClose, title, testId, children }: ChromeDrawerProps): ReactElement | null {
  const panelRef = useRef<HTMLElement | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const [moreBelow, setMoreBelow] = useState(false)

  const recomputeFade = useCallback((): void => {
    const el = bodyRef.current
    if (!el) { setMoreBelow(false); return }
    setMoreBelow(el.scrollTop + el.clientHeight < el.scrollHeight - 1)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    closeBtnRef.current?.focus()
    recomputeFade()
  }, [isOpen, recomputeFade])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return
    // capture phase: board が pointer capture する前に外側判定する（ThemeModal と同方式）
    const onDown = (e: PointerEvent): void => {
      if (!panelRef.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const titleId = `${testId}-title`
  return (
    <div className={styles.overlay} role="presentation" data-testid={`${testId}-overlay`}>
      <aside ref={panelRef} className={styles.panel} role="dialog" aria-labelledby={titleId} data-testid={testId}>
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>{title}</h2>
          <button
            ref={closeBtnRef}
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
            data-testid={`${testId}-close`}
          >×</button>
        </div>
        <div className={styles.body} ref={bodyRef} onScroll={recomputeFade}>
          {children}
        </div>
        <div className={styles.scrollFade} data-visible={moreBelow ? 'true' : 'false'} aria-hidden="true" />
      </aside>
    </div>
  )
}
```

`components/board/ChromeDrawer.module.css`（現行 `ThemeModal.module.css` の neutral 値を移植。paper ブロックは含めない＝中立固定。z は Task 2 で定数化するので一旦 410 を直書き→ Task 2 で `var(--z-chrome-drawer)` 化）:
```css
.overlay {
  position: fixed;
  inset: 0;
  z-index: 410;
  pointer-events: none;
  display: flex;
  justify-content: flex-end;
}
.panel {
  position: relative;
  pointer-events: auto;
  width: 400px;
  max-width: calc(100vw - 24px);
  margin: 12px 12px 12px 0;
  display: flex;
  flex-direction: column;
  max-height: calc(100dvh - 24px);
  background: rgba(12, 12, 12, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 14px;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.55);
  color: rgba(255, 255, 255, 0.85);
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
  overflow: hidden;
  animation: panelIn 220ms cubic-bezier(0.22, 1, 0.36, 1);
}
.header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 12px 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: rgba(255, 255, 255, 0.9);
}
.closeBtn {
  flex: 0 0 auto;
  background: none;
  border: none;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 4px 9px;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.55);
  transition: color 0.15s, background 0.15s;
}
.closeBtn:hover { color: rgba(255, 255, 255, 0.95); background: rgba(255, 255, 255, 0.06); }
.closeBtn:focus-visible { outline: 1px dashed rgba(255, 255, 255, 0.5); outline-offset: 2px; }
.body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 12px 16px 16px;
}
.scrollFade {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 48px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s;
  background: linear-gradient(to bottom, rgba(12, 12, 12, 0), rgba(12, 12, 12, 0.94));
}
.scrollFade[data-visible='true'] { opacity: 1; }
@keyframes panelIn {
  from { opacity: 0; transform: translateX(16px); }
  to { opacity: 1; transform: translateX(0); }
}
@media (prefers-reduced-motion: reduce) {
  .panel { animation: none; }
}
```

- [ ] **Step 4: テストが通るのを確認**

Run: `rtk vitest run components/board/ChromeDrawer.test.tsx`
Expected: PASS（6 tests）

- [ ] **Step 5: tsc**

Run: `rtk tsc`
Expected: エラー 0

- [ ] **Step 6: Commit**

```bash
rtk git add components/board/ChromeDrawer.tsx components/board/ChromeDrawer.module.css components/board/ChromeDrawer.test.tsx
rtk git commit -m "feat(board): add ChromeDrawer neutral right-drawer primitive"
```

---

## Task 2: z-index 定数化 ＋ activeDrawer 状態 ＋ THEMES を ChromeDrawer 化

**Files:**
- Modify: `lib/board/constants.ts`（`BOARD_Z_INDEX` に追加）
- Modify: `components/board/ChromeDrawer.module.css:3`（`z-index: 410` → 定数 CSS 変数）
- Modify: `components/board/ThemeModal.tsx`（中身を ChromeDrawer の children に）
- Modify: `components/board/ThemeModal.module.css`（overlay/panel/header/closeBtn/scrollFade/body 削除、中身用クラスのみ残す）
- Modify: `components/board/ThemeModal.test.tsx`（testid 前提を維持・必要なら調整）
- Modify: `components/board/BoardRoot.tsx`（`activeDrawer` 状態導入、THEMES 開閉を配線）

**Interfaces:**
- Consumes: `ChromeDrawer`（Task 1）
- Produces:
  ```ts
  // BoardRoot 内部
  type ActiveDrawer = 'tune' | 'settings' | 'share' | 'themes' | null
  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>(null)
  ```
  `ThemeModal` の props は不変（`isOpen`/`onClose` はそのまま。中身の描画のみ ChromeDrawer 経由に変わる）。

- [ ] **Step 1: z-index 定数を追加（先にテスト）**

`lib/board/constants.test.ts`（無ければ作成、あれば追記）:
```ts
import { describe, it, expect } from 'vitest'
import { BOARD_Z_INDEX } from './constants'

describe('BOARD_Z_INDEX.CHROME_DRAWER', () => {
  it('sits above the canvas ScrollMeter (400) and toolbar (110)', () => {
    expect(BOARD_Z_INDEX.CHROME_DRAWER).toBeGreaterThan(400)
    expect(BOARD_Z_INDEX.CHROME_DRAWER).toBeGreaterThan(BOARD_Z_INDEX.TOOLBAR)
  })
  it('sits below the onboarding spotlight ring (410)', () => {
    expect(BOARD_Z_INDEX.CHROME_DRAWER).toBeLessThan(BOARD_Z_INDEX.ONBOARDING_SPOTLIGHT_RING)
  })
})
```

- [ ] **Step 2: 落ちるのを確認**

Run: `rtk vitest run lib/board/constants.test.ts`
Expected: FAIL（`CHROME_DRAWER` 未定義）

- [ ] **Step 3: 定数を追加**

`lib/board/constants.ts` の `BOARD_Z_INDEX` に追加（`MODAL_OVERLAY: 200` の近く、値は 405＝ScrollMeter 400 より上・spotlight ring 410 より下）:
```ts
  /** 統一右ドロワー（TUNE/SETTINGS/SHARE/THEMES）。ScrollMeter(400) の上、onboarding ring(410) の下。 */
  CHROME_DRAWER: 405,
```

- [ ] **Step 4: ChromeDrawer CSS を定数連動に**

`components/board/ChromeDrawer.module.css` の `.overlay` に CSS 変数を注入する方針。`ChromeDrawer.tsx` の overlay に inline style で z を渡す（CSS Module から定数を読めないため）。`ChromeDrawer.tsx` の overlay を修正:
```tsx
import { BOARD_Z_INDEX } from '@/lib/board/constants'
// ...
<div className={styles.overlay} role="presentation" data-testid={`${testId}-overlay`} style={{ zIndex: BOARD_Z_INDEX.CHROME_DRAWER }}>
```
`ChromeDrawer.module.css:3` の `z-index: 410;` を削除（inline が担う）。

- [ ] **Step 5: ThemeModal を ChromeDrawer 化**

`components/board/ThemeModal.tsx` の return を、自前 overlay/panel/header/close/body/scrollFade を捨て、ChromeDrawer の children に中身（PATTERN THEMES / WORKS / ThemeCustomizeSection）を入れる形へ:
```tsx
import { ChromeDrawer } from './ChromeDrawer'
// ... 既存の isOpen early-return / Esc / outside-click / focus / scrollFade ロジックは ChromeDrawer に移譲するので削除
export function ThemeModal({ isOpen, onClose, themeId, onThemeChange, customization, isDefaultCustomization, onCustomize }: ThemeModalProps): ReactElement | null {
  const { t } = useI18n()
  return (
    <ChromeDrawer isOpen={isOpen} onClose={onClose} title={t('board.theme.modalTitle')} testId="theme-modal">
      <section className={styles.group}>
        <div className={styles.groupLabel}>PATTERN THEMES</div>
        <ThemePicker themeId={themeId} onThemeChange={onThemeChange} variant="modal" showHeading={false} filterKind="pattern" />
      </section>
      <section className={styles.group}>
        <div className={styles.groupLabel}>WORKS</div>
        <ThemePicker themeId={themeId} onThemeChange={onThemeChange} variant="modal" showHeading={false} filterKind="work" />
      </section>
      {customization && (
        <ThemeCustomizeSection value={customization} isDefault={isDefaultCustomization} allowsPattern={themeAllowsPattern(themeId)} onChange={onCustomize} />
      )}
    </ChromeDrawer>
  )
}
```
`ThemeModal.module.css` は `.group` / `.groupLabel` など**中身専用クラスのみ残し**、`.overlay` / `.panel` / `.header` / `.title` / `.titleWrap` / `.closeBtn` / `.body` / `.scrollFade` / `@keyframes panelIn` と paper override（`:138-173`）を削除。

- [ ] **Step 6: ThemeModal.test.tsx を確認・調整**

既存テスト（outside-click dismiss 等）は testid `theme-modal` / `theme-modal-close` / `theme-modal-overlay` を使用。ChromeDrawer が `testId="theme-modal"` からこれらを派生するため**そのまま通る想定**。落ちる場合は ChromeDrawer 側の testid 派生を確認。
Run: `rtk vitest run components/board/ThemeModal.test.tsx`
Expected: PASS

- [ ] **Step 7: BoardRoot に activeDrawer を導入し THEMES を配線**

`components/board/BoardRoot.tsx`:
- 行 324 の `const [themeModalOpen, setThemeModalOpen] = useState<boolean>(false)` を削除し、代わりに近傍へ:
  ```ts
  type ActiveDrawer = 'tune' | 'settings' | 'share' | 'themes' | null
  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>(null)
  ```
- THEMES 開（行 2416）: `onOpenThemeModal={() => setActiveDrawer('themes')}`
- THEMES render（行 2725 付近）: `isOpen={activeDrawer === 'themes'}` / `onClose={() => setActiveDrawer(null)}`
  ```tsx
  <ThemeModal
    isOpen={activeDrawer === 'themes'}
    onClose={(): void => setActiveDrawer(null)}
    themeId={themeId}
    onThemeChange={handleThemeChange}
    customization={resolvedCustom}
    isDefaultCustomization={isDefaultCustomization(themeId, themeCustomizations[themeId])}
    onCustomize={handleCustomizeTheme}
  />
  ```
- （SHARE の `shareModalOpen` は Task 4、SETTINGS/TUNE は Task 3/5 で移行するので本タスクでは触らない。それまで `shareModalOpen` は共存させておく。）

- [ ] **Step 8: tsc ＋ 関連テスト**

Run: `rtk tsc && rtk vitest run components/board/ChromeDrawer.test.tsx components/board/ThemeModal.test.tsx lib/board/constants.test.ts`
Expected: すべて PASS / tsc エラー 0

- [ ] **Step 9: 実機で THEMES が右から出るのを確認**

Run: dev サーバ（`rtk pnpm dev`）で board を開き、SETTINGS → CHOOSE A THEME で THEMES が右ドロワーとして開き、Esc/外側クリック/×で閉じる。playwright-skill で `theme-modal` の可視と `panelIn` を確認。
Expected: 従来どおり右から出る（挙動不変）。

- [ ] **Step 10: Commit**

```bash
rtk git add lib/board/constants.ts lib/board/constants.test.ts components/board/ChromeDrawer.tsx components/board/ChromeDrawer.module.css components/board/ThemeModal.tsx components/board/ThemeModal.module.css components/board/BoardRoot.tsx
rtk git commit -m "refactor(board): unify THEMES onto ChromeDrawer + activeDrawer state + CHROME_DRAWER z token"
```

---

## Task 3: SETTINGS（ExtensionEntry）を ChromeDrawer 化

**Files:**
- Modify: `components/board/ExtensionEntry.tsx`
- Modify: `components/board/ExtensionEntry.module.css`
- Modify: `components/board/ExtensionEntry.test.tsx`
- Modify: `components/board/BoardRoot.tsx`

**Interfaces:**
- Consumes: `ChromeDrawer`、`activeDrawer`/`setActiveDrawer`（Task 2）
- Produces: `ExtensionEntryProps` を外部制御化:
  ```ts
  export interface ExtensionEntryProps {
    readonly quickTagEnabled: boolean
    readonly onQuickTagToggle: (next: boolean) => void
    readonly onOpenBookmarkletModal: () => void
    readonly onReplayIntro?: () => void
    readonly isOpen: boolean            // ← forceOpen を置換（外部制御に一本化）
    readonly onOpenChange: (open: boolean) => void  // トリガー/内部から開閉要求
    readonly themeId: ThemeId
    readonly onOpenThemeModal: () => void
    readonly customWidthCount: number
    readonly onResetCardSizes: () => void
    readonly onSortNewestFirst: () => void
  }
  ```

- [ ] **Step 1: テストを更新（外部制御・click 化を検証）**

`components/board/ExtensionEntry.test.tsx` を新 props に合わせる。代表テスト:
```tsx
it('opens when the SETTINGS trigger is clicked', () => {
  const onOpenChange = vi.fn()
  render(<ExtensionEntry {...baseProps} isOpen={false} onOpenChange={onOpenChange} />)
  fireEvent.click(screen.getByTestId('extension-settings'))
  expect(onOpenChange).toHaveBeenCalledWith(true)
})
it('renders drawer content when isOpen', () => {
  render(<ExtensionEntry {...baseProps} isOpen onOpenChange={vi.fn()} />)
  expect(screen.getByTestId('quick-tag-toggle')).toBeTruthy()
  expect(screen.getByTestId('open-theme-modal')).toBeTruthy()
})
```
（`baseProps` は既存テストの props を新型へ移植。hover 前提の `fireEvent.mouseEnter` テストは click ベースへ差し替え。）

- [ ] **Step 2: 落ちるのを確認**

Run: `rtk vitest run components/board/ExtensionEntry.test.tsx`
Expected: FAIL

- [ ] **Step 3: ExtensionEntry を ChromeDrawer 化**

`components/board/ExtensionEntry.tsx`:
- `createPortal` / `measure()` / `pos` state / `useLayoutEffect`（resize/scroll listener）/ hover ハンドラ（`handleMouseEnter/Leave`/`leaveTimerRef`/`LEAVE_GRACE_MS`）/ 内部 `expanded` state / `closeNow` を**削除**。
- トリガーは click で `onOpenChange(true)`。中身は ChromeDrawer の children に:
```tsx
import { ChromeDrawer } from './ChromeDrawer'
export function ExtensionEntry(props: ExtensionEntryProps): ReactElement {
  const { isOpen, onOpenChange, quickTagEnabled, onQuickTagToggle, onOpenBookmarkletModal, onReplayIntro, themeId, onOpenThemeModal, customWidthCount, onResetCardSizes, onSortNewestFirst } = props
  const { t } = useI18n()
  // installed 検出・BackupStatus refreshKey 等の既存ロジックは残す
  return (
    <>
      <ChromeButton label="SETTINGS" onClick={(): void => onOpenChange(!isOpen)} aria-pressed={isOpen}
        data-testid="extension-settings" data-onboarding-target="settings" />
      <ChromeDrawer isOpen={isOpen} onClose={(): void => onOpenChange(false)} title="SETTINGS" testId="extension-settings-drawer">
        {/* 既存の SAVING / LAYOUT / THEME / HOW TO USE / EXTENSION セクションをそのまま移植。
            CHOOSE A THEME の onClick は closeNow() 廃止 → onOpenThemeModal() のみ（activeDrawer が themes へ切替＝settings は自動で閉じる） */}
        {/* ... 既存 sections（BackupButton/BackupStatus/themePickBtn 等）を <ChromeDrawer> の子に ... */}
      </ChromeDrawer>
    </>
  )
}
```
`ExtensionEntry.module.css` から `.wrap` / `.drawer` / `.drawerScroll` / `.scrollFade` / `.title`（ドロワーの外殻）を削除。中身のクラス（`.group` `.groupLabel` `.toggleRow` `.backupSection` `.themePickBtn` 等）は残す。paper override（`:388-503`）は Task 6 で削除。

- [ ] **Step 4: BoardRoot 配線を変更**

`components/board/BoardRoot.tsx`:
- 行 232 `forceSettingsOpen` state を削除。
- ExtensionEntry render（行 2403 付近）を新 props に:
  ```tsx
  <ExtensionEntry
    quickTagEnabled={quickTagEnabled}
    onQuickTagToggle={handleQuickTagToggle}
    onOpenBookmarkletModal={handleOpenBookmarkletModal}
    onReplayIntro={() => { void startOnboardingReplay() }}
    isOpen={activeDrawer === 'settings'}
    onOpenChange={(open) => setActiveDrawer(open ? 'settings' : null)}
    themeId={themeId}
    onOpenThemeModal={() => setActiveDrawer('themes')}
    customWidthCount={customWidthCount}
    onResetCardSizes={() => { void handleResetCardSizes() }}
    onSortNewestFirst={() => { void handleSortNewestFirst() }}
  />
  ```
- onboarding の settings beat（行 2639 `onSettingsBeatActive={setForceSettingsOpen}`）を `onSettingsBeatActive={(active: boolean) => setActiveDrawer(active ? 'settings' : null)}` に。

- [ ] **Step 5: テストが通るのを確認**

Run: `rtk vitest run components/board/ExtensionEntry.test.tsx`
Expected: PASS

- [ ] **Step 6: tsc ＋ 実機確認**

Run: `rtk tsc`（0）。dev で SETTINGS を**クリックで開く**（hover では開かない）／右ドロワー表示／CHOOSE A THEME で THEMES に切り替わり SETTINGS は閉じる／onboarding の settings beat で自動的に開くこと（playwright で onboarding replay を起動して確認、または settings beat の testid で確認）。

- [ ] **Step 7: Commit**

```bash
rtk git add components/board/ExtensionEntry.tsx components/board/ExtensionEntry.module.css components/board/ExtensionEntry.test.tsx components/board/BoardRoot.tsx
rtk git commit -m "refactor(board): move SETTINGS onto ChromeDrawer, external control, click-open"
```

---

## Task 4: SHARE（SenderShareModal）を ChromeDrawer 化【視覚リフロー注意】

**Files:**
- Modify: `components/share/SenderShareModal.tsx`
- Modify: `components/share/SenderShareModal.module.css`
- Modify: `components/share/SenderShareModal.test.tsx`
- Modify: `components/board/BoardRoot.tsx`

**Interfaces:**
- Consumes: `ChromeDrawer`、`activeDrawer`/`setActiveDrawer`
- Produces: `SenderShareModal` の `open`/`onClose` は据え置き（内部の backdrop/panel を ChromeDrawer に置換）。BoardRoot は `open={activeDrawer === 'share'}` で駆動。

**注意（リスク）:** 現状は中央モーダル（`min(720px)` 幅・backdrop blur ブロッキング）。右ドロワー（~400px・非ブロッキング）へ変更＝**中身（ShareMirror プレビュー＋actions）を ~400px 幅にリフロー**する。プレビューのアスペクトとボタン列が縦に収まるよう調整が要る。SELECT CARDS 選択モード（下部バー `ShareSelectBar` は独立）とは非ブロッキングでむしろ好相性（盤面が見えたまま選べる）。

- [ ] **Step 1: テストを更新**

`components/share/SenderShareModal.test.tsx` の既存モック（i18n/子/外部API）を維持しつつ、testid を ChromeDrawer 派生に合わせる。SHARE パネルの testid を `share-modal` に統一する例:
```tsx
it('renders share content in a drawer when open', () => {
  render(<SenderShareModal {...baseProps} open />)
  expect(screen.getByTestId('share-modal')).toBeTruthy()
  expect(screen.getByText('SHARE NOW')).toBeTruthy()
})
it('shows SELECT CARDS when onSelectCards provided and idle', () => {
  render(<SenderShareModal {...baseProps} open onSelectCards={vi.fn()} />)
  expect(screen.getByTestId('select-cards-button')).toBeTruthy()
})
```

- [ ] **Step 2: 落ちるのを確認**

Run: `rtk vitest run components/share/SenderShareModal.test.tsx`
Expected: FAIL

- [ ] **Step 3: SenderShareModal を ChromeDrawer 化**

`components/share/SenderShareModal.tsx`:
- `.backdrop` / `.panel` / `.header`（自前）と Esc/backdrop-click ハンドラを ChromeDrawer に移譲。`if (!open) return null` は ChromeDrawer 側 isOpen が担うので、`open` を ChromeDrawer に渡す。
- 隠し 1200×628 capture ノード（`captureRef`）は**そのまま残す**（ChromeDrawer の外＝Fragment の兄弟に置く）。
```tsx
import { ChromeDrawer } from '@/components/board/ChromeDrawer'
return (
  <>
    <ChromeDrawer isOpen={open} onClose={onClose} title="SHARE BOARD" testId="share-modal">
      <div className={styles.preview}>
        <ShareMirror items={items} positions={positions} /* ...既存props... */ themeId={themeId} custom={custom} frameRef={mirrorFrameRef} />
      </div>
      <p className={styles.hint}>{selectionActive ? '...' : '...'}</p>
      <div className={styles.actions}>
        {/* 既存の state machine（idle→SHARE NOW + SELECT CARDS / capturing / ready→COPY・SAVE IMAGE・POST TO X / error→RETRY）をそのまま。末尾 CLOSE は ChromeDrawer の × と重複するので撤去可 */}
      </div>
    </ChromeDrawer>
    {/* 隠し capture ノード（off-screen）はそのまま */}
    <div style={{ position: 'fixed', left: '-99999px', /* ... */ }} aria-hidden ref={captureRef}>
      <ShareMirror items={visibleItems} /* ... */ />
    </div>
  </>
)
```
`SenderShareModal.module.css`: `.backdrop` / `.panel` / `.panel::after` / `.header` / `.title` / `.closeIcon` / `@keyframes fadeIn`/`slideUp` を削除。`.preview` / `.hint` / `.actions` / ボタン系は**~400px 幅前提にリフロー**（`.preview` の幅・アスペクト、ボタン列を縦積み or 折返し）。

- [ ] **Step 4: BoardRoot 配線**

`components/board/BoardRoot.tsx`:
- 行 376 `shareModalOpen` state を削除。
- SHARE トリガー（行 2452）: `onClick={(): void => { if (!selectMode) setActiveDrawer('share') }}`
- SHARE render（行 2731 付近）: `open={activeDrawer === 'share'}` / `onClose={() => { setActiveDrawer(null); setShareSelectedIds(null) }}`
- `handleSelectShare`（行 1972 `setShareModalOpen(true)`）→ `setActiveDrawer('share')`
- onboarding share beat（行 2645 `setShareModalOpen(active)`）→ `setActiveDrawer(active ? 'share' : null)`

- [ ] **Step 5: テスト＋tsc**

Run: `rtk vitest run components/share/SenderShareModal.test.tsx && rtk tsc`
Expected: PASS / 0

- [ ] **Step 6: 実機で SHARE を確認【要目視】**

dev で SHARE をクリック→右ドロワーで開く／プレビューとボタンが ~400px 幅で崩れず収まる／SHARE NOW・SELECT CARDS・COPY・SAVE IMAGE が機能／選択モードで盤面が見えたまま選べる。**プレビューのリフロー品質はユーザー目視推奨**（レビュー checkpoint）。

- [ ] **Step 7: Commit**

```bash
rtk git add components/share/SenderShareModal.tsx components/share/SenderShareModal.module.css components/share/SenderShareModal.test.tsx components/board/BoardRoot.tsx
rtk git commit -m "refactor(share): move SHARE onto ChromeDrawer right-drawer, reflow to 400px"
```

---

## Task 5: TUNE（TuneTrigger）を ChromeDrawer 化【relayout＋scramble 注意】

**Files:**
- Modify: `components/board/TuneTrigger.tsx`
- Modify: `components/board/TuneTrigger.module.css`
- Modify: `components/board/TuneTrigger.test.tsx`
- Modify: `components/board/BoardRoot.tsx`

**Interfaces:**
- Consumes: `ChromeDrawer`、`activeDrawer`/`setActiveDrawer`
- Produces: `TuneTrigger` を外部制御化:
  ```ts
  type Props = {
    readonly widthPx: number
    readonly gapPx: number
    readonly onChangeWidth: (next: number) => void
    readonly onChangeGap: (next: number) => void
    readonly onReset: () => void
    readonly onApplyPreset: (id: PresetId) => void
    readonly isOpen: boolean          // ← 追加（外部制御）
    readonly onOpenChange: (open: boolean) => void  // ← 追加
    readonly label?: string
  }
  ```

**注意（リスク）:** TUNE は phase machine（`'idle-tune'|'opening'|'idle-readout'|'closing'`）でトリガー文字の scramble を hover 連動で駆動。**hover→click 化**と、開閉の scramble を `isOpen` の変化に駆動し直す。加えて横型ドロワー（presets 列＋faders＋ops legend）を ~400px 縦ドロワーに**relayout**。

- [ ] **Step 1: テストを更新（click 開＋isOpen 中身表示）**

`components/board/TuneTrigger.test.tsx`:
```tsx
it('requests open when the trigger is clicked', () => {
  const onOpenChange = vi.fn()
  render(<TuneTrigger {...baseProps} isOpen={false} onOpenChange={onOpenChange} />)
  fireEvent.click(screen.getByTestId('tune-trigger'))
  expect(onOpenChange).toHaveBeenCalledWith(true)
})
it('renders faders when isOpen', () => {
  render(<TuneTrigger {...baseProps} isOpen onOpenChange={vi.fn()} />)
  expect(screen.getByTestId('tune-drawer')).toBeTruthy()
})
```

- [ ] **Step 2: 落ちるのを確認**

Run: `rtk vitest run components/board/TuneTrigger.test.tsx`
Expected: FAIL

- [ ] **Step 3: TuneTrigger を ChromeDrawer 化**

`components/board/TuneTrigger.tsx`:
- hover ハンドラ（`handleMouseEnter/Leave`/`leaveTimerRef`/`LEAVE_GRACE_MS`）を削除。内部 `expanded` state を廃し、`isOpen` prop を使用。
- phase machine（scramble）は**残す**が、駆動を hover から `isOpen` 変化の effect に:
  ```tsx
  const prevOpen = useRef(isOpen)
  useEffect(() => {
    if (isOpen === prevOpen.current) return
    prevOpen.current = isOpen
    if (isOpen) startOpen(); else startClose()
  }, [isOpen, startOpen, startClose])
  ```
- トリガー button の `onClick` は `onOpenChange(!isOpen)`（reset セルの click 処理は据え置き）。
- ドロワーの中身（`TunePresetColumn` / `FaderColumn`×2 / opsLegend）を ChromeDrawer の children に移し、**縦 ~400px レイアウト**に。`.drawer`（`position:absolute;top:100%`）の外殻CSSは削除:
  ```tsx
  <>
    <button ref={btnRef} type="button" data-testid="tune-trigger" className={styles.trigger}
      aria-haspopup="dialog" aria-expanded={isOpen} onClick={(): void => onOpenChange(!isOpen)}
      data-glitch-text={visibleLabel}>{visibleLabel}</button>
    <ChromeDrawer isOpen={isOpen} onClose={(): void => onOpenChange(false)} title="TUNE" testId="tune-drawer">
      <div className={styles.tuneBody}>
        <TunePresetColumn widthPx={widthPx} gapPx={gapPx} onApply={onApplyPreset} />
        <div className={styles.faderGroup}>
          <FaderColumn scope="w" value={widthPx} min={BOARD_SLIDERS.CARD_WIDTH_MIN_PX} max={BOARD_SLIDERS.CARD_WIDTH_MAX_PX} def={BOARD_SLIDERS.CARD_WIDTH_DEFAULT_PX} onChange={onChangeWidth} label="W" />
          <FaderColumn scope="g" value={gapPx} min={BOARD_SLIDERS.CARD_GAP_MIN_PX} max={BOARD_SLIDERS.CARD_GAP_MAX_PX} def={BOARD_SLIDERS.CARD_GAP_DEFAULT_PX} onChange={onChangeGap} label="G" />
        </div>
        <div className={styles.opsLegend} aria-hidden="true">{/* 既存 opsRow ×5 */}</div>
      </div>
    </ChromeDrawer>
  </>
  ```
`TuneTrigger.module.css`: `.wrap` / `.drawer` / `.drawer[data-open]` / `.drawerDivider` / `.drawerRight` を削除。`.trigger` / `.faderGroup` / `.opsLegend` / `.opsRow` は残し、`.tuneBody` を新設（縦積み）。paper override（`:337-423`）と scramble 用CSSは Task 6 と scramble 維持方針に沿って扱う（scramble は残す）。

- [ ] **Step 4: BoardRoot 配線**

`components/board/BoardRoot.tsx` の TuneTrigger render（行 2400 付近）に `isOpen={activeDrawer === 'tune'}` / `onOpenChange={(open) => setActiveDrawer(open ? 'tune' : null)}` を追加。

- [ ] **Step 5: テスト＋tsc**

Run: `rtk vitest run components/board/TuneTrigger.test.tsx && rtk tsc`
Expected: PASS / 0

- [ ] **Step 6: 実機で TUNE を確認【要目視】**

dev で TUNE を**クリック**→右ドロワーで開く（hover では開かない）／W・G フェーダーが機能／プリセットが機能／トリガー文字の scramble が開閉で走る／縦レイアウトが崩れない。**relayout 品質はユーザー目視推奨**。

- [ ] **Step 7: Commit**

```bash
rtk git add components/board/TuneTrigger.tsx components/board/TuneTrigger.module.css components/board/TuneTrigger.test.tsx components/board/BoardRoot.tsx
rtk git commit -m "refactor(board): move TUNE onto ChromeDrawer, click-open, isOpen-driven scramble"
```

---

## Task 6: メニュー中立化（paper 装飾の除去）

**Files（paper スコープ・トークン参照・JS 分岐を削除）:**
- Modify CSS（`:global(html[data-theme-id='paper-atelier'])` ブロックと `--paper-panel-*`/`--chrome-*` 参照を削除）:
  - `components/board/ThemeModal.module.css`（残っていれば）
  - `components/board/ThemePicker.module.css:56-68`
  - `components/board/ThemeCustomizeSection.module.css:166-173`
  - `components/board/TunePresetColumn.module.css:261-299`
  - `components/board/ExtensionEntry.module.css:388-503`
  - `components/board/TuneTrigger.module.css:337-423`（scramble 非paperの基本演出は残す＝paper スコープのみ削除）
  - `components/board/FilterPill.module.css:508-649`
  - `components/board/TagAddPopover/TagAddPopover.module.css:119-161`
  - `components/board/ChromeButton.module.css:84-169`
  - `components/board/LanguageSwitcher.module.css:171-206`
  - `components/board/TopHeader.module.css:68-103`（paper 手書きインク罫線）
- Modify JS（`useIsPaperTheme` 分岐を削除。default 挙動に一本化）:
  - `components/board/ChromeButton.tsx:45,49-50`
  - `components/board/TuneTrigger.tsx:153`
  - `components/board/FilterPill.tsx:155`
- Modify（2ポップの中立フォント固定）:
  - `components/board/FilterPill.module.css`（`.menu` に `font-family: ui-monospace, "SF Mono", Consolas, monospace;` を明示）
  - `components/board/TagAddPopover/TagAddPopover.module.css`（`.popover` に同上）

**触らない（盤面＝維持）:** `ScrollMeter.module.css` / `RulerTrack` の paper（メーター）／`CardNode`/`CardSlideshow`（カード）／`BoardBackgroundTypography`（背景ワードマーク）／`TagIndicatorStrip.tsx:107`（カードのタグ washi）／`Lightbox.tsx:2084,2146`（盤面）／`ShareMirror.tsx:154`（共有画像＝盤面表現）／`chrome/`（額縁/封蝋）／globals.css の paper 盤面トークン。`--paper-panel-*` トークン**定義**は PiP/SaveToast が使うため残す（参照側の除去のみ）。

**Interfaces:** JS 分岐削除で `useIsPaperTheme` の import が menu 3ファイルから消える（`use-is-paper-theme.ts` 自体は TagIndicatorStrip/Lightbox が使うので残す）。

- [ ] **Step 1: 中立フォントの回帰テストを追加**

paper テーマ下でもメニューが serif を継承しない（＝ChromeDrawer が mono を pin、2ポップが mono を pin）ことは jsdom で computed style を取れないため、**代わりに「メニューコンポーネントの module.css に paper スコープが残っていない」ことを軽い grep 系テスト or 目視で担保**。ここでは実装後に実機検証（Step 4）を正とし、ユニットは既存テスト（testid ベース）が壊れないことを回帰基準とする。

- [ ] **Step 2: paper スコープ・トークン参照・JS分岐を削除**

上記 Files の各ブロックを削除。削除の指針:
- CSS: `:global(html[data-theme-id='paper-atelier']) { ... }` ブロックを丸ごと削除。`var(--paper-panel-*, fallback)` 参照は fallback 側（default 値）に置換 or 参照撤去（default で使っていた値を直書き）。`var(--chrome-btn-*, fallback)` / `var(--chrome-text-*, fallback)` はメニュー系では fallback（default）に固定。
- JS: `const isPaper = useIsPaperTheme()` と、それを使う分岐（`isPaper ? A : B`）を B（default 側）に一本化。未使用 import を削除。

- [ ] **Step 3: tsc ＋ 全ユニットテスト**

Run: `rtk tsc && rtk vitest run`
Expected: tsc 0 / vitest 全緑（既存 testid ベースのテストは中立化で壊れない想定。壊れたら paper 前提のアサーションを default 前提へ修正）。

- [ ] **Step 4: 実機で「paper のメニューが中立」を確認【要目視】**

dev で paper-atelier テーマに切替→ **盤面は従来どおり**（羊皮紙背景・カード装飾・ruler メーター・額縁/封蝋）／**メニュー（4ドロワー＋絞り込み＋＋タグ）は中立（羊皮紙化・serif が消え、default の暗い chrome）**。default テーマではメニュー・盤面とも従来どおり。playwright で paper 適用時に `theme-modal`/`extension-settings-drawer`/`tune-drawer`/`share-modal` パネルの背景が neutral（rgba(12,12,12,.94) 相当）であることを確認。

- [ ] **Step 5: Commit**

```bash
rtk git add -A
rtk git commit -m "refactor(theme): neutralize all menus (strip paper chrome), pin neutral font on pops"
```

---

## Task 7: 検証・e2e 更新・デプロイ

**Files:**
- Modify: `tests/e2e/board-theme.spec.ts`

- [ ] **Step 1: e2e を右ドロワー統一後の DOM に更新**

`tests/e2e/board-theme.spec.ts` の THEMES 起動・パネル selector を新 testid（`theme-modal` / `extension-settings-drawer` / `open-theme-modal`）に合わせる。onboarding-skip helper は既存流用（IDB に `settings`/`onboarding-completed` をセットして reload）。

- [ ] **Step 2: 盤面 byte-identical（限定）を確認**

Run: playwright で default テーマの盤面（カード/背景/メーター/モーション）が Task 前と一致することを実測（カードのスクショ or computed 値）。**メニューは対象外**（意図変化）。

- [ ] **Step 3: 全ゲート**

Run: `rtk tsc && rtk vitest run && rtk pnpm build`
Expected: tsc 0 / vitest 全緑 / build 成功（`out/` 生成）

- [ ] **Step 4: 通しの実機確認【要目視・レビュー checkpoint】**

dev（または本番デプロイ後）で:
- TUNE / SETTINGS / SHARE / テーマ選択 が**すべて右から同じ形で出る**／クリックで開く／同時に1枚だけ（別のを開くと前が閉じる）／Esc・外側クリック・×で閉じる。
- 絞り込み・＋タグ は**その場のまま**出る（中立見た目）。
- paper テーマ: 盤面は従来、メニューは中立。
- onboarding（replay）で settings/share beat が正しく開く。

- [ ] **Step 5: デプロイ**

```bash
rtk pnpm build
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true
```
ユーザーに「`allmarks.app` をハードリロードして確認」を案内。

- [ ] **Step 6: Commit（e2e 更新分）**

```bash
rtk git add tests/e2e/board-theme.spec.ts
rtk git commit -m "test(e2e): update board-theme spec for unified right-drawer chrome"
```

---

## Self-Review 記録

- **Spec coverage:** サブ① spec の §2.1 出方統一（Task 2-5）/ §2.2 中立化（Task 6）/ §3 テーマ境界（Task 6 の触らないリスト）/ §4 右ドロワー設計（Task 1-2）/ §5 検証（Task 7）/ §6 リスク（Task 4/5 に【注意】明記）/ §3.3 フォント継承（Task 1 の panel font-pin ＋ Task 6 の pops font-pin）/ §3.4 デッドトークン（Task 6 で定義は残す）— 全て対応タスクあり。
- **Placeholder scan:** コード欠落なし（CSS 削除は file:line 指定、実装コードは全掲載）。中身セクションの「既存移植」箇所は元の JSX が §抽出レポートに全掲載済のため実装者は参照可能。
- **Type consistency:** `activeDrawer: ActiveDrawer`（Task 2 定義）を Task 3/4/5 が一貫使用。`ExtensionEntryProps.isOpen/onOpenChange`、`TuneTrigger` の `isOpen/onOpenChange`、`ChromeDrawerProps`（isOpen/onClose/title/testId/children）が各タスクで整合。
- **リスク明示:** Task 4（SHARE 720→400 リフロー）と Task 5（TUNE relayout＋scramble）は視覚品質でユーザー目視 checkpoint 推奨。
