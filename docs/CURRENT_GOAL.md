# 次セッションのゴール (= セッション 86) — シェアの「サムネ + モーダル UX」 再設計

## 今のゴール (1 行)

**session 85 でシェア機能の本番 ship 完了 (= URL 生成 / 受信ページ / インタラクティブ 404 全部動く)、 ただしサムネが AllMarks ロゴだけのプレースホルダ + モーダル UI が薄い状態。 次セッションで業界標準 (= サーバーサイド OG 生成 + 縮小ミラー preview) に作り直し。**

## 開始時の動き (= Claude の最初の発言)

1. **このファイル** ([docs/CURRENT_GOAL.md](./CURRENT_GOAL.md))、 **[docs/TODO.md](./TODO.md) 「現在の状態」** を読む
2. **本番 (booklage.pages.dev) 確認** — 共有作成 + 受信 + 404 は動く、 サムネはロゴ placeholder
3. **🔴 allmarks.app ドメイン取得確認** — 月末 (今日以降) 予定だった、 取得済か聞く
4. シェア再設計の brainstorming + 着手

## session 85 で何が ship されたか

### 動いている (= 本番反映済)
- **POST /api/share/create** — 共有 ID 発行 + KV 保存
- **GET /s/<id>** — Cloudflare Pages Function が Next.js `/s.html` を取って OG メタタグだけ per-id に書き換えて返す (= hydration 維持)
- **GET /s/<id>/triage** — 同上 + triage 用 og:url
- **インタラクティブ 404** — 音波テーマ、 マウス近接で振動、 緑グロウ脈打つ。 テーマ複数化対応の registry あり (= wave 1 つだけ登録、 追加すれば自動的に 404 でランダム選択)
- **ReceiverLanding / ReceiverTriage** — URL パスから ID 抽出する形に refactor 済
- **重要バグ 3 件 fix** — ① encode/decode の ReadableStream constructor (= Workers 互換性問題)、 ② dom-to-image-more の iframe 自動再生 (= SHARE 押すと音楽鳴る)、 ③ 300 カードでメモリ 5GB 爆発

### **未達 (= 次セッションの中核)**: サムネ + モーダル UX の本格再設計

session 85 で 4 回サムネ実装を試行 (= dom-to-image-more / viewport filter / wireframe blocks / placeholder) どれもダメで、 user から「絶対にユーザー個人のボードが映らないとダメ」 と却下。 user 提案 (= 業界標準と一致):

> モーダル内に board の縮小ミラーが live で映る。 モーダル外でスクロールすると bg ボードと一緒にミラーも動く。 スクロールを止めた瞬間がサムネに乗る。 URL 生成は裏で並行。

これに加えて user 不満点:
- 「100 OF 300」 等の総数 / 共有数の関係が不明 (= 「100 CARDS」 だけだと意味不明)
- 共有範囲 (= 何の 100 枚?) の説明なし

## 次セッション (= 86) の作業項目

### 1. **OG サムネはサーバーサイド動的生成に切替** (業界標準)
- 現状: client で base64 サムネを送って KV に保存、 `og.ts` がそれを返す
- 目標: client は **メタデータ (= カードの URL / サムネ URL / 配置 / タグ) だけ** 送る、 `og.ts` がリクエスト時に [workers-og](https://workers-og.pages.dev/) (= Satori + Resvg、 Cloudflare Workers 公式互換) で JSX → PNG 動的レンダリング
- 利点: メモリ爆発しない、 一貫したブランド表現、 KV 容量大幅減 (= 30KB サムネ削除)、 X クローラに常に新鮮 OG

### 2. **モーダル内 live ミラー** (user 発案、 業界標準)
- 背景の本物ボードを CSS `transform: scale(0.25)` で縮小して clone 表示
- DOM clone でなく live mirror (= 軽量、 メモリ問題なし、 cross-origin 画像も普通に表示)
- 検討: clone vs `position: fixed; transform-origin` で同じ DOM を 2 箇所に映す方法

### 3. **bg スクロール同期**
- モーダル open 中、 モーダル背景の wheel event を bg board にバイパス
- bg + mini が同じ scroll Y で動く
- user が好きな絵を選んで止められる
- 「スクロールが効いて画面ぐるぐる」 の AllMarks 的 polish

### 4. **モーダル UX の言語化**
- 「100 OF 300 CARDS · NEWEST FIRST」 のような明示 (= session 85 で暫定追加済、 本実装でも維持)
- 「タグで絞ってから共有すると範囲を選べます」 的 hint
- 「30 日間有効」 の expiry 表示

### 5. **本実装後の placeholder 撤去**
- `lib/share/snapshot.ts` の AllMarks 暫定ロゴ生成は段階的に撤去
- client から send する base64 サムネ自体不要に (= server-side 生成に移行)

## session 85 の総括 (= TODO_COMPLETED に詳細)

- 21 commits + 6 本番デプロイ (= ship 4 + fix 3 = 7 deploy)
- テスト 880 → 882 (= 拡張部 + UX 改善で +)
- 中で踏んだ落とし穴: edge runtime + 静的 export 衝突、 ReadableStream 互換性、 iframe 自動再生、 dom-to-image メモリ爆発
- pivot ポイント: 「自前 HTML 生成」 → 「Next.js 出力を patch」 に途中で切替 (= hydration 整合のため)

## 守ること (= user memory + session 85 学習 参照)

- **私から流されない**: user は「ベストプラクティス / 業界水準を調査して」 と明示。 dom-to-image-more みたいな半端なライブラリでなく、 workers-og / Satori 等の業界主流を採用する
- **「100 of N」 のような UI 数値は user-friendly に**: 内部 ID や jargon 使わず、 自然な英文
- **大変更前は方針確認** ([feedback_consult_before_big_changes](memory))
- **平易な日本語、 横文字カタカナ控えめ** ([feedback_jargon_in_japanese](memory))
- **verify before claiming it works** ([feedback_verify_before_claiming](memory))
- **AskUserQuestion ボックス禁止** ([feedback_no_question_box_for_decisions](memory))

## 重要ドキュメント (= session 86 で読む順)

1. このファイル ([docs/CURRENT_GOAL.md](./CURRENT_GOAL.md))
2. [docs/TODO.md](./TODO.md) 「現在の状態」 セクション
3. [docs/TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 85 セクション (= 詳細 narrative)
4. workers-og 公式 (= https://workers-og.pages.dev/) — 採用ライブラリ
5. (= 必要時) [docs/superpowers/specs/2026-05-28-share-pages-function-design.md](./superpowers/specs/2026-05-28-share-pages-function-design.md) — session 85 で実装した Pages Function 設計
