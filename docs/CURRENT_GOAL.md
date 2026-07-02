# 次セッションのゴール (= セッション 152)

## 今の状態（N-15 保存失敗を根本修正・master マージ済・拡張 v0.1.23 審査中）

**セッション151でやったこと（master `49ed5a9` マージ済・tsc0/vitest1875/build影響なし）：**

- **N-15「PC再起動後の初回保存が失敗する」を根本修正**。真因＝offscreen→iframe のコールドスタート race（iframe の `message` リスナーは React ハイドレーション後に張られるが、`window.postMessage` は未登録の窓宛てだと破棄＝初回 post が消える）。3視点ワークフローで敵対検証＋敵対レビュー（blocker 0）。
- **修正＝拡張のみ・web 無変更**: offscreen.js が envelope を 250ms ごと再送、iframe が返信 or 8s 期限まで（新 `extension/lib/offscreen-repost.js`）。保存=nonce 重複排除／add-tag=冪等なので二重保存なし。新テスト8。
- **拡張 v0.1.23 を Chrome ストアに提出済**（v0.1.22 は既に承認済＝順当な次版）。承認で既存ユーザーに自動更新。
- **体感確認は次回 reboot 後の最初の1件**（テスト＋レビューで論理確定済）。恒久記録＝memory `reference_extension_offscreen_iframe_ready_race`。

## 次にやる（セッション152）＝残りの気づき or 本命バックログ（**まず優先順を相談**）

### 残りの細かい気づき
- **N-19 カードのサイズ/位置を default に戻す** — 一括 or 個別リセット。要設計（UI 置き場所＝SETTINGS or カード右クリック？／"default" の定義＝自動サイズ＆保存順）。ブレストから。
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
