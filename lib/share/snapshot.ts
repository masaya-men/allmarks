// lib/share/snapshot.ts
// SHARE 時の thumbnail プレースホルダ生成。 session 85 暫定版。
//
// 元設計は dom-to-image-more で board を画像化していたが、 300 カードのボードで
// tab メモリが 5GB+ に膨らんで落ちる致命傷があった。 viewport filter / 自前 canvas
// wireframe どちらも user 体験的に不採用 (= 写実的でない / 「俺のボードじゃない」)。
//
// 正解は OG 画像のサーバーサイド動的生成 (= workers-og + Satori、 業界標準)。
// 別セッションで再設計。 そこまでの繋ぎとして、 ここではブランド化された静的
// プレースホルダを返す。 user モーダルにも表示され、 X カードにも乗る。
//
// 制約: メモリ bounded (= 1 canvas のみ)、 速度 < 10ms、 一切外部 fetch しない、
// クラッシュしない。

export type SnapshotOptions = {
  readonly width: number   // target output width (px)
  readonly quality: number // 0.0-1.0
  /** ブランド帯に出すラベル (例 "100 CARDS"、 fallback は "ALLMARKS BOARD") */
  readonly captionRight?: string
}

const DEFAULT_OPTS: SnapshotOptions = { width: 1200, quality: 0.9 }

const BG_TOP = '#0a0a0c'
const BG_BOTTOM = '#000000'
const BRAND_GREEN = '#28F100'
const TEXT_MAIN = 'rgba(255,255,255,0.92)'
const TEXT_SOFT = 'rgba(255,255,255,0.42)'

/**
 * AllMarks ブランド placeholder を WebP data URL で返す。
 * element 引数は将来本物 snapshot 実装が戻った時のために残す (= 現状未使用)。
 * 失敗時は null。
 */
export async function captureViewportWebP(
  _element: HTMLElement | null,
  options: Partial<SnapshotOptions> = {},
): Promise<string | null> {
  const opts = { ...DEFAULT_OPTS, ...options }
  try {
    const cw = opts.width
    const ch = Math.round((cw * 9) / 16) // 16:9 (OG 推奨 1200x630 に近い 1.78)
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // 1) 真っ黒 + 縦グラデで深みを出す
    const grad = ctx.createLinearGradient(0, 0, 0, ch)
    grad.addColorStop(0, BG_TOP)
    grad.addColorStop(1, BG_BOTTOM)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, cw, ch)

    // 2) 微かな音波 motif (= AllMarks default theme と整合)
    ctx.strokeStyle = 'rgba(40,241,0,0.06)'
    ctx.lineWidth = 1
    ctx.beginPath()
    const cy = ch / 2
    for (let x = 0; x <= cw; x += 4) {
      const y = cy + Math.sin((x / cw) * Math.PI * 6) * (ch * 0.12)
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // 3) 中央のロゴと wordmark
    const logoSize = Math.min(ch * 0.32, 200)
    drawAMark(ctx, cw / 2, ch / 2 - logoSize * 0.18, logoSize)

    // 4) 中央下に "ALLMARKS" を控えめに
    ctx.fillStyle = TEXT_MAIN
    ctx.textBaseline = 'top'
    ctx.textAlign = 'center'
    const wordmarkSize = Math.max(18, Math.round(ch * 0.05))
    ctx.font = `600 ${wordmarkSize}px "Geist Mono", ui-monospace, SFMono-Regular, monospace`
    ctx.fillText('ALLMARKS', cw / 2, ch / 2 + logoSize * 0.3)
    ctx.fillStyle = TEXT_SOFT
    const tagSize = Math.max(11, Math.round(ch * 0.025))
    ctx.font = `400 ${tagSize}px "Geist Mono", ui-monospace, monospace`
    ctx.fillText('SHARED BOARD', cw / 2, ch / 2 + logoSize * 0.3 + wordmarkSize + 8)

    // 5) 右下ブランド帯 (= dot + caption)
    const padding = Math.round(ch * 0.06)
    const dotY = ch - padding
    const captionRight = opts.captionRight ?? 'ALLMARKS BOARD'
    const stripFontSize = Math.max(13, Math.round(ch * 0.028))
    ctx.font = `500 ${stripFontSize}px "Geist Mono", ui-monospace, monospace`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'right'
    ctx.fillStyle = TEXT_MAIN
    ctx.fillText(captionRight, cw - padding, dotY)

    // 左下: dot
    ctx.fillStyle = BRAND_GREEN
    ctx.beginPath()
    ctx.arc(padding + 4, dotY, 5, 0, Math.PI * 2)
    ctx.fill()

    return canvas.toDataURL('image/webp', opts.quality)
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('[share/snapshot] capture failed', e)
    return null
  }
}

/**
 * AllMarks 「A」 マーク (= 黒い三角の中に緑チェック) を canvas に描画。
 * favicon / floating button と同じモチーフ。
 */
function drawAMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  ctx.save()
  ctx.translate(cx - size / 2, cy - size / 2)
  // 白で大きな A の縦線
  ctx.strokeStyle = 'rgba(255,255,255,0.94)'
  ctx.lineWidth = Math.max(3, size * 0.08)
  ctx.lineCap = 'square'
  ctx.lineJoin = 'miter'
  ctx.beginPath()
  ctx.moveTo(size * 0.18, size * 0.84)
  ctx.lineTo(size * 0.5, size * 0.1)
  ctx.lineTo(size * 0.82, size * 0.84)
  ctx.stroke()
  // A の横線
  ctx.beginPath()
  ctx.moveTo(size * 0.33, size * 0.58)
  ctx.lineTo(size * 0.67, size * 0.58)
  ctx.stroke()
  // 緑のチェック (= A の右下、 控えめに)
  ctx.strokeStyle = BRAND_GREEN
  ctx.lineWidth = Math.max(2, size * 0.06)
  ctx.beginPath()
  ctx.moveTo(size * 0.62, size * 0.74)
  ctx.lineTo(size * 0.72, size * 0.84)
  ctx.lineTo(size * 0.9, size * 0.62)
  ctx.stroke()
  ctx.restore()
}
