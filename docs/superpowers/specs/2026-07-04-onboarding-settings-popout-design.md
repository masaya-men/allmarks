# オンボーディング改善（N-21 SETTINGS 説明の埋もれ／N-22 POP OUT 再現シーン）設計 — 2026-07-04 セッション157

## 背景・目的

セッション157でユーザーが実機で見つけたチュートリアルの2つの穴：

- **N-21**: `manage` シーンの `settings` beat で SETTINGS ドロワーを開いてトグルをスポットライトするが、**説明バブルが開いたドロワー（EXPORT/LAYOUT/THEME…満載）に重なって読めない**。
- **N-22**: シーン列に **POP OUT（PiP）の説明が存在しない**。主要機能なのに新規ユーザーが素通りする。

**ゴール**: N-21 を最小修正で読めるようにし、N-22 を既存の「再現アニメ」手法で1シーン追加する。default 盤面 byte-identical、拡張の再提出は不要（Web のみ）。

ユーザー確定事項（セッション157 相談）:
- N-22 は**実際に PiP を開かず、忠実な再現アニメ**で見せる（拡張/ブックマークレットと同じ手法）。
- 再現は**実挙動どおり**にする（後述の事実確認に従う）。

---

## N-21：SETTINGS 説明の埋もれ（最小修正）

### 原因（コードで確認済み）
[OnboardingController.tsx](../../../components/onboarding/OnboardingController.tsx) の `manage`/`settings` beat は `OnboardingSpotlight` に `quick-tag-toggle`（ドロワー最上部のトグル）を渡すが `captionAtBottom` を渡していない。[OnboardingSpotlight.tsx](../../../components/onboarding/OnboardingSpotlight.tsx) の `computePlacement` はキャプションを**穴の真下**に置く（`preferredTop = hole.top + hole.height + 14`）。トグルは開いた SETTINGS ドロワーの中にあるため、バブルがドロワーの中身に重なって埋もれる。

### 修正
`settings` beat の `OnboardingSpotlight` に **`captionAtBottom`** を渡す（`motion` シーンで既に使われている実績パターン）。説明は画面**下中央の固定バブル**に出て、右側のドロワーと重ならず読める。スポットライトのリング（トグルを照らす）とカーソルガイドは無変更。

- 変更は1コンポーネント・1 prop 追加のみ。`.bubbleBottom` は既存 CSS。
- ドロワーは右側・バブルは下中央固定＝重ならない（実測で確認する）。

---

## N-22：POP OUT 再現シーン（新規）

