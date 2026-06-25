/**
 * Pure, deterministic per-card decoration model for the paper-atelier theme.
 *
 * Same `cardId` always returns a deep-equal set, so a card's tape/pin/stamp
 * never reshuffle between renders (no flicker on reorder / lightbox close).
 * The generator is a string-seeded mulberry32 PRNG — same variant as the
 * approved placeholder-art mockup (scripts/generate-placeholder-art.mjs L47-55).
 *
 * Everything here is presentational metadata only; it never affects card box
 * geometry or hit-testing (consumed by a pointer-events:none overlay).
 */

export type DecoCorner = 'tl' | 'tr' | 'bl' | 'br'
export type WashiTint = 'a' | 'b' | 'c'
export type WashiEdge = 'top' | 'right' | 'bottom' | 'left'
export type StampLabel = 'ARCHIVE' | 'REAL' | 'RATED'

export type WashiPiece = {
  /** Which --deco-washi-{a|b|c} tint token to paint with. */
  readonly tint: WashiTint
  /** Which card edge the tape straddles. */
  readonly edge: WashiEdge
  /** Rotation of the tape strip, degrees (hand-torn look). */
  readonly angleDeg: number
  /** Position along the edge, 0..100 (% of that edge's free span). */
  readonly offsetPct: number
  /** Stable 0..1 fraction used by the component to pick a washi-tape PNG variant. */
  readonly assetSeed: number
}

export type DecoStamp = {
  readonly label: StampLabel
  readonly corner: DecoCorner
  readonly angleDeg: number
  /** Stable 0..1 fraction used by the component to pick a stamp-frame PNG variant. */
  readonly assetSeed: number
}

export type CardDecorationSet = {
  /** Photo-album corner holders. Subset of the 4 corners (often a diagonal pair). */
  readonly photoCorners: ReadonlyArray<DecoCorner>
  /** 0..2 washi-tape strips. */
  readonly washi: ReadonlyArray<WashiPiece>
  /** Top-edge push-pin (mutually exclusive with `clip`). null = no pin. */
  readonly pin: { readonly variant: 'gold' | 'green' } | null
  /** Top-edge bulldog clip (mutually exclusive with `pin`). */
  readonly clip: boolean
  /** Optional archival rubber stamp, or null. */
  readonly stamp: DecoStamp | null
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
const EDGES: ReadonlyArray<WashiEdge> = ['top', 'right', 'bottom', 'left']
const STAMP_LABELS: ReadonlyArray<StampLabel> = ['ARCHIVE', 'REAL', 'RATED']

/** Pick one element of `arr` using rng in [0,1). */
function pick<T>(rng: () => number, arr: ReadonlyArray<T>): T {
  return arr[Math.floor(rng() * arr.length)] as T
}

/** Map rng to a 1-decimal float in [min,max]. */
function floatRange(rng: () => number, min: number, max: number): number {
  return Math.round((min + rng() * (max - min)) * 10) / 10
}

/**
 * Returns the deterministic decoration set for a card.
 * @param cardId Stable bookmark id (CardNode data-card-id / it.bookmarkId).
 */
export function getCardDecorations(cardId: string): CardDecorationSet {
  const rng = mulberry32(hashStringToSeed(cardId))

  // --- Photo corners: 0, 1 (single accent), or 2 (diagonal pair). ---
  const photoCorners: DecoCorner[] = []
  const cornerRoll = rng()
  if (cornerRoll < 0.45) {
    // diagonal pair — pick one diagonal, attach both ends
    if (rng() < 0.5) {
      photoCorners.push('tl', 'br')
    } else {
      photoCorners.push('tr', 'bl')
    }
  } else if (cornerRoll < 0.7) {
    photoCorners.push(pick(rng, ALL_CORNERS))
  }
  // else: none

  // --- Washi tape: 0..2 strips, each on a distinct edge. ---
  const washiCount = (() => {
    const r = rng()
    if (r < 0.4) return 0
    if (r < 0.85) return 1
    return 2
  })()
  const usedEdges = new Set<WashiEdge>()
  const washi: WashiPiece[] = []
  for (let i = 0; i < washiCount; i++) {
    // choose an unused edge (top/bottom favoured for the "taped to wall" look)
    let edge = pick(rng, EDGES)
    let guard = 0
    while (usedEdges.has(edge) && guard < 6) {
      edge = pick(rng, EDGES)
      guard++
    }
    if (usedEdges.has(edge)) continue
    usedEdges.add(edge)
    washi.push({
      tint: pick(rng, TINTS),
      edge,
      angleDeg: floatRange(rng, -14, 14),
      offsetPct: floatRange(rng, 8, 80),
      assetSeed: rng(), // appended last — does not shift prior rng() call positions
    })
  }

  // --- Fastener: pin XOR clip, biased toward "nothing" so it stays calm. ---
  const fastenerRoll = rng()
  const pinPresent = fastenerRoll < 0.18
  // variant rng() consumed after the presence check (appended at end of pin logic)
  const pin: { readonly variant: 'gold' | 'green' } | null = pinPresent
    ? { variant: rng() < 0.5 ? 'gold' : 'green' }
    : null
  const clip = !pinPresent && fastenerRoll < 0.3

  // --- Stamp: rare archival rubber stamp in a corner. ---
  let stamp: DecoStamp | null = null
  if (rng() < 0.28) {
    stamp = {
      label: pick(rng, STAMP_LABELS),
      corner: pick(rng, ALL_CORNERS),
      angleDeg: floatRange(rng, -18, 18),
      assetSeed: rng(), // appended last — does not shift prior rng() call positions
    }
  }

  return { photoCorners, washi, pin, clip, stamp }
}
