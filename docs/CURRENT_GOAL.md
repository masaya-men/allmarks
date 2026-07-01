# 次セッションのゴール (= セッション 148)

## 今の状態（セッション147で出荷・allmarks.app 反映済）

**掴みぐりぐり(grab-wiggle)を全テーマで出荷＋実機チューニング＋既存バグ1件修正。縁エフェクトは試行錯誤の末いったん撤去し、代わりに「縁でデータ化」機能の spec/plan を用意した（実装は次回）。**

- **grab-wiggle 確定**：前面静か・中間大きく＝強いパララックス。`GRAB_LAYER_WEIGHTS`＝カード0.4/散布0.85/パターン0.8/羊皮紙0.28。全テーマ。static export の pattern 背景(grid/dots)も grab で動く。
- **🐛 Grid テーマ消失バグ修正**：静的プリレンダが default 柄(none)で焼かれ、React 18 が hydration の属性不一致を直さず grid が固着。patternLayer を post-mount ゲートで根絶。
- **縁グリッチは撤去**：RGB分離→乱流シャッター→0/1コード帯…と試したが「イメージと違う」。default から完全撤去済（ベースの掴みぐりぐりは全テーマ維持）。
- **fx-lab.html 設置**：`allmarks.app/fx-lab.html`（隠しページ）。CodePen「Shapes Over Pixels」を忠実移植した粒々(ハーフトーン)の調整ラボ。ユーザーが値確定：res8/size1.3/effect0.94/bg0.86/contrast125/max0.66/lighter。

## 次にやる（セッション148）= 「縁でデータ化」機能を実装

**正本**: [spec](superpowers/specs/2026-07-02-board-edge-data-dissolve-design.md) / [plan](superpowers/plans/2026-07-02-board-edge-data-dissolve.md)（6タスクTDD）。

- **やること**：default テーマで、掴んで動かすとカードが盤面外縁に潜った"その部分だけ"が粒々(データ)になる。あなたの案＝各カードの粒々版を1回だけ作って透明で重ね、縁の帯マスクで掴み中だけ見せる（毎フレーム計算なし＝軽い）。境界線も軽くあばれる。
- **CORS**：読める画像＝本物色の粒／読めない画像(X等)＝汎用の白シアン粒でフォールバック（映ってても外部画像はピクセル読取不可＝共有画像と同じ制約）。
- **着手方法**：「plan を実装して」で即開始。Task1(純ロジック,単体テスト)→Task6(実機調整)。canvas は jsdom 不可なので純ロジックのみ単体テスト、見た目は playwright＋実機。
- 帯の深さ(`--edge-band` 90px)・粒サイズ・reveal 速度は実機で調整。

## 守ること（毎回）
- default 盤面 byte-identical。deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。deploy `--project-name=allmarks --branch=master`
- **機微情報は `docs/private/` のみ。tracked に書かない・commit しない**（CLAUDE.md 厳守）
- 台紙系・装飾・掴み演出は実描画（playwright/実機）を見てからデプロイ。board のドラッグ/カードクリックは playwright 不可（setPointerCapture）
- 既知フレーキー: `tests/lib/channel.test.ts`（再実行で緑）。応答は日本語・簡潔に
