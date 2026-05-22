# Ambient Frame Slideshow + Single Hero Video — Design

**Date:** 2026-05-22 (session 67)
**Status:** Approved (design), pending spec review → plan
**Supersedes:** the muted multi-video Tier 1 viewport autoplay (memory `project_tier1_viewport_playback`)
**Context:** 4K stutter is GPU-compositing (fill-rate) bound, not decode bound — fill cost scales with the on-screen PIXEL AREA of *playing* video, not its count (memory `project_4k_composite_bound_playback`).

---

## Problem

The rotating-spotlight Tier 1 plays 1–3 muted videos simultaneously to keep the board feeling alive. On a 4K screen the simultaneous compositing of multiple playing-video regions is the dominant cost and still stutters. We want the "whole board is alive" feeling at a fraction of the cost.

## Core insight (user's idea)

A *playing* video repaints its region 30–60×/sec. A *still image* paints once and then sits there for free. So:

- **Make most video cards "alive" with a cheap still-frame slideshow** — cross-fade through 2–4 frames pulled from the video. No decode, near-zero continuous compositing.
- **Let exactly ONE video in the viewport actually play** (muted, ~15s, then hand off). One playing region instead of several = the heavy cost collapses.

## Goals

1. Replace multi-video Tier 1 with a two-layer model: cheap ambient slideshow (broad) + a single real playing video (the one heavy thing).
2. Honor the user's frame choice: **start / 25% / 50%** of the video (skip the end — it's often a dark frame with no information).
3. Animate **only things that can be animated**. Photo and text cards stay static — no forced Ken Burns (avoids generic/AI-template feel).
4. Keep the existing controls intact: MOTION master switch, Lightbox-open full stop, Tier 3 click-to-play-with-sound.

## Non-goals

- Server-side frame extraction (would require downloading full videos + a decoder in a Worker — out of scope).
- Exact-second frame control for YouTube/Vimeo (not possible cheaply; "decided/approximate" is acceptable per user).
- Sound on the ambient layer (hero is always muted; sound stays a deliberate Tier 3 gesture).

---

## Two-layer model

### Layer A — Ambient still-frame slideshow (broad, cheap)

Applies to **video cards only** (YouTube / Vimeo / X-video) that are in view. Photo / text cards are untouched (static).

Each participating card cross-fades through its resolved frame set on a **per-card randomly-offset timer** (a few seconds between swaps, short fade). Cards never swap in unison — the stagger reads like a gently rippling surface and also spreads the tiny compositing cost over time. This reuses the spirit of the current random rotation (`useSpotlightRotation` uses a random promotion index already).

Frame sources per platform:

| Platform | Frames | Mechanism | Cost |
|---|---|---|---|
| **YouTube** | poster + `hq1.jpg` (≈25%) + `hq2.jpg` (≈50%) | Ready-made stills YouTube samples itself, served from `i.ytimg.com`. ~start/25%/50% by convention. Skip `hq3.jpg` (≈75%) to honor "no end frame". | **Zero decode.** Just `<img>`. |
| **X (tweet mp4)** | exact **0% / 25% / 50%** of duration | Load the proxied (`/api/tweet-video`, same-origin → un-tainted canvas) mp4 off-screen once, read `duration`, seek to each point, `drawImage` → `toDataURL`, cache by bookmarkId. | One-time brief decode per card, then free. |
| **Vimeo / other** | poster only (1 frame) | Cross-origin iframe; no cheap multi-frame. Effectively a static still — its "motion" comes from being eligible as the hero. | Zero. |

Graceful degradation: any frame that fails (YouTube 404, X extraction error/CORS, video too short) falls back down the chain to a single still (poster / thumbnail). A card with only 1 resolvable frame simply shows it static — no crossfade.

### Layer B — Single hero video (the one heavy thing)

Exactly **one** in-view video card plays the real muted video for **~15s**, then the spotlight hands off to another in-view video card. Implemented by pinning the existing rotating-spotlight to **cap = 1** and setting per-card playtime to ~15s (`PER_CARD_MS`). Muted (autoplay-policy compliant).

