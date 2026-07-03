# 次セッションのゴール (= セッション 156)

## 今の状態（N-05 LP ナビ格納演出＝出荷済み・本番反映済み）

**セッション155でやったこと：**

- **発覚**: session 154 の「実装済み（branch `feat/lp-nav-dock` / commit `88178ff`）」は**ツール偽保存で実在しなかった**（実装・commit ともディスクに届いていなかった。残っていたのは spec と TODO 追記のみ。spec の「実コード確認」節も偽読み混入 → plan 冒頭の訂正対照表が正）。
- **N-05 を設計書から作り直して完遂**（master `b0d81a6`・`allmarks.app` 反映済み・本番実測 PASS）:
  - 判定は最初から**範囲＋ラッチ式**（`nav-dock-math.ts`+14テスト）＝Lenis 慣性で飛んでもすり抜けない（前回懸案を根治・大ホイール実測で証明）。
  - 演出オフ: reduced-motion（**ユーザー確定: OS設定尊重で全オフ**）／≤960px／kicker≠ナビ語（en/ja のみ有効、他13言語はローカライズ済みで自動オフ）。
  - dev 検証シート 9/9 PASS ＋ 本番で docked ずれ 0px・可逆・トップLP非接触を実測。

## 次にやる（セッション156）

1. **ユーザー実機で N-05 を目視**: `allmarks.app/features` 等をハードリロード→ゆっくり下スクロール（kicker が帯に乗る→ダッシュ→着地）→上スクロールで戻る。
2. 好みチューニング（任意）: バウンド強さ/ダッシュ速度＝`lib/scroll/nav-dock-math.ts` の `NAV_DOCK`（zipMs 等）と `NavDockTraveler.tsx` の easing、モーフ値＝`NavDockTraveler.module.css` の `--mp` 補間。
3. その後 本命バックログ相談: ③プレミアムテーマ制作／④K3 解錠実装（`docs/private/2026-07-01-k3-unlock-plan.md`）／選択的シェア／タグ付け強化。

## 検討メモ（未決・急がない）

- 13言語で演出が出ない件: kicker を全言語英語に統一すれば全言語で発動する（UI語彙は globally-clear English 方針とも整合）。ただし見た目が変わる13ファイル編集なので**ユーザー相談してから**。

## 守ること（毎回）

- default 盤面 byte-identical。web 変更時は deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。deploy `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`
- **機微情報は `docs/private/` のみ。tracked に書かない・commit しない**（CLAUDE.md 厳守）
- 既知フレーキー: `tests/lib/channel.test.ts`（再実行で緑）。**vitest は dev サーバー並走で無関係 suite が落ちる**（s155 で確認）→ 並走を止めて再実行
- **偽保存対策**: Write/Edit 後は独立 Read、commit 後は `git log --stat -1` の実出力で確認
- 応答は日本語・簡潔に
