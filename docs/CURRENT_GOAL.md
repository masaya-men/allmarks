# 次セッションのゴール (= セッション 142)

## 今の状態（セッション141で完了・allmarks.app 反映済み）

Paper テーマをユーザー対話でブラッシュアップ。全て本番反映済・tsc0/vitest1816/build OK・default(黒+音波) 無傷（全変更 paper-scoped or paper-gate）。

- **(N-08) 中央上の「線」解消＋手書き下線** — 正体は閉じた TUNE/SETTINGS drawer の border 漏れ（SETTINGS は body portal で Lightbox 貫通）。羊皮紙サーフェスを `[data-open=true]` 限定に。代わりにメニュー下へ**かすれた筆の連続インク下線**（SVG turbulence filter, TopHeader `.group::after`）。
- **(N-11) タグ絞り込みの黄緑解消** — active 行/タグドット等の `#28F100` を paper では forest `#2f4a37` に。
- **(N-12) Lightbox で写真だけ額縁から持ち上げ** — paper 画像カードは台紙＋空窓を盤面に残し写真だけ飛ぶ。clone を `[data-paper-window]` 限定。**開閉アニメは実機未確認（要ユーザー確認）**。
- **テキストカード**: 先頭が切れる不具合修正（`.paperNoteScroll` を `align-items: safe center`）＋ Lightbox で紙シートのまま拡大（`useIsPaperTheme`）。
- **画像カードの台紙リデザインは実験→混乱→revert**（pre-N-13 のシンプル状態へ）。詳細・次の段取りは TODO.md (N-13)。

## 次にやる（セッション142・ユーザーと一緒に、1コミット=1確認で小さく）

1. **画像カードの台紙リデザインを区切ってやり直す**（TODO.md N-13 の①〜④順）。まず **②写真/動画の乗せ方=「白い下地を出さず台紙に直接 cover で乗せる（見切れOK）」** から。`.paperPhoto` の白窓(`--paper-window-bg`)撤去＋`contain`→`cover`。1つ出して実機確認→次へ。
2. その後 **①台紙の品質**（低解像 `card-mat-1/2/3/aged` を除外）→ **③シート（方眼/ノート）の見せ方**。
3. **N-12 の開閉アニメをユーザー実機確認**（写真が額縁から抜ける/戻るか、default LB が無変更か）。

## 守ること（毎回）
- default 盤面 byte-identical。deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。deploy は `--project-name=allmarks --branch=master`。
- **台紙は一気にいじらない**。1変更=1デプロイ=1実機確認。ユーザーが混乱したら即止めて revert を提案。
- playwright で board カードのクリックは setPointerCapture で不可（Lightbox 開閉は実機確認に頼る）。paper の実機再現は IDB の `settings/board-config` に `themeId:'paper-atelier'` をシード。
- 既知フレーキー: `tests/lib/channel.test.ts`（再実行で緑）。応答は日本語、簡潔に。