### 実際の PiP 挙動（コードで確認済み — 再現の事実ベース）
- **横並びカルーセル**。新カードは配列**末尾＝右端に追加**（[PipCompanion.tsx:134-137](../../../components/pip/PipCompanion.tsx#L134) `[...prev.filter(...), initial]`）。
- 新カードが増えると **PipStack が最新カードを中央へオートスクロール**。[PipStack.tsx:145-152](../../../components/pip/PipStack.tsx#L145) のコメント「slide in from the **right** with the same ease … 'card glides in from the right'」。イージング＝ease-out quart、DUR=700ms（[PipStack.tsx:91-99](../../../components/pip/PipStack.tsx#L91)）。
- 下部に**常時表示メーター**（`LightboxNavMeter alwaysShow`・現在/全体の HUD、[PipStack.tsx:332-341](../../../components/pip/PipStack.tsx#L332)）。
- PiP は「別アプリの上に浮く小窓に、ブラウジング中に保存したブクマが溜まっていく相棒」（セッション中バッファ・開くたび空から）。

➡ **再現は「上から落ちる」ではなく「右からグライドイン→中央着地」＋常時メーター**。これがユーザー指摘の核心。

### シーン定義
[lib/onboarding/steps.ts](../../../lib/onboarding/steps.ts) の `ONBOARDING_SCENES` に `popout` を追加：
- 位置＝**`install` の後・`manage` の前**（extDemo→install→**popout**＝「どこでも保存できる道具」を3つ並べて語る流れ）。
- `{ id: 'popout', kind: 'cinema', advance: 'button' }`（target なし＝実 PiP は開かない）。
- `SceneId` union に `'popout'` 追加。
- **`MOBILE_SCENE_IDS` には入れない**（PiP は desktop 専用）。
- `board.onboarding.installDetected` 等の他 beat には影響しない。

### 再現コンポーネント `PopOutReenactment.tsx`（新規・BookmarkletSaveReenactment に倣う）
Props: `{ caption: string; buttonLabel: string; onAdvance: () => void }`。OnboardingController の cinema 分岐から `wrap(<PopOutReenactment .../>)` で描画。

**演出（忠実モック・黒×緑・音波モチーフ）**:
1. 暗いステージ中央に **PiP 風の小窓**（角丸・上に細いタイトルバーの気配・ほぼ正方形＝実 PiP の 256×256 を想起）がふわっと出現。
2. 窓の中の横カルーセルに、**ミニカードが右端からグライドイン → 中央着地**（ease-out quart・約700ms＝実挙動と同じ数値）。これを**2枚**行い、
3. 窓下の**常時メーター**が `01 / 01` → `02 / 02` と進む（実 PiP の LightboxNavMeter を模した簡易 HUD。実コンポーネントは持ち込まず、見た目だけ再現）。
4. 下中央キャプション＋**NEXT**（他 cinema シーンと同一操作）。
- `prefers-reduced-motion` 尊重（グライドを即着地・メーターは最終値）。アニメは **GSAP タイムライン**（既存 `BookmarkletSaveReenactment`/`ExtensionSaveReenactment` と同じ・Framer Motion 禁止＝CLAUDE.md）。実 PiP コンポーネント（PipStack 等）は import しない＝純粋な視覚再現に留める（結合を作らない）。

### コピー（15言語・`board.onboarding.popout.*`）
[messages/*.json](../../../messages/en.json)（15言語・`board-onboarding-parity.test.ts` がキー存在を強制）に追加：
- `body`（本文）。下書き：
  - ja: 「POP OUT で小さな相棒を切り離せます。別のアプリを見ている間も画面に浮かべておけば、そこで保存したものが右からどんどん溜まっていきます。」
  - en: `Pop out a little companion window. Keep it floating over your other apps — everything you save slides in while you browse.`
- NEXT ボタンは既存の汎用ラベル（各シーンは `buttonLabel="NEXT"` 直書き＝新規キー不要）。
- 他13言語はプロジェクトの既存翻訳フローで用意（parity テストを通す）。

---

## やらないこと（non-goals）
- 実際の PiP を開く（拡張/ブックマークレットと同じく再現のみ）。
- PiP 本体（PipStack/PipCompanion）のリファクタや結合。
- モバイル対応（PiP 非対応）。
- N-21 のスポットライト機構そのものの作り替え（`captionAtBottom` で足りる）。
- 拡張機能の変更（これは Web のみ＝ストア再提出なし）。

## エッジケース
- **resume フロー**: `manage` シーンは /triage へ出て戻る際に `initialScene` で再開する。`popout` は `manage` の**前**なので resume 対象の後段に影響しない（順序追加のみ）。念のため `nextSceneIdIn`/`MOBILE_SCENE_IDS` の順序テストで担保。
- **reduced-motion**: グライドを即着地、メーターは最終値で表示。
- **スポットライト rect 揺れ（N-21）**: ドロワー開閉アニメ中に `quick-tag-toggle` の rect が動いても、キャプションは bottom 固定なので影響を受けない（むしろ安定化）。

## テスト・検証
- **N-21**: OnboardingController の settings beat が `captionAtBottom` 付きで Spotlight を描画すること（レンダリングテスト or 実機 Playwright で下中央バブルがドロワーに重ならないこと）。
- **N-22**:
  - `steps.ts`: `ONBOARDING_SCENES` に `popout` が `install` の直後・`manage` の直前に入る／`nextSceneId('install')==='popout'`／`nextSceneId('popout')==='manage'`／`MOBILE_SCENE_IDS` に含まれない（単体テスト）。
  - `PopOutReenactment`: caption と NEXT を描画し、NEXT で `onAdvance` が呼ばれる（RTL、既存 reenactment テストに倣う）。
  - i18n: 15言語に `board.onboarding.popout.body` が存在（parity テストが自動でカバー）。
  - tsc / vitest / build 全green → デプロイ → 本番でオンボを頭から通し、SETTINGS 説明が読める・POP OUT シーンが install の後に出て右からカードが入る動きを実機確認。
- 実機の動き（オンボは実クリック主体で Playwright 自動化が不安定）はユーザー実機で最終確認。
