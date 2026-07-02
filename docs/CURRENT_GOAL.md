# 次セッションのゴール (= セッション 152)

## 今の状態（N-15 保存失敗を根本修正・master マージ済・拡張 v0.1.23 審査中）

**セッション151でやったこと（master `49ed5a9` マージ済・tsc0/vitest1875/build影響なし）：**

- **N-15「PC再起動後の初回保存が失敗する」を根本修正**。真因＝offscreen→iframe のコールドスタート race（iframe の `message` リスナーは React ハイドレーション後に張られるが、`window.postMessage` は未登録の窓宛てだと破棄＝初回 post が消える）。3視点ワークフローで敵対検証＋敵対レビュー（blocker 0）。
- **修正＝拡張のみ・web 無変更**: offscreen.js が envelope を 250ms ごと再送、iframe が返信 or 8s 期限まで（新 `extension/lib/offscreen-repost.js`）。保存=nonce 重複排除／add-tag=冪等なので二重保存なし。新テスト8。
- **拡張 v0.1.23 を Chrome ストアに提出済**（v0.1.22 は既に承認済＝順当な次版）。承認で既存ユーザーに自動更新。
- **体感確認は次回 reboot 後の最初の1件**（テスト＋レビューで論理確定済）。恒久記録＝memory `reference_extension_offscreen_iframe_ready_race`。

## 次にやる（セッション152）＝**N-19 から**（ユーザー指定・下ごしらえ済）

### N-19 下ごしらえ（s151 で実コード調査済・ここから始める）

**重要: N-19 は「ゼロから設計」ではなく、大半が既に実装済みと判明。**

- **カードのサイズ保存**: `BookmarkRecord.cardWidth?: number`（連続px）＋ `customCardWidth?: boolean`（true=手動リサイズ済＝ヘッダー Size スライダー無視）[indexeddb.ts:52-61](../lib/storage/indexeddb.ts#L52)。
- **個別サイズリセット＝既に存在**: カード隅の ↺ ボタン（`hasCustomWidth===true` の時だけ表示）[CardCornerActions.tsx:103](../components/board/CardCornerActions.tsx#L103) → `handleCardResetSize` [BoardRoot.tsx:584](../components/board/BoardRoot.tsx#L584) → `resetCustomWidth` [use-board-data.ts:670](../lib/storage/use-board-data.ts#L670) → `clearCustomCardWidth` [indexeddb.ts:1239](../lib/storage/indexeddb.ts#L1239)（flag を false に、幅の数値は無害なので残す）。
- **一括リセット＝ロジックは実装済・UI 未配線の可能性**: `clearAllCustomCardWidths` [indexeddb.ts:1255](../lib/storage/indexeddb.ts#L1255) / `resetAllCustomWidths` [use-board-data.ts:687](../lib/storage/use-board-data.ts#L687)。だが TUNE の `onReset` は**全体スライダー(W/G)を戻すだけ**で個別 override は触らない [TuneTrigger.tsx:128](../components/board/TuneTrigger.tsx#L128) / `handleResetWidthGap` [BoardRoot.tsx:449](../components/board/BoardRoot.tsx#L449)。→ **「全カードのサイズを default に戻す」ボタンの置き場所（SETTINGS or TUNE）を決めて配線するのが実質の残り**。
- **位置は保存されない**: 常に skyline 自動レイアウト（メイソンリー）で計算 [skyline-layout.ts:94](../lib/board/skyline-layout.ts#L94)。順番は `BookmarkRecord.orderIndex`（DESC=新しい順）[indexeddb.ts:49](../lib/storage/indexeddb.ts#L49)。→ **「位置を default に戻す」は自動配置モデルでは意味を持たない**（要ユーザー確認：位置の話は本当に必要？）。

**次回の最初の相談ポイント**（ブレスト冒頭でユーザーに確認）:
1. 個別の ↺ リセットが既にあるのを知っているか（知らなければ発見しづらい＝もっと目立たせる？）。
2. 欲しいのは**「全カードのサイズを一括で default に戻す」**か。置き場所は SETTINGS ドロワー or TUNE のどちらが良いか。
3. 「位置」も戻したいのか（自動配置なので実質サイズだけで足りるはず。ユーザーの実際の困りごとを聞く）。

### その他候補（N-19 の後 or 別途）
- **N-05 LP ナビの格納演出** — Features 等を選ぶとメニューから消え、スクロールで語がヘッダーに入ると緑玉付きで右へ「しゅん」と格納。要設計（IDEAS.md N-05）。

### 本命バックログ
- ③プレミアムテーマ制作／④K3 解錠実装（`docs/private/2026-07-01-k3-unlock-plan.md`）／選択的シェア／タグ付け強化。

### N-15 の任意フォローアップ（急がない）
- 保存不能時に「後で自動で保存し直す」保存キュー（業界最上位対応・別機能）。
- コンテキストメニューの `onStartup` 冪等生成（Chrome が永続化するので実害薄い）。

## 守ること（毎回）
- default 盤面 byte-identical。web 変更時は deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。deploy `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`
- **機微情報は `docs/private/` のみ。tracked に書かない・commit しない**（CLAUDE.md 厳守）
- 拡張の反映はストア審査経由（Web デプロイでは届かない）。即確認は `chrome://extensions`→`extension/` を unpacked ロード。**拡張は tsc/vitest 対象外→ `node --check` 必須**（ESM は `.mjs` にコピーして）
- **save-iframe への新規メッセージは「再送 or readiness ハンドシェイク」必須**（単発 postMessage は初回ロードで消える＝memory 記録済）
- board のドラッグ/カードクリック検証は Playwright の `page.mouse`（CDP=trusted）なら可。拡張UIは実CSSを scratchpad にコピーして独立再現
- 既知フレーキー: `tests/lib/channel.test.ts`（再実行で緑）。応答は日本語・簡潔に
