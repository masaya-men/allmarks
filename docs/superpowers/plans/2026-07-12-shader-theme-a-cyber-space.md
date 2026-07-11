# SHADER-THEME A: CYBER SPACE（WebGL インテリアマッピング・純背景テーマ）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **実行時期: 既存の計画済みタスク（N-56〜N-53・CUTOUT・TOWER）が済んでから**（ユーザー決定 s187）。TOWER（`2026-07-12-shader-theme-b-tower.md`）が先。
> **共通土台の重複注意**: TOWER の Task 0 が `lib/board/shader-layer.ts`（＋テスト）と `ThemeMeta.webglBackground` を先に作る（本計画の Task 2 Step 3 / Task 1 Step 1 のコードを写経する取り決め）。**本計画を実行する時点でそれらが既に在れば、該当 Step はスキップして再利用する**（Task 0 のモック保全も同様）。

**Goal:** 新テーマ `cyber-space` を追加する。ボード全体が「奥行きのある真っ黒なサイバー空間（箱の内側）」に浮かんで見える WebGL 背景。インテリアマッピング（各ピクセルから仮想の箱の内側へ光線を飛ばし、奥壁・左右壁・床・天井のどこに当たるかを 1 パスで解く）で、スクロールすると視点が動き本物の奥行きに見える。床の目盛り線を緑の光が奥へ走る（MOTION OFF で停止）。

**Architecture:** 既存テーマシステムに 1 テーマ追加（registry + globals トークン + ThemePicker 地色 + i18n）。背景は新部品 `CyberSpaceLayer`（**raw WebGL・依存ゼロ**・canvas 1枚・1パス・DPR≤1.5）を patternLayer と同型の **viewport 固定層**（translate ラッパ外・`inset:0`・`zIndex: THEME_BG`・`pointerEvents:'none'`）としてマウント。視差はスクロール（`viewport.y`）駆動＝既存ポリシー「パララックスは MOTION 非依存・`prefers-reduced-motion` のみ尊重」（use-paper-parallax の家訓）に従う。**撮影（dom-to-image）は生 canvas を写せる保証が無い**ので、`capturing` 中だけ canvas を `toDataURL()` スナップショットの `<img>` に差し替える（ライブ DOM の絵は不変）。s187 モックで GLSL・視差・60fps は検証済み。

**Tech Stack:** raw WebGL1（three/R3F 不使用・新規依存ゼロ）/ TypeScript strict / Vanilla CSS Modules / vitest / Playwright

## 設計判断（s187 ユーザー承認済み）

- 見た目 = s187 モックの **A · CYBER SPACE**（承認済み）。真っ黒な箱の内側・稜線と床の目盛り線・手前ほどロゴの緑 `#28F100`・奥ほど白く霞む・床の線を緑のパルスが奥へ走る。
- `tier: 'free'` で登録し、**K3 実装時に `'paid'` へ 1 行変更**（プレミアム1本目の扱いは `docs/private/2026-07-12-monetization-recheck-s187.md` §2 が正。K3 前に `'paid'` にすると誰も選べない＝`resolveThemeId` が default に落とす）。
- `kind: 'work'`（カスタマイズ無し・世界観固定）。`colorScheme: 'dark'`、`scrollMeterVariant: 'waveform'`、`direction: 'vertical'`。
- 視差の入力は **スクロールのみ**（マウス追従はしない）。スマホでもデスクトップでも同じ入力で成立する。`prefers-reduced-motion` では視差 0（`useReducedMotion`）。MOTION OFF ではパルス（時間）だけ止まり、スクロール視差は生きる。
- WebGL 不可/コンテキスト喪失時は **CSS フォールバック**（globals の暗色地）に自動で落ちる（canvas を隠すだけ。診断ビルド不要）。
- 受け取り画面（`/s/`）は v1 では **CSS フォールバック地色のみ**（ペイロードはテーマ id を運ぶが、受信側の WebGL 対応は後続）。共有「画像」にはスナップショット差し替えで本物が写る。

## Global Constraints

