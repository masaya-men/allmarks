# 次セッションのゴール — 端末間同期 束4(engine.ts: pull/merge/push)

## ★s211 の到達点(束3 = 足し算マージ + Drive 読み書き)

- ブランチ `feat/device-sync-bundle-3`(commit `d74d56ea`〜`d1aefb02`)。subagent-driven 6コードタスク + 各レビュー + opus 全ブランチレビュー + 修正波1 + 再レビュー clean。フルスイート **2708/2708** / tsc 0 / `rtk pnpm build` OK。**呼び出し元ゼロ = 既存挙動は完全不変**。
- **★merge/deploy は未実施(ユーザー確認待ち)。** マージ承認と下の C1・I2 の判断が要る。
- 出荷: `lib/sync/merge.ts`(純関数: `mergeBookmarks`/`mergeTags`/`mergeCards`/`mergeBoardConfig`/`mergeVault`/`mergeAll`・`SyncSnapshot` 型・`updatedAt` は `numericTime` 経由・`pickDeterministic` で決定的) / `lib/sync/drive-adapter.ts`(fetch のみ・token 注入・`DriveError{status}`・`buildMultipartRelated`・`findSyncFolder`/`createSyncFolder`/`listFolderFiles`/`downloadFileText`/`getHeadRevisionId`/`createTextFile`/`updateTextFile`)。
- 計画書 `docs/superpowers/plans/2026-09-04-device-sync-bundle-3-merge-drive.md`(tracked)。設計書 §15「束3」節に engine への申し送り全部。

## ★マージ前にユーザーが決めること(セッション頭で確認)

1. **C1 = 承認要**: `mergeBookmarks` は「両端末で `encryptedPayload` の有無が食い違うとき `tags[]` の和集合を取らず LWW 勝者を丸採用」。設計 §6.1「タグは常に和集合」からの**意図的ズレ**(§9 Private 平文非流出 + §12 のため)。代償: Private 化/解除が LWW で負けると同期越しに黙って捨てられる → 束4 engine が race をユーザーに見せる。
2. **I2 = 仕様判断要(束4着手前)**: ブクマからの「タグ外し」は和集合なので同期で伝わらない(相手の古いコピーが復活・1回収束すると外し操作は永久喪失)。選択肢 (a)「タグ外しは同期しない」割り切り / (b) `tags[]` もレコード丸ごと LWW / (c) ブクマ×タグ単位の墓標。

## ★次セッション = 束4(engine.ts ＋ sync-store ＋ vault.json)

設計書 §4.1(`engine.ts` / `sync-store.ts`)・§7(データフロー)・§8(安全弁)・§9(vault.json 授受)。計画書を writing-plans で作る → subagent-driven。

engine の責務(束3 の申し送りより):
- **base スナップショット(3-way)** ＋ ローカル/リモート変更の区別(§7.5)。pre-merge バックアップ直近3世代を `sync-store` に。
- **pull/merge/push オーケストレーション** ＋ **20秒デバウンス push** ＋ visibilitychange/beforeunload flush。
- **楽観ロック(§7.4)**: pull 時 `headRevisionId` 記録 → push 直前に `getHeadRevisionId` 比較 → 違えば先に pull+再マージ。
- **安全弁(§8)**: zod 全ファイル検証 / マージが総数の20〜30%超を削除したら一時停止してユーザー確認 / token 失効→「再接続」導線 / ネット不通は静かにスキップ / IDB 書込は 1トランザクション all-or-nothing。
- **`saveBoardConfig` に `updatedAt` 打刻を配線**(今 `{key,config}` のみ・`mergeBoardConfig` は 0 扱いで動くが engine が打つ)。
- **merge 結果を破壊的に変更しない**(戻り値は入力レコードと同一参照を含む)。engine 側でコピー。
- **`emptyTrash`/`deleteBookmark` の物理削除**(墓標なし)対策: 「ローカルに無い ≠ クラウドから消す」を守る or EMPTY TRASH を端末ローカル扱い。§6 の想定を実装前に確認。
- **`mergeVault` 食い違い**: 黙って進めず ユーザーに選ばせる or パスワード再設定。`isPrivateVault` タグ2つ問題も。
- **C1 の race をユーザーに見せる**(§6.5 衝突退避と同じ枠)。
- `hasRequiredScopes(scope)` ヘルパ(束2 申し送り・部分同意で Drive だけ外された検知)。GIS ポップアップ放置タイムアウト経路。

## ★公開前タスク(束2 で発生・継続)

- **PL-1**: OAuth 同意画面のメールを個人 Gmail → 専用アドレス(Google グループ)。memory `project_oauth_support_email_swap`。
- **PL-2**: OAuth アプリを「テスト中」→「本番」公開 + Search Console で `allmarks.app` ドメイン検証(束4 の放置運転自動同期の前に必須。テスト中だと refresh token が7日で失効)。

## 恒久ルール(継承)

- 視覚変更は `ui-design.md`「承認後」。`rtk` 前置・`--no-verify` 禁止・vitest/playwright は素の npx(`rtk npx` は既知の不具合)・Framer Motion 禁止。
- 音(dotted-notebook)/紙(paper-atelier)＝バイト同一を死守。
- 機微(支援・値付け・戦略)は tracked に書かない＝`docs/private/`。
- merge/push/deploy は必ずユーザー確認後。ただし deploy は「本番で見たい」等の明示的な合図があれば即実行可。docs だけの push はしない(次の実務 push に同梱)。
- 選択ボックス(AskUserQuestion)はデザイン判断・意思決定・調査/デバッグ中の質問には使わない。普通の会話で聞く。
- 文言(UI コピー)を新規/変更するときは、実装前に実際の英語・日本語の文面そのものを見せて確認を得る。
- IDB/vault など不可逆な本番データに関わる変更は、実行前に必ずユーザーに事実確認する。
- 大規模調査・実装はサブエージェントに委譲(司令塔は診断・設計・指示書・検収)。

## 保留中(同期の後 or 並行)

- **N-78**: 画像無しツイート専用カード(見た目案の提示・承認が必要)。
- **N-64**: カードの＋TAGポップオーバーが再表示後に開けなくなる既存バグ(`CardsLayer.tsx`)。
- **N-63**: `BackupReminder` の表示位置が ScrollMeter に被る(モック→承認後)。
- **N-65**: ECDH 秘密鍵 unwrap 時に生バイトが一瞬 JS 経由(severity LOW・設計変更要)。
- さらなるテーマ/Flat 磨き、C2 翻訳仕上げ。
