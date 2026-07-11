# N-58: スマホでもコラージュさせる（編集段の解禁・段階1）＋ N-55 同時解消 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** s185 の「CREATE で即撮影」を「ARRANGE で編集段に入る → 指で動かす・回す・大きさを変える → CREATE で撮影」に変える。スマホでも表現（コラージュ）できるようにする（ユーザーが s185 の決定を実機体験で撤回した件）。同時に N-55（撮影成功後もコラージュがシートの裏で触れる）をタッチ遮蔽で消す。

**Architecture:** 撮影の不変条件は**一切変えない**：帯（画面に内接する中央の 1.91:1 矩形）に配置し、`.outerFrame` を `fit:'cover'` で撮り、`computeCoverRect` が中央＝帯を切り出す。変えるのは**タイミングだけ**＝`handleMobileCreateShare`（配置→即撮影）を `handleMobileEnterArrange`（配置して止まる）と `handleMobileCaptureAndCreate`（撮影→リンク）に**二分割**する。編集 UI は既存 `CollageCanvas` がそのまま働く（移動・リサイズ・回転は実装済み、回転ノブは `@media (hover:none)` で表示済み）。新規は「帯の範囲を示す減光ガイド」と「編集段のボトムバー」の2部品のみ。**帯より外は画像に写らない**ことをガイドの減光がそのまま伝える（WYSIWYG）。

**Tech Stack:** Next.js 14 App Router / TypeScript strict / Vanilla CSS Modules / vitest + @testing-library/react / Playwright

**前提（依存）:** この計画は **n56 計画（`2026-07-11-n56-mobile-share-image-fix.md`）の実装後**に実行する。Task 3 が `captureCollageShareImageDetailed` / `setCaptureAttempts` / `setShareErrorMessage` を参照する。万一 N-56 未実装で先行する場合は、撮影ブロックを現行の `captureCollageShareImage(frame, {...})` のまま移植する（診断部分だけ落ちる）。

## 設計判断（s186 でユーザー回答を受けて更新）

- **最終ゴール（ユーザー確定 s186）**: スマホでも**上限の 100 枚**でコラージュを作れること。**ピンチイン/アウトで画面（ステージ）自体を拡縮しながら**、個々のカードも拡縮して編集できること（世のコラージュアプリと同じ操作感）。
- **段階1（この計画）**: 編集段を開けること自体が先。帯は実寸のまま（390px 幅の画面で 390×204）。少数枚なら実寸でも編集は成立する。「簡素でもコラージュしたい」への最短の一手＋段階2の土台（Enter/Capture の分割・帯ガイド・スクリム）。
- **段階2（次のセッションで実装・任意ではなく確定）**: ステージのピンチズーム＋パン。方式は決定済み＝**編集中だけ wrapper に CSS transform（scale+translate）を掛け、撮影直前に transform をリセットして撮る**（撮影系は 1 行も変わらない）。注意点: CollageCanvas のドラッグ量はスクリーン px なので、**ズーム中はポインタ差分を zoom 倍率で割って**レイアウト座標に戻す配線が要る（`handleElementPointerDown` 系に zoom を渡す）。2 本指=ステージ拡縮/パン、1 本指=カード操作、の判別も段階2の本体。100 枚は段階2で実用になる。
- **タイトル編集はスコープ外**（`setShareTitle(null)` を維持）。デスクトップの `ShareTitleElement` をスマホに出すかは N-57 の結果と合わせて別途ユーザー判断。
- リサイズの四隅アーク（hover 表示）はタッチでは見えないが**掴めば効く**（s184 実測）。常時表示は視覚ノイズになるため段階1では変えない。段階2のズームと合わせて再評価。
- **さらに先（別アイデア・IDEAS.md s186 節）**: clipart.studio 型の「切り抜き」コラージュ構想あり。段階1/2 の設計はそれを妨げない（切り抜き済み画像もただの要素として同じステージに載る）。

## Global Constraints

