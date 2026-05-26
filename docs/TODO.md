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

### 直近の状態 (2026-05-26 セッション 75 — タグ絞り込み体験の徹底 polish 完遂、 session 74 本体反映直後の regression 検出 → 業界調査ベース entry anim + source-aware scroll restore + scroll easing 全統一)

**ship 済 (= 本番反映済、 booklage.pages.dev、 session 内 12 deploy)**:

1. **session 74 動作検証**: user 朝起きて確認、 タグ click 背景文字変化 OK / リロード復元 OK / dropdown 切替 OK。 但し**絞り込み時 CRT shutdown アニメ消失**を報告。 systematic-debugging で root cause 特定: 「2 段絞り込み」 構造で session 74 統合により 1 段に吸収された結果、 非該当カードが CardsLayer に流入しなくなり shutdown trigger 消失。 修正: BoardRoot の `filteredItems` で tags kind 時のみ `BOARD_FILTER_ALL` 経由に下げる (= dropdown 経由のタグ filter も演出付きになる副次的 plus)
2. **scroll-to-top on filter change**: ボード下にいる時の絞り込みで該当カードが上に reflow しても viewport 取り残される問題対処、 activeFilter 変化 useEffect で `handleScrollMeterJump(0)`。 prevRef で初回 mount gate
3. **カード復活時 entry anim 試作 → 業界徹底調査 → v2 確定**:
   - 初版 fade-up (= opacity 0→1 + scale 0.96→1、 200ms) → user 「分からない」 → 派手版 (= 320ms / translateY 12px / scale 0.88) → 依然「分からない」
   - 診断 console.warn 仕込み deploy → **真の root cause 発見**: Chrome は custom property `Nms` を `(N/1000)s` に正規化、 `parseFloat("0.8s") === 0.8` で WAAPI に 0.8 ms (= 1000 倍小) が渡されて一瞬で完了していた → CSS variables から `ms` 単位除去で fix
   - user 「徹底調査して一番いいもの」 依頼 → 専門 agent dispatch で web 調査 (= Aldlevine CRT Page Load / Lucas Bebber / Old CRT TV / Material Design / Apple HIG / NN/g / 2025 nostalgic UX trend 12 reference + 5 案比較) → **案 2 採用** = bloom (= phosphor 残光) を最後の山場 (offset 0.55) に置く 6 段階 sequence、 380ms、 Material decelerate easing、 prefers-reduced-motion 対応
   - 結果: 「完全闇 → 中央点 (sub-100ms 爆発) → 横線最大展開 → bloom 山場 → glitch → 通常」 の CRT TV 起動演出。 shutdown と完全対称、 mood board 「表現ツール」 ミッションに合致、 user「結構気に入ってる」
4. **source-aware scroll restore (= 解除時に click 元カードへ scroll 復帰)**: user 指摘「絞り込み解除時にクリックしたカードのところに戻るべき」 → `onTagFilterToggle` callback に sourceBookmarkId optional 追加、 BoardRoot で `lastClickedSourceRef` に memo、 tags → 非 tags transition + source あり → `focusCard(source)` で元位置 smooth scroll + glow。 dropdown 経由 filter 変化は sourceBookmarkId undefined なので scroll-to-top (= 既存挙動互換)
5. **scroll easing 全統一 (= 全 scroll mechanism を easeOutQuart に)**: user 「サイドバー戻し時の動き出しが早く感じた」 → 距離 0 で scroll 走らず entry anim curve (= Material decelerate) を見ていたと判明 → user が好む curve = decelerate 系 → 全 scroll mechanism (= ScrollMeter click、 scroll-to-top、 source restore、 PiP focus、 ?focus=URL) を旧 Power-30 exponential ease-in-out (= 両端 motionless、 1800-3000ms) から `easeOutQuart` (= 動き出し急 + 終わり 4 次減速、 500-1200ms) に統一。 「動き出しまでの 540ms 待ち」 消滅、 「ふっと止まる」 luxury tail keep。 旧 dramatic 演出は CRT shutdown / entry anim 側で出してるので chrome 全体 motion 言語は損なわれない

**user 視点 (= 本 session 後の体験)**:
- カードタグピル click → CRT shutdown (= 緑 flash の業務用 TV 切れ) + 該当カード上 reflow + smooth scroll で上に追従
- もう一度同じピル click → 元のカード位置に **scroll 復帰** (= user が探索 mode から元 context に戻る、 業界 UX pattern「source-aware navigation」)
- サイドバー 戻し / dropdown 切替 → CRT bootup (= 「中央点 → 横線 → 縦展開 + 残光 bloom → glitch → 通常」 の TV 起動演出) で復活カード達がぱらぱらと
- 全 scroll motion が「動き出し即座 + 終わりふっと止まる」 luxury curve (= 500-1200ms)、 旧 1800-3000ms から大幅短縮

**テスト**: 829 PASS 維持 (= polish のみ、 unit test 追加なし)、 tsc 0 errors、 build 25 routes 全 success

**deploy 回数**: 12 (= session 内、 1 日 16 上限内余裕)

**設計上の重要発見 (= 次セッション以降の保険、 memory 候補)**:
- **Chrome は custom property `Nms` を `(N/1000)s` に正規化する**: `getComputedStyle().getPropertyValue('--x')` で `"800ms"` を期待しても `"0.8s"` が返る、 `parseFloat` すると `0.8`。 time 値の CSS variable は単位なし数値リテラル + コメントに単位明記が安全 (= session 75 で踏んだ罠、 アニメが動いてるように見えて実は 1000 倍速で一瞬完了)
- **2 段絞り込み構造を 1 段に統合する時は CardsLayer 側に「非該当カードを残しておく」 仕組みが要る**: 該当カードのみ流入させると shutdown / entry trigger が消える。 `filteredItems` で kind 別に semantic を分けるのが解
- **「分からない / 効いてない」 ユーザー報告は 2 種類**: (a) subtle すぎ (= 数値増幅で解決)、 (b) 動いてない (= 別 root cause)。 派手化で改善しない時は console.warn or playwright で実測が先 (= memory `feedback_verify_before_claiming` の応用)
- **業界調査 (= web 検索 + reference 比較) は entry anim 等の創造系 task で価値高い**: agent dispatch で 12 reference + 5 案比較を 5 分で取得、 推奨案を web.dev / Material / Apple HIG 根拠付きで決定可能
- **easing 統一 vs 文脈別の判断軸**: user が「今後を考えると統一」 と発言 = motion 言語の simplicity を優先、 個別の演出 (= 旧 ScrollMeter ドラマチック) は捨てて代替の演出 (= CRT shutdown / entry anim) で出すという trade-off
- **session 74 で残した console.warn 系の診断 deploy 経路は有効**: 短期間 diag 仕込み → user Console 確認 → 結果次第で revert、 という pattern が session 75 で root cause 特定の決め手になった (= 「派手版でも分からない」 → console で動作有無確定 → 1000 倍速の罠発見)

**未確認 (= 次セッションで polish 候補)**:
- **scroll 開始時 / 移動中の jank (= 動画読み込み + サムネ抽出 3 枚 が重い感じ)**: session 73 で「scroll-deferred 動画フレーム抽出」 既に実装したが、 まだ重い体感あり。 audit 必要 = (a) アンビエントスライドショー 3 枚抽出 (session 68 で実装) と scroll の競合、 (b) ImageCard hover swap の preload、 (c) hi-res image lazy load 等、 何が scroll 中に発火してるかを systematic 調査
- Triage 側 polish 候補 8 個 + Phase D 必須 5 個 は session 73 から持ち越し継続

詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 75 セクション

---

### 旧情報 (2026-05-26 セッション 74 — BoardFilter 統合完遂、 タグ click が背景文字 / chrome / dropdown すべてを 1 つの source of truth で駆動 + リロード復元、 本番反映済)

**ship 済 (= prod 反映済、 booklage.pages.dev、 session 内 2 deploy)**:

0. **Phase 0 = JSON backup/restore リカバリ保険**: `lib/storage/backup.ts` 新規 (= `exportAllStores` / `importAllStores`、 全 IDB store dump + 復元、 store list は `db.objectStoreNames` でフィルタ = legacy `moods` / `folders` 残置も round-trip)、 `components/board/BackupButton.tsx` 新規 (= chrome `EXPORT` / `IMPORT` button、 TUNE 隣に配置、 JSON file download + 復元 confirm + 自動 reload)、 本番 deploy → user が 567 ブクマ + 5 tags の JSON を **`C:\Users\masay\Downloads\allmarks-backup-2026-05-25.json`** (817 KB) に保存完了 ← Phase 1 の安全網
1. **Phase 1 = BoardFilter 型を discriminated union object 化** (= session 73 で発覚した「カードタグ click → chrome は変わるが背景文字 / dropdown は変わらない」 構造的 bug の core fix):
   - 旧型 `'all' | 'inbox' | 'archive' | 'dead' | mood:${string}` → 新型 `{ kind: 'all' } | ... | { kind: 'tags', tagIds, mode: 'and'|'or' }` (= リッチな discriminated union)
   - `lib/board/board-filter-helpers.ts` 新規 (= `BOARD_FILTER_ALL/INBOX/ARCHIVE/DEAD` 定数、 `makeTagsFilter`、 `isTagsFilter`、 `getActiveTagIds`、 `boardFilterEquals`、 `toggleTagInFilter`)
   - `lib/board/board-filter-migration.ts` 新規 + IDB v15 → **v16** schema bump (= `lib/storage/indexeddb.ts` upgrade case で settings/board-config record の `activeFilter` を旧 string から新 object に automigrate、 defensive な settings store 存在チェック付き)
   - `applyFilter` を新型対応 + AND/OR mode + empty tagIds fallback、 `useTagFilter` hook **完全廃止** (= file + test 削除)
   - `FilterPill` の `overrideLabel` / `overrideCount` (= session 73 で追加した hack) 削除、 `tagsMatchCount` に置換 = native 配線
   - `BoardBackgroundTypography` を新型対応 = 1 タグなら tag 名、 N タグなら `name +N-1` (= chrome と一致)、 これが**本 refactor の発端で user が指摘した「変わらない問題」 を直接解消**
   - `Sidebar` を `boardFilterEquals` / 定数経由に
   - `BoardRoot` 大改修: `useTagFilter` 削除、 `matchedBookmarkIds` を activeFilter 派生 useMemo に、 タグピル click → `toggleTagInFilter` 経由で `setActiveFilter` 呼び出し → IDB 永続化 (= **リロード復元が副産物として実装**)
2. **Phase 2 = 検証 + 本番 deploy**: vitest **829 PASS** (= +23 net: helpers 10 + migration 8 + applyFilter +3 + bg typography +2 + board-config +1 + backup 3 + BackupButton 2 - useTagFilter 6) / tsc clean / build success (= 25 routes static prerender) / refactor branch を master に no-ff merge / 本番 deploy 完了

**user 視点 (= 本 session 後の体験)**:
- カードのタグピル click → 背景の AllMarks 文字が tag 名に変わる + chrome FilterPill が同じ tag 名に変わる + Sidebar の該当 tag 行が active 表示、 **全部同時に**
- 複数タグ click → 背景文字 / chrome 両方が `Music +1` 形式に
- リロード後も filter 状態が IDB から復元される
- dropdown の既存 ALL / INBOX / ARCHIVE / 個別タグ切替も同じ source of truth で動く
- chrome 上段に新規 **EXPORT / IMPORT** button (= TUNE と MANAGE TAGS の間)、 任意のタイミングで全 IDB を JSON dump 可能 = クロスデバイス引越 / リカバリ保険として永続価値

**設計上の重要発見 (= 次セッション以降の保険)**:
- **fake-indexeddb は同一 upgrade transaction での cursor 並列 access を abort する**: v15 case の `openCursor().then(...)` が fire-and-forget で pending な間に v16 case が `openCursor()` を呼ぶと AbortError → 全 upgrade 失敗。 v16 case は `get('board-config').then(put)` の直接 access に書き換えで解決
- **IDB migration test の setup は production schema と乖離している**: v15 test setup は v14 minimal で `moods` + `bookmarks` のみ作る、 production の v3 で作られる `settings` store は存在しない → v16 case が `transaction.objectStore('settings')` を呼ぶと NotFoundError → upgrade abort。 `db.objectStoreNames.contains('settings')` の defensive check で test/prod 両対応
- **preview URL deploy では実 user data 検証ができない**: 別 origin で別 IDB なので user の 567 ブクマが見えない → preview で「タグ click → 背景変化」 を試せない → 本番 deploy + JSON backup safety net の組み合わせが現実的
- **session 73 の Polish 7 は「視覚だけ縛る hack」 だった**: FilterPill に override prop を付けて見せかけ連動させていたが、 真の state 統合ではなかった → user が「本質的に機能が一緒になってない」 と指摘 → Phase 1 で根本解決

**未確認 (= user 実機検証待ち)**:
- カードタグピル click → 背景文字 + chrome + Sidebar が同時連動するか
- 複数タグ click → `Music +1` 形式表示
- リロード後の filter 状態復元
- v16 migration が 567 ブクマ + 5 tags の実 IDB で問題なく走るか (= 万一壊れたら IMPORT で完全復元可能)

詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 74 セクション

---

### 旧情報 (2026-05-25 セッション 73 — 保存バグ self-heal 完了 + ボード側タグ UI 7 polish 完遂、 Triage 側 polish は未着手のまま次セッションへ持ち越し)

**ship 済 (= prod 反映済、 booklage.pages.dev、 session 内 9 deploy)**:

0. **保存バグ脱線**: user 報告「ブクマレットでも拡張でも保存できない、 赤いエラー」 → 5 経路全部が拡張の background SW + offscreen iframe 経由なので 1 箇所詰まると全死亡という構造を特定。 拡張リロードで一発復活したので原因は SW + offscreen stuck state と推定。 再発防止に `extension/lib/dispatch.js` で timeout 検知 + offscreen 破棄 + ensureOffscreen + 1 回自動リトライ (= self-heal)、 `extension/offscreen.js` の timeout 4000 → 8000ms 延長、 診断ログ console.debug 降格。 manifest v0.1.14 → **v0.1.15**。 user リロード必須、 web 不要。 (commit `bad4062`)

