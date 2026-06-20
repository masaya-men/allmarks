# 次セッションのゴール (= セッション 116)

## 今のゴール (1 行)

**✅ セッション 115 で 初回オンボーディング(対話型チュートリアル)を完成・本番反映 + 実機FBで3ラウンド改善(タグ自動化&くり抜き / 拡張デモ全面作り直し / Share NEXT / タグ・モーションを結果を見せてからNEXTで進む形に)。次は オンボーディングの継続改善(ユーザー希望) → ストア提出 → 残り公開前TODO。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態」を読む
2. `git status` クリーン確認(セッション115末で全コミット+push+本番反映済)
3. ユーザーに REPLAY INTRO の実機FBを聞く → 下記(A)から着手

## 次の最優先候補
- **(A) オンボーディング 継続改善(最優先・ユーザー希望「まだまだ改善したい」)**:
  - **🔴 タグ付けをタイピングアニメで見せる**(ユーザー明確リクエスト): 今は新しいカードに自動で『sample』タグが「パッと」付くだけ。これを **タグ入力欄に `s-a-m-p-l-e` と1文字ずつ打ち込むアニメ → 適用 → 緑チップが乗る** という様子を見せたい。実装案: タグシーンで本物の `TagAddPopover` を自動で開き、入力欄に文字送りアニメ(またはオンボーディング側のオーバーレイで疑似タイピングを見せてから `onApplySampleTag` を呼ぶ)。`TAG_AUTO_DELAY_MS`(現2200ms)との兼ね合いも調整。
  - その他、各シーンの演出速度・コピー・スポットライト位置の微調整を実機FBで継続。
  - 既知の小残(最終レビューMinor、必要なら): `installDetected` の毎レンダ DOM read、ExtensionSaveReenactment のループ演出の更なる作り込み。
- **(B) 拡張ストア提出**(ユーザー作業): デベロッパー登録(約¥800・一度きり)→ `dist/booklage-extension-0.1.20.zip` → 掲載文 [docs/extension-store-submission.md](./extension-store-submission.md) → 審査送信。公開後 `lib/board/constants.ts` の `EXTENSION_STORE_URL` 投入 → 再デプロイで「GET EXTENSION」点灯(オンボーディングの install/extDemo 導線も活きる)。
- **(C) 残り公開前TODO**: 赤い角バッジの正体調査(全カード共通の既存インジケータ・ユーザー気にしていた)/ ガイド操作動画 / テーマ1つ作る / モバイル最適化(ボード本体)/ バックアップ(EXPORT/IMPORT)表出し / 公式X開設→Contact導線。

## オンボーディング実装の要点(次に触るとき必読)
- 真実の場所: spec `docs/superpowers/specs/2026-06-20-onboarding-design.md` / plan `docs/superpowers/plans/2026-06-20-onboarding.md`。実装は `components/onboarding/` + `lib/onboarding/` + `BoardRoot`/`CardsLayer` 配線。
- **8シーン**: enter(START) → paste(Ctrl+V or TRY THIS=URLコピー→貼付) → tag(カードくり抜き+自動sampleタグ+結果確認+NEXT) → motion(MOTION強制OFF→押させる→動き確認+NEXT) → extDemo(GSAP再現・大きく明確) → install(ブックマークレットチップ/拡張検出で出し分け+NEXT) → share(SHARE開いて見せる・閉じるかNEXT) → finale。
- **重要な作法**: ①オーバーレイ root は `pointer-events:none`、対話要素だけ `auto`(穴から本物ボードへクリックが通る、シネマ stage は遮断)。②MOTIONは初回既定ON→motionシーン入場で `onRequestMotionOff` で強制OFF。③+TAG はホバー依存→`forceTagButtonVisible` で強制表示。④tag/motion は「結果を見せてから NEXT」(`tagApplied`/`motionOn` フラグで NEXT を出す)。⑤離脱時のデモカード掃除は「オンボーディングを開始しない全ロードで `clearOnboardingDemo`」。⑥下部キャプションは ScrollMeter を避けて `bottom:92px`。
- **i18n**: `board.onboarding.*`(scene毎 body + tag.done/motion.done/paste.copied/installDetected.body)を15言語同期。MOTION/SHARE/SETTINGS/TRY THIS/AllMarks は英語固定。
- **動作確認**: ユーザーは既存545件で自動開始しない → **SETTINGS の REPLAY INTRO**(or シークレットウィンドウ=空IDBで真の初回)。

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII)必須。`tsc <file>` 直叩き禁止 → `rtk tsc`。
- アプリ本体(`/board` `/s/*` `/save`)に言語接頭辞を付けない。`DB_NAME='booklage-db'` 等の内部符号は不変。
- 拡張(`extension/`)は tsc/vitest 対象外 → `node --check` 必須。視覚/実機は隔離レンダ(Playwright)+ユーザー実機の二段。
- デザイン変更は提案→承認(平文で相談、選択肢ボックスは使わない)。応答は日本語。
- **常にクリーンなセーブを維持**: 完了の区切りで commit+push、git=本番一致。
- **サブエージェント検証**: 報告を鵜呑みにせず commit が HEAD に乗ったか確認(セッション115で1体が孤立コミットを作った)。
