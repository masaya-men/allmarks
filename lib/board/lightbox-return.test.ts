import { describe, it, expect } from 'vitest'
import { computeNavReturnScrollY } from './lightbox-return'

const base = { topPad: 80, viewportH: 800, contentH: 10000 }

describe('computeNavReturnScrollY', () => {
  it('fully-visible card → null (board stays still)', () => {
    // card canvas top = 100+80 = 180, bottom = 380; viewport 100..900 → inside
    expect(computeNavReturnScrollY({ ...base, cardY: 100, cardH: 200, viewportY: 100 })).toBeNull()
  })

  it('card below the viewport → centres it', () => {
    // card canvas top = 5000+80 = 5080, h 200 → centre = 5080+100-400 = 4780
    const y = computeNavReturnScrollY({ ...base, cardY: 5000, cardH: 200, viewportY: 100 })
    expect(y).toBe(4780)
  })

  it('card above the viewport → centres it', () => {
    // card top = 200+80 = 280; viewport at 4000 → card is above → centre 280+100-400 = -20 → clamp 0
    const y = computeNavReturnScrollY({ ...base, cardY: 200, cardH: 200, viewportY: 4000 })
    expect(y).toBe(0)
  })

  it('partially visible (bottom cut off) → scrolls to centre', () => {
    // card canvas 780..1180; viewport 100..900 → bottom 1180 > 900 → not fully visible
    const y = computeNavReturnScrollY({ ...base, cardY: 700, cardH: 400, viewportY: 100 })
    // centre = 780 + 200 - 400 = 580
    expect(y).toBe(580)
  })

  it('clamps to the bottom of content', () => {
    // near-bottom card; contentH small so max scroll = contentH - viewportH
    const y = computeNavReturnScrollY({ ...base, contentH: 2000, cardY: 5000, cardH: 200, viewportY: 0 })
    expect(y).toBe(2000 - 800) // 1200
  })

  it('card taller than viewport is never "fully visible" → returns a centre', () => {
    const y = computeNavReturnScrollY({ ...base, cardY: 0, cardH: 2000, viewportY: 3000 })
    // top=80, centre = 80 + 1000 - 400 = 680
    expect(y).toBe(680)
  })

  it('returns null when the centred target equals the current viewport (no redundant move)', () => {
    // Construct a case where computeFocusScrollY returns exactly viewportY.
    // card canvas top=80, h=800 → centre = 80+400-400 = 80. viewportY 80 →
    // but card (80..880) vs viewport (80..880) is fully visible → null anyway.
    expect(computeNavReturnScrollY({ ...base, cardY: 0, cardH: 800, viewportY: 80 })).toBeNull()
  })
})
