// lib/share/encode-v2.ts
import type { KVShareEntry } from './types-v2'

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  // Use `new Response(bytes).body` instead of `new ReadableStream(...)` to
  // avoid Cloudflare Workers' streams_enable_constructors compat flag. Response
  // constructor (and its body getter) work without that flag, and also work
  // in jsdom (Blob.stream() does not).
  const body = new Response(bytes as unknown as BodyInit).body
  if (!body) throw new Error('gzip: Response body unexpectedly empty')
  const compressed = body.pipeThrough(new CompressionStream('gzip'))
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
