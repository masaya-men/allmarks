# 次セッションのゴール (= セッション 97)

## 今のゴール (1 行)

**session 96 で共有まわりを総点検し本番 ship (角丸統一/OGP致命バグ/413/R2移行)。session 97 は user 要望の 2 件から: ①受け取り画面をマネージ画面と同じ UI に (要 brainstorming) ②フィルターのタグ1つでもフェードがかかる件 (要 実機計測)。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態」+ §共有(share) 着手候補 を読む
2. ドメインは催促しない (session 91 で棚上げ確定)
3. **着手前に user に「①②どちらから / 他に優先したいこと」を確認**

## 🔴 session 97 の最優先 2 件 (= session 96 で user が挙げた)

### ① 受け取り画面 (/s/<id>/triage) をマネージ画面と同じ UI に
- 現状 [ReceiverTriage.tsx] はマネージ [TriagePage.tsx]/[TriageCard.tsx] を**全く再利用していない別物**。
- user 希望: 「マネージと同じ UI、文言だけ共有用に変更」。UX 一貫性のため価値あり。
- ただし目的差 (整理 vs 取り込み+送り主タグ提案+重複検出) があり、共通部品化 + 取り込み固有差し込みの設計が要る大改修。
- **brainstorming skill で方針合意してから実装** (勝手にやらない)。session 95 の画像ドラッグ付与/ガラス演出を受け取りにも入れるか含め相談。

### ② フィルターのタグ1つでもフェードがかかり視認性低下
- コードは overflow 時のみ mask のはず ([FilterPill.module.css:228] `data-scroll-edge !== 'none'`、[FilterPill.tsx:120] `updateTagScroll`)。1 タグでフェードが出るのは理屈と矛盾。
- **実機(Playwright)で 1 タグ状態を計測 → 真因特定してから直す** (憶測禁止)。`.menu` 等別要素のフェード混入 / `data-scroll-edge` 初期値・measure タイミングを疑う。

## 🔴 session 96 で未確認 (= user 目視確認をお願い)
- **SNS で新規共有リンクを貼ってサムネ(JPEG)が実際に出るか** — コード+本番API実測では出る状態だが SNS 目視は未確認。旧リンクは SNS キャッシュ古い可能性、必ず新規リンクで。X は Card Validator でキャッシュ更新可。

## session 96 の成果 (= 本番反映済、詳細は TODO.md「現在の状態」)
①カード角丸3面統一 ②OGP画像が出ない致命バグ(メタ /og.webp ↔ 実体 /og)修正 ③31枚共有の413をJPEG化+品質自動調整で解消 ④OG画像をKV→R2へ分離(100万人規模でもほぼ無料、10万人まで完全無料、30日自動削除)。全て本番 e2e PASS。設計 [docs/private/2026-05-31-share-image-r2-plan.md]、memory `project_share_r2_storage` / `reference_og_image_route_no_extension`。

## 守ること
- 実機(Playwright/本番curl/e2e)で測ってから「動いてる」と報告。デプロイ前に `npx wrangler whoami`。
- 横文字を日本語応答に混ぜない。推奨を先に。AskUserQuestion ボックス禁止 (平文で1個ずつ)。
- 新機能・大改修は brainstorming で方針合意してから (勝手に実装しない)。
- **可視性をアニメに依存させない** (memory `feedback_visibility_never_from_animation`)。
- git commit -m 本文にバッククォートを使わない。
