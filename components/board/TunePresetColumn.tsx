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
              <span className={styles.label}>{preset.label}</span>
              <span
                className={`${styles.lever} ${isActive ? styles.leverDown : ''}`}
                aria-hidden="true"
              >
                <span className={styles.handle} />
              </span>
              <span
                className={`${styles.led} ${isActive ? styles.ledOn : ''}`}
                aria-hidden="true"
              />
            </button>
          )
        })}
      </div>
      <div className={styles.maker} aria-hidden="true">
        ALLMARKS · MK-1
      </div>
    </div>
  )
}
