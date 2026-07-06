'use client'

import { useEffect, useRef, useState, type PointerEvent, type ReactElement } from 'react'
import {
  moveTitle,
  resolveTitleText,
  setTitleSize,
  type ShareTitleConfig,
} from '@/lib/share/share-title'
import { INTERACTION } from '@/lib/board/constants'
import typo from './BoardBackgroundTypography.module.css'
import styles from './ShareTitleElement.module.css'

export type ShareTitleElementProps = {
  readonly config: ShareTitleConfig
  /** The current filter's tag name (or app-level label) — shown when
   *  `config.text` is `null` (= user hasn't retitled yet). */
  readonly defaultText: string
  readonly onChange: (next: ShareTitleConfig) => void
}

/** Font-size growth per pixel of pointer travel while dragging the corner
 *  handle. >1 so the user can reach TITLE_MIN_PX..TITLE_MAX_PX without
 *  dragging across the whole screen (mirrors ResizeHandle's SENSITIVITY). */
const RESIZE_SENSITIVITY = 2.0

/**
 * Editable / draggable / corner-resizable collage title for the SHARE arrange
 * stage (phase 2). Reuses BoardBackgroundTypography's `.text` CSS class so the
 * wordmark's font/weight/letter-spacing/paper-kasure treatment matches the
 * board's background typography exactly, but is otherwise a fully separate
 * component — BoardBackgroundTypography keeps its "mounted == visible, no
 * state" reliability contract untouched.
 *
 * Visibility is a pure function of props/state (never animation-driven, per
 * repo convention): hidden when `!config.enabled`, OR when the resolved text
 * is empty AND the user isn't mid-edit (so clearing the last character while
 * typing doesn't yank the contentEditable node out from under the caret —
 * only committing the empty state on blur hides it).
 *
 * The text span is an UNCONTROLLED contentEditable: its `textContent` is
 * synced imperatively (via ref, only while not focused) rather than through
 * JSX children, which would reset the caret to the start on every keystroke.
 */
export function ShareTitleElement(props: ShareTitleElementProps): ReactElement | null {
  const { config, defaultText, onChange } = props
  const textRef = useRef<HTMLSpanElement>(null)
  const [isEditing, setIsEditing] = useState<boolean>(false)

  const text = resolveTitleText(config, defaultText)

  // Keep the contentEditable span's textContent in sync with resolved state,
  // but only while it isn't the live edit target — otherwise every re-render
  // would stomp the caret back to position 0 mid-typing.
  useEffect(() => {
    const el = textRef.current
    if (!el) return
    if (document.activeElement === el) return
    if (el.textContent !== text) el.textContent = text
  })

  if (!config.enabled) return null
  if (text === '' && !isEditing) return null

  function handleInput(): void {
    const el = textRef.current
    onChange({ ...config, text: el?.textContent ?? '' })
  }

  function handleRootPointerDown(e: PointerEvent<HTMLDivElement>): void {
    if (e.button !== 0) return
    const root = e.currentTarget
    const pointerId = e.pointerId
    const startX = e.clientX
    const startY = e.clientY
    const originX = config.x
    const originY = config.y
    let moved = false

    try {
      root.setPointerCapture(pointerId)
    } catch {
      /* jsdom / synthetic pointer — capture isn't critical for the gesture itself */
    }

    const move = (ev: globalThis.PointerEvent): void => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!moved && Math.hypot(dx, dy) < INTERACTION.DRAG_THRESHOLD_PX) return
      moved = true
      ev.preventDefault()
      onChange(moveTitle(config, originX + dx, originY + dy))
    }

    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      try {
        if (root.hasPointerCapture(pointerId)) root.releasePointerCapture(pointerId)
      } catch {
        /* jsdom / synthetic pointer */
      }
      // A click (no movement past the threshold) enters edit mode; a drag
      // that actually moved the title does not steal focus into editing.
      if (!moved) textRef.current?.focus()
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  function handleCornerPointerDown(e: PointerEvent<HTMLDivElement>): void {
    if (e.button !== 0) return
    // Grabbing the corner must never also start a title drag.
    e.stopPropagation()
    e.preventDefault()
    const corner = e.currentTarget
    const pointerId = e.pointerId
    const startX = e.clientX
    const startSize = config.size

    try {
      corner.setPointerCapture(pointerId)
    } catch {
      /* jsdom / synthetic pointer */
    }

    const move = (ev: globalThis.PointerEvent): void => {
      onChange(setTitleSize(config, startSize + (ev.clientX - startX) * RESIZE_SENSITIVITY))
    }

    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      try {
        if (corner.hasPointerCapture(pointerId)) corner.releasePointerCapture(pointerId)
      } catch {
        /* jsdom / synthetic pointer */
      }
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  return (
    <div
      className={styles.root}
      data-testid="share-title-element"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transform: `translate(${config.x}px, ${config.y}px) translate(-50%, -50%)`,
        pointerEvents: 'auto',
        cursor: 'grab',
        touchAction: 'none',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
      onPointerDown={handleRootPointerDown}
    >
      <span
        ref={textRef}
        className={typo.text}
        contentEditable
        suppressContentEditableWarning
        data-testid="share-title-text"
        data-wordmark-text={text}
        style={{ fontSize: `${config.size}px`, outline: 'none' }}
        onInput={handleInput}
        onFocus={(): void => setIsEditing(true)}
        onBlur={(): void => setIsEditing(false)}
      />
      <div
        className={styles.resizeCorner}
        data-testid="share-title-resize-corner"
        onPointerDown={handleCornerPointerDown}
      />
    </div>
  )
}