While a card is the hero it swaps from its slideshow overlay to the real player (existing `InlineMediaPlayer ... muted`); when it stops being hero it reverts to the slideshow. Vimeo/other "1-frame" cards get their motion here, when chosen as hero.

---

## Components & data flow

1. **Frame-source resolver** (pure where possible) — `resolveSlideshowFrames(item) → FramePlan`. Returns either a ready list of image URLs (YouTube, Vimeo/other) or an "extract" marker for X-video (with the seek fractions 0/0.25/0.5). Unit-tested.
2. **X-video frame extractor** — async; given the proxied mp4 URL + bookmarkId, returns 3 data-URL frames. In-memory cache keyed by bookmarkId (survives scroll, not reload — IDB persistence is a possible later add). Throttled / concurrency-limited so a fast scroll doesn't kick off many decodes at once; only runs for cards in or near the viewport.
3. **Card slideshow component** — takes the resolved frames, cross-fades them with a per-instance random offset + interval; renders nothing animated if only 1 frame. `pointer-events: none` (ambient, non-interactive), same as today's Tier 1 overlay.
4. **CardsLayer change** — replace the current muted multi-video Tier 1 block (`CardsLayer.tsx` ~L705–730) with: (a) a slideshow overlay on every in-view video card, and (b) a single hero-video overlay gated on the cap-1 spotlight set. Tier 3 (`audioActiveId`) overlay and the control bar are unchanged.
5. **Reuse** `useSpotlightRotation` for hero selection (cap = 1, derived interval for ~15s).

## Interaction with existing behavior

- **MOTION switch OFF** → no hero video AND no slideshow crossfade (cards show their static poster). Today OFF only stops video; we extend it to freeze the slideshow too, so OFF means "completely calm".
- **Lightbox open** → board fully stopped (hero cap 0, slideshow paused), as today.
- **Tier 3 (sound-on)** → unchanged and independent; the active audio card shows its real player, not the slideshow.
- **prefers-reduced-motion** → no crossfade and no hero autoplay; static posters only. (New, respects OS setting.)

## Edge cases / fallbacks

- X video shorter than the seek points → use whatever frames resolve (very short clip may yield just poster + 1 frame, or poster only).
- X extraction fails (decode/CORS/network) → poster-only static.
- YouTube `hq1/hq2.jpg` missing (some videos) → fall back to small `1.jpg/2.jpg`, then poster-only.
- Card with no thumbnail at all → no slideshow; relies on being picked as hero (or stays blank as today).

## Testing

Unit (Vitest):
- `resolveSlideshowFrames` per platform: correct YouTube URL set (poster + hq1 + hq2, no hq3), X → extract plan with fractions [0, 0.25, 0.5], Vimeo/other → single poster.
- Seek-point computation: 0/25/50% of a given duration; clamping/dedup for very short durations.
- Fallback chain selection logic.

Hard-to-unit-test (verify visually on `booklage.pages.dev`): canvas extraction output, crossfade stagger feel, hero handoff timing, cost/FPS on the user's 4K screen.

## Tuning knobs (live on real hardware)

- Hero: `PER_CARD_MS` (~15000), cap fixed at 1, `MIN_VISIBLE_RATIO` (0.3).
- Slideshow: per-card interval range + random offset, fade duration.

## Phasing

- **Phase 1 — stills + single hero.** Slideshow using ready-made stills only (YouTube quartile frames + posters) + hero video at cap 1, ~15s. Delivers the full visual model and the cost win immediately, with **no canvas extraction**. Lowest risk, ships fast. (X/Vimeo cards show their poster as a static still in this phase.)
- **Phase 2 — X real-frame extraction.** Add the canvas extractor + cache so X-video cards go from 1 → 3 real frames (0/25/50%).

Each phase gets its own implementation plan + deploy + user verification.
