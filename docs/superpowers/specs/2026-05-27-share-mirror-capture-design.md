# シェアモーダル: ミラー + 同期スクロール + キャプチャ — 設計書

**日付**: 2026-05-27 (session 86)
**ステータス**: ドラフト (= user レビュー待ち)
**著者**: Claude Opus 4.7 + user brainstorming
**前提読書**: [docs/CURRENT_GOAL.md](../../CURRENT_GOAL.md), [docs/TODO.md](../../TODO.md) 「現在の状態」 (session 85), [docs/superpowers/specs/2026-05-28-share-pages-function-design.md](./2026-05-28-share-pages-function-design.md) (session 85 で ship した Pages Function 設計)

---

## Part A — ユーザー向け要約 (まずはここ)

### このスプリントで作るもの

**SHARE ボタンを押した時のモーダル UX を作り直す**。 session 85 で「URL 発行 + 受信側 + 404」 は本番で動いているが、 サムネ画像が AllMarks ロゴだけのプレースホルダになっていて、 user 個人のボードの中身が映らない問題が残った。 これを「**モーダル内に board の縮小ミラーを live 表示 + 同期スクロール + SHARE 確定時にキャプチャ**」 方式で解決する。

### 完成したら何が見える？

1. ボードの SHARE ボタンを押す → 黒いモーダルが開く (= session 85 で既に作ったやつ)
2. モーダルの中に **ミラー** (= 元ボードの縮小版、 1.91:1 の横長フレーム) が live 表示される
3. user がマウスホイールでスクロールすると、 **背景のボードとミラーが一緒に動く** (= 同期スクロール)
4. 「ここで OK」 と思った構図で **SHARE 確定ボタン** を押す
5. ミラーが今映してる絵 が画像化されて、 共有 URL のサムネとして KV に保存される
6. X / Slack / LinkedIn 等に URL を貼ると、 その画像が **summary_large_image カード**として表示され、 クリックで AllMarks 受信ページに飛ぶ

### 含まないもの (= 別スプリント)

- ミラー内での動画の動き再現 (= MOTION OFF 相当、 静止画で十分)
- 個別カード単位のクリックリンク (= X Card は 1 画像 = 1 リンクが業界標準、 個別リンクは受信ページで対応)
- workers-og 等のサーバーサイド OG 動的生成 (= 不要と判断、 推奨を反転した経緯あり)
- 共有期限の延長や paid プラン (= 現状 30 日固定)

### 成功の定義

- [ ] 300 カードのボードで SHARE → モーダル open → スクロール → 確定までスムーズに動く
- [ ] メモリ使用量がキャプチャ時に **10MB を超えない** (= session 85 の 5GB から 1000 分の 1)
- [ ] iframe 自動再生が SHARE 押した瞬間に発火しない (= session 85 で踏んだ罠の再発防止)
- [ ] cross-origin サムネ画像が壊れても、 brand 塗りで fallback して画像化が止まらない
- [ ] X に URL 貼ったら summary_large_image カードが出て、 クリックで受信ページに飛ぶ

---

## Part B — 設計の核心 (= 5 つの決定事項)

### B1. ミラーは「MOTION OFF 状態の board を別 DOM で再 render したもの」

