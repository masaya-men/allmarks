import { describe, it, expect } from 'vitest'
import { parseAddTagMessage } from '@/lib/utils/save-message'

describe('parseAddTagMessage', () => {
  it('accepts a well-formed add-tag message', () => {
    const r = parseAddTagMessage({
      type: 'booklage:add-tag',
      payload: { bookmarkId: 'b1', tagId: 't1', nonce: 'n1' },
    })
    expect(r.ok).toBe(true)
  })
  it('rejects a missing tagId', () => {
    const r = parseAddTagMessage({
      type: 'booklage:add-tag',
      payload: { bookmarkId: 'b1', nonce: 'n1' },
    })
    expect(r.ok).toBe(false)
  })
})
