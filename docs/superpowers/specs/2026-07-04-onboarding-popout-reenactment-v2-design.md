# オンボーディング POP OUT 再現シーン v2（作り直し）設計 — 2026-07-04 セッション158後半

## 背景

s158 で N-22 の `PopOutReenactment`（POP OUT 説明シーン）を出荷したが、ユーザー実機で2つの問題が判明：

1. **操作不能（詰まり）**: このシーンで **NEXT が押せず、盤面クリックがブロックされない**。原因はコードで確定＝オンボの土台 `.root` は `pointer-events: none`（[OnboardingController.module.css:1-13]）で、各 cinema シーンは自分の `.stage` で `pointer-events: auto` と暗幕 `background: rgba(6,6,6,0.97)` を**貼り直す契約**（[OnboardingStage.module.css:12-14] にコメント明記／[ExtensionSaveReenactment.module.css:5-17] が実例）。ところが [PopOutReenactment.module.css] の `.stage`（6-14行）は**両方とも書き忘れ**＝NEXT ボタンまで `pointer-events: none` を継承して押せず、暗幕も無いので盤面が透けてクリックを奪う。
2. **品質が低い**: 空の暗箱＋単語だけで、拡張チュートリアル（[ExtensionSaveReenactment.tsx]）の「偽ブラウザ＋実LPスクショ＋実UIオーバーレイ＋**自動で動く緑カーソルがクリックして見せる**」に比べて安っぽい。

## ユーザー確定事項（セッション158 相談）

- **hands-on（本物ボタンを押させる）ではなく、拡張チュートリアルと同じ「本物のミニチュア＋自動カーソルがクリックして見せる」cinema 方式**にする（＝純視覚再現。実 PiP は開かない）。
- 拡張チュートリアルの手触りに**合わせる**（暗幕でブロック・緑カーソルが glide→click-pulse・実LPスクショ流用）。
- **文言は淡々と他シーンに合わせる**（擬人化「相棒」・勢い「どんどん」を廃す）。**確定コピー**（下記）。
- **タグ付けもデモに入れる**（拡張チュートリアルがチップを光らせるのと同様、POP OUT のカードに「+ TAG」→ チップが光る一瞬を入れる）。

## 実 PiP 挙動（コードで確認済み — 再現の事実ベース・引き継ぎ）

- 横並びカルーセル。新カードは**右端に追加**＋ PipStack が最新を中央へオートスクロール（[PipStack.tsx:145] "slide in from the right"・ease `power4.out`・700ms）。下に**常時メーター**。
- **タグ付け**: アクティブカードに「+ TAG」affordance（[PipCard.tsx] `isActive` + `tagEnabled` → `onOpenTags`）。[PipStack.tsx:37-41]。
- **カードクリックで AllMarks へ**: `handleCardClickFromPip` が `window.focus()` で AllMarks を前面化＋`booklage:focus-card` でそのカードへ移動（フィルタ中でも解除して合わせる）[BoardRoot.tsx:502-509]。
- 実 PiP はおよそ 256×256 の小窓（[project_pip_size_decision]）。「開くたび空から」。

## v2 の見せる筋書き（storyboard・ユーザー承認済み）

```
① 偽ブラウザに実LPスクショ。右上ナビに [POP OUT] ボタン（実 chrome 風・緑ドット）。
② 緑カーソルがフェードイン → [POP OUT] へ滑る → クリック（scale 0.78 yoyo）。
③ 小さな相棒ウィンドウ（PiP 風・角丸・タイトルバー「POP OUT」）が back.out でポンと分離して浮く。
④ デモカードが右から1枚→2枚グライドイン（power4.out/0.7s）＋下メーター 00/00→01/01→02/02。
⑤ カーソルがアクティブカードの「+ TAG」へ滑る → クリック → タグチップ（例 "design"）が緑に光る（data-on）。
⑥ 下に淡々キャプション＋NEXT。1周後に NEXT がパルス（cuePulse）。
```

- `prefers-reduced-motion`: アニメを全省略し静止終端（PiP 表示・カード2枚中央・メーター 02/02・チップ点灯・カーソル非表示・cuePulse 即 true）。CSS 側も CTA パルス停止。
- アニメは **GSAP タイムライン**（既存 reenactment と同一・Framer Motion 禁止＝CLAUDE.md）。**実 PiP コンポーネント（PipStack/PipCompanion 等）は import しない**＝純視覚再現。
- **ブラウザ対応は不問**: これは純視覚再現なので Document PiP 非対応ブラウザでも普通に表示される（実機能の Chromium 限定は再現デモには無関係）。シーンは従来どおり **desktop 専用**（`MOBILE_SCENE_IDS` に入れない・v1 のまま）。

## 確定コピー（`board.onboarding.popout.body`・15言語）

