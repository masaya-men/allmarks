# N-05 ブラッシュアップ（3段直列の変身）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LP サブページの kicker 格納演出を「乗り切る → その場で1文字ずつ衣装替え → 右へダッシュ」の3段直列に作り替える。

**Architecture:** 純関数層（`nav-dock-math.ts`）の状態機械に `morphing` を1段追加し、コンポーネント（`NavDockTraveler.tsx`）が morphing 進入で位置を凍結・JS タイマーで衣装替えの波を刻み、完了タイマーで既存 `toDocked()`（zip）へ進める。CSS はスクロール連動スクラブを廃止し、時間制 transition（keyframe 不使用＝キャンセル巻き戻しのため）に置き換える。

**Tech Stack:** Next.js 14 App Router / TypeScript strict / Vanilla CSS Modules / vitest / Playwright（実測）

**正本 spec:** `docs/superpowers/specs/2026-07-03-lp-nav-dock-morph-brushup-design.md`

## Global Constraints

- TypeScript strict・`any` 禁止・return type 明示（tsconfig 変更禁止）
- Tailwind / Framer Motion 禁止。CSS は Vanilla CSS Modules
- 変えないもの: `isDockEligible` の発動条件（reduced-motion / ≤960px / kicker≠ナビ語）、SSR 無属性（属性は mount 後のみ）、zip（460ms）と return（300ms）の時間・easing、本文 kicker / ナビ実ラベルの HTML 構造、トップ LP・ボード本体
- **vitest は dev サーバー並走禁止**（無関係 suite が落ちる・s155 で確認）。Task 3 の dev サーバー起動前に必ず vitest を済ませる
- コマンドは `rtk` prefix（`rtk tsc` / `rtk vitest run` / `rtk git ...`。build のみ `rtk pnpm build`）
- **偽保存対策**: Write/Edit 後は独立 Read か実出力、commit 後は `rtk git log --stat -1` の実出力で確認
- 作業ブランチ: `feat/lp-nav-dock-morph`（master から分岐。ユーザー実機 OK 後に `--no-ff` マージ）
- 既知フレーキー: `tests/lib/channel.test.ts` → 再実行で緑なら OK

---

### Task 1: 純関数層 — `morphing` 状態・新定数・`morphTotalMs`（TDD）

**Files:**
- Modify: `lib/scroll/nav-dock-math.ts`
- Test: `lib/scroll/nav-dock-math.test.ts`

**Interfaces:**
- Produces: `DockMode = 'armed' | 'traveling' | 'morphing' | 'docked'`、`NAV_DOCK.morphCharDelayMs: 30` / `morphCharMs: 240` / `morphCancelMs: 180` / `morphAlignMs: 120`、`morphTotalMs(charCount: number): number`。Task 2 がこの4定数と関数を import する

- [ ] **Step 1: ブランチ作成**

```bash
rtk git checkout -b feat/lp-nav-dock-morph
```

- [ ] **Step 2: 失敗するテストを書く**

`lib/scroll/nav-dock-math.test.ts` の import に `morphTotalMs` を追加:

```typescript
import { NAV_DOCK, isDockEligible, morphProgress, morphTotalMs, nextDockMode } from './nav-dock-math'
```

既存テスト（27-30行目）を差し替え:

```typescript
  it('traveling: anchorTop <= dockY で morphing（大きく飛び越しても範囲判定で捕まえる）', () => {
    expect(nextDockMode('traveling', NAV_DOCK.dockY)).toBe('morphing')
    expect(nextDockMode('traveling', -500)).toBe('morphing')
  })
```

同 describe 内に追加:

```typescript
  it('morphing: スクロールでは docked に進まない（昇格はタイマーのみ）', () => {
    expect(nextDockMode('morphing', NAV_DOCK.dockY)).toBe('morphing')
    expect(nextDockMode('morphing', -500)).toBe('morphing')
  })
  it('morphing: dockY+releaseGap まで戻したらキャンセルで traveling', () => {
    expect(nextDockMode('morphing', NAV_DOCK.dockY + NAV_DOCK.releaseGap)).toBe('traveling')
    expect(nextDockMode('morphing', NAV_DOCK.dockY + NAV_DOCK.releaseGap - 1)).toBe('morphing')
  })
```

