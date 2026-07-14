# Design — サブ2: フラットパターンテーマ＋その TUNE 皮（一般ユーザーの標準・LP と地続きの白エディトリアル）

日付: 2026-07-14 / セッション 198
種別: **サブ spec**（実装 spec）。親 = [2026-07-14-theme-scope-principle-design.md](2026-07-14-theme-scope-principle-design.md) §7 サブ2。前段 = サブ1（chrome スキントークン基盤・s197 出荷済）。
関連旧 spec: [2026-07-05-flat-theme-and-theme-boundary-design.md](2026-07-05-flat-theme-and-theme-boundary-design.md)（s162・白フラット default の初期構想）。本 spec はその「フラット＝白エディトリアル」を継ぐが、**既定化は当面見送り**（下 §2）。

---

## 1. 背景・目的

- 現状の登録テーマ（実確認・[theme-registry.ts](../../../lib/board/theme-registry.ts)）は **dotted-notebook（既定・音・dark）／grid-paper（Grid・dark）／paper-atelier（紙・light・work）** の3つ。**フラットテーマは未存在**。
- サブ1 で chrome スキントークン（`--chrome-panel-*`・`--chrome-btn-*`・`--chrome-font`・`--chrome-hover-fx`）を `:root` 中立既定＋各テーマブロックで着替える土台が入った（[globals.css](../../../app/globals.css) `:361-370` `:653-663`）。**サブ2 は、その土台を初めて"見える皮"として消費する最初の実テーマ**。
- 目的＝**LP（白エディトリアル・Fraunces セリフ・`#faf9f6`）と呼応する静かな明るい盤面**を、一般ユーザーの標準として追加する。あわせて **TUNE メニューの中身を、音テーマの金属オーディオミキサーとは別の"清潔なフラット皮"**にする（ユーザー要望 s198）。

### モックでの合意（ユーザー承認済み・2026-07-14）

- モック（Artifact `5886508d-0772-49ae-8428-11832c0e695f` rev2）でユーザーが**方向 A を承認**。
- 確定した具体点:
  - **地面＝LP パレット準拠**（面 `#faf9f6`／縁 `#f1efe8`／カード `#ffffff`／インク `#14130f`／柔インク `#57544c`／アクセント緑 `#28f100` は1〜2箇所のみ）。
  - **メーターは位置を変えない**（下の帯のまま）＝迷わせない。テーマで変えるのは"見た目だけ"（波形→静かな目盛り・数字はスクランブルさせず静止）。
  - **TUNE の中身をフラット化**＝プリセット（金属レバー＋ドーム LED → 淡い選択下地＋緑ドット）・W/G フェーダー（金属チャンネル＋オレンジ3Dキャップ＋42目盛り → 細レール＋白丸ハンドル＋数値）・CORNERS（金属スイッチ → iOS トグル）・操作凡例（5行 LED → 静かな小文字ヒント）。
  - **音テーマはミキサーのまま温存**（フラットの皮は音に一切影響しない）。

---

## 2. 確定した決定（本サブの背骨）

1. **フラット＝新規追加の opt-in 明テーマ**。`DEFAULT_THEME_ID` は当面 `dotted-notebook`（音）のまま。**既定化は「作り込んでから公開」の掟に従い、ユーザーが実機で承認した後に別途1行で**（受け取り既定も同時）。理由＝世界の第一印象＝既定を実機未検証テーマに倒すのは危険。追加なら可逆・爆風小。s162 の「フラット＝最終的に既定」という目標は捨てず、順序だけ安全化。
2. **メーターの位置は全テーマ共通（構造）**。テーマは `scrollMeterVariant`（見た目）だけを変える。フラットは**新しい静音 variant**を持つ（下 §4.7）。位置を下の帯にしたのは s170 のテーマ非依存な理由（フロアのカード操作とスクラブ判定の非重複）なので動かさない。
3. **TUNE 皮の実装手段＝テーマ id で scope した CSS 上書き**（＝紙が s135 でパネルに使った確立パターン）。JS 構造差し替え（variant prop の BoardRoot 経由スレッド）は**採らない**（既定バイト同一を scope で機械的に保証・低リスク）。sub1 トークンで着替わらない金属内部（フェーダー/プリセット/凡例）だけを `html[data-theme-id="flat"]`-scoped で再皮する。
4. **音テーマのミキサー皮は温存**。フラットの上書きは flat id にのみ効くので、音・Grid・紙は無影響。
5. **フラットは `kind:'pattern'`**（＝CUSTOMIZE で縁/面の色を調整可）。ただし**パターン制御（格子/ドット等）は当面出さない**（清潔さ優先・音と同じ「縁＋面の色のみ」）。既定 `patternType:'none'`。