1. **Polish 1**: chrome カード hover `+ ADD TAG` → **`+ TAG`** (= ADD 冗長削除、 1 文字 literal 差替え、 i18n 無し)
2. **Polish 2**: 新規 `components/board/TagIndicatorStrip.tsx`、 カード hover 時に左上から外にはみ出す既存タグ表示。 max 3 + `+N` overflow、 click で `useTagFilter.toggleTag` (= chrome chip と同挙動)、 z-index 50、 隣カード重なり対応で hover 時 wrapper z-index 100 lift。 trigger condition: `!taggedOut && it.tags.length > 0 && onTagFilterToggle !== undefined`
3. **Polish 2b**: 視覚 = ピル枠全削除 + `mix-blend-mode: difference` (= editorial) で 1 deploy → user「読みづらい」 → **白文字 + 2 段 text-shadow** (= `0 1px 2px rgba(0,0,0,0.65), 0 0 4px rgba(0,0,0,0.35)`) に切替、 既存 CardCornerActions × ↺ の drop-shadow recipe と同家族 (= filter:drop-shadow 版 / text-shadow 版 で SVG/text 区別のみ)、 + TAG ボタンも同じ recipe に統一 (= 旧 WebkitTextStroke 廃止)
4. **Polish 3**: TagAddPopover 全面 refactor、 `siteCandidates: string[]` prop を **`suggestedEntries: SuggestionEntry[]`** に置換。 SUGGESTED + ALL TAGS の 2 セクション構造 (= 業界準拠 Slack/Spotify autocomplete)、 上限 **5 個**。 HeuristicTagger 統合: `suggestSync` 追加 (= async interface 互換性維持しつつ React render 内同期呼出可)、 `extractTypedCandidatesFromBookmark` 新規 (= source: 'siteName' | 'hashtag' 付き、 既存 `extractCandidatesFromBookmark` は wrapper 残し)、 confidence 順 merge + 5 cap。 NEW_CANDIDATE_CONFIDENCE = { hashtag: 0.9, siteName: 0.65 } (= HeuristicTagger tier 0.95/0.8/0.5 と整合)。 emoji 全削除 (= user 明示却下)、 section header `SUGGESTED` `ALL TAGS` monospace 9px opacity 0.4
5. **Polish 4**: popover クリック外で閉じる、 業界準拠 dismiss pattern。 初版 `mousedown` listener → user「画面端だけ反応」 → 原因 `InteractionLayer.handlePointerDown` の `e.preventDefault()` が後続 mousedown を spec 通り抑止していた → **`pointerdown` に切替** で解決 (= preventDefault は propagation 止めないので pointerdown は document まで bubble する)
6. **Polish 5**: カード click でライトボックス morph 時、 + TAG / tag pills / × / ↺ / 再生ボタン 全 hover affordance を sourceCardId 判定で同時に opacity 0 → fade、 既存 wrapper visibility:hidden は FLIP clone 取得後発火だったので clone に affordance が baked in されていた問題を解消。 per-card render 冒頭で `isLightboxSource` + `hoverActive = (hover && !isLightboxSource)` を派生して 5 affordance に統一適用
7. **Polish 6**: スクロール中 X 動画フレーム抽出 (= `useTweetVideoFrames` の Boolean(tweetVideoExtraction) gate) に **`scrollingActive` 条件追加**、 BoardRoot に `isScrolling` state + `markScrollActive` (= 200ms idle で false に)、 handleScroll / handlePanY / handleScrollMeterJump の 3 経路で markScrollActive 発火 (= meter スムーススクロールの tick 内でも)、 CardsLayer 経由 CardSlideshow に prop 伝搬。 user 体感「読み込みっぽい何か」 → 教科書「scroll-deferred loading」 パターン (= X/Instagram/Pinterest/YouTube/Google Photos も同じ)。 in-flight 抽出は cancel 不可なので 1 個分は残るが queue が積み上がらない
8. **Polish 7**: chrome FilterPill が **tag chip filter 連動**。 `overrideLabel?` / `overrideCount?` prop 追加、 1 タグ = 名前のみ、 N タグ = `name +N-1`、 count = matchedBookmarkIds.size を 3 桁 0 詰め。 prevLabelRef + prevCountRef で前回値追跡 + 変化検出 `triggerBurst()` 発火 = 既存 hover scramble + glitch アニメと完全に同じ recipe を「filter 変化」 トリガで再利用。 副次効果: dropdown 経由 BoardFilter 切替も同じ scramble burst で動くようになった (= 前回は instant swap)

**user 視点 (= 本 session の累積)**:
- カード hover → 左上外に既存タグピル (白 + shadow) + + TAG ボタンが「すっ」 と出る (= 静かな mood board 哲学維持、 idle 時は完全 invisible)
- + TAG → 2 セクション SUGGESTED / ALL TAGS popover、 自動推奨が一目で分かる、 click 外で閉じる、 Esc も効く
- タグピル click → chrome 右上の AllMarks がスクランブル + グリッチで「YouTube · 012」 等に切替、 もう一度 click で逆遷移
- カード click → ライトボックス morph 時 全 affordance が静かに消える、 morph 後はサムネだけが大きく開く
- スクロール → 新規動画フレーム抽出が defer されるので体感かくつき軽減
- ブクマレット / 右クリック / フローティングボタン / 拡張ポップアップ / ショートカット 全 5 経路保存復活、 timeout 8s + 自動リトライで詰まり時もユーザー無操作で蘇生

**テスト**: 804 → **806 PASS** (= +2 TagAddPopover SUGGESTED / 既存 + ALL TAGS 重複防止 テスト)、 tsc 0 errors、 build success (= 25 routes static prerender)、 deploy 9 回 (= 月次枠余裕)

**設計上の重要発見 (= 次セッション以降の保険)**:
- **PointerEvent preventDefault は spec で compatibility mousedown を完全抑止**: document mousedown listener は preventDefault 領域内では発火しない、 click-outside 系は pointerdown listener を使え (= memory 候補)
- **mix-blend-mode は小サイズでも photo 上で読みづらい**: 過去 session 60-61 で大型 typography で却下されていた、 今回小サイズで再試行も user 同様の判定。 「mix-blend = 編集的で美しいが legibility は不安定」 が確定見解。 将来 editorial テーマで切替式採用は残す
- **useChromeScramble は label 変化で auto burst しない**: 即座 swap のみ、 burst は手動 triggerBurst 必要。 prevRef + useEffect で外部から検出する pattern が成立 (= 他の chrome 要素にも応用可能)
- **HeuristicTagger は既存タグへの推奨のみ、 新規タグ生成しない**: tag-candidates との 2 階層構造、 TagAddPopover で merge する責任は caller (= CardsLayer.computeSuggestedEntries)
- **scroll-deferred loading は業界標準**: X / Instagram / Pinterest / YouTube / Google Photos が同パターン採用、 `requestIdleCallback` / `scheduler.postTask` / React `useDeferredValue` 等 ブラウザ標準 API も用意されてる
- **拡張の offscreen iframe + SW は stuck state を起こしうる**: timeout self-heal 必須 (= 既に v0.1.15 で導入済)、 Chrome Web Store 公開時には extension auto-update も別途必要

