# 次セッションのゴール (= セッション 128)

## 今のゴール (1 行)

**テキストカード placeholder の刷新（生成アート＋スライドショー＋テーマ対応）を、既存の見え方にゼロ影響で実装する。**

## 開始時の動き
1. このファイル + [docs/private/IDEAS.md](./private/IDEAS.md) 末尾「テキストカード placeholder 刷新」セクションを読む（=完全な調査結果・計画・制約・チェックリスト）
2. user に「session 128 開始」+ 下の確認1つを出して着手

## 最初に user に確認すること（1つだけ）
- **音波バー(style1)を残す/外す**（賑やかなので緑絞り運用 or 除外）／**巡回は「同系統の微変化」か「別スタイル混在」か**
- モック再掲: https://allmarks.app/mockups/styles.png ・ https://allmarks.app/mockups/on-board.png

## 実装の要点（詳細は IDEAS.md）
- swap point は1関数 `lib/board/placeholder-image.ts pickPlaceholderImage` → 生成SVG data URI に。5消費者が一度に刷新。旧webp4枚削除可
- 新規 `lib/board/placeholder-art.ts`（軽量SVG・seed=URLハッシュ・**スケール非依存設計**）
- 「動く」= 既存 `use-slideshow-cycle.ts` 流用（div レイヤー crossfade）。`ambientOn` で自動停止
- **★ライトボックス制約（最重要）**: Lightbox は同じ PlaceholderCard を全画面拡大（LargePlaceholderCardScaler）。生成構図は全スケール対応必須＋巡回がライトボックスで動かないようスコープ管理
- 共有OG(capture-mirror)も同生成で WYSIWYG
- テーマ対応は palette 引数で将来差し込み（今は既定ブランド）

## ゼロ影響チェックリスト（厳守・IDEAS.md に詳細）
layout/スクリム/タイトル不変 / ライトボックス全スケール検証(Playwright) / アニメ停止条件 / プレビュー=OG=ボード一致 / 545枚軽量 / tsc・vitest・build・敵対検証・本番スモーク

## クリーンアップ（実装完了後）
- `public/mockups/`（本番に一時設置・未commit）と `scripts/og-placeholder-mockups.mjs`（未commit）を削除

## 監査フィックス（前回完了・参考）
- 確定44件 = 42 fix + 2 据え置き(rank31/rank43)。session127 で B8/B10/B11/B3 + 後続バグ修正（共有OG二重/CJKはみ出し/プレビュー≠実画像/legalリンク英語）すべて本番反映済。詳細 [docs/private/2026-06-22-audit-fix-progress.md](./private/2026-06-22-audit-fix-progress.md)
- B3 既定OGP画像(public/og.png)も user 承認待ち（暫定）

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII) 必須。応答は日本語。UI 変更は事前一言。
- **既知フレーキー**: `tests/lib/channel.test.ts` が full run でたまに落ちる→再実行 green。
- サブエージェントのモデルは作業の重さで使い分け。検証は省かない。