---

## 3. スコープ全体像（フラットテーマ＝1つの完成した皮を作る）

| # | ピース | 種別 | 主なファイル |
|---|---|---|---|
| A | テーマ登録（7点契約） | 新規 | `types.ts`・`theme-registry.ts`・`globals.css`・`themes.module.css`・`messages/*.json`×15 |
| B | CUSTOMIZE 既定（縁+面色） | 追加 | `theme-customization.ts` |
| C | chrome スキン（sub1 トークン設定＋TUNE 内部の scoped 上書き） | 追加 | `globals.css` flat ブロック＋`FaderColumn/TunePresetColumn/TuneTrigger.module.css` |
| D | 明色縁の chrome 文字反転（旧サブ1 Task 4 の回収） | 完成 | `globals.css` flat ブロック（＋必要なら `BoardRoot.tsx` の注入整合確認） |
| E | 静音メーター variant `'line'` | 新規 | `types.ts`・`ScrollMeter.tsx`・新規 `QuietTrack.tsx`＋css |
| F | 静かな motion（`'fade'` entry/shutdown） | 追加 | `lib/animation/tag-entry`・`tag-shutdown`（＋必要なら text 側 default 流用） |
| G | 背景ワードマーク（セリフ・柔インク） | 設定 | flat ブロック（`--bg-typo-font`/`--bg-typo-color`） |
| H | i18n ラベル `board.theme.flat` | 追加 | `messages/*.json`×15 |
| I | テスト（登録/被覆/e2e/バイト同一） | 追加 | `theme-registry.test.ts`・`chrome-theme-coverage.test.tsx`・`board-theme.spec.ts` ほか |

---

## 4. 詳細設計

### 4.1 テーマ登録（7点契約）

- **`ThemeId`**（[types.ts](../../../lib/board/types.ts) `:3`）に `'flat'` を追加 → `'dotted-notebook' | 'grid-paper' | 'paper-atelier' | 'flat'`。
- **`ThemeMeta`**（theme-registry.ts）に追加:
  ```ts
  flat: {
    id: 'flat',
    direction: 'vertical',
    backgroundClassName: 'flat',
    labelKey: 'board.theme.flat',
    colorScheme: 'light',
    tier: 'free',
    kind: 'pattern',
    scrollMeterVariant: 'line',                 // 新 variant（§4.7）
    motion: { entry: 'fade', text: 'default', shutdown: 'fade' },  // §4.8
  }
  ```
- **`DEFAULT_THEME_ID` は変更しない**（`dotted-notebook`）。
- ラベル名（表示）＝ワーキング「Flat」。picker 表示の最終文言は plan/実機で微調整可（テーマ名は §4.10）。

> **テーマ id / 表示名**: id は内部符号なので `'flat'` で確定（不可視・変更不可の掟に載る）。表示ラベルのみ後で変えられる。

### 4.2 globals.css の flat トークンブロック

`html[data-theme-id="flat"] { ... }` を新設。**紙ブロック（`:473-647`）の構造を手本**にしつつ、値は LP パレット・**フラット（テクスチャ無し・セリフは全面化しない）**。設定するトークン群（抜けると崩れるので paper と同じ枠を埋める）:

