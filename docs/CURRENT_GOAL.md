# 次セッションのゴール (= セッション 79) — 残り polish + convex bezel 別アプローチ + ドメイン取得確認

## 今のゴール (1 行)

**session 78 で /triage の屈折を「全体歪みタイプ」 で着地 (= LightningCSS prefix collapse 真因解明 + ::before z-ladder 確立)、 ただし「ガラスの縁に沿って線が曲がる」 convex bezel は β 案 (lib/glass/displacement-map 動的生成) で 2GB メモリ blow up し撤回。 次は残り polish (a)(b)(c)(e)(f) から着手 + convex bezel 真挑戦は α 案 (= pre-built PNG triplet) で別途、 2026-05-28 朝以降 allmarks.app 取得確認**。

## 開始時の動き (= Claude の最初の発言)

1. **🔴 allmarks.app ドメイン取得確認** (= 2026-05-28 朝以降 user 取得予定)
2. user に「**残り polish (a)(b)(c)(e)(f) から 1 つずつ片付け** から始めますか? **convex bezel α 案** (= pre-built PNG triplet) を先に挑戦? それとも **Phase D 5 項目** 着手?」 と聞く
3. user 指定したら「現状確認 → 案提示 → user 承認 → 実装 → 検証」

## session 78 到達点 (= booklage.pages.dev で動作中)

