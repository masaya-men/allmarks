# スマホのアレンジ体験 作り直し 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** スマホのアレンジ画面を「専用ボトムドックにチロム集約＝画面最大／指＝カード・ボードズームはドックのボタン／9:16 縦画像／DELETE＝画像から外すだけ＋毎回トーストで母国語確認」に作り直し、PC にも「画像から外す」を追加する。

**Architecture:** ジェスチャー（`MobileArrangeGestures`）と取消/やり直しの中身・純関数は**流用（無改変）**。変えるのは (1) 比率定数 9:16、(2) チロムを1つの `MobileArrangeDock` に集約（`MobileArrangeTopBar`＋単体スライダー＋`MobileArrangeBar` を置換）、(3) ボードズームをドックの −/＋/fit ボタンに、(4) DELETE 時に母国語トースト、(5) PC のホバー×削除。全てモバイル経路＋（承認済み例外の）PC 削除のみ。

**Tech Stack:** Next.js 14 / TS strict / Vanilla CSS Modules / vitest + @testing-library/react / Playwright / i18n `useI18n`（`messages/*.json` 15言語）

**設計書（正本）:** `docs/superpowers/specs/2026-07-13-mobile-arrange-ux-redesign-design.md`

## Global Constraints

- TS strict / `any` 禁止 / return type 明示 / CSS `.module.css` / z-index は `BOARD_Z_INDEX`。
- **言語方針**: 1単語アクション＝英語 or アイコン。**説明文（削除トースト）＝母国語**（`t()`・新キーは `messages/*.json` **15言語すべて**に追加＝`all-keys-parity.test.ts` を通す）。
- **リンク payload（`buildArrangeShare`）は無改変**（DELETE は画像だけ）。共有サーバー・OG route・payload・`renderCollageCanvasToJpeg` 本体は無改変。
- **撮影は state ベース**。ボードズーム（−/＋/fit・2本指）は `stageTransform` のみ＝画像無影響。
- **ジェスチャー（`MobileArrangeGestures`）は無改変**（2本指ボードズーム温存）。取消/やり直しの純関数・ハンドラは流用。
- **デスクトップは PC 削除の追加を除きバイト同一**（PC 削除＝承認済みの意図的変更・撮影ロジック本体は無改変）。
- git `rtk` 前置・`--no-verify` 禁止・ASCII commit body。**vitest/Playwright は素の `npx`**。

## File Structure

- Modify `lib/share/mobile-band.ts`（＋ test）— `SHARE_PORTRAIT_ASPECT` を 9:16 に。
- Modify `messages/*.json`（15ファイル）— 削除トーストのキー追加。
- Create `components/board/MobileArrangeDock.tsx` ＋ `.module.css`（＋ test）— 集約ドック。
- Create `components/board/MobileArrangeToast.tsx` ＋ `.module.css`（or `UndoToast` 流用）— 削除の母国語トースト。
- Modify `components/board/BoardRoot.tsx` — ドック配線・ボードズーム step/fit・DELETE→トースト・旧チロム撤去・PC 削除ハンドラ汎用化。
- Modify `components/board/CollageCanvas.tsx` — PC（`!touchMode`）にホバー×（remove）。
- Modify `tests/e2e/mobile-share.spec.ts` — 9:16・ドック・ボードズームボタン・削除トースト＋payload不変・PC×。

---

### Task 1: 比率 9:16 【cheap 可】

**Files:** Modify `lib/share/mobile-band.ts`、`lib/share/mobile-band.test.ts`

- [ ] **Step 1: テストを 9:16 に更新（先に失敗させる）**

`mobile-band.test.ts` の `describe('mobileCollagePortraitBandRect ...')` ブロックを次に置換（クリーンな 9:16 値を使う＝360幅は 640高）:

```ts
describe('mobileCollagePortraitBandRect (9:16 portrait)', () => {
  it('inscribes a centred 9:16 band in a tall phone frame', () => {
    // 360x900: portrait band keeps full width, height = 360 * 1920/1080 = 640, y-centred
    expect(mobileCollagePortraitBandRect(360, 900)).toEqual({ x: 0, y: 130, width: 360, height: 640 })
  })
  it('keeps the 9:16 ratio and caps sides on a wide frame', () => {
    // 900x360 wide: keeps full height, width = 360 * 1080/1920 = 202.5, x-centred
    const b = mobileCollagePortraitBandRect(900, 360)
    expect(b).toEqual({ x: 348.75, y: 0, width: 202.5, height: 360 })
    expect(b.width / b.height).toBeCloseTo(1080 / 1920) // 0.5625 = 9:16
  })
  it('returns empty on a degenerate frame', () => {
    expect(mobileCollagePortraitBandRect(0, 900)).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })
})
```

- [ ] **Step 2: 実行して失敗を確認**

```bash
npx vitest run lib/share/mobile-band.test.ts
```
Expected: FAIL（現行は 1080×1350＝4:5 の値）。

- [ ] **Step 3: 定数を 9:16 に**

`lib/share/mobile-band.ts` L20:

```ts
export const SHARE_PORTRAIT_ASPECT = { WIDTH: 1080, HEIGHT: 1920 } as const
```

（`mobileCollagePortraitBandRect` は `collageBandRect(fw,fh, SHARE_PORTRAIT_ASPECT.WIDTH, SHARE_PORTRAIT_ASPECT.HEIGHT)` のままで自動追従。コメントの「4:5」表記があれば「9:16」に。BoardRoot は `SHARE_PORTRAIT_ASPECT.WIDTH/HEIGHT` を撮影 width/height に使っているので撮影も自動で 1080×1920 になる＝BoardRoot 変更不要。）

- [ ] **Step 4: 緑を確認 → Commit**

```bash
npx vitest run lib/share/mobile-band.test.ts
rtk git add lib/share/mobile-band.ts lib/share/mobile-band.test.ts
rtk git commit -m "feat(share): portrait share aspect 4:5 -> 9:16 (fill the phone)"
```

---

### Task 2: 削除トーストの i18n キー（15言語）【cheap 可・機械的】

**Files:** Modify `messages/*.json`（15ファイル: ar de en es fr it ja ko nl pt ru th tr vi …＝`messages/` の全 `.json`）

**Interfaces:** Produces: 翻訳キー `board.collageRemoveToast`（説明文）と `board.collageRemoveUndo`（"UNDO" 相当・ただし短い動作なので英語のままでも可＝下記）。

- [ ] **Step 1: 全 `messages/*.json` に同一階層でキー追加**

各ファイルの `board` オブジェクト内に、その言語で追加（例）:

- `en.json`: `"collageRemoveToast": "Removed from the image. Your link still has every URL you picked."`
- `ja.json`: `"collageRemoveToast": "画像から外しました。リンクには選んだURLが全部残っています。"`
- 他13言語も各母国語で同義訳（de/es/fr/it/ko/nl/pt/ru/th/tr/vi/ar）。**全15ファイルに必ず入れる**（parity テスト対象）。

（"UNDO" ボタンは1単語＝英語のまま or 矢印アイコンにするので i18n キーは不要。トースト本文のみ多言語化。）

- [ ] **Step 2: parity テストで欠けが無いか確認 → Commit**

```bash
npx vitest run messages/all-keys-parity.test.ts
```
Expected: PASS（15言語すべてに `board.collageRemoveToast` があること）。

```bash
rtk git add messages/
rtk git commit -m "i18n: collage remove toast copy (15 languages)"
```

---

### Task 3: `MobileArrangeDock` ＋ 削除トースト部品 【Sonnet 推奨】

**Files:** Create `components/board/MobileArrangeDock.tsx` / `.module.css` / `.test.tsx`、Create `components/board/MobileArrangeToast.tsx` / `.module.css`

**Interfaces:**
- Produces `MobileArrangeDock`（props: `canUndo`/`canRedo`/`onUndo`/`onRedo`/`onZoomOut`/`onZoomIn`/`onZoomFit`/`hasSelection`/`onBringToFront`/`onSendToBack`/`onRemove`/`onBack`/`onCreate`/`creating`）。testid: `mobile-arrange-dock`/`-undo`/`-redo`/`-zoom-out`/`-zoom-in`/`-zoom-fit`/`-to-front`/`-to-back`/`-remove`/`-back`/`-create`。
- Produces `MobileArrangeToast`（props: `message: string`/`onUndo: () => void`/`onDismiss: () => void`）＝body portal・`BOARD_Z_INDEX.UNDO_TOAST`・`data-no-capture`・数秒で `onDismiss`。`UndoToast.tsx` の作りを手本に。

