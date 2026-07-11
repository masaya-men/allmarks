# N-56: スマホで共有画像が作成されない — 診断可視化＋段階フォールバック 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 実機のスマホで共有画像（1200×630 JPEG）が作られない致命バグを、(1) 失敗を**見える化**し（今は 13 箇所で握り潰されて「成功に見える」）、(2) 倍率を落とす**自動再挑戦**で直る種類の失敗をその場で救い、(3) 残る失敗は**診断文字列**として画面に出して真因を実機 1 回で特定できる状態にする。

**Architecture:** 撮影パイプライン（`captureCollageShareImage` → `renderShareImage` → `normalizeShotToJpegDataUrl`）は今、全失敗を `null` に潰して無ログで進む設計（共有を絶対に壊さないため）。この設計は**維持**しつつ、各段の失敗を `CaptureAttempt`（stage / message / elapsedMs / scale）として持ち帰る `captureCollageShareImageDetailed` を新設する。既存 `captureCollageShareImage` はその薄いラッパになり、**デスクトップの挙動はバイト同一**。モバイルだけ `fallbackScales: [1]`（失敗したら倍率1で撮り直し）と `rejectUniform: true`（ほぼ一様色＝真っ白出力を失敗扱い）を渡す。結果シートに「画像は作れなかったがリンクは生きている」状態と診断行を表示する。

**Tech Stack:** Next.js 14 App Router / TypeScript strict / Vanilla CSS Modules / vitest + @testing-library/react / Playwright / dom-to-image-more

## この計画の前提（s186 調査で確定した事実）

- 失敗の握り潰し地点は 13 箇所。代表: `render-share-image.ts:95` `toJpeg(...).catch(() => null)`、`capture-collage.ts:39-65` の `withTimeout`（20秒で null）、[BoardRoot.tsx](../../../components/board/BoardRoot.tsx) `handleMobileCreateShare`（2454-2513）の `try/finally`（catch なし）→ `thumb: thumb ?? undefined` で**リンクだけ**作られる。
- `MobileShareResult.tsx:90` は `{imageUrl && <img …>}` ＝ null なら**何も出さず LINK READY** を表示（＝ユーザーには成功に見える）。
- ログは撮影パイプライン全体で**ゼロ**。デバッグ用フラグも無い。
- 撮影は `.outerFrame` 全体（390×844）を `scale ≈ 3.077` で焼く＝dom-to-image が **約 1200×2597 の canvas** を確保してから中央の帯を cover 切り出しする。実機のメモリ/canvas 上限に一番近いのはここ。
- `document.fonts.ready` は `render-share-image.ts:64` で**無期限 await**（外側の 20 秒だけが天井）。
- e2e `tests/e2e/mobile-share.spec.ts` は 5/5 緑のまま実機で壊れた＝**この計画の検証の最後は必ず実機**。

## Global Constraints

- TypeScript `strict: true`。`any` 禁止（`unknown` + 型ガード）。return type は常に明示
- Tailwind 禁止・Framer Motion 禁止。CSS は `.module.css` のみ
- `console.log` を本番コードに残さない（診断は**画面表示**で出す。console に頼らない）
- z-index の魔法の数値禁止（今回、新規 z-index は不要）
- UI 文言は世界に通じる平易な英語・乾いた事実調（`NO IMAGE — LINK ONLY` / `RETRY IMAGE`）
- **デスクトップ（>640px）の SHARE 挙動はバイト同一を保つ**（`captureCollageShareImage` の既存シグネチャ・既定値を変えない）
- **撮影失敗でもリンクは必ず作る**（既存設計の維持。変えるのは「黙って成功に見せる」部分だけ）
- `fit:'cover'` を `'contain'` に戻さない（黒帯検出テストが守っている）
- git コマンドは `rtk` を前置。`--no-verify` 絶対禁止

---

## Task 0: ユーザーへの症状ヒアリング（コード前・1分）

**実装ではない。s187 開始時にユーザーに以下を聞き、答えをこの計画書に書き足してから Task 1 へ。**
（答えが未取得でも Task 1〜5 は症状に依存しない設計なので着手してよい）

- [ ] Q1. 実機で見えた症状はどれ？ (a) 結果シートにプレビュー画像が出ない（LINK READY は出る） (b) リンクはできるが X 等で画像が既定カード (c) 「COULDN'T CREATE THE LINK」が出る
- [ ] Q2. 端末の機種・OS・ブラウザ（例: iPhone 14 / iOS 17 / Safari、Pixel 7 / Android 14 / Chrome）
- [ ] Q3. 選択したカード枚数（少数でも起きるか、全選択だけか）

回答欄（**s186 でユーザー回答済み**）:
```
Q1: (a) プレビューが出ない。リンクはできたが、そもそも画像が生成されていなさそう
Q2: iPhone / Safari（iOS 版数は未聴取。必要になったら聞く）
Q3: 4 枚程度（少数でも発生）
```

