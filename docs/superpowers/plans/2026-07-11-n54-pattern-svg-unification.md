# N-54: グリッド/クロスハッチの交点が濃くなる — 盤面パターンを共有側と同じ単層 SVG に統一 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans。Steps use checkbox (`- [ ]`) syntax.

**Goal:** 本物の盤面で grid / crosshatch の線の交点だけ濃く見える問題を根治する。ついでに「盤面＝CSS グラデ／受け取り・OG＝SVG」という描画の二重管理を無くし、**dom-to-image が重ねた CSS グラデーションの片方向を落とす問題**（SHARE スクショの忠実度低下）も同時に解消する。

**Architecture:** 原因は確定済み — 盤面はパターンを **CSS の重ねグラデーション2枚**で描く（grid / crosshatch。`themes.module.css:33-38, 58-72`）ため、半透明の線が交点で**二重合成**されて濃くなる。受け取り画面／OG は `patternSvgDataUri`（**1 本の path に 2 サブパス＝1 回の描画**、`theme-customization.ts:194-224`）なので濃くならない。→ **盤面も同じ SVG data-URI を `background-image` に使う**（受け取り画面 `SharedBoard.tsx:475-490` が既にやっている方式の移植）。パララックス（`background-position` の y 項）はそのまま効く。`encodeURIComponent` を毎レンダーで回さないため **`useMemo` 必須**。

**Tech Stack:** Next.js 14 / TypeScript strict / CSS Modules / vitest / Playwright

## 事実の索引（s186 調査で確定）

- 盤面の描画: [BoardRoot.tsx](../../../components/board/BoardRoot.tsx):3129-3149 — `.patternLayer` に `data-pattern` ＋ CSS 変数（`--pattern-color/--pattern-size/--pattern-stroke/--pattern-dot-r/--board-color`）を inline で渡し、`themes.module.css` のルールが描く
- 2枚重ねなのは **grid と crosshatch** のみ。dots / diagonal は 1 層（＝見た目のバグは無いが、描画系統の統一のため**4 種とも** SVG へ移す）
- パララックス: `backgroundPosition: calc(50% + var(--grab-x,0px)*…) calc(${-gridBgPanY}px + var(--grab-y,0px)*…)`（BoardRoot.tsx:3137）— `background-image` が url() になっても機構は不変
- `patternSvgDataUri` の呼び出し元は現在 受け取り `SharedBoard.tsx:475` と `ShareMirror.tsx:162-163` のみ。**ShareMirror は SVG パターン背景を dom-to-image で撮れている実績あり**（＝SVG 化しても SHARE 撮影は壊れない先例）
- dom-to-image の片方向落ちの注記: `theme-customization.ts:190-193`（"it drops one direction of stacked CSS gradients — see 2026-06-29 spike"）
- 45° 系のタイル: CSS は `background-size: patternSize × 1.41421356`（周期ピン留め）、SVG は `patternSize` 角タイルに対角線（タイル境界で自己完結＝オフセットしても繋ぎ目が出ない）。**受け取り画面が同じ SVG を同じ patternSize でタイルして盤面と並んで検証済み**（N-52 出荷時に太さ・幾何のパリティ確認済み）
- 既定太さは種別ごと（線=1 / dots=1.4、`defaultPatternStroke`）・クランプは共有関数 `effectivePatternStroke`（`min(太さ, 間隔/2−1)`、下限 0.5）

## Global Constraints

- **盤面の見た目は「交点の濃さが消える」以外 1px も変えない**（間隔・太さ・色・パララックスすべて既存値のまま）
- **受け取り画面（/s/<id>）も必ず確認する**（恒久ルール。今回は受け取り側のコードを触らないが目視必須）
- `useMemo` 必須（`patternSvgDataUri` は毎回 `encodeURIComponent` する）
- TypeScript strict / CSS Modules / `rtk` 前置 / `--no-verify` 禁止

---

### Task 1: 盤面のパターン層を SVG data-URI 描画に切替 【Sonnet 推奨】

**Files:**
- Modify: `components/board/BoardRoot.tsx`（:3129-3149 の render と、その近くに useMemo 追加）

- [ ] **Step 1: useMemo で URI を作る**

`resolvedCustom` の useMemo（BoardRoot.tsx:1962-1965 近辺）の直後に追加。import に `patternSvgDataUri` を足す（`@/lib/board/theme-customization` から。`resolveThemeCustomization`/`effectivePatternStroke` と同じ行）:

```ts
  // N-54: 盤面のパターンを受け取り画面/OG と同じ単層 SVG で描く。CSS の重ねグラデ
  // 2枚は半透明線が交点で二重合成され濃くなる（SVG は 1 path 1 描画なので濃くならない）。
  // 副次効果: dom-to-image は重ねた CSS グラデの片方向を落とす（theme-customization.ts
  // の 2026-06-29 spike 注記）ため、SHARE スクショの背景忠実度も上がる。
  // encodeURIComponent を毎レンダーで回さないよう useMemo 必須。
  const patternUri = useMemo((): string => {
    if (!resolvedCustom) return ''
    return patternSvgDataUri(resolvedCustom)
  }, [resolvedCustom])
```

- [ ] **Step 2: render の style を差し替え**

BoardRoot.tsx:3129-3149 の `.patternLayer` div の `style` を次に変更（`data-pattern` 属性・`hydrated` ゲート・zIndex・pointerEvents・parallax はそのまま）:

```tsx
      {hydrated && themeMeta.kind === 'pattern' && resolvedCustom && (
        <div
          aria-hidden="true"
          className={themeStyles.patternLayer}
          data-pattern={resolvedCustom.patternType}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: BOARD_Z_INDEX.THEME_BG,
            pointerEvents: 'none',
            backgroundPosition: `calc(50% + var(--grab-x, 0px) * ${GRAB_LAYER_WEIGHTS.pattern}) calc(${-gridBgPanY}px + var(--grab-y, 0px) * ${GRAB_LAYER_WEIGHTS.pattern})`,
            backgroundColor: resolvedCustom.boardColor,
            backgroundImage: patternUri ? `url("${patternUri}")` : undefined,
            backgroundSize: `${resolvedCustom.patternSize}px ${resolvedCustom.patternSize}px`,
          } as CSSProperties}
        />
      )}
```

（削るもの: `'--board-color'` / `'--pattern-color'` / `'--pattern-size'` / `'--pattern-stroke'` / `'--pattern-dot-r'` の 5 変数。受け取り画面 `SharedBoard.tsx:475-490` と同じ形になる。）

- [ ] **Step 3: 型・単体・ビルド**

```bash
rtk tsc && rtk vitest run && pnpm build
```

- [ ] **Step 4: Commit**

```bash
rtk git add components/board/BoardRoot.tsx
rtk git commit -m "fix(board): draw the pattern layer from the shared single-pass SVG (N-54)"
```

---

### Task 2: 死んだ CSS グラデーション規則の削除 【Haiku 可】

**Files:**
- Modify: `components/board/themes.module.css`（:28-72）

- [ ] **Step 1: 消す前の確認**

盤面（Task 1 済み）・受け取り（`SharedBoard.tsx:487` inline）・ShareMirror（inline）の全員が inline `backgroundImage` を持つ＝クラス側の `background-image` 規則は**全消費者で上書きされて死んでいる**ことを確認:

```bash
rtk grep -n "patternLayer" --glob "**/*.tsx"
```

Expected: BoardRoot.tsx / SharedBoard.tsx（2件とも inline backgroundImage あり）のみ。他に出たら**止めてその消費者を先に確認**。

- [ ] **Step 2: 削除**

`themes.module.css` から `[data-pattern='grid']` / `[data-pattern='dots']` / `[data-pattern='diagonal']` / `[data-pattern='crosshatch']` の 4 ブロック（:33-72）を削除。ベース `.patternLayer`（:22-26）は残す。:28-32 のコメントを差し替え:

```css
/* Pattern geometry lives in ONE place: patternSvgDataUri() (theme-customization.ts).
   The board (BoardRoot), the receiver (SharedBoard) and the OG mirror (ShareMirror)
   all tile that same single-pass SVG inline — semi-transparent lines can't
   double-composite at crossings, and dom-to-image captures it faithfully (it
   drops one direction of stacked CSS gradients — 2026-06-29 spike). */
```

- [ ] **Step 3: 検証 → Commit**

```bash
rtk tsc && rtk vitest run && pnpm build
rtk git add components/board/themes.module.css
rtk git commit -m "refactor(board): drop the dead stacked-gradient pattern rules (N-54)"
```

---

### Task 3: 実測（交点・パリティ・パララックス・SHARE 撮影） 【Sonnet 推奨】

- [ ] **Step 1: 交点が濃くないことの画素実測（Playwright 一時スクリプト）**

1489×679 で `/board` を開き、IDB preseed で pattern テーマ（grid・薄い色・太さ2）を設定 → `.patternLayer` の `backgroundImage` が `url("data:image/svg+xml` で始まることを assert → スクリーンショットの画素で「線上の点」と「交点」の RGB 差が ±6 以内（＝二重合成が消えた）を確認。crosshatch でも同様。**修正前の master で同スクリプトを流すと交点が明確に濃い（RED）ことを先に確認しておくと証明になる。**

- [ ] **Step 2: 4 パターン × 盤面/受け取りの見比べスクショ**

grid / dots / diagonal / crosshatch それぞれ: 盤面スクショ＋実共有リンクを作って `/s/<id>` スクショ。間隔・太さ・色が盤面＝受け取りで一致（今回から**構造的に**同一ソース）。

- [ ] **Step 3: パララックスとつまみ（grab）の目視確認**

盤面をスクロールして背景パターンが従来どおり遅れて流れること（`gridBgPanY`）。カードをつかんで動かした時の `--grab-x/y` の微動も従来どおり。

- [ ] **Step 4: SHARE 撮影（デスクトップ CREATE）で背景が写ること**

SELECT ALL → ARRANGE → CREATE で共有画像を作り、プレビューにパターンが**両方向とも**写っていること（旧: dom-to-image が片方向を落としていた）。

- [ ] **Step 5: デプロイ＋ユーザー実機確認**

```bash
pnpm build && npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true
```

ユーザー確認: 薄い色のグリッドで交点の粒々が消えたか（発端の実機報告の再確認）。

- [ ] **Step 6: TODO.md 更新**（N-54 完了へ・スクショの学びを記録）

## Self-Review 済みの注意点

- `patternUri` が `''`（patternType 'none'）のとき `backgroundImage: undefined` ＝ 地色のみ。従来の 'none'（CSS 規則なし）と同じ見え。
- `themeMeta.kind === 'pattern'` ゲートは render 側に残っているので、useMemo 内の判定は `resolvedCustom` の null チェックだけで足りる（'work'＝paper テーマは resolvedCustom が null）。
- 45° 系（diagonal / crosshatch）は CSS 時代の「√2 周期ピン留め」が不要になる（SVG タイルは境界で自己完結）。見た目の周期は受け取り画面と同一＝N-52 で実機検証済みの幾何。
- SHARE の撮影（capture-collage → dom-to-image）はパターン層を含めて撮る（`data-no-capture` なし・確認済み）。SVG data-URI 背景は ShareMirror の OG 撮影で実績あり。
- 受け取り画面のコードは無変更。ただし恒久ルールにより**目視は必須**（Task 3 Step 2 に組込み済み）。
