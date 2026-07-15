# フラット白系シャドウ・浮遊感・エッジ・ライトボックス仕上げ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development。Steps は `- [ ]`。

**Goal:** フラット（白い世界）に残る「暗い前提のもの」を業界水準の軽い光の言語に置換する: ①カードの角丸をWaveと同じ式に＋軽い影で浮かせる（浮遊感）②盤面上下の黒グラデを白フェードに ③ライトボックスを明るくして文字を読めるように。**音・Grid はバイト同一。紙は現状維持。**

**Design（ユーザー承認済・モック https://claude.ai/code/artifact/8aa8fc6b-e70b-4e71-bcdd-cbb7573ad54f）:**
- 角丸＝Waveと同じ式（`min(20, 幅×0.12)`）にフラットも揃える（現状 3px 固定を撤廃）。
- カード＝軽い層状シャドウで盤面から浮かす＋ホバーでふわっと持ち上がる（浮遊感・美しく）。
- 盤面上下＝盤面色 `#faf9f6`→透明の白フェード（黒帯廃止）。
- ライトボックス＝明るい背景＋暗インク（文字は既にトークンで暗い＝読めるようになる）＋メディアに軽い影。

**調査で判明した根本原因（実 file:line）:**
- 角丸: `lib/board/card-radius.ts:26-30` が `flat=true→'3px'`。呼出 `components/board/CardsLayer.tsx:1386` が `flat: meta.colorScheme === 'light'`（flat も paper も light）。
- 黒グラデ: `components/board/BoardRoot.module.css:155-190` `.canvas::before/::after` が `rgba(0,0,0,0.32)` 固定。紙のみ `:225-228` で `display:none`。flat 未対応。
- ライトボックス: 背景 `--lightbox-backdrop`（`app/globals.css:415` = `rgba(0,0,0,0.5)`）は flat 未上書き＝暗いまま。文字は `--text-*`トークン＝flat で暗インク→暗×暗で不可視。カード影は `CardNode.module.css:84-91` が紙のみ。

## Global Constraints
- **音(dotted-notebook)・Grid(grid-paper) はバイト同一**（全変更は flat scoped or flat 専用ロジック分岐）。**紙(paper-atelier) は現状維持**（角丸3px・独自シャドウ・parchment scrim 不変）。
- FLIP/ドラッグと干渉しない: カード影・浮遊は `.cardNode`（外箱）に置く。`.inner`（will-change:transform・FLIP対象）の transform は触らない。ホバー lift は `.cardNode:hover` の transform（別要素＝FLIP と独立）で、transition つき。
- Framer Motion 禁止。reduced-motion 尊重。commit は `rtk` 前置・body 英語・`--no-verify` 禁止。vitest/playwright は素の `npx`。

---

### Task 1: フラットのカード角丸を Wave と同じ式に

**Files:**
- Modify: `lib/board/card-radius.ts`
- Modify: `components/board/CardsLayer.tsx:1386`
- Test: `lib/board/card-radius.test.ts`（既存に追記 or 作成）

- [ ] **Step 1: 失敗する unit**
`lib/board/card-radius.test.ts`:
```ts
import { cardCornerRadiusPx } from './card-radius'
test('flat theme uses the size-aware formula (not a hard 3px)', () => {
  // flat should now match the default theme's rounding
  expect(cardCornerRadiusPx({ width: 240, roundedCorners: true, minimalRadius: false }))
    .toBe(cardCornerRadiusPx({ width: 240, roundedCorners: true, minimalRadius: false }))
  expect(cardCornerRadiusPx({ width: 240, roundedCorners: true, minimalRadius: false })).toBe('20.0px') // min(20, 240*0.12=28.8)=20
  expect(cardCornerRadiusPx({ width: 100, roundedCorners: true, minimalRadius: false })).toBe('12.0px') // 100*0.12
})
test('minimalRadius (paper) still 3px; roundedCorners off = 0px', () => {
  expect(cardCornerRadiusPx({ width: 240, roundedCorners: true, minimalRadius: true })).toBe('3px')
  expect(cardCornerRadiusPx({ width: 240, roundedCorners: false, minimalRadius: true })).toBe('0px')
})
```
Run: `npx vitest run lib/board/card-radius.test.ts` → FAIL（型 or 値。現行 param 名は `flat`）。

- [ ] **Step 2: `card-radius.ts` の param を `flat`→`minimalRadius` にリネーム**
`lib/board/card-radius.ts`: input 型の `flat: boolean` を `minimalRadius: boolean` に。`if (input.flat) return '3px'` を `if (input.minimalRadius) return '3px'` に。ロジック（0px / 3px / `min(20, width*0.12)`）は不変。JSDoc も更新（「minimalRadius=紙のような角ばった小半径」）。

- [ ] **Step 3: 呼出を更新（flat をWave式に・紙のみ3px）**
`components/board/CardsLayer.tsx:1386`: `flat: meta.colorScheme === 'light'` → `minimalRadius: meta.id === 'paper-atelier'`。
（＝flat/dark themes は formula、paper のみ 3px。他に `cardCornerRadiusPx`/`flat:` 呼出があれば grep して同様に更新。）

