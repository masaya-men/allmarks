# 2026-05-20 — X 画像 + 本文ツイートの Lightbox split 表示復活 (= A 番)

> session 55、 backlog 「A 番 X 長文 tweet + 画像 で画像のみ表示 → split layout (= 画像左 / 文字右)」 の design spec。

---

## 1. 背景 (= bug 説明)

X の **画像 + 本文ツイート** を AllMarks で Lightbox 開いて拡大した時、 右カラムに **本文が出ない**。 著者名 + ハンドル + 「Open source ←」 リンクだけ出て、 ツイート本体テキストが行方不明になる。

### root cause

Lightbox の右カラム (= [`.text` カラム](../../../components/board/Lightbox.module.css)、 320px 固定 + scroll + hairline scrollbar 完備) は **元々画像左 / テキスト右の 2 カラム構造として設計済み**。 [`TweetText`](../../../components/board/Lightbox.tsx) component が author block + body `<p>` + source CTA の 3 段を縦並びで render するように既に書かれている。

ただし session 52 (= [B-#22 follow-up redesign の長文 tweet Lightbox 末尾だけ表示 bug fix](../../TODO_COMPLETED.md))、 全 tweet で `<p className={styles.tweetBody}>` を非表示にする判断:

```ts
// 現状 (= session 52 で変更後)
function shouldHideTweetBody(_meta, _slots): boolean {
  return true
}
```

意図は「text-only tweet なら body は左 LargeTextCardScaler、 media tweet では右 body は不要 → 完全廃止」 だったが、 結果として **画像 + 本文ツイート** の本文表示まで道連れで消えた。 user が見ている「画像のみ表示」 はこの右本文非表示の副作用。

---

## 2. 修正方針 (= 最小修正、 新規 component 一切なし)

`shouldHideTweetBody()` を **本文ありの media tweet では false 返す** ように書き換える。 既存の 2 カラム構造 + `.tweetBody` CSS + `TweetText` component は **そのまま流用**。

### 新ロジック

```ts
function shouldHideTweetBody(meta: TweetMeta | null, slots: readonly MediaSlot[]): boolean {
  // text-only tweet: 本文は左の LargeTextCardScaler が描画済 → 右本文は重複なので非表示維持
  if (isTweetTextOnly(meta, slots)) return true
  // media tweet で meta 未到着: 本文 fallback の item.title は OGP boilerplate を含む生文字列。
  // 著者情報 fetch 完了まで body は隠す (= 「Xユーザーの〜 さん:「本文」 / X」 が一瞬出るのを防ぐ)
  if (!meta) return true
  // media tweet で本文空 (= 画像のみツイート / 動画のみツイート): 空 <p> を出さない
  const text = (meta.text ?? '').trim()
  if (text === '') return true
  // それ以外 (= media + 本文あり) → 右カラムに本文表示
  return false
}
```

### 振る舞い表

| ツイート種別 | meta state | shouldHideTweetBody | 右カラム表示 |
|---|---|---|---|
| 文字のみツイート | any | **true** (現状維持) | 著者 + Open source ←、 本文は左 LargeTextCardScaler |
| 画像 + 本文ツイート | meta 未到着 | true (一瞬) | 著者 + Open source ← のみ |
| 画像 + 本文ツイート | meta 到着済 | **false (新規)** | 著者 + **本文** + Open source ← |
| 動画 + 本文ツイート | meta 到着済 | **false (新規)** | 著者 + **本文** + Open source ← |
| 画像のみツイート (本文空) | meta 到着済 | true (現状維持) | 著者 + Open source ← のみ |
| 動画のみツイート (本文空) | meta 到着済 | true (現状維持) | 著者 + Open source ← のみ |

---

## 3. scope — 触る / 触らないリスト

### ✏️ 触るファイル (= 1 ファイル、 1 関数)

- [`components/board/Lightbox.tsx`](../../../components/board/Lightbox.tsx) の `shouldHideTweetBody` 関数 (= 3 行 → 約 10 行) + 周辺コメント (= session 52 の意図記録を新しい振る舞いに沿って書き換え)

### 🚫 触らないファイル (= 1 mm も手をつけない)

- **board 系**: [`TextCard.tsx`](../../../components/board/cards/TextCard.tsx) / [`ImageCard.tsx`](../../../components/board/cards/ImageCard.tsx) / [`MinimalCard.tsx`](../../../components/board/cards/MinimalCard.tsx) / [`VideoThumbCard.tsx`](../../../components/board/cards/VideoThumbCard.tsx) / [`cards/index.ts`](../../../components/board/cards/index.ts) (= `pickCard` ルーティング)
- **Lightbox 内**: `TweetMedia` (= 左カラムの画像/動画/text-only 振り分け)、 `LightboxMedia` (= YouTube/TikTok/Vimeo 等 embed 振り分け)、 `TweetText` (= 右カラム author/body/CTA、 既存実装をそのまま流用)、 `isTweetTextOnly` 判定、 FLIP open/close アニメ、 navigation、 wheel scroll-chaining
- **CSS**: [`Lightbox.module.css`](../../../components/board/Lightbox.module.css) の `.text` / `.tweetBody` / `.tweetAuthor` etc. (= 既に必要な scroll / scrollbar / typography 揃っている)
- **その他**: board 描画、 PiP、 拡張機能、 storage、 share view

---

## 4. テスト方針

### unit test (= 任意)

`shouldHideTweetBody()` は Lightbox.tsx 内のローカル関数。 export してまで unit test を書くか、 統合テストで済ますか:

- **採用**: 関数本体は短くロジックも明快なので **inline 維持 + manual verify で十分**。 export して [tests/board/](../../../tests/board/) に test 追加もしないが、 もし将来 regression が起きるならその時に extract する
- **代替案 (= 採用しない)**: `lib/embed/should-hide-tweet-body.ts` に切り出して unit test 書く → over-engineering、 1 関数のためにファイル分けるのは過剰

### manual verify (= deploy 後 user に確認してもらう sheet)

| # | ツイート種別 | 期待動作 |
|---|---|---|
| 1 | 文字のみツイート (短文) | Lightbox 開く → 左に大きいテキストカード、 右に著者 + Open source ←、 本文は **左にのみ表示** (regression なし) |
| 2 | 文字のみツイート (長文) | 同上、 左テキストカードに scroll + 底フェード (regression なし) |
| 3 | **画像 + 短文ツイート** | Lightbox 開く → 左に画像、 右に **著者 + 本文 + Open source ←** (= 新規) |
| 4 | **画像 + 長文ツイート** | Lightbox 開く → 左に画像、 右に **著者 + 本文 (= scroll 可) + Open source ←** (= 新規) |
| 5 | 画像のみツイート (本文空) | Lightbox 開く → 左に画像、 右に **著者 + Open source ← のみ** (= 空 `<p>` 出ない、 regression なし) |
| 6 | 動画 + 本文ツイート | Lightbox 開く → 左に動画 player、 右に著者 + 本文 + Open source ← (= 新規、 副次効果) |
| 7 | 動画のみツイート | 左に動画 player、 右に著者 + Open source ← のみ (regression なし) |
| 8 | 複数画像 + 本文ツイート | 左で画像 swap (dots indicator)、 右に本文表示 (= 新規) |

特に重要な regression チェック:
- **(1)(2)**: text-only tweet で右カラムに本文の二重表示が起きてないこと
- **(5)(7)**: 本文ゼロのメディアツイートで右カラムに空 `<p>` が出てないこと
- **board 表示**: card grid 上で何も変化していないこと (= 修正対象は Lightbox のみ)

---

## 5. リスク評価

### 想定されるリスク

1. **text-only tweet で本文重複表示**: `isTweetTextOnly()` 判定が壊れていたら、 左 LargeTextCardScaler + 右 `<p>` の二重表示になる
   - 緩和策: `isTweetTextOnly` は session 32 から実戦使用、 [Lightbox.tsx:1595](../../../components/board/Lightbox.tsx) で `slots/hasPhoto/hasVideo` の 3 段判定。 既存ロジック流用なので破壊リスク極小
2. **画像のみツイートで右カラムに空 `<p>` 表示**: meta.text が空文字列なのに hideBody=false 返したら起きる
   - 緩和策: `(meta.text ?? '').trim() === ''` で空白も含めて弾く
3. **meta 未到着 race**: Lightbox open 直後、 meta fetch 中の数百 ms 間に本文 fallback の item.title (= OGP boilerplate 含む生文字列) が出る
   - 緩和策: `if (!meta) return true` で meta 到着まで隠す。 著者情報も meta 到着まで非表示なので動線として自然
4. **空 author block + 空 body の組み合わせで右カラムが完全に空**: 著者 fetch も本文も空ケース
   - 既存動作と同じ (= source link は常に出る)、 regression なし

### 想定されないリスク (= 触らないから起きない)

- board 描画の変更 (= 何も触らない)
- TextCard / ImageCard / MinimalCard / VideoThumbCard の挙動変更
- Lightbox の他カード型 (= YouTube / TikTok / 一般 web) 描画の変更
- FLIP open/close アニメ、 wheel scroll、 PiP

---

## 6. 実装後の deploy + 確認フロー

1. 修正 (= shouldHideTweetBody 1 関数 + 周辺コメント) を commit
2. `pnpm build` + `tsc` + `vitest run` 確認
3. `wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true` で本番反映
4. user に「booklage.pages.dev をハードリロードして、 §4 manual verify 表の 8 ケース確認してね」 と案内
5. 全部 OK なら session close

---

## 7. 非対象 (= この spec の外、 別 task)

- **長文本文の typography polish** (= 右カラム本文の font-size 微調整、 行間、 fade band 等): 必要なら session 後の polish sprint で。 現状は session 32 時点の `.tweetBody` style (= 16px / 1.65 line-height / pre-wrap) をそのまま流用
- **本文内 URL 自動リンク化**: 別 enhancement、 今は plain text 表示
- **画像 + 本文ツイート専用の card 比率**: board 側で「画像 + 長文 → 縦長 1:3」 みたいな旧 spec ([2026-04-20-board-content-sized-reorder-design.md](./2026-04-20-board-content-sized-reorder-design.md)) はあるが、 今回の修正は Lightbox 内のみで board は触らない。 board の card 比率変更は別 task
