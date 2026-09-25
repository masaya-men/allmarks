// lib/sync/gzip-codec.ts
// 同期ファイル（形式 v2）の gzip 圧縮/展開。ブラウザ標準の CompressionStream /
// DecompressionStream を使う（Chrome 80+ / Safari 16.4+ / Firefox 113+、Node 18+ も
// globalThis に持つ）。無い環境では getGzipCodec() が null を返し、engine.ts は
// 同じファイル名から `.gz` を外した素の JSON で読み書きする（設計 §Drive layout）。
//
// テスト環境（jsdom / node）でも差し替えられるよう、setGzipCodecForTesting で
// 任意の実装（または null =「圧縮できない端末」）を注入できる。

export interface GzipCodec {
  /** UTF-8 テキスト → gzip バイト列。 */
  compress(text: string): Promise<Uint8Array>
  /** gzip バイト列 → UTF-8 テキスト。壊れたデータなら reject。 */
  decompress(bytes: Uint8Array): Promise<string>
}

interface ByteTransform {
  readonly readable: ReadableStream<Uint8Array>
  readonly writable: WritableStream<Uint8Array>
}

type TransformCtor = new (format: 'gzip') => ByteTransform

function concatChunks(chunks: readonly Uint8Array[]): Uint8Array {
  let total = 0
  for (const c of chunks) total += c.byteLength
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.byteLength
  }
  return out
}

/** 1 つの TransformStream に input を流し込み、出力を全部つなげて返す。書き込みと
 *  読み出しを並行させる（逐次だとバックプレッシャーで止まる）。 */
async function runTransform(transform: ByteTransform, input: Uint8Array): Promise<Uint8Array> {
  const writer = transform.writable.getWriter()
  const writing = (async (): Promise<void> => {
    await writer.write(input)
    await writer.close()
  })()
  // 読み出し側が先に失敗した場合でも unhandled rejection にしない（下で await し直す）。
  writing.catch(() => undefined)
  const reader = transform.readable.getReader()
  const chunks: Uint8Array[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  await writing
  return concatChunks(chunks)
}

/** ブラウザ標準ストリームによる実装。どちらかのコンストラクタが無ければ null。 */
export function createStreamGzipCodec(): GzipCodec | null {
  const g = globalThis as { CompressionStream?: unknown; DecompressionStream?: unknown }
  if (typeof g.CompressionStream !== 'function' || typeof g.DecompressionStream !== 'function') return null
  const Compress = g.CompressionStream as TransformCtor
  const Decompress = g.DecompressionStream as TransformCtor
  return {
    async compress(text: string): Promise<Uint8Array> {
      return runTransform(new Compress('gzip'), new TextEncoder().encode(text))
    },
    async decompress(bytes: Uint8Array): Promise<string> {
      const out = await runTransform(new Decompress('gzip'), bytes)
      return new TextDecoder().decode(out)
    },
  }
}

/** undefined = 注入なし（既定の自動判定を使う）。null = 「圧縮不可の端末」を明示。 */
let codecOverride: GzipCodec | null | undefined

/** テスト専用: codec を差し替える。undefined を渡すと既定（自動判定）に戻る。 */
export function setGzipCodecForTesting(codec: GzipCodec | null | undefined): void {
  codecOverride = codec
}

/** 今の環境で使える gzip codec。無ければ null（素の JSON で読み書きする）。 */
export function getGzipCodec(): GzipCodec | null {
  if (codecOverride !== undefined) return codecOverride
  return createStreamGzipCodec()
}

/** 先頭 2 バイトが gzip のマジックナンバー（1f 8b）か。Drive が万一透過展開して
 *  素のテキストを返してきた場合にも読めるよう、展開前にこれで判定する。 */
export function looksGzipped(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b
}
