export const LAYOUT_CONFIG = {
  TARGET_ROW_HEIGHT_PX: 180,
  GAP_PX: 4,
  CONTAINER_MARGIN_PX: 16,
} as const

/**
 * Page-level cluster constraints. The cards arrange within a centered column
 * of width `min(viewport.w, MAX_WIDTH_PX) - 2 * SIDE_PADDING_PX` so the
 * background remains visible at the edges (mymind / Pinterest / Are.na pattern).
 */
/** destefanis is full-viewport edge-to-edge (no max-width cap). MAX_WIDTH_PX
 *  is intentionally a massive value so `Math.min(availableWidth, MAX)` always
 *  picks `availableWidth`. SIDE_PADDING_PX = COLUMN_MASONRY.GAP_PX / 2 so the
 *  outer card edges sit a half-gap from the viewport edge, mirroring the inner
 *  gap rhythm (destefanis applies `+gap/2` to x positions). */
export const BOARD_INNER = {
  MAX_WIDTH_PX: 999_999,
  SIDE_PADDING_PX: 9,
} as const

/** Top breathing room above the first row of cards inside the canvas (= keeps
 *  cards from colliding with the toolbar pill / scrim). Matches the value
 *  applied in BoardRoot's cards wrapper transform. */
export const BOARD_TOP_PAD_PX = 80

/** Chrome Web Store listing URL for the AllMarks browser extension. Empty
 *  until the extension is published (gated behind the domain move / store
 *  review). While empty, the board's GET EXTENSION entry shows a quiet
 *  "coming soon" affordance instead of a dead link — fill this in on launch
 *  day and the public install promo lights up automatically. Typed as
 *  `string` (not a literal) so toggling the value never makes the empty-check
 *  comparisons in consumers a TS2367 "always true/false" error. */
export const EXTENSION_STORE_URL: string = 'https://chromewebstore.google.com/detail/allmarks/gefnpfbjnlbhgomlfcfalnbdlenpmpcg'

/** Outer frame padding around the inner dark canvas (= --canvas-margin in
 *  globals.css). Kept here as a runtime constant so non-CSS consumers (e.g.
 *  ShareMirror, which reproduces the bg structure at scale) can apply it
 *  without parsing CSS vars. Must stay in sync with --canvas-margin. */
export const CANVAS_MARGIN_PX = 48

/** Viewport width (window CSS px) at/below which the board switches to its
 *  MOBILE presentation: a thinner frame, an N-column masonry sized to the
 *  narrow canvas, and stacked/pruned header chrome. Must match the
 *  `@media (max-width: 640px)` breakpoint used in the board CSS. Desktop
 *  (> 640px) is untouched — every mobile branch is gated on this value, so the
 *  default board stays byte-identical above the breakpoint. */
export const MOBILE_BP_PX = 640

/** Mobile-only board layout, applied at DISPLAY time only (never written to the
 *  user's stored card-width / card-gap or IDB BoardConfig — the desktop dial is
 *  preserved and simply overridden while the viewport is narrow). Per the user's
 *  s178 direction the mobile board is FULL-BLEED (no outer frame) and packs a
 *  dense uniform N-column masonry with tight gaps; per-card free-resize widths
 *  are ignored on mobile so the columns stay even. COLUMNS is decided on a real
 *  phone at A5 (user asked for 3 or 4) — both work; the widths recompute from
 *  the live container width, so only this number (and GAP) change. */
export const MOBILE_LAYOUT = {
  COLUMNS: 3,
  GAP_PX: 14,
  /** Left/right breathing room inside the canvas. A 3-column grid packed edge to
   *  edge covered the board, so the theme the user chose — pattern, board colour
   *  — never showed on a phone (N-51). Mirrored in SharedBoard.module.css's
   *  mobile block for the share receiver. */
  SIDE_MARGIN_PX: 16,
  /** Full-bleed on mobile: no outer frame margin (vs 48 on desktop). Mirrored in
   *  globals.css `@media (max-width: 640px)` as `--canvas-margin: 0`. */
  CANVAS_MARGIN_PX: 0,
} as const

export const RESIZE = {
  MIN_PX: 80,
  MAX_PX: 1200,
  HANDLE_SIZE_PX: 10,
  EDGE_HANDLE_SIZE_PX: 10,
} as const

export const CULLING = {
  BUFFER_SCREENS: 1.0,
} as const

