# 次セッションのゴール (= セッション 44)

## ゴール

**拡張機能 (= AllMarks 拡張) を user 個人 sideload 用に「完成」 させる**。 ストア公開は AllMarks ドメイン取得 (2026-05-31 予定) 後の `AllMarks v1.0` として 1 回だけ submit する方針なので、 セッション 44 の終わりに「機能完成 + sideload で個人運用開始 + あとは日付待ち」 状態に持っていく。

## 開始時の動き

1. **session 43 close-out 確認** — user に「https://booklage.pages.dev をハードリロードして TUNE 周りの最終状態 OK ?」 と聞く (= 念のため)
   - TUNE hover で drawer 展開 (= fader + ラジオダイヤル + LED panel 5 行)
   - 数字「267.84 · 97.21」 はそれぞれ局所 glitch (= 幅広にならない)
   - FilterPill = `AllMarks · 042`
   - POPOUT / SHARE / FilterPill / ScrollMeter counter 全部 hover で同じ glitch 言語
2. **既存 spec 読み込み**: `docs/superpowers/specs/2026-05-09-chrome-extension-v0-design.md` で現状確認
3. **拡張機能 code の現状 audit**: 既に何かしらの実装がある可能性 (= session 30 前後で着手?)
   - 場所: 多分 `extension/` or `chrome-extension/` ディレクトリ (= 要確認)
   - manifest.json / popup / content script / background script の有無

## 実装 / 仕上げの方針

### Phase 1: 現状 audit + 動作確認 (= 30-60 分)

- 既存 extension code を読む
- 動く状態なら build → user 機の Chrome 「拡張機能」 developer mode で sideload してもらう
- 不足機能洗い出し (= bookmarklet との挙動差分 等)

### Phase 2: 機能 brushup (= 1-2 時間)

- bookmarklet と同等の OGP / oEmbed 取得 + AllMarks board への保存
- 必要なら icon / popup UI 整備 (= 「保存しました」 toast 等)
- chrome.storage で AllMarks ボードの URL (= booklage.pages.dev 暫定) を保持
- 名前は仮で `Booklage Save` のまま (= AllMarks ドメイン取得時に 1 回だけ rebrand)

### Phase 3: sideload テスト + close-out (= 30 分)

- zip 作成 → user に「Chrome → 拡張機能 → 開発者モード ON → パッケージ化されていない拡張機能を読み込む」 案内
- 実 url で保存テスト → AllMarks ボードに表示確認
- 「あとは日付 (2026-05-31) を待つだけ」 状態に到達

## ストア公開のタイミング (= リマインダー)

- **2026-05-31** ドメイン `allmarks.app` 取得
- Cloudflare Pages 新 project 作成 → 301 redirect → GitHub repo rename
- 拡張機能を AllMarks v1.0 として manifest + name + icon を rebrand
- Chrome Web Store に **1 回だけ** submit (= 既存 user の混乱を避けるため複数バージョン submit はしない)

## 月末リマインダー (= 約 2 週間後)

`allmarks.app` ドメイン取得確認。 取得済なら拡張機能 store submit + 本体 rebrand sprint に進む。

## その他 backlog (= 余裕があれば)

- B-#3 重複 URL でサムネ等が出ない問題 (= 古めの未解決、 真因未調査)
- mobile UX 本格チューニング (B-#10)
- multi-playback vision の board card autoplay 着手 (= 差別化 core 機能、 memory `project_allmarks_vision_multiplayback.md`)
- 背景 AllMarks タイポ上の局所グリッチ演出 (= IDEAS.md §I、 CSS mask MVP 案あり)

## 引き継ぎ resources

- [docs/TODO.md](docs/TODO.md) — active backlog (= 「現在の状態」 が session 43 narrative)
- [docs/TODO_COMPLETED.md](docs/TODO_COMPLETED.md) — session 43 narrative (= 9 task + 7 round polish の全体)
- [docs/superpowers/specs/2026-05-09-chrome-extension-v0-design.md](docs/superpowers/specs/2026-05-09-chrome-extension-v0-design.md) — 拡張機能 v0 spec
- memory `project_allmarks.md` — ドメイン取得後の rebrand 進行
- memory `project_bookmarklet_persistence.md` — bookmarklet は他ブラウザ用に温存 (= 拡張機能と並存)

## session 43 で確定したこと (= 永続)

- **glitch 言語 統一**: 全 chrome (TUNE / POPOUT / SHARE / FilterPill / ScrollMeter counter) で 700ms steps(7) ::before/::after RGB ghost (橙+水色) ±4-5px shift。 keyframe は各 module 内に同一定義 (= CSS Modules scoping 対応)
- **TUNE chrome は drawer 型に確定**: hover で TopHeader 下に展開、 fader + ラジオダイヤル + LED legend。 数字 glitch は numGroup span で局所化。 chip 路線は廃止
- **AllMarks ブランド名は mixed-case で UI に出してよい**: FilterPill 'all' filter が「AllMarks」 表示、 他 chrome の uppercase 統一からの例外として brand identity を優先
- **「動いてる」 は computed style 実測まで取る**: code が正しく見えても CSS scoping / pointer-events / disabled 等で動かないケースあり。 「report 前に playwright で computed style + bounding rect 取って確証」 を習慣化
