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

**s219 (2026-09-23)**: テキストカードのガラス化(dotted-notebook)を**Flat・Paper両テーマへ展開**、過程でアバター関連バグ2件(ライトボックスでアイコン欠落・全テーマ共通の角丸崩れ)を発見修正。あわせて**収益化・ローンチ準備の棚卸し**を実施(`docs/private/`の既存計画を読み直し、集金PF=FANBOX確定済み・鍵配布方式=K3の合言葉リンク方式で実証済み・価格¥500/¥1,500確定済み、を再確認)。次セッションはFANBOX受け皿づくりの支援から着手。詳細 TODO_COMPLETED.mdの「s219」節。

**s218 (2026-09-22〜23)**: 端末間同期 **近リアルタイム化配線・PL-1/PL-2完了・K3運用開始・同期UX全面作り直し・テーマ端末別化・端末数表示を追加**、一気通貫で実施。同期の仕組み自体(束1-6)は完成済みだったが、①保存のたびに自動で同期される配線がゼロ→Proxy一箇所配線で解消、②公開前必須のPL-1/PL-2(OAuth本番公開等)完了、③実際にK3の招待リンクから鍵を発行・ユーザーが実機で同期接続を確認、④接続時のUXが分かりにくいとの実機フィードバックを受けガイド付きモーダルに全面作り直し、⑤テーマが端末間で意図せず同期されてしまう実データ不具合を発見・端末ごと独立に修正、⑥「あと何台使えるか分からない」との指摘を受け端末数表示を追加。全てmasterへコミット・`allmarks.app`へデプロイ済、フルスイート最終**3038/3038**。**唯一の持ち越し**: Cloudflareレート制限ルールを`/claim`・`/activate`に設定したが実際にブロックが発動するか確認できていない(実害なし・保留)。詳細 TODO_COMPLETED.mdの「s218続き」節。

### ★公開前の必須タスク — PL-1/PL-2 は s218(2026-09-22) 完了

ユーザー本人がGoogle Cloud Console/Search Console上で実施。サポートメール・開発者連絡先を`allmarks-support@googlegroups.com`へ差替(PL-1)、`allmarks.app`のドメイン検証+OAuth本番公開(PL-2、`drive.file`等は非機密スコープのため追加審査なし)。refresh token 7日失効問題が解消。詳細 TODO_COMPLETED.mdのs218節。

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
- **(N-51 の残り) ★スマホのボードに背景タイトル（ワードマーク）を出す（s184 ユーザー確定）** — 現状 `BoardBackgroundTypography` は `!isMobile` ゲートで**スマホでは描画されない**。受け取り画面では出ている。**ユーザーの理由**＝「ボトムナビの THEME からカスタマイズできるように見えるのに、実際は見えないのはおかしい」。s184 で左右16px・すき間14px の余白ができたので出す余地はある。TITLE 色は既に `ThemeCustomization.titleColor` で可変。

### session 161 で報告（Mac 実機・友人フィードバック ＋ 雑多改善 — ★ローンチ前クロスプラットフォーム）

> **前提の要確認（最重要）**: 友人が Mac で使ったのは **Chrome か Safari か**。拡張は Chrome ウェブストア版＝Chrome 専用。Safari だと拡張自体が入らない（＝タグメニュー等が出ないのは想定内で、対応は「Safari 拡張を別ビルド（大）」or「拡張なし導線＝ブックマークレット/貼り付け/PopOut を磨く」）。Mac-Chrome なら実バグ。ここで scope が大きく変わる。