export const BOARD_Z_INDEX = {
  THEME_BG: 0,
  FRAME_MASK: 5,
  CARDS: 10,
  CARD_DECORATION: 11,  // paper-atelier per-card overlay (pointer-events:none, above thumbnail, below interactive chrome)
  EMPTY_STATE: 12,
  FRAME_BORDER: 15,
  PAPER_CHROME: 16,  // Paper-atelier decorative frame plate + wax seal (pointer-events:none, below TOOLBAR:110)
  INTERACTION_OVERLAY: 20,
  SNAP_GUIDES: 25,
  RESIZE_HANDLE: 30,
  SELECTION_OUTLINE: 31,
  ROTATION_HANDLE: 32,
  DROP_INDICATOR: 40,
  CONTEXT_MENU: 90,
  SHARE_CANVAS: 95,  // SHARE stage-2 (arrange) collage layer — above the canvas edge scrims (BoardRoot.module.css .canvas::before/::after z:80) + THEME_BG, below TOOLBAR (110) + SHARE_TOAST (116). isolation:isolate on CollageCanvas .root contains its INTRA_CANVAS_Z_BASE (~10+) order.
  SHARE_BAND_OVERLAY: 96,  // スマホ編集段の「撮影される帯」ガイド — SHARE_CANVAS(95) の直上・DRAG_GHOST(100) 未満。pointer-events:none で編集を邪魔しない。
  SHARE_RESULT_SCRIM: 399, // スマホ結果シート表示中にコラージュへのタッチを遮る透明盾 (N-55) — SHARE_CANVAS(95) より上・SHARE_TOAST(402) 未満。
  DRAG_GHOST: 100,
  TOOLBAR: 110,
  SHARE_SELECT_BAR: 401,  // selective-share bottom bar — ABOVE the scroll meter (400) so it isn't covered during the select stage (s170); below CHROME_DRAWER (405). The select stage keeps the meter visible (unlike arrange, which hides it), so the bar must out-stack it.
  SHARE_TOAST: 402,  // collage-screenshot SHARE arrange-stage bottom bar — above select-bar + scroll meter, below CHROME_DRAWER (405)
  SHARE_ARRANGE_TOOLBAR: 402,  // mobile collage arrange TOP bar (undo/redo + selection tools). Same tier as SHARE_TOAST (bottom bar) — they don't overlap (top vs bottom). data-no-capture.
  POPOVER: 120,
  SAVE_BUTTON: 125,  // mobile/tablet floating "+" save button (above POPOVER 120, below UNDO_TOAST 130). Touch devices only.
  UNDO_TOAST: 130,
  PASTE_FEEDBACK: 135,
  LANGUAGE_SWITCHER: 140,
  TOUCH_BOTTOM_BAR: 150,  // fixed bottom action bar on touch surfaces (receiver's IMPORT bar). Above the canvas scrims (80) / TOOLBAR (110) / POPOVER (120); below MODAL_OVERLAY (200), the import overlay + Lightbox (both raw 300). Same tier as BoardMobileNav's raw 150.
  MODAL_OVERLAY: 200,  // App-level modal overlay (Bookmarklet install, etc.)
  SCROLL_METER: 400,   // sound-wave scroll/counter meter. Board: positioned by the outer-frame bottom band; receive view (SharedBoard): its own canvas-bottom anchor. Mirrors the raw z-index:400 in ScrollMeter/BoardRoot CSS.
  TAG_PANEL: 403,      // TAG MODE right-edge tag panel (drag-drop tagging) — above the meter + share bars, below CHROME_DRAWER (405).
  /** 統一右ドロワー（TUNE/SETTINGS/SHARE/THEMES）。ScrollMeter(400) の上、onboarding ring(410) の下。 */
  CHROME_DRAWER: 405,
  DATA_HOME: 205,       // first-run "your data lives here" card (after onboarding, below CHROME_DRAWER 405)
  SAVE_SHEET: 208,   // mobile/tablet URL input sheet (modal tier: above MODAL_OVERLAY 200 / DATA_HOME 205, below ONBOARDING 210).
  BACKUP_REMINDER: 195, // periodic backup nudge toast (below DATA_HOME + drawer)
  ONBOARDING: 210,     // First-run tutorial overlay (above MODAL_OVERLAY)
  ONBOARDING_SPOTLIGHT_RING: 410,  // portalled spotlight ring — above the unified CHROME_DRAWER (405) so the ring shows on a target INSIDE that drawer
  SHARE_CREATING: 500,  // body-portal "creating your link…" indicator (outside the capture subtree; above all board chrome)
} as const

export const INTERACTION = {
  DRAG_THRESHOLD_PX: 4,
  WHEEL_SCROLL_MULTIPLIER: 1.0,
  EMPTY_DRAG_SCROLL_MULTIPLIER: 1.0,
} as const

export const SNAP = {
  EDGE_ALIGNMENT_TOLERANCE_PX: 5,
  INSERT_SLOT_ACTIVATION_PX: 12,
  SPACING_EQUAL_TOLERANCE_PX: 3,
} as const

