# 次セッションのゴール (= セッション 74) — Triage 側 polish + Phase D 必須を 1 個ずつ消化

## 今のゴール (1 行)

**session 73 でボード側タグ UI (= +TAG popover、 タグピル表示、 chrome 連動、 ライトボックス遷移等) 7 polish 完遂 + 保存バグ self-heal 解決。 残るは Triage 側 (= /triage の swipe 振り分け画面) の polish 8 候補と Phase D 必須 5 項目を user 起点 1 個ずつ**。

## 開始時の動き (= Claude の最初の発言)

1. user に**「booklage.pages.dev で MANAGE TAGS から /triage 開いて触ってみてください、 どこから直したいか教えてください」** と聞く
   - 候補列挙して user に選んでもらう (= 下記 8 + 5 リスト)
2. user が指定したら 1 個ずつ「現状確認 → 案提示 → user 承認 → 実装 → 検証」 の 4 ステップで進行
3. user 検証未完項目 (= session 73 ship の Polish 6 / 7) も併せて確認できれば追記

## session 73 の到達点 (= 触れる状態、 booklage.pages.dev で動作中)

ボード側:
- カード hover で**左上外にタグピル群 (= 白 + text-shadow)** + + TAG ボタン
- + TAG → **SUGGESTED / ALL TAGS 2 セクション popover** (= HeuristicTagger + tag-candidates 統合、 max 5)
- popover は**クリック外で閉じる** + Esc + 再 click
- タグピル click → 画面右上 chrome が**スクランブル + グリッチで連動**
- カード click でライトボックス遷移時 **全 hover affordance 静かに消える**
- スクロール中は **動画フレーム抽出 defer** (= jank 軽減)

保存:
- 拡張 v0.1.15、 timeout 8s + self-heal (= 詰まり時 1 回自動リトライ)、 全 5 経路 動作確認済

### 詳細仕様: [docs/TODO.md](./TODO.md) の「直近の状態 (= session 73)」、 narrative: [docs/TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 73 セクション

## Triage 側 polish 候補 (= session 74 で 1 個ずつ消化)

8 個 + 5 個 = 13 項目。 user 体感ベース、 順不同:

### A. user 触り起点 polish (= /triage で実体検証してから判定)

- **(a)** 「しゅっ」 アニメ気持ちよさ — TriageCard 4 方向 exit、 現状 220ms cubic-bezier 3 段 (= 反り → 飛び去り)、 派手 / 静か / 別メタファー (紙折りたたみ / 光トレイル / 音波減衰) を user 判定
- **(b)** タグ削除 UI — EntryPicker の Manage tags inline、 今 `window.confirm` の OS ダイアログで mood board 世界観と乖離。 inline 確認 + 削除アニメに進化 (= Phase D3 と関連)
- **(c)** EntryPicker 配置・トンマナ — 「未分類のみ / 全部」 二択 + Manage tags 一覧の見え方
- **(d)** TagPicker 4 方向 2 段 chip — 主 + 薄字副 の可読性
- **(e)** Shift で副タグ切替の体感 — 副タグ 5-8 への切替応答性 + 視覚反応
- **(f)** 画面下 co-tags strip 余白・サイズ — chip 並びの密度、 入力 field との距離
- **(g)** 背景 board の透け度合い — BoardBackdrop opacity 0.14 + blur 3px が user に「裏が自分のボード」 と読めてるか
- **(h)** 「mood」 表記残り — i18n 検索 (= D4 と関連)

### B. Phase D 必須項目 (= 機能追加、 polish より重い)

- **D1** 中断再開 (= localStorage に completedBookmarkIds 永続 + 続きから prompt、 単独 1 sprint 級)
- **D2** 「しゅっ」 アニメ進化 (= a と関連、 大改造案)
- **D3** タグ削除 楽しい fx (= b と関連、 inline 確認 + 削除アニメ進化)
- **D4** 他 14 言語の mood → tag rename (= `messages/{en,ar,de,es,fr,it,ko,nl,pt,ru,th,tr,vi,zh}.json` の `newMood` / `moodNamePlaceholder` 等)
- **D5** NewMoodInput → NewTagInput rename (= file + 内部識別子)

### C. user 検証未完 (= session 73 ship 済、 ハードリロード後 確認)

- Polish 6 スクロール jank 軽減 — user「たぶん OK かな」 で確定保留、 体感ベース最終確認
- Polish 7 chrome label 連動 — タグピル click で chrome がスクランブル + グリッチで切替、 deploy 直後で未確認

## ブラッシュアップで触る可能性が高い file (= 開始時に読む候補)

