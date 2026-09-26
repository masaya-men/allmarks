# ボード UI 棚卸し(2026-09-26 時点・事実のみ)

ボードの UI/UX 全面刷新(白基調の新しい既定テーマ+白黒・文字・動きの部品言語)の出発点。コードを読んで集めた事実の一覧で、設計案は含まない。行番号は 2026-09-26 時点。

## 全体

- 入口: `app/(app)/board/page.tsx` → `components/board/BoardRoot.tsx`(4,839 行。ほぼ全部の画面部品の状態と操作をここが持つ)。
- ボードに関わる部品ファイルは約 150(`components/board` 直下と `cards/` `chrome/` `decorations/` `embeds/` `scrollmeter/` `TagAddPopover/` `TagButton/` `TagFilterBar/`、`components/onboarding` 16、`components/share` 10、`components/pip` 8、`components/triage` 8、`components/bookmarklet` 6)。

## 1. パソコンで常に見えている操作部品

- 左上: `BoardChrome.tsx` — 「AllMarks」の文字(`/` へのリンク、`ChromeButton` の link 版)。ライトボックスを開くと薄くなる。
- 右上(枠の外): `MotionToggle`(MOTION)+ `FilterPill`(BoardRoot.tsx:3672-3673)。パソコンのみ。
- 右上(キャンバス内の `TopHeader`、BoardRoot.tsx:3782-3893、この順): TITLE(`ChromeLedToggle`)→ TUNE(`TuneTrigger`、ホバーで開く)→ SETTINGS(`ExtensionEntry`)→ MANAGE TAGS(`TagButton`)→ POP OUT → SHARE → ごみ箱表示中だけ EMPTY TRASH(赤)→ TRASH DEAD LINKS。
- 下の帯: `ScrollMeter`(中央、テーマごとに waveform / line / ruler)。
- 右下(画面に固定): `LanguageSwitcher.tsx`(地球アイコン+言語コード、開くと各言語名)。パソコンのみ。
- 見た目: 操作ボタンはすべて `ChromeButton` 経由 — 大文字、`--chrome-font`(既定は等幅)、11px、字間 0.10em、ホバーで RGB のずれ演出(`ChromeButton.module.css:1-146`)。

## 2. 開いて出てくるもの(ポップオーバー・パネル・ダイアログ・通知)

- 右から出る引き出し `ChromeDrawer.tsx`(暗いガラス `rgba(12,12,12,.94)`、角丸 14px、ぼかし 14px、見出しは等幅):
  - SETTINGS(`ExtensionEntry.tsx`、区分 SAVING / VIEW(スマホ)/ LAYOUT / PRIVATE / SYNC / THEME / HOW TO USE / EXTENSION、212-399 行)
  - THEME(`ThemeModal.tsx` → `ThemePicker.tsx` で3テーマ+ `ThemeCustomizeSection.tsx`)
- TUNE: 独自のホバー引き出し(`TuneTrigger.tsx`、`FaderColumn` / `TunePresetColumn`、説明行 DRAG TO TUNE / SHIFT TO SLOW / HOLD TO JUMP / CTRL+Z UNDO / CTRL+SHIFT+Z REDO、530-550 行)。
- 絞り込み: `FilterPill.tsx` — ALL / NO TAGS / タグ一覧(ドラッグで並べ替え、A→Z / Z→A)/ 🔒 Private / TRASH / DEAD LINKS。
- タグ追加: `TagAddPopover/index.tsx`(SUGGESTED + ALL TAGS + 新規入力)。TAG MODE 用に `TagDropPanel.tsx`。
- 同期: `SyncPanel.tsx`(900 行、SETTINGS 内)+ `SyncConnectDialog.tsx` + `SyncMassDeleteConfirmDialog.tsx`。
- 非公開(Private): ダイアログ7種(Setup / Unlock / Manage / ChangePassword / RecoveryKey / Recover / ShareConfirm)+ `VaultConflictNoticeDialog` / `VaultConflictMergeDialog`。
- ごみ箱: `TrashConfirmDialog.tsx`(2秒長押しで DELETE、CANCEL)。
- ブックマークレット: `components/bookmarklet/BookmarkletInstallModal.tsx`(SETTINGS → SAVE WITHOUT EXTENSION からのみ)。
- 通知類: `UndoToast.tsx`、`PasteSaveFeedback.tsx`、`BackupReminder.tsx`、`DataHomeCard.tsx`、`CaptureCrashNotice.tsx`、`ShareCreatingIndicator.tsx`、`ShareToast.tsx`。
- 確認: `TagDeleteConfirmDialog`(`components/triage`)、`TagContextMenu`(タグの右クリック)。

## 3. カードごとの操作(`CardCornerActions.tsx` / `CardNode.tsx` / `CardsLayer.tsx`)

