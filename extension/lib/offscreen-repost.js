// Idempotent re-post pump for the offscreen → allmarks.app-iframe bridge.
//
// WHY THIS EXISTS (N-15 — "first save after a browser restart fails"):
// The offscreen document forwards a save / add-tag envelope to the embedded
// allmarks.app iframe with iframe.contentWindow.postMessage(). On a cold
// browser start the iframe is a Next.js page whose `message` listener is only
// attached after its React app hydrates (inside a useEffect), which can take
// SECONDS. A window.postMessage delivered to a window that has not yet attached
// a matching listener is DROPPED — the platform does not buffer it for a
// listener that shows up later. So a single post is silently lost and the first
// save after a restart fails (or, on faster machines, only succeeds after a
// long stall because dispatch.js closes+recreates the offscreen and retries).
//
// The fix: keep re-posting the SAME envelope on a short interval until the
// iframe answers (its nonce leaves the offscreen router's pending map) or a
// hard deadline elapses. The iframe dedupes every save/add-tag by nonce, so
// redundant posts can never produce a second bookmark — only the first delivery
// that lands after the listener is up is processed; earlier (dropped) copies
// never arrived and later duplicates are ignored.

// Re-post cadence. Short enough to feel instant once the iframe is ready, but
// not a tight loop. Cold-start hydration is typically a few hundred ms.
export const REPOST_INTERVAL_MS = 250

// Hard deadline for one forward attempt. Matches the previous single-shot
// timeout; dispatch.js still retries once on timeout, so the worst case for a
// genuinely dead bridge is unchanged (~two deadlines) while the common
// cold-start case now succeeds within the first deadline instead of failing.
export const FORWARD_DEADLINE_MS = 8000

/**
 * Per-tick decision for the re-post pump. Kept pure so it is unit-testable
 * without real timers.
 *
 * @param {{ pending: boolean, elapsedMs: number, deadlineMs: number }} state
 *   pending    — is the nonce still awaiting an answer from the iframe?
 *   elapsedMs  — time since the pump started
 *   deadlineMs — hard deadline for this forward attempt
 * @returns {'stop' | 'timeout' | 'repost'}
 *   'stop'    — the iframe answered; stop the pump (an answer wins over the
 *               deadline so a save that just landed is never reported as a
 *               timeout)
 *   'timeout' — the deadline elapsed with no answer; fire the timeout path
 *   'repost'  — still waiting under the deadline; re-post and keep going
 */
export function repostTickDecision(state) {
  if (!state.pending) return 'stop'
  if (state.elapsedMs >= state.deadlineMs) return 'timeout'
  return 'repost'
}

/**
 * Start the re-post pump. Posts once immediately, then re-posts every
 * intervalMs until the iframe answers or the deadline elapses.
 *
 * @param {object} opts
 * @param {() => void} opts.post         Post the envelope to the iframe.
 * @param {() => boolean} opts.isPending True while the nonce awaits an answer.
 * @param {() => void} opts.onTimeout    Called once if the deadline elapses.
 * @param {number} [opts.intervalMs]     Re-post cadence (default REPOST_INTERVAL_MS).
 * @param {number} [opts.deadlineMs]     Hard deadline (default FORWARD_DEADLINE_MS).
 * @returns {() => void} cancel — stop the pump early (no further posts/timeout).
 */
export function startRepostPump({
  post,
  isPending,
  onTimeout,
  intervalMs = REPOST_INTERVAL_MS,
  deadlineMs = FORWARD_DEADLINE_MS,
}) {
  post() // immediate first attempt (the one dropped on a cold start)
  let elapsedMs = 0
  const iv = setInterval(() => {
    elapsedMs += intervalMs
    const action = repostTickDecision({ pending: isPending(), elapsedMs, deadlineMs })
    if (action === 'stop' || action === 'timeout') {
      clearInterval(iv)
      if (action === 'timeout') onTimeout()
      return
    }
    post()
  }, intervalMs)
  return () => clearInterval(iv)
}