**回答を受けた仮説の優先順位（実装内容は不変・Task 6 の読み解きで使う）:**
- 4 枚でも失敗 ＝ モバイル回線での画像取り直し 20 秒超え（旧候補③）は**ほぼ消えた**。
- iPhone Safari ＝ 最有力は **(1) WebKit の dom-to-image（SVG foreignObject）失敗**（診断行では `render` の例外 or `blank`＝真っ白成功として出る）、次点 **(2) scale≈3.08 の canvas 確保失敗**（`render` の RangeError/InvalidStateError、fallback x1 で成功するはず）。
- つまり Task 3 の `rejectUniform`（真っ白検出）と `fallbackScales:[1]` がそのまま一次対応になる見込み。診断行で (1)/(2) を確定させてから恒久対応（F1/F4）を選ぶ。

---

### Task 1: 一様色（真っ白出力）検出の純関数 【Haiku 可】

**Files:**
- Create: `lib/share/uniform-image.ts`
- Test: `lib/share/uniform-image.test.ts`

**Interfaces:**
- Consumes: なし（純関数＋DOM canvas）
- Produces:
  - `isUniformSample(data: Uint8ClampedArray, tolerance?: number): boolean`
  - `isUniformImage(img: HTMLImageElement): boolean`

- [ ] **Step 1: Write the failing test**

`lib/share/uniform-image.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isUniformSample, isUniformImage } from './uniform-image'

function rgba(pixels: ReadonlyArray<readonly [number, number, number]>): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels.length * 4)
  pixels.forEach(([r, g, b], i) => {
    out[i * 4] = r
    out[i * 4 + 1] = g
    out[i * 4 + 2] = b
    out[i * 4 + 3] = 255
  })
  return out
}

describe('isUniformSample', () => {
  it('flags an all-white sample as uniform (the iOS blank-render signature)', () => {
    expect(isUniformSample(rgba([[255, 255, 255], [255, 255, 255], [255, 255, 255]]))).toBe(true)
  })

  it('tolerates JPEG noise within the tolerance', () => {
    expect(isUniformSample(rgba([[250, 250, 250], [253, 251, 248], [255, 255, 255]]))).toBe(true)
  })

  it('a real collage (board colour + one card pixel) is NOT uniform', () => {
    expect(isUniformSample(rgba([[10, 10, 11], [10, 10, 11], [200, 40, 40]]))).toBe(false)
  })

  it('an empty / tiny sample counts as uniform (nothing to share)', () => {
    expect(isUniformSample(new Uint8ClampedArray(0))).toBe(true)
    expect(isUniformSample(rgba([[0, 0, 0]]))).toBe(true)
  })
})

describe('isUniformImage', () => {
  it('returns false (=not uniform, do not kill the capture) when canvas 2d is unavailable (jsdom)', () => {
    const img = new Image()
    expect(isUniformImage(img)).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
rtk npx vitest run lib/share/uniform-image.test.ts
```

Expected: FAIL — `Failed to resolve import "./uniform-image"`.

- [ ] **Step 3: Write the implementation**

`lib/share/uniform-image.ts`:

```ts
// lib/share/uniform-image.ts
// iOS Safari は dom-to-image (SVG foreignObject) の描画に失敗しても「真っ白な
// 正常サイズの画像」を返すことがある。その場合パイプラインは全段成功に見えるので、
// 出力がほぼ一様色なら失敗として扱えるようにする検出器。
//
// 判定は保守的に: canvas が使えない・読めない環境では「一様ではない」(false) を
// 返し、撮影を殺さない。誤検出で本物の画像を捨てるより、見逃す方がまし。

/** RGBA 画素列が「ほぼ一様色」なら true。tolerance は先頭画素との各チャンネル許容差。 */
export function isUniformSample(data: Uint8ClampedArray, tolerance = 6): boolean {
  if (data.length < 8) return true
  const r0 = data[0]
  const g0 = data[1]
  const b0 = data[2]
  for (let i = 4; i < data.length; i += 4) {
    if (
      Math.abs(data[i] - r0) > tolerance ||
      Math.abs(data[i + 1] - g0) > tolerance ||
      Math.abs(data[i + 2] - b0) > tolerance
    ) {
      return false
    }
  }
  return true
}

/** 画像を 32×32 に縮小描画してサンプルし、ほぼ一様色かを判定する。 */
export function isUniformImage(img: HTMLImageElement): boolean {
  try {
    const c = document.createElement('canvas')
    c.width = 32
    c.height = 32
    const ctx = c.getContext('2d')
    if (!ctx) return false
    ctx.drawImage(img, 0, 0, 32, 32)
    return isUniformSample(ctx.getImageData(0, 0, 32, 32).data)
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
rtk npx vitest run lib/share/uniform-image.test.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
rtk git add lib/share/uniform-image.ts lib/share/uniform-image.test.ts
rtk git commit -m "feat(share): uniform-colour output detector for blank captures (N-56)"
```

---

### Task 2: renderShareImage に失敗理由の持ち帰り口＋fonts.ready の 3 秒見切り 【Haiku 可】

**Files:**
- Modify: `lib/share/render-share-image.ts`
- Test: `lib/share/render-share-image.test.ts`（既存に追記）

