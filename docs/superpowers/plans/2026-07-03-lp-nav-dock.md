# N-05 LP ナビ格納演出 (NavDockTraveler) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 5つのマーケサブページ（features/guide/about/faq/contact）で、冒頭の kicker（緑玉＋ページ名）がスクロールでヘッダーのガラス帯に乗り上がり→右へダッシュ→ナビの自分のスロットにバウンド着地する演出（可逆）。

**Architecture:** 純関数（状態遷移＋モーフ進捗）を `lib/scroll/nav-dock-math.ts` に置き vitest で TDD。表示は新規 `NavDockTraveler`（position:fixed の word、rAF+scroll で実 DOM rect 追従）。実 kicker とナビの実ラベルは CSS（`html[data-nav-dock]` 属性ゲート）で隠すだけ＝SSR/reduced-motion/JS無効では今日と同一表示。判定は範囲＋ラッチ式（`anchorTop <= dockY` / `>= dockY+10`）で Lenis 慣性でもすり抜け不能。

**Tech Stack:** React client component / Vanilla CSS Modules / Lenis（既存 `useSmoothScroll`）/ CSS transition（GSAP 不要：ダッシュは left/top transition + easing カーブ）

## Global Constraints

- 応答・UI 文言: UI 追加文言なし（既存ラベルのみ使用）
- **トップ LP（`/`）は一切変更しない**。ボード盤面は完全非接触
- **at-rest（未スクロール・演出無効時）は今日と同一表示**: html 属性が無い限り新 CSS は発火しない
- reduced-motion / ≤960px / kicker≠ナビ語（13言語）/ JS無効 → 演出オフ＝通常表示（ユーザー確認済み: 2026-07-03）
- Tailwind 禁止 / Framer Motion 禁止 / any 禁止 / rem 禁止（px のみ）
- 検証: `rtk tsc` 0 / `rtk vitest run` 緑（channel.test.ts はフレーキー→再実行）/ `pnpm build` OK
- **偽保存対策**: 各 Write/Edit 後に独立 Read で実在確認、各 commit 後に `git log --stat -1` の実出力確認

## 実コードで確認した事実（2026-07-03 再検証済み・spec の誤りを修正）

| spec の記述 | 実物 |
|---|---|
| `SubpageHero.tsx` がある | **無い**。各 `*Content.tsx` が個別に `<p className={styles.kicker}>` を持つ（features/guide/faq= `intro-page.module.css`, contact= `legal-page.module.css`, about= `AboutContent.module.css`。kicker スタイルは3ファイルとも同一: geist-mono 12px/500/0.2em/uppercase/ink-soft、dot 7px 緑+4pxリング） |
| SiteHeader に `active` 判定と `t(item.key)` | **無い**。`NAV_ITEMS` はハードコード英語ラベル。`active` 判定はこの実装で新設 |
| 15言語で kicker 英語固定 | **誤り**。en/ja のみ英語一致。ar/de/es/fr/it/ko/nl/pt/ru/th/tr/vi/zh はローカライズ済 → **語一致ゲートで自動オフ** |
| FaqContent `kicker="About"` バグ | **実在しない**（i18n キー `pages.faq.hero.kicker`="FAQ"）。修正タスク不要 |
| kicker 13px/--lp-sans | 実物は **12px/geist-mono** |

- ヘッダー: fixed 64px、`data-scrolled` は自前 scroll listener（Lenis 下でも native scroll 発火＝トップLPで実績あり）
- navLink: --lp-sans 14px/450/-0.005em/ink-soft、height36px padding 0 12px、gap 4px
- ≤960px で `.navLink:nth-child(n+4)`（FAQ/Contact）非表示、≤640px で全 navLink 非表示 → **≥961px ゲート**
- 5ページとも route から `subpath` が MarketingShell に渡っている（`app/(marketing)/*` と `app/[locale]/*` の両方）
- プロト確定値: GLASS_START=64+56=120 / dockY=32 / ダッシュ460ms `cubic-bezier(.34,1.42,.64,1)` / 復帰300ms / 文字ごと28ms 遅延・translateY(6px) 乗り上がり / ラッチ式範囲判定