- TypeScript `strict: true`。`any` 禁止。return type 明示。CSS は `.module.css`。Tailwind / Framer Motion / three.js 追加 禁止（raw WebGL のみ・新規依存ゼロ）
- **既定テーマ（dotted-notebook）と他テーマの描画はバイト同一**。新レイヤーは `themeMeta.webglBackground` ゲートの内側のみ
- 4K fill-rate 予算: canvas は DPR ≤ 1.5・1 パス・タブ非表示で rAF 停止（ブラウザ任せ）・テーマ非選択時は unmount
- パララックスは MOTION 非依存・`prefers-reduced-motion` のみ尊重（`use-paper-parallax.ts` L5-14 の既存ポリシー）
- z-index は `BOARD_Z_INDEX.THEME_BG`（既存 0）を使う。新定数不要
- UI 文言・テーマ名は i18n（`board.theme.cyberSpace` ×15言語。名前は "Cyber Space" 固定＝訳さない）
- git は `rtk` 前置。`--no-verify` 絶対禁止。vitest は `rtk npx vitest run <file>`、Playwright は素の `npx playwright test`

## 事実の索引（s187 調査済み・行番号は関数名/セレクタで吸収）

- テーマ追加で触るファイル: `lib/board/types.ts:3`（ThemeId union）/ `lib/board/theme-registry.ts:3-38`（THEME_REGISTRY・`DEFAULT_THEME_ID` L40）/ `components/board/themes.module.css`（backgroundClassName クラス）/ `app/globals.css`（`html[data-theme-id="…"]` トークン塊・paper の例 L458-580）/ `components/board/ThemePicker.module.css:12-15`（スウォッチ地色）/ `messages/*`（labelKey）。`lib/share/validate-v2.ts:48` は `listThemeIds()` から enum 生成＝**自動追随**
- `ThemeMeta` 型: `lib/board/types.ts:53-96`（`decorations?: boolean` L94 が「テーマ固有フラグ」の先例）
- 背景レイヤーの器（viewport 固定の先例）: BoardRoot.tsx L3129-3149 patternLayer ＝ `hydrated && themeMeta.kind==='pattern' && resolvedCustom` のとき `position:absolute; inset:0; zIndex:THEME_BG`、translate ラッパの**外**
- `[data-theme-id]` は `<html>`（BoardRoot L830-844・localStorage `'allmarks-theme-id'` プリペイント）＋ ThemeLayer div ＋ プリペイントスクリプト `app/(app)/layout.tsx:10-19`
- テーマ永続: IDB settings `'board-config'`（`lib/storage/board-config.ts` L8/L25-33、`BoardConfig.themeId` types.ts:155）
- MOTION: `motionEnabled` state（BoardRoot L246）・IDB ハイドレート L800-825（reduced-motion 既定 OFF）・`useReducedMotion`（`lib/board/use-reduced-motion.ts:6-16`）
- viewport（スクロール位置の真実）: BoardRoot L327 `viewport {x,y,w,h}`。デスクトップ=transform 駆動・モバイル=scrollTop ミラー（L1205-1211）
- 撮影: `.outerFrame` 丸ごと dom-to-image（THEME_BG は写る位置）。`deriveCaptureBoardColor`（L2391-2399）。**canvas を撮影した実績なし＝要スナップショット差し替え**。`capturing` state（L1620）と `data-capturing` 属性（L2888）
- WebGL 先例: `LightboxFlipScene`（R3F。ただし本計画は raw WebGL）。`fill-rate 4K 予算`注記は `themes.module.css:81-82`
- s187 モック（GLSL 検証済み・実測 60fps）: `docs/private/theme-mockups/` に保存する（Task 0 参照）。インテリアマッピング核 = `roomHit`（光線と箱の交差・face 判定）

---

### Task 0: モックの GLSL を repo に保全 【どのモデルでも可】

- [ ] s187 のモック HTML（会話の Artifact「AllMarks シェーダーテーマ モック」の最終版）を `docs/private/theme-mockups/2026-07-12-shader-mock-v2.html` として保存する（実装時の見た目の正）。実装者はこのファイルの `FRAG_CYBER` と `HEAD` の GLSL を正として写す。
- [ ] `rtk git status` で tracked に出ないこと（docs/private は gitignored）を確認。

### Task 1: テーマ登録（types / registry / css / i18n / picker） 【Haiku 可】

**Files:**
- Modify: `lib/board/types.ts`（ThemeId + ThemeMeta に `webglBackground?: boolean`）
- Modify: `lib/board/theme-registry.ts`
- Modify: `components/board/themes.module.css`
- Modify: `app/globals.css`
- Modify: `components/board/ThemePicker.module.css`
- Modify: `messages/*.json` ×15
- Test: 既存の registry / messages parity テストが自動で守る（新規テスト不要。`rtk vitest run` が通ること）

