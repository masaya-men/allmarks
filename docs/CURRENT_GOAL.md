# 次セッションのゴール (= セッション 66) — Tier 1 の本気チューニング (滑らかな大量同時再生に挑戦)

## 今のゴール (1 行)

画面内動画の**大量同時再生を「滑らか」に成立させることに本気で挑戦する**（あらゆる手法を集める）。叶わなければカクつき許容。加えて短尺ループ・YouTube ⏸マーク・MOTION 間隔の polish。

## 直前までの状態 (session 65、2026-05-21〜22)

- **Tier 1 = 画面内動画の音なし自動再生 + MOTION マスタースイッチ** を実装・本番反映済 (master、`booklage.pages.dev`)。
- MOTION は**外枠の上帯** (`.frameTopChrome`、canvas の上の余白) に `● │ MOTION  AllMarks·件数` で常設。**TUNE/POP OUT/SHARE は元位置のまま不動**（canvas が overflow clip するため、その上に出すには外枠側に置く必要があった＝重要な学び）。右端は SHARE と一致。
- session 65 末に user フィードバックで 4 点 ship 済: ①**同時再生の上限を撤去** (`TIER1_CAP=999` 実質無制限) ②自動再生中はプレイヤーのコントロール非表示 (YouTube/Vimeo `controls=0`, native `<video>` controls なし) ③MOTION を外枠上帯へ ④`LED │ MOTION` 罫線デザイン。
- **716 PASS** / tsc clean / deploy 済。

## user 実機フィードバック (= session 66 でやること)

1. **滑らかな大量同時再生に本気で挑戦する** (最優先・R&D)。
   - 現状: 上限なしで全部再生すると**動画はカクつく**が、スクロール等の操作は滑らか (= デコードのレーンが渋滞しても、コンポジタ/操作レーンは別物で空いているため。負荷は本物で大きい＝CPU/GPU・発熱・電池、弱い端末では全再生されない可能性)。
   - **目標は「滑らかに」大量同時再生を成立させること**。あらゆる知識・手法を集めて挑む。**叶わない場合に限りカクつき許容** (= 妥協ライン、その場合も ship はする)。
   - 技術リサーチの出発点・候補手法は **`docs/private/IDEAS.md` の「滑らかな大量同時再生」節**に記載 (= ブラウザの同時ハードデコーダ上限、軽量プレイヤー優先、低解像度ソース、開始ずらし、安価な擬似モーション併用 等)。
2. **短い動画はループ再生** (= 再生終了で自動的に頭へ)。YouTube `loop=1&playlist=<id>` / Vimeo `loop=1` / native `<video> loop` 属性。muted (Tier 1) のときのみ。
3. **YouTube だけ再生開始時に大きな ⏸ マークが出る**のを消したい (= 優先度低め)。controls=0 でも出る YouTube 内部の再生/一時停止オーバーレイ。`playsinline` 等で消せるか調査、無理なら仕様限界として記録。
4. **`● │ MOTION` の間隔を視覚的に均等に**。今は「LED↔罫線」より「罫線↔MOTION」が広く見える (= ChromeButton の左 padding 12px のせい)。人の目で同じ距離に見えるよう、divider→MOTION の余白を詰める ([MotionToggle.module.css](../components/board/MotionToggle.module.css) / ChromeButton の左 padding 相殺)。

## セッション開始時にやること

1. まず `docs/private/IDEAS.md`「滑らかな大量同時再生」節を読み、リサーチ方針を確認。
2. 1 (大量同時再生の滑らか化) を腰を据えて R&D。小さく実験 → preview で 60fps 計測 → 効く手法を採用。カクつき改善が頭打ちなら現状 (全部再生・カクつき許容) を維持。
3. 2〜4 の polish は 1 の合間 or 後で。
4. その後の大物は **タグ付け機能** (memory `project_tagging_top_priority`)。

## このプロジェクトの user 対応で厳守すること

- AskUserQuestion の質問箱を多用しない。普通の chat で 1 問ずつ。応答は日本語、横文字カタカナ多用しない
- 既存機能を壊さない: 触る前に依存を洗い、task ごとに全テスト + preview 実機確認。commit はこまめに、deploy 前に tsc + vitest
- preview: `npx -y wrangler@latest pages dev out --port 8788 --ip 127.0.0.1`、navigation は `waitUntil: 'domcontentloaded'` (自動再生で networkidle が来ない)
- 既知 flake: `tests/lib/channel.test.ts` は並列フルランで稀に落ちる。単体では PASS
- 関連 spec: [tier1-viewport-playback-design](./superpowers/specs/2026-05-21-tier1-viewport-playback-design.md) / plan: [tier1-viewport-playback](./superpowers/plans/2026-05-21-tier1-viewport-playback.md)

## backlog (この後)

- **タグ付け機能** (= 次の大物、user 最優先)
- 月末 (2026-05-31): `allmarks.app` ドメイン取得確認
