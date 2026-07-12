/**
 * Canvas-direct share image renderer for mobile (iOS-safe).
 *
 * dom-to-image (SVG foreignObject) cannot paint <img> inside foreignObject on
 * iOS Safari (confirmed on real device, N-56) — the mobile capture path must
 * draw directly to a <canvas> instead. Unlike capture-mirror.ts (which reads
 * a live mirror DOM via getBoundingClientRect), this renderer draws from
 * PLACEMENT DATA (input.cards + input.band), so it needs no DOM at all.
 *
 * jsdom does not implement a real canvas 2d context, so renderCollageCanvasToJpeg
 * always resolves null under test — the never-throw contract is what's tested
 * here. Real drawing is verified on-device (Task 5/7).
 */

import { pickPlaceholderImage } from '@/lib/board/placeholder-image'
import {
  loadCrossOriginImage,
  roundRectPath,
  drawWrappedText,
  drawClippedText,
  canvasToJpegUnderTarget,
} from './capture-mirror'

const TEXT_MAIN = 'rgba(255, 255, 255, 0.92)'

export type CollageCanvasCard = {
  readonly id: string
  readonly title: string
  readonly thumbnailUrl: string | null // = item.thumbnail
  readonly url: string // = item.url（生成アートの seed）
  readonly rect: { x: number; y: number; w: number; h: number } // band 空間
  /** Free rotation in degrees, matching CollageCanvas's on-screen
   *  transform: rotate(deg). Undefined / 0 = upright. Rotates around the
   *  card's center in output space. */
  readonly rotation?: number
}

export type RenderCollageCanvasInput = {
  readonly cards: readonly CollageCanvasCard[]
  readonly band: { x: number; y: number; width: number; height: number }
  readonly width: number // 1200
  readonly height: number // 630
  readonly bgColor: string
  readonly roundedCornersPx: number // 0 なら角丸なし
  readonly toProxyUrl: (src: string) => string // rewriteToProxy(src, origin)
  readonly targetBytes: number
  readonly startQuality: number
  readonly minQuality: number
}

/**
 * Calculate the source crop rectangle for a cover-fit operation.
 * Given an image and a destination box, returns the source crop (sx, sy, sw, sh)
 * that fills the destination while preserving aspect ratio, centered.
 *
 * @param imgW - source image width
 * @param imgH - source image height
 * @param dstW - destination box width
 * @param dstH - destination box height
 * @returns source crop coordinates for ctx.drawImage(image, sx, sy, sw, sh, ...)
 */
export function coverRect(
  imgW: number,
  imgH: number,
  dstW: number,
  dstH: number
): { sx: number; sy: number; sw: number; sh: number } {
  // Guard against zero or negative dimensions
  if (imgW <= 0 || imgH <= 0 || dstW <= 0 || dstH <= 0) {
    return { sx: 0, sy: 0, sw: 0, sh: 0 }
  }

  // scale = max(dstW/imgW, dstH/imgH) ensures the scaled image fully covers dst
  const scale = Math.max(dstW / imgW, dstH / imgH)

  // crop dimensions
  const sw = dstW / scale
  const sh = dstH / scale

  // center the crop
  const sx = (imgW - sw) / 2
  const sy = (imgH - sh) / 2

  return { sx, sy, sw, sh }
}

/**
 * Map a rect positioned in band-space to output (1200x630) space.
 * Implements the linear transformation from band coordinates to output coordinates.
 *
 * @param pos - position and size in band-space: {x, y, w, h}
 * @param band - the band rectangle in screen coordinates: {x, y, width, height}
 * @param outW - output width (typically 1200)
 * @param outH - output height (typically 630)
 * @returns mapped rectangle in output space: {x, y, w, h}
 */
export function mapBandToOutput(
  pos: { x: number; y: number; w: number; h: number },
  band: { x: number; y: number; width: number; height: number },
  outW: number,
  outH: number
): { x: number; y: number; w: number; h: number } {
  // Scale factors from band space to output space
  const sx = outW / band.width
  const sy = outH / band.height

  // Apply linear transformation:
  // shift by band offset, then scale
  const x = (pos.x - band.x) * sx
  const y = (pos.y - band.y) * sy
  const w = pos.w * sx
  const h = pos.h * sy

  return { x, y, w, h }
}

/**
 * Render a collage share image from PLACEMENT DATA directly to a <canvas>,
 * then encode to a size-capped JPEG dataURL. Never throws — any failure
 * (unsupported canvas/toBlob in jsdom, image load errors, etc.) resolves null
 * so the caller can still create a share link without an image.
 *
 * Images are loaded ONE AT A TIME (sequential await inside the per-card loop),
 * never Promise.all — a 100-card board must not hold 100 decoded images in
 * memory at once (that is the exact iOS OOM this renderer exists to avoid).
 */
export async function renderCollageCanvasToJpeg(
  input: RenderCollageCanvasInput
): Promise<string | null> {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = input.width
    canvas.height = input.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.fillStyle = input.bgColor
    ctx.fillRect(0, 0, input.width, input.height)

    for (const card of input.cards) {
      await drawCard(ctx, card, input)
    }

    drawBrand(ctx, input.width, input.height)

    return await canvasToJpegUnderTarget(canvas, input.targetBytes, input.startQuality, input.minQuality)
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('[share/collage-canvas-render] render failed', e)
    return null
  }
}

