# Tier 1 Viewport Playback + MOTION Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make in-view video cards autoplay muted (capped, viewport-driven) and multi-image cards hard-cut cycle, all gated by an always-visible MOTION master switch in a new 2-row header.

**Architecture:** A `motionEnabled` boolean (persisted in BoardConfig) gates everything. CardsLayer observes card visibility with IntersectionObserver and feeds a pure viewport-playback-pool that returns the top-N most-visible video cards; those mount a muted `InlineMediaPlayer` overlay. Multi-image `ImageCard`s auto-advance their existing `imageIdx` on an interval. The MOTION toggle reuses `ChromeButton` (plain text + glitch) plus a reused dome `.led`.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, vanilla CSS modules, IndexedDB (idb), Vitest, GSAP (existing), IntersectionObserver.

**Spec:** [docs/superpowers/specs/2026-05-21-tier1-viewport-playback-design.md](../specs/2026-05-21-tier1-viewport-playback-design.md)

**Conventions (this repo):**
- Run TS check: `rtk tsc` (expect "TypeScript compilation completed")
- Run tests: `rtk vitest run` (prints `PASS (N) FAIL (0)`). Single file: `npx vitest run path/to/file.test.ts`
- Build: `rtk pnpm build`. Preview: `npx -y wrangler@latest pages dev out --port 8788 --ip 127.0.0.1`
- Commit messages: conventional prefix + trailing `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`. Never `--no-verify`.
- No `any`, explicit return types, vanilla CSS modules (no Tailwind).

---

## File Structure

**Stage A — MOTION switch + header skeleton (no playback yet)**
- Modify `lib/board/types.ts` — add `motionEnabled` to `BoardConfig`.
- Modify `lib/storage/board-config.ts` — add `motionEnabled: true` to `DEFAULT_BOARD_CONFIG`.
- Create `components/board/StatusLed.tsx` + `.module.css` — shared dome LED (extracted recipe), on/off.
- Create `components/board/MotionToggle.tsx` — ChromeButton text + StatusLed, `enabled`/`onToggle`.
- Modify `components/board/TopHeader.tsx` + `.module.css` — 2-row right cluster.
- Modify `components/board/BoardRoot.tsx` — `motionEnabled` state, hydrate, toggle+persist, reduced-motion default, move FilterPill into top header row, render MotionToggle.

**Stage B — viewport playback pool + muted embeds + wiring**
- Modify `components/board/embeds/{YouTubeEmbed,VimeoEmbed,TikTokEmbed,TweetVideoEmbed,SoundCloudEmbed}.tsx`, `embeds/InlineMediaPlayer.tsx`, `embeds/media-players.tsx` — re-add `muted` prop.
- Create `lib/board/viewport-playback-pool.ts` — pure top-N-by-ratio selection.
- Create `lib/board/use-viewport-playback-pool.ts` — hook (ratio map → active set + scroll debounce).
- Modify `components/board/CardsLayer.tsx` — IntersectionObserver per card, muted overlay for active video cards.

**Stage C — multi-image hard-cut cycle**
- Modify `components/board/cards/ImageCard.tsx` — auto-advance `imageIdx` when `autoCycle`.
- Modify `components/board/CardsLayer.tsx` + `components/board/cards/index.ts` — thread `autoCycle` to ImageCard.

**Stage D — perf tuning** (verification, no new files)

---

## Stage A — MOTION switch + 2-row header

### Task A1: Persist `motionEnabled` in BoardConfig

**Files:**
- Modify: `lib/board/types.ts:80-85`
- Modify: `lib/storage/board-config.ts:9-14`
- Test: `lib/storage/board-config.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `lib/storage/board-config.test.ts`:

```typescript
it('defaults motionEnabled to true and round-trips it', async () => {
  const db = await openTestDb() // use the same helper the existing tests use
  const loaded = await loadBoardConfig(db)
  expect(loaded.motionEnabled).toBe(true)

  await saveBoardConfig(db, { ...loaded, motionEnabled: false })
  const reloaded = await loadBoardConfig(db)
  expect(reloaded.motionEnabled).toBe(false)
})
```

> If `openTestDb` isn't the helper name, read the top of `board-config.test.ts` and reuse whatever the existing tests use to get a `db`.

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run lib/storage/board-config.test.ts`
Expected: FAIL (`motionEnabled` is `undefined`).

- [ ] **Step 3: Add the field**

In `lib/board/types.ts`, inside `export type BoardConfig = {`:

```typescript
  readonly activeFilter: BoardFilter
  /** Tier 1 viewport-playback master switch. true = in-view video cards
   *  autoplay muted + multi-image cards cycle. Default true (reduced-motion
   *  users default false, set at hydrate time in BoardRoot). */
  readonly motionEnabled: boolean
```

In `lib/storage/board-config.ts`, `DEFAULT_BOARD_CONFIG`:

```typescript
export const DEFAULT_BOARD_CONFIG: BoardConfig = {
  frameRatio: { kind: 'preset', presetId: DEFAULT_PRESET_ID },
  themeId: DEFAULT_THEME_ID,
  displayMode: 'visual',
  activeFilter: 'all',
  motionEnabled: true,
}
```

- [ ] **Step 4: Run test + tsc, verify pass**

Run: `npx vitest run lib/storage/board-config.test.ts` → PASS
Run: `rtk tsc` → completes (BoardConfig is constructed in tests/BoardRoot; if tsc flags a missing `motionEnabled` somewhere, add `motionEnabled: true` there).

- [ ] **Step 5: Commit**

```bash
rtk git add lib/board/types.ts lib/storage/board-config.ts lib/storage/board-config.test.ts
rtk git commit -m "feat(board): persist motionEnabled in BoardConfig (default on)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task A2: Shared dome StatusLed component

Extracts the dome LED recipe (currently `TuneTrigger.module.css .led`) into a reusable component so MOTION reuses the exact crafted 3D look. TuneTrigger is left untouched (non-breaking).

**Files:**
- Create: `components/board/StatusLed.tsx`
- Create: `components/board/StatusLed.module.css`
- Test: `components/board/StatusLed.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from '@testing-library/react'
import { StatusLed } from './StatusLed'

