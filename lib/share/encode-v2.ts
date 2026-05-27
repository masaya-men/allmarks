// lib/share/encode-v2.ts
import type { KVShareEntry } from './types-v2'

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  // Use Blob.stream() instead of `new ReadableStream(...)` so this works in
  // Cloudflare Workers without the `streams_enable_constructors` compatibility
  // flag (= on by default for compat_date >= 2022-11-30, but our Pages project
  // pins an older date via the dashboard).
  // Cast: TS5 widens Uint8Array's buffer to ArrayBufferLike (includes
  // SharedArrayBuffer) but Blob/Response APIs want a plain ArrayBuffer-backed
  // view. Our `bytes` always comes from a fresh Uint8Array, so the cast is safe.
  const inputStream = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream()
  const compressed = inputStream.pipeThrough(new CompressionStream('gzip'))
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