- [ ] **Step 1: 型**

`lib/board/types.ts` L3 の union に `| 'cyber-space'` を追加。`ThemeMeta` の `decorations?: boolean` の直後に:

```ts
  /** true = このテーマは WebGL 背景レイヤーを持つ（BoardRoot が対応する Layer を
   *  viewport 固定でマウントする）。WebGL 不可時は backgroundClassName / globals の
   *  静的地が自動フォールバックになる。 */
  webglBackground?: boolean
```

- [ ] **Step 2: registry**

`theme-registry.ts` の `THEME_REGISTRY` に追加（paper-atelier エントリの直後）:

```ts
  'cyber-space': {
    id: 'cyber-space',
    direction: 'vertical',
    backgroundClassName: 'cyberSpace',
    labelKey: 'board.theme.cyberSpace',
    colorScheme: 'dark',
    tier: 'free', // K3 実装時に 'paid' へ（プレミアム1本目・private メモ s187 §2 が正）
    kind: 'work',
    scrollMeterVariant: 'waveform',
    motion: { entry: 'cyber-drift', text: 'cyber-underline', shutdown: 'cyber-fade' },
    webglBackground: true,
  },
```

- [ ] **Step 3: CSS（フォールバック地・トークン）**

`themes.module.css`（`.paperAtelier` ブロックの後）:

```css
/* cyber-space: WebGL レイヤーが主役。このクラスは WebGL 不可時の静的フォールバック地
   （と canvas 起動前の一瞬の地色）。canvas/GPU をここで使わないこと（4K fill-rate 予算）。 */
.cyberSpace {
  background:
    radial-gradient(ellipse 60% 40% at 50% 42%, rgba(40, 241, 0, 0.05), transparent 70%),
    #0a0b0d;
}
```

`app/globals.css`（paper のトークン塊の後）:

```css
/* ============ theme: cyber-space（トークン上書き・最小） ============ */
html[data-theme-id="cyber-space"] {
  --bg-dark: #0a0b0d;
  --bg-outer: #060708;
}
```

`ThemePicker.module.css` のスウォッチ地色ブロックに追加:

```css
.preview[data-theme-id='cyber-space'] { background: #0a0b0d; }
```

- [ ] **Step 4: i18n** — 15 の `messages/*.json` の `board.theme` に `"cyberSpace": "Cyber Space"` を追加（**全言語同一の英語表記**。機能名扱い＝訳さない。parity テストが同数・非空を守る）。

- [ ] **Step 5: 検証 → Commit**

```bash
rtk tsc && rtk vitest run
rtk git add lib/board/types.ts lib/board/theme-registry.ts components/board/themes.module.css app/globals.css components/board/ThemePicker.module.css messages
rtk git commit -m "feat(theme): register cyber-space work theme (fallback bg + tokens + i18n)"
```

---

### Task 2: `CyberSpaceLayer`（raw WebGL・インテリアマッピング背景） 【Sonnet 推奨】

**Files:**
- Create: `components/board/CyberSpaceLayer.tsx`
- Create: `lib/board/shader-layer.ts`（WebGL ボイラープレート＝TOWER と共用する土台）
- Test: `lib/board/shader-layer.test.ts` / `components/board/CyberSpaceLayer.test.tsx`

**Interfaces:**
- Produces:
  - `lib/board/shader-layer.ts`: `createShaderLayer(canvas, fragSrc): ShaderLayerHandle | null`（null = WebGL 不可）。`ShaderLayerHandle = { resize(w,h,dpr): void; render(u: ShaderUniforms): void; snapshot(u: ShaderUniforms): string | null; destroy(): void; readonly lost: boolean }`。`ShaderUniforms = { time: number; cam: readonly [number, number]; extra?: Readonly<Record<string, readonly number[]>> }`（extra は `u_` 前置の vec2/vec4 uniform。TOWER の格子用）
  - `CyberSpaceLayer({ viewportY, motionEnabled, capturing })` — viewport 固定の背景。`data-testid="cyber-space-layer"`（canvas）/ `data-testid="cyber-space-snapshot"`（capturing 中の img）
- Consumes: `BOARD_Z_INDEX.THEME_BG` / `useReducedMotion`

