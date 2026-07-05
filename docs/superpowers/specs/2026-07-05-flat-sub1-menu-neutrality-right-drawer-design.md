# Design — フラット化 サブ①：テーマ境界の確定＋メニュー中立化＋右ドロワー統一（基盤リファクタ）

日付: 2026-07-05 / セッション 163
親 spec: [2026-07-05-flat-theme-and-theme-boundary-design.md](./2026-07-05-flat-theme-and-theme-boundary-design.md)（方向性・全体分解）
種別: サブ①の詳細 spec（構造リファクタ。見た目の新意匠は含まない）

---

## 1. 目的（このサブで何を達成するか）

これからテーマ（きせかえ）を増やす前提を整える。今は「テーマを選ぶと盤面だけでなくメニュー窓の見た目まで変わる」作りで、新テーマを足すたびにメニュー側の作り込みが要り、必ず“抜け”（未対応で崩れる箇所）が出る。そこで **テーマが乗る範囲を盤面だけに閉じ、メニューは全テーマ共通の中立 chrome に固定** する。同時に、盤面の大パネルの“出方”が現状4種バラバラなのを **右ドロワー1種に統一** する。

**このサブは「形だけ」= 構造の統一と、メニューからテーマ分岐を外すこと。中立メニューの新しい見た目（意匠）は決めない**。今日の時点ではメニューは現行 default（暗い）の見た目のまま凍結する。新意匠は白フラット盤面（サブ②）が出来てから別途決める。

### スコープ外（今回やらない）
- **`DEFAULT_THEME_ID` は変えない**（`dotted-notebook` のまま）。白フラットを default にするのはサブ②。→ 今日は「暗い盤面＋落ち着いた中立メニュー」で見た目が揃うため、①単独でもちぐはぐにならない。
- **中立メニューの新意匠**（フラットな明るい窓）＝サブ②の後。
- **カスタマイズ拡張（角丸 ON/OFF・N-35 つまみ）**＝サブ③。
- **音波テーマ命名・N-33 タグ表記**＝サブ④。
- **PiP 窓・保存トースト（SaveToast）の中立化**＝別窓/一過性のため今回は対象外（現行の paper テーマ表示のまま維持）。
- **N-27（左右マージンのスナップ）**＝別件。

---

## 2. 確定した決定（session 163 ユーザー合意）

### 2.1 出方の統一
- **右ドロワーに統一する（4つ）**：TUNE / SETTINGS / SHARE / テーマ選択（THEMES）。
  - モデル＝**現在の THEMES パネルと同じ“右側に浮かぶ細長い窓”**（盤面は後ろに見えたまま＝非ブロッキング）。ユーザー要望「テーマ選択と同じ感じ」。
- **今のまま・その場に出す（2つ）**：右上の絞り込み（`AllMarks · NNN`）ポップ／カードの **＋タグ** ポップ。
  - ＋タグはカードに重なって出るのが自然、絞り込みはボタン直下が自然、という理由でドロワー化しない。ただし **中立化はする**（下記 3.2）。
- **開き方の変更**：現在 TUNE と SETTINGS は「マウスを乗せると開く（hover, 700ms grace）」。**「クリックで開く」に統一**する（他の右ドロワーと同じ操作／誤爆減）。

### 2.2 メニュー中立化
- メニュー窓は **どのテーマでも同じ見た目**にする＝メニュー側のテーマ分岐（CSS の paper スコープ・テーマトークン参照・JS の `useIsPaperTheme` 分岐）を **除去** する。
- 除去後の見た目＝**現行 default（暗い）メニューの姿がそのまま中立の基準**になる（新意匠は作らない）。
- 結果：**paper-atelier テーマのメニューは中立へ戻る**（parchment 化が外れる）。これは親 spec で合意済みの意図的変更。

### 2.3 byte-identical 不変条件の更新（重要）
- 従来の「default 盤面 byte-identical」は **盤面（背景/パターン・カード・メーター・モーション・明暗）に限定して継続** する。
- **メニューは全テーマで中立化するため byte-identical でなくなる**（合意済みの意図的変更）。
- 検証時は「盤面は従来と一致」「メニューは意図的に中立へ変化」を区別して確認する。

---

## 3. テーマ境界の定義（何がテーマで変わり、何が変わらないか）

親 spec のとおり、**テーマが変えてよいのは盤面の5項目だけ**：

