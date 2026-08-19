# 次セッション(s202)のゴール — Private(鍵付き秘密ブックマーク)plan を subagent-driven で実装開始

## ★s201 の到達点
- **OGP バグ修正・出荷済**: SHARE 自動撮影が `BackupReminder`/`DataHomeCard` を撮影除外リスト(`data-no-capture`)から漏らしていて、撮影の瞬間に画面に出ていると共有画像に写り込むバグを修正。tsc0/vitest2416/build/`allmarks.app` デプロイ済。
- **Private(鍵付き秘密ブックマーク)を brainstorm→spec→plan の正規フローで完走**（実装はまだ・次セッション）。
  - spec: `docs/superpowers/specs/2026-08-20-private-vault-design.md`
  - plan: `docs/superpowers/plans/2026-08-20-private-vault.md`（フェーズ1=パスワード版、15タスク、TDD具体コード込み）
  - 要件の芯: 鍵付きタグは「Private」1つだけ／パスワードでAES-GCM**本当に暗号化**／生体認証はフェーズ2(後日)／Private+普通タグ併用可だがPrivateを明示的に踏まない限り絶対に出ない／SHAREはロック中不可・解錠中選択時は確認ダイアログ付きで許可／EXPORTは暗号化済みのまま含む／再ロックはリロードのみ／救済はヒント文のみ
  - **plan 自己レビューで致命的バグを1件発見・修正済**: `privateTagId` の導出元を「ロック中に隠すフィルタ後」ではなく「常に見える rawTags」にする分離が必要だった（さもないとロックした瞬間に除外判定自体が壊れる）

## ★次セッション最優先＝ plan 実装
- **ユーザー指定: subagent-driven-development で1タスクずつ**（`/execute` 相当・各タスクごとに fresh subagent + レビュー）。
- **Task 1 (`lib/private/crypto.ts`) から順番に**。plan 内の Global Constraints（新規依存禁止・IDBバージョン不変・鍵は必ずメモリのみ・rtk はテストコードに書かない・新規ダイアログは全部 `data-no-capture`）を毎タスク遵守。
- Task 13 (BoardRoot.tsx wiring) が一番大きい・plan 内に実コード(handleTagToggle/handleCreateHostedShare/handleMobileCaptureAndCreate の実際の現行コードごと)を書き込み済みなので、そのまま写経できる。
- 全タスク完了後の post-plan gate: tsc0 / vitest full green / `pnpm build` / ユーザー実機確認(Private作成→リロードで消える→解錠→SHAREで警告確認)。
- **フェーズ2(WebAuthn生体認証)はこの plan の対象外**、別 plan として後日。

## 保留中（s200以前から継続、いつでも合流可）
- さらなるテーマ/Flat 磨き（実機で気になる点があれば）。
- 支援まわり（ユーザー保留中、詳細は非公開 `docs/private/IDEAS.md`）。
- 拡張の一括保存＝公開後 fast-follow。C2 翻訳(13言語)仕上げ。

## 恒久ルール（継承）
- 視覚変更は `ui-design.md`「承認後」（現状→変更案→承認→実装）。`rtk` 前置・`--no-verify` 禁止・vitest/playwright は素の npx・Framer Motion 禁止。
- 音(dotted-notebook)/紙(paper-atelier)＝バイト同一を死守。
- 機微（支援・値付け・戦略）は tracked に書かない＝`docs/private/`。
- 新規の共有撮影に写り込むフローティングUI(トースト・モーダル)は必ず `data-no-capture` を付ける（s201 で2件の抜けを実例として発見）。
