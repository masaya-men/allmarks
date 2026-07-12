/**
 * Pure utility functions for share image canvas rendering.
 * Task 3 will add async canvas-drawing logic to this file.
 */

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
