# LP スクロール演出(コレオグラフィ)実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** トップLP の各セクションに、PC幅限定で互いに異なるスクロール連動アニメ(Hero着地 / Problem横ワイプ / Features横スクロールジャック / ShareIt組み上がり / FinalCta色スクラブ / フッター全黒フィナーレ)を実装する。

**Architecture:** 既存の GSAP ScrollTrigger + Lenis 基盤を、まず両者が滑らかに連携するよう配線し直す。横移動量などの算術は純粋関数に切り出して TDD。各セクションは `gsap.matchMedia('(min-width:1024px) and (prefers-reduced-motion: no-preference)')` ブランチでのみアニメを構築し、それ以外(非PC幅 / reduced-motion)は既存の静的縦並びにフォールバック。

**Tech Stack:** Next.js 14 App Router(`output:'export'`)、TypeScript strict、GSAP + ScrollTrigger、Lenis、Vanilla CSS Modules、vitest。

## Global Constraints

- TypeScript `strict: true`、`any` 禁止(`unknown`+型ガード)、return type 明示。
- アニメは **GSAP + CSS keyframes のみ**(Framer Motion 禁止)。スタイルは Vanilla CSS Modules(Tailwind 禁止)。z-index はトークン管理(魔法の数値禁止)。
- **傾けない・回転しない・グリッド基準**。動きは translate / scale / opacity / clip-path / blur のみ。
- **PC幅(min-width:1024px)限定**かつ **`prefers-reduced-motion: reduce` では全演出オフ**。両条件を満たす時だけアニメ構築、それ以外は静的フォールバック必須。
- honest 表示維持(偽ドメイン/ラベルを足さない・既存の本物アセットを動かすだけ)。
- 触らない不変符号: `DB_NAME` 等の内部符号、`/board` 等のアプリ本体URL(言語接頭辞も付けない)。
- `tsc <file>` 直叩き禁止(stray `.js`)→ 型確認は `rtk tsc`(noEmit)。コマンドは `rtk` 前置。本番コードに `console.log` 残さない。
- 既存 vitest(現1110 pass)を壊さない・`rtk tsc` 0。
- 設計書: `docs/superpowers/specs/2026-06-18-lp-scroll-choreography-design.md`。

---

## ファイル構成

**新規:**
- `lib/scroll/horizontal-pin-math.ts` + `.test.ts` — 横ジャックの移動距離など純粋関数
- `lib/scroll/use-horizontal-pin.ts` — Features 横ジャックの ScrollTrigger 構築フック

**改修:**
- `lib/scroll/use-smooth-scroll.ts` — Lenis ↔ ScrollTrigger 配線(同一ループ + scroll で update)
- `components/marketing/sections/Features.tsx` + `Features.module.css` — 横トラック化 + 進捗バー + パネル小アニメ
- `components/marketing/sections/Hero.tsx`(+css)— 入場 timeline
- `components/marketing/sections/Problem.tsx`(+css)— 横ワイプ
- `components/marketing/sections/ShareIt.tsx`(+css)— 組み上がり
- `components/marketing/sections/FinalCta.tsx`(+css)— CTA 浮上
- `components/marketing/SiteFooter.tsx`(+css)/ `LandingPage.tsx` — 全黒フィナーレ

---

## Task 1: Lenis ↔ ScrollTrigger 配線

pin / scrub を滑らかに効かせるため、Lenis と GSAP を同一 raf ループに繋ぎ、Lenis の scroll で ScrollTrigger を更新する。現状は別々の raf で動いており、pin がカクつく/ズレる恐れがある。

**Files:**
- Modify: `lib/scroll/use-smooth-scroll.ts`

**Interfaces:**
- Produces: `useSmoothScroll()` は引き続き `RefObject<Lenis | null>` を返す(シグネチャ不変)。内部で `gsap.ticker` 駆動 + `lenis.on('scroll', ScrollTrigger.update)` を行う。

- [ ] **Step 1: 実装(差し替え)**

`lib/scroll/use-smooth-scroll.ts` を次に差し替える:

```ts
// lib/scroll/use-smooth-scroll.ts
'use client'

import { useEffect, useRef } from 'react'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * Initialize Lenis smooth scrolling and wire it to GSAP ScrollTrigger so that
 * pin/scrub animations stay in sync with the smooth scroll position. Both run
 * off gsap.ticker (one loop), and every Lenis scroll updates ScrollTrigger.
 * Tears down on unmount. Returns a ref to the Lenis instance.
 */
export function useSmoothScroll(): React.RefObject<Lenis | null> {
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    gsap.registerPlugin(ScrollTrigger)

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      touchMultiplier: 2,
    })
    lenisRef.current = lenis

    lenis.on('scroll', ScrollTrigger.update)

    const tick = (time: number): void => {
      // gsap.ticker time is seconds; Lenis.raf expects milliseconds
      lenis.raf(time * 1000)
    }
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(tick)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  return lenisRef
}
```

- [ ] **Step 2: 既存テスト + 型 + ビルドが壊れていないことを確認**

Run: `rtk tsc && rtk vitest run components/marketing/LandingPage.test.tsx`
Expected: tsc 0 / LandingPage テスト pass(`useSmoothScroll` は jsdom で no-op 前提=reduced-motion 早期 return、もしくは既存 mock パターンが効く)。落ちる場合は既存テストの mock 方法に合わせる(テストは Lenis を mock 済みのはず)。

- [ ] **Step 3: コミット**

```bash
rtk git add lib/scroll/use-smooth-scroll.ts
rtk git commit -m "feat(lp): wire Lenis to ScrollTrigger (shared ticker + scroll update) for pin/scrub"
```

---

## Task 2: horizontal-pin-math 純粋関数

横ジャックの「縦スクロール距離 → 横移動量」の算術を純粋関数化して TDD。ScrollTrigger 本体は jsdom でテスト不可なので、計算部分だけ確実にテストする。

**Files:**
- Create: `lib/scroll/horizontal-pin-math.ts`
- Test: `lib/scroll/horizontal-pin-math.test.ts`

**Interfaces:**
- Produces:
  - `horizontalScrollDistance(trackWidth: number, viewportWidth: number): number` — トラック全幅と viewport 幅から、横移動すべき総量(= `max(0, trackWidth - viewportWidth)`)を返す。
  - `panelProgress(globalProgress: number, panelCount: number, index: number): number` — 横ジャック全体の進捗(0..1)から、指定パネル(0始まり)のローカル進捗(0..1、範囲外は 0/1 にクランプ)を返す。パネル小アニメの発火タイミング計算に使う。

- [ ] **Step 1: 失敗するテストを書く**

`lib/scroll/horizontal-pin-math.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { horizontalScrollDistance, panelProgress } from './horizontal-pin-math'

describe('horizontalScrollDistance', () => {
  it('トラックが viewport より広い分だけ移動量になる', () => {
    expect(horizontalScrollDistance(5000, 1000)).toBe(4000)
  })
  it('トラックが viewport 以下なら 0(負にしない)', () => {
    expect(horizontalScrollDistance(800, 1000)).toBe(0)
  })
})

describe('panelProgress', () => {
  it('5パネル中、全体進捗0.0 は先頭パネルのローカル進捗0', () => {
    expect(panelProgress(0, 5, 0)).toBe(0)
  })
  it('5パネル中、全体進捗0.1 は先頭パネル(0..0.2区間)のローカル0.5', () => {
    expect(panelProgress(0.1, 5, 0)).toBeCloseTo(0.5)
  })
  it('範囲より前のパネルは0、後のパネルは1にクランプ', () => {
    expect(panelProgress(0.1, 5, 2)).toBe(0) // パネル2は0.4..0.6、まだ来てない
    expect(panelProgress(0.9, 5, 0)).toBe(1) // パネル0はとっくに過ぎた
  })
})
```

- [ ] **Step 2: 失敗を確認**

Run: `rtk vitest run lib/scroll/horizontal-pin-math.test.ts`
Expected: FAIL — モジュール未作成。

- [ ] **Step 3: 実装**

`lib/scroll/horizontal-pin-math.ts`:

```ts
/** Total horizontal travel for a pinned horizontal-scroll track. */
export function horizontalScrollDistance(trackWidth: number, viewportWidth: number): number {
  return Math.max(0, trackWidth - viewportWidth)
}

/**
 * Local progress (0..1) of one panel within an evenly-divided horizontal track.
 * globalProgress is the whole pin's 0..1 progress; the track is split into
 * `panelCount` equal segments and `index` selects one (0-based). Values before
 * the segment clamp to 0, after to 1.
 */
export function panelProgress(globalProgress: number, panelCount: number, index: number): number {
  const segment = 1 / panelCount
  const start = index * segment
  const local = (globalProgress - start) / segment
  return Math.max(0, Math.min(1, local))
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `rtk vitest run lib/scroll/horizontal-pin-math.test.ts`
Expected: PASS。

- [ ] **Step 5: コミット**

```bash
rtk git add lib/scroll/horizontal-pin-math.ts lib/scroll/horizontal-pin-math.test.ts
rtk git commit -m "feat(lp): horizontal-pin-math pure helpers (travel + panel progress)"
```

---

## Task 3: Features 横スクロールジャック(骨格)+ デプロイ確認

Features を横トラック化し、pin + scrub で5パネルを横に流す。まずは「横に流れる」骨格まで(パネル内の小アニメは Task 4)。これが一番の見せ場なので、ここで本番にデプロイしてユーザーに雰囲気を見てもらう。

**Files:**
- Create: `lib/scroll/use-horizontal-pin.ts`
- Modify: `components/marketing/sections/Features.tsx`、`components/marketing/sections/Features.module.css`

**Interfaces:**
- Consumes: `horizontalScrollDistance`(Task 2)
- Produces: `useHorizontalPin(opts: { sectionRef: RefObject<HTMLElement>; trackRef: RefObject<HTMLElement> }): void` — PC幅 + no-preference の時だけ、section を pin して track を横移動する ScrollTrigger を構築。クリーンアップで revert。

- [ ] **Step 1: 横ジャックフックを実装**

`lib/scroll/use-horizontal-pin.ts`:

```ts
'use client'
import { useEffect, type RefObject } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { horizontalScrollDistance } from './horizontal-pin-math'

/**
 * Pin a section and translate its inner track horizontally as the user scrolls
 * (scroll-jack). PC width only (min-width:1024px) AND only when the user has no
 * reduced-motion preference; otherwise no pin is created and the track stays in
 * its static (CSS) layout. Reverts fully on unmount / breakpoint change.
 */
export function useHorizontalPin(opts: {
  sectionRef: RefObject<HTMLElement>
  trackRef: RefObject<HTMLElement>
}): void {
  const { sectionRef, trackRef } = opts
  useEffect(() => {
    const section = sectionRef.current
    const track = trackRef.current
    if (!section || !track) return

    const mm = gsap.matchMedia()
    mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
      const distance = horizontalScrollDistance(track.scrollWidth, window.innerWidth)
      if (distance <= 0) return
      const tween = gsap.to(track, {
        x: -distance,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: () => `+=${distance}`,
          pin: true,
          scrub: true,
          invalidateOnRefresh: true,
          anticipatePin: 1,
        },
      })
      return () => {
        tween.scrollTrigger?.kill()
        tween.kill()
        gsap.set(track, { x: 0 })
      }
    })
    return () => mm.revert()
  }, [sectionRef, trackRef])
}
```

- [ ] **Step 2: Features を横トラック構造へ改修**

`components/marketing/sections/Features.tsx` の `Features` 関数を改修。`useReveal` は横ジャック時に競合するため、PC幅では `useHorizontalPin` に置き換え(縦並び時のフェードは CSS フォールバック側で別途)。`sequence` を `track`(横並びコンテナ)にし、`trackRef` を付ける:

```tsx
import { useHorizontalPin } from '@/lib/scroll/use-horizontal-pin'
// ...（useReveal の import は残す。下のフォールバックで使う）