1. **「しゅっ」 アニメ** ((a)(D2)): [components/triage/TriageCard.module.css](../components/triage/TriageCard.module.css) (= exit 4 方向 keyframes)
2. **タグ削除 UI** ((b)(D3)): [components/triage/TriagePage.tsx](../components/triage/TriagePage.tsx) (= EntryPicker function 内 Manage tags inline)
3. **EntryPicker トンマナ** ((c)): 同上 + [.module.css](../components/triage/TriagePage.module.css) (= .entry* / .tagManagement*)
4. **TagPicker レイアウト** ((d)(e)(f)): [components/triage/TagPicker.tsx](../components/triage/TagPicker.tsx) + [.module.css](../components/triage/TagPicker.module.css)
5. **背景透け度** ((g)): [components/triage/BoardBackdrop.module.css](../components/triage/BoardBackdrop.module.css)
6. **中断再開** (D1): [components/triage/TriagePage.tsx](../components/triage/TriagePage.tsx) + localStorage 設計
7. **15 言語 i18n** ((h)(D4)): [messages/](../messages/) 各 .json
8. **rename** (D5): [components/triage/NewMoodInput.tsx](../components/triage/NewMoodInput.tsx) (= 新 file name + 内部 import 更新)

## トンマナ参考 (= 既存 AllMarks 視覚言語に揃える時の参照)

- **session 73 で確立した「白文字 + 2 段 text-shadow」** ([CardCornerActions](../components/board/CardCornerActions.module.css) + [TagIndicatorStrip](../components/board/TagIndicatorStrip.tsx) + [+ TAG ボタン](../components/board/CardsLayer.tsx) 統一): `color: rgba(255, 255, 255, 0.94)`、 `text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65), 0 0 4px rgba(0, 0, 0, 0.35)` — SVG は filter:drop-shadow 版で同濃度
- **既存 chrome button** ([ChromeButton.module.css](../components/board/ChromeButton.module.css)): scramble + RGB chromatic aberration ghost
- **既存 pill 視覚言語**: ✓ 緑 / ⚠ アンバー / ! 赤 の 3 段意味体系 + 3 段 glow halo + RGB glitch
- **AllMarks success green**: `#28F100`
- **デフォルトテーマ**: 黒 + 白 minimal + 音波 motif
- **業界水準ヘッダ**: monospace 9px uppercase letter-spacing 0.14em opacity 0.4 (= session 73 で確立、 SUGGESTED / ALL TAGS)

## 守ること (= user memory + session 73 反省 参照)

- **「ムードボードは何もしなければ静か」** — meta UI は全て hover-revealed、 常時表示は content のみ — memory `feedback_minimal_card_affordances`
- AI っぽいデザイン禁止、 emoji 禁止 — memory `feedback_design_quality`
- **「素人考えで」 の user 提案は教科書水準の可能性高い**、 まず業界準拠か検証 — memory `feedback_layman_simple_path` (session 73 reinforcement で scroll defer の事例追記済)
- UI 英語は globally-clear、 中学英語動詞優先 — memory `feedback_globally_clear_english`
- クリックターゲット 32×32 px 以上 — memory `feedback_large_pointer`
- アニメ・配置調整は CSS 変数経由で
- 「verify before claiming it works」 — memory `feedback_verify_before_claiming`
- 一貫性目的の隣接波及は user 確認 — memory `feedback_dont_overgeneralize`
- **PointerEvent preventDefault は spec で mousedown 抑止**、 click-outside 系は pointerdown 使う (= session 73 で実体験)

## 進め方 (= 候補、 user 指示優先)

- 1 項目ずつ「現状確認 → 案提示 → user 承認 → 実装 → 検証」 の 4 ステップ
- 小さい調整は黙って実装でも OK、 大きい構造変更 (= 100 行+ refactor) は事前相談
- deploy は **Claude 判断で OK** (= session 73 で user 委任済、 ただし push 前に告げる)。 session 73 で 9 deploy / 月次余裕

## 確認事項・運用

- 確認は常に `booklage.pages.dev` をハードリロード (= Ctrl+Shift+R)
- 応答は日本語、 横文字カタカナ控えめ、 AskUserQuestion 多用しない、 **user が疲れてる兆候出たら短文質問形式に切替** (= session 73 で 1 度依頼あり)
- deploy 前に tsc + vitest (= 既知 flake `tests/lib/channel.test.ts` 単体 PASS 確認で OK、 session 73 全 806 PASS 連続)
- deploy 手順: `pnpm build` → `npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="<ASCII>"`
- **🔴 月末 (2026-05-31) まで残り 6 日**: `allmarks.app` ドメイン取得確認 (memory `project_allmarks_domain_reminder`)
- Chrome Web Store 公開は ドメイン取得 + 主要 UX 安定後に検討 (= 拡張 auto-update + 配布力、 $5 一括)

## session 73 で確立した重要パターン (= session 74 以降の再利用ストック)

- **scroll-deferred loading** (= isScrolling state + 200ms idle): 新規重い処理を gate するのに使える、 frame extraction 以外にも応用可能 (= 画像 hi-res load 等)
- **chrome scramble burst on label change** (= prevRef + useEffect + triggerBurst): 他の chrome 要素 (= ScrollMeter / TagButton 等) でも filter / state 連動の演出に使える
- **white + 2-tier text-shadow** (= color: rgba(255,255,255,0.94) + 2 段 shadow): あらゆる写真背景上のテキスト可読性確保、 mix-blend より安定
- **hover affordance hide during morph** (= isLightboxSource 判定 + hoverActive 派生): 他の morph 系 (= 将来 share image preview 等) でも応用可能