**Interfaces:**
- Consumes: 既存 `RenderShareImageOpts`
- Produces: `RenderShareImageOpts` に追加された `onError?: (message: string) => void`（挙動: toJpeg の reject・外側 catch で例外文字列を通知してから従来どおり null を返す）

- [ ] **Step 1: Write the failing test（既存ファイルに describe を追記）**

`lib/share/render-share-image.test.ts` の末尾に追記:

```ts
describe('renderShareImage onError (N-56 diagnostics)', () => {
  it('reports the thrown error message and still resolves null', async () => {
    // dom-to-image-more の import 自体を失敗させる最短経路: jsdom には
    // 実 DOM ノードを渡すが、vi.mock でモジュールを差し替える。
    vi.doMock('dom-to-image-more', () => {
      throw new Error('boom from import')
    })
    const { renderShareImage: fresh } = await import('./render-share-image?onerror-test')
    const messages: string[] = []
    const node = document.createElement('div')
    const out = await fresh(node, {
      width: 100,
      height: 100,
      targetBytes: 1024,
      startQuality: 0.9,
      minQuality: 0.9,
      onError: (m): void => { messages.push(m) },
    })
    expect(out).toBeNull()
    expect(messages.length).toBeGreaterThan(0)
    expect(messages[0]).toContain('boom from import')
    vi.doUnmock('dom-to-image-more')
  })
})
```

※ `import('./render-share-image?onerror-test')` のクエリ付き import は vitest でモジュールキャッシュを割るための常套手段。既存テストが `vi.mock('dom-to-image-more', …)` を**ファイル先頭**で使っている場合はそれに合わせ、mock 実装の `toJpeg` を `Promise.reject(new Error('boom'))` にして messages を検査する形に書き換えてよい（**先に既存テストの mock 方式を読むこと**）。

- [ ] **Step 2: Run to verify it fails**

```bash
rtk npx vitest run lib/share/render-share-image.test.ts
```

Expected: FAIL — `onError` が型に無い（tsc レベル）or messages が空。

- [ ] **Step 3: Implement**

`lib/share/render-share-image.ts` への変更は3点だけ。

(1) `RenderShareImageOpts` に追加（`scale?` フィールドの直後）:

```ts
  /** 失敗時に捕捉できた例外の文字列を受け取る（診断用・N-56）。呼ばれても戻り値は
   *  従来どおり null（挙動は変えない、理由が見えるようになるだけ）。 */
  readonly onError?: (message: string) => void
```

(2) `renderShareImage` 本体の先頭（`try {` の直前）にヘルパを追加し、2つの catch から呼ぶ:

```ts
export async function renderShareImage(node: HTMLElement, opts: RenderShareImageOpts): Promise<string | null> {
  const fail = (e: unknown): null => {
    opts.onError?.(e instanceof Error ? `${e.name}: ${e.message}` : String(e))
    return null
  }
  try {
```

- `line 95` の `toJpeg(node, { ...baseOpts, quality }).catch(() => null)` を `toJpeg(node, { ...baseOpts, quality }).catch((e: unknown) => fail(e))` に変更。
- 末尾の `} catch { return null }` を `} catch (e) { return fail(e) }` に変更。

(3) `document.fonts.ready` の無期限 await（line 64）を 3 秒見切りに変更:

```ts
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      // 実機で fonts.ready が解決しない事例への保険。フォントは盤面表示の時点で
      // ほぼ確実にロード済みなので、3 秒待って進んで実害はない。
      await Promise.race([
        document.fonts.ready,
        new Promise<void>((r): void => { setTimeout(r, 3000) }),
      ])
    }
```

- [ ] **Step 4: Run to verify it passes（既存テスト含め全部）**

```bash
rtk npx vitest run lib/share/render-share-image.test.ts lib/share/render-share-image.scale.test.ts
```

Expected: PASS（既存分も全緑 — `onError` 未指定の呼び出しは挙動不変）。

- [ ] **Step 5: Commit**

```bash
rtk git add lib/share/render-share-image.ts lib/share/render-share-image.test.ts
rtk git commit -m "feat(share): surface render failure reasons + cap fonts.ready wait (N-56)"
```

---

### Task 3: captureCollageShareImageDetailed — 段階別診断＋倍率フォールバック 【Sonnet 推奨】

**Files:**
- Modify: `lib/share/capture-collage.ts`
- Test: `lib/share/capture-collage.test.ts`（既存に追記）

**Interfaces:**
- Consumes: Task 1 の `isUniformImage`、Task 2 の `onError`
- Produces:
  - `type CaptureFailureStage = 'no-frame' | 'timeout' | 'render' | 'decode' | 'blank' | 'normalize'`
  - `type CaptureAttempt = { scale: number; timeoutMs: number; elapsedMs: number; stage: CaptureFailureStage | null; message: string | null }`（stage null = 成功）
  - `type CaptureOutcome = { dataUrl: string | null; attempts: readonly CaptureAttempt[] }`
  - `captureCollageShareImageDetailed(node: HTMLElement, opts: CaptureCollageOpts): Promise<CaptureOutcome>`
  - `formatCaptureAttempts(attempts: readonly CaptureAttempt[]): string`
  - `CaptureCollageOpts` 追加フィールド: `fallbackScales?: readonly number[]` / `fallbackTimeoutMs?: number`（既定 12000）/ `rejectUniform?: boolean`
  - 既存 `captureCollageShareImage(node, opts): Promise<string | null>` は Detailed の薄いラッパ（**シグネチャ・挙動不変**）

