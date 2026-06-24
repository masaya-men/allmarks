export type ScrollDirection = 'vertical' | 'horizontal' | '2d' | 'sphere'

export type ThemeId = 'dotted-notebook' | 'grid-paper' | 'paper-atelier'

export type CardPosition = {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export type LayoutCard = {
  readonly id: string
  readonly aspectRatio: number
  readonly userOverridePos?: CardPosition
}

export type LayoutInput = {
  readonly cards: ReadonlyArray<LayoutCard>
  readonly viewportWidth: number
  readonly targetRowHeight: number
  readonly gap: number
  readonly direction: ScrollDirection
}

export type LayoutResult = {
  readonly positions: Readonly<Record<string, CardPosition>>
  readonly totalHeight: number
  readonly totalWidth: number
}

export type InteractionState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'scrolling' }
  | {
      readonly kind: 'card-dragging'
      readonly cardId: string
      readonly startX: number
      readonly startY: number
    }
  | {
      readonly kind: 'card-resizing'
      readonly cardId: string
      readonly startW: number
      readonly startH: number
    }

export type ThemeLayoutParams = {
  readonly targetRowHeight?: number
  readonly gap?: number
}

export type ThemeMeta = {
  readonly id: ThemeId
  readonly direction: ScrollDirection
  readonly backgroundClassName: string
  readonly labelKey: string
  /** Base color scheme — drives color-scheme + which token block applies. */
  readonly colorScheme: 'light' | 'dark'
  /** Entitlement tier. 'free' = always available; 'paid' = needs a license. */
  readonly tier: 'free' | 'paid'
  /**
   * ScrollMeter rendering style. 'waveform' = the default sound-wave bars;
   * 'ruler' = the paper-atelier brass ruler track. Read by ScrollMeter's
   * `variant` prop (default 'waveform') so omitting it is impossible (required).
   */
  readonly scrollMeterVariant: 'waveform' | 'ruler'
  /**
   * Per-theme animation keys (NOT ThemeIds — a decoupled namespace:
   * 'wave' | 'paper-drift' | 'paper-fade' | 'ink-underline' | 'glitch-crt').
   * Consumers resolve via getEntryAnimation/getShutdownAnimationClass/getTextTransition.
   * @property entry    card + background-typography enter animation key
   * @property text     Lightbox tweet-translation text-transition key
   * @property shutdown card + background-typography MOTION-off exit key
   */
  readonly motion: {
    readonly entry: string
    readonly text: string
    readonly shutdown: string
  }
  /**
   * When true, mount the pointer-events:none paper card-decoration overlay
   * (washi tape / pins / photo corners). Only paper-atelier sets it. Optional:
   * absence === no decorations.
   */
  readonly decorations?: boolean
  readonly layoutParams?: ThemeLayoutParams
}

export type FreePosition = {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly rotation: number        // degrees
  readonly zIndex: number          // 0 = auto (last-touched wins)
  readonly locked: boolean
  readonly isUserResized: boolean  // prevents aspectRatio recompute overwrite
}

export type FrameRatio =
  | { readonly kind: 'preset'; readonly presetId: string }
  | { readonly kind: 'custom'; readonly width: number; readonly height: number }

export type DisplayMode = 'visual' | 'editorial' | 'native'

export type FilterMode = 'and' | 'or'

/** Filter applied to the board.
 *  - all/inbox/archive/dead = the singleton-kind variants (no payload).
 *  - tags = arbitrary set of tag ids combined by AND or OR.
 *
 *  Persisted in IDB as part of BoardConfig (= settings/board-config record).
 *  Legacy v15 installs persisted a string union ('all'|...|`mood:${id}`);
 *  the v15 → v16 migration in lib/storage/indexeddb.ts rewrites them to
 *  this object shape so application code only ever sees the object form. */
export type BoardFilter =
  | { readonly kind: 'all' }
  | { readonly kind: 'inbox' }
  | { readonly kind: 'archive' }
  | { readonly kind: 'dead' }
  | { readonly kind: 'tags'; readonly tagIds: readonly string[]; readonly mode: FilterMode }

export type BoardConfig = {
  readonly frameRatio: FrameRatio
  readonly themeId: ThemeId
  readonly displayMode: DisplayMode
  readonly activeFilter: BoardFilter
  /** Tier 1 viewport-playback master switch. true = in-view video cards
   *  autoplay muted + multi-image cards cycle. Default true (reduced-motion
   *  users default false, set at hydrate time in BoardRoot). */
  readonly motionEnabled: boolean
  /** Background typography (the big wordmark / filter title behind the cards).
   *  true = shown on the board AND reproduced in the share image. Default true. */
  readonly bgTypoEnabled: boolean
}

export type SnapGuideLine =
  | { readonly kind: 'vertical'; readonly x: number; readonly y1: number; readonly y2: number }
  | { readonly kind: 'horizontal'; readonly y: number; readonly x1: number; readonly x2: number }
  | { readonly kind: 'spacing'; readonly label: string; readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number }

export type CardRightClickAction =
  | 'open' | 'mark-read' | 'delete'
  | 'move-folder'
  | 'z-forward' | 'z-backward' | 'z-front' | 'z-back'
  | 'lock'