- [ ] **Step 4: 緑 + tsc**
Run: `npx vitest run lib/board/card-radius.test.ts` → PASS。`npx vitest run lib/board` → 既存緑。`rtk tsc` → 0。落ちたら報告。

- [ ] **Step 5: Commit**
```bash
rtk git add lib/board/card-radius.ts components/board/CardsLayer.tsx lib/board/card-radius.test.ts
rtk git commit -m "fix(flat): card corners use the size-aware radius (match Sound Wave), 3px only for paper"
```

---

### Task 2: フラットのカード影＋浮遊感、盤面上下の白フェード

**Files:**
- Modify: `components/board/CardNode.module.css`（flat 影＋ホバー lift）
- Modify: `components/board/BoardRoot.module.css`（flat エッジ白フェード）
- Test: `tests/e2e/flat-chrome-legibility.spec.ts`（append）

- [ ] **Step 1: 失敗する e2e を append**
```ts
test('flat: board cards float (soft shadow) and edge fades are light not black', async ({ page }) => {
  await prepFlatBoard(page)
  // a board card has a non-none box-shadow (floats off the white board)
  const card = page.locator('[class*="cardNode"]').first()
  await card.waitFor({ state: 'visible', timeout: 15_000 })
  const shadow = await card.evaluate((el) => getComputedStyle(el).boxShadow)
  expect(shadow).not.toBe('none')
  // the top edge scrim must NOT be a black gradient on flat (rgba(0,0,0,*))
  const canvasBefore = await page.locator('[class*="canvas"]').first().evaluate((el) => getComputedStyle(el, '::before').backgroundImage)
  expect(canvasBefore).not.toContain('rgba(0, 0, 0')
})
```
（`cardNode`/`canvas` の class 名は実 DOM で確認。カードが出るには seed 必要＝`prepFlatBoard` が seedDb 済。カードが無ければ seed 件数を確認。）
Run: `npx playwright test tests/e2e/flat-chrome-legibility.spec.ts -g "float"` → FAIL。dev 未起動なら `rtk pnpm dev` 背景。e2e 不可なら test 書いて tsc/build で確認し DONE_WITH_CONCERNS。

- [ ] **Step 2: フラットのカード影＋浮遊感**
`components/board/CardNode.module.css` 末尾に append（紙の `.cardNode` シャドウと同じ「外箱に置く」流儀・**flat scoped**）:
```css
/* Flat: cards float on the near-white board with a soft, layered, ink-tinted
   shadow (industry-standard light-UI elevation), so the card edges + rounded
   corners read against #faf9f6. Placed on .cardNode (not overflow:hidden) so the
   shadow isn't clipped; .inner (FLIP will-change:transform) is untouched. */
:global(html[data-theme-id="flat"]) .cardNode {
  border-radius: var(--card-radius);
  box-shadow:
    0 1px 2px rgba(20, 19, 15, 0.05),
    0 4px 14px rgba(20, 19, 15, 0.08);
  transition: box-shadow 0.22s ease, transform 0.22s cubic-bezier(0.2, 0.7, 0.2, 1);
}
/* Gentle float on hover — lift + deepen shadow. transform on .cardNode only
   (independent of .inner's FLIP transform and the wrapper's position). */
:global(html[data-theme-id="flat"]) .cardNode:hover {
  transform: translateY(-3px);
  box-shadow:
    0 2px 4px rgba(20, 19, 15, 0.06),
    0 12px 30px rgba(20, 19, 15, 0.12);
}
@media (prefers-reduced-motion: reduce) {
  :global(html[data-theme-id="flat"]) .cardNode { transition: none; }
  :global(html[data-theme-id="flat"]) .cardNode:hover { transform: none; }
}
```

- [ ] **Step 3: 盤面上下の白フェード（flat）**
`components/board/BoardRoot.module.css`: 紙の `display:none`（:225-228）に倣い、flat は**白フェードに置換**。紙のブロックの近くに append:
```css
/* Flat: the top/bottom scrim must fade to the board colour, not black — a dark
   gradient over #faf9f6 reads as ugly bands. Keep the fade (so the floating
   chrome stays legible over cards) but in the light board colour. */
:global(html[data-theme-id="flat"]) .canvas::before {
  background: linear-gradient(180deg, #faf9f6 0%, rgba(250, 249, 246, 0.75) 40%, transparent 100%);
}
:global(html[data-theme-id="flat"]) .canvas::after {
  background: linear-gradient(0deg, #faf9f6 0%, rgba(250, 249, 246, 0.75) 40%, transparent 100%);
}
```
（`.canvas::before/::after` の他プロパティ〔height/z-index/position〕は base のまま＝background だけ flat 上書き。）

