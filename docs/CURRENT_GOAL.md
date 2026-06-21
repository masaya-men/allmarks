# 次セッションのゴール (= セッション 120)

## 今のゴール (1 行)

**🎬 オンボーディング仕上げ — ⑧フィナーレ（緑ディスク統一・空ボード着地）と ①入場の残りseed（言語切替の発見性・幕越し透け・SKIP当たり判定）。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態」を読む
2. `git status` クリーン確認（119末で全コミット+push+本番反映済）
3. 確認は **SETTINGS → REPLAY INTRO**（or シークレットウィンドウ=空IDBで真の初回体験）

## このセッションの候補（ユーザーと相談して着手）

### ⑧ フィナーレ（finale シーン）
- 現状は `OnboardingStage variant="finale"` ＋ `finale.body`「準備完了です。SETTINGS からいつでも再生できます。」だけ。**緑ディスク（Aロゴ／音波モチーフ）の演出統一**と**空ボードへの気持ちいい着地**を作り込む。
- 着地後はオンボのデモカードが掃除され（`clearOnboardingDemo`）、ユーザーの実ボードに戻る。フィナーレ→空状態（`EmptyStateWelcome`）の繋ぎを滑らかに。

### ① 入場まわりの残りseed（実機FBで継続）
- **言語切替の発見性**: START画面の `OnboardingLanguagePicker` がもっと気づかれるように。
- **幕越し透け**: 入場シネマの黒幕越しに次が薄く透ける演出（記憶 [[feedback_animation_world_consistency]]＝幕は「薄いカーテン」）。
- **SKIP当たり判定**: SKIPが押しやすいか（最前面化済だが当たり判定/視認性の微調整）。

## 119 で到達済（本番反映・実機FB A〜F 完了）
**A** 緑カーソル（5デモ全部、形不変＋緑フチ＋グロー）/ **B** 視線誘導統一（新 `OnboardingCursorGuide`＝緑カーソルが MOTION/SETTINGS/MANAGE を押しに行く＋⑦共有SHAREに緑パルスリング）/ **C** カメラズーム一般化は見送り（ヘッダーは枠外で不可、B で代替・承認済）/ **D** manage 2ビート化（SETTINGS説明→MANAGE操作、`manage.settingsBody` 新設）/ **E** ⑤文言「自動で付く→タグ付けできる」修正 / **F** ⑤拡張デモ2画面化（画面2＝新 `ExtensionXSaveReenactment`＝X風ツイートのブックマーク→本物ピル保存＝I-05実演、`extDemo.bodyX`／「保存ボタンは設定で隠せる」`extDemo.hideNote`）。i18n 15言語同期＋パリティ緑。

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII)必須。`tsc <file>` 直叩き禁止 → `rtk tsc`。
- 視覚は隔離レンダ（`sessionStorage['allmarks-onboarding-resume']='<scene>'` で各シーンへジャンプ → Playwright スクショ）＋ユーザー実機の二段。デザイン変更は提案→承認。応答は日本語。
- 大きめ改修(新component/100行+)は事前に方針確認。**常にクリーンなセーブ**(区切りで commit+push、git=本番一致)。
- 新オンボーディングseedは onboardingDemo フラグ管理（完了時に掃除、本物ブクマ不可侵）。新i18nキーは15言語同期＋パリティテスト。