## File Structure

- Create: `lib/scroll/nav-dock-math.ts` — 純関数（進捗・状態遷移・適用判定）
- Create: `lib/scroll/nav-dock-math.test.ts`
- Create: `components/marketing/NavDockTraveler.tsx` — traveler 本体（rect 追従・html 属性オーナー）
- Create: `components/marketing/NavDockTraveler.module.css`
- Modify: `components/marketing/SiteHeader.tsx` — active スロット（通常ラベル＋ghost スロットの2枚持ち、CSS で切替）
- Modify: `components/marketing/SiteHeader.module.css` — `.navLabelPlain` / `.dockSlot` / `.slotDot`（`:global(html[data-nav-dock])` ゲート）
- Modify: `components/marketing/MarketingShell.tsx` — `useSmoothScroll()`＋traveler マウント
- Modify: `components/marketing/landing-tokens.css` — anchor kicker を隠す属性ゲート（global・非 module）
- Modify: 5ページ `FeaturesContent/GuideContent/AboutContent/FaqContent/ContactContent.tsx` — kicker `<p>` に `data-nav-dock-anchor` を1行ずつ

---

### Task 1: 純関数 nav-dock-math（TDD）

**Files:**
- Create: `lib/scroll/nav-dock-math.ts`
- Test: `lib/scroll/nav-dock-math.test.ts`

**Interfaces (Produces):**
```ts
export type DockMode = 'armed' | 'traveling' | 'docked'
export const NAV_DOCK = { headerH: 64, dockY: 32, glassStart: 120, glassOnAt: 0.06, releaseGap: 10, restGap: 8, zipMs: 460, returnMs: 300, charDelayMs: 28 } as const
export function morphProgress(anchorTop: number): number            // 0..1
export function nextDockMode(mode: DockMode, anchorTop: number): DockMode
export function isDockEligible(args: { reducedMotion: boolean; viewportWidth: number; kickerText: string | null; navLabel: string }): boolean
```

- [ ] **Step 1: 失敗するテストを書く**

```ts
// lib/scroll/nav-dock-math.test.ts
import { describe, expect, it } from 'vitest'
import { NAV_DOCK, isDockEligible, morphProgress, nextDockMode } from './nav-dock-math'

describe('morphProgress', () => {
  it('glassStart より下では 0', () => {
    expect(morphProgress(500)).toBe(0)
    expect(morphProgress(NAV_DOCK.glassStart)).toBe(0)
  })
  it('dockY で 1、さらに上（負方向）でも 1 に張り付く', () => {
    expect(morphProgress(NAV_DOCK.dockY)).toBe(1)
    expect(morphProgress(-200)).toBe(1)
  })
  it('中間は線形補間（glassStart と dockY の中点で 0.5）', () => {
    const mid = (NAV_DOCK.glassStart + NAV_DOCK.dockY) / 2
    expect(morphProgress(mid)).toBeCloseTo(0.5, 5)
  })
})

describe('nextDockMode（範囲＋ラッチ式＝Lenis の慣性で1フレームに大きく飛んでもすり抜けない）', () => {
  it('armed: ガラス帯進入（進捗>glassOnAt）で traveling', () => {
    expect(nextDockMode('armed', NAV_DOCK.glassStart - 20)).toBe('traveling')
  })
  it('armed: 帯より下では armed のまま', () => {
    expect(nextDockMode('armed', 400)).toBe('armed')
  })
  it('traveling: anchorTop <= dockY で docked（大きく飛び越しても範囲判定で捕まえる）', () => {
    expect(nextDockMode('traveling', NAV_DOCK.dockY)).toBe('docked')
    expect(nextDockMode('traveling', -500)).toBe('docked')
  })
  it('traveling: 帯の外（restGap 分のヒステリシス）へ戻ったら armed', () => {
    expect(nextDockMode('traveling', NAV_DOCK.glassStart + NAV_DOCK.restGap + 1)).toBe('armed')
  })
  it('traveling: 帯内にいる間は traveling を維持', () => {
    expect(nextDockMode('traveling', 60)).toBe('traveling')
    expect(nextDockMode('traveling', NAV_DOCK.glassStart + 2)).toBe('traveling')
  })
  it('docked: dockY+releaseGap まで戻ったら traveling（それまでは docked 維持）', () => {
    expect(nextDockMode('docked', NAV_DOCK.dockY + NAV_DOCK.releaseGap)).toBe('traveling')
    expect(nextDockMode('docked', NAV_DOCK.dockY + NAV_DOCK.releaseGap - 1)).toBe('docked')
    expect(nextDockMode('docked', -100)).toBe('docked')
  })
})

describe('isDockEligible', () => {
  const base = { reducedMotion: false, viewportWidth: 1489, kickerText: 'Features', navLabel: 'Features' }
  it('全条件成立で true', () => {
    expect(isDockEligible(base)).toBe(true)
  })
  it('reduced-motion で false（ユーザー確定 2026-07-03: OS設定を尊重して全オフ）', () => {
    expect(isDockEligible({ ...base, reducedMotion: true })).toBe(false)
  })
  it('960px 以下は false（ナビにスロットが無い）', () => {
    expect(isDockEligible({ ...base, viewportWidth: 960 })).toBe(false)
    expect(isDockEligible({ ...base, viewportWidth: 961 })).toBe(true)
  })
  it('kicker とナビ語の不一致（ローカライズ済み13言語）は false', () => {
    expect(isDockEligible({ ...base, kickerText: '기능' })).toBe(false)
    expect(isDockEligible({ ...base, kickerText: null })).toBe(false)
  })
  it('大文字小文字・前後空白は無視して一致扱い（kicker は CSS uppercase 表示のため）', () => {
    expect(isDockEligible({ ...base, kickerText: '  FEATURES ' })).toBe(true)
  })
})
```

