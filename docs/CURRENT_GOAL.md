# 次セッションのゴール — N-49「スマホから SHARE できない」を設計して出荷する

## セッション 184 の実機フィードバック（全て記録済・対応方針も確定）

- ✅ **N-46 スマホのスクロール** — 実機OK（「完璧に直ってました」）
- ✅ **N-48 受け取りの下部 IMPORT バー** — 実機OK
- ✅ **受け取り画面が左に寄る** — s184 末に**根治・本番反映**（`CardsLayer` は `position:absolute` で `.scroller` の padding を無視する一方、幅計算は padding を引いていた）。実測で 左16 / 列間隔124 / 右16 に。e2e で固定。
- **恒久ルール化**: **ボードの見た目を変えたら受け取り画面も必ず確認する**（memory `feedback_board_change_check_receiver`）。同種の事故が繰り返されている。

## 次セッションでやること

0. **★最優先＝(N-49) スマホ・タブレットから SHARE できるようにする**（ローンチ前・規模M）
   - **ユーザー確定**: 入口は**ボトムナビ**。今のナビ（TAG / THEME / MOTION / CORNERS / MORE）を**整理して、押しやすい位置に SHARE を置く**＝ボトムナビの再設計込み。
   - **真のブロッカーは2つだけ**（s184 調査・TODO.md の N-49 に全文）: (a) 入口が無い（`handleEnterSelectMode()` を呼ぶだけ） (b) 回転ノブが `.element:hover` 依存で指では触れない。
   - **既に指で動く**: カード選択・並べる段のドラッグ移動・撮影・リンク作成・COPY・POST TO X。
   - **要デザイン**: `ARRANGE_SAFE_INSET`(56/72/16) と `m=48` がスマホで右に約32px はみ出す／縦長盤面の撮影は 1200×630 で左右に約454px の黒帯／`ShareSelectBar`・`ShareToast` が 11px 文字の密な行。
   - **未配線の資産**: `canWebShareFiles` / `dataUrlToFile`（s174 実装・テスト済）＝ワンタップのネイティブ共有。
   - **最小 MVP 候補**: 「並べる」を自由編集させず自動配置のまま **選ぶ→CREATE**。
   - 進め方＝**brainstorming → spec → plan**（新規 UI・ナビ再設計なので承認を取ってから実装）。
1. **(N-54) グリッド/クロスハッチの交点だけ濃くなる**（s184 実機FB）— 本物盤面は CSS の重ねグラデーション2枚＝半透明の線が交点で二重合成。受け取り画面/OG は SVG（1描画）なので濃くならない＝**また盤面と共有リンクが食い違っている**。直し方の候補＝**盤面も同じ SVG data-URI を背景に使う**（dom-to-image がグラデ片方向を落とす既知問題も同時に解消）。`useMemo` 必須。詳細 TODO.md N-54。
2. **(N-51 の残り) スマホのボードに背景タイトルを出す**（ユーザー確定）— 「ボトムナビの THEME からカスタマイズできるように見えるのに見えないのはおかしい」。`BoardBackgroundTypography` の `!isMobile` ゲートを外す。
3. **(N-50) タブレットの作法** — 744〜1180px は PC と同一描画＝主要操作が全て 27px。規則は N-48 で確立済（**大きさは入力で決める・並べ方は幅で決める**）。
4. **(N-53) e2e `board-b0.spec.ts` の腐り**（非ブロック）。

## s184 で出荷したもの（全て `allmarks.app` 反映済）

N-46（スマホ受け取りスクロール）/ N-47（タブレット同）/ N-48（受け取りの下部 IMPORT バー・触り端末ではメーター非表示）/ N-51（スマホ盤面に左右16px・すき間14px）/ N-52（パターンの太さ THICKNESS スライダー）/ N-45（腐った共有 e2e 3本を削除）。

## 実装の在り処

- **N-46/47**: `CardsLayer` の新 prop `lockCardScroll`（属性 `data-lock-card-scroll` だけを駆動・**`isMobile` は渡さない**＝`×`/タグピルが消えるため）。`SharedBoard` は `lockCardScroll={isMobile || isTouchDevice}`。
- **N-48**: `components/share/ReceiverImportBar.tsx` + `.module.css`、`BOARD_Z_INDEX.TOUCH_BOTTOM_BAR=150`、`SharedBoard` の `isTouchSurface`。[spec](superpowers/specs/2026-07-10-receiver-touch-import-bar-design.md)。
- **N-51**: `MOBILE_LAYOUT.SIDE_MARGIN_PX=16` / `GAP_PX=14`、`BoardRoot` の `layoutSidePaddingPx`、`SharedBoard` の `CardsLayer` を包む位置合わせ div。
- **N-52**: `patternStroke` + `defaultPatternStroke` + `effectivePatternStroke`（`lib/board/theme-customization.ts`）、`themes.module.css` の `--pattern-stroke` / `--pattern-dot-r`、`ThemeCustomizeSection` の THICKNESS 行。

## リリース段取り（参考・`docs/private/2026-07-08-release-runway-plan.md`）

束A スマホ閲覧（完了）→ 束B スマホ保存（完了）→ **公開日宣言可** → 束C 13言語＋規約 → 束D 公開素材 → 束E 総仕上げ・公開。拡張の Pinterest(N-28) は並行の別枠。**残る大物は N-49（スマホ SHARE）と N-50（タブレット作法）。**
