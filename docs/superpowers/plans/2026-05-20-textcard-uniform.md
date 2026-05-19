# TextCard 統一化 — 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全 TextCard を 18px 文字 + 正方形 + スクロールに統一する。 文字数による 3 モード分岐を廃止して、 user が見せた reference 画像通りの統一見た目に揃える。

**Architecture:** `pickTitleTypography` + `measureTextCardLayout` 2 関数を「入力に関係なく固定値を返す」 に簡略化するだけ。 TextCard コンポーネント / Lightbox / CSS は一切触らない。 LargeTextCardScaler は TextCard 共有なので Lightbox も自動追従。

**Tech Stack:** TypeScript / React / Vitest / Next.js (Static Export) / Cloudflare Pages

**Spec:** [docs/superpowers/specs/2026-05-20-textcard-uniform-design.md](../specs/2026-05-20-textcard-uniform-design.md)

---

## File Structure

**触るファイル (3 個)**:
- [`lib/embed/title-typography.ts`](../../../lib/embed/title-typography.ts) — `pickTitleTypography` 関数を constant 返却に簡略化
- [`lib/embed/text-card-measure.ts`](../../../lib/embed/text-card-measure.ts) — `measureTextCardLayout` を constant 返却 + `TEXT_CARD_MIN_ASPECT` の値を 9/16 → 1.0 に変更
- [`lib/embed/title-typography.test.ts`](../../../lib/embed/title-typography.test.ts) — 6 ケース → 2 ケースに統合

**触らないファイル**:
- TextCard.tsx / TextCard.module.css / Lightbox.tsx / その他カード / IDB / 拡張機能 / PiP

---

## Task 1: pickTitleTypography を constant に簡略化

**Files:**
- Modify: [`lib/embed/title-typography.ts`](../../../lib/embed/title-typography.ts)

- [ ] **Step 1: ファイル全体を constant 返却版に書き換え**

Write ツールで [`lib/embed/title-typography.ts`](../../../lib/embed/title-typography.ts) 全文を以下に置き換える:

```ts
import type { TitleTypographyResult } from './types'

type Input = {
  readonly title: string
  readonly cardWidth: number
  readonly cardHeight: number
}

/**
 * Pick typography for a TextCard title.
 *
 * Session 55 統一化: 文字数による 3 モード分岐 (headline / editorial / index)
 * を廃止し、 全 TextCard で同じ font-size + 同じ aspect を使う。 user 仕様
 * (= moodboard 上の文字のみツイートを見た目で揃える) に沿った確定値。
 *
 * 入力は signature 互換性のために受け取るが内部では使わない。
 */
export function pickTitleTypography(_input: Input): TitleTypographyResult {
  return {
    mode: 'editorial',
    fontSize: 18,
    lineHeight: 27, // 18 × 1.5
    maxLines: 999,  // 実質無制限、 オーバーフローはスクロールで処理
  }
}
```

- [ ] **Step 2: tsc 型チェック**

```bash
npx tsc --noEmit
```

Expected: clean exit、 エラー 0 件。

---

## Task 2: measureTextCardLayout を constant に簡略化

**Files:**
- Modify: [`lib/embed/text-card-measure.ts`](../../../lib/embed/text-card-measure.ts)

- [ ] **Step 1: ファイル全体を constant 返却版に書き換え**

Write ツールで [`lib/embed/text-card-measure.ts`](../../../lib/embed/text-card-measure.ts) 全文を以下に置き換える:

```ts
/**
 * TextCard layout — session 55 統一化以降は全 TextCard が正方形 (= aspect 1.0)、
 * maxLines も実質無制限。 文字数による pretext measure + 9:16 clamp 廃止。
 * オーバーフローは TextCard 側の scroll + 底フェードで処理する。
 */
import type { TitleTypographyResult } from './types'

/**
 * 既存 import 互換のため `TEXT_CARD_MIN_ASPECT` 名は残置。 session 55 から
 * 値は 1.0 (= 正方形) で固定。 名前は「MIN」 だが現在は唯一の値。
 * 改名は別 task (= Lightbox.tsx の 2 箇所 import を同時更新する必要があるため、
 * 本変更の scope 外)。
 */
export const TEXT_CARD_MIN_ASPECT = 1.0

export type TextCardLayout = {
  readonly aspectRatio: number
  readonly maxLines: number
  readonly clamped: boolean
}

/**
 * Resolve the TextCard's display layout. Session 55 統一化以降は固定値。
 * title が空ならば null を返す (= 既存契約維持、 TextCard 側の guard 不要)。
 */
export function measureTextCardLayout(input: {
  readonly title: string
  readonly cardWidth: number
  readonly typography: TitleTypographyResult
}): TextCardLayout | null {
  if (!input.title) return null
  return {
    aspectRatio: 1.0,
    maxLines: 999,
    clamped: false,
  }
}
```

- [ ] **Step 2: tsc 型チェック**

```bash
npx tsc --noEmit
```

Expected: clean exit、 エラー 0 件。 もし pretext / `prepare` / `layout` の orphan import エラーが出たら Step 1 の Write で漏れている、 上書き内容に import 文がないか再確認。

---

## Task 3: title-typography.test.ts を統合版に書き換え

**Files:**
- Modify: [`lib/embed/title-typography.test.ts`](../../../lib/embed/title-typography.test.ts)

- [ ] **Step 1: テストファイル全文を書き換え**

Write ツールで [`lib/embed/title-typography.test.ts`](../../../lib/embed/title-typography.test.ts) を以下に置き換える:

```ts
import { describe, it, expect } from 'vitest'
import { pickTitleTypography } from './title-typography'

describe('pickTitleTypography (session 55 unified)', () => {
  const baseInput = { cardWidth: 280, cardHeight: 360 }

  it('always returns the unified typography regardless of title length', () => {
    const short = pickTitleTypography({ ...baseInput, title: 'short' })
    const medium = pickTitleTypography({ ...baseInput, title: 'a medium-length title with some characters' })
    const long = pickTitleTypography({ ...baseInput, title: 'a very long title '.repeat(20) })

    for (const r of [short, medium, long]) {
      expect(r.mode).toBe('editorial')
      expect(r.fontSize).toBe(18)
      expect(r.lineHeight).toBe(27)
      expect(r.maxLines).toBe(999)
    }
  })

  it('handles empty / emoji / CJK titles with the same unified values', () => {
    for (const title of ['', '🎨🌈✨', 'これは日本語のタイトルです']) {
      const r = pickTitleTypography({ ...baseInput, title })
      expect(r.fontSize).toBe(18)
      expect(r.mode).toBe('editorial')
    }
  })
})
```

- [ ] **Step 2: vitest 全件実行**

```bash
rtk vitest run
```

Expected: 全件 PASS。 元の 608/608 から title-typography テスト件数が 6 → 2 になるので合計は **604/604** になるはず。 もし減数が違ったら他テスト (= text-card-measure 等) が落ちている可能性、 個別に確認。

- [ ] **Step 3: Task 1-3 を 1 commit にまとめる**

```bash
rtk git add lib/embed/title-typography.ts lib/embed/text-card-measure.ts lib/embed/title-typography.test.ts
rtk git commit -m "feat(textcard): 統一化 — 全 TextCard で 18px 正方形に統一

文字数による 3 モード分岐 (headline / editorial / index) を廃止し、
全 TextCard で固定値 (= 18px / lineHeight 27 / aspect 1.0 / maxLines 999)
を返すように 2 関数を簡略化。 TextCard.tsx / Lightbox.tsx / CSS は不変、
LargeTextCardScaler 経由で Lightbox text-only も自動統一。

user 提示 reference 画像 (= サイトアイコン上 + 本文下 + 底フェード + 正方形)
に沿った見た目に揃える。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: build + deploy

**Files:** ソース変更なし

- [ ] **Step 1: pnpm build**

```bash
rtk pnpm build
```

Expected: `▲ Next.js ... ✓ Compiled successfully` + `out/` に static export 完了。

- [ ] **Step 2: wrangler deploy**

```bash
npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="textcard-uniform"
```

Expected: `✨ Deployment complete!` + `https://booklage.pages.dev` 反映完了。