/** Draw one card into `ctx` at its mapped output rect. Off-screen cards are skipped. */
async function drawCard(
  ctx: CanvasRenderingContext2D,
  card: CollageCanvasCard,
  input: RenderCollageCanvasInput
): Promise<void> {
  const out = mapBandToOutput(card.rect, input.band, input.width, input.height)
  if (out.x + out.w < 0 || out.y + out.h < 0 || out.x > input.width || out.y > input.height) return

  // サムネ画像を先に読み込む (proxy 経由で same-origin 化 → toBlob が canvas taint
  // で SecurityError にならない)。1 枚ずつ await — Promise.all は禁止 (メモリ安全)。
  let img: HTMLImageElement | null = null
  if (card.thumbnailUrl) {
    img = await loadCrossOriginImage(input.toProxyUrl(card.thumbnailUrl))
  }
  const hasImage = img !== null

  // サムネが無い / 失敗したカードは、board と同じ生成アート背景 (同一オリジンなので
  // proxy 不要 = 直接 loadCrossOriginImage)。
  let artImg: HTMLImageElement | null = null
  if (!hasImage) {
    const art = pickPlaceholderImage(card.url)
    if (art) artImg = await loadCrossOriginImage(art.url)
  }

  const radius = input.roundedCornersPx

  const rotationDeg = card.rotation ?? 0

  ctx.save()
  if (rotationDeg !== 0) {
    // Rotate about the card's center = same as CSS transform-origin:center
    // + transform: rotate(deg) that CollageCanvas applies on-screen.
    const cx = out.x + out.w / 2
    const cy = out.y + out.h / 2
    ctx.translate(cx, cy)
    ctx.rotate((rotationDeg * Math.PI) / 180)
    ctx.translate(-cx, -cy)
  }

  // 角丸でクリップしてから背景塗り + 画像描画 (角が四角く残らない)
  ctx.save()
  roundRectPath(ctx, out.x, out.y, out.w, out.h, radius)
  ctx.clip()
  ctx.fillStyle = '#1a1a1c'
  ctx.fillRect(out.x, out.y, out.w, out.h)
  if (img) {
    // cover-fit (stretch ではなく中央クロップ)。取得失敗の異常アスペクトは stretch へ fallback。
    const cr = coverRect(img.naturalWidth || img.width, img.naturalHeight || img.height, out.w, out.h)
    if (cr.sw > 0 && cr.sh > 0) {
      ctx.drawImage(img, cr.sx, cr.sy, cr.sw, cr.sh, out.x, out.y, out.w, out.h)
    } else {
      ctx.drawImage(img, out.x, out.y, out.w, out.h)
    }
  } else if (artImg) {
    // 生成アートは抽象画像なので stretch で十分。
    ctx.drawImage(artImg, out.x, out.y, out.w, out.h)
    // board の PlaceholderCard と同じ scrim (0.22 / 0.48 / 0.22 縦グラデ) で白タイトルの可読性を確保。
    const scrim = ctx.createLinearGradient(out.x, out.y, out.x, out.y + out.h)
    scrim.addColorStop(0, 'rgba(0, 0, 0, 0.22)')
    scrim.addColorStop(0.5, 'rgba(0, 0, 0, 0.48)')
    scrim.addColorStop(1, 'rgba(0, 0, 0, 0.22)')
    ctx.fillStyle = scrim
    ctx.fillRect(out.x, out.y, out.w, out.h)
  }
  ctx.restore()

  // タイトル text: 画像あり → 下端に小さく、なし → カード全体に大きく中央。
  // カード矩形で再度クリップしてからテキストを描く (折返し不完全でもはみ出さない安全網)。
  ctx.save()
  roundRectPath(ctx, out.x, out.y, out.w, out.h, radius)
  ctx.clip()
  ctx.fillStyle = TEXT_MAIN
  ctx.textBaseline = 'top'
  if (img) {
    ctx.textAlign = 'left'
    const titleSize = Math.max(9, Math.round(out.h * 0.09))
    ctx.font = `500 ${titleSize}px "Geist Mono", ui-monospace, monospace`
    drawClippedText(ctx, card.title, out.x + 6, out.y + out.h - titleSize - 6, out.w - 12)
  } else {
    ctx.textAlign = 'center'
    const titleSize = Math.max(10, Math.round(out.h * 0.12))
    ctx.font = `500 ${titleSize}px "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
    const lineHeight = titleSize * 1.3
    const topPad = Math.max(8, Math.round(out.h * 0.08))
    const maxLines = Math.floor((out.h - topPad * 2) / lineHeight)
    drawWrappedText(
      ctx,
      card.title,
      out.x + out.w / 2,
      out.y + topPad,
      out.w - 16,
      lineHeight,
      Math.max(1, maxLines)
    )
  }
  ctx.restore()
  ctx.restore()
}

/** 右下 allmarks.app 焼き込み (capture-mirror の drawBrandStrip 相当・タグ帯は v1 では省略)。 */
function drawBrand(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const padding = 18
  ctx.fillStyle = TEXT_MAIN
  ctx.font = '500 13px "Geist Mono", ui-monospace, monospace'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'right'
  ctx.fillText('allmarks.app', width - padding, height - padding - 16)
}
