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

過去のセッション詳細ログは全て [TODO_COMPLETED.md](./TODO_COMPLETED.md) に移動済み(session207でのクリーンアップ)。**次にやること・直近の到達点は [CURRENT_GOAL.md](./CURRENT_GOAL.md) を参照**(毎回最初に読むファイル)。

**s209 (2026-09-03)**: 端末間同期 **束1(下ごしらえ)実装・本番反映済**。`BookmarkRecord`/`CardRecord` に `updatedAt`(v16→v17 migration・実機545件で通過確認)、`touchBookmark` スタンプを全書き込み経路に、タグのソフト削除、`lib/sync/device-id.ts`。同期ロジックはまだゼロ=既存挙動は完全不変。実装計画=`docs/superpowers/plans/2026-09-02-device-sync-bundle-1-groundwork.md`。**束2〜4への必須制約は設計書 `docs/private/2026-09-02-device-sync-design.md` §15 に集約**(特に束3のマージは `updatedAt` を `typeof x === 'number' ? x : 0` で読む)。次=束2(極小 Function + 認証 + Google Cloud OAuth 設定)。詳細は CURRENT_GOAL.md。

**s208 (2026-09-02)**: 端末間同期の設計フェーズ完了。設計書=`docs/private/2026-09-02-device-sync-design.md`。方式=BYOS(ユーザー自身のGoogle Drive)・id で足し算マージ・放置運転の自動同期・Private金庫も同期・最小K3ゲートを同時に。

### ★公開前の必須タスク (ローンチ前チェックリスト)
- **(PL-1) Google OAuth 同意画面のメールを個人 Gmail から専用アドレスへ差し替え** — s210 で束2の OAuth 設定時、Google のドロップダウンが「アカウント自身のメール or 管理する Google グループ」しか受け付けないため、サポートメール・開発者連絡先を一時的にユーザー個人 Gmail にした。ユーザー明示要望「問い合わせが個人アドレスに来るのは困る」。**公開前に Google グループを作って両方差し替える**(ブランディングタブ + 開発者連絡先)。同期の開発/テストはブロックしない。詳細 memory `project_oauth_support_email_swap`。
- **(PL-2) Google OAuth アプリを「テスト中」→「本番」に公開 + ドメイン検証** — s210: 本番公開には Google Search Console で `allmarks.app` の所有権検証(DNS TXT 等)が必要で、束2/3 のテストには不要なため見送り。「テスト中」だと refresh token が7日で失効 = 放置運転の自動同期(束4)には本番公開が必須。**束4 着手時 or 公開前に**: (a) Search Console で allmarks.app 検証 → (b) ブランディングの「承認済みドメイン」に allmarks.app 追加 + ホームページ/プライバシー/利用規約 URL 記入 → (c) 対象ページで「アプリを公開」。同意画面に「未確認アプリ」警告は出るが `drive.file`+`openid/email/profile` は全て非機密なので Google 審査は不要。

## 🐛 未対応バグ・改善 (active backlog)

完了済バグは TODO_COMPLETED.md に移動済。 ここはアクティブのみ。

### session 204 で発見（カードの＋TAGポップオーバーが2回目に開けなくなることがある）

- **(N-64) `CardsLayer.tsx`の`popoverOpenFor`が、カードが一時的にDOMから消えると古い値のまま残る** — 未着手。Private Phase 2 ②(公開鍵暗号移行)のe2eテスト作成中に実機再現で発見（Private機能自体とは無関係の既存バグ、`git diff master...HEAD -- components/board/CardsLayer.tsx`が空であることを確認済＝今回のブランチは無関係）。
  - **再現手順**: あるカードの＋TAGポップオーバーを開いて何かタグを付ける操作をし、そのカードがフィルタ等の理由で一瞬盤面から消える（例: Privateタグを付けてALL表示から除外される）→ 別のフィルタで同じカードを再表示 → もう一度そのカードの＋TAGボタンをクリックしてポップオーバーを開こうとする → **二度と開かない**（`popoverOpenFor`が前回の"開いていた"状態のまま残っているため、クリックが「閉じる」と誤判定される。閉じ処理自体はアニメーション待ちの状態と競合し、結果的にどちらも成立しない）。
  - **根本原因**（`components/board/CardsLayer.tsx:476-482, 1714-1718`実コード確認済）: `popoverOpenFor`はカードが`items`から消える際にリセットされる仕組みが無い。カードが再表示されると古い`popoverOpenFor`と一致してポップオーバーが自動的に再マウントされてしまい、直後の他操作（Escape等）でそれが閉じるアニメーション中に、次の意図的な「開く」クリックが「(既に開いているので)閉じる」ブランチに落ちてしまう。
  - **影響範囲**: Private機能に限らず、タグ付け操作でカードが一時的に非表示になり、別経路で再表示された後にもう一度＋TAGを開こうとする、あらゆる場面で起こりうる（低頻度・気づきにくいが実害あり）。
  - **回避策（今回のe2eテストで採用）**: 同じ場面をテストする際はページをリロードしてから操作する（`tests/e2e/private-vault.spec.ts`の「removing the Private tag...」テストのコメント参照）。
  - **修正案（未実装）**: `popoverOpenFor`を`items`の変化を監視するeffectでガードする（対象bookmarkIdが`items`から消えたら`popoverOpenFor`/`popoverClosing`を即座にリセット）か、そもそも`items`ベースで`popoverOpenFor`の妥当性を毎レンダー検証する形に直す。

### session 204 で判明（security-review — Private ②クイック保存面、優先度低・未修正）

Private Phase 2 ②の実装後にsuperpowers:security-reviewを実施。confidence 9/10の3件(データ破壊バグ・過剰権限・タグ有無の漏洩オラクル)は同セッション内で直接修正済み(コミット`2a95d4bc`)。以下2件はconfidence基準は満たすが深刻度LOWかつ修正コストが見合わないため見送り、記録のみ:

- **(N-65) ECDH秘密鍵のunwrap時、生のPKCS8バイト列が一瞬JS側の変数(文字列/Uint8Array)を経由する** — `lib/private/crypto.ts`の`unwrapPrivateKey`(112-124行目)。`crypto.subtle.unwrapKey`のネイティブ経路(生バイトをJSに一切渡さない)を使わず、既存の`decryptJson`(汎用JSONブロブ復号)を流用しているため。旧・対称鍵方式には無かった経路で、今回のECDH移行で新規に生じた。**実害は限定的**: 悪用にはこのページ内で既にJS実行権限を握っている攻撃者が必要で、その時点で他にもっと直接的な手段(復号関数を直接呼ぶ等)がある。根治には保存形式自体を`wrapKey`/`unwrapKey`ネイティブ対応に変更する設計変更が必要で、v0の優先度としては見送り。
- **(N-67) PopOut/ブックマークレットのPrivateチップに成功/失敗のフィードバックが無い** — 全ブランチ最終レビュー(opus)で指摘。`components/pip/PipCompanion.tsx`の`handlePrivateChip`と`components/bookmarklet/SaveToast.tsx`の同名関数はどちらも`isTagged: false`固定・✓表示なし・例外も握りつぶし。成功しても失敗しても見た目が同じで、「隠したはず」という信頼が前提の機能としては要修正。板側の同種処理(`BoardRoot.tsx`の"Could not encrypt N cards"パターン)を流用予定。次回の拡張機能UI配線プランと合わせて着手。
- **(N-68) 保存直後にPrivate化すると、ツイート等の非同期メディア取得(mediaSlots)が永久に反映されない** — 同レビューで指摘。`persistMediaSlots`等(`lib/storage/indexeddb.ts`)は`encryptedPayload`があると平文漏洩防止のため正しく書き込みを止めるが、拡張保存パスの非同期メディア取得は保存直後の数秒後に完了するため、「保存した瞬間にPrivateタグを付ける」動線だとほぼ確実に間に合わずメディアが空のままになる。Phase 1からある制限だが、②の実装で「保存と同時にPrivate化」が主要動線になったため顕在化。今は公開鍵暗号化なのでパスワード無しでも解決可能(根治は非同期メディア取得側を公開鍵暗号化対応にする)。方針決めと実装は次回以降。
- **(N-66) 拡張機能側(`extension/offscreen.js`)の`router.resolve`許可リストに`add-private-tag:result`が入っていない** — 今回のブランチでは`extension/`側に`add-private-tag`メッセージの送信元が一切存在しない(未配線)ため現状は無害。ただし**将来「拡張機能自身のコンテンツスクリプトUI」を配線する際の落とし穴**: このまま繋ぐと、save-iframe側からの返信が握りつぶされ続け、オフスクリーンの再送ポンプ(`offscreen-repost.js`、250ms間隔・最大8秒)が同一操作を最大30回超再送してしまう。次にその配線に着手するセッションで`extension/offscreen.js`の許可リストに追加すること。