| # | 盤面項目 | 実体（触ってよい＝テーマ可変のまま維持） |
|---|---------|------------------------------------------|
| 1 | 背景/パターン | `backgroundClassName` ＋背景ワードマーク（`BoardBackgroundTypography`）＋ paper 背景 fiber/stain |
| 2 | カード | `CardNode` / `CardSlideshow` のカード見た目・paper カード装飾（`decorations/`） |
| 3 | スクロールメーター | `scrollMeterVariant`（waveform / ruler）＝ `ScrollMeter` / `scrollmeter/RulerTrack` |
| 4 | カードのモーション | `motion.entry/text/shutdown` |
| 5 | 明暗 | `colorScheme`（`isLightColor` による文字コントラスト確保は共通機構として維持） |

paper 専用の盤面装飾（`chrome/PaperFramePlate`＝額縁プレート、`chrome/PaperWaxSeal`＝封蝋）は **盤面の飾り**なので維持（メニュー非関与）。

### 3.1 中立化する“メニュー/chrome”面（テーマ分岐を除去する対象）

現状調査（実コード）で確定した、テーマ分岐が埋め込まれている面：

- **右ドロワー化する4つ**
  - TUNE：`components/board/TuneTrigger.tsx` / `TuneTrigger.module.css`（paper スコープ `:337-423`、JS 分岐 `TuneTrigger.tsx:153`）
  - SETTINGS：`components/board/ExtensionEntry.tsx` / `ExtensionEntry.module.css`（paper スコープ `:388-503`）
  - THEMES：`components/board/ThemeModal.module.css`（`:138-173`）＋ `ThemePicker.module.css`（`:56-68`）＋ `ThemeCustomizeSection.module.css`（`:166-173`）＋ `TunePresetColumn.module.css`（`:261-299`）
  - SHARE：`components/share/SenderShareModal.*`（現状は中央モーダル／paper トークンは主に共通トークン経由）
- **その場ポップのまま中立化する2つ**
  - 絞り込み：`components/board/FilterPill.tsx` / `FilterPill.module.css`（paper スコープ `:508-649`、JS 分岐 `FilterPill.tsx:155`）
  - ＋タグ：`components/board/TagAddPopover/TagAddPopover.module.css`（paper スコープ `:119-161`）
- **ヘッダのトリガー/表示系（メニューに準じる chrome）**
  - `components/board/ChromeButton.module.css`（paper スコープ `:84-169`、`ChromeButton.tsx:45,49-50` の paper 分岐）
  - `components/board/LanguageSwitcher.module.css`（paper スコープ `:171-206`）
  - `components/board/TopHeader.module.css`（paper 専用の手書きインク罫線 `:68-103`）

### 3.2 中立化しない（テーマ可変のまま維持する）面
- `ScrollMeter.module.css` / `scrollmeter/RulerTrack`（メーター＝盤面項目3）。**メーターの読みやすさトークン（counter の文字色等）は盤面側として維持**。
- `CardNode.module.css` / `CardSlideshow.module.css`（カード＝盤面項目2）。
- `BoardBackgroundTypography.module.css`（背景ワードマーク＝盤面項目1）。
- `chrome/PaperFramePlate` / `chrome/PaperWaxSeal`（盤面装飾）。
- globals.css の paper 盤面トークン（fiber/wordmark/plate/wax 等）。

### 3.3 フォントの注意点（実装の落とし穴）
paper は `app/globals.css:578` で `--font-sans` を serif(Fraunces) に上書きしており、これは **portal される UI 全体（メニュー含む）に波及**する。メニューから paper スコープの serif 指定を消しても、**`--font-sans` 経由で serif を継承したまま**になる。よって **中立メニュー（右ドロワー＋2ポップ）は自前で中立タイポ(mono/現行 default のフォント)を明示指定し、`--font-sans` を継承しない**こと。`--font-sans` の serif 上書き自体は paper のカード/背景の identity なので **globals では残す**。

### 3.4 デッドになるトークンの扱い
`--paper-panel-*`（`app/globals.css:523-529`）はメニューから参照が消えると盤面では未使用になるが、**PiP（`PipStack.module.css`）と SaveToast（`SaveToast.module.css`）がまだ参照している**。よって **トークン定義は削除しない**（PiP/SaveToast は今回スコープ外）。メニュー側の参照だけを外す。

---

## 4. 右ドロワーの設計（統一の中身）

### 4.1 共通ドロワー基盤
現状 THEMES（`ThemeModal`）が唯一の“右ドック浮遊パネル”（`overlay{position:fixed;inset:0;pointer-events:none;justify-content:flex-end}` ＋ `panel{width:400px;margin:12px}` ＋ `@keyframes panelIn{translateX(16px)→0}`）。これを **共通のドロワー基盤コンポーネント**として切り出し、TUNE / SETTINGS / SHARE / THEMES の中身を流し込む。