- `color-scheme: light`
- 盤面/カード: `--bg-dark`(=board `#faf9f6`)・`--bg-outer`(=edge `#f1efe8`)・`--card-dark-alt`/`--card-white`(=`#ffffff`)・`--card-border-dark`(=`rgba(20,19,15,0.10)`)・`--card-radius`（既定丸め維持）
- テキスト: `--text-primary`(=`#14130f`)・`--text-body`(=`#2c2a25`)・`--text-meta`/`--text-muted`(=`#57544c`)・`--color-text-*`
- アクセント: `--color-accent-primary`/`--accent-primary`（緑 `#28f100` は視認性のため text 用は `#1c9a00` 併用を検討＝plan で値決め）
- **chrome text（縁バンド文字＝反転・§4.6）**: `--chrome-text-color`(暗インク)・`-hover`・`--chrome-text-stroke-color`(明るいハロー)・`--chrome-text-shadow`(弱)
- **chrome スキン（sub1・§4.5）**: `--chrome-panel-surface`(=`rgba(255,255,255,0.97)`)・`--chrome-panel-border`(=`rgba(20,19,15,0.10)`)・`--chrome-panel-radius`(=`14px`)・`--chrome-panel-blur`(弱め or 0)・`--chrome-panel-shadow`(柔らかい持ち上げ)・`--chrome-btn-color`(=`#14130f`)・`--chrome-btn-hover`・`--chrome-font`(= Geist sans)・`--chrome-hover-fx: none`（glitch 停止）
- **メーター（`'line'` variant トークン・§4.7）**: 新設 `--meter-line-*`（レール色・目盛り色・つまみ色・数字色）
- **背景ワードマーク（§4.9）**: `--bg-typo-font: var(--font-serif-display)`・`--bg-typo-color`（柔インク）
- **font**: 紙は `--font-sans` まで serif 化したが、**フラットは body/chrome を sans（Geist）維持**。serif は**ワードマーク/見出しだけ**（`--bg-typo-font` と、必要なら `--font-heading` のみ）。`--font-sans`/`--font-mono` は既定のまま（＝Lightbox/PiP/ポップは sans）。
- lightbox scrim: **上書きしない**（親 spec §3＝ライトボックスは暗バックドロップ固定・テーマ非依存）。フラットでも media が映える暗背景を維持。

### 4.3 themes.module.css の `.flat`

- フラットは `kind:'pattern'` ＝ **既存の viewport-anchored `.patternLayer` 機構に乗る**（grid-paper が汎用性の証拠）。`.flat { background-color: transparent; }` のみ追加（`.dottedNotebook`/`.gridPaper` と同様）。盤面色＋パターン SVG は BoardRoot が customization から inline で描く＝**新規描画コード不要**。

### 4.4 CUSTOMIZE 既定（theme-customization.ts）

- `THEME_CUSTOMIZATION_DEFAULTS` に `flat` を追加（light 値）:
  ```ts
  flat: {
    edgeColor: '#f1efe8', boardColor: '#faf9f6',
    patternColor: 'rgba(20,19,15,0.10)',   // 使わない既定（patternType:'none'）だが値は保持
    patternType: 'none', patternSize: 40, patternStroke: 1,
    titleColor: /* 柔インク＝§4.9 と一致 */,
  }
  ```
- `THEMES_WITH_PATTERN_CONTROLS` には**入れない**（＝縁+面色のみ・パターン制御は非表示）。`isCustomizableTheme('flat')` は true（縁/面の色は調整可）。
- **明色スウォッチの追加検討**: `EDGE_SWATCHES`/`BOARD_SWATCHES`/`TITLE_SWATCHES` は現状ダーク中心。フラット選択時に明色候補が要る（縁/面のクリーム系・title の暗インク）。**per-theme スウォッチ分岐 or 明色を数個追加**を plan で決める（既存の暗色は音/Grid が使うので破壊しない）。

### 4.5 chrome スキン（TUNE 皮＋全パネル）

