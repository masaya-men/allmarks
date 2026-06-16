# 保存直後のその場タグ付け 第2段（PiP）＋ ON/OFF トグル 設計

- 日付: 2026-06-16（セッション104）
- 状態: 設計確定（実装計画づくりへ）
- 前提: 第1段（拡張ホスト頁）完了・本番反映済み
- 関連: [第1段設計](./2026-06-16-quick-tag-on-save-design.md) / Pop Out（PiP）/ タグシステム / ボード SETTINGS 入口

## 背景・目的

第1段で「保存した瞬間、フローティングボタン（またはカーソルピル）の位置にタグ帯が出て、その場で既存タグを付けられる」体験を実装した。第2段は **Pop Out（PiP）を開いている場面** へ横展開する。

実機で判明した問題（user 観察）:
- PiP を開いた状態で保存すると、フローティングボタン位置のタグ帯と PiP 小窓が **重なって操作できない**。
- せっかくの **PiP のカード入場アニメが帯に隠れる**。

→ 「同じ場所に2つ出している」ことが原因。PiP が開いている時はタグ付けを **PiP のカード側に寄せる** ことで解消する。あわせて、機能全体の **ON/OFF トグル** を用意する（user 要望）。

## 確定した3つの決定

### ① ON/OFF トグル：本体に1つ、拡張へは相乗りで伝達。SETTINGS を本体内パネル化

- **真実の値は本体の IndexedDB `settings` 置き場に1つだけ持つ**（初期値 = ON）。`lib/storage/tag-order-mode.ts` と同じ「キー＋値レコード」方式。
- **PiP**（本体オリジン）はこの値を直接読む。
- **拡張（フローティングボタン／カーソルピルの帯）** には、`/save-iframe` の保存応答にこの値を相乗りさせて伝える（第1段で既に `tags` / `currentTagIds` / `themeTokens` を相乗りさせている経路に1フィールド追加）。OFF なら帯を出さない（＝第1段以前の素の保存合図だけに戻る）。
- **新しい同期の仕組みは足さない**：本体が単一の真実、拡張は保存のたびに最新値を受け取る。`chrome.storage` を真実にすると PiP（本体オリジン）が読めないので不可。本体 IDB が唯一正しい置き場。

**SETTINGS 入口を本体内の小さな設定パネルに変える**（現状は外部の拡張設定ページを開くだけ＝[components/board/ExtensionEntry.tsx](../../../components/board/ExtensionEntry.tsx) L79-84 の `allmarks:open-settings` postMessage）:

- パネル内に **「保存したらその場でタグ付け」トグル（ON/OFF）** を最初から表示。← 第2段の本命スイッチ。
- パネル下部に **「拡張機能の詳しい設定を開く」ボタン**（従来どおり外部の拡張 options ページへ。自動保存サイトの細かい設定など深い項目はそちらに残す）。
- **住み分け**：浅い・よく触るスイッチは本体パネル、深い設定は拡張 options ページ。将来「簡単な ON/OFF」が増えたらこのパネルにトグルを足す器にする。
- **スコープの線引き（やりすぎ防止）**：今回は「パネル化＋タグ付けトグル1個＋拡張設定への入口ボタン」まで。拡張の全設定を本体へ引っ越す大改装はしない（別途）。
- **見た目・アニメ（user 要望・厳守）**：パネルは **TUNE ドロワー／右上 AllMarks ホバーと同じアニメ・トンマナ・デザイン** に揃える（同 easing `cubic-bezier(0.16,1,0.3,1)`、同じガラス感・余白・タイポ）。新規の見た目言語を作らず既存 chrome の様式を踏襲する。

補足（不具合切り分け）: user が「拡張設定を開けなかった」のは、橋渡し自体は健全（[extension/content.js](../../../extension/content.js) L230 は `allmarks.app` も対象、[extension/background.js](../../../extension/background.js) L93 が `openOptionsPage()`、manifest に `options_page` あり）なので、**localhost で試したため**（localhost ではこの橋渡しが有効化されない）の可能性が高い。本番 allmarks.app で1度確認して切り分ける。

### ② PiP が開いている時は拡張の帯を出さない（衝突解消）

- 保存時に「PiP が開いている」と分かったら、**拡張側のタグ帯は出さない**。保存できた合図（フローティングボタンの緑フラッシュ）は残す。タグ付けは PiP カードに任せる。
- これは第1段の原則「タグ帯は “そのとき出ている方” にぶら下げる」（フローティングボタン と カーソルピルは排他）の自然な延長。PiP が開いている時は **PiP がその場所** になるだけで、フローが分岐するわけではない。
- **PiP 開閉の検知は既存の仕組みを使う**：`lib/board/pip-presence.ts`（`broadcastPipOpen/Closed` / `subscribePipPresence`）＋ `/save-iframe` が既に `pipActive` を把握し probe に応答している（[app/save-iframe/SaveIframeClient.tsx](../../../app/save-iframe/SaveIframeClient.tsx) L72-83, L109-121）。保存応答に `pipActive` を乗せ、拡張はそれが true の時に帯を抑止する。
  - 既存の `booklage:probe` / `booklage:probe:result`（`lib/utils/save-message.ts` に zod スキーマ `pipActive: z.boolean()` あり）の作りに沿う。

### ③ PiP カードのタグ付けUI（ムードボード風の「＋」）

