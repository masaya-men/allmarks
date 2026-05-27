// lib/share/decode-v2.ts
import type { KVShareEntry } from './types-v2'

async function ungzip(bytes: Uint8Array): Promise<Uint8Array> {
  // Blob.stream() instead of `new ReadableStream(...)` so this works in
  // Cloudflare Workers without the `streams_enable_constructors` compatibility
  // flag (= on by default for compat_date >= 2022-11-30, but our Pages project
  // pins an older date via the dashboard). See lib/share/encode-v2.ts.
  const inputStream = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream()
  const decompressed = inputStream.pipeThrough(new DecompressionStream('gzip'))
  const buf = await new Response(decompressed).arrayBuffer()
  return new Uint8Array(buf)
}

function fromBase64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export type DecodeResult =
  | { readonly ok: true; readonly data: KVShareEntry }
  | { readonly ok: false; readonly error: string }

export async function decodeKVPayload(encoded: string): Promise<DecodeResult> {
  try {
    const compressed = fromBase64(encoded)
    const utf8 = await ungzip(compressed)
    const json = new TextDecoder().decode(utf8)
    const data = JSON.parse(json) as KVShareEntry
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'decode failed' }
  }
}
