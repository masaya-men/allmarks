# 次セッションのゴール (= セッション 96)

## 今のゴール (1 行)

**session 95 で 3 件を本番 ship: ①TITLE(背景タイポ) の OFF 退場演出(カードと同一 CRT shutdown)、②マネージ画面のドラッグでタグ付け+タップで別タブ+文字くっきり、③YouTube サムネが Lightbox/マネージでロゴ化していた件の根本修正。user 全 OK。session 96 は新しい改善から（user が次に挙げるテーマ）。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態」を読む
2. ドメインは催促しない (session 91 で棚上げ確定)
3. **まず user に「次にやりたい改善」を聞く**（session 95 は全 OK で締めたので、新テーマ待ち）

## 🔴 session 95 の成果 (= user 本番確認は概ね OK、`booklage.pages.dev` ハードリロード)

- **① TITLE OFF 退場**: OFF = カードがフィルターで消えるのと同一 CRT shutdown、ON = ブートアップ。可視性は状態の純粋関数のまま (memory `feedback_visibility_never_from_animation`)、遅延 unmount(固定620msタイマー、アニメ完了非依存)。
- **② マネージ操作**: 画像をドラッグ→タグへ吸い込み付与 / タップ→別タブ / 本文は選択可能 / 文字くっきり(白+影) / ヒントに SPACE TO SKIP。判定は [lib/triage/drag-gesture.ts](../lib/triage/drag-gesture.ts)。
- **③ YouTube サムネ**: [deriveThumbnail](../lib/storage/use-board-data.ts#L73) が YouTube は動画ID本物サムネ(hqdefault)優先。既存ブクマもリロードで直る。

### 微調整余地 (user が気になれば)
- ② ドラッグの減衰量(`CARD_FOLLOW_DAMP=0.42`) / 吸い込み速度(`TOSS_MS=300`) / チップ発光の強さ([TagPicker.module.css](../components/triage/TagPicker.module.css) `.chipDropTarget`)。
- ① TITLE 退場の速さ・強さ(`lib/animation/tag-shutdown` の CSS 変数)。

## 別タスク (繰越、単独で)
- **共有 OG 画像の角丸**: ミラー preview は角丸あり、OG 画像 ([capture-mirror.ts](../lib/share/capture-mirror.ts)) の drawCards が fillRect で角丸無し。§未対応バグ参照。
- **ページ名の不一致整理**: ボタン「MANAGE TAGS」↔ URL/内部名 `/triage`。URL 変更は共有リンクに影響するので慎重に。
- **カードが左詰めされないことがある** → §未対応バグ (skyline 再計算系、別 session で腰を据えて)。

## 守ること
- 実機(Playwright)で測ってから「動いてる」と報告。デプロイ前に `npx wrangler whoami`。
- 横文字を日本語応答に混ぜない。推奨を先に。AskUserQuestion ボックス禁止 (平文で1個ずつ)。
- 新機能は brainstorming で方針合意してから実装 (勝手に実装しない)。
- **可視性をアニメに依存させない** (memory `feedback_visibility_never_from_animation`)。
- git commit -m 本文にバッククォートを使わない。
