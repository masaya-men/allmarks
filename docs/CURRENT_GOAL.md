# 次セッションのゴール — スマホのネイティブスクロール修正を実機で確認 → OK なら「スマホ専用ライトボックス」へ

## まず最初に（ユーザーへの確認）
- **s180 でスマホのスクロール不能を修正して本番反映済**。カード（CardNode）の `touch-action:none` を、モバイル時だけ `pan-y` に緩めた（③のテキストカード内部停止は維持）。
- **セッション冒頭でユーザーに実機の結果を聞く**: 「`allmarks.app` をスマホでハードリロード → 指で盤面を上下スワイプしてスクロールできますか？」
  - **効いた** → タップでライトボックス／②上部タップで先頭／③テキストカード内部が動かない、も実機で再確認 → 問題なければ「スマホ専用ライトボックス」へ進む。
  - **まだ効かない** → 下の「もし直っていなかったら」へ。

## もし直っていなかったら（追加調査ポイント）
- `.mobileScrollContainer` 自身の高さ/spacer が 0 でスクロール余地がない可能性（contentBounds.height の spacer が実機で正しく積まれているか devtools で確認）。
- `-webkit-overflow-scrolling: touch` と `overscroll-behavior: contain` の相性、iOS Safari の慣性周り。
- カードの子で `touch-action:none` を持つ要素の取りこぼし（今回 `.cardNode` と ③のみと確認済だが、実機 devtools で pointerdown 対象の computed `touch-action` を実測する）。
- InteractionLayer がモバイルで pointer/wheel を本当に手放しているか（isMobile 分岐の実挙動）。

## その次（スクロールが直ったら本命）
- **スマホ専用ライトボックス**（memory `project_mobile_board_direction` の "mobile-specific Lightbox pending"）。フルスクリーン・スワイプで前後・下スワイプで閉じる等、スマホネイティブな操作に。
- **スマホでのタグ付け**（同 pending）。ボトムナビ TAG からの導線を実機フローで。

## s180 で確定・信じてよいこと
- 修正は [CardNode.module.css](../components/board/CardNode.module.css) の `:global([data-lock-card-scroll='true']) .cardNode { touch-action: pan-y }` 一箇所のみ。
- `data-lock-card-scroll="true"` は [CardsLayer.tsx:1304](../components/board/CardsLayer.tsx#L1304) が `isMobile` の時だけ各カードに付与（= `@media(max-width:640px)` と厳密一致、`useIsMobile`）。デスクトップは属性なし＝`touch-action:none` のまま＝回帰ゼロ（tsc0/vitest2154/build OK）。
- **教訓（重要）**: この種のタッチスクロールは **Playwright ですり抜ける**（JS scrollTop は touch-action を無視）。**実機でしか検証できない**。memory `reference_native_scroll_touch_action_playwright`。
