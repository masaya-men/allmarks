# Design — Private Phase 2 ①発見導線 + ③まとめてPrivate化

日付: 2026-08-24 / セッション 203
種別: **architectural spec**（既存3つのUI表面〈FilterPill・カード＋ボタン・MANAGE TAGS〉を横断する変更）。
前提: [Private vault Phase 1 design](2026-08-20-private-vault-design.md)（実装済・`master`にmerge済）の上に乗る。Phase 1のデータモデル・暗号化コア（`lib/private/crypto.ts`）・`addPrivateTag`/`removePrivateTag`（`lib/private/apply-tag-change.ts`）はそのまま再利用し、変更しない。
関連（今回のスコープ外・別セッション）: ②クイック保存面（PopOut/拡張機能/ブックマークレット、案B=鍵の安全な受け渡し）／④存在を隠すオプション。詳細は `docs/private/IDEAS.md`「s202 Private Phase 2構想まとめ」。

---

## 1. 背景・決定した方向性

Phase 1の設計は「入り口はSETTINGSの常設ボタンのみ、Privateタグ自体は通常のタグが出るUIに一切出さない」だった。ユーザー指摘: これでは機能の存在に気付く導線が無い。s203のbrainstormingで以下が確定した:

1. **「🔒 Private」はタグが現れる/適用できる場所すべてに常時表示する**（未設定でもロック中でも消さない）。
2. **新しい操作は一切覚えさせない**。既存の「タグをクリックする」「タグにドロップする」という操作の**行き先が状態に応じて変わるだけ**。
   - 未設定 → その場でセットアップダイアログ
   - ロック中 → その場で解錠ダイアログ
   - 解錠中 → そのまま実行（1枚なら暗号化トグル、複数枚ならループで暗号化、FilterPillなら絞り込みトグル）