- **自動で着替わる部分**（sub1 のトークン消費者＝flat ブロックの `--chrome-*` を設定するだけで完成）: ChromeDrawer（SETTINGS/THEMES ドロワー面）・ChromeButton（ヘッダーボタン文字）・FilterPill・ThemeModal/ThemePicker/ThemeCustomizeSection・ExtensionEntry・TuneTrigger の `.drawer` 面。
- **手で再皮する部分（scoped CSS 上書き）**＝ sub1 が触っていない金属内部。各 `.module.css` に `:global(html[data-theme-id="flat"])` 前置で追加（既定/音は無影響）:
  - **FaderColumn.module.css**: `.track`(金属チャンネル→細い明レール)・`.handle`(オレンジ3Dキャップ→白丸ハンドル＋薄影)・`.handle::before/::after`(グリップ溝/index→消す or 中央ドット)・`.ruler .tick`(42目盛り→非表示 or ごく薄い少数)・`.defaultMark`(暗→薄インク)・`.fillMark`(緑は維持・明背景で見える濃さに)・`.label`(明インク)。
  - **TunePresetColumn.module.css**: `.led`/`.ledOn`(ドーム LED→単純ドット・ON=緑塗り)・`.lever`/`.handle`(金属レバー→iOS トグル or 選択下地)・`.label`(明インク)・`.maker`("MK-1/ALLMARKS" 刻印→非表示 or ごく薄)・`.cornersRow`(iOS トグル化)。
  - **TuneTrigger.module.css**: `.drawer`(暗ガラス→白パネル＝sub1 トークンで概ね済／残差を scoped 補正)・`.drawerDivider`(金属彫り groove→ヘアライン)・`.opsLegend`/`.led`/`.opsText`(5行 LED→静かな小文字ヒント＝LED 非表示・文字を薄インク)。
- **掟（s197 fix-1）**: 明インク文字にするなら面も明色に**対で**。flat ブロックは面（`--chrome-panel-surface` 白）＋文字（`--chrome-btn-color` 暗）を必ずセットで置く。
- **リテラル緑 `#28F100`**（FaderColumn `.fillMark[data-in-range]` `:88-92`）は音/紙でも共通の"そろえ点"色＝**そのまま**（明背景でも見える）。

### 4.6 明色縁の chrome 文字反転（旧サブ1 Task 4 の完成）

- フラットは `colorScheme:'light'`＋縁が明色。サブ1 Task 4（保留）＝「明色 edge のテーマで chrome 文字を暗インクへ反転」を**ここで生かす**。実体は `BoardRoot.tsx:176-199` の `LIGHT_EDGE_CHROME`/`DARK_CHROME_RESET`（`isLightColor(edgeColor)` で発火）＋ flat ブロックの `--chrome-text-*`/`--chrome-btn-*`。
- **確認事項**: サブ1 fix-1 で paper の `--chrome-btn-color` 上書きを**中立化**した（コメントアウト `:605-616`）。フラットは**面もクリーム/白にする**ので暗インク×暗ガラスの罠は起きない＝安全に暗インク反転を効かせられる。plan で `LIGHT_EDGE_CHROME` の注入トークンが実消費されるか（`--chrome-btn-color`/`--chrome-text-*`）を計測 e2e で固定。
- 音（dark）は不変（`isLightColor` が false）。

### 4.7 静音メーター variant `'line'`（新規）

- **理由**: 波形は JS 正弦波＝"静か"にできない。`'ruler'` は `RulerTrack` が `paperAssetUrl('ruler-meter-strip'/'-thumb')`（[RulerTrack.tsx](../../../components/board/scrollmeter/RulerTrack.tsx) `:35-36`）で**紙の PNG テープを引き込む**＝紙固有。ゆえに**専用の静音 variant を新設**。
- 変更:
  - `types.ts` `ThemeMeta.scrollMeterVariant`: `'waveform' | 'ruler' | 'line'`。
  - `ScrollMeter.tsx`: (1) render 分岐に `variant === 'line' ? <QuietTrack markerRef/> : ...` を追加。(2) rAF の per-tick 高さ書き込みを `isRuler` と同様 line でもスキップ（`const isQuiet = variant==='ruler' || variant==='line'`）。(3) counter の**スクランブル停止**（`writeDigit` の `isRuler` short-circuit `:495-498` を `isQuiet` に一般化）＝数字は静止インク。marker は ruler と同じく `rulerMarkerRef` パターンで left% を書く（QuietTrack にも `markerRef`）。
  - 新規 `components/board/scrollmeter/QuietTrack.tsx`＋`.module.css`: 静かな editorial ライン＝細いベースライン＋疎な目盛り（数個）＋シンプルなつまみ（丸 or 細バー）。**紙 PNG に依存しない**。色は flat ブロックの `--meter-line-*` トークン（+ 中立フォールバック＝off-theme でも見える）。