### ガラス屈折の真因解明 (= session 78 最大成果)
- **LightningCSS prefix collapse バグ**: CSS で `backdrop-filter` と `-webkit-backdrop-filter` を同 value 両書きすると `-webkit-` only に collapse、 modern Chromium で computed `none`。 非 prefix だけ書いて LightningCSS 自動 prefix に任せるのが正解 ([memory](../C:/Users/masay/.claude/projects/.../memory/reference_lightningcss_prefix_collapse_backdrop_filter.md))
- **stacking context 設計**: `.canvas` が「装飾 + 子要素コンテナ」 兼任だと子が外に出られない、 装飾を `::before` に逃がして容器と中身を分離 ([TriagePage.module.css:119-156](components/triage/TriagePage.module.css#L119-L156))

### 屈折の見え方
- canvas 内で grid 線が **歪み・波打ち** = displacement 機能、 user 評価「ちゃんとしてる!」
- ただし「**縁に沿って曲がる**」 convex bezel ではなく「**全体歪み**」 タイプ
- 静的 PNG (`/displacement/glass-001.png`) + scale 80、 メモリ健全

### 撤回: β 案 (lib/glass/displacement-map 動的生成)
- 1265×576 パネル × dpr×4 super-sampling = 7300 万 pixel loop で **タブ 2GB**、 user 「怖い」 報告 → 即撤回
- 既存 `lib/glass/displacement-map.ts` は ~150px 用、 大パネルで OOM ([memory](../C:/Users/masay/.claude/projects/.../memory/reference_displacement_map_large_pane_memory.md))

## 残 polish (= session 73 → 77 → 78 から持ち越し継続)

- **(a)** 「しゅっ」 アニメ気持ちよさ (= TriageCard 4 方向 exit 220ms 3 段、 別メタファー検討)
- **(b)** タグ削除 UI inline 化 (= window.confirm から、 mood board 世界観に統一)
- **(c)** EntryPicker (= 「未分類のみ / 全部」 二択画面) 配置・トンマナ
- **(e)** Shift 副タグ切替の体感調整
- **(f)** co-tags strip 余白・密度 最終調整

## convex bezel 真挑戦 (= session 79 候補、 α 案)

「ガラスの縁に沿って線が曲がる」 = Apple Liquid Glass の convex bezel を実現する別 path:

**α 案 = pre-built PNG triplet** (= Desktop Claude 推奨、 kube.io 完コピ):
1. `scripts/build-displacement-map.ts` を新規作成、 Node スクリプトで 3 枚 PNG を **build 時に 1 度だけ**生成:
   - `/displacement/glass-001-bezel.png` (= convex bezel displacement、 R=X 変位 / G=Y 変位、 縁のみ強く中央 grey)
   - `/displacement/glass-001-specular.png` (= 縁のリムライト α マスク、 中央透明 / 外周 feather 付き白)
   - `/displacement/glass-001-magnify.png` (= 中央拡大 displacement、 不要なら scale=0 で実質 OFF)
2. SVG filter を 11 段に拡張 (= kube.io の "Precision Lens" 構造): displacement + saturate + composite + blend × 2、 ただし大パネル想定でメモリ軽量
3. ResizeObserver で `<feImage>` の width/height を canvas 実寸に更新 (= データ自体は 静的 PNG なのでメモリ軽い)
4. 校正グリッドを **一時復元** して数値調整 (= bezelPercent 相当を user 評価で決定)、 完了後撤去

これは別 session 1-2 回かかる作業、 polish 系を片付けた後で着手推奨。

## Phase D 必須 5 項目 (= backlog、 機能追加)

- **D1** 中断再開 (= localStorage 完了 id 永続)
- **D2** 「しゅっ」 アニメ進化 (= a と関連)
- **D3** タグ削除 楽しい fx (= b と関連)
- **D4** 他 14 言語 mood → tag rename
- **D5** NewMoodInput → NewTagInput rename

## session 78 で確立した design 知見 (= 再利用ストック)

- **LightningCSS prefix collapse on backdrop-filter** (= 新 memory): 非 prefix だけ書く
- **displacement-map は大パネルで OOM** (= 新 memory): ~150px 限定、 大物は静的 PNG
- **stacking context 二段の罠**: 親 `.root` + 子 `.canvas` 両方が context を作ると子の z-index が外に出られない、 `isolation: isolate` + `::before` で分離
- **Desktop Claude 診断 pattern**: user 経由で 3 回追加診断、 全部正鵠、 次セッション以降も活用
- **校正グリッド戦略 (= session 77 user 提案) は LightningCSS バグも検出**: 視覚効果系のデバッグに universally 効く

## 守ること (= user memory + session 78 反省 参照)

- **「対話で進める、 一括で 3 つも 4 つも変えない」** — session 77-78 通じて user 一貫主張
- **「verify before claiming it works」** — memory `feedback_verify_before_claiming`、 deploy 後自分で playwright で screen shot or computed style 確認してから user に投げる (= session 78 で 何度か怠って user に「自分で見てわかりませんか?」 と叱られた)
- **100 行+ refactor / 新 component 廃止前は方針確認** — memory `feedback_consult_before_big_changes`
- **AskUserQuestion で polish 系を聞かない** — memory `feedback_no_question_box_for_design`
- **メモリ blow up は即撤回**: 視覚効果より user の安心感優先、 怖がられたら諦め切替

## 進め方 (= 候補、 user 指示優先)

- 1 項目ずつ「現状確認 → 案提示 → user 承認 → 実装 → 検証」 の 4 ステップ
- deploy は **Claude 判断で OK** (= session 75-78 で user 委任済)、 ただし 1 日 16 deploy 上限を意識
- 大きい構造変更 (= 100 行+ refactor) は事前相談、 user 「怖い案出さないで」

## 確認事項・運用

- 確認は常に `booklage.pages.dev` をハードリロード (= Ctrl+Shift+R)
- 応答は日本語、 横文字カタカナ控えめ、 AskUserQuestion 多用しない (= 特に design 系)
- deploy 前に tsc + vitest (= 既知 flake `tests/lib/channel.test.ts` 単体 PASS 確認で OK)
- deploy 手順: `pnpm build` → `npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="<ASCII>"`
- **🔴 ドメイン (2026-05-28 朝以降)**: `allmarks.app` 取得確認 (memory `project_allmarks_domain_reminder`)
