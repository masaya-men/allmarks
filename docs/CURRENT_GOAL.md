# 次セッションのゴール — N-54「グリッドの交点だけ濃くなる」を根治する

## セッション 185 でやったこと（本番反映済・実機確認待ち）

**N-49 スマホから SHARE できるようにした**（ミッションの根幹）。[spec](superpowers/specs/2026-07-10-mobile-share-bottom-nav-design.md) / [plan](superpowers/plans/2026-07-10-mobile-share-bottom-nav.md)。
tsc0 / vitest 2246 / クリーンビルド / opus 全ブランチレビュー READY TO MERGE / `merge --no-ff b9c43511` / `allmarks.app` デプロイ済。

- ボトムナビ＝`TAG / THEME / SHARE / CORNERS / MORE`（MOTION は MORE パネルへ降格）
- スマホは**選ぶ→CREATE の2手**。並べる段は出さない
- **黒帯を消した方法**＝レプリカを組まず、画面に内接する**中央の 1.91:1 の帯**に自動配置して `.outerFrame` を `fit:'cover'` で撮る。`computeCoverRect` は中央を切るので帯と一致する
- 結果シートで `SHARE`（OS の共有シートに画像＋リンク）/ `COPY LINK` / `DONE`
- 回転ノブを触りで出せるように（先に `data-no-capture` を付けてから）

## ★まず実機で確認してほしいこと（自動では確認不能）

1. スマホの**選択モードで指スクロールが生きるか**（`setPointerCapture` と `touch-action:pan-y` の同居）
2. `SHARE` を押して出た OS シートで、**X / Instagram / LINE が画像とリンクをどう拾うか**
3. 出来た共有画像で**カードの文字が読めるか**（`scale` が効いてぼやけていないか）
4. タブレットの並べる段で**回転ノブが指で掴めるか**、かつ**共有画像にノブが写っていないか**
5. `/s/<id>` をスマホで開いて、受け取り画面が s184 のままか

## 次セッションでやること

1. **★最優先＝(N-54) グリッド/クロスハッチの交点だけ濃くなる**（s184 実機FB）— 本物盤面は CSS の重ねグラデーション2枚＝半透明の線が交点で二重合成される。受け取り画面/OG は `patternSvgDataUri` の SVG（1描画）なので濃くならない＝**また盤面と共有リンクが食い違っている**。直し方の候補＝**盤面も同じ SVG data-URI を背景に使う**（`background-image: url(data:...)` ＋ `background-size`）。副次効果＝`theme-customization.ts:160-163` が言う「dom-to-image は重ねた CSS グラデーションの片方向を落とす」問題も同時に解消し、SHARE スクショの忠実度が上がる。`useMemo` 必須。パララックス（`background-position-y`）と `background-size` の互換を要確認。詳細 TODO.md N-54。
2. **(N-51 の残り) スマホのボードに背景タイトルを出す**（ユーザー確定）— `BoardBackgroundTypography` の `!isMobile` ゲートを外す。出したら**スマホの共有画像にもタイトルを載せるか**を決める（s185 は盤面に無いので載せていない）。
3. **(N-50) タブレットの作法** — 744〜1180px は PC と同一描画＝主要操作が全て 27px。規則は確立済（**大きさは入力で決める・並べ方は幅で決める**）。
4. **(N-55) 撮影成功後もコラージュがシートの裏で触れる**（s185 レビュー発見・実害なし）。
5. **(N-53) e2e の腐り** — **実態は 58本中 30本**（master 単体で。s185 で A/B 実測）。`Test timeout` 20件・`VersionError (9)<(16)` 13件。**回帰検出網が半分死んでいる**ので、そろそろ腰を据えて直す価値がある。

## 絶対に守ること（恒久ルール）

- **ボードの見た目を変えたら、受け取り画面（`/s/<id>`）も必ず確認する。** s183・s184 と同じ事故を繰り返している。
- `CardsLayer` に `isMobile` を渡してはいけない（`×` とタグピルが消える）。スクロール解放は `lockCardScroll` を使う。
- ネイティブの触りスクロールは**実機でしか検証できない**（CDP の `synthesizeScrollGesture` も不可）。合成では computed `touch-action` を assert する。
- カードのタップ選択は `setPointerCapture` を使うので **Playwright では駆動できない**。`SELECT ALL` 経由で確認する。
- **`fit:'cover'` を勝手に `'contain'` に戻さない。** `tests/e2e/mobile-share.spec.ts` の黒帯検出テストが守っている。
- 目視確認はユーザーに振る。tsc / vitest / e2e と「測定でしか証明できないもの」だけ自分でやる。

## リリース段取り（参考・`docs/private/2026-07-08-release-runway-plan.md`）

束A スマホ閲覧（完了）→ 束B スマホ保存（完了）→ **束B' スマホ共有（＝N-49・完了）** → 束C 13言語＋規約 → 束D 公開素材 → 束E 総仕上げ・公開。拡張の Pinterest(N-28) は並行の別枠。**残る大物は N-50（タブレットの作法）。**
