# 次セッションのゴール (= セッション 148)

## 今の状態（セッション147で出荷・allmarks.app 反映済・ユーザー実機OK）

**空き盤面「掴んでぐりぐり」（grab-wiggle）を実装＋実機チューニング＋既存バグ1件修正**。全テーマ対応・**default byte-identical / tsc0 / vitest1858 / build OK**。

- **ふるまい**: 盤面の余白を左ドラッグ → 世界が指につられてズレる → **離すとぷるっとバネで戻る**（GSAP elastic）。引くほど重くなり上限90px弱（rubber-band `tanh`）。**実スクロール位置は変えない**。
- **方式**: カードは1枚も動かさず、CSS変数 `--grab-x/--grab-y` を cameraRef に書き、既存3層 transform＋patternLayer が `calc(base + var*重み)` で読む。React 再描画を通さず 60fps。素の状態は `var(...,0px)*w=0` で従来と一致。
- **確定チューニング**: 「パララックスを強く感じる遊び」＝前面静か・中間大きく。**カード0.4／散布シミ0.85／パターン(grid/dots)0.8／羊皮紙0.28**（`lib/board/rubber-band.ts` の `GRAB_LAYER_WEIGHTS`）。上限90 / バネ `elastic.out(1,0.4)`/0.7s。
- **温存**: 中ボタン/Space＋ドラッグのパン・ホイールは無変更。reduced-motion→従来スクロール。カード/chrome 上では非発動。
- **🐛 Grid テーマがリロードで消えるバグ修正（既存・grab無関係）**: 静的プリレンダが default 柄（none）で焼かれ、React 18 が hydration の属性不一致を直さず grid が `data-pattern='none'` に固着していた → patternLayer を post-mount フラグでゲートして根絶。playwright 実測。
- **スコープ外（将来）**: スマホは「ボード長押し→同じ遊び」を別タスク。default 用の奥で動く背景モチーフも別タスク。
- 正本: [spec](superpowers/specs/2026-07-01-board-grab-wiggle-design.md) / [plan](superpowers/plans/2026-07-01-board-grab-wiggle.md)。

## 次にやる（セッション148）= 生計フェーズ or 磨き、相談で1つ

- **③ プレミアムテーマ制作** — paper の次の世界観（テーマ土台は稼働中）。grab-wiggle も全テーマで効くので新テーマにも自動で乗る。
- **④ K3 実装** — 有料テーマ解錠機構（`docs/private/2026-07-01-k3-unlock-plan.md` の10タスク工程表）。
- **選択的シェア** — 新しい順100枚固定→手選択（IDEAS.md S1/S2/S3）。
- grab-wiggle のさらなる微調整（もっと大きく/上限UP 等）も随時可。

## 守ること（毎回）
- default 盤面 byte-identical。deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。deploy `--project-name=allmarks --branch=master`
- **機微情報は `docs/private/` のみ。tracked に書かない・commit しない**（CLAUDE.md 厳守）
- 台紙系・装飾・共有画像は実描画（playwright/実機）を見てからデプロイ。board のドラッグ/カードクリックは playwright 不可
- 既知フレーキー: `tests/lib/channel.test.ts`（再実行で緑・今回は一発緑）。応答は日本語・簡潔に
