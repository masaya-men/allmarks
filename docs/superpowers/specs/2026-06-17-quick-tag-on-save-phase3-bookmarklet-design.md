# 保存直後タグ付け 第3段(ブックマークレット)設計

> 作成: 2026-06-17 (session 105) / brainstorming 合意済
> 関連: 第1段 `2026-06-16-quick-tag-on-save-design.md`(拡張ホスト頁) / 第2段 `2026-06-16-quick-tag-on-save-phase2-pip-design.md`(PiP)

## 1. 目的とスコープ

保存直後タグ付けを、**拡張機能を入れていないユーザーがブックマークレットで保存する経路**にも広げる。第1段(拡張ホスト頁)・第2段(PiP)に続く最後の保存経路。

### 対象(やること)
- `/save` ポップアップ窓(`components/bookmarklet/SaveToast.tsx`)に、保存直後のタグ付けUIを追加する。

### 非対象(やらないこと — 明確化)
- **カーソルピルは一切いじらない**(拡張専用、`extension/` 配下)。第3段はカーソルピルと無関係。
- 元ページの Shadow DOM トースト(ブックマークレット IIFE が出す右上の「保存しました ✓」)はいじらない。
- ブックマークレット本体(`lib/utils/bookmarklet.ts` の IIFE)のロジックは原則いじらない。例外は §6 の `resizable` 許可のみ。
- 拡張あり経路(第1段)は不変。拡張ありのブックマークレットは拡張に丸投げするので既にタグ帯が出る。
- 「拡張なしでもカーソルピルを出す」案は**別タスク**(`docs/private/IDEAS.md` に記録済、保留)。

## 2. 前提となる事実(調査で確認済)

- 拡張なしのブックマークレットは `window.open('<APP>/save?...', 'booklage-save', 'width=200,height=160,...resizable=0...')` で小窓を開く。中身は `SaveToast`。([lib/utils/bookmarklet.ts](../../../lib/utils/bookmarklet.ts) `BOOKMARKLET_SOURCE`)
- `SaveToast` は `addBookmark` で IndexedDB に保存 → `postBookmarkSaved` を放送 → **80ms で `window.close()`**。([SaveToast.tsx](../../../components/bookmarklet/SaveToast.tsx))
- この窓は **AllMarks 自身の origin** なので IndexedDB・タグ操作・BroadcastChannel が全て使える(第一者パーティション)。元ページ(よその origin)からは AllMarks のデータを触れないため、タグ付けはこの窓の中でしか成立しない。
- タグメニュー `TagAddPopover` は **`compact` モード**(狭い場所向け、PiP 用に作成済)を持つ。([components/board/TagAddPopover/index.tsx](../../../components/board/TagAddPopover/index.tsx))
- PiP のタグ付け handler 構成(流用元、[PipCompanion.tsx](../../../components/pip/PipCompanion.tsx)):
  - データ: `getAllBookmarks` + `getAllTags` + `orderTagsForSave(bm, corpus, tags)` → `allTags` / `currentTagIds` / `suggestedEntries`(関連順の既存タグを上位5件)。
  - 既存タグ付与: `addTagToBookmark(db, bookmarkId, tagId)` → `postBookmarkUpdated({ bookmarkId })`。
  - 新規タグ: 同名検索 → 無ければ `addTag(db, { name, color: '#28F100', order })` → `addTagToBookmark` → `postBookmarkUpdated`。
- ON/OFF トグルの真実値: `loadQuickTagEnabled(db)`(本体 IDB settings `quick-tag-on-save`、既定 ON)。([lib/storage/quick-tag-setting.ts](../../../lib/storage/quick-tag-setting.ts))
- PiP 開閉の検知: `queryPipPresence(timeoutMs)`(BroadcastChannel 経由、別窓からでも同 origin なので届く)。([lib/board/pip-presence.ts](../../../lib/board/pip-presence.ts))

## 3. 振る舞い(`/save` 窓の新しい分岐)

保存(IDB 書き込み)成功後、以下を判定する。全て「拡張なしのブックマークレット経路」での話。

| 条件 | 窓の挙動 |
|------|---------|
| `quickTagEnabled` が **OFF** | 今まで通り 80ms で閉じる(変更なし) |
| `quickTagEnabled` ON かつ **本物の PiP が開いている**(`queryPipPresence` が true) | 80ms で閉じる。保存カードは開いている PiP に `postBookmarkSaved` 経由で流れ込むので、タグはそこで付ける。窓を出すと二重になるため出さない |
| `quickTagEnabled` ON かつ **PiP なし**(大多数) | 窓を閉じず、**タグ付けUIに変身**(下記 §4) |

