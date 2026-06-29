# 次セッションのゴール (= セッション 141)

## 今の状態（セッション140で完了・allmarks.app 反映済み）

Paper テーマの作り込みをユーザー対話で継続。全て本番反映済・tsc0/vitest1816/build OK・default 無傷（paper-scoped）。

- **台紙の高解像度化 + ユーザー選定素材配線**（Figma CC BY 4.0、透明テープ/枝+緑封蝋/破れクラフト）。ライセンスは `docs/paper-theme-asset-licenses.md`。
- **テキストカード（サムネ無し）を方眼/ノート紙化**（`card-paper-graph/notepad`、Yomogi 手書き）。`PlaceholderCard.paper` prop。
- **「四角い影板」修正**: paper-note の四角 box-shadow を**形に沿う drop-shadow** へ（`:has([data-paper-note])`）。DOM 実測で真因確定。
- **メーターは現状維持**（木ルーラー不採用）+ 色味を少し濃く。
- **立体感強化**: カード台紙 / paper-note / ボード紙パネルの3影を強く濃く。

## 次にやる（セッション141・ユーザーと一緒に）

1. **ボード中央上の「よくわからない線」を解消**（ユーザー報告 = 最優先）。まず DOM 実測で正体特定（TopHeader ナビ下のルール線 / パネル境界 / 装飾のどれか）→ 解消。TODO.md (N-08)。
2. **影の強度をユーザー実機判断で微調整**（N-09）。もっと濃く/長く可。ボードパネルは外側も明るく影が出にくい→外側を少し暗くする/縁取り追加も選択肢。
3. **共有画像テキストカードの紙パリティ**（N-10）を一致させるか相談・実装（ShareMirror に graph/notepad 描画を足す）。

## 残り（順次）
Paper 品質: ⑥マステ/ピン配置 ／ ⑦チュートリアル PiP 紹介 ／ ⑧枠付きカードの使い道 ／ 眠り在庫（deckle-edge-mat/foxing/スタンプ）有効化 ／ follow-up: 明色 BOARD のヘッダー色ハードコード ／ OG画像の Google Fonts CORS（fallback でカバー）。

## 守ること（毎回）
- default 盤面 byte-identical。deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。deploy は `--project-name=allmarks --branch=master`。
- playwright で board カードのクリックは setPointerCapture で不可。Lightbox は開かず祖先 computed style ダンプで調査する手が有効（session140 で実証）。
- 既知フレーキー: `tests/lib/channel.test.ts`（再実行で緑）。応答は日本語。
