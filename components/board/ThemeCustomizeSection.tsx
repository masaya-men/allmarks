'use client'

import type { ReactElement } from 'react'
import type { ThemeCustomization, PatternType } from '@/lib/board/types'
import type { ResolvedThemeCustomization } from '@/lib/board/theme-customization'
import {
  PATTERN_TYPES,
  PATTERN_SIZE_MIN,
  PATTERN_SIZE_MAX,
  PATTERN_STROKE_MIN,
  PATTERN_STROKE_MAX,
  swatchesForScheme,
} from '@/lib/board/theme-customization'
import styles from './ThemeCustomizeSection.module.css'

export interface ThemeCustomizeSectionProps {
  /** Effective (defaults + overrides) values for the active pattern theme. */
  readonly value: ResolvedThemeCustomization
  /** True when the theme is at its byte-identical baseline (hides reset). */
  readonly isDefault: boolean
  /** Whether to show the pattern controls (style / pattern colour / density). */
  readonly allowsPattern: boolean
  /** The active theme's board world, which selects the colour swatch presets:
   *  'dark' = Sound Wave's darks, 'light' = Flat's light editorial palette. */
  readonly colorScheme: 'dark' | 'light'
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
export function ThemeCustomizeSection({ value, isDefault, allowsPattern, colorScheme, onChange }: ThemeCustomizeSectionProps): ReactElement {
  const sw = swatchesForScheme(colorScheme)
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

      {/* Pattern style — grid/dots/etc. are a customization of the live-world
          'pattern' themes (Sound Wave, Flat), not a separate theme. */}
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

      <ColorRow label="EDGE" swatches={sw.edge} active={value.edgeColor} onPick={(c): void => onChange({ edgeColor: c })} />
      <ColorRow label="BOARD" swatches={sw.board} active={value.boardColor} onPick={(c): void => onChange({ boardColor: c })} />
      <ColorRow label="TITLE" swatches={sw.title} active={value.titleColor} onPick={(c): void => onChange({ titleColor: c })} />

      {allowsPattern && (
        <>
          <ColorRow label="PATTERN" swatches={sw.pattern} active={value.patternColor} onPick={(c): void => onChange({ patternColor: c })} />

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

          {/* Thickness — stroke width for the line patterns, dot radius for dots.
              Right = thicker (DENSITY inverts; this one must not). */}
          <div className={styles.row}>
            <span className={styles.rowLabel}>THICKNESS</span>
            <input
              type="range"
              className={styles.slider}
              min={PATTERN_STROKE_MIN}
              max={PATTERN_STROKE_MAX}
              // 0.2, not 0.5: dots rest at r=1.4, and an off-step value can't be
              // dialled back once the user drags away from it.
              step={0.2}
              value={value.patternStroke}
              onChange={(e): void => onChange({ patternStroke: Number(e.target.value) })}
              aria-label="Pattern thickness"
              data-testid="pattern-thickness"
            />
          </div>
        </>
      )}
    </section>
  )
}