**Triage 側 polish 候補 (= session 74 持ち越し)**:
- (a) **「しゅっ」 アニメ気持ちよさ** — TriageCard 4 方向 exit、 現状 220ms cubic-bezier 3 段 (反り → 飛び去り)、 user 体感で派手 / 静か / 別メタファー (紙折りたたみ / 光トレイル / 音波減衰) 判定
- (b) **タグ削除 UI** — EntryPicker の Manage tags inline、 今 `window.confirm` の OS ダイアログ、 mood board 世界観と乖離。 inline 確認 + 削除アニメに進化 (= Phase D3 の楽しい fx と関連)
- (c) **EntryPicker 配置・トンマナ** — 「未分類のみ / 全部」 二択 + Manage tags 一覧の見え方
- (d) **TagPicker 4 方向 2 段 chip** — 主 + 薄字副 の可読性
- (e) **Shift で副タグ切替の体感** — 副タグ 5-8 へ即座切替の応答性 + 視覚反応
- (f) **画面下 co-tags strip 余白・サイズ** — chip 並びの密度、 入力 field との距離
- (g) **背景 board の透け度合い** — BoardBackdrop opacity 0.14 + blur 3px が user に「裏が自分のボード」 と読めてるか
- (h) **「mood」 表記残り** — i18n 検索 (= D4 の他 14 言語と関連)

**Phase D 必須項目 (= 機能追加、 polish より重い)**:
- **D1** 中断再開 (= localStorage で completedBookmarkIds 永続 + 続きから prompt、 単独 1 sprint 級)
- **D2** 「しゅっ」 アニメ進化 (= a と関連、 大改造案)
- **D3** タグ削除 楽しい fx (= b と関連、 inline 確認 + 削除アニメ進化)
- **D4** 他 14 言語の mood → tag rename (= messages/{en,ar,de,es,fr,it,ko,nl,pt,ru,th,tr,vi,zh}.json の `newMood` / `moodNamePlaceholder` 等)
- **D5** NewMoodInput → NewTagInput rename (= file + 内部識別子)

**未確認のもの (= user 検証待ち)**:
- Polish 6 (= scroll jank 軽減) は user 「たぶん OK かな」 で確定保留、 体感ベース判定
- Polish 7 (= chrome label 連動) は deploy 直後で user 検証未完

詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 73 セクション

---

### 旧情報 (2026-05-25 セッション 72 — タグ機能 Phase 2 = Triage 大改造完成 ship 済、 user 視点で MANAGE TAGS → 4 方向 swipe + 副タグ + 複数同時付与 + 背景うっすら + おすすめ + 削除 全部動く状態に到達)

**ship 済 (= prod 反映済、 booklage.pages.dev、 session 内 5 deploy)**:

1. **Polish (= session 開始時 user feedback 最小消化)**: chrome `TAG` → **`MANAGE TAGS`** (= 業界水準 action verb + noun)、 カード hover `+ TAG` → **`+ ADD TAG`**、 TagButton を ChromeButton wrapper 化 (= 四角枠削除 + scramble + RGB glitch 統一)、 TagAddPopover chip も四角枠削除 + monospace
2. **Phase A = 4 方向 directional swipe MVP**: TagPicker 大改造で 4 方向 grid (= 上右下左)、 TriagePage に矢印キー + drag pointer event (= 60px threshold) + Esc 戻り、 TriageCard exit アニメ 4 方向、 BoardRoot の MANAGE TAGS onClick を `router.push('/triage')` に切替、 canvas 左上 TagFilterBar + SimpleTagList modal 完全撤去
3. **Phase B1 = Shift 副タグ + 複数同時付与**: TagPicker 4 方向 DirChip を 2 段表示 (= 主 + 薄字副)、 Shift 押し中は active 入替 (= 副タグ 5-8 が前面)、 画面下 CoTagStrip = 全タグ chip 並び (= click + 数字キー 1-9 で toggle、 既存「即付与」 から仕様変更)、 入力 field で新規作成 → 自動 co-tag on、 swipe で「主 + 選択中 co-tags 全部」 を一括 persistTags、 Shift keydown/keyup + window blur で stuck 状態回避 — **業界未踏領域** (= Superhuman/Tinder/Gmail/Things のいずれも片方のみ)
4. **Phase B2 = 背景うっすら + 「しゅっ」 polish**: BoardBackdrop 新規 (= 60 枚サムネ grid、 GSAP/Lightbox なし、 opacity 0.14 + blur 3px)、 TriagePage .root background rgba(8,8,10,0.88) 半透明 dim、 TriageCard exit アニメ 3 段化 (= 0% 静止 → 20% 反対方向 10px 反り + brightness 1.18 → 100% 飛び去り + scale 0.84 + brightness 0.72) 220ms cubic-bezier、 prefers-reduced-motion = fade only 120ms
5. **Phase C = EntryPicker + 集合継承 + ハッシュタグ抽出 + タグ削除 UI + ja rename**:
   - **C1**: TriagePage に `useSearchParams()` で mode 取得 + EntryPicker (= mode 無し時表示、 「未分類のみ (default) / 全部」 二択 + 数字キー 1/2 + ENTER 速選)、 BoardRoot の MANAGE TAGS onClick を activeFilter で分岐 (= all → /triage = picker、 mood:<id> → /triage?mode=tag:<id> 集合継承、 他 → /triage?mode=untagged)、 「all」 mode では persistMainPlusCo が既存 tags と union + swipe 後 index 手動 advance
   - **C3**: HeuristicTagger に `extractHashtags()` 追加 (= `/#[\p{L}\p{N}_]+/gu` 多言語 Unicode 対応)、 hashtag exact match = confidence 0.95 (= domain 0.8 / keyword 0.5 より上)、 TagReason 型に 'hashtag' 追加
   - **C4**: lib/storage/tags.ts に `deleteTagCascade` 追加 (= tag store + bookmarks 同 transaction で dangling ref scrub)、 use-tags.remove を切替、 EntryPicker に Manage tags inline 一覧 + 各 tag × Delete button + window.confirm
   - **C5**: messages/ja.json の `newMood` / `moodNamePlaceholder` を「タグ」 表現に更新 (= 他 14 言語の文字列内 mood は Phase D 持ち越し)
   - **C2 (中断再開)** は Phase D 持ち越し (= localStorage 設計 1 sprint 級、 他項目との独立性高い)
   - 既存 `/triage` 実装 (= 過去 session で作られた T1 Linear MVP + HeuristicTagger ドメイン辞書 18 件 + keyword match) を base にして拡張、 完全書き直しは回避
6. **Suspense fix** (= /triage build エラー対応): `useSearchParams()` が Static Generation 必須の Suspense boundary 要件、 app/(app)/triage/page.tsx で `<Suspense fallback={null}>` で wrap

**user 視点**:
- chrome 右上 `MANAGE TAGS` 押す → /triage 別 page に遷移 (= 裏に自分の board がサムネで薄く透ける)
- AllMarks 中 = EntryPicker で「未分類 / 全部」 二択 + タグ削除一覧、 タグ絞り込み中 = 即その集合で swipe 開始
- 中央にカード 1 枚、 上下左右に主タグ chip (= 各 chip 内に薄字で副タグ)、 Shift で主⇄副反転
- 矢印キー or drag (= 60px) or chip click で swipe → アニメ「しゅっ」 (= 弾性 + brightness pulse + 飛び去り) → 主 + co-tags 一気に付与
- 画面下 co-tags strip = click / 数字キー 1-9 / 入力で新規作成 → toggle on
- 副タグ on のまま swipe で複数 tag 同時付与 = **業界未踏領域**
- S = skip / Z = undo / Esc = /board 戻り
- おすすめタグ (= HeuristicTagger): ハッシュタグ literal + ドメイン辞書 + title keyword で suggested 緑強調

