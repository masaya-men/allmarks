# テーマシステム土台 ＋ paper-atelier（第1テーマ）設計書

- **日付**: 2026-06-24（セッション 131）
- **状態**: ✅ ブレインストーミング承認済み（①器 / ②paper-atelier / ③UI・解錠・データ・テスト の3チャンク全承認）→ 実装計画(plan)待ち
- **関連**: `docs/CURRENT_GOAL.md`、`docs/private/theme-mockups/`（モック15枚）、`docs/private/IDEAS.md`（N-06 有料テーマ）
- **進め方**: brainstorm（本書）→ writing-plans → 実装

---

## 0. 要約（TL;DR）

「テーマを1個選ぶと、背景だけでなく **配色・書体・カード表面・スクロールメーター・アニメ** まで一斉に切り替わる」土台（器）を確立し、その器で **paper-atelier（編集紙・セリフ・マステ/ピン・クリーム+金）をモック完全再現で1枚完成**させる縦切り。

- 既存の `themeId`（IndexedDB 保存）/ `THEME_REGISTRY` / `ThemeLayer` を拡張する自然な延長で作る。新規の重い仕組みは作らない。
- 各テーマは `data-theme-id="<id>"` の CSS ブロックで **自己完結**（自分の配色・`color-scheme`・書体を全部宣言）。LP の `data-theme=light`（過去の遺物・別属性）には依存しない。
- **デフォルト（dotted-notebook = 黒 + 音波）は無傷**。新テーマは追加で選べるだけ。
- 有料解錠は **受け口（判定窓口）だけ** 配線。鍵入力・検証の本体は後の回（N-06）。
- 適用範囲 = **アプリ本体（ボード）のみ**。LP・紹介ページ群は従来の編集デザインを維持（対象外）。
- ロードマップ順: **paper-atelier(3) → white-sector(1) → celestial-atlas(5)**、code-rain(2)・liquid-chrome(4) は後。器は最初からこの5枚を量産できる汎用の器として設計する。

---

## 1. ゴール / スコープ / 非ゴール

### ゴール（この縦切りで達成）
1. **器**: 1つのテーマ選択が「7部品」一式を切り替える仕組み。
2. **第1テーマ**: paper-atelier をモック完全再現（最終形）で実装。
3. **選択UI**: SETTINGS ドロワー内の「THEMES」欄で切替（プレビュー付き・即適用・無料/🔒バッジ）。
4. **解錠受け口**: `tier` と `isThemeUnlocked()` の窓口（スタブ）を配線。
5. **デフォルト無傷**: 既存の黒+音波テーマは見た目・挙動とも一切変えない。

### スコープ（slice 1 で作るもの）
- `ThemeMeta`（テーマ1個の定義型）を「7部品の契約」へ拡張。
- `ThemeId` union に `'paper-atelier'` 追加。
- `themeId` を BoardConfig → BoardRoot state → ルート属性 → `ThemeLayer` へ配線（現状ハードコード `DEFAULT_THEME_ID` を置換）。
- paper-atelier の CSS トークン一式・紙背景・カード紙化・装飾（マステ/ピン/クリップ/フォトコーナー/スタンプ）・定規メーター変種・署名アニメ。
- ベタ書き値のトークン化（メーター波形色・方眼線色・カードタイトル帯・Instagram覆い）。
- 単体テスト＋視覚検証。

### 非ゴール（今回やらない・後の回）
- 有料テーマの **鍵入力・検証の本体**（受け口の形だけ作る）。
- **テーマ #1/#5/#2/#4 の実装**（器は対応するが中身は別セッション）。
- **紹介ページ群（features/guide/faq 等）へのテーマ適用**。
- **共有ビュー / 共有OG画像のテーマ化**（[SharedBoard.tsx](../../../components/share/SharedBoard.tsx) / capture-mirror 系）= follow-up。
- 専用「テーマギャラリー画面」（テーマ5枚揃った後に格上げ）。
- IndexedDB の **バージョン上げは不要**（後述）。

---

## 2. 既存土台（実コードで検証済み）

