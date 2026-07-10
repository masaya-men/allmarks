# 共有受け取り画面：触り端末の「取り込む」バー（N-48）— 設計

*2026-07-10 / session 184 / 承認済み*

## 問題

100件を共有してスマホで `/s/<id>` を開いても、**取り込む手段が一つも無い**。

実測（本番 `https://allmarks.app/s/LJ41eU`、6幅 × 実 Chromium）:

| 幅 | IMPORT ボタン | 上部クローム |
|---|---|---|
| 390（スマホ） | **0×0px** | `display:none`（[BoardRoot.module.css:52-56](../../../components/board/BoardRoot.module.css#L52-L56)） |
| 744〜1180（タブレット） | 196×**27**px | 表示 |
| 1489（PC） | 196×27px | 表示 |

- スマホ: `.frameTopChrome` が `@media (max-width: 640px)` で消えるので、その中にある IMPORT（[SharedBoard.tsx:451-458](../../../components/share/SharedBoard.tsx#L451-L458)）ごと消える。**受け取り画面は閲覧専用になっている。**
- タブレット: 見えてはいるが 27px 高 ＝ 本プロジェクトの指最小 32px も、Apple の 44pt も下回る。**あるだけで押せない。**

背景: **このアプリにタブレット用レイアウトは存在しない**。唯一の分岐は `useIsMobile()` の 640px だけで、744px 以上は 1489px の PC と同一の描画になる。

## 判断の規則（今回確立）

> **大きさは入力で決める。並べ方は幅で決める。**

- 触りなら最低 44×44pt（[Apple HIG](https://developer.apple.com/design/human-interface-guidelines/buttons)）／48×48dp（[Material](https://support.google.com/accessibility/android/answer/7101858)）。幅は無関係。
- レイアウトは幅で分岐する。Google は `isTablet` 型の端末種別分岐を明確に非推奨（[window size classes](https://developer.android.com/develop/ui/views/layout/use-window-size-classes)）。

つまり「タブレット＝スマホ UI」は業界水準では**ない**。ただし**当たり判定だけはスマホと同じ**にする。

## 決定事項

1. **触り端末（`isMobile || isTouchDevice`）に下部固定バーを新設**し、画面幅いっぱいの主役ボタン `IMPORT <n> TO YOUR BOARD`（高さ 52px）を置く。
2. **上部の細い IMPORT は触り端末では描画しない**（マウス PC は不変）。
3. **触り端末では ScrollMeter を出さない**。理由: ①新バーと物理的に衝突する（`.frameBottomChrome` は `bottom:20px`）②掴む部分が 360×**18px** で指の最小寸法を満たさない ③枚数はバーの文言が伝える ④スマホは既にそうなっている。
   - 補足（正直な報告）: 「触りにドラッグ式スクラブバーは不適切」と述べたガイドラインは**存在しない**。Apple は「標準のスクロール操作を常にサポートせよ」と言うだけ。よって「44px 以上に太らせて残す」も正当。今回は上記4点により削除を選ぶ。
4. **押下時のロジックは新規に書かない**。既存 `handleSave`（[SharedBoard.tsx:309-349](../../../components/share/SharedBoard.tsx#L309-L349)）をそのまま呼ぶ ＝ × で消した残り（見えている全部）を取り込む。PC と同一挙動。
5. スクロール中も出しっぱなし。カード 0 枚／取り込み中は押せない。

## 構造

新規 `components/share/ReceiverImportBar.tsx` + `.module.css`。

- **`.canvas` の中に `position:absolute; bottom:0` で置く**（`position:fixed` は使わない）。`.canvas` は `overflow:hidden` + `position:relative` なので、
  - スマホでは `--canvas-margin: 0` ＝ canvas が viewport 全域 → 実質画面下端に貼り付く
  - タブレット/PC では暗い盤面の下端に収まり、外枠にはみ出さない
  - **取り込み中は `ImportProgressIndicator`（`inset:0`, z-index **300**）が完全に覆う**（[ImportProgressIndicator.module.css:1-13](../../../components/share/ImportProgressIndicator.module.css#L1-L13)）
- z-index は新定数 `BOARD_Z_INDEX.TOUCH_BOTTOM_BAR = 150`。カード(10)・盤面下スクリム(80)・ツールバー(110)・ポップオーバー(120) より上、モーダル(200)・取り込みオーバーレイ(300)・ライトボックス(300) より下。`BoardMobileNav` の生値 150 と同じ段。
- 見た目は **`BoardMobileNav` と同素材**（`rgba(9,9,11,0.9)` / `blur(20px) saturate(1.1)` / 上端 1px ヘアライン / `env(safe-area-inset-bottom)` / mono ピン留め）。**テーマ非追従**（メニュー中立化の既定方針、[spec 2026-07-05](2026-07-05-flat-sub1-menu-neutrality-right-drawer-design.md)）。
- ボタンは受け取り画面に既にある `.errorCta` と同じ緑（`#28F100`）の系統。
- `.scroller` の下余白を `calc(120px + env(safe-area-inset-bottom, 0px))` に。最下段のカードがバーに隠れない。

## 変更するファイル

- `lib/board/constants.ts` — `BOARD_Z_INDEX.TOUCH_BOTTOM_BAR: 150`
- `components/share/ReceiverImportBar.tsx` / `.module.css` — 新規
- `components/share/SharedBoard.tsx` — `isTouchSurface` を1本化し、上部 IMPORT / ScrollMeter / バーの3箇所を分岐
- `components/share/SharedBoard.module.css` — `.scroller` の下余白
- `components/share/SharedBoard.mobile-scroll.test.tsx` — バーの出し分けを追加
- `tests/e2e/board-share-polish.spec.ts` — スマホ / タブレット / PC の3幅

## テスト

**単体**（`useIsMobile` / `useIsTouchDevice` を差し替え）:
- スマホ（幅狭・触り）→ バーが出る／上部 IMPORT は描画されない
- タブレット（幅広・触り）→ 同上
- マウス PC → バーは無い／上部 IMPORT がある
- カード 0 枚 → バーのボタンは `disabled`

**e2e**（`test.use({ hasTouch: true })` が必須。素の `setViewportSize` では `(pointer: coarse)` にならない — N-47 で実測済み）:
- 390×844 触り → `[data-testid="receiver-import-bar"]` が見える／ボタン高 ≥44px／文言に枚数／ScrollMeter 無し
- 1024×768 触り → 同上（上部 IMPORT が無いこと）
- 1489×679 マウス → バー無し／上部 IMPORT あり／ScrollMeter あり

## やらないこと（別項目）

- **N-49**: スマホ/タブレットから SHARE できない（本体ボードの `TopHeader` が 640px 以下で `display:none`）。別途 brainstorm。
- **N-50**: ボード本体のタブレット作法（SHARE/TITLE/TUNE/POP OUT/MANAGE TAGS が全て 27px 高）。別途。
- i18n は入れない。受け取り画面のクローム文言は全て英語直書きで、`next-intl` は通っていない（既存方針に合わせる）。

## 未検証（実機のみ）

- ノッチ付き iPhone での `env(safe-area-inset-bottom)` 実値と、最下段カードの隠れ具合。
- 実機タブレットでのバーの押しやすさ。
