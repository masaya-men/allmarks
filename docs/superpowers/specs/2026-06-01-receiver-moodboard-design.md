# 受け取り画面リデザイン — 「SHARED WITH YOU」ムードボード設計

**日付**: 2026-06-01 (session 97)
**対象**: 共有リンクを開いた受け取り側の画面 (`/s/<id>`)
**状態**: brainstorming 合意済み → 本 spec を user レビュー後、実装計画 (writing-plans) へ

---

## 1. 目的とひとことサマリ

共有リンクを開いた人に、**送り主のテーマのまま、本物のムードボードとして**コレクションを見せる。
取り込み専用の素朴な UI は廃止。受け取った人は、見て楽しみながら「要るカードだけ」を選んで自分のボードに取り込む。

ひとこと: **「取り込まずに、本物のボードとして見せる。SAVE を押した時に初めて、選んだ分だけ取り込む。」**

---

## 2. 確定した設計判断 (brainstorming の結論)

| # | 判断 | 理由 |
|---|------|------|
| D1 | **取り込み専用 UI (1枚ずつの ReceiverTriage) を廃止** | 画面を1つに。本物のボードを見せる方がブランド (表現ツール) に合う |
| D2 | **開いても裏で取り込まない**。SAVE で初めて取り込む | リンクを開いただけでライブラリを汚さない (同意の前に書き込まない)。一時フラグ/後片付けの複雑さも回避 |
| D3 | **送り主のテーマで表示** (受け取った人が既存ユーザーでも、取り込むまでは送り主テーマ) | 送り主の世界観を尊重 + テーマの周知。ルールが1本化され実装もシンプル |
| D4 | **本物のムードボード挙動** = 静止画スライドショー + ヒーロー1本の実再生あり (= MOTION ON のボードそのまま) | CardsLayer をそのまま使うので無料で手に入る |
| D5 | **タグのオンオフはムードボード上**。カードにホバーで送り主タグが上に出て、クリックで ON。**既定は全て OFF** | 他人のタグで自分のボードが汚れるのを避ける (user 判断)。操作はぱっと見でその場で |
| D6 | **取り込み/除外もカードにホバーで出るトグル**。既定は「取り込む」。外すとカードがグレーアウト | 視覚的に分かりやすい。大半 (だいたい全部要る) が最小操作で済む |
| D7 | **既に自分が持っているカードは最初からグレーアウト + `ALREADY SAVED` リボン**、取り込み対象から自動除外 | 重複を防ぐ。[findDuplicates](../../../lib/share/import.ts) を流用 |
| D8 | 左上に**テーマに合わせた `SAVE 15 / 57` ボタン** (選んだ数 / 全体) | 一目で「何件取り込むか」分かる |

### 文言 (世界共通の伝わる英語)

- 背景タイポ (大): **`SHARED WITH YOU`** ('FOR YOU' は "アルゴリズムのおすすめ" 連想が少しあるので不採用)
- 取り込みボタン (左上): **`SAVE 15 / 57`** 形式
- 既保存リボン: **`ALREADY SAVED`**
- 取り込み完了の知らせ: 既存の [BulkImportToast](../../../components/share/BulkImportToast.tsx) (`N CARDS SAVED · M ALREADY SAVED`) を流用

---

## 3. なぜ大改修にならないか (アーキ確認・コードで実証済み)