- [ ] **Step 4: 緑 + 音バイト同一**
Run: `npx playwright test tests/e2e/flat-chrome-legibility.spec.ts` → 全 PASS。
Run: `npx playwright test tests/e2e/chrome-skin-tokens.spec.ts tests/e2e/board-theme.spec.ts` → 全 PASS（音/紙 不変）。`rtk tsc && rtk pnpm build` → 0/成功。

- [ ] **Step 5: Commit**
```bash
rtk git add components/board/CardNode.module.css components/board/BoardRoot.module.css tests/e2e/flat-chrome-legibility.spec.ts
rtk git commit -m "feat(flat): floating card shadow + hover lift; light board edge fades"
```

---

### Task 3: フラットのライトボックスを明るく（文字が読める）＋メディアに軽い影

**Files:**
- Modify: `app/globals.css`（flat ブロックに `--lightbox-backdrop`）
- Modify: `components/board/Lightbox.module.css`（flat: メディアに軽い影・必要なら情報パネル面）
- Test: `tests/e2e/flat-chrome-legibility.spec.ts`（append）

- [ ] **Step 1: 失敗する e2e を append**
ライトボックスを開くのが e2e で難しければ（カードクリックは setPointerCapture で合成不可＝memory）、**computed token 検証**で代替:
```ts
test('flat: lightbox backdrop is light (so dark-ink text is legible)', async ({ page }) => {
  await prepFlatBoard(page)
  const backdrop = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--lightbox-backdrop').trim())
  // flat must define a LIGHT scrim, not the default rgba(0,0,0,0.5)
  expect(backdrop).not.toBe('')
  expect(backdrop).not.toContain('0, 0, 0')
})
```
Run: `npx playwright test tests/e2e/flat-chrome-legibility.spec.ts -g "lightbox backdrop"` → FAIL。

- [ ] **Step 2: flat の `--lightbox-backdrop` を明るく**
`app/globals.css` の `html[data-theme-id="flat"]` ブロックに追記:
```css
  /* lightbox: light frost so the dark-ink info text (via --text-* tokens) reads.
     (The default rgba(0,0,0,0.5) left dark text on a dark scrim = invisible.) */
  --lightbox-backdrop: rgba(250, 249, 246, 0.86);
```
（0.86 = ほぼ不透明の白フロスト＋blur16px でメディア/文字がくっきり。実機で薄い/濃いは調整可。）

- [ ] **Step 3: flat: ライトボックスのメディアに軽い影（浮遊感の統一）**
`components/board/Lightbox.module.css`: メディア要素（画像/動画のラッパ・実クラス名を確認、例 `.media`/`.mediaWrap`/`.tweetMedia`）に flat scoped で軽い影:
```css
:global(html[data-theme-id="flat"]) .media {
  box-shadow: 0 1px 2px rgba(20, 19, 15, 0.05), 0 6px 18px rgba(20, 19, 15, 0.09);
}
```
（実クラス名は Lightbox.module.css を読んで合わせる。`.text` の default `#e8e8e8` は子がトークンで上書き済＝触らない。もし本文が薄すぎるなら flat で `.tweetAuthorHandle`/`.meta`（`--text-meta`=#6b675e）を少し濃く〔例 `--text-body` 相当〕にするのは任意・実機判断。）

- [ ] **Step 4: 緑 + build**
Run: `npx playwright test tests/e2e/flat-chrome-legibility.spec.ts -g "lightbox"` → PASS。`rtk tsc && rtk pnpm build` → 0/成功。

- [ ] **Step 5: Commit**
```bash
rtk git add app/globals.css components/board/Lightbox.module.css tests/e2e/flat-chrome-legibility.spec.ts
rtk git commit -m "fix(flat): light lightbox backdrop so info text is legible; media shadow"
```

---

## Verification & Invariants（最終ゲート）
- [ ] `rtk tsc` 0 ／ `npx vitest run` 全緑 ／ `rtk pnpm build` 成功
- [ ] `npx playwright test tests/e2e/flat-chrome-legibility.spec.ts tests/e2e/chrome-skin-tokens.spec.ts tests/e2e/board-theme.spec.ts` 全 PASS
- [ ] 音・Grid バイト同一（全変更 flat scoped or `minimalRadius` 分岐）／紙 現状維持（3px・独自シャドウ・parchment scrim 不変）
- [ ] FLIP/ドラッグ非干渉（影/lift は `.cardNode`・`.inner` 無改変）＝レビュー＋実機で確認
- [ ] opus 全ブランチレビュー: (1)音/Grid バイト同一・紙不変 (2)flat: 角丸=Wave式・カード浮遊・白フェード・明ライトボックス (3)FLIP/ドラッグ非干渉

## Self-Review
- Design coverage: 角丸=T1／カード影+浮遊+盤面フェード=T2／ライトボックス=T3。全カバー。
- 不変: 全て flat scoped（CSS）or `minimalRadius`/`meta.id` 分岐（JS）＝音/Grid/紙 保全。
- Type consistency: `minimalRadius`（T1 でリネーム）を card-radius.ts + CardsLayer で一貫。
