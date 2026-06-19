# PiP Paste-to-Save — 設計書 (spec)

> Pop Out(PiP)ウィンドウにフォーカスがある状態で URL を Ctrl+V すると、その場で取り込み、
> 貼り付けたカードが PiP 先頭(アクティブ)に来て、既存の「+TAG」でそのままタグ付けできる。
> 作成: 2026-06-19 (session 113) / brainstorming 承認済み。ユーザー指示によりレビュー gate を省略し spec→実装直行。

---

## 1. 目的

session 113 で実装した貼り付け保存(Ctrl+V)を、Pop Out(PiP=フローティング小窓)にも広げる。PiP を常時出しているユーザーが、ボードへ戻らず PiP に直接ペーストして保存→その場でタグ付けできるようにし、保存ハードルをさらに下げる。

## 2. 鍵となる事実(実装が小さい理由)

- **PiP はボードと同じ JS コンテキスト**で動く(`PipPortal` が React ツリーを PiP ウィンドウへ portal)。よって IndexedDB に直接アクセスでき、`ingestPastedUrl` をそのまま呼べる。
- **「貼り付けたカードを先頭アクティブにする」は既存経路で自動実現**: `PipCompanion` は `subscribeBookmarkSaved` を購読し、保存通知を受けるとカードをバッファ末尾に追加+自動スクロールで先頭に出す(`PipCompanion.tsx:84-119`)。`postBookmarkSaved` は別インスタンスの購読に届くため、PiP 内で保存→`postBookmarkSaved`→自分の購読が拾って追加+アクティブ化、が成立する。**直接追加しない**(二重追加回避)。
- **タグ付けは既存**: 先頭に来たカードの「+TAG」(`handleOpenTags`→`TagAddPopover`)でそのままタグ付け。
- **paste リスナの対象 document**: `PipCompanion` の host ノードの `ownerDocument` が PiP ウィンドウの document。ここに張る。

## 3. スコープ

### やること
- `useUrlPasteSave` を「対象 document を渡せる」よう一般化(後方互換: 省略時は `document`)。
- `PipCompanion` で paste を配線(PiP の document に張る)、保存時 `postBookmarkSaved` を発火、コンパクトな取り込み中/重複の合図を PiP 内に表示。

### やらないこと
- 新しいタグ付け UI(既存 `TagAddPopover` をそのまま使う)。
- カードの直接バッファ追加ロジック(既存 `subscribeBookmarkSaved` 経路を使う)。
- 複数 URL・文中 URL 抽出(MVP は単一 URL、ボードと同条件)。

## 4. 設計

### 4.1 `useUrlPasteSave` の一般化(DRY)
現状は `document` に固定で paste リスナを張る。これを変更:
```
useUrlPasteSave(opts: {
  onSaved: (bookmarkId: string) => void | Promise<void>
  targetDocument?: Document | null   // 追加。省略時は document
}): { feedback: PasteFeedback }
```
- 効果内で `const doc = opts.targetDocument ?? (typeof document !== 'undefined' ? document : null)` を解決。`doc` が null なら何もしない(PiP マウント前)。`doc.addEventListener('paste', …)`、cleanup で解除。
- 依存配列に `opts.targetDocument` を含め、PiP の document が利用可能になった時点で張り直す。
- ガード(`isEditableTarget` / `extractSinglePastedUrl`)・busy・loading/duplicate フィードバックの挙動は不変。ボード呼び出し(`targetDocument` 省略)は完全後方互換。

### 4.2 `PipCompanion` の配線
- host 要素に `hostRef` を付け、マウント後に `hostRef.current?.ownerDocument` を state `pipDoc` に格納。
- `const { feedback } = useUrlPasteSave({ onSaved: (bookmarkId) => postBookmarkSaved({ bookmarkId }), targetDocument: pipDoc })`。
  - `onSaved` は `postBookmarkSaved` のみ(既存 `subscribeBookmarkSaved` がカード追加+アクティブ化、開いてるボードも reload+highlight)。
- `.host` 内に `<PasteSaveFeedback feedback={feedback} themeId={DEFAULT_THEME_ID} />` を描画(position:fixed なので PiP ビューポート 256×256 中央に出る)。

### 4.3 データの流れ
```
PiP で Ctrl+V → ガード通過 → ingestPastedUrl(同一JS文脈・同IDB)
  → addBookmark → postBookmarkSaved({bookmarkId})
       ├─ PiP の subscribeBookmarkSaved: バッファ追加 + 自動スクロールで先頭アクティブ
       └─ Board の subscribeBookmarkSaved: reload + 新着ハイライト
  → ユーザーが「+TAG」→ 既存 TagAddPopover → addTagToBookmark → postBookmarkUpdated → ボード反映
重複/失敗時: カード追加なし、PiP 内にコンパクト合図(Already saved / フォールバックは ingest 側で保存済)
```

## 5. 再利用マップ

| 必要なもの | 既存実体 |
|---|---|
| 貼り付けガード | `lib/board/paste-url.ts`(session 113) |
| 取り込み | `lib/board/paste-ingest.ts` `ingestPastedUrl`/`fetchOgpMeta`(session 113) |
| 取り込み中/重複の合図 | `components/board/PasteSaveFeedback.tsx` + `SoundWaveWorking`(session 113) |
| カード追加+アクティブ化 | `PipCompanion` の `subscribeBookmarkSaved` 経路(既存) |
| タグ付け | `PipCompanion` の `handleOpenTags`/`TagAddPopover`(session 104) |
| 保存通知 | `postBookmarkSaved`(`lib/board/channel.ts`) |

## 6. ユニット

- `lib/board/use-url-paste-save.ts`(変更): `targetDocument` 対応に一般化。
- `components/pip/PipCompanion.tsx`(変更): hostRef + pipDoc state + フック呼び出し + フィードバック描画(最小の差分)。

## 7. テスト

- 単体(hook): `useUrlPasteSave` に `targetDocument` を渡したとき、その document の paste で取り込みが走り、省略時は `document` に張る(既存テストは後方互換のまま緑)。
- PipCompanion: 既存テストを壊さない(paste 配線は ownerDocument 依存の統合なので、フック単体で担保 + 手動/本番実機確認)。
- 手動/本番: PiP を出して内側で Ctrl+V → 読み込み(音波)→ カードが PiP 先頭に出る → 「+TAG」でタグ付け → ボードにも反映。重複 URL は Already saved。

## 8. リスク・確認点

- **PiP(子ウィンドウ)で `paste` イベント/クリップボード読みが効くか** は実機確認(同一オリジンの子窓なので原則動くが、フォーカスを PiP に置く必要)。動かなければフォールバックは無し(ボード側の貼り付けは従来どおり使える)。
- `pipDoc` の解決タイミング(マウント後 effect で取得、null の間は未配線)。
