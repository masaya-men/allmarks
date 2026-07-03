# 次セッションのゴール (= セッション 159)

## 今の状態（オンボ改善 N-21+N-22 出荷済／ユーザー実機目視のみ残）

**セッション158でやったこと：**

1. **オンボ改善 N-21+N-22 を出荷**（merge `28931b9`・`--no-ff`・tsc0 / **vitest1945** / build OK・`allmarks.app` 反映済・default 盤面 byte-identical）。サブエージェント駆動6タスク＋各タスクレビュー＋**opus 全ブランチレビュー（Ready to merge YES・Critical/Important ゼロ）**。
   - **N-21**＝`settings` beat に `captionAtBottom`（SETTINGS 説明が下中央固定・ドロワーに埋もれない）。
   - **N-22**＝desktop 専用 `popout` cinema シーン＋新 `PopOutReenactment`（GSAP・純視覚再現＝実 PiP 非結合）：カードが**右からグライドイン→中央着地**（`power4.out`/0.7s）＋**常時メーター** `00/00→01/01→02/02`。15言語コピー。
2. レビューで回帰1件捕捉・修正（popout 挿入で manage walk テストが off-by-one＝test-only +1 NEXT）／spec 準拠仕上げ（メーター常時表示化 `dc04767`）。

## 最初にやる（セッション159冒頭）＝オンボの実機目視

`allmarks.app` をハードリロード → オンボを頭から通し、以下を目視：
- ① **SETTINGS を説明する beat** で説明が**画面下中央**に出て、開いた SETTINGS ドロワーに重ならず読める（N-21）。
- ② `install`（ブックマークレット）の**次に POP OUT シーン**が出る（N-22）。
- ③ POP OUT で**カードが右からスッと入って中央に着地**し、下のメーターが `00/00→01/01→02/02` と進む（「上から落ちる」ではない）。
- ④ NEXT で manage に進む／SKIP で離脱できる／`prefers-reduced-motion` で動きが静止する。
- ⑤ 通常盤面（オンボ外）が byte-identical（回帰なし）。
- **メーター空窓の `00/00` が気になる場合**は1行で hidden-when-empty に戻せる（[PopOutReenactment.tsx](../components/onboarding/PopOutReenactment.tsx) の meter div に `{count > 0 && ...}` ガードを戻すだけ）。ユーザー判断。

## その後の本命バックログ（順不同・相談して決める）

- **N-20（拡張クイックタグ上だけ2列）** — [floating-button.js:453](../extension/floating-button.js#L453) `tagstripSplit(tags, 2)`→`1` 等。直すと拡張の新バージョン再提出。`EXTENSION_STORE_URL` 投入と**同じ回にまとめる**のが得。
- **③ プレミアムテーマ制作**（Claude 推奨・売り物＋告知の引き金・1本目候補 Liquid Glass）。
- **④ K3 解錠実装**（計画完成済 `docs/private/2026-07-01-k3-unlock-plan.md`）。
- タグ付け強化。

## 守ること（毎回）

- default 盤面 byte-identical。web 変更時は deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。deploy `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`
- **機微情報は `docs/private/` のみ。tracked に書かない・commit しない**（CLAUDE.md 厳守）
- 既知フレーキー `tests/lib/channel.test.ts`（再実行で緑）。**vitest は dev サーバー並走禁止**
- **偽保存対策**：Write/Edit 後は独立 Read、commit/マージ後は**生 `git log --graph`** の実出力で確認（rtk git log はマージコミットを隠す）
- アニメは GSAP（Framer Motion 禁止）。応答は日本語・簡潔に