### session 204 で提案（ユーザーからの新規ブラッシュアップ案、9件のうちN-69/74/75/76は完了・詳細はTODO_COMPLETED.md）

Private Phase 2完了後、ユーザーから次の一括インプット。N-69(タグ「なし」フィルタ)・N-74(SHAREタイトルTO FRONT/TO BACK)・N-75(SHARE文言の多言語化)・N-76(SHARE自動配置のツリーマップ化)はsession206〜207で完了、本番反映済。残るはN-78のみ。

- **(N-78) 画像の無いツイートも「ツイートらしい見た目」のカードにできないか** — 現状`pickCard`は画像(thumbnail)が無いツイートを汎用の`PlaceholderCard`に振り分けており、他の「文字だけのウェブサイト」と見た目が同じで「盤面の中で浮いて見える」というユーザー指摘。s205で調査済み: 過去(v17, commit `c7b6c59b`)に実際react-tweet埋め込み(`TweetCard`)を盤面カードとして使っていたが、**多数を同時マウントすると高さ計測(4タイマー安全策)絡みで再描画の連鎖が起きる不安定さがあり、あえて今のサムネイル画像方式に切り替えた経緯がある**(react-tweetの生埋め込みを盤面カードとして復活させるのは非推奨)。代替案としてClaudeが提案・ユーザーへ提示済み: 生埋め込みではなく、**取得済みのツイート本文＋投稿者名/アイコンを使った専用の静的カードデザイン**(軽量・高さ予測可能、他カードと同じ土俵)を新規に作る方向。視覚変更のため着手前に見た目案の提示・承認が必要。**ユーザー方針: 収益化の仕組みに着手した後に回す**。

### session 202 で報告（バックアップ提案の表示位置が不適切）

- **(N-63) バックアップ提案(BackupReminder)の表示位置がおかしい** — 未着手（視覚変更のためモック→承認後に実装、`ui-design.md` の承認フロー適用）。
  - **現状**（確認済）: `components/board/BackupReminder.module.css` の `.toast` は `position: fixed; bottom: 22px`（画面下部中央のトースト）、z-index は `lib/board/constants.ts` の `BOARD_Z_INDEX.BACKUP_REMINDER = 195`。
  - **問題**: `SCROLL_METER = 400` の方が高いため、画面下部で**スクロールメーターに視覚的に覆われる**位置関係になっている。ユーザー報告: 位置が下すぎる＋メーターに被っている。
  - **要望**: 画面**中央**かつ**最前面**に表示し、ユーザーに確実に見せて反応させる(確認させる)ようにする。現状のトースト的な「気づかなくても流れていく」表示から、モーダルに近い「見なかったことにできない」表示への変更。
  - **着手時**: 中央配置後は`BOARD_Z_INDEX`の中で最上位に近い値を新設(既存最大は`ONBOARDING`系410前後 — 実装時に現在の最大値を再確認して割り当てる)。他の modal 系(`MODAL_OVERLAY`/`SAVE_SHEET`/`CHROME_DRAWER`)との重なり方も要確認。

### session 196 で報告（Cloudflare コスト・悪用耐性 — 監査完了・防御は未実装）

> ★徹底監査完了（s196）。正本レポート = `docs/private/2026-07-14-cloudflare-cost-audit.md`（全経路・最悪額試算・防御プラン・ダッシュボード手順）。**結論: 現状 Workers Free なら悪用されても請求ほぼ0（日次上限が間接レート制限として働き R2 無料枠を超えない）。構造的費用は R2 超過分（現実的にほぼ0）と .app 更新 約$14/年のみ。** ハード上限機能が無いので Budget alert $1 が唯一の防衛線。

- **(N-62) Cloudflare 悪用面の防御実装（安価モデルで写経可・公開前が望ましいが緊急ではない）** — 未着手。正本レポート §4 にバッチ分割あり:
  - **バッチ1（コードのみ・低リスク・TDD）**: ①`/api/img` を `caches.default` で実キャッシュ化（現状コメントは「キャッシュされる」だが実測 DYNAMIC＝毎回 Function 起動の無駄）②`/api/oembed` 撤去 or `_routes.json` 除外（アプリ未使用のオープンプロキシ面）③`/og`・`/s`・`/api/share/[id]` の cache key からクエリ除去（`caches.default` 明示 key）。
  - **バッチ2（ユーザーのダッシュボード操作・Claude 不可）**: レポート §6 チェックリスト（★Budget alert $1／WAF レート制限1本を `/api/` に／Cache Rule でクエリ無視／R2 は Standard 維持）。
  - 悪用経路の要点: A=クエリでキャッシュ迂回し R2/KV 読み誘発（`og/[id].ts:50` パスのみ検証）／B=`/api/share/create` 無レート制限で KV write 枠枯渇＋R2 書込／C=`/api/img` 未キャッシュのオープン画像プロキシ／D=`/api/oembed` 未使用面。**隠れ課金リソースはゼロ**（D1/Queues/Actions/有料API/K3課金endpoint 全て無し・実照会済）。

### session 196 で報告（チュートリアル＝オンボーディングの実態ズレ ★公開前に直す）

> ユーザー報告（s196）: 機能を色々変えたので、オンボーディング（初回チュートリアル）の説明が現状の機能と食い違っている箇所がある。公開前に直す。

