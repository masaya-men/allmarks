import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { TweetVideoEmbed, type TweetVideoSource } from './TweetVideoEmbed'

// Session 63 stale-media bug regression guard.
//
// In the Lightbox the same TweetVideoEmbed instance is reused across left/right
// card nav (its React key is the slot index, which stays `slot-0`), and the
// parent feeds it a new card's `source` via props. The player MUST reflect the
// current `source` prop on the rendered <video src>. The original bug: source
// was snapshotted into useState at mount and never reconciled with later prop
// changes, so the left media kept showing the PREVIOUS card's video while the
// right text panel had already updated.
describe('TweetVideoEmbed — source prop is live (session 63 stale-media)', () => {
  const srcA: TweetVideoSource = { videoUrl: 'https://video.example/AAA.mp4', posterUrl: undefined, aspect: 16 / 9 }
  const srcB: TweetVideoSource = { videoUrl: 'https://video.example/BBB.mp4', posterUrl: undefined, aspect: 16 / 9 }

  it('updates the <video src> when the source prop changes on the same instance', () => {
    const { container, rerender } = render(
      <TweetVideoEmbed
        item={{ url: 'https://x.com/u/status/1', title: 'card A' }}
        source={srcA}
        variant="lightbox"
      />,
    )
    const videoA = container.querySelector('video')
    expect(videoA).not.toBeNull()
    expect(videoA!.getAttribute('src')).toContain(encodeURIComponent(srcA.videoUrl))

    // Same component instance (no key change) — simulates Lightbox card nav.
    rerender(
      <TweetVideoEmbed
        item={{ url: 'https://x.com/u/status/2', title: 'card B' }}
        source={srcB}
        variant="lightbox"
      />,
    )
    const videoB = container.querySelector('video')
    expect(videoB).not.toBeNull()
    // Bug repro: this stayed AAA.mp4 before the fix.
    expect(videoB!.getAttribute('src')).toContain(encodeURIComponent(srcB.videoUrl))
    expect(videoB!.getAttribute('src')).not.toContain(encodeURIComponent(srcA.videoUrl))
  })
})