- [ ] **Step 2: 落ちることを確認** — `rtk vitest run lib/scroll/nav-dock-math.test.ts` → FAIL（module not found）
- [ ] **Step 3: 実装**

```ts
// lib/scroll/nav-dock-math.ts
/**
 * N-05 LP ナビ格納演出の純関数層。
 * anchorTop = 本文 kicker の viewport 基準 top(px)。ヘッダーは fixed 64px。
 * 状態遷移は「範囲＋ラッチ式」: しきい値を跨いだ *範囲* で判定するため、
 * Lenis の慣性スクロールで 1 フレームに大きく飛んでも取りこぼさない。
 */
export type DockMode = 'armed' | 'traveling' | 'docked'

export const NAV_DOCK = {
  /** ヘッダー高（SiteHeader.module.css .header height と一致） */
  headerH: 64,
  /** 着地判定線 = ヘッダー中央 */
  dockY: 32,
  /** モーフ開始線（ヘッダー下端から 56px 下） */
  glassStart: 120,
  /** この進捗を超えたら traveler が語を引き取る（1文字ずつ乗り上がり開始） */
  glassOnAt: 0.06,
  /** docked → traveling へ戻すヒステリシス(px) */
  releaseGap: 10,
  /** traveling → armed へ戻すヒステリシス(px) */
  restGap: 8,
  /** ダッシュ（しゅっ→バウンド着地）の時間(ms) */
  zipMs: 460,
  /** 上スクロールで本文へ帰る時間(ms) */
  returnMs: 300,
  /** 1文字ごとの乗り上がり遅延(ms) */
  charDelayMs: 28,
} as const

/** kicker の top から モーフ進捗 0→1 を返す（glassStart で 0, dockY で 1） */
export function morphProgress(anchorTop: number): number {
  const p = (NAV_DOCK.glassStart - anchorTop) / (NAV_DOCK.glassStart - NAV_DOCK.dockY)
  return Math.max(0, Math.min(1, p))
}

/** 現在モードと anchorTop から次モードを返す（副作用なし） */
export function nextDockMode(mode: DockMode, anchorTop: number): DockMode {
  if (mode === 'docked') {
    return anchorTop >= NAV_DOCK.dockY + NAV_DOCK.releaseGap ? 'traveling' : 'docked'
  }
  if (mode === 'traveling') {
    if (anchorTop <= NAV_DOCK.dockY) return 'docked'
    if (anchorTop > NAV_DOCK.glassStart + NAV_DOCK.restGap) return 'armed'
    if (morphProgress(anchorTop) <= 0) return 'armed'
    return 'traveling'
  }
  // armed
  return morphProgress(anchorTop) > NAV_DOCK.glassOnAt ? 'traveling' : 'armed'
}

/** 演出を有効化してよいか（mount/resize 時に評価） */
export function isDockEligible(args: {
  reducedMotion: boolean
  viewportWidth: number
  kickerText: string | null
  navLabel: string
}): boolean {
  if (args.reducedMotion) return false
  if (args.viewportWidth <= 960) return false
  if (!args.kickerText) return false
  return args.kickerText.trim().toLowerCase() === args.navLabel.trim().toLowerCase()
}
```

