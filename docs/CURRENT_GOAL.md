# 次セッションのゴール (= セッション 153)

## 今の状態（N-19「サイズ/並び順を default に戻す」出荷・master マージ済・allmarks.app 反映済）

**セッション152でやったこと（master `a7be63d` マージ済・tsc0 / vitest1887 / build OK・本番反映済）：**

- **N-19 完遂**。SETTINGS ドロワーに新グループ **LAYOUT** を追加し、2操作を配線：
  - **RESET CARD SIZES**（リサイズ済み枚数を表示・0枚で無効）＝全カードの手動サイズを解除 → 既定サイズに戻る（既存 `resetAllCustomWidths` を配線）。
  - **SORT: NEWEST FIRST** ＝ `savedAt` 降順で並び直す（新関数 `resortByNewestFirst`＝マイグレーション `repairOrderIndexIfNeeded` は無変更で、フラグ非依存の何度でも実行可版）。
  - どちらも**その場2タップ確認**（1回目「TAP AGAIN TO CONFIRM」→ 3秒以内に2回目で実行・排他）＋実行後トースト。EXPORT バックアップが同ドロワーの保険。
- **設計はゼロからではなく既存ロジック活用**が判明（個別 ↺・TUNE ↺ は温存）。**default 盤面 byte-identical**・機微情報なし・15言語 i18n・サブエージェント駆動5タスク＋各タスク2段レビュー＋opus 全ブランチレビュー（Ready to merge）。
- 正本：[spec](superpowers/specs/2026-07-02-board-reset-layout-design.md) / [plan](superpowers/plans/2026-07-02-board-reset-layout.md)。

## 次にやる（セッション153）＝**まず N-19 実機確認 → 本命バックログへ**

### 最初にユーザーに確認（実機目視・allmarks.app ハードリロード）
1. SETTINGS を開き **LAYOUT** グループが SAVING の下に自然に出るか。
2. 何枚かリサイズ → `RESET CARD SIZES (N)` の N が実数 → 2タップで全カードが既定サイズに戻る＋トースト。0枚のとき薄く無効。
3. `SORT: NEWEST FIRST` を2タップ → 新しいものが上に戻る＋トースト。
4. 別テーマ（Paper）でも馴染むか。default 盤面が従来どおりか。

### その後の候補（優先順は相談）
- **本命バックログ**：③プレミアムテーマ制作／④K3 解錠実装（`docs/private/2026-07-01-k3-unlock-plan.md`）／選択的シェア／タグ付け強化。
- **N-05 LP ナビの格納演出**（Features 等を選ぶとメニューから消え、スクロールで語がヘッダーに緑玉付きで「しゅん」と格納）。要設計（IDEAS.md N-05）。

## 守ること（毎回）
- default 盤面 byte-identical。web 変更時は deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。deploy `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`
- **機微情報は `docs/private/` のみ。tracked に書かない・commit しない**（CLAUDE.md 厳守）
- 拡張の反映はストア審査経由（Web デプロイでは届かない）
- 既知フレーキー: `tests/lib/channel.test.ts`（再実行で緑）。応答は日本語・簡潔に