- TypeScript `strict: true`。`any` 禁止。return type 明示。CSS は `.module.css`。Tailwind / Framer Motion 禁止
- z-index は `BOARD_Z_INDEX`（`lib/board/constants.ts`）に定数を足して使う（магic number 禁止）
- UI 文言は世界に通じる英語・乾いた事実調（`ARRANGE` / `CREATE` / `BACK` / `DRAG TO ARRANGE`）。i18n キーは足さない（board chrome は英語リテラルが既定）
- 押せるものは 52px 以上
- **デスクトップ（>640px）の描画・挙動はバイト同一**。新 UI は全て `isMobile` ゲートの内側
- **撮影の不変条件を守る**: 帯=中央 1.91:1、`fit:'cover'` 固定、レプリカ禁止、`data-no-capture` の徹底（新部品は全部付ける）
- 撮影失敗でもリンクは作る（N-56 の診断表示に接続済み）
- git は `rtk` 前置。`--no-verify` 絶対禁止

## 事実の索引（s186 調査済み・実装者は信じてよいが行番号のズレは関数名で吸収）

- `handleMobileCreateShare`: [BoardRoot.tsx](../../../components/board/BoardRoot.tsx) 2454-2513（配置→2フレーム→撮影→リンクの一体関数）
- `sharePhase`: `'select' | 'arrange' | null`（BoardRoot.tsx:429）。ボトムナビは `sharePhase === null` の時だけ描画（:2982）
- `MobileShareSelectBar` の CREATE ボタン: `data-testid="mobile-select-create"`（MobileShareSelectBar.tsx:50）、配線は BoardRoot.tsx:3552-3559
- `CollageCanvas` は編集操作フル装備（move/resize/rotate、`CollageCanvas.tsx:113-150,263-276`）。回転ノブは touch で常時表示＋`data-no-capture` 済（`CollageCanvas.module.css:71-75`、`CollageCanvas.tsx:228-233`）
- `MobileShareResult` は **bottom sheet（inset:0 ではない）・scrim 無し**（`MobileShareResult.module.css:3-18`）→ シートの上の領域でコラージュが触れる＝N-55
- z-index: CollageCanvas root = `SHARE_CANVAS: 95`、シート = `SHARE_TOAST: 402`。**96 と 399 は空き**（constants.ts:82-112 確認済み）
- カード面は `CardNode` ＝ `touch-action: none` 既定（`[data-lock-card-scroll]` 祖先が無い collage ではロック解除されない）→ カード上の指ドラッグはスクロールに奪われない

---

### Task 1: z-index 定数と帯ガイド `MobileBandOverlay` 【Haiku 可】

**Files:**
- Modify: `lib/board/constants.ts`（`BOARD_Z_INDEX` に 2 定数追加）
- Create: `components/board/MobileBandOverlay.tsx`
- Create: `components/board/MobileBandOverlay.module.css`
- Test: `components/board/MobileBandOverlay.test.tsx`

**Interfaces:**
- Consumes: `CollageFitRect`（`lib/share/collage-layout.ts:79-84`）
- Produces: `MobileBandOverlay({ band: CollageFitRect })` — 帯の位置に置く減光ガイド。`BOARD_Z_INDEX.SHARE_BAND_OVERLAY = 96` / `BOARD_Z_INDEX.SHARE_RESULT_SCRIM = 399`

- [ ] **Step 1: 定数追加**

`lib/board/constants.ts` の `BOARD_Z_INDEX` 内、`SHARE_CANVAS: 95,` の行の直後に:

```ts
  SHARE_BAND_OVERLAY: 96,  // スマホ編集段の「撮影される帯」ガイド — SHARE_CANVAS(95) の直上・DRAG_GHOST(100) 未満。pointer-events:none で編集を邪魔しない。
  SHARE_RESULT_SCRIM: 399, // スマホ結果シート表示中にコラージュへのタッチを遮る透明盾 (N-55) — SHARE_CANVAS(95) より上・SHARE_TOAST(402) 未満。
```

- [ ] **Step 2: Write the failing test**

