# 次セッションのゴール (= セッション 65 続き) — Tier 2 撤去済、次の大物 (Phase 3 か タグ付け) を選択

## 今のゴール (1 行)

Tier 2 ホバー再生を **撤去して本番反映済**。 user が本番で音量50%復活を確認後、次の大物 (Phase 3 = Tier 1 常時モーション、 または タグ付け) を選んで着手する。

## 直前までの状態 (session 65)

- **Tier 2 ホバー再生を撤去** (commit `ea8b93f`、 deploy 済)。 理由: ボードはマウスを動かす画面なので通過しただけのカードが次々ミュート再生して「うるさい・誤爆」、 緑枠もカードの角丸/トンマナ外。 「ボードが生きてる」 感は Phase 3 (Tier 1 静かな常時モーション) に寄せ、 意図的な再生は Tier 3 (アイコン押し=音つき) に集約する判断。
- 撤去方法: Tier 2 の **5 コミットを git revert** (純粋プール logic / usePlaybackPool / useHoverIntent / embeds の muted 対応 / CardsLayer 配線)。 embeds は **session 62 の既知良好状態 (= インライン既定音量 50%) に復帰**。
- **686 PASS** (= 699 − Tier 2 の 13 test) / tsc clean / build OK / deploy 1。

## セッション開始時 / 続行時にやること

1. **user に本番で音量確認を依頼**: `booklage.pages.dev` ハードリロード → 動画/音楽カードの右下アイコンを押して音つき再生 → **音量が 50% で始まるか**。 ホバーで勝手に再生されなくなったことも確認。
   - もし 50% でないなら、原因は Tier 2 ではなく **過去に Lightbox 等で音量を下げた値が localStorage `allmarks.player.defaultVolume` に保存されている** 可能性 (= 仕様上の永続化)。 その場合は「カード個別調整を global 既定として永続化すべきか」 を別途相談する。
2. **OK なら次の大物を user と選択**:
   - **Phase 3 = Tier 1 常時 ambient モーション**: 画面内の全カードが軽く動いて見える層 (= ストーリーボード / ゆっくりズーム / クロスフェード、 動画デコード 0 の軽量演出)。 spec [multi-playback-design](./superpowers/specs/2026-05-21-multi-playback-design.md) §3 Tier 1。 「ボードが常に生きてる」 を静かで設計された動きで完成させる
   - **タグ付け機能**: user 最優先発言 (memory `project_tagging_top_priority`)。 multi-playback がひと段落したので着手の好機

## このプロジェクトの user 対応で厳守すること

- AskUserQuestion の質問箱を多用しない。 普通の chat で 1 問ずつ
- 応答は日本語、 横文字カタカナ多用しない
- 既存機能を壊さない: 触る前に依存を洗い、 task ごとに全テスト + preview 実機確認。 commit はこまめに、 deploy 前に tsc + vitest
- ドキュメント更新 (TODO / CURRENT_GOAL / TODO_COMPLETED) を commit と同じ区切りで必ず行う
- **preview の注意**: ローカル wrangler が古く compatibility date でコケるので `npx -y wrangler@latest pages dev out --port 8788 --ip 127.0.0.1` を使う

## backlog (この後)

- multi-playback Phase 4 = master ON/OFF スイッチ (= 全 Tier 停止の「静かな鑑賞モード」)。 ※Tier 2 撤去で当面は Tier 3 のみ。 Phase 3 着手後に再検討
- 月末 (2026-05-31): `allmarks.app` ドメイン取得確認
