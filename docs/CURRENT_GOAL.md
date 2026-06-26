# 次セッションのゴール (= セッション 137)

## 今の状態（セッション136で完了・全て本番 `allmarks.app` 反映済み / commit+push 済み）

Paper/テーマ系のユーザー実機フィードバックを多数反映。tsc0 / vitest1791 / build OK。default(Sound Wave=黒+音波)は全変更 paper/grid-scoped で不変。

セッション136 で shipped（4デプロイ）:
1. **テーマ追従漏れクラスタ**: ①FilterPill ドロップダウン（黒箱→羊皮紙紙片＋墨、フォントも serif 化＝周囲と所帯統一）／②拡張のフローティングタグ strip（save-iframe が **third-party 埋め込みで localStorage 分離**のため暗かった → **IDB board-config からテーマを読む**よう修正、memory `reference_save_iframe_storage_partition`）／③PiP本体＋PiP内タグ窓（data-theme-id を PiP doc にスタンプ＋PiP CSS 4枚 paper override、user確認OK）。
2. **テーマ名英語統一（全15言語）**: Sound Wave(既定・旧Dotted Notebook)／Grid／Paper Atelier。既定は選択肢に **DEFAULT バッジ**。
3. **Grid テーマ刷新**: グリッドを**ビューポート固定層**に移設（旧: contentWidth=1963 の panned 層で center が盤面1393とズレ→左右非対称だった）。今は canvas 中央＝対称（端で左右16.5px）＋ **bg-position-y で 0.15x パララックス**（= paper 背景と同強度 `1−PAPER_PARALLAX_FACTOR`、**MOTION トグル無視で常時ON**・OS reduced-motion のみ尊重）。memory `reference_theme_bg_viewport_vs_content`。

## 次にやる（user と合意済みの順番: ④ → ⑤）

### 1. 【最優先】④ SETTINGS 再設計（方向B確定 = テーマを別枠に）
user が具体構成を提示済み。横幅広げてグループ＋ラベル化:
```
保存設定   : 保存時にすぐタグ付け [ON/OFF]
テーマ     : テーマを選ぶ [ボタン → 専用テーマ画面]
使い方     : ブックマークレットで保存 / チュートリアルを見る
拡張機能   : 拡張機能の詳細設定を開く
```
- **Phase 1**: ドロワーをグループ化＋横幅拡大、THEMES を「テーマを選ぶ」ボタンに置換 → クリックで**専用テーマギャラリー**（大きいスウォッチ）。これでドロワーが本来高さに戻り **s136 で判明したスクロール溢れ（中身745px>上限520px、下227px切れ）も解消**。実装は `components/board/ExtensionEntry.tsx`＋`.module.css`、`ThemePicker.tsx` を切り出し/モーダル化。
- **Phase 2**: テーマギャラリーに「**今の盤面を SHARE ボード風に切り取ったライブプレビュー**」（user 提案）。盤面レンダリング流用が要るので Phase 1 の後。
- **Phase 3 ＝ パターンテーマのカスタマイズ（user が④に畳み込み希望・2026-06-26）**: テーマを2系統に分ける ―「作品」テーマ（Paper/将来SF軍事は全固定）と「パターン」テーマ（Sound Wave/Grid はカスタム可）。盤面は**独立3レイヤー**（縁`.outerFrame` / 本体`.canvas` / パターン層）で、それぞれ色を CSS変数（`--edge-color`/`--board-color`/`--pattern-color`）に切り出して可変化。パターン種類（格子/斜め45deg/ドット/クロスハッチ=純CSS、複雑系=SVGパターン nucleoapp）・密度・線幅も選択。保存は board-config に per-theme カスタム値。テーマ専用画面に「カスタマイズ」セクションを組み込む（パターンテーマ選択時のみ）。**default(Sound Wave)は無変更時 byte-identical を維持**。詳細は `docs/private/IDEAS.md`「2026-06-26 パターンテーマのカスタマイズ構想」。

### 2. ⑤ SHARE のテーマ化（Plan 3・バイラル核）
user 指摘: SHARE は**背景色しか変わらず、台紙/マステ/装飾が乗っていない**＝「バイラルが生まれない」。共有レンダリング（A盤面スナップ＋B OGサムネ）に paper の素材を乗せる。原因調査（装飾レイヤーが共有レンダリングに含まれていない等）から。`components/share/SharedBoard.tsx`、共有エンコード/レンダリング経路を追う。

### 3. 残り（順次）
- **②拡張strip の実機検証**: user が拡張をリロード→ペーパーで保存して確認待ち。まだ暗ければ IDB が拡張コンテキストから読めているか診断ログを仕込む。
- **⑥マステ/ピンを意味のある位置に**（カードとボードに半分跨ぐ・上下で留める等、貼られて見える配置）。
- **⑦チュートリアルに PiP 紹介＋PiP に URL コピペで保存できる説明の超リッチアニメ**（IDEAS.md 確認してから）。
- **⑧枠付きカード（16:08 古紙フレーム(1)）の使い道を決める**（cover で壊れるのでオーバーレイ層 or 専用モード、user と決める）。

## 守ること（毎回）
- default(Sound Wave/dotted-notebook)は **byte-identical**。全 paper/grid 変更は scoped（`:global(html[data-theme-id='...'])` か `themeId===` 分岐）。
- deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。deploy は `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true --commit-message="ASCII"`。応答は日本語。**視覚は user 直接確認**（PiP/拡張は headless 不可、テーマ名/Grid は playwright で UI クリック切替して計測）。
- **UI見た目変更は承認フロー**（現状→案→承認→実装）。テーマ名/設計は英語 globally-clear。
- 既知フレーキー: `tests/lib/channel.test.ts`（単独では緑、再実行で pass）。

## 実機検証レシピ（playwright・テーマ切替は UI クリックで）
dev `pnpm dev`(:3000)。viewport `1489×679` dpr2。`/board` を待ち → IDB に `bookmarks` ダミー（thumbnail付）seed → reload → `extension-settings-wrap` を hover → `theme-button-<id>` をクリックでテーマ確実切替（**IDB board-config の直接 seed はタイミングで切替らないことがある**）。DB名 `booklage-db`。grid 層は `[class*="gridLines"]`（ビューポート固定・canvas中央）。スクリプトはプロジェクト直下に `_x.mjs` で書いて `node` 実行後に削除。
