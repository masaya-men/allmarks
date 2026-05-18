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

### 直近の状態 (2026-05-18 セッション 41 — TopHeader brushup + Amendment 1 + 続報 1-4、 polish 2 件持ち越し)

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

**持ち越し 2 件 (= session 42):**
1. **chip ハンドルの中心ずれ** — 計算は正しいはずだが visually 30-40% 位置に見える user 報告。 layout (flex item + inline-block width enforcement) を疑う、 dev で要 verify
2. **ツールチップ復活** — 試作した `<span class="wrap">` 方式は alignment regression で revert、 cells inner ref か React portal で再実装する

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

---

## ✨ 新機能アイデア (詳細は IDEAS.md)

`docs/private/IDEAS.md` 参照。 ここはタグだけ:

- X 自動翻訳取り込み + 原文切替 (Lightbox 内)
- テーマ案: SF 軍事スタイル (ガンプラ / 戦闘機パネル分け / デカール / 墨入れ質感)
- ギャップスライダー (カード間 gap 無段階) + 背景タイポ
- PiP 内広告
- SNS Share ボタン連携 (X / YouTube)
- ブラウザ完結 AI 自動タグ付け
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
