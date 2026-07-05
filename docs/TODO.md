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
- **公開前の残り片付け = 実質ゼロ(session129 で実態確認)**: 暫定 EXPORT/IMPORT 撤去は**不要**(B5/session124 で設定の正式バックアップ機能として配線済＝撤去は機能破壊)、`chrome-extension/` は**不在**(本物は `extension/`)、残るは `EXTENSION_STORE_URL` 投入のみ＝Chrome審査通過後に1行(外部待ち)
- 詳細プラン: `docs/superpowers/plans/2026-06-16-allmarks-rebrand-migration.md`

---

## 現在の状態 (次セッションはここから読む)

### 直近の状態 (セッション 161 — ③バックアップの法的守り A〜D 出荷・本番反映済・opus 全ブランチレビュー「READY」)

- **③ バックアップの法的守り A〜D 完遂**（merge `bb168f5`・`--no-ff`・tsc0 / **vitest1970** / build OK・`allmarks.app` 反映済・default 盤面 byte-identical）。brainstorm→spec→plan→**サブエージェント駆動7タスク＋各2段レビュー＋opus 全ブランチレビュー（READY TO MERGE）**。
  - **A 利用規約**：§3 に「データは端末内のみ・**控えを取る責任は利用者**・端末変更/ブラウザ消去/故障/更新での消失は復元不可」を15言語追記。**本番 /terms で live 確認済**（"keeping your own backups is your responsibility" / "cannot be recovered"）。
  - **B 初回「データの住処」カード**：オンボ finale 後（既存ユーザーは初回ロード）に一度だけ・**淡々調（ポエム排除・ユーザー要望）**・「GOT IT」で了解時刻 `data-home-ack` を記録＝二度と出ない。
  - **C SETTINGS 表示**：`BackupStatus`＝「Last backup: N days ago / never」を SAVING グループに常駐。
  - **D 定期リマインド**：`shouldShowBackupReminder`＝**新規15件＋前回控えから30日＋dismissから30日**が揃った時だけ1回・×(LATER)で `backup-nudge-dismissed-at` 記録。EXPORT で `last-backup-at` 更新＝自然沈黙（まめな人には出ない）。
  - EXPORT を共有ヘルパ `lib/board/export-backup.ts` に集約し SETTINGS ボタン／リマインド両方が最終バックアップ時刻を記録。純関数 `lib/storage/backup-reminder.ts`（13テスト）。正本 [spec](superpowers/specs/2026-07-04-backup-legal-safeguard-design.md) / [plan](superpowers/plans/2026-07-04-backup-legal-safeguard.md) / narrative [TODO_COMPLETED.md](./TODO_COMPLETED.md) s161。
- **⚠ 公開前ゲート**：バックアップ機能の**13言語（en/ja以外）翻訳、特に Terms 法的条項は未レビュー**（Claude のたたき台）。ワイドローンチ前に**ネイティブ＋法務レビュー**必須。
- **先送り（next）**：**E＝DB更新前の控え促し**（不可逆スキーマ変更の直前に自動 EXPORT 促し・spec §3）／**複数端末同期（案B＝ユーザー自身のクラウド、課金候補）**は専用セッションで brainstorm（骨子 `docs/private/IDEAS.md` (SYNC) 節）。
- **学び**：`BoardItem` は `savedAt` 非保持（raw `BookmarkRecord` のみ）→ D は effect 内 `db.getAll('bookmarks')`＋`!isDeleted` で件数算出。vitest4 は `vi.fn<[..],..>()` 2引数ジェネリックが tsc で落ちる（`vi.fn<Fn>()`）。
- **次（セッション162・2026-07-06 月〜）＝★ スマホ本格対応（最優先・s161 ユーザー指示）**＋見せ用の共有ボード作成（ローンチ告知の素材）。その後 ① 自動画像 → ② カラーハント。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)・下記「★★ 最優先: スマホ本格対応」。

### 直近の状態 (セッション 160 — N-23 動画Lightbox「がくっと」修正・実機OK／拡張 v0.1.24 審査通過・ストアURLは既に配線済)

- **N-23 完遂（実機確認OK・本番反映済・commit `d05cc48`）**: YouTube 動画カード→Lightbox 移行で絵が「がくっと縮む」を根治。真因＝板は maxresdefault(16:9)/object-fit:cover、Lightbox poster は hqdefault(4:3)/contain（`.media img{contain}` が `.embedPoster{cover}` を詳細度で上書き）で**別サムネ**→ clone が 888幅に育った後、handoff で 667幅にレターボックス縮小＋低解像化。**Playwright 実測で確定**（板=cover/全幅、LB=contain/黒帯）。修正＝①`YouTubeEmbed` の poster を板と同じ maxres→hq→mq→0 の onError 鎖に（`item.thumbnail` 無視）②`.media img[class*="embedPoster"]{object-fit:cover}` で cover 復元（`.imageBox` 写真は無傷）。**新規リグレッションでなく既存の潜在不一致**（コメント自身が「YouTube はレターボックス不一致が一瞬見える」と自認していた）。tsc0/vitest実質全緑/build OK。memory `reference_lightbox_youtube_poster_parity` 記録。
- **拡張 Chrome ウェブストア v0.1.24 審査通過**（N-20 add-new-tag 入り）。**`EXTENSION_STORE_URL` は v0.1.21 時点(commit `108e198`)で既に投入・本番点灯済**（拡張ID `gefnpf…` はバージョン非依存で固定・`chromewebstore.google.com/detail/allmarks/gefnpf…` は HTTP200 実確認）→ **URL投入は追加作業ゼロ**、ストアが自動で v0.1.24 を配信。TODO/release-blocker の「URL投入が残作業」は**古い記述だった**（下記 release blocker #2 訂正済）。
- **次（セッション161）＝本命バックログ ③バックアップの法的守り**（利用規約明記＋初回説明＋定期リマインド＋危険操作前警告＋文面たたき台）→ ①自動画像 → ②カラーハント。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 159 — 拡張 N-20 完遂＋新規タグ作成／オンボ PopOut ペースト／高解像度は revert／次＝動画Lightbox「がくっと」修正)