- [ ] **Step 1: ドックのテスト（失敗）**

`MobileArrangeDock.test.tsx`（`vitest.setup.ts` に jest-dom あり）:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MobileArrangeDock } from './MobileArrangeDock'

const base = {
  canUndo: false, canRedo: false, onUndo: vi.fn(), onRedo: vi.fn(),
  onZoomOut: vi.fn(), onZoomIn: vi.fn(), onZoomFit: vi.fn(),
  hasSelection: false, onBringToFront: vi.fn(), onSendToBack: vi.fn(), onRemove: vi.fn(),
  onBack: vi.fn(), onCreate: vi.fn(), creating: false,
}

describe('MobileArrangeDock', () => {
  it('always shows undo/redo, zoom buttons, BACK and CREATE; hides selection tools with no selection', () => {
    render(<MobileArrangeDock {...base} />)
    for (const id of ['mobile-arrange-undo','mobile-arrange-redo','mobile-arrange-zoom-out','mobile-arrange-zoom-in','mobile-arrange-zoom-fit','mobile-arrange-back','mobile-arrange-create']) {
      expect(screen.getByTestId(id)).toBeInTheDocument()
    }
    expect(screen.queryByTestId('mobile-arrange-remove')).not.toBeInTheDocument()
  })
  it('shows TO FRONT / TO BACK / REMOVE when a card is selected and fires REMOVE', () => {
    const onRemove = vi.fn()
    render(<MobileArrangeDock {...base} hasSelection onRemove={onRemove} />)
    expect(screen.getByTestId('mobile-arrange-to-front')).toBeInTheDocument()
    screen.getByTestId('mobile-arrange-remove').click()
    expect(onRemove).toHaveBeenCalledOnce()
  })
  it('disables undo/redo per canUndo/canRedo and CREATE while creating', () => {
    render(<MobileArrangeDock {...base} canUndo creating />)
    expect(screen.getByTestId('mobile-arrange-undo')).toBeEnabled()
    expect(screen.getByTestId('mobile-arrange-redo')).toBeDisabled()
    expect(screen.getByTestId('mobile-arrange-create')).toBeDisabled()
  })
})
```

- [ ] **Step 2: 実行して失敗を確認**

```bash
npx vitest run components/board/MobileArrangeDock.test.tsx
```

- [ ] **Step 3: 実装（ドック＋トースト＋CSS）**

`MobileArrangeDock.tsx`（`'use client'`・`data-no-capture`・`BOARD_Z_INDEX.SHARE_TOAST`）。構成: 一番下＝大きな緑 `CREATE`；その上の細い段＝左に `↺`(undo)/`↻`(redo) アイコン、中央に `−`/`⤢`(fit)/`＋`、右に `BACK`；`hasSelection` の時だけ更に上に細い段 `前面へ`/`背面へ`/`🗑`(remove)。undo/redo と remove はアイコンのみ（`aria-label` は英語）、front/back は短い英語ラベル or アイコン、CREATE/BACK は英語。`creating` で CREATE を無効化＋`CREATING…`。

```tsx
'use client'

