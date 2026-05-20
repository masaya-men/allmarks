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
            <div key={preset.id} className={styles.presetRow}>
              <span
                className={`${styles.led} ${isActive ? styles.ledOn : ''}`}
                aria-hidden="true"
              />
              <button
                type="button"
                role="radio"
                aria-checked={isActive}
                className={`${styles.button} ${isActive ? styles.buttonActive : ''}`}
                onClick={(): void => {
                  if (!isActive) onApply(preset.id)
                }}
              >
                {preset.label}
              </button>
            </div>
          )
        })}
      </div>
      <div className={styles.maker} aria-hidden="true">
        ALLMARKS · MK-1
      </div>
    </div>
  )
}
