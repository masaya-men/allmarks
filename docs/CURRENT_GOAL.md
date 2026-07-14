# 次セッションのゴール — テーマ実行の続き（サブ3 Grid・紙の TUNE 皮）＋独立の C2／実機確認

## ★s198 の到達点（サブ2 出荷済・subagent-driven＋opus 全ブランチレビュー）
- **サブ2 出荷**（`theme-sub2-flat` 6タスク＋各 per-task レビュー＋fix＋opus 全ブランチレビュー Ready=WITH FIXES→hover 欠陥1件 fix→merge --no-ff→`allmarks.app` デプロイ）。
  - 新 opt-in 明テーマ **Flat**（LP 白エディトリアル `#faf9f6`／Fraunces ワードマーク／`kind:'pattern'`）。**既定は音のまま**（フラット既定化＝`DEFAULT_THEME_ID` 差し替えは実機承認後に別途1行）。
  - **TUNE をフラット皮に**（金属ミキサー→細レール＋白丸フェーダー・ドット選択プリセット・iOS CORNERS・静音凡例・白ドロワー）。全変更 `data-theme-id="flat"` scoped＝**音/紙/Grid＋既定はバイト同一**。
  - 旧サブ1 **Task 4（明盤面 chrome 反転）を完成**（`DARK_CHROME_RESET` を colorScheme で gate）／静音メーター新 variant `'line'`（QuietTrack）／静か motion `'fade'`。tsc0/vitest2407/build/e2e14。
  - 親 spec §7 に出荷追記済。

## ★次セッション最優先＝実機確認（まず）
- `allmarks.app` をハードリロード → SETTINGS → THEMES → **Flat** を選ぶ。確認点:
  1. 盤面が白エディトリアル（暖かいオフホワイト・淡いセリフ透かし・カード/文字が読める）。
  2. **TUNE を開く**と白い清潔なパネル（金属ミキサーでない）。プリセット行/CORNERS を**hover しても文字が消えない**。CORNERS は iOS トグル。
  3. メーターは**下の帯で静かな目盛り**・数字は静止。**Sound Wave に戻すと**従来どおり暗い金属ミキサー＋波形（＝バイト同一）。
- 気になる所（パレット/ワードマーク濃さ/`.trigger` の hover glitch/フェーダーの目盛り）は1箇所ずつ調整して再デプロイ。

## ★実機OKなら＝テーマ実行の続き（甲＝作り込んでから公開・各回頭でモック承認→写経）
以下から1つを深く（親 spec §7）:
1. **サブ3 Grid・紙の TUNE 皮**（Grid＝方眼世界／紙＝道具箱の皮）。紙は既存 `--paper-panel-*` クリーム面を再配線（489caf7e が面消費を剥がした）＝s197 fix-1 で中立化した紙 chrome 上書きを、面と対で復活させる。
2. （サブ2 で確立した scoped-CSS 手段をそのまま踏襲＝安価モデル写経可）。

## ★独立・いつでも（波0 残）
- **C2 バッチ1（zh/ko）盤面翻訳仕上げレビュー**（Sonnet+・s196 で一次訳済の13言語の本レビュー・正文条項 en/ja は確定）。以降 es/fr/pt/it→de/nl/tr/ru→ar/th/vi。
- N-62 課金防御バッチ1／N-60 オンボ文言／N-61 影焼き込み（素材待ち）。

## 恒久ルール（継承）
- 翻訳は Sonnet+（Haiku 不可）。placeholder 保持・機能名は訳さない（parity テストが守る）。
- **視覚変更は ui-design.md「承認後」**（(1)現状→(2)変更案→(3)承認→(4)実装）。`rtk` 前置・`--no-verify` 禁止・vitest/playwright は素の npx・Framer Motion 禁止。
- **テーマ皮の手段＝`data-theme-id="<id>"` scoped の CSS append-only 上書き**（サブ2 で確立・既定/他テーマをバイト同一に保つ）。JS 構造差し替えは不要だった。
- **s197 fix-1 の掟**: 文字色を暗インクにするなら面もクリーム/明色に（対で・片方だけ＝不可視）。`var(--x, fb)` の fb は `--x` が :root 定義済みなら死にコード。
- 機微（支援・値付け・戦略）は tracked に書かない＝`docs/private/`。