- [ ] **Step 3: sanity check**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://booklage.pages.dev/board
```

Expected: `200`。

---

## Task 5: user 実機 manual verify

**Files:** 触らない

- [ ] **Step 1: 7 ケース確認を user に提示**

user に以下を提示:

> **`booklage.pages.dev` をハードリロード**して、 以下 7 ケースを確認してください:
>
> | # | テスト内容 | 期待動作 |
> |---|---|---|
> | 1 | 短い文字のみツイート (5-10 文字) | 正方形カード、 18px 文字、 上にサイトアイコン + サイト名、 文字は上寄せで下に大きな空白 |
> | 2 | 中くらいの文字のみツイート (50 文字前後) | 同じ正方形カード、 18px 文字、 何行か並ぶが余白も少し残る |
> | 3 | 長い文字のみツイート (200 文字以上) | 同じ正方形カード、 18px 文字、 はみ出した部分は底フェードで隠れて scroll で読める |
> | 4 | ライトボックスで短い文字ツイート開く | 正方形のまま大きく拡大、 18px の比率も維持 |
> | 5 | ライトボックスで長い文字ツイート開く | 同上、 拡大した正方形内で scroll 可能 |
> | 6 | 画像 + 本文ツイートを Lightbox 開く | 直前の A 番 fix のまま (= 左に画像、 右に本文、 regression check) |
> | 7 | 画像カード / 動画カードの形 | TUNE スライダー以外で何も変わらない (= 文字以外は触ってない) |

- [ ] **Step 2: user 報告を待つ**

OK パターン: 全件確認 → Task 6 へ。
NG パターン別の次手:
- (1)(2)(3) で「正方形になってない」 → IDB に古い aspect 値が残っているかも、 ハードリロード後に persistMeasuredAspect が effect で 1.0 上書きするはずなので 数秒〜数 click で反映するか確認
- (3) で「scroll しない / 底フェード出ない」 → TextCard 側の overflow 検知が新 aspect で動いてるか確認、 ResizeObserver 周辺を debug
- (4)(5) で Lightbox 表示崩れ → LargeTextCardScaler の zoom 計算が新 aspect で動いてるか確認
- (6) で本文消える → A 番 fix が破壊された、 Lightbox.tsx の shouldHideTweetBody を再確認
- (7) で他カードに変化 → spec 違反、 ImageCard / VideoThumbCard 側に影響していないか調査

---

## Task 6: session 55 docs update (A 番 + TextCard 統一化 両方 batch)

**Files:**
- Modify: [`docs/TODO.md`](../../TODO.md)
- Modify: [`docs/TODO_COMPLETED.md`](../../TODO_COMPLETED.md)
- Modify: [`docs/CURRENT_GOAL.md`](../../CURRENT_GOAL.md)

- [ ] **Step 1: TODO.md §現在の状態 を session 55 内容に書き換え**

Edit で TODO.md の line 22 周辺「### 直近の状態 (2026-05-20 セッション 54 ...)」 を「### 直近の状態 (2026-05-20 セッション 55 — A 番 fix + TextCard 統一化)」 に書き換える:

```markdown
### 直近の状態 (2026-05-20 セッション 55 — A 番 fix + TextCard 統一化)

