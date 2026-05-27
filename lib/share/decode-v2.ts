// lib/share/decode-v2.ts
import type { KVShareEntry } from './types-v2'

async function ungzip(bytes: Uint8Array): Promise<Uint8Array> {
  const rs = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes.buffer.slice(0)))
      controller.close()
    },
  })
  const decompressed = rs.pipeThrough(new DecompressionStream('gzip') as TransformStream<Uint8Array, Uint8Array>)
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
