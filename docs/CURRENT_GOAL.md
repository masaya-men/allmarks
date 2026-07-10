# 次セッションのゴール — N-49（スマホから SHARE できない）を設計して出荷する

## まず最初に（ユーザーへの確認 = s184 で出荷した5件の実機チェック）

すべて `allmarks.app` に反映済み。**スマホ実機**で見てほしいのは3点：

1. **(N-48) 受け取り画面の下部「IMPORT n TO YOUR BOARD」バー** — 共有リンクをスマホ／タブレットで開く → 画面下端に幅いっぱいの緑ボタン（高さ52px）。押すと今までどおり取り込み → ボードへ。**上部の細い IMPORT と、スクロールメーターは触り端末では消えている**のが正。
   - テスト用リンク（100枚・約30日で失効）: `https://allmarks.app/s/LJ41eU` ※プライベートウィンドウで開くこと（IMPORT を押すと本当に100件入る）
2. **(N-51) スマホのボード** — 3列のまま、左右に16px・カード間に14px の余白ができ、**テーマのパターン／盤面色が覗く**。カード幅は 120→110px。
   - **要判断**: スマホのボードでは**背景タイトル（ワードマーク）はまだ出していない**（別ゲート）。出しますか？
3. **(N-52) THEMES → CUSTOMIZE** — グリッド系テーマ選択時、DENSITY の下に **THICKNESS** 行。右に動かすと線が太く（ドットは大きく）なる。**既定のままなら見た目は1px も変わらない**のが正。

（N-46 スマホスクロール・N-47 タブレットスクロールは実機OK済）

## 次セッションでやること

0. **★最優先＝(N-49) スマホ・タブレットから SHARE できない**（ローンチ前・規模M）。本体ボードは 640px 以下で `TopHeader` ごと `display:none`＝**スマホから共有リンクを作れない**。「コラージュを画像で SNS シェアさせてバイラルを起こす」というミッションの根幹。**s184 で調査済（TODO.md の N-49 参照）**:
   - **真のブロッカーは2つだけ**: (a) 入口が無い（`handleEnterSelectMode()` を呼ぶ導線を足すだけ） (b) 回転ノブが `.element:hover` 依存で指では触れない。
   - **既に指で動く**: カード選択・並べる段のドラッグ移動・撮影・リンク作成・COPY・POST TO X。
   - **要デザイン**: `ARRANGE_SAFE_INSET`(56/72/16) と `m=48` がスマホで右に約32px はみ出す／縦長盤面の撮影は 1200×630 で左右に約454px の黒帯／`ShareSelectBar`・`ShareToast` が 11px 文字の密な行。
   - **未配線の資産**: `canWebShareFiles` / `dataUrlToFile`（s174 実装・テスト済）＝ワンタップのネイティブ共有。
   - **最小 MVP 候補**: 「並べる」を自由編集させず自動配置のまま **選ぶ→CREATE**。失うもの＝回転・見えるリサイズ・横長 OG。
   - 進め方＝**brainstorming → spec → plan**（新規 UI なので承認を取ってから実装）。
1. **(N-50) タブレットの作法**（ローンチ前）— 744〜1180px は PC と同一描画＝ SHARE 60×27 / TITLE 60×27 / TUNE 53×28 / POP OUT 74×27 / MANAGE TAGS 103×27 / メーター18px と、主要操作が全て指の最小寸法未満。合格は「＋」保存の 56×56 のみ。**規則は N-48 で確立済（大きさ＝入力／並べ方＝幅）**。適用先の棚卸しから。
2. **(N-51 の残り)** スマホのボードに背景タイトルを出すか（ユーザー判断）。
3. **(N-53) e2e `board-b0.spec.ts` の腐り**（非ブロック）— `seedBoard` が `/board` を開いた後に `indexedDB.open(db, 9)` する競合。詳細は TODO.md。
4. **or 公開関連**（束C 13言語・規約正文条項 / 束D 公開素材 / 束E 総仕上げ）。

## s184 の実装の在り処

- **N-46/47**: `CardsLayer` の新 prop `lockCardScroll`（属性 `data-lock-card-scroll` だけを駆動・**`isMobile` は渡さない**＝`×`/タグピルが消えるため）。`SharedBoard` は `lockCardScroll={isMobile || isTouchDevice}`。
- **N-48**: `components/share/ReceiverImportBar.tsx` + `.module.css`、`BOARD_Z_INDEX.TOUCH_BOTTOM_BAR=150`、`SharedBoard` の `isTouchSurface` が上部 IMPORT / ScrollMeter / バーの3箇所を分岐。[spec](superpowers/specs/2026-07-10-receiver-touch-import-bar-design.md)。
- **N-51**: `MOBILE_LAYOUT.SIDE_MARGIN_PX=16` / `GAP_PX=14`、`BoardRoot` の `layoutSidePaddingPx`、`SharedBoard.module.css` の 640px ブロック。
- **N-52**: `patternStroke` + `defaultPatternStroke` + `effectivePatternStroke`（`lib/board/theme-customization.ts`）、`themes.module.css` の `--pattern-stroke` / `--pattern-dot-r`、`ThemeCustomizeSection` の THICKNESS 行。

## 直近のリリース段取り（参考・`docs/private/2026-07-08-release-runway-plan.md`）

束A スマホ閲覧（完了）→ 束B スマホ保存（完了・実機OK）→ **公開日宣言可** → 束C 13言語＋規約 → 束D 公開素材 → 束E 総仕上げ・公開。拡張の Pinterest(N-28) は並行の別枠。**s184 で N-46〜N-52 のスマホ/タブレット致命傷を潰したので、残る大物は N-49（スマホ SHARE）と N-50（タブレット作法）。**
