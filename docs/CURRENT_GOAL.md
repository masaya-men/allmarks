# 次セッションのゴール — 束B（スマホ保存）を実機確認 → 公開日宣言 or 束C

## まず最初に（ユーザーへの確認）
- **s183 で束B（スマホ・タブレット保存）を出荷・本番反映済み**（実機確認待ち）:
  - **賢い「+」ボタン**（右下フローティング・全タッチ端末）: タップ→コピー済み URL を自動保存、読めない時だけ**下から出る入力シート**
  - **Android 共有メニュー受け口**（他アプリの「共有」→AllMarks で保存・要ホーム追加）。iOS/iPad は Apple 仕様で共有メニュー不可＝「+」が本命
  - マウスの PC には「+」を出さない（**デスクトップ byte-identical**）
- **実機で確認してほしいこと**（自動テスト不可・実機のみ）:
  1. スマホ/タブレットで URL をコピー →「+」→（iOS は「ペースト」確認が1回）→ カード出現
  2. コピー無し/非URL →「+」→ 入力シート → 貼付/入力 → ADD → 保存（既存 URL は琥珀「Already saved」）
  3. **Android のみ**: X 等の共有ボタン → AllMarks（要ホーム画面追加）→ 自動保存
  4. PC（マウス）で「+」が出ない・盤面が従来どおり

## 次セッションでやること（実機確認の結果しだい）
1. **束Bが実機OKなら → 公開日宣言可**。滑走路計画（`docs/private/2026-07-08-release-runway-plan.md`）で「束A→束B→**ここで公開日宣言可**」。次は **束C（13言語仕上げ＋規約の正文条項）** に着手（C0 守り→C1 正文条項→C2 言語別レビュー4バッチ。Sonnet 以上・Haiku 不可）。
2. **or 残りのモバイル磨き**: ピンチリサイズ／長文テキストカードのスクロール微調整 等（公開を止めない任意 backlog）。
3. 実機で「+」保存に不具合が出たら、まずそれを根治してから次へ。

## s183 の実装の在り処（次セッションが触るとき用）
- 保存の芯 = `useSaveUrl`（[lib/board/use-save-url.ts](../lib/board/use-save-url.ts)）。3入口共通の URL 判定 = `normalizeToUrl`（[lib/board/paste-url.ts](../lib/board/paste-url.ts)・裸単語は「.」必須でシート送り）。
- UI = `MobileSaveButton.tsx` / `MobileSaveSheet.tsx`。ゲート = `useIsTouchDevice`（`pointer: coarse`）。配線・Android 共有受け口は `BoardRoot.tsx`（`?shared=true` の mount effect ＋ タッチゲートで mount）。
- テーマは CSS 変数（`--save-btn-*` / `--save-sheet-*`）＋`:root[data-theme-id]` 上書きで着せ替え可能。将来の構造変種は `ThemeMeta.saveButtonVariant` 縫い代のみ（未実装）。
- 正本 [spec](superpowers/specs/2026-07-09-mobile-tablet-save-smart-add-design.md) / [plan](superpowers/plans/2026-07-09-mobile-tablet-save-smart-add.md)。deferred: B3 ホーム追加案内 / iPhone ショートカット共有 / タブレット盤面最適化。

## 直近のリリース段取り（参考・`docs/private/2026-07-08-release-runway-plan.md`）
束A スマホ閲覧（完了）→ 束B スマホ保存（**s183 完了・実機確認待ち**）→ **公開日宣言可** → 束C 13言語仕上げ＋規約 → 束D 公開素材 → 束E 総仕上げ・公開。
