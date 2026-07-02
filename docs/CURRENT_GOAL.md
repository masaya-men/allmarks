# 次セッションのゴール (= セッション 151)

## 今の状態（ボード磨き＋インタラクション修正を master にマージ済・盤面まわりは一区切り）

**セッション150でやったこと（すべて `allmarks.app` 反映・ユーザー実機OK・master マージ済）：**

1. **カード内ボタンにホバー反応**（×/↺/＋TAG/タグpill に ▶ 風「拡大＋明るく」）。default 静止時 byte-identical。
2. **🐛 ドラッグ移動中の grabbing カーソル**（`<html data-card-dragging>` + globals.css で強制。`.cardNode:active` は pointer capture 中に効かないため）。
3. **🐛 テキストカードの scrollbar 押下でライトボックスが開く/スクロール強奪**（`pressLandsOnCardScrollbar` で capture 前に bail。classic=幾何厳密／overlay=target フォールバック。実マウスで両モード実証・TDD 9テスト）。
4. **ブランチ `fix/board-cursor-and-paper-meter` を `--no-ff` で master マージ**（149の磨き5＋docs1＋150の3＝9コミット、ローカル/リモート削除済）。tsc0 / vitest1867 / build OK。

## 次にやる（セッション151）＝本命バックログに戻る（**まず優先順を相談**）

盤面の磨きは一区切り。以下から着手先をユーザーと相談して決める：

1. **③ プレミアムテーマ制作**（paper-atelier に続く2〜3本。spec は `docs/specs/2026-06-24-theme-system-paper-atelier-design.md` の量産手順、#1 white-sector / #5 celestial-atlas 候補）
2. **④ K3 解錠実装**（有料テーマのライセンス機構。工程表 `docs/private/2026-07-01-k3-unlock-plan.md`＝10タスクTDD。`EMPTY_LICENSES` を本物のライセンス集合へ。5台キャップ/フェイルオープン/ブクマ非接触/¥0/default byte-identical が不変条件）
3. **選択的シェア**（今は新しい順100枚固定→どの100枚を送るか選ぶ。3案は IDEAS.md）
4. **タグ付け強化**（最優先機能と本人発言・s60）

## 守ること（毎回）
- default 盤面 byte-identical。deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。deploy `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`
- **機微情報は `docs/private/` のみ。tracked に書かない・commit しない**（CLAUDE.md 厳守）
- board のドラッグ/カードクリックは **Playwright の `page.mouse`（CDP=trusted）なら検証可能**（setPointerCapture が効く）。`page.dispatchEvent` の synthetic は不可。headless=overlay / headed=classic でスクロールバー描画が違う点に注意
- 既知フレーキー: `tests/lib/channel.test.ts`（再実行で緑）。応答は日本語・簡潔に
