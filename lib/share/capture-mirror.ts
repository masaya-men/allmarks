// ミラー DOM を Canvas API で WebP 画像化する。 ライブラリ依存なし。
//
// 設計: lib/share/snapshot.ts (session 85 の placeholder) の置換。 dom-to-image-more の
// メモリ爆発 + iframe 自動再生問題を回避するため、 DOM walk せず直接 canvas に
// drawImage する方式。 入力は ShareMirror の DOM frame + items リスト。
//
// jsdom 環境では canvas API が未対応のため、 null を返して safely fail する。
// 実環境 (= ブラウザ) の動作は playwright で検証 (= Task 7)。

import { pickPlaceholderImage } from '@/lib/board/placeholder-image'

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
  /** 目標ファイルサイズ (bytes)。 この内に収まるよう JPEG 品質を自動調整する。
   *  OGP 推奨は ~150KB / 上限 300KB (= SNS は縮小表示なので高画質不要)。 */
  readonly targetBytes: number
  /** 自動調整で許す最低品質 (0.0-1.0)。 これより下げてもサイズ超過なら、 最低品質で諦めて返す。 */
  readonly minQuality: number
  /** 自動調整の開始品質 (0.0-1.0)。 通常 0.82 程度。 */
  readonly startQuality: number
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

    // JPEG で出力 (= 全 SNS で OGP プレビューが出る最大互換、 WebP は Discord/Slack 非対応)。
    // 目標バイト数に収まるよう品質を段階的に落とす (= SNS は縮小表示なので高画質不要、
    // 軽いほどクローラ取得成功率も上がる)。
    const dataUrl: string | null = await canvasToJpegUnderTarget(
      canvas,
      input.targetBytes,
      input.startQuality,
      input.minQuality,
    )
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

  // Size from the span's PAINTED height (getBoundingClientRect already includes
  // the .outerBand transform: scale), mapped into OG space. Using
  // getComputedStyle().fontSize here was the bug: it returns the PRE-transform
  // px (e.g. 260), ignoring the outerBand down-scale, so the wordmark rendered
  // ~2× larger than the preview — the "preview ≠ share height" the user saw.
  // line-height is 1.0, so the single-line box height ≈ the rendered font size;
  // the maxW shrink below keeps multi-line/long text within frame.
  let fontPx = Math.max(10, rect.height * scaleY)

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

  // Clip every card to the VISIBLE inner board area (= ShareMirror の
  // .canvasReplica, overflow:hidden)。 これが無いと、 プレビューが盤面の下端で
  // 隠している行のカードが、 frame の下の余白ゾーンにまで描かれて「OG だけ下に
  // 1 行多く写る」 ズレになる (= preview/board は canvasReplica で切るのに、 capture
  // は frame まで塗っていた)。 canvasReplica の矩形でクリップして preview と一致させる。
  const replicaRect = frame
    .querySelector<HTMLElement>('[data-testid="mirror-canvas-replica"]')
    ?.getBoundingClientRect()
  const hasReplicaClip = !!replicaRect && replicaRect.width > 0 && replicaRect.height > 0
  if (hasReplicaClip && replicaRect) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(
      (replicaRect.left - frameRect.left) * scaleX,
      (replicaRect.top - frameRect.top) * scaleY,
      replicaRect.width * scaleX,
      replicaRect.height * scaleY,
    )
    ctx.clip()
  }

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

    // サムネが無い / 失敗したカードは、 board と同じ生成アート背景を描く (WYSIWYG)。
    // frame[0] (= pickPlaceholderImage) を使うので board の resting frame・triage・
    // PiP と一致。 生成 SVG は自己完結 (外部 font / foreignObject なし) なので canvas
    // を taint せず、 後段の toBlob が SecurityError にならない。
    let artImg: HTMLImageElement | null = null
    if (!hasImage) {
      const artUrl = pickPlaceholderImage(item.url)?.url ?? null
      if (artUrl) {
        try {
          artImg = await loadCrossOriginImage(artUrl)
        } catch {
          artImg = null
        }
      }
    }

    // 角丸でクリップしてから背景塗り + サムネ描画 (= 角が四角く残らない)
    ctx.save()
    roundRectPath(ctx, cx, cy, cw, ch, radius)
    ctx.clip()
    // 背景塗り (= 失敗時の fallback ベース、 cross-origin OK なら drawImage で上書き)
    ctx.fillStyle = '#1a1a1c'
    ctx.fillRect(cx, cy, cw, ch)
    if (img) {
      ctx.drawImage(img, cx, cy, cw, ch)
    } else if (artImg) {
      ctx.drawImage(artImg, cx, cy, cw, ch)
      // board の PlaceholderCard と同じ scrim (0.22 / 0.48 / 0.22 の縦グラデ) を重ねて、
      // どのスタイルでも白タイトルが読めるよう可読性を board と揃える。
      const scrim = ctx.createLinearGradient(cx, cy, cx, cy + ch)
      scrim.addColorStop(0, 'rgba(0, 0, 0, 0.22)')
      scrim.addColorStop(0.5, 'rgba(0, 0, 0, 0.48)')
      scrim.addColorStop(1, 'rgba(0, 0, 0, 0.22)')
      ctx.fillStyle = scrim
      ctx.fillRect(cx, cy, cw, ch)
    }
    ctx.restore()

    // タイトル text: サムネあり → 小さく下端に、 サムネなし → 大きくカード全体に。
    // カード矩形でクリップしてから描く (= 折返しが不完全でも文字がカード外へ
    // はみ出さない安全網。 CJK のはみ出しバグ対策)。
    ctx.save()
    roundRectPath(ctx, cx, cy, cw, ch, radius)
    ctx.clip()
    ctx.fillStyle = TEXT_MAIN
    ctx.textBaseline = 'top'
    if (hasImage) {
      // 画像あり: 小さいタイトルを下端に (= board ImageCard と同じ左寄せ・等幅キャプション)
      ctx.textAlign = 'left'
      const titleSize = Math.max(9, Math.round(ch * 0.09))
      ctx.font = `500 ${titleSize}px "Geist Mono", ui-monospace, monospace`
      drawClippedText(ctx, item.title, cx + 6, cy + ch - titleSize - 6, cw - 12)
    } else {
      // 画像なし: board の PlaceholderCard と同じ「中央寄せ + サンセリフ(Geist)」で
      // カード全体に大きく描く。 board 側 (.titleInner) は text-align:center +
      // font-family:var(--font-sans)(= Geist)。 OG も同じにして「共有プレビュー =
      // 盤面」 の WYSIWYG を保つ (= 旧: 左上・等幅 "Geist Mono" でズレていた)。
      // 上端から流す点も board (titleScroll の上端 start) に合わせる。
      ctx.textAlign = 'center'
      const titleSize = Math.max(10, Math.round(ch * 0.12))
      ctx.font = `500 ${titleSize}px "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
      const lineHeight = titleSize * 1.3
      const topPad = Math.max(8, Math.round(ch * 0.08))
      const maxLines = Math.floor((ch - topPad * 2) / lineHeight)
      drawWrappedText(ctx, item.title, cx + cw / 2, cy + topPad, cw - 16, lineHeight, Math.max(1, maxLines))
    }
    ctx.restore()
  }

  if (hasReplicaClip) ctx.restore()
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

  // 右下 allmarks.app — 焼き込み URL (= 画像と一緒に旅をする辿れる導線)。
  // 右下は慣習的なウォーターマーク/署名の角。内部情報の「N OF M CARDS」
  // キャプションはユーザーに意味不明なので撤去。
  ctx.fillStyle = TEXT_MAIN
  ctx.font = '500 13px "Geist Mono", ui-monospace, monospace'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'right'
  ctx.fillText('allmarks.app', W - padding, H - padding - 16)
}

/**
 * Wrap `text` into at most `maxLines` lines that each fit `maxWidth`, using the
 * supplied `measure` (= ctx.measureText width). Breaks at spaces when possible
 * (Latin) and mid-string otherwise — crucial for CJK (Japanese/Chinese tweet
 * bodies have NO spaces, so the old whitespace-only split produced one giant
 * line that overflowed the card). The last line is ellipsized when text is cut.
 * Exported for unit testing (the canvas isn't available under jsdom).
 */
export function wrapTextToLines(
  measure: (s: string) => number,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  if (maxLines < 1 || maxWidth <= 0) return []
  const chars = Array.from(text.replace(/\s+/g, ' ').trim())
  const lines: string[] = []
  let line = ''
  let i = 0
  while (i < chars.length && lines.length < maxLines) {
    const ch = chars[i]
    const candidate = line + ch
    if (measure(candidate) <= maxWidth) {
      line = candidate
      i++
      continue
    }
    if (line.length === 0) {
      // A single character is wider than maxWidth — force it on its own line.
      lines.push(ch)
      i++
      continue
    }
    const sp = line.lastIndexOf(' ')
    if (sp > 0) {
      lines.push(line.slice(0, sp))
      line = line.slice(sp + 1) // carry the remainder; re-process ch (no i++)
    } else {
      lines.push(line)
      line = '' // char-break; re-process ch (no i++)
    }
  }
  if (line.length > 0 && lines.length < maxLines) {
    lines.push(line)
    line = ''
  }
  // Truncated if any text is left unrendered → ellipsize the last line.
  const truncated = line.length > 0 || i < chars.length
  if (truncated && lines.length > 0) {
    let last = lines[lines.length - 1]
    while (last.length > 0 && measure(last + '…') > maxWidth) last = last.slice(0, -1)
    lines[lines.length - 1] = last + '…'
  }
  return lines
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
  const lines = wrapTextToLines((s) => ctx.measureText(s).width, text, maxWidth, maxLines)
  let currentY = y
  for (const line of lines) {
    ctx.fillText(line, x, currentY)
    currentY += lineHeight
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

/** canvas を指定品質で JPEG dataURL 化する (1 回)。 toBlob 非対応環境では null。 */
function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<string | null> {
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
      'image/jpeg',
      quality,
    )
  })
}

/** dataURL (base64) の実バイト数を概算する (= base64 長 × 3/4、 prefix 除外)。 */
function dataUrlByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  // base64 4 文字 = 3 byte。 padding '=' は実バイトに含めない。
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.floor((b64.length * 3) / 4) - padding
}

/** 目標バイト数に収まる JPEG dataURL を返す。 startQuality から段階的に品質を
 *  落とし、 収まった時点で返す。 minQuality まで下げても超過する場合は minQuality
 *  の結果をそのまま返す (= 失敗させず、 多少大きくても共有を成立させる)。 */
async function canvasToJpegUnderTarget(
  canvas: HTMLCanvasElement,
  targetBytes: number,
  startQuality: number,
  minQuality: number,
): Promise<string | null> {
  const STEP = 0.1
  let quality = startQuality
  let last: string | null = null
  while (quality >= minQuality - 1e-9) {
    const dataUrl = await canvasToJpeg(canvas, quality)
    if (!dataUrl) return last // toBlob 非対応なら直前結果 (= 通常 null)
    last = dataUrl
    if (dataUrlByteLength(dataUrl) <= targetBytes) return dataUrl
    quality -= STEP
  }
  return last // minQuality でも超過 → 最小品質版を返す
}

