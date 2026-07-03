# オンボーディング POP OUT 再現シーン v2（作り直し）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** s158 出荷の `PopOutReenactment` が①暗幕/クリックブロック欠落で NEXT が押せず詰まる②品質が低い、の2点をユーザー実機で確認。拡張チュートリアル（`ExtensionSaveReenactment`）と同じ「偽ブラウザ＋実LPスクショ＋自動で動く緑カーソルがクリックして見せる」方式に**全面作り直し**し、淡々コピーへ更新、タグ付けの一瞬もデモに入れる。

**Architecture:** `PopOutReenactment.tsx`/`.module.css`/`.test.tsx` を全面書き換え（Props 不変＝`{caption, buttonLabel, onAdvance}` なので OnboardingController の配線 [OnboardingController.tsx:336-344] と `steps.ts` は無変更）。コピー `board.onboarding.popout.body` を15言語で確定文へ更新。

**Tech Stack:** Next.js 14 / TS strict / Vanilla CSS Modules / GSAP（Framer Motion 禁止）/ vitest + RTL / 15言語 JSON

**Spec:** `docs/superpowers/specs/2026-07-04-onboarding-popout-reenactment-v2-design.md`

## Global Constraints

- TypeScript strict、`any` 禁止、return type 明示（`(): ReactElement` / `(): void` 等）
- アニメは **GSAP**（Framer Motion 禁止）。`prefers-reduced-motion` 尊重（静止終端）
- CSS は `.module.css`。緑は `#28f100`。z-index マジックナンバー可（オンボ overlay 内で完結・既存 reenactment と同水準）。UI ラベル `NEXT` 直書き
- **実 PiP を開かない・PipStack/PipCompanion 等を import しない**（純視覚再現）
- **`.stage` は必ず `position: fixed; inset:0;` に `background: rgba(6,6,6,0.97)` と `pointer-events: auto` を持つ**（＝詰まり解消の核。欠けると NEXT が押せない）
- POP OUT は desktop 専用（`MOBILE_SCENE_IDS` は無変更＝入れない）。default 盤面 byte-identical
- コピーは15言語すべてに同キー `board.onboarding.popout.body`（`board-onboarding-parity.test.ts` 強制）。文言は**下記の確定文を verbatim**
- `--no-verify` 禁止。テストは `rtk vitest run <path>`（**dev サーバー並走禁止**）。既知フレーキー `tests/lib/channel.test.ts`（再実行で緑）
- Write/Edit 後は独立 Read、commit 後は生 `git log --stat -1` の実出力で確認（偽保存対策・rtk git log はマージを隠す）
- 再現の動き＝**実挙動どおり**：カードは右からグライドイン→中央着地（`power4.out`/0.7s）、常時メーター。緑カーソルが POP OUT を押す→窓が pop→カード流入→「+ TAG」を押してチップ点灯

---

### Task 1: コピー更新 — `board.onboarding.popout.body`（15言語・淡々・タグ&ジャンプ追記）

**Files:**
- Modify: `messages/{ar,de,en,es,fr,it,ja,ko,nl,pt,ru,th,tr,vi,zh}.json`（既存 `board.onboarding.popout.body` を差し替え）
- Test: `messages/board-onboarding-parity.test.ts` / `messages/all-keys-parity.test.ts`（既存・キー存在/構造を強制）

**Interfaces:** Produces: 各 locale の `board.onboarding.popout.body` を確定文へ。Task 2 の `caption` に流れる（OnboardingController の汎用 `body` 解決）。

- [ ] **Step 1: 15言語すべての `board.onboarding.popout.body` を下記へ置換**

既存キーは既に全 locale にある（s158 で追加済）。**値だけ**を次へ差し替える（キー追加ではなく上書き）：

