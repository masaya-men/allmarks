# 次セッションのゴール (= セッション 117)

## 今のゴール (1 行)

**🎬 オンボーディングを「1シーンずつ磨く」フェーズ。セッション116で 大刷新＋タグ画面のカメラズーム演出＋終了時クリーンアップ まで完了・本番反映済。次は ①入場 から順に、各シーンの速度・文言・見た目・配置を1つずつ詰める（ユーザーと相談しながら）。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態」を読む
2. `git status` クリーン確認（116末で全コミット+push+本番反映済）
3. ユーザーに「①入場シーンから磨きますか？」と確認 → REPLAY INTRO の実機所感を聞く

## 進め方（ユーザー指定）
- **1シーンずつ**。セッションを重くしないため、数シーンごとに区切る。
- 各シーンで (A)ユーザーが REPLAY INTRO を見て気になる所を言う / (B)Claude が改善案を1つずつ出す、のどちらでも。
- デザイン変更は提案→承認。応答は日本語。確認は **SETTINGS → REPLAY INTRO**（or シークレットウィンドウ）。

## シーン別・磨き候補（Claude の seed。順に潰す）
1. **入場(START＋言語)**: 言語切替の発見性（地球儀＋言語名だけ→「LANGUAGE」等の手がかり or もう少し目立たせる）。背景の0.96幕越しにデモカードが薄く見える（奥行きとして残すか不透明化するか）。SKIP が小さい(29×17)。
2. **貼る**: TRY THIS が「コピー→自分で貼る」の2段で間接的（サンプルを直接出す案も）。貼ったカードの着地をもっと見せる。
3. **タグ(ズーム＋タイピング)**: ズームの倍率(1.7)/緩急、読ませ→寄り→打鍵の各間（`TAG_READ_BEAT_MS`/`TAG_ZOOM_MS`）、大きいカード上での打鍵欄の位置・サイズ、done表示の保持時間。
4. **MOTION**: スポットライト位置、「動き出す」体験の見せ方。
5. **拡張デモ(PV)**: ループの間/repeatDelay、タグ選択ビートの速度、初回後の NEXT 緑pulse の分かりやすさ。タグチップは本物語彙に統一済。
6. **設置**: target無しで全面ダーク（cinema的）になる。ブックマークレットチップのドラッグ訴求、「chip」語彙は撤去済＋Ctrl/⌘+Shift+B案内追加済。
7. **共有(ショーケース)**: プレビュータイルの不揃い、自動前進 `AUTO_ADVANCE_MS=5200`（速い/遅い）、アスピレーショナル文言。
8. **フィナーレ**: 緑ディスクチェック統一（tag/motionのdoneは素の✓のまま=低優先の残）、空ボードへの着地。
- **横断**: doneの✓を緑ディスクチェックに統一（低優先）。SKIPのクリック領域拡大。

## 実装の要点（次に触るとき必読）
- 部品: `components/onboarding/{OnboardingController, OnboardingStage, OnboardingSpotlight, OnboardingTagTyper, OnboardingLanguagePicker, ExtensionSaveReenactment, ShareReenactment, BookmarkletInstallChip}`。
- **タグ画面の流れ**: `tagPhase: 'read'→'zoom'→'type'`。read(`TAG_READ_BEAT_MS=1500`)で文言→zoom(`onZoomToCard`→BoardRootの`zoomCameraToOnboardingCard`がカメラ層をGSAP変形、`TAG_ZOOM_MS=1200`)→type(`OnboardingSpotlight`がセンタリングされたカードをリング＋`OnboardingTagTyper`が`sample`打鍵→chip popで`onApplySampleTag`本物タグ→`tagApplied`でdone+NEXT)。NEXT/skipで`onZoomReset`。
- **カメラ層**: BoardRootで`InteractionLayer`だけを`cameraRef`(`.cameraWrap`)で包む。オンボーディングは兄弟なので`position:fixed`は無事、`canvasWrap`の`overflow:hidden`でズームが盤面内に収まる。
- **終了時クリーンアップ**: オンボ中の保存/タグ生成は全て`onboardingDemo`フラグ付き（demo seed / TRY THIS fallback / `useUrlPasteSave`の`flagOnboardingRef`経由の貼り付け / `handleTagCreate`の新規タグ）。`clearOnboardingDemo`がフラグ付きカード＋タグ(deleteTagCascade)を掃除。`onComplete`で`reload()`+`reloadTags()`＝ページ再読込なしで空状態に。**本物のブクマ/タグは無印=不可侵**（test: `tests/lib/onboarding-demo.test.ts`）。
- **共有**: `ShareReenactment`が自動再生→`AUTO_ADVANCE_MS`で自動前進、NEXTで早送り。本物パネルは開かない。

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII)必須。`tsc <file>` 直叩き禁止 → `rtk tsc`。
- アプリ本体に言語接頭辞を付けない。`DB_NAME='booklage-db'` 等の内部符号は不変。
- 視覚は隔離レンダ(Playwright `serve out -l 4321`)＋ユーザー実機の二段。デザイン変更は提案→承認。応答は日本語。
- **常にクリーンなセーブ**: 完了の区切りで commit+push、git=本番一致。
