# 共有のテーマ化（スクリーンショット方式）— 設計書

- **日付**: 2026-06-29（セッション138）
- **状態**: 設計合意済み → 実装計画(plan)へ
- **関連**: [theme-system spec §6 共有のテーマ化](2026-06-24-theme-system-paper-atelier-design.md#L242)（旧 Plan 3 = Satori 前提。本書がそれを上書きし、方式を「スクショ」に確定）

---

## 1. 背景と問題

ミッションは「コラージュを画像で SNS シェアしてバイラル」。だが現状の共有は **背景色しか変わらず、テーマ（台紙・マステ・装飾・パターン）が乗らない** ＝ ユーザー指摘「バイラルが生まれない」。

### 現状の事実（コード実読・セッション138 調査）

| 面 | 役割 | テーマ | カスタム | 根拠 |
|---|---|---|---|---|
| OG画像 | SNSサムネ | ❌ ベタ書き | ❌ | [capture-mirror.ts](../../../lib/share/capture-mirror.ts)（手描き canvas・`BG_COLOR='#0a0a0c'` 等固定） |
| 送信プレビュー | ShareMirror | ❌ | ❌ | [ShareMirror.tsx](../../../components/share/ShareMirror.tsx)（独自CSS・theme非対応） |
| 受信ページ | /s/<id> | ⚠️空振り | ❌ | [SharedBoard.tsx:397](../../../components/share/SharedBoard.tsx#L397)（`data-theme` を div に付けるだけ＝CSSは `html[data-theme-id]` を見るので無効） |
| 送信データ | ShareDataV2 | `theme?` のみ | ❌ 箱なし | [types-v2.ts:55](../../../lib/share/types-v2.ts#L55) |
| 送信時 themeId | — | DEFAULT固定 | — | [BoardRoot.tsx:1786](../../../components/board/BoardRoot.tsx#L1786)（コメント「Plan 3 までの placeholder」） |

カスタム値の正体（session137 で実装済）: `ThemeCustomization` = edge/board/pattern 色・patternType・patternSize・titleColor（[types.ts:140](../../../lib/board/types.ts#L140)）。IDB `BoardConfig.themeCustomizations` に保存。live 盤面は patternLayer で描画（[BoardRoot.tsx:2232](../../../components/board/BoardRoot.tsx#L2232)）。**共有には一切乗っていない。**

---

## 2. ゴール / 非ゴール

### ゴール
- 共有の **3面（送信プレビュー・OG画像・受信ページ）** すべてに、ユーザーのテーマ＋カスタムが乗る。
- **¥0**（サーバー増設なし・クライアント生成）。
- **未来のテーマに無条件で強い**（テーマごとの描画コードを書かない）。
- default（Sound Wave=dotted-notebook）の **live 盤面は byte-identical**。古い共有（theme 無し）は default で無事。

### 非ゴール（今回やらない）
- サーバー側 Satori 描画（¥0方針と CPU/容量上限の衝突で見送り。将来テーマが激増したら再検討）。
- ShareMirror の完全撤去（＝プレビューを生成画像に一本化する案「(い)」）。**今回はプレビューを残してテーマ対応する案「(あ)」**（user 合意 2026-06-29）。
- 有料テーマ解錠（N-06）。

---

## 3. 方式の決定 ＝ スクリーンショット（dom-to-image）

### なぜこの方式か（調査の結論）

OG画像を作る方法は3系統: (i) サーバーSatori / (ii) 画面スクショ / (iii) 手描きcanvas。

- **(iii) が現状**。テーマが乗らないのは「手描きが盤面の見た目を知らない」から。
- **(ii) は過去に試して捨てられていた**が、その理由を履歴で確認: **本物の盤面（最大300枚＋動画iframe）を丸ごと処理して 5GB+ にメモリ爆発**（`b69e2e3` / `09f6e46`）＋ **iframe 複製で動画が自動再生**（`73c18c7`）。フィルタで画面外を除いても、ライブラリが**フィルタ前に全カードの画像を先読み**するため効かなかった。
- **user 指摘（正鵠）**: 「**見えてる枠だけ**撮る」なら、十数枚・動画なし ＝ 3つの爆発要因が全て回避される。

### スパイクで実証済み（2026-06-29）

本物のテーマCSS＋**本物の 2.3MB 紙PNG**で「見えてる枠（1200×628）を dom-to-image でPNG化」を実測:

| テーマ | 結果 | 時間 | サイズ |
|---|---|---|---|
| Grid | ✅ 落ちない・taint しない | 47ms | 553KB |
| Paper（本物紙PNG入り） | ✅ | 321ms | 1134KB |

- **Paper（紙テクスチャ＋セリフ）まで完璧に再現** ＝ Satori が苦手とした最難所をスクショは苦もなく出した。
- **発見した唯一のキズ**: CSSグラデを2枚重ねた格子で、dom-to-image が**横線を薄く落とす**（既知のクセ）。→ 対策: パターンを **単層の SVG/画像** として渡せば正確（紙PNGが完璧だったのと同じ理屈）。
- スパイク成果物: `scratchpad/frame-{grid,paper}-{DTI,REF}.png`。

### この方式の本質的利点
**写すのは本物のDOM**なので、テーマがどんな見た目でも共有に自動で乗る。テーマごとの追加コード=ゼロ。唯一の弱点は「普通のCSSで描けない特殊効果（backdrop-filter 等）」だが、プレビューは平らな簡易版で使っていないため実質非該当。

---

## 4. アーキテクチャ / データフロー

```
[送信側]
 live 盤面(themeId + resolvedCustom)
   → buildShareData: ShareDataV2{ theme, custom, cards, ... }   ← ①箱を増やす
   → SHARE NOW:
       見えてるカードだけの「キャプチャノード」を themed で構築   ← ②visible-only
       dom-to-image でPNG化 → JPEG圧縮(<180KB)               ← ③スクショ方式
   → createShare({ share, thumb })  （経路は今のまま）
       → functions/api/share/create.ts: thumb→R2 / share→KV   （変更なし）

[受信側]  /s/<id>
   share をデコード → SharedBoard
     <html data-theme-id=…> をセット + patternLayer を custom で描画  ← ④テーマ適用
```

ストレージ・配信（[create.ts](../../../functions/api/share/create.ts) / [og.ts](../../../functions/api/share/[id]/og.ts)）は**無変更**。サーバーは「クライアントが作った画像を受け取って保存」のまま ＝ ¥0 維持。

---

## 5. 変更点（コンポーネント別）

### ① 送信データに箱を追加
- **`lib/share/types-v2.ts`**: `ShareDataV2` に `custom?: ShareCustomization`（= ThemeCustomization の安全な部分集合: 6フィールド）を追加。デコード時に sanitize（色は文字列長＋簡易検証、patternType は enum、patternSize はレンジ clamp）。
- **`lib/share/board-to-share.ts`**: `buildShareDataFromBoard` に `themeId`（実値）と `custom` を載せる。
- **`components/board/BoardRoot.tsx`（~L1786）**: `DEFAULT_THEME_ID` 固定をやめ、state の `themeId` と `resolvedCustom` を渡す。
- **default 正規化**: themeId===DEFAULT かつ custom がデフォルト同値なら `custom` を省略（古い受信と挙動一致・ペイロード最小）。

### ② プレビューをテーマ対応 ＋ 見えてる範囲だけ撮る
- **`components/share/ShareMirror.tsx`**: themeId + custom を受け取り、台紙/パターン/縁/Title 色をテーマ対応に（live 盤面の見た目に寄せる）。**パターンは単層SVG**（横線対策）。プレビューは従来どおり全カード描画＋スムーズscroll（live 位置決めのため）。
- **キャプチャノード（新規・on SHARE NOW のみ）**: 現在のスクロール位置から「枠内に入るカードだけ」を選び、1200×628 の themed ノードを構築 → これを dom-to-image。**全カードを保持しないので 2026 の爆発は構造的に起きない**。ShareMirror のカード描画を共有（DRY）。

### ③ OG画像レンダラを差し替え
- **新規 `lib/share/render-share-image.ts`**: `dom-to-image-more` を**遅延 import**（既存依存・コラージュ書き出しで現役）。キャプチャノードを dom-to-image → PNG → 既存の `canvasToJpegUnderTarget` 相当で **JPEG <180KB** に再圧縮。base64 を返す。
- **`components/share/SenderShareModal.tsx`**: `captureMirrorToWebP` の呼びを新レンダラに置換。**フォールバック**: dom-to-image が失敗/空なら従来の `captureMirrorToWebP`（手描きcanvas）に退避＝共有が絶対に壊れない。フォント ready（`document.fonts.ready`）を待ってから撮る。
- **`lib/share/capture-mirror.ts`**: フォールバックとして残置（撤去しない）。

### ④ 受信ページのテーマ適用
- **`components/share/SharedBoard.tsx`**: 復元した theme を **`<html>` の `data-theme-id`** にセット（現状の div `data-theme` を是正）。pattern テーマは patternLayer を custom で描画、work テーマ（paper）は globals.css の `html[data-theme-id='paper-atelier']` ブロックがそのまま効く。未知/欠落 themeId → default フォールバック。

### ⑤ 単層パターン（横線対策）
- **`lib/board/theme-customization.ts`** に「custom → 単層パターンの SVG data-URI」ヘルパを追加（patternType/色/size から生成）。**プレビューとキャプチャの両方で使用**（dom-to-image の横線落ち対策＋プレビュー＝キャプチャの見た目一致。単層SVGはブラウザでも dom-to-image でも正確に出る）。**live 盤面の default patternLayer CSS は触らない**（byte-identical 維持）。

---

## 6. エラー処理・エッジケース
- **dom-to-image 失敗/空** → 手描きcanvasにフォールバック（③）。共有は止めない。
- **CORS サムネ**（Twitter等）→ プレビュー/キャプチャは crossOrigin + placeholder fallback 済 ＝ 表示画像は CORS クリーン ＝ **taint しない**（スパイクで確認）。YouTube 等 CORS 許可サムネはそのまま写る。
- **Safari の foreignObject クセ** → リスク（後述）。フォールバックが保険。実装後に Safari 実機確認。
- **大量カード** → キャプチャは見えてる分のみ ＝ 構造的に bounded。
- **フォント** → `document.fonts.ready` 後に撮る（Fraunces/Geist 反映）。

## 7. default 不変性
- **live 盤面 default は無変更**（変更は全て share/capture 側にスコープ）。
- **default の共有OG画像**は描画器が変わるため見た目が変化しうる → 「今と同等以上」を実機で確認（dom-to-image は実プレビュー由来でむしろ忠実）。

## 8. テスト・検証
- **単体(vitest)**: ペイロード往復（theme+custom encode/decode/sanitize）/ custom sanitize（色・enum・range）/ default 正規化 / 未知 themeId フォールバック。
- **視覚(Playwright)**: 盤面に bookmarks＋theme＋custom を seed → 共有 → キャプチャ生成 → 各テーマで PNG/JPEG が出る＋見た目正しいを実測（getComputedStyle ＋ スクショ）。default の共有画像が今と同等を確認。受信 /s/ にテーマが効くことを確認。
- **デプロイ前ゲート**: `rtk tsc && rtk vitest run && rtk pnpm build`。
- 既知フレーキー: `tests/lib/channel.test.ts`（再実行で緑）。

## 9. 変更ファイル地図
- `lib/share/types-v2.ts` — custom 追加 + sanitize
- `lib/share/board-to-share.ts` — themeId(実値)+custom を載せる
- `components/board/BoardRoot.tsx` — 送信に実 themeId+resolvedCustom（~L1786）
- `components/share/ShareMirror.tsx` — テーマ対応 + 単層パターン
- `lib/share/render-share-image.ts`（新規） — dom-to-image キャプチャ（遅延 import）+ JPEG 圧縮
- `components/share/SenderShareModal.tsx` — 新レンダラ採用 + visible-only キャプチャノード + フォールバック
- `components/share/SharedBoard.tsx` — /s/ に data-theme-id + patternLayer
- `lib/board/theme-customization.ts` — 単層パターン SVG ヘルパ
- `lib/share/capture-mirror.ts` — フォールバックとして残置

## 10. 既知のリスク
- **dom-to-image の安定性/ブラウザ差**（特に Safari）。→ フォールバック(手描き)で保険、実機確認で詰める。
- **単層パターンの見た目一致**（live 盤面の CSS グラデ pattern と、共有の単層SVG pattern が視覚的に揃うか）。→ 実装時に並べて校正。
- **プレビューとキャプチャの一致**（別ノードなので見た目がズレないよう、同じ themed カード描画を共有）。
