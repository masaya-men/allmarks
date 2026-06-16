# 次セッションのゴール (= セッション 103)

## 今のゴール (1 行)

**🎉 session 102 で `allmarks.app` へのリブランド移行が完了(本番=allmarks.app、旧 booklage.pages.dev は 301 転送、データ545件+タグ22 移行済、拡張も新ドメイン保存)。次は「公開準備フェーズ」: (a) 暫定 EXPORT/IMPORT ボタン撤去 + 未使用 chrome-extension/ 削除 (b) i18n 言語切替の配線 (c) onboarding (d) LP 整備 (e) 拡張ストア公開素材。user が選ぶ。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態 (セッション 102)」を読む
2. **本番は `allmarks.app`(deploy は `--project-name=allmarks --branch=master`)**。booklage.pages.dev は触らない(301 シェル)
3. user に「次どこ行く?」を確認(下の候補から)

## セッション 102 で完了 (= リブランド移行、全て検証済)
- **コード手当て**: `.env.production`(tracked、allmarks.app + AllMarks)新設 + 古い `.env.local`(localhost/Booklage)撤去。`lib/constants.ts` に `SITE_URL` 追加 → sitemap/robots/layout metadataBase を一本化。拡張(content/floating-button/offscreen/options/manifest)を allmarks.app 保存先 + 両ホスト判定 + v0.1.18。privacy ページ説明文。tsc 0 / vitest 978 / build OK
- **インフラ**: 新 `allmarks` Pages プロジェクト作成+デプロイ、`allmarks.app` カスタムドメイン Active(SSL 有効)。KV/R2 は wrangler.toml の同 ID で引き継ぎ(共有データ・古い共有リンク生存)。旧 `booklage` プロジェクトは `/* → allmarks.app/:splat 301` 転送シェル化
- **データ移行**: user が booklage.pages.dev で EXPORT(545件・タグ22、ファイル解析で整合検証済)→ allmarks.app で IMPORT 復元確認済。拡張リロード後の実機保存も allmarks.app で確認済
- **片付け**: GitHub repo rename(booklage→allmarks、remote 更新)、package.json name、CLAUDE.md デプロイ手順を allmarks.app/`--project-name=allmarks` に。master push 済
- **記憶更新**: project_allmarks / project_allmarks_domain_reminder / reference_github を移行後の事実に
- 詳細プラン: `docs/superpowers/plans/2026-06-16-allmarks-rebrand-migration.md`

## 次の候補 (公開準備フェーズ)
- **公開前の最終片付け (軽い)**: 暫定 EXPORT/IMPORT ボタン撤去([BoardRoot.tsx](../components/board/BoardRoot.tsx) の `TEMPORARY` コメント箇所 + import)、未使用 `chrome-extension/` 削除(コード参照なし=古い試作)
- **🔴 i18n 言語切替の配線**: 翻訳は15言語揃ったが [lib/i18n/t.ts](../lib/i18n/t.ts) が ja.json 固定 import。`output: 'export'` 制約があるので brainstorming してから(方式 (a)per-locale 静的ルート (b)client 切替 (c)言語ピッカー)
- onboarding チュートリアル(初回ユーザー向け、user 複数回言及)
- LP 整備(share / 拡張 の言及追加。multi-playback は未実装なので謳わない)
- 拡張機能 Chrome Web Store 公開素材(説明文・スクショ・アイコン)+ 公開後 `EXTENSION_STORE_URL`(lib/board/constants.ts)に 1 行投入で全員に ADD TO CHROME 点灯

## 守ること
- **本番は allmarks.app**。deploy 前 `npx wrangler whoami`、tsc + vitest 通してから。実機(playwright/本番)で測ってから「動いてる」と報告
- 発明しない・本物のボード部品を流用。横文字を日本語応答に混ぜない。AskUserQuestion ボックス禁止。可視性をアニメに依存させない。デザイン変更は提案→承認→実装
- `DB_NAME='booklage-db'` 等の不可視な内部符号は**永久に維持**(変えるとデータ消失)
- i18n: 新 key は 15 言語全部に同期(`node /tmp/check-i18n.js`)
- 暫定 EXPORT/IMPORT ボタンは公開前に必ず撤去(今は再取り込みの保険として残置)
