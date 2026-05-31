# 次セッションのゴール (= セッション 97)

## 今のゴール (1 行)

**session 96 で共有まわり 2 件を本番 ship: ①共有カードの角丸をボード・プレビュー・OG画像の3面で統一(20px)、②OGP画像が出ない致命バグ(メタが /og.webp を指すが配信は /og にしかない)を本番実測で特定し修正(共有作成→画像配信まで一気通貫で PASS)。session 97 は user が次に挙げる改善から。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態」を読む
2. ドメインは催促しない (session 91 で棚上げ確定)
3. **まず user に「次にやりたい改善」を聞く**

## 🔴 session 96 の成果 (= user 本番確認は SNS のリンクプレビューで)

- **① 角丸統一**: プレビュー `.card` を直書き 3px → `var(--card-radius)` (20px)。OG画像 ([capture-mirror.ts](../lib/share/capture-mirror.ts)) も角丸クリップ + 半径をカード幅比で算出(縮小率非依存)。実機 Chromium ピクセル検証済。
- **② OGP画像修正**: メタの参照先を `/api/share/<id>/og.webp` → 実在する `/og` に。本番で共有作成→og:image→画像配信(200/image/webp) まで実測 PASS。**SNS で実際にリンクを貼ってサムネが出るか最終確認してほしい**(キャッシュで古い結果が残る場合あり、新規共有で確認推奨)。

## 別タスク (繰越、単独で)
- **ページ名の不一致整理**: ボタン「MANAGE TAGS」↔ URL/内部名 `/triage`。URL 変更は共有リンクに影響するので慎重に。
- **カードが左詰めされないことがある** → §未対応バグ (skyline 再計算系、別 session で腰を据えて)。
- **スクロール中にカードの場所が入れ替わる** → §未対応バグ (同じ skyline 系の疑い)。

## 守ること
- 実機(Playwright/本番curl)で測ってから「動いてる」と報告。デプロイ前に `npx wrangler whoami`。
- 横文字を日本語応答に混ぜない。推奨を先に。AskUserQuestion ボックス禁止 (平文で1個ずつ)。
- 新機能は brainstorming で方針合意してから実装 (勝手に実装しない)。
- **可視性をアニメに依存させない** (memory `feedback_visibility_never_from_animation`)。
- git commit -m 本文にバッククォートを使わない。
