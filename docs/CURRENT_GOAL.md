# 次セッションのゴール (= セッション 62)

## 状況

session 61 で 2 つのことが起きた:
1. **背景文字グリッチ (I) を断念** — 4 回作り直しても user 意図に届かず、 board から全撤去して**静止白文字に revert** + 本番 deploy 済。 再挑戦用に `/typo-glitch-lab` playground を残置
2. **multi-playback (= カード上で複数同時再生)** に方向転換 — user 最優先機能。 2 本の web 調査 → spec → **Phase 1 plan まで確立**。 セッションが長くなったので実装は次セッション (= 今回) へ持ち越し

## 最優先タスク: multi-playback Phase 1 を実装

**まず読む**: [docs/superpowers/plans/2026-05-21-multi-playback-phase1.md](./superpowers/plans/2026-05-21-multi-playback-phase1.md) (= 5 task TDD plan)
**設計背景**: [docs/superpowers/specs/2026-05-21-multi-playback-design.md](./superpowers/specs/2026-05-21-multi-playback-design.md) (= 3 段モデル全体 + 調査根拠)

Phase 1 の 5 task:
1. **右下アイコンを押せるトグルボタン化** (= 既存 × ボタンの z-index 50 パターン流用 + ホバー内側拡大 + 緑 glow active)
2. **Lightbox の埋め込みプレイヤーを `components/board/embeds/` に共通化** (= YouTube/Vimeo/SoundCloud/TikTok を verbatim 抽出、 Lightbox 動作維持)
3. **InlineMediaPlayer ディスパッチャ** (= URL 種別で正しいプレイヤー選択)
4. **board に audio-active state 配線** (= アイコン押し → カード内で音つき再生、 **単体 1 枚**。 4 枚プールは Phase 2)
5. **build + playwright 検証 + deploy** ← **右下リサイズが効くこと必須チェック** (spec §4)

実行方法: executing-plans (= このセッションで順番に) か subagent-driven (= task ごと subagent)。 user に開始時 1 行で確認。

## このプロジェクトの user 対応で厳守すること (= session 61 で確認)

- **AskUserQuestion の質問箱を多用しない**。 user は「決められた答えしかできなくて幅が狭い」 と 2 回明示。 探索的な詰めは普通の chat で 1 問ずつ会話する
- **「徹底調査して」 = 推測で答えず実際に web 調査エージェントを回す**
- **勝手に memory を増やさない** (= session 61 で「余計なメモリ追加しないで」 と言われた)。 design の一般論を memory 化するのは特に避ける
- 応答は日本語、 横文字カタカナ多用しない

## multi-playback の後 (= Phase 2 以降)

- Phase 2 = Tier 2 hover プール (= `usePlaybackPool` 4枚LRU + `useHoverIntent` 300ms)
- Phase 3 = Tier 1 ambient モーション (= storyboard sprite / Ken Burns / クロスフェード)
- Phase 4 = 全体 ON/OFF master スイッチ (音波テーマ、 配置は要相談)

## 月末リマインダー (2026-05-31)

`allmarks.app` ドメイン取得確認。 取得済なら拡張機能の Chrome Web Store submit + 本体 rebrand sprint。 Developer Account は既存 ($5 払い済)。

## 引き継ぎ resources

- [docs/TODO.md](./TODO.md) — active backlog (= session 61 反映済)
- [docs/TODO_COMPLETED.md](./TODO_COMPLETED.md) — session 61 narrative 集約済
- [docs/superpowers/plans/2026-05-21-multi-playback-phase1.md](./superpowers/plans/2026-05-21-multi-playback-phase1.md) — Phase 1 実装 plan
- [docs/superpowers/specs/2026-05-21-multi-playback-design.md](./superpowers/specs/2026-05-21-multi-playback-design.md) — multi-playback 全体設計
- memory `project_allmarks_vision_multiplayback.md` — multi-playback vision
