# 拡張機能フローティングボタン 設計仕様書 ((I-08))

日付: 2026-05-19
担当: Claude (session 53)
関連: docs/private/IDEAS.md (I-08)、 docs/TODO.md 拡張機能磨きフェーズ

---

## 1. 概要

AllMarks 拡張機能の content script が全 URL に対し、 画面右端中央付近に常駐する小さな丸ボタンを inject する。 1 クリックで現在ページを AllMarks に保存。 既保存ページでは緑チェックが永続表示され「もう保存済」 が一目でわかる。 既存の Ctrl+Shift+B / 右クリックメニュー / 拡張機能アイコン / ブックマーレット 4 経路に **5 つ目の保存経路** を追加する。

ユーザー体験ゴール:
- マウスを右端に突き刺すだけで 1 click で保存できる
- 邪魔にならない (= 動画 controls / chat widget / cookie banner と被らない、 アイドル時半透明)
- 既保存ページは visual で即わかる (= 重複 click 抑止)
- 邪魔なサイトでは個別 OFF できる、 拡張全体としても OFF できる

---

## 2. 配置仕様

### 2.1 初期位置

**右端の縦中央 (= `right: 0, top: 50%`)**。

根拠 (= 業界調査の結論):
- 4 隅は他 widget (= チャット widget / cookie banner) の聖地で衝突しがち
- 右端中央は動画 controls (= 下端) / chat widget (= 右下) / サイトメニュー (= 上) / 主ナビ (= 左) のいずれとも被らない無人地帯
- Fitts's Law の edge ピンニング (= 右端まで突き刺せば必ず当たる) が効くので押しやすさも担保
- scroll しても常に視界内 (= `position: fixed` + 縦中央)

### 2.2 ユーザーによる位置変更

**snap-to-edge 方式** (= 業界標準):
- 長押し (= 300ms) で drag mode に入る
- マウスに追従、 release で「左右どちらの端が近いか」 を判定し snap
- 縦位置は release 時の高さで保存 (= 縦は完全自由、 横だけ snap)
- snap 完了時に短い磁石 feedback (= 1.05x → 1.0 の微小 pulse 100ms)

設定の永続化:
- `chrome.storage.sync` に `floatingButtonSnapSide: 'left' | 'right'` と `floatingButtonTopRatio: 0..1` を保存
- 別ブラウザでも同じ位置に出る (= sync storage)

### 2.3 完全自由配置にしない理由

業界調査の結論として、 完全自由配置は「中途半端な位置で取り残されて邪魔」 になりやすく非推奨。 「縦は自由 + 左右だけ snap」 で「右端 (or 左端) の好きな高さ」 という user の欲しい自由度は確保しつつ、 中央付近に取り残される事故を防ぐ。

---

## 3. 視覚仕様

### 3.1 アイコン

user 提供の SVG (= 黒 X + 緑チェック overlay) を `extension/icons/floating-button-mark.svg` に配置。

レイヤー構成 (= SVG 内):
- `mark` パス = 黒の X 形 (= AllMarks の M を X 風にシャープ化)
- `check` パス = 緑のチェック (= 元色 `#28F100`、 CSS で上書き可能)

加工項目:
- 元 SVG の `<g filter>` (= inner shadow) はそのまま流用
- `check` パス側に `id="check-path"` を振って CSS で個別制御
- viewBox `0 0 112 111` は変更不要

### 3.2 状態と visual

| 状態 | mark | check | overlay | 不透明度 |
|---|---|---|---|---|
| idle (= 未保存、 アイドル) | 表示 | 非表示 | なし | 設定値 (= デフォルト 30%) |
| idle-hover | 表示 | 非表示 | なし | 100% |
| saving | 表示 | 非表示 | spinner ring | 100% |
| saved | 表示 | reveal アニメ | なし | 100% |
| already-saved (= 既保存ページ再訪) | 表示 | 永続表示 (= アニメ無し) | なし | 100% |
| already-saved-idle | 表示 | 永続表示 | なし | 設定値 (= デフォルト 30%) |
| error | 表示 | 非表示 | red bang + shake | 100% |

### 3.3 緑チェックの reveal アニメ

既存 cursor pill の checkmark は `stroke-dashoffset` で線描画していたが、 提供 SVG は **fill 形式 (= 塗りつぶし path)** なので別手法を使う:

```css
.floating-btn[data-state="saved"] #check-path {
  clip-path: inset(0 100% 0 0);
  animation: floating-btn-check-reveal 480ms cubic-bezier(0.65, 0, 0.35, 1) 60ms forwards;
}
@keyframes floating-btn-check-reveal {
  to { clip-path: inset(0 0 0 0); }
}
```

