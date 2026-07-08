# 次セッションのゴール — ★スマホのネイティブスクロールが実機で効かない件を直す（最優先・ほぼ原因確定）

## 状況（s179 末）
- モバイル盤面を **JS パン/慣性 → ブラウザ標準の overflow スクロール**に載せ替えた（本番反映済）。
- Playwright では構造・回帰OK（`.mobileScrollContainer` = overflow-y:auto/pan-y、scrollTop=400 でカード400px移動、**デスクトップ回帰ゼロ**）。
- **だが実機（スマホ）でスクロールが全く反応しない**（ユーザー確認）。

## 原因の見立て（最有力・ほぼ確実）
- **カード自体（CardNode）の `touch-action: none` が残っている**（[CardNode.module.css:12](../components/board/CardNode.module.css#L12)）。
- モバイルは密グリッドでカードが画面をほぼ埋める → 指が必ずカードに落ちる → カードの `touch-action:none` がネイティブ縦スクロールを塞ぐ。
- InteractionLayer は `pan-y` に緩めた（[InteractionLayer.tsx](../components/board/InteractionLayer.tsx) の isMobile 分岐）が、**カード（CardNode）を緩め忘れた**。
- **Playwright は JS で直接 scrollTop を動かしたので touch-action を無視＝すり抜けた**。この種のタッチスクロールは**実機でしか検証できない**（重要な教訓）。

## 次にやること（ここ一点でほぼ直る見込み）
1. **モバイル時、カードの `touch-action` を `pan-y` に緩める**（CardNode。`data-lock-card-scroll` 経由 or media query or isMobile prop）。
2. ③テキストカード内部停止は **`.titleScroll` だけ `touch-action:none`** で維持（globals.css の `[data-lock-card-scroll] [data-card-scroll]`）。カード全体は pan-y、内部スクロール要素だけ none。
3. 他に `touch-action:none` で塞いでいる要素がないか洗い出す（`.cardNode` の子、ResizeHandle 等。モバイル非表示のはずだが要確認）。
4. **実機で必ず確認**（Playwright はすり抜ける）。スクロールが効いたら、タップでライトボックス／②上部タップ／③テキスト停止も実機で再確認。

## s179 で完成・信じてよい土台（Playwright実測済み）
- `.mobileScrollContainer`（overflow-y:auto + 高さ contentBounds.height の spacer）を BoardRoot に isMobile 分岐で配線済み・構造は正しい。
- scroll→viewport.y 同期（`handleMobileScroll`＝モバイル唯一の viewport.y writer）、深リンク/②タップの `scrollTo` 化、済み。
- 全部 `isMobile` 分岐で**デスクトップは回帰ゼロ**（Playwrightで実測）。JS 慣性/跳ね返り・momentum-scroll.ts は撤去済み。
- 残るは **touch-action の塞ぎを外すだけ**の見込み。

## 本番の状態（要ユーザー判断）
- 現在の本番 `allmarks.app` は**モバイルでスクロール不能**。前版に戻す選択肢あり（ただし前版も感触は今ひとつ）。次セッション冒頭で touch-action を直して即デプロイが最短。
