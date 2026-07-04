# 次セッションのゴール (= セッション 161)

## 今の状態（N-23 動画Lightbox「がくっと」修正 実機OK／拡張 v0.1.24 通過・URLは既に配線済／次＝③バックアップの法的守り）

**セッション160でやったこと:**
- **N-23 完遂（実機「完璧」・本番反映・commit `d05cc48`）**: YouTube 動画→Lightbox の「がくっと小さくなる」を根治。真因＝板と Lightbox で**別サムネ・別 object-fit**（板＝maxres 16:9/cover、LB poster＝hqdefault 4:3/contain。`.media img{contain}` が `.embedPoster{cover}` を詳細度で上書きしていた）→ clone が 888幅に育った後 handoff で 667幅にレターボックス縮小＋低解像化。**Playwright 実測で確定**。修正＝①poster を板と同じ maxres→hq→mq→0 の onError 鎖に②`.embedPoster` を cover 復元（写真の `.imageBox` は無傷）。**新規リグレッションでなく既存の潜在不一致**。memory `reference_lightbox_youtube_poster_parity` 記録。
- **拡張 v0.1.24 審査通過**（N-20 add-new-tag 入り）。**`EXTENSION_STORE_URL` は v0.1.21 で既に投入・本番点灯済**（commit `108e198`、ID 固定・HTTP200確認）＝**追加作業ゼロ**、ストアが自動配信。release-blocker の旧「URL投入残」記述は訂正済。

## このセッションのゴール ＝ ③ バックアップの法的守り（ユーザー要望「法的に安全にしたい」）

**目的**：ローカル保存（IndexedDB）のみでサーバーにデータを持たない設計ゆえ、「端末を変えた／消えた」時にユーザーが自己責任でバックアップを取れるよう、**法的・体験的な安全網**を整える。ユーザーは非エンジニア＝平易に。

### 進め方（brainstorming から。勝手に実装しない）
1. まず `superpowers:brainstorming` で範囲合意。候補要素＝**①利用規約に「データはブラウザ内のみ・自己バックアップ責任」を明記／②初回起動時の誠実な説明（1回）／③定期リマインド（例：保存数の節目や久しぶり起動）／④危険操作前の警告（DBバージョン上げ・IMPORT 上書き・全消し等。既存 memory `feedback_irreversible_pause`／`project_backup_before_idb_migration` と接続）／⑤既存 EXPORT/IMPORT（B5/SETTINGS）の導線強化**。
2. **文面のたたき台まで作る**（利用規約の該当節・初回説明・リマインド文・警告文）。**最終は専門家（弁護士等）確認を推奨**とユーザーに明言（Claude は法助言者ではない）。
3. 機微・戦略・本名/メアドは `docs/private/` のみ。実装は合意後に spec→plan→サブエージェント駆動。

### 参考（既存の土台）
- 既存 EXPORT/IMPORT＝SETTINGS ドロワー（B5/session124 で正式バックアップ機能として配線済＝撤去禁止）。
- 関連 memory：`project_backup_before_idb_migration`（DB版上げ前に EXPORT）／`project_idb_irreversibility`（版下げ不可）／`feedback_irreversible_pause`（危険操作前に3リスク列挙）。
- 利用規約の現物＝`app/(marketing)/terms/`（多言語）。プライバシー＝`/privacy`。

## その後の本命バックログ（順）
- **① 自動画像**：保存時に**操作ゼロ**で、og:image が無い記事はページ内の良い画像を自動採用／無ければブランドタイル自動生成（ユーザー厳命＝保存時に手間を増やさない。memory `feedback_automatic_capture_no_steps`）。
- **② カラーハント**：保存時パレット抽出（既存ブクマは backfill・他サイト画像は CORS で画像中継が要る）。詳細＝`docs/private/IDEAS.md` の X-01..X-25。

## 守ること（毎回）
- **見た目変更は ui-design.md 準拠＋実機検証してからデプロイ**（s159 の教訓）。default 盤面 byte-identical。
- web 変更は deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build` → `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`。
- 機微情報は `docs/private/` のみ。既知フレーキー `tests/lib/channel.test.ts`（再実行で緑）。vitest は dev サーバー並走禁止。
- Write/Edit 後は独立 Read、commit/マージ後は生 `git log`。拡張 JS は `node --check`。応答は日本語・簡潔・平易に。
