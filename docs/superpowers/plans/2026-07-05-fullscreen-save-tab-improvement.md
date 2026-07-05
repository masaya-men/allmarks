# Plan — フルスクリーン時のブックマークレット保存タブ改善 (N-24 / N-39)

日付: 2026-07-05 / セッション 162

## 背景・根本原因（確定済み）

- macOS の Chrome は**フルスクリーン表示中**、`window.open` の小窓要求を無視して**別タブ**で開く（Chrome の意図的仕様。[Bugzilla #803675](https://bugzilla.mozilla.org/show_bug.cgi?id=803675) の同挙動）。
- 拡張なしのブックマークレット保存は、経路(B) で `window.open('__APP_URL__/save?...', 'booklage-save', 'width=256,height=256,...')` を**無条件**に実行（[lib/utils/bookmarklet.ts:69](../../../lib/utils/bookmarklet.ts#L69)）。PopOut(PiP) の有無も SETTINGS のタグ設定も見ない（設定は `/save` 起動後に読む＝タブ自体は止められない）。
- ⇒ フルスクリーン + 拡張なし + ブックマークレット保存 で「タグ付けポップが別タブで全画面に開く」＝友人の N-39 と同一。
- タブが開くこと自体は保存の仕組み上（Chrome のストレージ隔離のためトップレベル AllMarks タブが必須）**避けられない**。よってタブが開く前提で「中身」と「閉じ方」を改善する。

## ゴール（ユーザー確定仕様）

`/save` が**タブとして開かれた（＝フルスクリーン）**と検知したときだけ、以下に切替。**普通の小窓のときは一切変えない**（タグ付けも従来通り）。

1. **分岐①：PopOut が開いている** → 確認は PopOut にカードがスライドインして出る（既存挙動 [PipCompanion.tsx:107](../../../components/pip/PipCompanion.tsx#L107)）。`/save` タブは**最短で自動クローズ**（点滅を最小化）。タグUIなし。
2. **分岐②：PopOut なし + 初回** → 中央にきれいなカードで「SAVED ✓」＋**フルスクリーンの説明と代替手段**を表示（GOT IT で閉じる）。**初回のみ**（IDB にフラグ記録）。タグUIなし。
3. **分岐③：PopOut なし + 2回目以降** → 中央に「SAVED ✓」だけ静かに出て**約1.3秒で自動クローズ**。タグUIなし。
4. フルスクリーンのブックマークレット保存では**タグ付けしない**（後でボードで付ける）。

## 文言（globally-clear English・/save の既存 chrome が英語のため統一）

分岐②の説明カード:

> **You're in fullscreen**
> Chrome is in fullscreen, so saving opens this tab each time. To avoid it:
> • **Exit fullscreen** — saves show in a small corner window instead
> • **Keep PopOut open** — the save appears there and this tab closes instantly
> • **Install the extension** — saves silently, with no window at all
> Tagging isn't available on fullscreen bookmarklet saves — you can add tags later on your board.
> [ GOT IT ]

（15言語ローカライズは別タスク候補。/save は現状ほぼ英語 chrome なので今回は英語で統一。）

## 実装（TDD）

### 1. 純関数（先にテスト） — `lib/bookmarklet/save-window-plan.ts`
- `isOpenedAsTab({ innerWidth, innerHeight }): boolean` — 意図した popup は 256×256。閾値超（`innerWidth > 460 || innerHeight > 620`）でタブ判定。定数 `POPUP_DETECT_MAX_W/H`。
- `planSaveWindow` を拡張:
  ```ts
  planSaveWindow(outcome, quickTagEnabled, pipActive, openedAsTab, fullscreenNoticeSeen): SaveWindowPlan
  ```
  返り値に `mode: 'normal' | 'tab-minimal' | 'tab-explain' | 'tab-confirm'` と `showExplanation: boolean` を追加。
  - `error` → 従来（`ERROR_AUTOCLOSE_MS`・mode normal・no tags/explain）。
  - `!openedAsTab` → **従来通り**（`shouldShowQuickTagWindow`／tags?null:`SAVED_AUTOCLOSE_MS`・mode normal）。
  - `openedAsTab && pipActive` → `tab-minimal`・showTags false・`autoCloseMs = TAB_MINIMAL_CLOSE_MS(250)`。
  - `openedAsTab && !pipActive && !noticeSeen` → `tab-explain`・showExplanation true・showTags false・`autoCloseMs null`（手動 GOT IT）。
  - `openedAsTab && !pipActive && noticeSeen` → `tab-confirm`・showTags false・`autoCloseMs = TAB_CONFIRM_CLOSE_MS(1300)`。
- 新定数: `TAB_MINIMAL_CLOSE_MS = 250`, `TAB_CONFIRM_CLOSE_MS = 1300`。

### 2. ストレージ — `lib/storage/fullscreen-save-notice.ts`（`quick-tag-setting.ts` を踏襲）
- `settings` ストアに `{ key: 'fullscreen-save-notice-seen', seen: boolean }`。
- `loadFullscreenNoticeSeen(db): Promise<boolean>`（既定 false）／`markFullscreenNoticeSeen(db): Promise<void>`。

### 3. `components/bookmarklet/SaveToast.tsx`
- effect 内で `openedAsTab = isOpenedAsTab({ innerWidth: window.innerWidth, innerHeight: window.innerHeight })` を同期取得。
- `Promise.all` に `loadFullscreenNoticeSeen(db)` を追加し `planSaveWindow(...)` に渡す。
- `plan.mode === 'tab-explain'` のとき表示後に `markFullscreenNoticeSeen(db)` を発火（初回のみ担保）。
- 描画分岐追加:
  - `tab-explain` → 中央カード（`.tabCard`）：SAVED ✓ ＋ 説明文 ＋ GOT IT ボタン（`closeWindow`）。
  - `tab-confirm` → 中央カード：SAVED ✓ のみ（`autoCloseMs` で自動クローズ）。
  - `tab-minimal` → 中央に小さく SAVED ✓（`autoCloseMs=250` で即クローズ）。
  - `normal` → **既存の描画そのまま**（tagData 経路含め無変更）。
- タグUI経路（`tagData`）は `plan.showTags` が tab 系で常に false なので発火しない（＝タブ時にタグは出ない）。

### 4. `components/bookmarklet/SaveToast.module.css`
- `.tabCard`：全画面ステージに引き伸ばさず、中央に `max-width: 420px` の落ち着いたカード。既存トークン流用。説明文は読みやすい行間・左寄せ、GOT IT は大きめ（memory: large pointer）。

## 検証
- `rtk vitest run`（純関数テスト緑）／`rtk tsc`（0）／`rtk pnpm build`（out/ 生成）。
- Playwright で `/save?...` を **大ビューポート**（例 1440×900）と **小ビューポート**（256×256）で叩き、tab 系カードが中央に出る／小窓は従来描画、を実測。
- default 盤面 byte-identical（このタスクは盤面非関与だが念のため）。
- **実機は Windows 不可**（Mac フルスクリーン依存）→ ユーザーに普通ウィンドウのフルスクリーンで最終目視を依頼。

## 非対象（今回やらない）
- 拡張の導線強化（ユーザー指示で現状維持）。
- 15言語ローカライズ（別タスク候補）。
- ブックマークレットを PopOut に流す（拡張の役割・オリジン跨ぎ不可）。