`components/board/MobileBandOverlay.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MobileBandOverlay } from './MobileBandOverlay'

describe('MobileBandOverlay', () => {
  it('positions itself exactly on the band rect and stays out of the capture', () => {
    render(<MobileBandOverlay band={{ x: 0, y: 319.625, width: 390, height: 204.75 }} />)
    const el = screen.getByTestId('mobile-band-overlay')
    expect(el.style.left).toBe('0px')
    expect(el.style.top).toBe('319.625px')
    expect(el.style.width).toBe('390px')
    expect(el.style.height).toBe('204.75px')
    expect(el.getAttribute('data-no-capture')).not.toBeNull()
  })

  it('renders nothing for a degenerate band', () => {
    const { container } = render(<MobileBandOverlay band={{ x: 0, y: 0, width: 0, height: 0 }} />)
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 3: Run to verify it fails**

```bash
rtk npx vitest run components/board/MobileBandOverlay.test.tsx
```

- [ ] **Step 4: Implement**

`components/board/MobileBandOverlay.tsx`:

```tsx
'use client'

import type { ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import type { CollageFitRect } from '@/lib/share/collage-layout'
import styles from './MobileBandOverlay.module.css'

export type MobileBandOverlayProps = {
  /** 撮影される 1.91:1 の帯（.outerFrame 座標）。 */
  readonly band: CollageFitRect
}

/** スマホのコラージュ編集中に「この範囲が画像になる」を示すガイド。帯の外側を
 *  巨大な box-shadow で減光し（＝写らない領域がそのまま暗く見える WYSIWYG）、
 *  境界は細い破線。pointer-events:none なので帯の内外どちらの編集も邪魔しない。
 *  data-no-capture なので撮影には写らない。 */
export function MobileBandOverlay(props: MobileBandOverlayProps): ReactElement | null {
  const { band } = props
  if (band.width <= 0 || band.height <= 0) return null
  return (
    <div
      className={styles.band}
      data-no-capture
      data-testid="mobile-band-overlay"
      style={{
        left: `${band.x}px`,
        top: `${band.y}px`,
        width: `${band.width}px`,
        height: `${band.height}px`,
        zIndex: BOARD_Z_INDEX.SHARE_BAND_OVERLAY,
      }}
    />
  )
}
```

`components/board/MobileBandOverlay.module.css`:

```css
.band {
  position: absolute;
  pointer-events: none;
  border: 1px dashed rgba(255, 255, 255, 0.45);
  /* 帯の外側だけを減光する。内側（＝画像に写る範囲）は素通し。 */
  box-shadow: 0 0 0 4000px rgba(0, 0, 0, 0.55);
}
```

- [ ] **Step 5: Run to verify it passes → Commit**

```bash
rtk npx vitest run components/board/MobileBandOverlay.test.tsx
rtk git add lib/board/constants.ts components/board/MobileBandOverlay.tsx components/board/MobileBandOverlay.module.css components/board/MobileBandOverlay.test.tsx
rtk git commit -m "feat(share): capture-band guide overlay for the mobile arrange stage (N-58)"
```

---

### Task 2: 編集段のボトムバー `MobileArrangeBar` 【Haiku 可】

**Files:**
- Create: `components/board/MobileArrangeBar.tsx`
- Create: `components/board/MobileArrangeBar.module.css`
- Test: `components/board/MobileArrangeBar.test.tsx`

**Interfaces:**
- Consumes: なし
- Produces: `MobileArrangeBar({ onBack: () => void; onCreate: () => void; creating: boolean })`
  - `BACK` = 選び直し（select へ戻る）、`CREATE` = 撮影してリンク作成（creating 中は disabled）

- [ ] **Step 1: Write the failing test**

`components/board/MobileArrangeBar.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MobileArrangeBar } from './MobileArrangeBar'

