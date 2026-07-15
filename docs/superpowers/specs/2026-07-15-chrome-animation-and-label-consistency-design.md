# Design — ① chrome アニメのテーマ化 ＋ chrome ラベル字体の連動（フラット静音化）

日付: 2026-07-15 / セッション 199
種別: feature 設計（brainstorming 承認済＝B 下線モック承認・音 only signature・ピル字体そろえる＋連動）
親: [2026-07-14-theme-scope-principle-design.md](2026-07-14-theme-scope-principle-design.md)（chrome＝テーマの皮／肌の層にカードアニメ・chrome アニメを含む）
関連掟: 連動／抜けもれなく（[[reference_token_fallback_dead_when_root_defined]]・s199 の `--chrome-ink-rgb` と同思想）／[[project_pill_visual_language]]（glitch は音の言語）

---

## 1. 目的（ユーザー確定）
- **chrome（メニュー）のアニメを「テーマごとに載せ替え」**（有無〜種類）。音＝賑やか（文字スクランブル＋RGBグリッチ）を**オプトイン**、それ以外は黙って静か（＝将来テーマも自動で静か＝抜けゼロ）。
- **フラット＝決めたアニメのみ**：ホバーで**下線（B）**。スクランブル無し・グリッチ無し。
- **絞り込みピルの字体をヘッダーボタンと"連動"**：共通トークンで揃え、テーマを作るたびにずれない。

