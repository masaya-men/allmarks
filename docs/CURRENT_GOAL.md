# 次セッションのゴール (= セッション 75) — Triage 側 polish + Phase D 必須を 1 個ずつ消化

## 今のゴール (1 行)

**session 74 で BoardFilter 統合 refactor (= 案 C、 IDB v16 schema bump + JSON backup) 完遂、 タグ click が背景文字 / chrome / Sidebar / dropdown すべてを 1 source of truth で駆動 + リロード復元 + クロスデバイス引越用 EXPORT/IMPORT を ship。 残るは Triage 側 (= /triage の swipe 振り分け画面) の polish 8 候補と Phase D 必須 5 項目を user 起点 1 個ずつ**。

## 開始時の動き (= Claude の最初の発言)

1. **session 74 で本番 deploy した BoardFilter 統合の動作確認結果を聞く** (= user が寝る前にチェックしてくれた場合、 その結果を確認):
   - カードタグ click → 背景文字 + chrome + Sidebar 同時連動?
   - リロードで filter 状態復元?
   - 既存 dropdown filter 切替も問題ない?
   - 万一何か壊れてたら → JSON backup (= `C:\Users\masay\Downloads\allmarks-backup-2026-05-25.json`、 817 KB) を chrome の **IMPORT** で復元 → 旧 build にロールバック検討
2. user に**「booklage.pages.dev で MANAGE TAGS から /triage 開いて触ってみてください、 どこから直したいか教えてください」** と聞く
   - 候補列挙して user に選んでもらう (= 下記 8 + 5 リスト)
3. user が指定したら 1 個ずつ「現状確認 → 案提示 → user 承認 → 実装 → 検証」 の 4 ステップで進行

## session 74 の到達点 (= 触れる状態、 booklage.pages.dev で動作中)

- **本 plan の発端 bug 解消**: カードタグピル click → 背景の AllMarks 文字 + chrome FilterPill + Sidebar 該当行 すべて同じ source of truth で動く (= 「変わらない」 問題完全解消)
- **リロード復元**: タグ filter 状態は IDB v16 schema に永続化、 リロード後も復元
- **新 chrome button**: TUNE と MANAGE TAGS の間に **EXPORT / IMPORT** button (= 全 IDB を JSON dump、 クロスデバイス引越 + リカバリ保険)
- IDB v15 → v16 migration 走った (= settings/board-config record の activeFilter を旧 string → 新 object に automigrate)

### 詳細仕様: [docs/TODO.md](./TODO.md) の「直近の状態 (= session 74)」、 narrative: [docs/TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 74 セクション

## Triage 側 polish 候補 (= session 75 で 1 個ずつ消化、 session 73 から持ち越し)

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

## ブラッシュアップで触る可能性が高い file (= 開始時に読む候補)

1. **「しゅっ」 アニメ** ((a)(D2)): [components/triage/TriageCard.module.css](../components/triage/TriageCard.module.css)
2. **タグ削除 UI** ((b)(D3)): [components/triage/TriagePage.tsx](../components/triage/TriagePage.tsx)
3. **EntryPicker トンマナ** ((c)): 同上 + [.module.css](../components/triage/TriagePage.module.css)
4. **TagPicker レイアウト** ((d)(e)(f)): [components/triage/TagPicker.tsx](../components/triage/TagPicker.tsx) + [.module.css](../components/triage/TagPicker.module.css)
5. **背景透け度** ((g)): [components/triage/BoardBackdrop.module.css](../components/triage/BoardBackdrop.module.css)
6. **中断再開** (D1): [components/triage/TriagePage.tsx](../components/triage/TriagePage.tsx) + localStorage 設計
7. **15 言語 i18n** ((h)(D4)): [messages/](../messages/) 各 .json
8. **rename** (D5): [components/triage/NewMoodInput.tsx](../components/triage/NewMoodInput.tsx)

## session 74 で追加された再利用ストック

- **JSON backup 機能** ([lib/storage/backup.ts](../lib/storage/backup.ts)): 任意のタイミングで全 IDB を JSON dump、 chrome の EXPORT/IMPORT button から user 操作可能、 store list は `db.objectStoreNames` で動的検出 (= 将来の schema 変更にも自動対応)、 import は store ごと clear+put の full replace = 復元時のデータロス無し
- **BoardFilter helpers** ([lib/board/board-filter-helpers.ts](../lib/board/board-filter-helpers.ts)): `BOARD_FILTER_ALL/INBOX/ARCHIVE/DEAD` 定数 + `makeTagsFilter` / `isTagsFilter` / `getActiveTagIds` / `boardFilterEquals` / `toggleTagInFilter`、 今後 BoardFilter を touch する箇所は必ずこれ経由
- **board-filter-migration** ([lib/board/board-filter-migration.ts](../lib/board/board-filter-migration.ts)): IDB legacy string → object 変換、 idempotent、 将来 BoardFilter 型をさらに拡張する時の参考