- 判定順は「保存成功 → `quickTagEnabled` 読む → ON なら `queryPipPresence` → 分岐」。
- 保存失敗(`error`)は現状維持(エラートースト後に閉じる)。

## 4. タグ付けUI(PiP なしのときに窓が変身)

- **世界観は PiP / ボードと同一**(黒・ガラス・音波テーマ)。窓の背景・枠もそれに合わせる。
- **中身はタグだけ**。`TagAddPopover` を `compact` で窓いっぱいに描画(SUGGESTED 行 + ALL TAGS + 新規タグ入力欄)。カード・メーター・題名は出さない(user 確定)。
- データは PiP と同じ作り方: `getAllBookmarks` + `getAllTags` + `orderTagsForSave` → `allTags` / `currentTagIds` / `suggestedEntries`(上位5)。
- タップで付与 → その場で `addTagToBookmark` → `postBookmarkUpdated({ bookmarkId })` で**開いているボードに即反映**。新規タグも同様(`addTag(#28F100)` → 紐付け → 通知)。
- 通信の往復は不要(窓自身が AllMarks origin で IDB を直接書ける)。

### 共通化(design for isolation)
PiP と `/save` で **付与 handler(既存付与・新規作成)が同一ロジック**になる。重複を避けるため、付与ロジックを純粋な小ヘルパー/フックに抽出して両者で共有する(例: `lib/tagger/apply-quick-tag.ts` 的なもの、`{ addExisting, addNew }`)。抽出が過剰になる場合は最小限の共有関数に留める(YAGNI)。

## 5. 窓のライフサイクル(閉じ方)

user 確定の挙動:

- **触らなければ数秒(暫定 5s)で自動的に閉じる**(タグ付けしたくない人の邪魔をしない)。
- **マウスを乗せる / 入力欄にフォーカス / 文字入力を始めたら、自動クローズのタイマーを止める**(タグ付け中に消えない)。
- **一度でも触った後、マウスが窓から離れたら**(`mouseleave` / `blur`)、猶予の後に自動的に閉じる。
- **✕ 閉じるボタン**を常設。押せば即閉じる。
- これらは第1段のタグ帯「触ったら閉じない」考え方と同じで、世界観も揃う。

## 6. 窓のサイズ(`window.resizeTo`)

- ブックマークレットは 200×160 で開く。タグUIには狭いので、**変身時に `SaveToast` 自身が `window.resizeTo` で広げる**(暫定 横280×縦360、後で実機を見て微調整)。
- `resizable=0` で開いているため `resizeTo` がブラウザに無視される可能性がある。**実装時に実機(本番)で必ず検証**する。無視される場合の対処:
  - `BOOKMARKLET_SOURCE` の `resizable=0` → `resizable=1` に変更(これだけは IIFE をいじる)。**公開前なので installed-base への影響は実質ゼロ**(開発者が再取得するだけ)。`booklage-save` 窓名・`booklage:*` 等の不可視符号は維持。
- 窓が画面端で広がると見切れる可能性 → 必要なら `moveTo` も併用(polish、実機判断)。

## 7. テーマ/CSS

- `/save` 窓でも `globals.css` の `:root` 変数が読めるので、`TagAddPopover` の見た目はテーマ追従する。窓の地の背景を黒+ガラスに整える(`SaveToast.module.css` 側で対応)。

## 8. 影響範囲とファイル

- 主: [components/bookmarklet/SaveToast.tsx](../../../components/bookmarklet/SaveToast.tsx)(分岐追加・タグUI描画・ライフサイクル)+ `SaveToast.module.css`(タグモードの地のスタイル)。
- 流用: `TagAddPopover`(compact)、`orderTagsForSave`、`loadQuickTagEnabled`、`queryPipPresence`、`addTag`/`addTagToBookmark`、`postBookmarkUpdated`。
- 抽出(任意): 付与 handler の共有ヘルパー。
- 例外的に IIFE: `resizable` 許可のみ(§6、検証で必要なら)。

## 9. 検証観点(実装時)

- tsc 0 / vitest 緑 / build OK。
- **本番 allmarks.app + 拡張オフ**で、実ブックマークレットから:
  - OFF → 一瞬で閉じる。
  - ON + PiP 開 → 窓は出ず、PiP に新カードが入りそこでタグ付けできる。
  - ON + PiP なし → タグ窓が出る。既存タグ付与・新規作成がボードへ即反映。
  - ライフサイクル(無操作で自動クローズ / 触ると止まる / 付与後にマウス離脱で閉じる / ✕)。
  - `window.resizeTo` が効くか。
- 拡張ありの経路・カーソルピルが**不変**であること(回帰なし)。

## 10. 非対象の再確認

- カーソルピル(拡張専用)には触れない。
- 「拡張なしでもカーソルピルを出す」は別タスク(IDEAS.md 保留)。
