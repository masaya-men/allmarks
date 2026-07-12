// lib/share/capture-breadcrumb.ts
// N-56 実機で分かったこと: スマホの共有画像づくり (dom-to-image 撮影) は、多枚数の
// カードを一度に画像化するとき iOS Safari のタブメモリ上限を超え、タブごと強制終了
// (OOM) することがある。タブが死ぬと画面上の診断表示 (s188) は道連れで消えるので、
// 実機で理由を読み取れない。
//
// そこで「撮影の直前」に、枚数・canvas 寸法・元画像の総画素数を localStorage に
// 同期書き込みしておく (= パンくず)。撮影が無事に終われば消す。もしタブがクラッシュ
// して消せなかった場合、次にボードを開いた時にこのパンくずが残っている ＝「前回この
// 条件で落ちた」証拠になる。localStorage を使うのは、同期書き込みでクラッシュ前に
// 確実にディスクへ残せるため (IndexedDB は非同期でフラッシュ前に死ぬと消える)。
// これはユーザーデータ保存ではなく、1件だけの診断メモなので localStorage が適切。

const KEY = 'allmarks:capture-breadcrumb'

/** 撮影の直前スナップショット。全て数値 (個人情報・URL は入れない)。 */
export type CaptureBreadcrumb = {
  /** 書き込み時刻 (Date.now)。 */
  readonly ts: number
  /** 撮影対象に含まれる選択カード枚数。 */
  readonly cardCount: number
  /** 撮影フレームの CSS 幅・高さ。 */
  readonly frameW: number
  readonly frameH: number
  /** dom-to-image に渡した倍率。 */
  readonly scale: number
  /** 確保される出力 canvas の実ピクセル寸法 (= frame × scale)。 */
  readonly canvasW: number
  readonly canvasH: number
  /** 撮影対象に写る全 <img> の元画像の合計メガピクセル (画像埋め込みメモリの目安)。 */
  readonly sourceMP: number
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function toBreadcrumb(v: unknown): CaptureBreadcrumb | null {
  if (typeof v !== 'object' || v === null) return null
  const o = v as Record<string, unknown>
  if (
    isFiniteNumber(o.ts) &&
    isFiniteNumber(o.cardCount) &&
    isFiniteNumber(o.frameW) &&
    isFiniteNumber(o.frameH) &&
    isFiniteNumber(o.scale) &&
    isFiniteNumber(o.canvasW) &&
    isFiniteNumber(o.canvasH) &&
    isFiniteNumber(o.sourceMP)
  ) {
    return {
      ts: o.ts,
      cardCount: o.cardCount,
      frameW: o.frameW,
      frameH: o.frameH,
      scale: o.scale,
      canvasW: o.canvasW,
      canvasH: o.canvasH,
      sourceMP: o.sourceMP,
    }
  }
  return null
}

/** 撮影の直前に呼ぶ。storage が使えない環境でも決して throw しない。 */
export function writeCaptureBreadcrumb(b: CaptureBreadcrumb): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(b))
  } catch {
    // Safari プライベートモード / storage 無効 / 容量超過 — 診断は諦めるが撮影は続ける。
  }
}

/** 撮影が (成功・失敗を問わず) 最後まで走ったら呼ぶ。クラッシュ時だけ残る。 */
export function clearCaptureBreadcrumb(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // no-op
  }
}

/** 残存パンくずを読む (= 前回撮影がクラッシュした証拠)。無ければ null。決して throw しない。 */
export function readStaleCaptureBreadcrumb(): CaptureBreadcrumb | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return toBreadcrumb(JSON.parse(raw))
  } catch {
    return null
  }
}

/** 実機報告用の 1 行。canvas 寸法と元画像の総画素の両方を出し、どちらが主犯かを一目で分かるようにする。 */
export function formatCaptureBreadcrumb(b: CaptureBreadcrumb): string {
  const scale = Number(b.scale.toFixed(2))
  return `${b.cardCount} cards · canvas ${b.canvasW}×${b.canvasH} (x${scale}) · images ${Math.round(b.sourceMP)}MP`
}
