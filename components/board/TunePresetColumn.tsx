'use client'

import { type ReactElement } from 'react'
import { PRESETS, findActivePreset, type PresetId } from '@/lib/board/tune-presets'
import styles from './TunePresetColumn.module.css'

type Props = {
  readonly widthPx: number
  readonly gapPx: number
  readonly onApply: (id: PresetId) => void
}

export function TunePresetColumn({ widthPx, gapPx, onApply }: Props): ReactElement {
  const activeId = findActivePreset(widthPx, gapPx)

  return (
    <div className={styles.column} role="radiogroup" aria-label="Board density presets">
      {PRESETS.map((preset) => {
        const isActive = preset.id === activeId
        return (
          <button
            key={preset.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            className={`${styles.row} ${isActive ? styles.active : ''}`}
            onClick={(): void => {
              if (!isActive) onApply(preset.id)
            }}
          >
            <span className={styles.led} aria-hidden="true" />
            <span className={styles.label}>{preset.label}</span>
          </button>
        )
      })}
      <div className={styles.plate} aria-hidden="true">
        ALLMARKS
        <br />
        MK-1
      </div>
    </div>
  )
}
