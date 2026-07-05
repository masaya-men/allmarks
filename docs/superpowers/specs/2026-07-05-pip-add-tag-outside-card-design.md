# Spec — PopOut「+ TAG」をカード外・上部固定ピルへ (N-30)

日付: 2026-07-05 / セッション 162

## 背景・問題
PopOut(PiP) の「+ TAG」は現在 `PipCard` がアクティブカードの**左上に重ねて**描画（[PipCard.module.css `.tagAffordance`](../../../components/pip/PipCard.module.css) top:8px/left:8px・透明文字＋影）。明るい/賑やかなサムネの上だと埋もれて見えにくく、カードの形（横長/縦長）で位置も変わる。ユーザー要望＝**カードの外に出して見やすく**（N-30）。

## ゴール
「+ TAG」を**カードに重ねず、PopOut 窓の固定位置（上部中央）に、読みやすいピル型**で出す。対象は今まで通り**アクティブ（中央）カードのみ**。タグメニュー（横スライドのパネル）挙動は無変更。PiP は 256×256 で狭いので `project_pip_size_decision` のカルーセル＋常時メーター構成は崩さない。

## 変更
1. **`PipCard`**：`.tagAffordance` の「+ TAG」ボタン描画を撤去。ボタン専用だった props `isActive` / `tagEnabled` / `onOpenTags` を削除（カードの opacity は `.slot.active` が担うので `isActive` は不要）。`PipCard.module.css` から `.tagAffordance` / `.addTagButton` と関連 paper コメントを削除。
2. **`PipStack`**：`.stage` 直下（`.scroller`/`.meter` の兄弟）に**上部固定の「+ TAG」ピル**を追加。表示条件＝`tagEnabled !== false && onOpenTags && activeCard`。クリックで `onOpenTags(activeCard.id)`。`.scroller` の子ではないので、カードのクリック/スクロールに干渉しない（stopPropagation 依存を減らす）。`data-testid="pip-add-tag-button"` は維持（所在のみ移動）。
3. **`PipStack.module.css`**：`.tagBar`（absolute・top:10px・左右中央）＋ `.addTagPill`（薄い半透明の暗い背景 `rgba(20,20,26,.62)` ＋細枠 ＋白等幅「+ TAG」・`pointer-events:auto`）。paper-atelier 用に読みやすい配色 override を追加。z-index はメーター(2)と同等以上。

## 非対象
- タグメニュー本体（`TagAddPopover` / `tagPanel`）の挙動・見た目。
- アクティブカードの現在タグの表示（今回はボタン移動のみ＝“軽め”）。
- カードのサイズ/カルーセルのレイアウト（縦長カードでは上端に軽く重なるのはメーターと同じ扱いで許容）。

## テスト
- `PipCard.test.tsx`：`pip-add-tag-button` がカード内に無いことへ更新（撤去確認）。
- `PipStack.test.tsx`：アクティブカードに対し stage レベルで `pip-add-tag-button` が出る／非アクティブでは各カードに出ない／クリックで `onOpenTags(activeCardId)` が呼ばれる／`tagEnabled=false` や `onOpenTags` 無しで非表示、を追加。
- `PipCompanion.test.tsx`：`pip-add-tag-button` 参照があれば所在移動に追随。
- 実機：Playwright で /pip-tune もしくは PiP に近い stage を描画し、ピルが上部中央・カード外に出ることを目視。default 盤面 byte-identical（PiP は盤面外だが本体 CSS へ波及しないこと）。
