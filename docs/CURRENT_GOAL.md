# 次セッションのゴール (= セッション 118)

## 今のゴール (1 行)

**🎬 オンボーディングのシーン単位の磨きを継続。次は ⑥設置(ブックマークレット) を ⑤拡張デモと同じ「本物UIの忠実再現」にする。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態」を読む
2. `git status` クリーン確認（117末で全コミット+push+本番反映済）
3. 確認は **SETTINGS → REPLAY INTRO**（or シークレットウィンドウ）

## 次にやる本命: ⑥設置 = ブックマークレットの忠実デモ（ユーザー希望）
- ⑤拡張デモと同じ方針で「**本物の画面（LPスクショ流用可）＋本物の保存UI**」にする。
- **本物の保存窓 = [SaveToast.tsx](../components/bookmarklet/SaveToast.tsx)**（拡張なしのブックマークレット保存窓。`Saving → Saved / Already saved / Failed`＋ring/brand/glow、256×256、任意でコンパクトTagAddPopover）。これを忠実再現に流用。
- 流れ案: ブラウザ枠＋**ブックマークバーに「AllMarks」ブックマークレット**（バーは模型／ツールバー拡張アイコン同様、ブラウザchromeは描画不可なのでバーは作り物）→ カーソルがブックマークレットをクリック → **本物の /save 窓がポップ（Saving→Saved）** → 任意でタグ。
- 現状の ⑥ は `BookmarkletInstallChip`（ドラッグして設置）＝「設置の説明」。**使い方デモ（保存の様子）を見せる**形に格上げするか、設置＋デモの2ビートにするか要判断。
- 移植元参考: [extension-ui.css](../components/onboarding/extension-ui.css) と [ExtensionSaveReenactment.tsx](../components/onboarding/ExtensionSaveReenactment.tsx)（⑤の作り）。SaveToast の見た目は `SaveToast.module.css` から移植 or `:global` 注意（⑤と同じくグローバルCSSで回避済の手法が使える）。

## その後の残り（シーン磨き）
- **⑦共有(ショーケース)**: プレビュータイルの不揃い・自動前進速度・文言。
- **⑧フィナーレ**: 緑ディスクチェック統一・空ボードへの着地。
- **①入場(START＋言語)**: まだ未着手の seed が残る — 言語切替の発見性（🌐＋言語名だけ→「LANGUAGE」手がかり）、背景0.96幕越しのデモカード透け、SKIP の当たり判定(約29×17)拡大。

## このセッション(117)でやったこと（全て本番反映済・ユーザー承認済）
- **②貼る**: 全面スポットライト廃止→中央カード＋暗幕、URL欄＋COPYボタン(input禁止でCtrl+V保証)、一行コピー15言語、ふわっと入場、**COPY後に盤面を明るく＋下部プロンプト＋デモカーソルが空き地をカチッ**、ScrollMeterをチュートリアル中非表示。
- **③タグ**: 4ビート化(zoom→intro→demo→done)。**本物の+TAGを実測して光らせ・カーソルでクリック**、メニューは本物位置に出現、入力はカーソルが脇へどいて2.5倍ゆっくり、完了で全体暗転＋下部メッセージ。
- **④MOTION**: デモseedを動くカードで刷新(複数画像3＋**本物YouTube4本(Blender作品, oEmbed検証済)**＋静止)、**MOTION ONで盤面を明るく見せる**2ビート、done文言15言語。
- **⑤拡張デモ**: **本物の拡張UIを忠実再現**(cursor pill / floating button / tag strip を `extension/` から1:1移植、新規 extension-ui.css)＋**AllMarks LPスクショ**(`public/onboarding/lp-hero-shot.webp`, `scripts/capture-lp-shot.mjs`)上で実演。

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII)必須。`tsc <file>` 直叩き禁止 → `rtk tsc`。
- 視覚は隔離レンダ＋ユーザー実機の二段。デザイン変更は提案→承認。応答は日本語。
- 大きめ改修(新component/100行+)は事前に方針確認。**常にクリーンなセーブ**(区切りで commit+push、git=本番一致)。
- LPスクショは LP の見た目が大きく変わったら `node scripts/capture-lp-shot.mjs`(serve out/ 後)で撮り直す。
