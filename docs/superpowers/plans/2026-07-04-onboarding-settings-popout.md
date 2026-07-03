# オンボーディング改善（N-21 SETTINGS caption / N-22 POP OUT 再現シーン）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** チュートリアルの2つの穴を塞ぐ — SETTINGS 説明が開いたドロワーに埋もれる件（N-21）を下中央キャプションで直し、POP OUT の説明が無い件（N-22）を「右からカードがグライドインする」忠実な再現シーンで追加する。

**Architecture:** N-21 は `manage/settings` beat のスポットライトに既存 `captionAtBottom` prop を渡す1行修正。N-22 は `ONBOARDING_SCENES` に `popout` cinema シーンを `install` の後に追加し、新 `PopOutReenactment`（GSAP・実 PiP コンポーネントは import しない純視覚再現）を OnboardingController の cinema 分岐で描画、15言語コピーを足す。

**Tech Stack:** Next.js 14 App Router / TypeScript strict / Vanilla CSS Modules / GSAP（既存 reenactment と同じ・Framer Motion 禁止）/ vitest + React Testing Library / next-intl 風 15言語 JSON

**Spec:** `docs/superpowers/specs/2026-07-04-onboarding-settings-popout-design.md`

## Global Constraints

- TypeScript strict。`any` 禁止。Return type 明示（`(): void =>` 等）
- アニメは **GSAP**（Framer Motion 禁止＝CLAUDE.md）。`prefers-reduced-motion` 尊重
- CSS は `.module.css`。色は AllMarks の pill 語彙（✓green `#28f100`）。z-index マジックナンバー禁止（この計画では新 z-index 不要＝オンボ overlay 内で完結）
- UI ラベル英語直書き（`NEXT` 等）。説明本文は15言語 JSON（`board.onboarding.popout.body`）。**15言語すべてに同じキー**（`messages/board-onboarding-parity.test.ts` が強制）
- **実 PiP は開かない・PipStack/PipCompanion 等は import しない**（純粋な視覚再現）
- POP OUT は **desktop 専用**＝`MOBILE_SCENE_IDS` に入れない
- default 盤面 byte-identical（オンボ overlay 外の DOM/CSS は不変）
- `--no-verify` 禁止。テストは `rtk vitest run <path>`（**dev サーバー並走禁止**）。既知フレーキー `tests/lib/channel.test.ts`（再実行で緑）
- Write/Edit 後は独立 Read、commit 後は生 `git log --stat -1` の実出力で確認（偽保存対策・rtk git log はマージを隠すので確認は生 git）
- 再現の動きは**実挙動どおり**：カードは**右からグライドイン→中央着地**（ease `power4.out`＝ease-out quart / 0.7s＝実 PiP の値）、下に**常時メーター**（現在/全体・両方インクリメント）。「上から落ちる」は誤り

---

### Task 1: N-21 — SETTINGS 説明を下中央に（captionAtBottom）

**Files:**
- Modify: `components/onboarding/OnboardingController.tsx`（`manage`/`settings` beat の `OnboardingSpotlight`）