- 音/Grid/紙は無変更（waveform/ruler のまま）。

### 4.8 静かな motion（`'fade'`）

- 現状（実確認）: `getEntryAnimation`（[tag-entry/index.ts](../../../lib/animation/tag-entry/index.ts) `:41`）は `'wave' | 'paper-drift'`・default→undefined。`getShutdownAnimationClass`（[tag-shutdown/index.ts](../../../lib/animation/tag-shutdown/index.ts) `:13`）は `'wave' | 'paper-fade'`・default→undefined。`getTextTransition` は `'ink-underline' | 'glitch-crt' | 'default'`。
- 追加:
  - `getEntryAnimation` に `case 'fade'`: opacity 0→1（＋ごく小さな translateY）・穏やかな ease・短め。カード＋背景ワードマークに効く（entry は両者共通）。
  - `getShutdownAnimationClass` に `case 'fade'`: opacity→0 のクラス（CSS keyframe を1つ追加）。
  - text は `'default'`（既存の素の切替）を使う＝新規不要。
- flat motion = `{ entry:'fade', text:'default', shutdown:'fade' }`。MOTION off 時の退場も `'fade'`。
- `reduced-motion` で無効化（既存機構に自動追従）。

### 4.9 背景ワードマーク（セリフ・柔インク）

- flat ブロックで `--bg-typo-font: var(--font-serif-display)`（Fraunces）＋`--bg-typo-color`（柔インク）。既定/音は fallback で不変（BoardBackgroundTypography は var-with-fallback）。
- **濃さ**: モックの極薄（0.065）は薄すぎ。紙は 0.9（かなり濃い）。フラットは**中間の"見えるが静かな柔インク"**を plan/実機で確定（初期値の候補＝ `rgba(20,19,15,0.5)` 前後）。`titleColor`（CUSTOMIZE）が上書きするので、既定 titleColor をこの値に合わせる。

### 4.10 i18n ラベル（15言語）

- `messages/*.json` 全15言語に `board.theme.flat` を追加。テーマ名の翻訳方針は**既存テーマ（dottedNotebook/gridPaper/paperAtelier）の JSON 実値に合わせる**（plan で現行値を確認＝翻訳するのか英語固定なのか。機能名でなくテーマの固有名なので既存慣習に従う）。placeholder 無し＝parity テストの新規リスク低いが、キー追加は全ロケール必須（欠けると fallback）。

---

## 5. 不変条件（死守）

- **既定テーマ（dotted-notebook）はバイト同一**。flat の追加・globals の flat ブロック・scoped CSS 上書きは全て `data-theme-id="flat"` に閉じる。サブ1 の computed-style e2e（`chrome-skin-tokens.spec.ts`）＋既定盤面テストが緑のままを確認。
- **音のミキサー皮は無変更**（FaderColumn/TunePresetColumn の非 scoped 部分＝金属の実体は触らない・flat の追加ルールのみ）。
- **紙は無変更**（紙ブロック・`--paper-panel-*`・RulerTrack の paper 経路に触れない）。`--paper-panel-*` の定義削除禁止（SaveToast/PipStack 消費）。
- **メーターの位置・スクラブ契約は不変**（0..1 in / onScrub out）。variant 追加は render 分岐と counter 静止のみ。
- **CLAUDE.md 規約**: TypeScript strict・`any` 禁止・Vanilla CSS/`.module.css`・Tailwind/Framer Motion 禁止・z-index は `BOARD_Z_INDEX`・`rtk` 前置・`--no-verify` 禁止。

## 6. テスト