describe('MobileArrangeBar', () => {
  it('fires onBack / onCreate and stays out of the capture', () => {
    const onBack = vi.fn()
    const onCreate = vi.fn()
    render(<MobileArrangeBar onBack={onBack} onCreate={onCreate} creating={false} />)
    expect(screen.getByTestId('mobile-arrange-bar').getAttribute('data-no-capture')).not.toBeNull()
    fireEvent.click(screen.getByTestId('mobile-arrange-back'))
    expect(onBack).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('mobile-arrange-create'))
    expect(onCreate).toHaveBeenCalledTimes(1)
  })

  it('disables CREATE while creating', () => {
    render(<MobileArrangeBar onBack={() => {}} onCreate={() => {}} creating={true} />)
    expect(screen.getByTestId('mobile-arrange-create')).toBeDisabled()
    expect(screen.getByTestId('mobile-arrange-create').textContent).toBe('CREATING…')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
rtk npx vitest run components/board/MobileArrangeBar.test.tsx
```

- [ ] **Step 3: Implement**

`components/board/MobileArrangeBar.tsx`:

```tsx
'use client'

import type { ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import styles from './MobileArrangeBar.module.css'

export type MobileArrangeBarProps = {
  /** 選び直し（select 段へ戻る）。編集内容は破棄される。 */
  readonly onBack: () => void
  /** いまの配置のまま撮影してリンクを作る。 */
  readonly onCreate: () => void
  /** 撮影〜リンク作成中は CREATE を無効化。 */
  readonly creating: boolean
}

/** スマホのコラージュ編集段のボトムバー。デスクトップの ShareToast(CREATE) の
 *  モバイル版に相当する。data-no-capture なので撮影には写らない。 */
export function MobileArrangeBar(props: MobileArrangeBarProps): ReactElement {
  return (
    <div
      className={styles.bar}
      style={{ zIndex: BOARD_Z_INDEX.SHARE_TOAST }}
      data-no-capture
      data-testid="mobile-arrange-bar"
    >
      <span className={styles.hint}>DRAG TO ARRANGE — THE BRIGHT BAND BECOMES THE IMAGE</span>
      <div className={styles.actions}>
        <button type="button" className={styles.ghost} onClick={props.onBack} data-testid="mobile-arrange-back">
          BACK
        </button>
        <button
          type="button"
          className={styles.primary}
          onClick={props.onCreate}
          disabled={props.creating}
          data-testid="mobile-arrange-create"
        >
          {props.creating ? 'CREATING…' : 'CREATE'}
        </button>
      </div>
    </div>
  )
}
```

`components/board/MobileArrangeBar.module.css` — **`.bar` と `.hint` は下記のとおり新規**。`.actions` / `.primary` / `.ghost` は**既存 `MobileShareResult.module.css` の同名クラスの中身をそのままコピー**する（結果シートとボタンの見た目を完全一致させるため。コピー元を読み、値を変えずに写すこと）:

```css
/* N-58: コラージュ編集段のボトムバー。MobileShareResult のシートと同素材。 */
.bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px));
  background: rgba(9, 9, 11, 0.94);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px) saturate(1.1);
  -webkit-backdrop-filter: blur(20px) saturate(1.1);
}

.hint {
  font-size: 10px;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.55);
  text-align: center;
}

/* .actions / .primary / .ghost は MobileShareResult.module.css からコピー（52px 最小高を含む） */
```

- [ ] **Step 4: Run to verify it passes → Commit**

```bash
rtk npx vitest run components/board/MobileArrangeBar.test.tsx
rtk git add components/board/MobileArrangeBar.tsx components/board/MobileArrangeBar.module.css components/board/MobileArrangeBar.test.tsx
rtk git commit -m "feat(share): bottom bar for the mobile arrange stage (N-58)"
```

---

### Task 3: BoardRoot の二分割配線＋N-55 スクリム 【Sonnet 推奨（大ファイルの配線）】

**Files:**
- Modify: `components/board/BoardRoot.tsx`
- Modify: `components/board/BoardRoot.module.css`（スクリム 1 クラス追加）
- Modify: `components/board/MobileShareSelectBar.tsx`（ラベル CREATE → ARRANGE。testid は不変）
- Modify: `components/board/CollageCanvas.module.css`（モバイルで stage の touch-action を切る）

**Interfaces:**
- Consumes: Task 1 の `MobileBandOverlay` / `SHARE_RESULT_SCRIM`、Task 2 の `MobileArrangeBar`、n56 の `captureCollageShareImageDetailed`
- Produces:
  - `handleMobileEnterArrange(): void` — 帯に自動配置して**止まる**（撮影しない）
  - `handleMobileCaptureAndCreate(): Promise<void>` — いまの配置で撮影→リンク作成（**再配置しない**＝RETRY で編集が消えない）
  - state `mobileBandRect: CollageFitRect | null`

- [ ] **Step 1: state 追加**

`collageRotations` の useState 宣言の近くに:

```ts
  // スマホ編集段の帯（.outerFrame 座標）。arrange 進入時に確定し、CREATE の撮影倍率と
  // 帯ガイドの描画が同じ値を共有する。exit で null に戻す。
  const [mobileBandRect, setMobileBandRect] = useState<CollageFitRect | null>(null)