- [ ] **Step 1: Write the failing tests（既存ファイルに追記）**

`lib/share/capture-collage.test.ts` に追記。既存テストのモック方式（`vi.mock('./render-share-image', …)` 等）を**先に読んで**流儀を合わせること。追加するテストの本体:

```ts
import { captureCollageShareImageDetailed, formatCaptureAttempts } from './capture-collage'

// data-URL を即 onload で解決する Image スタブ（jsdom は画像を実ロードしない）
class InstantImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  naturalWidth = 1200
  naturalHeight = 2597
  set src(_v: string) {
    queueMicrotask((): void => this.onload?.())
  }
}

describe('captureCollageShareImageDetailed (N-56)', () => {
  it('records stage "render" with the reported message when dom-to-image fails', async () => {
    // renderShareImage が onError('SecurityError: tainted') を呼んでから null を返すようモック
    // （モック実装例）
    // vi.mocked(renderShareImage).mockImplementation(async (_n, o) => { o.onError?.('SecurityError: tainted'); return null })
    const node = document.createElement('div')
    const out = await captureCollageShareImageDetailed(node, { origin: 'https://allmarks.app', boardColor: '#0a0a0b' })
    expect(out.dataUrl).toBeNull()
    expect(out.attempts).toHaveLength(1)
    expect(out.attempts[0].stage).toBe('render')
    expect(out.attempts[0].message).toContain('SecurityError')
  })

  it('falls back to the next scale and succeeds — attempts carry both records', async () => {
    vi.stubGlobal('Image', InstantImage)
    // 1回目 null（onError('RangeError: canvas too big')）→ 2回目 'data:image/jpeg;base64,xxx' を返すモック
    const node = document.createElement('div')
    const out = await captureCollageShareImageDetailed(node, {
      origin: 'https://allmarks.app',
      boardColor: '#0a0a0b',
      scale: 3.08,
      fallbackScales: [1],
    })
    expect(out.attempts).toHaveLength(2)
    expect(out.attempts[0].stage).toBe('render')
    expect(out.attempts[0].scale).toBeCloseTo(3.08, 2)
    expect(out.attempts[1].scale).toBe(1)
    // normalize は jsdom の canvas 制約で null になり得る — dataUrl の成否ではなく
    // 「2回目が試行されたこと」「scale が正しいこと」を主眼に検証する
    vi.unstubAllGlobals()
  })

  it('keeps the legacy wrapper byte-identical: no fallbackScales → exactly 1 attempt', async () => {
    const node = document.createElement('div')
    const out = await captureCollageShareImageDetailed(node, { origin: 'https://allmarks.app', boardColor: '#0a0a0b' })
    expect(out.attempts).toHaveLength(1)
  })
})

describe('formatCaptureAttempts', () => {
  it('renders a compact one-line diagnostic', () => {
    expect(
      formatCaptureAttempts([
        { scale: 3.08, timeoutMs: 20000, elapsedMs: 20003, stage: 'timeout', message: null },
        { scale: 1, timeoutMs: 12000, elapsedMs: 3120, stage: 'render', message: 'SecurityError: tainted' },
      ]),
    ).toBe('#1 x3.08 timeout 20003ms / #2 x1 render 3120ms SecurityError: tainted')
  })

  it('marks success attempts as ok', () => {
    expect(formatCaptureAttempts([{ scale: 1, timeoutMs: 12000, elapsedMs: 900, stage: null, message: null }]))
      .toBe('#1 x1 ok 900ms')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
rtk npx vitest run lib/share/capture-collage.test.ts
```

Expected: FAIL — `captureCollageShareImageDetailed` が存在しない。

- [ ] **Step 3: Implement**

`lib/share/capture-collage.ts` を以下の形に書き換える（既存の import 3 行と `loadImage` はそのまま。`withTimeout` は差し替え）。

(1) import に追加: `import { isUniformImage } from './uniform-image'`

(2) `CaptureCollageOpts` の `scale?` の後に追加:

```ts
  /** 失敗時に scale を落として順に再挑戦する列（例 [1]）。省略時は再挑戦なし
   *  （＝デスクトップは従来どおり 1 回だけ）。 */
  readonly fallbackScales?: readonly number[]
  /** 再挑戦 1 回あたりのタイムアウト (ms, 既定 12000)。初回は timeoutMs が効く。 */
  readonly fallbackTimeoutMs?: number
  /** true なら「ほぼ一様色」の出力を失敗として扱い、次の再挑戦に回す
   *  （iOS Safari の foreignObject 空振り＝真っ白画像の検出）。 */
  readonly rejectUniform?: boolean
```

(3) 型と `withTimeout` の差し替え:

```ts
/** 撮影がどの段で死んだか。null は成功。 */
export type CaptureFailureStage =
  | 'no-frame'   // 撮影対象 DOM が無かった（呼び出し側が付与する）
  | 'timeout'    // renderShareImage が制限時間内に終わらなかった
  | 'render'     // dom-to-image が null / 例外
  | 'decode'     // 撮った data-URL を Image に読めなかった
  | 'blank'      // 出力がほぼ一様色（真っ白疑い）
  | 'normalize'  // 1200×630 正規化が失敗（canvas 不可・汚染など）

export type CaptureAttempt = {
  readonly scale: number
  readonly timeoutMs: number
  readonly elapsedMs: number
  readonly stage: CaptureFailureStage | null
  readonly message: string | null
}

export type CaptureOutcome = {
  readonly dataUrl: string | null
  readonly attempts: readonly CaptureAttempt[]
}

type TimedResult<T> = { readonly value: T | null; readonly timedOut: boolean }

/** `p` が `ms` 以内に解決しなければ timedOut=true を返す (元の promise は放置)。 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<TimedResult<T>> {
  return new Promise((resolve): void => {
    let settled = false
    const timer = setTimeout((): void => {
      if (!settled) {
        settled = true
        resolve({ value: null, timedOut: true })
      }
    }, ms)
    void p.then(
      (v): void => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          resolve({ value: v, timedOut: false })
        }
      },
      (): void => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          resolve({ value: null, timedOut: false })
        }
      },
    )
  })
}
```

(4) 1 回分の撮影を関数化（既存 `captureCollageShareImage` の中身の移植＋診断付与）:

```ts
async function attemptCapture(
  node: HTMLElement,
  opts: CaptureCollageOpts,
  scale: number | undefined,
  timeoutMs: number,
): Promise<{ readonly dataUrl: string | null; readonly attempt: CaptureAttempt }> {
  const started = Date.now()
  const finalW = opts.width ?? 1200
  const finalH = opts.height ?? 630
  const captureW = node.offsetWidth || finalW
  const captureH = node.offsetHeight || finalH
  let renderMessage: string | null = null

  const fail = (stage: CaptureFailureStage): { dataUrl: null; attempt: CaptureAttempt } => ({
    dataUrl: null,
    attempt: { scale: scale ?? 1, timeoutMs, elapsedMs: Date.now() - started, stage, message: renderMessage },
  })

  const rendered = await withTimeout(
    renderShareImage(node, {
      width: captureW,
      height: captureH,
      targetBytes: 8 * 1024 * 1024,
      startQuality: 0.94,
      minQuality: 0.94,
      bgColor: opts.boardColor,
      rewriteImageSrc: (src): string => rewriteToProxy(src, opts.origin),
      onError: (m): void => { renderMessage = m },
      ...(typeof scale === 'number' ? { scale } : {}),
    }),
    timeoutMs,
  )
  if (rendered.timedOut) return fail('timeout')
  if (!rendered.value) return fail('render')

  const img = await loadImage(rendered.value)
  if (!img) return fail('decode')
  if (opts.rejectUniform && isUniformImage(img)) return fail('blank')

  const normalized = await normalizeShotToJpegDataUrl(img, {
    width: finalW,
    height: finalH,
    targetBytes: opts.targetBytes ?? 180 * 1024,
    fit: opts.fit ?? 'cover',
    bgColor: opts.boardColor,
  })
  if (!normalized) return fail('normalize')

  return {
    dataUrl: normalized,
    attempt: { scale: scale ?? 1, timeoutMs, elapsedMs: Date.now() - started, stage: null, message: null },
  }
}
```

(5) 新 API と既存ラッパ:

```ts
/**
 * 診断付き撮影。初回は opts.scale / opts.timeoutMs で撮り、失敗したら
 * fallbackScales の倍率で順に撮り直す。全試行の記録を attempts に返す。
 */
export async function captureCollageShareImageDetailed(
  node: HTMLElement,
  opts: CaptureCollageOpts,
): Promise<CaptureOutcome> {
  const attempts: CaptureAttempt[] = []
  const first = await attemptCapture(node, opts, opts.scale, opts.timeoutMs ?? 20000)
  attempts.push(first.attempt)
  if (first.dataUrl) return { dataUrl: first.dataUrl, attempts }

  for (const s of opts.fallbackScales ?? []) {
    const retry = await attemptCapture(node, opts, s, opts.fallbackTimeoutMs ?? 12000)
    attempts.push(retry.attempt)
    if (retry.dataUrl) return { dataUrl: retry.dataUrl, attempts }
  }
  return { dataUrl: null, attempts }
}

/** 従来 API（デスクトップ用・挙動不変）: Detailed の dataUrl だけ返す。 */
export async function captureCollageShareImage(
  node: HTMLElement,
  opts: CaptureCollageOpts,
): Promise<string | null> {
  return (await captureCollageShareImageDetailed(node, opts)).dataUrl
}

/** 実機診断用の 1 行文字列。例: "#1 x3.08 timeout 20003ms / #2 x1 render 3120ms SecurityError: …" */
export function formatCaptureAttempts(attempts: readonly CaptureAttempt[]): string {
  return attempts
    .map((a, i) => {
      const head = `#${i + 1} x${Number(a.scale.toFixed(2))} ${a.stage ?? 'ok'} ${a.elapsedMs}ms`
      return a.message ? `${head} ${a.message}` : head
    })
    .join(' / ')
}
```

- [ ] **Step 4: Run to verify（既存の capture-collage テスト含め全緑）**

```bash
rtk npx vitest run lib/share/capture-collage.test.ts lib/share/uniform-image.test.ts
```

- [ ] **Step 5: Commit**

```bash
rtk git add lib/share/capture-collage.ts lib/share/capture-collage.test.ts
rtk git commit -m "feat(share): staged capture diagnostics + scale fallback chain (N-56)"
```

---

### Task 4: 結果シートに「画像なし」状態と診断行を出す 【Haiku 可】

**Files:**
- Modify: `components/board/MobileShareResult.tsx`
- Modify: `components/board/MobileShareResult.module.css`
- Test: `components/board/MobileShareResult.test.tsx`（既存に追記）

**Interfaces:**
- Consumes: Task 3 の `CaptureAttempt` / `formatCaptureAttempts`
- Produces: `MobileShareResultProps` 追加 props:
  - `readonly captureAttempts?: readonly CaptureAttempt[] | null`
  - `readonly errorMessage?: string | null`（リンク作成失敗時の理由）

- [ ] **Step 1: Write the failing tests（既存に追記）**

`components/board/MobileShareResult.test.tsx` に追記（既存テストの render ヘルパの流儀に合わせる）:

```tsx
it('shows the NO IMAGE warning + diag line when the link exists but the image is null', () => {
  render(
    <MobileShareResult
      imageUrl={null}
      shareUrl="https://allmarks.app/s/abc123"
      createState="idle"
      captureAttempts={[
        { scale: 3.08, timeoutMs: 20000, elapsedMs: 20003, stage: 'timeout', message: null },
        { scale: 1, timeoutMs: 12000, elapsedMs: 12001, stage: 'timeout', message: null },
      ]}
      onCopyLink={async () => true}
      onRetry={() => {}}
      onDone={() => {}}
    />,
  )
  expect(screen.getByTestId('mobile-share-image-failed')).toBeInTheDocument()
  expect(screen.getByTestId('mobile-share-diag').textContent).toContain('#1 x3.08 timeout')
  expect(screen.queryByTestId('mobile-share-preview')).toBeNull()
  expect(screen.getByTestId('mobile-share-retry-image')).toBeInTheDocument()
})

it('shows the diag line on success too when a fallback attempt was needed', () => {
  render(
    <MobileShareResult
      imageUrl="data:image/jpeg;base64,xxxx"
      shareUrl="https://allmarks.app/s/abc123"
      createState="idle"
      captureAttempts={[
        { scale: 3.08, timeoutMs: 20000, elapsedMs: 9000, stage: 'render', message: 'RangeError: too big' },
        { scale: 1, timeoutMs: 12000, elapsedMs: 2100, stage: null, message: null },
      ]}
      onCopyLink={async () => true}
      onRetry={() => {}}
      onDone={() => {}}
    />,
  )
  expect(screen.getByTestId('mobile-share-preview')).toBeInTheDocument()
  expect(screen.getByTestId('mobile-share-diag').textContent).toContain('RangeError')
})