- `en`: `Press POP OUT to open a small window. The cards you save line up there, and you can tag them right in it. Click a card to jump to it in AllMarks.`
- `ja`: `POP OUT を押すと、小さなウィンドウが開きます。保存したカードがそこに並び、そのままタグ付けもできます。カードを押すと、AllMarks を開いてそのカードに移動します。`
- `de`: `Drücke POP OUT, um ein kleines Fenster zu öffnen. Die Karten, die du speicherst, reihen sich darin auf, und du kannst sie direkt dort taggen. Klicke auf eine Karte, um in AllMarks zu ihr zu springen.`
- `es`: `Pulsa POP OUT para abrir una ventana pequeña. Las tarjetas que guardas se alinean ahí y puedes etiquetarlas justo en ella. Haz clic en una tarjeta para saltar a ella en AllMarks.`
- `fr`: `Appuie sur POP OUT pour ouvrir une petite fenêtre. Les cartes que tu enregistres s'y alignent, et tu peux les taguer directement dedans. Clique sur une carte pour y accéder dans AllMarks.`
- `it`: `Premi POP OUT per aprire una piccola finestra. Le carte che salvi si allineano lì e puoi taggarle direttamente al suo interno. Clicca una carta per saltare ad essa in AllMarks.`
- `ko`: `POP OUT을 누르면 작은 창이 열립니다. 저장한 카드가 거기에 나란히 쌓이고, 그 안에서 바로 태그를 달 수 있습니다. 카드를 누르면 AllMarks에서 해당 카드로 이동합니다.`
- `nl`: `Druk op POP OUT om een klein venster te openen. De kaarten die je opslaat komen daar op een rij te staan en je kunt ze er meteen taggen. Klik op een kaart om er in AllMarks naartoe te springen.`
- `pt`: `Pressione POP OUT para abrir uma pequena janela. Os cards que você salva se alinham ali, e você pode marcá-los ali mesmo. Clique em um card para ir até ele no AllMarks.`
- `ru`: `Нажмите POP OUT, чтобы открыть маленькое окно. Сохранённые карточки выстраиваются в нём, и вы можете сразу добавлять к ним теги. Нажмите на карточку, чтобы перейти к ней в AllMarks.`
- `th`: `กด POP OUT เพื่อเปิดหน้าต่างเล็ก ๆ การ์ดที่คุณบันทึกจะเรียงอยู่ในนั้น และคุณแท็กได้ทันทีในหน้าต่างนี้ คลิกที่การ์ดเพื่อกระโดดไปยังการ์ดนั้นใน AllMarks`
- `tr`: `Küçük bir pencere açmak için POP OUT'a bas. Kaydettiğin kartlar orada sıralanır ve onları hemen orada etiketleyebilirsin. Bir karta tıklayarak AllMarks'ta o karta atla.`
- `vi`: `Nhấn POP OUT để mở một cửa sổ nhỏ. Các thẻ bạn lưu sẽ xếp hàng trong đó, và bạn có thể gắn thẻ ngay tại đây. Nhấp vào một thẻ để nhảy đến nó trong AllMarks.`
- `zh`: `按下 POP OUT 会打开一个小窗口。你保存的卡片会排列在里面，可以直接在其中加标签。点击卡片即可跳转到 AllMarks 中的那张卡片。`
- `ar`: `اضغط على POP OUT لفتح نافذة صغيرة. تصطف البطاقات التي تحفظها فيها، ويمكنك وسمها مباشرة داخلها. انقر على بطاقة للانتقال إليها في AllMarks.`

各ファイル JSON valid を維持（値差し替えのみ・カンマ構造は不変）。

- [ ] **Step 2: parity + 妥当性**

Run: `rtk vitest run messages/board-onboarding-parity.test.ts messages/all-keys-parity.test.ts`
Expected: PASS（全15言語に popout.body・構造一致）

- [ ] **Step 3: Commit**

```bash
rtk git add messages/*.json
rtk git commit -m "i18n(onboarding): rewrite POP OUT copy — calm register + tag + jump-to-card, all 15 locales (N-22)"
rtk git log --stat -1
```

---

### Task 2: `PopOutReenactment` 全面書き換え（暗幕/ブロック＋偽ブラウザ＋自動カーソル＋pop-out＋タグ点灯）

