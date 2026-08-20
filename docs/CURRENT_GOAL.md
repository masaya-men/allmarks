# 次セッション(s203)のゴール — Private vault: ユーザー実機確認 → merge → デプロイ

## ★s202 の到達点
- **Private(鍵付き秘密ブックマーク)Phase 1、実装+レビュー完走。ブランチ `private-vault-phase1`(未merge・未デプロイ)。**
  - 15タスク + follow-up 1件(TriagePage漏れ修正)を subagent-driven-development で完遂。
  - **最終全ブランチレビュー(opus)実施 → 2件のCritical + 6件のImportant + 9件のMinorを検出 → 1回のfix dispatchで13件まとめて修正**(quick-tag系3経路が暗号化なしでPrivateタグを付けられた問題／解錠中の裏メタデータ取得が暗号化済みレコードに平文を書き込んでいた問題、他)。
  - **その修正コミットへのscoped re-review(opus)を実施 → 新たに1件Critical発見**(カード個別の「+ TAG」新規タグ入力欄が同じ抜け穴を持っていた)→ **司令塔が1行の外科修正で直接fix**。
  - 検証: tsc 0エラー / vitest 300ファイル2478テスト全緑 / `pnpm build` 成功(`assert-share-template` OK)。
  - **未着手のまま次に持ち越したMinor 4件**(いずれ非ブロッキング・詳細は台帳): `lib/private/resolve-visibility.ts`の型定義がI1のフィールド追加に追随していない(実害なし・型のみ)／新規タグのorder値が僅かに重複しうる(見た目のみ)／`updateBookmarkOgp`に暗号化ガード無し(現状呼び出し元ゼロ・死コード)／ツイート/TikTokの裏メタデータ取得がPrivate項目でもURLをx.com/tiktok.comに送っている(書き込みは阻止済・通信は未対応)。
  - 台帳(全記録): `.superpowers/sdd/2026-08-20-private-vault/progress.md`

## ★次セッション最優先＝ユーザー実機確認 → merge → デプロイ
1. **ブランチをローカルで実機確認**(spec通りの動作確認、CLAUDE.mdの安全ルールによりmerge/deployはユーザー確認必須):
   - SETTINGS → PRIVATE → パスワード設定 → カードにPrivateタグを付ける → リロード → 消えることを確認
   - 解錠 → フィルタでPrivateを明示的に選んだ時だけ見えることを確認(他フィルタ・ALL・TRASHには絶対出ない)
   - 解錠中にPrivate項目を選んでSHARE → 確認ダイアログが出ることを確認
   - EXPORT → 別ブラウザ/シークレットウィンドウにIMPORT → 同じパスワードで解錠できることを確認
2. OKなら: `master` へ merge(`--no-ff`推奨) → `pnpm build` → `wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true` → `allmarks.app`をハードリロードして本番確認。
3. merge後: `.superpowers/sdd/2026-08-20-private-vault/`(台帳・brief類)は削除してよい(完了記録は本ファイル+TODO_COMPLETED.mdに残る)。
4. **フェーズ2(WebAuthn生体認証)はこのplanの対象外**、要望が出たら別plan。

## 保留中(いつでも合流可)
- TODO.mdが873行(目安200行を大幅超過)→ 古いセッションnarrativeをTODO_COMPLETED.mdへ移動する軽い掃除タスク(非ブロッキング、手が空いた時に)。
- dashboard.html(`docs/private/`)がs202の内容未反映(次のセッション終了時にまとめて更新)。
- さらなるテーマ/Flat磨き、支援まわり(非公開`docs/private/IDEAS.md`)、拡張の一括保存、C2翻訳仕上げ。

## 恒久ルール(継承)
- 視覚変更は`ui-design.md`「承認後」。`rtk`前置・`--no-verify`禁止・vitest/playwrightは素の npx・Framer Motion禁止。
- 音(dotted-notebook)/紙(paper-atelier)＝バイト同一を死守。
- 機微(支援・値付け・戦略)はtrackedに書かない＝`docs/private/`。
- merge/push/deployは必ずユーザー確認後(CLAUDE.md安全ルール)。