- [ ] **Step 4: テスト緑を確認** — `rtk vitest run lib/scroll/nav-dock-math.test.ts` → PASS
- [ ] **Step 5: Commit** — `git add lib/scroll/nav-dock-math.ts lib/scroll/nav-dock-math.test.ts && git commit -m "feat(lp): nav-dock math — range+latch mode transitions (N-05)"` → `git log --stat -1` で実在確認

---

### Task 2: NavDockTraveler 本体

**Files:**
- Create: `components/marketing/NavDockTraveler.tsx`
- Create: `components/marketing/NavDockTraveler.module.css`

**Interfaces:**
- Consumes: Task 1 の `NAV_DOCK`/`morphProgress`/`nextDockMode`/`isDockEligible`/`DockMode`
- Consumes（DOM 契約・Task 3 が提供）: `[data-nav-dock-anchor]`（本文 kicker）・`[data-nav-dock-target]`（ナビ ghost スロット）
- Produces: `<html data-nav-dock="armed|traveling|docked">`（無属性=演出オフ）。`NavDockTraveler({ label: string })`

- [ ] **Step 1: 実装**（視覚コンポーネント＝vitest は数学層で担保、実挙動は Task 4 の Playwright で実測）

```tsx
// components/marketing/NavDockTraveler.tsx
'use client'

import { useEffect, useRef } from 'react'
import {
  NAV_DOCK,
  isDockEligible,
  morphProgress,
  nextDockMode,
  type DockMode,
} from '@/lib/scroll/nav-dock-math'
import styles from './NavDockTraveler.module.css'

/**
 * N-05 — 本文 kicker（緑玉＋ページ名）がヘッダーのガラス帯に乗り上がり、
 * 右へダッシュしてナビの自分のスロットへバウンド着地する traveler。
 *
 * - 実 kicker / ナビ実ラベルは CSS（html[data-nav-dock] 属性）で隠すだけ。
 *   属性はこのコンポーネントが mount 後にのみ書く＝SSR/prerender は今日と同一。
 * - 判定は nav-dock-math の範囲＋ラッチ式。位置は毎フレーム実測 rect 追従。
 * - reduced-motion / ≤960px / kicker≠ナビ語 → 属性を書かず終了（演出オフ）。
 */
export function NavDockTraveler({ label }: { label: string }): React.ReactElement {
  const wordRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const word = wordRef.current
    const anchor = document.querySelector<HTMLElement>('[data-nav-dock-anchor]')
    const target = document.querySelector<HTMLElement>('[data-nav-dock-target]')
    if (!word || !anchor || !target) return

    const html = document.documentElement
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let mode: DockMode = 'armed'
    let settleTimer: number | undefined
    let raf = 0
    let enabled = false

    const eligible = (): boolean =>
      isDockEligible({
        reducedMotion: reduced.matches,
        viewportWidth: window.innerWidth,
        kickerText: anchor.textContent,
        navLabel: label,
      })

    const setWordState = (state: DockMode, settling: boolean): void => {
      word.dataset.state = state
      word.dataset.settling = settling ? 'true' : 'false'
    }

    const follow = (rect: DOMRect): void => {
      word.style.left = `${rect.left}px`
      word.style.top = `${rect.top}px`
    }

    const setMorph = (p: number): void => {
      word.style.setProperty('--mp', p.toFixed(3))
    }

    const toDocked = (): void => {
      mode = 'docked'
      html.dataset.navDock = 'docked'
      setWordState('docked', true)
      const t = target.getBoundingClientRect()
      word.style.transition = `left ${NAV_DOCK.zipMs}ms cubic-bezier(.34,1.42,.64,1), top ${NAV_DOCK.zipMs}ms cubic-bezier(.34,1.42,.64,1)`
      follow(t)
      setMorph(1)
      window.clearTimeout(settleTimer)
      settleTimer = window.setTimeout(() => {
        setWordState('docked', false)
        frame()
      }, NAV_DOCK.zipMs + 40)
    }

    const toTravelingBack = (): void => {
      mode = 'traveling'
      html.dataset.navDock = 'traveling'
      setWordState('traveling', true)
      const a = anchor.getBoundingClientRect()
      word.style.transition = `left ${NAV_DOCK.returnMs}ms cubic-bezier(.4,0,.2,1), top ${NAV_DOCK.returnMs}ms cubic-bezier(.4,0,.2,1)`
      follow(a)
      window.clearTimeout(settleTimer)
      settleTimer = window.setTimeout(() => {
        setWordState('traveling', false)
        frame()
      }, NAV_DOCK.returnMs + 20)
    }

    const frame = (): void => {
      if (!enabled) return
      const a = anchor.getBoundingClientRect()
      const next = nextDockMode(mode, a.top)
      const settling = word.dataset.settling === 'true'

      if (next !== mode) {
        if (next === 'docked') {
          toDocked()
          return
        }
        if (mode === 'docked' && next === 'traveling') {
          toTravelingBack()
          return
        }
        mode = next
        html.dataset.navDock = next
        setWordState(next, false)
      }

      if (settling) return
      word.style.transition = 'none'
      if (mode === 'docked') {
        follow(target.getBoundingClientRect())
        setMorph(1)
      } else {
        follow(a)
        setMorph(mode === 'armed' ? 0 : morphProgress(a.top))
      }
    }

    const onScroll = (): void => {
      if (raf) return
      raf = window.requestAnimationFrame(() => {
        raf = 0
        frame()
      })
    }

    const enable = (): void => {
      if (enabled) return
      enabled = true
      mode = 'armed'
      html.dataset.navDock = 'armed'
      setWordState('armed', false)
      frame()
    }

    const disable = (): void => {
      if (!enabled) return
      enabled = false
      window.clearTimeout(settleTimer)
      delete html.dataset.navDock
      setWordState('armed', false)
    }

    const evaluate = (): void => {
      if (eligible()) enable()
      else disable()
      if (enabled) frame()
    }

    evaluate()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', evaluate)
    reduced.addEventListener('change', evaluate)

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', evaluate)
      reduced.removeEventListener('change', evaluate)
      window.clearTimeout(settleTimer)
      if (raf) window.cancelAnimationFrame(raf)
      delete html.dataset.navDock
    }
  }, [label])

  const chars = [...label]
  return (
    <span ref={wordRef} className={styles.word} aria-hidden="true" data-state="armed" data-settling="false" style={{ ['--mp' as string]: 0 }}>
      <span className={styles.dot} />
      <span className={styles.txt}>
        {chars.map((c, i) => (
          <span key={`${c}-${i}`} className={styles.ch} style={{ transitionDelay: `${i * NAV_DOCK.charDelayMs}ms` }}>
            {c}
          </span>
        ))}
      </span>
    </span>
  )
}
```

