import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SoundWaveWorking } from '@/components/board/SoundWaveWorking'

describe('SoundWaveWorking', () => {
  it('renders the sound-wave bars for the default theme', () => {
    const { getByTestId } = render(<SoundWaveWorking themeId="dotted-notebook" />)
    const svg = getByTestId('sound-wave-working')
    expect(svg.querySelectorAll('rect').length).toBe(7)
  })
})
