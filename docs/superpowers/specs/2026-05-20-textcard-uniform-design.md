# 2026-05-20 — TextCard 統一化 (= 文字サイズ + 形を全カードで揃える)

> session 55、 A 番 fix 直後に user 発案。 「文字のみツイートで短文と長文で見た目が違う」 → user 選択 (ii) 統一案 → 数値 (a) 18px + (e) 1.0 正方形 + (α) サイトアイコン上配置で確定。

---

## 1. 背景 (= 何を解決するか)

ボード上の文字のみツイートが文字数によって 3 つの違う見た目になっている (= 短文は大きい文字 + 短いカード、 中文は中サイズ + 中カード、 長文は小さい文字 + 高いカード)。 user の moodboard 体験では「同じ種類のものは同じ見た目で揃えてほしい」 という美意識があり、 統一仕様に変更する。

user 提示の reference 画像:
- 上端に **サイトアイコン (= X ロゴ) + サイト名 (= x.com)** が小さく
- その下に **本文テキスト** が連続して並ぶ
- カードは **正方形** に近い形
- 長文ははみ出たら **底フェード** で「下にまだ続く」 シグナル + **スクロール可能**

---

## 2. 統一仕様

| 項目 | 値 | 備考 |
|---|---|---|
| 文字サイズ | **18px** | 現在の中文 (editorial) モード相当、 短文も長文も全部 18px に統一 |
| カードの形 (aspectRatio) | **1.0 (正方形)** | カード幅 = カード高さ、 TUNE スライダーで幅を変えると高さも同期で変わる |
| 上端の配置 | サイトアイコン + サイト名を上に固定 | 現在の中文モードの見え方を全カードに広げる |
| 行間 (line-height) | **27px** (= 18 × 1.5) | 現在の editorial と同じ |
| 文字の混雑時 | **スクロール** + 底フェード | はみ出ても省略 (…) しない、 縦にスクロールで全部読める |
| max-lines (行数上限) | **実質無制限** | スクロールで読めるので clamp 不要、 値としては大きい数 (= 999) を入れて安全側 |

---

## 3. 触る / 触らないリスト

### ✏️ 触るファイル (= 2 個 + テスト)

1. [`lib/embed/title-typography.ts`](../../../lib/embed/title-typography.ts) — `pickTitleTypography` 関数を「入力に関係なく常に固定値を返す」 に書き換え (= 文字数による 3 段階分岐 + CJK 幅計算ロジック 廃止)
2. [`lib/embed/text-card-measure.ts`](../../../lib/embed/text-card-measure.ts) — `measureTextCardLayout` 関数を「常に aspectRatio = 1.0 + maxLines = 999 + clamped = false を返す」 に書き換え (= pretext による natural height 計算は不要、 9:16 ceiling 判定も不要)
3. [`lib/embed/title-typography.test.ts`](../../../lib/embed/title-typography.test.ts) — 既存 6 テストを「固定値返すこと」 を確認する 1-2 テストに統合

### 🚫 触らないファイル

- [`components/board/cards/TextCard.tsx`](../../../components/board/cards/TextCard.tsx) (= コンポーネント本体)、 [`TextCard.module.css`](../../../components/board/cards/TextCard.module.css) (= CSS、 .headline / .index クラスは dead code 化するが残置)
- [`components/board/Lightbox.tsx`](../../../components/board/Lightbox.tsx) (= LargeTextCardScaler は TextCard 共有なので自動で統一仕様に追従)
- 他カード系: ImageCard / VideoThumbCard / MinimalCard、 ボードレイアウト (skyline)、 PiP、 拡張機能、 IDB スキーマ
- A 番 で先程 fix した `shouldHideTweetBody` 関数 (= 別領域)

---

## 4. 副次効果 (= 確認済 / 受容)

1. **TextCard.module.css の `.headline` / `.index` モードが dead code 化**: 今回は残置 (= 将来 polish sprint で削除)
2. **IDB の aspectRatio 値が古いまま**: 既存カードは IDB に変動値が残ってる。 TextCard が render される度に `persistMeasuredAspect(cardId, 1.0)` で 1.0 を上書きする自己修復ロジック (= 既存) で時間とともに全カードが 1.0 化。 マイグレーション スクリプト不要
3. **Lightbox の文字のみツイート表示も自動統一**: LargeTextCardScaler が内部で TextCard を共有しているので、 TextCard が統一仕様になるとライトボックスも追従。 別途修正不要
4. **既存の短文カードが急に「大きな空白付き正方形」 に見える**: user 仕様要望どおり。 短文の余白美を狙う