- 右上 × 削除(ごみ箱表示中は ↺ 復元)— ホバーで出る(`CardCornerActions.tsx:60-102`)。
- 左下 ↺ 大きさを戻す(手動で幅を変えたカードのみ、103-135 行)。
- 左上 +TAG(`TagAddPopover` を開く)と、ホバー時のタグ表示 `TagIndicatorStrip.tsx`。
- 四隅のリサイズつまみ `ResizeHandle.tsx`(当たり判定 10px)。
- 右下のメディア表示 `MediaTypeIndicator.tsx`(動画・写真・音声。音声では再生/停止ボタン)。
- 選択モード(同じ `selectedIds` を共有、同時には1つ): TAG MODE(パソコン、ドラッグで範囲選択)/ SHARE の選択 / スマホの長押し複数選択(ごみ箱へ)。

## 4. ライトボックス(`Lightbox.tsx`、2,537 行)

- カードのクリックで開く(カードの位置から広がる)。閉じる: ✕ / 背景クリック / Esc。
- パソコン: 2列(メディア+文章)、前後の矢印(`LightboxNavChevron.tsx`)、位置メーター。文章側にタイトル・説明・サイト名・「元のページへ →」・ツイート翻訳の切り替え。
- スマホは `MobileLightbox.tsx`(ほぼ全画面)。

## 5. スマホ専用(640px 以下)

- 下のナビ `BoardMobileNav.tsx`: TAG / THEME / SHARE / CORNERS / MORE(線のアイコン)。各モード中は `MobileShareSelectBar` / `MobileTrashSelectBar` / `BoardMobileTagBar` に置き換わる。
- 保存の + ボタン `MobileSaveButton.tsx` → `MobileSaveSheet.tsx`(下から出るシート、URL 入力、ADD)。
- 共有の並べ直し: `MobileArrangeDock/TopBar/Gestures/Toast.tsx`、`MobileBandOverlay.tsx`、結果 `MobileShareResult.tsx`。
- 上部: 透明の「一番上へ戻る」帯+右上の絞り込み(FilterPill)。

## 6. 保存の流れ

- ボードに貼り付け → `PasteSaveFeedback.tsx`(SAVING / Already saved)。
- ブックマークレット → `BookmarkletInstallModal.tsx`。
- 拡張機能 → `data-booklage-extension` の目印で検出(`ExtensionEntry.tsx:31-70`)。未導入なら GET EXTENSION の案内(ストア URL 未設定の間は COMING SOON)。
- スマホの共有 → `app/save` / `app/save-iframe`。
- どの経路も最後は同じタグ付けの案内に合流。

## 7. はじめて使う人の流れ

- `lib/onboarding/steps.ts:22-35` / `OnboardingController.tsx`。パソコン: enter → paste → tag → motion → extDemo → install → popout → share → finale(9場面)。スマホ: enter → paste → finale。
- ブックマーク0件かつ未完了のとき自動で始まり、見本カードを入れる(スマホでは入れない)。SETTINGS → REPLAY INTRO でもう一度見られる。
- 空のボード専用の表示は無い(`BOARD_Z_INDEX.EMPTY_STATE` は定義だけで未使用)。

## 8. 共通の設定値

- 重なり順: `lib/board/constants.ts:82-124` の `BOARD_Z_INDEX`(30 以上の名前付きの層)。
- 操作部品の文字: `app/globals.css:367-381` の `--chrome-font` / `--chrome-label-size:11px` / `--chrome-label-tracking:0.1em` / `--chrome-label-weight:400`。
- テーマ(`lib/board/theme-registry.ts:4-38`、3つ):
  - dotted-notebook(表示名 Sound Wave、既定、黒): 等幅、ホバーで RGB のずれ(globals.css:664-675)。
  - flat(白): `--chrome-font` が Geist、ずれ演出なし、ホバーで下線(globals.css:681-729)。
  - paper-atelier(紙): 本文は明朝系だが、操作ボタンの上書きは保留のままで等幅のまま(globals.css:616-627)。

## 事実として確認できたちぐはぐな点

1. 同じボタン仲間で翻訳の扱いが揃っていない: POP OUT / SHARE は翻訳キー経由、TITLE / EMPTY TRASH / TRASH DEAD LINKS / MOTION / MANAGE TAGS は英語の直書き。操作ボタンは全言語英語固定という方針は `FilterPill.tsx:85-96` に書かれているが、適用が不揃い。
2. 本文は翻訳されているのに、隣のボタン文字は直書き: EXPORT / LATER(`BackupReminder.tsx:26-27`)、GOT IT(`DataHomeCard.tsx:25`)、SAVING / Already saved(`PasteSaveFeedback.tsx:28,31`)。SETTINGS の区分見出しも LAYOUT だけ翻訳キー。
3. 言語設定に関係なく日本語が出る: ライトボックスの切り替え点の読み上げ用ラベル「メディア切替」「動画 N / M」「画像 N / M」(`Lightbox.tsx:1937,1945-1946`)。
4. 使われていない部品: `components/board/TagFilterBar/`(テストからしか読まれていない。実際は `FilterPill.tsx` が同じ役割)。
5. 使われていない設定値: `BOARD_Z_INDEX.EMPTY_STATE`。
6. 使われていない翻訳: `messages/en.json:60` の `board.theme.gridPaper`(該当テーマが無い)。