- **(N-24) ★Mac 対応必須（ローンチ前）** — 友人実機で複数箇所うまく動かない。スマホと並ぶ公開前クロスプラットフォーム項目。**ブラウザ＝Chrome 確定（s161）**＝Safari 非対応ではなく Mac-Chrome の実バグ。**タグ窓が出なかった件は N-25（タグ0件バグ）だった可能性大＝修正済**。残りの「複数箇所」＝下記 N-39 ほか、Mac 実機で1つずつ洗い出し（systematic-debugging Phase1）。
- **拡張の再審査は束ねる**：拡張本体に関わる修正（**N-25 済／N-28 Pinterest／N-29 設定導線**）は**まとめて manifest 版上げ→1回でストア再審査**（審査サイクルを何度も回さない）。N-30(PopOut) は web(PiP) 側なので拡張再審査には不要。
- **(N-26/32/33/35) フラット化 — サブ①完了（s163）→ 次はサブ②** — 親 spec [2026-07-05-flat-theme-and-theme-boundary-design.md](superpowers/specs/2026-07-05-flat-theme-and-theme-boundary-design.md)。**白フラットを新default／現・暗い体験は「音波」テーマとして盤面 byte-identical 温存／テーマは盤面5項目だけ／全メニュー中立＋大パネル右ドロワー統一／角丸トグル＋N-35 つまみ／N-33 はサブ④で確定**。分解＝~~①テーマ境界＋メニュー中立化＋右スライド統一~~ ✅ **s163完了**（[spec](superpowers/specs/2026-07-05-flat-sub1-menu-neutrality-right-drawer-design.md)/[plan](superpowers/plans/2026-07-05-flat-sub1-menu-neutrality-right-drawer.md)・`ChromeDrawer` 統一＋メニュー中立化）→ **②白フラット default テーマ（次）** →③カスタマイズ（角丸＋N-35）→④音波命名＋N-33 タグ表記。下記の個別 N-26/32/33/35 はこの spec に統合済み（archive 用に残置）。
- **(N-28) ★Pinterest 保存ボタン連動（優先度高・来週着手予定・s183 でユーザー確定）** — s183 調査で確定: **Pinterest の URL を通常保存するのは今でも動く**（Pin ページの `og:image`(i.pinimg)/`og:title`/`og:url` 完備＝きれいなカードになる・実 fetch で確認）。**未対応＝Pinterest 自身の「保存」ボタン押下での自動連動**（X like/YouTube like と同じ per-site 方式）＝**s49 で一度作って実機で動かず外した所**（真因未診断＝保存ボタンの DOM/`data-test-id` が検出できず）。再挑戦は**まず実機で実 DOM をダンプ→本当の属性特定**の1手が必須（note.js/vimeo.js が s49 でやった手法）。code は git history に生存（`TODO_COMPLETED.md:2908`）。scope 小〜中だが不確実。**他の拡張修正（N-25/N-29）と束ねて1回で再審査**。
- **(N-29) 拡張の設定、入れてすぐ見れる状態に** — インストール直後に設定/使い方が見える導線（初回 options ページ自動表示 or アイコンからの案内）。現状は気づきにくい。
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

### session 159 で報告（ユーザー実機メモ・新規）

- **(参考) 高解像度化は s159 で試みて revert 済**（表示時に新URL差し替え→FLIP で未デコード縮小の劣化）。再挑戦時は「元画像を先に表示→裏で先読み→差し替え」or 保存時のみ、＋実機検証。memory `reference_lightbox_flip_content_equivalence` 隣に学びを記録。

### session 150続き で報告（ユーザー実機メモ7件 — 残タスクのみ）

> ✅ 完了（→ TODO_COMPLETED セッション150続き）: **N-17** TRASH の EMPTY TRASH ボタン赤 danger 化（本番反映・確認OK）／ **N-18** 拡張クイックタグ窓の見切れ（1列スクロール化・v0.1.22 パッケージ→**2026-07-02 ストア審査提出済**）。
> ⏹ 対応不要: **N-14** Lightbox 中のボードモーション（カード/動画/スライドショーは既に `ambientOn` gate で停止済）。
> 🅿 保留: **N-16** 空ボードの青モーダル＝**スマホ限定**（未対応プラットフォーム）。色トークンだけダーク化済（デスクトップは背景ワードマークに occlude され不可視＝実害なし）。スマホ対応時に再確認。

### session 132 フォローアップ（Plan 2 で出た非ブロッキング・別タスク）