export function Features(): React.ReactElement {
  const { t } = useI18n()
  const sectionRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  useHorizontalPin({
    sectionRef: sectionRef as React.RefObject<HTMLElement>,
    trackRef: trackRef as React.RefObject<HTMLElement>,
  })

  return (
    <section ref={sectionRef} id="features" className={styles.features}>
      <div className={styles.stage}>
        <p className={styles.kicker}>
          <span className={styles.kickerDash} aria-hidden="true" />
          FEATURES
        </p>

        <div ref={trackRef} className={styles.track}>
          {BEATS.map((beat) => (
            <article key={beat.num} className={styles.beat} data-panel>
              <div className={styles.beatText}>
                <p className={styles.beatNum}>
                  <span className={styles.num}>{beat.num}</span>
                  <span className={styles.numLabel}>{beat.label}</span>
                </p>
                <h3 className={styles.beatTitle}>{t(`landing.features.${beat.key}.title`)}</h3>
                <p className={styles.beatBody}>{t(`landing.features.${beat.key}.body`)}</p>
              </div>
              <div className={styles.beatVisual}>
                <BeatVisual visual={beat.visual} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: CSS 改修(横トラック・PC幅のみ横並び / 非PCは縦)**

`components/marketing/sections/Features.module.css` に追加・改修。**既存の `.beat` 内タイポ/visual のスタイルは保持**し、コンテナだけ横化する。PC幅で横並び、未満は従来の縦積みにフォールバック:

```css
/* 横トラック: PC幅のみ横並び。pin 中に section が viewport を占有する */
@media (min-width: 1024px) and (prefers-reduced-motion: no-preference) {
  .features { overflow: hidden; }              /* 横はみ出しを隠す */
  .track {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 0;
  }
  .beat {
    flex: 0 0 100vw;                            /* 1パネル = 全幅 */
    box-sizing: border-box;
    min-height: 100vh;
    padding: 0 clamp(48px, 8vw, 160px);
    margin: 0;
  }
}
/* 非PC幅 or reduced-motion: 従来の縦積み(既存挙動)。.track は通常フロー */
@media (max-width: 1023px), (prefers-reduced-motion: reduce) {
  .track { display: block; }
}
```

> 注: 既存 CSS に `.sequence` のスタイルがある場合は `.track` にリネーム or 併記。`rtk grep "sequence" components/marketing/sections/Features.module.css` で既存定義を確認し、縦並びの見た目を壊さないよう統合する。

- [ ] **Step 4: 型 + 既存テスト + ビルド**

Run: `rtk tsc && rtk vitest run && rtk pnpm build`
Expected: tsc 0 / 全 pass / build 成功。

- [ ] **Step 5: コミット**

```bash
rtk git add lib/scroll/use-horizontal-pin.ts components/marketing/sections/Features.tsx components/marketing/sections/Features.module.css
rtk git commit -m "feat(lp): Features horizontal scroll-jack skeleton (pin + scrub track)"
```

- [ ] **Step 6: 本番デプロイ + ユーザー視覚確認(コントローラが実施)**

```bash
rtk pnpm build
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true --commit-message="LP Features horizontal scroll-jack"
```
ユーザーに `allmarks.app` をハードリロードして Features の横スクロールを確認してもらう。動き・速度(scrub)・パネル幅・pin の安定を見て、好みを次タスク以降に反映する **calibration チェックポイント**。

---

## Task 4: Features パネル小アニメ + 音波プログレスバー

各パネルが中央に来たとき別々の小アニメを発火し、横ジャックの進捗を音波バーで常時表示する。

**Files:**
- Modify: `components/marketing/sections/Features.tsx`、`components/marketing/sections/Features.module.css`
- Modify: `lib/scroll/use-horizontal-pin.ts`(進捗を外へ渡す `onProgress` コールバック追加)

**Interfaces:**
- Consumes: `panelProgress`(Task 2)
- Produces: `useHorizontalPin` opts に `onProgress?: (p: number) => void`(0..1、scrub 中に呼ぶ)を追加。

- [ ] **Step 1: `useHorizontalPin` に onProgress を追加**

`lib/scroll/use-horizontal-pin.ts` の opts に `onProgress?: (p: number) => void` を足し、ScrollTrigger の `onUpdate: (self) => onProgress?.(self.progress)` を追加(他は不変)。型 return 明示。

- [ ] **Step 2: 進捗バー + パネル小アニメを Features に実装**

`Features.tsx` に音波プログレスバー要素(`<div className={styles.progress}><span ref={progressFillRef} /></div>`)を追加し、`onProgress` で `gsap.set(progressFill, { scaleX: p })`。各パネルの visual に `data-panel-anim="capture|layout|live|organize|privacy"` を付け、`containerAnimation` を使った入れ子 ScrollTrigger で中央到達時に発火する小アニメを構築する(別フック `usePanelAnims` に切り出してもよい)。各小アニメは別の from 値:

- capture: カード群を `{ scale: 0.8, opacity: 0 }` から中央へ収束
- layout: masonry 各カードを `{ y: 24, opacity: 0 }` から stagger 整列
- live: 音波バー(LIVE 内)を `scaleY` パルス(既存動画はそのまま)
- organize: pill/swatch を `{ x: -16, opacity: 0 }` から
- privacy: rows を `{ opacity: 0 }` → 内側に閉じる `{ letterSpacing }` 等

> 各小アニメは「PC幅 + no-preference」ブランチでのみ構築(matchMedia)。reduced-motion では visual は静的。

- [ ] **Step 3: 型 + 全テスト + ビルド**

Run: `rtk tsc && rtk vitest run && rtk pnpm build`
Expected: tsc 0 / 全 pass / build 成功。

- [ ] **Step 4: コミット**

```bash
rtk git add lib/scroll/use-horizontal-pin.ts components/marketing/sections/Features.tsx components/marketing/sections/Features.module.css
rtk git commit -m "feat(lp): Features per-panel micro-anims + sound-wave progress bar"
```

---

## Task 5: Hero 入場 timeline

Hero 読込時に、見出しが行ごとにマスク登場 → 画像カードが scale+フェードで時間差着地。既存パララックスは維持。

**Files:**
- Modify: `components/marketing/sections/Hero.tsx`、`Hero.module.css`

- [ ] **Step 1: 実装**

Hero に mount 用 `useEffect` を追加し、`gsap.matchMedia('(min-width:1024px) and (prefers-reduced-motion: no-preference)')` ブランチで入場 timeline を構築:見出し行(`[data-hero-line]`)を `{ yPercent: 110 }`(親に `overflow:hidden`)から `0` へ stagger、画像カード(`[data-hero-card]`)を `{ scale: 0.96, opacity: 0 }` から `1` へ stagger(`ease:'power3.out'`)。reduced-motion / 非PC では `gsap.set(..., {clearProps:'all'})` で静的。見出し行・カードに対応する `data-*` 属性と、行マスク用の `overflow:hidden` ラッパを CSS/JSX に追加。

- [ ] **Step 2: 型 + ビルド**

Run: `rtk tsc && rtk pnpm build`
Expected: tsc 0 / build 成功。

- [ ] **Step 3: コミット**

```bash
rtk git add components/marketing/sections/Hero.tsx components/marketing/sections/Hero.module.css
rtk git commit -m "feat(lp): Hero entrance timeline (line mask-up + card settle)"
```

---

## Task 6: Problem 横ワイプ

Problem 進入時に大きな一文が左→右に clip-path で拭い出される。

**Files:**
- Modify: `components/marketing/sections/Problem.tsx`、`Problem.module.css`

- [ ] **Step 1: 実装**

Problem の見出し要素に ScrollTrigger(`start:'top 75%'`)で `clip-path` を `inset(0 100% 0 0)`(右が隠れた状態)から `inset(0 0% 0 0)` へ tween(`duration:0.9, ease:'power3.inOut'`)。matchMedia の PC+no-preference のみ。reduced-motion では `clip-path:none` 静的。`useReveal` と二重に動かない様、Problem の見出しは reveal 対象(`data-reveal`)から外す。

- [ ] **Step 2: 型 + ビルド**

Run: `rtk tsc && rtk pnpm build`
Expected: tsc 0 / build 成功。

- [ ] **Step 3: コミット**

```bash
rtk git add components/marketing/sections/Problem.tsx components/marketing/sections/Problem.module.css
rtk git commit -m "feat(lp): Problem headline horizontal clip-wipe reveal"
```

---

## Task 7: ShareIt 組み上がり

完成ボードのタイルが枠内へ集まり1枚に → 透かしロゴがフェードイン。

**Files:**
- Modify: `components/marketing/sections/ShareIt.tsx`、`ShareIt.module.css`

- [ ] **Step 1: 実装**

ShareIt のボード枠内タイル(`[data-share-tile]`)を、ScrollTrigger(`start:'top 70%', scrub:true` または timeline)で各タイル別方向の `{ x, y, scale:0.85, opacity:0 }` から整列位置へ stagger 収束。最後に透かしロゴ(`[data-share-mark]`)を `opacity 0→1`。matchMedia PC+no-preference のみ。reduced-motion 静的。タイルに `data-share-tile` 属性を付与(無ければ JSX 追加)。

- [ ] **Step 2: 型 + ビルド**

Run: `rtk tsc && rtk pnpm build`
Expected: tsc 0 / build 成功。

- [ ] **Step 3: コミット**

```bash
rtk git add components/marketing/sections/ShareIt.tsx components/marketing/sections/ShareIt.module.css
rtk git commit -m "feat(lp): ShareIt board assembly reveal"
```

---

## Task 8: FinalCta CTA 浮上 + フッター全黒フィナーレ

既存の白→黒スクラブを維持しつつ黒地に CTA を浮上。フッター到達で全黒の幕を pin、中央に大きな Open Board ボタン。

**Files:**
- Modify: `components/marketing/sections/FinalCta.tsx`、`FinalCta.module.css`
- Modify: `components/marketing/SiteFooter.tsx`、`SiteFooter.module.css`

- [ ] **Step 1: FinalCta CTA 浮上**

FinalCta の CTA テキスト/ボタン(`[data-cta-rise]`)を、黒に切り替わるスクラブ進行に合わせて `{ y:40, opacity:0 }`→`{ y:0, opacity:1 }`。既存スクラブ構造を壊さず追加。matchMedia PC+no-preference のみ。

- [ ] **Step 2: フッター全黒フィナーレ**

`SiteFooter.tsx` の先頭に全黒フィナーレ幕(`[data-footer-finale]`、中央に大きな `Open Board →` = 既存 `/board` リンク・`SiteHeader` の openApp と同遷移)を追加。ScrollTrigger で幕を `pin`(`start:'top top', end:'+=<viewport高>'`)し、`opacity` で幕→ナビへ受け渡し。matchMedia PC+no-preference のみ。reduced-motion / 非PC では幕を pin せず、フッター先頭に同じ CTA を静的表示。z-index は `landing-tokens.css` にトークン追加(魔法の数値禁止)。

- [ ] **Step 3: 型 + 全テスト + ビルド**

Run: `rtk tsc && rtk vitest run && rtk pnpm build`
Expected: tsc 0 / 全 pass / build 成功。

- [ ] **Step 4: コミット**

```bash
rtk git add components/marketing/sections/FinalCta.tsx components/marketing/sections/FinalCta.module.css components/marketing/SiteFooter.tsx components/marketing/SiteFooter.module.css components/marketing/landing-tokens.css
rtk git commit -m "feat(lp): FinalCta CTA rise + footer full-black finale with Open Board"
```

---

## Task 9: 通し検証 + 本番デプロイ + ユーザー最終確認

**Files:** なし(検証・デプロイのみ)

- [ ] **Step 1: 通しで型 + 全テスト + ビルド**

Run: `rtk tsc && rtk vitest run && rtk pnpm build`
Expected: tsc 0 / 全 pass / build 成功。

- [ ] **Step 2: reduced-motion フォールバック確認**

`prefers-reduced-motion: reduce` で全セクションが静的縦並びで読めること(pin/横ジャックが無効)を、playwright か手動で確認。

- [ ] **Step 3: 本番デプロイ**

```bash
npx wrangler whoami
rtk pnpm build
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true --commit-message="LP scroll choreography"
```

- [ ] **Step 4: 本番(allmarks.app)実機確認(ユーザー)**

PC で全セクションのアニメ(Hero着地 / Problem横ワイプ / Features横ジャック+小アニメ+進捗バー / ShareIt組み上がり / FinalCta / フッター全黒)を通し確認。好みの微調整を反映。

- [ ] **Step 5: ドキュメント更新 + コミット**

`docs/TODO.md`「現在の状態」更新、`docs/TODO_COMPLETED.md` narrative 追記、`docs/CURRENT_GOAL.md` 上書き。

```bash
rtk git add docs/
rtk git commit -m "docs(session): LP scroll choreography shipped"
```

---

## Self-Review(計画 vs 設計書)

- 設計書 §セクション別コレオグラフィの6セクション → Task 5(Hero)/6(Problem)/3+4(Features)/7(ShareIt)/8(FinalCta+Footer)で全カバー ✓
- §横スクロールジャック技術設計 → Task 2(math)+3(骨格)+4(小アニメ/進捗) ✓
- §フッター全黒フィナーレ → Task 8 ✓
- §原則(PC限定 + reduced-motion オフ) → 全タスクで matchMedia `(min-width:1024px) and (prefers-reduced-motion: no-preference)` 統一 ✓
- §Lenis 共存 → Task 1 で配線(pin/scrub の前提) ✓
- 純粋関数の TDD → Task 2 ✓。ScrollTrigger 挙動はビルド + 本番実機で検証(設計書テスト方針通り) ✓
- 型整合: `useHorizontalPin`(Task 3 で定義 → Task 4 で onProgress 拡張)、`horizontalScrollDistance`/`panelProgress`(Task 2 → 3/4 で参照)整合 ✓
- スコープ外(スマホ最適化 / F-1 / コピー伝播 / LP残債)は計画に含めない ✓
