# 次セッションのゴール — SHARE 自動画像化を実装（方向A・1機能=1フレッシュセッション）

## 進め方（最速プロトコル）

- **1 機能ずつ、フレッシュなセッションで**進める。設計は最小往復で最速、実装→検証→デプロイまで自走。
- 見た目変更は claim 前に Playwright で実測。応答は短く。戻せる修正は逐一承認を取らず自走。デプロイは `--branch=master`。機微は `docs/private/`。

## ★次セッションのゴール＝ SHARE 自動画像化 実装（方向A）

**背景（s175 で実測完了・GO 確定）**：全 722 ブクマをサーバー側 fetch した結果、**写真で撮れる 90.3%／自動化で新規に文字化するのは 8 件(1.1%)のみ、しかも全て既に壊れてる画像**。同一オリジン proxy 経由の dom-to-image 実撮りでも代表9枚すべて本物どおりに焼けた。→ **自動化に全振り確定**。
- 詳細＝`docs/private/2026-07-08-share-autocapture-measurement.md`（数字・失敗ホスト）／`docs/private/IDEAS.md`「SHARE 自動画像化」§（実装メモ）／証拠画像 `2026-07-08-share-autocapture-proof.png`。

**やること（brainstorm→spec/plan→サブエージェント駆動→検証→deploy）**：
1. **同一オリジン画像 proxy `functions/api/img.ts`** を新設。`?u=<url>` をサーバー側 fetch → bytes を `image/*` で返す。**SSRF対策は既存 `functions/api/ogp.ts` の `isBlockedHost` を再利用**＋バイト上限＋content-type allowlist＋`Cache-Control` immutable＋リダイレクト着地の再検証。
2. **SHARE 撮影時だけ**カード `<img src>` を `/api/img?u=…` に差し替え（常時 proxy化は帯域増→撮影時限定）。dom-to-image（`lib/share/render-share-image.ts`）で盤面をそのまま撮影。
3. **SHARE を「①選ぶ ②並べる ③作る」の1ボタン化**。撮影モード・貼付・HIDE TO SNIP を撤去。既存 `create-hosted-share`／`/og/<id>.jpg`（s174）に接続。
4. 取得失敗カードは PlaceholderCard 相当の文字カードにフォールバック（新規劣化なし）。
5. **edge 実地確認**（website 数件だけ本番 proxy で叩く）＋ tsc/vitest/build → deploy → 本番で1回 SHARE 実撮り目視。

## 直近の完了（s175）＝ SHARE 自動画像化の「実測」完了・方向A確定（実装は次セッション）

- 全 722 ブクマをサーバー側 fetch：**写真652(90.3%)／取得失敗8(1.1%)／元から文字62(8.6%)**。失敗8件は全て既存の壊れ画像で新規劣化ゼロ。
- dom-to-image 実撮り（同一オリジン proxy 経由）で代表9枚すべて本物どおり。汚染・空白ゼロ。
- 測定ノート・証拠画像・実装メモを `docs/private/` に保存済。

## バックログ（順不同・どれからでも）

- **スマホ本格対応**（以前「最優先」・s161）＝規模大。「まず盤面閲覧＋保存だけ」の第1弾に切る。#8 の Web Share ワンタップ共有もここで配線。
- **タグ強化**（s60 で最優先だった整理の背骨）＝速めに効く。
- **TUNE テーマ追従（案C・全メニュー一括）** をやるか、s163 中立化を維持するか **まず決める**。
- **#5 収益化**：機微につき `docs/private/IDEAS.md` 参照。
