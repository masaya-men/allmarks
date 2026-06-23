# 次セッションのゴール (= セッション 128)

## 今のゴール (1 行)

**監査フィックスは全44件 処理完了・本番反映済。次は (1) B3 既定 OGP 画像の最終承認/差し替え、(2) 公開前の残り片付け or 次の機能、を user と決めて進める。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態」を読む
2. 監査の詳細が要れば [docs/private/2026-06-22-audit-fix-progress.md](./private/2026-06-22-audit-fix-progress.md)（全件決着済み・真実の場所）
3. user に「session 128 開始」+ 下記の残りアクションを 1 行で提示して続行確認

## 残りの user アクション（監査の積み残しはこれだけ）
- **B3 OGP 画像の承認**: `public/og.png`（黒地+白A緑チェック+ワードマーク+タグライン+音波+allmarks.app）は Claude 暫定版。OK なら確定、変えたいなら方針（タグライン/レイアウト/実カードのコラージュ風/ブランド色）を聞いて `scripts/generate-og-image.mjs` を編集→再生成。**X等で `allmarks.app` を貼って実際のカード見た目を確認推奨**（キャッシュは debugger で更新）
- **rank29 リサイズの体感かくつき**: user が「少し感じる」と報告。選択肢＝(a) 8px gate の刻みを小さく/無しに(滑らかさ↑・負荷↑) (b) computeSkylineLayout 自体の最適化を別タスク化(根本) (c) 現状維持。どれにするか相談

## 監査の最終結果（session 122〜127）
- **確定44件 = 42 fix + 2 据え置き(理由付き)**。偽陽性も全件決着。
- session127 で B8(共有堅牢性)/B10(パフォ・React)/B11(i18n)/B3(OGP画像) を実装+敵対検証+本番反映。
- 据え置き: rank31(by-tag index 不要)・rank43(複数タブ初回オンボ＝デモのみ)。

## 公開前の片付け候補（監査外・将来）
- 未使用 `chrome-extension/` 削除 / `EXTENSION_STORE_URL` 投入(ストア公開時) / 拡張 options 画面の多言語化 / ボード内 chrome 文章(TrashConfirm 等)の多言語化

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII) 必須。応答は日本語。
- UI 変更は事前一言（ui-design.md）。新 i18n キーは15言語同期（`messages/all-keys-parity.test.ts` が照合）。
- **既知フレーキー**: `tests/lib/channel.test.ts`（BroadcastChannel タイミング）が full run でたまに落ちる→再実行で green。無関係。
- サブエージェントのモデルは作業の重さで使い分け（機械的=haiku/sonnet、調査=sonnet、難所+敵対検証=opus）。検証は省かない。