session 54 直後、 backlog から「A 番 X 長文 tweet + 画像 で画像のみ表示 bug」 を user 選択。 spec 起こし時に root cause 判明: session 52 で `shouldHideTweetBody()` を「全 tweet で本文非表示」 に変更した副作用で、 画像 + 本文ツイートの本文も消えていた。 1 関数書き換えで完了。 user 確認で文字のみツイートの「短文と長文で見た目が違う」 質問発覚 → 統一化 sprint に拡張。

**ship 済 (= prod 反映済、 user 実機 OK)**:
- **A 番 fix**: `shouldHideTweetBody()` を判定ベースに書き換え (= text-only / meta 未到着 / 本文空 は隠す、 それ以外は表示)。 既存 2 カラム構造 / TweetText / TextCard / ImageCard 全て不変
- **TextCard 統一化**: `pickTitleTypography` + `measureTextCardLayout` を constant 返却に簡略化。 全 TextCard が 18px + 正方形 + 上端サイトアイコン + scroll で統一。 LargeTextCardScaler 経由で Lightbox text-only も自動追従

**変更 file** (4): components/board/Lightbox.tsx (= A 番) + lib/embed/title-typography.ts + lib/embed/text-card-measure.ts + lib/embed/title-typography.test.ts (= 統一化)

**テスト**: 608 → 604 PASS (= title-typography 6 → 2 統合のため減数)

**deploy 回数**: 2

詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 55 セクション

**次セッション (= 56) の goal**: backlog から user 選択。 候補:
- 🟡 10 番 有名サイト pre-set OFF list (= 拡張 polish、 ~50 行)
- 🟡 音波テーマ世界観確立 sprint (= H + J + K + I-09 + I-10、 session 54 で I-09 一部消化済)
- 🟡 multi-playback vision board card autoplay (= AllMarks core 差別化)
- 🐛 B-#3 重複 URL でサムネ等が出ない (= 古めの未解決)

詳細は [docs/CURRENT_GOAL.md](./CURRENT_GOAL.md)
```

旧 session 54 セクションは「### 旧情報 (2026-05-20 セッション 54 — ...)」 にリネームして残置。

- [ ] **Step 2: TODO_COMPLETED.md に session 55 narrative 追加**

Edit で TODO_COMPLETED.md 先頭 (= session 54 section 上) に session 55 セクション追加:

```markdown
## セッション 55 (2026-05-20) — A 番 fix + TextCard 統一化

### 経緯

session 54 close 後、 backlog 5 候補から user 「おすすめどおり」 で A 番 着手。 brainstorming で root cause 判明: 当初新規 SplitTweetCard を作る前提だったが、 user 仕様確認で「ボードは現状維持、 Lightbox 内だけ画像左 + 文字右」 と判明。 Lightbox.tsx を読んだ結果、 元々 2 カラム構造で TweetText の右カラム body 描画完備だったが session 52 で全 tweet body 非表示にした副作用で巻き込み消失と判明 → 1 関数書き換えで最小修正。 user 実機 OK 確認後、 文字のみツイートの「短文と長文で見た目が違う」 質問発覚 → 統一化 sprint に拡張。

### ship 済 (= prod 反映済、 user 実機 OK)

**A 番 fix (= 画像 + 本文ツイートで右カラム本文復活)**:
- [components/board/Lightbox.tsx](../components/board/Lightbox.tsx) の `shouldHideTweetBody` 関数 (line 1613) を 4 段判定 (= text-only / meta 未到着 / 本文空 / それ以外) に書き換え。 既存 2 カラム構造 / TweetText / .tweetBody CSS / TextCard / ImageCard 等は全て不変。 周辺コメントも session 52 → session 55 の意図に更新

