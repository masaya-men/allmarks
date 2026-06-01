# 次セッションのゴール (= セッション 100)

## 今のゴール (1 行)

**共有まわり (受け取り=ボード一致 / SHARE 再共有 / 取り込み重複サマリー) は全て本番 ship + master push 済。次は user が選ぶ公開向けバックログ、または共有の最終ブラッシュアップ。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態 (セッション 99)」を読む
2. user に「次どこ行く?」を確認 (下の候補から)
3. 着手前に該当 spec / plan を読む

## セッション 99 で ship 済 (本番反映・master push 済)
- **Plan 2 = SHARE 再共有**: 受け取り画面の SHARE を有効化。今見えてるカード (× で減らした後・TUNE 反映後) から本物の `SenderShareModal` で新規共有を作る。`buildShareDataFromBoard` 流用 (上限/truncate/タグ辞書/型判定パリティ)、ミラープレビューのジオメトリは受け取りの skyline レイアウト + scrollTop + コンテナ実寸から供給。送り主タグは再共有データに残す (次の受け取り手にも読み取り専用ラベル)。本番ラウンドトリップ実測 PASS。
- **取り込み重複サマリー (主流の「報告のみ」)**: 取り込み完了の緑 ✓ の下に、重複があった時だけアンバー (#FFB020) で1行。一部重複=`N SAVED · M ALREADY SAVED`、全部重複=`ALL ALREADY SAVED`。事前ダイアログ無し・どの URL かは出さない (一括は件数だけで十分)・強制追加無し。重複ありの時だけ done を 2s 保持 (読めるように)、重複ゼロは従来通りサッと遷移。削除済み URL は再取り込み可 (不変)。本番で両状態 実測 PASS。
- 受け取り取り込みの並び順は正しい (送り主の最上段=受け取りの最上段) と再確認済 (user のハードリロード漏れだった)。

## 次の候補 (公開向けバックログ、TODO.md「公開向け残タスク」参照)
- ドメイン allmarks.app (棚上げ中、催促しない)
- Phase D4/D5: 他14言語の mood→tag i18n rename + NewMoodInput→NewTagInput 内部 rename (公開前必須)
- onboarding チュートリアル (初回ユーザー向け)
- 拡張機能 Chrome Web Store 公開準備
- LP 整備 (share / multi-playback / 拡張 の言及追加)
- 共有の最終ブラッシュアップ / 上澄み polish

## 守ること
- **本番が既定**: ship したら淡々と本番デプロイ→本番で実測確認。デプロイ可否を毎回聞かない (memory `feedback_prod_is_default`)。特別な場合 (履歴書換/破壊的) のみ立ち止まる。
- 実機(playwright/本番)で測ってから「動いてる」と報告。視覚変更はデプロイ→確認。デプロイ前 `npx wrangler whoami`。
- 発明しない・本物のボード部品を流用。横文字を日本語応答に混ぜない。AskUserQuestion ボックス禁止。可視性をアニメに依存させない。
- ブランチは使わない (master 直接、ソロ開発)。git commit -m 本文にバッククォートを使わない。
- **デザイン変更は提案→承認→実装** (`.claude/rules/ui-design.md`)。ただし軽微で user が事前 OK したものは即実装で良い。