---

## 5. 修正後の各関数の最終形

### pickTitleTypography (= 大幅簡略化)

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

### measureTextCardLayout (= 大幅簡略化)

```ts
import type { TitleTypographyResult } from './types'

export const TEXT_CARD_MIN_ASPECT = 1.0  // 既存定数を 9/16 → 1.0 に更新 (= 「最小」 概念も不要だが定数名は流用)

export type TextCardLayout = {
  readonly aspectRatio: number
  readonly maxLines: number
  readonly clamped: boolean
}

/**
 * Session 55 統一化: 全 TextCard が正方形 (= aspect 1.0)、 maxLines は実質無制限。
 * 既存の pretext による natural height 計算は廃止 (= scroll で溢れるので measure 不要)。
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

### tests (= 6 ケース → 2 ケース)

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

---

## 6. テスト方針

### unit test

- [`lib/embed/title-typography.test.ts`](../../../lib/embed/title-typography.test.ts) を §5 の 2 テストに置き換える (= 6 → 2)
- `measureTextCardLayout` のテストファイルは現状なし、 新規追加は今回 **見送り** (= 関数が固定値返すだけなので unit test は overkill、 manual verify で十分)

### manual verify (= deploy 後 user に確認してもらう)

| # | テスト内容 | 期待動作 |
|---|---|---|
| 1 | 短い文字のみツイート (5-10 文字) | 正方形カード、 18px 文字、 上にサイトアイコン + サイト名、 文字は上寄せで下に大きな空白 |
| 2 | 中くらいの文字のみツイート (50 文字前後) | 同じ正方形カード、 18px 文字、 何行か並ぶが余白も少し残る |
| 3 | 長い文字のみツイート (200 文字以上) | 同じ正方形カード、 18px 文字、 はみ出した部分は底フェードで隠れて scroll で読める |
| 4 | ライトボックスで短い文字ツイート開く | 正方形のまま大きく拡大、 18px の比率も維持 |
| 5 | ライトボックスで長い文字ツイート開く | 同上、 拡大した正方形内で scroll 可能 |
| 6 | A 番 fix が壊れていないこと | 画像 + 本文ツイートで右側に本文表示 (= 直前の修正、 regression check) |
| 7 | 画像カード / 動画カードの形 | TUNE スライダー以外で何も変わらないこと (= 文字以外は触ってない) |

### regression check

- vitest 608 件中、 既存の title-typography 関連テスト (= 6 件、 §5 で 2 件に置き換え) 以外は **全て pass 維持**
- ボードの skyline レイアウトが新しい aspect 1.0 で正しく組まれること (= 各カードが正方形に並ぶ)

---

## 7. リスク評価

1. **既存カードが急に正方形になって user 体感が悪い**: user 仕様要望どおりなので想定済、 ただし「思ってたのと違う」 なら微調整 (= aspect 値や font 値の再選択) で対応
2. **長文ツイートで scroll が見えにくい**: 既存の底フェード + ホバー RGB グリッチ (= session 52 redesign) が「下に続く」 シグナルとして既に機能している、 regression なし
3. **既存テストの落ち** : §5 のテスト置き換えで対応、 他テストへの巻き込みなし (= title-typography のみが該当)
4. **dead code 化した CSS / 関数引数** : `pickTitleTypography` の `_input` は signature 互換のため残置、 TextCard.module.css の .headline / .index は dead だが残置 (= 別 polish sprint で清掃)

---

## 8. 実装後の deploy + 確認フロー

1. `lib/embed/title-typography.ts` + `lib/embed/text-card-measure.ts` + テストを commit
2. `pnpm build` + `tsc` + `vitest run` で全部 pass 確認
3. `wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true` で本番反映
4. user に「§6 の 7 ケース実機で確認してね」 と提示
5. 全部 OK なら A 番 fix と合わせて session 55 docs update + close

---

## 9. 非対象 (= 別 task)

- TextCard.module.css の dead 化した .headline / .index クラス削除
- pickTitleTypography 関数自体の削除 (= caller が 1 行で書ける所まで簡略化されるなら関数廃止も検討、 別 sprint)
- 文字色 / colorVariant の挙動変更 (= 今回は触らない)
- カード幅 (cardWidth) の TUNE スライダー挙動変更 (= TUNE の数値範囲は別 task)