import type { ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import styles from './MobileArrangeDock.module.css'

export type MobileArrangeDockProps = {
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly onUndo: () => void
  readonly onRedo: () => void
  readonly onZoomOut: () => void
  readonly onZoomIn: () => void
  readonly onZoomFit: () => void
  readonly hasSelection: boolean
  readonly onBringToFront: () => void
  readonly onSendToBack: () => void
  readonly onRemove: () => void
  readonly onBack: () => void
  readonly onCreate: () => void
  readonly creating: boolean
}

export function MobileArrangeDock(props: MobileArrangeDockProps): ReactElement {
  return (
    <div className={styles.dock} style={{ zIndex: BOARD_Z_INDEX.SHARE_TOAST }} data-no-capture data-testid="mobile-arrange-dock">
      {props.hasSelection && (
        <div className={styles.rowContext} data-testid="mobile-arrange-selection-tools">
          <button type="button" className={styles.chip} onClick={props.onBringToFront} data-testid="mobile-arrange-to-front">TO FRONT</button>
          <button type="button" className={styles.chip} onClick={props.onSendToBack} data-testid="mobile-arrange-to-back">TO BACK</button>
          <button type="button" className={styles.chipDanger} onClick={props.onRemove} data-testid="mobile-arrange-remove" aria-label="Remove from image">🗑</button>
        </div>
      )}
      <div className={styles.rowTools}>
        <div className={styles.group}>
          <button type="button" className={styles.icon} onClick={props.onUndo} disabled={!props.canUndo} data-testid="mobile-arrange-undo" aria-label="Undo">↺</button>
          <button type="button" className={styles.icon} onClick={props.onRedo} disabled={!props.canRedo} data-testid="mobile-arrange-redo" aria-label="Redo">↻</button>
        </div>
        <div className={styles.group}>
          <button type="button" className={styles.icon} onClick={props.onZoomOut} data-testid="mobile-arrange-zoom-out" aria-label="Zoom out">−</button>
          <button type="button" className={styles.icon} onClick={props.onZoomFit} data-testid="mobile-arrange-zoom-fit" aria-label="Fit board">⤢</button>
          <button type="button" className={styles.icon} onClick={props.onZoomIn} data-testid="mobile-arrange-zoom-in" aria-label="Zoom in">＋</button>
        </div>
        <button type="button" className={styles.ghost} onClick={props.onBack} disabled={props.creating} data-testid="mobile-arrange-back">BACK</button>
      </div>
      <button type="button" className={styles.create} onClick={props.onCreate} disabled={props.creating} data-testid="mobile-arrange-create">
        {props.creating ? 'CREATING…' : 'CREATE'}
      </button>
    </div>
  )
}
```

`MobileArrangeDock.module.css`: `.dock{position:fixed;left:0;right:0;bottom:0;display:flex;flex-direction:column;gap:8px;padding:8px 12px calc(8px + env(safe-area-inset-bottom,0px));background:rgba(9,9,11,0.94);border-top:1px solid rgba(255,255,255,0.1);backdrop-filter:blur(20px) saturate(1.1);-webkit-backdrop-filter:blur(20px) saturate(1.1);font-family:ui-monospace,'SF Mono',Consolas,monospace;}` ＋ `.rowContext`/`.rowTools`（`display:flex;align-items:center;justify-content:space-between;gap:8px`）＋ `.group`（`display:flex;gap:6px`）＋ `.icon`/`.chip`/`.chipDanger`/`.ghost`（`min-height:40px;min-width:40px` 以上＝指サイズ）＋ `.create`（緑・`min-height:52px`・`MobileShareResult` の `.primary` と同素材）＋ `:disabled{opacity:.35}` ＋ `prefers-reduced-motion`。既存 `MobileArrangeBar.module.css` / `MobileShareResult.module.css` の色トークンに合わせる。

`MobileArrangeToast.tsx`（`UndoToast.tsx` を手本に）: body portal（`createPortal`）・`BOARD_Z_INDEX.UNDO_TOAST`・`data-no-capture`・`message` を表示＋"UNDO" ボタン（`onUndo`）＋`useEffect` で ~4秒後 `onDismiss`（`prefers-reduced-motion` 配慮）。文言 `message` は呼び出し側が `t()` で渡す。

- [ ] **Step 4: 緑を確認 → Commit**

```bash
npx vitest run components/board/MobileArrangeDock.test.tsx
rtk git add components/board/MobileArrangeDock.tsx components/board/MobileArrangeDock.module.css components/board/MobileArrangeDock.test.tsx components/board/MobileArrangeToast.tsx components/board/MobileArrangeToast.module.css
rtk git commit -m "feat(board): MobileArrangeDock (consolidated arrange chrome) + remove toast"
```

---

### Task 4: BoardRoot 配線（ドック差替え・ボードズーム・削除トースト）【Sonnet 推奨】

**Files:** Modify `components/board/BoardRoot.tsx`

**Interfaces:** Consumes Task 3 `MobileArrangeDock`/`MobileArrangeToast`、既存 `handleZoomSliderChange`/`STAGE_ZOOM_MIN`/`STAGE_ZOOM_MAX`/`IDENTITY_STAGE_TRANSFORM`/`handleCollageUndo`/`handleCollageRedo`/`handleBringSelectedToFront`/`handleSendSelectedToBack`/`handleShareReselect`/`handleMobileCaptureAndCreate`/`t`。

- [ ] **Step 1: import＋ボードズーム step/fit＋削除トースト state**

import に `MobileArrangeDock`、`MobileArrangeToast` を追加。`STAGE_ZOOM_MIN/MAX` は既に import 済（`stage-zoom`）。ハンドラ群の近くに追加:

```ts
  const BOARD_ZOOM_STEP = 1
  const handleBoardZoomIn = useCallback((): void => {
    handleZoomSliderChange(Math.min(STAGE_ZOOM_MAX, stageTransform.scale + BOARD_ZOOM_STEP))
  }, [handleZoomSliderChange, stageTransform.scale])
  const handleBoardZoomOut = useCallback((): void => {
    handleZoomSliderChange(Math.max(STAGE_ZOOM_MIN, stageTransform.scale - BOARD_ZOOM_STEP))
  }, [handleZoomSliderChange, stageTransform.scale])
  // fit = ズームを1倍に戻す（既存 handleDoubleTapFit と同じ）。
  const handleBoardZoomFit = useCallback((): void => setStageTransform(IDENTITY_STAGE_TRANSFORM), [])

  const [removeToast, setRemoveToast] = useState<boolean>(false)
```

`handleDeleteSelectedCollage`（既存）の末尾に `setRemoveToast(true)` を足す（外した時だけトーストを出す）。

- [ ] **Step 2: 旧チロムをドックに差替え**

`sharePhase === 'arrange'` の `<div data-no-capture>` 内（現行 L3896-3920 付近）の `isMobile ?` ブロックで、**`MobileArrangeTopBar` と `MobileArrangeBar` の2ブロックを `MobileArrangeDock` 1つに置換**（`hostedShareUrl === null && shareCreateState !== 'error'` の表示条件は踏襲・撮影中は CREATE のみ無効＝ドックは出す）:

```tsx
                {hostedShareUrl === null && shareCreateState !== 'error' && (
                  <MobileArrangeDock
                    canUndo={collageUndoStack.length > 0}
                    canRedo={collageRedoStack.length > 0}
                    onUndo={handleCollageUndo}
                    onRedo={handleCollageRedo}
                    onZoomOut={handleBoardZoomOut}
                    onZoomIn={handleBoardZoomIn}
                    onZoomFit={handleBoardZoomFit}
                    hasSelection={selectedCollageId !== null}
                    onBringToFront={handleBringSelectedToFront}
                    onSendToBack={handleSendSelectedToBack}
                    onRemove={handleDeleteSelectedCollage}
                    onBack={handleShareReselect}
                    onCreate={(): void => { void handleMobileCaptureAndCreate() }}
                    creating={shareCreateState === 'creating'}
                  />
                )}
```

（`MobileArrangeTopBar` / `MobileArrangeBar` / `MobileZoomSlider` の import と JSX は撤去。`MobileArrangeTopBar.tsx`・`MobileArrangeBar.tsx`・`MobileZoomSlider.tsx` 本体ファイルは残してよい＝未使用 import になるなら BoardRoot からの import 行のみ削除。lint が未使用 export を怒らなければ放置可。）

- [ ] **Step 3: 削除トーストをマウント**

同じ `<div data-no-capture>` 内 or その近くに（`removeToast` の時）:

```tsx
                {removeToast && (
                  <MobileArrangeToast
                    message={t('board.collageRemoveToast')}
                    onUndo={(): void => { handleCollageUndo(); setRemoveToast(false) }}
                    onDismiss={(): void => setRemoveToast(false)}
                  />
                )}
```

- [ ] **Step 4: 検証 → Commit**

```bash
rtk tsc
npx vitest run
pnpm build
```
Expected: tsc 0 / vitest 緑 / build OK（`assert-share-template OK`）。デスクトップ経路は無改変（ドックは `isMobile` ブロック内）。

```bash
rtk git add components/board/BoardRoot.tsx
rtk git commit -m "feat(board): swap mobile arrange chrome to MobileArrangeDock; board-zoom buttons + remove toast; 9:16 capture via constant"
```

---

### Task 5: PC（デスクトップ）に「画像から外す」ホバー× 【Sonnet 推奨】

**Files:** Modify `components/board/CollageCanvas.tsx`、`components/board/BoardRoot.tsx`

- [ ] **Step 1: 削除ハンドラを id 引数で汎用化（BoardRoot）**

既存 `handleDeleteSelectedCollage`（選択カードを外す）に加え、**id を直接受ける**汎用版を追加（PC のホバー×用）。共通ロジックを切り出し:

```ts
  const removeCollageCardById = useCallback((id: string): void => {
    if (!id) return
    pushHistoryBeforeDiscreteEdit()
    const s = collageStateRef.current
    const r = removeFromCollage(s.positions, s.order, s.rotations, id)
    setCollagePositions(r.positions)
    setCollageOrder(r.order)
    setCollageRotations(r.rotations)
    setSelectedCollageId((cur) => (cur === id ? null : cur))
    setRemoveToast(true)
  }, [pushHistoryBeforeDiscreteEdit])
```

`handleDeleteSelectedCollage` は `removeCollageCardById(selectedCollageId ?? '')` を呼ぶ薄いラッパに。

- [ ] **Step 2: CollageCanvas に任意 prop `onRemoveCard?` ＋ PC ホバー×**

`CollageCanvasProps` に `readonly onRemoveCard?: (id: string) => void` を追加。`!props.touchMode`（＝デスクトップ）の枝（現行の `ResizeHandle`/回転ノブと同じ場所）に、カード右上のホバー×を追加（`data-no-capture`・`stopPropagation` で移動を始めない）:

```tsx
            {!props.touchMode && props.onRemoveCard && (
              <button
                type="button"
                className={styles.removeButton}
                data-testid={`collage-remove-${id}`}
                data-no-capture
                aria-label="Remove from image"
                onPointerDown={(e): void => { e.stopPropagation() }}
                onClick={(e): void => { e.stopPropagation(); props.onRemoveCard?.(id) }}
              >
                ×
              </button>
            )}
```

`CollageCanvas.module.css` に `.removeButton`（絶対配置・右上・ホバーで出る＝`.element:hover .removeButton{opacity:1}`／既定 `opacity:0`・`pointer-events` は出ている時のみ・`min-width/height:24px`・`z-index:31`＝ノブ40未満/枠30近傍）。既存 `.rotateHandle` のホバー流儀に合わせる。

- [ ] **Step 3: BoardRoot で CollageCanvas に配線**

`CollageCanvas` の props に、**PC のみ**（＝`!isMobile` の時に付ける／モバイルはドックの REMOVE を使うので `undefined`）:

```tsx
              onRemoveCard={!isMobile ? removeCollageCardById : undefined}
```

（トーストは PC でも出る＝`removeToast` は共通。PC のトーストも `MobileArrangeToast`＝body portal で画面下に出る。「Mobile」名だが共通利用でよい／名前が気になるなら後日改名。）

- [ ] **Step 4: 検証 → Commit**

```bash
rtk tsc
npx vitest run components/board/CollageCanvas.test.tsx
pnpm build
```
Expected: tsc 0 / 既存 CollageCanvas テスト緑（新 prop は任意）／build OK。**デスクトップは×追加＝承認済みの意図的変更**（撮影ロジック本体は無改変）。

```bash
rtk git add components/board/CollageCanvas.tsx components/board/CollageCanvas.module.css components/board/BoardRoot.tsx
rtk git commit -m "feat(board): desktop hover-x to remove a card from the collage image (parity with mobile)"
```

---

### Task 6: e2e ＋ 全体ゲート 【Sonnet 推奨】

**Files:** Modify `tests/e2e/mobile-share.spec.ts`

- [ ] **Step 1: e2e を作り直しに追随**

既存の到達（SHARE→全選択→ARRANGE）は流用。更新/追加:
- **チロム**: `mobile-arrange-topbar` は**もう無い**（`toHaveCount(0)`）／`mobile-arrange-dock` が visible。`mobile-arrange-undo`/`-redo`/`-zoom-out`/`-zoom-in`/`-zoom-fit`/`-back`/`-create` が visible。
- **ボードズーム（ボタン）**: `mobile-arrange-zoom-in` を数回 → `mobile-arrange-stage` の transform scale > 1／`mobile-arrange-zoom-fit` → scale が 1 に戻る。（既存の2本指ボードズームのテストは**残す＝温存**。）
- **DELETE→トースト＋payload不変**: カード選択 → `mobile-arrange-remove` → 撮影カード（`collage-el-`）が1減る／トースト（`MobileArrangeToast` の testid・下記で付与）表示／トーストの UNDO でカード復帰。**リンク payload は選択数のまま**＝`stubCreate` で受けた `buildShare` の項目数が削除前の選択数と一致（＝リンクは減らない）を検証。
- **プレビュー 9:16**: プレビュー画像の `naturalWidth/Height === 1080 / 1920`（既存の 1080×1350 assert を更新）。帯高の式も 9:16（`vw*(1920/1080)`）に。SEED_COUNT は 9:16 帯で「全行が両端に届く」よう再校正（段階1と同じ方法＝行が割り切れる枚数を選ぶ）。
- **PC（デスクトップ describe）**: `mobile-arrange-dock` は count 0／デスクトップでカードに `collage-remove-<id>` がホバーで出る（or 存在する）→ クリックでカードが減る／payload 不変。

（`MobileArrangeToast` に `data-testid="mobile-arrange-remove-toast"` を付けておく＝Task 3 で付与。）

- [ ] **Step 2: 実行**

```bash
npx playwright test tests/e2e/mobile-share.spec.ts
```
Expected: 全緑。`rtk npx` は使わない。

- [ ] **Step 3: Commit**

```bash
rtk git add tests/e2e/mobile-share.spec.ts
rtk git commit -m "test(e2e): mobile arrange redesign (dock, board-zoom buttons, remove toast + link unchanged, 9:16, desktop hover-x)"
```

- [ ] **Step 4: 全体ゲート（コントローラ）→ デプロイ→実機確認依頼**

```bash
rtk tsc && npx vitest run && pnpm build
npx playwright test tests/e2e/mobile-share.spec.ts
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true
```

実機確認（コピペ用）:
```
スマホで https://allmarks.app をハードリロード → SHARE → 全選択 → ARRANGE:
1. 画面がほぼコラージュで、下に細い専用バー（↺↻ / − ⤢ ＋ / BACK / CREATE）だけになっているか。
2. カードをタップ → 下に 前面へ/背面へ/🗑 が出るか。1本指移動・2本指で拡縮回転できるか。
3. − ＋ でボードが拡縮、⤢ で全体表示に戻るか。
4. 🗑 で画像から外れ、「画像から外しました（母国語）」トーストが出て、UNDO で戻るか。
5. CREATE の画像が縦長(9:16)でスマホを埋める形か。貼ったリンクのカードは横長中央に縦帯か。
PC でも SHARE→並べる→カードにマウスを乗せると × が出て、押すと画像から外れる（リンクは減らない）か。
```

---

## Self-Review（実装者への注意）

- **ジェスチャーと取消/やり直しの中身は無改変**。触るのはチロムの置き方・比率定数・削除の PC 追加・トースト・配線のみ。
- **DELETE は画像だけ**＝`buildArrangeShare`（リンク）は無改変。削除トーストで毎回それを母国語で伝える。
- **9:16 は定数1箇所**（`SHARE_PORTRAIT_ASPECT`）＝撮影 width/height・帯・レターボックス元が自動追従。サーバー/OG 無改変。
- **デスクトップは PC 削除の追加のみが意図的変更**、撮影ロジック本体・共有経路は無改変。
- 実タッチ・実際の見えは実機のみ。
