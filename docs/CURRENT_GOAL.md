# 次セッションのゴール — 言語の仕上げ（束C）を始める → 残タスクもいくつか

## ★ユーザー確定（s195 末・2026-07-13）
- **規約の正文＝日本語で確定**（束C の正文条項に使う・差し替え不要）。
- 次セッションは **①まず束C（言語の仕上げ）を始める → ②残タスクもいくつか進める**、とユーザー指示。
- N-53（e2e 修理）＋N-54（盤面グリッド交点バグ）は完了・本番反映済（`allmarks.app`）。N-54 実機OK。スマホのアレンジ作り直しは後回し（要件は `docs/private/IDEAS.md`）。

## ★次セッション最優先＝束C（多言語仕上げ＋規約正文条項）を開始

正本: `docs/private/2026-07-08-release-runway-plan.md` §束C。**このセッションではまず C0＋C1 まで**（言語バッチ C2 は次以降）:

- **C0 守りを先に足す（小）**: ①`messages/` に placeholder パリティテスト追加（各 locale の値の `{…}` トークン集合が en と一致するか全キー検査）②`bookmarklet.*` 3キーの消費箇所を grep（未使用ならレビュー対象外とメモ）③`lib/i18n/lp-metadata.ts:12` の `ar_AR`→`ar_SA` 修正。
- **C1 正文条項（正文＝日本語で確定済み）**: `TermsContent.tsx` の SECTIONS に1節（id 例 `language`）＋全15 JSON に `pages.terms.languageHeading/language` 追加（parity テストが守る）。文言＝「**本規約の正文は日本語版。他言語は参考訳であり、齟齬がある場合は日本語版が優先**」。**en/ja はこのセッションで確定訳**、他13言語は C2 の各バッチで。
- **C2（次セッション以降・4バッチ）**: zh/ko → es/fr/pt/it → de/nl/tr/ru → ar/th/vi。1言語＝法務98キー→アプリUI165キー→集客140キーの順で全キー照合。**翻訳レビューは Sonnet 以上（Haiku 不可）**。不変則: placeholder `{…}` 一字一句保持／機能名（AllMarks/SHARE/TUNE/SETTINGS 等）と "Open Board" は訳さない／文体は乾いた事実調。

進め方＝subagent-driven（各タスクレビュー＋opus 全ブランチ）。既存の守り: `messages/all-keys-parity.test.ts` 等 vitest 6本。

## ★「残タスクもいくつか」＝ユーザーが選ぶ（束C の合間 or 後）
公開前で束C 以外に残るもの（冒頭で「束C の後にどれ？」を軽く確認）:
- **TOWER**（公開前の無料看板テーマ・WebGL・ユーザー確定）`plans/2026-07-12-shader-theme-b-tower.md`
- 小物: スマホ盤面に背景タイトル（N-51残）／タブレットの作法（N-50）
- （希望あれば前倒し可）白フラット default テーマ（フラット化サブ②・現状は公開後枠）

参考: 残タスク全体は `docs/superpowers/plans/2026-07-11-s186-remaining-work-roadmap.md`。フラット化サブ①（メニュー中立化）は s163 完了済。

## 恒久ルール（継承）
- 束C の翻訳は Sonnet 以上（言語の自然さ判定が本体）。placeholder `{…}` 保持・機能名は訳さない（parity テストが落ちる）・法務節は直訳寄り。
- 機微（支援・値付け・戦略）は tracked に書かない＝`docs/private/`。規約の正文＝日本語（法的リスクをこの条項で束ねる）。
- `rtk` 前置・`--no-verify` 禁止／vitest・playwright は素の `npx`／盤面を変えたら受け取り画面も確認／デスクトップ 1px 原則不変。
- 新しい見た目・操作系・大改修は着手前に superpowers:brainstorming。