**テスト**: 全 804 PASS 維持 (= session 内 5 回連続 PASS、 既存 test 破壊なし)、 tsc 0 errors、 build success (= 25 routes static prerender)、 deploy 5 回

**設計上の重要発見 (= 次セッション以降の保険)**:
- **`useSearchParams()` の Suspense 要件**: Static Generation で `useSearchParams()` を使う component は `<Suspense fallback={...}>` で wrap 必須、 さもないと prerender error。 next/navigation の動的 hook は全部この制約 (= memory 候補)
- **persistTags の semantics = 上書き**: 既存 tags array を引数のもので完全 replace (= 追加ではない)。 「all」 mode で既存 tags 保持したい場合は呼び出し側で merge する必要 (= persistMainPlusCo で main + co + existing を seen Set で dedupe 順序保持)
- **deleteTag は dangling ref を残す**: tag store のみ削除、 bookmark の tags array は scrub されない。 cascade 削除には別 API (= deleteTagCascade) が必要、 単一 transaction で両 store 操作
- **既存 T1 を捨てない判断**: 過去 session の T1 Linear MVP + HeuristicTagger が活きてた、 完全書き直しでなく拡張で済んだ (= 時間節約 + HeuristicTagger 即流用)

**Phase D 持ち越し (= session 73 候補)**:
- **D1 中断再開** = localStorage に completedBookmarkIds 保存、 続きから prompt
- **D2 「しゅっ」 アニメ進化** = 紙折りたたみ / 光トレイル / 音波減衰 (= IDEAS.md 3+ 案から prototype 試作)
- **D3 タグ削除 楽しい fx** = 「タグごと爆発」 / 「音波で消える」 (= 現状 window.confirm を inline + アニメに進化)
- **D4 他 14 言語 i18n** = messages/{en/ar/de/es/fr/it/ko/nl/pt/ru/th/tr/vi/zh}.json の newMood / moodNamePlaceholder の mood 表現を各国 tag 語に
- **D5 NewMoodInput → NewTagInput rename** = file + 内部識別子

---

### 旧情報 (2026-05-25 セッション 71 — タグ機能 Phase 1 完成 + ship 済、 user 視点で chip/CRT shutdown/reflow/popover が全部動く状態に到達)

**ship 済 (= prod 反映済、 booklage.pages.dev で動作確認可能)**:

1. **Task 17 = BoardRoot 配線**: `useTagFilter()` 呼び出し + `matchedBookmarkIds: ReadonlySet<string> | null` useMemo (= filter active 時のみ対象 bookmark id set、 inactive は null = 全件該当扱い)、 CardsLayer に prop 追加、 `TagFilterBar` を canvas top-left に絶対配置 (= 既存 frameTopChrome と並列のチェイン chrome、 Lightbox open 時 fade)、 BoardRoot.module.css に `.tagFilterHost` 追加 (commit `4f56a23`)
2. **Task 17 = CardsLayer 配線**: `getShutdownAnimationClass('wave')` import、 `itemsForMasonry` (= matchedBookmarkIds で filter) を masonry 入力に流用 (= 既存 GSAP-FLIP が自動 reflow)、 `displayedPositions` で tagged-out カードに cached prev 位置を fallback (= shutdown 演出が定位置で再生)、 inner div wrapper (`position:absolute inset:0 borderRadius:var(--card-radius)`) を導入し GSAP の outer 位置 transform と CSS shutdown の transform を完全分離 (commit `4f56a23`)
3. **Task 18 = + TAG button + popover 統合**: カード hover で top-left に `+ TAG` button (= z-index 40、 既存 × ↺ ボタンと corner 競合無し)、 click で `popoverOpenFor: string | null` state トグル、 `TagAddPopover` を絶対配置で render、 BoardRoot 側に `handleTagToggle` / `handleTagCreate` (= addTagToBookmark / removeTagFromBookmark / addTag + reloadTags + reload) を実装、 `extractCandidatesForItem` adapter (= BoardItem → BookmarkRecord 風オブジェクト、 hostname → friendly name マップ) で site 候補抽出 (commit `e2cd45c`)
4. **Task 19 = TopHeader に TagButton + SimpleTagList placeholder**: chrome 内 TUNE の隣に `<TagButton>` 配置、 click で `tagPanelOpen` state を true → `SimpleTagList` (= 黒背景 modal、 全タグ列表示 + CLOSE ボタン、 Phase 2 Triage の placeholder) を render (commit `e2cd45c`)
5. **Task 20 = FLIP reflow は既存 GSAP-FLIP に丸投げ**: 新規 `runFlipReflow` は呼ばない (= 計画書 Task 20 の新規 API はスキップ)、 Task 17 の `itemsForMasonry` filter で `masonryLayout.positions` が変化 → 既存 useLayoutEffect の `gsap.to(el, { x, y })` が matched カードを compact 位置へ自動 animate
6. **Task 21 = preview 実機検証 + TDZ fix**: pnpm build + wrangler pages dev 8788 + playwright (= 本人画面 1489×2.58) で seed-demos → board → TagButton 表示 → + TAG → 「Test」 タグ作成 → 2 枚目カードにも付与 → chip click → 4/6 が data-tagged-out=true + matched 2 枚が top-left に compact reflow を確認。 **検証中に TDZ error 発見**: `displayedPositions` useMemo が `prevPositionsRef.current` を参照していたが `prevPositionsRef` の宣言が後にあって TDZ 違反 → `prevPositionsRef` を `displayedPositions` の直前に移動 (commit `c8e84cb`、 fix 後再検証 PASS)
7. **Task 22 = ship + docs 更新**: `pnpm build` (= 24 routes static prerender) + `wrangler pages deploy out/` 完了、 本セッション内 deploy 2 回

**user 視点**: ボード上で **タグ機能が完成形で動く**。 chip 押下で CRT shutdown + 緑 flash + scanline + flicker (= WAVE テーマ) → 非該当カード退出 → 該当カードが上に詰まる reflow。 hover の `+ TAG` ボタンで popover open、 既存タグの toggle + 新規タグ作成 + 元サイト候補 (= YouTube / X / Vimeo / TikTok / SoundCloud / Instagram / note / GitHub の friendly name) が表示。 TopHeader の `TAG` ボタンは Phase 1 placeholder modal (= タグ一覧のみ、 Phase 2 で Triage に進化)。 解除 (× button) で全カード復活 (= reverse アニメは Phase 2 で追加予定、 現状は瞬間表示)。

**テスト**: 既存 804 PASS 維持、 tsc 0 errors、 build success、 deploy 2 回 (= preview build + ship build)。

**設計上の重要発見 (= 次セッション以降の保険)**:
- **TDZ trap in useMemo + ref**: useMemo callback が後方宣言の `useRef` を参照すると、 deps 変化で再評価される時に Temporal Dead Zone error。 必ず ref 宣言を useMemo より上に置く (= 今回 1 度踏んだ trap、 memory `reference_tdz_useref_after_usememo` 候補)
- **GSAP transform vs CSS animation transform の衝突**: GSAP が `el.style.transform = matrix(...)` で位置を設定してる要素に CSS `@keyframes` で `transform: scale(...)` を当てると、 CSS が完全に上書きして位置情報が失われカードが (0,0) に飛ぶ。 inner wrapper div を挟んで responsibility 分離 (= outer = GSAP 位置、 inner = CSS 演出) が解
- **既存 GSAP-FLIP は十分強力**: 計画書 Task 20 で新規 `runFlipReflow` API を作る予定だったが、 CardsLayer の既存 useLayoutEffect (= L520-555) が `displayedPositions` 変化を gsap.to で animate するので、 input (= itemsForMasonry) を絞るだけで reflow が自動発火。 重複実装回避できた

