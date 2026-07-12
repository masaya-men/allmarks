# 次セッションのゴール — N-56 の恒久修正を実機で確認（100枚で画像が出るか）→ 出れば N-56 完了・N-58 段階1 へ

## ★s188 の道のり（原因確定 → 修正出荷まで、全て本番反映済）

1. **s188 診断可視化**: 撮影の各段失敗を画面に出す＋倍率フォールバック＋真っ白検出。だが実機は想定より深刻だった。
2. **s188 実機結果 = iOS OOM タブクラッシュ**: 100枚 SELECT ALL で共有ボードは出るが CREATE（撮影）で**タブごと強制終了**（黒画面→再読込→ボード・繰り返すと Safari が止める）。リンクも作られない＝`createHostedShare` 到達前に死亡＝catch 不能。画面診断も倍率フォールバックも**タブが死ぬと道連れ**＝1回目の撮影を軽くするしかない。
3. **s188.1 パンくず（クラッシュ耐性診断）**: `lib/share/capture-breadcrumb.ts`（localStorage 同期）＋`CaptureCrashNotice.tsx`（次回起動時に琥珀枠）。→ 実機で**決定的な数字**が取れた: `100 cards · canvas 1200×1744 (x3.2) · images 78MP`。
4. **主犯確定 = 画像埋め込み**: canvas は 1200×1744=210万画素（約8MB・無害）。**images 78MP = 撮影時に全カード画像を原寸展開で約310MB → タブ上限超過**（canvas の約37倍）。倍率・帯では直らない、画像を縮小するしかない、と数字で確定。
5. **s188.2 恒久修正 出荷（本番反映）= 撮影時のカード画像 適応縮小**: `lib/share/capture-thumbnails.ts`（`captureThumbnailMaxPx`＝合計約12MP予算・100枚→346px・少数→原寸1200／`buildCaptureThumbnailMap`＝proxy 経由 fetch＋canvas 縮小・同時実行4でメモリ安全）。`capture-collage.ts` に `captureThumbnails?` opt（**デスクトップは渡さない＝`?? rewriteToProxy` で byte-identical**）。BoardRoot モバイル撮影のみ、多枚数時にサムネ Map を作って渡す（少数は Map を作らず原寸＝現行不変）。tsc0 / **vitest 2277** / build OK。

## ★次にユーザーへ頼むこと（1回だけ・コピペで渡す）

```
スマホ Safari を一度完全に閉じて開き直し → https://allmarks.app
1. SHARE → SELECT ALL（100枚）→ CREATE
2. どうなったか教えてください:
   ・画像プレビューが出た → 直りました🎉（N-56 完了）
   ・まだ黒画面で落ちる → 戻った直後の黄色い枠の英数字（images ◯◯MP）を送る
```

## ★結果に応じて

- **画像が出た** → N-56 完了。**N-58 段階1（スマホでコラージュ編集）へ**。
- **まだ落ちる** → パンくずの `images ◯◯MP` が下がっているはず（縮小が効いた証拠）。まだ大きければ予算（`captureThumbnailMaxPx` の budgetMP=12）をさらに下げる／サムネ化の失敗（proxy fetch 落ち）で原寸フォールバックが多い可能性を調べる。数字ドリブンで詰める。
- どちらでも **デスクトップ SHARE はバイト同一**／`fit:'cover'` 固定／撮影失敗でもリンクは作る、を死守。

> 撮影は実機でしか検証できない（Playwright は canvas/メモリ挙動を再現しない）。この修正の効果確認は**必ず実機**。

## ★毎セッション共通のキックオフ（ユーザーはこれを貼るだけ・実行フェーズは Sonnet 中心で開始）

```
セッション開始。docs/CURRENT_GOAL.md → docs/superpowers/plans/2026-07-11-s186-remaining-work-roadmap.md
の順に読み、実行順の先頭にある未完了タスクを、その詳細計画書どおりに実行して。
- superpowers:subagent-driven-development で、計画書の各タスク見出しの推奨モデル
  （【Haiku 可】【Sonnet 推奨】）どおりにサブエージェントへ割り当てること。迷ったら1つ上。
- 検証（rtk tsc / vitest は素の npx vitest run / pnpm build / 計画書指定の Playwright）→ デプロイ →
  TODO.md・CURRENT_GOAL.md の更新 → commit/push まで自走する。
- 私（ユーザー）に頼るのは「実機確認」「計画書に書かれた1行判断」だけ。依頼はコピペ形式で。
```

## 実行順（ロードマップ §1・s187 更新版）

N-56（★s188 診断出荷済・実機読み待ち）→ N-58段階1 → N-58段階2 → N-57+59 → N-54 → N-53 → CUTOUT → **TOWER（公開前）** → 束C → 束D → 束E（公開）→ 公開後: BULK-IMPORT → 花火: K3 + cyber-space（シェーダーA）＋プレミアム群

## 絶対に守ること（恒久ルール・継承）

- 撮影は実機でしか検証できない／ボードを変えたら受け取り画面も確認／`fit:'cover'` 固定／`CardsLayer` に `isMobile` 渡さない／デスクトップ 1px 不変（承認済み新機能の意図された変更を除く）／`rtk` 前置・`--no-verify` 禁止／機微は `docs/private/` へ／**vitest は素の `npx vitest run`**（`rtk npx` は誤解析する）。
- 拡張の一括取り込みは **Task 0（実 DOM 採取）完了まで selector を書かない**（s49 の教訓・計画書に明記済み）。