- [ ] **Step 1: Write the failing tests**

`lib/board/shader-layer.test.ts`（jsdom は WebGL 無し＝ null フォールバックの契約を固定）:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createShaderLayer } from './shader-layer'

describe('createShaderLayer', () => {
  it('returns null when WebGL is unavailable (jsdom) instead of throwing', () => {
    const canvas = document.createElement('canvas')
    expect(createShaderLayer(canvas, 'void main(){}')).toBeNull()
  })
})
```

`components/board/CyberSpaceLayer.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CyberSpaceLayer } from './CyberSpaceLayer'

describe('CyberSpaceLayer', () => {
  it('mounts a pointer-transparent viewport layer at THEME_BG and never crashes without WebGL', () => {
    render(<CyberSpaceLayer viewportY={0} motionEnabled={true} capturing={false} />)
    const root = screen.getByTestId('cyber-space-root')
    expect(root.style.zIndex).toBe('0')
    expect(root.style.pointerEvents).toBe('none')
    expect(screen.getByTestId('cyber-space-layer').tagName).toBe('CANVAS')
  })

  it('shows the snapshot img slot while capturing (canvas hidden)', () => {
    render(<CyberSpaceLayer viewportY={0} motionEnabled={true} capturing={true} />)
    // WebGL 無し環境では snapshot は作れない → canvas を隠すだけで img は出ない
    expect(screen.getByTestId('cyber-space-layer').style.visibility).toBe('hidden')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
rtk npx vitest run lib/board/shader-layer.test.ts components/board/CyberSpaceLayer.test.tsx
```

- [ ] **Step 3: Implement — `lib/board/shader-layer.ts`**

```ts
/** raw WebGL のフルスクリーン 1 パスシェーダーレイヤー（テーマ背景用の共通土台）。
 *  three.js は使わない（依存ゼロ・数 KB）。WebGL 不可なら null（CSS フォールバックに落ちる）。
 *  snapshot(): preserveDrawingBuffer 無しでも同期描画→toDataURL で確実に絵を取る
 *  （dom-to-image は生 canvas を写せる保証が無いため、撮影時は img に差し替える）。 */

export type ShaderUniforms = {
  readonly time: number
  readonly cam: readonly [number, number]
  readonly extra?: Readonly<Record<string, readonly number[]>>
}

export type ShaderLayerHandle = {
  readonly resize: (w: number, h: number, dpr: number) => void
  readonly render: (u: ShaderUniforms) => void
  readonly snapshot: (u: ShaderUniforms) => string | null
  readonly destroy: () => void
  readonly isLost: () => boolean
}

const VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }'

export function createShaderLayer(canvas: HTMLCanvasElement, fragSrc: string): ShaderLayerHandle | null {
  let gl: WebGLRenderingContext | null = null
  try {
    gl = canvas.getContext('webgl', { antialias: false, alpha: false })
  } catch {
    return null
  }
  if (!gl) return null
  const ctx = gl

  const compile = (type: number, src: string): WebGLShader | null => {
    const s = ctx.createShader(type)
    if (!s) return null
    ctx.shaderSource(s, src)
    ctx.compileShader(s)
    if (!ctx.getShaderParameter(s, ctx.COMPILE_STATUS)) return null
    return s
  }
  const vs = compile(ctx.VERTEX_SHADER, VERT)
  const fs = compile(ctx.FRAGMENT_SHADER, fragSrc)
  if (!vs || !fs) return null
  const prog = ctx.createProgram()
  if (!prog) return null
  ctx.attachShader(prog, vs)
  ctx.attachShader(prog, fs)
  ctx.linkProgram(prog)
  if (!ctx.getProgramParameter(prog, ctx.LINK_STATUS)) return null

  const buf = ctx.createBuffer()
  ctx.bindBuffer(ctx.ARRAY_BUFFER, buf)
  ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), ctx.STATIC_DRAW)

  let lost = false
  canvas.addEventListener('webglcontextlost', (e): void => {
    e.preventDefault()
    lost = true
  })

  const render = (u: ShaderUniforms): void => {
    if (lost) return
    ctx.useProgram(prog)
    ctx.uniform2f(ctx.getUniformLocation(prog, 'u_res'), canvas.width, canvas.height)
    ctx.uniform1f(ctx.getUniformLocation(prog, 'u_time'), u.time)
    ctx.uniform2f(ctx.getUniformLocation(prog, 'u_cam'), u.cam[0], u.cam[1])
    if (u.extra) {
      for (const [name, v] of Object.entries(u.extra)) {
        const loc = ctx.getUniformLocation(prog, name)
        if (v.length === 2) ctx.uniform2f(loc, v[0], v[1])
        else if (v.length === 4) ctx.uniform4f(loc, v[0], v[1], v[2], v[3])
      }
    }
    const locP = ctx.getAttribLocation(prog, 'p')
    ctx.bindBuffer(ctx.ARRAY_BUFFER, buf)
    ctx.enableVertexAttribArray(locP)
    ctx.vertexAttribPointer(locP, 2, ctx.FLOAT, false, 0, 0)
    ctx.drawArrays(ctx.TRIANGLES, 0, 3)
  }

  return {
    resize: (w: number, h: number, dpr: number): void => {
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      ctx.viewport(0, 0, canvas.width, canvas.height)
    },
    render,
    snapshot: (u: ShaderUniforms): string | null => {
      if (lost) return null
      try {
        render(u) // toDataURL と同期タスク内で描く＝preserveDrawingBuffer 不要
        return canvas.toDataURL('image/png')
      } catch {
        return null
      }
    },
    destroy: (): void => {
      const ext = ctx.getExtension('WEBGL_lose_context')
      if (ext) ext.loseContext()
    },
    isLost: (): boolean => lost,
  }
}
```

- [ ] **Step 4: Implement — `components/board/CyberSpaceLayer.tsx`**

GLSL は Task 0 で保全したモックの `HEAD`（`hash`/`noise`/`roomHit`）＋ `FRAG_CYBER` を**そのまま**移植する（値をいじらない＝承認済みの見た目が正）。視差は `u_cam = (0, clamp(viewportY * -0.00035, -0.5, 0.5))`＋MOTION ON のときだけの微ドリフト。

```tsx
'use client'

import { useEffect, useRef, type ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import { useReducedMotion } from '@/lib/board/use-reduced-motion'
import { createShaderLayer, type ShaderLayerHandle } from '@/lib/board/shader-layer'

const FRAG = /* Task 0 のモックの HEAD + FRAG_CYBER をここに文字列で貼る（一字一句） */ ''

export type CyberSpaceLayerProps = {
  /** 盤面スクロール位置（BoardRoot の viewport.y）。視差の唯一の入力。 */
  readonly viewportY: number
  /** MOTION トグル。OFF で時間（パルス・ドリフト）を凍結。視差は生きる。 */
  readonly motionEnabled: boolean
  /** 撮影中は canvas をスナップショット img に差し替える（dom-to-image 対策）。 */
  readonly capturing: boolean
}

const DPR_CAP = 1.5
const PARALLAX = -0.00035 // スクロール px → cam.y。符号は「下にスクロール＝視点が下がる」

/** cyber-space テーマの WebGL 背景（インテリアマッピング・1 パス・依存ゼロ）。
 *  patternLayer と同じ viewport 固定の器（translate ラッパ外・THEME_BG・pointer 透過）。
 *  WebGL 不可/喪失時は canvas を隠すだけ → 下の .cyberSpace 静的地が見える。 */
export function CyberSpaceLayer(props: CyberSpaceLayerProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const handleRef = useRef<ShaderLayerHandle | null>(null)
  const stateRef = useRef({ time: 0, last: 0, viewportY: 0, motion: true, capturing: false, failed: false })
  stateRef.current.viewportY = props.viewportY
  stateRef.current.motion = props.motionEnabled
  const reduced = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const handle = createShaderLayer(canvas, FRAG)
    handleRef.current = handle
    if (!handle) {
      stateRef.current.failed = true
      canvas.style.visibility = 'hidden' // CSS フォールバック地に落ちる
      return
    }
    const resize = (): void => {
      handle.resize(canvas.clientWidth, canvas.clientHeight, Math.min(window.devicePixelRatio || 1, DPR_CAP))
    }
    resize()
    window.addEventListener('resize', resize)
    let raf = 0
    const loop = (now: number): void => {
      const st = stateRef.current
      if (st.motion) st.time += Math.min(0.05, (now - st.last) / 1000)
      st.last = now
      if (!st.capturing && !handle.isLost()) {
        const camY = reduced ? 0 : Math.max(-0.5, Math.min(0.5, st.viewportY * PARALLAX))
        const driftX = st.motion ? Math.cos(st.time * 0.4) * 0.10 : 0
        handle.render({ time: st.time, cam: [driftX, camY] })
      }
      if (handle.isLost()) canvas.style.visibility = 'hidden'
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return (): void => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      handle.destroy()
      handleRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced])

  // 撮影中: canvas → スナップショット img（撮影が終わったら戻す）
  useEffect(() => {
    stateRef.current.capturing = props.capturing
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    if (props.capturing && handleRef.current && !stateRef.current.failed) {
      const st = stateRef.current
      const camY = reduced ? 0 : Math.max(-0.5, Math.min(0.5, st.viewportY * PARALLAX))
      const url = handleRef.current.snapshot({ time: st.time, cam: [0, camY] })
      if (url) {
        img.src = url
        img.style.display = 'block'
      }
      canvas.style.visibility = 'hidden'
    } else {
      img.style.display = 'none'
      if (!stateRef.current.failed && handleRef.current && !handleRef.current.isLost()) {
        canvas.style.visibility = 'visible'
      }
    }
  }, [props.capturing, reduced])

  return (
    <div
      data-testid="cyber-space-root"
      style={{ position: 'absolute', inset: 0, zIndex: BOARD_Z_INDEX.THEME_BG, pointerEvents: 'none', overflow: 'hidden' }}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} data-testid="cyber-space-layer" style={{ width: '100%', height: '100%', display: 'block', visibility: props.capturing ? 'hidden' : undefined }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imgRef} data-testid="cyber-space-snapshot" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'none' }} />
    </div>
  )
}
```

- [ ] **Step 5: Run to verify they pass → Commit**

```bash
rtk npx vitest run lib/board/shader-layer.test.ts components/board/CyberSpaceLayer.test.tsx
rtk tsc
rtk git add lib/board/shader-layer.ts lib/board/shader-layer.test.ts components/board/CyberSpaceLayer.tsx components/board/CyberSpaceLayer.test.tsx
rtk git commit -m "feat(theme): CyberSpaceLayer — raw-WebGL interior-mapping background + shared shader-layer runtime"
```

---

### Task 3: BoardRoot 配線 【Sonnet 推奨（大ファイル）】

**Files:**
- Modify: `components/board/BoardRoot.tsx`

- [ ] **Step 1:** import `CyberSpaceLayer` を追加。patternLayer ブロック（L3129-3149・`hydrated && themeMeta.kind === 'pattern' && resolvedCustom` の条件塊）の**直後**に追加:

```tsx
        {hydrated && themeMeta.webglBackground === true && themeMeta.id === 'cyber-space' && (
          <CyberSpaceLayer viewportY={viewport.y} motionEnabled={motionEnabled} capturing={capturing} />
        )}
