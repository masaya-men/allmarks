'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { E, clamp01 } from '@/lib/marketing/lp/motion-math'
import {
  RAIL_LABELS,
  RAIL_NARROW_MAX_VW,
  buildRailPlan,
  eioExpo,
  railClear,
  railCrossPhase,
  railCrossProgress,
  railLineX,
  railProgress,
  railTickStep,
  railTickWrap,
  railTilt,
  railWhere,
  type RailPlan,
} from '@/lib/marketing/lp/rail'
import styles from './ScrollRail.module.css'

/** 書き込み済みの値を覚えておき、値が変わらないフレームは書かない部品(見本の mk / wt / wo)。 */
type Part = { el: HTMLElement; t: string; o: string }

/** 渡り 1 つぶんの、画面上の位置。レイアウト時に 1 回だけ計算する。 */
type Cross = {
  /** 出発 / 着く縦線の中心の x。 */
  xf: number
  xt: number
  /** 渡りの高さ(この y で横へ走る)。yr は丸めた値。 */
  yc: number
  yr: number
  /** 横棒の入れ物の左端 x と長さ(太い棒はこの中で translateX + scaleX する)。 */
  X0: number
  len: number
}

/** 縦に走る 1 本ぶんの区間。 */
type Run = { y0: number; y1: number; len: number }

/** レイアウト時に測って作り、毎フレームの描画に使い回す値(スクロール中は測らない)。 */
type Geometry = {
  plan: RailPlan
  /** 入れ物の高さ(= 線の先端が進み 1 で届く画面の下端)。 */
  Hc: number
  top: number
  /** 線の長さ(上端から画面の下端まで)。 */
  L: number
  /** 6 本の縦線の中心 x(道順の順)。 */
  xs: number[]
  /** 角の印・札が消えていく距離(0.15H)。 */
  hv: number
  cross: Cross[]
  runs: Run[]
}

/** 最後に書いた値(変わっていなければ書かない)。 */
type Written = { th?: string; fw?: string; rc?: string; cp?: string; tk?: string; coff?: boolean; end?: boolean }

const DEG = Math.PI / 180
/** intro を飛ばす操作(Hero と同じ 4 種)。 */
const SKIP_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const

/** CSS Modules のクラス名(なければ空)。 */
function cls(name: string): string {
  return styles[name] ?? ''
}

/**
 * ScrollRail — スクロールの進み具合を示す線(あみだくじ)と、それに付随する背景の縦線の動き。
 * docs/private/lp-v11-mock.html 861〜961 行の移植。
 *
 * 1 本の白い線が、hero → Problem → Features(01-02 / 03-04 / 05-06)→ 締め の順に、縦線を伝って画面の下へ
 * 伸びる。節目では左右交互に隣の縦線へ横へ渡る(渡っている間は縦に伸びない)。入れ物にだけ
 * mix-blend-mode: difference を付けるので、白い紙の上では黒い線、黒い所の上では白く反転して見える。
 *
 * 同じ ticker(gsap.ticker)で、次の 3 つもまとめて書く:
 *   - 背景の縦線(BackgroundGrid の [data-lp-bggrid-wrap])と、締めの中の縦線(FinalCta の [data-lp-fingrid])と、
 *     この線の入れ物に、同じ角度の skewX を同じ原点(画面の縦の真ん中)で掛ける。傾きは各「渡り」と同期して左右交互。
 *   - 縦線ごとの目盛り([data-lp-rtk])を縦線に沿って流す(ΔS × 3.0 を 1 フレーム ±38.4px に制限して足し込む)。
 *   - 締めのあと(進み 1 = 画面が全部黒になった後)、入れ物に clip-path を掛けて線を下へ抜けて消す。
 *
 * すべて「なめらかなスクロール値 S」だけで決まる(戻せば戻る)。寸法はレイアウト時・リサイズ時(160ms デバウンス)・
 * フォント読み込み後にだけ測ってキャッシュし、スクロール中・ticker 中には測らない。毎フレーム書くのは
 * transform / opacity / clip-path だけで、値が変わらないフレームは書かない。計算は lib/marketing/lp/rail.ts の純関数。
 *
 * 動きを減らす設定: S = scrollY、傾きなし、目盛りは流さない、合図・スキャン・角の印・札は出さない
 * (線の伸びと渡りの位置は残す)。
 *
 * 探す相手(見つからなければ何もしない): BackgroundGrid の [data-lp-bggrid-wrap] / [data-lp-rtk]、Problem の #problem、
 * Features の [data-fpin]、FinalCta の [data-lp-fin] / [data-lp-fingrid]、SiteHeader の <header>。
 * 札の余白判定には、Problem の動くボードの枠と Features の右のパネルの [data-lp-rail-board](なくても動く)。
 */