**TextCard 統一化 (= 全 TextCard で 18px 正方形に揃える)**:
- [lib/embed/title-typography.ts](../lib/embed/title-typography.ts) — `pickTitleTypography` を「入力無視で constant 返却」 に簡略化、 文字数 3 モード (headline / editorial / index) 分岐 + CJK 幅計算ロジック廃止
- [lib/embed/text-card-measure.ts](../lib/embed/text-card-measure.ts) — `measureTextCardLayout` も constant 返却、 pretext による natural height 計算 + 9:16 clamp 廃止。 `TEXT_CARD_MIN_ASPECT` を 9/16 → 1.0 に値変更 (= 名前は互換のため残置、 改名は別 task)
- [lib/embed/title-typography.test.ts](../lib/embed/title-typography.test.ts) — 6 ケース → 2 ケースに統合
- 副次効果: TextCard.module.css の .headline / .index モード CSS は dead code 化、 今回は残置 (= 別 polish sprint で清掃)。 LargeTextCardScaler は TextCard 共有なので Lightbox text-only も自動追従

### 変更 file (4)

- [components/board/Lightbox.tsx](../components/board/Lightbox.tsx) (= A 番)
- [lib/embed/title-typography.ts](../lib/embed/title-typography.ts) (= 統一化)
- [lib/embed/text-card-measure.ts](../lib/embed/text-card-measure.ts) (= 統一化)
- [lib/embed/title-typography.test.ts](../lib/embed/title-typography.test.ts) (= 統一化、 テスト)

### deploy 回数: 2

### テスト

- vitest 608 → 604 PASS (= title-typography テストを 6 → 2 統合のため減数、 ロジック簡略化を反映)
- tsc clean
- user 実機で A 番 8 ケース + TextCard 統一化 7 ケース 確認 OK

### 学び

- **既存実装を読んでから「最小修正」 を再評価する習慣**: A 番 で当初 spec ドラフトは新規 SplitTweetCard 提案 → user 仕様確認 + Lightbox 既存 read で「既に 2 カラム構造完備」 発覚 → 1 関数書き換えで完了。 session 39 / 41 と同じ「user 観察で軌道修正」 パターン (= memory `feedback_user_observation_reveals_intent.md` / `feedback_layman_simple_path.md`)
- **「文字のみ短文と長文で見た目が違うのなぜ?」 のような user 質問は仕様変更の opening**: 答えるだけで終わらせず、 「この挙動でいい?」 を聞くと統一化のような積極的改修につながる
- **「メタ」 「favicon」 等のジャーゴンは user に通じない**: 「上のラベル」 「サイトアイコン」 など平易な日本語に置換、 memory `feedback_jargon_in_japanese.md` を再徹底
```

- [ ] **Step 3: CURRENT_GOAL.md を次セッション用に上書き**

Write で CURRENT_GOAL.md 全文を以下で上書き:

```markdown
# 次セッションのゴール (= セッション 56)

## 状況

session 55 で **2 件完了**:
- **A 番 fix** (= 画像 + 本文ツイートで Lightbox 右本文復活、 1 関数書き換え)
- **TextCard 統一化** (= 全 TextCard 18px 正方形 + scroll に揃える、 2 関数 + テスト書き換え)
- 2 deploy、 604/604 PASS、 user 実機 OK

## 次の選択肢 (= backlog から user 選択)

| 優先度 | task | 工数 |
|---|---|---|
| 🟡 | **10 番 有名サイト pre-set OFF list** (= 拡張 polish、 YouTube / Notion / Slack 等を「外すだけ」 で OFF できる事前リスト) | 小 (~50 行) |
| 🟡 | **音波テーマ世界観確立 sprint** (= H + J + K + I-09 + I-10) ※ session 54 で I-09 一部消化済 | 大 |
| 🟡 | **multi-playback vision board card autoplay** (= AllMarks core 差別化) | 大 |
| 🐛 | **B-#3 重複 URL でサムネ等が出ない** (= 古めの未解決、 session 54 で重複ピル fix した今が再調査の機会) | 中 |
| 🧹 | **TextCard.module.css の dead code 清掃** (= .headline / .index CSS モードと `_input` ignored arg を削除) | 小 (~30 行) |