```

import: `import type { CollageFitRect } from '@/lib/share/collage-layout'`（既に import があれば追記不要）。
`import { MobileBandOverlay } from './MobileBandOverlay'` / `import { MobileArrangeBar } from './MobileArrangeBar'` を追加。

- [ ] **Step 2: `handleMobileCreateShare` を 2 関数に分割**

既存 `handleMobileCreateShare`（2454-2513 近辺）を**削除**し、同じ場所に:

```ts
  /** スマホの ARRANGE: 選択カードを帯に自動配置して編集段に入る（撮影はまだしない・N-58）。 */
  const handleMobileEnterArrange = useCallback((): void => {
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
    setShareCreateState('idle')
    setCaptureAttempts(null)
    setShareErrorMessage(null)
    setMobileBandRect(band)
    setSharePhase('arrange')
  }, [selectedIds, lightboxNavItems, customWidths, cardWidthPx, viewport.w, viewport.h])

  /** スマホの CREATE: いまの配置のまま撮影してリンクを作る（再配置しない・N-58）。 */
  const handleMobileCaptureAndCreate = useCallback(async (): Promise<void> => {
    const frame = boardFrameRef.current
    const band = mobileBandRect
    if (!band) return
    setCapturedImageUrl(null)
    setHostedShareUrl(null)
    setCaptureAttempts(null)
    setShareErrorMessage(null)
    setShareCreateState('creating')

    let thumb: string | null = null
    if (frame && typeof requestAnimationFrame === 'function') {
      setCapturing(true)
      // 帯ガイド等の [data-no-capture] を隠す CSS が確実に paint されてから撮る。
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
      try {
        const outcome = await captureCollageShareImageDetailed(frame, {
          origin: shareOrigin(),
          boardColor: deriveCaptureBoardColor(),
          fit: 'cover',
          // 帯の幅（画面幅ではない）を渡す — 切り出す帯が原寸 1200px の raster になる。
          scale: mobileCaptureScale(band.width),
          fallbackScales: [1],
          rejectUniform: true,
        })
        thumb = outcome.dataUrl
        setCaptureAttempts(outcome.attempts)
      } finally {
        setCapturing(false)
      }
    } else {
      setCaptureAttempts([{ scale: 1, timeoutMs: 0, elapsedMs: 0, stage: 'no-frame', message: null }])
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
      setShareErrorMessage(res.message)
      setShareCreateState('error')
    }
  }, [mobileBandRect, buildArrangeShare, deriveCaptureBoardColor])
```

※ 依存配列は上記のとおり（`selectedIds` 等は Enter 側だけが持つ）。`handleMobileCreateShare` への参照が残っていないことを `rtk grep handleMobileCreateShare` で確認して全て置換する。

- [ ] **Step 3: 出口と選択バーの配線**

1. `handleExitShareMode`（2228-2238 近辺）に `setMobileBandRect(null)` を追加。
2. `MobileShareSelectBar` の配線（3552-3559 近辺）: `onCreate={(): void => { void handleMobileCreateShare() }}` → `onCreate={handleMobileEnterArrange}`（同期関数になるので `void` 不要）。
3. `MobileShareSelectBar.tsx:50` 近辺の CREATE ボタンの**表示文字だけ** `CREATE` → `ARRANGE` に変更（`data-testid="mobile-select-create"` は据え置き＝e2e の互換）。同ファイルのコメント・テスト（`MobileShareSelectBar.test.tsx`）の期待文字列も `ARRANGE` に更新。

- [ ] **Step 4: arrange ブロックの JSX（3560-3611 近辺）をモバイル編集段対応に**

`sharePhase === 'arrange'` ブロック内、`<CollageCanvas …/>` の**直後**に追加:

```tsx
        {isMobile && mobileBandRect && <MobileBandOverlay band={mobileBandRect} />}
        {isMobile && hostedShareUrl === null && shareCreateState !== 'error' && (
          <MobileArrangeBar
            onBack={handleShareReselect}
            onCreate={(): void => { void handleMobileCaptureAndCreate() }}
            creating={shareCreateState === 'creating'}
          />
        )}
        {isMobile && (hostedShareUrl !== null || shareCreateState === 'error') && (
          <div
            className={styles.resultScrim}
            style={{ zIndex: BOARD_Z_INDEX.SHARE_RESULT_SCRIM }}
            data-no-capture
            data-testid="mobile-share-scrim"
          />
        )}