= clip-path で「右側 100% 隠れた」 状態から「右側 0% 隠れた (= 全部見える)」 にアニメ。 視覚的には「左から右へお絵かき風にチェックが描かれる」。 既存 cursor pill の green check stroke と同じ 480ms タイミングで揃える。

### 3.4 green glow halo (= 既存レシピ流用)

既存 cursor pill の 3 段 drop-shadow をそのまま流用:

```css
.floating-btn[data-state="saved"] #check-path,
.floating-btn[data-state="already-saved"] #check-path,
.floating-btn[data-state="already-saved-idle"] #check-path {
  filter:
    drop-shadow(0 0 3px rgba(134, 239, 172, 0.95))
    drop-shadow(0 0 8px rgba(74, 222, 128, 0.75))
    drop-shadow(0 0 16px rgba(34, 197, 94, 0.55));
}
```

= AllMarks 成功緑の visual language が cursor pill と floating button で完全に一致。

### 3.5 背景パネル

ボタン本体は **背景パネルなし** (= マークそのものをボタンに)。 user 提供 SVG はそれ自体が形を持っているので、 ガラス pill の背景は不要。 hover 時に subtle なグロー halo を mark 自体に重ねる。

### 3.6 サイズ

- ボタン全体 = 40 x 40 px (= 既存 cursor pill の高さと同じ、 大きいマウスポインタ前提で 32x32 以上を確保)
- SVG mark 内寸 = 32 x 32 px (= viewBox 内で実装)
- hover で 1.08x (= 微小)、 click で 0.94x (= press feedback)

### 3.7 テーマ受け口

CSS 変数で stroke / fill / glow を制御:
```css
.floating-btn {
  --floating-btn-mark-color: #000;
  --floating-btn-check-color: #28F100;
  --floating-btn-glow-inner: rgba(134, 239, 172, 0.95);
  --floating-btn-glow-mid:   rgba(74, 222, 128, 0.75);
  --floating-btn-glow-outer: rgba(34, 197, 94, 0.55);
}
```

将来の音波テーマ等で差し替え可能。 v1 ではデフォルト値のみ。

---

## 4. 隠れるべき時

| 条件 | 挙動 |
|---|---|
| 全体設定 OFF | 描画しない (= content script 早期 return) |
| per-domain OFF list に登録 | 描画しない |
| video / iframe / 任意要素が fullscreen 状態 | display: none (= `fullscreenchange` listener) |
| AllMarks 自身のページ (= `booklage.pages.dev`) | 描画しない (= 自分のサイトには不要) |

---

## 5. 既保存判定 ( = already-saved 状態)

### 5.1 課題

「既保存ページなら緑チェック永続表示」 を実現するには、 起動時に「現在 URL は AllMarks に既保存か」 を判定する必要がある。 しかし AllMarks 本体の IndexedDB は `booklage.pages.dev` origin に隔離されており、 他サイトの content script から直接アクセスできない。

### 5.2 採用案: 保存済 URL の `chrome.storage.local` ミラー

1. `extension/lib/saved-urls-mirror.js` を新設 (= 50 行)
2. `dispatch.js` の保存成功時 hook で「保存した URL」 を `chrome.storage.local` の `savedUrlsMirror` Set にミラー追加
3. floating-button.js は起動時に `chrome.storage.local.get('savedUrlsMirror')` で現在 URL を check
4. ヒットなら `already-saved` 状態で起動

### 5.3 制約

- v1 では「ミラー時点以降の保存」 のみ反映 (= 過去ブクマは判定不能、 各ページを 1 度再保存 attempt するとミラーに入る)
- 一度ミラーされれば永続。 別ブラウザ間では同期されない (= `local` storage、 `sync` ではない理由はサイズ制限。 sync は 100KB 上限で URL set がすぐ溢れる)
- 削除 / soft-delete は v1 では追従しない (= 一度保存した URL は再訪時に緑のまま、 false-positive 許容)
- 「ミラーが空でも保存ボタンとしては機能する」 の挙動を保証 (= 余計な依存なし)

### 5.4 ストレージ形式

```js
// chrome.storage.local
{
  savedUrlsMirror: {
    'https://example.com/article-1': 1716120000000,  // timestamp
    'https://x.com/user/status/123': 1716130000000,
    // ...
  }
}
```

= Set ではなく Object (= chrome.storage.local が Set serialize 非対応のため)、 値は timestamp (= 将来の整理用)

