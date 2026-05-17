/**
 * Character set used by TuneTrigger (and any future Matrix-style scramble
 * surface) to flicker each cell through random glyphs before settling to a
 * target character. Mix of uppercase ASCII, digits, and a few visual symbols
 * — kept to monospace-friendly chars so cell widths don't jitter mid-scramble.
 */
export const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·#@$%&*?/\\|<>=+-'

/** Returns one random character from SCRAMBLE_CHARS. */
export function pickRandomChar(): string {
  const i = Math.floor(Math.random() * SCRAMBLE_CHARS.length)
  return SCRAMBLE_CHARS[i] ?? '?'
}