```

`MobileShareResult` の `onRetry` を `(): void => { void handleMobileCaptureAndCreate() }` に変更（**編集した配置を保ったまま撮影だけやり直す**。N-56 の RETRY IMAGE も同じ経路になる）。

`BoardRoot.module.css` に追加:

```css
/* N-55: 結果シート表示中、背後のコラージュへのタッチを遮る透明の盾。 */
.resultScrim {
  position: absolute;
  inset: 0;
}
```

- [ ] **Step 5: 編集中の指ドラッグを盤面スクロールに奪われないようにする**

`components/board/CollageCanvas.module.css` の `.root` ブロックの後に追加:

```css
/* N-58: スマホの編集段では、コラージュ上のどの指ドラッグもカード操作（または
   何もしない）であって、ページ/盤面スクロールではない。カード面は CardNode の
   touch-action:none が既に守っているが、カードの無い余白から始まる指ドラッグが
   背後の盤面スクロールに化けるのを止める。デスクトップはマウスなので影響なし。 */
@media (max-width: 640px) {
  .root {
    touch-action: none;
  }
}
```

- [ ] **Step 6: 検証（単体＋型＋ビルド）**

```bash
rtk tsc
rtk vitest run
pnpm build
```

Expected: tsc 0 / vitest 全緑 / build OK。

- [ ] **Step 7: Commit**

```bash
rtk git add components/board/BoardRoot.tsx components/board/BoardRoot.module.css components/board/MobileShareSelectBar.tsx components/board/MobileShareSelectBar.test.tsx components/board/CollageCanvas.module.css
rtk git commit -m "feat(board): mobile arrange stage — edit the collage before CREATE (N-58), scrim kills ghost touches (N-55)"
```

---

### Task 4: e2e 更新（フロー変更の追随＋新アサーション） 【Sonnet 推奨】

**Files:**
- Modify: `tests/e2e/mobile-share.spec.ts`

**変更の原則:** 既存 5 テストの検証内容（帯の幾何・1200×630・黒帯検出・デスクトップ非回帰）は**全部残す**。変わるのは「CREATE 1 タップ」→「ARRANGE → CREATE の 2 タップ」の操作列だけ。

- [ ] **Step 1: 操作列の共通変更**

各 phone テストの `mobile-select-create` タップの後に、編集段の確認と CREATE タップを挿入:

```ts
    // ARRANGE → 編集段（撮影はまだ）: 帯ガイドと編集バーが出て、ナビは消えたまま
    await page.getByTestId('mobile-select-create').tap()
    await expect(page.getByTestId('mobile-arrange-bar')).toBeVisible()
    await expect(page.getByTestId('mobile-band-overlay')).toBeVisible()
    await expect(page.getByTestId('mobile-share-result')).toHaveCount(0)
    // CREATE → 撮影〜結果シート
    await page.getByTestId('mobile-arrange-create').tap()
    await expect(page.getByTestId('mobile-share-result')).toBeVisible()