- **拡張 N-20 完遂＋機能追加**：クイックタグ帯を「**+ add tag** ハンドル＋ホバー1列ドロワー」に刷新（上だけ2列を根治）＋フォント一致＋**スクロール末尾でフェード消滅**修正。さらに「**+ add tag クリックで新規タグ作成**」を web+拡張の往復で新設（`booklage:add-new-tag`・find-or-create は `applyNewQuickTag` 流用）。**敵対的レビュー2件で実バグ5件**（**IME 変換確定Enter でタグ化＝日本語全滅**／重複タグ→nonceガード＋送信済みSet／bookmarklet 悪用→bookmark存在ゲート＋`getBookmark`／keyup漏れ 等）摘出・全修正。**manifest 0.1.24・zip 生成・ユーザーが審査提出**。web 反映済。tsc0/**vitest1959**。commit `31e1092`/`eb2b5c2`/`958e255`。
- **オンボ PopOut にペースト保存を追加**：[PopOutReenactment.tsx](../components/onboarding/PopOutReenactment.tsx) に「URL 貼り付け→カード保存」ビート＋**キャプション15言語更新**（拡張もブクマも不要で保存を教える）。commit `419fb4d`・反映済。
- **アイデア洗い出し**：5レンズ→実現性判定→統合の workflow で **X-01〜X-25** を IDEAS.md に記録（拡張ロードマップ統合版）。
- **高解像度化（案X=Lightbox の X 写真のみ）を試みて revert**：表示時に新URLへ差し替えると **FLIP 時に未デコードで小さく表示**する劣化 → `6f4621d` でまるごと revert・本番は既知の良い状態に復帰。**教訓＝見た目変更は tsc/vitest 通過≠OK、実機確認してから出す**（次に高解像度を再挑戦するなら「元画像を先に表示→裏で先読み→差し替え」＋実機検証）。
- **次（セッション160）＝ N-23 動画Lightbox「がくっと」を安全に修正**（下記・ユーザー明示）。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 158 — オンボ改善 N-21+N-22 出荷・master マージ済・allmarks.app 反映済／ユーザー実機目視のみ残)

- **オンボ改善 N-21+N-22 を出荷**（merge `28931b9`・`--no-ff`・tsc0 / **vitest1945** / build OK・`allmarks.app` 反映済・default 盤面 byte-identical）。
  - **N-21**＝`manage`/`settings` beat の `OnboardingSpotlight` に `captionAtBottom` 追加（1行）→ SETTINGS 説明が画面下中央に固定され開いたドロワーに埋もれない。
  - **N-22**＝desktop 専用 `popout` cinema シーンを `install` の後に追加。**当初 v1 はユーザー実機で①詰まり（NEXT 不可・盤面がクリックを奪う＝`.stage` の暗幕/`pointer-events:auto` 欠落）②品質低の2問題→ 同セッションで v2 に全面作り直し**（merge `ca81341`）。v2＝拡張チュートリアルと同方式（偽ブラウザ＋実LPスクショ＋緑カーソルが `POP OUT` をクリック→相棒窓が `back.out` でポップアウト→カードが右からグライドイン `power4.out`/0.7s＋常時メーター `00/00→01/01→02/02`→「+ TAG」でタグチップ点灯）。淡々コピー＋タグ/ジャンプ追記を15言語。実 PiP 非結合。
  - 進め方＝`superpowers:subagent-driven-development`。v1＝6タスク＋opus 全ブランチレビュー。v2＝2タスク＋各レビュー＋opus 全ブランチレビュー（Ready to merge YES）＋flash 修正 `eff5fc3`。正本 v1 [spec](superpowers/specs/2026-07-04-onboarding-settings-popout-design.md)/[plan](superpowers/plans/2026-07-04-onboarding-settings-popout.md)・v2 [spec](superpowers/specs/2026-07-04-onboarding-popout-reenactment-v2-design.md)/[plan](superpowers/plans/2026-07-04-onboarding-popout-reenactment-v2.md)・narrative [TODO_COMPLETED.md](./TODO_COMPLETED.md) s158。
- **同セッション末に実機フィードバックの追い込み修正4連（master `fb16eb8`/`bf34335`/`9305cbd` 他・全て allmarks.app 反映）**: POP OUT タグチップ被り→左上／SETTINGS beat のリングずれ→**トグルを上に固定＋スクロールロック**（[ExtensionEntry.tsx]）／キャプションをトグルの**すぐ左に寄り添う**（`captionLeftOfHole`）／**緑リングを body portal でドロワー(z401)より前面(z410)に**出して可視化（`ringAbovePanels`・定数 `ONBOARDING_SPOTLIGHT_RING`）。詳細 [TODO_COMPLETED.md](./TODO_COMPLETED.md) s158 末。**オンボは概ね OK**（残りは気になれば次回微調整）。
- **次（セッション159）＝拡張 N-20 修正＋再審査**（下記・ユーザー合図で着手）。
- **次（セッション159）**: N-20（拡張クイックタグ2列・`EXTENSION_STORE_URL` 投入と同回）／③プレミアムテーマ／④K3 解錠。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 157 — 選択的シェア「SELECT CARDS」出荷・master マージ済・本番実測 PASS)

- **選択的シェアを出荷**（merge `1aaeb37`・tsc0 / **vitest1942** / build OK・`allmarks.app` 反映済・Playwright 本番スモーク **12/12 PASS**・default 盤面 byte-identical）。SHARE モーダルに **SELECT CARDS** を追加 → 盤面が選択モードに（tap で選択トグル・0枚スタート・緑✓バッジ+緑アウトライン・下部バー `n/100 SELECTED`＋SELECT ALL＋SHARE(n)＋CANCEL＋琥珀「100 MAX」）→ SHARE(n) で確定すると**選んだカードだけ**を盤面順で共有（`filter:null`・タグ帯なし）。既存の「押したらすぐ新しい順100枚」は無変更。**受け取り側 /s/ は無変更**。
  - 純関数 `lib/share/selection.ts`(12テスト)＋`ShareSelectBar`(5テスト)＋`SenderShareModal` SELECT CARDS(3テスト)。CardsLayer 選択モードは tap ハンドラ＝receiver のツイン、選択中はホバーchrome を全非マウント。BoardRoot 配線は normal path が旧コードに一致（byte-identical 再検証）。
  - 進め方＝brainstorm→spec→plan→**サブエージェント駆動6タスク＋各2段レビュー＋opus 全ブランチレビュー（Ready to merge）**。レビューで実バグ2件摘出・修正（+TAG/タグpill行の未ゲート／再生トグルが `pointer-events:auto` でタップを奪う）。正本 [spec](superpowers/specs/2026-07-03-selective-share-design.md) / [plan](superpowers/plans/2026-07-03-selective-share.md) / narrative [TODO_COMPLETED.md](./TODO_COMPLETED.md) s157。
  - **未対応の任意ブラッシュアップ（ユーザー実機判断待ち）**: 緑アウトラインの強さ／選択バッジの登場トランジション（spec通り今は無し）／選択の永続化はしない設計。
- **同セッションで追加**: ユーザー実機フィードバックを反映＝N-15 解決／拡張ストア審査通過（残＝`EXTENSION_STORE_URL`）／新規 N-20（拡張クイックタグ上だけ2列）N-21・N-22（オンボ）を backlog 追加。**オンボ改善 N-21+N-22 の spec と実装計画を完成**（[spec](superpowers/specs/2026-07-04-onboarding-settings-popout-design.md) / [plan](superpowers/plans/2026-07-04-onboarding-settings-popout.md)・6タスク・**実装は未着手**）。
- **次（セッション158）**: **オンボ改善計画をサブエージェント駆動で実装**（上記 plan）→ その後 N-20（拡張・URL投入と同回）／③プレミアムテーマ／④K3。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 156 — N-05 ブラッシュアップ v2+v3 完遂・master マージ済・本番反映済。LP はいったん区切り)

- **N-05 を3段直列＋境界マイクロ演出に刷新**（merge `782dcf6`・tsc0 / **vitest1922** / build OK・`allmarks.app` 実測 **13項目 PASS**・ユーザーOK → LP はいったんここで区切り）。
  - **v2（3段直列）**: 帯上は本文の姿のまま → ナビの行で止まって左→右の衣装替え（時間制の波 約0.45s）→ **横移動はスクロール駆動**（とどまり `holdPx:160` → `dashPx:140` を easeOutBack でスクラブ・完全可逆）。docked 状態と時間制 zip/return を**廃止**＝帯を離れる帰還は垂直のみ（**斜め軌跡を根治**）。**着地形はナビ実体と完全一致**（"Features" 混在ケース・-0.005em。s155 の uppercase+0.06em は誤実測だった。dockSlot は navLink 継承に修正）。許容差: per-char 化でカーニング分 幅+1.9px（実物と同時表示なし＝不可視）。
  - **v3（境界演出4点・全案採用）**: ①乗り上がり＝跳ねの波にスクロール駆動化（引き継ぎ瞬間は実 kicker と完全同姿＝がたっ根治。**DOM＝純関数 誤差0.000px 実測**）②hairline 屈折（横断中のみ per-char clip 分割・静止観察可）③玉ノック（下向き接触で一度・時間制は意図）④境界線グロー（語の真上だけ緑に灯る）。
  - 純関数 `dashProgress/dashEase/bandClimbProgress/charHopArc/crossGlow`（nav-dock-math **35テスト**）。チューニングは `NAV_DOCK` 定数（hold/dash/hop/knock 等）と `.module.css` の px 値だけ。
- 正本 spec: [2026-07-03-lp-nav-dock-morph-brushup-design.md](superpowers/specs/2026-07-03-lp-nav-dock-morph-brushup-design.md)（§9=v2 / §10=v3）/ narrative [TODO_COMPLETED.md](./TODO_COMPLETED.md) s156。
- **同セッション追加＝LP最下部の黒幕バグ根治**（master `9e7ea1b`・本番実測 PASS）。ユーザー報告の「黒い部分の白い矩形」は **N-05 以前からの既存構造バグ**（s153 ビルドとピクセル同一を実測で確定）: 幕(finale)が footer の横 padding 内側で左右40px を覆えず＋トップLPは z文脈でヘッダーを覆えたことが無かった → ①幕の全幅化（PC全画面時のみ）②幕が上端に達したらヘッダー自身がフェード退場（可逆）。詳細 narrative s156 末尾。
- **未決（急がない）**: 13言語で演出が出ない件＝kicker を全言語英語に統一すれば全言語発動（見た目が変わるので要ユーザー相談・CURRENT_GOAL 検討メモ）。
- **次**: 本命バックログの優先順相談＝③プレミアムテーマ制作／④K3 解錠実装（`docs/private/2026-07-01-k3-unlock-plan.md`）／選択的シェア／タグ付け強化。

### 直近の状態 (セッション 155 — N-05 LPナビ格納演出を作り直して出荷・本番反映済 ※s154は全損だった)

- **N-05 完遂**（master `b0d81a6`・tsc0 / **vitest1901** / build OK・`allmarks.app` 反映済・本番実測 PASS）。5サブページで kicker がガラス帯に1文字ずつ乗り上がり→右へダッシュ→ナビの自分のスロットへバウンド着地（可逆）。
  - 新規 `lib/scroll/nav-dock-math.ts`(+14テスト)＝**範囲＋ラッチ式**判定（Lenis 慣性すり抜け不能・大ホイール実測で証明）／新規 `NavDockTraveler.tsx/.module.css`／配線＝SiteHeader スロット2枚持ち・MarketingShell(Lenis+traveler)・5ページ kicker anchor・landing-tokens ゲート。
  - **演出オフ条件（確定）**: reduced-motion（ユーザー確定・OS設定尊重）／≤960px／kicker≠ナビ語（**13言語はローカライズ済みで自動オフ**・en/ja は有効）。属性 `html[data-nav-dock]` は mount 後にのみ書く＝SSR/JS無効は従来表示。
  - 正本 [spec](superpowers/specs/2026-07-03-lp-nav-dock-design.md)（※§2「実コード確認」は s154 の偽読み混入 → [plan](superpowers/plans/2026-07-03-lp-nav-dock.md) 冒頭の訂正対照表が正）/ narrative [TODO_COMPLETED.md](./TODO_COMPLETED.md) s155。
- **重大事実**: s154 の「実装済み・commit 88178ff」は**偽保存で実在しなかった**（fsck/reflog/origin/worktree まで捜索し痕跡ゼロ）。ディスクに届いていたのは spec/TODO追記/計測メモのみ。教訓＝**書き込み・commit は独立した実出力で確認**。
- **残る微調整（任意）**: バウンド強さ/ダッシュ速度/着地書体は実機の好みで `NAV_DOCK` 定数と `.module.css` の `--mp` 補間値をいじるだけ。
- **次（セッション156）**: ユーザー実機で N-05 の動きを確認→好みチューニング → 本命バックログ（③プレミアムテーマ／④K3 解錠／選択的シェア／タグ強化）。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 152 — N-19「サイズ/並び順を default に戻す」出荷 → master マージ済 / allmarks.app 反映済)

- **N-19 完遂**（master `a7be63d`・tsc0 / **vitest1887** / build OK・default 盤面 byte-identical・本番反映済）。SETTINGS ドロワーに新グループ **LAYOUT** を追加し2操作を配線：
  - **RESET CARD SIZES**（リサイズ済み枚数表示・0枚で無効）＝全カードの手動サイズを解除→既定サイズへ（既存 `resetAllCustomWidths` 配線）。
  - **SORT: NEWEST FIRST** ＝ `savedAt` 降順で並び直し（新関数 `resortByNewestFirst`＝フラグ非依存で何度でも実行可。マイグレーション `repairOrderIndexIfNeeded` は無変更）。
  - どちらも**その場2タップ確認**＋実行後トースト。EXPORT バックアップが同ドロワーの保険。個別 ↺・TUNE ↺ は温存。
- 進め方＝brainstorm→spec→plan→**サブエージェント駆動5タスク＋各2段レビュー＋opus 全ブランチレビュー（Ready to merge）**→`--no-ff` マージ→デプロイ。15言語 i18n・機微情報なし。正本 [spec](superpowers/specs/2026-07-02-board-reset-layout-design.md) / [plan](superpowers/plans/2026-07-02-board-reset-layout.md)。narrative は [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション152。
- **フォローアップ修正（同セッション・master `365ddd4`・本番反映済）**：SETTINGS ドロワーのスクロールフェードが下端に固定されず特定項目（チュートリアル行）に黒帯が貼り付いて遅れて消えるバグを修正。根本原因＝`.scrollFade` の `position:absolute` がスクロールコンテナ（flex-column ドロワー）内でコンテンツと一緒に流れていた → 内側 `.drawerScroll` を新設してドロワー本体を非スクロール化、フェードを可視下端に常駐。Playwright 実測で dev＋本番とも合格。ユーザー実機OK（N-19 本体）。
- **次（セッション153）**：まず **フェード修正の実機目視**（allmarks.app ハードリロード→SETTINGS を少しスクロールし、黒帯が下端に留まり項目に貼り付かないか）→ その後 本命バックログ（③テーマ／④K3／選択的シェア／タグ強化）or N-05 LP格納演出。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

---

### 公開向け残タスク (= session 83 以降の優先度順、 session 82 で整理)

**release blocker (= 公開前 必須・残り)**:
1. **onboarding チュートリアル** — ✅ session 121 でユーザー「一旦OK」。追加ブラッシュアップは公開後でも可(ユーザーと一緒に随時)。
2. **拡張機能 Chrome Web Store 提出** — ✅ **完了**。v0.1.21 で初回審査通過→公開、**`EXTENSION_STORE_URL` は commit `108e198` で既に投入・本番点灯済**（`lib/board/constants.ts:34`、ID `gefnpf…` 固定・HTTP200確認）。N-20 を入れた **v0.1.24 も審査通過（セッション160）**＝ストアが自動で最新版配信。**URL投入の残作業はゼロ**（TODO の旧「残作業＝URL投入」記述は誤り）。
3. **公開前の残り片付け** — ✅ **実態調査で完了/不要と判明(TODO記載が古かった)**: `chrome-extension/` は不在(本物は `extension/`＝提出対象)。残るは上記2の `EXTENSION_STORE_URL` 投入のみ。
   - **BackupButton.tsx/backup.ts は未描画の孤立コード** → **B5(rank15)で「ユーザー向けバックアップ機能」として復活配線する方針に確定(session123)**。これは将来の DBバージョン上げ前に「ユーザーが自分でバックアップを取れる」安全網を用意する目的(=version bump の前提)。置き場所は SETTINGS ドロワー内が候補(要 user 確認)。

> ✅ 完了済 (詳細は TODO_COMPLETED.md): ドメイン取得 (session 102) / mood→tag rename (session 101) / **i18n 言語切替の配線**(層① runtime=session 106・層② LP言語別URL=session 109、 [lib/i18n/config.ts](../lib/i18n/config.ts) が locale 別動的 import) / **LP 全面作り直し + 紹介9ページ15言語化** (session 107〜112)。

**公開後でも OK (= 上澄み polish)**:
7. convex bezel 数値調整 (= session 82 試作 OK 後の微調整余地)
8. /triage 外周 4 段 bloom halo の 0.5x 絞り (= ハロ強すぎ件、 一旦 OK)
9. TagDeleteConfirmDialog 2 秒長押し feel (= 一旦 OK)
10. 「TAG THIS.」 サイズ + 緑パルス強度 (= 一旦 OK)

**別軸 (= 機能追加、 公開後の発展)**:
11. Song Bottle 風ブクマ交換 (= IDEAS.md)
12. ~~multi-playback (= 複数動画/音声同時再生)~~ ❌ **session 130 で user 見送り判断**
13. per-tag theme (= dominantColor + ThemeLayer 切替) — (N-01)カラーハントと統合余地
14. (N-02) Lightbox 自動再生プレイリスト (= 再生終了で次カードへ。multi-playback 見送り後の「再生体験」主役候補)
15. テーマシステム + 有料テーマ (= N-06、 ノーアカウント・ライセンスキー解錠案。 IDEAS.md)

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

---

## 🐛 未対応バグ・改善 (active backlog)

完了済バグは TODO_COMPLETED.md に移動済。 ここはアクティブのみ。

### session 161 で報告（Mac 実機・友人フィードバック ＋ 雑多改善 — ★ローンチ前クロスプラットフォーム）

> **前提の要確認（最重要）**: 友人が Mac で使ったのは **Chrome か Safari か**。拡張は Chrome ウェブストア版＝Chrome 専用。Safari だと拡張自体が入らない（＝タグメニュー等が出ないのは想定内で、対応は「Safari 拡張を別ビルド（大）」or「拡張なし導線＝ブックマークレット/貼り付け/PopOut を磨く」）。Mac-Chrome なら実バグ。ここで scope が大きく変わる。

- **(N-24) ★Mac 対応必須（ローンチ前）** — 友人実機で複数箇所うまく動かない。スマホと並ぶ公開前クロスプラットフォーム項目。まず「どのブラウザ・どの導線で何が起きたか」を洗い出し（systematic-debugging Phase1）。
- **(N-25) タグ付けウィンドウが出ない（当初「Mac で」と報告 → 実は『タグ0件の初回状態』が原因の可能性大・★ローンチ致命的）** — 「別画面で画面中央右に出るやつ」。追記(同session)＝**「タグが1つも無いとき、＋タグはあるのにタグ付けウィンドウが出ない」**と判明。→ Mac 固有でなく**タグ0件時のバグ**の疑い＝**全新規ユーザーが最初にタグ付けできない**（launch blocker 級）。まず 0件時のタグ窓表示ロジックを systematic-debugging で確認（どの導線か＝拡張保存窓/PopOut/本体のどれか＋0件ガードの有無）。推測で原因を断定しない。
- **(N-26) LP の世界観と default テーマが合わない（design 大物）** — default 盤面をもっと**フラット**にして LP（白/エディトリアル）に寄せる。※default 盤面は Phase A で確定した「黒＋白＋音波」＝変更は byte-identical 前提を崩す大改修。**brainstorm 必須**（勝手に変えない）。memory `project_theme_sound_wave` / `project_phase_a_decisions`。
- **(N-27) 左右マージンでスナップ** — カードの配置/リサイズ時に左右マージンが「合う位置」でスナップできると綺麗。**要具体化**（列幅にスナップ？ 盤面外周マージン？ 現状どこが不揃いに見えるか）。盤面はグリッド/skyline masonry（自由配置ではない）点に注意。
- **(N-28) Pinterest 保存対応の検討** — 拡張の保存連動に Pinterest を（※session49 で一旦“自動連動から除外”＝URL保存経路は生存の経緯あり）。**scope 要確認**：Pinterest の保存ボタン連動（自動保存）か／Pinterest URL 保存時の見え方改善か。
- **(N-29) 拡張の設定、入れてすぐ見れる状態に** — インストール直後に設定/使い方が見える導線（初回 options ページ自動表示 or アイコンからの案内）。現状は気づきにくい。
- **(N-30) PopOut の「＋タグ」をカード外へ** — PopOut(PiP)で「＋タグ」をカードの外に出して見やすく。memory `project_pip_size_decision` の PiP レイアウトと整合を取る。
- **(N-31) タグ体験の作り直し：MANAGE TAGS 画面を廃止 → 「選択してタグにドラッグ＆ドロップ」** — 現状のマネージ/Triage（1枚ずつスワイプ）を廃止し、**ボタンで選択モード→カードを選ぶ→タグへ D&D で付与**に。s157 の SELECT CARDS 選択モード＋s95 の「画像ドラッグでタグ付け＋ガラス演出」構想を土台に流用余地。**大改修＝brainstorm 必須**。関連 memory `project_selective_share_shipped` / `project_tagging_top_priority`。
- **(N-32) メニュー系を全部フラットに刷新（design 方針・N-26 と一体）** — 全メニュー UI をフラット化。N-26（default テーマをフラットにして LP に寄せる）と同じ「フラット化」方針の一部。**まとめて brainstorm**（視覚言語の再定義＝大物）。
- **(N-33) タグを小文字強制でなく入力どおりのケースを受け付ける** — 「Design」等をそのまま保存できるように。**実装時の勘所**：表示は入力どおりのケースを保持しつつ、**重複判定は大小無視**（Design/design/DESIGN を別タグにしない）＝display はケース保持・照合は case-insensitive が定石。まず現状の lowercase 強制が「視覚統一」か「重複防止」どちらの意図かをコードで確認してから（両立させる）。
- **(N-35) 見た目の微調整コントロール：タイトルの font/サイズ、背景の格子の太さ・ドット径 等を変えられる** — ユーザーが盤面の見た目を微調整（タイトル書体・サイズ／背景パターンの格子線の太さ・ドット径 等）。既存 theme-customization（`resolveThemeCustomization`/`patternSvgDataUri`）＋TUNE 資産に接続。※N-26/N-32（フラット化・TUNE 見直し）と**方針の擦り合わせが要る**：default は静かに・でもユーザーに“表現の摘み”は残す＝両立可能。どの摘みを新フラット系で残す/露出するかは brainstorm で確定。
- **(N-34) Share の作り方そのものを作り直す：選択→“疑似 Share タグ”で本物の盤面に入り、その場でサイズ/並び順を整えて送る** — 現状の選択的シェア(s157)は「選んだら即共有」。新案＝Share で選ぶ＝**疑似的に Share タグ/フィルタが付いた状態**で**本物のボード画面**に切替（複製プレビュー・ShareMirror を挟まない）→その場でカードの**サイズ・並び順を編集**→「この状態で送る」。**要設計判断**：その場の並べ替え/サイズ変更を **(a)** 共有だけの一時状態にして送信後に元の盤面へ戻すか、**(b)** 本物の盤面にも反映して残すか。**N-31（選択→本物の作業ビューで操作→実行）と同じ操作モデル**＝「選択して本物の画面で仕上げて実行」を Share・タグで一貫させる好機。既存 reorder/free-size 資産＋ `project_selective_share_shipped` を流用。
- **(N-36) 共有画面のときだけ“完全自由配置”解禁＝コラージュモード（N-34 の核心強化）** — N-34 の share 編集画面では通常盤面のグリッド/skyline を外し、**カードを自由配置（位置・重なり・サイズ）できるコラージュ**に。**通常の盤面はグリッド維持**（memory `feedback_allmarks_grid_no_tilt`＝グリッド常時・傾けない は“本体盤面”のルールとして継続）、free 配置は**共有画面限定の意図的な例外**。要設計判断：①傾き/回転まで許すか（従来 no-tilt との関係）②自由配置の座標を**共有データ形式に載せる**（現状は並び順ベース＝x/y を持たせる必要）③**受け取り側 /s も自由配置を再現**できるようにするか④`dom-to-image` 書き出し（シェア画像）との整合。＝データ形式・受け取り・書き出しまで波及する中〜大。

### session 157 で報告（ユーザー実機メモ・新規）

- ~~**(N-20) 拡張クイックタグ窓：上だけ2列のまま**~~ ✅ **セッション159 完了**（折りたたみを「+ add tag」ハンドル1個＋ホバー1列ドロワーに刷新＝2列を根治。さらに「+ add tag クリックで新規タグ作成」まで追加。詳細 [TODO_COMPLETED.md](./TODO_COMPLETED.md) s159／manifest 0.1.24 提出）。

### session 159 で報告（ユーザー実機メモ・新規）

- ~~**(N-23) YouTube 動画カード→Lightbox で「がくっと小さくなる」**~~ ✅ **セッション160 完了（実機OK）**。真因＝板と Lightbox で別サムネ/別 object-fit（板 maxres/cover vs LB hqdefault/contain）→ handoff で絵が 888→667幅にレターボックス縮小。修正＝poster を板と同じ maxres 鎖＋`.embedPoster` を cover 復元。詳細 [TODO_COMPLETED.md](./TODO_COMPLETED.md) s160／memory `reference_lightbox_youtube_poster_parity`。既存の潜在不一致（新規リグレッションではなかった）。
- **(参考) 高解像度化は s159 で試みて revert 済**（表示時に新URL差し替え→FLIP で未デコード縮小の劣化）。再挑戦時は「元画像を先に表示→裏で先読み→差し替え」or 保存時のみ、＋実機検証。memory `reference_lightbox_flip_content_equivalence` 隣に学びを記録。
- ~~**(N-21) オンボ：SETTINGS の説明が埋もれる**~~ ✅ **セッション158 完了**（`captionAtBottom` で下中央固定。詳細 [TODO_COMPLETED.md](./TODO_COMPLETED.md) s158）。ユーザー実機目視のみ残。
- ~~**(N-22) オンボ：POP OUT の説明シーンが無い**~~ ✅ **セッション158 完了**（desktop 専用 `popout` cinema シーン＋`PopOutReenactment`＝右グライドイン再現。詳細 [TODO_COMPLETED.md](./TODO_COMPLETED.md) s158）。ユーザー実機目視のみ残。

### session 150続き で報告（ユーザー実機メモ7件 — 残タスクのみ）

> ✅ 完了（→ TODO_COMPLETED セッション150続き）: **N-17** TRASH の EMPTY TRASH ボタン赤 danger 化（本番反映・確認OK）／ **N-18** 拡張クイックタグ窓の見切れ（1列スクロール化・v0.1.22 パッケージ→**2026-07-02 ストア審査提出済**）。
> ⏹ 対応不要: **N-14** Lightbox 中のボードモーション（カード/動画/スライドショーは既に `ambientOn` gate で停止済）。
> 🅿 保留: **N-16** 空ボードの青モーダル＝**スマホ限定**（未対応プラットフォーム）。色トークンだけダーク化済（デスクトップは背景ワードマークに occlude され不可視＝実害なし）。スマホ対応時に再確認。

- ~~**(N-15) PC 電源入れ直し後、初回1回だけ拡張の保存が失敗するかも**~~ ✅ **セッション157でユーザー「終わってます」判定**（実機で再現しなくなった＝解決扱い。コード側の恒久対策が要るなら再浮上時に）。
- ~~(N-19) カードのサイズ/並び順を default に戻す~~ ✅ **セッション152 完了**（SETTINGS→LAYOUT に RESET CARD SIZES / SORT: NEWEST FIRST を2タップ確認付きで出荷。詳細 [TODO_COMPLETED.md](./TODO_COMPLETED.md) s152）。
- ~~(#4 = 既出 N-05) LP ナビの格納演出ブラッシュアップ~~ ✅ **セッション155で実装・156でブラッシュアップ完遂**（3段直列＋スクロール駆動ダッシュ＋境界マイクロ演出4点。詳細 [TODO_COMPLETED.md](./TODO_COMPLETED.md) s155/s156）。未決の残メモ: 13言語は kicker≠ナビ語で自動オフ（英語統一案は要相談）。

### session 140 で報告（新規・未調査）

- ~~**(N-08) ボード中央上に「よくわからない線」がある**~~ ✅ **session 141 完了** — 真因は DOM 実測で確定: paper 化で TUNE/SETTINGS の閉じた drawer に付けた `border:1px`+parchment 背景が、`max-height:0` でも上下ボーダー計2pxの帯として残り横線化（TUNE と SETTINGS が重なる中央が二重で濃い）。SETTINGS drawer は body に portal されるため Lightbox を貫通していた。修正: 羊皮紙サーフェスを `[data-open='true']` のみに限定（閉じ時は default 同様 border:0→高さ0→不可視）。代わりにユーザー要望の**手書き風インク下線**を TopHeader の actions `.group::after`（paper限定）に追加＝ヘッダーの子なので Lightbox で一緒にフェード。
- ~~**(N-09) 影の強度**~~ ✅ **session 146** — paper の3影（ボードパネル/台紙/破れ紙）を深い墨茶 `26,22,17`＋高アルファ＋遠層拡大で「がっつり」濃く。実レンダリング computed 値を実測。さらなる微調整は実機判断で随時。
- ~~**(N-10) 共有画像テキストカードの紙パリティ**~~ ✅ **session 146** — ShareMirror をノート紙シート＋手書きに（`pickTextNoteSheet` で盤面と選択一致・`isPaperTextNote` で `pickCard` 再現）。破れシート黒帯・サムネ CORS 黒窓も解消。同一実行で盤面↔共有一致を実測。本物写真の焼き込みは CORS 制約のため別途「画像中継」案を IDEAS.md に記録。

### session 141 で報告（新規・未調査 — ユーザー実機メモ）

- ~~**(N-11) タグ絞り込みメニュー最上部の黄緑**~~ ✅ **session 146** — 実測で当初の neon 緑は s141 で既に forest 化済と判明。真の指摘は「ALL 行の横長の緑塗り」で、user 判断により **どのテーマでも `.item.active` の背景塗りを撤去**（アクティブは下線＋文字明るさに一本化）。
- ~~**(N-12) Lightbox を開くと台紙（mat）が消える**~~ ✅ **session 144 ユーザー実機確認OK**（実装は s141）。ユーザー案で「台紙を Lightbox にも出す」のでなく**「額縁から中身だけ取り出す」**方式に決定: paper 画像カードは台紙＋キャプション＋空の紙窓を盤面に残し、**写真/動画だけ**が窓 rect から Lightbox へ飛ぶ（閉じると窓へ戻る）。clone を `[data-paper-window]` 要素だけにし、写真は `[data-photo-content]`＋`photoHidden` で source 側のみ不可視化。clone(写真)→media(写真) で従来の「台紙→裸写真」の唐突な差し替えも解消。**scope=paper画像カードのみ**（default/非paper/動画(VideoThumb)/テキストは gate 済みで無変更）。「空き額縁」見た目は Playwright で検証済だが、**開閉アニメは実クリックが要るため未自動検証→ユーザー実機で開閉確認待ち**。実装: [ImageCard.tsx](../components/board/cards/ImageCard.tsx) / [CardsLayer.tsx](../components/board/CardsLayer.tsx) / [Lightbox.tsx](../components/board/Lightbox.tsx)。
- ~~**(N-13) 画像カードの台紙リデザイン**~~ ✅ **session 142 完遂**（1コミット=1確認で進行・全実機確認OK）: ②写真を台紙に直接 cover（白窓撤去）/ ①高解像9種に刷新（Figma シート番号ピッカー選定→`card-mat-s*` JPEG、共有定数 `IMAGE_CARD_BACKING_POOL`）/ 方眼・ノートのシートを画像カード(全URL)にも `100% 100%` 全面表示で使用。途中で出た**白い下地3連バグ**（シート透明部裏の ivory 2層・矩形ボーダー幽霊枠・破れシートの矩形影）を実描画 repro で特定し透明化/drop-shadow化。破れシートでは写真コーナー抑制（`paperCardHasTornBacking`）。**残: N-09影強度 / N-10 共有テキストカード紙パリティ は別途**。
- ~~（旧 N-13 メモ）次回はこの順で1つずつ実機確認しながら~~ ✅ 上記で消化済（以下は当時の段取りメモ・archive）:**良くなった分は維持**（下線/N-11緑/N-12写真持ち上げ/テキスト先頭切れ/テキスト紙のままLB）。**次回はこの順で1つずつ実機確認しながら**:
  - **①台紙の品質** — 低解像の `card-mat-1/2/3/aged` は使わない（ぼける）。高解像 `card-mat-4/5` + `lined/grid` + 方眼/ノート `card-paper-graph/notepad` を使う。
  - **②写真/動画の乗せ方** — **白い下地を出さない**。台紙の上に**直接 cover で乗せる**（`.paperPhoto` の `--paper-window-bg` 撤去＋`object-fit:contain`→`cover`、CardSlideshow も同様）。**キャプション等は見切れてOK**。
  - **③シートを使うとき** — 方眼/ノートは「穴・罫・綴じ」が見えるように（cover で切れない見せ方を要検討。`100% 100%` は伸びる）。**ユーザーが本当に欲しいのは「高品質な台紙の上に画像/動画が乗る」だけ**＝シンプルに保つ。
  - **④ライトボックス** — 写真だけ持ち上げ（N-12 済）／テキストは紙のまま（済）。台紙リデザイン時に矛盾が出ないか確認。
  - 関連スクショ/学び: 白窓の正体は `.paperPhoto` の warm 白背景＋`contain` レターボックス。低品質台紙は session140 で `card-mat-4/5` に置換された旧 `1/2/3/aged`。

### session 132 フォローアップ（Plan 2 で出た非ブロッキング・別タスク）

- **(N-07) e2e シード版数ズレ＝既存テスト債務** — `tests/e2e/board-b0.spec.ts` が IndexedDB を `open(dbName, 9)` で開くが app `DB_VERSION=16`([lib/constants.ts:30](../lib/constants.ts#L30)) のため VersionError → board-b0 全テストが seed 時に失敗。Plan 2 起因ではない(7回の DB 版数更新で蓄積)。テーマ切替 e2e は **構造は正しく un-skip 済**。直すにはシードを現行スキーマに合わせる(版数を 16 にし onupgradeneeded で現行ストアを作る、もしくはアプリのスキーマ生成を流用)。中優先。
- **`useTweetTranslation` 引数名リネーム** — [use-tweet-translation.ts](../lib/board/use-tweet-translation.ts) の引数 `themeId` は実際は motion キー('ink-underline'/'glitch-crt')を受ける(Lightbox が `getThemeMeta(themeId).motion.text` を渡す)。`textTransitionKey` 等へリネーム。軽微。
- **perf watch (4K)** — `lib/animation/tag-shutdown/themes/paper.module.css` の `filter: blur(1.5px)` アニメ(tagged-out カードのみ・一回0.46s)と `RulerTrack.module.css .marker { will-change: left }`(非標準)。現状許容、4K でジャンク報告が出たら最初に外す候補。

### session 130 棚卸しで追加（新規・実装可能）

- **(N-04) 一部ツイートで本文テキストが取れない** — repro `https://x.com/fta7/status/2059754329058488795`。次セッションで `/api/tweet-meta`→`cdn.syndication.twimg.com/tweet-result` の payload を実取得し、`text/full_text` が空か別フィールド(note/article)かを確認 → `parseTweetData`([tweet-meta.ts:137](../lib/embed/tweet-meta.ts#L137)) の分岐補強。詳細 IDEAS.md (N-04)。
- **(N-03) ローカル保存の安全性対策** — `navigator.storage.persist()` 要求で eviction 耐性を上げる(安価・高効果)＋EXPORT を目立たせる。Mac デフラグ等は IndexedDB に実質無関係。詳細 IDEAS.md (N-03)。

> session 130 で user が ✅完了 判定: 共有OGタイトル目視 / (I-03)ギャップスライダー / (I-08)フローティングボタン / (I-09)pill音波化 / PiP貼り付け保存・拡張なしカーソルpill。❌見送り: 複数同時再生 / (M)受け取りUI統一。新アイデア (N-01)カラーハント (N-02)Lightbox自動再生プレイリスト (N-05)LPナビ演出 (N-06)有料テーマ → IDEAS.md。

### 共有 (share) — 次セッション着手候補 (session 96 で user 要望)

- ~~**選択的シェア（新しい順100枚固定の改善）**~~ ✅ **セッション157完了**（SELECT CARDS で1枚ずつ選んで共有。詳細 [TODO_COMPLETED.md](./TODO_COMPLETED.md) s157）。
- **受け取り画面 (/s/<id>/triage) をマネージ画面と同じ UI に** (session 96 user 要望) — 現状 [ReceiverTriage.tsx](../components/share/ReceiverTriage.tsx)(239行) はマネージ [TriagePage.tsx](../components/triage/TriagePage.tsx)(857行)/[TriageCard.tsx](../components/triage/TriageCard.tsx) を**全く再利用していない別物**。user は「マネージと同じ UI で文言だけ共有用に変える」体験を希望。ただし目的が違う (マネージ=自分のブクマ整理 / 受け取り=他人のを取り込み + 送り主タグ提案 + 重複検出) ので「共通部品を共有 + 取り込み固有の振る舞いを差し込む」設計が要る。**brainstorming で方針合意してから実装** (大改修、勝手にやらない)。マネージ側には session 95 の「画像ドラッグでタグ付け + ガラス演出」もあり、受け取りにも欲しいか含め要相談。
- ~~**フィルターのタグ 1 つでもフェードがかかり視認性が落ちる**~~ ✅ **session 122 完了** — 真因は静止時でなく「開くアニメ中に clientHeight が過小なまま→overflow 誤判定→フェードが一瞬タグを隠す」。判定を max-height 基準の安定値に変更（純関数 [computeTagScrollEdge](../lib/board/tag-scroll-edge.ts) に切出し+単体テスト15件）。実機計測で前後検証済。

### 表示・サムネ系

- ~~**B-#23 Vimeo / SoundCloud Lightbox 再生未対応**~~ ✅ session 51 で完遂 (= 専用 Embed コンポーネント追加 + 全 embed 共通 50% 音量デフォルト + SoundCloud カスタムスライダーまで波及)
- ~~**B-#22 長文 tweet Lightbox 末尾だけ表示 bug + 全文表示 enhancement**~~ ✅ session 52 で完遂 (= cleanTitle 過剰マッチ修正 + TextCard 透明グラス redesign + scroll + persistTitle backfill 開通 + font jump 解消、 9 file 変更 / 5 deploy / 19 unit test 追加)
- ~~**スクロール中にカードの場所が入れ替わる問題**~~ ✅ **session 122 完了 (rank1)** — 真因: サムネ無しカードの高さを「画面表示の瞬間に初測(w/1.25)」する作りで、表示前(推定aspect)→表示後で高さが変わり下のカードが全部ずれていた。高さ計算を決定論の共通純関数 [itemSkylineHeight](../components/board/cards/index.ts) に一本化（CardsLayer描画 / BoardRootスクロール範囲 / 共有プレビューの3箇所）。マウント順非依存に。実機で再現(12枚Δ804px)→決定論を単体テストで証明。**ユーザー実機での最終確認待ち**。
- **カードが左端に詰まらず隙間ができることがある** (session 93 報告) — 上記 reshuffle 修正で多くは解消の見込みだが、**残因として F5 = skyline-layout が segment の左端しか試さず右の窪みに詰めない**点が残る（監査 board-layout finder 指摘）。reshuffle のユーザー実機確認で「左すき間まだ出る」なら skyline に右端候補/backfill を追加。別途・低優先。
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

### ★★ 最優先: スマホ本格対応 (2026-07-06 月〜開始・ユーザー指示 s161)

**格上げ理由**: ローンチ告知（動画＋共有ボードのツイート）を見据える。X 流入の大半がスマホで、現状モバイル UX が最大の穴。「最後に回す」→ **最優先**に変更（s161 ユーザー指示）。まず**実機スマホで LP / 空 board / 共有ボード（`/s/xxxx`）がどう見えるか実測**→ brainstorm→spec→plan→サブエージェント駆動。共有受け取り側はオンボ非発火＝摩擦ゼロを確認済み（s161）。

> **★ ローンチ前必須の2本柱（s161 ユーザー決定）**: **(1) スマホ本格対応**（この節）＋ **(2) 端末間同期＝案B（ユーザー自身のクラウド／Googleドライブ等・サーバー無し・ポリシー無違反・課金候補）**。同期は**着手前に必ず1日スパイク**でブラウザだけで OAuth-PKCE 読み書きが完結するか実証してから本実装（緑→実装／赤→手動ファイル同期で先に出し後で自動化）。骨子 `docs/private/IDEAS.md` (SYNC) 節。加えて (3) 見せ用共有ボード作成／(4) 公開前の法務・ネイティブレビュー（13言語規約条項）。

- **ローンチ素材: 見せ用の共有ボードを1枚作る**（個人的でない“魅せ用”の綺麗なボード→共有リンク化。ツイートで押させるのはこの `/s/xxxx`。動画＋このリンクが告知の主役）。※これはコードでなくコンテンツ作業（ユーザー主体）。

- **B-#10 モバイル UX 本格チューニング** (セッション 9 末ユーザー報告・= 最優先の本体)
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
