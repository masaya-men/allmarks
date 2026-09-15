// K3のEd25519鍵ペアを生成する一回限りのCLIスクリプト（鍵ローテーション時も使う）。
// 実行: node scripts/generate-k3-keypair.mjs
//
// 出力される2つの値の扱い:
//   K3_PUBLIC_KEY  → 秘密ではない。.env.production の NEXT_PUBLIC_K3_PUBLIC_KEY= に貼る。
//   K3_PRIVATE_KEY → 絶対にcommitしない。`wrangler pages secret put K3_PRIVATE_KEY`
//                    を実行してその場で貼る（chatにも貼らない）。
//
// base64urlエンコードは lib/board/license-types.ts の bytesToBase64Url と
// 同じ変換（依存を避けるためここでは Buffer で再実装）。
function bytesToBase64Url(bytes) {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
const rawPublic = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey))
const pkcs8Private = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey))

console.log('K3_PUBLIC_KEY (not secret — paste into .env.production NEXT_PUBLIC_K3_PUBLIC_KEY=):')
console.log(bytesToBase64Url(rawPublic))
console.log('')
console.log('K3_PRIVATE_KEY (SECRET — do not commit, do not paste in chat):')
console.log('  wrangler pages secret put K3_PRIVATE_KEY --project-name=allmarks')
console.log('  (paste the value below when prompted)')
console.log(bytesToBase64Url(pkcs8Private))