- **描画の中核 [CardsLayer](../../../components/board/CardsLayer.tsx) は `items` を渡す prop 方式**。内部で IndexedDB を読んでいない。
  - 決定的証拠: [CardsLayer.tsx:261-264](../../../components/board/CardsLayer.tsx#L261-L264) のコメントに「**the share-view caller** がスクロール無しなら省略できるよう optional にしてある」=**もともと共有表示からの再利用を想定して prop 駆動に作られている**。
- カードの種別振り分け [pickCard(item: BoardItem)](../../../components/board/cards/index.ts#L39)、[Lightbox](../../../components/board/Lightbox.tsx) も `item` prop 駆動 (Lightbox には [LightboxItem→BoardItem 詰め直しヘルパー](../../../components/board/Lightbox.tsx#L1816) が既にある)。
- 背景タイポ [BoardBackgroundTypography](../../../components/board/BoardBackgroundTypography.tsx) も props 駆動で、見出し文字を渡すだけ。

### 「生きている」挙動の在りか → CardsLayer 再利用が必須 (A案)

[CardsLayer.tsx:1014-1065](../../../components/board/CardsLayer.tsx#L1014-L1065) で確認: ヒーロー1本の実再生 (`playing` 集合 + InlineMediaPlayer) と静止画スライドショー (`candidates` + CardSlideshow) は**カード部品ではなく CardsLayer がカードの上に重ねて駆動**している。カード部品 (pickCard → VideoThumbCard 等) は静止画だけ。
→ 生きた挙動 (D4) を得るには **CardsLayer をそのまま使うしかない** (pickCard だけ流用する案だと Tier1/スライドショーが死ぬ)。
→ 受け取り用オーバーレイ (取り込みトグル・送り主タグ chip・グレーアウト・リボン) は **CardsLayer に「受け取りモード」optional props を足し、per-card ラッパー内 (既存の再生オーバーレイ群と同じ場所) に重ねる**。編集系の affordance (リサイズ・×削除・並び替え・ボードのタグピル) は受け取りモードで無効化。CardsLayer は元々 share-view 再利用を想定して prop 駆動。

### ⚠️ テーマの実態 (確認結果・brainstorming の前提を訂正)

- 共有データ [ShareDataV2.theme](../../../lib/share/types-v2.ts#L54) は存在するが**値が `'wave'` のリテラルで、実際の [ThemeId](../../../lib/board/types.ts#L3) (`'dotted-notebook' | 'grid-paper'`) と一致していない**。送り主テーマを正しく運ぶには `theme` を `ThemeId` を運ぶ形に直す小変更が要る (= brainstorming で「スキーマ追加不要」と言ったのは不正確だった)。
- さらに **ボードはテーマ切り替えを未実装** ([BoardRoot.tsx:591](../../../components/board/BoardRoot.tsx#L591) は `getThemeMeta(DEFAULT_THEME_ID)` でハードコード)。テーマは現状デフォルト1種のみ。
- 結論: **D3「送り主テーマで表示」は今は見た目が変わらない (将来テーマが増えた時のための配管)**。themeId を共有に載せ、受け取り側はボードと同じやり方で適用するに留める (ボードが持たないテーマ適用機構は作らない = 過剰実装回避)。

→ 受け取り画面は「`ShareCardV2` を `BoardItem` 形に変換して、CardsLayer (受け取りモード) + Lightbox に流す」作業。今の [ReceiverLanding](../../../components/share/ReceiverLanding.tsx) が既に簡易カードで masonry を描いているので、それを**本物のカード (CardsLayer) に差し替え、選択用の見せ方を足す**。

---

## 4. 画面の流れ

```
リンクを開く (/s/<id>)
   ↓
共有データ取得 (fetchShare) → sanitize (sanitizeShareDataV2)
   ↓
送り主テーマを適用 + 自分の既存ブクマ URL を取得 (重複判定用)
   ↓
本物のムードボード表示 (CardsLayer, motion ON, 背景 "SHARED WITH YOU")
   ・各カード = 既定で「取り込む」(選択 ON)
   ・既に持っているカード = グレーアウト + ALREADY SAVED リボン + 選択不可
   ・ホバー → 「取り込む/外す」トグル + 送り主タグ chip (既定 OFF)
   ・クリック → Lightbox (詳細閲覧。タグはここでも確認可)
   ↓
左上 "SAVE 15 / 57" を押す
   ↓
選択 ON のカードだけ addBookmark (ON にした送り主タグだけ付与、tag は convertSenderTagsForReceiver で自分のタグに変換/マージ)
   ↓
自分のボード (/board) へ移動 + BulkImportToast で件数表示
```

---

## 5. 構成要素 (再利用 / 新規 / 廃止)

### 再利用 (本物のボード資産)
- [CardsLayer](../../../components/board/CardsLayer.tsx) — `items` (BoardItem[]) + `viewport` + `motionEnabled` 等を渡す。スクロール系 callback は省略可 (共有表示前提の optional)。
- [Lightbox](../../../components/board/Lightbox.tsx) — 詳細表示・再生。
- [pickCard / cards/*](../../../components/board/cards/index.ts) — カード種別描画。
- [BoardBackgroundTypography](../../../components/board/BoardBackgroundTypography.tsx) — 背景タイポ (見出し = `SHARED WITH YOU`)。
- テーマ適用の仕組み (theme-registry / `themeId`) — 送り主の `share.theme` を適用。
- [findDuplicates](../../../lib/share/import.ts) / [convertSenderTagsForReceiver](../../../lib/share/import.ts) — 重複判定 / タグ変換。
- [BulkImportToast](../../../components/share/BulkImportToast.tsx) — 完了通知。

### 新規
- **`ShareCardV2 → BoardItem` 変換 (純関数)** — `url=u, title=t, description=d, thumbnail=th, type=ty, 幅/比=cw/a`。`bookmarkId` は url から決まる合成 id。`tags` は初期は空 (送り主タグは「割り当て済み」ではなく「選択候補」のため、ローカル選択状態で別管理)。単体テスト対象。
- **受け取り画面コンポーネント** (= [ReceiverLanding](../../../components/share/ReceiverLanding.tsx) を作り替え or 新規 `SharedBoard`) — CardsLayer を host し、以下の**一時状態 (DB は触らない)** を管理:
  - 取り込む/外す の選択 (既定: 重複でないカードは全て ON、重複は除外)
  - per-card で ON にした送り主タグ ID の集合
- **選択用 chrome** — カードホバーで出す「取り込む/外す」トグル + 送り主タグ chip。OFF カードのグレーアウト。既保存カードの `ALREADY SAVED` リボン (= DEAD LINKS バッジと同系統の角リボン手法)。
- **左上 `SAVE N / M` ボタン** — テーマ配色。押下で取り込み実行。

### 廃止
- [ReceiverTriage](../../../components/share/ReceiverTriage.tsx) + `ReceiverTriage.module.css` + `ReceiverTriage.test.tsx`
- [ShareEntry](../../../app/(app)/s/ShareEntry.tsx) の landing/triage 分岐 → 常に新受け取り画面を出す (triage import 削除)
- 旧 [ReceiverLanding](../../../components/share/ReceiverLanding.tsx) の簡易カード masonry・footer 2 ボタン (IMPORT ALL / PICK ONE BY ONE)

---

## 6. データの扱い

- **読み取りのみ (取り込み前)**: 共有データ + 自分の既存ブクマ URL (重複判定)。IndexedDB へは**一切書かない**。
- **選択状態**: すべて受け取り画面のローカル state。
  - 取り込む集合: `Set<cardId>` (既定 = 重複以外全部)
  - per-card タグ選択: `Map<cardId, Set<senderTagId>>` (既定 = 空)
- **SAVE 押下時のみ書く**: 選択 ON の各カードを `addBookmark`。タグは [convertSenderTagsForReceiver](../../../lib/share/import.ts) で自分のタグへ変換 (同名は自分の既存タグにマージ、無ければ作成)。
- **テーマ**: 受け取り画面は `share.theme` を適用。取り込んだカードは自分のボードに入るので、以後は自分のテーマで表示される (取り込み = 世界観の境界)。

---

## 7. 共有を作る側 (送信側) で必要な小変更

- 共有スキーマ [types-v2.ts](../../../lib/share/types-v2.ts#L54) の `theme?: 'wave'` を **`theme?: ThemeId`** に変更 (実際のテーマ値を運べるように)。[validate-v2](../../../lib/share/validate-v2.ts) の sanitize も `ThemeId` 集合で検証。
- 共有作成 ([board-to-share.ts:89](../../../lib/share/board-to-share.ts#L89) の `theme: 'wave'` ハードコード) を、**送り主の `BoardConfig.themeId`** を載せる形に変更。
- 受け取り側は `share.theme` が未設定 or 不正なら `DEFAULT_THEME_ID` でフォールバック (後方互換: R2 移行前の旧共有 + 旧 `'wave'` 値も壊れない)。
- 適用はボードと同じ範囲に留める (ボードは現状ハードコード default なので、受け取り側も「themeId を保持しつつ、表示はボードの仕組みに従う」= 今は見た目差なし、将来テーマ実装で自動的に効く)。

---

## 8. テスト方針

- **純関数 (vitest)**: `ShareCardV2 → BoardItem` 変換 / 取り込み選択の初期値 (重複除外) / per-card タグ選択 → `convertSenderTagsForReceiver` への受け渡し。
- **実機 (Playwright)**: 受け取り画面が本物カードで描画されること / ホバーでトグル・タグ chip が出ること / OFF でグレーアウト / 既保存カードのリボン + 除外 / `SAVE N/M` のカウントが選択に追従 / SAVE 後にボード遷移 + toast。
- **後方互換**: `theme` 未設定の旧共有が default テーマで開けること。

---

## 9. 性能の歯止め

- 本物のボードと同じ挙動 (= 既存のボードの性能特性そのまま)。新たな再生機構は足さない。
- 100 枚上限 ([SHARE_LIMITS_V2.MAX_CARDS](../../../lib/share/types-v2.ts#L84)) は既存どおり。大量時の重さはボード本体の virtualization 課題 (別 backlog) と同根なので、本機能では新たな対策は入れない (= ボードと同じ土俵)。

---

## 10. やらないこと (スコープ外)

- ボード本体 (BoardRoot) のリファクタ (= CardsLayer は既に prop 駆動なので不要)
- 1枚ずつ送り主タグを大量に付ける導線 (= タグ既定 OFF の方針上、ぱっと見の任意 ON のみ)
- 送り主名の表示 (= 個人情報を持たない設計のため、共有データに名前を載せない)
- テーマの新規追加 (= 既存の theme 仕組みに乗るだけ)
