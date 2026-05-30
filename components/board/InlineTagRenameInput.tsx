'use client'

import type { ReactElement } from 'react'
import { useInlineTagRename } from '@/lib/board/use-inline-tag-rename'

type Props = {
  /** Current tag name, pre-filled + selected on focus. */
  readonly currentName: string
  /** Names of every OTHER tag (case-insensitive duplicate guard). */
  readonly otherNames: readonly string[]
  /** Fired once with the trimmed new name on a valid commit. */
  readonly onSubmit: (name: string) => void
  /** Fired once when the edit is abandoned (Esc / invalid blur). */
  readonly onCancel: () => void
  /** className for the <input> so each surface keeps its own typography. */
  readonly className?: string
  /** className applied additionally while the value duplicates another tag. */
  readonly duplicateClassName?: string
  readonly 'data-testid'?: string
}

/** The in-place rename field. Wraps {@link useInlineTagRename} so the field
 *  can live inside a `.map()` (hooks can't be called conditionally). Used by
 *  both the filter dropdown rows and the triage chips; the caller supplies the
 *  className so each surface keeps its own look. */
export function InlineTagRenameInput({
  currentName, otherNames, onSubmit, onCancel, className, duplicateClassName, ...rest
}: Props): ReactElement {
  const { isDuplicate, inputProps } = useInlineTagRename({
    currentName, otherNames, onSubmit, onCancel,
  })
  const cls = [className, isDuplicate ? duplicateClassName : null].filter(Boolean).join(' ')
  return (
    <input
      {...inputProps}
      className={cls || undefined}
      data-testid={rest['data-testid']}
      data-duplicate={isDuplicate ? 'true' : undefined}
    />
  )
}
