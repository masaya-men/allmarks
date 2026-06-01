# 次セッションのゴール (= セッション 101)

## 今のゴール (1 行)

**拡張まわり (設定画面リデザイン + ボードからの SETTINGS/GET EXTENSION 入口) は本番 ship 済。次は公開向けバックログから user が選ぶ — 他14言語 tag rename / onboarding / LP 整備 / 拡張ストア素材。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態 (セッション 100)」を読む
2. user に「次どこ行く?」を確認 (下の候補から)
3. 着手前に該当 spec / plan を読む

## セッション 100 で ship 済 (本番反映・master push 済)
- **拡張機能の設定画面 (options) を参考画像どおりに全面リデザイン**: Geist/Geist Mono を拡張に同梱 ([extension/fonts/](../extension/fonts/))、配色は既存トークン、保存数/バージョンは実値、設定挙動は全保持 (idle opacity のみスライダー化)。manifest 0.1.17。
- **ボードの TUNE 右隣に拡張設定の入口**: 導入済み→`SETTINGS` (クリックで options ページを開く、content.js/background.js ブリッジ)、未導入→`GET EXTENSION` (宣伝ポップオーバー、ストア URL 空なので今は `COMING SOON`)。閉じる3手段 (× / ESC / 外側クリック)。
- 公開向け残タスクの「拡張機能 設定画面 整備」完了。

## 次の候補 (公開向けバックログ、TODO.md「公開向け残タスク」参照)
- ドメイン allmarks.app (棚上げ中、催促しない)
- Phase D4/D5: 他14言語の mood→tag i18n rename + NewMoodInput→NewTagInput 内部 rename (公開前必須)
- onboarding チュートリアル (初回ユーザー向け)
- LP 整備 (share / multi-playback / 拡張 の言及追加)
- 拡張機能 Chrome Web Store 公開素材 (説明文・スクショ・アイコン。公開ボタンはドメイン取得まで温存)
- **拡張公開日タスク (1行)**: [constants.ts](../lib/board/constants.ts) の `EXTENSION_STORE_URL` に実 URL を入れると未導入者全員に `ADD TO CHROME` が点灯。content.js の host 判定 (`booklage.pages.dev`) はドメイン移行時に更新。

## 守ること
- **本番が既定**: ship したら淡々と本番デプロイ→本番で実測確認。デプロイ可否を毎回聞かない (memory `feedback_prod_is_default`)。特別な場合 (履歴書換/破壊的) のみ立ち止まる。
- 実機(playwright/本番)で測ってから「動いてる」と報告。視覚変更はデプロイ→確認。デプロイ前 `npx wrangler whoami`。
- 発明しない・本物のボード部品を流用。横文字を日本語応答に混ぜない。AskUserQuestion ボックス禁止。可視性をアニメに依存させない。
- ブランチは使わない (master 直接、ソロ開発)。git commit -m 本文にバッククォートを使わない。
- **デザイン変更は提案→承認→実装** (`.claude/rules/ui-design.md`)。ただし軽微で user が事前 OK したものは即実装で良い。
