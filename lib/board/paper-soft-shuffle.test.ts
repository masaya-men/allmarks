import { describe, it, expect } from 'vitest'
import { selectPaperSoftShuffle, PAPER_SHUFFLE_CADENCE_MS, DEFAULT_SHUFFLE_CADENCE_MS } from './paper-soft-shuffle'

describe('selectPaperSoftShuffle', () => {
  it('paper + ambient on → crossfade with the calmer paper cadence', () => {
    const r = selectPaperSoftShuffle({ softShuffle: true, ambientOn: true })
    expect(r.crossfade).toBe(true)
    expect(r.cadenceMs).toBe(PAPER_SHUFFLE_CADENCE_MS)
    expect(PAPER_SHUFFLE_CADENCE_MS).toBeGreaterThan(DEFAULT_SHUFFLE_CADENCE_MS) // calmer = slower
  })

  it('non-paper theme → hard cut, default cadence (default theme unchanged)', () => {
    const r = selectPaperSoftShuffle({ softShuffle: false, ambientOn: true })
    expect(r.crossfade).toBe(false)
    expect(r.cadenceMs).toBe(DEFAULT_SHUFFLE_CADENCE_MS)
  })

  it('ambient off (motion disabled / reduced / scrolling) → no crossfade even on paper', () => {
    const r = selectPaperSoftShuffle({ softShuffle: true, ambientOn: false })
    expect(r.crossfade).toBe(false)
    expect(r.cadenceMs).toBe(DEFAULT_SHUFFLE_CADENCE_MS) // falls back to the default cadence too
  })
})
