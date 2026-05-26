# 次セッションのゴール (= セッション 76) — scroll jank polish + Triage 持ち越し

## 今のゴール (1 行)

**session 75 でタグ絞り込み体験の徹底 polish 完遂 (= entry CRT bootup 業界調査ベース v2 + source-aware scroll restore + scroll easing 全統一)、 12 deploy。 残るは user 報告の「scroll 開始時 / 移動中の jank (= 動画読み込み + サムネ 3 枚取得が重い感じ)」 polish + session 73 から持ち越しの Triage 側 polish 8 個 + Phase D 必須 5 項目**。

## 開始時の動き (= Claude の最初の発言)

1. user に「**今日は scroll jank と Triage 側 polish どっちから着手しますか?**」 と聞く
2. user が指定したら 1 個ずつ「現状確認 → 案提示 → user 承認 → 実装 → 検証」 の 4 ステップで進行

## session 75 の到達点 (= 触れる状態、 booklage.pages.dev で動作中)

- **タグ click → CRT shutdown** (= 旧 session 71 復活)、 **scroll-to-top** (= 該当カードへ追従)、 **smooth scroll** (= easeOutQuart 500-1200ms、 動き出し即座 + 終わり 4 次減速の luxury tail)
- **解除 → source-aware scroll restore** (= click 元カード位置に焦点 + glow)、 dropdown 経由は scroll-to-top (= 既存挙動互換)
- **カード復活 → CRT bootup v2** (= 「完全闇 → 中央点 → 横線 → 縦展開 + 残光 bloom 山場 → glitch → 通常」 380ms 6 段階)、 prefers-reduced-motion 対応済
- 全 scroll motion (= ScrollMeter click、 PiP focus、 ?focus=URL 等) が同じ luxury curve

### 詳細仕様: [docs/TODO.md](./TODO.md) の「直近の状態 (= session 75)」、 narrative: [docs/TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 75 セクション

## 次セッション 着手候補 A: scroll 開始 / 移動中の jank polish (= user 直 report、 最優先)

user 報告: **「スクロール始まる瞬間と移動中にどうしても動画読み込み / サムネ 3 枚取得をやっていて重いのかな？ と感じている」**

### 仮説 (= 着手前 audit が必要)

1. **アンビエントスライドショー 3 枚抽出 (= session 68 で実装)** と scroll の競合
   - X 動画カードを 0% / 25% / 50% の 3 枚クロスフェードで表示するため、 off-screen `<video>` + canvas + JPEG quality 0.7 で抽出
   - session 73 で「scroll-deferred (= isScrolling state + 200ms idle) で gate」 既に実装、 但し**抽出 in-flight は cancel 不可**で 1 個分は残る
   - 加えて queue が積み上がる頻度が user の scroll 速度に追従できてない可能性
2. **ImageCard hover swap の preload** (= multi-image tweet 用、 session 12 で実装) が scroll で hover detection 誤発火?
3. **hi-res image lazy load** (= ブラウザ任せ `loading="lazy"`)、 scroll 中に viewport に入ったカードが一気に load 開始?
4. **Tier 1 viewport 自動再生 (= 1 video + 静止画スライドショー、 session 67)** の起動コスト?
5. **GSAP transform layer creation** (= 540 枚の position 計算 + transform 適用、 viewport buffer 内のみ DOM 上にあるが、 culling 復帰時に paint 集中)?

### audit 方針

- まず**何が scroll 中に発火してるか** systematic 調査 (= Chrome Performance recording + console 計測 + git log audit)
- 仮説のうち最も寄与が大きい 1 つを特定 → 修正 → user 検証 → 次の仮説、 の iter
- session 73 で確立した **scroll-deferred loading pattern** を他の重い処理に応用展開できる箇所を発見できれば quick win

### 関連 file (= 開始時に読む候補)

- [components/board/CardSlideshow.tsx](../components/board/CardSlideshow.tsx) (= 3 枚クロスフェード、 scroll defer 既に組込済)
- [lib/board/extract-video-frames.ts](../lib/board/extract-video-frames.ts) (= X 動画コマ抽出)
- [lib/board/use-tweet-video-frames.ts](../lib/board/use-tweet-video-frames.ts) (= in-memory キャッシュ + in-flight dedup + FIFO 待ち行列)
- [components/board/cards/ImageCard.tsx](../components/board/cards/ImageCard.tsx) (= multi-image hover swap)
- [components/board/CardsLayer.tsx](../components/board/CardsLayer.tsx) (= masonry + GSAP-FLIP + Tier 1 viewport autoplay)

## 次セッション 着手候補 B: Triage 側 polish 8 個 + Phase D 5 項目 (= session 73 持ち越し継続)

### A. user 触り起点 polish (= /triage で実体検証してから判定)

- **(a)** 「しゅっ」 アニメ気持ちよさ — TriageCard 4 方向 exit、 220ms 3 段 → 別メタファー検討
- **(b)** タグ削除 UI — 今 `window.confirm` の OS ダイアログ、 inline 確認 + 削除アニメに進化
- **(c)** EntryPicker 配置・トンマナ
- **(d)** TagPicker 4 方向 2 段 chip 可読性
- **(e)** Shift 副タグ切替の体感
- **(f)** 画面下 co-tags strip 余白・サイズ
- **(g)** 背景 board の透け度合い
- **(h)** 「mood」 表記残り (= i18n)