### 5.5 ミラーサイズ管理

`chrome.storage.local` は 10 MB 上限。 URL 100 char × 100000 entries で ~10 MB。 実用上問題なし。 念のため 50000 entries を超えたら古い 10% を削除する pruning logic を入れる。

---

## 6. 設定 UI (= options.html に追加 section)

```html
<section>
  <h2>Floating save button</h2>
  <p class="lede">A small button stays on the edge of every page. Click to save the page to AllMarks. Long-press to drag-and-snap to a different edge.</p>

  <label class="row">
    <input type="checkbox" id="floatingButtonEnabled" />
    <span>Show floating save button on all pages</span>
  </label>

  <label class="row">
    <span>Idle opacity</span>
    <select id="floatingButtonIdleOpacity">
      <option value="0">0% (hidden until hover)</option>
      <option value="0.2">20%</option>
      <option value="0.3" selected>30% (default)</option>
      <option value="0.4">40%</option>
      <option value="0.6">60%</option>
    </select>
  </label>

  <button type="button" id="floatingButtonResetPosition">Reset position to right edge, middle</button>

  <h3>Hide on specific sites</h3>
  <p class="lede">Add a domain to hide the button only on that site. URL save shortcuts still work.</p>
  <div id="floatingButtonDisabledList"></div>
  <div class="row">
    <input type="text" id="floatingButtonAddDomain" placeholder="example.com" />
    <button type="button" id="floatingButtonAddDomainBtn">Add</button>
  </div>
</section>
```

### 6.1 設定キー (= chrome.storage.sync)

| キー | 型 | デフォルト | 意味 |
|---|---|---|---|
| `floatingButtonEnabled` | boolean | `true` | 全体 ON/OFF |
| `floatingButtonIdleOpacity` | number | `0.3` | アイドル時の不透明度 |
| `floatingButtonSnapSide` | `'left' \| 'right'` | `'right'` | 横の snap 端 |
| `floatingButtonTopRatio` | number 0..1 | `0.5` | 縦位置 (= viewport 高さに対する比率) |
| `floatingButtonDisabledDomains` | string[] | `[]` | 個別 OFF ドメイン |

---

## 7. アクセシビリティ

- `role="button"`、 `aria-label="Save current page to AllMarks"`、 `tabindex="0"`
- Tab で focus 可能、 Enter / Space で保存発火
- focus-visible で 2px outline (= AllMarks 緑、 keyboard ユーザーには明示)
- `prefers-reduced-motion: reduce` で snap pulse / hover scale / reveal アニメを抑制
- drag は v1 ではマウス only (= keyboard 操作で位置変更は v2 へ)

---

## 8. ファイル構成

### 8.1 新規

```
extension/
├── floating-button.js              (~250 lines)  content script
├── floating-button.css             (~120 lines)
├── lib/
│   ├── floating-button-state.js    (~80 lines)   pure state machine、 テスト可能
│   └── saved-urls-mirror.js        (~50 lines)   chrome.storage.local 操作
└── icons/
    └── floating-button-mark.svg                  user 提供 SVG (id 振り直し)

tests/extension/
├── floating-button-state.test.ts   (~120 lines)
└── saved-urls-mirror.test.ts       (~80 lines)

docs/specs/
└── 2026-05-19-floating-button-design.md          (= 本 spec)
```

### 8.2 変更

```
extension/
├── manifest.json                   content_scripts に floating-button.js 追加
├── background.js                   保存成功時に saved-urls-mirror 更新を呼ぶ
├── lib/dispatch.js                 同上 (= dispatchSave 内に hook)
├── options.html                    Floating button section 追加
└── options.js                      設定ロジック追加
```

合計規模見積もり: **新規 ~700 行 + 変更 ~80 行**。 元の IDEAS.md 記載 50 行から大幅に拡大しているが、 既保存判定 / 設定 / drag / アクセシビリティ全部入りで現実的な数字。

---

## 9. 状態遷移と message フロー

### 9.1 状態機械 (= floating-button-state.js、 pure logic)

```
入力: { state, event, isAlreadySaved }
出力: { newState }

state ∈ { idle, idle-hover, saving, saved, already-saved, already-saved-idle, error }

event = 'click'        → saving (= ただし state が saving なら無視)
event = 'mouseenter'   → idle → idle-hover (or already-saved-idle → already-saved)
event = 'mouseleave'   → idle-hover → idle (or already-saved → already-saved-idle)
event = 'save-success' → saving → saved (3 秒後 → already-saved)
event = 'save-error'   → saving → error (3 秒後 → idle に戻る)
event = 'mirror-hit'   → idle → already-saved-idle (起動時 check の結果)
```