**Phase 1a で発見された cleanup 候補 6 件 (= 全て Phase 2/3 並列 OK、 ship に影響なし)**: BoardFilter `mood:` literal / data-testid / CSS class 名 (.moodChip 等) / NewMoodInput ファイル名 / v9 JSDoc comment / v16 旧 moods store 削除 migration。

**Phase 2 brainstorm 時必須メモ**: user 発案「Triage 別 route の背景に board うっすら見せる案」 (= IDEAS.md 記録済)。 SimpleTagList 廃止して Triage 本実装に進化させる。

**次の大物 (= session 72 候補)**:
- **Phase 2 brainstorm**: Triage UI (= タグ rename / reorder / delete / swipe-assign / 一括振り分け)、 reverse-fade-in アニメ (= 解除時の瞬間表示を polish)、 SimpleTagList → Triage 本実装、 tag color customization
- **Phase 1 cleanup 並列**: mood→tag 一括 rename (= 6 件残)、 BoardFilter literal `mood:` → `tag:`、 .moodChip class 名 統一
- **Phase 3 brainstorm**: per-tag theme (= dominantColor + ThemeLayer 切替)、 カラーハント、 ボード全体の音波 vs タグ別テーマ調和

---

### 旧情報 (2026-05-25 セッション 70 — タグ機能 Phase 1b + 1c + 1d 実装完遂、 本番反映済、 user 視点見た目変化なし [= Phase 1e 配線待ち])

**ship 済 (= prod 反映済、 本番に dead code として存在、 user 視点は変化なし)**:

1. **Phase 1b (Task 8-9)** = filter state + 候補抽出 (subagent-driven、 2 commits): `lib/board/use-tag-filter.ts` (= selectedTagIds + mode + toggle + clearAll + isActive、 commit `08d885c`、 6 tests PASS)、 `lib/board/tag-candidates.ts` (= siteName + tweet # ハッシュタグ抽出 + 同ドメイン頻出スコアリング、 commit `11909af`、 7 tests PASS、 plan の buggy `target.tags.includes(...spread)` 行は controller が preemptive fix で除外)
2. **Phase 1c (Task 10-12)** = アニメ層 (subagent-driven、 3 commits): WAVE テーマ CRT shutdown CSS (= F6 lbebber 派生 + 緑 flash + 5 段 keyframes + scanline + flicker + 8 CSS 変数 + reduced-motion 対応、 commit `182c83f`)、 `getShutdownAnimationClass(theme)` API (= theme key → CSS class マップ、 Phase 3 拡張ポイント空欄、 commit `1e244d7`、 2 tests)、 `runFlipReflow` Web Animations API translate-only (= scale FLIP 不採用、 0.5px 閾値で no-op、 commit `8707abf`、 2 tests)
3. **Phase 1d (Task 13-16)** = UI 層 (subagent-driven、 4 + 1 fix commits): `TagFilterBar` (= chip + AND/OR + counter + 解除、 commit `d35ad08`、 6 tests + vitest.setup.ts に jest-dom matcher 追加)、 `TagAddPopover` (= 既存タグ + サイト候補 + 新規入力 + Esc、 click-only、 commit `0dde601`、 6 tests)、 `TagButton` chrome (= commit `1a430d5` で CSS divergence → spec reviewer 検出 → 同 implementer の `b38ec0e` で verbatim CSS に修正、 5 tests)、 i18n 15 言語 (= ar/de/en/es/fr/it/ja/ko/nl/pt/ru/th/tr/vi/zh 全部に `tag` セクション英語値統一、 commit `7c92c5c`、 plan が想定した zh-TW/hi/id は repo 実体と乖離していたため controller が dispatch 前に修正)

**user 視点**: 見た目変化なし (= 全コンポーネント・hook・CSS は存在するが BoardRoot.tsx 配線が Phase 1e 残のため未活性、 dead code として bundle に同居)。

**テスト**: 既存 770 → **804 PASS** (= +6 use-tag-filter + 7 tag-candidates + 2 shutdown index + 2 reflow + 6 TagFilterBar + 6 TagAddPopover + 5 TagButton = +34 net)、 tsc 0 errors、 build success (= 22 routes static prerender)、 deploy 1 回。

**subagent-driven 運用所感**: 10 dispatch (= 9 implementer + reviewers + 1 fix) で 9 タスク完遂。 review 失敗 → fix → re-review の loop は Task 15 (= TagButton CSS divergence) のみ 1 回発生、 残り 8 タスクは初回両 review PASS。 教訓: **verbatim CSS / TSX を必ず引用、 subagent に解釈余地を残す指示 (= 「TUNE pattern matching」 等) は避ける**。

**次の大物 (= session 71 必須)**:
- **Phase 1e (Task 17-22)** = BoardRoot.tsx 配線 + 視覚検証 + 本番 ship + user 検証:
  - Task 17: BoardRoot に filter state 配線 + `data-tagged-out` 属性付与
  - Task 18: TagAddPopover を CardsLayer に統合 (= カード hover で `+ TAG` アイコン + popover)
  - Task 19: TagButton を chrome に追加 (= TUNE/POP OUT/SHARE と並列)
  - Task 20: FLIP reflow を BoardRoot に統合 (= 既存 CardsLayer の GSAP-FLIP と統合判断)
  - Task 21: preview で全機能を実機検証 (= playwright + 本人画面 1489×2.58)
  - Task 22: 本番 ship + user 検証案内

**重要**: session 71 は **必ず BoardRoot.tsx を読んでから着手** (= 既存 chrome 配線パターン + ScrollMeter 周辺の隣接配置の流れを把握)。

**Phase 1a で発見された cleanup 候補 6 件 (= Phase 2/3 並列 OK)**: BoardFilter `mood:` literal / data-testid / CSS class 名 (.moodChip 等) / NewMoodInput ファイル名 / v9 JSDoc comment / v16 旧 moods store 削除 migration。

**Phase 2 brainstorm 時必須メモ**: user 発案「Triage 別 route の背景に board うっすら見せる案」 (= IDEAS.md 記録済)。

---

### 旧情報 (2026-05-25 セッション 68 — スライドショー揃いすぎ修正 + Phase 2 X 動画コマ抽出 完遂、本番反映済)

**ship 済 (全て本番反映 + push、user 実機 OK)**:

1. **スライドショー揃いすぎ修正 (動画カード + 画像ツイート両経路)**: session 67 の Phase 1 で残った「ほぼ同タイミングでフェード」「秒数も一定」を消化。動画側 [use-slideshow-cycle.ts](../lib/board/use-slideshow-cycle.ts) と画像ツイート autoCycle 側 [ImageCard.tsx](../components/board/cards/ImageCard.tsx) の両方に同じ desync を適用 = (a) 開始フレームをカードごとランダム化、(b) 間隔幅をランダムバンドに拡大、(c) 初回 offset をフルレンジに分散。user 実機で「個別バラバラの揺らぎ」OK。
2. **アンビエント・スライドショー Phase 2 (X 動画コマ抽出)**: X 動画カードを poster 1 枚 → **0% / 25% / 50% の 3 枚クロスフェード**にリッチ化。新規 [extract-video-frames.ts](../lib/board/extract-video-frames.ts) (`computeSeekSeconds` pure + `extractVideoFrames` = off-screen `<video>` + canvas + JPEG quality 0.7 + maxWidth 640px、`/api/tweet-video` プロキシ経由で canvas tainted 回避) + 新規 [use-tweet-video-frames.ts](../lib/board/use-tweet-video-frames.ts) (in-memory キャッシュ + in-flight dedup + FIFO 待ち行列 + `enabled` ガード、IDB 永続化は不採用)。[CardSlideshow.tsx](../components/board/CardSlideshow.tsx) に prop 追加で配線。
3. **Phase 2 並列上限調整 (2→1)**: 初回スクロール時の一時カクつきを観察 → 抽出 2 本並列 + ヒーロー 1 本 = 3 デコーダ同時の瞬間が原因 → `MAX_CONCURRENT` を 1 に下げて ヒーロー本物 + 抽出 1 本 = 2 デコーダ固定。user 実機「かくつかなくなった」OK。

**テスト**: 741 → **756 PASS** (+15)、tsc clean、deploy 3 回。

**次の大物**:
- **タグ付け機能** (= user 直接発言で最重要、memory `project_tagging_top_priority`)。仕様未確定 → 次セッションで brainstorming から開始。

**console ノイズ (磨き候補、いつでも可)**: `manifest enctype` 警告 / TUNE ドロワーの `aria-hidden` フォーカス警告(`inert` 属性化)。他は第三者由来で対応不要。

---

### 旧 (2026-05-21 セッション 62 — Phase 1 + メディア統一 + インライン再生コントロール)

session 62 後半でさらに 2 改善を本番反映: ①**画像のみカードは右下アイコン非表示**（再生できるカードだけ押せるボタン）+ Vimeo=動画/SoundCloud=♪音楽アイコン修正 ②**カード再生中に真下へ AllMarks ミキサー調のコントロールバー**（音量スライダー + ⏸再生/停止）。 音量は**カード個別 + メモリのみ（リロードでデフォルトに戻る、IDB非保存）** = multi-playback ミックスの土台。 右下アイコンは再生中**■停止**に切替。 全埋め込みに controlled volume/paused を inline 専用で追加（Lightbox は variant 温存=無破壊）。 plan: [inline-playback-controls](./superpowers/plans/2026-05-21-inline-playback-controls.md)。 検証: preview 実プロキシで音量反映/一時停止/リサイズ確認、 **682 PASS** / tsc clean / lint 新規0 / deploy 2。 詳細: [TODO_COMPLETED.md](./TODO_COMPLETED.md)「セッション 62 続き2」

---

### 旧 (2026-05-21 セッション 62 — multi-playback Phase 1 + メディア再生の Lightbox↔ボード統一)

session 61 の Phase 1 plan を実装完遂 + 本番 deploy 後、 user 検証で「ツイート動画もボードで再生できるべき / 将来追加も全部網羅すべき」 と指摘 → **media player 台帳 (registry) を新設してボードと Lightbox を単一の真実に統一**するリファクタまで実施。 **board のカード右下アイコンが「押せる再生トグル」、 押すと音つきインライン再生、 もう一度で停止** (= Tier 3 単体 1 枚)。 対応: YouTube / Vimeo / TikTok / SoundCloud / **X動画**。 リサイズ干渉も解決済。

**メディア統一の核** ([plan](./superpowers/plans/2026-05-21-board-media-playback-unification.md)): [embeds/media-players.tsx](../components/board/embeds/media-players.tsx) の `ENTRIES` 配列が「どの item をどのプレイヤーで再生するか」の唯一の真実。 `canPlayInline` / `resolveInlinePlayer` / `resolveLightboxPlayer` を導出。 ボード = Lightbox の再生能力の鏡写し。 mp4 動画は mediaSlot 有無で platform 非依存に match → 将来 Bluesky 等も新規コードほぼ 0 で網羅。 `TweetVideoPlayer` も [embeds/TweetVideoEmbed.tsx](../components/board/embeds/TweetVideoEmbed.tsx) に抽出して両者共通化 (Lightbox 体験は無破壊で保持)。

**検証**: `pnpm preview` (wrangler pages dev = 関数稼働) で実 mp4 再生まで確認。 ボード `<video>` mount + リサイズ 268→493、 Lightbox 再生ボタン+作者パネル維持 + Escape で停止。 **676 PASS** / tsc clean / lint 新規 error 0 / deploy 2。 詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) 「セッション 62 続き」

