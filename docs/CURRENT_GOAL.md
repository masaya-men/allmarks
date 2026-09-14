# 次セッションのゴール — 端末間同期 束4(engine.ts: pull/merge/push)

## ★s211 の到達点(束3 = 足し算マージ + Drive 読み書き。★master マージ済)

- **master マージ済**（merge commit `1885308d`・`feat/device-sync-bundle-3` は削除済）。**デプロイは未実施**（呼び出し元ゼロ＝既存挙動に影響ゼロだが、ユーザー判断で「同期が実際に使える形（束4以降）になってから本番反映」と決定。単独デプロイは省く）。
- subagent-driven 6コードタスク + 各レビュー + opus 全ブランチレビュー + 修正波1 + 再レビュー clean → セッション再開後、ユーザーと相談して **`tags[]` のマージ方式を revise**（下記）→ 追加レビュー clean。フルスイート **2706/2706** / tsc 0 / eslint 0 / `rtk pnpm build` OK。
- 出荷: `lib/sync/merge.ts`(純関数: `mergeBookmarks`/`mergeTags`/`mergeCards`/`mergeBoardConfig`/`mergeVault`/`mergeAll`・`SyncSnapshot` 型・`updatedAt` は `numericTime` 経由・`pickDeterministic` で決定的) / `lib/sync/drive-adapter.ts`(fetch のみ・token 注入・`DriveError{status}`・`buildMultipartRelated`・`findSyncFolder`/`createSyncFolder`/`listFolderFiles`/`downloadFileText`/`getHeadRevisionId`/`createTextFile`/`updateTextFile`)。
- 計画書 `docs/superpowers/plans/2026-09-04-device-sync-bundle-3-merge-drive.md`(tracked)。設計書 §15「束3」節に engine への申し送り全部。

### ★s211 途中で解決した2件（もう判断不要・記録のみ）

- **旧C1（Private の平文漏洩バグ）** — 当初「Private の状態が食い違うときだけタグの和集合をやめる」特別ルールで暫定修正。ユーザーに「業界標準は？」と問われ調査 → 根本原因は和集合そのもの（タグ外しを原理的に伝播できない）と判明。
- **旧I2（タグ外しが同期で伝わらない）** — 上と同じ根っこ。
- → **`tags[]` を他フィールドと同じ whole-record LWW に統一**（集合和をやめる）。実在する業界パターン（CloudKit 等の "field-level last-write-wins"）。タグ外しが正しく伝わるようになり、C1 の特別ルールも丸ごと不要に。代償（ユーザー承認済み）: 未同期のまま両端末が別々のタグを足すと片方が消えることがある。将来「1つも失わない」を売りにしたければ OR-Set（CRDT）に格上げする余地あり（設計 §13）。調査の詳細は **memory `project_allmarks_sync_tag_merge_strategy`**（同じ調査を二度しないための保存）。

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
- **`mergeVault` 食い違い**（同期前に2台で別々に Private 設定）: 黙って進めず ユーザーに選ばせる or パスワード再設定。`isPrivateVault` タグ2つ問題も。
- 一般の衝突退避(§6.5): 本当に同時編集が起きたとき（Private トグルを含む、あらゆるフィールド）は「負けた版を30日退避 + 静かなトースト」。特定フィールド専用の UI は不要（全フィールド共通の仕組みでカバー）。
- `hasRequiredScopes(scope)` ヘルパ(束2 申し送り・部分同意で Drive だけ外された検知)。GIS ポップアップ放置タイムアウト経路。

## ★公開前タスク(束2 で発生・継続)

- **PL-1**: OAuth 同意画面のメールを個人 Gmail → 専用アドレス(Google グループ)。memory `project_oauth_support_email_swap`。
- **PL-2**: OAuth アプリを「テスト中」→「本番」公開 + Search Console で `allmarks.app` ドメイン検証(束4 の放置運転自動同期の前に必須。テスト中だと refresh token が7日で失効)。

## 恒久ルール(継承)

- 視覚変更は `ui-design.md`「承認後」。`rtk` 前置・`--no-verify` 禁止・vitest/playwright は素の npx(`rtk npx` は既知の不具合)・Framer Motion 禁止。
- 音(dotted-notebook)/紙(paper-atelier)＝バイト同一を死守。
- 機微(支援・値付け・戦略)は tracked に書かない＝`docs/private/`。
- merge/push/deploy は必ずユーザー確認後。ただし deploy は「本番で見たい」等の明示的な合図があれば即実行可。docs だけの push はしない(次の実務 push に同梱)。
- **束3で決定**: 束1-3 は各々 master マージ済みだが、**本番デプロイは同期が実際に使える形（束4以降）になってからまとめて行う**（単独デプロイは省く）。
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
