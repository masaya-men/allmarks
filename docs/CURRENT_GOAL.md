# 次セッションのゴール (= セッション 43)

## ゴール

**session 42 持ち越し 3 件を片付ける**。 ①②は短時間 fix、 ③は brainstorming → spec → 実装の大きめ task (= スライダー自体を音波 / ラジオ / ミキサー風に redesign)。

## 持ち越し 3 件

### 1. chip 中央配置の視覚補正 (= user 指定値で chip position シフト)

- **デフォルト値そのものは変更しない** (= 表示は `267.84` / `97.21` のまま)
- chip の表示位置だけ user 指定の補正をかける:
  - **W (左 slider)**: 数値 `302.92` 相当の位置を chip の visual 中央にする
    - 現状 chipLeftPx(267.84) = 50px → 補正後 chipLeftPx は 53.18px (= +3.18px 右シフト)
  - **G (右 slider)**: 数値 `100.92` 相当の位置 (= +0.75px 右シフト)
- 実装: `components/board/TuneTrigger.tsx` の `chipLeftPx()` 関数に scope 別 visual offset を追加。 全 W 値 / 全 G 値に同じ offset を適用 (= drag した値が変わっても offset は constant)
- **重要**: 「数学的には完璧」 という反論はしない。 user の視覚判断 = 真実。 +3.18 / +0.75 は user が tune した値なのでそのまま使う

### 2. hover 外したときの leave grace を長めに

- 現 `LEAVE_GRACE_MS = 180` を **800ms or 1000ms** に
- user 「マウスホバーを外したときにすぐに TUNE に戻らないように少し時間をおいてほしい長めに」
- 修正箇所: `components/board/TuneTrigger.tsx` の `const LEAVE_GRACE_MS = 180` 1 行

### 3. 思い切った redesign — スライダーを音波メーター / ラジオ / ミキサー風に

- user 「もしくは思い切った変更で、 スライダー自体音波メーターみたいにしたり、 ラジオのチューンとかサウンドミキサーのつまみとか、 マイクのゲインの縦のスライダーみたいにして、 数値は別のところにガタガタしないように置いちゃうのは？ それがいいかも」
- **方向性**:
  - スライダー本体 = 音波視覚化 / ラジオダイヤル / ミキサーつまみ / マイクゲイン縦スライダー風
  - 数値 readout = 別の位置 (= drag 中もガタガタしない場所、 例: chip 上 or chrome 別位置)
  - 黒+白 minimal + 音波 motif テーマ (= memory `project_theme_sound_wave.md`) と完全相性
- **手順**:
  1. brainstorming skill で 3-5 案のモック (= Visual Companion で HTML mockup 比較)
  2. user 選定 → spec → 実装 plan → ship
  3. ①②の補正は **③着手前に当てる** (= 現行 chip 形式のまま暫定運用、 ③ 完成後に旧 chip 廃止)

## 開始時の動き

1. user 挨拶 + session 42 close-out 確認 (= ハードリロード `https://booklage.pages.dev`)
   - TUNE hover → readout 展開、 縦ガタなし ✓
   - 数字 `267.84` / `97.21` = orange、 「DEFAULT」 = grey (state 動かしたら orange)
   - ScrollMeter 上に `CLICK TO JUMP · SHIFT FOR FAST` 常時表示
   - chip 中央問題 (= 視覚的に左寄り) は **次セッション ①で fix 予定**
2. user に「①②先にやる or ③先に brainstorm か」 を確認
3. ①②から着手推奨 (= 30 分以内、 即体感改善)、 次に ③ brainstorm

## その他 backlog (= 余裕があれば)

- multi-playback vision の board card autoplay 着手 (= 差別化 core 機能、 memory `project_allmarks_vision_multiplayback.md`)
- B-#3 重複 URL でサムネ等が出ない問題 (= 古めの未解決、 真因未調査)
- mobile UX 本格チューニング (B-#10)

## 月末リマインダー (= 2026-05-31 約 2 週間後)

`allmarks.app` ドメイン取得確認 (= 既に何度かリマインド済、 user 取得待ち)。

## 引き継ぎ resources

- [docs/TODO.md](docs/TODO.md) — active backlog
- [docs/TODO_COMPLETED.md](docs/TODO_COMPLETED.md) セッション 42 narrative (= 5 phase 詳細)
- memory `project_theme_sound_wave.md` — ③ の redesign 方向性 (= 音波テーマ)
- memory `reference_box_sizing_min_height.md` — session 42 で学んだ CSS 罠

## session 42 で確定したこと (= 永続)

- **UI 文字言語ポリシー**: chrome (= ボタン / ラベル / ヒント) は全 15 言語英語固定、 content (= 説明 / ヘルプ / LP) は 15 言語翻訳継続。 Linear / Figma / Notion 方式
- **default theme**: 黒+白 minimal + 音波 motif で統一。 今後のアニメ・装飾は音 (waveform / oscillation / amplitude / frequency) から着想
- **user の視覚判断 = 真実**: chip 中央等の「ずれてる」 報告に対して「math 上は中央です」 と反論しない、 user 補正値をそのまま使う