---

### 旧 (2026-05-21 セッション 62 前半 — multi-playback Phase 1 実装完遂)

session 61 で確立した Phase 1 plan (= 5 task TDD) を新鮮な状態から実装。 全 task 完遂 + 本番 deploy 済。 **board のカード右下アイコンが「押せる再生トグル」 になり、 押すと音つきでカード内インライン再生、 もう一度で停止** (= Tier 3 単体 1 枚)。 リサイズ干渉問題も解決済 (= 既存 × ボタンパターン流用 + 内側拡大)。

**ship 済 (= prod 反映済、 booklage.pages.dev)**:
1. **MediaTypeIndicator を押せるトグルボタン化** ([MediaTypeIndicator.tsx](../components/board/MediaTypeIndicator.tsx)): `onActivate` / `active` prop で `<div>` badge ↔ `<button>` 切替。 z-index 50 (= リサイズハンドル 30 の上) + ボタン本体のみ pointer-events + pointerdown 伝播停止 + 内側 (= bottom-right anchor) 拡大 22→34px + active 時 緑 glow (AllMarks success-green)。 photo カードは従来の passive badge のまま
2. **Lightbox 埋め込みプレイヤーを `components/board/embeds/` に共通抽出** (= 8 file): YouTube / Vimeo / TikTok / Instagram / SoundCloud の 5 embed + 共有 `EmbedShell` (EmbedPosterBox / EmbedPlayButton) を Lightbox.tsx (2700 行) から verbatim 抽出。 CSS は `../Lightbox.module.css` を import して同一スコープ名維持 (= 視覚変化ゼロ)。 Lightbox は barrel から再 import、 未使用 import も整理。 全 666 テスト維持で挙動不変を実証
3. **InlineMediaPlayer ディスパッチャ** ([embeds/InlineMediaPlayer.tsx](../components/board/embeds/InlineMediaPlayer.tsx)): URL 種別で正しい embed を選択 + `canPlayInline()` ガード (= youtube/vimeo/soundcloud/tiktok のみ true、 tweet/instagram は false)
4. **board に audio-active state 配線** (= 単体 1 枚): BoardRoot に `audioActiveId` state + `handleToggleAudio` → CardsLayer に thread → カードラッパー内に InlineMediaPlayer オーバーレイ (= inset:0, z-index 10, pointerdown stopPropagation で reorder/Lightbox 誤発火防止) + indicator に props 配線
5. **autoStart prop 追加** (= 検証で判明した修正): 抽出した embed はデフォルトで poster+再生ボタン (Lightbox 動作)。 Tier 3 はアイコン押し自体が user gesture なので、 InlineMediaPlayer が `autoStart` を渡して即 mount + 音つき autoplay。 Lightbox 側は false で従来動作維持

