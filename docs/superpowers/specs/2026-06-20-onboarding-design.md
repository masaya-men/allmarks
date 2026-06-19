# オンボーディング(初回チュートリアル)設計仕様

- **日付**: 2026-06-20(セッション 115)
- **状態**: 設計確定(ユーザー承認済) → 実装計画(writing-plans)へ
- **対象**: 初回アクセス時のインタラクティブなオンボーディング体験
- **関連**: `docs/private/IDEAS.md`「初回チュートリアル＝設置のメイン導線」/ paste-to-save spec(`specs/2026-06-19-paste-to-save-design.md`)/ bookmarklet save-window spec(`specs/2026-06-17-bookmarklet-save-window-redesign-design.md`)

---

## 1. 目的とゴール

**主目的 = アクティベーション**: 初回ユーザーに「その場で実際に操作させ」、最短で「使えた」という成功体験を作る。受け身のスライドショーではなく、**本物のボード上で本物の操作**をさせる。

**設計の核**:
- **出来ることは全部その場で体験させる**(貼り付け保存 → タグ付け → MOTION → 共有)。
- **今その場で出来ないものは、リッチなアニメーションで見せる**(拡張のワンクリック保存・保存即タグ付け = GSAP によるアプリ内再現)。
- 終了後、ユーザーの手元に「**自分で貼った最初のカード**」が残る(成果が消えない)。

**形式 = ハイブリッド**: 「見せる所」はシネマ(全画面演出)、「やらせる所」は本物ボード上のスポットライト誘導。音波テーマの世界観(waveform / A形ロゴ / 緑チェック `#28f100` / RGBグリッチ / ダークガラス)で1本に繋ぐ。すべて既存資産から流用。

---

## 2. シーン構成(全8シーン)

| # | シーン | 種別 | ユーザーの操作 / 前進トリガ |
|---|--------|------|------------------------------|
| 0 | **入場** | シネマ | 音波が波形を描き A形ロゴ→緑チェック点灯。`START` を押す |
| 1 | **最初の1件を貼る** | ハンズオン | スポットライト＋「リンクを貼る(⌘/Ctrl+V)／ `TRY THIS`」。**本物の保存イベント**(`bookmark-saved`)を検知して前進 |
| 2 | **タグを付ける** | ハンズオン | 新カードの「+ TAG」を強調 → `TagAddPopover` で1つ付与。`bookmark-updated` を検知して前進 |
| 3 | **ボードを生かす(MOTION)** | ハンズオン | `MOTION` トグルを強調 → ON にするとデモカード十数枚が一斉に呼吸。ON 検知で前進 |
| 4 | **どこからでも自動で保存** | シネマ動画(GSAP再現) | 偽ブラウザ＋カーソルが拡張ボタンを押す→緑フラッシュ→保存即タグ付け帯。`NEXT` で前進 |
| 5 | **保存導線を用意する** | ハンズオン＋案内 | ブックマークレット設置チップ(ドラッグ)。設置完了は検知不能 → `NEXT`(「あとで」=SETTINGS にある旨)で抜ける |
| 6 | **共有** | ハンズオン一手 | `SHARE` 操作行を強調 → ユーザーに**共有パネルを開かせる**(これが実操作)。中の「リンクをコピー / POST TO X / プレビュー」を**見せて、押さずに閉じる**。`SHARE NOW` は押させない = サーバーに共有を作らない |
| 7 | **フィナーレ** | シネマ | 音波が一閃 →「準備完了」→ デモカード掃除 → **自分の1枚が残った本物ボード**へ着地。SETTINGS に `REPLAY INTRO` がある旨を一言 |

**コピー方針(確定)**: 馴れ馴れしい二人称(「〜したね」等)を使わない。**淡々と、動作と教えたいことを説明する**文体。例: シーン4 =「拡張を入れると、開いているページを1クリックで保存。保存と同時にタグも付きます。」

---

## 3. デモカードによる賑わい

初回ボードは空(=貼った1枚のみ)で MOTION が寂しいため、**オンボーディング中だけデモカードを十数枚仮置き**する。

