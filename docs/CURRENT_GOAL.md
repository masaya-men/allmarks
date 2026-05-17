# 次セッションのゴール (= セッション 42)

## ゴール

**user 指定なし** — backlog から最優先 1 件を選んで着手。 候補は順番に:

1. **multi-playback vision の board card autoplay 着手** (= 差別化 core 機能、 memory `project_allmarks_vision_multiplayback.md`、 重め)
2. **B-#3 重複 URL でサムネ等が出ない問題** (= 古めの未解決、 真因未調査、 軽め-中)
3. **mobile UX 本格チューニング (B-#10)** (= 重い、 mobile 全体の再設計)

## 開始時の動き

1. user と挨拶 + session 41 close-out 確認 (= `booklage.pages.dev` をハードリロード)
   - 右側 chrome が `TUNE` / `POP OUT` / `SHARE` の 3 テキスト label になってる
   - `TUNE` にホバー → Matrix scramble で `W 267.84 · G 97.21 · ↺` readout 展開、 数字 drag で値変更、 `↺` で default 戻し
   - TUNE click で sticky open、 ESC で close
2. 候補 1〜3 のどれをやるか user に聞く
3. 決まったタスクの spec / plan / memory を読む
4. 提案 → 合意 → 実装 → tsc + vitest → prod deploy → user 確認

## 月末リマインダー (= 2026-05-31 約 2 週間後)

`allmarks.app` ドメイン取得確認。

## 引き継ぎ resources

- [docs/TODO.md](docs/TODO.md) — active backlog 全体
- [docs/TODO_COMPLETED.md](docs/TODO_COMPLETED.md) セッション 41 セクション — TUNE トリガー narrative
- spec: [docs/superpowers/specs/2026-05-18-topheader-tune-trigger-design.md](docs/superpowers/specs/2026-05-18-topheader-tune-trigger-design.md)
- plan: [docs/superpowers/plans/2026-05-18-topheader-tune-trigger.md](docs/superpowers/plans/2026-05-18-topheader-tune-trigger.md)

## 余裕があれば backlog

- テーマ vocab map (= TUNE → CALIBRATE 等) を仕込んでおく (= 別 sprint 予定だが、 構造的に load 軽い)
- ResetAll 廃止に関する UX 検証 (= ユーザーが「全リセット」 を本当に Ctrl+Z で済ませてるか観察)
- TopHeader 残課題: orphan ファイル (PopOutButton / SizeSlider / GapSlider / WidthGapResetButton / ResetAllButton) を実際に削除する判断 (= 復活しないなら delete commit)

## session 41 で学んだこと (= memory 更新候補)

- **CSS cascade per-property**: 同じ selector 2 つ書いても異なるプロパティなら共存する。 reviewer false-alarm 一度 (Haiku)
- **innerHTML char injection**: scramble 系の random char set に `<` `>` `&` 混ぜると DOM 破壊。 escape ではなく除去で対応
- **stale closure on props in rAF chain**: ref を render 毎に inline で同期する PrecisionSlider パターンが正解
- **subagent review の hallucination**: Haiku reviewer が plan に無い "expected" 値を発明することがある。 controller が plan 原本確認で棄却
