# 次セッションのゴール (= セッション 64) — Phase 2: ホバーで本物再生 (Tier 2)

## 今のゴール (1 行)

board のカードに **300ms マウスを留めると、そのカードが本物のミュート再生に昇格**する Tier 2 ホバープールを実装する (最大 4 枚 LRU)。

## 直前までの状態 (session 63 終了時点)

- **ライトボックス stale-media バグ #4 = 根治・本番反映済**。 真因は [TweetVideoEmbed.tsx](../components/board/embeds/TweetVideoEmbed.tsx) が再生 source を mount 時 useState に snapshot して prop 変更を無視していたこと。 source を毎レンダ prop 導出に変更して解決。 回帰テスト + verify スクリプト stale=0 で確認済。
- **コントロールバーのブラッシュアップ 4 項目 = 完了済** (commit `918b652` 他)。 ドキュメントが前セッション中断で未追記だっただけ、 コードには反映済 (user 確認)。
- 684 PASS / tsc clean / `booklage.pages.dev` 反映済。

## やること (Tier 2 hover プール、 上から順に)

仕様の真実は [multi-playback-design](./superpowers/specs/2026-05-21-multi-playback-design.md) §3 (Tier 2) / §6。 着手前に必ず読む。

1. **`useHoverIntent` フック** = カードに 300ms マウスが留まったら発火。 離れたら 2〜3 秒は再生キープしてから退避対象に (即 unmount でデコーダ thrash を避ける)。 業界標準 300ms (NN/g・Baymard)。
2. **`usePlaybackPool` フック** = 本物再生は **最大 4 枚同時** (`MAX_ACTIVE_PLAYERS = 4`)。 5 枚目昇格時は最も古い非ピン留めプレイヤーを停止して Tier 1 に戻す (LRU 退避、 Netflix 同時 4 と同思想 = デコーダ上限内)。
3. **昇格時 0.1 秒で視覚反応** (枠 / scrim 等)。 プレイヤー起動の待ちを感じさせない。
4. **ミュート再生**で昇格 (音は Tier 3 = アイコン押しの領分)。 既存の inline player 機構 ([embeds/media-players.tsx](../components/board/embeds/media-players.tsx) の registry) を流用、 新概念を増やさない。

## 設計上の前提 (調査済・厳守)

- 同時本物再生のボトルネックは GPU ではなく**ハードウェアデコーダのセッション数**。 iframe (YouTube/Vimeo) は raw `<video>` より遥かに重い → **4 枚上限は物理制約**、 増やさない。
- カード本体クリック = 従来どおり Lightbox を開く (変更しない)。 ホバー / アイコン押し / 本体クリックの 3 役割分離。

## テスト方法

- `pnpm preview` (= `next build && wrangler pages dev out`、 port 8788)。 ツイート動画も実再生で確認可。 **検証前に古い workerd を落として新ビルドで再起動**する (session 63 の教訓: stale サーバーを掴むと誤検証になる)。
- カード投入: `http://127.0.0.1:8788/save?url=<encoded>`。 playwright で hover → 300ms 後に `<video>` mount を確認、 5 枚目で最古が停止する LRU を確認。

## このプロジェクトの user 対応で厳守すること

- AskUserQuestion の質問箱を多用しない。 普通の chat で 1 問ずつ
- 応答は日本語、 横文字カタカナ多用しない
- 既存機能を壊さない: 触る前に依存を洗い、 task ごとに全テスト + preview 実機確認。 commit はこまめに、 deploy 前に tsc + vitest
- ドキュメント更新 (TODO / CURRENT_GOAL / TODO_COMPLETED) を**コミットと同じ区切りで必ず行う** (session 63 で前セッションの未追記によるドキュメントズレが判明したため)

## backlog (Tier 2 の後)

- Phase 3 = Tier 1 ambient モーション (全カード軽量演出、 デコーダ 0) / Phase 4 = master ON/OFF スイッチ
- タグ付け機能 (= user 最優先発言、 multi-playback 完了後すぐ着手)
- 月末 (2026-05-31): `allmarks.app` ドメイン取得確認
