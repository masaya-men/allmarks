# 次セッションのゴール (= セッション 41)

## ゴール

**user 指定なし** — backlog から最優先 1 件を選んで着手。 候補は順番に:

1. **B-#13 TopHeader 上部 chrome brushup** (= session 40 で予定だったが edge auto-scroll + undo に変更で持ち越し。 filter pill / size / gap slider / share 等のレイアウト全体の brushup)
2. **multi-playback vision の board card autoplay 着手** (= 差別化機能 core、 memory `project_allmarks_vision_multiplayback.md`)
3. **B-#3 重複 URL でサムネ等が出ない問題** (= 古めの未解決、 真因未調査)

## 開始時の動き

1. user と挨拶 + session 40 close-out 確認 (= `booklage.pages.dev` をハードリロード)
   - card を掴んで viewport 端 → page が auto-scroll する
   - Ctrl+Z で reorder / delete / resize / add / size slider / gap slider を全部戻せる、 Ctrl+Shift+Z で redo
   - 画面下に「並び替えを戻しました」 等の glass pill toast
2. 候補 1〜3 のどれをやるか user に聞く
3. 決まったタスクの spec / plan / memory を読む
4. 提案 → 合意 → 実装 → tsc + vitest → prod deploy → user 確認

## 月末リマインダー (= 2026-05-31 約 2 週間後)

`allmarks.app` ドメイン取得確認。

## 引き継ぎ resources

- [docs/TODO.md](docs/TODO.md) — active backlog 全体
- [docs/TODO_COMPLETED.md](docs/TODO_COMPLETED.md) セッション 40 セクション — edge auto-scroll + undo narrative
- memory `feedback_verify_before_completion.md` — session 40 で edge auto-scroll の architecture 誤認 + user 「動かない」 報告から再修正した教訓。 deploy 前に dev で実機 verify 必須
- memory `feedback_layman_simple_path.md` — session 39 の教訓、 user の「素人考えですが」 提案を 1 段重く受け取る

## 余裕があれば backlog

上記 1〜3 のうち、 着手しなかったもの。

## session 40 で学んだこと (= memory 更新候補)

- board の scroll architecture: `outerFrame` / `canvas` / `canvasWrap` が全部 `overflow: hidden`、 viewport.y state + `transform: translate3d` で動かす方式。 native scroll は完全に殺してる。 「scroll させたい」 時は handleScroll(dx, dy) callback 経由 (= 既存 API)
- `persistSoftDelete(id, false)` は元々「現セッション反映なし、 reload 必須」 spec だった。 session 40 で「IDB read + setItems push」 に修正済 = undo / 復活系の機能を入れやすくなった
