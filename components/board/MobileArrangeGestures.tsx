'use client'

import { useRef, type PointerEvent, type ReactElement, type ReactNode } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import { panStageTransform, pinchStageTransform, type StagePoint, type StageTransform } from '@/lib/share/stage-zoom'
import styles from './MobileArrangeGestures.module.css'

export type MobileArrangeGesturesProps = {
  /** false（デスクトップ）なら wrapper DOM を一切足さず子をそのまま返す。 */
  readonly enabled: boolean
  /** 現在のボードズーム/パン（BoardRoot 所有）。 */
  readonly transform: StageTransform
  /** ボードズーム/パンの更新（非選択時の2本指・余白1本指パン）。 */
  readonly onTransformChange: (next: StageTransform) => void
  /** いま選択中のカード id（null=非選択）。2本指の行き先を決める。 */
  readonly selectedId: string | null
  /** 選択カードのピンチ開始で1回。BoardRoot が base をスナップショットする。 */
  readonly onSelectedPinchStart: () => void
  /** 選択カードのピンチ中に毎フレーム。factor=距離比・deltaDeg=角度差（開始基準の絶対値）。 */
  readonly onSelectedPinch: (change: { readonly factor: number; readonly deltaDeg: number }) => void
  /** 余白の1本指タップで選択解除。 */
  readonly onDeselect: () => void
  /** 選択カードのピンチ終了で1回（BoardRoot が履歴を確定）。 */
  readonly onSelectedPinchEnd?: () => void
  /** 余白のダブルタップで「整列」（ボードズームを1倍に戻す）。 */
  readonly onDoubleTapFit?: () => void
  readonly children: ReactNode
}

type PinchState = {
  readonly mode: 'card' | 'stage'
  readonly idA: number
  readonly idB: number
  readonly startA: StagePoint
  readonly startB: StagePoint
  readonly startDist: number
  readonly startAngleDeg: number
  readonly base: StageTransform
  readonly viewportW: number
  readonly viewportH: number
}

/** 余白から始まった1本指（pan or tap-deselect の候補）。 */
type SingleState = {
  readonly id: number
  readonly startX: number
  readonly startY: number
  moved: boolean
  readonly base: StageTransform
}

const PAN_SLOP_PX = 4
const DOUBLE_TAP_MS = 300
const DOUBLE_TAP_SLOP_PX = 24

function angleDeg(a: StagePoint, b: StagePoint): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
}

/** スマホのコラージュ編集段の多点タッチ担当（N-58 段階2）。内側の stage 層に CSS transform を
 *  掛けるだけで、子（CollageCanvas・帯ガイド）のレイアウト座標は変えない。仕分け:
 *  - 2本指: 選択中→選択カードの拡縮+回転（onSelectedPinch）/ 非選択→ボードズーム（onTransformChange）
 *  - 1本指: カード上→素通し（CollageCanvas の drag）/ 余白→パン（ズーム中のみ効く）or タップで解除
 *  すべて capture 相で処理し、2本目の指だけ stopPropagation して2つ目のカード操作を止める。 */
