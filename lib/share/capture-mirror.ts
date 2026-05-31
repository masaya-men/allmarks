// ミラー DOM を Canvas API で WebP 画像化する。 ライブラリ依存なし。
//
// 設計: lib/share/snapshot.ts (session 85 の placeholder) の置換。 dom-to-image-more の
// メモリ爆発 + iframe 自動再生問題を回避するため、 DOM walk せず直接 canvas に
// drawImage する方式。 入力は ShareMirror の DOM frame + items リスト。
//
// jsdom 環境では canvas API が未対応のため、 null を返して safely fail する。
// 実環境 (= ブラウザ) の動作は playwright で検証 (= Task 7)。

export type MirrorCaptureItem = {
  readonly url: string
  readonly title: string
  readonly thumbnailUrl: string | null
}

export type MirrorCaptureInput = {
  /** ShareMirror のルート DOM (= 1.91:1 frame)。 null なら null を返す。 */
  readonly mirrorFrame: HTMLElement | null
  /** ミラーに表示されているアイテム一覧。 data-mirror-card-id との照合に使う。 */
  readonly items: ReadonlyArray<MirrorCaptureItem>
  /** 共有カード数 (= "N OF M CARDS" の N 側)。 */
  readonly sharedCardCount: number
  /** アクティブな tag 名 (= ブランド帯上部表示用、 空配列なら非表示)。 */
  readonly activeTagNames: ReadonlyArray<string>
  /** "N OF M CARDS" の M 側 (= ボード全体のカード数)。 */
  readonly totalBoardCount: number
  /** 背景タイポ文字列 (= 大きな wordmark)。 空 / 未指定なら描かない (= board の
   *  TITLE トグル off に追従)。 */
  readonly bgTypoText?: string
  /** Output width in px (typical 1200). */
  readonly width: number
  /** Output height in px (typical 628 = 1.91:1)。 */
  readonly height: number
  /** WebP quality 0.0-1.0。 */
  readonly quality: number
}

const BG_COLOR = '#0a0a0c'
const BRAND_GREEN = '#28F100'
const TEXT_MAIN = 'rgba(255, 255, 255, 0.92)'
const TEXT_SOFT = 'rgba(255, 255, 255, 0.42)'

export async function captureMirrorToWebP(input: MirrorCaptureInput): Promise<string | null> {
  if (!input.mirrorFrame) return null

  try {
    const canvas = document.createElement('canvas')
    canvas.width = input.width
    canvas.height = input.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // 背景塗り (= board の地色と揃える)
    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, input.width, input.height)

    // 背景タイポ (= 大きな wordmark)。 カードより先に描いて下に敷く。
    if (input.bgTypoText) drawBgTypo(ctx, input)

    // ミラー DOM から card 要素を取得 + 各カードを描画
    await drawCards(ctx, input)

    // ブランド帯
    drawBrandStrip(ctx, input)

    // toBlob 経由で WebP base64 を返す
    const dataUrl: string | null = await canvasToWebP(canvas, input.quality)
    return dataUrl
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('[share/capture-mirror] capture failed', e)
    return null
  }
}

/** 背景タイポを描画する。 プレビュー (ShareMirror) の span 矩形をそのまま読んで
 *  canvas 座標に写すので、 OG 画像は preview と同じ位置・サイズになる (WYSIWYG)。
 *  カードより先に呼ぶことで board と同じく「文字の上にカードが乗る」 重なりを再現。 */
