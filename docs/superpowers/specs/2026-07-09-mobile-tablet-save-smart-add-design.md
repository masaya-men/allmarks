# スマホ・タブレット保存（束B）— 賢い「+」ボタン 設計書

- **日付**: 2026-07-09（セッション183）
- **状態**: 設計確定・実装前
- **関連**: `docs/private/2026-07-08-release-runway-plan.md` 束B ／ `docs/CURRENT_GOAL.md`
- **前提となる正本コード**（s183 実読で裏取り済・行番号はズレ得る）:
  - 保存の芯 `ingestPastedUrl(url, deps)` … [lib/board/paste-ingest.ts:62](../../../lib/board/paste-ingest.ts#L62)
  - 既存の貼り付け保存フック `useUrlPasteSave` … [lib/board/use-url-paste-save.ts](../../../lib/board/use-url-paste-save.ts)
  - URL 抽出 `extractSinglePastedUrl`（http/https 必須・単一トークンのみ）… [lib/board/paste-url.ts:5](../../../lib/board/paste-url.ts#L5)
  - フィードバック `PasteSaveFeedback`（SAVING / Already saved） … [components/board/PasteSaveFeedback.tsx](../../../components/board/PasteSaveFeedback.tsx)
  - OGP プロキシ（既存・SSRF ガード済） … [functions/api/ogp.ts](../../../functions/api/ogp.ts)
  - モバイル判定 `useIsMobile()` = `matchMedia(max-width:640px)` … [lib/board/use-is-mobile.ts](../../../lib/board/use-is-mobile.ts)
  - テーマ適用 = `<html data-theme-id={themeId}>` … [components/board/BoardRoot.tsx:818](../../../components/board/BoardRoot.tsx#L818)、`ThemeMeta`（`scrollMeterVariant` / `decorations` 等の per-theme フィールド方式） … [lib/board/theme-registry.ts](../../../lib/board/theme-registry.ts)
  - share_target = manifest 宣言のみ・受け側ゼロ … [public/manifest.json:23](../../../public/manifest.json#L23)

---

## 1. ゴール

スマホ・タブレットから、URL をブックマーク（カード）として保存できるようにする。現状スマホ/タブレットの保存導線は実質ゼロ（ブックマークレットはドラッグ前提、拡張は PC のみ、share_target は宣言だけ）。

**中心となる体験 =「賢い + ボタン」**: タップするとコピー済みの URL を自動で読んで即保存。読めない時だけ入力欄を出す。ユーザーの手間を最小化する（アプリの UX 方針「最小操作」）。

---

## 2. スコープ

### v1 でやること
- **B1 賢い「+」ボタン**（全タッチ端末＝スマホ＋タブレット）
- **B2 Android 共有メニュー受け口**（share_target の受信）
- **B4 新規文言の 15 言語**（parity テスト維持のため必須）

### v1 でやらないこと（合意済み）
- **B3 ホーム画面追加の案内**（空ボード CTA のモバイル版）→ 後日、ホーム追加の物語とまとめて。
- **iPhone のショートアプリ経由の共有メニュー擬似対応** → 将来の任意対応（IDEAS 退避）。
- **盤面レイアウトのタブレット最適化** → 触らない。タブレットは従来どおりデスクトップ表示のまま、「+」だけ足す。
- **iOS の共有メニュー対応** → OS 仕様上不可（Web Share Target 非対応）。「+」が iOS の本命。

---

## 3. 端末ゲート（どこに「+」を出すか）

- 「+」は **タッチ主体の端末（`matchMedia('(pointer: coarse)')`）に出す**。スマホ＋タブレット両方に出る。マウスのデスクトップ（`pointer: fine`）には**出さない**＝開発者 PC を含む既存デスクトップは 1px も変わらない。
- 新規フック `useIsTouchDevice()`（`use-is-mobile.ts` と同じ SSR-safe パターン: 初期値 false → mount 後に matchMedia で更新）。**盤面レイアウトの `useIsMobile()`（640px）とは別軸**。「+」の表示は端末の入力方式で決め、盤面の見た目は従来どおり幅で決める。
- **保険**: 実装時に `(pointer: coarse)` 単独で漏れる端末が判明したら `(pointer: coarse), (max-width: 640px)` の OR に広げられるよう、判定は 1 フック内に閉じ込める。

---

## 4. アーキテクチャ（責務分離）

### 4.0 URL 正規化ヘルパー `normalizeToUrl`（新規・純関数）

3 入口の URL 判定を**完全に同一ルール**にするための 1 純関数。`paste-url.ts` に追加:

```
normalizeToUrl(raw: string): string | null
  // 1. trim。scheme（http/https）が無ければ先頭に "https://" を補完
  // 2. extractSinglePastedUrl で検証（単一トークン・空白なし・http(s)）
  // 3. 通れば URL 文字列、ダメなら null
```

- 効果: 「+」/入力シート/Android 共有のどこから来ても、`example.com`（scheme 無し）は `https://example.com` として同じ判定になる。
- **デスクトップのグローバル貼り付けは従来どおり `extractSinglePastedUrl`（https 補完なし）を使い、挙動を byte-identical に保つ**（scheme 無しの裸ドメインを勝手に拾わない現状仕様を維持）。https 補完の恩恵はモバイル 3 入口だけに新規適用。

### 4.1 保存の共通芯 `useSaveUrl`（リファクタ／新規の内部フック）

現状 `useUrlPasteSave` は「document の paste リスナ」と「保存＋フィードバック＋onSaved」が一体化している。後者（芯）を**入口非依存の再利用フック `useSaveUrl` に切り出す**。

```
useSaveUrl(opts): {
  feedback: PasteFeedback                 // 既存 'loading' | 'duplicate' | null をそのまま
  saveUrl(url: string): Promise<Outcome>  // Outcome = 'saved' | 'duplicate'
}
```

- `saveUrl` は**検証済みの URL 文字列**を受ける（呼び出し側が `normalizeToUrl` or `extractSinglePastedUrl` で先に検証する）→ `ingestPastedUrl(url, deps)` → 成功で `feedback:null`＋`onSaved(bookmarkId)`／重複で琥珀 pill（既存の 1600ms タイマー流用）。`'invalid'` は芯の責務外（呼び出し側が normalize で弾く）。
- `deps` は現状と同じ組（`initDB` / `getAllBookmarks` / `saveBookmarkDeduped` / `fetchOgpMeta`）。busy ガード・dup タイマーも芯に移す。
- 既存のオンボーディング demo フラグ（`flagOnboardingRef` × `SAMPLE_URL`）は芯に引数として温存（挙動不変）。

**`useUrlPasteSave` は薄いラッパに**: `const { feedback, saveUrl } = useSaveUrl(opts)` ＋ 既存の paste リスナ（`isEditableTarget` bail → `extractSinglePastedUrl` → `saveUrl`）。**= デスクトップのグローバル貼り付けは芯を差し替えるだけで挙動 byte-identical**。

> 狙い: 「+」・入力シート・Android 共有の 3 入口が**すべて同じ `saveUrl` を通る**。挙動が揃い、重複・OGP・入場ハイライトのロジックが 1 箇所に集約される。

### 4.2 `MobileSaveButton`（賢い「+」・新規）

- 右下に浮くボタン（モノトーン＋サウンドウェーブ語彙。青丸 FAB 禁止）。`useIsTouchDevice()` が true の時だけ mount。
- 表示を抑止する状態（下部ナビと揃える）: Lightbox 開・オンボーディング中・タグモード中・SHARE の arrange 中は非表示。
- タップ時の流れ:
  1. `navigator.clipboard?.readText()` を **try/catch**（タップ＝ユーザージェスチャ内で呼ぶ）。iOS は「ペースト」確認が 1 回入る（Apple 仕様・不可避）。
  2. 取得テキストを `normalizeToUrl` で判定:
     - **URL なら** `saveUrl(url)` を即実行（入力なし）。
     - **URL でない／空／読めない（未対応・拒否・例外）なら** 入力シート（4.3）を開く。
- クリップボード API が無いブラウザ（一部 Firefox 等）でも、catch → 入力シートへフォールバックするので必ず保存経路がある。

### 4.3 `MobileSaveSheet`（入力シート・新規）

- 画面下から出るシート（キーボードと視線が繋がる）。URL 入力欄 ＋ `ADD` ボタン ＋ 閉じる。
- `ADD`（または Enter）: 入力値を `normalizeToUrl` で検証 →
  - **null（無効）**: シートは**開いたまま**、欄の下に静かな一言（赤・エラー感を出さない）。ユーザーが直せる。
  - **URL**: `saveUrl(url)` →
    - `'saved'`: シートを閉じる（盤面で入場ハイライト＋既存フィードバックが見える）。
    - `'duplicate'`: シートを閉じ、琥珀「Already saved」pill（既存 `PasteSaveFeedback`）。
- 貼り付け・手入力の両対応。`isEditableTarget` が INPUT を無視するので、この欄への貼り付けはグローバル paste と二重保存にならない。

### 4.4 Android 共有メニュー受け口（B2・BoardRoot の mount 効果）

- `/board` mount 時に一度だけ `location.search` を読む（static export のためクライアント側で読む。先例 = triage ページの `location.search` 直読み）。
- `shared=true` を検知 → `url` param、無ければ `text` param から `normalizeToUrl`（Android は text に URL を入れるアプリが多い）→ `saveUrl` → **`history.replaceState` でクエリ除去**（リロード毎の再保存防止）→ フィードバック。
- 端末ゲート不要（明示的な共有インテントで発火。デスクトップ PWA 共有でも同経路で保存されて問題ない）。iOS は共有メニューに出ないので実質 Android 専用。

---

## 5. データフロー（3 入口 → 1 芯）

```
[賢い+ タップ] --clipboard----> ┐
[入力シート ADD] --input-------> ┼─ normalizeToUrl ─ null ─> 入力シート内で静かな赤（+/共有経路では無言でシート/無視）
[Android 共有] --?shared url|text> ┘        │ url
                                            ▼
                                     useSaveUrl.saveUrl
                                            ▼
                          ingestPastedUrl (重複排除 / OGP / 保存)
                                            │
                     saved ─> onSaved: reload + 入場ハイライト + postBookmarkSaved
                     duplicate ─> 琥珀 "Already saved" pill
```

---

## 6. テーマ拡張性

「中身（動作）」と「見た目（皮）」を分離し、**新テーマはコンポーネント無改修で着せ替え可能**にする。

1. **皮 = CSS 変数 ＋ `[data-theme-id]` カスケード**。ボタン/シートの表面を CSS 変数で表現（例: `--save-btn-bg` / `--save-btn-fg` / `--save-btn-ring` / `--save-btn-glow` / `--save-sheet-bg` / `--save-radius`）。default（dotted-notebook / grid-paper）は中立モノトーン。新テーマは `:root[data-theme-id="xxx"] { --save-btn-bg: … }` を CSS に足すだけ。= 既存の `--card-radius` / paper・ruler variant と同じパターン。
2. **構造変種の縫い代を予約（v1 では未実装）**。テーマが構造ごと変えたくなった時のため、`ThemeMeta` に任意フィールド `saveButtonVariant?: 'default' | string`（`scrollMeterVariant` と同型・既定は未定義 = 'default'）を**将来足せる形**にし、`MobileSaveButton` は `variant` prop の default 分岐を持つ。**v1 では variant を追加しない（YAGNI）**が、追加時に他を壊さない。
3. **SAVING 表示は既にテーマ対応**（`PasteSaveFeedback` が `themeId` を受け、サウンドウェーブがテーマ追従）＝そのまま流用。
4. コンポーネントは `themeId` を prop で受けるだけ（分岐ロジックは持たない）。テーマ判定を内部に埋め込まない＝依存が最小。

---

## 7. フィードバック / エラー処理

- 保存中: 既存 `PasteSaveFeedback` の「SAVING」（サウンドウェーブ）。埋め込み型（tweet/youtube 等）は OGP 取得不要なので loading を出さない（既存挙動）。
- 重複: 琥珀「Already saved」pill（1600ms・既存）。エラートーンにしない（`feedback_duplicate_gentle`）。
- 無効 URL: 入力シート内の静かな赤一言のみ（`+` 経路では `extractSinglePastedUrl` が事前に弾くので発生しない）。
- クリップボード拒否/例外: エラーを出さず、無言で入力シートにフォールバック。

---

## 8. 多言語（B4）

- **単語のアクション語（`ADD` / `+`）は英語チめの語彙のまま**（`TAG` / `THEME` / `MOTION` と同じ扱い＝訳さない。`feedback_ui_vocabulary`）。
- **文らしいコピーだけ messages に追加して 15 言語化**（parity テストが落ちるため必須）:
  - `board.save.placeholder`（入力欄プレースホルダ 例: "Paste a link"）
  - `board.save.invalidHint`（無効時の一言 例: "That's not a link"）
  - 必要なら `board.save.addLabel`（ボタンの aria-label）
- en / ja はこのセッションで丁寧に、他 13 言語は一次訳（束C のレビュー対象に含める）。placeholder 系に `{…}` トークンは入れない（parity/placeholder 検査を単純に保つ）。

---

## 9. 定数 / z-index（魔法の数値禁止）

- `BOARD_Z_INDEX` に追加（[lib/board/constants.ts:77](../../../lib/board/constants.ts#L77)）:
  - `SAVE_BUTTON`（POPOVER 120 の上・UNDO_TOAST 130 の下あたり。フィードバック pill と画面位置が違うので競合しない）
  - `SAVE_SHEET`（モーダル層。MODAL_OVERLAY 200 相当・ONBOARDING 210 の下）
- 実値は実装時に確定（本設計では層の順序のみ規定）。
- 「+」の位置は下部ナビ（モバイル）の上・右寄せ。タブレット（デスクトップ表示）では枠内右下。ScrollMeter（bottom band）と重ならないことを実測で確認。

---

## 10. スコープ死守（回帰ゼロの根拠）

- **デスクトップ byte-identical**: マウス端末（`pointer: fine`）に「+」を出さない。`useUrlPasteSave` は `useSaveUrl` を呼ぶ薄いラッパに変わるだけで、paste リスナの挙動・feedback・onSaved は不変。
- **IDB の BoardConfig を書き換えない**（表示だけ・保存値不変）。
- **モバイル/タブレットの盤面レイアウト不変**（「+」の追加とゲートのみ）。
- **share_target 受け口はクエリがある時だけ発火**（通常の `/board` 起動に影響なし）。

---

## 11. テスト

- `rtk tsc` / `rtk vitest run` / `pnpm build`（`rtk next build` 不可＝export されない）。
- 単体（vitest）:
  - `useSaveUrl` の芯（saved / duplicate / invalid の分岐、https 補完、onSaved 呼び出し）を DI で。
  - `useUrlPasteSave` の既存テストが緑のまま（＝グローバル貼り付け回帰ゼロ）。
- Playwright 390×844（`reference_playwright_board_share_verify` の IDB preseed でオンボ/モーダル回避）:
  - 入力シート経路: 「+」→（クリップボード空を想定して）シート → URL 入力 → ADD → カード出現。
  - 重複: 既存 URL を入れて琥珀 pill。
  - Android 共有: `/board?shared=true&text=<url>` 直叩き → 保存 → クエリ消滅。
  - タブレット幅（例 820×1180）で「+」が表示され、盤面がデスクトップ表示のまま。
  - デスクトップ 1489×679（dpr2.58）回帰: マウス端末では「+」が出ない・盤面不変。
- **実機のみで最終確認**（自動不可）: クリップボード自動読み（iOS のペースト確認含む）、Android 共有メニューからの起動、タップ/シートのタッチ感、キーボード上のシート位置。

---

## 12. 未対応（deferred・backlog）

- B3 ホーム追加の案内（モバイル空ボード CTA）。
- iPhone のショートカット経由の共有メニュー擬似対応。
- タブレットの盤面レイアウト最適化。
- テーマ別の「+」構造変種（`saveButtonVariant`）。

---

## 13. ファイル一覧（見込み）

**新規**
- `lib/board/use-save-url.ts` … 保存の共通芯フック
- `lib/board/use-is-touch-device.ts` … タッチ端末判定（`pointer: coarse`）
- `components/board/MobileSaveButton.tsx` / `.module.css` … 賢い「+」
- `components/board/MobileSaveSheet.tsx` / `.module.css` … 入力シート
- 単体テスト（use-save-url.test.ts 等）／ Playwright spec

**変更**
- `lib/board/paste-url.ts` … `normalizeToUrl`（https 補完＋検証）を追加。既存 `extractSinglePastedUrl` は不変
- `lib/board/use-url-paste-save.ts` … `useSaveUrl` を使う薄いラッパへ
- `components/board/BoardRoot.tsx` … 「+」/シートの mount（タッチゲート）＋ Android 共有受け口の mount 効果
- `lib/board/constants.ts` … `BOARD_Z_INDEX.SAVE_BUTTON` / `SAVE_SHEET`
- `messages/{locale}.json` ×15 … `board.save.*`
- （将来のみ）`lib/board/types.ts` / `theme-registry.ts` … `saveButtonVariant`（v1 では触らない）
