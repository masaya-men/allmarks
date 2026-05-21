'use client'

/**
 * Typo Glitch Lab v4 — ポインタ位置を「欠かす」 + chrome ボタンと同じ RGB 横スライス
 *
 * 方針 (= ようやく確定した正解):
 *   - 文字は本番と同じ 1 ブロック描画 (1 文字分割なし、 scramble なし)
 *   - マウスポインタの小さい円ゾーンだけが対象
 *   - そのゾーンで:
 *       (a) ベース白文字を穴あけ (= 黒背景が見える = 「文字の一部が欠ける」)
 *       (b) chrome ボタンと同じ glitch-shift keyframes で、 オレンジ/シアンの
 *           RGB ゴーストが clip-path 横スライスしながらチラつく
 *   - ゾーン外は完全無傷
 *
 * chrome ボタン ([ChromeButton.module.css]) の glitch-shift-a/b keyframes を
 * そのまま流用して視覚言語を完全に揃える。 違いは「ホバーで 1 回」 ではなく
 * 「マウス位置で常時ループ」 し、 radial マスクでポインタ周辺に限定する点。
 *
 * 全 UI 日本語。
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactElement,
} from 'react'
import styles from './typo-glitch-lab.module.css'

type Params = {
  /** マウス中心で文字が欠ける半径 (px) */
  radius: number
  /** その外側でフェードする距離 (px) */
  falloff: number
  /** RGB 横スライスのずれ倍率 (= chrome keyframes の translate を何倍するか) */
  shiftScale: number
  /** スライスアニメの 1 周期 (ms) — 短いほど激しくチラつく */
  animSpeed: number
  /** クリックバーストの持続時間 (ms) */
  burstDuration: number
  /** バースト時の半径倍率 */
  burstRadiusMult: number
  /** バースト時のずれ倍率 */
  burstAmpMult: number
}

const DEFAULTS: Params = {
  radius: 22,
  falloff: 16,
  shiftScale: 1,
  animSpeed: 700,
  burstDuration: 800,
  burstRadiusMult: 6,
  burstAmpMult: 3,
}