### 9.2 background ↔ content message

新規 message type:
- `booklage:floating-button-save` (= floating-button → background): 保存リクエスト、 既存 `safeDispatch({ trigger: 'floating-button', tabId })` 経路に乗せる
- 既存 `booklage:cursor-pill` (= background → content): 既存通り `saving / saved / error` を受け取り、 floating-button 側でも subscribe する

`isAutoSaveEnabled` の判定対象に `'floating-button'` を追加するかは決定不要 (= floating button は user が明示的に押す操作なので、 拡張全体 OFF 以外は常に有効。 個別 OFF は floatingButtonEnabled で扱う)。

---

## 10. cursor pill との関係

既存 content.js の cursor pill は **そのまま残す**。 ただし floating button からの保存時は cursor pill を「マウスカーソル直下に出すか、 floating button 上に出すか」 の 2 択で迷う。

**採用**: cursor pill は出さない (= floating button 自身が saving spinner + saved check を出すため重複する)。

実装方針:
- `safeDispatch({ trigger: 'floating-button', ...})` の dispatch.js 側で trigger が `'floating-button'` の時は cursor pill 通知を spilt
- floating button 自身が状態を表示するので、 cursor pill の通知は不要

---

## 11. cross-origin ガード

content script は <all_urls> で動く。 つまり銀行サイト / 社内ツール / 機密サイトでも injection される。 user の判断ポイント:

- 全体 OFF (= floatingButtonEnabled=false) で完全停止
- per-domain OFF list で銀行サイト等を除外
- どんな状態でも、 ボタンは「ユーザーが明示的に押すまで何も保存しない」 (= mirror 読み込みは local だけ、 ネットワークアクセスなし)

---

## 12. 制約と非ゴール

### 12.1 v1 で実装しない

- keyboard で drag (= focus + 矢印キーで位置変更) → v2 に持ち越し
- soft-delete に追従するミラー更新 → v2
- 別ブラウザ間の位置同期 (= `sync` は容量制限のため `local` のみ)
- テーマ system 連動 (= 受け口だけ用意、 実 themes は別 sprint)
- モバイル (= スマホ Chrome は拡張機能の content_scripts 非対応、 デスクトップ専用)

### 12.2 既知の限界

- 既保存判定は「ミラー時点以降」 のみ正確 (= 過去ブクマは初回再保存 attempt まで判定不能)
- フルスクリーン中は隠れるが、 picture-in-picture 中は表示 (= 同列扱いで判定が複雑になるため v1 では PiP 中は表示維持)

---

## 13. テスト方針

### 13.1 vitest (= pure logic)

- `floating-button-state.test.ts`: 7 状態 × 6 イベントの遷移行列を全網羅 (= 42 assertions)
- `saved-urls-mirror.test.ts`: add / has / prune 操作の正しさ、 50000 entries で pruning が走るか、 timestamp 古い順削除

### 13.2 手動検証 (= sideload テスト、 user に最後に依頼)

- 普通のサイトで右端中央に出る
- click で保存される (= cursor pill ではなく floating button 内で saving → saved 表示)
- 既保存サイトを再訪すると緑チェック永続表示
- 長押し → drag → release で左右 snap
- 動画 fullscreen 中は消える
- 設定 OFF で消える
- per-domain OFF list で対象ドメインだけ消える
- `booklage.pages.dev` 上では出ない
- focus → Enter で発火

### 13.3 自動 e2e は v1 では skip

content_script の sideload は CI で組みづらく ROI 低。 unit + 手動検証で carry。

---

## 14. ロールアウト

1. 実装 (= 本 spec の手順 7 step)
2. vitest / tsc 通過確認
3. user に sideload 手順を案内
4. user 実機検証 (= 13.2 のチェックシート)
5. 問題なければ次セッションで extension v0.2 release 候補 (= manifest version bump)
6. Chrome Web Store submit は引き続き allmarks.app 取得後 (= 月末リマインダー、 2026-05-31)

---

## 15. 後続課題 (= IDEAS.md に逆流させる)

- v2 候補: keyboard drag、 soft-delete 追従、 別ブラウザ位置同期、 テーマ system 連動
- 本体側との連携: AllMarks 本体で URL 削除した時に拡張機能側のミラーをどう invalidate するか (= `booklage:url-deleted` message を本体 → 拡張 で送る?)
