# 開発ToDo (AllMarks — 旧 Booklage、 2026-05-16 コード rebrand 済)

> 完了済みタスク → [TODO_COMPLETED.md](./TODO_COMPLETED.md)
> アイデア・将来構想・代替案 → `docs/private/IDEAS.md` (非公開、 gitignored)
> 今このセッションのゴール → `docs/CURRENT_GOAL.md` (5〜10 行のみ、 毎回最初に読む)

このファイルは **アクティブな backlog のみ**。 narrative や ✅ 完了は TODO_COMPLETED.md に移動する。

---

## 🔴 月末 (2026-05-31 頃) 必須リマインダー

**ユーザーが「allmarks.app」 ドメインを取得したか確認する。**

- 取得方法: `https://dash.cloudflare.com/` → Domain Registration → allmarks.app → 約 ¥1,600/年
- 取得済 → リブランド実装に進む (詳細は `docs/private/2026-05-11-allmarks-branding-spec.md`)
- 未取得 → 取得を促す

---

## 現在の状態 (次セッションはここから読む)

### 直近の状態 (2026-05-20 セッション 59 — 拡張機能 v0.1.7 → 0.1.14 全 7 ship 完遂、 sprint クローズ)

session 58 の v0.1.7 が user 検証で多数の症状判明 → 構造的修正 + 全サイト防御層投入 + SPA navigation 検知 + YouTube DOM 変動追跡を **1 session で 7 回 ship** で対応。 user 最終確認 (Twitter ブクマ + YouTube 高評価 + 後で見る C4wfr7XxYBk) で全て OK、 sprint クローズ。

**7 回 ship の整理**:

| version | 変更 | 解決した問題 |
|---|---|---|
| v0.1.8 | 構造的修正 3 件 + 全サイト防御層 | floating-button inline↔source 再同期、 ミラー防御 5 サイト、 YouTube 一覧 ︙ メニュー対応 |
| v0.1.9 | 黄ピル復活 + SPA navigation で mirror 再チェック | 「保存済 URL 再 click で何も出ない」 + 「動画/tweet SPA 移動でフローティングボタン緑にならない」 |
| v0.1.10 | X SPA 検知の保険 (500ms 定期チェック) | X 一覧→ tweet 個別ページで緑にならない |
| v0.1.11 | YouTube セレクタに 2 種追加 + 検出失敗時 DOM 診断ログ | 特定動画 (C4wfr7XxYBk 等) で Watch Later 検出失敗 |
| v0.1.12 | 診断ログを `console.debug` → `console.log` + 「auto-save fired」 ログ追加 | user の console で diag が見えなかった |
| v0.1.13 | Like 検出にテキストガード | `<like-button-view-model>` が Watch later option ラップするケース |
| v0.1.14 | セレクタから `[class*="ytListItemViewModel"]` 削除 | 内側 span にマッチして text 読み違える bug (= outerHTML から真因特定) |

**業界の現実 (= session 確定)**:
- 競合 (Pocket / Raindrop / mymind / Toby / Notion Web Clipper) **誰も** YouTube Watch Later 自動検知してない
- AllMarks の自動検知は差別化機能だが**ベストエフォート**位置付け
- 100% 確実な保存経路は 4 つ: Ctrl+Shift+B / フローティングボタン / 右クリック / 拡張アイコン

**変更 file (累計 11 modified)**: extension/{content, floating-button, manifest, youtube, twitter, vimeo, soundcloud, note}.js (+ docs/{CURRENT_GOAL, TODO, TODO_COMPLETED}.md)

**テスト**: 633 PASS 維持 (= 全 7 ship), tsc clean、 next build OK

**deploy 回数**: 7 (= 1 日 16 回上限内、 余裕)