```

※ patternLayer と同じ「translate ラッパの外＝viewport 固定」の位置であること。`viewport.y` はデスクトップ（transform 駆動）でもモバイル（scrollTop ミラー）でも同じ真実（L327/L1205-1211）。

- [ ] **Step 2: 検証 → Commit**

```bash
rtk tsc && rtk vitest run && pnpm build
rtk git add components/board/BoardRoot.tsx
rtk git commit -m "feat(board): mount cyber-space WebGL background layer (viewport-anchored, THEME_BG)"
```

---

### Task 4: e2e（選択・視差・撮影スナップショット・非回帰） 【Sonnet 推奨】

**Files:**
- Create: `tests/e2e/theme-cyber-space.spec.ts`

- [ ] **Step 1: テストを書く**（seed は `mobile-share.spec.ts` の `seedBoard` パターンを流用。**Playwright 起動オプションに SwiftShader が必要**: `npx playwright test` の該当 spec で `test.use` はできないため、spec 内で `chromium` 既定のまま動かない場合は `playwright.config` ではなく **spec 冒頭コメントの指示どおり** `--project` を分けず、`page.goto` 前に WebGL 有無を feature-detect して WebGL 無し環境では fallback 検証に切り替える）:

```ts
import { expect, test, type Page } from '@playwright/test'

