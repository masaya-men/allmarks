# 次セッションのゴール (= セッション 87) — シェアミラーの未解決問題を playwright で実機 verify してから直す

## 今のゴール (1 行)

**session 86 でシェア機能 (= ミラー / 同期スクロール / Canvas キャプチャ / OG プロキシ) は全部 ship したが、 ミラーの「表示範囲が bg と一致しない」 と「テキストカード空っぽ」 の 2 件が直っていない (= 2 回 fix 試行したが両方とも実機で効いてなかった、 unit test は通ってた)。 次セッションは playwright で実機検証してから直す。**

## 🔴 開始時に必ず守ること

**プロセス改善**: unit test 通っただけで「動いてる」 と user に言わない。 必ず以下の順:

1. unit test (= vitest) で論理を verify
2. **playwright で実 browser に load → スクショ → ピクセル位置/サイズを assertion で verify** ← これを抜かしてた
3. それでも user 検証が必要なら本番 deploy

session 86 の 2 fix は (1) で通って (2) を抜かして user に投げてしまい、 user 検証で両方 NG。 同じ轍を踏まない。

参考 memory: [feedback_verify_before_claiming](memory) 「CSS animation/hover 系は playwright getComputedStyle で実測してから『動いてる』 と報告」。 今回は CSS animation じゃないが、 **layout / 位置計算 / scale** も同じ。 「ピクセルが正しい位置にあるか」 は jsdom じゃ計測できない。

## 未解決問題 (= 次セッションの中核)

### 問題 1: ミラーが bg と同じ範囲を映してない

**症状**: user 報告 (= session 86 第 2 スクショ) で、 bg ボード上で見えてる 6 枚並びの最上段が、 ミラーでは 7 枚以上の異なる並び順に化けてる。 「ミラー = bg の縮小版」 になってない。

**試した fix (= 効かなかった)**:

- [a0bc84b](https://github.com/masaya-men/booklage/commit/a0bc84b) — ResizeObserver で scale 動的計算 + scroll math 修正 (= MIRROR_FRAME_HEIGHT 採用)
- [535783f](https://github.com/masaya-men/booklage/commit/535783f) — 独自 column-stack 撤去、 bg の layout.positions を直接受ける構造に refactor
- [85e01e9](https://github.com/masaya-men/booklage/commit/85e01e9) — `bgViewportWidth` を `viewport.w` から `effectiveLayoutWidth` に変更

3 つやって全部 NG。 つまり問題の根本原因がまだ特定できてない。

**未テスト仮説 (= 次セッションで playwright で実証から)**:

1. `effectiveLayoutWidth` も実は bg が使ってる値と違う可能性 (= `BOARD_INNER.SIDE_PADDING_PX` の値 / scroll bar 幅 / gutter 等で何 px かズレてる)
2. モーダル panel の CSS `width: min(720px, calc(100vw - 32px))` が user の viewport で 720 に効いてない可能性 (= スクショ見ると panel が画面の 90% 占めてる、 720 CSS px のはずなのに見た目変、 何かが override してる)
3. ShareMirror の `cardsLayer` inline style `width: bgViewportWidth, height: ...` が CSS の `inset: 0` と競合して想定外の reflow / overflow 挙動になってる可能性
4. ResizeObserver の callback が初回マウント時に発火タイミングが遅れて、 一瞬 default scale 0.5 で render → user スクショはその一瞬を捉えてる可能性 (= でも user は静止画なので可能性低い)
5. bg ボードが本当に位置を確定する transform が、 `cardsLayer` の上にもう 1 段あって、 私が見えてない wrapper が `translate(SIDE_PADDING, TOP_PAD)` してる可能性 → [components/board/CardsLayer.tsx](../components/board/CardsLayer.tsx) と BoardRoot の JSX を最初から playwright で「描画後の各カードの screen 座標」 を計測して確認

### 問題 2: テキストカードが空っぽ

**症状**: tweet など `thumbnailUrl` 無いカードがミラーで空の黒矩形 + 下端に小さい title だけ。

**試した fix (= 効かなかった)**:

- [85e01e9](https://github.com/masaya-men/booklage/commit/85e01e9) — `<div className={styles.cardTextBody}>` で title をカード全体表示 + capture-mirror に `drawWrappedText` 追加

user は実機で「直っていない」 と報告。 つまり:
- 上記の `cardTextBody` div が描画されてないか
- `thumbnailUrl` が null のはずなのに null じゃない値 (= 空文字、 undefined 文字列) で `<img>` 経路に入ってる可能性

**playwright で確認すべき**:
1. tweet card の `data-mirror-card-id` 要素を取得、 中の HTML を inspect (= `<img>` か `<div className=cardTextBody>` どちらが render されてるか)
2. `filteredItems[i].thumbnail` の実値を console.log で確認 (= null なのか空文字なのか URL なのか)
3. BoardRoot で `thumbnailUrl: it.thumbnail ?? null` の `it.thumbnail` の実値を確認 (= 別フィールド名の可能性)

## ship 済 (= 動いてる)

- POST /api/share/create + GET /api/share/:id (= URL 発行 + 取得、 session 85 から)
- GET /api/share/:id/og.webp (= OG プロキシ、 session 86)
- GET /s/:id + /s/:id/triage (= 受信ページ + triage、 Pages Function、 session 85)
- 404 音波テーマ (= session 85)
- summary_large_image カード生成 (= og:url で受信ページに飛ぶ)
- モーダル open + SHARE NOW + URL 表示 + COPY + POST TO X (= UI fundamentals 動いてる)
- 同期スクロール (= wheel が bg と mirror 両方に伝わる、 session 86 fix)

## 開始時の動き (= Claude の最初の発言)

1. **このファイル** + **[docs/TODO.md](./TODO.md) 「現在の状態」** を読む
2. **🔴 allmarks.app ドメイン取得確認** — 2026-05-28 朝以降の見込みだった、 user に状況聞く
3. **playwright を /board に対して走らせる** — 以下を実測:
   - bg の cards の screen 座標を全部取得 (= `el.getBoundingClientRect()`)
   - モーダル open → mirror frame の screen 座標 + size を取得
   - mirror の cards の screen 座標を全部取得
   - bg cards.x vs mirror cards.x の比率を実測 → scale が一致してるか
   - tweet card の HTML を outerHTML で取得 → `<img>` か `<div.cardTextBody>` か
4. 実測値ベースで原因特定 + fix 設計 (= 推測で書かない)
5. fix 後も同じ playwright で「以前と比較して 6 cards in row 1 になったか」 を assert (= 「動いた」 を主観で言わない)

## 重要ドキュメント (= session 87 で読む順)

1. このファイル
2. [docs/TODO.md](./TODO.md) 「現在の状態」
3. [docs/TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 86 セクション (= 詳細 narrative)
4. [docs/superpowers/specs/2026-05-27-share-mirror-capture-design.md](./superpowers/specs/2026-05-27-share-mirror-capture-design.md) — 元 spec
5. (= 実コード) `components/share/ShareMirror.tsx` + `components/share/SenderShareModal.tsx` + `components/board/BoardRoot.tsx` (= line 516-540 と 1744-1773)

## 守ること (= 反省 + memory 振り返り)

- **verify before claiming** ([feedback_verify_before_claiming](memory)) — unit test は logic 検証、 layout/位置検証は playwright 必須
- **「直りました」 と user に投げる前に自分でスクショを比較する** — 今回これを抜かして 2 回失敗
- **推測で fix dispatch しない** — 「仮説 1〜5」 を実コード読まずに dispatch すると今回みたいに空振りする。 まず playwright で実測 → 数値で根本原因確定 → ピンポイント fix
- **大変更前は brainstorming → spec → plan** ([feedback_consult_before_big_changes](memory)) — 今回は brainstorming 経由したが、 fix dispatch は推測ベースで brainstorming スキップしてた
- **平易な日本語** ([feedback_jargon_in_japanese](memory))
- **AskUserQuestion ボックス禁止** ([feedback_no_question_box_for_decisions](memory))
