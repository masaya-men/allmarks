// lib/share/encode-v2.ts
import type { KVShareEntry } from './types-v2'

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const rs = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes.buffer.slice(0)))
      controller.close()
    },
  })
  const compressed = rs.pipeThrough(new CompressionStream('gzip') as TransformStream<Uint8Array, Uint8Array>)
  const buf = await new Response(compressed).arrayBuffer()
  return new Uint8Array(buf)
}

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

/** Serialize KV entry to a single base64 string for Cloudflare KV `put`. */
export async function encodeKVPayload(entry: KVShareEntry): Promise<string> {
  const json = JSON.stringify(entry)
  const utf8 = new TextEncoder().encode(json)
  const compressed = await gzip(utf8)
  return toBase64(compressed)
}
