# 次セッションのゴール (= セッション 133)

## このセッション(132)で完了したこと — テーマシステム Plan 2 (paper-atelier 完全再現) 本番反映
- **paper-atelier を「核の見た目」から「完璧なフル再現」へ。`allmarks.app` にデプロイ済み**。
- 実装(サブエージェント駆動・各タスク spec+品質レビュー→修正→再レビュー→最終 opus 全ブランチレビュー=Ready to merge):
  1. ThemeMeta 契約拡張(scrollMeterVariant/motion/decorations)＋3テーマ充填
  2. 紙繊維テクスチャ背景(生成SVGタイル＋シミ＋インセット・ヴィネット)
  3. 定規/巻尺スクロールメーター変種(RulerTrack)＋メーター色トークン化
  4. カード装飾(マステ/画びょう/クリップ/フォトコーナー/スタンプ、card.id 決定論・pointer-events:none・FLIP非干渉)
  5. 署名アニメ#1: pinned-card drift(entry)＋paper-fade(shutdown)＋themeId 配線
  6. 署名アニメ#2: ink-underline(Lightbox翻訳トグル)＋soft photo shuffle＋背景パララックス(0.85x)
  7. chrome: 活版/かすれワードマーク＋MK-1プレート＋蝋封「A」＋装飾「+」(非機能スタンプ)
  8. 据え置きMinor: Lightbox淡色スクリム(paper)/picker role=group/優しいロックpill(15言語)＋e2e復活
- 検証: **tsc0 / vitest 1768 / build OK**。default(黒+音波)は **byte-identical を最終レビューで証明**。merge 79f0206 → push → 本番デプロイ。
- 正本: [plan2](superpowers/plans/2026-06-24-theme-system-paper-atelier-plan2.md) / [spec](superpowers/specs/2026-06-24-theme-system-paper-atelier-design.md)。

## ⏳ user 宿題(最優先) — paper の実機確認＋校正フィードバック
`allmarks.app` をハードリロード → SETTINGS → THEMES → **Paper Atelier** に切替えて実機で見て、**「ここをこうしたい」を言ってもらう**。色hex・紙のザラつき/シミ/ヴィネットの強さ・装飾(マステ/スタンプ)の密度や位置・定規メーターの目盛り・活版ワードマークのかすれ・MK-1/蝋封の見え方は**全部トークン/CSSで校正可能**(初期値で出してある)。フィードバックをもらって mock に寄せる。

## 次にやる(優先順)
1. **paper 校正** — user フィードバックを受けてトークン微調整(grain/vignette/decoration/色)を mock に寄せる。軽い反復。
2. **Plan 3 = 共有のテーマ化** — (A) 共有盤面に実 themeId を載せる(送信は今 DEFAULT 固定＝[BoardRoot.tsx](../components/board/BoardRoot.tsx) buildShareData)＋ SharedBoard 統一済の data-theme-id を活かす。(B) OGサムネ canvas([capture-mirror.ts](../lib/share/capture-mirror.ts))をテーマ対応(初版=署名再現)。**spec §6 が正本**。`writing-plans` で Plan 3。
3. **テーマ #1 white-sector → #5 celestial-atlas** を同じ器で量産(「7部品契約」を埋めるだけ)。
4. 軽いフォローアップ(下記)。

## このセッションで残したフォローアップ(非ブロッキング・TODO.md にも記載)
- **e2e シード版数ズレ(既存債務)**: `tests/e2e/board-b0.spec.ts` が IDB を v9 で開く→アプリ DB_VERSION=16 で VersionError → board-b0 全テストが実行不可。テーマ切替 e2e は**構造は正しく un-skip 済**、シードを現行スキーマに合わせれば動く。Plan 2 起因ではない。
- `useTweetTranslation` の引数名 `themeId` は実際は motion キー('ink-underline'等)を受ける→ `textTransitionKey` 等へリネーム(軽微)。
- perf watch: `tag-shutdown/themes/paper.module.css` の `filter: blur(1.5px)` と `.marker { will-change: left }`(4K で要観察、現状許容)。

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII) 必須。応答は日本語。UI変更は事前一言。
- **既知フレーキー**: `tests/lib/channel.test.ts`(full run でたまに落ちる→再実行 green)。
- ユーザーは視覚を**自分で直接確認**する方針(スクショ撮影に手を割かない・各段で止まらず作る)。[[feedback_user_self_verifies_visuals]]