export const ROTATION = {
  SNAP_STEP_DEG: 15,
  AUTO_RANDOM_RANGE_DEG: 5,       // ±5° 自動微傾
  HANDLE_OFFSET_ABOVE_CARD_PX: 24,
  HANDLE_SIZE_PX: 14,
} as const

export const Z_ORDER = {
  AUTO_TOUCHED_TOP: true,
  LOCK_KEY: 'l',
  FORWARD_KEY: ']',
  BACKWARD_KEY: '[',
  FORWARD_STEP_KEY: { key: ']', modifier: 'ctrl' },
  BACKWARD_STEP_KEY: { key: '[', modifier: 'ctrl' },
} as const

export const FRAME = {
  MIN_PX: 200,
  MAX_PX: 5000,
  BORDER_PX: 1.5,
  BORDER_COLOR: 'rgba(0, 0, 0, 0.3)',
  OUTSIDE_OVERLAY_BG: 'rgba(210, 210, 210, 0.55)',
  OUTSIDE_SATURATE: 0.2,
} as const

export const MODE_TRANSITION = {
  MORPH_MS: 400,
  EASING: 'power2.inOut',
} as const

export const UNDO = {
  TOAST_DURATION_MS: 10_000,
} as const

export const PERF = {
  TARGET_FPS: 60,
  MAX_LAYOUT_MS_1000_CARDS: 16,
} as const

/** destefanis: 5 columns at typical desktop viewports, 18px gaps.
 *  TARGET_COLUMN_UNIT_PX is the desired column width — masonry picks the column
 *  count that gets nearest. With 280 target, sidebar 240, viewport 1900 →
 *  available 1660, picks 5 columns of ~314px each (destefanis-like). */
export const COLUMN_MASONRY = {
  TARGET_COLUMN_UNIT_PX: 280,
  GAP_PX: 18,
} as const

/** Board-wide card width and gap controlled by the header sliders.
 *  CARD_WIDTH_DEFAULT_PX = 267 was originally derived for a dense
 *  5-column layout at the developer's canvasWrap width with G=18.
 *  Session 30 (= 全画面化 visual pivot) では default を 「最密 5 列
 *  thumbnail wall」 から 「4 列 + 大きな gap でカード呼吸 + 背景タイポ
 *  透過」 に転換。 W は据置 267 (= カード 1 枚の親密感は維持)、
 *  G を 18 → 97 に拡大して 4 列 gallery 密度に。 ミッション 「整理ツール
 *  ではなく 表現ツール」 (CLAUDE.md) を default で体現する転換。
 *
 *  Session 39 (= NNNN.NN slider 表示 + 10× slowdown と同時): user が
 *  prod で精密に dial して 「これがぴったり」 と決めた 2 decimal default
 *  (= W 267.84 / G 97.21) に更新。 Reset button restores both to these.
 *  実値の物理的な意味は変わらないが、 user が見て「default」 とラベル
 *  された数字を正確に再現できるようになる。 */
export const BOARD_SLIDERS = {
  CARD_WIDTH_DEFAULT_PX: 267.84,
  CARD_WIDTH_MIN_PX: 120,
  CARD_WIDTH_MAX_PX: 720,
  CARD_GAP_DEFAULT_PX: 97.21,
  CARD_GAP_MIN_PX: 0,
  CARD_GAP_MAX_PX: 300,
} as const

/**
 * Share-wire encoding only. The board itself uses continuous `cardWidth`
 * (lib/board/size-migration.ts); this column-span map is kept for the
 * legacy 'S' | 'M' | 'L' wire format consumed by composer-layout and
 * relay-layout, where preserving the original 1/2/3-column behavior is
 * required for backward-compat with already-shared URLs.
 */
export const SIZE_PRESET_SPAN: Readonly<Record<'S' | 'M' | 'L', number>> = {
  S: 1,
  M: 2,
  L: 3,
}

/** SHARE アレンジ（自由配置キャンバス）の安全領域インセット（px）。値は「見える
 *  盤面パネル（.canvas＝ウィンドウから CANVAS_MARGIN_PX 内側）」の内側からの余白で、
 *  BoardRoot が canvas パネル矩形に対して適用する（ウィンドウ全面ではない）。こうする
 *  ことで端のカードがパネル（紙の額）からはみ出さない。上＝盤面ヘッダー行（TITLE/TUNE
 *  …/SHARE）、下＝ShareToast（下部バー）、左右＝パネル端の余白。fitSelectionToScreen は
 *  この内側に全カードを収める。 */
export const ARRANGE_SAFE_INSET = {
  TOP_PX: 56,
  BOTTOM_PX: 72,
  SIDE_PX: 16,
} as const