export function MobileArrangeGestures(props: MobileArrangeGesturesProps): ReactElement {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const pointers = useRef<Map<number, StagePoint>>(new Map())
  const pinch = useRef<PinchState | null>(null)
  const single = useRef<SingleState | null>(null)
  const lastBlankTap = useRef<{ t: number; x: number; y: number } | null>(null)

  if (!props.enabled) return <>{props.children}</>

  const toLocal = (e: PointerEvent<HTMLDivElement>): StagePoint => {
    const rect = viewportRef.current?.getBoundingClientRect()
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) }
  }

  const isOnCard = (target: EventTarget | null): boolean => {
    const el = target as HTMLElement | null
    return !!el?.closest?.('[data-testid^="collage-el-"]')
  }

  const handlePointerDownCapture = (e: PointerEvent<HTMLDivElement>): void => {
    const local = toLocal(e)
    pointers.current.set(e.pointerId, local)

    if (pinch.current === null && pointers.current.size === 2) {
      // 2本目の指: ピンチ開始。この pointerdown が新しいカード操作を始めないよう伝播を止める。
      e.stopPropagation()
      single.current = null
      const entries = Array.from(pointers.current.entries())
      const first = entries[0]
      const second = entries[1]
      if (!first || !second) return
      const rect = viewportRef.current?.getBoundingClientRect()
      const mode: 'card' | 'stage' = props.selectedId !== null ? 'card' : 'stage'
      pinch.current = {
        mode,
        idA: first[0],
        idB: second[0],
        startA: first[1],
        startB: second[1],
        startDist: Math.hypot(second[1].x - first[1].x, second[1].y - first[1].y),
        startAngleDeg: angleDeg(first[1], second[1]),
        base: props.transform,
        viewportW: rect?.width ?? 0,
        viewportH: rect?.height ?? 0,
      }
      // Fire on ANY pinch start (card OR stage). BoardRoot's handler always cancels the in-flight
      // 1-finger card drag via the arbiter, and only snapshots a base when a card is actually
      // selected — this guards the selectedId setState race where a 2nd finger could land in stage
      // mode while a card drag is still live and leak its listeners.
      props.onSelectedPinchStart()
      const vp = viewportRef.current
      if (vp) {
        try {
          vp.setPointerCapture(first[0])
        } catch {
          /* synthetic pointer */
        }
        try {
          vp.setPointerCapture(second[0])
        } catch {
          /* synthetic pointer */
        }
      }
      return
    }

    if (pointers.current.size === 1 && !isOnCard(e.target)) {
      // 余白の1本指: パン or タップ解除の候補（カード上は素通しして CollageCanvas に任せる）。
      single.current = { id: e.pointerId, startX: local.x, startY: local.y, moved: false, base: props.transform }
    }
  }

  const handlePointerMoveCapture = (e: PointerEvent<HTMLDivElement>): void => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, toLocal(e))

    const p = pinch.current
    if (p !== null && (e.pointerId === p.idA || e.pointerId === p.idB)) {
      e.stopPropagation()
      const currA = pointers.current.get(p.idA)
      const currB = pointers.current.get(p.idB)
      if (!currA || !currB) return
      if (p.mode === 'stage') {
        props.onTransformChange(
          pinchStageTransform({
            base: p.base,
            startA: p.startA,
            startB: p.startB,
            currA,
            currB,
            viewportW: p.viewportW,
            viewportH: p.viewportH,
          }),
        )
      } else {
        const dist = Math.hypot(currB.x - currA.x, currB.y - currA.y)
        const factor = p.startDist > 0 ? dist / p.startDist : 1
        const deltaDeg = angleDeg(currA, currB) - p.startAngleDeg
        props.onSelectedPinch({ factor, deltaDeg })
      }
      return
    }

    const s = single.current
    if (s !== null && e.pointerId === s.id) {
      const cur = pointers.current.get(s.id)
      if (!cur) return
      const dx = cur.x - s.startX
      const dy = cur.y - s.startY
      if (!s.moved && Math.hypot(dx, dy) > PAN_SLOP_PX) s.moved = true
      if (s.moved) props.onTransformChange(panStageTransform(s.base, dx, dy, viewportRef.current?.clientWidth ?? 0, viewportRef.current?.clientHeight ?? 0))
    }
  }

  const handlePointerEndCapture = (e: PointerEvent<HTMLDivElement>): void => {
    pointers.current.delete(e.pointerId)

    const p = pinch.current
    if (p !== null && (e.pointerId === p.idA || e.pointerId === p.idB)) {
      pinch.current = null
      e.stopPropagation()
      props.onSelectedPinchEnd?.()
      return
    }

    const s = single.current
    if (s !== null && e.pointerId === s.id) {
      if (!s.moved) {
        // 余白タップ: 1回目=選択解除、~300ms 内の近接2回目=整列（ダブルタップ）。
        const now = Date.now()
        const prev = lastBlankTap.current
        if (prev && now - prev.t < DOUBLE_TAP_MS && Math.hypot(s.startX - prev.x, s.startY - prev.y) < DOUBLE_TAP_SLOP_PX) {
          lastBlankTap.current = null
          props.onDoubleTapFit?.()
        } else {
          lastBlankTap.current = { t: now, x: s.startX, y: s.startY }
          props.onDeselect()
        }
      }
      single.current = null
    }
  }

  return (
    <div
      ref={viewportRef}
      className={styles.viewport}
      style={{ zIndex: BOARD_Z_INDEX.SHARE_CANVAS }}
      data-testid="mobile-arrange-viewport"
      onPointerDownCapture={handlePointerDownCapture}
      onPointerMoveCapture={handlePointerMoveCapture}
      onPointerUpCapture={handlePointerEndCapture}
      onPointerCancelCapture={handlePointerEndCapture}
    >
      <div
        className={styles.stage}
        data-testid="mobile-arrange-stage"
        style={{ transform: `translate(${props.transform.tx}px, ${props.transform.ty}px) scale(${props.transform.scale})` }}
      >
        {props.children}
      </div>
    </div>
  )
}