**Interfaces:**
- Consumes: 既存 `OnboardingSpotlight` の `captionAtBottom?: boolean`（true で `.bubbleBottom` 固定・[OnboardingSpotlight.tsx:145-146](../../../components/onboarding/OnboardingSpotlight.tsx#L145)）。`motion` シーンが既に使用中の実績パターン
- Produces: なし

**注**: この beat は盤面（SETTINGS ドロワー）が無いと `quick-tag-toggle` の rect が測れず、単体レンダリングテストで下中央バブルを再現できない（rect=null 時は別分岐）。よって tsc + 本番実機目視で検証する（`motion` シーンで同 prop が機能する実績が担保）。1 prop の宣言的変更。

- [ ] **Step 1: `captionAtBottom` を追加**

`components/onboarding/OnboardingController.tsx` の `settings` beat（現状）:
```tsx
          <OnboardingSpotlight
            targetSelector={TARGET_SELECTOR['quick-tag-toggle']}
            caption={t('board.onboarding.manage.settingsBody')}
          >
```
を次に変更（`captionAtBottom` を1行追加。他は不変）:
```tsx
          <OnboardingSpotlight
            targetSelector={TARGET_SELECTOR['quick-tag-toggle']}
            caption={t('board.onboarding.manage.settingsBody')}
            captionAtBottom
          >
```

- [ ] **Step 2: tsc**

Run: `rtk tsc`
Expected: 0 エラー

- [ ] **Step 3: 既存オンボテストが壊れないこと**

Run: `rtk vitest run components/onboarding/OnboardingController.test.tsx`
Expected: PASS（変更は宣言的・既存アサーションに影響しない）

- [ ] **Step 4: Commit**

```bash
rtk git add components/onboarding/OnboardingController.tsx
rtk git commit -m "fix(onboarding): move SETTINGS beat caption to bottom-center so it isn't buried by the open drawer (N-21)"
rtk git log --stat -1
```

---

### Task 2: N-22a — `popout` シーンを steps に追加

**Files:**
- Modify: `lib/onboarding/steps.ts`（`SceneId` union + `ONBOARDING_SCENES`）
- Test: `tests/lib/onboarding-steps.test.ts`（既存を更新）

**Interfaces:**
- Produces（後続タスクが依存）: `SceneId` に `'popout'` を追加。`ONBOARDING_SCENES` の順序＝`enter, paste, tag, motion, extDemo, install, popout, manage, share, finale`（10件）。`{ id: 'popout', kind: 'cinema', advance: 'button' }`（target なし）。`nextSceneId('install')==='popout'`、`nextSceneId('popout')==='manage'`

- [ ] **Step 1: 既存テストを新順序に更新（先に失敗させる）**

`tests/lib/onboarding-steps.test.ts` の2箇所を更新:

`'has 9 scenes in the spec order'` テスト → 10件・popout を install の後に:
```ts
  it('has 10 scenes in the spec order', () => {
    expect(ONBOARDING_SCENES.map((s) => s.id)).toEqual([
      'enter', 'paste', 'tag', 'motion', 'extDemo', 'install', 'popout', 'manage', 'share', 'finale',
    ])
  })
```

`'nextSceneId walks the chain then ends'` テスト → install→popout→manage を反映:
```ts
  it('nextSceneId walks the chain then ends', () => {
    expect(nextSceneId('enter')).toBe('paste')
    expect(nextSceneId('install')).toBe('popout')
    expect(nextSceneId('popout')).toBe('manage')
    expect(nextSceneId('manage')).toBe('share')
    expect(nextSceneId('share')).toBe('finale')
    expect(nextSceneId('finale')).toBeNull()
  })
```

さらに popout が cinema・target 無し・モバイル除外を明示する新テストを追加（`describe` 内の末尾）:
```ts
  it('popout is a desktop-only cinema scene between install and manage', () => {
    expect(sceneById('popout').kind).toBe('cinema')
    expect(sceneById('popout').advance).toBe('button')
    expect(sceneById('popout').target).toBeUndefined()
    expect(MOBILE_SCENE_IDS).not.toContain('popout')
  })
```

- [ ] **Step 2: 失敗を確認**

Run: `rtk vitest run tests/lib/onboarding-steps.test.ts`
Expected: FAIL（現 steps.ts は9件・`nextSceneId('install')==='manage'`）

- [ ] **Step 3: steps.ts を更新**

`lib/onboarding/steps.ts` の `SceneId`（12行目）に `'popout'` を追加:
```ts
export type SceneId =
  | 'enter' | 'paste' | 'tag' | 'motion' | 'extDemo' | 'install' | 'popout' | 'manage' | 'share' | 'finale'
```

`ONBOARDING_SCENES`（22-32行目）に `install` の直後・`manage` の直前へ1行挿入:
```ts
  { id: 'install', kind: 'handsOn', advance: 'button' },
  { id: 'popout',  kind: 'cinema',  advance: 'button' },
  { id: 'manage',  kind: 'handsOn', advance: 'button', target: 'manage' },
```
（`MOBILE_SCENE_IDS` は無変更＝popout はモバイル列に入らない）

- [ ] **Step 4: green を確認**

Run: `rtk vitest run tests/lib/onboarding-steps.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
rtk git add lib/onboarding/steps.ts tests/lib/onboarding-steps.test.ts
rtk git commit -m "feat(onboarding): add desktop-only 'popout' cinema scene after install (N-22)"
rtk git log --stat -1
```

---

### Task 3: N-22b — `PopOutReenactment` コンポーネント

**Files:**
- Create: `components/onboarding/PopOutReenactment.tsx`
- Create: `components/onboarding/PopOutReenactment.module.css`
- Test: `components/onboarding/PopOutReenactment.test.tsx`

**Interfaces:**
- Consumes: `gsap`（既存依存）
- Produces（Task 5 が描画）: `export function PopOutReenactment(props: { readonly caption: string; readonly buttonLabel: string; readonly onAdvance: () => void }): ReactElement`。`data-testid="stage-popout-demo"`

- [ ] **Step 1: 失敗するテストを書く**

`components/onboarding/PopOutReenactment.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PopOutReenactment } from './PopOutReenactment'

describe('PopOutReenactment', () => {
  it('renders the caption and fires onAdvance on the button', () => {
    const onAdvance = vi.fn()
    render(<PopOutReenactment caption="pop it out" buttonLabel="NEXT" onAdvance={onAdvance} />)
    expect(screen.getByText('pop it out')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'NEXT' }))
    expect(onAdvance).toHaveBeenCalledOnce()
  })

  it('renders the popout demo stage with two demo cards', () => {
    const { container } = render(<PopOutReenactment caption="c" buttonLabel="NEXT" onAdvance={() => {}} />)
    expect(container.querySelector('[data-testid="stage-popout-demo"]')).toBeTruthy()
    expect(container.querySelectorAll('[data-anim^="card"]').length).toBe(2)
  })
})
```

- [ ] **Step 2: 失敗を確認**

Run: `rtk vitest run components/onboarding/PopOutReenactment.test.tsx`
Expected: FAIL（モジュール未作成）

- [ ] **Step 3: コンポーネントを実装**

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

// Neutral labels — no borrowed brand. Two cards so the meter ticks 01 → 02,
// mirroring the real PiP where each save appends to the RIGHT end of the
// carousel and auto-scrolls the newest to centre.
const DEMO_CARDS = ['clip', 'article'] as const

const pad = (n: number): string => String(n).padStart(2, '0')

/**
 * POP OUT (Document Picture-in-Picture) re-enactment. A faithful mock — the
 * real PiP can't be driven inline (OS window + user gesture), same as the
 * extension/bookmarklet demos. Cards GLIDE IN FROM THE RIGHT and settle at
 * centre (ease-out quart / 0.7s = the real PipStack auto-scroll), and an
 * always-on meter below ticks current/total as the deck grows. Does NOT open
 * real PiP and does NOT import PipStack/PipCompanion (pure visual facsimile).
 */
export function PopOutReenactment({ caption, buttonLabel, onAdvance }: Props): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null)
  const [count, setCount] = useState<number>(0)
  const [cuePulse, setCuePulse] = useState<boolean>(false)

  useEffect((): (() => void) | undefined => {
    const root = rootRef.current
    if (!root) return undefined
    const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-anim^="card"]'))
    if (cards.length < 2) return undefined

    const reduce =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false

    const reset = (): void => {
      gsap.set(cards, { xPercent: 260, opacity: 0 }) // parked off to the right
      setCount(0)
    }

    if (reduce) {
      // Static end state: both cards centred (last one on top), meter full.
      gsap.set(cards[0], { xPercent: -110, opacity: 1 })
      gsap.set(cards[1], { xPercent: 0, opacity: 1 })
      setCount(2)
      setCuePulse(true)
      return undefined
    }

    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.1, onRepeat: () => setCuePulse(true) })
    tl.call(reset)
      .to({}, { duration: 0.35 })
      // card 1 glides in from the right → centre (ease-out quart, 0.7s = real PiP)
      .to(cards[0], { xPercent: 0, opacity: 1, duration: 0.7, ease: 'power4.out' })
      .call(() => setCount(1))
      .to({}, { duration: 0.9 })
      // card 2 arrives; card 1 slides left out of the way (the carousel advances)
      .to(cards[0], { xPercent: -110, duration: 0.7, ease: 'power4.out' }, 'in2')
      .to(cards[1], { xPercent: 0, opacity: 1, duration: 0.7, ease: 'power4.out' }, 'in2')
      .call(() => setCount(2))
      .to({}, { duration: 1.7 })

    return () => { tl.kill() }
  }, [])

  return (
    <div className={styles.stage} data-testid="stage-popout-demo">
      {/* faint suggestion of "other apps" behind the floating companion */}
      <div className={styles.backdrop} aria-hidden="true" />
      <div ref={rootRef} className={styles.window} aria-hidden="true">
        <div className={styles.titlebar}><span className={styles.dot} />POP OUT</div>
        <div className={styles.carousel}>
          {DEMO_CARDS.map((c, i) => (
            <div key={c} data-anim={`card${i}`} className={styles.card}>{c}</div>
          ))}
        </div>
        <div className={styles.meter}>
          {count > 0 && <span className={styles.meterText}>{pad(count)} / {pad(count)}</span>}
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

`components/onboarding/PopOutReenactment.module.css`:
```css
/* PopOutReenactment — faithful mock of the POP OUT (Document PiP) companion.
   Cards glide IN FROM THE RIGHT and centre (matching the real PiP carousel:
   new saves append to the right end + auto-scroll), with an always-on meter
   below. Black + green sound-wave language. No real PiP components imported. */

.stage {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22px;
}

.backdrop {
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(115deg, rgba(255, 255, 255, 0.015) 0 2px, transparent 2px 22px),
    radial-gradient(60% 50% at 50% 40%, rgba(40, 241, 0, 0.05), transparent 70%);
  pointer-events: none;
}

.window {
  position: relative;
  width: 300px;
  height: 300px;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  background: rgba(16, 18, 16, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.10);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(40, 241, 0, 0.06);
  overflow: hidden;
}

.titlebar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font: 600 10px/1 ui-monospace, "SF Mono", Consolas, monospace;
  letter-spacing: 0.18em;
  color: rgba(255, 255, 255, 0.5);
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #28f100;
  box-shadow: 0 0 8px rgba(40, 241, 0, 0.7);
}

.carousel {
  position: relative;
  flex: 1;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.card {
  grid-area: 1 / 1; /* stack both cards in one centred cell; GSAP xPercent slides them */
  width: 128px;
  height: 150px;
  border-radius: 10px;
  background: linear-gradient(160deg, #232823, #141715);
  border: 1px solid rgba(255, 255, 255, 0.10);
  display: flex;
  align-items: flex-end;
  padding: 10px;
  font: 500 12px/1 ui-monospace, "SF Mono", Consolas, monospace;
  color: rgba(255, 255, 255, 0.7);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.4);
}

.meter {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 26px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}

.meterText {
  font: 600 10px/1 ui-monospace, "SF Mono", Consolas, monospace;
  letter-spacing: 0.16em;
  color: #28f100;
  font-variant-numeric: tabular-nums;
}

.caption {
  max-width: 440px;
  margin: 0;
  text-align: center;
  font-family: inherit;
  font-size: 15px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.82);
}

.cta {
  appearance: none;
  border: 1px solid rgba(40, 241, 0, 0.45);
  background: rgba(40, 241, 0, 0.12);
  color: #28f100;
  font: 600 12px/1 ui-monospace, "SF Mono", Consolas, monospace;
  letter-spacing: 0.14em;
  padding: 11px 26px;
  border-radius: 999px;
  cursor: pointer;
}

.cta[data-cue="true"] { animation: popoutCue 1.4s ease-in-out infinite; }

@keyframes popoutCue {
  0%, 100% { box-shadow: 0 0 0 rgba(40, 241, 0, 0); }
  50% { box-shadow: 0 0 18px rgba(40, 241, 0, 0.4); }
}

@media (prefers-reduced-motion: reduce) {
  .cta[data-cue="true"] { animation: none; }
}
```

- [ ] **Step 4: green を確認**

Run: `rtk vitest run components/onboarding/PopOutReenactment.test.tsx`
Expected: PASS（2 tests）

- [ ] **Step 5: Commit**

```bash
rtk git add components/onboarding/PopOutReenactment.tsx components/onboarding/PopOutReenactment.module.css components/onboarding/PopOutReenactment.test.tsx
rtk git commit -m "feat(onboarding): PopOutReenactment — cards glide in from the right into a floating PiP mock (N-22)"
rtk git log --stat -1
```

---

### Task 4: N-22c — 15言語コピー `board.onboarding.popout.body`

**Files:**
- Modify: `messages/en.json` ほか15言語すべて（ar, de, en, es, fr, it, ja, ko, nl, pt, ru, th, tr, vi, zh）
- Test: `messages/board-onboarding-parity.test.ts`（既存・キー存在を強制）

**Interfaces:**
- Produces: `board.onboarding.popout.body`（各言語）。Task 5 の `body = t('board.onboarding.popout.body')` が参照

- [ ] **Step 1: en に追加して parity を失敗させる**

各 `messages/<locale>.json` の `board.onboarding` ブロック内（`finale` の隣で可）に `"popout"` キーを追加。まず en だけ入れて parity テストを走らせ、他言語欠落で失敗することを確認する。

`messages/en.json`（`"finale": { ... }` の後にカンマ＋追加）:
```json
      "finale": {
        "body": "You're set. Replay this anytime from SETTINGS."
      },
      "popout": {
        "body": "Pop out a little companion window. Keep it floating over your other apps — everything you save slides in from the right while you browse."
      }
```

- [ ] **Step 2: parity 失敗を確認**

Run: `rtk vitest run messages/board-onboarding-parity.test.ts`
Expected: FAIL（en にのみ popout があり他14言語に無い）

- [ ] **Step 3: 残り14言語に同キーを追加**

各ファイルの `board.onboarding` ブロックに `"popout": { "body": "<下記>" }` を追加（`finale` の隣）:

- `messages/ja.json`: `"POP OUT で小さな相棒を切り離せます。別のアプリの上に浮かべておけば、保存したものが右からどんどん溜まっていきます。"`
- `messages/ar.json`: `"أخرِج نافذة رفيقة صغيرة، واتركها تطفو فوق تطبيقاتك الأخرى — كل ما تحفظه ينزلق إليها من اليمين أثناء التصفح."`
- `messages/de.json`: `"Klappe ein kleines Begleitfenster aus. Lass es über deinen anderen Apps schweben – alles, was du speicherst, gleitet beim Surfen von rechts hinein."`
- `messages/es.json`: `"Abre una pequeña ventana acompañante. Déjala flotando sobre tus otras apps: todo lo que guardas se desliza desde la derecha mientras navegas."`
- `messages/fr.json`: `"Détache une petite fenêtre compagnon. Laisse-la flotter au-dessus de tes autres applis — tout ce que tu enregistres y glisse par la droite pendant que tu navigues."`
- `messages/it.json`: `"Stacca una piccola finestra compagna. Lasciala fluttuare sopra le tue altre app: tutto ciò che salvi scivola dentro da destra mentre navighi."`
- `messages/ko.json`: `"작은 동반 창을 팝아웃하세요. 다른 앱 위에 띄워 두면, 탐색하는 동안 저장한 것들이 오른쪽에서 미끄러져 들어옵니다."`
- `messages/nl.json`: `"Klap een klein metgezelvenster uit. Laat het boven je andere apps zweven — alles wat je opslaat schuift van rechts naar binnen terwijl je browst."`
- `messages/pt.json`: `"Destaque uma pequena janela companheira. Deixe-a flutuando sobre seus outros apps — tudo o que você salva desliza pela direita enquanto você navega."`
- `messages/ru.json`: `"Выдвиньте маленькое окно-компаньон. Пусть оно плавает поверх других приложений — всё, что вы сохраняете, вплывает справа, пока вы просматриваете."`
- `messages/th.json`: `"ป็อปหน้าต่างคู่ใจเล็ก ๆ ออกมา แล้ววางให้ลอยอยู่เหนือแอปอื่น ๆ — ทุกสิ่งที่คุณบันทึกจะเลื่อนเข้ามาจากทางขวาระหว่างที่คุณเปิดดู"`
- `messages/tr.json`: `"Küçük bir yardımcı pencere açın. Diğer uygulamalarınızın üzerinde yüzer bırakın — gezinirken kaydettiğiniz her şey sağdan içeri kayar."`
- `messages/vi.json`: `"Bật ra một cửa sổ bạn đồng hành nhỏ. Cứ để nó nổi trên các ứng dụng khác — mọi thứ bạn lưu sẽ trượt vào từ bên phải khi bạn duyệt web."`
- `messages/zh.json`: `"弹出一个小小的伴随窗口，让它浮在其他应用之上——浏览时，你保存的一切都会从右侧滑入其中。"`

各ファイルとも JSON が valid であること（末尾カンマに注意）。

- [ ] **Step 4: parity + JSON 妥当性を確認**

Run: `rtk vitest run messages/board-onboarding-parity.test.ts messages/all-keys-parity.test.ts`
Expected: PASS（全15言語に popout.body・キー構造一致）

- [ ] **Step 5: Commit**

```bash
rtk git add messages/*.json
rtk git commit -m "i18n(onboarding): add board.onboarding.popout.body in all 15 locales (N-22)"
rtk git log --stat -1
```

---

### Task 5: N-22d — OnboardingController に popout cinema 分岐を配線

**Files:**
- Modify: `components/onboarding/OnboardingController.tsx`（import 追加 + cinema 分岐に popout ケース）

**Interfaces:**
- Consumes: Task 3 `PopOutReenactment`、Task 2 の `popout` シーン、Task 4 の `board.onboarding.popout.body`。既存の `body = t(\`board.onboarding.${sceneId}.body\`)`（[OnboardingController.tsx:276](../../../components/onboarding/OnboardingController.tsx#L276)）が popout の body を自動解決、`advance`（NEXT で次シーン）、`wrap()`

- [ ] **Step 1: import を追加**

`components/onboarding/OnboardingController.tsx` の import 群（22行目 `BookmarkletSaveReenactment` の隣）に追加:
```tsx
import { BookmarkletSaveReenactment } from './BookmarkletSaveReenactment'
import { PopOutReenactment } from './PopOutReenactment'
```

- [ ] **Step 2: cinema 分岐に popout ケースを追加**

cinema ブロック内、`share` の分岐の後・末尾の汎用 `OnboardingStage` return（現状 `return wrap(<OnboardingStage ... />)`）の**直前**に追加:
```tsx
    if (sceneId === 'popout') {
      return wrap(
        <PopOutReenactment
          caption={body}
          buttonLabel="NEXT"
          onAdvance={advance}
        />,
      )
    }
    return wrap(
      <OnboardingStage
        variant={sceneId === 'finale' ? 'finale' : 'enter'}
        caption={body}
        buttonLabel={sceneId === 'enter' ? 'START' : 'NEXT'}
        onAdvance={advance}
      />,
    )
```
（`popout` は `kind: 'cinema'` なので cinema ブロックに入る。この分岐が無いと汎用 `OnboardingStage` にフォールバックしてしまうため、必ず share ケースの後に置く）

- [ ] **Step 3: tsc + オンボテスト**

Run: `rtk tsc && rtk vitest run components/onboarding/OnboardingController.test.tsx`
Expected: tsc 0・PASS

- [ ] **Step 4: Commit**

```bash
rtk git add components/onboarding/OnboardingController.tsx
rtk git commit -m "feat(onboarding): render PopOutReenactment for the popout scene (N-22)"
rtk git log --stat -1
```

---

### Task 6: 検証・デプロイ・実機

**Files:** なし（検証のみ・必要なら修正 commit）

- [ ] **Step 1: フルゲート**

Run: `rtk tsc && rtk vitest run && rtk pnpm build`
Expected: tsc 0・全 vitest PASS（`tests/lib/channel.test.ts` フレークは再実行）・`out/` 生成

- [ ] **Step 2: デプロイ**

```bash
rtk pnpm build
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true
```

- [ ] **Step 3: 本番実機（allmarks.app ハードリロード → オンボを頭から）**

1. SETTINGS を説明する beat（manage の settings）で、**説明が画面下中央に出て、開いた SETTINGS ドロワーに重ならず読める**（N-21）
2. `install`（ブックマークレット）の**次に POP OUT シーン**が出る（N-22）
3. POP OUT シーンで**カードが右からスッと入って中央に着地**し、下のメーターが 01/01→02/02 と進む（「上から落ちる」ではない）
4. NEXT で manage に進む／SKIP で離脱できる／`prefers-reduced-motion` で動きが静止する
5. 通常盤面（オンボ外）が byte-identical（回帰なし）

注: オンボは実クリック主体で Playwright 自動化が不安定。上記はユーザー実機目視で最終確認。自動化できる範囲（steps 順序・コンポーネント描画）は単体テストで担保済み。

- [ ] **Step 4: セッション記録**

`docs/TODO.md`（N-21/N-22 を完了へ）・`docs/TODO_COMPLETED.md`（narrative）・`docs/CURRENT_GOAL.md`（次セッション）を更新 → commit → push。

---

## Self-Review 済メモ

- spec 全項目カバー: N-21 caption=T1／popout シーン=T2／再現コンポーネント=T3／15言語=T4／配線=T5／検証=T6。実挙動（右グライドイン・power4.out/0.7s・常時メーター）は T3 の GSAP に反映。desktop 限定（MOBILE 除外）=T2。実 PiP を開かない/import しない=T3 の JSDoc + 実装。
- 型整合: `PopOutReenactment` の props（caption/buttonLabel/onAdvance）＝T3 定義＝T5 の呼び出しと一致。`popout` SceneId＝T2＝T5 分岐条件と一致。`body` は既存の scene 汎用解決を再利用（T5）。
- placeholder なし: 15言語コピーは全て実文字列を記載。テストコードは実コード。
- 行番号は 2026-07-04 時点の実測。編集時は前後コードで照合（行ズレ許容）。