| 項目 | 実体 | 状態 |
|---|---|---|
| テーマ保存 | [board-config.ts:12](../../../lib/storage/board-config.ts#L12) `themeId: DEFAULT_THEME_ID`、load/save 配線あり | ✅ 保存可。ただし **読み込んだ値が描画に未接続** |
| テーマ一覧 | [theme-registry.ts](../../../lib/board/theme-registry.ts) `THEME_REGISTRY`（dotted-notebook / grid-paper） | ✅ あり。**背景クラス＋ラベルのみの薄い定義** |
| 型 | [types.ts:53-59](../../../lib/board/types.ts#L53) `ThemeMeta`、[types.ts:3](../../../lib/board/types.ts#L3) `ThemeId`、[types.ts:95-107](../../../lib/board/types.ts#L95) `BoardConfig` | ✅ 拡張対象 |
| 背景描画 | [ThemeLayer.tsx](../../../components/board/ThemeLayer.tsx) `themeId` 受領→背景クラス適用、`data-theme-id` を自 div に付与 | ✅ あり |
| 背景パターン | [themes.module.css](../../../components/board/themes.module.css) `.dottedNotebook`（黒一色）/`.gridPaper`（方眼・線色ベタ書き） | ⚠ 方眼線色がトークン化されていない |
| 配色トークン | [globals.css](../../../app/globals.css) `:root`（暗）＋ `[data-theme="light"]`（明・LP専用） | ✅ トークン体系あり |
| 書体 | next/font: Geist / Geist Mono / Fraunces(`--font-serif-display`) / Caveat（既存読込・板未使用） | ✅ セリフ・等幅・手書きが既に手元にある |
| アニメ登録 | [tag-entry/index.ts](../../../lib/animation/tag-entry/index.ts) `getEntryAnimation(theme)` / [text-transition/index.ts](../../../lib/animation/text-transition/index.ts) `getTextTransition(theme)` / tag-shutdown `getShutdownAnimationClass(theme)` = `switch(theme)` 方式 | ✅ case 追加で拡張可 |
| スクロールメーター | [ScrollMeter.tsx](../../../components/board/ScrollMeter.tsx)（波形 150tick）＋module.css | ⚠ 波形バーの色/高さが React 内ベタ書き（トークン無し） |
| 設定UI | [ExtensionEntry.tsx](../../../components/board/ExtensionEntry.tsx)（SETTINGS hover ドロワー）/ [TuneTrigger.tsx](../../../components/board/TuneTrigger.tsx)（TUNE） | ✅ THEMES 欄の置き場所＝SETTINGS ドロワー |
| 配線の手本 | `motionEnabled`: state→load→handler→save→UI→描画の一式 | ✅ themeId はこれを完全に踏襲 |
| 属性切替の実証 | [LandingPage.tsx:45-48](../../../components/marketing/LandingPage.tsx#L45) が mount 時に `data-theme` を setAttribute し離脱で復元 | ✅ ランタイム属性切替の「技」はこれを流用 |
| i18n | 15言語 + 整合テスト（`messages/*.json` + parity test） | ✅ 新ラベルキーは15言語へ追加 |

**ギャップ（今回埋める）**: ①themeId が描画に未接続（[BoardRoot.tsx](../../../components/board/BoardRoot.tsx) が `DEFAULT_THEME_ID` をハードコードで `ThemeLayer` に渡す）/ ②選択UIなし / ③解錠なし / ④ベタ書き値4箇所 / ⑤`ThemeMeta` が薄い。

---

## 3. アーキテクチャ（器）

### 3.1 切替の仕組み — `data-theme-id` カスケード

- **各テーマ = 自己完結した `[data-theme-id="<id>"]` CSS ブロック**。自分の `color-scheme` と CSS 変数（配色・書体・影・カード・メーター等）を全部宣言する。デフォルト = `:root`（暗）そのまま、override ブロック無し（= 恒等）。
- **属性の付与先 = `document.documentElement`（`<html>`）**。理由: Lightbox / ポップオーバー等 **portal で `<body>` 直下に出る要素にもカスケードを効かせる**ため。`<html>` に付ければ portal 要素（body の子孫）にも届く。
- **LP との非干渉**: LP が触るのは `data-theme`（light/dark）。ボードが使うのは **別属性 `data-theme-id`**。衝突しない。ボードは mount 時に `data-theme-id` をセットし、ボード離脱時に除去/復元（LandingPage と同じ作法）。
- **specificity**: テーマ override は `:root` の後段に置き、必要なら `html[data-theme-id="paper-atelier"]`（specificity 0,1,1）で `:root`(0,1,0) と `[data-theme="dark"]` を確実に上書き。既存 `[data-theme="light"]` が `:root` を上書きしているのと同じ原理。
- **背景描画**: `ThemeLayer` は従来どおりボード内の背景を描く（自 div の `data-theme-id` ＋背景クラス）。token カスケード（`<html>`）と背景描画（ThemeLayer）は同じ `themeId` state を読む二系統。役割が違うので併存させる。

### 3.2 テーマの契約 — 「7部品」（量産の肝）

`ThemeMeta` を拡張し、**1テーマ＝7部品を埋めるだけ**にする。構造的事実は `ThemeMeta`（TS）に、視覚の **値** は `[data-theme-id]` CSS ブロックに置く（CSS カスケードが最速・実証済みのため）。

| # | 部品 | 置き場所 | `ThemeMeta` 追加フィールド |
|---|---|---|---|
| 1 | 基調＋配色 | CSS ブロック（`color-scheme` + 配色トークン） | `colorScheme: 'light' \| 'dark'` |
| 2 | 書体 | CSS ブロック（`--font-*` 上書き） | （CSS のみ） |
| 3 | ボード背景 | `themes.module.css` のクラス | `backgroundClassName`（既存） |
| 4 | カード表面＋装飾 | CSS ブロック ＋ 装飾オーバーレイ部品 | `decorations?: boolean`（装飾レイヤー有無） |
| 5 | スクロールメーター | ScrollMeter の変種 | `scrollMeterVariant: 'waveform' \| 'ruler'` |
| 6 | モーションの個性 | アニメ登録の case | `motion: { entry: string; text: string; shutdown: string }` |
| 7 | メタ（ID/ラベル/価格） | registry | `id` / `labelKey`（既存）/ `tier: 'free' \| 'paid'` |

> `ThemeMeta` 拡張後の例（paper-atelier）:
> ```ts
> 'paper-atelier': {
>   id: 'paper-atelier',
>   direction: 'vertical',
>   colorScheme: 'light',
>   backgroundClassName: 'paperAtelier',
>   decorations: true,
>   scrollMeterVariant: 'ruler',
>   motion: { entry: 'paper-drift', text: 'ink-underline', shutdown: 'paper-fade' },
>   tier: 'free',
>   labelKey: 'board.theme.paperAtelier',
> }
> ```
> 既存2テーマも新フィールドを埋める（dotted-notebook: colorScheme 'dark' / scrollMeterVariant 'waveform' / motion 'wave' 系 / tier 'free'）。**全テーマが全フィールドを持つ**ことを単体テストで保証（部品の登録漏れ検査）。

### 3.3 状態とデータの流れ

`motionEnabled` の配線を**そのまま踏襲**:
1. `ThemeId` union に `'paper-atelier'` 追加（[types.ts:3](../../../lib/board/types.ts#L3)）。`BoardConfig.themeId` は既存（型変更不要）。
2. BoardRoot に `const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME_ID)`。
3. mount 時 `loadBoardConfig` で読み込み → state へ（`motionEnabled` と同じ useEffect）。
4. `handleThemeChange(id)` → setState ＋ `saveBoardConfig(db, { ...cfg, themeId: id })`。
5. `themeId` state を **副作用で `<html>` の `data-theme-id` に反映**（mount/change で set、ボード離脱で除去）。
6. `<ThemeLayer themeId={themeId} .../>` に渡す（**現状の `DEFAULT_THEME_ID` ハードコードを置換**）。
7. **フォールバック**: 読み込んだ `themeId` が registry に無い / 有料未解錠 → `DEFAULT_THEME_ID` に落とす（壊れない）。
8. **IndexedDB バージョン上げ不要**: `themeId` は既存の保存項目。union に値を増やすだけ＝後方互換。既存保存値（dotted-notebook/grid-paper）も有効なまま。`loadBoardConfig` は default とマージするので未知値もフォールバックで安全。

### 3.4 解錠受け口（スタブ）

- `ThemeMeta.tier: 'free' | 'paid'`。
- `isThemeUnlocked(meta, licenseState): boolean` — `free` → 常に true / `paid` → 保存済みライセンスを見る（今は空＝常に false）。
- ライセンス保管 = settings ストアに `theme-licenses` レコードの**形だけ**用意（中身は空）。読み出し関数のみ。**鍵入力UI・検証ロジックは作らない**。
- 選択UIは `isThemeUnlocked` を読み、`paid` かつ未解錠なら 🔒 表示＋クリックで「後日解錠」の優しい案内（pill 言語: ⚠ アンバー系、エラー表現は使わない）。
- paper-atelier は `free` のため **実画面ではロック非表示**。受け口は配線され、**単体テストで解錠/施錠の判定を保証**（将来 paid テーマ追加時に即機能する）。

### 3.5 ベタ書き値のトークン化（デフォルト見た目は不変）

各々、**現在の値を default トークン値にする**ので既定テーマの見た目は変わらない。テーマはこのトークンを上書きするだけ:
- メーター波形バー: `--meter-bar-color` / `--meter-swell-color` / `--meter-bar-glow`（[ScrollMeter.tsx](../../../components/board/ScrollMeter.tsx) のインライン style 経由で WaveformTrack へ）。
- 方眼線色: `--theme-grid-line-color`（[themes.module.css](../../../components/board/themes.module.css) `.gridPaper`）。
- カードタイトル帯: `--card-title-bg` / `--card-title-fg`（[ImageCard.module.css](../../../components/board/cards/ImageCard.module.css) の白ベタ `rgba(255,255,255,0.95)` を置換）。
- Instagram 覆い: `--card-instagram-tint`（同上のラジアルグラデの黒ベタ）。

---

## 4. paper-atelier 完全再現 仕様（第1テーマ・最終形）

> モックは「デザイン見本ポスター」。**パレット色見本の帯・"Animation ideas" の箇条書きはポスターの説明書き**であり実画面UIではない（user 確認済み）。再現対象は **生きたボード/設定/メーターの見た目と動き**。

### 4.1 配色（6色・初期値は要校正）

モックの "PALETTE" 行から名称確定。hex は縮小画像で正確に読めないため **初期値**を置き、実装中に **校正グリッドで mock に寄せて確定**する（憶測の確定値は置かない）。

| 役割名 | 初期hex(要校正) | 主なマッピング先トークン |
|---|---|---|
| PARCHMENT（紙地） | `#efe6d2` | `--color-bg-primary` / `--bg-dark`（背景） |
| IVORY（象牙・カード地） | `#f7f1e3` | `--color-bg-elevated` / `--color-card-bg` / `--card-title-bg` |
| WARM GRAY（褪せ灰） | `#9c9485` | `--color-text-secondary` / `--color-card-border` |
| CHARCOAL（墨） | `#2b2722` | `--color-text-primary` / `--card-title-fg` / `--chrome-text-color` |
| FOREST（深緑） | `#2f4a37` | `--color-accent-primary`（保存ボタン・選択枠 等） |
| GOLD PEEL（古金） | `#b9924a` | 第2アクセント（スタンプ/レバー/箔・新トークン `--accent-gold`） |

`color-scheme: light`。影は紙が紙に落ちる柔らかい影（`--shadow-*` を低コントラストの温かい影に上書き）。

### 4.2 書体（新規ダウンロード無し）

既存読込済みのみで構成（First Load 増やさない）:
- 見出し/ワードマーク = **Fraunces**（`--font-serif-display`、高コントラストセリフ）。
- 本文 = セリフ（`var(--font-serif-display), Georgia, serif`。小サイズ可読性は校正で確認）。
- ラベル/メタ/メーター数字 = **Geist Mono**（`--font-geist-mono`）。
- 手書き調アクセント（"Drag to edge" 等の注記） = **Caveat**（既存読込・変数名は実装時に確認）。

### 4.3 ボード背景

- **紙の繊維テクスチャ**（生成り・ほのかな汚し/シミ・周辺減光ヴィネット）。
- 実装: 軽量タイル画像（`public/themes/paper-atelier/` に SVG/PNG。`scripts/` で生成＝既存 placeholder-art と同方式）＋ CSS の重ね（grain + vignette）。**常時 canvas・GPU フィルタは使わない**（perf 安全）。
- `themes.module.css` に `.paperAtelier` クラス追加、`ThemeMeta.backgroundClassName` で選択。

### 4.4 カード表面＋装飾

- **表面（トークンで紙化）**: 地=IVORY 紙、枠=WARM GRAY ヘアライン、角丸=小（写真プリント風 2–4px、`--card-radius` 上書き）、影=柔らかい紙影、タイトル帯=紙地＋墨文字。
- **装飾レイヤー（飾りの重ね貼り）**: マステ（半透明色テープ）/ 画びょう / クリップ / フォトコーナー / スタンプ（ARCHIVE・REAL・RATED）。
  - **非干渉が絶対条件**: `pointer-events: none` の純粋な見た目オーバーレイ。**クリック判定・ドラッグ/リサイズ・Lightbox の FLIP 計測（`.media` の rect）に一切関与しない**。カード枠に被せるだけ。
  - **決定論的**: 装飾の種類/位置は **card.id をシードに決定**（毎 render でランダムに変わらない＝同じカードは常に同じテープ）。既存の決定論方針（placeholderArtFrames）に倣う。
  - **Lightbox 整合**: 拡大時の source-clone にも装飾が乗り、同じ overlay/フェード帯を通って消える（拡大クローンも実要素と同じ overlay/フェード帯を通す＝世界の一貫性原則）。slice 1 では「装飾は media クローンと一緒に素直にフェード」で可。
  - `ThemeMeta.decorations: true` のテーマだけ装飾部品をマウント。

### 4.5 スクロールメーター（定規/巻尺 変種）

- `scrollMeterVariant: 'ruler'`。**スクロール位置ロジックは現状を再利用**、見た目だけ差し替え。
- WaveformTrack と並ぶ **RulerTrack**（目盛り＋数字＋真鍮マーカー）を新設。`ScrollMeter` が variant で出し分け。
- 色は 4.1 ＋ 新トークン（`--meter-*`）。slice 1 は基本の目盛り＋マーカー＋カウンタ。凝った状態差（hover/drag 毎の演出）は磨きで。

### 4.6 モーションの個性（署名アニメ）

アニメ登録（`switch(theme)`）に paper 戦略を追加し、`ThemeMeta.motion` で選択。**完全再現の最終形では4種すべて入れる**（積む順は §4.8）:
- **pinned-card drift**（出現/常時の微揺れ）→ `getEntryAnimation` の `'paper-drift'` case。
- **soft photo shuffle**（複数画像カードの切替）→ 既存 motion 機構のテーマ別差分。
- **ink underline draw**（文字切替＝翻訳トグル等）→ `getTextTransition` の `'ink-underline'` case（既定 glitch-crt の代替）。
- **paper parallax**（背景の視差）→ 背景レイヤーの軽いパララックス（reduced-motion で無効）。
- **reduced-motion 尊重**: `motionEnabled` / `prefers-reduced-motion` off で停止（既存ゲートに乗る）。

### 4.7 装飾 chrome（ボード周辺）

- **MK-1 プレート**（左下タブ "ALLMARKS MK-1"）、**蝋封「A」シール**（右下の円形スタンプ）、パネル角のマステ/クリップ。
- ワードマーク（背景の大「AllMarks」）は paper では Fraunces セリフ。`bgTypoEnabled` の既存挙動はそのまま、見た目だけテーマ追従。

### 4.8 積む順（完全再現を安全な順で）

各段で実機確認＋校正しながら mock に寄せる:
1. 器（registry 拡張 / themeId 配線 / `<html>` 属性 / フォールバック）＋ トークン化4箇所。
2. paper の配色トークン＋`color-scheme`＋書体（紙地＋セリフが効く）。
3. ボード背景（紙テクスチャ）。
4. カード紙化（表面トークン）。
5. カード装飾レイヤー（マステ/ピン/クリップ/スタンプ）。
6. 定規メーター変種。
7. 署名アニメ4種。
8. 選択UI（THEMES 欄）＋解錠受け口。
9. 全体 校正グリッドで mock に寄せる。

---

## 5. テーマ選択 UI

- **置き場所**: SETTINGS ドロワー（[ExtensionEntry.tsx](../../../components/board/ExtensionEntry.tsx)）内に「**THEMES**」セクション新設（QUICK-TAG トグルと既存項目の並び）。
- **見た目**: テーマを**ミニプレビュー付きの札**で横並び（default / paper-atelier）。各札 = 小サムネ＋テーマ名（i18n）＋ 無料/🔒 バッジ。クリックで即適用（保存＋属性更新＋即反映）。
- **e2e 用**: 各札に `data-theme-button="<id>"` を付与（既存 e2e の TODO だった属性を復活）。
- **将来**: テーマが5枚揃ったら **専用ギャラリー画面** に格上げ（"売り場" として魅せる）= 後の回。slice 1 はドロワー内方式（YAGNI）。

---

## 6. エラー処理 / エッジケース / パフォーマンス

- **未知/削除/未解錠の themeId** → `DEFAULT_THEME_ID` フォールバック（§3.3-7）。
- **reduced-motion** → テーマアニメは既存ゲートで停止。
- **portal 要素**（Lightbox/PiP/ポップオーバー）→ `<html>` 属性なのでカスケード到達。要視覚確認。
- **共有/エクスポート**（[SharedBoard.tsx:397](../../../components/share/SharedBoard.tsx#L397) は `data-theme={themeId}` を outer frame に付与、OG は capture-mirror）→ **テーマ化は follow-up**（slice 1 はボードのライブ表示が対象。共有はデフォルト見た目のままでも破綻しない）。
- **パフォーマンス**: paper は静的テクスチャ＋静的装飾、常時 canvas/GPU フィルタ無し → 盤面は合成律速（fill-rate 律速）だが paper はそこに負荷を足さないので安全。装飾は `pointer-events:none` で hit-test 負荷も無し。

---

## 7. テスト ＆ 検証

### 単体（vitest）
- **契約整合**: 全テーマが `ThemeMeta` 7部品（colorScheme/backgroundClassName/scrollMeterVariant/motion/tier/labelKey/id）を漏れなく持つ。
- **解錠**: `isThemeUnlocked` — free→true / paid(未解錠)→false。
- **保存往復**: `saveBoardConfig`→`loadBoardConfig` で themeId 保持。
- **フォールバック**: 未知 themeId → default。
- **i18n parity**: 新ラベルキー（`board.theme.paperAtelier`）が15言語に存在（既存 parity テストに乗る）。
- **決定論装飾**: 同 card.id → 同じ装飾割り当て（純関数）。

### 視覚（Playwright・「code が通る≠効いている」前提で実測＋校正グリッドで客観評価）
- paper 適用時に `getComputedStyle` で **実際に紙色・セリフ・color-scheme が効く**ことを実測（code が通る≠効いている）。
- ボード/設定/メーターを paper テーマでスクショ → **校正グリッド**で mock に寄せる。
- portal（Lightbox）にもテーマが届くことを確認。
- 既知フレーキー: `tests/lib/channel.test.ts`（full run でたまに落ちる→再実行 green）。

### デプロイ前ゲート（CLAUDE.md）
`rtk tsc && rtk vitest run && rtk pnpm build` → `wrangler whoami` → `wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-message`(ASCII)。

---

## 8. 変更/新規ファイル 地図（plan 用の目安）

**型/レジストリ**
- `lib/board/types.ts` — `ThemeId` に `'paper-atelier'`、`ThemeMeta` に新フィールド。
- `lib/board/theme-registry.ts` — 3テーマ分の新フィールド充足。
- `lib/board/theme-entitlement.ts`（新規） — `tier` 型・`isThemeUnlocked`・ライセンス読み出しスタブ。

**配線**
- `components/board/BoardRoot.tsx` — themeId state / load / handler / `<html>` 属性副作用 / `ThemeLayer` へ渡す（DEFAULT_THEME_ID 置換）。
- `components/board/ThemeLayer.tsx` — 既存維持（必要なら variant 受け）。

**CSS/トークン**
- `app/globals.css` — `html[data-theme-id="paper-atelier"]` ブロック（配色/`color-scheme`/`--font-*`/影/カード/メーター）＋ §3.5 のトークン default 化。
- `components/board/themes.module.css` — `.paperAtelier` 背景クラス、方眼線色トークン化。
- `components/board/cards/ImageCard.module.css` — タイトル帯/Instagram覆いのトークン化。

**部品（新規）**
- `components/board/decorations/`（新規） — 装飾オーバーレイ（マステ/ピン/クリップ/スタンプ）＋決定論割当。
- `components/board/scrollmeter/RulerTrack.tsx`（新規） — 定規メーター変種。
- `components/board/ThemePicker.tsx`（新規） — SETTINGS 内 THEMES 欄。
- `lib/animation/*/themes/paper-*.{ts,module.css}`（新規） — paper の entry/text/shutdown 戦略。

**アセット/生成**
- `scripts/generate-paper-texture.mjs`（新規・任意） — 紙テクスチャ生成 → `public/themes/paper-atelier/`。

**i18n**
- `messages/*.json`（15言語） — `board.theme.paperAtelier` ほかラベル。

**テスト**
- `lib/board/theme-registry.test.ts` / `theme-entitlement.test.ts` / 装飾決定論 / 既存 e2e の `[data-theme-button]` 復活。

---

## 9. 未解決の論点

- なし（slice 1 の範囲は確定）。色 hex・寸法は「初期値→実装中に校正グリッドで確定」というプロセスで解決する（spec 上の placeholder ではなく確定手順）。
- follow-up（別タスク化）: 共有/OG のテーマ化、紹介ページのテーマ化、テーマギャラリー画面、有料解錠の本体（N-06）。