新 describe をファイル末尾に追加:

```typescript
describe('morphTotalMs（変身の総時間 = ラベル長で決まる）', () => {
  it('8文字(FEATURES) = 7*morphCharDelayMs + morphCharMs = 450ms', () => {
    expect(morphTotalMs(8)).toBe(450)
  })
  it('1文字 = morphCharMs のみ', () => {
    expect(morphTotalMs(1)).toBe(NAV_DOCK.morphCharMs)
  })
  it('0 以下でも正の時間を返す（防御）', () => {
    expect(morphTotalMs(0)).toBe(NAV_DOCK.morphCharMs)
  })
})
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `rtk vitest run lib/scroll/nav-dock-math.test.ts`
Expected: FAIL（`morphTotalMs` 未定義 / `'morphing'` 型不一致）

- [ ] **Step 4: 実装**

`lib/scroll/nav-dock-math.ts` を以下に書き換え（差分: `DockMode` に `'morphing'`、`NAV_DOCK` に4定数、`morphTotalMs` 新設、`nextDockMode` の traveling/morphing 分岐、コメント更新）:

```typescript
// lib/scroll/nav-dock-math.ts
/**
 * N-05 LP ナビ格納演出の純関数層。
 * anchorTop = 本文 kicker の viewport 基準 top(px)。ヘッダーは fixed 64px。
 * 状態遷移は「範囲＋ラッチ式」: しきい値を跨いだ *範囲* で判定するため、
 * Lenis の慣性スクロールで 1 フレームに大きく飛んでも取りこぼさない。
 * 演出は3段直列（2026-07-03 ブラッシュアップ）:
 *   traveling(本文の姿のまま帯に乗る) → morphing(その場で衣装替え・時間制)
 *   → docked(zip)。morphing → docked の昇格はタイマーのみ（スクロールでは進まない）。
 */
export type DockMode = 'armed' | 'traveling' | 'morphing' | 'docked'

export const NAV_DOCK = {
  /** ヘッダー高（SiteHeader.module.css .header height と一致） */
  headerH: 64,
  /** 着地判定線 = ヘッダー中央 */
  dockY: 32,
  /** 帯進入の判定開始線（ヘッダー下端から 56px 下） */
  glassStart: 120,
  /** この進捗を超えたら traveler が語を引き取る（1文字ずつ乗り上がり開始） */
  glassOnAt: 0.06,
  /** docked/morphing → traveling へ戻すヒステリシス(px) */
  releaseGap: 10,
  /** traveling → armed へ戻すヒステリシス(px) */
  restGap: 8,
  /** ダッシュ（しゅっ→バウンド着地）の時間(ms) */
  zipMs: 460,
  /** 上スクロールで本文へ帰る時間(ms) */
  returnMs: 300,
  /** 1文字ごとの乗り上がり遅延(ms) */
  charDelayMs: 28,
  /** 衣装替えの波: 1文字ごとの開始遅延(ms) */
  morphCharDelayMs: 30,
  /** 衣装替え: 1文字の沈み→起き上がり全体(ms)。折り返し(1/2)で font-family 切替 */
  morphCharMs: 240,
  /** 変身キャンセル時の一斉逆戻し(ms) */
  morphCancelMs: 180,
  /** morphing 進入時、凍結位置へ寄せる時間(ms)（大ジャンプでも瞬間移動しない） */
  morphAlignMs: 120,
} as const

/** kicker の top から帯進入の進捗 0→1 を返す（glassStart で 0, dockY で 1）。
 *  発動判定（glassOnAt との比較）専用。CSS のスクラブには使わない。 */
export function morphProgress(anchorTop: number): number {
  const p = (NAV_DOCK.glassStart - anchorTop) / (NAV_DOCK.glassStart - NAV_DOCK.dockY)
  return Math.max(0, Math.min(1, p))
}

/** 変身の総時間(ms) = 最終文字の開始遅延 + 1文字分。ラベル長で決まる */
export function morphTotalMs(charCount: number): number {
  if (charCount <= 0) return NAV_DOCK.morphCharMs
  return (charCount - 1) * NAV_DOCK.morphCharDelayMs + NAV_DOCK.morphCharMs
}