```css
/* components/marketing/NavDockTraveler.module.css
   N-05 traveler。--mp = モーフ進捗 0(本文 kicker 姿)→1(ナビ姿)。
   kicker 実測値(intro-page/legal-page/AboutContent 共通):
   geist-mono 12px w500 ls.2em uppercase ink-soft, dot7px 緑+4px リング, gap9px。
   ナビ着地形: --lp-sans 14px w450 uppercase ls.06em ink-soft(dot 温存)。 */

.word {
  --mp: 0;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 110; /* SiteHeader(z100) の上 */
  pointer-events: none;
  display: inline-flex;
  align-items: center;
  gap: calc(9px + (8px - 9px) * var(--mp));
  font-family: var(--font-geist-mono), ui-monospace, 'SFMono-Regular', monospace;
  font-size: calc(12px + (14px - 12px) * var(--mp));
  font-weight: calc(500 + (450 - 500) * var(--mp));
  letter-spacing: calc(0.2em + (0.06em - 0.2em) * var(--mp));
  text-transform: uppercase;
  color: var(--lp-ink-soft);
  white-space: nowrap;
  visibility: hidden; /* armed(帯の外) では実 kicker が本物を表示 */
}

.word[data-state='traveling'],
.word[data-state='docked'] {
  visibility: visible;
}

/* 着地形はナビの書体へ（ダッシュ中に切替＝高速移動中で知覚されない） */
.word[data-state='docked'] {
  font-family: var(--lp-sans, system-ui, sans-serif);
}

.dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--lp-accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--lp-accent) 16%, transparent);
}

.txt {
  display: inline-flex;
}

/* 1文字ずつの乗り上がり: traveling 進入時に下から climb する */
.ch {
  display: inline-block;
  transform: translateY(6px);
  opacity: 0.001;
  transition:
    transform 0.32s cubic-bezier(0.2, 0.85, 0.25, 1),
    opacity 0.32s ease;
}

.word[data-state='traveling'] .ch,
.word[data-state='docked'] .ch {
  transform: translateY(0);
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .word {
    display: none;
  }
}
```