**playwright 実機検証 (= 本人画面 1489×2.58)**: シード 6 枚 → 動画カードにホバーで右下が button 表示 → 押下で `data-active` true + iframe 1 個 mount → 再押下で false → **右下角つまみでリサイズ発火 (268→508px) = spec §4 必須チェック通過**

**既知の小さな点 (= Phase 1 では許容、 後フェーズで調整)**: ①SoundCloud カードは今 photo アイコン表示 (= ♪ 音楽アイコンは後の装飾、 押せば再生は機能) ②検証デモの YouTube Short が「再生できません」 表示だったが、 これは当該動画が埋め込み再生禁止のため (= Lightbox でも同じ、 仕組み自体は正常)

**テスト**: 661 → **668 PASS** (= MediaTypeIndicator 5 + inline-media-player 2)、 tsc clean、 build OK。 **deploy**: 1 (= multi-playback-phase1)

**次セッション (= 63) goal**: user 本番検証 (= booklage.pages.dev でアイコン押下→再生→停止→リサイズ)。 OK なら **Phase 2 = Tier 2 hover プール** (`usePlaybackPool` 4枚LRU + `useHoverIntent` 300ms)。 詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 62 セクション

---

### 1 つ前の状態 (2026-05-21 セッション 61 — 背景文字グリッチ断念+revert + multi-playback 設計確立、 Phase 1 plan まで)

session 60 持ち越しの **I (背景文字グリッチ)** を 4 回作り直しても user 意図に届かず → **board から全撤去 (静止白文字に revert)** + 本番 deploy。 その後 user 最優先の **multi-playback (= カード上で複数同時再生)** に方向転換 → 2 本の web 調査 → spec → Phase 1 plan 確立。 セッション長のため Phase 1 実装は次セッションへ。

**確定したこと**:
- 背景文字 = 静止白文字 (= glitch 全撤去済、 本番反映済)。 再挑戦用に `/typo-glitch-lab` playground を残置
- **multi-playback 3 段モデル** = Tier 1 常時軽量モーション (storyboard/Ken Burns/クロスフェード、 デコーダ0) / Tier 2 ホバー300msで本物ミュート再生 (4枚LRU) / Tier 3 右下アイコン押しで音ON+ピン留め (4枚ミックス)。 spec: [multi-playback-design](./superpowers/specs/2026-05-21-multi-playback-design.md)
- **Phase 1 plan 確立** ([multi-playback-phase1](./superpowers/plans/2026-05-21-multi-playback-phase1.md)、 5 task TDD): 右下アイコン操作化 + 埋め込みプレイヤー共通化 + InlineMediaPlayer + audio-active 配線 (単体1枚) + 検証(brリサイズ死守)+deploy
- **GSAP / motion-design skill を `~/.claude/skills/` に install 済** (= 今後の motion 作業で参照可)

**重要な学び**: ①「壊れる/崩れる」 は減算の意味 (= 本体が欠ける) で使われがち、 ただし design 一般論として memory 化は user に否定された ②user は **AskUserQuestion 質問箱より自然な chat 対話を強く好む** (= 2 回明示) ③「徹底調査して」 = 実際に web 調査を回す

**テスト**: 661 PASS、 tsc clean、 build OK。 **deploy**: 2 (iter3 + revert)

**次セッション (= 62) goal**: multi-playback **Phase 1 を実装**。 plan の 5 task を新鮮な状態から。 詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 61 セクション

---

### 旧情報 (2026-05-21 セッション 60 — J 9 iter 完走 + I 着手中、 翌セッションへ持ち越し)

session 60 は board 中心部の世界観強化 sprint。 大物 2 つ着手 (= J, I):

- **J. TUNE drawer 物理 preset ボタン (= 完走 + 本番 deploy 済)**:
  - 5 個の preset (DENSE / TIGHT 243.57/36.17 / DEFAULT / OPEN / AMBIENT)、 user が自分の 1489 viewport で tune した値
  - レイアウト: LED → ミニブレーカーレバー (= 縦長 20×34px、 メタリックハンドル) → パネル文字 (cream label)
  - 動作: ラッチング・トグル (押されたまま固定)、 LED 状態鏡 (±0.5px tolerance)、 Ctrl+Z で W/G 両方同時 undo、 i18n 15 言語、 audio interface 風 divider、 ドーム型 LED (= preset + ops 両方)、 ALLMARKS · MK-1 刻印プレート
  - スライダー本体も同時 polish: 立体レール (= 6px 溝 + chamfer + inset)、 縦長メタリックハンドル (= グラデ + 12 グリップ溝 + index line)、 42 目盛り (= 22 から倍密)、 long-press 350ms ジャンプ (= click-to-jump 廃止で精密調整可能)、 ドラッグ速度入れ替え (= 普通=高速 ×40、 Shift=低速)、 ops 説明文 `DRAG TO TUNE` / `SHIFT TO SLOW` / `HOLD TO JUMP` / `CTRL+Z UNDO` / `CTRL+SHIFT+Z REDO`
  - ヘッダー読み出しの動的化 + glitch: `267.84 · 97.21 · DEFAULT` → 選択中 preset 名に変わる、 変化時に既存 v4 scramble 再発火
  - **9 iteration 一気に polish**: iter 1=設計実装、 iter 2-7=user feedback で見た目調整、 iter 8=速度入れ替え、 iter 9=FINE→SLOW 文言

- **I. 背景文字 マウス追従グリッチ (= 翌セッションに iter 続行)**:
  - 仕様: マウス近傍 80px 円形のみ AllMarks 文字に chromatic aberration glitch、 外は通常表示
  - 初版 ship 後 user feedback: ① 背景が前面に出てる (= z-index 問題)、 ② マウス追従が離れた所に出る (= mask 座標系 mismatch)、 ③ glitch スタイルが chrome (TuneTrigger) と違う
  - 3 バグ全て fix 版 ship 済 (commit `1f24c946`、 deploy 済): z-index 全削除 + .glitchLayer ラッパー (= host inset:0) + chrome 互換 keyframes (= 7-step clip-path inset 横線、 オレンジ + シアン、 1400ms infinite)
  - **user 検証で「思ったのと違う」** → 翌セッションで具体ヒアリング + iteration 続行

**テスト**: 633 → **662 PASS** (= J で +18 tune-presets / TunePresetColumn / FaderColumn 拡張 + I で +9 BoardBackgroundTypography 新規)、 tsc clean、 次 build OK

**deploy 回数**: 11 (= J 9 + I 2、 1 日 16 回上限内)

**変更 file (累計)**: J = lib/board/tune-presets.ts + components/board/TunePresetColumn.* + TuneTrigger.* + FaderColumn.* + BoardRoot.tsx + messages/*.json 15 lang。 I = components/board/BoardBackgroundTypography.* + .test.tsx 新規

**次セッション (= 61) の goal**: I のグリッチを user 思う通りの見え方になるまで iteration。 開始時にまず**何が思ったのと違ったかヒアリング**してから方針確定。 詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 60 セクション

### 1 つ前の状態 (2026-05-20 セッション 59 — 拡張機能 v0.1.7 → 0.1.14 全 7 ship 完遂、 sprint クローズ)

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