3. **ダイアログ完了後は元の操作を自動で続行する**（再度クリック/ドロップし直す必要なし）。
4. **追加の確認ダイアログは挟まない**（ドロップ/クリック自体が既に意図的な操作。パスワード入力が実質的な確認を兼ねる）。
5. **表示位置は3箇所とも「一番下」に固定**（常時表示＝発見できるが、一番目立つ場所ではない＝詮索的に主張しない、というバランス。ユーザー指定）。
6. **一括処理は追加専用**（通常のタグのドラッグ&ドロップが「追加のみ・既にタグ済みはスキップ」という仕様なので、それに合わせる。一括「解除」は今回のスコープ外）。
7. **`/triage`（スワイプでタグ付けする専用画面）は対象外**。s170で「MANAGE TAGSは in-page TAG MODE（ドラッグ&ドロップ）に置き換え」済みで、`/triage`はオンボーディング以外から到達しない休眠画面（[BoardRoot.tsx:3555-3558](../../../components/board/BoardRoot.tsx#L3555-L3558)）。

対象3箇所と、変更前の現状:

| # | 場所 | 現状の実装 | 現状の書き込み方式 |
|---|---|---|---|
| ① | `FilterPill`（絞り込み一覧） | `tags` prop＝`useTags()`の表示用リスト。ロック中は除外、解錠中は普通のタグとして混ざって表示（[FilterPill.tsx:102-105](../../../components/board/FilterPill.tsx#L102-L105), [BoardRoot.tsx:3312](../../../components/board/BoardRoot.tsx#L3312)） | 読み取り専用（フィルタ選択のみ、書き込みなし） |
| ② | カードの＋ボタン（`TagAddPopover`、盤面のみ） | `allTags` prop＝同じ`tags`。盤面の呼び出しは`onTagToggle={handleTagToggle}`（[BoardRoot.tsx:3731-3732](../../../components/board/BoardRoot.tsx#L3731-L3732)） | `handleTagToggle`＝Phase 1で実装済みの安全な単発暗号化（[BoardRoot.tsx:1670-1699](../../../components/board/BoardRoot.tsx#L1670-L1699)） |
| ③ | MANAGE TAGSのドラッグ&ドロップ先（`TagDropPanel`/`BoardMobileTagBar`） | `tags` prop＝`bulkAssignableTags`＝Privateを除外済み（[BoardRoot.tsx:3204-3207](../../../components/board/BoardRoot.tsx#L3204-L3207)） | `assignTagToCards`→`persistTags`＝平文の配列書き込み（暗号化しない）。Private宛は現在「何もしない」でno-op（[BoardRoot.tsx:2305-2317](../../../components/board/BoardRoot.tsx#L2305-L2317)） |

②は`TagAddPopover`という**純粋な表示コンポーネント**（[TagAddPopover/index.tsx](../../../components/board/TagAddPopover/index.tsx)）を盤面（CardsLayer経由・安全）とPipCompanion/SaveToast（拡張機能・ブックマークレット・まだ不安全）の両方が共有している。**盤面の呼び出し元だけ**にPrivateチップを渡し、PipCompanion/SaveToastは変更しない（②のスコープ）。

---

## 2. 新規に必要なコード（最小限）

現状把握の結果、必要なのは実質2つだけ。残りは「常に表示する」ための配線変更。

### 2.1 状態別ルーティングの共通ロジック（`BoardRoot.tsx`内、新規state + 1関数）

Phase 1に既にある2つの前例パターンをそのまま拡張する:
- `privateDialog: 'setup' | 'unlock' | null`（[BoardRoot.tsx:3928-3976](../../../components/board/BoardRoot.tsx#L3928-L3976)）
- `pendingPrivateShare: { count, resume } | null`（確認→resume実行の前例、[BoardRoot.tsx:3977-3987](../../../components/board/BoardRoot.tsx#L3977-L3987)）

新設する保留アクション型（3つの呼び出し元にそれぞれ対応）:

```ts
type PendingPrivateAction =
  | { readonly kind: 'toggle-tag'; readonly bookmarkId: string }   // カード＋ボタン
  | { readonly kind: 'filter' }                                     // FilterPill
  | { readonly kind: 'batch-encrypt'; readonly bookmarkIds: readonly string[] } // MANAGE TAGS

const [pendingPrivateAction, setPendingPrivateAction] = useState<PendingPrivateAction | null>(null)
```

エントリ関数（3箇所から呼ぶ、状態に応じて分岐）:

```ts
function handlePrivateEntry(action: PendingPrivateAction): void {
  const status = privateTagId === null ? 'none' : privateSession === null ? 'locked' : 'unlocked'
  if (status === 'unlocked') { void runPrivateAction(action, privateSession!); return }
  setPendingPrivateAction(action)
  setPrivateDialog(status === 'none' ? 'setup' : 'unlock')
}
```

`runPrivateAction`は**セッションを引数で受け取る**（Reactのstate更新は非同期なので、直後に`privateSession`stateを読んでも間に合わない可能性がある。呼び出し元が手元に持っている確立済みセッションをそのまま渡す）:

```ts
async function runPrivateAction(action: PendingPrivateAction, session: PrivateVaultSession): Promise<void> {
  const db = await initDB()
  if (action.kind === 'toggle-tag') {
    // handleTagToggleのPrivate分岐（1675-1689）と同じロジックを共通化して呼ぶ
    await addPrivateTag(db, action.bookmarkId, privateTagId!, session)
  } else if (action.kind === 'filter') {
    handleFilterChange(toggleTagInFilter(activeFilter, privateTagId!))
  } else {
    const { failed } = await addPrivateTagBatch(db, action.bookmarkIds, privateTagId!, session)
    if (failed.length > 0) {
      // トーストで失敗件数を通知（UndoToastと同じ表示機構を再利用）
    }
  }
  setPendingPrivateAction(null)
  await reload()
}
```

`PrivateSetupDialog.onCreate`と`PrivateUnlockDialog.onSubmit`の成功パス（既存コード、[BoardRoot.tsx:3944-3946](../../../components/board/BoardRoot.tsx#L3944-L3946)と[:3964-3965](../../../components/board/BoardRoot.tsx#L3964-L3965)）の末尾に、`pendingPrivateAction`が非nullなら**そこで作った/返ってきたばかりの`session`変数を直接渡して**`runPrivateAction(pendingPrivateAction, session)`を呼ぶ処理を追加する（`toggle-tag`/`batch-encrypt`のみ実行対象 — `filter`分岐はダイアログ経由でも同じ関数で問題なく動く）。

**ロック中に見えているカードは、その定義上すべて非Private**（`resolvePrivateVisibility`がロック中はPrivateタグ付きを`items`から除外するため、[resolve-visibility.ts:29-33](../../../lib/private/resolve-visibility.ts#L29-L33)）。よって`toggle-tag`/`batch-encrypt`の保留アクションは常に「追加」であり、「解錠したら実は既にPrivateだった」という分岐は発生しない。

### 2.2 一括暗号化の新関数（`lib/private/apply-tag-change.ts`に追加）

```ts
/** Encrypts each bookmark not already Private, one at a time (each call is its
 *  own atomic transaction via addPrivateTag). Additive only — mirrors the
 *  plain-tag drag-and-drop's "union, skip already-tagged" semantics
 *  (BoardRoot's assignTagToCards). A failure on one card doesn't stop the
 *  rest; failed ids come back so the caller can report them. */
export async function addPrivateTagBatch(
  db: DbLike,
  bookmarkIds: readonly string[],
  privateTagId: string,
  session: PrivateVaultSession,
): Promise<{ readonly succeeded: readonly string[]; readonly failed: readonly string[] }> {
  const succeeded: string[] = []
  const failed: string[] = []
  for (const id of bookmarkIds) {
    try {
      const bookmark = await getBookmark(db, id)
      if (!bookmark) continue
      if (bookmark.tags.includes(privateTagId)) { succeeded.push(id); continue }
      await addPrivateTag(db, id, privateTagId, session)
      succeeded.push(id)
    } catch {
      failed.push(id)
    }
  }
  return { succeeded, failed }
}
```

既存の`addPrivateTag`（[apply-tag-change.ts:35-62](../../../lib/private/apply-tag-change.ts#L35-L62)）をそのままループで呼ぶだけ。新しい暗号化ロジックは書かない。

---

## 3. UIごとの変更

### 3.1 MANAGE TAGSのドロップ先（`TagDropPanel`/`BoardMobileTagBar`）

`CardsLayer`のドラッグ判定は`document.elementFromPoint(x,y)?.closest('[data-tag-id],[data-tag-new]')`という**汎用DOM hit-test**で、`data-tag-new`があれば`'__new__'`という固定文字列をtargetKeyとして`onTagDrop`に渡す（[CardsLayer.tsx:1124](../../../components/board/CardsLayer.tsx#L1124), [:1215-1218](../../../components/board/CardsLayer.tsx#L1215-L1218)）。これと全く同じ前例パターンで、新しい固定センチネル`'__private__'`を使う:

- `TagDropPanel`/`BoardMobileTagBar`の末尾（リストの一番下、"DRAG ONTO A TAG →"のあと）に専用行を1つ追加。`data-tag-id="__private__"`（実タグidの有無に関わらず常に描画できる — 未設定でも`privateTagId`がnullでも問題ない）。
- `handleTagDrop`（[BoardRoot.tsx:2322-2332](../../../components/board/BoardRoot.tsx#L2322-L2332)）に`targetKey === '__private__'`の分岐を追加: `handlePrivateEntry({ kind: 'batch-encrypt', bookmarkIds: cardIds })`を呼ぶ。
- モバイル（`BoardMobileTagBar`）はタップ即time適用なので、同じ行をタップした時に同じ`handlePrivateEntry`を呼ぶ`onAssignPrivate`propを追加。
- 見た目: 他の行と同じ`tagItem`/`chip`スタイルをベースに、🔒アイコン+状態別のトーン（未設定=薄いグレー、ロック中=🔒のまま、解錠中=他の行と同じ緑ドット）。

### 3.2 カードの＋ボタン（`TagAddPopover`、盤面のみ）

`TagAddPopoverProps`に新しい任意prop `privateEntry` を追加:

```ts
readonly privateEntry?: {
  readonly status: 'none' | 'locked' | 'unlocked'
  readonly isTagged: boolean   // 現在のブックマークに既についているか（unlocked時のみ意味を持つ）
  readonly onClick: () => void
}
```

`allTags`/`otherTags`のチップ列とは別に、ポップアップの一番下（新規タグ入力欄の下）に専用チップとして描画。`onClick`は盤面（CardsLayer経由）から`() => handlePrivateEntry({ kind: 'toggle-tag', bookmarkId })`を渡す。**`unlocked`状態でのクリックは`PrivateEntry`を経由させず`handlePrivateEntry`が直接実行に倒す**（既存の`handleTagToggle`のPrivate分岐がそのまま動くので新規ロジック不要）。

PipCompanion/SaveToastの呼び出し元は`privateEntry` propを渡さない＝今まで通りチップは出ない（②のスコープ）。

### 3.3 FilterPill（絞り込み一覧）

現状は`tags`（Private込みのことがある）をそのままソートして描画している。変更点:

- `BoardRoot`が渡す`tags` propから**Privateを常に除外**する（今後は普通のタグ一覧に混ざらせない・状態に関わらず1本化）。
- `FilterPill`に新規props `privateStatus: 'none' | 'locked' | 'unlocked'`、`privateActive: boolean`（現在の絞り込みにPrivateが含まれているか）、`onPrivateClick: () => void` を追加。
- `bottomGroup`（TRASH/DEAD LINKSの下、[FilterPill.tsx:493-511](../../../components/board/FilterPill.tsx#L493-L511)）のさらに下に専用行を追加。クリックで`onPrivateClick`（`unlocked`なら`handleFilterChange(toggleTagInFilter(...))`相当を親が既に処理、`none`/`locked`なら親が`handlePrivateEntry({ kind: 'filter' })`を呼ぶ）。

---

## 4. ダイアログの説明文（Phase 1からの積み残し）

Phase 1の`PrivateSetupDialog`は入力欄のみで説明文が無い（IDEAS.mdで既に指摘済みの積み残し）。常時表示化で「何も知らずに🔒をクリックしてしまう」経路が増えるため、今回**セットアップダイアログに説明文を追記する**（何が起きるか・パスワードで暗号化される・救済はヒントのみ、の3点。既存のPhase 1 spec §1決定3・9の文言をベースに）。

---

## 5. 影響を受けないもの（変更なし）

- Phase 1の暗号化コア・データモデル・`resolvePrivateVisibility`・`applyFilter`のPrivate封じ込めロジック（一切変更なし）
- ②のクイック保存面（PopOut・拡張機能・ブックマークレット）— `quick-tag-apply.ts`の既存ガードはそのまま維持、PipCompanion/SaveToastにはPrivateチップを出さない
- `/triage`（休眠画面、触らない）
- Private一括「解除」（今回は追加のみ）
- SHAREのPrivate確認フロー（`PrivateShareConfirmDialog`、Phase 1のまま）

---

## 6. テスト方針

- **単体**: `addPrivateTagBatch`（成功/一部失敗/既にPrivate済みのものはスキップして成功扱い）
- **単体**: `handlePrivateEntry`の3分岐（none→setup、locked→unlock、unlocked→即実行）と、ダイアログ成功後の自動resume（`pendingPrivateAction`のクリア含む）
- **単体**: `FilterPill`/`TagAddPopover`/`TagDropPanel`/`BoardMobileTagBar`それぞれの状態別レンダリング（3状態×専用行の見た目・クリック/ドロップ時の呼び出し先）
- **単体**: `handleTagDrop`の`'__private__'`センチネル分岐（既存の`'__new__'`分岐と同じ形でテスト）
- **e2e (Playwright)**: MANAGE TAGSで複数カード選択→Private行にドロップ→（ロック中）解錠ダイアログ→パスワード入力→自動的に選択カードが暗号化される→リロードで消える、の一連
- **e2e**: 未設定状態でカード＋ボタンのPrivateチップをクリック→セットアップダイアログ→作成→自動的にそのカードが暗号化される

---

## 7. 未確定の小さな点（実装時にその場で決めてよいレベル）

- 一括暗号化中の視覚的インジケーター（MANAGE TAGSのPrivate行のスピナー等）の具体的なアニメーション
- 3状態のトーン分け（グレー/🔒/緑ドット）の正確な色値
- 失敗トーストの文言・表示時間
