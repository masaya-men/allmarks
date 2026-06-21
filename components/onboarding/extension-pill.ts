// components/onboarding/extension-pill.ts
//
// The AllMarks extension's cursor-pill animation helpers, ported verbatim from
// extension/content.js (L81-132). Shared by the two onboarding extension demos
// (ExtensionSaveReenactment = saving on a page, ExtensionXSaveReenactment = the
// X bookmark → auto-save), so the pill behaves exactly like the real extension
// in both. The look comes from extension-ui.css (.booklage-pill*).

/** Pill icon markup — a spinning ring (saving) and a green check (saved). */
export const PILL_ICONS: Record<string, string> = {
  ring: '<span class="ring"></span>',
  check: '<svg viewBox="0 0 24 24" class="check"><path d="M5 12 L10 17 L19 7"/></svg>',
}
export const PILL_STATE_LABEL: Record<string, string> = { saving: 'Saving', saved: 'Saved' }
export const PILL_STATE_ICON: Record<string, string> = { saving: 'ring', saved: 'check' }

/** Per-char rise → morph to a single text node → 700ms RGB glitch
 *  (extension/content.js:81-111). Returns timer ids so the caller can clear them. */
export function setPillLabelAnimated(stateEl: HTMLElement, finalText: string): number[] {
  const timers: number[] = []
  stateEl.classList.remove('is-glitching')
  stateEl.setAttribute('data-glitch-text', finalText)
  stateEl.innerHTML = ''
  for (let i = 0; i < finalText.length; i++) {
    const span = document.createElement('span')
    span.className = 'booklage-pill__char'
    span.textContent = finalText[i] === ' ' ? ' ' : finalText[i]
    span.style.animationDelay = `${i * 22}ms`
    stateEl.appendChild(span)
  }
  const slideEnd = (finalText.length - 1) * 22 + 320
  timers.push(window.setTimeout(() => {
    stateEl.textContent = finalText
    stateEl.classList.add('is-glitching')
    timers.push(window.setTimeout(() => stateEl.classList.remove('is-glitching'), 700))
  }, slideEnd + 40))
  return timers
}

/** Re-fire the per-state CSS animation (extension/content.js:113-132): clear
 *  data-state, force a reflow, re-set it, swap the icon, re-animate the label. */
export function applyPillState(pill: HTMLElement, iconEl: HTMLElement, stateEl: HTMLElement, state: string): number[] {
  pill.setAttribute('data-state', '')
  void pill.offsetWidth
  pill.setAttribute('data-state', state)
  iconEl.innerHTML = PILL_ICONS[PILL_STATE_ICON[state]] ?? ''
  return setPillLabelAnimated(stateEl, PILL_STATE_LABEL[state] ?? '')
}
