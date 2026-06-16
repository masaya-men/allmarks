# 開発ToDo (AllMarks — 旧 Booklage、 2026-05-16 コード rebrand 済)

> 完了済みタスク → [TODO_COMPLETED.md](./TODO_COMPLETED.md)
> アイデア・将来構想・代替案 → `docs/private/IDEAS.md` (非公開、 gitignored)
> 今このセッションのゴール → `docs/CURRENT_GOAL.md` (5〜10 行のみ、 毎回最初に読む)

このファイルは **アクティブな backlog のみ**。 narrative や ✅ 完了は TODO_COMPLETED.md に移動する。

---

## ドメイン allmarks.app (= ✅ 2026-06-16 取得 + リブランド移行 完了)

**session 102 (2026-06-16): リブランド移行 完了。本番 = `https://allmarks.app`。** 新 `allmarks` Pages プロジェクト + カスタムドメイン Active(SSL有効)。旧 `booklage.pages.dev` は `/* → allmarks.app/:splat 301` 転送シェル(古い共有リンクも生存)。KV/R2 は wrangler.toml の同 ID 引き継ぎ。user 本人の 545件(タグ22)は EXPORT/IMPORT で移行済。拡張も allmarks.app 保存先(v0.1.18)で実機確認済。GitHub repo は `masaya-men/allmarks` に rename。

- **deploy は `--project-name=allmarks --branch=master`**(CLAUDE.md 更新済)。本番 URL は `.env.production`(tracked)の `NEXT_PUBLIC_APP_URL=https://allmarks.app` 由来 → `SITE_URL`(lib/constants.ts)経由で sitemap/robots/OG に反映
- **永久に維持**(変えるとデータ/互換破壊): `DB_NAME='booklage-db'`、bookmarklet 内部 ID、拡張の `booklage:*` メッセージ型、CSS クラス名等の不可視符号
- **公開前の残り片付け**: 暫定 EXPORT/IMPORT ボタン撤去(BoardRoot の TEMPORARY 箇所)、未使用 `chrome-extension/` 削除、`EXTENSION_STORE_URL` 投入(ストア公開時)
- 詳細プラン: `docs/superpowers/plans/2026-06-16-allmarks-rebrand-migration.md`

---

## 現在の状態 (次セッションはここから読む)

### 直近の状態 (セッション 102 — allmarks.app へのリブランド移行 完了)

**完了 (= 全て検証済: tsc 0 / vitest 978 / build OK / 本番 allmarks.app 実測 + 301 実測)**:

1. **コード手当て**: `.env.production`(tracked、allmarks.app + AllMarks)新設 + 古い `.env.local`(localhost/Booklage 上書き)撤去 → dev は constants の fallback。`lib/constants.ts` に `SITE_URL` 追加し sitemap/robots/layout metadataBase を一本化(localhost OG バグも解消)。拡張(content/floating-button/offscreen/options/manifest v0.1.18)を allmarks.app 保存先 + allmarks.app|booklage.pages.dev 両ホスト判定に。privacy ページ説明文。`booklage:*` メッセージ型は内部契約として維持。
2. **インフラ**: 新 `allmarks` Pages プロジェクト作成+デプロイ、`allmarks.app` カスタムドメイン Active(SSL)。KV `SHARE_KV`/R2 `SHARE_OG` は wrangler.toml の同 ID で新 project に引き継ぎ(`/s`・`/api/share/*/og` の graceful 404 で実測確認、共有データ・古い共有リンク生存)。旧 `booklage` プロジェクトは `/*  https://allmarks.app/:splat  301` の転送シェルに置換(本番 301 実測)。wrangler.toml の name も allmarks に。
3. **データ移行**: user が booklage.pages.dev で EXPORT(暫定再表示した BackupButton)→ ファイル解析で 545件(アクティブ514+ゴミ箱31)・タグ22・参照整合 dangling 0 を検証 → allmarks.app で IMPORT 復元確認。拡張リロード後の実機保存(ツイート)も allmarks.app で確認済。
4. **片付け**: GitHub repo rename(booklage→allmarks、local remote 更新)、package.json name、CLAUDE.md デプロイ手順を allmarks.app/`--project-name=allmarks` に。master push 済。記憶(project_allmarks 等)も更新。
5. **暫定残置**: EXPORT/IMPORT ボタンは再取り込みの保険として BoardRoot に残置(TEMPORARY コメント付き、公開前に撤去)。

**🔴 次セッションの候補**: 公開前の最終片付け(暫定ボタン撤去・未使用 chrome-extension/ 削除)/ i18n 言語切替の配線(要 brainstorming)/ onboarding / LP 整備 / 拡張ストア公開素材。詳細は [CURRENT_GOAL.md](./CURRENT_GOAL.md)。

### 一つ前 (セッション 101 — i18n の mood→tag 掃除 + 15 言語を ja.json と同構造に翻訳)

**完了 (= 全て検証済: tsc 0 / 全 978 tests pass / build 成功。本番未デプロイ = 画面に出ない変更なので任意)**:

1. **Phase D5 + mood→tag コード掃除**: `NewMoodInput` → `NewTagInput` (ファイル + 識別子、[NewTagInput.tsx](../components/triage/NewTagInput.tsx))。ja.json の最後の mood キー (`moodsHeader`/`newMood`/`moodNamePlaceholder`) を `tagsHeader`/`newTag`/`tagNamePlaceholder` に統一 + 参照追従 ([Sidebar.tsx](../components/board/Sidebar.tsx) の t() キー + `.moodDot`→`.tagDot` / `.newMoodBtn`→`.newTagBtn` CSS)。**DB ストア名 `moods` 等の内部符号・マイグレーション・「ムードボード」視覚語は意図的に不変** (触ると既存データ破壊)。
2. **TODO 前提の誤りを訂正**: 「他14言語の `newMood` を rename」という TODO の前提は**成り立っていなかった**。実際は他14言語ファイルは**タグ機能以前の古い版**で、mood キーが無く、sidebar/triage/bookmarklet セクションごと欠落・古い「folder」語が残存していた。
3. **15 言語を ja.json と同構造に整備**: [en.json](../messages/en.json) を基準テンプレートとして ja と同構造 (96 leaf キー) に再作 → 残り13言語 (ar/de/es/fr/it/ko/nl/pt/ru/th/tr/vi/zh) を並列サブエージェントで翻訳。固定英語語彙 (TUNE/TAGS/LIBRARY/Inbox/Archive/Visual 等)・プレースホルダ `{current}/{total}`・絵文字・キーコンボ・`#AllMarks` は全言語で verbatim 保持。`triage.skip/undo/hint` は ja に合わせ英語固定 (一部 agent がローカライズした分を強制英語に統一)。構造・固定値とも機械チェック通過。

