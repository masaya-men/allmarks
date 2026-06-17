# 次セッションのゴール (= セッション 107)

## 今のゴール (1 行)

**🎉 session 106 完了・本番反映・user 確認済: i18n 言語切替の「層①(アプリ本体)」を配線。ボード右下に 🌐 言語切替(畳=`🌐 JA`、開くと 15 言語が各言語自身の名前=日本語/中文/한국어…)。「保存値→ブラウザ言語→英語」で自動判定し、リロードなしで即切替。URL は不変(共有リンク・ブックマークレット保護)。アプリ chrome は意図的に英語固定なので見た目変化は小さい(ライトボックスの「元ページを開く↔Open original page」等で確認済)。多言語の本丸=LP は層②として設計図のみ確定済・未実装。次は LP 作り直し(層②もそこに乗せる)or 言語切替UIの見た目調整 or onboarding。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態 (セッション 106)」を読む
2. **本番は `allmarks.app`**(deploy は `--project-name=allmarks --branch=master`)
3. user に「次は LP 作り直し / 言語切替UIの見た目 / onboarding のどれにする?」を確認

## session 106 で確定したこと(user 確認済)
- **層①(アプリ本体)= ランタイム言語切替**を実装。仕組み: `lib/i18n/I18nProvider.tsx`(`I18nProvider`+`useI18n()`、英語ベイク既定・プロバイダ外でも throw せず英語フォールバック)、`lib/i18n/locale-store.ts`(localStorage キー `allmarks-locale`、解決順=保存値→ブラウザ言語→英語)、`lib/i18n/translate.ts`(純粋関数)。旧 `lib/i18n/t.ts` は削除(全 10 コンポーネントが hook に移行)。
- **言語切替UI** = `components/board/LanguageSwitcher.tsx`(ボード右下・`position:fixed`、`BOARD_Z_INDEX.LANGUAGE_SWITCHER=140`)。畳=🌐+コード、開=`LANGUAGE_ENDONYMS`(各言語自身の名前)。外側クリックは capture-phase pointerdown。
- **アプリ chrome は英語固定が仕様**(TITLE/TUNE/SETTINGS 等)。言語で変わるのは少数の文章のみ(ライトボックス「元ページを開く」/ TUNE スライダーtooltip / サイドバー All↔すべて等 / 空状態 / ブックマークレットmodal / triage 一部)。**多言語の本丸は LP(層②)**。

## 次の候補
- **LP 作り直し(層②もここに乗せる)** ← 多言語集客の本丸。設計図 §5 の通り「素URL=英語 + `/ja` `/zh`… + hreflang + 言語別sitemap」で `app/[locale]/` を構築。`project_lp_redesign_vision` 参照。**洗練デザインへの作り直しが前提**。
- **言語切替UIの見た目調整**(下記 §未処理の Minor をここで回収): 生スクロールバー廃止・listbox の `role=option`・位置/色/開閉アニメ・MOTION OFF 時の挙動。
- **onboarding**(初回案内)
- **拡張ストア公開素材**(スクショ・説明文・`EXTENSION_STORE_URL` 投入)

## session 106 の未処理 Minor(次に LanguageSwitcher を触るとき回収。最終レビューで全て非ブロッキング判定)
- 言語リストが生スクロールバー(`overflow-y:auto`)→ fade/自作meter へ([[feedback_no_plain_scrollbars]])
- `<li>` が `role=listbox` 直下 → `role=option` の direct child に(a11y)
- `aria-hidden` を `aria-hidden="true"` に
- `setLocale` の rapid-switch 最新優先ガード(低頻度なので任意)

## 設計・計画(参照)
- 設計 `docs/superpowers/specs/2026-06-17-i18n-locale-architecture-design.md`(層①+層②両方の設計図)
- 計画 `docs/superpowers/plans/2026-06-17-i18n-locale-wiring.md`(層① 8タスク)

## 守ること
- **本番は allmarks.app**。deploy 前 `npx wrangler whoami`、tsc + vitest 通してから。実機/本番で測ってから「動いてる」と報告
- 発明しない・本物の部品を流用。横文字を日本語応答に混ぜない。AskUserQuestion ボックス禁止。デザイン変更は提案→承認→実装
- `DB_NAME='booklage-db'`・`booklage:*`・窓名 `booklage-save`・ボード固定英語語彙等の不可視/固定符号は**永久に維持**
- i18n: 新 key は 15 言語全部に同期。**アプリ chrome の英語固定方針は維持**(localize 対象は文章のみ)
- localStorage キー `allmarks-locale`、既定言語=英語、`useI18n()` はプロバイダ外でも throw しない、を壊さない