const SLIDER_LABELS: Record<keyof Params, { ja: string; hint: string }> = {
  radius: { ja: '影響範囲 (px)', hint: 'マウス中心から文字が欠ける円の半径' },
  falloff: { ja: 'フェード距離 (px)', hint: '欠ける範囲の外側で 0 まで滑らかにフェード' },
  shiftScale: { ja: 'スライスずれ倍率', hint: 'RGB 横スライスのずれ量 (chrome ボタンの値を何倍するか)' },
  animSpeed: { ja: 'チラつき速度 (ms)', hint: 'スライスアニメの 1 周期。 短いほど激しい' },
  burstDuration: { ja: '持続時間 (ms)', hint: 'クリックバーストの長さ' },
  burstRadiusMult: { ja: '範囲倍率', hint: 'バースト peak で半径が何倍に広がるか' },
  burstAmpMult: { ja: '強度倍率', hint: 'バースト peak でずれ量が何倍になるか' },
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function burstCurve(t: number, peakAt: number = 0.3): number {
  if (t <= 0 || t >= 1) return 0
  if (t < peakAt) return easeOutCubic(t / peakAt)
  return easeOutCubic(1 - (t - peakAt) / (1 - peakAt))
}

export default function TypoGlitchLab(): ReactElement {
  const [p, setP] = useState<Params>(DEFAULTS)
  const hostRef = useRef<HTMLDivElement>(null)
  const burstStartRef = useRef<number | null>(null)
  const pRef = useRef<Params>(DEFAULTS)
  pRef.current = p

  // マウス位置 → CSS 変数 (host 基準 px) を同期書き込み
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const onMove = (e: PointerEvent): void => {
      const rect = host.getBoundingClientRect()
      host.style.setProperty('--gx', `${e.clientX - rect.left}px`)
      host.style.setProperty('--gy', `${e.clientY - rect.top}px`)
    }
    document.addEventListener('pointermove', onMove)
    return (): void => {
      document.removeEventListener('pointermove', onMove)
    }
  }, [])

  // バースト rAF — radius / amp 乗数を曲線で animate
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let rafId = 0
    const tick = (): void => {
      const params = pRef.current
      const now = performance.now()
      let radiusK = 1
      let ampK = 1
      if (burstStartRef.current !== null) {
        const elapsed = now - burstStartRef.current
        if (elapsed >= params.burstDuration) {
          burstStartRef.current = null
        } else {
          const curve = burstCurve(elapsed / params.burstDuration)
          radiusK = 1 + (params.burstRadiusMult - 1) * curve
          ampK = 1 + (params.burstAmpMult - 1) * curve
        }
      }
      host.style.setProperty('--g-burst-radius-k', String(radiusK))
      host.style.setProperty('--g-burst-amp-k', String(ampK))
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return (): void => cancelAnimationFrame(rafId)
  }, [])

  const triggerBurst = useCallback((): void => {
    burstStartRef.current = performance.now()
  }, [])

  const set =
    (key: keyof Params) =>
    (e: ChangeEvent<HTMLInputElement>): void => {
      setP({ ...p, [key]: Number(e.target.value) })
    }

  const reset = (): void => setP(DEFAULTS)

  const stageStyle = {
    '--g-radius': `${p.radius}px`,
    '--g-falloff': `${p.falloff}px`,
    '--g-shift-scale': p.shiftScale,
    '--g-anim-speed': `${p.animSpeed}ms`,
    '--g-burst-radius-k': '1',
    '--g-burst-amp-k': '1',
  } as CSSProperties

  return (
    <div className={styles.root}>
      <div ref={hostRef} className={styles.stage} style={stageStyle}>
        {/* ベース文字: 全領域に表示、 マウス位置だけ穴あけマスクで欠ける */}
        <div className={styles.baseLayer}>
          <span className={styles.text} onClick={triggerBurst}>
            AllMarks
          </span>
        </div>

        {/* RGB ゴースト: マウスゾーンだけ可視、 chrome ボタンと同じ横スライス glitch */}
        <div className={styles.glitchLayer} aria-hidden="true">
          <span className={`${styles.text} ${styles.ghostOrange}`}>AllMarks</span>
          <span className={`${styles.text} ${styles.ghostCyan}`}>AllMarks</span>
        </div>

        <div className={styles.hint}>マウスを文字に近づける · クリックでバースト</div>
      </div>

      <aside className={styles.controls}>
        <header className={styles.header}>
          <h2>タイポグラフィ・グリッチ・ラボ v4</h2>
          <p className={styles.subtitle}>ポインタ位置を欠かす + chrome 同じ RGB 横スライス</p>
          <div className={styles.actions}>
            <button onClick={reset} className={styles.btn}>初期値に戻す</button>
            <button onClick={triggerBurst} className={styles.btn}>バースト発動</button>
          </div>
        </header>

        <h3>通常時</h3>
        <ParamSlider keyName="radius" value={p.radius} min={2} max={300} step={1} onChange={set('radius')} />
        <ParamSlider keyName="falloff" value={p.falloff} min={0} max={200} step={1} onChange={set('falloff')} />
        <ParamSlider keyName="shiftScale" value={p.shiftScale} min={0} max={5} step={0.1} onChange={set('shiftScale')} />
        <ParamSlider keyName="animSpeed" value={p.animSpeed} min={120} max={2000} step={20} onChange={set('animSpeed')} />

        <h3>クリックバースト</h3>
        <ParamSlider keyName="burstDuration" value={p.burstDuration} min={100} max={2500} step={50} onChange={set('burstDuration')} />
        <ParamSlider keyName="burstRadiusMult" value={p.burstRadiusMult} min={1} max={20} step={0.25} onChange={set('burstRadiusMult')} />
        <ParamSlider keyName="burstAmpMult" value={p.burstAmpMult} min={1} max={10} step={0.25} onChange={set('burstAmpMult')} />

        <details className={styles.snapshot}>
          <summary>JSON スナップショット</summary>
          <pre>{JSON.stringify(p, null, 2)}</pre>
        </details>

        <div className={styles.legend}>
          <strong>用語ガイド</strong>
          <ul>
            <li><b>影響範囲</b>: ポインタ中心で文字が欠ける円の半径 (= 小さくするとピンポイント)</li>
            <li><b>フェード距離</b>: その外側で効果が 0 まで滑らかに弱まる距離</li>
            <li><b>スライスずれ倍率</b>: chrome ボタンの RGB 横スライスのずれ量 (0=ずれ無し)</li>
            <li><b>チラつき速度</b>: スライスが切り替わる速さ (短いほど激しい)</li>
            <li><b>バースト</b>: 文字クリック時、 範囲と強度が一気に膨らんで戻る演出</li>
          </ul>
        </div>
      </aside>
    </div>
  )
}

function ParamSlider(props: {
  readonly keyName: keyof Params
  readonly value: number
  readonly min: number
  readonly max: number
  readonly step?: number
  readonly onChange: (e: ChangeEvent<HTMLInputElement>) => void
}): ReactElement {
  const info = SLIDER_LABELS[props.keyName]
  return (
    <label className={styles.slider} title={info.hint}>
      <span className={styles.sliderLabel}>{info.ja}</span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        onChange={props.onChange}
      />
      <span className={styles.sliderValue}>{props.value}</span>
    </label>
  )
}
