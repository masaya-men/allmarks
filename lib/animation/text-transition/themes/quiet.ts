import type { TextTransition, PlayEntryArgs } from '../index'

/** Quiet text transition: no loading glitch, no CRT exit — the flat/still
 *  world just swaps the text (a plain, immediate set; entry is a no-op so the
 *  translated text simply appears). */
export function createQuietTransition(): TextTransition {
  return {
    loadingClass: null,
    exitClass: null,
    exitMs: 0,
    playEntry({ finalText, setText }: PlayEntryArgs): () => void {
      setText(finalText)
      return () => {}
    },
  }
}
