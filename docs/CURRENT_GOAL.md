# 次セッションのゴール — 未定（s176 で SHARE 自動画像化を出荷。次の1機能を選ぶ）

## 進め方（最速プロトコル）

- **1 機能ずつ、フレッシュなセッションで**進める。設計は最小往復で最速、実装→検証→デプロイまで自走。
- 見た目変更は claim 前に Playwright で実測。応答は短く。戻せる修正は逐一承認を取らず自走。デプロイは `--branch=master`。機微は `docs/private/`。

## 直近の完了（s176）＝ SHARE 自動画像化 出荷（方向A・手動スクショ撤廃）

- **SHARE が「①選ぶ ②並べる ③作る」の1ボタン**に。CREATE で本物のアレンジ画面を dom-to-image で自動撮影 → 1200×630 → 既存 R2／`/og/<id>.jpg` → LINK READY（COPY LINK / SAVE IMAGE / POST TO X）。HIDE TO SNIP／貼付／BROWSE を撤去。
- 要＝同一オリジン画像 proxy `functions/api/img.ts`（`ogp.ts` の `isBlockedHost` 再利用）。撮影時だけ clone の `<img src>` を `/api/img?u=` に差し替えてクロスオリジン汚染を回避。取得失敗カードは既に文字カード化済みで新規劣化ゼロ。
- tsc0／vitest 全緑／build OK。**本番 allmarks.app デプロイ済 + edge 実測（CDN=200/SSRF=400/SVG=415/dead=404）+ 本番 Playwright で CREATE→LINK READY・6/6 本物写真の WYSIWYG 目視まで完了**。学び：CF は Worker の 5xx を自前エラーページに差し替える→proxy の失敗は 404 で返す。一部 website は CF edge IP を 403 で弾く（rare・placeholder フォールバック）。
- 詳細＝`docs/TODO_COMPLETED.md` s176 ／ `docs/private/IDEAS.md`「SHARE 自動画像化」§ s176。

### s176 の残る手動確認（クローラー相手で自動不可・任意）
- **X に実際に共有リンクを貼って大画像カード（summary_large_image）が出るか**を1回だけ目視（s174 と同じ最終確認）。ユーザーが投稿するときに確認でOK。

## 次にやる候補（順不同・ユーザーが1つ選ぶ）

- **スマホ本格対応**（以前「最優先」・s161）＝規模大。「まず盤面閲覧＋保存だけ」の第1弾に切る。#8 の Web Share ワンタップ共有（ヘルパー実装済）もここで配線。
- **タグ強化**（s60 で最優先だった整理の背骨）＝速めに効く。
- **TUNE テーマ追従（案C・全メニュー一括）** をやるか、s163 中立化を維持するか **まず決める**。
- **#5 収益化**：機微につき `docs/private/IDEAS.md` 参照。
