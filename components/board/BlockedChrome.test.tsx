import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { BlockedChrome } from './BlockedChrome'

describe('BlockedChrome', () => {
  it('wraps children and marks them blocked', () => {
    const { getByTestId } = render(
      <BlockedChrome label="FILTER"><button>FILTER</button></BlockedChrome>,
    )
    const wrap = getByTestId('blocked-chrome')
    expect(wrap.getAttribute('aria-disabled')).toBe('true')
  })
})