## session 55 で確定した事 (= 前提として保持)

- **「最小修正」 の探求順序**: 新規 component 提案 → user 仕様確認 → 既存実装 read → 1-2 関数で済むことが多い
- **A 番 fix**: `shouldHideTweetBody` を「全 tweet 非表示」 から「種別判定」 に戻した (= text-only のみ非表示、 media + 本文ありは表示)
- **TextCard 統一化**: pickTitleTypography + measureTextCardLayout が constant 返却、 全カード 18px + 正方形 + scroll

## 引き継ぎ resources

- [docs/TODO.md](./TODO.md) — active backlog
- [docs/TODO_COMPLETED.md](./TODO_COMPLETED.md) — session 55 narrative (= A 番 + 統一化)
- [docs/private/IDEAS.md](./private/IDEAS.md) — H / J / K / I-08 / I-09 / I-10 セクション
- memory `feedback_user_observation_reveals_intent.md` (= user 観察で軌道修正)
- memory `feedback_jargon_in_japanese.md` (= ジャーゴン禁止、 平易な日本語)

## 月末リマインダー (= 2026-05-31)

`allmarks.app` ドメイン取得確認。 取得済なら 拡張機能の Chrome Web Store submit + 本体 rebrand sprint へ進む。
```

- [ ] **Step 4: docs 3 ファイルを 1 commit にまとめる**

```bash
rtk git add docs/TODO.md docs/TODO_COMPLETED.md docs/CURRENT_GOAL.md
rtk git commit -m "docs: session 55 close-out — A 番 fix + TextCard 統一化 narrative

- TODO.md §現在の状態 を session 55 内容 (A 番 + 統一化) に更新、 session 54 を旧情報へ
- TODO_COMPLETED.md に session 55 narrative 追記 (= 経緯 + ship 済 + 学び)
- CURRENT_GOAL.md を次セッション用に上書き

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: 引き継ぎメッセージを user に提示**

```
セッション 56 開始。 docs/CURRENT_GOAL.md と docs/TODO.md (§現在の状態) を読んで。

session 55 で 2 件 ship 完了:
- A 番 fix (= 画像 + 本文ツイートで Lightbox 右本文復活、 1 関数書き換え)
- TextCard 統一化 (= 全 TextCard 18px 正方形 + scroll、 2 関数 + テスト書き換え)
2 deploy、 604/604 PASS、 user 実機 OK。

次セッションは backlog から user 選択:
- 🟡 10 番 有名サイト pre-set OFF list (= 拡張 polish、 ~50 行)
- 🟡 音波テーマ世界観確立 sprint (= H + J + K + I-09 + I-10)
- 🟡 multi-playback vision board card autoplay (= AllMarks core 差別化)
- 🐛 B-#3 重複 URL でサムネ等が出ない
- 🧹 TextCard.module.css dead code 清掃 (= 短工数)

最初に user に「どれから着手する?」 と聞いて、 おすすめは 10 番 (= 小工数で拡張 polish 完走) or 清掃 (= 短工数のついで作業)。
```

---

## Self-Review

- ✅ spec §2 統一仕様 → Task 1 Step 1 + Task 2 Step 1 のコード block で値を 18 / 27 / 999 / 1.0 として実装
- ✅ spec §3 触る / 触らないリスト → File Structure で明示、 該当ファイルのみ Task で扱う
- ✅ spec §5 修正後の関数最終形 → Task 1-2 Step 1 で全文転記
- ✅ spec §6 manual verify 7 ケース → Task 5 Step 1 に完全転記
- ✅ spec §7 リスク評価 → Task 5 Step 2 の「NG パターン別の次手」 で各リスクへの初動を書き出し
- ✅ spec §8 deploy フロー → Task 4 で 3 step に展開
- ✅ A 番 docs 反映 → Task 6 で TextCard 統一化と batch で session 55 close 処理
