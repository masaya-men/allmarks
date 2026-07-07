'use client'

import { type ReactElement } from 'react'
import { PRESETS, findActivePreset, type PresetId } from '@/lib/board/tune-presets'
import styles from './TunePresetColumn.module.css'

type Props = {
  readonly widthPx: number
  readonly gapPx: number
  readonly onApply: (id: PresetId) => void
  /** Card corner style. true = rounded, false = square. */
  readonly roundedCorners: boolean
  readonly onToggleCorners: () => void
}

export function TunePresetColumn({
  widthPx,
  gapPx,
  onApply,
  roundedCorners,
  onToggleCorners,
}: Props): ReactElement {
  const activeId = findActivePreset(widthPx, gapPx)

  return (
    <div className={styles.column}>
      <div className={styles.presets} role="radiogroup" aria-label="Board density presets">
        {PRESETS.map((preset) => {
          const isActive = preset.id === activeId
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={preset.label}
              className={styles.presetRow}
              onClick={(): void => {
                if (!isActive) onApply(preset.id)
              }}
            >
              <span
                className={`${styles.led} ${isActive ? styles.ledOn : ''}`}
                aria-hidden="true"
              />
              <span
                className={`${styles.lever} ${isActive ? styles.leverDown : ''}`}
                aria-hidden="true"
              >
                <span className={styles.handle} />
              </span>
              <span className={styles.label}>{preset.label}</span>
            </button>
          )
        })}
      </div>
      {/* CORNERS toggle — a switch in the same lever/LED language as the preset
          rows, but a boolean (ROUND / SQUARE) rather than a density radio. Sits
          under the presets, above the maker mark, so the shorter left column
          uses its spare height without growing the drawer. */}
      <button
        type="button"
        role="switch"
        aria-checked={roundedCorners}
        aria-label="Card corners"
        className={styles.cornersRow}
        data-testid="tune-corners-toggle"
        onClick={onToggleCorners}
      >
        <span
          className={`${styles.led} ${roundedCorners ? styles.ledOn : ''}`}
          aria-hidden="true"
        />
        <span
          className={`${styles.lever} ${roundedCorners ? styles.leverDown : ''}`}
          aria-hidden="true"
        >
          <span className={styles.handle} />
        </span>
        <span className={styles.cornerLabelWrap}>
          <span className={styles.label}>CORNERS</span>
          <span
            className={`${styles.cornerState} ${roundedCorners ? styles.cornerStateOn : ''}`}
          >
            {roundedCorners ? 'ROUND' : 'SQUARE'}
          </span>
        </span>
      </button>
      <div className={styles.maker} aria-hidden="true">
        ALLMARKS · MK-1
      </div>
    </div>
  )
}
