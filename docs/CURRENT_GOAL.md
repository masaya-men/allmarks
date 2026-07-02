# 次セッションのゴール (= セッション 151)

## 今の状態（ボード磨き＋細かい nit を master に集約済・拡張は審査提出済）

**セッション150＋150続きでやったこと（すべて master マージ済・tsc0/vitest1867/build OK）：**

1. カード内ボタンのホバー反応（▶風 拡大＋明るく）／ドラッグ中 grabbing カーソル／テキストカード scrollbar 誤ライトボックス修正（前半）。
2. **N-17 EMPTY TRASH を赤 danger 表示**（本番反映・確認OK）。
3. **N-18 拡張クイックタグ窓の見切れ → 1列スクロール化**。拡張 **v0.1.22** パッケージ → **2026-07-02 Chrome ウェブストア更新提出済（審査待ち）**。承認で既存ユーザーに自動更新。
4. N-14（Lightbox 中モーション）＝既に停止済で対応不要／ N-16（空ボード青モーダル）＝スマホ限定で保留。

## 次にやる（セッション151）＝残りの気づき or 本命バックログ（**まず優先順を相談**）

### 残りの細かい気づき（今回の続き）
- **N-15 拡張の再起動後・初回1回だけ保存失敗するかも** — service worker コールドスタート/接続未確立が疑い。**実 reboot 再現が難点** → まずコード経路（background/SW の接続 readiness、content→SW メッセージのリトライ）を調査し防御的対策。
- **N-19 カードのサイズ/位置を default に戻す** — 一括 or 個別リセット。要設計（UI 置き場所＝SETTINGS or カード右クリック？／"default" の定義＝自動サイズ＆保存順）。ブレストから。
- **N-05 LP ナビの格納演出** — Features 等を選ぶとメニューから消え、スクロールで語がヘッダーに入ると緑玉付きで右へ「しゅん」と格納。要設計（IDEAS.md N-05）。

### 本命バックログ
- ③プレミアムテーマ制作／④K3 解錠実装（`docs/private/2026-07-01-k3-unlock-plan.md`）／選択的シェア／タグ付け強化。

## 守ること（毎回）
- default 盤面 byte-identical。deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。deploy `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`
- **機微情報は `docs/private/` のみ。tracked に書かない・commit しない**（CLAUDE.md 厳守）
- 拡張の反映はストア審査経由（Web デプロイでは届かない）。即確認は `chrome://extensions`→`extension/` を unpacked ロード
- board のドラッグ/カードクリック検証は Playwright の `page.mouse`（CDP=trusted）なら可（setPointerCapture 効く）。headless=overlay/headed=classic でスクロールバー描画が違う。拡張UIは実CSSを scratchpad にコピーして独立再現
- 既知フレーキー: `tests/lib/channel.test.ts`（再実行で緑）。応答は日本語・簡潔に
