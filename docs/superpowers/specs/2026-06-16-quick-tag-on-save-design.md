# 保存直後のその場タグ付け（Quick-Tag on Save）設計

- 日付: 2026-06-16（セッション103）
- 状態: 設計確定（第1段の実装計画づくりへ）
- 関連: 拡張機能の保存経路 / タグシステム / Pop Out（PiP）/ ブックマークレット

## 背景・目的

現在、ブックマークは全5経路すべて「タグ無し（受信箱行き）」で無言保存され、タグ付けは保存の **後** にボードの「+TAG」かマネージ画面でやる二段構え。ユーザー要望は **「保存した瞬間に、その場でタグを付けられる」** こと。拡張ユーザーが第一優先、可能なら拡張なしユーザーにも広げたい。

データ保存層（`addBookmark`）は最初からタグを受け取れる作りで、storage 側の改修は最小。

## 操作モデル（確定）

「ワンクリック保存の軽さを壊さない」を最優先（モデル(1)）:

1. 保存ボタン/ショートカット/右クリック → **即保存**（今まで通り、タグ無しで受信箱）
2. 保存確認の表示の隣に **タグ帯** がスッと出る
3. チップを1タップ → そのタグが付く（緑✓）。複数タップ可
4. 末尾の **`ALL`** → 全タグの小パネルに展開、スクロールで全部から選べる
5. 何も触らず数秒 → フェードして受信箱のまま

中身は **(a) 既存タグを「このページに合いそうな順」で数個 ＋ 末尾に `ALL` 展開**。
**新規タグ作成はしない**（既存から選ぶのみ。新規は後でボードで）。

## その場タグ付けの全面マップ（surface map）

| # | 保存のしかた | 画面に出るもの | タグ帯の置き場所 | 技術的重さ | 段 |
|---|---|---|---|---|---|
| 1 | 拡張・フローティングボタン | 端のボタン（緑フラッシュ） | ボタンの内側に帯 | 中（タグ情報の供給要） | 第1段 |
| 2 | 拡張・ショートカット/右クリック/ボタンOFF | カーソルピル | ピルの隣に帯 | 中（#1と共通部品） | 第1段 |
| 3 | Pop Out（PiP）を開いている | 小窓に新カードが出る | カード上でタグ付け | 軽（本体の窓＝直接扱える） | 第2段 |
| 4 | ブックマークレット | Shadow DOM トースト | トーストに帯 | 中 | 第3段 |
| 5 | URL貼り付け（/save） | ポップアップ | ポップアップに帯 | 軽〜中 | 第3段 |

共通部品は「厳選チップ＋ALL展開」のタグ帯ひとつ。置き場所だけ各表示に合わせる（PiPだけはカード自体に付ける）。

### 作る順
**第1段：拡張ホスト頁（#1ボタン＋#2カーソルピル）** → **第2段：PiP（#3）** → **第3段：ブックマークレット＋貼り付け（#4#5）**。
本ドキュメントは **第1段** を確定設計とし、第2段・第3段は方針のみ記す。

## 第1段 設計（拡張ホスト頁）

### データの流れ：方式(A)「保存応答への相乗り」を採用

拡張はブラウザの origin 分離により、ホスト頁（例：X）の上でアプリ本体（allmarks.app）のタグ一覧を直接は読めない。

- **採用（A）保存の応答にタグ情報を相乗りさせる**
  保存処理は裏で offscreen（allmarks.app origin の隠し枠 = `/save-iframe`）を通って IndexedDB に書き込み、`bookmarkId` を返している（[app/save-iframe/SaveIframeClient.tsx](../../../app/save-iframe/SaveIframeClient.tsx) の `reply({ type: 'booklage:save:result', ... bookmarkId })`）。
  その **応答に「全タグ一覧 ＋ このページに合いそうな順（おすすめ）」も乗せて返す**。ホスト頁の帯はそれを表示するだけ。チップを押したら「このブクマにこのタグを足して」を同じ経路で offscreen に送り、本体で `addTagToBookmark` を実行。
- **不採用（B）タグ一覧を常時 `chrome.storage.local` に写す**
  保存前でも参照できる利点はあるが、今回は「保存後に出す」ので保存前参照は不要。同期ズレ管理が増えるだけで **過剰**。

採用理由：常時同期の「写し」を別途持たずに済む。保存のたびに最新のタグが届く。「合いそうな順」はアプリ本体側に既にある推測の仕組み（[lib/board/tag-candidates.ts](../../../lib/board/tag-candidates.ts) / [lib/tagger/heuristic.ts](../../../lib/tagger/heuristic.ts)）で **本体側で計算してから返す** ので、ホスト頁側で重い処理は走らない。

### 部品の分け方（単位と責務）

1. **タグ帯（共通部品・素のJS）** — `extension/` 配下に新規。チップ表示・`ALL`展開・タップ処理だけを担う。`extension/` の既存の素JS（フローティングボタン／カーソルピルと同じ流儀）で実装。ボタンにもカーソルピルにも同じ部品をぶら下げる。見た目は `--am-strip-*` CSS変数駆動（既定値内蔵）。
   - 入力：`{ bookmarkId, tags: [{id, name, color}], currentTagIds, themeTokens, anchor(出す場所/向き) }`
   - 出力（コールバック）：`onAddTag(bookmarkId, tagId)` / `onDismiss()`
