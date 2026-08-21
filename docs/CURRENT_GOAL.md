# 次セッション(s203)のゴール — Private Phase 2 に進む(着手前にbrainstorming必須)

## ★s202 の到達点
- **Private(鍵付き秘密ブックマーク)Phase 1、完全に完了。`master`へmerge済・GitHubへpush済・本番デプロイ済・ユーザー実機確認済。**
  - `master`のコミット`be763ad3`(`--no-ff`マージ)。作業ブランチ`private-vault-phase1`は削除済み。台帳(`.superpowers/sdd/2026-08-20-private-vault/`)も削除済み(完了記録は`docs/TODO_COMPLETED.md`に残る)。
  - 最終全ブランチレビュー(opus)→2件Critical含む17件検出→fix→scoped re-reviewでもう1件Critical発見→修正、まで完遂。
  - セッション中に偶然見つけたPrivateとは無関係のバグ3件も同セッションで修正・本番反映済み(テーマ切替時のハイドレーション警告／リンク健全性チェックの無限リトライ／Lightboxで画像ツイートが縮むN-23再発)。

## ★次セッション最優先＝ Private Phase 2 に進むなら、まず superpowers:brainstorming から
**いきなり実装に入らないこと。** 4つの構想候補があり、優先順位・組み合わせ方はまだ確定していない。詳細・技術的な勘所は `docs/private/IDEAS.md`「s202 Private Phase 2構想まとめ」節を必ず読むこと:

1. **①発見導線**: メインのタグ絞り込み列＋カードの＋ボタンにPrivateを常に表示(未設定/ロック中でも)。クリック時の状態別の挙動(未設定→説明+設定へ、ロック中→解錠へ、解錠中→通常トグル)を設計。
2. **②クイック保存面対応**: PopOut/拡張機能/ブックマークレットからもPrivate化できるようにする。**ユーザーは「案B」(暗号化の鍵をstructured cloneで別ウィンドウへ安全に渡す本格版)を希望**、案A(簡易な「保留フラグで即座に隠す」版)は不採用。
3. **③まとめてPrivate化**: 複数選択→一括暗号化。専用インジケーター+アニメーション、失敗時は原子的処理+どのカードが失敗したか通知。
4. **④存在を隠すオプション**: ①の上乗せ(デフォルトOFF)。SETTINGS内にパスワードを打つと初めてPrivateの入り口が現れる、という追加の隠し層。

## 次点(Private Phase 2と並行 or 別途、いつでも着手可)
- **N-63**: バックアップ提案(`BackupReminder`)の表示位置がScrollMeterに被るバグ。中央+最前面に変更希望。視覚変更のためモック→承認後に実装(`docs/TODO.md`§未対応バグ)。
- **Lightbox複数画像ツイートの理想形**: 「開く瞬間だけ盤面と揃えて切り取り／開いた後は手動切り替えで全体表示」への改善。詳細`docs/private/IDEAS.md`「s202 複数画像ツイートのLightbox内ブラウズを...」節。

## 保留中(いつでも合流可)
- TODO.mdが900行超(目安200行を大幅超過)→ 古いセッションnarrativeをTODO_COMPLETED.mdへ移動する軽い掃除タスク(非ブロッキング)。
- さらなるテーマ/Flat磨き、支援まわり(非公開`docs/private/IDEAS.md`)、拡張の一括保存、C2翻訳仕上げ。

## 恒久ルール(継承)
- 視覚変更は`ui-design.md`「承認後」。`rtk`前置・`--no-verify`禁止・vitest/playwrightは素の npx・Framer Motion禁止。
- 音(dotted-notebook)/紙(paper-atelier)＝バイト同一を死守。
- 機微(支援・値付け・戦略)はtrackedに書かない＝`docs/private/`。
- merge/push/deployは必ずユーザー確認後(CLAUDE.md安全ルール)。ただしdeployは「本番で見たい」等の明示的な合図があれば即実行可。