**manifest version**: 0.1.7 → **0.1.14** (= user は chrome://extensions で都度リロード必須、 今は最終版 0.1.14)

**次セッション (= 60) の goal**: オンボーディング案内画面の draft (= 高精度 / ベストエフォート / 100% の 3 段階ラベルで自動保存機能を user に正直に案内する画面)。 memory `project_onboarding_stance.md` 参照。 詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 59 セクション

---

### 1 つ前の状態 (2026-05-20 セッション 59 後半 — 拡張機能 v0.1.9 黄ピル復活 + SPA 連動)

session 59 後半で user 第 2 弾実機検証 → v0.1.8 の問題発見 = (1) 黄ピルが**全 5 サイトで出なくなった** (= 保存済 URL で再 click しても何のフィードバックも返らない) / (2) **動画ページを SPA navigation で開いただけ**ではフローティングボタン緑にならず、 リロード必須。 user 提案「フローティングボタンは AllMarks の保存状態インジケーターであるべき」 が正解と確認 → 設計修正。 v0.1.8 → 0.1.9。

**ship 済 (= prod 反映済、 user 再 sideload 必要)**:

1. **Phase A — 黄ピル復活**: v0.1.8 で「ミラー防御 = save 発火スキップ」 にしたが、 save スキップすると当然黄ピルも消える設計ミス。 修正は「save dispatch は引き続きスキップ (= 余計な通信は避ける) + content.js に新メッセージ `pill-duplicate` を直接 postMessage → 即座に「Already saved」 ⚠ ピルを出す」 に変更。 全 5 サイト (youtube / twitter / vimeo / soundcloud / note) で適用 + [extension/content.js](../extension/content.js) に `pill-duplicate` リスナー追加
2. **Phase B — SPA navigation で mirror 再チェック**: YouTube / X / Vimeo 等は `history.pushState` で URL を書き換える SPA。 v0.1.8 までは floating-button.js が初回 page load 時にしかミラーチェックしなかったため、 動画 click で /watch に SPA 移動した時に緑にならなかった。 [extension/floating-button.js](../extension/floating-button.js) に `history.pushState` / `replaceState` のフック + `popstate` + `yt-navigate-finish` リスナー追加、 URL 変化検知後 50ms debounce で `mirrorHas(normalizeUrl(location.href))` 再実行 → 保存済 URL に SPA 移動した瞬間に緑 (silent mirror-hit-initial)、 未保存 URL なら灰色 (mirror-miss)。 user の「フローティングボタン = AllMarks 保存状態インジケーター」 提案がそのまま実現

**変更 file (8 modified)**: extension/{content, floating-button, manifest, youtube, twitter, vimeo, soundcloud, note}.js (+ docs/CURRENT_GOAL.md / TODO.md / TODO_COMPLETED.md)

**テスト**: 633 PASS 維持、 tsc clean、 next build OK

**deploy 回数**: 1 (= session 59 後半 build + deploy)

**manifest version**: 0.1.8 → **0.1.9** (= 拡張 user リロード必須)

詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 59 後半セクション

**次セッション (= 60) の goal**: user 実機検証 (= 拡張 v0.1.9 リロード後、 黄ピル復活 + 動画 SPA 移動で緑表示)。 OK なら元 backlog (= deploy 数 script setup / 10 番 / 音波 sprint / multi-playback / B-#3) に戻る

---

### 1 つ前の状態 (2026-05-20 セッション 59 前半 — 拡張機能 v0.1.8 全サイト構造的修正 sprint)

session 59 で user 実機検証の結果、 v0.1.7 で 4 つの問題が報告 = ① 一覧 ︙ メニューから「後で見るに保存」 で拾えない / ② 「後で見るから削除」 で誤発火 + エラー / ③ 保存後フローティングボタン緑にならない / ④ 保存済再 click で黄ピル。 拡張 5 サイト全部の OFF ガード方式を監査 → 4/5 サイトは ARIA / class ベースで構造的に堅い、 **YouTube Watch Later だけ** が文字列依存だった事実が判明。 構造的修正 3 件 + 全サイトに防御層共通投入。 v0.1.7 → 0.1.8。

**ship 済 (= prod 反映済、 user 再 sideload 必要)**:

1. **floating-button.js inline 状態機械を source of truth と同期** ([extension/floating-button.js](../extension/floating-button.js)): session 58 で source ([extension/lib/floating-button-state.js](../extension/lib/floating-button-state.js)) を `mirror-hit-initial` / `mirror-hit-live` の 2 つに分けたが、 floating-button.js の **inline コピーを更新し忘れていた** = 旧 `mirror-hit` のままで default に落ちて何もしなかった + `save-success` も `pillState === 'saving'` guard で外経路保存をブロック。 これが ③「他経路保存でフローティングボタン緑にならない」 root cause。 inline を source と 1:1 で再同期 + ファイル冒頭に「inline 編集時は source も同期しろ」 警告 comment 追加
2. **全 5 site (= youtube / twitter / vimeo / soundcloud / note) にミラー防御層を共通投入**: chrome.storage.local の savedUrlsMirror を sync-readable Set にキャッシュ、 click handler で「URL が既に AllMarks に保存済なら save 発火を抑止」。 YouTube Watch Later の文字列依存問題を構造的に殺すと同時に、 全サイトの toggle-OFF slip + churn の保険になる。 storage.onChanged で live update。 診断 console.debug 付き
3. **YouTube 一覧 ︙ メニュー経由保存対応** ([extension/youtube.js](../extension/youtube.js)): ホーム / チャンネル / 検索結果 / プレイリストの video tile (= `ytd-rich-item-renderer`, `yt-lockup-view-model` 等 9 selector) を click capture、 thumbnail の `a[href*="/watch"]` から URL を canonicalize + tile から OGP (title / image / channel) 抽出 → pending capture (5s TTL)。 popup の「後で見るに保存」 click 時に extractVideoUrl が null なら pending を fallback として使う → ① ユーザー視点での「同じ操作」 動作を実現
4. **session 58 反省点記載**: 「徹底調査」 と言いつつ実機の「解除」 状態の DOM を一度も capture しなかったのが mistake。 文字列ステム列挙だけでは locale 非依存にならない。 今回は構造的防御 (= ミラー Set) に切り替えた

**変更 file (8 modified)**: extension/{floating-button, manifest, youtube, twitter, vimeo, soundcloud, note}.js (+ docs/CURRENT_GOAL, TODO, TODO_COMPLETED.md)

**テスト**: 633 PASS 維持 (= 新規追加なし、 inline 同期の verification は既存 mirror-hit-initial / live / miss テストでカバー)、 tsc clean、 next build OK

**deploy 回数**: 1 (= session 59 build + deploy)

**manifest version**: 0.1.7 → **0.1.8** (= 拡張 user リロード必須)

詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 59 セクション

**次セッション (= 60) の goal**: user 実機検証 (= 拡張 v0.1.8 リロード後、 YouTube 一覧 ︙ メニュー / 後で見る解除 / フローティングボタン緑連動 / 黄ピル抑止)。 OK なら元 backlog (= deploy 数 script setup / 10 番 / 音波 sprint / multi-playback / B-#3) に戻る

---

### 1 つ前の状態 (2026-05-20 セッション 58 — apple-touch-icon 更新 + 拡張機能不安定 root cause 修正 sprint)

session 57 close-out 直後、 推奨どおり **apple-touch-icon (iOS ホーム画面用)** を 新ロゴ (= 黒 A + 緑チェック) で再生成 + deploy で完了。 その後 user が拡張機能の不安定を報告 (= YouTube 後で見るが動かない動画、 フローティングボタンが緑にならない、 他経路保存時のアニメ無しで唐突な緑チェック)。 拡張機能の全 file (= background / content / floating-button / dispatch / 5 site .js / lib 全部) を熟読 audit → 確定バグ 2 件 + UX 不整合 1 件 を特定 → 一気に修正 + テスト追加 + v0.1.6 → 0.1.7 で manifest bump。 1 deploy。

**ship 済 (= prod 反映済、 user 再 sideload 必要)**:

1. **apple-touch-icon (192px) + maskable PWA icon (512px) を新ロゴへ更新**: SVG → PNG 変換スクリプト [scripts/gen-icons.mjs](../scripts/gen-icons.mjs) を新設 (= 再利用可能、 20% safe-zone padding で PWA Maskable spec 準拠、 白背景 + 中央配置)
2. **URL 正規化 layer 新設** ([extension/lib/normalize-url.js](../extension/lib/normalize-url.js) + [tests/extension/normalize-url.test.ts](../tests/extension/normalize-url.test.ts) 26 test): tracking query (= utm_*, fbclid, gclid 等) + YouTube 専用 (= list, index, t, pp, si, feature 等) + X 専用 (= ref_src, s, t, cn) を strip、 末尾スラッシュ削除、 hostname 小文字化、 idempotent。 [extension/lib/dispatch.js](../extension/lib/dispatch.js) で mirror 保存時 normalize、 [extension/floating-button.js](../extension/floating-button.js) で検索時 normalize、 [extension/background.js](../extension/background.js) で url-deleted message も normalize してから remove。 → user 観察「フローティングボタンが緑にならない」 root cause 解消 (= 保存される URL と検索される URL の query 不一致が原因だった)
3. **YouTube selector を新 DOM 対応に拡張** ([extension/youtube.js](../extension/youtube.js)): `yt-list-item-view-model`, `[class*="ytListItemViewModel"]`, `[role="option"]` を closest selector に追加。 user 報告「動画によっては『後で見る』 で動かない」 → YouTube が A/B test で旧 `<tp-yt-paper-checkbox>` と新 `<yt-list-item-view-model>` を混在配信していた、 旧 selector しか拾えてなかったのが root cause
4. **note.js selector 予防拡張** ([extension/note.js](../extension/note.js)): `button` → `button, [role="button"], a[role="button"]` (= 将来 React app の DOM 変更で button が消えても拾える)
5. **floating-button visual 整合性 fix** ([extension/lib/floating-button-state.js](../extension/lib/floating-button-state.js)): 旧 `mirror-hit` event を 2 つに分離。 `mirror-hit-initial` (= page load 時、 静かに savedFlag だけ立てる) + `mirror-hit-live` (= 他経路で保存された時、 **flash アニメ通す**)。 → user 観察「click 経路はアニメ流れるけど他経路では 30% 不可視で唐突に緑チェック」 解消、 全保存経路で同じ視覚体験

**dead UI (= 報告のみ、 今回は削除しない)**: `cursorPillFallbackPosition` 設定 (= options.html に UI あり、 content.js で未使用) → 次回判断

**変更 file (10 modified + 3 new)**: extension/{background, floating-button, lib/dispatch, lib/floating-button-state, manifest, note, youtube}.js + tests/extension/floating-button-state.test.ts + public/icon-{192,512}.png + 新 extension/lib/normalize-url.js + tests/extension/normalize-url.test.ts + scripts/gen-icons.mjs

**テスト**: 604 → **633 PASS** (+29 件、 normalize-url 26 + floating-button mirror-hit 3)、 tsc clean、 next build OK

**deploy 回数**: 1 (= apple-touch-icon)。 拡張の修正は本体 deploy 不要 (= ユーザーが chrome://extensions で「リロード」 必須)

**manifest version**: 0.1.6 → **0.1.7** (= 拡張 user リロード必須)

詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 58 セクション

**次セッション (= 59) の goal**: user 実機検証 (= 拡張機能リロード後、 YouTube / X / Vimeo / SoundCloud / note の全 button 連動 + フローティングボタン緑チェック)。 もし不安定残ったら「保存通知 dropped 時の mirror-hit salvage」 (= 仕様限界 D) の追加対策へ。 OK なら元 backlog (= deploy 数 script setup / 10 番 / 音波 sprint / multi-playback / B-#3) に戻る

---

### 旧情報 (2026-05-20 セッション 57 — favicon リブランド + 9 URL サムネ消失調査 + session 55/56 dead code 清掃)

session 56 close-out 直後、 推奨どおり **7 URL サムネ消失調査**から着手。 user 雑談で favicon (= 三角形のまま) を session 53 確定の「黒 A + 緑チェック」 ロゴに変えたいと判明 → 先に 5 分仕事で片付け。 9 URL の OGP 並列調査で「source 側に og:image なし」 = booklage の bug ではないと確定 (= fix 不要)。 後半で **session 55/56 dead code 清掃** を scope C (= 最も綺麗な状態) で一気に消化、 2 deploy で全完了。

**ship 済 (= prod 反映済、 user 実機 OK)**:
1. **favicon を 三角形 → 黒 A + 緑チェック (= AllMarks ロゴ)** (`app/icon.svg` 新規、 Next.js 自動 link 注入)
2. **9 URL サムネ消失 → 原因確定 (= fix 不要)**: A 群 7 個 (= liquid-dom-showcase / threejswaterpro / pacomepertant / google labs / joel.plus / kawai-text / pushmatrix) は source 側に og:image 無し、 B 群 2 個 (= github / lovart) は一時 blip 説で観察対象
3. **session 55/56 dead code 清掃 (= 7 file -37 行 net、 視覚 0 影響)**: dead `metaBottom` JSX 削除 / `.headline` `.index` variant 削除 / `.editorial` を base 統合 / `TitleMode` union 削除 + mode type narrow / `TEXT_CARD_MIN_ASPECT` → `TEXT_CARD_ASPECT` 改名 / `@chenglou/pretext` 依存削除 / cleanup-related comment 更新

**変更 file** (8): [app/icon.svg](../app/icon.svg) (new) + [TextCard.tsx](../components/board/cards/TextCard.tsx) + [TextCard.module.css](../components/board/cards/TextCard.module.css) + [Lightbox.tsx](../components/board/Lightbox.tsx) + [types.ts](../lib/embed/types.ts) + [text-card-measure.ts](../lib/embed/text-card-measure.ts) + [package.json](../package.json) + pnpm-lock.yaml

**テスト**: 604 / 604 PASS 維持、 tsc clean、 next build OK

**deploy 回数**: 2

**deploy 数取得 script** (= 未 setup、 持ち越し): [scripts/count-deploys.mjs](../scripts/count-deploys.mjs)。 user が CF API token 発行 + `.env.local` に `CLOUDFLARE_API_TOKEN=...` 追記 → `node scripts/count-deploys.mjs` で月次 deploy 数取得可

詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 57 セクション

**次セッション (= 58) の goal**: backlog から user 選択。 候補:
- 🔧 **deploy 数取得 script setup** (= user の API token 発行 ~3 分 + 動作確認)
- 🟡 **10 番 有名サイト pre-set OFF list** (= 拡張 polish、 ~50 行)
- 🟡 **音波テーマ世界観確立 sprint** (= H + J + K + I-09 + I-10、 session 54 で I-09 一部消化済)
- 🟡 **multi-playback vision board card autoplay** (= AllMarks core 差別化)
- 🐛 **B-#3 重複 URL でサムネ等が出ない** (= 古めの未解決)
- 🎨 **iOS ホーム画面用 apple-touch-icon (= 192px PNG)** を新ロゴに更新 (= 現在 `/icon-192.png` 古い、 session 57 で持ち越し)

🔴 **月末リマインダー (= 2026-05-31 頃)**: allmarks.app ドメイン取得確認

詳細は [docs/CURRENT_GOAL.md](./CURRENT_GOAL.md)

---

### 旧情報 (2026-05-20 セッション 54 — session 53 持ち越し 2 件 + 追加発覚 2 件、 拡張機能 + PiP まわり完全 close)

session 53 持ち越しの B 番重複弾き + PiP サムネ消しを起点に、 4 ポイント console.log でリレー実測 → B 番は session 53 時点から実は動いていた (= 真因は緑「Saved」 と緑「Already saved」 の視覚差別化不足) と判明 → 重複ピル全面 redesign に方向転換。 続けて user 実機で発覚した 2 件 (= site .js 設定 OFF 時 pill ぐるぐる、 PiP open + auto-save で pill 無限) も完遂。 7 deploy で session 53 + 追加全消化。

**ship 済 (= prod 反映済、 user 実機 OK)**:
- **重複ピル 視覚 redesign**: ✓ 緑 / ⚠ アンバー / ! 赤 の 3 段意味体系完成。 stroke + 3 段 glow halo 共通 recipe、 色のみ差し替え。 ⚠ は triangle outline → ! line → dot fade の 3 段ストロークアニメ
- **state テキスト着色** (緑/アンバー/赤 subtle)、 **per-char slide-in + RGB chromatic aberration glitch**: AllMarks ChromeButton hover effect (= SHARE / TUNE / POP OUT) と同じ orange / cyan ghost recipe を流用、 `::before` / `::after` で **ピル幅完全固定**
- **5 site .js (twitter / youtube / note / vimeo / soundcloud) に設定キャッシュ + storage.onChanged**: OFF source は click 検知で早期 return → pill 発火 + sendMessage skip。 storage.onChanged で即反映 (= リロード不要)
- **PiP open + auto-save で pill 無限 spinning bug fix**: dispatch.js の `skipSuccessPill = !!isPipActive` を完全削除 (= site .js の独自 pill 経路と不整合だった)、 floating-button のみ pill 抑制継続。 background.js の pipActive state + content.js の PiP reporter dead code 撤去。 副次効果: 手動保存 (shortcut / 右クリック / ブクマレット) + PiP open でも pill 完走するように
- **PiP サムネ削除追従**: lib/board/channel.ts に `postBookmarkDeleted` / `subscribeBookmarkDeleted` 追加、 persistSoftDelete で発火、 PipCompanion で購読 + cards から id filter
- **PiP delete スライド 中途半端 bug fix**: cards.length 減少時に PipStack の activeIdx を len-1 に clamp + scrollToIdx 700ms ease で再センター、 len=0 で activeIdx を 0 リセット

**変更 file** (15): extension 11 (= manifest / content.{js,css} / dispatch / pill-state-machine / background / 5 site .js) + lib/board/channel.ts + lib/storage/use-board-data.ts + components/pip/{PipCompanion,PipStack}.tsx

**テスト変更 4** (= 604 → 608 PASS): pill-state-machine (warn) / channel (+2 delete) / PipCompanion (delete sync) / PipStack (re-center)

**deploy 回数**: 7

**manifest version**: 0.1.0 → **0.1.6** (= 拡張 user re-sideload 必須)

詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 54 セクション

**次セッション (= 55) の goal**: backlog から user 選択。 候補:
- 🐛 A 番 X 長文 tweet + 画像 で画像のみ表示 → split layout (= 画像左 / 文字右)
- 🟡 10 番 有名サイト pre-set OFF list (= 拡張 polish、 ~50 行)
- 🟡 音波テーマ世界観確立 sprint (= H + J + K + I-09 + I-10、 ただし session 54 で重複ピルに RGB glitch + ⚠ 入れたので I-09 一部消化済)
- 🟡 multi-playback vision board card autoplay (= AllMarks core 差別化)
- 🐛 B-#3 重複 URL でサムネ等が出ない (= 古めの未解決、 重複ピル fix で関連調査の機会)

詳細は [docs/CURRENT_GOAL.md](./CURRENT_GOAL.md)

---

### 旧情報 (2026-05-19 セッション 52 — B-#22 完遂 + TextCard 透明グラス redesign + scroll-aware 全面化 + title backfill 開通)

session 51 持ち越し 4 候補から user 「推奨どおり」 で B-#22 着手 → cleanTitle bug fix 完了 → user 発案で TextCard 全面 redesign (= 透明 + 縁グロー + scroll + 底フェード) に拡張 → 5 deploy + iterative ブレストで密度高く消化。

**ship 済 (= prod 反映済、 user 実機 OK)**:
- **B-#22 長文 tweet Lightbox bug fix**: cleanTitle の `/「([\s\S]+)」/` 過剰マッチを `/さん[::]\s*「(…)」/` に厳格化 → user-content 「」 の誤マッチ撲滅、 19 unit test 追加
- **TextCard 全面 redesign**: 白/黒 destefanis variant 廃止、 透明 + 縁グロー (`linear-gradient border-box` + 32px box-shadow) + scroll-aware 底フェード + native scrollable に統一
- **wheel scroll-chaining**: card 側で「scroll 余地あり時のみ stopPropagation」 + Lightbox 側で「`[data-card-scroll]` element 上で defer」 の二段
- **font jump 解消**: Lightbox text-only tweet の `fakeBoardItem.title` を `item.title` に変更
- **tweet-backfill に persistTitle 開通**: syndication API の `meta.text` を IDB title に上書き
- **extension/twitter.js**: title の 80 文字 slice 撤廃、 cleanTitle が render 時に prefix を剥がす設計

**変更 file** (9): clean-title.ts / TextCard.tsx / TextCard.module.css / Lightbox.tsx / BoardRoot.tsx / tweet-backfill.ts / use-board-data.ts / extension/twitter.js / tests/lib/clean-title.test.ts (新規)

**deploy 回数**: 5

詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 52 セクション

---

### 旧情報 (2026-05-19 セッション 51 — B-#23 完遂 + 全 embed 共通 50% 音量デフォルト + SoundCloud カスタムスライダー + ScrollMeter 波形 glitch)

session 50 が残した 4 候補から user が「おすすめどおり」 で B-#23 (= Vimeo / SoundCloud 再生対応) を選択。 着手 → SoundCloud 音量問題発覚 → 全 embed 共通 50% デフォルト + SoundCloud 自前スライダーへスコープ拡張 → そこから「ボード全体音量つまみ」 構想 (= IDEAS.md K) + ScrollMeter glitch 拡張 (= 4 段階 tuning) という流れで 1 session 7 deploy で密度高く消化。

**ship 済 (= prod 反映済、 user 実機 OK)**:
- **B-#23 Vimeo / SoundCloud Lightbox 再生対応**: URL 種別判定に 2 種類追加 + `extractVimeoId()` 関数 + `VimeoEmbed` (= 16:9) / `SoundCloudEmbed` (= 1:1 visual) 2 コンポーネント新設 + ShareCardType 拡張。 SoundCloud は iframe `allow` 属性を YouTube と同じ 7 属性集合に拡張で「再生押せるけど音出ない」 問題解決 (= encrypted-media が必要だった)
- **全 embed 共通デフォルト音量 50% スプリント**: `lib/embed/default-volume.ts` を立ち上げ (= localStorage + React hook + カスタムイベント同期)、 SoundCloud (= Widget API + Twitter 風自前スライダー右下 overlay) + YouTube (= Player API postMessage) + Vimeo (= Player API postMessage) + Twitter X 動画 (= HTML5 video ref) + TikTok Tier 1 (= 同上) すべてに 50% デフォルト + user 調整時 cross-card 同期。 TikTok Tier 2 (= iframe) は外部 API 制御不可で対象外
- **ScrollMeter 波形 glitch 拡張**: counter glitch (= session 43 既存) を維持しつつ、 波形 (= 150 tick) にも 720ms burst パターン (= 10% drop + 0.40-1.65x mult) を 4 トリガー (= track hover / counter hover / click / Lightbox open-close) で連動。 何もしてない時は完全 calm sinusoid 維持、 user の「常時暴れ」 試行は revert (= うるさかった)、 最終形は「触った瞬間だけ短く暴れる」 で確定

**設計記録 (= IDEAS.md に永続化)**:
- **K section 新規**: ボード全体音量ロータリーノブ — オーディオミキサー POT 風 + 円弧 LED 列で現在値が光る + 既存 `defaultVolume` global state に直結。 multi-playback vision sprint と同時 or 直後着手、 詳細仕様は [docs/private/IDEAS.md](../docs/private/IDEAS.md) K 項 (= 配置 4 案 + 操作 7 種類 + 工数 ~380 行)

**変更 file** (12): 新規 3 (`lib/embed/default-volume.ts`、 `lib/embed/soundcloud-widget.ts`、 `tests/lib/default-volume.test.ts`)、 変更 9 ([Lightbox.tsx](../components/board/Lightbox.tsx) / [Lightbox.module.css](../components/board/Lightbox.module.css) / [ScrollMeter.tsx](../components/board/ScrollMeter.tsx) / [ScrollMeter.module.css](../components/board/ScrollMeter.module.css) / [url.ts](../lib/utils/url.ts) / [aspect-ratio.ts](../lib/board/aspect-ratio.ts) / [share/types.ts](../lib/share/types.ts) / [url.test.ts](../tests/lib/url.test.ts) / [TODO.md](./TODO.md))

**deploy 回数**: 7

詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 51 セクション

**次セッション (= 52) の goal**: B-#22 (= 長文 tweet Lightbox 末尾だけ表示 bug + 全文表示 enhancement) が最有力。 または音波テーマ世界観確立 sprint (= H + J + K + I-09 + I-10) の集中投下。 詳細は [docs/CURRENT_GOAL.md](./CURRENT_GOAL.md) 参照

---

### 旧情報 (2026-05-19 セッション 50 — cursor pill 即時化 + ✓ 緑 glow + 設計議論 3 件 + B-#25 ドロップ)

session 49 終了直前 user 4 要望 (= B-#24 / B-#25 / I-10 / I-08) を CURRENT_GOAL に永続化した状態で開始。 user 「おすすめ順で OK」 で B-#24 → 設計議論 → B-#25 の流れで密度高く消化。

**ship 済 (= prod 反映済、 user 実機 OK)**:
- **B-#24 cursor pill 即時化** (= 体感遅延 100-300ms → ~10ms): site-specific .js 5 file に `window.postMessage({source:'booklage-extension', type:'pill-saving'}, '*')` を追加、 content.js の既存 window message listener を拡張して即 `setState('saving')` 発火。 加えて 8 秒の stuck-saving safety timeout を content.js に追加 (= 即時 pill 発火後に background が auto-save トグル OFF で drop する edge case の safety net)
- **cursor pill ✓ icon 緑化 + 3 段 drop-shadow glow halo** (= AllMarks success green visual language 確立): stroke `rgba(74, 222, 128, 0.98)` + `filter: drop-shadow(0 0 3px / 8px / 16px)` 3 層 halo。 既存 error 赤 (`#ff5a5a`) と semantic 揃って成功 緑 / spinner 白 の trio で意味体系完成。 この 3 段 glow recipe は AllMarks 全体で再利用予定 (= 将来の TUNE preset LED 等)
- **B-#25 ドロップ + 死にコード除去**: 確認の結果 `autoOpenPip` トグルは UI + storage 書き込みは存在、 読み出して PiP を開く logic は完全に未実装。 Chrome の Document PiP API は user gesture 必須なので「タブ訪問で自動 open」 は技術的に不可能、 「1 click で open」 にしても POP OUT ボタン 1 click と変わらず価値ゼロ → user 判断でドロップ + options.html / .js から該当 UI 即時 cleanup

**設計記録 (= IDEAS.md に永続化、 実装は後)**:
- **楽しい削除フロー + タグ一括削除との連携** (= unlike 自動削除案を user 不採用にした代替): foundation 柱 2 (= manual tag schema) と統合する fun deletion sprint、 5 種類のアニメ案 (= swipe / 紙吹雪 / 音波 / disintegrate / 吸い込み) を [docs/private/IDEAS.md](../docs/private/IDEAS.md) に記録
- **TUNE drawer 物理ボタン preset (= IDEAS.md J section)**: Yamaha AG03 mixer の reference 画像で user 提案、 3 ボタン案 / 5 ボタン案 + 物理ボタン feel + LED dot + 集中 sprint (= H + J + I-09 + I-10 を「音波テーマ世界観確立 sprint」) で polish 方針確定
- **outerFrame / canvas / ThemeLayer 3 層構造の説明** (= user の SF軍事テーマ質問対応): 「マージン band じゃなくて 1 枚の paintable div、 ユニコーンガンダム的テーマで 3 階層の奥行き作れる」 確認、 IDEAS.md 保存は今回パス

**変更 file**: 9 file
- [extension/content.js](../extension/content.js): window message listener 拡張 + stuck-saving safety timer
- [extension/content.css](../extension/content.css): `.check` の stroke 緑化 + 3 段 drop-shadow halo
- [extension/twitter.js](../extension/twitter.js), [youtube.js](../extension/youtube.js), [note.js](../extension/note.js), [vimeo.js](../extension/vimeo.js), [soundcloud.js](../extension/soundcloud.js): postMessage 1 行追加
- [extension/options.html](../extension/options.html): 「Auto-open PiP on AllMarks tab」 section 削除
- [extension/options.js](../extension/options.js): `autoOpenPip` の DEFAULTS / load / change listener 削除

**新規 file**: なし

**削除 file**: なし (= options.html / .js から該当 section 削除のみ)

**deploy 回数**: 4 回 (= 即時化、 緑 ✓ 追加、 glow 強化、 cleanup)

詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 50 セクション

**次セッション (= 51) の goal**: B-#23 Vimeo / SoundCloud Lightbox 再生対応 (= user 体験の根幹) を最優先。 詳細は [docs/CURRENT_GOAL.md](./CURRENT_GOAL.md) 参照

---

### 旧情報 (2026-05-18 セッション 49 — 配信先を **5 サイト 8 ボタン** に絞り込み、 user 実機検証で確定した動く範囲のみ維持)

session 49 後半、 user 実機検証で 11 サイト中 4 ボタンのみ ○、 7 ボタン ×、 7 ボタン未検証 (= アカウントなし) 判明。 user 判断「動かないものを並べるより品質担保」 で **大幅 scope 削減**:

**最終構成 (= 5 サイト 8 ボタン)**:
- ✅ X いいね + ブクマ (= いいねは session 49 後半 fix、 selector タグ非依存化)
- ✅ YouTube 高評価 + 後で見る (= user 検証 ○)
- ✅ note スキ (= user 検証 ○)
- 🔧 Vimeo Like + Watch Later (= session 49 後半 fix、 selector タグ非依存化、 user 再検証待ち)
- 🔧 SoundCloud Like (= 同上)

**削除した 6 サイト 11 ボタン (= ファイルごと削除、 manifest / config / options / test から全部除去)**:
- TikTok いいね + Favorite (= user アカウントなし)
- Bluesky Like + Repost (= user アカウントなし、 「招待制」 と user 誤認だったが解消後も使用予定なし)
- Threads いいね (= user アカウントなし)
- Reddit Upvote + Save (= user 操作不明、 URL 保存で十分)
- Pixiv ブクマ + いいね (= user 使わない)
- Pinterest Save (= user 使わない)

**重要原則**: 削除したのは「ボタン押すだけで自動保存」 という追加連動だけ。 全 URL 保存経路 (= ショートカット Ctrl+Shift+B / 右クリック → Save to AllMarks / 拡張機能アイコン click / ブックマーレット) は **全サイトで生きたまま**。 ユーザーは削除サイトでも従来通り URL 保存可能。

**新規 file**: なし

**削除 file**: `extension/tiktok.js`、 `extension/bluesky.js`、 `extension/threads.js`、 `extension/reddit.js`、 `extension/pixiv.js`、 `extension/pinterest.js`

**変更 file**: `extension/manifest.json` (= 6 content_scripts entry 削除)、 `extension/lib/auto-save-config.js` (= 11 source 削除、 source 数 18 → 8)、 `extension/options.html` (= 11 トグル削除)、 `extension/options.js` (= 11 key 削除)、 `tests/extension/auto-save-config.test.ts` (= 11 expect → 8 expect、 + 削除済 source が null を返すテスト追加)、 `extension/twitter.js` (= L74-77 selector タグ非依存化、 button → button + [role="button"])、 `extension/vimeo.js` (= L70 同上)、 `extension/soundcloud.js` (= L67 同上)、 `extension/content.js` (= PiP reporter + ブックマーレット連動の sendMessage 2 箱所に isExtensionAlive ガード追加、 session 46 で 5 file に入れた防御コードの漏れを今回 fix)

**session 49 narrative の全体構造**:
1. **前半 (= sprint 完走)**: Reddit + Pinterest ship で 8 追加サイト sprint 完走、 配信先 11 サイト × 検知 18 ボタンに到達 → user 実機検証チェックシート提示
2. **中盤 (= user 検証で大幅 ×)**: 動いた 4 / 動かない 7 / 未検証 7 → user 判断で削除 6 サイト確定 + Vimeo / SoundCloud 修正方針
3. **後半 (= scope 削減 + 修正 sprint)**: 6 サイト file ごと削除、 X いいね + Vimeo + SoundCloud の selector タグ非依存化、 1 deploy で本番反映

詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 49 セクション

**次セッション (= 50) の goal**: user 再検証で Vimeo Like + Watch Later + SoundCloud Like が動くか確認。 OK なら拡張機能 sprint 完全 close → 磨きフェーズ ((I-08) 画面右端 floating ボタン or (I-09) cursor pill 音波化) へ。 NG なら DOM 詳細を user 環境で見て個別 debug。 詳細は [docs/CURRENT_GOAL.md](./CURRENT_GOAL.md) 参照

**ship 済 (= prod 反映済、 user 実機検証は本セッションで全 18 ボタン分まとめて出す)**:
- **Reddit 連動** (= [extension/reddit.js](../extension/reddit.js) 新規 110 行): canonical `og:url` 第一優先 + pathname `/r/{sub}/comments/{id}(/{slug})?/` マッチ。 **scope 判定の二段構え** (= `.closest('shreddit-comment')` ヒットなら早期 return、 `.closest('shreddit-post')` 必須) でコメント側 Upvote / Save の誤発火を防御。 Upvote + Save 検知 (= aria-label lowercase 化、 まず `\bdownvote\b` を完全除外、 次に OFF `\bremove\b` / `\bunsave\b` を除外してから ON `\bupvote\b` / `\bsave\b` を `\b` 付きで判定)。 Save は kebab menu 内 `role="menuitem"` でも発火するので closest selector に追加
- **Pinterest 連動** (= [extension/pinterest.js](../extension/pinterest.js) 新規 100 行): canonical `og:url` 第一優先 + pathname `/pin/{pinId}/` マッチ。 **button 検知の二段戦略** = まず `data-test-id` で安定 attribute マッチ (= `pin-action-save` / `pinSaveButton` / `save-button`、 React 内部 stable)、 fallback で aria-label の locale stem (= en `\bsave\b` / ja `保存` / ko `저장` / zh `保存`) マッチ。 Save 後の「保存先ボード選択」 popover が出る前 (= click 時点) に URL 抽出するので popover swap 罠は回避

**新規 file**: `extension/reddit.js`、 `extension/pinterest.js`

**変更 file**: `extension/manifest.json`、 `extension/lib/auto-save-config.js`、 `extension/options.html`、 `extension/options.js`、 `tests/extension/auto-save-config.test.ts`

**配信先サイト 9 → 11 に拡張 (= 8 追加サイト sprint 完走)**:
- 既存 (session 44-45): X / YouTube / TikTok = 3
- session 46-49 で追加: note / Pixiv / Vimeo / SoundCloud / Bluesky / Threads / Reddit / Pinterest = 8
- 諦め: Instagram (= ログイン壁 + CORS でサムネ取得不可)

詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 49 セクション

**次セッション (= 50) の goal**: user 実機検証チェックシートの結果を元に必要があれば修正、 問題なければ磨きフェーズ ((I-08) 画面右端 floating ボタン or (I-09) cursor pill 音波化 + テーマ連動設計) に進む判断。 詳細は [docs/CURRENT_GOAL.md](./CURRENT_GOAL.md) 参照

---

### 旧情報 (2026-05-18 セッション 48 — Bluesky + Threads 連動 ship、 全部 prod 反映済)

session 47 close 後、 量産レシピ 7 step を踏襲して 2 サイト (= Bluesky / Threads) を写経ベースで追加。 詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 48 セクション

---

### 旧情報 (2026-05-18 セッション 47 — Vimeo + SoundCloud 連動 ship、 全部 prod 反映済)

session 46 close 後、 量産レシピ 7 step を踏襲して 2 サイト (= Vimeo / SoundCloud) を写経ベースで追加。 詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 47 セクション

---

### 旧情報 (2026-05-18 セッション 46 — note + Pixiv 連動 ship + Extension context invalidated 防御を 5 file 一斉投入、 全部 prod 反映済)

session 45 close 後、 user に「PiP / TikTok 連動の動作で気になることは?」 と聞いたら X タブで `Uncaught Error: Extension context invalidated.` ([twitter.js:71](../extension/twitter.js)) の screenshot 報告。 拡張機能を再読込した時の既知挙動 (= 古い content script が死んだ context を握ったまま) と説明 → user 判断「**入れると決めたやつぜんぶ** + **適度に区切って** + **途中で聞かなくていい**」。 → 既存 3 file 防御 + note / Pixiv 2 サイト追加で session 46 区切り。

詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 46 セクション

---

### 旧情報 (2026-05-18 セッション 45 — PiP 常に最前面化 + TikTok ボタン連動 ship、 全部 prod 反映済)

session 44 close 後、 user 指定なしモードで開始。 user 報告で **PiP が裏に行く問題** が判明 → 「業界水準が常に最前面ならそうしてほしい」 と意思決定。 加えて拡張機能の対応サイト議論で 9 サイト追加方針確定 + Instagram 諦め判断、 TikTok ボタン連動を 1 サイト目として ship。

- **PiP 常に最前面化** ([lib/board/pip-window.ts](../lib/board/pip-window.ts) に 29 行): 親 window の `focus` / `blur` / `visibilitychange` で PiP を `focus()` 復帰
- **TikTok ボタン連動** (= `extension/tiktok.js`): `data-e2e` 属性ベース、 manifest + auto-save-config + options UI + test 全部更新

詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 45 セクション

---

### 旧情報 (2026-05-18 セッション 44 — 拡張機能を SNS ボタン連動拡張に進化、 全部 prod 反映済)

session 開始時、 私 (Claude) は spec ファイル経由で「現状確認」 から入って完全に方向ズレ。 user の本命希望は IDEAS.md の (I-05) に書いてあった「**X いいね / X ブクマ / YouTube 高評価 / YouTube 後で見る ボタンを検知して AllMarks に自動保存**」 だった。 user が指摘して軌道修正、 そのまま実装着手 → 完成 → user 実機テスト OK で session 44 close。

**ship 済 (= prod 反映済、 user テスト確認済)**:
- X (x.com / twitter.com) の **いいねボタン + ブクマボタン** click を content script で検知 → 自動保存
- YouTube (www.youtube.com) の **高評価ボタン + 後で見るボタン** click を検知 → 自動保存
- OGP は tweet article DOM / video meta tag から組み立て (= 動画 tweet も `video[poster]` 経由でサムネ取得)
- 設定画面に 4 種類の ON / OFF トグル (= デフォルト全 ON、 個別 OFF 可能)
- 重複 URL は黙ってスキップ (= 既保存なら無視、 ただし**削除済 (`isDeleted: true`) は別扱い** で再保存可能)
- 自動連動経由の保存は cursor pill 非表示 (= 失敗時のみ表示、 X / YouTube 操作中の邪魔を避ける)
- 単体テスト 6 件追加 (= 519/519 PASS)、 型 clean、 build 成功、 deploy 2 回

**新規 file**: `extension/twitter.js`、 `extension/youtube.js`、 `extension/lib/auto-save-config.js`、 `tests/extension/auto-save-config.test.ts`

**永続化した教訓 memory**:
- `feedback_jargon_in_japanese.md` (= audit / scope / polish / sideload 等のカタカナ多用禁止、 日本語に置換)
- `feedback_read_ideas_first.md` (= 拡張機能関連は IDEAS.md の (I-05) を spec より優先で読む)

詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 44 セクション

---

### 旧情報 (2026-05-18 セッション 43 — TUNE chrome 音 motif redesign + glitch 統一)

session 42 持ち越し 3 件で開始 → user が「思い切った redesign の方が良い」 と即決 → 9-task implementation + 7 round polish の大マラソン。 deploy 約 11 回。 全部 prod 反映済。 詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 43 セクション

---

### 旧情報 (2026-05-18 セッション 42 — B-#13 polish 多発 + DEFAULT state grey + 操作 hint 移行 + 音波テーマ確定)

session 42 で session 41 持ち越しから着手 → user feedback で scope 拡大 → 6 deploy + 3 件次セッション持ち越し:

**ship 済 (= prod 反映済):**
- TUNE hover の縦ガタつき解消 (= `.trigger` min-height 34px、 border-box 考慮)
- chip 内 letter-spacing 0 (= 末尾トレーリング 1.1px 除去、 math 上完全対称)
- Shift drag 速度 4 倍化 (= `SHIFT_SPEED_MULTIPLIER` 20 → 40、 short drag で大ジャンプ)
- 「DEFAULT」 文字列 state ベース grey (= 値全部 default → grey、 動かしたら通常の白)
- `.cell.reset` dead code bug fix (= scope='reset' cell に正しく `.reset` class 付与)
- ScrollMeter 上に常時表示の操作ヒント追加 (`CLICK TO JUMP · SHIFT FOR FAST`)、 旧 TUNE tooltip 路線廃止 (= session 43 で TUNE drawer に再移管)
- 全 15 言語 chrome 英語固定 + content 翻訳の hybrid 方針確定 (= Linear / Figma / Notion 方式)
- 黒+白 minimal + 音波 motif テーマ確定 → memory `project_theme_sound_wave.md` に永続化

詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 42 セクション (5 phase + 学び)

---

### 旧情報 (2026-05-18 セッション 41 — TopHeader brushup + Amendment 1 + 続報 1-4、 polish 2 件持ち越し)

session 41 で B-#13 TopHeader 右側 brushup + 後半 Amendment 1 + ship 後 user feedback 4 連 polish:

- 既存 6 要素 → 3 テキスト label (TUNE / POP OUT / SHARE)
- **TUNE ホバー** → Matrix scramble で readout 展開 (v4-inplace、 stagger 11ms / scramble 125-190ms)
- **Amendment 1 + 続報 2**: readout は「短いピル track 100px + 透明 chip + オレンジ数字 = handle」 形式、 W/G ラベル削除、 数字テキストそのまま track 上の handle、 chip 位置は value fraction で track 上を slide
- **超精密**: MOUSE_PX_FOR_FULL_RANGE = 30000、 SHIFT_SPEED_MULTIPLIER 20 (= shift+drag で 2x 速い)
- **続報 3**: default-center piecewise マッピング (= default 値 → fraction 0.5) + track 空クリックでジャンプ復活 (PrecisionSlider 二段使い)
- 末尾 `DEFAULT` (= 7 文字、 全文字 click で reset 発火) で W/G default 戻し (Ctrl+Z で undo 可)
- TUNE click で sticky open、 ESC + outside click で close
- ResetAll 廃止 (= Ctrl+Z で代替)
- TUNE のみ hover lift 削除 (= POP OUT / SHARE は維持)
- chrome は完全に文字のみ (background / border は chip すらナシ、 11px monospace、 paint-order stroke で legibility)
- i18n: 15 言語に `board.chrome.{tune,popout,share}` + `board.tune.{width,gap,reset_tooltip}` 追加
- 新 file: [components/board/TuneTrigger.tsx](../components/board/TuneTrigger.tsx) + `.module.css` + `.test.tsx` (8 tests)、 [lib/board/scramble.ts](../lib/board/scramble.ts)
- 削除した DOM: PopOutButton / SizeSlider / GapSlider / WidthGapResetButton / ResetAllButton (file 自体は orphan で残置)
- vitest 507/507 / tsc clean / build 成功 / `https://booklage.pages.dev` 反映済

詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 41 セクション

---

### 旧情報 (2026-05-18 セッション 40 — edge auto-scroll + Ctrl+Z undo/redo、 全部 prod 反映済)

session 40 で 2 機能を完遂:

**1. edge auto-scroll while dragging card**:
- card を掴んで viewport 上下端 80px band に入れたら page を自動 scroll
- 線形ランプ 0 → **1200 px/sec** (band 境界=0、 viewport 端=max)
- `useCardReorderDrag` に `onPanY` callback を渡す方式、 board の viewport.y state を update (= native scroll は board で殺されてるため)
- ShareFrame caller では `onPanY` 未渡しで auto-scroll 無効化
- playwright at 1489×679 で実機 verify (delta 575px、 理論 574px と一致)

**2. Ctrl+Z / Ctrl+Shift+Z undo/redo system (= 6 種類)**:
- 対象: reorder / delete / resize / add (= 新規ブクマ追加) / cardWidth slider / cardGap slider
- 業界水準 (= Cmd 系も同等、 input/textarea focus 中はネイティブ undo 尊重)
- in-memory stack 30 操作 / リロードでクリア (= Figma 方式)
- 視覚 feedback: 画面下に glass pill toast (= slider tooltip 同トンマナ、 PrecisionSlider tooltip 数値 verbatim copy)
- slider drag は **500ms debounce** で 1 entry に集約 (= 60Hz spam 防止)
- 15 言語 i18n に `undo.*` / `redo.*` セクション追加 (ja / en は完全、 他 13 言語は短い翻訳 phrase、 polish は別 sprint)
- `persistSoftDelete` を「in-session revive 反映」 に改修 (= 既存「reload 必須」 spec を破棄、 IDB から bookmark + card read → setItems push)
- playwright verify: delete + Ctrl+Z 復活 ✓ / reorder + Ctrl+Z 復元 ✓
- 新規 file: [lib/board/undo-stack.ts](../lib/board/undo-stack.ts), [components/board/UndoToast.tsx](../components/board/UndoToast.tsx), [.module.css](../components/board/UndoToast.module.css)

詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 40 セクション

---

### 旧情報 (= 2026-05-17 セッション 39 — B-#20 解消 + PrecisionSlider 大改修、 全部 prod 反映済)

session 38 直後 user 報告「ScrollMeter がガチャガチャ動く」 を 6 phase で完全解消 → さらに PrecisionSlider (= W / G slider) を 6 phase で改修:

**Meter side (phase 1-6, B-#20)**:
- 1: slot 統一 + crossfade、 2: close counter freeze、 3: swell glide 引き継ぎ、 4: ease-in-out-cubic 1200ms ぬるっと、 5: TopHeader hidden 中 click 透過 fix、 6: **user 提案で unified ScrollMeter に refactor (= 正味 -200 行)**

**Slider side (phase 7-12)**:
- 7: NNNN.NN 表示 (= 小数部 dim)、 8: 10× slow で 2 decimal smooth、 9: track click ジャンプ + W=267.84/G=97.21 default 化、 10: Shift+drag = 高速 (業界の逆)、 11: 拡張機能 booklage-pill vocabulary の custom glass tooltip + i18n 全 15 言語、 12: tooltip 位置を 拡張機能と同じ「右側」 anchor に

- [BoardRoot.module.css](components/board/BoardRoot.module.css) に `.lightboxMeterSlot` 新設 (z 400、 ScrollMeter wrapper と完全同位置)
- [LightboxNavMeter.tsx](components/board/LightboxNavMeter.tsx) に `counterFormat='range'` + `n1`/`n2` props 追加、 ScrollMeter と同じ scramble cadence
- [Lightbox.module.css](components/board/Lightbox.module.css) に `.meterDim` + `data-counter-format='range'` typography override 追加 (font-size / color / text-stroke / text-shadow を ScrollMeter と一致)
- [BoardRoot.tsx](components/board/BoardRoot.tsx) で ScrollMeter sibling に LightboxNavMeter 配置、 `lightboxItemId` で hidden 反転 = 真の crossfade。 phase 2 で `lastLightboxIndexRef/lastLightboxTotalRef` 追加 (= close 後 freeze 値)、 phase 3 で `scrollMeterGlideFromFraction` state 追加 (= ScrollMeter に swell 引き継ぎヒント送る)
- [Lightbox.tsx](components/board/Lightbox.tsx) の LightboxNavMeter render + import 削除 (chevrons は残置)
- [ScrollMeter.module.css](components/board/ScrollMeter.module.css) z-index 90 → 400 bump (両 meter 同 stacking layer)
- [ScrollMeter.tsx](components/board/ScrollMeter.tsx) に spring damping (= LightboxNavMeter と同じ stiffness 320 / 臨界減衰) + `glideFromFraction?` prop 追加。 デフォルト挙動 (= scroll 直接追随) は不変
- PiP の LightboxNavMeter 利用は `counterFormat` default 'index-decimal' で backwards compat 維持
- 検証: playwright at user viewport 1489×679 で position Δ全部 0.00px、 close 連続フレームで swell が `149 → 129 → 100 → 67 → ... → 4` と smooth に glide 確認、 chrome 干渉なし、 tsc clean / vitest 493/493 / prod deploy 済 → `https://booklage.pages.dev`
- **phase 4** (= phase 3 deploy 後の user feedback「まだ急に動いた」): spring → ease-in-out-cubic tween (1200ms) に置換、 「ぬったりぬるっと」 達成
- **phase 5** (= 別件報告「カードの上らへんで close 判定効かない」): TopHeader が hidden 中も `.group` の `pointer-events: auto` で透明 click を吸ってた → `.hidden .group { pointer-events: none }` 1 行追加で fix
- **phase 6** (= user の根本的に正しい設計提案による refactor): 「ScrollMeter の数字を書き換えるだけでいい」 = 1 component + mode prop の unified 設計。 LightboxNavMeter は PiP 専用に戻し、 BoardRoot から slot wrapper / freeze refs / glide arm 全削除。 **正味 -200 行**、 概念的にも実装的にもスッキリ。 体験は phase 1-5 と同じ
- 詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 39 セクション (phase 1-6)

### 次セッション (= 42) でやること

**user 指定なし** — backlog から優先度順:
1. **multi-playback vision の board card autoplay 着手** (= 差別化 core 機能、 memory `project_allmarks_vision_multiplayback.md`)
2. **B-#3 重複 URL でサムネ等が出ない問題** (= 古めの未解決、 真因未調査)
3. TopHeader 残課題: テーマ vocab map (TUNE → CALIBRATE 等) は別 sprint (= テーマ system 着手時)
4. PopOut オンボーディング (= 初見ユーザーへの「PiP 機能だよ」 案内) は別 task
5. mobile (≤640px) の TUNE / POP OUT 表示は B-#10 モバイル UX 本格チューニング に合流

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