async function selectCyberSpace(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('booklage-db')
      req.onsuccess = (): void => resolve(req.result)
      req.onerror = (): void => reject(req.error)
    })
    const tx = db.transaction(['settings'], 'readwrite')
    const store = tx.objectStore('settings')
    const cur = await new Promise<{ key: string; value: Record<string, unknown> } | undefined>((resolve) => {
      const r = store.get('board-config')
      r.onsuccess = (): void => resolve(r.result as { key: string; value: Record<string, unknown> } | undefined)
      r.onerror = (): void => resolve(undefined)
    })
    store.put({ key: 'board-config', value: { ...(cur?.value ?? {}), themeId: 'cyber-space' } })
    await new Promise<void>((resolve) => { tx.oncomplete = (): void => resolve() })
    db.close()
  })
  await page.reload()
  await page.waitForSelector('html[data-theme-id="cyber-space"]')
}

test.use({ viewport: { width: 1489, height: 679 } })

test('cyber-space mounts a WebGL background (or falls back cleanly)', async ({ page }) => {
  await page.goto('/board')
  await page.waitForSelector('[data-theme-id]')
  await selectCyberSpace(page)
  await expect(page.getByTestId('cyber-space-root')).toBeVisible()
  const hasGl = await page.evaluate(() => {
    try { return document.createElement('canvas').getContext('webgl') !== null } catch { return false }
  })
  const vis = await page.getByTestId('cyber-space-layer').evaluate((el) => getComputedStyle(el).visibility)
  expect(vis).toBe(hasGl ? 'visible' : 'hidden') // WebGL 無し環境では静的地に落ちる
})