- **出方**：右端に浮かぶ幅 ~400px の非ブロッキングパネル（盤面は後ろで見えたまま・操作可）。`translateX` の右スライドで登場。
- **開閉**：トリガーボタンの **クリックで開く**。閉じるは 閉じるボタン / 盤面クリック(外側) / Esc。
- **同時に1枚だけ**：あるドロワーを開くと他は閉じる（`activeDrawer` 状態を BoardRoot に一本化）。
- **中立サーフェス**：背景・薄罫・影・タイポを **1箇所（共通ドロワー）で定義**し、現行 default メニューの見た目を基準にする。各パネルの個別テーマ上書きは撤去。

### 4.2 各パネルの移行メモ
- **THEMES**：ほぼ現行のまま基盤へ吸収（既に右ドック）。
- **SETTINGS**：現在は body portal ＋下アコーディオン＋JS 実測アンカー（`ExtensionEntry.tsx:184-200`）。右ドロワー基盤に載せ替え、JS アンカー計測は不要化。hover→click。
- **TUNE**：現在はヘッダ内 absolute の下アコーディオン＋hover。右ドロワー化＋click。W/G フェーダー等の中身ロジックは維持。
- **SHARE**：現在は中央ブロッキングモーダル（backdrop blur）。右ドロワー（非ブロッキング）へ。内容（720px 幅想定）は ~400px 幅へリフロー。**SELECT CARDS 選択モード（s157）とはむしろ相性良い**（盤面が見えたまま選べる。下部バー `ShareSelectBar` は独立の固定バーなので無変更）。

### 4.3 状態管理
BoardRoot が現在バラバラに持つ各パネルの open 状態（`shareModalOpen`、THEMES の `onOpenThemeModal`、TUNE/SETTINGS の内部 hover 状態）を、**単一の `activeDrawer: 'tune'|'settings'|'share'|'themes'|null` に集約**。トリガーボタンは `activeDrawer` をトグルするだけにする。

---

## 5. テスト・検証方針
- **共通ドロワー基盤**の開閉（クリック開／外側クリック・Esc 閉／同時1枚）を単体・インタラクションテスト。
- **盤面 byte-identical（限定）**：カード・背景・メーター・モーションが従来と一致することを確認（メニューは対象外＝意図的に変化）。
- **paper 盤面が無傷**：paper テーマで盤面（背景 fiber・カード装飾・ruler メーター・額縁/封蝋）が従来どおり出ること。**メニューだけ中立**になることを確認。
- **フォント継承チェック**：paper テーマでメニューが serif を継承せず中立フォントで出ること（3.3）。
- e2e：`tests/e2e/board-theme.spec.ts` を右ドロワー統一後の DOM に合わせて更新。
- Playwright 実機（dev＋本番）で「4パネルが右から出る・2ポップは据え置き・paper のメニューが中立」を目視相当で計測してからデプロイ。

## 6. リスク / 留意
- SHARE を中央モーダル→右ドロワーにすると **幅リフロー**が要る（720→~400px）。中身の再レイアウトが必要。
- TUNE/SETTINGS の **hover→click 化**は操作感の変化（合意済み）。
- メニュー中立化は **byte-identical でなくなる**ため、レビュー時に「盤面は一致／メニューは意図変化」を明確に区別する。
- `--font-sans` serif 継承（3.3）と、共有トークンがメーター（盤面・維持）とヘッダ（中立化）で重複している点（`--chrome-text-*`）は、**盤面側の読みやすさを壊さないよう**トークンの棲み分けを実装時に確認する。

## 7. 分解（サブ①内のタスク粒度・plan で確定）
1. 共通ドロワー基盤コンポーネント（THEMES を土台に抽出）＋ `activeDrawer` 状態一本化。
2. TUNE を基盤へ載せ替え（click 化）。
3. SETTINGS を基盤へ載せ替え（portal/アンカー撤去・click 化）。
4. SHARE を基盤へ載せ替え（幅リフロー・選択モード整合）。
5. メニュー中立化：4ドロワー＋2ポップ＋ヘッダ chrome（ChromeButton/LanguageSwitcher/TopHeader）の paper スコープ・テーマトークン参照・`useIsPaperTheme` 分岐を除去。フォント継承を中立に固定。
6. 検証（盤面 byte-identical 限定・paper 盤面無傷・フォント・e2e 更新）。