## トンマナ参考 (= 既存 AllMarks 視覚言語に揃える時の参照)

- **「白文字 + 2 段 text-shadow」** (= session 73 で確立): `color: rgba(255, 255, 255, 0.94)`、 `text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65), 0 0 4px rgba(0, 0, 0, 0.35)` — SVG は filter:drop-shadow 版で同濃度
- **既存 chrome button** ([ChromeButton.module.css](../components/board/ChromeButton.module.css)): scramble + RGB chromatic aberration ghost
- **既存 pill 視覚言語**: ✓ 緑 / ⚠ アンバー / ! 赤 の 3 段意味体系 + 3 段 glow halo + RGB glitch
- **AllMarks success green**: `#28F100`
- **デフォルトテーマ**: 黒 + 白 minimal + 音波 motif
- **業界水準ヘッダ**: monospace 9px uppercase letter-spacing 0.14em opacity 0.4

## 守ること (= user memory + session 74 反省 参照)

- **「ムードボードは何もしなければ静か」** — meta UI は全て hover-revealed、 常時表示は content のみ — memory `feedback_minimal_card_affordances`
- AI っぽいデザイン禁止、 emoji 禁止 — memory `feedback_design_quality`
- **「素人考えで」 の user 提案は教科書水準の可能性高い**、 session 74 で再確認 = user の構造的指摘で案 B → 案 C に切り替え、 真の解決に到達 — memory `feedback_layman_simple_path`
- **「私に流されずプロとして」 と言われたら、 短期合理性ではなく技術的正解を選ぶ** — memory にしてもいい (= session 74 で 1 回経験、 案 B 推奨 → 訂正 → 案 C へ)
- UI 英語は globally-clear、 中学英語動詞優先 — memory `feedback_globally_clear_english`
- クリックターゲット 32×32 px 以上 — memory `feedback_large_pointer`
- 「verify before claiming it works」 — memory `feedback_verify_before_claiming`
- 一貫性目的の隣接波及は user 確認 — memory `feedback_dont_overgeneralize`
- **JSON export 等 reversible な保険を先に整備してから不可逆 operation に臨む** (= session 74 で実践、 Phase 0 → Phase 1 の段取り、 memory `feedback_irreversible_pause` の応用例)

## 進め方 (= 候補、 user 指示優先)

- 1 項目ずつ「現状確認 → 案提示 → user 承認 → 実装 → 検証」 の 4 ステップ
- 小さい調整は黙って実装でも OK、 大きい構造変更 (= 100 行+ refactor) は事前相談
- deploy は **Claude 判断で OK** (= session 73-74 で user 委任済、 ただし push 前に告げる)

## 確認事項・運用

- 確認は常に `booklage.pages.dev` をハードリロード (= Ctrl+Shift+R)
- 応答は日本語、 横文字カタカナ控えめ、 AskUserQuestion 多用しない、 **user が疲れてる兆候出たら短文質問形式に切替**
- deploy 前に tsc + vitest (= 既知 flake `tests/lib/channel.test.ts` 単体 PASS 確認で OK、 session 74 で 829 PASS 連続)
- deploy 手順: `pnpm build` → `npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="<ASCII>"`
- **🔴 月末 (2026-05-31) まで残り 5 日**: `allmarks.app` ドメイン取得確認 (memory `project_allmarks_domain_reminder`)
- Chrome Web Store 公開は ドメイン取得 + 主要 UX 安定後に検討 (= 拡張 auto-update + 配布力、 $5 一括)

## session 74 残し物 (= origin/master 未 push)

session 74 の commits (= Phase 0 4 commit + Phase 1 9 commit + merge commit = 14 commits) は**本番 deploy 済だが origin/master へは未 push**。 user が朝起きて動作確認 OK 後に `rtk git push origin master` で remote 反映。 万一の rollback が必要になった時、 remote 未 push なら local の `git reset --hard <phase0-commit>` だけで済む (= force push 不要)。
