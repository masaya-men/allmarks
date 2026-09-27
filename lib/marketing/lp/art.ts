import type { ArtKind, CardSpec } from './types'

/** 見本 ACCS(見本 530 行)。1=緑 / 2=橙 / 3=青。 */
export const ACCENTS: Record<1 | 2 | 3, string> = { 1: '#28F100', 2: '#FF5A1F', 3: '#2B4BFF' }

/** 見本 DEFC(見本 531 行)。art ごとの既定アクセント。 */
export const DEFAULT_ACCENT: Record<ArtKind, 1 | 2 | 3> = {
  halftone: 1,
  halftone3: 1,
  film: 2,
  grid: 1,
  bars: 1,
  ticker: 2,
  swiss: 2,
  dither: 2,
  rules: 2,
  truchet: 3,
  vinyl: 3,
  arches: 3,
  tag: 3,
}

function rgb(hex: string): readonly [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgba(hex: string, a: number): string {
  const c = rgb(hex)
  return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'
}

function cv(el: HTMLElement, w: number, h: number, cls?: string): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  if (cls) c.className = cls
  el.appendChild(c)
  return c
}

/* ── 動きは「その場だけ・見えている時だけ」(見本 540–541 行 steppers/step) ── */

export type StepRunner = { add(el: HTMLElement, fn: () => void, ms: number): void; tick(ts: number): void; clear(): void }

type Stepper = { el: HTMLElement; fn: () => void; ms: number; last: number }

export function createStepRunner(): StepRunner {
  let steppers: Stepper[] = []
  return {
    add(el, fn, ms) {
      steppers.push({ el, fn, ms, last: 0 })
    },
    tick(ts) {
      for (const s of steppers) {
        if (ts - s.last > s.ms) {
          s.last = ts
          s.fn()
        }
      }
    },
    clear() {
      steppers = []
    },
  }
}

/** drawHT の1コマ: 光の向き(正規化前ベクトル)と、軌道上の光点の角度(ラジアン)。 */
type OrbitFrame = readonly [dir: readonly [number, number, number], ang: number]

/** ハーフトーンの球(見本 565–572 行)。acc は6桁hexの文字列。 */
function drawHT(g: CanvasRenderingContext2D, W: number, H: number, acc: string, dir: readonly [number, number, number], ang: number): void {
  const cx = W * 0.5, cy = H * 0.45, R = W * 0.33, s = W / 22
  const n = Math.hypot(dir[0], dir[1], dir[2])
  const L: readonly [number, number, number] = [dir[0] / n, dir[1] / n, dir[2] / n]
  const rx = R * 1.5, ry = R * 0.3
  g.lineWidth = 2.4
  g.strokeStyle = rgba(acc, 0.55)
  g.beginPath()
  g.ellipse(cx, cy, rx, ry, 0, Math.PI, 2 * Math.PI)
  g.stroke()
  g.fillStyle = '#121212'
  g.beginPath()
  g.arc(cx, cy, R + s * 0.5, 0, 7)
  g.fill()
  g.fillStyle = '#f1f0eb'
  for (let y = s / 2; y < H; y += s) {
    for (let x = s / 2; x < W; x += s) {
      const dx = (x - cx) / R, dy = (y - cy) / R, d2 = dx * dx + dy * dy
      if (d2 > 1) continue
      const I = dx * L[0] + dy * L[1] + Math.sqrt(1 - d2) * L[2]
      g.beginPath()
      g.arc(x, y, s * 0.5 * Math.max(0.14, Math.pow(Math.max(I, 0), 0.8)), 0, 7)
      g.fill()
    }
  }
  g.strokeStyle = acc
  g.beginPath()
  g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI)
  g.stroke()
  g.fillStyle = acc
  g.beginPath()
  g.arc(cx + rx * Math.cos(ang), cy + ry * Math.sin(ang), W * 0.028, 0, 7)
  g.fill()
  g.fillStyle = '#8a8983'
  g.font = '500 22px "Geist Mono", monospace'
  g.fillText('FIG. 03 — ORBIT', 32, H - 36)
}