test('default theme has no cyber layer (byte-identical guard)', async ({ page }) => {
  await page.goto('/board')
  await page.waitForSelector('html[data-theme-id="dotted-notebook"]')
  await expect(page.getByTestId('cyber-space-root')).toHaveCount(0)
})
```

- [ ] **Step 2:**

```bash
npx playwright test tests/e2e/theme-cyber-space.spec.ts
rtk git add tests/e2e/theme-cyber-space.spec.ts
rtk git commit -m "test(e2e): cyber-space theme mount + fallback + default-theme guard"
```

---

### Task 5: 検証一式→デプロイ→実機確認依頼 【どのモデルでも可】

- [ ] `rtk tsc && rtk vitest run && pnpm build` → `npx playwright test tests/e2e/theme-cyber-space.spec.ts tests/e2e/mobile-share.spec.ts` → デプロイ。
- [ ] ユーザー実機確認（コピペ）:

```
PC とスマホで https://allmarks.app → THEMES → WORKS → Cyber Space:
1. 盤面の奥に「黒い箱の内側」（緑の目盛り線・奥の霞）が見えますか
2. スクロールすると空間の見える角度が変わりますか（4K でカクつきは？ fps 目視で）
3. MOTION OFF → 床を走る緑のパルスが止まり、完全に静止しますか（スクロール視差は残る）
4. SHARE で共有画像を作る → 画像に背景（空間）が写っていますか（真っ白/真っ黒でないか）
5. 他のテーマに切り替え→戻す、リロード後も維持、を確認
```

- [ ] TODO.md 更新（SHADER-THEME A 完了・tier 切替は K3 束で）。

## Self-Review 済みの注意点（実装者へ）

- **GLSL はモック（Task 0 保全物）が正**。値の「改善」をしない（見た目はユーザー承認済み）。
- `tier: 'free'` は暫定（K3 で 'paid' 化）。`resolveThemeId` が paid×無ライセンスを default に落とす仕様（`theme-resolve.ts:8-17`）を理解しておく。
- 撮影は **snapshot 差し替え**が本体（dom-to-image が生 canvas を写す保証は無い）。`snapshot()` は render と同期タスク内で `toDataURL` するので `preserveDrawingBuffer` 不要。
- 受け取り画面（/s/）は静的フォールバック地のみ（v1 スコープ外・SharedBoard は globals.css の `html[data-theme-id]` カスケードで地色は正しくなる）。
- 4K 予算: DPR≤1.5・1 パス・非選択時 unmount。`themes.module.css` の「NO canvas/GPU」注記は**このテーマには適用しない**が、フォールバッククラス自体には canvas を使わない（注記どおり）。
- Playwright のヘッドレスは WebGL コンテキストが喪失する環境がある（s187 実測: `--use-gl=angle --use-angle=swiftshader` で回復）。e2e は WebGL 有無を feature-detect して**両分岐とも意味のある検証**にしてある。