it('shows the create-error detail message when the link itself failed', () => {
  render(
    <MobileShareResult
      imageUrl={null}
      shareUrl={null}
      createState="error"
      errorMessage="fetch failed"
      onCopyLink={async () => true}
      onRetry={() => {}}
      onDone={() => {}}
    />,
  )
  expect(screen.getByTestId('mobile-share-error')).toBeInTheDocument()
  expect(screen.getByTestId('mobile-share-error-detail').textContent).toBe('fetch failed')
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
rtk npx vitest run components/board/MobileShareResult.test.tsx
```

- [ ] **Step 3: Implement**

`MobileShareResult.tsx`:

(1) import に追加:

```ts
import { formatCaptureAttempts, type CaptureAttempt } from '@/lib/share/capture-collage'
```

(2) props 追加（`onDone` の後）:

```ts
  /** 撮影の試行記録（診断表示用・N-56）。 */
  readonly captureAttempts?: readonly CaptureAttempt[] | null
  /** リンク作成が失敗した時の理由（診断表示用・N-56）。 */
  readonly errorMessage?: string | null
```

分割代入にも追加: `const { imageUrl, shareUrl, createState, onCopyLink, onRetry, onDone, captureAttempts, errorMessage } = props`

(3) `failed`（エラー）分岐の `mobile-share-error` の span 直後に追加:

```tsx
          {errorMessage && (
            <code className={styles.diag} data-testid="mobile-share-error-detail">{errorMessage}</code>
          )}
```

(4) 成功分岐の `{imageUrl && (…preview…)}` の**直後**に追加:

```tsx
          {!imageUrl && (
            <div className={styles.imageFailed} data-testid="mobile-share-image-failed">
              <span className={styles.imageFailedTitle}>NO IMAGE — LINK ONLY</span>
              <span className={styles.imageFailedBody}>
                The picture could not be made on this phone. The link below still works.
              </span>
              {captureAttempts && captureAttempts.length > 0 && (
                <code className={styles.diag} data-testid="mobile-share-diag">
                  {formatCaptureAttempts(captureAttempts)}
                </code>
              )}
              <button
                type="button"
                className={styles.secondary}
                onClick={onRetry}
                data-testid="mobile-share-retry-image"
              >RETRY IMAGE</button>
            </div>
          )}
          {imageUrl && captureAttempts && captureAttempts.length > 1 && (
            <code className={styles.diag} data-testid="mobile-share-diag">
              {formatCaptureAttempts(captureAttempts)}
            </code>
          )}
```

(5) `MobileShareResult.module.css` に追記（琥珀＝警告トーン。エラー赤は使わない — リンクは生きているため）:

```css
/* N-56: 画像だけ失敗（リンクは生きている）の警告枠。琥珀＝「注意・でも壊れてない」。 */
.imageFailed {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 196, 0, 0.35);
  border-radius: 10px;
  background: rgba(255, 196, 0, 0.08);
}

.imageFailedTitle {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #ffc400;
}

.imageFailedBody {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
  line-height: 1.5;
}

/* 実機診断行。ユーザーがそのままコピペ/スクショで報告できるよう選択可にする。 */
.diag {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.55);
  word-break: break-all;
  user-select: text;
  -webkit-user-select: text;
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
rtk npx vitest run components/board/MobileShareResult.test.tsx
```

- [ ] **Step 5: Commit**

```bash
rtk git add components/board/MobileShareResult.tsx components/board/MobileShareResult.module.css components/board/MobileShareResult.test.tsx
rtk git commit -m "feat(share): visible NO IMAGE state + diagnostics on the mobile result sheet (N-56)"
```

---

### Task 5: BoardRoot の配線（モバイル撮影を Detailed + fallback に） 【Sonnet 推奨】

**Files:**
- Modify: `components/board/BoardRoot.tsx`（`handleMobileCreateShare` 2454-2513 近辺 / `handleExitShareMode` 2228-2238 / `MobileShareResult` の JSX 3583-3596 近辺 — 行番号は前タスクでズレるので**関数名で探す**こと）

**Interfaces:**
- Consumes: Task 3 の `captureCollageShareImageDetailed` / `CaptureAttempt`、Task 4 の新 props
- Produces: なし（配線のみ）

- [ ] **Step 1: state を追加**

`shareCreateState` の useState 宣言（`const [shareCreateState, …` を検索）の直後に:

```ts
  const [captureAttempts, setCaptureAttempts] = useState<readonly CaptureAttempt[] | null>(null)
  const [shareErrorMessage, setShareErrorMessage] = useState<string | null>(null)
```

import は既存の `captureCollageShareImage` の import 行を拡張:
`import { captureCollageShareImageDetailed, type CaptureAttempt } from '@/lib/share/capture-collage'`
（デスクトップ側 `handleCreateHostedShare` が `captureCollageShareImage` を使い続けるなら両方 import。**デスクトップの呼び出しは触らない**。）

- [ ] **Step 2: `handleMobileCreateShare` の撮影ブロックを差し替え**

`setShareCreateState('creating')` の直前に `setCaptureAttempts(null)` と `setShareErrorMessage(null)` を追加。撮影ブロックを:

```ts
    let thumb: string | null = null
    if (frame && typeof requestAnimationFrame === 'function') {
      setCapturing(true)
      // 帯の描画と data-capturing の CSS が確実に paint されてから撮る。
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
      try {
        const outcome = await captureCollageShareImageDetailed(frame, {
          origin: shareOrigin(),
          boardColor: deriveCaptureBoardColor(),
          fit: 'cover',
          // 帯の幅（画面幅ではない）を渡す — 切り出す帯が原寸 1200px の raster になる。
          scale: mobileCaptureScale(band.width),
          // 実機で高倍率が死ぬ場合に備え、倍率 1 でもう一度だけ撮り直す (N-56)。
          fallbackScales: [1],
          // iOS の「真っ白な成功画像」を失敗として検出する (N-56)。
          rejectUniform: true,
        })
        thumb = outcome.dataUrl
        setCaptureAttempts(outcome.attempts)
      } finally {
        setCapturing(false)
      }
    } else {
      setCaptureAttempts([{ scale: 1, timeoutMs: 0, elapsedMs: 0, stage: 'no-frame', message: null }])
    }
```

`createHostedShare` の結果分岐の else を:

```ts
    } else {
      setShareErrorMessage(res.message)
      setShareCreateState('error')
    }
```

- [ ] **Step 3: `handleExitShareMode` にリセットを追加**

既存のリセット群（`setCapturedImageUrl(null)` 等）に並べて:

```ts
    setCaptureAttempts(null)
    setShareErrorMessage(null)
```

- [ ] **Step 4: `MobileShareResult` の JSX に props を渡す**

```tsx
          <MobileShareResult
            imageUrl={capturedImageUrl}
            shareUrl={hostedShareUrl}
            createState={shareCreateState}
            captureAttempts={captureAttempts}
            errorMessage={shareErrorMessage}
            onCopyLink={handleShareCopyLink}
            onRetry={(): void => { void handleMobileCreateShare() }}
            onDone={handleExitShareMode}
          />
```

※ `onRetry` は現状どおり全再実行（自動配置からやり直し）。N-58 実装後は「撮影だけ再実行」に差し替わる（n58 計画側で対応）。

- [ ] **Step 5: 検証一式**

```bash
rtk tsc
rtk vitest run
pnpm build
npx playwright test tests/e2e/mobile-share.spec.ts
```

Expected: tsc 0 / vitest 全緑（2246+ 新規分）/ build OK / mobile-share 5 本緑（成功経路は挙動不変なので**全部そのまま通るはず**。落ちたら退行＝直してから進む）。

- [ ] **Step 6: Commit**

```bash
rtk git add components/board/BoardRoot.tsx
rtk git commit -m "feat(board): wire mobile capture diagnostics + scale fallback (N-56)"
```

---

### Task 6: デプロイ→実機診断プロトコル 【Sonnet／読み解きは Opus】

- [ ] **Step 1: デプロイ**

```bash
pnpm build
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true
```

- [ ] **Step 2: ユーザーに実機手順を依頼（そのままコピペで渡す）**

```
1. スマホで https://allmarks.app を開いてハードリロード（再読み込み）
2. 下の SHARE → SELECT ALL → CREATE
3. 結果シートを見て、次のどれかを教えてください:
   (A) プレビュー画像が出た（黄色い注意枠なし）→ 直っています
   (B) プレビューは出たが、下に小さい灰色の英数字の行がある → その行をコピペかスクショで送ってください
   (C) 「NO IMAGE — LINK ONLY」の黄色い枠が出た → 中の小さい英数字の行を送ってください
   (D) 「COULDN'T CREATE THE LINK」が出た → 下の英数字の行を送ってください
```

- [ ] **Step 3: 診断行 → 真因 → 恒久対応の対応表（該当した分岐だけ次セッションで実装）**

| 診断行のパターン | 真因 | 恒久対応（別タスクとして起票） |
|---|---|---|
| `#1 x3.08 timeout` → `#2 x1 ok` | 高倍率 canvas がメモリ/速度で死んでいる | F1: `fallbackScales` を `[2, 1]` にして中間画質を確保。将来は「帯だけを撮る」最適化（`.outerFrame` 全体でなく帯 rect の wrapper を撮影対象にし、canvas 面積を 1/4 に）を検討 |
| `#1 x3.08 render RangeError/InvalidStateError…` → `#2 x1 ok` | 端末の canvas 上限超過 | 同上 F1（既に fallback で救えている。診断行で確定させるだけ） |
| 両方 `timeout` | モバイル回線での `/api/img` 再取得が 20 秒超え | F2: `timeoutMs` を 30000 に増やす＋arrange 進入時に選択カードの proxy URL を `fetch` で先読みして CF edge cache を温める（`handleMobileCreateShare` の band 計算直後に `chosen.forEach(it => { const src = …表示画像URL…; void fetch(rewriteToProxy(src, shareOrigin())).catch(() => {}) })`） |
| `render SecurityError…` | 汚染＝proxy を通っていない画像がある | F3: `rewriteImageSrc` の対象漏れ（`srcset`・CSS 背景画像等）を特定。診断 message に URL を含める拡張から |
| `blank` | iOS の foreignObject 空振り（真っ白成功） | F4: **ユーザーと相談**。選択肢 = (a) canvas 直描画のモバイル専用レンダラー（大工事・s174 の `capture-mirror.ts` が土台になる） (b) 「この端末では画像なし」を正直に出す（現状の NO IMAGE 表示のまま） |
| `decode` / `normalize` | data-URL 破損 or canvas 不可 | 稀。message と機種を添えて個別調査 |
| (D) + message | `/api/share/create` ネットワーク/サーバー | `functions/api/share/create` 側を message を手掛かりに調査 |

- [ ] **Step 4: セッション記録**

TODO.md の N-56 に診断結果と選ばれた恒久対応を書き足す。直った場合は TODO_COMPLETED へ。

---

## Self-Review 済みの注意点（実装者へ）

- `captureCollageShareImage`（旧 API）の呼び出し元はデスクトップ `handleCreateHostedShare`（BoardRoot 内）。**触らない**。fallback は opts 未指定なら発動しない設計なので安全。
- `formatCaptureAttempts` の `x${Number(a.scale.toFixed(2))}` は `3.08` → `x3.08`、`1` → `x1` になる（`Number()` で末尾ゼロを落とす）。テストの期待値はこれに合わせてある。
- jsdom では `Image` が実ロードしないので、パイプライン全体を貫通する単体テストは書けない。**モック境界は renderShareImage**（`vi.mock`）に置き、実機側は Task 6 のプロトコルで検証する。
- 診断行はユーザーに見える。個人情報・URL 全文は入らない（例外名＋メッセージのみ）。message に URL が含まれる例外（fetch 失敗等）が観測されたら表示前に切り詰める改善を F3 で。