/** 現在モードと anchorTop から次モードを返す（副作用なし）。
 *  morphing → docked はここでは起きない（コンポーネントの完了タイマーが進める）。 */
export function nextDockMode(mode: DockMode, anchorTop: number): DockMode {
  if (mode === 'docked') {
    return anchorTop >= NAV_DOCK.dockY + NAV_DOCK.releaseGap ? 'traveling' : 'docked'
  }
  if (mode === 'morphing') {
    return anchorTop >= NAV_DOCK.dockY + NAV_DOCK.releaseGap ? 'traveling' : 'morphing'
  }
  if (mode === 'traveling') {
    if (anchorTop <= NAV_DOCK.dockY) return 'morphing'
    if (anchorTop > NAV_DOCK.glassStart + NAV_DOCK.restGap) return 'armed'
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

- [ ] **Step 5: テストが通ることを確認**

Run: `rtk vitest run lib/scroll/nav-dock-math.test.ts`
Expected: PASS（19テスト = 既存14のうち1件を morphing 行きに置換 + 新規5）

- [ ] **Step 6: Commit（実出力確認込み）**

```bash
rtk git add lib/scroll/nav-dock-math.ts lib/scroll/nav-dock-math.test.ts
rtk git commit -m "feat(lp): nav-dock adds morphing state + morphTotalMs (N-05 brushup)"
rtk git log --stat -1
```

---

### Task 2: traveler — 凍結・衣装替えの波・キャンセル（TSX + CSS）

**Files:**
- Modify: `components/marketing/NavDockTraveler.tsx`（全面改修）
- Modify: `components/marketing/NavDockTraveler.module.css`（全面改修）
- Modify: `components/marketing/landing-tokens.css:30-31`（morphing を隠しリストに追加）

**Interfaces:**
- Consumes: Task 1 の `morphing` モード、`NAV_DOCK.morphCharDelayMs/morphCharMs/morphCancelMs/morphAlignMs`、`morphTotalMs(charCount)`
- Produces: `html[data-nav-dock='morphing']`（新しい属性値）、char span の `data-ch` / `data-dip` / `data-swap`、word の `data-cancel`。全て traveler 内部＋landing-tokens の隠しセレクタのみが読む

- [ ] **Step 1: `NavDockTraveler.tsx` を書き換え**

全文を以下に置き換え:

```tsx
'use client'

import { useEffect, useRef } from 'react'
import {
  NAV_DOCK,
  isDockEligible,
  morphProgress,
  morphTotalMs,
  nextDockMode,
  type DockMode,
} from '@/lib/scroll/nav-dock-math'
import styles from './NavDockTraveler.module.css'

/**
 * N-05 — 本文 kicker（緑玉＋ページ名）がヘッダーのガラス帯に乗り上がり、
 * ナビの行の高さで止まって1文字ずつ衣装替え（morphing）した後、
 * 右へダッシュしてナビの自分のスロットへバウンド着地する traveler。
 *
 * - 実 kicker / ナビ実ラベルは CSS（html[data-nav-dock] 属性）で隠すだけ。
 *   属性はこのコンポーネントが mount 後にのみ書く＝SSR/prerender は従来表示のまま。
 * - 判定は nav-dock-math の範囲＋ラッチ式（Lenis の慣性で飛んでもすり抜けない）。
 *   位置は毎フレーム実 DOM rect（getBoundingClientRect）追従。
 *   morphing 中だけは位置を凍結し、タイマーが波と完了を刻む。
 * - reduced-motion / ≤960px / kicker≠ナビ語（ローカライズ言語）→ 属性を書かず演出オフ。
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
    let morphTimer: number | undefined
    const charTimers: number[] = []
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

    const chSpans = (): HTMLElement[] =>
      Array.from(word.querySelectorAll<HTMLElement>('span[data-ch]'))

    /** 波のタイマーと文字の dip/swap 印を全て解除（morphing を離れるとき必ず呼ぶ） */
    const clearMorphWave = (): void => {
      charTimers.forEach((t) => window.clearTimeout(t))
      charTimers.length = 0
      window.clearTimeout(morphTimer)
      chSpans().forEach((s) => {
        delete s.dataset.dip
        delete s.dataset.swap
      })
    }

    /** 寸法モーフ（font-size/letter-spacing/weight/gap = --mp の calc）を
     *  実プロパティの transition で滑らかに動かすための共通文字列 */
    const morphTransition = (ms: number, ease: string): string[] => [
      `font-size ${ms}ms ${ease}`,
      `letter-spacing ${ms}ms ${ease}`,
      `font-weight ${ms}ms ${ease}`,
      `gap ${ms}ms ${ease}`,
    ]

    /** その場で変身: 位置を凍結（横はその場・高さはナビの行）し、
     *  左から右へ1文字ずつ dip→swap。完了タイマーで toDocked へ。 */
    const toMorphing = (): void => {
      mode = 'morphing'
      html.dataset.navDock = 'morphing'
      setWordState('morphing', true)
      const a = anchor.getBoundingClientRect()
      const t = target.getBoundingClientRect()
      const spans = chSpans()
      const total = morphTotalMs(spans.length)
      const ease = 'cubic-bezier(0.2, 0.85, 0.25, 1)'
      word.style.transition = [
        `left ${NAV_DOCK.morphAlignMs}ms ease-out`,
        `top ${NAV_DOCK.morphAlignMs}ms ease-out`,
        ...morphTransition(total, ease),
      ].join(', ')
      word.style.left = `${a.left}px`
      word.style.top = `${t.top}px`
      setMorph(1)
      spans.forEach((s, i) => {
        charTimers.push(
          window.setTimeout(() => {
            s.dataset.dip = 'true'
          }, i * NAV_DOCK.morphCharDelayMs),
          window.setTimeout(() => {
            delete s.dataset.dip
            s.dataset.swap = 'true'
          }, i * NAV_DOCK.morphCharDelayMs + NAV_DOCK.morphCharMs / 2),
        )
      })
      window.clearTimeout(morphTimer)
      morphTimer = window.setTimeout(() => {
        // キャンセル済みなら何もしない（clearMorphWave がタイマーを消すが二重防御）
        if (mode === 'morphing') toDocked()
      }, total + 40)
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
        // settle 中にモードが変わっていても巻き戻さない(現 mode を反映)
        setWordState(mode, false)
        frame()
      }, NAV_DOCK.zipMs + 40)
    }

    /** 本文へ帰る（docked からは returnMs、morphing キャンセルは morphCancelMs）。
     *  文字は一斉に本文の姿へ（data-cancel で乗り上がり用 stagger を無効化） */
    const toTravelingBack = (ms: number): void => {
      mode = 'traveling'
      html.dataset.navDock = 'traveling'
      clearMorphWave()
      word.dataset.cancel = 'true'
      setWordState('traveling', true)
      const a = anchor.getBoundingClientRect()
      word.style.transition = [
        `left ${ms}ms cubic-bezier(.4,0,.2,1)`,
        `top ${ms}ms cubic-bezier(.4,0,.2,1)`,
        ...morphTransition(ms, 'ease'),
      ].join(', ')
      follow(a)
      setMorph(0)
      window.clearTimeout(settleTimer)
      settleTimer = window.setTimeout(() => {
        delete word.dataset.cancel
        // settle 中にモードが変わっていても巻き戻さない(現 mode を反映)
        setWordState(mode, false)
        frame()
      }, ms + 20)
    }

    const frame = (): void => {
      if (!enabled) return
      const a = anchor.getBoundingClientRect()
      const next = nextDockMode(mode, a.top)
      const settling = word.dataset.settling === 'true'

      if (next !== mode) {
        if (next === 'morphing') {
          toMorphing()
          return
        }
        if ((mode === 'docked' || mode === 'morphing') && next === 'traveling') {
          toTravelingBack(mode === 'morphing' ? NAV_DOCK.morphCancelMs : NAV_DOCK.returnMs)
          return
        }
        mode = next
        html.dataset.navDock = next
        setWordState(next, false)
      }

      // morphing はタイマー駆動（位置凍結）。settle 中も触らない
      if (mode === 'morphing' || settling) return
      word.style.transition = 'none'
      if (mode === 'docked') {
        follow(target.getBoundingClientRect())
        setMorph(1)
      } else {
        follow(a)
        setMorph(0)
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
      clearMorphWave()
      delete word.dataset.cancel
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
      clearMorphWave()
      if (raf) window.cancelAnimationFrame(raf)
      delete html.dataset.navDock
    }
  }, [label])

  const chars = [...label]
  return (
    <span
      ref={wordRef}
      className={styles.word}
      aria-hidden="true"
      data-state="armed"
      data-settling="false"
      style={{
        ['--mp' as string]: 0,
        ['--morph-half' as string]: `${NAV_DOCK.morphCharMs / 2}ms`,
        ['--morph-cancel' as string]: `${NAV_DOCK.morphCancelMs}ms`,
      }}
    >
      <span className={styles.dot} />
      <span className={styles.txt}>
        {chars.map((c, i) => (
          <span
            key={`${c}-${i}`}
            data-ch
            className={styles.ch}
            style={{ ['--climb-delay' as string]: `${i * NAV_DOCK.charDelayMs}ms` }}
          >
            {c}
          </span>
        ))}
      </span>
    </span>
  )
}
```

設計メモ（実装者向け）:
- **乗り上がり stagger を inline `transitionDelay` → CSS 変数 `--climb-delay` に変更**。inline のままだと衣装替え（dip/swap）の transition まで遅延してしまうため。CSS 側で `transition-delay: var(--climb-delay, 0ms)` を読み、dip/swap/cancel 時は `0ms` で上書きする
- **morphing 中は `frame()` が位置を触らない**（凍結）。キャンセル判定（`nextDockMode`）だけは毎スクロールで効く
- `--mp` は 0↔1 の反転のみ。滑らかさは実プロパティ（font-size 等）への inline transition が担う（custom property の変化でも実プロパティの transition は発火する）

- [ ] **Step 2: `NavDockTraveler.module.css` を書き換え**

全文を以下に置き換え:

```css
/* NavDockTraveler.module.css — N-05 traveler（3段直列: 乗る→その場で変身→ダッシュ）。
   --mp = 姿 0(本文 kicker)↔1(ナビ) の反転スイッチ。滑らかさは TSX の inline transition
   （font-size/letter-spacing/font-weight/gap）が担い、スクロール連動スクラブはしない。
   kicker 実測値(intro-page/legal-page/AboutContent 共通):
   geist-mono 12px w500 ls.2em uppercase ink-soft, dot 7px 緑+4px リング, gap 9px。
   ナビ着地形: --lp-sans 14px w450 uppercase ls.06em ink-soft（緑玉は温存）。 */

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
.word[data-state='morphing'],
.word[data-state='docked'] {
  visibility: visible;
}

/* 着地形はナビの書体へ（morphing の波で文字ごとに切替済み＝同じ書体なので継ぎ目なし） */
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

/* 1文字ずつの乗り上がり: traveling 進入時に下から climb する。
   stagger は --climb-delay（TSX が文字ごとに設定）。 */
.ch {
  display: inline-block;
  transform: translateY(6px);
  opacity: 0.001;
  transition:
    transform 0.32s cubic-bezier(0.2, 0.85, 0.25, 1),
    opacity 0.32s ease;
  transition-delay: var(--climb-delay, 0ms);
}

.word[data-state='traveling'] .ch,
.word[data-state='morphing'] .ch,
.word[data-state='docked'] .ch {
  transform: translateY(0);
  opacity: 1;
}

/* ── 衣装替えの波（morphing 中のみ・JS がタイマーで dip/swap 印を刻む）──
   keyframe を使わず transition + data 印で組む＝キャンセル時に滑らかに巻き戻せる。
   前半: 沈んで減光 → 折り返しで font-family をナビ書体へ掛け替え → 後半: 起き上がる */
.word[data-state='morphing'] .ch[data-dip='true'] {
  transform: translateY(3px);
  opacity: 0.55;
  transition-duration: var(--morph-half);
  transition-delay: 0ms;
}

.word[data-state='morphing'] .ch[data-swap='true'] {
  font-family: var(--lp-sans, system-ui, sans-serif);
  transition-duration: var(--morph-half);
  transition-delay: 0ms;
}

/* キャンセル巻き戻し: 全文字一斉・短く（乗り上がり用 stagger を無効化） */
.word[data-cancel='true'] .ch {
  transition-duration: var(--morph-cancel);
  transition-delay: 0ms;
}

@media (prefers-reduced-motion: reduce) {
  .word {
    display: none;
  }
}
```

- [ ] **Step 3: `landing-tokens.css` の隠しセレクタに morphing を追加**

30-31行目のセレクタを3値に:

```css
html[data-nav-dock='traveling'] [data-nav-dock-anchor],
html[data-nav-dock='morphing'] [data-nav-dock-anchor],
html[data-nav-dock='docked'] [data-nav-dock-anchor] {
  visibility: hidden;
}
```

- [ ] **Step 4: 型チェック＋全テスト＋独立確認**

Run: `rtk tsc && rtk vitest run`
Expected: tsc エラー0 / vitest 全緑（1901+5=1906 目安。`channel.test.ts` フレーキーは再実行）

`rtk git diff --stat` で 3ファイルが実際に変わっていることを確認（偽保存対策）。

- [ ] **Step 5: Commit（実出力確認込み）**

```bash
rtk git add components/marketing/NavDockTraveler.tsx components/marketing/NavDockTraveler.module.css components/marketing/landing-tokens.css
rtk git commit -m "feat(lp): nav-dock 3-stage choreography — ride plain, morph in place, dash (N-05 brushup)"
rtk git log --stat -1
```

---

### Task 3: dev 実測（Playwright・spec §7 の4項目）

**Files:**
- Create: `<scratchpad>/navdock-morph-check.mjs`（セッションの scratchpad ディレクトリ。リポジトリには入れない）

**Interfaces:**
- Consumes: Task 2 まで反映済みの dev サーバー（`pnpm dev`・port 3000）
- Produces: 4項目の PASS/FAIL 実測ログ（次タスクの deploy 判断材料）

- [ ] **Step 1: dev サーバー起動（vitest は Task 2 で完了済みであること）**

```bash
pnpm dev
```

（バックグラウンド起動。`http://localhost:3000` が返るまで待つ）

- [ ] **Step 2: 計測スクリプトを書く**

`navdock-morph-check.mjs`（viewport は開発者実画面基準 1489×679 / deviceScaleFactor 2.58。Lenis を駆動するため実ホイールイベントを使う）:

```javascript
import { chromium } from 'playwright'

const results = []
const check = (name, ok, detail) => {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1489, height: 679 },
  deviceScaleFactor: 2.58,
})
await page.goto('http://localhost:3000/features', { waitUntil: 'networkidle' })

const word = page.locator('span[aria-hidden="true"][data-state]').first()
const anchorTop = () =>
  page.evaluate(() => document.querySelector('[data-nav-dock-anchor]').getBoundingClientRect().top)

// ① traveling 中は本文の姿のまま（font-size 12px・--mp 0）
// anchorTop が 40〜110px に入るまで少しずつホイール
for (let i = 0; i < 120; i++) {
  const t = await anchorTop()
  if (t <= 110 && t > 40) break
  await page.mouse.wheel(0, 60)
  await page.waitForTimeout(50)
}
const midState = await word.getAttribute('data-state')
const midFont = await word.evaluate((el) => getComputedStyle(el).fontSize)
check('1. traveling 中フォント不変', midState === 'traveling' && midFont === '12px',
  `state=${midState} font=${midFont}`)

// ② dockY 到達 → morphing（位置凍結・波で per-char family 切替）
for (let i = 0; i < 120; i++) {
  const s = await word.getAttribute('data-state')
  if (s === 'morphing' || s === 'docked') break
  await page.mouse.wheel(0, 60)
  await page.waitForTimeout(30)
}
const stateAtTrigger = await word.getAttribute('data-state')
const frozen1 = await word.evaluate((el) => ({ l: el.style.left, t: el.style.top }))
await page.waitForTimeout(120)
const swappedMid = await word.evaluate(
  (el) => el.querySelectorAll('span[data-ch][data-swap]').length)
const frozen2 = await word.evaluate((el) => ({ l: el.style.left, t: el.style.top }))
check('2. morphing で凍結+波', stateAtTrigger === 'morphing' && frozen1.l === frozen2.l
  && frozen1.t === frozen2.t && swappedMid > 0 && swappedMid < 8,
  `state=${stateAtTrigger} pos=${frozen1.l}/${frozen1.t}→${frozen2.l}/${frozen2.t} swapped=${swappedMid}/8`)

// ③ 完了 → zip → docked ずれ 0px
await page.waitForTimeout(500 + 500 + 200) // morph 残り + zip + 余裕
const dockState = await word.getAttribute('data-state')
const gap = await page.evaluate(() => {
  const w = document.querySelector('span[aria-hidden="true"][data-state]').getBoundingClientRect()
  const t = document.querySelector('[data-nav-dock-target]').getBoundingClientRect()
  return { dl: Math.abs(w.left - t.left), dt: Math.abs(w.top - t.top) }
})
check('3. docked ずれ 0px', dockState === 'docked' && gap.dl < 0.5 && gap.dt < 0.5,
  `state=${dockState} Δleft=${gap.dl.toFixed(2)} Δtop=${gap.dt.toFixed(2)}`)

// ④ 逆スクロールで可逆（docked→戻る→armed で実 kicker 復帰。
//    morphing 中キャンセルは①②を高速で再通過して確認）
for (let i = 0; i < 160; i++) {
  const s = await word.getAttribute('data-state')
  if (s === 'armed') break
  await page.mouse.wheel(0, -80)
  await page.waitForTimeout(40)
}
const backState = await word.getAttribute('data-state')
const kickerVisible = await page.evaluate(
  () => getComputedStyle(document.querySelector('[data-nav-dock-anchor]')).visibility)
const noResidue = await word.evaluate(
  (el) => el.querySelectorAll('[data-dip],[data-swap]').length === 0)
check('4. 逆スクロール可逆', backState === 'armed' && kickerVisible === 'visible' && noResidue,
  `state=${backState} kicker=${kickerVisible} residue=${!noResidue}`)

console.log(results.join('\n'))
await browser.close()
```

- [ ] **Step 3: 実行して4項目 PASS を確認**

Run: `node <scratchpad>/navdock-morph-check.mjs`
Expected: `PASS 1.` 〜 `PASS 4.` の4行。FAIL があれば systematic-debugging（推測パッチ禁止）

morphing キャンセル（変身中に上スクロール→traveling 復帰）は速度依存で自動計測が不安定になりやすいので、FAIL 時や不安があれば `data-state='morphing'` 中に `page.mouse.wheel(0, -600)` を撃つ追加ブロックで個別確認する。

- [ ] **Step 4: dev サーバー停止**

（Playwright 完走後。以後 vitest を回す場合の並走禁止を守るため）

---

### Task 4: build → deploy → 本番実測

**Files:** なし（ビルドとデプロイのみ）

- [ ] **Step 1: ビルド**

Run: `rtk pnpm build`
Expected: 成功・`out/` 生成（`rtk next build` ではダメ、`pnpm build` であること）

- [ ] **Step 2: デプロイ**

```bash
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true
```

（`--branch=master` 必須。commit message を聞かれる場面は無いが、もし `--commit-message` を渡すなら ASCII のみ）

- [ ] **Step 3: 本番実測**

Task 3 のスクリプトの `page.goto` を `https://allmarks.app/features` に変えて再実行。
Expected: 4項目 PASS。

- [ ] **Step 4: ユーザーへ実機確認を依頼**

`allmarks.app/features` をハードリロード → ゆっくり下スクロールで「乗る→その場で衣装替え→ダッシュ」を目視してもらう。OK なら `--no-ff` で master へマージ（finishing-a-development-branch）。チューニング要望があれば `NAV_DOCK` の `morphCharDelayMs` / `morphCharMs` / `zipMs` を調整して再デプロイ。