**Files:**
- Overwrite: `components/onboarding/PopOutReenactment.tsx`
- Overwrite: `components/onboarding/PopOutReenactment.module.css`
- Overwrite: `components/onboarding/PopOutReenactment.test.tsx`

**Interfaces:** Consumes: `gsap`（既存）。参照アセット `/onboarding/lp-hero-shot.webp`（実在確認済・[ExtensionSaveReenactment.tsx:164] と同じ）。Props 不変＝OnboardingController 無変更。`data-testid="stage-popout-demo"`。

**注意（実装者へ）**: 下記コードは `ExtensionSaveReenactment`（[components/onboarding/ExtensionSaveReenactment.tsx] / `.module.css`）のパターンに厳密に倣っている。**まず参照元をざっと読んで**、`.stage` の暗幕+`pointer-events:auto`・偽ブラウザ・`.viewport` 相対の `rel()` カーソル駆動・`data-cue` の cuePulse・reduced-motion 静止終端という共通契約を理解してから転記すること。コードは verbatim 転記でよいが、型が通らない/テストが通らない箇所は最小修正し、変更点を報告に明記（勝手な演出変更はしない）。

- [ ] **Step 1: テストを先に書いて失敗させる（TDD）**

`components/onboarding/PopOutReenactment.test.tsx`（全置換）:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PopOutReenactment } from './PopOutReenactment'

describe('PopOutReenactment', () => {
  it('renders the caption and fires onAdvance on the NEXT button', () => {
    const onAdvance = vi.fn()
    render(<PopOutReenactment caption="pop it out" buttonLabel="NEXT" onAdvance={onAdvance} />)
    expect(screen.getByText('pop it out')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'NEXT' }))
    expect(onAdvance).toHaveBeenCalledOnce()
  })

  it('renders the fake browser miniature: POP OUT control, companion window, two cards, tag affordance + chip, and the cursor', () => {
    const { container } = render(<PopOutReenactment caption="c" buttonLabel="NEXT" onAdvance={() => {}} />)
    expect(container.querySelector('[data-testid="stage-popout-demo"]')).toBeTruthy()
    expect(container.querySelector('[data-anim="popoutBtn"]')).toBeTruthy()
    expect(container.querySelector('[data-anim="pip"]')).toBeTruthy()
    expect(container.querySelectorAll('[data-anim^="card"]').length).toBe(2)
    expect(container.querySelector('[data-anim="tagBtn"]')).toBeTruthy()
    expect(container.querySelector('[data-anim="chip"]')).toBeTruthy()
    expect(container.querySelector('[data-anim="cursor"]')).toBeTruthy()
  })
})
```

Run: `rtk vitest run components/onboarding/PopOutReenactment.test.tsx` → FAIL（新構造未実装＝現行は popoutBtn/pip/tagBtn/chip/cursor を持たない）

- [ ] **Step 2: コンポーネントを実装（全置換）**

`components/onboarding/PopOutReenactment.tsx`:
```tsx
// components/onboarding/PopOutReenactment.tsx
'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { gsap } from 'gsap'
import styles from './PopOutReenactment.module.css'

type Props = {
  readonly caption: string
  readonly buttonLabel: string
  readonly onAdvance: () => void
}

// Two demo cards so the meter ticks 01 → 02 as saves accumulate in the popped-out
// companion, mirroring the real PiP carousel (new saves append at the RIGHT end +
// auto-scroll the newest to centre). The last (active/centred) card carries the
// "+ TAG" affordance the cursor taps.
const DEMO_CARDS = [
  { id: 'card0', title: 'design ref' },
  { id: 'card1', title: 'article' },
] as const

const pad = (n: number): string => String(n).padStart(2, '0')

