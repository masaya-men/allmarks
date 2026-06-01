# 次セッションのゴール (= セッション 99)

## 今のゴール (1 行)

**受け取り画面=ボード完全一致 (Plan 1) は本番 ship + master マージ済。次は ① user の本番視覚確認の反映 → ② Plan 2 (SHARE 再共有) の実装。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態 (セッション 98)」を読む
2. user に「受け取り画面の見た目/動き、気になる点ある?」を確認 (本番 `booklage.pages.dev/s/<新規共有>`)
3. 視覚の手直しがあれば先に潰す → デプロイ
4. その後 Plan 2 (SHARE 再共有) へ

## Plan 1 で ship 済 (本番反映・master マージ済)
受け取り `/s/<id>` を本物のボード chrome に再構築: 本物部品流用 (TITLE/TUNE/MOTION 有効・FILTER/MANAGE/POP OUT/SHARE 取り消し線ブロック) / `IMPORT N TO YOUR BOARD` ボタン / × 削除一本 (緑 SAVE 廃止) / 送り主タグ読み取り表示 / タグ非取り込み + 既存重複は弾く / 並び順逆順修正 / 取り込み中インジケーター (テーマ駆動・音波→緑✓→遷移)。共有データに `w` 追加。
- 設計 [docs/superpowers/specs/2026-06-01-receiver-board-parity-design.md] / 計画 [docs/superpowers/plans/2026-06-01-receiver-board-parity.md]

## Plan 2 (次の実装) = SHARE 再共有
- 受け取り画面の SHARE を機能化: 今見えているカード (× で減らした後) から **新しい共有を作る**。
- 本物の `SenderShareModal` + `buildShareDataFromBoard` + 共有作成 API を流用。ミラープレビューの props (MirrorItem/MirrorPosition/scroll/bgViewport 等) を受け取りの可視カードレイアウトから供給する配線が要。
- 重複取り込みの UX: 今は「既存と重複する URL は弾く」のみ (silent skip)。確認ダイアログ/強制追加を出すかは Plan 2 着手時に user と相談。

## テスト用共有の作り方
`POST {本番}/api/share/create` body=`{share: ShareDataV2(w/gap/cards...), thumb}` → `{id}` → `/s/<id>`。雛形 `C:/Users/masay/AppData/Local/Temp/playwright-recv-parity.js` (8枚デモ・列数/IMPORT文言/×削除をデータ確認)。

## 守ること
- **本番が既定**: ship したら淡々と本番デプロイ→本番で実測確認。デプロイ可否を毎回聞かない (memory `feedback_prod_is_default`)。特別な場合 (履歴書換/破壊的) のみ立ち止まる。
- 実機(playwright/本番)で測ってから「動いてる」と報告。視覚変更はデプロイ→確認。デプロイ前 `npx wrangler whoami`。
- 発明しない・本物のボード部品を流用。横文字を日本語応答に混ぜない。AskUserQuestion ボックス禁止。可視性をアニメに依存させない。
- git commit -m 本文にバッククォートを使わない。push は user が求めた時のみ。