```

※ 帯内配置のアサーション（28 要素が帯内・両端接地）は **arrange 段（CREATE タップ前）**に移すと安定する（撮影後も配置は変わらないのでどちらでも正しいが、前に置けば「編集段が正しい初期配置で止まる」ことの検証を兼ねる）。

- [ ] **Step 2: 新規テスト2本を追加**

```ts
  test('BACK returns to selection without creating anything', async ({ page }) => {
    await seedBoard(page)
    await page.getByTestId('mobile-nav-share').tap()
    await page.getByTestId('mobile-select-all').tap()
    await page.getByTestId('mobile-select-create').tap()
    await expect(page.getByTestId('mobile-arrange-bar')).toBeVisible()
    await page.getByTestId('mobile-arrange-back').tap()
    await expect(page.getByTestId('mobile-share-select-bar')).toBeVisible()
    await expect(page.getByTestId('mobile-arrange-bar')).toHaveCount(0)
  })

  test('the result scrim blocks touches to the collage behind the sheet (N-55)', async ({ page }) => {
    await seedBoard(page)
    await page.getByTestId('mobile-nav-share').tap()
    await page.getByTestId('mobile-select-all').tap()
    await page.getByTestId('mobile-select-create').tap()
    await page.getByTestId('mobile-arrange-create').tap()
    await expect(page.getByTestId('mobile-share-result')).toBeVisible()
    const scrim = page.getByTestId('mobile-share-scrim')
    await expect(scrim).toBeVisible()
    // 盾がコラージュ全域を覆っている（外枠と同寸）
    const frame = await page.locator('[data-testid="collage-canvas"]').boundingBox()
    const box = await scrim.boundingBox()
    expect(box).not.toBeNull()
    expect(frame).not.toBeNull()
    if (box && frame) {
      expect(box.width).toBeGreaterThanOrEqual(frame.width - 1)
      expect(box.height).toBeGreaterThanOrEqual(frame.height - 1)
    }
  })
```

- [ ] **Step 3: 実行**

```bash
npx playwright test tests/e2e/mobile-share.spec.ts
```

Expected: 既存5本（操作列更新後）＋新規2本 = **7 本全緑**。`rtk npx` は使わない（壊れる）。tail は失敗リストであって実行リストではない点に注意。

- [ ] **Step 4: Commit**

```bash
rtk git add tests/e2e/mobile-share.spec.ts
rtk git commit -m "test(e2e): mobile SHARE two-step flow (ARRANGE -> CREATE) + N-55 scrim guard"
```

---

### Task 5: デプロイ＋実機確認依頼 【どのモデルでも可】

- [ ] **Step 1: 検証一式→デプロイ**

```bash
rtk tsc && rtk vitest run && pnpm build
npx playwright test tests/e2e/mobile-share.spec.ts
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true
```

- [ ] **Step 2: ユーザーへの実機確認依頼（コピペで渡す）**

```
スマホで https://allmarks.app をハードリロードして:
1. SHARE → 何枚か選ぶ → ARRANGE。明るい帯と「DRAG TO ARRANGE…」のバーが出ますか？
2. 帯の中のカードを指で動かす／四隅をつまんで大きさを変える／上の丸いノブで回す。
   → 操作の感触を教えてください（段階2=ピンチズームは実装確定済み。ここでの感想は
      段階2の優先度と、ズーム倍率・既定表示の調整に使います）
3. CREATE → プレビューの画像が「自分が並べたとおり」になっていますか？
4. 結果シートが出た後、シートの上の空きでカードが動かないこと（以前は動いた）
5. RETRY IMAGE（出た場合）で並べた配置が保たれたまま撮り直されること
```

- [ ] **Step 3: 記録** — TODO.md の N-58/N-55 を更新（N-55 は解消済みへ）。段階2（ピンチズーム）の要否をユーザーの回答から判定して CURRENT_GOAL に記す。

---

## Self-Review 済みの注意点（実装者へ）

- **撮影経路は 1 行も変わっていない**こと（`fit:'cover'`・`mobileCaptureScale(band.width)`・2 フレーム待ち・`data-capturing`）。変わるのは呼ぶタイミングだけ。黒帯検出テストが最後の砦。
- `MobileArrangeBar` は `position:fixed` だが `.outerFrame` の子なので `data-capturing` の `[data-no-capture]` 非表示が効く（`MobileShareResult` と同じ理屈）。
- タブレット（>640px）は従来どおり TopHeader → ShareSelectBar → ShareToast の**デスクトップ経路**。この計画の新 UI は `isMobile` の内側だけ＝タブレット挙動不変。
- `handleShareReselect` は既存関数（sharePhase を 'select' に戻す）。BACK からの再 ARRANGE は配置を作り直す＝意図どおり（「選び直したら並べ直し」）。
- 回転ノブは band の上端近くのカードだと画面上部にはみ出しうる（ノブはカード上 48px）。帯は中央配置なので 390×844 では問題にならない。横長端末（帯が全高）はタブレット＝この計画のスコープ外。
