import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  getPrivateVaultSession,
  setPrivateVaultSession,
  usePrivateVaultSession,
  type PrivateVaultSession,
} from './vault-session'

const fakeKey = {} as CryptoKey

afterEach(() => {
  setPrivateVaultSession(null)
})

describe('private/vault-session', () => {
  it('defaults to null (locked)', () => {
    expect(getPrivateVaultSession()).toBeNull()
  })

  it('set then get round-trips the session', () => {
    const session: PrivateVaultSession = { tagId: 'tag-1', key: fakeKey }
    setPrivateVaultSession(session)
    expect(getPrivateVaultSession()).toEqual(session)
  })

  it('usePrivateVaultSession reflects the module singleton and re-renders on change', () => {
    const { result } = renderHook(() => usePrivateVaultSession())
    expect(result.current).toBeNull()
    act(() => {
      setPrivateVaultSession({ tagId: 'tag-2', key: fakeKey })
    })
    expect(result.current).toEqual({ tagId: 'tag-2', key: fakeKey })
  })

  it('two independent hook instances (simulating two mounted pages) both see the same session', () => {
    const a = renderHook(() => usePrivateVaultSession())
    const b = renderHook(() => usePrivateVaultSession())
    act(() => {
      setPrivateVaultSession({ tagId: 'tag-3', key: fakeKey })
    })
    expect(a.result.current).toEqual({ tagId: 'tag-3', key: fakeKey })
    expect(b.result.current).toEqual({ tagId: 'tag-3', key: fakeKey })
  })
})