## 2. 現状の事実（調査済・実コード）
### アニメの棚卸し（GLOBAL＝全テーマで発火・要ゲート）
- **文字スクランブル（JS）**: `lib/board/use-idle-scramble.ts`（`useChromeScramble`＝idle wobble＋hover burst）＋`components/board/TuneTrigger.tsx` の独自スクランブル。消費: `ChromeButton`（TITLE/SHARE/POP OUT/EMPTY TRASH/ワードマーク/`TagButton`/`MotionToggle`/`ChromeLedToggle`）・`FilterPill`。**テーマ判定なし＝全テーマで動く**。（grab churn だけは既に `data-grabbing`＝音のみ）
- **RGBグリッチ（CSS）**: `glitch-shift-a/b` を5ファイルが個別定義＝`ChromeButton.module.css`・`FilterPill.module.css`・`TuneTrigger.module.css`・`ScrollMeter.module.css`・`LanguageSwitcher.module.css`（`lang-glitch-a/b`）。hover 発火は**全テーマ**（grab loop は `data-grabbing`＝音のみ）。
- **ツイート翻訳の CRT グリッチ（カード側）**: `getTextTransition('default')` が `glitch-crt` にフォールバック（[lib/animation/text-transition/index.ts:51-53](../../../lib/animation/text-transition/index.ts#L51)）。flat は `motion.text:'default'`（[theme-registry.ts:47](../../../lib/board/theme-registry.ts#L47)）→ **flat でも "じじっ" グリッチが出る**。

### 既にテーマ化済（触らない）
- スクロールメーター（waveform/ruler/line＝`scrollMeterVariant`）。flat は `line`（静か）。
- カード登場/退場アニメ（`motion.entry/shutdown`）。

### 絞り込みピルの字体差（連動対象）
- ピルの `.label` は「ブランド印」として別スタイル（[FilterPill.tsx:66-69](../../../components/board/FilterPill.tsx#L66) コメント "the 'all' filter doubles as the brand mark"）: **font-weight 500・font-size 12px・letter-spacing 0.04em・大文字化なし**（[FilterPill.module.css:38-46](../../../components/board/FilterPill.module.css#L38)）。
- ヘッダーボタン `.btn` は **weight 400（既定）・11px・0.10em・UPPERCASE**（[ChromeButton.module.css:1-6](../../../components/board/ChromeButton.module.css#L1)）。
- **font-family は両方 `var(--chrome-font)` で既に共通**（フラットでは Geist）。差は weight/size/tracking/case のみ。音（mono）では埋もれ、フラット（sans）で「別書体」に見える。

## 3. 設計

### 3-A. アニメ載せ替えの仕組み — `ThemeMeta.chromeMotion`（signature | quiet）
- `ThemeMeta` に必須フィールド `chromeMotion: 'signature' | 'quiet'` を追加（必須＝新テーマは必ず宣言＝抜けゼロ）。
  - `dotted-notebook`（音）= `'signature'`／`grid-paper` = `'quiet'`／`paper-atelier` = `'quiet'`／`flat` = `'quiet'`。
- **JS スクランブル**: `useChromeScramble`／`TuneTrigger` のスクランブルを「現テーマが signature のときだけ動く」ようにゲート。判定＝`getThemeMeta(currentThemeId).chromeMotion === 'signature'`。現テーマの取得は `<html data-theme-id>` を監視（`TuneTrigger` の既存 `data-grabbing` 監視と同型の MutationObserver）で全消費者を一括カバー（prop 配線漏れを防ぐ）。signature 以外＝スクランブルせず素のラベルを返す。
- **CSS グリッチ**: 5ファイルの hover グリッチ（`:hover::before/::after`）を signature テーマにスコープ＝`:global(html[data-theme-id="dotted-notebook"]) …:hover::before {…}`。音では従来どおり（バイト同一）、それ以外は発火しない。grab loop（`data-grabbing`）は音のみゆえ現状維持。
- **不変**: 音は挙動バイト同一（スコープ追加後も音では全セレクタが一致）。grid-paper/paper/flat はグリッチ＋スクランブルが**消える**（＝意図的・「音 only signature」）。

### 3-B. フラットの下線ホバー（B）
- `ChromeButton .btn` と ワードマークに、フラット限定でホバー下線を追加（`:global(html[data-theme-id="flat"]) .btn:hover::after { … underline draw … }`）。他テーマ・音は無し（バイト同一）。下線は `currentColor`（=暗インク）で 1.5px、左から `scaleX(0→1)`（B モック準拠）。pill/トグルは既存の色/枠変化のまま（下線は付けない＝B モックどおり）。
- 実装注意: `.btn` の `::before/::after` は音のグリッチゴーストに使われる。フラットの下線は `::after` を使うが、フラットでは音のグリッチが発火しない（3-A でスコープ済）ので衝突しない。念のためフラットスコープで `::after` の content/animation を下線用に上書き。

### 3-C. ツイート翻訳のフラット静音化（カード側・小）
- 静かなテキスト遷移を1つ追加（`lib/animation/text-transition/themes/` に `createQuietTransition`＝loadingClass/exitClass=null・playEntry は WAAPI 無しの即 setText or 軽いクロスフェード）。`getTextTransition` に `case 'quiet'` を追加。flat の `motion.text` を `'default'`→`'quiet'` に。音/Grid は `'glitch-crt'` のまま（不変）、紙は `'ink-underline'` のまま。

### 3-D. chrome ラベル字体の連動 — 共通トークン
- `globals.css :root` に共通トークンを定義（テーマで上書き可）:
  - `--chrome-label-size: 11px;`／`--chrome-label-tracking: 0.1em;`／`--chrome-label-weight: 400;`（font-family は既存 `--chrome-font`）。
- **消費側を統一**: `ChromeButton .btn`（現 11px/0.10em/400 をトークン参照＝バイト同一）・`FilterPill .pill`＋`.label`＋`.count`・`TuneTrigger .trigger` を、この共通トークンで駆動。
- **ピルの harmonize（意図的変更・全テーマ）**: `.label` の bespoke（weight 500/size 12/tracking 0.04）を撤去してトークン参照へ。→ ピルがヘッダーボタンと同じ family/weight/size/tracking になり、**別書体に見えなくなる**。case は内容駆動のまま（`AllMarks` はタイトルケース、タグ名は小文字）。
- **連動の担保**: 以後どのテーマも `--chrome-*`（font/label-size/tracking/weight）を変えれば chrome 全ラベルが一緒に動く＝ずれない。
- **注記（不変条件の例外）**: この harmonize は**音を含む全テーマでピルの見た目を変える**（ユーザー要望＝全テーマで揃える）。音のバイト同一は「ピルのラベル字体を除いて」維持。他（ボタン/TUNE の字体）はトークン化しても計算結果同値。

## 4. 不変条件（死守）
- **音（dotted-notebook）**: スクランブル/グリッチの挙動バイト同一（スコープ追加は音で全一致）／カードアニメ不変／**例外＝ピル label 字体の harmonize（意図的・3-D）**。
- **紙・Grid**: グリッチ/スクランブルが消える（意図的・音 only signature）＋ピル字体 harmonize。その他は不変。s199 のフラット可読化・線修正は無改変。
- **フラット**: 下線(B)追加／グリッチ・スクランブル無し／ツイート翻訳=quiet／ピル=ボタンと同字体。
- `chromeMotion` は必須フィールド＝全テーマ宣言＝抜けゼロ。CSS グリッチのスコープ theme-id と `chromeMotion==='signature'` の集合が一致することをテストで固定。
- reduced-motion 既存ニュートライザは維持。Framer Motion 禁止（WAAPI/CSS のみ）。

## 5. テスト（抜けゼロの固定）
- e2e（`data-theme-id` 切替）:
  - 音: ボタン/ピル hover で glitch ゴースト（`::before` 可視）＝発火する。
  - フラット: ボタン hover で glitch 無し／**下線が出る**（`.btn:hover::after` の transform）。スクランブルは JS ゆえ e2e で厳密検証は難＝下記 unit で。
  - フラット: 絞り込みピル `.label` の computed font-weight/size/letter-spacing/font-family が `.btn` と一致。
- unit（vitest）: `getThemeMeta('flat').chromeMotion==='quiet'`／`getThemeMeta('dotted-notebook').chromeMotion==='signature'`／`getTextTransition('quiet')` が loadingClass=null（グリッチ無し）を返す／`useChromeScramble` が quiet テーマで display=素のラベル・タイマー無し（fake timers で wobble が起きない）。
- 既存: chrome-skin-tokens（音バイト同一）＋ flat-chrome-legibility（可読・線無し）が緑のまま。

## 6. 非対象（別回）
- Grid をフラットに統合（②）＝別タスク（本①で Grid は quiet 化するのみ・統合/移行は②）。
- 紙・Grid の"固有の署名アニメ"の作り込み＝サブ3。
- フラットの黒 text-stroke（`-webkit-text-stroke`）の明色最適化＝ピル/ボタン間では既に同値ゆえ本①の「揃える」対象外。必要なら別 polish。
