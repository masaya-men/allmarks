// functions/claim.test.ts
import { describe, it, expect } from 'vitest'
import { onRequestGet } from './claim'

function makeCtx(url: string) {
  return { request: new Request(url) }
}

describe('GET /claim', () => {
  it('redirects to /gift preserving the c value', async () => {
    const res = await onRequestGet(makeCtx('https://allmarks.app/claim?c=secret1') as never)
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('https://allmarks.app/gift?c=secret1')
  })

  it('URL-encodes special characters in c', async () => {
    const res = await onRequestGet(makeCtx('https://allmarks.app/claim?c=a+b%26c') as never)
    expect(res.status).toBe(302)
    const location = new URL(res.headers.get('Location')!)
    expect(location.pathname).toBe('/gift')
    expect(location.searchParams.get('c')).toBe('a b&c')
  })

  it('redirects to /gift with no c param when c is missing', async () => {
    const res = await onRequestGet(makeCtx('https://allmarks.app/claim') as never)
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('https://allmarks.app/gift')
  })

  it('drops an over-length c rather than forwarding it', async () => {
    const res = await onRequestGet(makeCtx(`https://allmarks.app/claim?c=${'a'.repeat(129)}`) as never)
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('https://allmarks.app/gift')
  })

  it('never issues a key (no KV access, never mints)', async () => {
    // No env/KV is even passed to the handler — a type-level guarantee that
    // this route cannot mint or write anything. This test documents that
    // guarantee so a future refactor that adds env access back gets caught.
    const res = await onRequestGet(makeCtx('https://allmarks.app/claim?c=secret1') as never)
    const body = await res.text()
    expect(body).toBe('')
  })

  it('does not set Cache-Control to something cacheable', async () => {
    const res = await onRequestGet(makeCtx('https://allmarks.app/claim?c=secret1') as never)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })
})