- `theme-registry.test.ts`: flat の meta（colorScheme light・kind pattern・scrollMeterVariant 'line'・motion fade/default/fade）を追加検証。全テーマループ（既存）に flat が乗る。
- `chrome-theme-coverage.test.tsx`（サブ1 の抜けゼロ検査）: 全テーマ×全 chrome パネルに flat が自動的に含まれる＝flat でも全 testid が描画されることを確認（皮を着ても骨は落ちない）。
- `theme-customization` 単体: flat の既定解決（縁/面色・patternType none・isCustomizableTheme true・themeAllowsPattern false）。
- `ScrollMeter` 単体: `variant='line'` で per-tick 高さ書き込み無し・counter がスクランブルせず静止・marker が left% 追従。
- e2e `board-theme.spec.ts`: (1) flat 選択で `data-theme-id="flat"`＋盤面が明色。(2) **明色縁の chrome 文字反転**（chrome ボタン computed color が暗インク）。(3) 静音メーターが出る。(4) TUNE を開くと白パネル＋フラット内部。(5) 既定（dark）に戻すと反転しない（不変）。
- ゲート: `rtk tsc && rtk vitest run && pnpm build` ＋ `npx playwright test tests/e2e/board-theme.spec.ts tests/e2e/chrome-skin-tokens.spec.ts`。

## 7. 非対象（本サブに含めない）

- **既定化（`DEFAULT_THEME_ID` の差し替え）**＝実機承認後に別途（§2-1）。
- **受け取り画面（/s/）のフラット化**＝親 spec サブ5。共有 payload は現状 `DEFAULT_THEME_ID` を forward（`SharedBoard` は `data-theme`）＝別系統。ただし **SHARE 画像（dom-to-image で実 DOM を撮る）はフラット盤面をそのまま写す**＝自動でフラットになる。**要確認（plan）**: 明色盤面の SHARE プレビュー/OG のコントラスト（帯・文字が明背景で読めるか）。破綻すれば別タスク化。
- **Grid・紙の TUNE 皮**＝サブ3。
- **世界の層**（横スクロール・奥行き・WebGL）＝別サブ。

## 8. plan で詰める未確定

- メーター: `'line'` variant の具体ビジュアル（つまみの形・目盛り本数）。QuietTrack の最小構成。
- パレット最終値: 縁/面/カード境界/柔インク/アクセント text 色（`#28f100` vs `#1c9a00`）・ワードマーク濃さ・chrome パネル影/ブラー。
- CUSTOMIZE の明色スウォッチ追加方法（per-theme 分岐 vs 明色数個追加）。
- TUNE 内部 scoped 上書きの粒度（42目盛りは非表示 or 数本残す／プリセットのレバーは iOS トグル型 or 選択下地のみ／操作凡例は3行に減らす or 5行を静音）。
- 表示ラベル名（「Flat」か別名か）と 15言語の翻訳可否（既存テーマ慣習に合わせる）。
- motion 'fade' の duration/easing（4K 実機で計測・肌の層アニメも 4K で測る＝親 spec §8）。

## 9. 実装順（plan の下書き・写経粒度）

1. 骨（登録）: `types.ts`（ThemeId + variant 'line'）→ `theme-registry.ts`（flat meta）→ `theme-customization.ts`（既定）→ `themes.module.css`（.flat）→ `messages/*.json`×15（ラベル）。ここまでで「選べるが皮は中立」。
2. 肌（見た目）: `globals.css` flat ブロック（palette + chrome トークン + 反転 + wordmark + meter-line トークン）。
3. メーター: `ScrollMeter.tsx`（line 分岐＋counter 静止）＋新規 `QuietTrack`。
4. motion: `tag-entry`/`tag-shutdown` に 'fade'。
5. TUNE 皮: FaderColumn/TunePresetColumn/TuneTrigger の `.module.css` に flat-scoped 上書き。
6. テスト一式＋ゲート＋（デプロイして実機確認依頼）。

各ステップに per-task レビュー、最後に opus 全ブランチレビュー。実装モデルは Sonnet 中心（芯）＋機械的部分は Haiku 可。
