# 次セッションのゴール (= セッション 119)

## 今のゴール (1 行)

**🎬 オンボーディングの仕上げ。残りは ⑧フィナーレ と ①入場の seed。シーン①〜⑦＋manage は本物UIで実演済。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態」を読む
2. `git status` クリーン確認（118末で全コミット+push+本番反映済）
3. 確認は **SETTINGS → REPLAY INTRO**（or シークレットウィンドウ）

## このセッション(118)で到達した形（本番反映済）
- 全シーンが「本物UIの実演」方向に。⑤拡張デモ/⑥ブックマークレットデモ=本物の保存窓、**⑦共有=本物の `SenderShareModal` を非対話で出す**、**manage（新）=実クリックで本物 `/triage` へ遷移→自動デモ＋連続パン演出→CONTINUEで共有シーンに再開**。デモのマウスポインターは矢印に統一。
- シーン順: ①入場→②貼る→③タグ→④MOTION→⑤拡張→⑥設置→**manage**→⑦共有→⑧フィナーレ（9＋manage）。

## 次にやる本命
1. **⑧フィナーレ**: 緑ディスクチェックの統一・空ボードへの綺麗な着地。今は cinema の締め。
2. **①入場（START＋言語）**: 言語切替の発見性（🌐＋言語名→「LANGUAGE」手がかり）、背景0.96幕越しのデモカード透け、SKIP の当たり判定拡大。

## 小残債・メモ
- **manage→triage 自動デモのタグ**: arm するのは tags[0]/tags[1]。本番フローでは③タグ scene の `sample` タグが在るので付与される（新規ユーザーは sample のみ＝1色）。リッチにしたいならデモ用タグを数個 seed する手も。
- **triage オンボ**: `?onboarding=1` で本物 triage を流用（[TriagePage.tsx](../components/triage/TriagePage.tsx) のオンボ分岐＝queue絞り/自動デモ/overlay）。MANAGE の routing と resume は [BoardRoot.tsx](../components/board/BoardRoot.tsx)（sessionStorage `allmarks-onboarding-resume` + `initialScene`）。
- デモseed画像が一部 headless で404（既存・本件と無関係）。本番では読める。

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII)必須。`tsc <file>` 直叩き禁止 → `rtk tsc`。
- 視覚は隔離レンダ＋ユーザー実機の二段。デザイン変更は提案→承認。応答は日本語。
- 大きめ改修(新component/100行+)は事前に方針確認。**常にクリーンなセーブ**(区切りで commit+push、git=本番一致)。
- 新オンボーディングseedは onboardingDemo フラグ管理（完了時に掃除、本物ブクマ不可侵）。LP見た目が大きく変わったら `node scripts/capture-lp-shot.mjs` で `lp-hero-shot.webp` を撮り直す（⑤⑥が使用）。