PiP は本体（allmarks.app）自身が開く窓なので、拡張への供給が不要で **タグ一覧を直接扱える**（`getAllTags` / `addTagToBookmark` / `computeSuggestedEntries` 相当 / `postBookmarkUpdated` を本体オリジンでそのまま呼べる）。第1段で苦労したオリジン分離・色トークン相乗りは PiP では発生しない。

- **アクティブなカードの隅に小さな「＋」**（[components/pip/PipCard.tsx](../../../components/pip/PipCard.tsx) は現状表示専用なのでタグ操作を足す。アクティブ判定は [components/pip/PipStack.tsx](../../../components/pip/PipStack.tsx) の `activeIdx`）。
- 押すと **第1段と同じ TUNE風アコーディオンの小帯** が PiP 窓内にオーバーレイで出る（カードの上に重ねる）。合いそうな順のチップ数個＋`ALL`。
- **窓が約 256×256 と狭い** ため、ボードの `TagAddPopover`（おすすめ＋全タグ＋新規入力欄）はそのまま入らない。第1段で確立した「厳選チップ＋`ALL`展開」のコンパクト帯を踏襲。
- **新規タグ作成はしない**（既存タグから選ぶのみ）。第1段と体験を揃える＋窓が狭い。新規はボードで。
- チップ1タップで付与（緑✓）。`addTagToBookmark` → `postBookmarkUpdated(bookmarkId)` で開いているボードへ即反映（第1段の `bookmark-updated` 合図をそのまま使う。`lib/board/channel.ts`）。
- **おすすめ順の計算ロジックを共有する**：ボードの `computeSuggestedEntries`（[components/board/CardsLayer.tsx](../../../components/board/CardsLayer.tsx) L154-183、`HeuristicTagger` + `extractTypedCandidatesFromBookmark` をマージ・confidence ソート・上限5）は今 CardsLayer 内ローカル関数。PiP からも使うため **共有モジュールに切り出して両者から呼ぶ**（PiP・ボードで提案順が一致する）。

## 部品の分け方（単位と責務）

1. **設定値の読み書き（本体）** — `settings` 置き場に `quick-tag-on-save`（boolean, 既定 true）を読み書きする小モジュール（`tag-order-mode.ts` と同じ流儀）。
2. **SETTINGS パネル（本体・React）** — ExtensionEntry を「外部を開くだけ」から「本体内パネル」に拡張。トグル1個＋拡張設定への入口ボタン。見た目は TUNE/AllMarks ホバーと同様式。
3. **保存応答の相乗り拡張（save-iframe）** — `buildSavePayload` に `quickTagEnabled`（設定値）と `pipActive` を追加で返す。
4. **拡張の帯の抑止（拡張側）** — 保存応答の `quickTagEnabled === false` または `pipActive === true` の時、タグ帯を出さない（保存合図は残す）。
5. **PiP カードのタグ付け（本体・React）** — PipCard にアクティブ時の「＋」＋コンパクト帯。`getAllTags` / 共有 `computeSuggestedEntries` / `addTagToBookmark` / `postBookmarkUpdated` を直接利用。

## 状態・エラー処理

- 設定値が読めない時は **既定 ON** で振る舞う（degrade gracefully）。
- PiP のタグ0件（まだタグを作っていない）時は「＋」を出すが帯は「ALL（既存タグなし）」を空表示にしない＝帯を出さず、ボードで作るよう促す程度に留める（窓が狭いので最小限）。
- 既に付いているタグはチップに ✓ 済みで表示（第1段と同じ）。
- 重複保存（既存ブクマ）が PiP に来た時も、その既存カードにタグを足せる（第1段の方針と同じ）。

## テスト方針

- 設定モジュール：読み書き・既定値フォールバックの単体テスト（`tag-order-mode` と同様式）。
- save-iframe 相乗り：応答に `quickTagEnabled` / `pipActive` が乗ることの単体テスト。
- 共有 `computeSuggestedEntries`：切り出し後も従来と同じ提案順を返す回帰テスト（既存のボード側テストを壊さない）。
- PiP タグ付け：チップタップで `addTagToBookmark` + `postBookmarkUpdated` が呼ばれることの単体テスト。
- 拡張帯の抑止：`quickTagEnabled=false` / `pipActive=true` で帯を出さないロジックの単体テスト（`node --check` で構文確認も必須＝content.js/floating-button.js は vitest/tsc 対象外）。
- 実機（Playwright/本番 allmarks.app）で見た目・出る位置・アニメ・衝突解消を目視調整（数値は実機で詰める）。

## 第2段で “やらないこと”

- その場での **新規タグ作成** はしない（既存から選ぶのみ）。
- 拡張の全設定を本体パネルへ引っ越す大改装はしない（深い設定は拡張 options ページに残す）。
- 第3段（ブックマークレット／URL貼り付け #4#5）は次段。
- 見た目の最終数値（チップ寸法・「＋」位置・アニメ）はここで固定せず実機で調整。

## 守る前提（プロジェクト規約）

- `booklage:*` メッセージ型・`DB_NAME='booklage-db'` 等の不可視符号は維持。
- UI英語は globally-clear 語彙（`ALL` 等）。タグ色は既存の A緑 `#28F100` 系を踏襲。
- 拡張 manifest を変更したら version bump。i18n 文言を足すなら15言語同期。
- SETTINGS パネルの見た目は TUNE/AllMarks ホバーの既存様式に揃える（新規の見た目言語を作らない）。
- 拡張の content.js / floating-button.js は `node --check` で構文確認。
- 本番は allmarks.app（deploy は `--project-name=allmarks --branch=master`）。
