// Decide whether the host-page quick-tag strip should be shown after a save.
// Source of truth: the save reply from /save-iframe carries `quickTagEnabled`
// (whole-feature ON/OFF from app IDB) and `pipActive` (a PiP window is open).
// - feature OFF        -> never show the strip (plain save confirmation only)
// - PiP open           -> never show on the host page; the PiP card handles
//                         tagging instead, so the two surfaces don't collide
// Missing fields are treated as the permissive default (older /save-iframe
// builds that predate this field still show the strip).
export function shouldSendQuickTag(result) {
  const enabled = result && result.quickTagEnabled !== false
  const pipOpen = !!(result && result.pipActive)
  return enabled && !pipOpen
}