- [ ] **Step 2: `rtk tsc` 0 を確認**
- [ ] **Step 3: Commit** — `git commit -m "feat(lp): NavDockTraveler — kicker rides the glass band into its nav slot (N-05)"` → `git log --stat -1` 確認

---

### Task 3: 配線（SiteHeader スロット / MarketingShell / 5ページ anchor / global ゲート CSS）

**Files:**
- Modify: `components/marketing/SiteHeader.tsx`（NAV_ITEMS export + active スロット2枚持ち）
- Modify: `components/marketing/SiteHeader.module.css`（末尾に純追記）
- Modify: `components/marketing/MarketingShell.tsx`（Lenis + traveler）
- Modify: `components/marketing/landing-tokens.css`（末尾に純追記）
- Modify: `components/marketing/pages/{Features,Guide,About,Faq,Contact}Content.tsx`（kicker に `data-nav-dock-anchor`）

- [ ] **Step 1: SiteHeader** — `NAV_ITEMS` に `export` を付け、nav map を差し替え:

```tsx
export const NAV_ITEMS = [
  // …既存 5 項目そのまま…
] as const

// nav 内の map を:
{NAV_ITEMS.map((item) => {
  const isDockSlot = item.subpath === subpath
  return (
    <Link key={item.subpath} href={navHref(locale, item.subpath)} className={styles.navLink}>
      {isDockSlot ? (
        <>
          <span className={styles.navLabelPlain}>{item.label}</span>
          <span className={styles.dockSlot} data-nav-dock-target aria-hidden="true">
            <span className={styles.slotDot} />
            {item.label}
          </span>
        </>
      ) : (
        item.label
      )}
    </Link>
  )
})}
```

- [ ] **Step 2: SiteHeader.module.css 末尾に追記**（`html[data-nav-dock]` が無い限り一切発火しない）:

```css
/* ── N-05 nav-dock: active ページの語は traveler が運ぶ ──
   html[data-nav-dock] は NavDockTraveler だけが mount 後に書く。
   無属性(SSR/演出オフ)では .dockSlot は display:none = 従来表示のまま。 */
.dockSlot {
  display: none;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}

.slotDot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

:global(html[data-nav-dock]) .navLabelPlain {
  display: none;
}

:global(html[data-nav-dock]) .dockSlot {
  display: inline-flex;
  visibility: hidden; /* 幅だけ確保。語は traveler が描く */
}
```

- [ ] **Step 3: landing-tokens.css 末尾に追記**（本文 kicker の隠し・global 属性のみ＝module ハッシュ非依存）:

```css
/* ── N-05 nav-dock: 語が旅の間、本文 kicker は場所だけ残して隠す ── */
html[data-nav-dock='traveling'] [data-nav-dock-anchor],
html[data-nav-dock='docked'] [data-nav-dock-anchor] {
  visibility: hidden;
}
```

