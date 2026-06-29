'use client'

import type { ReactElement } from 'react'
import type { ThemeCustomization, PatternType } from '@/lib/board/types'
import type { ResolvedThemeCustomization } from '@/lib/board/theme-customization'
import {
  PATTERN_TYPES,
  PATTERN_SIZE_MIN,
  PATTERN_SIZE_MAX,
  EDGE_SWATCHES,
  BOARD_SWATCHES,
  PATTERN_SWATCHES,
} from '@/lib/board/theme-customization'
import styles from './ThemeCustomizeSection.module.css'

export interface ThemeCustomizeSectionProps {
  /** Effective (defaults + overrides) values for the active pattern theme. */
  readonly value: ResolvedThemeCustomization
  /** True when the theme is at its byte-identical baseline (hides reset). */
  readonly isDefault: boolean
  /** Whether to show the pattern controls (style / pattern colour / density).
   *  False = a pattern-free theme like Sound Wave: edge + board colour only. */
  readonly allowsPattern: boolean
  /** Merge a field change; null = reset the whole theme to defaults. */
  readonly onChange: (patch: ThemeCustomization | null) => void
}

const PATTERN_LABEL: Record<PatternType, string> = {
  none: 'NONE',
  grid: 'GRID',
  diagonal: 'DIAGONAL',
  dots: 'DOTS',
  crosshatch: 'CROSSHATCH',
}

/** One colour row: curated swatches + a native custom picker. */
function ColorRow({
  label,
  swatches,
  active,
  onPick,
}: {
  readonly label: string
  readonly swatches: ReadonlyArray<string>
  readonly active: string
  readonly onPick: (color: string) => void
}): ReactElement {
  const isCustom = !swatches.includes(active)
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <div className={styles.swatches}>
        {swatches.map((c) => (
          <button
            key={c}
            type="button"
            className={styles.colorSwatch}
            style={{ background: c }}
            aria-pressed={active === c}
            aria-label={`${label} ${c}`}
            onClick={(): void => onPick(c)}
          />
        ))}
        <label
          className={styles.customSwatch}
          data-active={isCustom ? 'true' : 'false'}
          title="Custom colour"
          style={isCustom ? { background: active } : undefined}
        >
          <span aria-hidden="true">+</span>
          <input
            type="color"
            className={styles.colorInput}
            onChange={(e): void => onPick(e.target.value)}
            aria-label={`${label} custom colour`}
          />
        </label>
      </div>
    </div>
  )
}

/**
 * CUSTOMIZE controls for a 'pattern' theme — pattern style + edge/board/pattern
 * colour + density. Changes apply live to the real board (the panel is
 * non-blocking, so the user watches it update behind). Mounted by
 * {@link ThemeModal} only while a pattern theme is active.
 */
export function ThemeCustomizeSection({ value, isDefault, allowsPattern, onChange }: ThemeCustomizeSectionProps): ReactElement {
  return (
    <section className={styles.section} data-testid="theme-customize">
      <div className={styles.headerRow}>
        <div className={styles.groupLabel}>CUSTOMIZE</div>
        {!isDefault && (
          <button
            type="button"
            className={styles.resetBtn}
            onClick={(): void => onChange(null)}
            data-testid="customize-reset"
          >
            RESET
          </button>
        )}
      </div>

      {/* Pattern style — only for themes whose identity is a pattern (Grid). */}
      {allowsPattern && (
        <div className={styles.row}>
          <span className={styles.rowLabel}>STYLE</span>
          <div className={styles.patternSwatches}>
            {PATTERN_TYPES.map((p) => (
              <button
                key={p}
                type="button"
                className={styles.patternSwatch}
                data-pattern={p}
                aria-pressed={value.patternType === p}
                aria-label={PATTERN_LABEL[p]}
                title={PATTERN_LABEL[p]}
                onClick={(): void => onChange({ patternType: p })}
                data-testid={`pattern-${p}`}
              >
                <span className={styles.patternPreview} data-pattern={p} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}

      <ColorRow label="EDGE" swatches={EDGE_SWATCHES} active={value.edgeColor} onPick={(c): void => onChange({ edgeColor: c })} />
      <ColorRow label="BOARD" swatches={BOARD_SWATCHES} active={value.boardColor} onPick={(c): void => onChange({ boardColor: c })} />

      {allowsPattern && (
        <>
          <ColorRow label="PATTERN" swatches={PATTERN_SWATCHES} active={value.patternColor} onPick={(c): void => onChange({ patternColor: c })} />

          {/* Density */}
          <div className={styles.row}>
            <span className={styles.rowLabel}>DENSITY</span>
            <input
              type="range"
              className={styles.slider}
              min={PATTERN_SIZE_MIN}
              max={PATTERN_SIZE_MAX}
              step={2}
              // Spacing px → density: invert so dragging RIGHT = denser (smaller gap).
              value={PATTERN_SIZE_MIN + PATTERN_SIZE_MAX - value.patternSize}
              onChange={(e): void => onChange({ patternSize: PATTERN_SIZE_MIN + PATTERN_SIZE_MAX - Number(e.target.value) })}
              aria-label="Pattern density"
              data-testid="pattern-density"
            />
          </div>
        </>
      )}
    </section>
  )
}