- **素材**: 既存の CC0(著作権フリー)名画コレクション `lib/marketing/demo-collage.ts`(`DEMO_COLLAGE`)＋デモ注入の前例(`app/(app)/seed-demos/page.tsx`)。
- **流れ**: 開始時点で美しいデモコラージュが並ぶ → シーン1で自分のカードが加わる → シーン3でデモ十数枚が一斉に動く。
- **後始末(ユーザーの IDB を汚さない)**:
  - デモカードに内部フラグ `onboardingDemo: true` を付けて注入(`BookmarkRecord` に任意フィールド追加。**IndexedDB はオブジェクト形状をバージョン管理しないため、ストア/インデックス増設なし = スキーマbump不要**、[[project_idb_irreversibility]] の罠を踏まない)。
  - 完了/スキップ時に**フラグ付きのみ削除**。ユーザーが貼った実カード(無印)は残る。
  - 途中離脱(タブを閉じる)対策: 次回ボード起動時に「フラグ付きが残っていたら掃除」のスイープを実行。再開始時は重複注入しない(既存フラグ付きを先に掃除 or 数で判定)。

---

## 4. 技術設計

### 4.1 部品構成(単一責任で分割)

| 部品 | 責任 | 主依存 |
|------|------|--------|
| `lib/onboarding/onboarding-state.ts` | 初回フラグの読み書き(IDB `settings` の `onboarding-completed`)、`shouldAutoStart(db, itemCount)`、`markComplete(db)` | 既存 settings ストア(`lib/storage/quick-tag-setting.ts` と同様のパターン) |
| `lib/onboarding/onboarding-demo.ts` | デモカードの注入(`seedOnboardingDemo`)と掃除(`clearOnboardingDemo`)、フラグ管理 | `lib/storage/indexeddb.ts`, `DEMO_COLLAGE` |
| `lib/onboarding/steps.ts` | シーン定義(id・種別 cinema/handsOn・ターゲット属性・前進条件)を純データで集約 | なし |
| `components/onboarding/OnboardingController.tsx` | 進行管理(現在シーン・next/skip・本物イベント購読)。ポータルで最上位 | state, steps, 各 view |
| `components/onboarding/OnboardingStage.tsx` | シネマ枠(0/4/7)。GSAP タイムライン | gsap, 音波/ロゴ/グリッチ資産 |
| `components/onboarding/OnboardingSpotlight.tsx` | 本物ボード上の暗転＋くり抜き＋吹き出し。ターゲット矩形を実測 | DOM 実測 |
| `components/onboarding/ExtensionSaveReenactment.tsx` | シーン4の偽ブラウザ＋カーソル＋緑フラッシュ＋タグ帯の GSAP 再現 | gsap, 既存 quick-tag/SaveToast の見た目トークン |

### 4.2 状態とデータの流れ

- `BoardRoot` が「**空 && 初回**」を判定して `OnboardingController` をマウント(現 `EmptyStateWelcome` のマウント位置 `items.length === 0` 分岐を置換/内包)。
- ハンズオン各シーンは**本物のイベントで前進**(疑似操作ではなく実操作を待つ):
  - シーン1: `subscribeBookmarkSaved`(`lib/board/channel.ts`)でカード生成を検知。
  - シーン2: `subscribeBookmarkUpdated` でタグ付与を検知。
  - シーン3: `MotionToggle` の `enabled` が true になったのを検知(`BoardRoot` が持つ MOTION state を props で渡す)。
  - シーン6: 共有パネル(`SenderShareModal`)が開いたのを検知して吹き出しを切替。前進は `NEXT`(`SHARE NOW` は押させない=サーバーに共有を作らない)。
- **スポットライトのターゲットは座標ハードコードしない**。既存要素に `data-onboarding-target="paste-zone | card-tag | motion | share"` を属性で印付け → Controller が `getBoundingClientRect` で実測して穴＋吹き出しを配置。
- 完了/スキップで `markComplete()` → 以後自動表示なし。SETTINGS の `REPLAY INTRO` は `onboarding-completed` を無視して手動起動。

### 4.3 サンプルURL(シーン1の確実成功)

- クリップボードが空でも詰まらせない。`TRY THIS` = 用意した公開URL1件(**即・生きたカードになる埋め込み系**、例: 公開 YouTube クリップ)を貼り付け実行に流す。
- 自分のURL貼り付け(⌘/Ctrl+V)も並行で受ける。どちらでも `bookmark-saved` で前進。

