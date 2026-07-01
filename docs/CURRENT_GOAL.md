# 次セッションのゴール (= セッション 148)

## 今の状態（セッション147で出荷・allmarks.app 反映済）

**空き盤面を掴んで「ぐりぐり」動かす微インタラクション（grab-wiggle）を実装・出荷**。全テーマ対応・**default byte-identical / tsc0 / vitest1858 / build OK**。

- **ふるまい**: 盤面の余白を左ドラッグ → 世界が指につられてズレる（paper=奥行き付き3層／default=平ら）→ **離すとぷるっとバネで戻る**（GSAP elastic）。引くほど重くなり上限90px弱（rubber-band `tanh`）。**実スクロール位置は変えない**。
- **方式**: カードは1枚も動かさず、CSS変数 `--grab-x/--grab-y` を cameraRef に書き、既存3層 transform が `calc(base + var*重み)` で読む（カード1.0/散布0.55/羊皮紙0.28、default の背景は重み0）。React 再描画を通さず 60fps。素の状態は `var(...,0px)*w=0` で従来と一致。
- **温存**: 中ボタン/Space＋ドラッグのパン・ホイールスクロールは無変更。reduced-motion 時は従来スクロールにフォールバック。カード/chrome 上では非発動。
- **スコープ外（将来）**: スマホは「ボード長押し→同じ遊び」を別タスク。default 用の奥で動く背景モチーフも別タスク。
- **検証**: playwright で default 静止時の3層 transform が純平行移動（カード=matrix(1,0,0,1,9,80)）＝byte-identical を実測。掴みドラッグ自体は setPointerCapture のため playwright 不可 → **ユーザー実機確認が宿題**。
- 正本: [spec](superpowers/specs/2026-07-01-board-grab-wiggle-design.md) / [plan](superpowers/plans/2026-07-01-board-grab-wiggle.md)。

## 次にやる（セッション148）

- **grab-wiggle の実機フィードバック取り込み**: 重み(1.0/0.55/0.28)・上限(90)・バネ(elastic.out(1,0.4)/0.7s)を `lib/board/rubber-band.ts` で微調整。もっと大きく/控えめ、戻りの弾み具合など。
- **次テーマ or 生計フェーズ**: ③プレミアムテーマ制作 or ④K3実装（`docs/private/2026-07-01-k3-unlock-plan.md`）or 選択的シェア（どれから行くか相談）。

## 守ること（毎回）
- default 盤面 byte-identical。deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。deploy `--project-name=allmarks --branch=master`
- **機微情報は `docs/private/` のみ。tracked に書かない・commit しない**（CLAUDE.md 厳守）
- 台紙系・装飾・共有画像は実描画（playwright/実機）を見てからデプロイ。board のドラッグ/カードクリックは playwright 不可
- 既知フレーキー: `tests/lib/channel.test.ts`（再実行で緑・今回は一発緑）。応答は日本語・簡潔に