[components/board/MotionToggle.tsx](../../../components/board/MotionToggle.tsx) と [components/board/CardsLayer.tsx#L388-L412](../../../components/board/CardsLayer.tsx#L388) を読んだ結果、 MOTION OFF 時の board は:

- Tier 1 自動再生プール cap = 0
- スポットライト動画も生えない
- 結果: **iframe / 動画 / audio embed が DOM にほぼ載らない**、 サムネ画像 + タイトル + 配置だけが残る状態

ミラーはこの「MOTION OFF state の board を強制的に再現するレンダー」 として実装する。 既存の `CardsLayer` を流用 (= prop で `motionEnabled={false}` 固定 + 縮小用 scale prop 追加) するのが第一候補。

**なぜ separate DOM か** (= bg board の CSS scale じゃダメな理由):

- bg board は 300 カード分の DOM を持っており、 CSS scale で見た目が縮んでも DOM の中身は同じ。 capture 時に walk するコストが大きい
- ミラーを別 DOM にすれば、 視界に映る 6〜15 枚分だけの最小 DOM で済む
- 「ミラーの中身は **OG 1200×630 viewport に映る範囲だけ**」 と限定できるので、 capture 対象が物理的に bounded

### B2. 同期スクロール: bg board ↔ ミラー の状態を 1 つの scrollY で共有

- BoardRoot (= 親) が `scrollY` state を保持
- bg の CardsLayer も、 モーダル内ミラーの CardsLayer も、 同じ `scrollY` を prop で受ける
- モーダル open 中の wheel event は、 **bg board の InteractionLayer に転送** (= bg のスクロールロジックをそのまま再利用)
- bg がスクロールすると `scrollY` 更新 → ミラーも自動追従

これにより:
- user は「ミラーの中身を見ながら、 wheel で自由に bg を動かす」 感覚を得る
- 「bg とミラーの位置がズレる」 バグ条件を構造的に排除 (= 1 state を 2 view で共有)

実装注意: モーダルの中身は `position: fixed` + `pointer-events: auto` だが、 **wheel は intercept して bg に流す**。 clipboard / button click 等は通常通り処理。

### B3. キャプチャは Canvas API に直接 drawImage、 ライブラリ不使用

session 85 の `dom-to-image-more` 由来のメモリ爆発を完全に避けるため、 キャプチャは:

1. SHARE 確定ボタン click → `canvas.getContext('2d')` 取得 (= 1200×630)
2. ミラーの中で「OG 範囲に映ってる」 と判定された各カードについて:
   - card 矩形 (x, y, w, h) を OG 座標系に変換
   - 背景塗り (= card background color)
   - サムネ画像を `Image()` で load → drawImage (= `crossOrigin="anonymous"` 設定済)
   - タイトル text を fillText で 1〜2 行描画
3. ブランド帯 (= B4) を描画
4. `canvas.toBlob('image/webp', 0.85)` → Blob → base64 dataURL
5. 既存の `createShare()` API に thumb として送信 ([lib/share/api-client.ts](../../../lib/share/api-client.ts))

cross-origin 失敗時 (= 画像が CORS 拒否):
- `Image.onerror` で検知
- 当該カードは brand 塗り (= `#1a1a1c` 単色 + 中央にカード type アイコン) + title 文字だけで描画
- キャプチャ全体は中断せず継続

メモリ天井計算: canvas 1200×630×4byte ≈ 3MB、 image decode buffer 15 枚 × 100KB ≈ 1.5MB、 合計 **~5MB**。

### B4. ブランド帯はミラー DOM の一部として組み込む

OG 画像の上部 or 下部に、 AllMarks の身元を baked-in する:

- **左下** (= 16px padding): 「A」 マーク (= 黒い三角の中に緑チェック、 favicon と同じ)、 ~32px size
- **右下**: 「N CARDS · NEWEST FIRST」 (= 11px monospace、 緑 dot 1 個 + text)、 N が share data の cards.length
- **上部** (アクティブ tag があれば): 「MUSIC · DESIGN」 (= dot 区切り join、 13px monospace)、 active filter から `t1, t2, ...` の name を join

これらはミラーの DOM 内に固定配置されており、 ミラーを見れば画像化結果と完全一致する状態。 「user に見せる WYSIWYG」 が成立する。

### B5. workers-og は導入しない

詳細は brainstorming session で論じた通り。 ポイント:

- AllMarks の OG は user の curating 行為 (= スクロールで構図を決める) を反映する画像なので、 「シェア作成時に 1 回作って KV に保存」 で良い
- workers-og は「リクエスト時に毎回サーバーで動的生成」 が前提のため、 ここでは過剰
- 費用: AllMarks 案は KV 1 read / OG 表示。 workers-og 案だと毎回 Satori cycle ~200ms × bot crawler 回数で課金線形増。 healthy で安い AllMarks 案を選ぶ

既存の [functions/s/patch-share-html.ts](../../../functions/s/patch-share-html.ts) が `og:image` に `/api/share/<id>/og.webp` を埋め込んでいる。 この URL 用の Pages Function `functions/api/share/[id]/og.ts` を新規追加して、 KV の `thumb` を bytes として返す薄いプロキシにする。

---

## Part C — データ・コンポーネント設計

### C1. 既存スキーマは維持

[lib/share/types-v2.ts#L59-L63](../../../lib/share/types-v2.ts#L59) の `KVShareEntry` は:

```typescript
export type KVShareEntry = {
  readonly share: ShareDataV2
  readonly thumb: string  // base64 WebP
}
```

このまま使う。 違うのは `thumb` の中身が「session 85 の brand placeholder」 から「ミラー由来の board 縮小画像」 に変わるだけ。 [lib/share/encode-v2.ts](../../../lib/share/encode-v2.ts) / [lib/share/decode-v2.ts](../../../lib/share/decode-v2.ts) / [functions/api/share/create.ts](../../../functions/api/share/create.ts) の touch 不要。

### C2. 新規追加するもの

| 役割 | パス | 内容 |
|---|---|---|
| ミラーレンダー | `components/share/ShareMirror.tsx` (新規) | board CardsLayer の subset、 motion 強制 OFF、 1.91:1 frame、 ブランド帯組み込み |
| ミラー styles | `components/share/ShareMirror.module.css` (新規) | レイアウト + ブランド帯 + 1.91:1 aspect |
| キャプチャ関数 | `lib/share/capture-mirror.ts` (新規) | ミラーの DOM 情報 + share data から canvas に drawImage、 WebP base64 を返す |
| OG プロキシ | `functions/api/share/[id]/og.ts` (新規) | `env.SHARE_KV.get(id)` → thumb を bytes として返す、 `Cache-Control: public, max-age=3600` |

### C3. 既存ファイルへの変更

| ファイル | 変更内容 |
|---|---|
| [components/share/SenderShareModal.tsx](../../../components/share/SenderShareModal.tsx) | レイアウト全面改修: 中央に `<ShareMirror>` を埋め込み + SHARE 確定ボタンを追加 + 「現在の `captureViewportWebP` 呼び出し」 を `lib/share/capture-mirror.ts` 経由に置換 |
| [components/board/BoardRoot.tsx#L63](../../../components/board/BoardRoot.tsx#L63) | SenderShareModal に渡す prop に `scrollY` / `setScrollY` を追加 (= 同期スクロール用) |
| [lib/share/snapshot.ts](../../../lib/share/snapshot.ts) | **削除**。 brand placeholder ロジックは不要に |
| [components/share/SenderShareModal.module.css](../../../components/share/SenderShareModal.module.css) | preview thumb 表示エリアを ShareMirror 用に再設計 (= 1.91:1 aspect、 black inset、 bezel) |

### C4. ShareMirror コンポーネントの I/F

```typescript
type ShareMirrorProps = {
  /** Share data — cards + tags + filter */
  readonly shareData: ShareDataV2
  /** Active filter tag names (= for brand strip display) */
  readonly activeTagNames: ReadonlyArray<string>
  /** Total board card count (= 全件) for "N OF M" display */
  readonly totalBoardCount: number
  /** Sync scroll Y from BoardRoot — same coord system as bg board */
  readonly scrollY: number
  /** Mirror's visible frame is OG 1.91:1, this scale factor is used to map
   *  bg coordinates to mirror coordinates. e.g. 0.25 = 1/4 size. */
  readonly scaleFactor: number
  /** Ref forwarded so capture-mirror.ts can read DOM rects at SHARE click. */
  readonly mirrorFrameRef: RefObject<HTMLDivElement>
}
```

スコープ:
- 内部で `motionEnabled={false}` 固定の CardsLayer 風レンダラを呼ぶ
- ブランド帯 (= 上下のテキスト/ロゴ) は ShareMirror 内部で配置
- 1.91:1 frame からはみ出るカードは `overflow: hidden` で clip
- ホバー / クリック / ドラッグ等のインタラクションは無効 (= 視聴専用)

### C5. capture-mirror.ts の I/F

```typescript
type CaptureOptions = {
  readonly width: number   // typically 1200
  readonly height: number  // typically 630 (= 1.91:1)
  readonly quality: number // 0.0-1.0, typically 0.85
}

export async function captureMirrorToWebP(
  mirrorFrame: HTMLElement,
  shareData: ShareDataV2,
  activeTagNames: ReadonlyArray<string>,
  totalBoardCount: number,
  scrollY: number,
  options: CaptureOptions,
): Promise<string | null>  // base64 WebP dataURL, null on failure
```

内部実装:

1. canvas 作成 (= options.width × options.height)
2. 背景塗り (= board bg color、 #0a0a0c)
3. ミラー frame から `data-card-id` 付きの child を query
4. 各カードに対して:
   a. mirrorFrame の getBoundingClientRect() 起点で `{x, y, w, h}` を取得
   b. canvas 座標系に変換 (= scale = options.width / mirrorFrame.width)
   c. サムネ image を `await loadImage(url, { crossOrigin: 'anonymous' })` で取得
   d. drawImage または fallback (brand 塗り)
   e. title text を 1〜2 行 fillText
5. ブランド帯描画 (= 左下 A マーク、 右下 N CARDS、 上部 active tags)
6. `canvas.toBlob('image/webp', options.quality)` → base64 dataURL

### C6. OG プロキシ Function

`functions/api/share/[id]/og.ts`:

```typescript
export async function onRequestGet(ctx): Promise<Response> {
  const id = ctx.params.id
  if (!isValidShareId(id)) return new Response('not found', { status: 404 })

  const encoded = await ctx.env.SHARE_KV.get(id)
  if (!encoded) return new Response('not found', { status: 404 })

  const decoded = await decodeKVPayload(encoded)
  if (!decoded.ok) return new Response('error', { status: 500 })

  // thumb is base64 WebP dataURL like "data:image/webp;base64,XXXX"
  const thumb = decoded.data.thumb
  const match = thumb.match(/^data:image\/webp;base64,(.+)$/)
  if (!match) return new Response('invalid thumb', { status: 500 })

  const bytes = Uint8Array.from(atob(match[1]), c => c.charCodeAt(0))
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
```

X / Facebook / LinkedIn の crawler はこの URL を 1 回 fetch して画像を取り込む。 Cloudflare の edge cache が 1 時間 hit すれば、 share がバズっても KV read はその間 1 回で済む。

---

## Part D — 同期スクロールの実装詳細

### D1. 単一 source of truth

`BoardRoot.tsx` に既に存在する scrollY 風の state (= 内部的に CardsLayer に `viewport.y` 等で渡してる値) を、 SenderShareModal にも同じ値で渡す。

具体的には:

- bg の CardsLayer は `viewport.y = scrollY` で描画 (= 既存挙動)
- ShareMirror も同じ `scrollY` を受け取り、 ミラー frame の中で `transform: translateY(-scrollY * scaleFactor)` でカードを動かす
- bg がスクロールする方法は **wheel / panY / dragY** の 3 経路すべて変わらず、 結果 scrollY が変わればミラーも追従

### D2. モーダル内 wheel event

モーダルの backdrop / panel / mirror すべての wheel event を:

```typescript
const onWheel = (e: React.WheelEvent): void => {
  e.preventDefault()
  // delegate to bg board's panY handler
  onPanY(e.deltaY)
}
```

`onPanY` は BoardRoot から prop で渡された関数で、 bg board の scrollY を変えるロジックそのもの (= 既存)。 つまり「ミラー上で wheel する」 と「bg で wheel する」 は同じ効果。

### D3. モーダル open 中の bg 操作禁止

bg board はモーダル open 中はクリック / ドラッグ等のインタラクションを禁止する (= モーダルが pointer event を full screen で catch する)。 ただし wheel は intercept して bg に流すので、 「user は wheel だけ自由に使える」 状態になる。

---

## Part E — エラーハンドリングと fallback

### E1. CORS 失敗時

サムネ画像が `crossOrigin='anonymous'` で fetch できない場合:

- Image.onerror に到達
- 当該カードは brand 塗り (= `#1a1a1c` 単色) + 中央にカード type アイコン (= URL kind 別: tweet / youtube 等) + title 文字 2 行で描画
- キャプチャ全体は完走

### E2. 描画 0 枚の場合 (= 全カード CORS 失敗)

- canvas に「N CARDS · ALLMARKS」 だけ表示された画像になる
- 失敗扱いはせず、 share 自体は成立する
- 「ベストエフォート」 仕様 — ユーザーには見えない裏側の挙動

### E3. canvas.toBlob 失敗

- catch して null 返す
- 呼び出し側 (SenderShareModal) は `{ kind: 'error', message: '...' }` 表示
- 「もう一度試す」 ボタンで再試行 (= 既存 UI)

### E4. KV 書き込み失敗

- 既存挙動と同じ (= [functions/api/share/create.ts](../../../functions/api/share/create.ts) の error 表示)

---

## Part F — テスト計画

### F1. unit test (= vitest)

- `lib/share/capture-mirror.ts`:
  - 正常系: 5 カード + ブランド帯 → WebP base64 が返る
  - CORS 失敗: 1 カード fail → fallback 塗り + 他カードは正常
  - 全 CORS 失敗: ブランド帯だけの画像が返る
  - canvas.toBlob fail → null 返す
- `ShareMirror.tsx`:
  - render: 渡された shareData の cards が DOM に出る
  - scrollY 変化で transform 更新
  - frame からはみ出るカードは clip される
- `functions/api/share/[id]/og.ts`:
  - 正常: KV → bytes → 200 + image/webp header
  - 不正 ID: 404
  - KV miss: 404
  - thumb 不正フォーマット: 500
  - Cache-Control header 確認

### F2. integration test (= 手動)

- 300 カードボードで SHARE → モーダル open → スムーズなスクロール
- メモリプロファイラで capture 中の peak < 10MB を確認
- iframe 自動再生が SHARE クリック時に発火しないことを耳で確認 (= session 85 のバグ再発防止)
- preview deploy で実 URL を X に貼って summary_large_image カードが出ることを確認

### F3. 既存テスト regression

- [functions/s/_handler.test.ts](../../../functions/s/_handler.test.ts), [functions/s/patch-share-html.test.ts](../../../functions/s/patch-share-html.test.ts) が壊れていないこと
- session 85 で ship した 882 テストが PASS のまま

---

## Part G — リスク / 未確定事項

### G1. ミラーのカード数

OG 1.91:1 frame に何枚映るかは scale factor 次第。 候補:

- 控えめ: 縮小率 0.2 (= 5× 縮小)、 frame 1200×630 / 0.2 = world 6000×3150 範囲 → 30〜60 カード可視
- バランス: 縮小率 0.3 (= 3.3× 縮小)、 world 4000×2100 → 15〜30 カード
- 写実重視: 縮小率 0.4 (= 2.5× 縮小)、 world 3000×1575 → 8〜15 カード

→ **暫定 0.3** で実装、 user に確認して微調整。 既存 [lib/board/skyline-layout](../../../lib/board/skyline-layout.ts) の `containerWidth` を frame 内寸に合わせれば自動 reflow。

### G2. ミラー frame の正確な size

OG 画像が 1200×630 で確定、 ただしモーダル内のミラー表示サイズは別の話 (= 表示用は viewport に依存)。

- モーダル中央に max-width 720px、 aspect-ratio 1.91/1 で配置
- 720 × (1/1.91) ≈ 377 px height
- これがミラーの **見た目** size、 内部の座標系は 1200×630 で記録 (= scale で繋ぐ)

### G3. 同期スクロールの bg → mirror 反映タイミング

scrollY が rapid に変わる (= wheel 連続) と、 ミラー再描画が間に合わず jank する懸念。

→ `requestAnimationFrame` で transform 更新を debounce / throttle、 60fps 維持を目標。 既存 board の bg レンダーが同じ調子で動いてるので、 同じパターンを使えば問題ない見込み。

### G4. capture 時間の体感

15 枚のサムネ画像を順次 fetch + draw すると ~500ms〜1500ms かかる可能性 (= ネット状況依存)。 user が SHARE 確定を押してからのこの待ち時間は session 85 の「⌗ preparing...」 と同じ loading 表現で吸収する。

### G5. iframe 排除の確認

[components/board/CardsLayer.tsx](../../../components/board/CardsLayer.tsx) を読んだが、 MOTION OFF 時に iframe が完全にゼロかは未検証。 ShareMirror 内部で iframe が child に含まれる可能性が残る場合、 ShareMirror 側で明示的に `iframe` element を排除 (= filter out) する。 実装フェーズで検証する。

---

## Part H — ロールアウト

### H1. ブランチ + commit 戦略

- branch: 直接 `master` (= [feedback_no_worktrees](memory)、 1 人開発 + 単一機能 branch)
- commit 単位: ShareMirror 新規 → capture-mirror 新規 → OG プロキシ新規 → SenderShareModal 改修 → snapshot.ts 削除 → BoardRoot 配線 → preview → 本番、 の順
- 各 commit で tsc + vitest が PASS していること

### H2. デプロイ

- preview deploy で動作確認
- 自分の X アカウントで実 URL 貼って summary_large_image 出ることを確認
- 本番デプロイ (= `pnpm build && wrangler pages deploy out/ --project-name=booklage --branch=master`)
- ハードリロードで実装版が見えることを確認

### H3. 引き継ぎ

- session 86 セッション終了時に CURRENT_GOAL.md / TODO_COMPLETED.md / TODO.md を更新
- 引き継ぎメッセージは次セッション用にコピペ可能な形で出す
