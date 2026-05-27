# 開発ToDo (AllMarks — 旧 Booklage、 2026-05-16 コード rebrand 済)

> 完了済みタスク → [TODO_COMPLETED.md](./TODO_COMPLETED.md)
> アイデア・将来構想・代替案 → `docs/private/IDEAS.md` (非公開、 gitignored)
> 今このセッションのゴール → `docs/CURRENT_GOAL.md` (5〜10 行のみ、 毎回最初に読む)

このファイルは **アクティブな backlog のみ**。 narrative や ✅ 完了は TODO_COMPLETED.md に移動する。

---

## 🔴 月末 (2026-05-28 朝以降) 必須リマインダー

**ユーザーが「allmarks.app」 ドメインを取得したか確認する。**

session 76 (2026-05-26) user 報告: 取得できても 2026-05-28 朝以降の見込み。

- 取得方法: `https://dash.cloudflare.com/` → Domain Registration → allmarks.app → 約 ¥1,600/年
- 取得済 → リブランド実装に進む (詳細は `docs/private/2026-05-11-allmarks-branding-spec.md`)
- 未取得 → 取得を促す

---

## 現在の状態 (次セッションはここから読む)

### 直近の状態 (セッション 86 — シェアモーダル UX 再設計完遂、 ミラー + 同期スクロール + Canvas キャプチャ 本番 ship)

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
1. **🔴 ドメイン取得確認** (= allmarks.app、 2026-05-28 朝以降)
2. **Phase D4 他 14 言語 mood → tag rename** (= 公開時に各国語ユーザー必須)
3. **Phase D5 NewMoodInput → NewTagInput 内部 rename**
4. **onboarding チュートリアル** (= 初回ユーザー向け、 user 自身が複数回言及)
5. **拡張機能 Chrome Web Store 公開準備** (= manifest 整備、 audit、 アイコン整備、 説明文)
6. **拡張機能 設定画面 整備** (= マネージ完了後の「ダサい完了画面」 を「ボードに戻る」 自動化に置換、 components/triage/TriagePage.tsx:334)
7. **LP 整備** (= 現 LP に share / multi-playback / 拡張機能 言及無、 update 要)

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

### 表示・サムネ系

- ~~**B-#23 Vimeo / SoundCloud Lightbox 再生未対応**~~ ✅ session 51 で完遂 (= 専用 Embed コンポーネント追加 + 全 embed 共通 50% 音量デフォルト + SoundCloud カスタムスライダーまで波及)
- ~~**B-#22 長文 tweet Lightbox 末尾だけ表示 bug + 全文表示 enhancement**~~ ✅ session 52 で完遂 (= cleanTitle 過剰マッチ修正 + TextCard 透明グラス redesign + scroll + persistTitle backfill 開通 + font jump 解消、 9 file 変更 / 5 deploy / 19 unit test 追加)
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