- [ ] **Step 4: MarketingShell** — `useSmoothScroll` + traveler（5ページのみ）:

```tsx
import { useSmoothScroll } from '@/lib/scroll/use-smooth-scroll'
import { NAV_ITEMS, SiteHeader } from './SiteHeader'
import { NavDockTraveler } from './NavDockTraveler'

// コンポーネント内:
useSmoothScroll() // トップ LP と同じ慣性(Lenis)。reduced-motion では自動 no-op
const dockItem = NAV_ITEMS.find((item) => item.subpath === subpath)

// JSX（SiteHeader の直後）:
{dockItem ? <NavDockTraveler label={dockItem.label} /> : null}
```

- [ ] **Step 5: 5ページの kicker に anchor 属性**（各1行、例は Features。5ファイル同型）:

```tsx
<p className={styles.kicker} data-reveal data-nav-dock-anchor>
```

（ContactContent は data-reveal なし → `<p className={styles.kicker} data-nav-dock-anchor>`）

- [ ] **Step 6: `rtk tsc` 0 / `rtk vitest run` 全緑 / `pnpm build` OK を確認**
- [ ] **Step 7: Commit** — `git commit -m "feat(lp): wire nav-dock — header slot, Lenis shell, kicker anchors (N-05)"` → `git log --stat -1` 確認

---

### Task 4: Playwright 実測（dev）

**Files:** 検証スクリプトは scratchpad（tracked に残さない）

- [ ] **Step 1: dev server 起動、`/features` を viewport 1489×679・deviceScaleFactor 2.58 で開く**
- [ ] **Step 2: 実測項目**
  1. 初期表示: kicker 可視・ナビの "Features" スロットは空（ghost）・traveler 不可視・`html[data-nav-dock]="armed"`
  2. ゆっくりスクロール: kicker が 120px 線を越えると `data-nav-dock="traveling"`・traveler 可視・--mp が 0→1 に増える
  3. さらにスクロール: `data-nav-dock="docked"`・traveler の left がナビスロット rect と一致（±2px）
  4. 上へ戻す: docked→traveling→armed と逆順で戻り、kicker が復活
  5. reduced-motion エミュレーション: `html[data-nav-dock]` 属性なし・kicker とナビが通常表示
  6. `/ja/features`: 2 と同じ（kicker=Features 英語）
  7. `/ko/features`: 属性なし（기능≠Features で自動オフ）・通常表示
  8. トップ `/`: DOM に data-nav-dock 皆無（非接触）
- [ ] **Step 3: 課題があれば修正 → 再実測 → commit**

---

### Task 5: 仕上げ（merge → deploy → docs）

- [ ] **Step 1: `rtk tsc` / `rtk vitest run` / `pnpm build` 最終確認**
- [ ] **Step 2: master へ `--no-ff` マージ、ブランチ削除**
- [ ] **Step 3: デプロイ** — `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`
- [ ] **Step 4: 本番 Playwright で項目 2/3/8 を再実測（allmarks.app）**
- [ ] **Step 5: docs 更新**（TODO.md 現在の状態 / TODO_COMPLETED.md / CURRENT_GOAL.md / spec の誤り箇所を実物に合わせ改訂）→ commit → push

## Self-Review 済みメモ

- spec §3 の「フォントモーフ」: font-family は補間不能 → サイズ/字間/太さは連続補間、書体切替はダッシュ中（460ms の高速移動中）に実施。本番で見て微調整前提。
- 着地形は uppercase＋緑玉維持（プロト v2 の確定挙動と同一）。ナビ他項目は capitalize のまま＝docked 語だけタグ的に見えるのは意図。
- Lenis は MarketingShell 全ページ（extension/privacy/terms 含む）に乗る＝spec §4.1 の指示どおり。演出は 5 ページのみ。
- 縦 640px 級の低い画面でも glassStart=120 は viewport 基準なので破綻しない。
- Contact はページが短くスクロール量不足で docked まで行かない可能性 → 演出は途中まで＝無害（要実機確認）。
