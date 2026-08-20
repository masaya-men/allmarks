# 次セッション(s203)のゴール — private-vault-phase1 を master へ merge

## ★s202 の到達点
- **Private(鍵付き秘密ブックマーク)Phase 1、実装+最終レビュー+本番デプロイまで完走。ユーザー実機確認済み。ただし`private-vault-phase1`ブランチはまだ`master`に未merge。**
  - 最終全ブランチレビュー(opus) → 2件Critical含む17件検出 → 1回のfix dispatchでまとめて修正 → 修正のscoped re-reviewでもう1件Critical発見 → 司令塔が1行で直接fix。
  - ユーザーが実機で「作成→タグ付け→リロードで消える→解錠→絞り込みで見える」を確認済み。
  - **本番(`allmarks.app`)には2回デプロイ済・動作確認済**(direct uploadなのでbranch/merge状態は問わない仕様)。
  - 実機確認中に偶然見つけた副産物バグ2件も同セッションで修正・本番反映済(①テーマ切替時のハイドレーション警告 ②リンク健全性チェックの無限リトライ)。
  - 台帳(全記録): `.superpowers/sdd/2026-08-20-private-vault/progress.md`

## ★次セッション最優先＝ master へ merge
1. `private-vault-phase1` → `master` へ merge(`--no-ff`推奨、本番は既に動作確認済なので実機再確認は不要)。
2. merge後: `.superpowers/sdd/2026-08-20-private-vault/`(台帳・briefなど作業用ファイル)は削除してよい(完了記録は`docs/TODO_COMPLETED.md`に残る)。
3. **フェーズ2(WebAuthn生体認証)はこのplanの対象外**、要望が出たら別plan。

## 次点(いつでも着手可、着手前にbrainstormingから)
- **N-63**: バックアップ提案(`BackupReminder`)の表示位置がScrollMeterに被るバグ。中央+最前面に変更希望。視覚変更のためモック→承認後に実装(`docs/TODO.md`§未対応バグ)。
- **Private Phase 2構想4件**(詳細`docs/private/IDEAS.md`「s202 Private Phase 2構想まとめ」):
  - ①発見導線(常時表示エントリーポイント。メインのタグ絞り込み列＋カードの＋ボタンにPrivateを常に表示)
  - ②クイック保存面対応(PopOut/拡張機能/ブックマークレット。**ユーザーは「案B」=鍵をstructured cloneで安全に別ウィンドウへ渡す本格版を希望**、後回しでよいので急がない)
  - ③まとめてPrivate化(複数選択→一括暗号化、専用インジケーター+アニメーション)
  - ④Privateの存在自体を隠すオプション(①の上乗せ、デフォルトOFF)

## 保留中(いつでも合流可)
- TODO.mdが900行超(目安200行を大幅超過)→ 古いセッションnarrativeをTODO_COMPLETED.mdへ移動する軽い掃除タスク(非ブロッキング)。
- dashboard.html(`docs/private/`)はhero-strip部分のみs202反映済(深い panel 群は以前から意図的に古いまま=source of truthはTODO.md)。
- さらなるテーマ/Flat磨き、支援まわり(非公開`docs/private/IDEAS.md`)、拡張の一括保存、C2翻訳仕上げ。

## 恒久ルール(継承)
- 視覚変更は`ui-design.md`「承認後」。`rtk`前置・`--no-verify`禁止・vitest/playwrightは素の npx・Framer Motion禁止。
- 音(dotted-notebook)/紙(paper-atelier)＝バイト同一を死守。
- 機微(支援・値付け・戦略)はtrackedに書かない＝`docs/private/`。
- merge/push/deployは必ずユーザー確認後(CLAUDE.md安全ルール)。ただしdeployは「本番で見たい」等の明示的な合図があれば即実行可。