### B. Phase D 必須項目

- **D1** 中断再開 (= localStorage 完了 id 永続 + 続きから prompt)
- **D2** 「しゅっ」 アニメ進化 (= a と関連)
- **D3** タグ削除 楽しい fx (= b と関連)
- **D4** 他 14 言語の mood → tag rename
- **D5** NewMoodInput → NewTagInput rename

## session 75 で追加された再利用ストック (= 次セッション以降の applicable patterns)

- **`lib/animation/tag-entry/`** = shutdown と同じ pattern の API + theme module 構造、 Phase 3 で他テーマ追加時はこの枠
- **`getEntryAnimation(theme)`** = WAAPI で発火する keyframes + options + stagger 数値返す、 CSS variables 経由でテーマ別 override 可能
- **`easeOutQuart`** (= `1 - (1-t)^4`) は全 scroll で統一済、 業界 luxury tail curve、 動き出し急 + 終わり 4 次減速
- **CSS custom property time 値は単位なし**: `--x: 800` + コメント `/* ms */` で書く、 `800ms` は Chrome が `"0.8s"` に正規化して罠
- **source-aware navigation pattern**: callback に source ID を bind、 useRef で memo、 transition 検出 useEffect で focus 復帰、 click 元 context lost を防ぐ業界 best practice

## トンマナ参考 (= 既存 AllMarks 視覚言語に揃える時の参照)

- **「白文字 + 2 段 text-shadow」** (= session 73 で確立): `color: rgba(255, 255, 255, 0.94)` + 2 段 shadow
- **既存 chrome button**: scramble + RGB chromatic aberration ghost
- **既存 pill 視覚言語**: ✓ 緑 / ⚠ アンバー / ! 赤 の 3 段意味体系
- **AllMarks success green**: `#28F100`
- **デフォルトテーマ**: 黒 + 白 minimal + 音波 motif
- **業界水準ヘッダ**: monospace 9px uppercase letter-spacing 0.14em opacity 0.4
- **scroll motion curve**: easeOutQuart 500-1200ms (= session 75 確立、 全 scroll で統一)
- **entry anim curve**: Material decelerate 380ms 6 段階 CRT bootup (= session 75 確立、 業界調査ベース)

## 守ること (= user memory + session 75 反省 参照)

- **「ムードボードは何もしなければ静か」** — memory `feedback_minimal_card_affordances`
- AI っぽいデザイン禁止、 emoji 禁止 — memory `feedback_design_quality`
- **「素人考えで」 の user 提案は教科書水準の可能性高い** — memory `feedback_layman_simple_path` (session 74-75 で 3 度実証: 案 C 採用 / source restore / scroll easing 統一の方向性 全部 user 直感が正解)
- **「私に流されずプロとして」 と言われたら短期合理性ではなく技術的正解を選ぶ** — session 74 で経験、 session 75 でも繰り返し実践 (= 業界調査 + bloom 最後型 / 終わり強化 quart 等)
- UI 英語は globally-clear、 中学英語動詞優先 — memory `feedback_globally_clear_english`
- クリックターゲット 32×32 px 以上 — memory `feedback_large_pointer`
- 「verify before claiming it works」 — memory `feedback_verify_before_claiming` (session 75 で 1000 倍速の罠で痛感、 console.warn 仕込みで確定)
- 一貫性目的の隣接波及は user 確認 — memory `feedback_dont_overgeneralize`
- **JSON export 等 reversible な保険を先に整備してから不可逆 operation に臨む** (= session 74-75 で Phase 0 の export 機能が安心材料、 「不可逆 IDB 変更」 ではない polish では関係ないが心構えとして)

## 進め方 (= 候補、 user 指示優先)

- 1 項目ずつ「現状確認 → 案提示 → user 承認 → 実装 → 検証」 の 4 ステップ
- 小さい調整は黙って実装でも OK、 大きい構造変更 (= 100 行+ refactor) は事前相談
- deploy は **Claude 判断で OK** (= session 73-75 で user 委任済)。 session 75 で 12 deploy、 1 日 16 上限内
- iter ベース 開発を継続 (= 数値調整 → user 体感 → fine-tune の loop)

## 確認事項・運用

- 確認は常に `booklage.pages.dev` をハードリロード (= Ctrl+Shift+R)
- 応答は日本語、 横文字カタカナ控えめ、 AskUserQuestion 多用しない
- deploy 前に tsc + vitest (= 既知 flake `tests/lib/channel.test.ts` 単体 PASS 確認で OK、 session 75 で 829 PASS 連続維持)
- deploy 手順: `pnpm build` → `npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="<ASCII>"`
- **🔴 月末 (2026-05-31) まで残り 5 日**: `allmarks.app` ドメイン取得確認 (memory `project_allmarks_domain_reminder`)
- Chrome Web Store 公開は ドメイン取得 + 主要 UX 安定後に検討

## session 75 で push 済 (= origin/master 同期完了)

session 75 のコミット (= 約 18 commit、 session 74 残り + session 75 全部) を一括 push 済。 万一の rollback は GitHub の commit history から個別 revert か、 `git reset` + force push が必要 (= 念のため備忘)。