**🔴 ただし今は誰の画面にも出ない**: [t.ts](../lib/i18n/t.ts) が `ja.json` 固定 import のまま。外国語を実際に出すには **locale 配線が必要** (= §公開向け残タスク release blocker #4 に新規追加)。これは `output: 'export'` の制約で設計判断が要るので別タスク (brainstorming してから)。

### 一つ前 (セッション 100 — 拡張機能の設定画面リデザイン + ボードからの設定入口を本番 ship)

**ship 済 (本番 `booklage.pages.dev` 反映済 / tsc 0 / 全 978 tests pass / 全状態 Playwright 実機検証)**:

1. **拡張機能の設定画面 (options) を参考画像どおりに全面リデザイン** ([extension/options.html](../extension/options.html) / [options.css](../extension/options.css) / [options.js](../extension/options.js)): 左サイドバー (ワードマーク・ナビ・MOTION・SIGNAL オシロスコープ・VER/BUILD) + 上部 EQ バー + 「ALLMARKS SETTINGS」+ 縦フェーダー付き 4 カード + ワイヤーフレーム地球儀 + フッター。**フォントは AllMarks と同じ Geist/Geist Mono を [extension/fonts/](../extension/fonts/) に同梱** (Google Fonts の latin 可変フォント、計 31KB)。配色は既存トークン (share オレンジ `#ff8a3d` / A ロゴ緑 `#28f100`)。「AllMarks · 372」は `savedUrlsMirror` の実保存数、VER/BUILD は manifest 実値。設定の挙動は全保持 (idle opacity のみ select→スライダー化、保存値 0–1 互換)。manifest `0.1.16→0.1.17`。
2. **ボードの TUNE 右隣に拡張設定の入口を追加** (新規 [ExtensionEntry.tsx](../components/board/ExtensionEntry.tsx) + `.module.css`、[BoardRoot.tsx](../components/board/BoardRoot.tsx) で配置): 拡張検知 (`data-booklage-extension`) で出し分け。**導入済み → `SETTINGS`** (クリックで postMessage → content.js → background が `chrome.runtime.openOptionsPage()`)。**未導入 → `GET EXTENSION`** (宣伝ポップオーバー + `ADD TO CHROME`)。ストア URL は [constants.ts](../lib/board/constants.ts) の `EXTENSION_STORE_URL` (空)、**空の間は `COMING SOON` で死んだリンクを出さない** → 公開日に1行埋めれば全員に自動点灯。閉じる手段3つ (× / ESC / 外側クリック=capture pointerdown でボードの操作レイヤーより先に判定)。
3. これで公開向け残タスクの **「拡張機能 設定画面 整備」は完了**。「Chrome Web Store 公開準備」も入口・宣伝・同梱フォントが揃い前進 (公開は引き続きドメイン取得待ち)。

**設計上の確定 (memory 化済)**: ボード上の「外側クリックで閉じる」は capture フェーズ pointerdown 必須 (InteractionLayer が bubble で mousedown を握り潰す)。拡張に AllMarks フォントを使うには woff2 同梱 (next/font なので repo に実体無し)。

**🔴 user 確認手順**: あなたは拡張 sideload 済なので本番ボードでは `SETTINGS` が出る。クリックで設定が開く配線は `content.js`/`background.js` 更新が要るので、`chrome://extensions` で拡張を「更新」してからボードをハードリロード。宣伝側を見たい時は拡張を一時オフに。

### 一つ前 (セッション 99 — SHARE 再共有 / Plan 2 + 取り込み重複サマリーを本番 ship + master push)

**ship 済 (本番 `booklage.pages.dev` 反映済・master push 済 / tsc 0・全 978 tests pass / 本番 playwright 実測 PASS)**:

1. **Plan 2 = SHARE 再共有** ([SharedBoard.tsx](../components/share/SharedBoard.tsx)): 受け取り画面の SHARE を有効化。今見えてるカード (× で減らした後・TUNE 反映後) から本物の `SenderShareModal` を開いて新規共有を作る。共有データは `buildShareDataFromBoard` 流用 (上限/truncate/タグ辞書/型判定が一次共有と同じ)。ミラープレビューのジオメトリ (positions/scrollY/bgViewportWidth=containerWidth/bgCanvasWidth=+18/viewportHeight) は受け取りの skyline レイアウト (spacer と共用) + scrollTop + コンテナ実寸から供給。送り主タグは再共有データに残す (次の受け取り手にも読み取り専用ラベル=表現の一部)。本番ラウンドトリップ実測: 8枚→×で6枚→SHARE→ミラー6枚→SHARE NOW→新URLが6枚で開く、PASS。
2. **取り込み重複サマリー (主流の「報告のみ」)** ([ImportProgressIndicator.tsx](../components/share/ImportProgressIndicator.tsx)): 取り込み完了の緑 ✓ の下に、重複があった時だけアンバー (`#FFB020`) で1行。一部重複=`N SAVED · M ALREADY SAVED`、全部重複=`ALL ALREADY SAVED`。**事前ダイアログ無し・どの URL かは出さない (一括は件数だけで十分、user 合意)・強制追加無し**。重複ありの時だけ done を 2s 保持 (読めるように)、重複ゼロは従来通りサッと遷移。削除済み URL は再取り込み可 (不変)。本番で両状態 実測 PASS。設計判断: 業界主流 (フォト系の「N件スキップ」報告) + AllMarks の優しい pill 言語 (エラー赤を使わない) に揃えた。
3. **並び順の再確認**: 受け取り取り込み後の並び (送り主の最上段=受け取りの最上段) は **正しい**と再確認 (user の「古いものが上」は元 AllMarks タブのハードリロード漏れだった)。`orderForImport` の reverse + `addBookmarkBatch` の昇順 orderIndex + ボード DESC sort で論理整合。

**🔴 user 視覚確認待ち**: 本番で SHARE 再共有の触り心地、取り込み重複サマリーの見た目/間 (一部重複・全部重複)。
**次 (Plan 完了)**: 共有まわりは一段落。次は公開向けバックログ (下記) か共有の上澄み polish を user が選ぶ。

### 一つ前 (セッション 98 — 受け取り画面=ボード完全一致 / Plan 1 を本番 ship + master マージ)

**ship 済 (本番 `booklage.pages.dev` 反映済・master マージ済 / tsc 0・対象テスト緑 / 本番 playwright 実測 PASS)**:

受け取り画面 `/s/<id>`(`SharedBoard`) を本物のボード chrome に作り直した (設計 [docs/superpowers/specs/2026-06-01-receiver-board-parity-design.md]、計画 [docs/superpowers/plans/2026-06-01-receiver-board-parity.md]、サブエージェント駆動で実装+2段レビュー):
1. **本物 chrome 流用**: TopHeader(TITLE/TUNE/MANAGE/POP OUT/SHARE) + 外側帯(MOTION/FILTER) を実部品で描画。TITLE/TUNE/MOTION 有効、FILTER/MANAGE/POP OUT/SHARE は取り消し線+無効 (`BlockedChrome`)。SHARE は計画2(再共有)まで仮ブロック。
2. **IMPORT ボタン** (MOTION 左、`IMPORT N TO YOUR BOARD`、N=表示枚数)。**× 削除一本** (緑 SAVE 廃止)、送り主タグは**読み取り表示のみ**。
3. **タグ非取り込み** (案A、調査 [docs/private/2026-06-01-tag-import-research.md])。**取り込み時に既存(非削除)URLと重複は弾く** (重複ポリシー準拠)。
4. **並び順バグ修正**: `orderForImport` で逆順保存→送り主の順そのまま・束は最上段。
5. **取り込み中インジケーター** (`ImportProgressIndicator`、テーマ駆動=既定音波→緑✓→ボード遷移、出現/最中/消滅アニメ)。
6. 共有データに送り主の基準幅 `w` を追加 (gap は前回追加済)。受け取りが TUNE 完全再現。列数パリティ(9px)済。

**🔴 user 視覚確認待ち**: 本番 `booklage.pages.dev/s/<新規共有>` で chrome の見た目一致・IMPORT のトンマナ・インジケーターのアニメ・×削除・送り主タグ表示・取り込み後の並びを目視。
**次の計画 (Plan 2)**: SHARE 再共有 (`SenderShareModal` 流用で受け取り可視カードから新規共有を作る)。重複取り込みの「確認/強制追加」を出すかは要相談 (今は弾くのみ)。

### 一つ前 (セッション 96 — 共有の角丸 + OGP致命バグ + 画像413 + R2移行を本番 ship)

**ship 済 (= 本番 `booklage.pages.dev` 反映済、 tsc 0 / 975 tests pass、 本番 e2e 実測 PASS)**:

1. **共有カードの角丸を3面で統一**: プレビュー(ShareMirror) のカードが直書き 3px → outerBand 縮小でほぼ四角に見えていた。ボードと同じ `var(--card-radius)` (20px) に統一。OG画像 ([capture-mirror.ts](../lib/share/capture-mirror.ts)) も `fillRect` → 角丸クリップ (`roundRectPath`+`clip`) 描画にし、半径はカード幅比で算出 (縮小率非依存) してプレビューと一致。実機 Chromium ピクセル検証済。
2. **🔴 OGP画像が出ない致命バグ**: og:image メタが `/api/share/<id>/og.webp` を指すが配信関数ルートは `/og` (.webp なし) で**どの関数にも当たらず Next の 404 HTML が返り SNS クローラーが画像を取得できていなかった**。本番 curl で実測確定 → メタを実在する `/og` に修正。
3. **🔴 31枚共有が 413 (thumbnail too large)**: 上限が極小 (50KB、 小アイコン想定の古い値) なのに実画像は写真密な1200x628。さらに WebP は Discord/Slack で OGP 非表示。→ **JPEG 化 + 目標180KB に品質自動調整** (`canvasToJpegUnderTarget`、 最低品質まで落として必ず成立)、上限を 300KB/600KB/800KB に緩和。実機 + 本番 e2e PASS。
4. **🔴 OG画像を KV → R2 へ分離 (100万人規模コスト対策)**: KV は画像込みで保管がスケールし無料枠を超える恐れ (1M user で月¥1.5万、 ほぼ画像)。R2 は **egress 無料 + ストレージ単価 1/33** で画像側は実質無料 (1M user で月¥3-5k=リクエスト課金中心、 10万人まで完全無料)。user が Cloudflare ダッシュボードで **R2 有効化** (PayPal 紐付け済、 課金は無料枠超過分のみ)。bucket `allmarks-share-og(-preview)` 作成 + 30日 expire lifecycle 設定。create.ts は画像を R2.put・KV は share のみ、 og.ts は R2優先→旧共有は KV thumb フォールバック。**本番 e2e: KV軽量(thumb無)・R2からimage/jpeg配信・旧共有も後方互換配信、 全 PASS**。設計詳細 [docs/private/2026-05-31-share-image-r2-plan.md]。
5. (繰越のまま) ページ名の不一致整理 (MANAGE TAGS ↔ /triage) / カード左詰めの隙間 (skyline 系)。

**🔴 user 本番確認待ち**: 実データ (31枚タグ等) で共有が成功するか + SNS にリンク貼ってサムネ (JPEG) が出るか (新規共有で。 X は Card Validator でキャッシュ更新可)。

### 一つ前 (セッション 95 — TITLE退場演出 + マネージ操作改善 + YouTubeサムネ修正を本番 ship)

**ship 済 (= 本番 `booklage.pages.dev` 反映済、 tsc 0 / 967 tests pass、 全て Playwright 実機検証済、 3件とも brainstorming で合意してから実装)**:

1. **TITLE(背景タイポ) の OFF 退場演出** (`8cde48f`): OFF = カードがフィルターで消えるのと**完全同一の CRT shutdown**(`lib/animation/tag-shutdown`)、ON = 従来のブートアップ。可視性は状態の純粋関数のまま死守 (memory `feedback_visibility_never_from_animation`)、CardsLayer barMount と同じ遅延 unmount パターン (`bgTypoMount` が `bgTypoEnabled` に遅れて追従、OFF は closing=true で描画維持→固定タイマー620msで unmount、アニメ完了に依存しない)。連打は最後の状態に収束。
2. **マネージ画面(/triage) 操作改善** (`b1afacb`): カードの**画像部分**でジェスチャ (本文テキストは選択可能のまま)。**ドラッグでタグ付け** (ガラス内で減衰追従 0.42、狙ったチップ緑発光+他減光、中央に「→タグ名」緑ピル、離すとそのタグへ吸い込み付与+次へ)、**タップで別タブ**、左右スワイプ YES/NO 維持。判定は純粋関数 [lib/triage/drag-gesture.ts](../lib/triage/drag-gesture.ts)(単体12件)。**文字くっきり** (タイトル純白/説明ほぼ白+黒影、本文 user-select:text)。ヒント `CLICK TO TOGGLE TAGS · SPACE TO SKIP · Z TO UNDO`。🐛 移動 release の合成 click がルートの閉じるハンドラを誤発火→`suppressNextRootClickRef` で握り潰し解決。
3. **YouTube サムネ修正** (`208e77d`): Lightbox・マネージが白い「YouTube」ロゴになる件を根本修正。[use-board-data.ts](../lib/storage/use-board-data.ts#L73) `deriveThumbnail` を、YouTube は保存 og:image より**動画IDの本物サムネ(hqdefault)を優先**に。読み込み時導出なので**既存ブクマもリロードで直る**。ボード(VideoThumbCard)は元から ID 方式で不変、スライドショーのコマ(hq1/hq2)は別物で不変。単体 +4。

**🔴 user 本番確認待ち** ([CURRENT_GOAL.md](./CURRENT_GOAL.md)): ①TITLE 退場の体感・強さ / ②ドラッグ減衰量・吸い込み速度・タップ開き・文字可読 / ③Lightbox と Shorts でも本物サムネか。

### 一つ前 (セッション 94 — タグ周り作り直し 3 件を本番 ship)

**ship 済 (= 本番 `booklage.pages.dev` 反映済、 tsc 0 / 951 tests pass、 全て Playwright 実機検証済)**:

1. **② リネームをその場インライン編集に** (モーダル `RenameTagDialog` 廃止): 右クリック「Rename」でタグ名がその場で入力欄になる。Enter 確定 / Esc 取消 / blur 確定、同名(大小無視)はアンバー下線で弾く。フィルターのドロップダウン行 + triage チップ両方。共通ロジック [lib/board/use-inline-tag-rename.ts] + [components/board/InlineTagRenameInput.tsx]。FilterPill は rename 対象が来たらドロップダウンを自動で開く（カードのタグpillから rename しても編集行に着地）。
2. **③ 並び替えを直接ドラッグに** (掴み手 ⠿ 全廃): 行/チップを直接 press → 6px 動かしたらドラッグ、ちょん押しはクリック(絞り込み/arm)維持。端で自動スクロール(フィルター↕ / triage↔、スクロール補正で掴んだ要素がポインタに追従)。共通フック [lib/board/use-drag-reorder.ts] + 純粋ヒットテスト [lib/board/drag-reorder-geometry.ts]。**🐛 triage 右方向バグを systematic-debugging で根治**: gap 判定が掴んだ要素自身の(平行移動した)矩形を含んでいたため高index方向が no-op だった → 掴んだ要素を除外(memory `reference_drag_reorder_exclude_dragged_hittest`)。フィルター縦の下方向も同根バグだったので一緒に解消。
3. **④ デフォルト名前順 + 昇順降順トグル + 手動モード**: 既定はアルファベット順(日本語あいうえお順、locale-aware)。新タグは自動で正しい位置。フィルターの TAGS ヘッダー横に「A→Z / Z→A」トグル(自動時は緑)。手で1回ドラッグすると手動モード(A↕Z)に切替・以後その順を保持・新タグ末尾。設定は独自キー `tag-order-mode` に永続化(BoardConfig と分離)。[lib/board/tag-order.ts] + [lib/storage/tag-order-mode.ts] + useTags 改修。

**追加 ship (= 同 session 後半、 本番反映済)**:

4. **TITLE (背景タイポ) トグル**: TUNE 左隣に `●│TITLE` (LED)。板の大きな背景文字 (AllMarks / フィルター名) を表示/非表示、`BoardConfig.bgTypoEnabled` に永続化。新規 `ChromeLedToggle` (汎用 LED トグル)。
5. **共有がタイポ追従**: 共有プレビュー (ShareMirror) + OG 画像 (capture-mirror) に背景タイポ描画 (元から欠けていた = §未対応バグ (b) 解消)。TITLE OFF なら共有にも出さない。
6. **TITLE 出現エフェクト**: ON でカード出現と同じ CRT ブートアップ (`lib/animation/tag-entry`) を wordmark に。テーマ駆動。
7. **🔴 安定化**: 「ON なのにタイトルが消える」不安定バグを根治。可視性をアニメ (`fill:forwards`+`onfinish`) に依存させていた競合が原因 → **可視性は `enabled` の純粋関数 (マウント=表示)**、出現は mount 1 回の飾り (`fill:'none'`) に作り直し。memory `feedback_visibility_never_from_animation`。OFF は確実性優先で即時非表示 (退場演出は次回 正式 enter/exit で任意)。

**🔴 user 本番確認待ち** ([CURRENT_GOAL.md](./CURRENT_GOAL.md) に確認シート): ②③④ + TITLE トグル/エフェクトの体感 + 微調整余地(自動スクロール速度 / ドラッグ閾値 6px / トグル置き場所 / 出現エフェクトの強さ)。

**プロセスメモ**: wrangler の git commit message 由来の reject 回避に `--commit-message` で ASCII 上書き。git commit -m のメッセージ本文にバッククォートを使うと bash がコマンド展開して 1 語落ちる(今回 `order` が消えた、無害)→ 以後使わない。

### 一つ前 (セッション 93 — タグ周り 4 機能を本番 ship + 次回 rework 方針を確定)

**ship 済 (= 本番 `booklage.pages.dev` 反映済、 tsc 0 / 942 tests pass、 全て Playwright 実機検証済)**:

1. **タグ名を全箇所で小文字表示**: ユーザーが付けたタグ名だけ強制小文字(枠ラベル ALL/TRASH/DEAD LINKS 等は大文字維持)。board 6 箇所 + 共有 5 箇所。表示のみ(CSS text-transform / 該当枝の toLowerCase)、保存値は不変。
2. **共有まわり修正 2 件**: (a) 共有のタグ名も小文字、 (b) **🐛 共有がフィルター絞り込みを反映しないバグ修正** — タグ絞り込み時 board は演出のため全カードを保持(`filteredItems`=全件)+ 表示は `matchedBookmarkIds` で該当のみ再レイアウト、なのに共有が `filteredItems`(全件)を見ていた。共有を `lightboxNavItems`(該当のみ)+ 該当を再計算した `shareLayout` に切替 ([BoardRoot.tsx](../components/board/BoardRoot.tsx))。
3. **タグ名リネーム**: 右クリックメニューに「Rename」追加 → [RenameTagDialog](../components/triage/RenameTagDialog.tsx)(モーダル)。重複ガード(大小無視)。**→ session 94 でインライン編集に作り直す予定**。
4. **タグ並び替え**: フィルターのドロップダウン + triage で掴み手(⠿)ドラッグ。`computeReorder`([lib/board/reorder.ts](../lib/board/reorder.ts)) + `useTags().reorder` 新設。window pointer listener 方式(setPointerCapture 不使用)。**→ session 94 で掴み手廃止 + 直接ドラッグ + 自動スクロール + 右方向バグ修正に作り直す予定**。

**🔴 user フィードバック (本番確認後) → session 94 で rework 確定** ([CURRENT_GOAL.md](./CURRENT_GOAL.md) に詳細):
- ② リネーム = モーダル廃止 → **その場でインライン編集**
- ③ 並び替え = 掴み手廃止 → **掴んで動かすだけ(threshold)** + **端で自動スクロール** + **triage 右方向バグ修正**
- ④ **デフォルト名前順(あいうえお順含む)** + 追加時に自動で正しい位置 + **昇順/降順ボタン** + 手動ドラッグ後は手動モード

**プロセスメモ**: デプロイ中に Cloudflare の OAuth ログインが期限切れ → `npx wrangler login`(ブラウザで Allow)で復旧。デプロイ前に `whoami` 確認。

### 一つ前 (セッション 92 — board / triage の小改善を多数 ship)

**ship 済 (= 本番反映済、 全て tsc 0 / 925 tests pass)**:

1. **board スクロール下限を制限**: 最後のカードの下の余白を固定 600px → 「viewport 高さ × 0.5」 に。 一番下までスクロールしても最後のカードが画面中央で止まり、 背景だけの空白に入れない ([BoardRoot.tsx](../components/board/BoardRoot.tsx) `BOTTOM_OVERSCROLL_FRACTION`)。
2. **カード +TAG ポップアップ改善**: マウス離脱で 0.7 秒 grace 後に閉じる + 開閉マイクロアニメ (top-left origin の scale+fade、 TUNE と同 easing) + ポップアップを持つカードを z-index 900 に上げ隣接カードに被らないように。
3. **focus ring 四角枠の抑制**: triage のタグチップ + YES/NO + board のタグ chip/pill + FilterPill に `onMouseDown preventDefault`。 マウスクリックで focus が残らない (= 次のキー操作で :focus-visible 枠が出ない)、 Tab focus は維持。
4. **Lightbox ナビがタグ絞り込みを尊重**: タグ filter 中、 左右/ホイール/メーター送りが「該当カードのみ」 を巡回 (旧 `filteredItems` 全件 → 新 `lightboxNavItems`)。 件数表示 N/M も該当数基準に。
5. **triage テキストカードに placeholder 画像**: サムネ無しカードが黒背景 → board と同じ `pickPlaceholderImage` で 4 種画像表示 ([TriageCard.tsx](../components/triage/TriageCard.tsx))。
6. **triage 背景 (AmbientBackdrop) も placeholder 画像**: テキストカードの背景ぼかしもカードと同じ画像で一致。
7. **triage カード画像の先読み**: 次 4 枚 + 前 1 枚を `new Image()` でプリフェッチ、 スワイプ時の黒→パッ pop-in を解消。
8. **triage タグ列 overflow 対応**: +TAG を右端固定 (スクロール外、 常に見える) + タグ列を狭めて中央ガラス幅 (左右 112px) に揃え + 強フェード (72px、 先がある側のみ) + ホイール横送り + **開いた瞬間からフェード表示** (内側行も ResizeObserver + rAF/60ms/200ms 多段測定で初回測定の取りこぼし解消、 Playwright 実機で edge='start' + mask 適用を確認)。
9. **triage ヒント文を英語化**: `1-9 タグ ON/OFF · Z 取り消し` → `CLICK TO TOGGLE TAGS · Z TO UNDO` ([messages/ja.json](../messages/ja.json))。

**未解決として TODO 追加**: 「スクロール中にカードの場所が入れ替わる問題」 (§未対応バグ、 真因未特定、 別 session)。

**プロセス反省 (= 次 session で厳守)**: 途中、 ツール呼び出しの記法が壊れて編集が未適用なのに「ship した」 と誤報告 → user 指摘。 以後 **(a) 実機 (Playwright) で挙動を測ってから報告、 (b) ビルド成果物 + 本番チャンクに変更が入ったか確認してからデプロイ完了を宣言** する。 memory `feedback_verify_before_claiming` の再徹底。

### 一つ前 (セッション 91 — master push 同期 + ScrollMeter 下帯移設を試作→revert + 右端アイデア記録)

**確定 (= 本番反映済)**:
- session 88-90 の 14 commits + 本 session の revert を **master push 済** (origin 同期完了)。
- **フィルターのホバー開閉アニメ (session 90 ship)**: user 本番確認「OK」。
- **ドメイン `allmarks.app`**: user が購入直前までいったが **カード拒否で取得できず**。生活が落ち着くまで **取得は棚上げ (急がない)** で合意。
- **一般公開・拡張ストア公開は「ドメイン取得後」に確定**: 理由 = 全データがブラウザのローカル保存で **URL (origin) 単位**。今 `booklage.pages.dev` で公開して後で `allmarks.app` に移すと、ユーザーのブクマが新 URL に自動で移らない (バックアップ手動 export/import でしか運べない = [BackupButton.tsx](../components/board/BackupButton.tsx) は存在する)。**「ユーザーに手動移行を強いたくない」= 最初から最終 URL で公開する**、が user 判断。拡張も `booklage.pages.dev` を保存先に見ているので一蓮托生。なお Chrome 拡張の再審査中もユーザーは使用継続できる (審査でダウンタイムは出ない) ことは確認済。
- **旧名 "Booklage" 残存**: 画面・拡張・LP・i18n の **見える表記はすべて AllMarks 済** (大文字 "Booklage" は app/components/extension/messages/lib で 0 件)。残る小文字 `booklage` は URL / DB 内部名 (`booklage-db`) / CSS クラス名等の **不可視な内部符号のみ**で、DB 名は変えると既存データ消失なので **意図的に維持**。ドメイン移行とセットで一括対応する。

**試作→却下 (= 本番は元のまま)**: ScrollMeter (波形+数字) を canvas 内から **外枠の下帯へ移設 (B1)** を実装・本番確認したが、**下帯 48px では余白不足で窮屈** (波形下端 16px でも「あまり良い感じがしない」) → **revert 済** (本番は元の canvas 内・下24px+下スクリムに戻り済)。
- 代わりに user 発案「**メーターを右端 (縦置き) に出す**」を [docs/private/IDEAS.md](private/IDEAS.md) §L に記録。次に board chrome を触るときの選択肢。

### 一つ前 (セッション 90 — X 削除ツイートのリンク切れ検出を実装 ship、 2 大タスク完結)

**ship 済 (= master + 本番 booklage.pages.dev 反映済、 4 commits + 1 deploy)**: 2 大タスクの残り片方「X 削除ツイートの dead 検出」を完了。 これで **2 大タスク (重い問題 / dead 検出) は両方クローズ**。

- **問題**: `/api/ogp` は X 削除ツイートに 404/410 を返さない (生きてる風の 200) ため永遠に「生きてる」 と誤判定 → DEAD LINKS に出てこなかった。
- **解決 (Approach A)**: 既存の注入可能 `Fetcher` にツイート対応の振り分けを追加。 ツイート URL は syndication 経由 (`/api/tweet-meta`) で存在確認、 それ以外は従来どおり `/api/ogp`。
- **判定**: 404 → gone / 200+`__typename:"Tweet"`+id_str → alive / それ以外の 200 (tombstone = 凍結・鍵アカ・年齢制限) → gone / 5xx・timeout → unknown (据え置き)。 「生きてると確認できた時だけ alive、 それ以外は全部 gone」 の安全側述語 (user 合意「全部まとめてリンク切れ扱い」)。
- **変更**: 新規 [lib/board/tweet-liveness.ts](../lib/board/tweet-liveness.ts) (`checkTweetLiveness` + `createCompositeFetcher`) + 新規 test 11件 + [BoardRoot.tsx](../components/board/BoardRoot.tsx) で fetcher を 1 行差し替え。 **DB 変更なし / Cloudflare 関数 改修なし** (`/api/tweet-meta` は既に本番稼働)。
- **検証**: tsc 0 / 全 **925 tests pass** / build 24 routes / 本番デプロイ後 `/api/tweet-meta` 実測で alive=200・削除=404 確認。 出力側 (DEAD LINKS フィルター + バッジ) は session 88 完成済なので検出が直結。
- **🔴 user の実機確認が残り**: 実 IndexedDB に残る削除ツイートのブクマを開く/画面に入れる → DEAD LINKS に「リンク切れ」 で出るか (= 7日 guard により前回チェックから時間が経ったカードで発火)。 → **user 確認済「バッジついてました」**。

**追補 ship 1 (= 同セッション、 本番反映済)**: user 依頼でリンク切れバッジを刷新 + DEAD LINKS フィルター常時表示。
- バッジ: くすんだ角丸ピル → **左上角を覆う真っ赤な三角ウェッジ + 白い壊れたリンクアイコン** (角丸はカードに追従、 1 枚 SVG)。 薄グレー化を子要素へ移してバッジは vivid 維持。
- フィルター: DEAD LINKS を **0 件でも常時表示** (TRASH と同様)。
- user 本番確認「とてもいい」。

**追補 ship 2 (= 同セッション、 本番反映済)**: フィルターボタンを TUNE と同じホバー挙動 + 開閉アニメに。
- **ホバーで開く** (click でピン留め、 離れて 0.7 秒で閉じる) + **grid `0fr`→`1fr` のアコーディオン開閉** (TUNE と同じ easing、 中身の高さぴったりに伸縮) + **文字スクランブルを出る/消える両方**。 閉じた時は完全 0 height (line/余白なし)。 開いた panel の見た目は不変。
- 変更 = [FilterPill.tsx](../components/board/FilterPill.tsx) + [FilterPill.module.css](../components/board/FilterPill.module.css)。 内側に clip 用 `.menuInner` 1 枚追加。

**session 90 合計**: tsc 0 / 925 tests pass / build 24 routes / 計 9 commits (内 doc 3) + 3 deploy。 master ahead、 **未 push**。 **user の本番最終確認待ち** (バッジ + フィルター開閉)。

詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 90 セクション

---

### 一つ前 (セッション 88 — PlaceholderCard 統合 + フィルター件数表示・開閉アニメ + デッドリンク縦伸び fix、 5 commits 本番 ship)

**ship 済 (= master + 本番反映済、 commits `06688c6` 〜 `4672121`、 5 commits + 5 deploys、 未 push)**:

1. **board の TextCard / MinimalCard / ImageCard-onError を PlaceholderCard に統合** (`06688c6`): 新規 `PlaceholderCard` (= AI placeholder 画像 bg + scrim + 中央スクロールタイトル + 左上ホスト名、 favicon なし)。 `pickCard` を 4 → 3 経路に (YouTube/TikTok→VideoThumb / thumbnail→Image / それ以外→Placeholder)。 Lightbox の `LightboxTextDisplay` (= session 37 以降 dead code) 削除、 `LargeTextCardScaler`→`LargePlaceholderCardScaler` rename。 旧 6 ファイル削除 (TextCard.tsx/.module.css, MinimalCard.tsx/.module.css, text-card-color.ts, text-card-measure.ts)。 triage 完了画面 (= ダサい「All done」 CTA) を board 自動遷移に。 **net -529 行**。

2. **PlaceholderCard 上端切れ fix** (`369ef46`): 当初 `align-items: center` で長文 title が中央 anchor になり上端が overflow 領域に押し出される bug → block scroll (上端 start) に戻して解消。

3. **フィルター件数表示 + 並び替え + 開閉アニメ** (`4cac935` + `4672121`):
   - 各タグ行に bookmark 件数 (= active set)、 0 件は muted
   - 構造変更: ALL 上固定 → TAGS スクロール領域 (約 8 行で頭打ち、 生スクロールバー隠し + 上下フェードで続き示唆) → TRASH/DEAD LINKS 下固定 (常時見える)
   - 開閉アニメ: open = menuIn (160ms, pill から展開) / close = menuOut (130ms, pill へ collapse)、 close アニメ後 onAnimationEnd で unmount (= render/open 分離)。 reduced-motion でも 1ms close で確実 unmount

4. **デッドリンク「縦伸び」 fix** (`4cac935`): サムネ画像 404 → ImageCard が PlaceholderCard に fallback する時 `reportIntrinsicHeight` を forward してなかったため、 死んだ画像の縦長 aspect (0.6) のままだった → forward して 1.25 に補正。 playwright で 0.6→1.25 補正を実機 verify。

**検証**: tsc 0 errors、 Card/filter 関連 19 tests pass、 build 22 static routes、 playwright で実機 verify 多数 (PlaceholderCard aspect / フィルター dropdown 件数・スクロール・fade / 開閉 unmount ライフサイクル)。

**user との重要なやりとり / 設計判断 (= session 88 で確定)**:
- **board と Lightbox は別 DOM** (= session 86 確定): Lightbox は `LargeBoardCardClone` で board card を cloneNode + 拡大。 board の PlaceholderCard 化で Lightbox も自動連動 (= 見た目一貫)
- **Lightbox 文字 jump は zoom/scale 無関係と判明** → 棚上げ。 HTML 単体検証で zoom と transform:scale は段組み完全一致 (offsetWidth 224/6行)。 真因未特定。 center anchor 撤廃で「上切れ」 は解消したが「文字ガタガタ動く」 は残る → user が一旦棚上げ OK
- **デッドリンク方針**: X 削除ツイートを検出したら `linkStatus='gone'` → DEAD LINKS フィルター + 「リンク切れ」 バッジ。 user が「DEAD LINKS をフィルターに書くのが良い」 と確認
- **2 大タスク認識合わせ**: (1) 重い問題 = virtualization (viewport culling)、 (2) デッドリンク = X 削除ツイート存在チェック。 どちらも 1 sprint 規模

**🔴 次セッション (89) の最優先候補 (= 2 大タスク + 棚上げ)**:

1. **重い問題 (virtualization / viewport culling)** — 300+ カードで board が重い。 skyline masonry は position absolute なので縦リスト virtualization の亜種 (= 画面に映る矩形と重なる card だけ render) が必要。 1 sprint 規模
2. **X 削除ツイートの dead 検出** — `/api/ogp` は X 削除ツイートに 404/410 が返らず検出不可。 `cdn.syndication.twimg.com` でツイート ID 存在チェック (Cloudflare Pages Function 経由、 memory `reference_twitter_syndication_cors`) を組む。 検出したら `linkStatus='gone'` で既存の DEAD LINKS フィルター + バッジに流れる
3. **(棚上げ) Lightbox 文字ガタガタ jump** — center anchor 撤廃後も残る。 真因未特定 (zoom/scale は無関係と判明済)。 board→Lightbox の morph 中の何か。 user 棚上げ OK だが要再調査
4. **(backlog) ツイート両言語表示** — IDEAS.md (I-01)、 原文 + 翻訳トグル。 単独 sprint、 syndication API が両方返すか技術調査が前提

詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 88 セクション

---

### 一つ前 (セッション 87 — シェアミラー残課題 fix + watermark + AI placeholder + 致命的 orderIndex バグ修正 + newest-at-top 切替、 5 commits 本番 ship)

**ship 済 (= master + 本番反映済、 commits `aef5...` 〜 `84d9...`、 5 commits + 5 deploys)**:

1. **シェアミラー 構造 fix** (= 残課題 ①): bg の `.outerFrame` (48px) + `.canvas` + 内側 80px (BOARD_TOP_PAD) + 9px (SIDE_PADDING) を全部ミニチュアに再現。 playwright で bg vs mirror カード座標の ratio 0.458 で一致 verify。 user 意図「ちゃんと画面を再現」 実装。

2. **シェアミラー img onError fallback** (= 残課題 ②): pbs.twimg.com 等 CORS 拒否 URL で img 表示不能時、 cardTextBody (= 文字主体) に自動 swap。 4 ケース (= 正常 URL / CORS 拒否 / 存在しないホスト / 空文字) 全部 playwright verify。

3. **ALLMARKS ウォーターマーク**: A logo SVG (= 24px 米粒) を `ALLMARKS` テキスト (Geist Mono 13px) に置換、 右側 caption と対称。 capture-mirror.ts 側も `drawALogo` 廃止 → `fillText('ALLMARKS')` で OG 画像にも反映。 ドメイン `allmarks.app` 取得後 wordmark に追加予定。

4. **placeholder 画像 system + AI 4 枚**:
   - 第 1 弾 ship 時は barcode SVG プレースホルダ (= user 「微妙」 で却下)
   - 最終: AI 生成 4 枚 (`dark` ぼかし人物 / `light` 飴細工 / `jewel` 宝石色 / `fog` 水面) を `public/placeholders/` に WebP 配置 (= 合計 156KB、 元 PNG 7.6MB の 2%)
   - `lib/board/placeholder-image.ts` で URL ハッシュベース決定論的配信 + 各画像の aspect 情報保持 (= board 拡張時にサイズ感の差として活きる)
   - 適用先: ShareMirror の MirrorCardContent (= thumbnail 無し / img 失敗時に画像 bg + 中央タイトル + 上下フェード)

5. **🔴 致命的バグ: orderIndex 衝突 + 「最新ブクが途中に紛れる」 修正**:
   - 原因: `addBookmark` が `nextOrder = await db.count('bookmarks')` だった。 EMPTY TRASH で物理削除すると count が下がるが max orderIndex はそのまま → 新ブクが既存 orderIndex と衝突 → 非決定的ソートで途中位置出現
   - fix: `nextOrderIndex(db) = max(orderIndex) + 1` ヘルパー追加、 addBookmark + addBookmarkBatch 両方更新
   - **sort 方向反転** ASC → DESC (= 業界標準「最新が top」 = Pocket / Raindrop / Instapaper / mymind と同じ)
   - `persistOrderBatch` + `updateBookmarkOrderBatch` の indexing も reverse (= 視覚 top = 最高 orderIndex)
   - **migration v2**: 起動時 1 回限定で savedAt 降順に全ブク resort → 最新が top に並ぶ (v1 は「並び順保持」 で user 体感ゼロ → v2 で再修正)
   - 設定 store flag `orderIndexRepairV2` で idempotent ガード (= 二度目以降は手動 drag を破壊しない)

**検証**:
- vitest 897 → **906** (= +9 net、 0 fail)
- tsc 0 errors
- build 22 static routes
- playwright で実機 verify: bg/mirror ratio 一致 + onError fallback 4 ケース + scroll sync ratio 0.457 + AI 画像 4 枚分散配信
- 本番 [`booklage.pages.dev`](https://booklage.pages.dev) reflect 済、 user 朝起床後の確認待ち

**user の重要発言 + 設計判断 (= session 87 で確定)**:
- **「業界標準 = 最新が上」**: Pocket / Raindrop / Instapaper / mymind に揃える
- **「並び順に拘りない」**: migration v2 が user の手動 reorder を上書きすることに同意済
- **「業界に無いけど ブックマーレットに絵文字付けない」**: bookmarklet 名は plain `AllMarks`
- **「画像が無いカードが気になる」**: AI placeholder 4 枚で対応
- **「TextCard 統合 OK」**: 次 sprint で board の TextCard / MinimalCard / ImageCard-onError 統合 = 約 300 行コード削減予定
- **「favicon 要らない、 サイト名は左上に小さく」**: 次 sprint の PlaceholderCard 仕様
- **D1 中断再開 不要**: manage button で事実上同等 → release blocker から削除

**設計上の重要発見 (= memory 候補)**:
- **「count vs max(orderIndex)」 の罠**: EMPTY TRASH で物理削除する store の append-order は count NOT 信頼できる、 必ず max+1 を使う
- **「migration の semantic」 確認の必要性**: 「user の order を保持」 と「業界標準に合わせる」 は別物、 実装前に 1 行確認する (= 今回 v1 で「保持」 と読み取って失敗、 v2 で「再ソート」 に再修正)
- **placeholder 画像の aspect 情報を lib に持たせる**: 4 枚 1:1 が単調にならないよう、 16:9 1 枚で「サイズ感の差」 を board に作る user 意図

**次 sprint で待ってる残課題**:

🔴 **user 確認 2 件** (= session 88 開始直後):
1. orderIndex 修正 + sort 反転で「最新ブクが top に並ぶ」 体感確認
2. ミラー placeholder の 4 枚 AI 画像 + 文字読みやすさ確認

→ OK なら **board の TextCard 削除 + PlaceholderCard 統合 + 左上ホスト名表示 + マネージ画面のダサい完了画面除去** に着手。

詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 87 セクション

詳細 + 次セッションの進め方: [docs/CURRENT_GOAL.md](./CURRENT_GOAL.md)

---

### 一つ前 (セッション 86 — シェアモーダル UX 再設計完遂、 ミラー + 同期スクロール + Canvas キャプチャ 本番 ship)

**ship 済 (= master + 本番反映済、 commits `d3a22b7` 〜 `a0bc84b`、 9 commits + 1 production deploy)**:

1. **OG プロキシ Pages Function** ([functions/api/share/[id]/og.ts](../functions/api/share/[id]/og.ts)) — KV thumb (= base64 WebP) を bytes として配信、 1h edge cache + 24h s-maxage、 SNS crawler 用

2. **Canvas API でミラー DOM 直接 drawImage** ([lib/share/capture-mirror.ts](../lib/share/capture-mirror.ts)) — session 85 の dom-to-image-more OOM 完全回避、 cross-origin 失敗 fallback、 brand 帯 baked、 ライブラリ依存ゼロ

3. **ShareMirror コンポーネント** ([components/share/ShareMirror.tsx](../components/share/ShareMirror.tsx)) — 1.91:1 frame、 MOTION OFF 状態のサムネ + タイトルだけの軽量 DOM、 ResizeObserver で frame width 取得 + cardsLayer に `scale` 適用 (= WYSIWYG)

4. **SenderShareModal 再設計** ([components/share/SenderShareModal.tsx](../components/share/SenderShareModal.tsx)) — ミラー埋込 + SHARE NOW 確定 + capture-mirror 配線、 panel 480px → 720px に拡張、 wheel forwarding for sync scroll

5. **BoardRoot 配線** — `scrollY` / `contentHeight` / `viewportHeight` / `activeTagNames` / `onPanY` を SenderShareModal に渡す

6. **patch-share-html.ts** — `og:image:height` 627 → 628 (= capture-mirror の 628 出力と一致)

7. **dead code 清掃** — 旧 `lib/share/snapshot.ts` (= placeholder、 139 行) + `getCanvasEl` useCallback 削除

8. **vitest.setup.ts** に ResizeObserver no-op stub 追加 (= jsdom 補助)

**検証 (= テスト + build + 本番 deploy 完了)**:
- vitest 882 → **896** (= +14 net、 0 fail)
- tsc 0 errors
- build 21 routes 全 static export 成功
- 本番 [`booklage.pages.dev`](https://booklage.pages.dev) reflect 済、 user 検証待ち

**設計判断の核心 (= brainstorming で決まった 5 つ)**:
1. workers-og 不採用 (= 当初推奨を user 指摘で反転、 client capture + KV プロキシで cost 健全)
2. ミラー = MOTION OFF 別 DOM (= bg board CSS scale は DOM walk コスト残るので不採用)
3. Canvas API 直接 drawImage (= dom-to-image-more の OOM 回避)
4. ブランド帯はミラー DOM の一部として組み込み (= WYSIWYG)
5. 同期スクロール = bg + mirror が同じ scrollY で動く (= wheel forwarding)

**final code review が拾った Critical 3 件 + fix ([a0bc84b](../../commits/a0bc84b))**:
- ミラー座標系不一致 (= 1200 logical px vs ~684 CSS px、 60% しか見えてなかった) → ResizeObserver + scale 修正
- 同期スクロール wheel forwarding 未実装 → backdrop onWheel + onPanY 配線
- scroll math 座標系不一致 (= 220 CSS px と worldHeight mirror coords 混在) → MIRROR_FRAME_HEIGHT (= 628) で統一

詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 86 セクション

詳細 spec: [docs/superpowers/specs/2026-05-27-share-mirror-capture-design.md](./superpowers/specs/2026-05-27-share-mirror-capture-design.md)

詳細 plan: [docs/superpowers/plans/2026-05-27-share-mirror-capture.md](./superpowers/plans/2026-05-27-share-mirror-capture.md)

**🔴 次セッション (87) の最優先**:

1. **allmarks.app ドメイン取得確認** (= 2026-05-28 朝以降の見込み、 user 報告予定)
2. **未解決問題 2 件を playwright で実機 verify してから fix** (= session 86 で 2 回 fix dispatch したが両方とも実機で効いてなかった、 unit test 通っただけで「動いてる」 と user に投げてしまった):
   - **ミラーが bg と同じ範囲を映してない** (= 試した 3 fix `a0bc84b` / `535783f` / `85e01e9` 全部 NG、 根本原因未特定)
   - **テキストカードが空っぽ** (= 試した 1 fix `85e01e9` NG)
3. minor 残課題 (= ロゴ・font サイズの CSS/canvas 不一致、 thumb 上限超過時の quality fallback)

**詳細 + 次セッションのプロセス改善**: [docs/CURRENT_GOAL.md](./CURRENT_GOAL.md) 参照。 playwright で実機検証してから fix する手順を必ず守る。

---

### 一つ前 (セッション 84 — シェア機能 Phase 3-6 実装 ship / Phase 7 で architectural blocker、 次セッション Pages Function 化へ持ち越し)

**ship 済 (= master に 21 commits、 ただし本番未反映)**:

1. **Phase 3 完成** (Tasks 12-15、 4 commits): 送信側 SenderShareModal + BoardRoot 配線
   - `lib/share/import.ts` (= `findDuplicates` + `convertSenderTagsForReceiver`)
   - `components/share/SenderShareModal.tsx` + `.module.css` (= 軽量 modal、 黒 + 緑 + monospace + convex bezel + ESC/backdrop close)
   - SenderShareModal に snapshot + API 配線 (= viewport WebP + POST `/api/share/create` + COPIED toast 1.5 秒)
   - BoardRoot の SHARE button を新 modal に切替 (= 旧 ShareComposer は Phase 6 で削除)

2. **Phase 4 完成** (Tasks 16-22、 7 commits): 受信側 ReceiverLanding
   - `/s/[id]/page.tsx` + `ReceiverLanding.tsx` (= fetch + state machine + masonry 流用 + bulk import + inline Lightbox + 背景タイポ)
   - `BulkImportToast` component (= "N CARDS SAVED · M ALREADY SAVED" 4 秒 toast)
   - 既存 `lib/board/skyline-layout` 流用、 `SkylineCard` / `{x,y,w,h}` / `totalHeight` の実 API に adapt

3. **Phase 5 完成** (Tasks 23-26、 4 commits): 受信側 ReceiverTriage
   - `/s/[id]/triage/page.tsx` + `ReceiverTriage.tsx` (= queue + YES/NO + sender tag suggestions + receiver 既存 tags chip + completion toast)
   - `convertSenderTagsForReceiver` で name-based merge、 新規 tag は受信者側 `addTag` で作成 + bookmark に紐付け

4. **Phase 6 完成** (Tasks 27-30、 4 commits): 旧実装の完全削除
   - 旧 ShareComposer + ShareFrame + SharedView + ShareSourceList + ShareAspectSwitcher + ShareActionSheet + use-share-* 全廃
   - 旧 `/share` route 削除 (= `app/(app)/share/page.tsx`)
   - 旧 lib/share v1 modules (= aspect-presets / board-to-cards / composer-layout / decode / validate / relay-layout / schema / encode / png-export / watermark-config) 削除
   - `lib/share/types.ts` + `lib/share/lightbox-item.ts` は board の Lightbox 用途で温存 (= share-feature とは別)
   - BoardRoot.tsx から `handleShareConfirm` + `actionSheet` + ShareActionSheet JSX + 4 legacy import + dynamic png-export import 全 31 行削除

5. **build fix** (1 commit): `lib/share/snapshot.ts` の `dom-to-image-more` を top-level import から dynamic import (`await import(...)`) に変更 (= `/board` の SSR HTML shell prerender で `Node is not defined` を回避)

**進め方**: subagent-driven (= task ごとに fresh general-purpose agent + checkpoint review)、 trivial copy-paste task は review 1 段に簡略化

**検証 (= Phase 3-6 完了時点)**: tsc 0 errors / vitest 843 PASS / 既存テスト regression なし

**Phase 7 architectural blocker (= 本番 ship を次セッションに持ち越した理由)**:

`pnpm build` が `Cannot find module 'app-edge-has-no-entrypoint'` で死亡。 根本原因は session 83 設計時の判断ミス:

- `/s/[id]` route が `runtime = 'edge'` + dynamic segment + `dynamic = 'force-dynamic'` を使用
- プロジェクトは `output: 'export'` (= 完全静的書き出し、 事前に全 HTML を生成して Cloudflare に配置する方式)
- 静的書き出しと edge runtime + 動的セグメントは共存不可能 (= シェア ID は実行時生成なので `generateStaticParams()` で事前列挙不可)

**解決方針 (= 次セッションで実施、 user 「B」 確定)**: Cloudflare Pages Function `functions/s/[id].ts` で HTML を直接返す方式に切替。 per-id OG metadata を維持して X 投稿でのバイラル性を担保。 詳細設計: [docs/superpowers/specs/2026-05-28-share-pages-function-design.md](./superpowers/specs/2026-05-28-share-pages-function-design.md)

**本番 (booklage.pages.dev)**: 旧コードのまま (= ship 前なので user 影響ゼロ、 SHARE ボタン押すと旧 ShareComposer = 画像エクスポートが動く)

**次セッション (= 85) のゴール**:

1. Pages Function 設計 spec を読み込み (= [docs/superpowers/specs/2026-05-28-share-pages-function-design.md](./superpowers/specs/2026-05-28-share-pages-function-design.md))
2. `app/(app)/s/[id]/page.tsx` + `app/(app)/s/[id]/triage/page.tsx` を削除
3. `functions/s/[id].ts` + `functions/s/[id]/triage.ts` 新規実装 (= HTML 組み立て + per-id OG + JS bundle 参照)
4. ReceiverLanding / ReceiverTriage を pathname から ID 抽出して boot するように修正 (= `params` prop 受け取り → `window.location.pathname` parse)
5. preview deploy で動作確認
6. 本番 ship

詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 84 セクション

---

### 一つ前 (セッション 82 — タグ削除 UI 復活 + フィルターボタン editorial 化 + favicon/floating button polish + Z 単純前カード undo + convex bezel)

**ship 済 (= 本番反映、 session 内 5 deploy)**:

1. **タグ削除 UI 復活 — /triage の chip 右クリック (= 第 1 段)**: 新規 `TagContextMenu` (= editorial 黒 panel、 11px monospace、 ⚠ Delete tag 赤行、 viewport clamp + 別 chip 右クリックで再 aim + Shift+Delete keybind) + `TagDeleteConfirmDialog` (= TrashConfirmDialog の 2 秒長押し recipe 流用、 タグ名大表示)。 削除完了で `deleteTagCascade` (= tag store + 全 bookmark scrub、 bookmark 本体は無傷)。
2. **タグ削除 UI 第 2 段 — board FilterPill dropdown + カード TagIndicatorStrip 右クリック**: 同じ menu / dialog を BoardRoot で render、 削除した tag が active filter に居たら `BOARD_FILTER_ALL` に自動リセット。
3. **フィルターボタン全面 editorial 改修**: panel `rgba(8,8,10,0.96)` + backdrop-blur + 角丸 8px、 `right: 0` anchor + `max-width: min(320px, calc(100vw-32px))` で画面外 clamp、 100ms fade + slide 出現、 行 11px monospace uppercase、 mouse leave **700ms grace** で close、 `TAGS` section header + `N OF M · OR` 緑 hint、 緑 dot indicator (= inactive 中空丸 / active 緑 fill + glow)、 active 行 緑 underline accent。
4. **TRASH 行ミュート赤** (= `rgba(220,130,130,0.78)` ローズ、 DEAD LINKS の警告赤と区別、 「破壊的だが日常」 の語感)。
5. **OR mode 統一**: `toggleTagInFilter` の default を `'and'` → `'or'` に。 dropdown 内タグ click は閉じない (= 複数選択 = どれか持つカード全部表示)。
6. **背景の大文字に絞り込みタグ全展開**: `deriveBoardBgTypoText` を「 ` · ` join」 に、 CSS `font-size: clamp(96px, 14vw, 260px)` + `text-wrap: balance` + `max-width: 95vw` で **floor 96px 到達後に自動 2 段** wrap。
7. **TagDeleteConfirmDialog 文言追加**: 「The bookmarks themselves stay — only the tag is removed.」 を `.assure` クラスで footnote 風 quiet 表示、 user の「カードまで消えない?」 不安解消。
8. **favicon + 拡張 floating button 透明箱削除**: SVG `<filter>` 2 つ (= innerShadow + `filterUnits="userSpaceOnUse"` で薄 box が Chromium で visible になる副作用) を全削除、 effect 自体は negligible。 mask + highlight path は維持で白枠線そのまま。
9. **favicon に白枠線追加**: `app/icon.svg` に mask + highlight path 追加で floating button と同じ「黒 A + 白枠 + 緑チェック」 3 層構成に揃える。 拡張 manifest v0.1.15 → v0.1.16。
10. **Z = 単純に前のカードに戻る**: `handleYes` / `handleNo` 両方で `setLastAction({ bookmarkId, prev })` を常に push (= 旧 `tagsChanged` check 廃止)、 `handleUndo` で `persistTags(prev)` (= idempotent、 タグ変更なしなら no-op) + queue 不変時の手動 `setIndex` 併用 → タグ変更あれば revert、 無くても index 戻る。
11. **convex bezel ガラス厚み試作**: `.canvas::after` 追加で上端→下端 linear-gradient (= 凸面照り反射) + inset box-shadow 4 方向 + inner soft rim highlight → ガラスが立体的なスラブ感、 試作値 user OK。

**user 視点 (= session 後の体験)**:

- 3 箇所どこから右クリックしてもタグ削除メニュー (= /triage chip / board chrome dropdown 行 / カード hover の左上タグ pill)、 全部同じ editorial 黒 menu + 2 秒長押し dialog + 「カードは残る」 安心文言
- フィルターボタン dropdown が editorial monospace に変身、 タグを click しても閉じない、 緑 dot が点く、 mouse 離れて 700ms で自動 close
- 複数タグ選ぶと OR mode (= どっちか持つカード全部)、 chrome label `Music +2` 短縮、 背景大文字は `MUSIC · DESIGN · CODE` 全展開 + 5+ タグで自動 2 段
- TRASH 行が DEAD LINKS と違うミュートローズ
- favicon に白枠線復活、 拡張フロートボタンも透明箱なし
- ガラスが**凸レンズ的に厚みを持って見える** (= 上端照り + 縁全周 highlight + 中央 soft rim)
- **Z で 1 枚前のカードに戻る** (= 何の操作後でも、 タグ変更あれば一緒に revert)

**テスト**: vitest **852 PASS** (= +23 net、 +17 menu/dialog + 5 board context + 2 typography 修正 - 1 旧 +N-1 形式 test)、 tsc 0 errors、 build 25 routes 全 success

**deploy 5 回** (= 1 日 16 上限内余裕)、 本番 https://booklage.pages.dev

**設計上の重要発見 (= memory 候補)**:

- **`onContextMenu` 系 panel の outside-click は「別 trigger pointerdown を ignore」** = `e.target?.closest('[data-tag-id]')` 等の marker check で自分から close しない、 親が直後に setMenu(new) する前に閉じると last write wins で消える
- **`filterUnits="userSpaceOnUse"` + 明示 region は Chromium で薄 box visible** = innerShadow filter の effect negligible なら filter 削除が clean、 effect 必要なら `objectBoundingBox` で region 追従
- **`text-wrap: balance` + `clamp(MIN, FLUID, MAX)` floor の組み合わせ = 自動 2 段 polish** = font-size floor 到達後に自然 wrap、 文字数 - font-size の trade-off を CSS だけで解決
- **Z undo を unified semantic にするには queue 不変時の手動 setIndex 併用** = useEffect は queue identity 変化で発火、 tags 変化なしは effect 走らない、 直接 setIndex で reposition

**未達 (= 次セッション持ち越し)**:

- **🔴 ドメイン**: **2026-05-28 朝以降 `allmarks.app` 取得確認** — 取得済なら `docs/private/2026-05-11-allmarks-branding-spec.md` 計画開始、 未取得なら取得促し
- ~~**Phase D1 中断再開**~~ — session 87 で user 判断「不要」 確定 (= manage ボタン経由で途中再開が事実上可能なので D1 単独機能は重複)
- **Phase D4 他 14 言語 mood → tag rename** (= `messages/{en,ar,de,es,fr,it,ko,nl,pt,ru,th,tr,vi,zh}.json` の `newMood` / `moodNamePlaceholder`)
- **Phase D5 NewMoodInput → NewTagInput 内部 rename** (= file + identifier)
- **onboarding チュートリアル** (= 初回ユーザー向け)
- **拡張機能 Chrome Web Store 公開準備**
- **convex bezel 数値調整** / **ハロ 0.5x 絞り** / **TrashConfirmDialog 2 秒 feel** / **TAG THIS. サイズ** — 全部「一旦 OK」 で棚上げ、 気が向いたら brushup

詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 82 セクション

---

### 公開向け残タスク (= session 83 以降の優先度順、 session 82 で整理)

**release blocker (= 公開前 必須)**:
1. ~~**ドメイン取得**~~ ✅ **2026-06-16 取得完了** (allmarks.app、 §ドメイン 参照) → 次はリブランド移行
2. ~~**Phase D4 mood → tag rename**~~ ✅ **session 101 完了** (下記 §i18n 参照)
3. ~~**Phase D5 NewMoodInput → NewTagInput 内部 rename**~~ ✅ **session 101 完了**
4. **🔴 i18n 言語切替の配線 (= 新ブロッカー、 session 101 で判明)** — 翻訳 15 言語は揃ったが [lib/i18n/t.ts](../lib/i18n/t.ts) が **ja.json 固定 import** のままなので外国語は誰の画面にも出ない。実際に locale 別で出す仕組みが要る。`output: 'export'` の制約 (静的 HTML は 1 言語で prerender → client 切替は flash/hydration mismatch、 marketing LP は SEO 影響) があるので **設計判断が要る = brainstorming してから着手**。方式候補: (a) per-locale 静的ルート (proper だが大) / (b) client-side runtime 切替 (board 中心なら可、 LP は要検討) / (c) アプリ内 言語ピッカー手動選択。**着手前に t() の利用箇所 (server/client・marketing/app) を洗う**
5. **onboarding チュートリアル** (= 初回ユーザー向け、 user 自身が複数回言及)
6. **拡張機能 Chrome Web Store 公開準備** (= manifest 整備、 audit、 アイコン整備、 説明文)
7. **LP 整備** (= 現 LP に share / 拡張機能 言及無、 update 要。 multi-playback は未実装なので謳わない)

**公開後でも OK (= 上澄み polish)**:
7. convex bezel 数値調整 (= session 82 試作 OK 後の微調整余地)
8. /triage 外周 4 段 bloom halo の 0.5x 絞り (= ハロ強すぎ件、 一旦 OK)
9. TagDeleteConfirmDialog 2 秒長押し feel (= 一旦 OK)
10. 「TAG THIS.」 サイズ + 緑パルス強度 (= 一旦 OK)

**別軸 (= 機能追加、 公開後の発展)**:
11. Song Bottle 風ブクマ交換 (= IDEAS.md)
12. multi-playback (= 複数動画/音声同時再生、 差別化の核、 IDEAS.md)
13. per-tag theme (= dominantColor + ThemeLayer 切替)

### foundation 3 本柱 (= セッション 32 以降)

セッション 30 で合意した骨組み:
1. **サイジング汎用化** (= clamp(MIN, vw, BASE)、 spec 既存 `docs/specs/2026-05-12-sizing-migration-spec.md`)
2. **manual tag schema** (= IDB schema bump + tag CRUD + filter)
3. **広告 placement 予約 slot** (= board / footer / PiP)

推奨順 (1) → (3) → (2)。 詳細は `docs/private/IDEAS.md` 既存セクション + 戦略 spec。

### 拡張機能 polish (= セッション 32 以降、 別 sprint)

セッション 30 で 3 項目合意 (詳細 IDEAS.md F 項):
- ✅ PiP 自動常駐 (= 高難度)
- ✅ SNS いいね / ブクマ連動 (X / YouTube から、 設定で挙動切替)
- ❌ 右クリック位置改善は不採用、 代替の ショートカット + floating action button で対応

### リブランド進行: Booklage → AllMarks (= 2026-05-16 コード rebrand 完了)

- 新ブランド: **AllMarks** / メインドメイン: **allmarks.app** (取得は月末 2026-05-31 予定)
- 詳細 spec: `docs/private/2026-05-11-allmarks-branding-spec.md` (gitignored)
- ✅ コード rebrand 完了 (= UI / i18n / 拡張 / docs / 型名 / log prefix 全部 AllMarks)
- 🔒 **意図的に維持**: `DB_NAME='booklage-db'`, deploy URL `booklage.pages.dev`, wrangler `--project-name=booklage`, `package.json` "name", bookmarklet 内 programmatic ID, GitHub repo 名
- 🔜 **ドメイン取得後**: Cloudflare Pages 新 project 作成 → 301 redirect → GitHub repo rename → 拡張機能ストア submit (AllMarks v1.0 として 1 回で)

---

## 🐛 未対応バグ・改善 (active backlog)

完了済バグは TODO_COMPLETED.md に移動済。 ここはアクティブのみ。

### 共有 (share) — 次セッション着手候補 (session 96 で user 要望)

- **受け取り画面 (/s/<id>/triage) をマネージ画面と同じ UI に** (session 96 user 要望) — 現状 [ReceiverTriage.tsx](../components/share/ReceiverTriage.tsx)(239行) はマネージ [TriagePage.tsx](../components/triage/TriagePage.tsx)(857行)/[TriageCard.tsx](../components/triage/TriageCard.tsx) を**全く再利用していない別物**。user は「マネージと同じ UI で文言だけ共有用に変える」体験を希望。ただし目的が違う (マネージ=自分のブクマ整理 / 受け取り=他人のを取り込み + 送り主タグ提案 + 重複検出) ので「共通部品を共有 + 取り込み固有の振る舞いを差し込む」設計が要る。**brainstorming で方針合意してから実装** (大改修、勝手にやらない)。マネージ側には session 95 の「画像ドラッグでタグ付け + ガラス演出」もあり、受け取りにも欲しいか含め要相談。
- **フィルターのタグ 1 つでもフェード(マスク)がかかり視認性が落ちる** (session 96 user 報告) — コード上はフェードは overflow 時のみ ([FilterPill.module.css:228](../components/board/FilterPill.module.css#L228) `data-scroll-edge !== 'none'` の時だけ mask、[FilterPill.tsx:120](../components/board/FilterPill.tsx#L120) `updateTagScroll` が `canScroll` 判定)。1 タグなら overflow しない→`none`→マスク無しが理屈なのに**実際はフェードが見える＝理屈と現実がズレ**。**実機(Playwright)で 1 タグ状態の dropdown を計測して真因特定してから直す** (憶測で触らない)。`.menu` 等別要素のフェード混入 or `data-scroll-edge` 初期値/measure タイミングの誤りを疑う。

### 表示・サムネ系

- ~~**B-#23 Vimeo / SoundCloud Lightbox 再生未対応**~~ ✅ session 51 で完遂 (= 専用 Embed コンポーネント追加 + 全 embed 共通 50% 音量デフォルト + SoundCloud カスタムスライダーまで波及)
- ~~**B-#22 長文 tweet Lightbox 末尾だけ表示 bug + 全文表示 enhancement**~~ ✅ session 52 で完遂 (= cleanTitle 過剰マッチ修正 + TextCard 透明グラス redesign + scroll + persistTitle backfill 開通 + font jump 解消、 9 file 変更 / 5 deploy / 19 unit test 追加)
- **スクロール中にカードの場所が入れ替わる問題** (session 92 で再確認、 未解決) — 手動スクロール中に skyline masonry の bin-packing が再計算され、 カードの配置が動的に入れ替わって見えることがある。 viewport culling (画面内だけ render) と layout 再計算のタイミングが絡む疑い。 真因未特定、 別 session で着手
- **カードが左端に詰まらず隙間ができることがある** (session 93 user スクショで報告) — 本来 skyline masonry は左から詰めるはずだが、 ある列が左に寄らず不自然な空きが出ることがある。 上記「スクロール中カード入れ替わり」 と同じ skyline 再計算/bin-packing 系の疑い (= 同根の可能性)。 再現条件・真因とも未特定、 別 session で腰を据えて調査
- ~~**共有ミラー (ShareMirror) の再現精度**~~ ✅ **session 96 で完了** — (a) カードの角丸: プレビュー `.card` を直書き 3px → ボードと同じ `var(--card-radius)` (20px) に統一 + OG 画像 ([capture-mirror.ts](../lib/share/capture-mirror.ts)) を角丸クリップ (`roundRectPath`+`clip`) 描画 + 半径をカード幅比で算出 (縮小率非依存) に修正。 実機 Chromium ピクセル検証済。 (b) 背景タグ文字は session 94 で対応済。
- **B-#3 重複 URL でサムネ等が出ない問題** — 同 URL 重複追加時の表示挙動を確認・修正 (セッション 20 では真因未調査、 個別 session で着手)
- **MinimalCard polish** — 64px favicon が S サイズ (160px) で大きく見える可能性。 Visual Companion でモック比較してサイズ判定 (セッション 20 で実装後、 視覚調整は次回)
- **Task 12: 全件再 check 設定 UI** — viewport revalidation で日常運用は OK だが、 ユーザーが 「いま全件チェック」 を 1 クリックで kick できる設定パネル。 設定パネル自体が未実装なので別 spec 立ち上げ要

### Lightbox animation 系 (セッション 23-24 で B-#17 open/close/動画 + 揺れ完成、 残課題あり)

- **B-#17-#3 internal nav (wheel scroll で隣カード) の clone-based 移行** (中期) — open/close は clone-based に移行済だが、 Lightbox 内で wheel scroll した時の隣カード切替は **既存 transform:scale ロジックのまま**。 動作確認まだ。 open/close が本番で安定したのを受けて、 次に着手するならここ

- **角丸 24 → 20 検討** (= B-#17 落ち着いた現時点でやって良い視覚比較) — 短時間タスク

### カード操作・PiP

- **B-#7 自由サイジング 縮小時の clipping ポイント** — サイズ 3 付近で「がくっ」 と変わる感触あり
   - セッション 13 で調査済 (修正 revert、 持ち越し)
   - root cause: 縮小カード自身は滑らかだが**周囲カードの reflow burst** が原因 (skyline masonry が discrete に bin-packing)
   - 計測スクリプト: `C:\Users\masay\AppData\Local\Temp\playwright-test-resize-neighbors.js` / `-enlarge.js`
   - 保留中の代替案: (a) リサイズ中は周囲固定、 release で reflow / (b) FLIP tween 再チューニング (duration / ease) / (c) skyline ヒステリシス / (d) 受容
   - ユーザー希望: 周囲の「ぬるっと」 質感は維持、 完全固定 (案 a) は最終手段
- **B-#8 PiP click → カードへスクロール の見切れ** — カードサイズによって画面外で止まる、 画面中央付近で止まる scroll に変更
- **B-#12 拡大時 viewport overflow 破綻** (セッション 13 で観測) — 自由リサイズで viewport を超える幅まで拡大すると skyline が破綻、 他カードが画面外に押し出される
   - root cause 仮説: `computeSkylineLayout` の containerWidth clamp が単一カードの超過時に未定義
   - 対策候補: (a) `maxCardWidth` を絞る / (b) skyline 側で width > containerWidth カードを単独行 / (c) ResizeHandle で max を明示

### レスポンシブ (★ユーザー希望で最後に回す)

- **B-#10 モバイル UX 本格チューニング** (セッション 9 末ユーザー報告)
   - モバイルでカード列数が多すぎる + テキストカード縦伸び
   - デフォルトでモバイルは ~3 列にする
   - ピンチ操作でカード size 変更 (将来機能)
   - 実装方針: A 案 (即効) = `lib/board/size-levels.ts` で viewport-aware column / B 案 = mobile 起動時 level 2 default / C 案 (本格) = モバイル専用 SizeLevel テーブル
   - テキストカード縦伸び: `TextCard.tsx` に `max-height` or `aspect-ratio` クランプ + overflow:hidden

### TopHeader / chrome

- ~~**B-#13 TopHeader brushup**~~ ✅ session 41 で完了 (TUNE トリガー + 文字 chrome 化)
   - session 39 で ScrollMeter 下配置 + Lightbox 表現統一 (B-#20 解消)
   - session 41 で残りの上部 chrome (filter pill 以外) を TUNE / POP OUT / SHARE に整理 + scramble アニメで polish

### 拡張機能関連 (= session 44-45 で SNS ボタン連動 ship 後の残課題)

- ~~**B-#21 縦動画 tweet の card 縦横比**~~ ✅ session 45 で **(c) 受容** に user 判断確定 (= 翌ボードセッションで [lib/board/tweet-backfill.ts](../lib/board/tweet-backfill.ts) + [lib/board/backfill-queue.ts](../lib/board/backfill-queue.ts) が再取得して mediaSlots を更新するので直る前提)

### 拡張機能 連動の最終構成 (= session 49 user 検証後の確定 scope、 5 サイト 8 ボタン)

- ✅ **X (Twitter)** いいね + ブクマ
- ✅ **YouTube** 高評価 + 後で見る
- ✅ **note** スキ
- 🔧 **Vimeo** Like + Watch Later (= session 49 後半 fix、 user 再検証待ち)
- 🔧 **SoundCloud** Like (= session 49 後半 fix、 user 再検証待ち)
- ❌ **Instagram** 諦め (= ログイン壁 + CORS でサムネ取得不可)
- ❌ **TikTok / Bluesky / Threads / Reddit / Pixiv / Pinterest** 削除 (= session 49 で user 判断、 アカウントなし or 使用頻度低、 URL 保存経路は維持)

**重要原則**: 削除サイトでも 全 URL 保存経路 (= ショートカット Ctrl+Shift+B / 右クリック → Save to AllMarks / 拡張機能アイコン click / ブックマーレット) は **生きたまま**。 削除したのは「ボタン押すだけで自動保存」 連動だけ。

### 拡張機能 磨きフェーズ (= 9 サイト追加が終わった後、 詳細 IDEAS.md (I-08) (I-09))

- 🔜 **(I-08) 画面右端 floating ボタン**: content.js が全サイトに右端 fixed ボタンを inject、 設定で ON/OFF + 位置 (右上 / 右中 / 右下)
- 🔜 **(I-09) cursor pill 音波化 + テーマ連動設計**: 拡張機能の保存中フィードバック pill を音波 motif に + 将来テーマ system 追加時に連動できる CSS 変数受け口を仕込む

---

## ✨ 新機能アイデア (詳細は IDEAS.md)

`docs/private/IDEAS.md` 参照。 ここはタグだけ:

- X 自動翻訳取り込み + 原文切替 (Lightbox 内)
- テーマ案: SF 軍事スタイル (ガンプラ / 戦闘機パネル分け / デカール / 墨入れ質感)
- ギャップスライダー (カード間 gap 無段階) + 背景タイポ
- PiP 内広告
- SNS Share ボタン連携 (X / YouTube)
- ブラウザ完結 AI 自動タグ付け
- **ボード全体音量ロータリーノブ (= IDEAS.md K section、 session 51 user 発案)** — multi-playback vision で同時再生が立ち上がった瞬間に必要になる「ボード上の全カード音量を一括変更するつまみ」。 オーディオミキサー POT 風 + 円弧 LED 列で現在値が光る、 既存 `defaultVolume` global state (= session 51 で立ち上げ済) に直結。 multi-playback sprint と同時 or 直後に着手
- ✅ 複数画像 / 動画ホバー切替 (mediaSlots 実装中、 セッション 17 deploy 済)

---

## 📐 サイズ設計移行 (Phase 2-6 残)

- Phase 1 完了 (セッション 15、 `app/globals.css` :root に `--fs-*` namespace 追加、 参照ゼロ = 見た目変化なし)
- Phase 2-6 は `docs/specs/2026-05-12-sizing-migration-spec.md` 参照
- 全プロジェクト共通思想: `C:\Users\masay\.claude\design-philosophy-sizing.md`

---

## 過去の試行・教訓 (消すな、 同じ轍を避けるため)

### IDB schema bump は不可逆
- 一度 v12 → v13 に上げた IDB は v12 コードで開けない (VersionError)
- rollback は schema bump を含む deploy では事実上不可
- **bump 前にローカル dev で v12 → v13 を実機検証**することが**絶対**必要
- 恒久対策の 3 本柱は `docs/specs/2026-05-12-idb-launch-readiness.md` 参照

### Lightbox `.media` の rect 計測
- FLIP open/close アニメは `.media` の `getBoundingClientRect()` ベース
- `.media` の子に explicit width のない wrapper を置くと intrinsic 依存で rect が崩れる
- `<img>` は intrinsic dim を持つので安定、 `<div>` wrapper は要 explicit width

### 拡張機能 sideload
- `<all_urls>` host_permission を加えたら **再 sideload 必須** (Chrome は既存承認を upgrade しない)
- 検証手順は TODO_COMPLETED.md にアーカイブ済