export type FilmHandle = { draw(t: number): void; t: number; acc: number; dur: number; fill: HTMLElement; tc: HTMLElement }

/* .__film / .__slides の代わり(見本の el.__film / el.__slides)。キーは .art 要素。 */
const FILM = new WeakMap<HTMLElement, FilmHandle>()
const SLIDES = new WeakMap<HTMLElement, HTMLCanvasElement[]>()

export function filmOf(card: HTMLElement): FilmHandle | null {
  const art = card.querySelector('.art')
  return art instanceof HTMLElement ? (FILM.get(art) ?? null) : null
}

export function slidesOf(card: HTMLElement): HTMLCanvasElement[] | null {
  const art = card.querySelector('.art')
  return art instanceof HTMLElement ? (SLIDES.get(art) ?? null) : null
}

type ArtFn = (el: HTMLElement, acc: string, amb: boolean, steps?: StepRunner) => void

/** 自作アート(白黒+アクセント・描くのは1回だけ)。見本 544–619 行の ART。 */
const ART: Record<ArtKind, ArtFn> = {
  halftone: (el, acc) => {
    el.style.background = '#121212'
    const c = cv(el, 480, 640)
    const g = c.getContext('2d')
    if (g) drawHT(g, 480, 640, acc, [0.62, -0.42, 0.66], 0.765)
  },
  /* 動画カードの「静止画が切り替わる」再生: 光の向きと軌道の点が進んだ3コマ */
  halftone3: (el, acc) => {
    el.style.background = '#121212'
    const frames: readonly OrbitFrame[] = [
      [[0.62, -0.42, 0.66], 0.765],
      [[0.05, -0.55, 0.84], 1.57],
      [[-0.66, -0.34, 0.66], 2.376],
    ]
    const slides = frames.map((f, i) => {
      const c = cv(el, 480, 640, 'sl' + (i ? '' : ' on'))
      const g = c.getContext('2d')
      if (g) drawHT(g, 480, 640, acc, f[0], f[1])
      return c
    })
    SLIDES.set(el, slides)
  },
  /* 再生される1本: 128×72 の点描の夕景(夕日が沈み、波が動き、船が横切る)。再生中だけ描き直す */
  film: (el, acc) => {
    el.style.background = '#0e0e0e'
    const W = 128, H = 72
    const c = cv(el, W, H, 'px')
    const g = c.getContext('2d')
    if (!g) return
    /* nested function 内では null 絞り込みが引き継がれないため、非 null 型で確定させておく */
    const ctx: CanvasRenderingContext2D = g
    const img = ctx.createImageData(W, H)
    const d = img.data
    const A = rgb(acc)
    const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
    function draw(t: number): void {
      const hz = Math.round(H * 0.56), sunR = H * 0.17, sunY = H * (0.26 + 0.12 * ((t % 24) / 24)), bx = ((t * 6) % (W + 30)) - 15
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let v: number
          let hot = false
          if (y < hz) {
            v = 0.02 + 0.46 * Math.pow(y / hz, 2.6)
            const dd = Math.hypot(x - W * 0.62, y - sunY)
            if (dd < sunR) { v = 1; hot = true } else v += 0.26 * Math.exp(-(dd - sunR) / (W * 0.06))
          } else if (y === hz) {
            v = 0.72
          } else {
            const k = (y - hz) / (H - hz)
            v = 0.015
            if (Math.abs(x - W * 0.62) < sunR * (1.05 - 0.55 * k) + Math.sin(y * 1.1 + t * 2.4) * 1.6 && Math.sin(y * 1.9 - t * 3.2 + x * 0.08) > -0.15) { v = 0.95; hot = true }
            else if (Math.sin(x * 0.23 + y * 1.7 - t * 2.6) > 0.965) v = 0.55
          }
          if (y >= hz - 6 && y <= hz && Math.abs(x - bx) < 7) {
            const tt = y - (hz - 6)
            if ((y >= hz - 1 && Math.abs(x - bx) < 6) || (y < hz - 1 && x - bx > -1 && x - bx < tt * 0.9)) { v = 0; hot = false }
          }
          const on = v > (B[(y & 3) * 4 + (x & 3)] + 0.5) / 16
          const i4 = (y * W + x) * 4
          if (on) {
            if (hot) { d[i4] = A[0]; d[i4 + 1] = A[1]; d[i4 + 2] = A[2] } else { d[i4] = 236; d[i4 + 1] = 235; d[i4 + 2] = 230 }
          } else { d[i4] = 14; d[i4 + 1] = 14; d[i4 + 2] = 14 }
          d[i4 + 3] = 255
        }
      }
      ctx.putImageData(img, 0, 0)
    }
    draw(3)
    el.insertAdjacentHTML('beforeend', '<span class="fl-play">▶</span><div class="fl-ui"><i class="fl-bar"><i class="fl-fill"></i></i><span class="fl-tc">0:03 / 0:24</span></div>')
    const fill = el.querySelector('.fl-fill')
    const tc = el.querySelector('.fl-tc')
    if (fill instanceof HTMLElement && tc instanceof HTMLElement) {
      FILM.set(el, { draw, t: 3, acc: 0, dur: 24, fill, tc })
    }
  },
  dither: (el, acc) => {
    el.style.background = '#0e0e0e'
    const W = 90, H = 120
    const c = cv(el, W, H, 'px')
    const g = c.getContext('2d')
    if (!g) return
    const img = g.createImageData(W, H)
    const d = img.data
    const A = rgb(acc)
    const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
    const hz = H * 0.6, sunR = W * 0.2, sunY = H * 0.44
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let v: number
        let hot = false
        if (y < hz) {
          v = 0.06 + 0.5 * Math.pow(y / hz, 1.7)
          const dd = Math.hypot(x - W * 0.5, y - sunY)
          if (dd < sunR) { v = 1; hot = true } else v += 0.32 * Math.exp(-(dd - sunR) / (W * 0.13))
        } else {
          const k = (y - hz) / (H - hz)
          v = 0.1 + 0.14 * (1 - k)
          if (Math.abs(x - W * 0.5) < sunR * (0.95 - 0.45 * k) + Math.sin(y * 0.9) * 2.2 * (1 + k * 2) && Math.sin(y * 1.7) > -0.25) { v = 0.92; hot = true }
        }
        const on = v > (B[(y & 3) * 4 + (x & 3)] + 0.5) / 16
        const i4 = (y * W + x) * 4
        if (on) {
          if (hot) { d[i4] = A[0]; d[i4 + 1] = A[1]; d[i4 + 2] = A[2] } else { d[i4] = 236; d[i4 + 1] = 235; d[i4 + 2] = 230 }
        } else { d[i4] = 14; d[i4 + 1] = 14; d[i4 + 2] = 14 }
        d[i4 + 3] = 255
      }
    }
    g.putImageData(img, 0, 0)
  },
  truchet: (el, _acc, amb, steps) => {
    el.style.background = '#f2f1ed'
    let h = '<div class="tru">'
    for (let i = 0; i < 16; i++) {
      const q = (i * 7) % 5 < 3
      const r = ((i * 3) % 4) * 90
      h += '<i style="transform:rotate(' + r + 'deg)" data-r="' + r + '"><svg viewBox="0 0 10 10"><path d="' + (q ? 'M0 0H10A10 10 0 0 1 0 10Z' : 'M0 0H10A5 5 0 0 1 0 0Z') + '" style="fill:' + (i === 9 ? 'var(--acc)' : '#111') + '"/></svg></i>'
    }
    el.innerHTML = h + '</div>'
    if (amb) {
      const tiles = Array.from(el.querySelectorAll<HTMLElement>('.tru i'))
      steps?.add(el, () => {
        const tl = tiles[Math.floor(Math.random() * tiles.length)]
        const r = Number(tl.dataset.r ?? '0') + 90
        tl.dataset.r = String(r)
        tl.style.transform = 'rotate(' + r + 'deg)'
      }, 1300)
    }
  },
  swiss: (el, _acc, amb, steps) => {
    let dots = ''
    for (let i = 0; i < 10; i++) dots += '<b' + (i === 3 ? ' class="on"' : '') + '></b>'
    el.innerHTML = '<div class="sw"><div class="sw-top"><span>Vol. 26</span><span>Autumn</span></div><div class="sw-word">ARCH<br>IVE</div><div class="sw-grid">' + dots + '</div><div class="sw-bot"><span>Collected references</span><span>03</span></div></div>'
    if (amb) {
      const bs = Array.from(el.querySelectorAll<HTMLElement>('.sw-grid b'))
      let cur = 3
      steps?.add(el, () => {
        let nx: number
        do { nx = Math.floor(Math.random() * bs.length) } while (nx === cur)
        bs[cur].classList.remove('on')
        bs[nx].classList.add('on')
        cur = nx
      }, 1100)
    }
  },
  ticker: (el, _acc, amb) => {
    const band = (cls: string, word: string, dur: number): string => {
      let s = ''
      for (let i = 0; i < 4; i++) s += word + '&nbsp;✦&nbsp;'
      return '<div class="' + cls + '"><span class="' + (amb ? 'mq' : '') + '" style="animation-duration:' + dur + 's">' + s + s + '</span></div>'
    }
    el.innerHTML = '<div class="tk">' + band('b1', 'Moodboard', 18) + band('b2 r', 'Reference', 22) + band('b3', 'Archive', 15) + band('b4 r', 'Inspiration', 25) + '</div>'
  },
  arches: (el) => {
    let p = ''
    for (let i = 0; i < 12; i++) {
      const r = 4 + i * 2.9
      p += '<path class="' + (i === 8 ? 'a' : '') + '" d="M' + (40 - r).toFixed(2) + ' 100 V60 A' + r.toFixed(2) + ' ' + r.toFixed(2) + ' 0 0 1 ' + (40 + r).toFixed(2) + ' 60 V100"/>'
    }
    el.innerHTML = '<div class="arcW"><svg class="arc" viewBox="0 0 80 100" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0;width:100%;height:100%">' + p + '</svg><span class="arcL">Arches / 12</span></div>'
  },
  grid: (el) => {
    let c = ''
    for (let i = 0; i < 16; i++) c += '<i' + (i === 6 ? ' class="f"' : i === 9 ? ' class="o"' : '') + '></i>'
    el.innerHTML = '<div class="gd"><span class="gd-l">Nº 04 — GRID</span><div class="gd-g">' + c + '</div></div>'
  },
  rules: (el) => {
    let r = ''
    for (let i = 0; i < 12; i++) r += '<i' + (i === 8 ? ' class="a"' : '') + '>' + (i < 9 ? '0' : '') + (i + 1) + '</i>'
    el.innerHTML = '<div class="ru"><span class="ru-l">Index</span><div class="ru-r">' + r + '</div></div>'
  },
  bars: (el, _acc, amb) => {
    const hs = [0.35, 0.62, 0.48, 0.86, 0.54, 0.74, 0.3, 0.66, 0.92, 0.5, 0.4, 0.7]
    let b = ''
    hs.forEach((h, i) => {
      b += '<i class="' + (amb ? 'eq' : '') + (i === 8 ? ' a' : '') + '" style="height:' + (h * 100) + '%;animation-delay:' + (-i * 0.23).toFixed(2) + 's"></i>'
    })
    el.innerHTML = '<div class="eq-w"><span class="eq-l">SIDE A — 04:12</span><div class="eq-b">' + b + '</div></div>'
  },
  vinyl: (el, _acc, amb) => {
    el.style.background = '#161616'
    let gr = ''
    for (let r = 17; r < 47; r += 1.15) {
      gr += '<circle cx="62" cy="50" r="' + r.toFixed(2) + '" fill="none" stroke="rgba(255,255,255,' + (r % 3 < 1.2 ? 0.1 : 0.05) + ')" stroke-width=".35"/>'
    }
    el.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"><circle cx="62" cy="50" r="48" fill="#0b0b0b"/><g class="disc' + (amb ? ' spin' : '') + '" style="transform-box:view-box;transform-origin:62px 50px">' + gr + '<circle cx="62" cy="50" r="15" style="fill:var(--acc)"/><circle cx="62" cy="50" r="12.5" fill="none" stroke="#111" stroke-width=".3"/>' +
      '<text x="62" y="44.5" text-anchor="middle" font-family="Geist, sans-serif" font-weight="800" font-size="3.6" fill="#111">SIDE A</text><text x="62" y="58.6" text-anchor="middle" font-family="Geist Mono, monospace" font-size="2.4" fill="#111">33 RPM</text><circle cx="62" cy="50" r="1.2" fill="#161616"/></g>' +
      '<path d="M62 50 L112 18 L112 30 Z" fill="rgba(255,255,255,.05)"/><text x="7" y="12" font-family="Geist Mono, monospace" font-size="3.6" fill="#8a8983">NIGHT DRIVE</text><text x="7" y="93" font-family="Geist Mono, monospace" font-size="3.6" fill="#8a8983">LP — 01</text></svg>'
  },
  tag: (el) => {
    el.innerHTML = '<div class="tgW"><svg viewBox="0 0 100 133" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%"><path d="M50 36 V0" fill="none" stroke="#111" stroke-width=".5"/></svg>' +
      '<div class="tg"><i class="hole"></i><span class="tg-b">AM—26</span><span class="tg-l">SIZE</span><span class="tg-v">M</span><span class="tg-l">MATERIAL</span><span class="tg-v">COTTON 100%</span><span class="tg-bar"></span><span class="tg-code">0 26 0928 4471</span><i class="tg-acc"></i></div></div>'
    const st: string[] = []
    let x = 0
    let k = 0
    while (x < 100) {
      const w = 0.4 + ((k * 37) % 17) / 10
      st.push('#111 ' + x.toFixed(1) + '% ' + Math.min(100, x + w).toFixed(1) + '%')
      x += w
      const gp = 0.5 + ((k * 23) % 13) / 10
      st.push('transparent ' + x.toFixed(1) + '% ' + Math.min(100, x + gp).toFixed(1) + '%')
      x += gp
      k++
    }
    const bar = el.querySelector('.tg-bar')
    if (bar instanceof HTMLElement) bar.style.background = 'linear-gradient(90deg,' + st.join(',') + ')'
  },
}

/** ボード見本のカード1枚の DOM を組み立てる(見本 625–628 行の makeCard)。 */
export function makeCard(spec: CardSpec, opts: { amb: boolean; tweetText?: string; steps?: StepRunner }): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'card'
  if (spec.tweet != null) {
    el.classList.add('tcard')
    el.innerHTML = '<div class="tw-author"><span class="tw-av">A</span><span class="tw-name">AllMarks</span></div><div class="tw-body"><p></p></div>'
    const p = el.querySelector('.tw-body p')
    if (p) p.textContent = opts.tweetText ?? ''
    return el
  }
  const art = spec.art
  if (!art) return el
  const a = document.createElement('div')
  a.className = 'art'
  const acc = ACCENTS[spec.accent ?? DEFAULT_ACCENT[art]]
  a.style.setProperty('--acc', acc)
  el.appendChild(a)
  ART[art](a, acc, opts.amb, opts.steps)
  return el
}
