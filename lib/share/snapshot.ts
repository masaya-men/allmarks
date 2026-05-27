// lib/share/snapshot.ts
// SHARE 時の thumbnail 生成。 board をスクロールして user が見ている範囲を、
// 軽量な canvas 描画でブロック模様化する。
//
// 旧実装は dom-to-image-more を使って実 DOM を完全クローンしていたが、
// 300 カードのボードで tab メモリが 5GB に達して落ちる問題があった。
// 新実装は外部画像を一切 fetch せず、 画面に映っているカードの位置・サイズ・
// 背景色だけを描き写す。 結果はカード配置の wireframe + AllMarks ブランド帯。
//
// 副作用ゼロ (= 実 DOM は touch しない)、 メモリ bounded (= 1 canvas のみ)、
// 速度 < 50ms。 ユーザーが SHARE 押した瞬間の viewport が thumb になる。

export type SnapshotOptions = {
  readonly width: number   // target output width (px)
  readonly quality: number // 0.0-1.0
}

const DEFAULT_OPTS: SnapshotOptions = { width: 600, quality: 0.85 }

const BRAND_GREEN = '#28F100'
const BRAND_TEXT = 'rgba(255,255,255,0.88)'

/**
 * 引数 element の viewport-visible rect を canvas にブロック模様で描画し、
 * WebP data URL として返す。 失敗時は null。
 */
export async function captureViewportWebP(
  element: HTMLElement | null,
  options: Partial<SnapshotOptions> = {},
): Promise<string | null> {
  if (!element) return null
  const opts = { ...DEFAULT_OPTS, ...options }

  try {
    const elRect = element.getBoundingClientRect()
    if (elRect.width <= 0 || elRect.height <= 0) return null

    const cw = opts.width
    const ch = Math.max(1, Math.round((elRect.height / elRect.width) * cw))
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // 1) board の素地: 真っ黒 + 上下グラデで微かな深みを出す
    const grad = ctx.createLinearGradient(0, 0, 0, ch)
    grad.addColorStop(0, '#0a0a0c')
    grad.addColorStop(1, '#000000')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, cw, ch)

    // 2) viewport 内のカードを位置 + 背景色のブロックとして描く
    const vw = window.innerWidth
    const vh = window.innerHeight
    const scaleX = cw / elRect.width
    const scaleY = ch / elRect.height

    const cards = Array.from(element.querySelectorAll<HTMLElement>('[data-card-id]'))
    let visibleCount = 0
    for (const card of cards) {
      const r = card.getBoundingClientRect()
      if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue
      visibleCount++

      const x = Math.round((r.left - elRect.left) * scaleX)
      const y = Math.round((r.top - elRect.top) * scaleY)
      const w = Math.max(1, Math.round(r.width * scaleX))
      const h = Math.max(1, Math.round(r.height * scaleY))

      const cs = getComputedStyle(card)
      let bg = cs.backgroundColor
      if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') {
        bg = 'rgba(38,38,42,0.92)'
      }
      ctx.fillStyle = bg
      ctx.fillRect(x, y, w, h)

      // 緑のアウトラインで AllMarks らしさをほのかに
      ctx.strokeStyle = 'rgba(40,241,0,0.16)'
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
    }

    // 3) ブランド帯 (= 緑 dot + ALLMARKS + N CARDS)
    const padding = 18
    const fontSize = Math.max(11, Math.min(15, Math.round(ch * 0.04)))
    const dotY = ch - padding
    ctx.fillStyle = BRAND_GREEN
    ctx.beginPath()
    ctx.arc(padding + 4, dotY, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = BRAND_TEXT
    ctx.font = `600 ${fontSize}px "Geist Mono", ui-monospace, SFMono-Regular, monospace`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.fillText('ALLMARKS', padding + 16, dotY)
    if (visibleCount > 0) {
      ctx.textAlign = 'right'
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.fillText(`${visibleCount} CARDS`, cw - padding, dotY)
    }

    return canvas.toDataURL('image/webp', opts.quality)
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('[share/snapshot] capture failed', e)
    return null
  }
}