- **ja**: 「POP OUT を押すと、小さなウィンドウが開きます。保存したカードがそこに並び、そのままタグ付けもできます。カードを押すと、AllMarks を開いてそのカードに移動します。」
- **en**: "Press POP OUT to open a small window. The cards you save line up there, and you can tag them right in it. Click a card to jump to it in AllMarks."
- 他13言語は同じ淡々トーンで用意（`board-onboarding-parity.test.ts` がキー存在を強制）。NEXT は既存の直書きラベル。

## コンポーネント構造（`PopOutReenactment.tsx` 全面書き換え・[ExtensionSaveReenactment.tsx] に倣う）

- Props は **不変**：`{ caption: string; buttonLabel: string; onAdvance: () => void }`（＝OnboardingController の配線 [OnboardingController.tsx:336-344] は無変更で済む）。`data-testid="stage-popout-demo"`。
- `.stage`（fixed・inset:0・**暗幕 `rgba(6,6,6,0.97)`・`pointer-events: auto`**）＝詰まり解消の核。
- 中に `.browser`（偽ブラウザ・[ExtensionSaveReenactment.module.css:20-31] と同値）→ `.chrome`（× + urlbar "allmarks.app"）→ `.viewport`：
  - `<img className={styles.page} src="/onboarding/lp-hero-shot.webp">`（既存アセット流用・実在確認済）
  - `.nav`（右上オーバーレイ・`SETTINGS / [POP OUT] / SHARE`、POP OUT に `data-anim="popoutBtn"`）
  - `.pip`（`data-anim="pip"`・ポップアウトする相棒窓：`.pipBar` + `.carousel` に2枚の `.card`（`.cardThumb` + `.cardTitle`、アクティブに `data-anim="tagBtn"` 「+ TAG」＋`data-anim="chip"` タグチップ）+ `.meter`（常時表示 `pad(count)/pad(count)`））
  - `<span data-anim="cursor">`（緑カーソル・[ExtensionSaveReenactment.module.css:80-88] の SVG を流用）
  - キャプション `.caption` + `.cta` NEXT（自前描画・既存慣習どおり）
- GSAP：`useEffect` 内で `rel()`（対象の viewport 相対中心）を使い、reset → カーソル fade → POP OUT へ glide → click-pulse → pip pop（back.out）→ カード右から glide（power4.out/0.7s・setCount）→ カーソル +TAG へ → click-pulse → チップ点灯 → hold → loop（`repeat:-1`・`onRepeat` で cuePulse）。cleanup で `tl.kill()`。
- メーターは **常時表示**（`{count > 0}` ガードを入れない＝s158 の spec 準拠修正を踏襲）。

## やらないこと（non-goals）

- 実 PiP を開く／PipStack・PipCompanion を import する（純視覚再現のみ）。
- `steps.ts`・`ONBOARDING_SCENES`・`MOBILE_SCENE_IDS`・OnboardingController の配線変更（v1 で済・props 不変なので触らない）。
- モバイル対応・Document PiP 非対応ブラウザ向けフォールバック（再現デモは全 desktop で表示されるため不要）。
- 実ボードのスクショ新規作成（LP スクショを「あなたの画面」として流用＝拡張デモと同じ慣習）。

## テスト・検証

- **単体（RTL・jsdom）**: caption 描画・NEXT で `onAdvance`・`stage-popout-demo` 存在・`[data-anim^="card"]` が2枚・`[data-anim="popoutBtn"]`/`[data-anim="pip"]`/`[data-anim="tagBtn"]`/`[data-anim="chip"]`/`[data-anim="cursor"]` 存在（構造）。`matchMedia` は既存 setup 依存だが、安全のためガード付き参照。GSAP タイムラインの視覚は単体で検証不能＝構造＋実機目視で担保。
- **tsc / vitest / build 全green** → デプロイ → **本番実機**：①POP OUT シーンで**暗幕が出て NEXT が押せる・盤面が固まる**（詰まり解消）②緑カーソルが POP OUT を押す→小窓が浮く→カードが右から入る→**+ TAG を押してチップが光る**③メーター 00/00→01/01→02/02④NEXT で manage へ／SKIP／reduced-motion 静止。
- 可能なら Playwright で popout シーンのスクショを取り、暗幕・レイアウト崩れの粗検出（オンボは実クリック主体でフローの自動化は不安定＝最終はユーザー実機）。

## エッジ・注意

- `.cursor` は `.viewport`（`position: relative`）内の `position: absolute`。`rel()` は viewport 相対。`() => rel(target)` の遅延評価で、カード到着後の中央位置を正しく拾う。
- default 盤面 byte-identical（変更は PopOutReenactment 3ファイル＋15言語コピーのみ）。
- 偽保存対策：Write/Edit 後は独立 Read、commit/マージは生 `git log --graph` で確認。