- **(N-61) 紙テーマ：スクロール中に全カードが一瞬点滅（4K 実機）— ★原因確定済・修正はユーザー判断待ち** — s196 で Playwright 計測により根治対象を特定:
  - **真因＝破れ紙カードの三重 `drop-shadow` filter**（[CardNode.module.css:107-113](../components/board/CardNode.module.css#L107-L113)・ぼかし半径 5/28/58px）。N-09「影を深める」（2026-06-30〜07-01, commits `3003e2f7`→`51adc516`）で導入＝ユーザーが「以前は無かった」時期と一致。
  - **実測**（60枚・同一スクロール・rAF フレーム数）: 既定テーマ 350 / 紙そのまま ~100 / **影を全部消すと 294** / 影1枚 186 / 影2枚 133。飾り層（背景紙・中間視差・カード装飾）はどれも消しても効果なし＝影が唯一の支配項。
  - **機構**: 影のラスタライズが重く 4K DPR2.58 でタイル描画がスクロールに追いつかない瞬間、未ラスタのタイルが一瞬素通し＝「全カード点滅」。DOM レベル（再マウント/アニメ/opacity）は無実を計測で確認。
  - **★ユーザー決定（s196）＝(b) 破れ紙アセットに影を焼き込む（根治・ランタイムコスト0）**。実装は後日（まずコスト監査を優先とユーザー指示）。アセット元は `docs/private/` の紙素材群（memory `reference_paper_asset_sources`）・透過縁に影を含めるためキャンバス余白の拡張が必要。probe スクリプトは scratchpad に保管（`flicker-probe.spec.ts.bak`・回帰測定に再利用可）。
- **(N-60) オンボーディングを現状の機能に合わせて更新** — 未着手。2箇所:
  - **① マネージ画面のくだりを削除**: 「マネージ画面」はもう無い機能。新しいタグ付け機能が完成しているので、**マネージの説明は丸ごと削ってよい**（ユーザー判断）。新タグ付けは直感的で**説明不要**（＝新たな説明を足すのではなく、古い説明を消す方向）。
  - **② 共有（SHARE）のくだりが変わっている**: 共有の流れ（選ぶ→CREATE で自動撮影→リンク＝s176 以降）に作り替わっているのに、オンボーディングの共有説明が古いまま。現状フローに合わせて直す。
  - 着手時: `components/onboarding/` の実装（OnboardingController 等）を読み、現状フロー（タグ付け＝s182 下部タグ帯・共有＝s176 自動撮影）と照合してから修正。**規模：小〜中**（主に削除＋共有節の文言差し替え）。

### session 183 で報告（PC盤面＋共有の磨き — ★ローンチ前・s183 で着手）

> 束B（スマホ保存）実機OK後にユーザーが挙げた5件。s183 で調査（各項目 subagent 並行・事実確認済）→ **①②③④を s183 で着手／⑤(N-28) は来週**。グループ A=共有（②③）／B=PC質感（①④）。

- ~~**(N-42) ① PC のテキストカードのスクロールバーを廃止→両端フェードに**~~ ✅ **s183完了・本番反映**（`computeTagScrollEdge` 流用・両端フェード・バー非表示）。 — 旧: 現状 `.titleScroll`（[components/board/cards/PlaceholderCard.tsx](../components/board/cards/PlaceholderCard.tsx)）は `overflow-y:auto` の（薄く整えた）ネイティブスクロールバー＋**下端のみ**フェード（上端フェード無し）。**要望＝両端フェード＋バー完全非表示＋端まで行けばその側のフェードが解ける**。**気づき＝同パターンは既に FILTER のタグ一覧で完成・出荷済**（純関数 `computeTagScrollEdge` の `none/top/middle/bottom` 4状態＋`data-scroll-edge`＋mask-image・`FilterPill` / `tag-scroll-edge.ts`）。それを `.titleScroll` に移植＋バーを完全非表示に。**規模：小**。※ライトボックスの大文字カード instance にも同時に効く点に注意。
- ~~**(N-43) ② 共有リンク受け取り画面の乱れ（本物のボード機構の“移植し忘れ”2点）**~~ ✅ **s183完了・本番反映**（スマホ3列幅移植＝1列解消／メーターを枠下帯へ）。**実機確認の残**＝スマホ受け取りの3列/タップ開閉/×削除・メーター位置。 — 旧: 受け取り画面 `SharedBoard`（[components/share/SharedBoard.tsx](../components/share/SharedBoard.tsx)）は**再発明ではなく本物の `CardsLayer`/`ScrollMeter`/`computeSkylineLayout` を既に再利用**。乱れの原因は2つだけ：**(a) スマホで1列**＝`BoardRoot` の「モバイル=3列・カード幅上書き（`MOBILE_LAYOUT`）」が受け取り側に**未移植**→送信者の広い幅のまま→狭画面で1枚/行。**(b) PC メーターが古い**＝部品は最新だが**配置が s170 以前**（画面下中央 absolute・canvas 内）のまま。今の本物は `.frameBottomChrome`（枠下帯・canvas 外）。→ (a) `useIsMobile`+`MOBILE_LAYOUT` 由来の幅/gap/customWidths を CardsLayer と spacer に流す、(b) メーターを `frame.frameBottomChrome` に移す。**規模：小〜中**。※要注意＝`CardsLayer` の onPointerDown は `isMobile` を `receiverMode` より先に判定するので、受け取り側で isMobile=true にすると受け取り専用タップ処理が飛ばされ得る＝実機確認必須（memory `reference_native_scroll_touch_action_playwright`）。
- ~~**(N-44) ③ SHARE の「作成中」インジケーターが撮影中に消える**~~ ✅ **s183完了・本番反映**（body への portal「CREATING YOUR LINK…」で撮影〜完了まで常時表示・撮影に写らない）。 — 旧: CREATE 押下→自動撮影中は唯一の進捗表示（ボタンの「CREATING…」）が**撮影対象の枠内**にあり、`.outerFrame[data-capturing]` の `[data-no-capture]{visibility:hidden}` で**丸ごと非表示**。100枚だと画像100枚取得で数秒〜十数秒、その間「何も出ない＝スクショ撮れと言われてる?」に見える（ユーザー不安）。手動スクショ文言は既に未使用（残骸のみ）。→ **進捗表示を撮影対象の外（body への portal）に出す**（`shareCreateState==='creating'` で表示・撮影に写り込まず完了まで見える）。[ShareToast.tsx](../components/board/ShareToast.tsx) / `handleCreateHostedShare`（[BoardRoot.tsx](../components/board/BoardRoot.tsx)）。**規模：小**。

- ~~**(N-46) ★共有受け取り画面：スマホでスクロールがさくさく動かない**~~ ✅ **s184 で根治・本番反映**（**実機確認待ち**）。**真因＝カードの `touch-action:none` の緩め忘れ**（候補(a)が的中）。`SharedBoard` が `CardsLayer` に `isMobile` を渡していない → `data-lock-card-scroll` が付かない（[CardsLayer.tsx:1304](../components/board/CardsLayer.tsx#L1304)）→ `.cardNode` が `touch-action:none` のまま（[CardNode.module.css:12](../components/board/CardNode.module.css#L12)）→ 3列密グリッドでは指が必ずカードに落ちネイティブ縦スクロールが打ち消される＝**s180 と同一のバグが受け取り側だけ未修正**。**実 Chromium 計測で確定**（390×844・ビルド済 out/）：受け取り `.cardNode` = `none` / lock属性 0-of-100、本物盤面 = `pan-y` / 51-of-51。
  - **`isMobile` をそのまま渡すのは不可**（`hoverActive = !isMobile && …`＝受け取りの `×`・タグピルが消える）→ 属性だけを駆動する専用 prop **`lockCardScroll`** を新設し `lockCardScroll={isMobile}` を渡す。`.scroller` も本物の `.mobileScrollContainer` に揃えた（`overscroll-behavior:contain` / `-webkit-overflow-scrolling:touch` / `touch-action:pan-y`）。
  - **`setPointerCapture` は温存**（W3C Pointer Events 3：パン/ズームは pointer event の default action ではなく capture では抑止不能、かつ触りは pointerdown 時点で暗黙キャプチャ済み）。スクロール開始時は `pointercancel` が飛び既存コードが正しく弾く。
  - **検証**：tsc0 / vitest **2201**（+3 配線テスト）/ e2e 6本 / 修正後の再計測で受け取り `pan-y` 100-of-100・盤面は不変。e2e 回帰ガード2本は「修正を外すと落ちる」ことを確認済。**CDP `Input.synthesizeScrollGesture` は既知の正解（盤面）すらスクロールさせられず、合成での実スクロール再現は不可と確定**（memory `reference_native_scroll_touch_action_playwright` を追認）。
  - **残（実機のみ）**：①受け取りのスクロールが実際に滑るか ②100枚全マウント（受け取りは `UNCULLED_VIEWPORT_H` で間引き無効・盤面は51枚）による残ジャンクの有無 ③スクロール中に触れたカードの `×`／タグピルが一瞬光る点が気になるか。
- ~~**(N-47) 共有受け取り：タブレット（>640px の触り端末）でも同じスクロール不全**~~ ✅ **s184 完了・本番反映**（ユーザー承認「タブレットも指スクロールなので直して」）。判定を**幅ではなくポインタ**に変更＝`lockCardScroll={isMobile || isTouchDevice}`（既存 `lib/board/use-is-touch-device.ts`＝`(pointer: coarse)`、s183 の「+」ボタンと同じフック）。受け取り側のカードは並べ替えもリサイズもしないので `touch-action:none` に用は無い。副作用（承認済）＝タブレットでもテキストカードの内部スクロールは止まる。**実測**: Chromium は `hasTouch` だけで 1024px でも `(pointer: coarse)` を返すと確認 → e2e 1024×768 で `pan-y` を固定。

- ~~**(N-48) ★共有受け取り：スマホ・タブレットに「取り込む」導線が無い**~~ ✅ **s184 完了・本番反映**（実機確認待ち）。**実測**（本番 `/s/LJ41eU`）: スマホ 390px は `.frameTopChrome` が `display:none` で **IMPORT が 0×0 ＝完全に不可視**、タブレットは 196×**27px**＝指の最小 32px も Apple の 44pt も下回る。**確立した規則＝「大きさは入力で決める。並べ方は幅で決める」**（Apple HIG 44pt / Material 48dp は入力基準、Google は `isTablet` 型のレイアウト分岐を明確に非推奨）。→ 触り端末（`isMobile || isTouchDevice`）に `ReceiverImportBar`（盤面の床に `position:absolute`・高さ 52px・`BoardMobileNav` と同素材・`BOARD_Z_INDEX.TOUCH_BOTTOM_BAR=150`）。上部の 27px IMPORT と **ScrollMeter（掴む部分 360×18px）は触り端末では描画しない**。押下は既存 `handleSave` のまま。**検証**: tsc0 / vitest 2207 / e2e 10本 / 本番実測（スマホ 366×52・タブレット 904×52・PC は 196×27＋メーター維持・エラー0）。[spec](superpowers/specs/2026-07-10-receiver-touch-import-bar-design.md)。
- ~~**(N-49) ★スマホ・タブレットから SHARE できない**~~ ✅ **s185 完了・本番反映**（実機確認待ち）。[spec](superpowers/specs/2026-07-10-mobile-share-bottom-nav-design.md) / [plan](superpowers/plans/2026-07-10-mobile-share-bottom-nav.md)。サブエージェント駆動9タスク＋各レビュー＋opus 全ブランチレビュー **READY TO MERGE**（Critical/Important ゼロ）。tsc0 / vitest **2246** / クリーンビルド / e2e 新規5本（フルスイートでも緑）/ `merge --no-ff b9c43511` / `allmarks.app` デプロイ済。
  - **ボトムナビ = `TAG / THEME / SHARE / CORNERS / MORE`**。MOTION は MORE パネル（`ExtensionEntry` の VIEW 行・**モバイル時のみ描画**＝デスクトップは 1 行も増えない）へ降格。SHARE は中央・`data-active` 無し（共有中はナビ自体が引っ込むので点く瞬間が無い）。
  - **スマホに「並べる段」は無い**。CREATE が `sharePhase='arrange'` に**一瞬だけ**入り、選択カードを**画面に内接する中央の 1.91:1 の帯**に自動配置 → 2 フレーム待つ → `.outerFrame` を `fit:'cover'` で撮る → `computeCoverRect` が中央を切る＝**帯とぴったり一致**。**黒帯ゼロ・レプリカゼロ**（s169 の「レプリカ再構成は排除」を守る＝背景の二重管理を増やさない）。
  - **新規純関数** `lib/share/mobile-band.ts`（`mobileCollageBandRect` / `mobileCaptureScale(bandWidth)`）。鮮明さは `dom-to-image` の `scale = 1200/帯幅`（`renderShareImage`・`capture-collage` に `scale?` を新設。**未指定なら `scale` キー自体が付かない**＝デスクトップ撮影はバイト同一）。
  - **結果シート** `MobileShareResult`＝撮った 1200×630 を大きく見せ、`SHARE`（`navigator.share({files,url})`／files 不可なら url のみ／Web Share 無しなら非表示）・`COPY LINK`・`DONE`。`AbortError`（OS シートを閉じた）は**何も出さない**。撮影失敗でもリンクは作る。
  - **回転ノブ**を `@media (hover: none)` で常時表示に。**先に `data-no-capture` を付けた**（付けずに開けると、タブレットの共有画像にノブが焼き付く）。
  - **設計の穴を2つ、レビューで潰した**: ①初版の `mobileCollageBandRect` は帯の高さを画面に切り詰めており、横長画面で帯≠切り出しになった（帯を「内接する中央の 1.91:1 矩形」と定義し直して無条件成立に）②**`fit:'cover'` を誰も固定していなかった**（`'contain'` に戻しても全テストが緑だった）→ 画像の左右300pxを8px格子でサンプルして色数を数える**黒帯検出テスト**を追加。`contain` で確実に赤くなることを実装者とレビュアーが独立に確認。
  - **★s185 実機フィードバックで (N-56) が発覚＝画像ができない**。下記参照。合成環境（Playwright 390×844）では 5/5 緑だったので、**撮影は実機でしか検証できない**を追認。
- **(N-55) 撮影成功後もコラージュがシートの裏で触れる（s185 最終レビュー発見・非ブロック・実害なし）** — 成功後も `sharePhase` は `'arrange'` のままなので `CollageCanvas` が生きており、帯のカードを指で動かせてしまう（回転ノブも `hover:none` で見えている）。画像は既に撮り終えて R2 に載っているので**共有内容は 1mm も変わらない**が、「動かせるのに何も起きない」のは小さな UX の傷。直すなら成功時に当たり判定を殺す。※**(N-58) を実装するなら消える**（触れて正しくなる）。

### session 185 実機フィードバック（★次セッション最優先・N-56 は致命）

- **(N-56) ★★スマホで共有画像が作成されない（実機・致命・ローンチブロッカー）** — 症状（s186 でユーザー確定）＝**(a) プレビューが出ない・iPhone Safari・4枚でも発生**。
  - **✅ s188 で「診断可視化＋倍率フォールバック＋真っ白検出」を実装・本番反映済**（計画書 Task 1〜5 完了・opus 全ブランチレビュー READY TO MERGE・Critical/Important ゼロ）。撮影を段階別（no-frame/timeout/render/decode/blank/normalize）に診断し、失敗したら**倍率1で撮り直し**、iOS の「真っ白な成功画像」を失敗扱いにする。結果シートに **NO IMAGE — LINK ONLY** の琥珀枠＋**1行の診断文字列**（例 `#1 x3.08 render 9000ms RangeError… / #2 x1 ok 2100ms`）を出す。**デスクトップはバイト同一**（レビュアーが呼び出し元で検証）・**撮影失敗でもリンクは必ず作る**。
  - **★次セッション最優先＝実機で診断行を1回読む**: ユーザーに iPhone で `allmarks.app` → SHARE → SELECT ALL → CREATE を実行してもらい、結果シートの診断行（黄枠 or プレビュー下の灰色英数字）を報告してもらう。**その1行で真因が確定**し、恒久対応（下表）を1つ選んで別セッションで実装する:
    - `#1 x3.08 … → #2 x1 ok`（倍率が犯人）＝ F1: `fallbackScales` を `[2,1]` にして中間画質を確保＋将来「帯だけ撮る」最適化（canvas 面積 1/4）。**この場合は既にフォールバックで救えている**（画像は出る）ので、診断で確定させるだけ。
    - `blank`（iOS foreignObject 空振り＝真っ白）＝ F4: ユーザーと相談。canvas 直描画のモバイル専用レンダラー（大工事）か、「この端末は画像なし」を正直に出す（現状の NO IMAGE 表示のまま）か。
    - 両方 `timeout` ＝ F2: `timeoutMs` を 30000 に＋arrange 進入時に proxy URL を先読みして CF edge を温める。
    - `render SecurityError` ＝ F3: proxy 対象漏れ（srcset/CSS 背景）を特定。**この F3 で診断行の URL 切り詰めも同時に行う**（レビュアー Minor #2・現状は自端末・自データ・非送信なので出荷可）。
  - **N-58 との関係**: retry は現状「全再実行」（新しい /s リンクを作る）。N-58 実装後に「撮影だけ再実行」へ差し替わる（計画書明記）。
  - **★s188 実機結果（想定より深刻）＝OOM タブクラッシュ**: 100枚 SELECT ALL で、共有ボードは表示されるが CREATE（撮影）で**タブごと強制終了**（黒画面→再読込→ボードに戻る→繰り返すと Safari が止める）。リンクも作られない＝`createHostedShare` 到達前に死亡＝catch 不能なメモリ枯渇。**画面表示の診断（s188）はページごと消えて読めない**。s188 の倍率フォールバックも**タブが死ぬと土台ごと消えるので効かない**＝1回目の撮影を軽くするしかない。
  - **★s188.1 出荷済（本番反映）＝クラッシュ耐性パンくず**: `lib/share/capture-breadcrumb.ts`（localStorage 同期）＋`CaptureCrashNotice.tsx`（次回起動時に琥珀枠で読み返し）。撮影直前に `枚数・canvas WxH・元画像総MP(sourceMP)` を記録→無事終われば消す→落ちて残れば次回表示。tsc0 / vitest 2269 / build OK。
  - **★主犯確定（実機パンくず）**: `100 cards · canvas 1200×1744 (x3.2) · images 78MP`。canvas=210万画素(無害)、**images 78MP=撮影時に全カード画像を原寸展開で約310MB→タブ上限超過が主犯**（canvas の約37倍）。
  - **★s188.2 恒久修正 出荷済（本番反映）＝撮影時のカード画像 適応縮小**: `lib/share/capture-thumbnails.ts`（`captureThumbnailMaxPx`＝合計約12MP予算・100枚→346px・少数→原寸1200／`buildCaptureThumbnailMap`＝proxy 経由 fetch＋canvas 縮小・同時実行4）。`capture-collage.ts` に `captureThumbnails?` opt（**デスクトップは渡さず byte-identical**）。BoardRoot モバイル多枚数時のみサムネ Map を渡す（少数は原寸＝不変）。tsc0 / vitest 2277 / build OK。
  - **★s188.2 でクラッシュは解消（実機確認済）**。だが **6枚でも 100枚でも画像が出ない（暗い）＝枚数非依存**。→ **iOS Safari の dom-to-image が foreignObject 内の画像を描けない**制限が確定（PC Chrome では出る＝iOS 固有・候補①/F4 が現実化）。小技では直らない。
  - **★恒久修正＝canvas 直描画へ移行**（foreignObject 不使用）。計画書 **[2026-07-12-n56-mobile-canvas-renderer.md](superpowers/plans/2026-07-12-n56-mobile-canvas-renderer.md)**（Task 1〜5）。土台 `lib/share/capture-mirror.ts`（既存の canvas 直描画レンダラー・primitives 完成）を流用し、`chosen`＋`collagePositions`＋`band` から直接描く。**デスクトップは dom-to-image のまま触らない**。ユーザー承認済（¥0・安全確認済）。
  - **★次セッション最優先＝この計画書を subagent-driven-development で実装** → 実機で写真が出るか確認 → 出れば N-56 完了→N-58段階1。
  - 旧計画 [n56](superpowers/plans/2026-07-11-n56-mobile-share-image-fix.md)（診断・縮小）／ narrative [TODO_COMPLETED.md](./TODO_COMPLETED.md) s188。
- **(N-57) スマホのボードに背景タイトル（ワードマーク）が出ていない** — **これは s185 のスコープ外**（N-51 の残りとして次に置いてあった）。`BoardBackgroundTypography` の `!isMobile` ゲートを外すだけ。ユーザーの理由＝「ボトムナビの THEME からカスタマイズできるように見えるのに見えないのはおかしい」。出したら**スマホの共有画像にもタイトルを載せるか**を決める（s185 は盤面に無いので `setShareTitle(null)` にしてある）。
- **(N-58) ★スマホでもコラージュさせたい（＝s185 の「並べる段を出さない」決定を撤回）** — ユーザー曰く「簡素でもコラージュしたい。表現の場なのでスマホでもきちんと表現させたい」。s185 spec §2.1 でユーザー自身が「並べる段は出さない（失うもの＝移動・回転・拡縮・タイトル編集）」を承認していたが、実機で触って**表現できないことが受け入れられないと判明**。
  - **既に指で動く**（s184 調査）: 並べる段のドラッグ移動／リサイズ（掴めるが弧が hover 依存で見えなかった → s185 で `@media (hover:none)` により**回転ノブは指で触れるようになっている**）。
  - **要設計**: 帯（画面中央 1.91:1・390px なら高さ 204.75px）は指で編集するには狭すぎる。**「撮る枠」と「編集する画面」を分ける**必要がある（例: 帯だけをピンチズームして編集／編集中は帯を画面いっぱいに拡大して見せ、撮影時に縮める）。撮影の不変条件（帯＝`computeCoverRect` の切り出し）を壊さないこと。
  - **(N-55) と (N-56) と束ねて考える**。N-56 が直らないと編集しても写らない。
- **(N-59) スマホでも列数と余白を簡易的に変えたい（新規要望・小）** — 「決められた余白の値だけ動かせるようにしてもいい」。デスクトップの TUNE（W/G フェーダー）はスマホに無い。`MOBILE_LAYOUT.COLUMNS`(3) / `GAP_PX`(14) / `SIDE_MARGIN_PX`(16) は現在ベタ書き定数。**離散的な選択肢**（例: 列数 2/3/4、余白 小/中/大）にして THEME か MORE パネルに置くのが素直。IDB `board-config` に載せれば永続も既存の器で済む。
- **(N-50) タブレットの作法（s184 発見・ローンチ前）** — **このアプリにタブレット用レイアウトは存在しない**。分岐は `useIsMobile()` の 640px だけで、**744〜1180px は 1489px の PC と同一描画**。結果、iPad では SHARE 60×27 / TITLE 60×27 / TUNE 53×28 / POP OUT 74×27 / MANAGE TAGS 103×27 / メーター 18px と、**主要操作が全て指の最小寸法未満**。合格は「＋」保存ボタン 56×56 のみ。規則は N-48 で確立済（大きさ＝入力／並べ方＝幅）。適用先の棚卸しが要る。
- ~~**(N-51) スマホでボード背景が見えず、テーマの意味が薄い**~~ ✅ **s184 完了・本番反映**（ユーザーがモック5案から **(c) 3列のまま左右16px・すき間14px** を選択）。`MOBILE_LAYOUT` に `SIDE_MARGIN_PX: 16` を追加＋`GAP_PX: 6→14`。`BoardRoot` の `layoutSidePaddingPx`（モバイルのみ16／PCは `BOARD_INNER.SIDE_PADDING_PX`=9）で幅とオフセットを一本化。受け取り画面の `.scroller` も 640px 以下で左右16px。390px でカード幅は 120→110px、列数は3のまま。PC は不変。
  - **★残り（ユーザー判断）**: **スマホのボードでは背景ワードマーク（タイトル）はいまも描画されない**（`!isMobile` ゲート）。今回で見えるようになったのは**パターンと盤面色だけ**。タイトルも出すなら別対応（モック案 (e) 相当）。
- ~~**(N-52) パターン（グリッド・ドット等）の太さをスライダーで調整したい**~~ ✅ **s184 完了・本番反映**。THEMES→CUSTOMIZE の DENSITY 直下に **THICKNESS** 行（1〜6px・刻み0.2・右で太く）。**太さは2箇所にベタ書きだった**＝`patternSvgDataUri`（受け取り画面・OG 画像）と `themes.module.css` の CSS グラデーション（本物盤面・SHARE スクショ）→ 両方を `patternStroke` と純関数 `effectivePatternStroke`（`min(太さ, 間隔/2 − 1)`、下限0.5）に集約＝**盤面と共有リンクで線の太さが食い違わない**。**既定は1px も動かない**（線=1・ドット=1.4、**パターン種別ごとの既定**なのでグリッド→ドットに変えても r=1.4 のまま）。DB バージョン上げ不要（`board-config` の JSON 塊内）。共有スキーマは `.optional()`（必須にすると既存リンクの `custom` が丸ごと落ちる）。opus 敵対的レビュー＝SHIP・欠陥0。tsc0 / vitest 2215。
- ~~**(N-54) ★グリッド/クロスハッチの交点だけ濃くなる**~~ ✅ **s195 完了・master マージ済（`62f2a934`）・`allmarks.app` デプロイ済**。原因＝本物盤面が CSS の重ねグラデ2枚で描き交点が二重合成。修正＝**盤面も受け取り/OG と同じ単層 SVG（`patternSvgDataUri`）をタイル**（`BoardRoot` の `.patternLayer` を inline SVG background に・useMemo・間隔/太さ/色/パララックスは不変）＋ `themes.module.css` の死んだ 4 グラデ規則を削除（副次効果＝dom-to-image のグラデ片方向落ちも解消）。**交点の濃さを実測**: 修正前 CSS は交点が **58/ch 濃い**（バグ）→ 本ブランチ **0/ch**（根治・α合成の理論値と一致）。tsc0 / vitest 2350 / board-theme e2e 3/3 / opus 全ブランチ Ready=YES・Crit/Important 0。**★残＝ユーザー実機目視**（薄い色グリッドで交点の粒々が消えたか＋受け取り画面 /s/ でも一致するか）。
- **(N-51 の残り) ★スマホのボードに背景タイトル（ワードマーク）を出す（s184 ユーザー確定）** — 現状 `BoardBackgroundTypography` は `!isMobile` ゲートで**スマホでは描画されない**。受け取り画面では出ている。**ユーザーの理由**＝「ボトムナビの THEME からカスタマイズできるように見えるのに、実際は見えないのはおかしい」。s184 で左右16px・すき間14px の余白ができたので出す余地はある。TITLE 色は既に `ThemeCustomization.titleColor` で可変。
- ~~**(N-53) ★フル e2e が半分落ちる（回帰検出網が半分死んでいた）**~~ ✅ **s195 完了・master マージ済（`d453ba21`・非デプロイ）**。**30本落ち → 0本**（フル 72 pass / 0 fail / 5 skip・2回連続で安定）。真因は3系統＋想定外の「陳腐化」: ①版数固定 seed（`open(dbName,9)`＝VersionError）→ **版数非固定の共有ヘルパー `tests/e2e/helpers/seed-db.ts`**（スキーマ完成までポーリング＋無版数 open・自分では作らない＝race 修正込み）に全移植 ②`networkidle` 待ち→実要素待ち ③dead-link ガード（ogp が Pages Function 化し dev で404）→ seed に `linkStatus:'alive'`+`lastCheckedAt` ④**多数が撤去/変更済み機能の古いテスト**（display-mode 撤去・swipe /triage 撤去・再生オーバーレイ撤去・hover が cross-fade 化・FLIP が clone-tween 化・save が全画面タブ化）→ **現挙動へ再ターゲット（検証は弱めず・むしろ強化・確立コミットを引用）or 撤去済みは削除**。display-mode.spec は削除（機能が非マウント）、triage-flow は削除でなく**現 TriagePage 用に書き直し**（タグ作成フローは生存）、board-b0:81 は**文書化した skip**（素の左ドラッグは grab-wiggle で元に戻る＝意図的挙動・pan は Space/中クリック）。`lib/board/fill-snap.ts` の死コード `fillCandidates`/`snapToFill` も prune（**N-45/N-07 吸収**）。tsc0 / vitest 2350 / opus 全ブランチレビュー Ready=YES・Crit/Important 0。**フォロー（非ブロッキング）**: drag-pan(Space/中クリック)の e2e 追加／`DisplayModeSwitch.tsx`＋孤立 `handleDisplayModeChange` は**既存の死んだ製品コード**（別途掃除）／`waitForStableBox` を helpers に集約。
  - **(N-45)** ✅ 完了済（旧 SHARE e2e 3本は `ac0b35da` で削除済・fill-snap prune は本タスクに吸収）。**(N-07)** ✅ 本タスクの VersionError 修正に吸収。
- ~~**(N-45) 掃除：古い SHARE e2e 3本が消えた testid を参照**~~ ✅ **実は完了済みと s186 調査で判明**（3本は commit `ac0b35da` で削除済み・この記載が古かった）。残る `lib/board/fill-snap.ts` の旧 `fillCandidates`/`snapToFill` prune は [N-53 計画](superpowers/plans/2026-07-11-n53-e2e-repair.md) Task 6 に組込み済み。

### session 161 で報告（Mac 実機・友人フィードバック ＋ 雑多改善 — ★ローンチ前クロスプラットフォーム）

> **前提の要確認（最重要）**: 友人が Mac で使ったのは **Chrome か Safari か**。拡張は Chrome ウェブストア版＝Chrome 専用。Safari だと拡張自体が入らない（＝タグメニュー等が出ないのは想定内で、対応は「Safari 拡張を別ビルド（大）」or「拡張なし導線＝ブックマークレット/貼り付け/PopOut を磨く」）。Mac-Chrome なら実バグ。ここで scope が大きく変わる。

- ~~**(N-40) ★SHARE アレンジで多数カードが表示されない**~~ ✅ **セッション167 完了（本番反映・merge `b42c2fe`）**。「1画面に最大サイズで自動配置」＝新純関数 `fitSelectionToScreen`（skyline パック＋収まる最大倍率の二分探索＋安全領域中央寄せ・gap も倍率で縮小）で何枚でも画面外に出ない。`handleEnterArrange` を WYSIWYG→フィットシードに。Playwright で 40/100枚×一般/実機画面すべて画面外0 実測。詳細 [TODO_COMPLETED.md](./TODO_COMPLETED.md) s167。**残＝ユーザー実機目視のみ**。
- ~~**(N-41) コラージュ回転ノブのデザインを業界水準に**~~ ✅ **セッション167 完了（本番反映・N-40 と同回）**。Canva/Figma 風の円形回転アイコン（弧＋矢印 SVG）に刷新。角度ロジック `collage-rotate.ts` 不変・見た目のみ。**残＝ユーザー実機目視のみ**。
- **(N-24) ★Mac 対応必須（ローンチ前）** — 友人実機で複数箇所うまく動かない。スマホと並ぶ公開前クロスプラットフォーム項目。**ブラウザ＝Chrome 確定（s161）**＝Safari 非対応ではなく Mac-Chrome の実バグ。**タグ窓が出なかった件は N-25（タグ0件バグ）だった可能性大＝修正済**。残りの「複数箇所」＝下記 N-39 ほか、Mac 実機で1つずつ洗い出し（systematic-debugging Phase1）。
- ~~**(N-39) ブックマークレット保存の `/save` ウィンドウが「画面いっぱいの PiP みたいな見た目」（Mac-Chrome）**~~ ✅ **セッション162 完了（本番反映・commit `a3d53ed`/`ccae0f1`）**。真因＝**Mac-Chrome はフルスクリーン中 `window.open` を別タブ化する Chrome 仕様**（コードのバグでない）。対応＝`/save` が自ビューポートで「タブとして開かれた」と検知→中立な中央カード（間延び解消）＋初回フルスクリーン案内＋最短クローズ＋15言語化。**残＝Mac 実機の目視のみ（「おそらく大丈夫」）**。
- **拡張の再審査は束ねる**：拡張本体に関わる修正（**N-25 済／N-28 Pinterest／N-29 設定導線**）は**まとめて manifest 版上げ→1回でストア再審査**（審査サイクルを何度も回さない）。N-30(PopOut) は web(PiP) 側なので拡張再審査には不要。
- ~~**(N-25) タグ付けウィンドウが出ない（タグ0件の初回状態が原因・★ローンチ致命的）**~~ ✅ **コード修正済み（s161・要実機/再審査）**。systematic-debugging で確定：面＝**拡張のフローティングボタン quick-tag 帯**（`getStripAnchor` が画面右端・縦中央＝「別画面で画面中央右」に一致・ホストページ注入）。真因＝**受信側 [floating-button.js:611] の `msg.tags.length > 0` ガードが空配列を捨てていた**（送信側 dispatch.js は0件でも送っている／作成入力欄 `enterInputMode` は0件でも動く）＝**全新規ユーザーが保存時に最初のタグを作れない**。修正＝611 を `Array.isArray(msg.tags) && msg.bookmarkId` に（`tags.length>0` 撤廃）＋源泉 `shouldShowStrip`（tag-strip-model.js）とデッド copy(371) も同期＋テスト更新（tag-strip-model.test.ts）。本体ボード/PiP は0件でも正常（無条件で開く）と確認済。tsc0・拡張テスト131緑・node --check OK。**残＝ユーザー実機（unpacked reload で0件保存→右中央に「+ ADD TAG」帯が出るか）＋ Chrome ストア再審査（他の拡張修正 N-28/29/30 と束ねて1回で出すのが効率的）**。
- **(N-26/32/33/35) フラット化 — サブ①完了（s163）→ 次はサブ②** — 親 spec [2026-07-05-flat-theme-and-theme-boundary-design.md](superpowers/specs/2026-07-05-flat-theme-and-theme-boundary-design.md)。**白フラットを新default／現・暗い体験は「音波」テーマとして盤面 byte-identical 温存／テーマは盤面5項目だけ／全メニュー中立＋大パネル右ドロワー統一／角丸トグル＋N-35 つまみ／N-33 はサブ④で確定**。分解＝~~①テーマ境界＋メニュー中立化＋右スライド統一~~ ✅ **s163完了**（[spec](superpowers/specs/2026-07-05-flat-sub1-menu-neutrality-right-drawer-design.md)/[plan](superpowers/plans/2026-07-05-flat-sub1-menu-neutrality-right-drawer.md)・`ChromeDrawer` 統一＋メニュー中立化）→ **②白フラット default テーマ（次）** →③カスタマイズ（角丸＋N-35）→④音波命名＋N-33 タグ表記。下記の個別 N-26/32/33/35 はこの spec に統合済み（archive 用に残置）。
- ~~**(N-27) 左右マージンでスナップ＝実装済だが“矯正が有害”で作り直し（s183 実機で判明）**~~ ✅ **s183完了・本番反映**（中央寄せせず左詰め維持・今の列数のまま左右一致値に吸着＝列数を変えない・範囲で緑マーク点灯・画面px吸着。`snapToFillAtCurrentColumns`）。**実機確認の残**＝吸着の効き/範囲UIの見え。 — 旧: s173 で `fill-snap.ts`（`fillCandidates`/`snapToFill`・W/G 両フェーダー配線・当時実機OK）として出荷済。**が s183 実機で真の問題が判明＝スナップが強すぎて列数の意図を上書きする**：ユーザーは 5列にしたいのに、指を離すと「左右マージンが揃う別候補（4列）」に**矯正される**（`243.57/34.16` で 5列狙い→離すと 4列化）。原因＝`snapToFill` は「N×幅+(N−1)×gap=盤面幅」の**全 N の候補**から近い方に吸着するため、隣の列数の even-fill 候補に飛ぶ。**s183 調査の「吸着範囲が約2px で届かない」という当初診断は誤り**（届く時に誤爆している）。→ **正しい狙い＝「今の列数のまま左右マージンを揃える」**（列数を変えずに幅/gap を even-fill 値へ）。**設計を brainstorm し直す**（列数固定スナップ／ずっと弱く+明確な目印だけ／FILL ボタンで任意発火 等）。scope 小〜中。**s183 で着手予定（束B）**。
- **(N-28) ★Pinterest 保存ボタン連動（優先度高・来週着手予定・s183 でユーザー確定）** — s183 調査で確定: **Pinterest の URL を通常保存するのは今でも動く**（Pin ページの `og:image`(i.pinimg)/`og:title`/`og:url` 完備＝きれいなカードになる・実 fetch で確認）。**未対応＝Pinterest 自身の「保存」ボタン押下での自動連動**（X like/YouTube like と同じ per-site 方式）＝**s49 で一度作って実機で動かず外した所**（真因未診断＝保存ボタンの DOM/`data-test-id` が検出できず）。再挑戦は**まず実機で実 DOM をダンプ→本当の属性特定**の1手が必須（note.js/vimeo.js が s49 でやった手法）。code は git history に生存（`TODO_COMPLETED.md:2908`）。scope 小〜中だが不確実。**他の拡張修正（N-25/N-29）と束ねて1回で再審査**。
- **(N-29) 拡張の設定、入れてすぐ見れる状態に** — インストール直後に設定/使い方が見える導線（初回 options ページ自動表示 or アイコンからの案内）。現状は気づきにくい。
- ~~**(N-30) PopOut の「＋タグ」をカード外へ**~~ ✅ **セッション162 完了（本番反映・commit `eab12f1`）**。カード左上の重ね表示 → PopOut 窓上部中央の読みやすいピル（`PipStack .addTagPill`）。カード形が変わっても位置固定・明るい画像でも埋もれない。spec [2026-07-05-pip-add-tag-outside-card-design.md](superpowers/specs/2026-07-05-pip-add-tag-outside-card-design.md)。**残＝Mac/実機の目視のみ**。
- **(N-31) タグ体験の作り直し：MANAGE TAGS 画面を廃止 → 「選択してタグにドラッグ＆ドロップ」** — 現状のマネージ/Triage（1枚ずつスワイプ）を廃止し、**ボタンで選択モード→カードを選ぶ→タグへ D&D で付与**に。s157 の SELECT CARDS 選択モード＋s95 の「画像ドラッグでタグ付け＋ガラス演出」構想を土台に流用余地。**大改修＝brainstorm 必須**。関連 memory `project_selective_share_shipped` / `project_tagging_top_priority`。
- **(N-32) メニュー系を全部フラットに刷新（design 方針・N-26 と一体）** — 全メニュー UI をフラット化。N-26（default テーマをフラットにして LP に寄せる）と同じ「フラット化」方針の一部。**まとめて brainstorm**（視覚言語の再定義＝大物）。
- **(N-33) タグの大文字表示（＝実は“見た目の設計判断”・brainstorm 合流／s161 調査済）** — **調査結果**：保存側は**既にケース保持**（`applyNewQuickTag` は入力どおり `trimmed` で作成、`addTag` は `input.name` 保存、照合は `toLowerCase()===toLowerCase()` の case-insensitive）＝**機能的に直すものは無い**。「小文字に見える」の正体は**表示側の `text-transform: lowercase` がアプリ全体で一貫**（[CardsLayer.module.css:41] 本体タグ／[FilterPill.module.css:366,419] フィルタ／[TagAddPopover.module.css:89]／triage TagPicker・TriageCard／ShareMirror／拡張 floating-button.css 計8+箇所）＝**意図的な統一デザイン**。→ 大文字を出す＝**アプリ全体の視覚変更**＝**フラット化 brainstorm（N-26/32/35）で「タグの見た目」として決定**（ui-design.md：見た目変更は要ユーザー承認、勝手に剥がさない）。**要確認の小さな別件**：share import (`lib/share/import.ts`) は名を lowercase 保存の疑い（import.test が `'design'` 期待）＝取り込みタグだけケースが落ちる不整合の可能性→ brainstorm 時に確認。
- **(N-35) 見た目の微調整コントロール：タイトルの font/サイズ、背景の格子の太さ・ドット径 等を変えられる** — ユーザーが盤面の見た目を微調整（タイトル書体・サイズ／背景パターンの格子線の太さ・ドット径 等）。既存 theme-customization（`resolveThemeCustomization`/`patternSvgDataUri`）＋TUNE 資産に接続。※N-26/N-32（フラット化・TUNE 見直し）と**方針の擦り合わせが要る**：default は静かに・でもユーザーに“表現の摘み”は残す＝両立可能。どの摘みを新フラット系で残す/露出するかは brainstorm で確定。
> **【N-34/36/37/38 統合 SHARE 作り直し — フェーズ1 出荷済（s165・本番反映）／フェーズ2・3 残】** [spec](superpowers/specs/2026-07-06-share-collage-screenshot-rebuild-design.md)／[plan](superpowers/plans/2026-07-06-share-collage-screenshot-rebuild.md)（10タスク3フェーズ）。**✅ フェーズ1（Task1-4＝コアモード：SHARE→選ぶ→並べる自由配置→範囲選択スクショ→終了でグリッド復帰／旧ドロワー撤去）出荷**。残：**フェーズ2＝編集/移動できるコラージュ・タイトル（Task5-7・N-37）** → **フェーズ3＝COPY LINK 併記（Task8-10・N-38 の /s 併記）**。以下の N-34/36/37/38 原文は経緯として保持。

- **(N-34) Share の作り方そのものを作り直す：選択→“疑似 Share タグ”で本物の盤面に入り、その場でサイズ/並び順を整えて送る** — 現状の選択的シェア(s157)は「選んだら即共有」。新案＝Share で選ぶ＝**疑似的に Share タグ/フィルタが付いた状態**で**本物のボード画面**に切替（複製プレビュー・ShareMirror を挟まない）→その場でカードの**サイズ・並び順を編集**→「この状態で送る」。**要設計判断**：その場の並べ替え/サイズ変更を **(a)** 共有だけの一時状態にして送信後に元の盤面へ戻すか、**(b)** 本物の盤面にも反映して残すか。**N-31（選択→本物の作業ビューで操作→実行）と同じ操作モデル**＝「選択して本物の画面で仕上げて実行」を Share・タグで一貫させる好機。既存 reorder/free-size 資産＋ `project_selective_share_shipped` を流用。
- **(N-36) 共有画面のときだけ“完全自由配置”解禁＝コラージュモード（N-34 の核心強化）** — N-34 の share 編集画面では通常盤面のグリッド/skyline を外し、**カードを自由配置（位置・重なり・サイズ）できるコラージュ**に。**通常の盤面はグリッド維持**（memory `feedback_allmarks_grid_no_tilt`＝グリッド常時・傾けない は“本体盤面”のルールとして継続）、free 配置は**共有画面限定の意図的な例外**。要設計判断：①傾き/回転まで許すか（従来 no-tilt との関係）②自由配置の座標を**共有データ形式に載せる**（現状は並び順ベース＝x/y を持たせる必要）③**受け取り側 /s も自由配置を再現**できるようにするか④`dom-to-image` 書き出し（シェア画像）との整合。＝データ形式・受け取り・書き出しまで波及する中〜大。
- **(N-37) 共有ボードのタイトルを自由化（無し〜自由文言／font・サイズも自由）** — Share 時にボードのタイトルを「無し」から任意テキストまで設定可。**盤面いっぱいに文字が欠けてもよい**＝font・サイズも自由（巨大タイトルが盤面を横断してOK）。N-35（タイトル font/サイズ）・N-34/36（コラージュ編集）と一体。コラージュの“見出し”として機能。
- **(N-38) ★Share の根本転換：レプリカ再構成でなく“本物の画像”で送る（WYSIWYG・スクショモード）** — ユーザー不満＝「共有すると自分のボードの見た目どおりにならない」。要望＝**1手増えてでも「スクショモードに入る→その画像を添付」**でピクセル一致で送る（レプリカを再現しない）。
  - **見解**：バイラル（X/IG 投稿）にはこれが正解＝**画像こそ拡散する**。N-34/36/37（自由配置コラージュ＋自由タイトル）→**CAPTURE して画像化→投稿**、で「作って見せる」一連に束ねられる。既存 `project_share_theming_screenshot`（dom-to-image スクショ方向）・`capture-mirror.ts` と地続き。
  - **正直な技術的壁**：ボードは他サイトのサムネ＝**クロスオリジン画像**を含む→ dom-to-image でキャンバスが tainted になり黒窓/失敗（既知 `reference_dom_to_image_bound_subtree`）。だから今の共有は“データ再構成”になっている。**ピクセル一致の画像化には画像中継（same-origin proxy）が要る**＝ここが本丸（中〜大）。
  - **推奨形**：**「画像で共有（投稿用・WYSIWYG）」と「ボードで共有（/s・取り込み可の従来型）」を別アクションに分ける**。1つに両立を強いない。ユーザー不満は前者で解消。

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

- **(s202 新規・必ずやる)** 複数画像ツイートのLightbox表示を「開く瞬間だけ盤面と揃えて切り取り／開いた後に手動で画像を切り替えたら全体を見せる」に分離。今回(s202)はシンプルな「常にcover統一」で暫定出荷、理想形は別途設計して実装。詳細・技術的な勘所はIDEAS.md「s202 複数画像ツイートのLightbox内ブラウズを...」節参照。
- **(s186 新規)** 切り抜きコラージュ（clipart.studio 型・手動なげなわ→AI 背景除去の2段）
- **(s186 新規)** シェーダーテーマ（WebGL 1 枚 canvas の擬似 3D 背景・超軽量）
- **(s186 新規)** 既存分の一括取り込み — **方針確定「対応サイトは基本全部、拡張で一括取り込みできるようにする」**（X ブクマ/いいね・YouTube 高評価/後で見る・note/Vimeo/SoundCloud。拡張の自動スクロール収穫が本命＋Takeout CSV 等は拡張なしの受け皿。per-site 見立ては IDEAS.md s186 節）
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
