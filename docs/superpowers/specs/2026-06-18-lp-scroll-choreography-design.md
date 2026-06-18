# LP スクロール演出(コレオグラフィ)設計書

**作成:** 2026-06-18(セッション 109)
**対象:** トップLP(`/` および `/[locale]` 全言語)= `components/marketing/LandingPage.tsx` 配下のセクション群
**ブランチ:** `feat/lp-i18n-layer2-phase1`(層②第1段の磨き込みとして継続)

## ゴール

LP を「ただ並ぶ静的なセクション」から、**スクロールすると各セクションが上品に動いて入ってくるプロ品質のLP**へ引き上げる。各セクションで**異なる表現**を使い(同じ動きを繰り返さない=退屈にしない)、見せ場として Features を**横スクロールジャック**にし、最後にフッターを**全黒のフィナーレ**にする。

## 原則(厳守)

- **PC幅限定**。スマホ最適化は後回し(別タスク)。`gsap.matchMedia()` の `(min-width: 1024px)` クエリでのみ作動(= PC 閾値 1024px。これ未満は静的縦並び)。
- **`prefers-reduced-motion: reduce` では全演出オフ**。横ジャックも無効化し、普通の縦スクロールで全内容が読める静的状態にフォールバック(既存 `useReveal` と同じ作法)。
- **傾けない・回転しない・グリッド基準**(AllMarks の作法)。動きは移動(translate)・拡大縮小(scale)・フェード(opacity)・マスク(clip-path/inset)・ぼかし(blur)のみ。
- **GSAP + ScrollTrigger のみ**(Framer Motion 禁止)。Lenis 滑らかスクロールと共存(ScrollTrigger は Lenis の `scroll` に追従済みの前提=既存 `use-scroll-trigger` の登録を使う)。
- **既存資産を活かす**:`lib/scroll/use-reveal.ts`(フェード+上昇+stagger)、`lib/scroll/use-parallax-layer.ts`(パララックス)、`lib/scroll/parallax-math.ts`。新規はフック追加で対応し、巨大化させない。
- **音波モチーフ**(waveform/振幅)をプロジェクト共通の着想源として Features の進捗バーと LIVE パネルに織り込む([[project_theme_sound_wave]])。
- **honest 表示**を崩さない:偽ドメイン/ラベルを足さない。アニメは既存の本物アセット(CC0画像 / NASA動画)を動かすだけ。

## セクション別コレオグラフィ(全部別の質感)

| # | セクション | 演出 | 技術 |
|---|---|---|---|
| 1 | **Hero** | 読込時:見出しが行ごとに下からマスク登場(clip wipe up)→ 画像カードが scale 0.96→1 + フェードで時間差着地。既存の奥行きパララックスは維持。 | 入場 timeline(ScrollTrigger 不要、mount で1回)+ 既存 parallax |
| 2 | **Problem** | 進入時:大きな一文が左→右に拭い出される(clip-path inset 横ワイプ)。Hero の"着地"と差別化した"出現"。 | ScrollTrigger `start: top 75%`、clip-path tween |
| 3 | **Features 01–05** | **横スクロールジャック**。セクションを pin、5パネルを横トラックで translateX。各パネルが画面中央に来たとき**別々の小アニメ**を発火(①CAPTURE=カードが中央へ収束 ②LAYOUT=masonry がグリッドに整列 ③LIVE=音波バーが脈打つ ④ORGANIZE=タグ/スウォッチが絞り込み再配置 ⑤PRIVACY=要素が内側に閉じる)。**細い音波プログレスバー**で横進捗を常時表示(閉じ込め不安の解消)。 | ScrollTrigger `pin: true` + `scrub` + 横トラック translateX。各パネルに入れ子 ScrollTrigger(`containerAnimation`)で小アニメ発火 |
| 4 | **ShareIt** | 完成ボードが組み上がる:画像タイルが枠内へ集まり1枚のボードに → 透かしロゴがフェードイン。 | ScrollTrigger scrub、タイルごとの from(x/y/scale) stagger |
| 5 | **FinalCta** | 既存の白→黒スクラブを維持しつつ、黒地にセリフ CTA が scale+フェードで浮上。 | 既存 scrub + 追加 tween |
| 6 | **フッター(フィナーレ)** | 到達すると**画面全体が真っ黒に固定(pin)**、中央に大きな **「Open Board →」ボタン**がフィナーレ出現 → 解除でナビ(Product/Company/Legal)が現れる。 | ScrollTrigger `pin` + フェード。CTA は既存 `/board` リンク |

**バリエーション確認**(同じ表現を使わない):着地/scale(Hero)・横ワイプ(Problem)・横ジャック+5種小アニメ(Features)・組み上がり(ShareIt)・色スクラブ(FinalCta)・全黒 pin フィナーレ(Footer)= 全部別物。