function drawBgTypo(ctx: CanvasRenderingContext2D, input: MirrorCaptureInput): void {
  const text = input.bgTypoText
  if (!text) return
  const frame = input.mirrorFrame
  if (!frame) return
  const frameRect = frame.getBoundingClientRect()
  if (frameRect.width === 0 || frameRect.height === 0) return
  const span = frame.querySelector<HTMLElement>('[data-testid="mirror-bg-typo"] span')
  if (!span) return

  const scaleX = input.width / frameRect.width
  const scaleY = input.height / frameRect.height
  const rect = span.getBoundingClientRect()
  const cx = ((rect.left + rect.right) / 2 - frameRect.left) * scaleX
  const cy = ((rect.top + rect.bottom) / 2 - frameRect.top) * scaleY

  const cssFontPx = parseFloat(getComputedStyle(span).fontSize) || 0
  let fontPx = Math.max(10, cssFontPx * scaleY)

  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 ${fontPx}px "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

  // 横幅に収まるよう必要なら縮める (= board は wrap するが OG は 1 行で fit)。
  const maxW = input.width * 0.92
  while (fontPx > 12 && ctx.measureText(text).width > maxW) {
    fontPx -= 2
    ctx.font = `600 ${fontPx}px "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  }
  ctx.fillText(text, cx, cy)
}

async function drawCards(ctx: CanvasRenderingContext2D, input: MirrorCaptureInput): Promise<void> {
  const frame = input.mirrorFrame
  if (!frame) return
  const frameRect = frame.getBoundingClientRect()
  if (frameRect.width === 0 || frameRect.height === 0) return

  const scaleX = input.width / frameRect.width
  const scaleY = input.height / frameRect.height

  const cardEls = Array.from(frame.querySelectorAll<HTMLElement>('[data-mirror-card-id]'))
  for (const el of cardEls) {
    const rect = el.getBoundingClientRect()
    const cx = (rect.left - frameRect.left) * scaleX
    const cy = (rect.top - frameRect.top) * scaleY
    const cw = rect.width * scaleX
    const ch = rect.height * scaleY

    // OG frame からはみ出ているカードはスキップ
    if (cx + cw < 0 || cy + ch < 0 || cx > input.width || cy > input.height) continue

    const cardId = el.dataset.mirrorCardId ?? ''
    const item = input.items.find((it) => it.url === cardId)
    if (!item) continue

    // カードの角丸 (= プレビュー .card の border-radius を OG スケールへ写す、 WYSIWYG)。
    // getComputedStyle は transform 前の論理 px (= 20px) を返すので、 そのまま scaleX
    // するとプレビューの縮小 (outerBand の scale) 分を取りこぼす。 カード幅に対する
    // 比率に直してから OG 上のカード幅 (cw) に掛けることで、 縮小率に左右されず
    // プレビューと同じ丸みになる。
    const cssRadius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0
    const ownW = el.offsetWidth || 0
    const radius = ownW > 0 ? (cssRadius / ownW) * cw : 0

    // サムネ画像を先に読み込む (= クリップ中に同期描画したいので await を前出し)
    let img: HTMLImageElement | null = null
    if (item.thumbnailUrl) {
      try {
        img = await loadCrossOriginImage(item.thumbnailUrl)
      } catch {
        img = null
      }
    }
    const hasImage = img !== null

    // 角丸でクリップしてから背景塗り + サムネ描画 (= 角が四角く残らない)
    ctx.save()
    roundRectPath(ctx, cx, cy, cw, ch, radius)
    ctx.clip()
    // 背景塗り (= 失敗時の fallback ベース、 cross-origin OK なら drawImage で上書き)
    ctx.fillStyle = '#1a1a1c'
    ctx.fillRect(cx, cy, cw, ch)
    if (img) ctx.drawImage(img, cx, cy, cw, ch)
    ctx.restore()

    // タイトル text: サムネあり → 小さく下端に、 サムネなし → 大きくカード全体に
    ctx.fillStyle = TEXT_MAIN
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    if (hasImage) {
      // 画像あり: 小さいタイトルを下端に
      const titleSize = Math.max(9, Math.round(ch * 0.09))
      ctx.font = `500 ${titleSize}px "Geist Mono", ui-monospace, monospace`
      drawClippedText(ctx, item.title, cx + 6, cy + ch - titleSize - 6, cw - 12)
    } else {
      // 画像なし: 大きいタイトルをカード全体に
      const titleSize = Math.max(10, Math.round(ch * 0.12))
      ctx.font = `500 ${titleSize}px "Geist Mono", ui-monospace, monospace`
      const lineHeight = titleSize * 1.3
      const maxLines = Math.floor((ch - 16) / lineHeight)
      drawWrappedText(ctx, item.title, cx + 8, cy + 8, cw - 16, lineHeight, Math.max(1, maxLines))
    }
  }
}

function drawBrandStrip(ctx: CanvasRenderingContext2D, input: MirrorCaptureInput): void {
  const W = input.width
  const H = input.height
  const padding = 18

  // 上部 tag 帯 (= activeTagNames が空でなければ "music · design")。 タグ名は常に
  // 小文字で描画する (= ユーザーが付けた中身。 canvas なので CSS は効かず JS で小文字化)。
  if (input.activeTagNames.length > 0) {
    const text = input.activeTagNames.map((s): string => s.toLowerCase()).join(' · ')
    ctx.fillStyle = TEXT_SOFT
    ctx.font = '500 13px "Geist Mono", ui-monospace, monospace'
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    drawClippedText(ctx, text, padding, padding, W - padding * 2)
  }

  // 左下 ALLMARKS wordmark (= 右下 caption と同 font / size / weight、
  // 2 つで 1 つの chrome バンドに読める)
  ctx.fillStyle = TEXT_MAIN
  ctx.font = '500 13px "Geist Mono", ui-monospace, monospace'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText('ALLMARKS', padding, H - padding - 16)

  // 右下 「N CARDS · NEWEST FIRST」 or「N OF M CARDS · NEWEST FIRST」
  const N = input.sharedCardCount
  const M = input.totalBoardCount
  const captionText = M > N
    ? `${N} OF ${M} CARDS · NEWEST FIRST`
    : `${N} CARDS`
  ctx.fillStyle = TEXT_MAIN
  ctx.font = '500 13px "Geist Mono", ui-monospace, monospace'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'right'
  ctx.fillText(captionText, W - padding, H - padding - 16)

  // 右下緑 dot
  ctx.fillStyle = BRAND_GREEN
  ctx.beginPath()
  ctx.arc(W - padding - ctx.measureText(captionText).width - 12, H - padding - 16, 3, 0, Math.PI * 2)
  ctx.fill()
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): void {
  const words = text.split(/\s+/)
  let line = ''
  let currentY = y
  let lineCount = 0

  for (let i = 0; i < words.length; i++) {
    const testLine = line === '' ? words[i] : `${line} ${words[i]}`
    if (ctx.measureText(testLine).width > maxWidth && line !== '') {
      ctx.fillText(line, x, currentY)
      lineCount++
      if (lineCount >= maxLines) return
      line = words[i] ?? ''
      currentY += lineHeight
    } else {
      line = testLine
    }
  }
  if (line !== '' && lineCount < maxLines) {
    ctx.fillText(line, x, currentY)
  }
}

function drawClippedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
): void {
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y)
    return
  }
  // 末尾 ... で切り詰め
  let clipped = text
  while (clipped.length > 1 && ctx.measureText(clipped + '…').width > maxWidth) {
    clipped = clipped.slice(0, -1)
  }
  ctx.fillText(clipped + '…', x, y)
}

/** 角丸の矩形パスを現在の path に積む (= roundRect 非対応環境でも動くよう arcTo で構築)。
 *  半径は幅 / 高さの半分でクランプして潰れを防ぐ。 */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function loadCrossOriginImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve): void => {
    if (typeof Image === 'undefined') { resolve(null); return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = (): void => resolve(img)
    img.onerror = (): void => resolve(null)
    img.src = url
  })
}

function canvasToWebP(canvas: HTMLCanvasElement, quality: number): Promise<string | null> {
  return new Promise((resolve): void => {
    if (typeof canvas.toBlob !== 'function') { resolve(null); return }
    canvas.toBlob(
      (blob): void => {
        if (!blob) { resolve(null); return }
        const reader = new FileReader()
        reader.onload = (): void => resolve(typeof reader.result === 'string' ? reader.result : null)
        reader.onerror = (): void => resolve(null)
        reader.readAsDataURL(blob)
      },
      'image/webp',
      quality,
    )
  })
}

