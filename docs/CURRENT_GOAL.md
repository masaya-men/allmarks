# 次セッションのゴール (= セッション 102)

## 今のゴール (1 行)

**🎉 session 101 で `allmarks.app` 取得完了 (公開の最後の関門クリア)。最有力の次タスクは「リブランド移行 (allmarks.app への deploy 切替 + 拡張 host 更新 + repo rename)」。他に locale 配線 / onboarding / LP / 拡張ストア素材も候補。user が選ぶ。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態 (セッション 101)」を読む
2. user に「次どこ行く?」を確認 (下の候補から)
3. 着手前に該当 spec / plan を読む

## セッション 101 で完了 (= tsc 0 / 全 978 tests pass / build 成功。本番未デプロイ = 画面に出ない変更なので任意)
- **mood→tag コード掃除 (D5 含む)**: `NewMoodInput`→`NewTagInput`、ja.json の残り mood キーを tag 名に統一 + 参照追従。DB ストア名等の内部符号は意図的に不変。
- **15 言語を ja.json と同構造に整備**: en を基準に再作 → 13 言語を並列翻訳。固定英語語彙・プレースホルダ・絵文字・#AllMarks は全言語 verbatim。構造/固定値とも機械チェック通過。
- **判明した重要事実**: 他14言語は「タグ機能以前の古い版」だった (TODO の前提が誤り)。今回 ja と同構造に揃え直したので解消。

## 次の候補 (公開向けバックログ、TODO.md「公開向け残タスク」参照)
- **🚀 リブランド移行 (= 最有力、 ドメイン取得で actionable に)**: allmarks.app を Cloudflare Pages に接続 → deploy 切替、 旧 booklage.pages.dev の扱い (301 等)、 Chrome 拡張の host 判定更新 + 再パッケージ + `EXTENSION_STORE_URL` 投入、 GitHub repo rename。**大きい多段タスク。着手前に `docs/private/2026-05-11-allmarks-branding-spec.md` §5 を読む**。落とし穴 = IDB は origin 単位で user 自身の既存ブクマ(約372件)は自動移行しない (BackupButton で 1 回手動 export/import)、 `DB_NAME='booklage-db'` 等の維持リストは壊さない
- **🔴 i18n 言語切替の配線**: 翻訳は揃ったが [lib/i18n/t.ts](../lib/i18n/t.ts) が ja.json 固定 import のままで外国語が出ない。`output: 'export'` 制約 (静的 HTML 1 言語 prerender / LP は SEO) があるので **brainstorming してから着手**。方式候補 (a) per-locale 静的ルート (b) client 切替 (c) アプリ内 言語ピッカー。着手前に t() 利用箇所を洗う
- onboarding チュートリアル (初回ユーザー向け、 user が複数回言及)
- LP 整備 (share / 拡張 の言及追加。 multi-playback は未実装なので謳わない)
- 拡張機能 Chrome Web Store 公開素材 (説明文・スクショ・アイコン)

## 守ること
- **本番が既定**: ただし session 101 の変更は「画面に出ない」(翻訳は未配線・コード掃除は不可視) ので本番デプロイは任意。視覚に出る変更を ship したら淡々とデプロイ→本番実測。
- 実機(playwright/本番)で測ってから「動いてる」と報告。デプロイ前 `npx wrangler whoami`。
- 発明しない・本物のボード部品を流用。横文字を日本語応答に混ぜない。AskUserQuestion ボックス禁止。可視性をアニメに依存させない。
- ブランチは使わない (master 直接、ソロ開発)。git commit -m 本文にバッククォートを使わない。
- **デザイン変更は提案→承認→実装**。軽微で user が事前 OK したものは即実装で良い。
- **i18n 運用ルール**: 新 key 追加時は 15 言語全部に同期する。`messages/` の構造チェックは `node /tmp/check-i18n.js` (ja.json 基準で全言語の leaf キー差分を出す) で確認できる。
