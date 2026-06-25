import { describe, it, expect } from 'vitest'
import {
  PAPER_ASSET_BASE,
  PAPER_ASSETS,
  hasPaperAsset,
  paperAssetUrl,
  pickPaperAsset,
} from './paper-assets'

describe('paper-assets manifest', () => {
  it('resolves a placed asset to its public URL', () => {
    expect(hasPaperAsset('card-mat-1')).toBe(true)
    expect(paperAssetUrl('card-mat-1')).toBe(`${PAPER_ASSET_BASE}/card-mat-1.png`)
  })

  it('returns null url for an un-placed asset (parchment-bg pending)', () => {
    expect(hasPaperAsset('parchment-bg')).toBe(false)
    expect(paperAssetUrl('parchment-bg')).toBeNull()
  })

  it('pickPaperAsset is deterministic for a given fraction and skips un-placed ids', () => {
    const ids = ['card-mat-1', 'card-mat-2', 'card-mat-3'] as const
    const a = pickPaperAsset(0.1, ids)
    const b = pickPaperAsset(0.1, ids)
    expect(a).toBe(b)
    expect(ids).toContain(a)
  })

  it('pickPaperAsset returns null when no candidate is placed', () => {
    // parchment-bg is the only un-placed id; a list of only it must yield null
    expect(pickPaperAsset(0.5, ['parchment-bg'])).toBeNull()
  })
})
