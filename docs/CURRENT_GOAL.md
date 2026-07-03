# 次セッションのゴール (= セッション 157)

## 今の状態（LP はいったん区切り・全部 master マージ済＋本番反映済）

**セッション156でやったこと：**

- **N-05 ブラッシュアップ v2+v3 完遂**（merge `782dcf6`）: 乗る→その場で衣装替え→**スクロール駆動の横移動**（完全可逆・斜め軌跡根治）。着地形はナビ実体と完全一致（混在ケース）。境界マイクロ演出4点（スクロール駆動の跳ね／hairline 屈折／玉ノック／境界線グロー）。本番実測13項目 PASS・ユーザーOK。
- **LP最下部の黒幕バグ根治**（`9e7ea1b`）: 白い矩形の正体は **N-05以前からの既存構造バグ**（3世代実測で確定）。幕の全幅化＋幕が上端に達したらヘッダー退場で「最下部＝完全な黒」を設計どおりに。ユーザー確認OK。
- tsc0 / vitest **1922** / build OK。TODO.md を 505→約250行に整理（未収蔵 s149/151/153 を TODO_COMPLETED へ移設）。

## 次にやる（セッション157）

1. **本命バックログの優先順を決める**（前回相談の続き。Claude 推奨＝③から）:
   - **③ プレミアムテーマ制作** ← 推奨。テーマ基盤に乗るだけで始められ、サポーター制の売り物＋build-in-public の発信ネタ
   - **④ K3 解錠実装**（設計・10タスク計画は完成済み `docs/private/2026-07-01-k3-unlock-plan.md`）— ③の1本目が見えたら差し込むのが自然
   - **選択的シェア**（今は新しい順100枚固定・545枚ユーザー本人が困る）
   - **タグ付け強化**（ユーザーが以前「最優先」と言った機能）
2. 決めたテーマの brainstorming から着手（③なら「どの世界観のテーマを最初に作るか」から）

## 検討メモ（未決・急がない）

- 13言語で N-05 演出が出ない件: kicker を全言語英語に統一すれば全言語で発動（UI語彙の globally-clear English 方針とも整合）。見た目が変わる13ファイル編集なので**ユーザー相談してから**。

## 守ること（毎回）

- default 盤面 byte-identical。web 変更時は deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。deploy `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`
- **機微情報は `docs/private/` のみ。tracked に書かない・commit しない**（CLAUDE.md 厳守）
- 既知フレーキー: `tests/lib/channel.test.ts`（再実行で緑）。**vitest は dev サーバー並走禁止**
- **偽保存対策**: Write/Edit 後は独立 Read、commit 後は `rtk git log --stat -1` の実出力で確認。バックグラウンド exit0+空出力も信じず前面で再実行
- **TaskStop で dev サーバーを止めると子プロセスが port 3000 に残る** → `netstat -ano | grep :3000` で確認し `taskkill //PID <pid> //F`（Git Bash は `//`）
- 応答は日本語・簡潔に