export function ScrollRail(): React.ReactElement {
  const railRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = railRef.current
    const scope = root?.parentElement
    if (!root || !scope) return undefined

    const bgWrap = scope.querySelector<HTMLElement>('[data-lp-bggrid-wrap]')
    const finEl = scope.querySelector<HTMLElement>('[data-lp-fin]')
    const finWrap = scope.querySelector<HTMLElement>('[data-lp-fingrid]')
    const problemEl = scope.querySelector<HTMLElement>('#problem')
    const fpinEl = scope.querySelector<HTMLElement>('[data-fpin]')
    if (!bgWrap || !finEl || !finWrap || !problemEl || !fpinEl) return undefined
    const ticks = Array.from(bgWrap.querySelectorAll<HTMLElement>('[data-lp-rtk]'))
    const headerEl = scope.querySelector<HTMLElement>(':scope > header')
    // 札を右に置ける余白の限り(パソコンのみ): Problem の動くボードの枠 / Features の右のパネルの左端。
    // 両方に data-lp-rail-board が付いている(なければ画面の右端まで)。
    const stageEl = problemEl.querySelector<HTMLElement>('[data-lp-rail-board]')
    const panelEl = fpinEl.querySelector<HTMLElement>('[data-lp-rail-board]')

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    /** 合図・スキャン・角の印・札・目盛りの流れ(動きを減らす設定では出さない)。 */
    const deco = !reduce

    // ── 部品はぜんぶ最初に作る(あとは位置と透明度を書くだけ) ──
    const parts: Part[] = []
    function mk(tag: 'i' | 'span', name: string, text?: string): Part {
      const el = document.createElement(tag)
      el.className = cls(name)
      if (text) el.textContent = text
      root!.appendChild(el)
      const part: Part = { el, t: '', o: '' }
      parts.push(part)
      return part
    }
    const runParts = Array.from({ length: 6 }, () => ({ tr: mk('i', 'rvt'), br: mk('i', 'rvb') }))
    const crossParts = RAIL_LABELS.map((label) => ({
      tr: mk('i', 'rht'),
      br: mk('i', 'rhb'),
      d: mk('i', 'rmk'),
      a: mk('i', 'rmk'),
      lb: mk('span', 'rlb', label),
      sc: mk('i', 'rscn'),
    }))
    const cue = mk('i', 'rcuew')
    const cueLine = document.createElement('i')
    cueLine.className = cls('rcue')
    cue.el.appendChild(cueLine)
    const tip = mk('i', 'rtip')

    const wt = (p: Part, v: string): void => {
      if (p.t !== v) {
        p.t = v
        p.el.style.transform = v
      }
    }
    const wo = (p: Part, v: string): void => {
      if (p.o !== v) {
        p.o = v
        p.el.style.opacity = v
      }
    }
    /** 角の印: m = 1 左下 / 2 右下 / 3 右上 / 4 左上 の角。(vx, vy) はその角の位置。 */
    const markAt = (p: Part, m: 1 | 2 | 3 | 4, vx: number, vy: number): void => {
      const left = m === 1 || m === 4 ? vx : vx - 8
      const topPx = m === 1 || m === 2 ? vy - 8 : vy
      p.el.dataset.m = String(m)
      p.el.style.cssText = `left:${left}px;top:${topPx}px;transform:scale(0)`
      p.t = 'scale(0)'
      p.o = ''
    }

    // ── 状態 ──
    let geo: Geometry | null = null
    let S = window.scrollY
    let tickPos = 0
    let dirty = true
    let lastS = -1
    let lastY = -1
    let rs: Written = {}

    // ── 測る(レイアウト時・リサイズ時・フォント読み込み後だけ) ──
    function layout(): void {
      root!.style.display = ''
      const Hs = window.innerHeight
      const Hc = root!.clientHeight || Hs
      const vw = root!.clientWidth || window.innerWidth
      const narrow = window.innerWidth <= RAIL_NARROW_MAX_VW
      const wl = bgWrap!.offsetLeft
      const ww = bgWrap!.offsetWidth
      const scrollNow = window.scrollY
      const docTop = (el: HTMLElement): number => el.getBoundingClientRect().top + scrollNow
      const finTop = docTop(finEl!)
      // 締めの固定される画面(sticky)の高さ。固定が終わる位置 = 締めの上端 + 締めの高さ − その高さ。
      const stage = finEl!.firstElementChild
      const stageH = (stage instanceof HTMLElement ? stage.offsetHeight : 0) || Hs
      const top = (headerEl?.offsetHeight || 64) + 3
      const bot = Hc
      const L = bot - top
      const plan =
        ww > 0 && Hc > 0 && L > 0
          ? buildRailPlan({
              H: Hs,
              boxH: Hc,
              narrow,
              gridLeft: wl,
              gridWidth: ww,
              problemTop: docTop(problemEl!),
              featTop: docTop(fpinEl!),
              featSpan: fpinEl!.offsetHeight - Hs,
              finTop,
              finPinEnd: finTop + finEl!.offsetHeight - stageH,
            })
          : null
      rs = {}
      if (!plan) {
        // レイアウトが想定と違う: 線は出さず、傾きも元に戻す
        geo = null
        root!.style.display = 'none'
        bgWrap!.style.transform = ''
        finWrap!.style.transform = ''
        root!.style.transform = ''
        root!.style.clipPath = ''
        ticks.forEach((el) => {
          el.style.transform = ''
        })
        return
      }

      // 縦線 k の中心 x(1px の線 13 本 = 左端 + .5 + k × (幅 − 1) / 12)。plan.cols の最後の k は、
      // 終わりの瞬間に先端が画面内(下端で x ≥ 24px)に見えるよう、画面に合わせて補正済み。
      const xs = plan.cols.map((k) => railLineX(k, wl, ww))
      const cross: Cross[] = plan.crossings.map((c, i) => {
        const yc = top + L * railProgress(plan, c.a)
        const xf = xs[i]
        const xt = xs[i + 1]
        return { xf, xt, yc, yr: Math.round(yc), X0: Math.min(xf, xt) - 1, len: Math.abs(xt - xf) + 2 }
      })
      const runs: Run[] = Array.from({ length: 6 }, (_, i) => {
        const y0 = i === 0 ? top : cross[i - 1].yc
        const y1 = i === 5 ? bot : cross[i].yc
        return { y0, y1, len: y1 - y0 }
      })
      geo = { plan, Hc, top, L, xs, hv: 0.15 * Hs, cross, runs }

      parts.forEach((p) => {
        p.t = ''
        p.o = ''
      })
      runs.forEach((r, i) => {
        const st = `left:${xs[i] - 1}px;top:${r.y0}px;height:${r.len}px`
        runParts[i].tr.el.style.cssText = st
        runParts[i].br.el.style.cssText = st
      })
      const stageLeft = stageEl ? stageEl.getBoundingClientRect().left : vw
      const panelLeft = panelEl ? panelEl.getBoundingClientRect().left : vw
      cross.forEach((c, i) => {
        const cp = crossParts[i]
        const dir = plan.crossings[i].dir
        const xmin = Math.min(c.xf, c.xt)
        const dx = Math.abs(c.xt - c.xf)
        const lw = cp.lb.el.offsetWidth
        cp.tr.el.style.cssText = `left:${xmin - 1}px;top:${c.yr - 1}px;width:${dx + 1}px;transform-origin:${dir > 0 ? '0 50%' : '100% 50%'}`
        cp.br.el.style.cssText = `left:${xmin - 1}px;top:${c.yr - 1}px;width:${dx + 2}px`
        if (dir > 0) {
          markAt(cp.d, 1, c.xf - 5, c.yr + 5)
          markAt(cp.a, 3, c.xt + 5, c.yr - 5)
        } else {
          markAt(cp.d, 2, c.xf + 5, c.yr + 5)
          markAt(cp.a, 4, c.xt - 5, c.yr - 5)
        }
        // 札は、着く側の角の近く。右に余白があれば右、なければ左(傾いた分も見込む。
        // パソコンでは動くボード / パネルの手前までを「余白」とみなす)
        const xsc = c.xt + Math.tan(railTilt(plan, plan.crossings[i].b) * DEG) * (c.yr - Hc / 2)
        const lim = narrow ? vw : Math.min(vw, i === 0 ? stageLeft : i < 4 ? panelLeft : vw)
        const right = xsc + 12 + lw + 6 < lim
        cp.lb.el.style.cssText = `left:${right ? c.xt + 12 : c.xt - 12 - lw}px;top:${c.yr + 7}px;transform-origin:${right ? '0 50%' : '100% 50%'}`
        cp.sc.el.style.cssText = `left:${c.xt - 1}px;top:0px`
      })
      // 測り直したら、その場で描き直す(1 フレームでも素の状態を見せない)
      dirty = false
      lastS = S
      lastY = scrollNow
      render(S, scrollNow)
    }

    // ── 描く(毎フレーム。transform / opacity / clip-path だけ、変わった時だけ) ──
    function render(Sv: number, y: number): void {
      const g = geo
      if (!g) return
      const { plan, Hc, top, L, xs, hv, cross, runs } = g
      const Sx = Sv < 0 ? 0 : Sv
      const th = reduce ? 0 : railTilt(plan, Sx)
      const ths = th.toFixed(3)

      // 傾き: 背景の縦線・締めの中の縦線・線の入れ物に、同じ角度を同じ原点(画面の縦の真ん中)で掛ける
      if (rs.th !== ths) {
        rs.th = ths
        bgWrap!.style.transform = `skewX(${ths}deg)`
      }
      // 締めがせり上がる間は、箱ごと下にずれている分だけ横へ戻して、縦線をそろえる
      const dfin = y < plan.end ? plan.end - y : 0
      const fs =
        dfin > 0 && Math.abs(th) > 0.0005
          ? `translateX(${(Math.tan(th * DEG) * dfin).toFixed(2)}px) skewX(${ths}deg)`
          : `skewX(${ths}deg)`
      if (rs.fw !== fs) {
        rs.fw = fs
        finWrap!.style.transform = fs
      }
      const rc = `skewX(${ths}deg)`
      if (rs.rc !== rc) {
        rs.rc = rc
        root!.style.transform = rc
      }
      // 終わり: 締めで画面が全部黒になった後、線が下へ抜けて消える(しっぽが先端を追って画面の下へ出ていく)
      const clear = railClear(plan, Sx)
      const cp = clear > 0 ? `inset(${(clear * 100).toFixed(2)}% 0 0 0)` : 'none'
      if (rs.cp !== cp) {
        rs.cp = cp
        root!.style.clipPath = cp
      }
      // 流れる目盛り: 縦線に沿って、frame() が足し込んだ位置へ
      if (deco) {
        const off = railTickWrap(tickPos).toFixed(1)
        if (rs.tk !== off) {
          rs.tk = off
          const tv = `translateY(-${off}px)`
          for (const el of ticks) el.style.transform = tv
        }
      }

      // 進み具合の線: 今いる縦線(runJ)か、渡りの途中(cx)か
      const where = railWhere(plan, Sx)
      const runJ = where.run
      const cx = where.crossing
      const yt = top + L * railProgress(plan, Sx)
      const sm = cx >= 0 ? eioExpo((where.u - 0.12) / 0.7) : 0
      const tx = cx >= 0 ? cross[cx].xf + sm * (cross[cx].xt - cross[cx].xf) : xs[runJ]
      const tyy = cx >= 0 ? cross[cx].yc : yt
      const ended = Sx >= plan.end
      for (let i = 0; i < 6; i++) {
        const r = runs[i]
        const pr = runParts[i]
        const grown = r.len > 0 ? clamp01((yt - r.y0) / r.len) : 0
        const absorbed = i >= 5 ? 0 : i < runJ ? 1 : i === cx ? sm : 0
        // 通ってきた線(薄い)
        wt(pr.tr, `scaleY(${grown.toFixed(4)})`)
        // 今の線(2px・100%)。渡りの間は曲がり角へ吸い込まれるように縮む
        wt(pr.br, `translateY(${(absorbed * r.len).toFixed(2)}px) scaleY(${Math.max(0, grown - absorbed).toFixed(4)})`)
      }
      for (let i = 0; i < 5; i++) {
        const c = cross[i]
        const p = crossParts[i]
        const uu = railCrossProgress(plan.crossings[i], Sx)
        const { head, tail } = railCrossPhase(uu)
        wt(p.tr, `scaleX(${head.toFixed(4)})`)
        let bt = 'scaleX(0)'
        if (head > 0 && tail < 1) {
          const dd = c.xt - c.xf
          const p0x = c.xf + tail * dd
          const p1x = c.xf + head * dd
          let xa: number
          let xb: number
          if (dd > 0) {
            xa = p0x - (tail <= 0 ? 1 : 0)
            xb = p1x + 1
          } else {
            xa = p1x - 1
            xb = p0x + (tail <= 0 ? 1 : 0)
          }
          if (xb - xa > 0) bt = `translateX(${(xa - c.X0).toFixed(2)}px) scaleX(${((xb - xa) / c.len).toFixed(4)})`
        }
        wt(p.br, bt)
        if (deco) {
          const cr = plan.crossings[i]
          // 角の印: 渡りの終わりから 0.15H の間に両方消える
          const vv = E(Sx, cr.b, cr.b + hv)
          let md = 0
          let ma = 0
          if (Sx >= cr.a && vv < 1) {
            md = E(uu, 0, 0.12) * (1 - vv)
            ma = E(uu, 0.82, 1) * (1 - vv)
          }
          wt(p.d, `scale(${md.toFixed(3)})`)
          wt(p.a, `scale(${ma.toFixed(3)})`)
          // 札: 区間の .35〜.6 で下から現れ、到着後 0.25H で消える
          const lin = E(uu, 0.35, 0.6)
          const lo = Sx >= cr.a ? lin * (1 - E(Sx, cr.b + 0.18 * plan.H, cr.b + 0.25 * plan.H)) : 0
          wo(p.lb, lo.toFixed(3))
          if (lo > 0) wt(p.lb, `translateY(${(6 * (1 - lin)).toFixed(1)}px) skewX(${(-th).toFixed(3)}deg)`)
          // スキャン: 着いた角から画面の下端まで走り抜ける
          let so = 0
          let sy = 0
          if (uu > 0.82 && uu < 1) {
            so = E(uu, 0.82, 0.86)
            sy = c.yr + (Hc - c.yr) * E(uu, 0.82, 1)
          }
          wo(p.sc, so.toFixed(3))
          wt(p.sc, `translateY(${(so > 0 ? sy : 0).toFixed(1)}px)`)
        }
      }
      // 先端の四角はまっすぐに保つ(入れ物の傾きを打ち消す)。進み 1 以降は出さない
      if (!ended) wt(tip, `translate(${tx.toFixed(1)}px,${tyy.toFixed(1)}px) skewX(${(-th).toFixed(3)}deg)`)
      if (deco) {
        wt(cue, `translate(${(tx - 0.75).toFixed(1)}px,${(tyy + 3).toFixed(1)}px)`)
        // 「続きがある」合図は、渡りの間と進み 1 以降だけ消える
        let coff = ended
        for (let i = 0; i < 5 && !coff; i++) {
          const cr = plan.crossings[i]
          if (Sx >= cr.a && Sx <= cr.b + hv) coff = true
        }
        if (rs.coff !== coff) {
          rs.coff = coff
          cue.el.classList.toggle(cls('off'), coff)
        }
      }
      if (rs.end !== ended) {
        rs.end = ended
        root!.classList.toggle(cls('end'), ended)
      }
    }

    // ── 毎フレーム: なめらかなスクロール値 S を追従させ、変わった時だけ描く ──
    const frame = (_time: number, dt: number): void => {
      const y = window.scrollY
      const prev = S
      if (reduce) {
        S = y
      } else {
        // 追従の係数 = 1 − exp(−dt / 90ms)。動きを減らす設定では S = scrollY
        S += (y - S) * (1 - Math.exp(-Math.min(dt || 16, 100) / 90))
        if (Math.abs(y - S) < 0.05) S = y
      }
      // 目盛りは ΔS × 3.0 を足し込む(1 フレームの上限あり。戻せば逆向きに流れる)
      if (deco && S !== prev) tickPos += railTickStep(S - prev)
      if (!dirty && S === lastS && y === lastY) return
      dirty = false
      lastS = S
      lastY = y
      render(S, y)
    }

    // ── 導入(hero の intro)に合わせて、目盛りは 1.0s から 0.8s、線は 1.5s から 0.6s かけて現れる(見本 828〜829 行) ──
    // intro が流れない時(動きを減らす・途中までスクロール済みで開いた時)は最初から出す。飛ばす操作は Hero と同じ 4 種。
    let intro: gsap.core.Timeline | null = null
    const skipIntro = (): void => {
      intro?.progress(1)
    }
    const removeSkip = (): void => {
      SKIP_EVENTS.forEach((ev) => window.removeEventListener(ev, skipIntro))
    }
    if (!reduce && window.scrollY <= window.innerHeight * 0.5) {
      intro = gsap.timeline({ onComplete: removeSkip })
      if (ticks.length > 0) intro.fromTo(ticks, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, ease: 'none' }, 1.0)
      intro.fromTo(root, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, ease: 'none' }, 1.5)
      SKIP_EVENTS.forEach((ev) => window.addEventListener(ev, skipIntro, { passive: true }))
    } else {
      gsap.set([root, ...ticks], { autoAlpha: 1 })
    }

    // ── 測り直すきっかけ: リサイズ(160ms デバウンス)・フォント読み込み後・load ──
    let disposed = false
    let resizeTimer: number | undefined
    const relayout = (): void => {
      if (!disposed) layout()
    }
    const onResize = (): void => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(relayout, 160)
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('load', relayout)
    if (document.fonts?.ready) {
      void document.fonts.ready.then(relayout)
    }

    layout()
    gsap.ticker.add(frame)

    return () => {
      disposed = true
      gsap.ticker.remove(frame)
      window.clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('load', relayout)
      removeSkip()
      intro?.kill()
      gsap.set([root, ...ticks], { clearProps: 'opacity,visibility' })
      parts.forEach((p) => p.el.remove())
      root.style.display = ''
      root.style.transform = ''
      root.style.clipPath = ''
      root.classList.remove(cls('end'))
      bgWrap.style.transform = ''
      finWrap.style.transform = ''
      ticks.forEach((el) => {
        el.style.transform = ''
      })
    }
  }, [])

  return <div ref={railRef} className={styles.rail} aria-hidden="true" data-lp-rail />
}
