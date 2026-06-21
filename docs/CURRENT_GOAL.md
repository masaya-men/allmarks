# 次セッションのゴール (= セッション 119)

## 今のゴール (1 行)

**🎬 オンボーディング ブラッシュアップ（ユーザー実機FB）— 視線誘導の統一・デモカーソルの区別・manage 分割・⑤拡張デモの修正＆拡充。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態」を読む
2. `git status` クリーン確認（118末で全コミット+push+本番反映済）
3. 確認は **SETTINGS → REPLAY INTRO**

## このバッチ（ユーザー指示・優先）
セッション118末にユーザーが実機を見て出したFB。**実装は次回**（118で「区切る」指示）。原文に忠実に：

### A. デモカーソルをユーザーのカーソルと区別（最優先・全デモ共通）
- **矢印の形は変えない**。**緑で縁取り（グロー）**を足す。理由＝ユーザーの実カーソルと混同しないため。
- 対象: 全デモの `.cursor`（[BookmarkletSaveReenactment](../components/onboarding/BookmarkletSaveReenactment.module.css) / ExtensionSaveReenactment / OnboardingPasteCursor / OnboardingTagDemo / [OnboardingShareReveal](../components/onboarding/OnboardingShareReveal.module.css)）。今は白塗り＋黒フチの矢印 SVG data-URI。緑フチ版に差し替え。

### B. 視線誘導を全インタラクティブ箇所で統一
- **押す場所（MOTION / SETTINGS / MANAGE / SHARE 等）を明確化**：①ターゲットを**パルス**でアピール＋②**偽物の（緑）カーソルがそこへ動いて押す**動作で誘導。
- 特に **SHARE の紹介**は今「視線誘導されないまま始まる」→ 誘導してから始める（④で本物SHAREを押す動作は入れたが、もっと明確に・パルス＋導線）。

### C. 見せたい箇所にまず「ズーム」して導入（アニメ一貫性のため・検討）
- ③タグ scene のカメラズームのように、**各シーンで見せたい箇所にまず寄る**演出を全箇所で統一すると一貫性が出る、というユーザー提案。BoardRoot の `zoomCameraToOnboardingCard` 系を一般化できるか検討。

### D. manage シーンを2ビート化（説明と操作を混ぜない）
- 今の1枚キャプション（SETTINGS off と MANAGE を1文に混ぜている＝ユーザー「混ぜないで」）を分割：
  - **ビートA**: **SETTINGS を強調**しながら「保存の際に出るウィンドウが必要なければ SETTINGS からいつでもオフにできます」→ NEXT。
  - **ビートB**: **MANAGE の説明**＋（緑カーソルで誘導して）クリック → 本物 triage（既存の②フロー）。
- `manage.body` を分割（SETTINGS文 / MANAGE文）。`manage.triageBody` はそのまま。15言語。

### E. ⑤拡張デモの文言修正（誤り・要修正）
- 現「AllMarks 拡張機能を入れると、どのページでも1クリックで保存。**同時にタグも自動で付きます**。」→ 自動では付かない。「**同時にタグ付けできます**」に。
- en: `extDemo.body` "…and tags it automatically." → "…and you can tag it at the same time." 15言語同期。

### F. ⑤拡張デモに内容追加
- **フローティングボタンを非表示にできる**ことを紹介（実在: 拡張のオプション）。
- **有名サイトはブックマークボタン等で AllMarks に追加できる**ことを紹介（= 既存の拡張連動 **(I-05)**。`extension/twitter.js` 等で実装済＝Xのいいね/ブクマ→AllMarks 保存）。
- **X(Twitter)の模倣画面**を作り、**Xのブックマークボタンを押す→AllMarks に保存される**さまをアニメで見せる（緑カーソルで誘導）。⑤拡張デモの作り（[ExtensionSaveReenactment](../components/onboarding/ExtensionSaveReenactment.tsx)＝偽ブラウザ枠＋本物UI＋GSAP）を流用。IDEAS の (I-05) 参照。

## その後（バッチ後）
- **⑧フィナーレ**（緑ディスク統一・空ボード着地）/ **①入場の残りseed**（言語切替の発見性・幕越し透け・SKIP当たり判定）。

## 118 で到達済（本番反映）
全シーン「本物UIの実演」へ: ⑤拡張/⑥ブックマークレット=本物の保存窓、**⑦共有=本物 `SenderShareModal` 非対話**、**manage=実クリックで本物 `/triage`→自動デモ＋パン→CONTINUEで共有に再開**、デモカーソル矢印化、③タグ done 文言。順: ①→②→③→④→⑤→⑥→**manage**→⑦→⑧。

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII)必須。`tsc <file>` 直叩き禁止 → `rtk tsc`。
- 視覚は隔離レンダ＋ユーザー実機の二段。デザイン変更は提案→承認。応答は日本語。
- 大きめ改修(新component/100行+)は事前に方針確認。**常にクリーンなセーブ**(区切りで commit+push、git=本番一致)。
- 新オンボーディングseedは onboardingDemo フラグ管理（完了時に掃除、本物ブクマ不可侵）。