- **(N-07) e2e シード版数ズレ＝既存テスト債務** — `tests/e2e/board-b0.spec.ts` が IndexedDB を `open(dbName, 9)` で開くが app `DB_VERSION=16`([lib/constants.ts:30](../lib/constants.ts#L30)) のため VersionError → board-b0 全テストが seed 時に失敗。Plan 2 起因ではない(7回の DB 版数更新で蓄積)。テーマ切替 e2e は **構造は正しく un-skip 済**。直すにはシードを現行スキーマに合わせる(版数を 16 にし onupgradeneeded で現行ストアを作る、もしくはアプリのスキーマ生成を流用)。中優先。
- **`useTweetTranslation` 引数名リネーム** — [use-tweet-translation.ts](../lib/board/use-tweet-translation.ts) の引数 `themeId` は実際は motion キー('ink-underline'/'glitch-crt')を受ける(Lightbox が `getThemeMeta(themeId).motion.text` を渡す)。`textTransitionKey` 等へリネーム。軽微。
- **perf watch (4K)** — `lib/animation/tag-shutdown/themes/paper.module.css` の `filter: blur(1.5px)` アニメ(tagged-out カードのみ・一回0.46s)と `RulerTrack.module.css .marker { will-change: left }`(非標準)。現状許容、4K でジャンク報告が出たら最初に外す候補。

### session 130 棚卸しで追加（新規・実装可能）

- **(N-04) 一部ツイートで本文テキストが取れない** — repro `https://x.com/fta7/status/2059754329058488795`。次セッションで `/api/tweet-meta`→`cdn.syndication.twimg.com/tweet-result` の payload を実取得し、`text/full_text` が空か別フィールド(note/article)かを確認 → `parseTweetData`([tweet-meta.ts:137](../lib/embed/tweet-meta.ts#L137)) の分岐補強。詳細 IDEAS.md (N-04)。
- **(N-03) ローカル保存の安全性対策** — `navigator.storage.persist()` 要求で eviction 耐性を上げる(安価・高効果)＋EXPORT を目立たせる。Mac デフラグ等は IndexedDB に実質無関係。詳細 IDEAS.md (N-03)。

> session 130 で user が ✅完了 判定: 共有OGタイトル目視 / (I-03)ギャップスライダー / (I-08)フローティングボタン / (I-09)pill音波化 / PiP貼り付け保存・拡張なしカーソルpill。❌見送り: 複数同時再生 / (M)受け取りUI統一。新アイデア (N-01)カラーハント (N-02)Lightbox自動再生プレイリスト (N-05)LPナビ演出 (N-06)有料テーマ → IDEAS.md。

### 共有 (share) — 次セッション着手候補 (session 96 で user 要望)

- **受け取り画面 (/s/<id>/triage) をマネージ画面と同じ UI に** (session 96 user 要望) — 現状 [ReceiverTriage.tsx](../components/share/ReceiverTriage.tsx)(239行) はマネージ [TriagePage.tsx](../components/triage/TriagePage.tsx)(857行)/[TriageCard.tsx](../components/triage/TriageCard.tsx) を**全く再利用していない別物**。user は「マネージと同じ UI で文言だけ共有用に変える」体験を希望。ただし目的が違う (マネージ=自分のブクマ整理 / 受け取り=他人のを取り込み + 送り主タグ提案 + 重複検出) ので「共通部品を共有 + 取り込み固有の振る舞いを差し込む」設計が要る。**brainstorming で方針合意してから実装** (大改修、勝手にやらない)。マネージ側には session 95 の「画像ドラッグでタグ付け + ガラス演出」もあり、受け取りにも欲しいか含め要相談。

### 表示・サムネ系

- **カードが左端に詰まらず隙間ができることがある** (session 93 報告) — 上記 reshuffle 修正で多くは解消の見込みだが、**残因として F5 = skyline-layout が segment の左端しか試さず右の窪みに詰めない**点が残る（監査 board-layout finder 指摘）。reshuffle のユーザー実機確認で「左すき間まだ出る」なら skyline に右端候補/backfill を追加。別途・低優先。
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
