/**
 * Pure, deterministic per-card decoration model for the paper-atelier theme.
 *
 * Same `cardId` always returns a deep-equal set, so a card's tape/pin never
 * reshuffle between renders (no flicker on reorder / lightbox close). The
 * generator is a string-seeded mulberry32 PRNG — same variant as the approved
 * placeholder-art mockup (scripts/generate-placeholder-art.mjs L47-55).
 *
 * MOUNTING MODEL (2026-07-01, simplified): a card is fastened to the board in
 * exactly ONE of two ways — a single strip of tape centred on the top edge, or a
 * single top-center push-pin. Every card gets one (no bare cards). Corners /
 * diagonals / multiple strips were all removed as too busy. The tape straddles
 * the top edge so its upper half sits on the board and its lower half on the card
 * (= "taped to the board").
 *
 * Everything here is presentational metadata only; it never affects card box
 * geometry or hit-testing (consumed by a pointer-events:none overlay).
 */

export type DecoCorner = 'tl' | 'tr' | 'bl' | 'br'
export type WashiTint = 'a' | 'b' | 'c'
/** Tape is either clear cellophane or coloured washi (per card). */
export type TapeFamily = 'clear' | 'colored'

/** A single strip of tape, centred on the top edge. */
export type TapePiece = {
  /** Which --deco-washi-{a|b|c} tint token to paint with (coloured CSS fallback). */
  readonly tint: WashiTint
  /** Hand-torn tilt in degrees. */
  readonly angleDeg: number
  /** Horizontal center as a % of the top edge (≈ 50). */
  readonly offsetPct: number
  /** Stable 0..1 fraction used by the component to pick a tape PNG. */
  readonly assetSeed: number
}

/** A small archival icon stamp (star / heart / check / camera / …). */
export type DecoIcon = {
  readonly corner: DecoCorner
  readonly angleDeg: number
  readonly assetSeed: number
}

/** A pressed wax-seal accent. */
export type DecoWax = {
  readonly corner: DecoCorner
  readonly assetSeed: number
}

export type CardDecorationSet = {
  /** The single top-center tape strip, or null (pinned or bare). */
  readonly tape: TapePiece | null
  /** Whether the tape is clear cellophane or coloured washi. */
  readonly tapeFamily: TapeFamily
  /** A single top-center push-pin (mutually exclusive with `tape`). */
  readonly pin: boolean
  /** Colour of the pin when `pin` is true. */
  readonly pinVariant: 'gold' | 'green'
  /** Optional small icon stamp, or null. */
  readonly iconStamp: DecoIcon | null
  /** Optional pressed wax-seal accent, or null. */
  readonly wax: DecoWax | null
}

/** mulberry32 — same variant as the approved mockup generator. */
function mulberry32(seed: number): () => number {
  let s = seed
  return (): number => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a 32-bit string hash → stable integer seed for a cardId. */
function hashStringToSeed(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

const ALL_CORNERS: ReadonlyArray<DecoCorner> = ['tl', 'tr', 'bl', 'br']
const TINTS: ReadonlyArray<WashiTint> = ['a', 'b', 'c']

/** Pick one element of `arr` using rng in [0,1). */
function pick<T>(rng: () => number, arr: ReadonlyArray<T>): T {
  return arr[Math.floor(rng() * arr.length)] as T
}

/** Map rng to a 1-decimal float in [min,max]. */
function floatRange(rng: () => number, min: number, max: number): number {
  return Math.round((min + rng() * (max - min)) * 10) / 10
}

/** Fraction of cards whose tape is clear cellophane (rest are coloured washi). */
const CLEAR_TAPE_FRACTION = 0.34
/** Fastener mix: tape most of the time, a pin the rest. Every card gets one. */
const TAPE_FRACTION = 0.62

/** Build the single top-center tape strip. */
function makeTape(rng: () => number, assetSeed: number): TapePiece {
  return {
    tint: pick(rng, TINTS),
    angleDeg: floatRange(rng, -5, 5),
    offsetPct: floatRange(rng, 46, 54),
    assetSeed,
  }
}

/**
 * Returns the deterministic decoration set for a card (untorn).
 * @param cardId Stable bookmark id (CardNode data-card-id / it.bookmarkId).
 */
export function getCardDecorations(cardId: string): CardDecorationSet {
  const rng = mulberry32(hashStringToSeed(cardId))

  const fastenerRoll = rng()
  const tapeFamily: TapeFamily = rng() < CLEAR_TAPE_FRACTION ? 'clear' : 'colored'
  const tapeAssetSeed = rng()

  // Every card is fastened: a top-center tape, or a top-center pin.
  let tape: TapePiece | null = null
  let pin = false
  if (fastenerRoll < TAPE_FRACTION) {
    tape = makeTape(rng, tapeAssetSeed)
  } else {
    pin = true
  }

  const pinVariant: 'gold' | 'green' = rng() < 0.5 ? 'gold' : 'green'

  // --- Rare accents (unchanged categories), layered on top of the mount. ---
  let iconStamp: DecoIcon | null = null
  if (rng() < 0.16) {
    iconStamp = {
      corner: pick(rng, ALL_CORNERS),
      angleDeg: floatRange(rng, -12, 12),
      assetSeed: rng(),
    }
  }

  let wax: DecoWax | null = null
  if (rng() < 0.1) {
    wax = { corner: pick(rng, ALL_CORNERS), assetSeed: rng() }
  }

  return { tape, tapeFamily, pin, pinVariant, iconStamp, wax }
}

/** A deterministic top-center tape used to replace a push-pin on torn/ring
 *  sheets (a pin can't hold a loose / ring-bound sheet). Seeded separately so it
 *  doesn't perturb the base set's PRNG stream. */
function pinReplacementTape(cardId: string): TapePiece {
  const rng = mulberry32(hashStringToSeed(`${cardId}:pin-to-tape`))
  return makeTape(rng, rng())
}

/**
 * Resolve the decoration set for how the card is actually backed.
 *
 * On torn/ring-bound sheets (graph / notepad) a push-pin would let the loose
 * sheet fall, so it becomes a top-center tape instead. A tape is already
 * top-center (fine on a torn sheet, whose top edge reaches the box top), and a
 * bare card stays bare. Untorn cards pass through unchanged. Pure + deterministic
 * per (cardId, tornBacking).
 */
export function resolveDecorations(cardId: string, tornBacking: boolean): CardDecorationSet {
  const base = getCardDecorations(cardId)
  if (!tornBacking || !base.pin) return base
  return { ...base, pin: false, tape: pinReplacementTape(cardId) }
}
