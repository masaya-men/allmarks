# 次セッションのゴール (= セッション 97)

## 今のゴール (1 行)

**session 96 で共有まわりを総点検し本番 ship: ①カード角丸を3面統一 ②OGP画像が出ない致命バグ(メタ /og.webp ↔ 実体 /og)修正 ③31枚共有の413をJPEG化+品質自動調整で解消 ④OG画像をKV→R2へ分離し100万人規模でもほぼ無料に。全て本番 e2e 実測 PASS。session 97 は user が次に挙げる改善から。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態」を読む
2. ドメインは催促しない (session 91 で棚上げ確定)
3. **まず user に「次にやりたい改善」を聞く**

## 🔴 session 96 の成果 (= user 本番確認は SNS のリンクプレビューで)

- **① 角丸統一**: プレビュー/OG画像/ボードを `var(--card-radius)` (20px) に統一。実機検証済。
- **② OGP致命バグ**: メタ参照先を実在する `/api/share/<id>/og` に修正。
- **③ 413 解消**: 画像を WebP→JPEG + 目標180KB に品質自動調整 ([capture-mirror.ts](../lib/share/capture-mirror.ts) `canvasToJpegUnderTarget`)。JPEG なので Discord/Slack でもサムネが出る。
- **④ R2 移行**: 画像を KV→R2 (`allmarks-share-og`) へ。egress無料+単価1/33で 100万人規模でもほぼ無料 (10万人まで完全無料)。30日 lifecycle で自動削除。旧共有は KV thumb 後方互換。
- **user 最終確認**: 実データ (31枚タグ) で共有成功するか + **SNS で新規共有のリンクを貼ってサムネが出るか** (旧リンクはSNS側キャッシュ古い可能性、新規で。X は Card Validator でキャッシュ更新可)。

## 「ドメイン以外は無料・プライバシー完璧」の現状整理 (= user の身上)
- 共有データ+画像は 30日で自動消滅 (KV TTL + R2 lifecycle)。一過性。
- コスト: 10万人まで完全無料。100万人で月¥3-5k (リクエスト課金中心、画像保管はほぼ¥0)。R2 課金は無料枠超過分のみ。
- 設計詳細・将来判断材料: [docs/private/2026-05-31-share-image-r2-plan.md]

## 別タスク (繰越、単独で)
- **ページ名の不一致整理**: ボタン「MANAGE TAGS」↔ URL/内部名 `/triage`。共有リンクに影響するので慎重に。
- **カードが左詰めされないことがある / スクロール中に入れ替わる** → §未対応バグ (skyline 再計算系、別 session)。

## 守ること
- 実機(Playwright/本番curl/e2e)で測ってから「動いてる」と報告。デプロイ前に `npx wrangler whoami`。
- 横文字を日本語応答に混ぜない。推奨を先に。AskUserQuestion ボックス禁止 (平文で1個ずつ)。
- 新機能は brainstorming で方針合意してから実装 (勝手に実装しない)。
- **可視性をアニメに依存させない** (memory `feedback_visibility_never_from_animation`)。
- git commit -m 本文にバッククォートを使わない。
