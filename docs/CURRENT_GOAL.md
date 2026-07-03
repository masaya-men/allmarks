# 次セッションのゴール (= セッション 159)

## 今の状態（オンボ N-21 + N-22 出荷済／POP OUT は実機フィードバックで v2 に作り直し済／ユーザー実機目視のみ残）

**セッション158でやったこと：**

1. **N-21（SETTINGS 説明の埋もれ）＋ N-22（POP OUT 説明シーン）を出荷**（v1 merge `28931b9`）。
2. **ユーザー実機フィードバックで POP OUT を全面作り直し（v2）**（merge `ca81341`・`allmarks.app` 反映済）。v1 は①詰まり（NEXT 押せず盤面がクリックを奪う＝`.stage` の暗幕/`pointer-events:auto` 欠落）②品質低。v2＝拡張チュートリアルと同方式（偽ブラウザ＋実LPスクショ＋緑カーソルが `POP OUT` をクリック→相棒窓がポップアウト→カードが右からグライドイン＋常時メーター→「+ TAG」でタグチップ点灯）＋淡々コピー（タグ/ジャンプ追記）15言語。
3. 進め方＝サブエージェント駆動＋各レビュー＋opus 全ブランチレビュー（Ready to merge YES）。tsc0 / vitest1945 / build OK / default 盤面 byte-identical。

## 最初にやる（セッション159冒頭）＝オンボの実機目視

`allmarks.app` をハードリロード → オンボを頭から通し、以下を目視：

- ① **SETTINGS を説明する beat** で説明が**画面下中央**に出て、開いた SETTINGS ドロワーに重ならず読める（N-21）。
- ② **POP OUT シーンで暗幕が出て NEXT が押せる・盤面が固まる**（v1 の詰まりが解消しているか＝最重要）。
- ③ 緑カーソルが **POP OUT を押す → 小窓がポンと浮く → デモカードが右から1枚→2枚入る**、下メーター `00/00→01/01→02/02`。
- ④ カーソルが **「+ TAG」を押して、タグチップ（design）が緑に光る**。
- ⑤ キャプションが淡々コピー（他シーンと同じトーン）、NEXT で manage へ／SKIP／`prefers-reduced-motion` で静止（窓表示・カード中央・チップ点灯・メーター満）。
- ⑥ 通常盤面（オンボ外）が byte-identical。
- **もし POP OUT の見た目/動きにまだ不満があれば**、`components/onboarding/PopOutReenactment.tsx`/`.module.css` を調整（storyboard は spec に、値は `.module.css` にある）。

## その後の本命バックログ（順不同・相談して決める）

- **N-20（拡張クイックタグ上だけ2列）** — [floating-button.js:453](../extension/floating-button.js#L453) `tagstripSplit(tags, 2)`→`1` 等。直すと拡張の新バージョン再提出。`EXTENSION_STORE_URL` 投入と**同じ回にまとめる**のが得。
- **③ プレミアムテーマ制作**（Claude 推奨・1本目候補 Liquid Glass）。
- **④ K3 解錠実装**（計画完成済 `docs/private/2026-07-01-k3-unlock-plan.md`）。
- タグ付け強化。

## 守ること（毎回）

- default 盤面 byte-identical。web 変更時は deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。deploy `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`
- **機微情報は `docs/private/` のみ。tracked に書かない・commit しない**（CLAUDE.md 厳守）
- 既知フレーキー `tests/lib/channel.test.ts`（再実行で緑）。**vitest は dev サーバー並走禁止**
- **偽保存対策**：Write/Edit 後は独立 Read、commit/マージ後は**生 `git log --graph`** の実出力で確認（rtk git log はマージコミットを隠す）
- **オンボ再現シーンを足す/直すときは `.stage` の暗幕＋`pointer-events:auto` を必ず確認**（v1 詰まりの真因）。兄弟に合わせるならまず兄弟を全部読む
- アニメは GSAP（Framer Motion 禁止）。応答は日本語・簡潔に