## 横スクロールジャックの技術設計(Features)

現状 Features は `.sequence` 内に5つの `.beat` が縦積み(`components/marketing/sections/Features.tsx:304-325`)。これを横トラック化する:

- **マークアップ**:`.sequence` を横並びの **track**(`display:flex; width: 5パネル分`)に変更。各 `.beat` は `width: 100vw`(またはパネル幅)で横に並ぶ。縦積みの DOM 構造・i18n キー・BeatVisual はそのまま流用(レイアウトCSSのみ差し替え、PC幅のみ)。
- **pin + scrub**:`ScrollTrigger.create({ trigger: section, pin: true, scrub: true, start: 'top top', end: () => '+=' + トラック横幅, animation: gsap.to(track, { x: -(トラック幅 - 100vw) }) })`。縦スクロール量を横移動に変換。
- **パネル内小アニメ**:各パネルの visual に `containerAnimation`(= 上記横 tween)を `trigger` にした入れ子 ScrollTrigger を付け、パネルが中央付近に来たら発火。5種それぞれ別の from 値。
- **進捗バー**:pin 中のセクション上端 or 下端に、横ジャックの `self.progress` を幅に反映する細い音波バー。`onUpdate` で `scaleX` を更新。
- **reduced-motion / 非PC**:`gsap.matchMedia` の PC+no-preference ブランチでのみ pin を作る。それ以外では track を縦積み(現状 CSS)に戻し、`useReveal` 相当のフェードのみ。
- **新規フック** `lib/scroll/use-horizontal-pin.ts`(純粋な算術部分 = トラック移動距離計算 `horizontalScrollDistance(trackWidth, viewportWidth)` を `lib/scroll/horizontal-pin-math.ts` に切り出し、TDD でテスト)。

## フッター全黒フィナーレの技術設計

`SiteFooter.tsx` を pin 対象にする(または LandingPage に finale ラッパを足す):

- フッター到達時、フッターのトップ領域を `pin` して **全黒の幕**を viewport に固定、中央に大きな `Open Board →`(既存 `/board` リンク、`SiteHeader` の openApp と同じ遷移)。
- スクロール継続で幕がフェードアウト/スクロールアップし、既存の3カラムナビが現れる。
- reduced-motion では pin せず、フッター先頭に同じ CTA を静的表示。

## ファイル構成

**新規:**
- `lib/scroll/horizontal-pin-math.ts` + `.test.ts` — 横移動距離などの純粋関数(TDD)
- `lib/scroll/use-horizontal-pin.ts` — Features 横ジャックの ScrollTrigger 構築フック(PC+no-preference のみ)
- `components/marketing/sections/FooterFinale`(or LandingPage 内ラッパ)— 全黒フィナーレ(必要に応じて)

**改修:**
- `components/marketing/sections/Hero.tsx`(+css)— 入場 timeline
- `components/marketing/sections/Problem.tsx`(+css)— 横ワイプ
- `components/marketing/sections/Features.tsx` + `Features.module.css` — 横トラック化 + 進捗バー + パネル小アニメ
- `components/marketing/sections/ShareIt.tsx`(+css)— 組み上がり
- `components/marketing/sections/FinalCta.tsx`(+css)— CTA 浮上(既存スクラブ維持)
- `components/marketing/SiteFooter.tsx`(+css)/ `LandingPage.tsx` — 全黒フィナーレ

## テスト方針

- **純粋関数**(`horizontal-pin-math` 等)= vitest で TDD。
- **ScrollTrigger/pin の挙動**は jsdom で再現不可 → **ビルドが通ること + 本番(allmarks.app)実機でセクションごとに目視確認**で検証(LP のスクロール演出は本来そういう性質)。各セクションを1つずつ ship してユーザーに見てもらい、好みを反映してから次へ。
- 既存 vitest(現1110 pass)・`rtk tsc` 0 を壊さない。reduced-motion での静的フォールバックを必ず確認。

## スコープ外(やらない=YAGNI)

- スマホ/タブレットのスクロール演出最適化(後日別タスク。今回は非PC幅では静的縦並びにフォールバックするのみ)。
- F-1(言語別タイトルの多言語化)・コピーの英語+13言語伝播=本演出とは別タスク(LP磨き込みの別項目として並行)。
- 既存 LP残債(`#save-demo` / RefObject キャスト / aurora クレジット)はこの設計の対象にしない。

## 進め方

見せ場の **Features 横ジャック**から雛形を作って本番で雰囲気を確認 → OK なら他セクションへ展開。1セクションずつ ship してユーザーの好みを反映する反復方式。
