# 次セッションのゴール (= セッション 119)

## 今のゴール (1 行)

**🎬 オンボーディングのシーン磨きを継続。次は ⑦共有（ショーケース）→ ⑧フィナーレ → ①入場の残りseed。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態」を読む
2. `git status` クリーン確認（118末で全コミット+push+本番反映済）
3. 確認は **SETTINGS → REPLAY INTRO**（or シークレットウィンドウ）

## このセッション(118)でやったこと（本番反映済）
- **⑥設置 = 2ビート忠実デモ**: ⑤拡張デモと対に。**ビート1**＝偽ブラウザ枠＋ブックマークバーの「AllMarks」しおり→カーソルでクリック→**本物そっくりの保存窓**（新 `SaveToastFace` が `SaveToast.module.css` を共有＝顔はドリフト不可）が Saving→Saved→タグチップ緑点灯。**ビート2**＝本物ドラッグチップ。新ファイル: [BookmarkletSaveReenactment.tsx](../components/onboarding/BookmarkletSaveReenactment.tsx) / `.module.css` / [SaveToastFace.tsx](../components/bookmarklet/SaveToastFace.tsx)。本物の保存窓 `SaveToast.tsx` は無改変。
- i18n `install.demoCaption` 15言語 + `board.onboarding` パリティテスト新設。敵対的レビューで確定指摘（顔限定のドリフト文言・aria重複・props引き締め・パリティ）解消。

## 次にやる本命: ⑦共有（ショーケース）の磨き
- 現状は [ShareReenactment.tsx](../components/onboarding/ShareReenactment.tsx)（板を画像化プレビュー＋共有リンク＋アクション、自動前進・サーバー共有は作らない）。
- 磨きどころ（116/117メモより）: プレビュータイルの不揃い・自動前進速度・文言。⑤⑥と同じ「本物UIの忠実再現」方向に格上げできるか要検討（本物の SHARE パネル/書き出し見た目を流用？）。
- 小掃除（118レビューが指摘・既存の軽微事項）: `ShareReenactment.tsx` の `gsap.set/to(panel,…)` が `panel` の null ガード無し → jsdom テストで「GSAP target null not found」警告（無害・全テストpass）。⑦を触るついでに冒頭 null ガードを足すと綺麗。

## その後の残り（シーン磨き）
- **⑧フィナーレ**: 緑ディスクチェック統一・空ボードへの着地。
- **①入場(START＋言語)**: 言語切替の発見性（🌐＋言語名→「LANGUAGE」手がかり）、背景0.96幕越しのデモカード透け、SKIP の当たり判定(約29×17)拡大。

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII)必須。`tsc <file>` 直叩き禁止 → `rtk tsc`。
- 視覚は隔離レンダ＋ユーザー実機の二段。デザイン変更は提案→承認。応答は日本語。
- 大きめ改修(新component/100行+)は事前に方針確認。**常にクリーンなセーブ**(区切りで commit+push、git=本番一致)。
- 新オンボーディングseedは onboardingDemo フラグ管理（完了時に掃除、本物ブクマ不可侵）。LP見た目が大きく変わったら `node scripts/capture-lp-shot.mjs` で `lp-hero-shot.webp` を撮り直す（⑤⑥が使用）。