describe('StatusLed', () => {
  it('lit green when on', () => {
    const { getByTestId } = render(<StatusLed on data-testid="led" />)
    const el = getByTestId('led')
    expect(el.getAttribute('data-on')).toBe('true')
  })
  it('unlit when off', () => {
    const { getByTestId } = render(<StatusLed on={false} data-testid="led" />)
    expect(getByTestId('led').getAttribute('data-on')).toBe('false')
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run components/board/StatusLed.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`components/board/StatusLed.tsx`:

```tsx
import { type ReactElement } from 'react'
import styles from './StatusLed.module.css'

/** Domed status lamp reused from the TUNE drawer LED recipe (radial-gradient
 *  reflection + edge darkening). `on` toggles lit-green vs unlit-dim. */
export function StatusLed({
  on,
  'data-testid': dataTestId,
}: {
  readonly on: boolean
  readonly 'data-testid'?: string
}): ReactElement {
  return <span className={styles.led} data-on={on ? 'true' : 'false'} data-testid={dataTestId} aria-hidden="true" />
}
```

`components/board/StatusLed.module.css` (recipe copied verbatim from `TuneTrigger.module.css .led`, with on/off color via `data-on`):

```css
.led {
  position: relative;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
  background-color: currentColor;
  background-image:
    radial-gradient(circle at 30% 28%,
      rgba(255, 255, 255, 0.65) 0%,
      rgba(255, 255, 255, 0) 36%),
    radial-gradient(circle at 50% 60%,
      rgba(0, 0, 0, 0) 55%,
      rgba(0, 0, 0, 0.32) 100%);
  background-repeat: no-repeat;
  box-shadow:
    inset 0 0 0 0.5px rgba(0, 0, 0, 0.5),
    0 0 3px currentColor,
    0 0 7px color-mix(in srgb, currentColor 60%, transparent);
  transition: color 0.18s ease;
}
/* Lit = AllMarks success green (matches TuneTrigger data-color="green"). */
.led[data-on="true"]  { color: #4cd56a; }
/* Unlit = dark dome, no glow halo (override the green box-shadow halo). */
.led[data-on="false"] {
  color: #2a2e2a;
  box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.6);
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npx vitest run components/board/StatusLed.test.tsx` → PASS

- [ ] **Step 5: Commit**

```bash
rtk git add components/board/StatusLed.tsx components/board/StatusLed.module.css components/board/StatusLed.test.tsx
rtk git commit -m "feat(board): shared dome StatusLed (reused TUNE LED recipe)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task A3: MotionToggle component

**Files:**
- Create: `components/board/MotionToggle.tsx`
- Test: `components/board/MotionToggle.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, fireEvent } from '@testing-library/react'
import { MotionToggle } from './MotionToggle'

describe('MotionToggle', () => {
  it('renders MOTION label and reflects on state on the LED', () => {
    const { getByTestId } = render(<MotionToggle enabled onToggle={() => {}} />)
    expect(getByTestId('motion-toggle').textContent).toContain('MOTION')
    expect(getByTestId('motion-led').getAttribute('data-on')).toBe('true')
  })
  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn()
    const { getByTestId } = render(<MotionToggle enabled={false} onToggle={onToggle} />)
    fireEvent.click(getByTestId('motion-toggle'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run components/board/MotionToggle.test.tsx` → FAIL (module not found)

- [ ] **Step 3: Implement**

`components/board/MotionToggle.tsx`:

```tsx
'use client'

import { type ReactElement } from 'react'
import { ChromeButton } from './ChromeButton'
import { StatusLed } from './StatusLed'
import styles from './MotionToggle.module.css'

/** MOTION master switch: plain ChromeButton text (no box, same glitch hover as
 *  TUNE/POP OUT/SHARE) + a reused dome LED showing on/off. */
export function MotionToggle({
  enabled,
  onToggle,
}: {
  readonly enabled: boolean
  readonly onToggle: () => void
}): ReactElement {
  return (
    <span className={styles.wrap} data-testid="motion-toggle-wrap">
      <ChromeButton label="MOTION" onClick={onToggle} data-testid="motion-toggle" />
      <StatusLed on={enabled} data-testid="motion-led" />
    </span>
  )
}
```

`components/board/MotionToggle.module.css`:

```css
.wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
```

> The LED sits to the RIGHT of the MOTION text (`MOTION ●`). ChromeButton already supplies the plain-text + glitch styling; do not add a border/background here.

- [ ] **Step 4: Run test, verify pass**

Run: `npx vitest run components/board/MotionToggle.test.tsx` → PASS

- [ ] **Step 5: Commit**

```bash
rtk git add components/board/MotionToggle.tsx components/board/MotionToggle.module.css components/board/MotionToggle.test.tsx
rtk git commit -m "feat(board): MotionToggle (ChromeButton text + dome LED)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task A4: BoardRoot — motionEnabled state, hydrate, persist, reduced-motion default

**Files:**
- Modify: `components/board/BoardRoot.tsx` (state near `displayMode` ~L91; hydrate ~L412-421; new persist handler near L1015-1025)

- [ ] **Step 1: Add state + handler**

Near the other board state (after `displayMode` useState ~L91):

```typescript
const [motionEnabled, setMotionEnabled] = useState<boolean>(true)
```

In the hydrate effect (the one reading `loadBoardConfig` ~L418-421), after `setDisplayMode(cfg.displayMode)`:

```typescript
// Reduced-motion users default OFF on first run (no persisted value yet);
// once they've toggled it, the persisted value wins.
const prefersReduced =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
const record = await db.get('settings', 'board-config') // raw to detect "never set"
const hasPersisted = !!(record && typeof (record as { config?: { motionEnabled?: unknown } }).config?.motionEnabled === 'boolean')
setMotionEnabled(hasPersisted ? cfg.motionEnabled : !prefersReduced)
```

> If reading the raw record is awkward, simpler acceptable alternative: `setMotionEnabled(prefersReduced ? false : cfg.motionEnabled)` on first hydrate. The spec only requires reduced-motion ⇒ default off; persisted value otherwise.

Add a toggle handler near the other persist handlers (~L1024):

```typescript
const handleToggleMotion = useCallback((): void => {
  setMotionEnabled((prev) => {
    const next = !prev
    void getDb().then(async (db) => {
      const cfg = await loadBoardConfig(db)
      await saveBoardConfig(db, { ...cfg, motionEnabled: next })
    })
    return next
  })
}, [])
```

> Use whatever DB accessor the neighbouring handlers use (the `displayMode`/`activeFilter` handlers at L1015/1024 show the exact pattern — copy it, do not invent `getDb`).

- [ ] **Step 2: tsc**

Run: `rtk tsc` → completes.

- [ ] **Step 3: Commit** (UI wiring of the toggle happens in A5)

```bash
rtk git add components/board/BoardRoot.tsx
rtk git commit -m "feat(board): motionEnabled state + persistence + reduced-motion default

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task A5: TopHeader 2-row right cluster + place MOTION + FilterPill

**Files:**
- Modify: `components/board/TopHeader.tsx`
- Modify: `components/board/TopHeader.module.css`
- Modify: `components/board/BoardRoot.tsx` (the `<TopHeader …>` usage ~L1291-1324)
- Test: `components/board/TopHeader.test.tsx`

Target layout (right side, two rows; left side empty):
```
[ empty ]                     row 1 (top):  MOTION ●   AllMarks · 192
                              row 2 (bot):  TUNE  POP OUT  SHARE
```
- Both rows right-aligned to the same right edge (FilterPill right edge == SHARE right edge).
- Bottom row keeps TUNE/POP OUT/SHARE intact and in order; TUNE drawer opens downward, never under row 1.

- [ ] **Step 1: Write the failing test**

In `components/board/TopHeader.test.tsx`, add (adapt prop names to the new API below):

```tsx
it('renders two right-side rows: top actions then bottom actions, left empty', () => {
  const { getByTestId } = render(
    <TopHeader
      actionsTop={<span data-testid="top-actions">TOP</span>}
      actionsBottom={<span data-testid="bottom-actions">BOTTOM</span>}
    />,
  )
  expect(getByTestId('top-actions')).toBeTruthy()
  expect(getByTestId('bottom-actions')).toBeTruthy()
})
```

> Update existing TopHeader tests that pass `nav`/`actions` to the new `actionsTop`/`actionsBottom` API in this same step.

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run components/board/TopHeader.test.tsx` → FAIL (old API / props).

- [ ] **Step 3: Implement TopHeader**

`components/board/TopHeader.tsx`:

```tsx
'use client'

import type { ReactElement, ReactNode } from 'react'
import styles from './TopHeader.module.css'

type Props = {
  /** Upper right row: MOTION toggle + FilterPill. */
  readonly actionsTop: ReactNode
  /** Lower right row: TUNE / POP OUT / SHARE (position preserved). */
  readonly actionsBottom: ReactNode
  readonly hidden?: boolean
}

export function TopHeader({ actionsTop, actionsBottom, hidden }: Props): ReactElement {
  const className = hidden ? `${styles.header} ${styles.hidden}` : styles.header
  return (
    <header className={className} data-testid="board-top-header" aria-hidden={hidden ? 'true' : undefined}>
      <div className={styles.rightStack}>
        <div className={styles.group} data-group="actions-top">{actionsTop}</div>
        <div className={styles.group} data-group="actions-bottom">{actionsBottom}</div>
      </div>
    </header>
  )
}
```

`components/board/TopHeader.module.css` — change the lane to right-align a vertical stack (replace `.header` justify-content and add `.rightStack`; keep `.group`/`.hidden` rules):

```css
.header {
  display: flex;
  justify-content: flex-end; /* push the stack to the right; left stays empty */
  align-items: flex-start;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 14px 24px 0;
  z-index: 110;
  pointer-events: none;
  transition: opacity 0.25s ease;
}
.rightStack {
  display: flex;
  flex-direction: column;
  align-items: flex-end; /* both rows right-aligned to the same edge */
  gap: 10px;
}
```

Keep the existing `.hidden`, `.hidden .group`, `.group`, and the mobile `@media` block — but in the mobile block, replace the `[data-group="actions"]` selector with `[data-group="actions-bottom"]` so only Share survives on mobile:

```css
@media (max-width: 640px) {
  .header { padding: 10px 12px 0; }
  .group[data-group="actions-bottom"] > :not([data-testid="share-pill"]) { display: none; }
  .group[data-group="actions-top"] { gap: 8px; }
}
```

- [ ] **Step 4: Update BoardRoot usage**

Replace the `<TopHeader nav={…} actions={…} />` (~L1291-1324) with:

```tsx
<TopHeader
  hidden={!!lightboxItemId}
  actionsTop={
    <>
      <MotionToggle enabled={motionEnabled} onToggle={handleToggleMotion} />
      <FilterPill value={activeFilter} onChange={handleFilterChange} moods={moods} counts={sidebarCounts} />
    </>
  }
  actionsBottom={
    <>
      <TuneTrigger
        widthPx={cardWidthPx}
        gapPx={cardGapPx}
        onChangeWidth={handleCardWidthChange}
        onChangeGap={handleCardGapChange}
        onReset={handleResetWidthGap}
        onApplyPreset={onApplyPreset}
      />
      <ChromeButton label={t('board.chrome.popout')} onClick={() => { void pip.open() }} disabled={!pip.isSupported} data-testid="pop-out-button" />
      <ChromeButton label={t('board.chrome.share')} onClick={(): void => setShareComposerOpen(true)} data-testid="share-pill" />
    </>
  }
/>
```

Add the import near the other board imports: `import { MotionToggle } from './MotionToggle'`.

> Check the second `<TopHeader …>` usage (~L1438, the lightbox-nav header) — it also uses `nav`/`actions`. Update it to the new API (`actionsTop`/`actionsBottom`) or, if that instance is structurally different, give it the props it needs. Read L1423-1460 before editing.

- [ ] **Step 5: Run tests + tsc**

Run: `npx vitest run components/board/TopHeader.test.tsx` → PASS
Run: `rtk tsc` → completes
Run: `rtk vitest run` → `FAIL (0)`

- [ ] **Step 6: Visual verify on preview**

Run: `rtk pnpm build` then `npx -y wrangler@latest pages dev out --port 8788 --ip 127.0.0.1`. Open the board. Confirm: left-top empty; top-right row = `MOTION ●  AllMarks · NNN` with FilterPill right edge flush to SHARE's right edge; bottom-right row = TUNE/POP OUT/SHARE intact; clicking MOTION flips the LED green↔dim; TUNE drawer opens downward without covering the top row. **This is the layout the user iterates on — pause for user review here.**

- [ ] **Step 7: Commit**

```bash
rtk git add components/board/TopHeader.tsx components/board/TopHeader.module.css components/board/TopHeader.test.tsx components/board/BoardRoot.tsx
rtk git commit -m "feat(board): 2-row header — MOTION + FilterPill above TUNE/POPOUT/SHARE

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Stage B — viewport playback pool + muted embeds + wiring

### Task B1: Re-introduce `muted` prop on embeds + registry

This restores the embed `muted` support reverted in `ea8b93f` (Tier 2 removal). It is now needed for Tier 1 viewport autoplay. Re-apply the inverse of that revert for the embed files only (NOT the hooks, NOT the hover wiring).

**Files:**
- Modify: `components/board/embeds/media-players.tsx`, `embeds/InlineMediaPlayer.tsx`, `embeds/YouTubeEmbed.tsx`, `embeds/VimeoEmbed.tsx`, `embeds/TikTokEmbed.tsx`, `embeds/TweetVideoEmbed.tsx`, `embeds/SoundCloudEmbed.tsx`

- [ ] **Step 1: Recover the exact diff**

Run: `git show a1fb7fe -- components/board/embeds/` — this is the original "muted support" commit. Re-apply the SAME additions (the `muted` prop on each embed, the `mute=1`/`muted=1` iframe params, native `<video> muted` attr, SoundCloud `setVolume(0)` + hidden overlay, and the `muted` threading in `media-players.tsx` `RenderOpts`/`InlinePlayerOpts`/`resolveInlinePlayer` and `InlineMediaPlayer`).

```bash
git show a1fb7fe -- components/board/embeds/ | git apply --3way
```

If `git apply` conflicts (files changed since), apply the additions by hand from the diff — they are purely additive (`muted` optional prop, guards `if (muted === true) return`).

- [ ] **Step 2: tsc**

Run: `rtk tsc` → completes.

- [ ] **Step 3: Run full tests**

Run: `rtk vitest run` → `FAIL (0)` (embeds have no behaviour-changing tests; `muted` is optional/undefined by default so Lightbox + Tier 3 paths are unchanged).

- [ ] **Step 4: Commit**

```bash
rtk git add components/board/embeds/
rtk git commit -m "feat(board): re-add muted prop to embeds for Tier 1 viewport autoplay

Restores the embed muted support reverted with Tier 2 (ea8b93f); muted is
optional and defaults undefined so Lightbox + Tier 3 (sound) are unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task B2: Pure viewport-playback-pool logic

Selects the top-N most-visible card ids. Pure function, no React.

**Files:**
- Create: `lib/board/viewport-playback-pool.ts`
- Test: `lib/board/viewport-playback-pool.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { selectActivePlayers } from './viewport-playback-pool'

describe('selectActivePlayers', () => {
  const ratios = new Map<string, number>([['a', 0.9], ['b', 0.5], ['c', 0.1], ['d', 0.7]])

  it('returns the top-N ids by visibility ratio, highest first', () => {
    expect(selectActivePlayers(ratios, 2)).toEqual(['a', 'd'])
  })
  it('returns all when N exceeds count', () => {
    expect(new Set(selectActivePlayers(ratios, 99))).toEqual(new Set(['a', 'b', 'c', 'd']))
  })
  it('ignores ratio 0 (off-screen)', () => {
    const m = new Map([['a', 0], ['b', 0.4]])
    expect(selectActivePlayers(m, 3)).toEqual(['b'])
  })
  it('returns empty for cap 0', () => {
    expect(selectActivePlayers(ratios, 0)).toEqual([])
  })
  it('breaks ties by id for stable output', () => {
    const m = new Map([['y', 0.5], ['x', 0.5]])
    expect(selectActivePlayers(m, 1)).toEqual(['x'])
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run lib/board/viewport-playback-pool.test.ts` → FAIL (module not found)

- [ ] **Step 3: Implement**

```typescript
/** Pure selection for Tier 1 viewport playback: given each candidate card's
 *  current visibility ratio (0–1) and a concurrency cap, return the ids that
 *  should play, most-visible first. Off-screen (ratio <= 0) cards are excluded.
 *  Ties break by id ascending so the active set is stable across recomputes. */
export function selectActivePlayers(ratios: ReadonlyMap<string, number>, cap: number): string[] {
  if (cap <= 0) return []
  return [...ratios.entries()]
    .filter(([, r]) => r > 0)
    .sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, cap)
    .map(([id]) => id)
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npx vitest run lib/board/viewport-playback-pool.test.ts` → PASS

- [ ] **Step 5: Commit**

```bash
rtk git add lib/board/viewport-playback-pool.ts lib/board/viewport-playback-pool.test.ts
rtk git commit -m "feat(board): pure viewport-playback-pool (top-N by visibility)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task B3: `useViewportPlaybackPool` hook (ratio map + scroll debounce → active set)

**Files:**
- Create: `lib/board/use-viewport-playback-pool.ts`
- Test: `lib/board/use-viewport-playback-pool.test.ts`

The hook owns the ratio map (cards report their visibility ratio) and returns a stable `Set<string>` of active ids, recomputed on a trailing debounce so fast scroll doesn't thrash players.

- [ ] **Step 1: Write the failing test**

```typescript
import { renderHook, act } from '@testing-library/react'
import { useViewportPlaybackPool } from './use-viewport-playback-pool'

describe('useViewportPlaybackPool', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('promotes top-N visible ids after the debounce window', () => {
    const { result } = renderHook(() => useViewportPlaybackPool(2, 150))
    act(() => {
      result.current.report('a', 0.9)
      result.current.report('b', 0.2)
      result.current.report('c', 0.8)
    })
    expect(result.current.active.size).toBe(0) // not yet (debounced)
    act(() => { vi.advanceTimersByTime(150) })
    expect(result.current.active.has('a')).toBe(true)
    expect(result.current.active.has('c')).toBe(true)
    expect(result.current.active.has('b')).toBe(false)
  })

  it('drops a card when it leaves the viewport (ratio 0)', () => {
    const { result } = renderHook(() => useViewportPlaybackPool(3, 150))
    act(() => { result.current.report('a', 0.9); vi.advanceTimersByTime(150) })
    expect(result.current.active.has('a')).toBe(true)
    act(() => { result.current.report('a', 0); vi.advanceTimersByTime(150) })
    expect(result.current.active.has('a')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run lib/board/use-viewport-playback-pool.test.ts` → FAIL (module not found)

- [ ] **Step 3: Implement**

```typescript
import { useCallback, useEffect, useRef, useState } from 'react'
import { selectActivePlayers } from './viewport-playback-pool'

type Pool = {
  /** A card reports its current visibility ratio (0 = off-screen). */
  readonly report: (id: string, ratio: number) => void
  /** Ids that should currently play, capped at N, most-visible first. */
  readonly active: ReadonlySet<string>
}

/** Owns the per-card visibility ratio map and recomputes the active set on a
 *  trailing debounce (so fast scroll doesn't boot/kill players every frame). */
export function useViewportPlaybackPool(cap: number, debounceMs = 150): Pool {
  const ratiosRef = useRef<Map<string, number>>(new Map())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [active, setActive] = useState<ReadonlySet<string>>(new Set())

  const recompute = useCallback((): void => {
    setActive(new Set(selectActivePlayers(ratiosRef.current, cap)))
  }, [cap])

  const report = useCallback((id: string, ratio: number): void => {
    if (ratio <= 0) ratiosRef.current.delete(id)
    else ratiosRef.current.set(id, ratio)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(recompute, debounceMs)
  }, [recompute, debounceMs])

  // Recompute immediately if the cap changes (e.g. perf tuning).
  useEffect(() => { recompute() }, [recompute])
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return { report, active }
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npx vitest run lib/board/use-viewport-playback-pool.test.ts` → PASS

- [ ] **Step 5: Commit**

```bash
rtk git add lib/board/use-viewport-playback-pool.ts lib/board/use-viewport-playback-pool.test.ts
rtk git commit -m "feat(board): useViewportPlaybackPool hook (debounced active set)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task B4: CardsLayer — observe visibility + mount muted overlay for active video cards

**Files:**
- Modify: `components/board/CardsLayer.tsx`
- Modify: `components/board/BoardRoot.tsx` (pass `motionEnabled` into `<CardsLayer>` ~L1356-1391)

CardsLayer must: (1) accept `motionEnabled`; (2) for each visible video card, observe its intersection ratio and `report(id, ratio)`; (3) mount a muted `InlineMediaPlayer` overlay on cards in `pool.active` that are video-playable AND not the Tier 3 `audioActiveId` card; (4) when `motionEnabled` is false, report nothing / mount nothing.

- [ ] **Step 1: Add the prop + pool**

In `CardsLayerProps` add:
```typescript
  /** Tier 1 master switch — when false, no viewport autoplay or multi-image cycle. */
  readonly motionEnabled: boolean
```
Add to the destructured params and to `<CardsLayer motionEnabled={motionEnabled} … />` in BoardRoot.

Near the top of the component body:
```typescript
import { useViewportPlaybackPool } from '@/lib/board/use-viewport-playback-pool'
// …
// Tier 1 viewport playback: cap is tuned in Stage D; start at 4.
const TIER1_CAP = 4
const pool = useViewportPlaybackPool(motionEnabled ? TIER1_CAP : 0)
```

- [ ] **Step 2: Observe each video card's visibility**

Inside the per-card render (`visibleItems.map`), for cards where `canPlayInline(it)` is true, attach an IntersectionObserver via a ref callback that reports the ratio. Add this helper effect-ref pattern using a single shared observer keyed by element. Simplest robust approach — a ref callback per card that creates/observes:

```tsx
// Above the return: a stable ref-callback factory that observes a card el and
// reports its visibility ratio to the pool. One IntersectionObserver per card
// is fine here (counts are bounded by culling); thresholds give smooth ratios.
const observeViz = useCallback((id: string) => {
  return (el: HTMLElement | null): void => {
    const existing = vizObservers.current.get(id)
    if (existing) { existing.disconnect(); vizObservers.current.delete(id) }
    if (!el || !motionEnabled) { pool.report(id, 0); return }
    const obs = new IntersectionObserver(
      (entries) => { for (const e of entries) pool.report(id, e.isIntersecting ? e.intersectionRatio : 0) },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    )
    obs.observe(el)
    vizObservers.current.set(id, obs)
  }
}, [motionEnabled, pool])
```

Add near the other refs: `const vizObservers = useRef<Map<string, IntersectionObserver>>(new Map())` and a cleanup effect:
```tsx
useEffect(() => () => { vizObservers.current.forEach((o) => o.disconnect()); vizObservers.current.clear() }, [])
```

Attach `ref={observeViz(it.bookmarkId)}` to a thin wrapper element inside each playable card (or reuse the existing card wrapper element — set both the existing `cardRefs` callback and the viz observer; combine them in one ref callback so you don't clobber the FLIP ref). Combine like:
```tsx
ref={(el): void => { cardRefs.current[it.bookmarkId] = el; if (canPlayInline(it)) observeViz(it.bookmarkId)(el) }}
```

- [ ] **Step 3: Mount the muted overlay for active video cards**

After the Tier 3 `audioActiveId` overlay block, add:

```tsx
{motionEnabled && pool.active.has(it.bookmarkId) && audioActiveId !== it.bookmarkId && canPlayInline(it) && (
  // Tier 1 muted viewport autoplay. pointerEvents:none so it never blocks
  // card clicks / resize. Excluded on the Tier 3 sound-on card.
  <div
    data-viewport-playback
    style={{
      position: 'absolute', inset: 0, zIndex: 10, overflow: 'hidden',
      borderRadius: 'var(--card-radius, 20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
    }}
  >
    <InlineMediaPlayer item={it} muted />
  </div>
)}
```

> `InlineMediaPlayer` gains its `muted` prop in Task B1. Confirm it forwards `muted` to `resolveInlinePlayer`. The autoStart for muted viewport playback should be true (muted autoplay is policy-allowed) — verify InlineMediaPlayer/embeds start playing when `muted` is set without a click; if they need `autoStart`, pass it (the embeds already mount immediately when muted in the a1fb7fe diff).

- [ ] **Step 4: tsc + tests**

Run: `rtk tsc` → completes
Run: `rtk vitest run` → `FAIL (0)`

- [ ] **Step 5: Visual verify on preview**

Build + preview. With a board containing video cards: in-view video cards begin muted playback (up to 4 most-visible); scrolling moves playback to whatever is most visible; MOTION OFF stops all; Tier 3 (press the corner icon) still plays with sound and isn't disturbed; card click/resize still work over a playing card. **Watch frame rate (Stage D).**

- [ ] **Step 6: Commit**

```bash
rtk git add components/board/CardsLayer.tsx components/board/BoardRoot.tsx
rtk git commit -m "feat(board): Tier 1 viewport muted autoplay wired into CardsLayer

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Stage C — multi-image hard-cut cycle

### Task C1: ImageCard auto-advances imageIdx when cycling

`ImageCard` already swaps images instantly via `imageIdx`/`data-active` (hard cut) and overrides on hover. Add an interval that advances `imageIdx` when `autoCycle` is true and the card has multiple slots. Hover still overrides (pointerMove sets idx); leaving resets to 0 and the interval resumes.

**Files:**
- Modify: `components/board/cards/ImageCard.tsx`
- Modify: `components/board/cards/index.ts` (pickCard must forward `autoCycle`)
- Modify: `components/board/CardsLayer.tsx` (pass `autoCycle = motionEnabled && pool.active.has(id)` to the card)
- Test: `components/board/cards/ImageCard.test.tsx` (create if absent)

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from '@testing-library/react'
import { ImageCard } from './ImageCard'

const item = {
  cardId: 'x', bookmarkId: 'x', url: 'https://example.com', title: 't', aspectRatio: 1,
  mediaSlots: [{ type: 'photo', url: 'a.jpg' }, { type: 'photo', url: 'b.jpg' }, { type: 'photo', url: 'c.jpg' }],
} as unknown as Parameters<typeof ImageCard>[0]['item']

describe('ImageCard auto-cycle', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())
  it('advances the active image on an interval when autoCycle is on', () => {
    const { getAllByTestId } = render(<ImageCard item={item} displayMode="visual" autoCycle cycleMs={1000} />)
    const activeIndex = (): number =>
      getAllByTestId('multi-image-dot').findIndex((d) => d.getAttribute('data-active') === 'true')
    expect(activeIndex()).toBe(0)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(activeIndex()).toBe(1)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(activeIndex()).toBe(2)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(activeIndex()).toBe(0) // wraps
  })
  it('does not cycle when autoCycle is off', () => {
    const { getAllByTestId } = render(<ImageCard item={item} displayMode="visual" autoCycle={false} cycleMs={1000} />)
    act(() => { vi.advanceTimersByTime(3000) })
    const idx = getAllByTestId('multi-image-dot').findIndex((d) => d.getAttribute('data-active') === 'true')
    expect(idx).toBe(0)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run components/board/cards/ImageCard.test.tsx` → FAIL (no `autoCycle` prop).

- [ ] **Step 3: Implement**

Add to `ImageCard` `Props`:
```typescript
  /** Tier 1: advance through mediaSlots on an interval (hard cut). */
  readonly autoCycle?: boolean
  /** Interval per image in ms (default 2200). */
  readonly cycleMs?: number
```
Destructure `autoCycle = false, cycleMs = 2200`. After `const hasMultiple = slots.length > 1`, add:
```typescript
useEffect(() => {
  if (!autoCycle || !hasMultiple) return
  const id = setInterval(() => {
    setImageIdx((prev) => (prev + 1) % slots.length)
  }, cycleMs)
  return () => clearInterval(id)
}, [autoCycle, hasMultiple, slots.length, cycleMs])
```

> Hover (`handlePointerMove`) still sets `imageIdx` directly and `handlePointerLeave` resets to 0 — that interaction is unchanged; the interval just keeps advancing when the pointer isn't driving it.

- [ ] **Step 4: Thread the prop**

In `components/board/cards/index.ts` `pickCard` (read it first), ensure `ImageCard` receives `autoCycle`/`cycleMs`. If `pickCard` spreads a fixed prop set, add `autoCycle` to the card's accepted props passed through CardsLayer's `<Card … />`. In `CardsLayer.tsx` where `<Card item={it} … />` is rendered (~L580-587), add `autoCycle={motionEnabled && pool.active.has(it.bookmarkId)}`.

> Note: only ImageCard consumes `autoCycle`; other card components must accept-and-ignore it (or pickCard only forwards it to ImageCard). Read `cards/index.ts` to choose the cleanest path — prefer pickCard forwarding only to ImageCard.

- [ ] **Step 5: Run test + tsc + full suite**

Run: `npx vitest run components/board/cards/ImageCard.test.tsx` → PASS
Run: `rtk tsc` → completes
Run: `rtk vitest run` → `FAIL (0)`

- [ ] **Step 6: Visual verify**

Preview: a multi-image card (X tweet with several photos) hard-cuts through its images ~every 2.2s when MOTION is on and the card is on-screen; stops when MOTION off or scrolled away; hovering still scrubs by cursor x; single-image cards never cycle.

- [ ] **Step 7: Commit**

```bash
rtk git add components/board/cards/ImageCard.tsx components/board/cards/ImageCard.test.tsx components/board/cards/index.ts components/board/CardsLayer.tsx
rtk git commit -m "feat(board): Tier 1 hard-cut auto-cycle for multi-image cards

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Stage D — performance tuning & final verification

### Task D1: Tune cap N + verify 60fps

**Files:** Modify `components/board/CardsLayer.tsx` (`TIER1_CAP` constant) if needed.

- [ ] **Step 1: Measure** — Preview with a board that has many video cards visible. Use the browser Performance panel (or playwright with `performance` traces at the user's real viewport 1489×2.58 and at 1920×2) while scrolling. Record FPS with `TIER1_CAP = 4`.
- [ ] **Step 2: Adjust** — If FPS dips below ~55 during steady viewing (not just the scroll burst), lower `TIER1_CAP` to 3, re-measure. If smooth and the user wants more simultaneous playback, try 5–6. Decide the value WITH the user (they explicitly want to tune N together on real content).
- [ ] **Step 3: Sanity checks** — Confirm: MOTION OFF → zero players mounted + zero `report` activity; reduced-motion OS setting → MOTION defaults off on a fresh profile; Tier 3 sound playback unaffected; no console errors; resize/drag/lightbox open over a playing card all still work.
- [ ] **Step 4: Build + deploy**

```bash
rtk pnpm build
npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="Tier 1 viewport playback + MOTION switch"
```

- [ ] **Step 5: Docs** — Update `docs/TODO.md` current-state, `docs/CURRENT_GOAL.md`, `docs/TODO_COMPLETED.md` (session narrative), and the dashboard per session-workflow. Commit.

---

## Self-Review Notes

- **Spec coverage:** §2 motion scope → Tasks B4 (video), C1 (multi-image), and "static for single/text" is the default (no task needed — those cards get no `autoCycle`/overlay). §3 MOTION switch → A1–A5. §3 visuals (no box, dome LED) → A2/A3. §4 header layout → A5. §5-3 pool → B2/B3/B4 + muted re-add B1. §5-4 multi-image → C1. §6 perf/reduced-motion → A4 (reduced-motion default), D1 (cap). §7 tests → each task has unit tests + preview checks.
- **Open value:** `TIER1_CAP` starts at 4, finalized in D1 with the user. `cycleMs` 2200 default, adjustable.
- **Type consistency:** `selectActivePlayers(ratios, cap)` (B2) ↔ used by `useViewportPlaybackPool` (B3) ↔ `pool.active`/`pool.report` consumed in CardsLayer (B4) and `autoCycle` derived from `pool.active` (C1). `motionEnabled` flows BoardConfig (A1) → BoardRoot state (A4) → CardsLayer prop (B4) → ImageCard `autoCycle` (C1). `muted` prop added across embeds (B1) consumed by the B4 overlay. Consistent.
- **Risk to watch:** B4 ref-callback must not clobber the existing `cardRefs` FLIP ref — combine both in one callback (shown). B1 re-applies a known-good diff; if `git apply` fails, apply additively by hand.
