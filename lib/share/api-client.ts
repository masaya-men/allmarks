// lib/share/api-client.ts
import type { CreateShareResponse, GetShareResponse, KVShareEntry, ShareErrorResponse } from './types-v2'

export type ApiResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: ShareErrorResponse['error']; readonly message: string }

export async function createShare(entry: KVShareEntry): Promise<ApiResult<CreateShareResponse>> {
  try {
    const res = await fetch('/api/share/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    })
    if (!res.ok) {
      const err = await res.json() as ShareErrorResponse
      return { ok: false, error: err.error ?? 'server', message: err.message ?? `HTTP ${res.status}` }
    }
    const data = await res.json() as CreateShareResponse
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: 'server', message: e instanceof Error ? e.message : 'network error' }
  }
}

export async function fetchShare(id: string): Promise<ApiResult<GetShareResponse>> {
  try {
    const res = await fetch(`/api/share/${encodeURIComponent(id)}`, { method: 'GET' })
    if (!res.ok) {
      const err = await res.json() as ShareErrorResponse
      return { ok: false, error: err.error ?? 'server', message: err.message ?? `HTTP ${res.status}` }
    }
    const data = await res.json() as GetShareResponse
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: 'server', message: e instanceof Error ? e.message : 'network error' }
  }
}