2. **保存応答の拡張（offscreen / save 経路側）** — `bookmarkId` に加え「全タグ ＋ おすすめ順」＋「現在テーマの色トークン」を返す。`addTag` 要求を受けて本体に `addTagToBookmark` を書く。
3. **アンカー供給（ボタン側／ピル側）** — それぞれ「帯を出す座標と展開方向（端なら内側へ）」だけを共通部品に渡す。

### トンマナ＝テーマ追従（user 要望、2026-06-16 追加）
帯の見た目はAllMarksの現テーマに合わせ、将来のテーマ切替に自動追従させる。ただし帯はホスト頁（例：X）上の拡張DOMで、アプリ本体のCSS変数を直接読めない。

- **方式**：`/save-iframe`（アプリ本体オリジン）で `getComputedStyle(document.documentElement)` から**解決済みの色値**（背景 `--bg-dark` / 前景 `--text-primary` / 枠 `--color-card-border` / ぼかし `--glass-blur` ＋ ✓緑は意味的定数 `#28F100`）を読み、保存応答にタグと一緒に相乗りさせて返す（[app/globals.css](../../../app/globals.css) `:root`）。
- **帯側**：CSSは `--am-strip-*` 変数駆動（既定値＝ダーク）。受け取ったトークンを帯要素の inline style で上書き。`color-mix` で半透明化（Chrome ≥124、manifest `minimum_chrome_version`）。
- **なぜ追従するか**：「どのテーマか」を判定せず**実際に解決された値**を読むので、色テーマ切替が将来実装された時に読み出す値が変わるだけで帯も自動で変わる。
- **現状**：色テーマ切替UIは未配線（[app/layout.tsx](../../../app/layout.tsx) で `data-theme="dark"` 固定）＝今はダーク既定が流れる。切替実装時は `/save-iframe` がアクティブテーマを適用してから読む小フォロー 1 つで完成。
- 注：[lib/board/board-config.ts](../../../lib/board/board-config.ts) の `BoardConfig.themeId`（dotted/grid）はスクロール方向・レイアウト用で**色とは別軸**。色は globals.css の CSS変数。

### 既存資産の流用
- storage：`addBookmark`（[lib/storage/indexeddb.ts](../../../lib/storage/indexeddb.ts) L826）はタグ受け入れ済 / `addTagToBookmark`・`getAllTags`（[lib/storage/tags.ts](../../../lib/storage/tags.ts)）をそのまま使用。
- 推測：`HeuristicTagger` / `tag-candidates` をボードと同じ流儀で offscreen 側から呼ぶ（ボードの `computeSuggestedEntries` 相当を save 経路で再利用）。
- 確認表示：フローティングボタン状態機械（[extension/lib/floating-button-state.js](../../../extension/lib/floating-button-state.js)）／カーソルピル（[extension/lib/pill-state-machine.js](../../../extension/lib/pill-state-machine.js)）は排他（[extension/lib/dispatch.js](../../../extension/lib/dispatch.js) L82）。帯は「そのとき出ている方」にぶら下げる。

### 状態・エラー処理
- 保存自体は従来通り先に確定。帯のタグ付けは保存成功後にのみ表示。
- 保存が `error` 状態のときは帯を出さない（タグ付け対象が無い）。
- offscreen 応答が来ない／タグ0件のときは帯を出さず、従来の確認表示だけで終わる（degrade gracefully）。
- 重複保存でスキップ（既存ブクマ）の場合も、その既存 `bookmarkId` に対して帯を出す（= 再保存は「整理したい」合図のことが多く、その場で既存ブクマにタグを足せると有用）。帯には既に付いているタグを ✓ 済みで表示する。

### テスト方針
- タグ帯の素JS：状態（表示/ALL展開/タップで✓/dismiss）の純粋ロジックを単体テスト（既存 `floating-button-state` / `pill-state-machine` と同じ流儀）。
- save 応答の相乗り：offscreen handler がタグ一覧＋おすすめ順を返すこと、`addTag` 要求で `addTagToBookmark` が呼ばれることを単体テスト。
- 実機（Playwright/本番）で見た目・出る位置・アニメを目視調整（数値は実機で詰める）。

### 第1段で“やらないこと”
- その場での **新規タグ作成はしない**（既存から選ぶのみ）。
- PiP（#3）・ブックマークレット/貼り付け（#4#5）は第2段・第3段。
- 見た目の最終数値（チップ寸法・色・アニメ・正確な位置）はここでは固定せず、実機で調整。

## 第2段・第3段（方針のみ）

- **第2段 PiP（#3）**：PiP は本体（allmarks.app）自身が開く窓で、タグ一覧を直接扱える（拡張への供給が不要）。新カードに第1段と同じ「厳選チップ＋ALL」を付ける。[components/pip/PipCard.tsx](../../../components/pip/PipCard.tsx) は現状表示専用なのでタグ操作を足す。BroadcastChannel 経由でボードへ書き戻し。
- **第3段 #4#5**：ブックマークレットの Shadow DOM トースト／`/save` ポップアップに同じ帯を横展開。`/save-iframe` は既に応答に必要情報を持つので相乗り方式をそのまま使える。

## 守る前提（プロジェクト規約）
- `booklage:*` メッセージ型・`DB_NAME='booklage-db'` 等の不可視符号は維持。
- UI英語は globally-clear 語彙（`ALL` 等）。新規タグ色は既存のA緑 `#28F100` 系を踏襲。
- 拡張 manifest は変更時に version bump。i18n 文言を足すなら15言語同期。