/**
 * POP OUT (Document Picture-in-Picture) re-enactment — a faithful visual
 * facsimile built like ExtensionSaveReenactment: a fake browser on a real LP
 * screenshot, with a green cursor that auto-drives the demo. The cursor presses
 * the POP OUT control, a small companion window pops out, saved cards GLIDE IN
 * FROM THE RIGHT and settle at centre (ease-out quart / 0.7s = the real PipStack
 * auto-scroll) while an always-on meter ticks current/total, and the cursor taps
 * "+ TAG" so a tag chip lights. Does NOT open real PiP and does NOT import
 * PipStack/PipCompanion — pure GSAP + CSS. Loops; pulses NEXT after pass 1.
 */
export function PopOutReenactment({ caption, buttonLabel, onAdvance }: Props): ReactElement {
  const vpRef = useRef<HTMLDivElement>(null)
  const [count, setCount] = useState<number>(0)
  const [cuePulse, setCuePulse] = useState<boolean>(false)

  useEffect((): (() => void) | undefined => {
    const vp = vpRef.current
    if (!vp) return undefined
    const q = <T extends HTMLElement>(sel: string): T | null => vp.querySelector<T>(sel)
    const popBtn = q('[data-anim="popoutBtn"]')
    const pip = q('[data-anim="pip"]')
    const tagBtn = q('[data-anim="tagBtn"]')
    const chip = q('[data-anim="chip"]')
    const cursor = q('[data-anim="cursor"]')
    const cards = Array.from(vp.querySelectorAll<HTMLElement>('[data-anim^="card"]'))
    if (!popBtn || !pip || !tagBtn || !chip || !cursor || cards.length < 2) return undefined

    // centre of an element relative to the viewport box (for cursor targeting)
    const rel = (el: HTMLElement): { x: number; y: number } => {
      const r = el.getBoundingClientRect()
      const v = vp.getBoundingClientRect()
      return { x: r.left - v.left + r.width / 2, y: r.top - v.top + r.height / 2 }
    }
    const vw = (): number => vp.getBoundingClientRect().width
    const vh = (): number => vp.getBoundingClientRect().height

    const reset = (): void => {
      gsap.set(pip, { scale: 0.5, opacity: 0, transformOrigin: '85% 8%' })
      gsap.set(cards, { xPercent: 260, opacity: 0 })
      chip.setAttribute('data-on', 'false')
      gsap.set(cursor, { left: vw() * 0.22, top: vh() * 0.84, scale: 1, opacity: 0 })
      setCount(0)
    }

    const reduce =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false

    if (reduce) {
      // Static end state: window popped, both cards centred (last on top),
      // meter full, tag chip lit, cursor hidden.
      gsap.set(pip, { scale: 1, opacity: 1 })
      gsap.set(cards[0], { xPercent: -112, opacity: 1 })
      gsap.set(cards[1], { xPercent: 0, opacity: 1 })
      chip.setAttribute('data-on', 'true')
      gsap.set(cursor, { opacity: 0 })
      setCount(2)
      setCuePulse(true)
      return undefined
    }

    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.0, onRepeat: () => setCuePulse(true) })
    tl.call(reset)
      .to(cursor, { opacity: 1, duration: 0.3, ease: 'power2.out' })
      // cursor glides to the POP OUT control and presses it
      .to(cursor, { left: () => rel(popBtn).x, top: () => rel(popBtn).y, duration: 0.9, ease: 'power2.inOut' }, '+=0.1')
      .to(cursor, { scale: 0.78, duration: 0.13, yoyo: true, repeat: 1, ease: 'power1.inOut' })
      // the companion window pops out
      .to(pip, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.5)' }, '-=0.05')
      .to({}, { duration: 0.3 })
      // card 1 glides in from the right → centre (real PiP auto-scroll values)
      .to(cards[0], { xPercent: 0, opacity: 1, duration: 0.7, ease: 'power4.out' })
      .call(() => setCount(1))
      .to({}, { duration: 0.7 })
      // card 2 arrives; card 1 slides left out of the way (carousel advances)
      .to(cards[0], { xPercent: -112, duration: 0.7, ease: 'power4.out' }, 'in2')
      .to(cards[1], { xPercent: 0, opacity: 1, duration: 0.7, ease: 'power4.out' }, 'in2')
      .call(() => setCount(2))
      .to({}, { duration: 0.55 })
      // cursor taps "+ TAG" on the active card → a tag chip lights green
      .to(cursor, { left: () => rel(tagBtn).x, top: () => rel(tagBtn).y, duration: 0.6, ease: 'power2.inOut' })
      .to(cursor, { scale: 0.8, duration: 0.11, yoyo: true, repeat: 1 })
      .call(() => chip.setAttribute('data-on', 'true'))
      .to({}, { duration: 1.6 })

    return () => { tl.kill() }
  }, [])

  return (
    <div className={styles.stage} data-testid="stage-popout-demo">
      <div className={styles.browser}>
        <div className={styles.chrome}>
          <span className={styles.close} aria-hidden="true" />
          <span className={styles.urlbar}>allmarks.app</span>
        </div>
        <div ref={vpRef} className={styles.viewport}>
          {/* the "real screen" — a screenshot of AllMarks being used */}
          <img className={styles.page} src="/onboarding/lp-hero-shot.webp" alt="" draggable={false} />

          {/* board nav overlay carrying the real POP OUT control */}
          <div className={styles.nav} aria-hidden="true">
            <span className={styles.navItem}>SETTINGS</span>
            <span data-anim="popoutBtn" className={styles.popoutBtn}>
              <span className={styles.navDot} />POP OUT
            </span>
            <span className={styles.navItem}>SHARE</span>
          </div>

          {/* the companion window that pops out */}
          <div data-anim="pip" className={styles.pip} aria-hidden="true">
            <div className={styles.pipBar}><span className={styles.dot} />POP OUT</div>
            <div className={styles.carousel}>
              {DEMO_CARDS.map((c, i) => (
                <div key={c.id} data-anim={`card${i}`} className={styles.card}>
                  <div className={styles.cardThumb} />
                  <div className={styles.cardTitle}>{c.title}</div>
                  {i === DEMO_CARDS.length - 1 && (
                    <>
                      <span data-anim="tagBtn" className={styles.tagBtn}>+ TAG</span>
                      <span data-anim="chip" className={styles.chip} data-on="false">design</span>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className={styles.meter}>
              <span className={styles.meterText}>{pad(count)} / {pad(count)}</span>
            </div>
          </div>

          <span data-anim="cursor" className={styles.cursor} aria-hidden="true" />
        </div>
      </div>
      <p className={styles.caption}>{caption}</p>
      <button
        type="button"
        className={styles.cta}
        data-cue={cuePulse ? 'true' : undefined}
        onClick={onAdvance}
      >
        {buttonLabel}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: CSS を実装（全置換）**

`components/onboarding/PopOutReenactment.module.css`:
```css
/* PopOutReenactment — faithful visual facsimile of the POP OUT (Document PiP)
   companion, built like ExtensionSaveReenactment: fake browser + real LP
   screenshot + a green cursor that auto-drives the demo. The cursor presses
   POP OUT, a companion window pops out, saved cards GLIDE IN FROM THE RIGHT
   into a carousel with an always-on meter, and the cursor taps "+ TAG" so a
   chip lights. Black + green (#28f100). No real PiP imported. */

.stage {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22px;
  background: rgba(6, 6, 6, 0.97);
  color: rgba(255, 255, 255, 0.9);
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
  pointer-events: auto; /* cinema scene blocks the board */
}

/* fake browser window holding the real page screenshot */
.browser {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(680px, 92vw);
  aspect-ratio: 16 / 10;
  background: rgba(14, 14, 16, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
}

.chrome {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.025);
}
.close { position: relative; width: 12px; height: 12px; flex: none; opacity: 0.5; }
.close::before, .close::after {
  content: ''; position: absolute; top: 50%; left: 0; width: 100%; height: 1.5px;
  background: rgba(255, 255, 255, 0.7);
}
.close::before { transform: rotate(45deg); }
.close::after { transform: rotate(-45deg); }
.urlbar {
  flex: 1;
  height: 26px;
  margin: 0 6px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}

.viewport {
  position: relative;
  flex: 1;
  overflow: hidden;
}
.page {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top left;
  user-select: none;
  -webkit-user-drag: none;
}

/* board nav overlay (top-right) carrying the POP OUT control */
.nav {
  position: absolute;
  top: 12px;
  right: 14px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 7px 12px;
  border-radius: 10px;
  background: rgba(10, 10, 12, 0.72);
  font-size: 10px;
  letter-spacing: 0.14em;
  z-index: 3;
}
.navItem { color: rgba(255, 255, 255, 0.45); }
.popoutBtn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.92);
}
.navDot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #28f100; box-shadow: 0 0 7px rgba(40, 241, 0, 0.7);
}

/* the companion window that pops out */
.pip {
  position: absolute;
  right: 22px;
  top: 26%;
  width: 190px;
  height: 196px;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  background: rgba(16, 18, 16, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 20px 46px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(40, 241, 0, 0.07);
  overflow: hidden;
  z-index: 4;
}
.pipBar {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 11px;
  font-size: 9px;
  letter-spacing: 0.18em;
  color: rgba(255, 255, 255, 0.5);
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}
.dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #28f100; box-shadow: 0 0 7px rgba(40, 241, 0, 0.7);
}
.carousel {
  position: relative;
  flex: 1;
  display: grid;
  place-items: center;
  overflow: hidden;
}
.card {
  grid-area: 1 / 1; /* stack cards in one centred cell; GSAP xPercent slides them */
  position: relative;
  width: 104px;
  height: 118px;
  border-radius: 9px;
  background: linear-gradient(165deg, #26302a, #12160f);
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
}
.cardThumb {
  position: absolute;
  inset: 0 0 30px 0;
  background:
    radial-gradient(120% 80% at 30% 20%, rgba(40, 241, 0, 0.14), transparent 60%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.01));
}
.cardTitle {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  padding: 7px 9px;
  font-size: 9px;
  color: rgba(255, 255, 255, 0.72);
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.5));
}
/* "+ TAG" affordance on the active card (mirrors PipCard's isActive affordance) */
.tagBtn {
  position: absolute;
  top: 6px; right: 6px;
  padding: 3px 7px;
  border-radius: 999px;
  font-size: 8px;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.25);
}
/* the tag chip that lights when tapped */
.chip {
  position: absolute;
  left: 6px; bottom: 6px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 8px;
  color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  transition: color 0.25s ease, background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
}
.chip[data-on="true"] {
  color: #28f100;
  background: rgba(40, 241, 0, 0.14);
  border-color: rgba(40, 241, 0, 0.5);
  box-shadow: 0 0 10px rgba(40, 241, 0, 0.3);
}
.meter {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}
.meterText {
  font-size: 9px;
  letter-spacing: 0.16em;
  color: #28f100;
  font-variant-numeric: tabular-nums;
}

/* demo cursor (green-glow arrow, ported from ExtensionSaveReenactment) */
.cursor {
  position: absolute;
  width: 17px;
  height: 23px;
  background: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2014%2019'%3E%3Cpath%20d='M0,0L0,16.6L4.6,12.6L7.1,18.6L9.9,17.4L7.4,11.6L13.4,11.6Z'%20fill='white'%20stroke='%2328f100'%20stroke-width='1.5'%20stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat top left / contain;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 5px rgba(40, 241, 0, 0.9));
  pointer-events: none;
  z-index: 6;
}

.caption {
  max-width: 460px;
  text-align: center;
  font-size: 13.5px;
  line-height: 1.8;
  color: rgba(255, 255, 255, 0.92);
}
.cta {
  font: inherit;
  font-size: 12px;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.95);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 8px;
  padding: 10px 22px;
  cursor: pointer;
}
.cta:hover { background: rgba(255, 255, 255, 0.1); }
.cta[data-cue="true"] {
  border-color: rgba(40, 241, 0, 0.5);
  animation: popoutCtaPulse 1.5s ease-in-out infinite;
}
@keyframes popoutCtaPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(40, 241, 0, 0); }
  50% { box-shadow: 0 0 0 5px rgba(40, 241, 0, 0.18); }
}
@keyframes onb-rise-popout {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: no-preference) {
  .caption { animation: onb-rise-popout 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
}
@media (prefers-reduced-motion: reduce) {
  .cta[data-cue="true"] { animation: none; }
}
```

- [ ] **Step 4: green + tsc**

Run: `rtk vitest run components/onboarding/PopOutReenactment.test.tsx` → PASS（2 tests）
Run: `rtk tsc` → 0 エラー

- [ ] **Step 5: 既存オンボテストが壊れないこと（配線・walk 無変更の確認）**

Run: `rtk vitest run components/onboarding/OnboardingController.test.tsx tests/lib/onboarding-steps.test.ts`
Expected: PASS（Props 不変・シーン順不変なので既存アサーションに影響なし）

- [ ] **Step 6: Commit**

```bash
rtk git add components/onboarding/PopOutReenactment.tsx components/onboarding/PopOutReenactment.module.css components/onboarding/PopOutReenactment.test.tsx
rtk git commit -m "feat(onboarding): rebuild PopOutReenactment to match the extension tutorial — dim/block stage, fake browser on real LP, auto-cursor presses POP OUT, window pops out, cards glide in + tag chip lights (N-22)"
rtk git log --stat -1
```

---

### Task 3: 検証・デプロイ・実機

**Files:** なし（検証のみ・必要なら修正 commit）

- [ ] **Step 1: フルゲート**

Run: `rtk tsc && rtk vitest run && rtk pnpm build`
Expected: tsc 0・全 vitest PASS（`tests/lib/channel.test.ts` フレークは再実行）・`out/` 生成

- [ ] **Step 2: デプロイ**

```bash
rtk pnpm build
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true
```

- [ ] **Step 3: 本番実機（allmarks.app ハードリロード → オンボを頭から → POP OUT シーン）**

1. **暗幕が出て NEXT が押せる・盤面が固まる**（詰まり解消＝最重要）
2. 緑カーソルが **POP OUT を押す → 小窓がポンと浮く → デモカードが右から1枚→2枚入る**、下メーター `00/00→01/01→02/02`
3. カーソルが **+ TAG を押して、タグチップ（design）が緑に光る**
4. キャプションが淡々コピー（他シーンと同じトーン）、NEXT で manage へ／SKIP／`prefers-reduced-motion` で静止（窓表示・カード中央・チップ点灯・メーター満）
5. 通常盤面（オンボ外）が byte-identical

注: オンボは実クリック主体で Playwright 自動化が不安定。可能なら popout シーンのスクショで暗幕・レイアウトの粗検出。最終はユーザー実機目視。

- [ ] **Step 4: セッション記録**

`docs/TODO.md` / `docs/TODO_COMPLETED.md`（narrative）/ `docs/CURRENT_GOAL.md` を更新 → commit → push。

---

## Self-Review 済メモ

- spec 全項目カバー: 暗幕/ブロック=`.stage` の `pointer-events:auto`+dim（Task2 CSS）／偽ブラウザ+実LP=Task2 構造／自動カーソル click-pulse=Task2 GSAP／pop-out=`back.out`／カード右グライド=`power4.out`/0.7s／タグ点灯=`+ TAG`→chip data-on／常時メーター=ガード無し／15言語淡々コピー=Task1／props 不変で配線無変更。
- 型整合: Props（caption/buttonLabel/onAdvance）不変＝OnboardingController の呼び出しと一致。`data-anim` セレクタは実装の要素と一致（popoutBtn/pip/tagBtn/chip/cursor/card0/card1）。
- 実 PiP 非結合: import は react/gsap/CSS のみ（PipStack/PipCompanion なし）。
- reduced-motion: 静止終端（窓表示・カード中央・チップ点灯・メーター2/2・カーソル非表示・cuePulse）＋CSS でパルス停止。
- 行番号は 2026-07-04 時点。編集時は前後コードで照合（行ズレ許容）。