### 4.4 z-index

- オンボーディングは全要素の最上位。`lib/board/constants.ts` の `BOARD_Z_INDEX` に専用トークン追加(魔法数字禁止)。`MODAL_OVERLAY`(200)より上に置く。

---

## 5. i18n(15言語)

- 新名前空間 `board.onboarding.*`(en/ja 人手 → 13言語並列翻訳 → キーパリティ確認)。
- **トーン**: 淡々・説明調(§2)。
- **英語固定 chrome 語彙**: `START` / `SKIP` / `NEXT` / `TRY THIS` / `REPLAY INTRO`([[feedback_ui_vocabulary]])。文章部分のみ各言語化。
- 新キー追加なので 15 言語すべて同期(値だけでなくキーも追加)。

---

## 6. エッジケース

- **クリップボード空/貼り付け失敗** → `TRY THIS` のサンプルで必ず前進。
- **アニメ削減**(`prefers-reduced-motion`) → シネマ各シーンは静的/即時表示に縮退。**可視性はアニメに依存させない**(state の純粋関数。mount=表示、`fill:forwards`/`onfinish` で可視性を制御しない、[[feedback_visibility_never_from_animation]])。
- **デモカードの後始末** → フラグ付きのみ削除＋次回起動スイープ(§3)。
- **再生(REPLAY INTRO)** → 完了フラグを無視して起動。既にカードがあっても動く(「最初の1枚」表現は中立化)。再生中のデモも同じくフラグ管理で掃除。
- **拡張導入済みユーザー**(`data-booklage-extension`、`ExtensionEntry.tsx` の検知を流用) → シーン5を「拡張は検出済み」に出し分け。設置チップは出さず、ブックマークレット/貼り付けの案内に寄せる。
- **スキップ** → 完了として記録(`markComplete`)。
- **モバイル** → 現状未最適化。**貼り付け＋簡潔な歓迎の縮約版**にフォールバック(拡張/ブックマークレット/重いシネマは出さない)。本格モバイルシネマは別タスク。

---

## 7. スコープ

**v1に入れる**:
- 8シーン(0入場 / 1貼る / 2タグ / 3MOTION / 4拡張デモGSAP / 5設置 / 6共有=パネルを開いて見せる / 7フィナーレ)。
- デモカード十数枚の仮置き＆掃除(フラグ管理＋起動スイープ)。
- SETTINGS に `REPLAY INTRO`。
- 15言語。
- `prefers-reduced-motion` 縮退、モバイル縮約版、拡張導入済み出し分け。

**v1に入れない(明示)**:
- 実共有リンクの生成(初回はボタンを見せるのみ・サーバーに残さない)。
- 本格モバイルシネマ。
- 効果音。
- 解析イベント。

---

## 8. テスト方針

- **純ロジック**(`onboarding-state` の判定/永続化、`onboarding-demo` の注入/掃除、`steps` の遷移条件)= vitest。
- **Controller の前進**(イベント購読→次シーン)= vitest(`channel` をモック)。
- **スポットライト座標・GSAP演出**は自動検証不可 → 隔離レンダ＋実機目視([[feedback_verify_before_claiming]]: getComputedStyle 等で可能な範囲は実測)。
- 既存テストへの影響: `EmptyStateWelcome` の扱い変更に伴うテスト更新。

---

## 9. 既存への影響

- `EmptyStateWelcome`(現 `items.length === 0` で表示、📌絵文字つき)の扱い:
  - **初回(未完了 && カード0)** → `OnboardingController` を表示。
  - **2回目以降(完了済 && カード0、全削除した等)** → `EmptyStateWelcome` を**現行化して残す**: 📌絵文字を撤去(セッション115の細線しおりSVG＋chrome語彙に合わせる)、コピーを貼り付け保存中心に更新、`REPLAY INTRO` への導線を添える。フル再生はさせない(自動では出さない方針と整合)。
- `BoardRoot` のマウント分岐を1箇所追加。
- `BookmarkRecord` に任意フィールド `onboardingDemo?: boolean`(スキーマbumpなし)。
- IDB `settings` に `onboarding-completed`(既存 settings ストア流用)。
- `BOARD_Z_INDEX` に専用トークン追加。
