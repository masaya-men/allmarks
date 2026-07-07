# TAG MODE — drag-and-drop tagging (replaces the Triage manage screen)

_s170 · design approved by user._

## Goal

Replace the swipe-based Triage "MANAGE TAGS" screen with a fast, continuous
drag-and-drop tagging mode: multi-select cards → drag onto a floating tag panel
→ tag them. Create new tags inline by dropping on "+ NEW TAG".

## Entry

- The "MANAGE TAGS" chrome button opens **TAG MODE** instead of Triage.
- Triage code is kept **dormant** (repoint the entry only); remove it later once
  TAG MODE is confirmed as the replacement. Do NOT bulk-delete Triage up front.

## UX

- **Multi-select**: click cards to select. Reuse the Share select machinery
  (`selectedIds` + the same card-click→toggle routing).
- **Floating tag panel**: a **small, tag-dedicated** panel floated on the RIGHT
  EDGE, **vertically centered**. Lists the user's tags (each a drop target) plus
  a "**+ NEW TAG**" drop target. Caps at a reasonable max-height → **internal
  scroll** when tags overflow (never a full-height rail).
- **Tag**: drag the selected cards → drop on a tag → **adds** that tag to ALL
  selected (additive union with each card's existing `tags`). Selection
  **persists** after a drop (continuous multi-tagging). The hovered drop target
  highlights and shows "+N".
- **Create**: drop on "+ NEW TAG" → inline name input → `useTags.create` +
  assign to the selection.
- **Exit**: DONE / CANCEL / Esc. Empty-board click clears the selection.

## Data (all existing — no new layer)

- Tags: `useTags` (`create` / `tags` list). `lib/storage/use-tags.ts`.
- Assignment: `persistTags(bookmarkId, nextTags)` — `lib/storage/use-board-data.ts:202`.
  `bookmark.tags` is a `string[]` of tag ids. Drop = union(existing, tagId).
- Filtering unaffected (`filterByTags`).

## Reuse

- Share select machinery (`selectedIds`, card-click→toggle, the bottom mode bar
  pattern from `ShareSelectBar`).
- GSAP Draggable + a drop-target hit test (cf. the drag-reorder hit test).
- Chrome tokens (pill / glow) for the panel + drop feedback.

## Phases

1. **Enter TAG MODE** (repoint MANAGE TAGS) + multi-select + the floating tag
   panel (render + list + "+ NEW TAG"); no drag yet. Bottom mode bar.
2. **Drag → drop on tag** → additive assign + hover highlight / "+N" feedback.
3. **"+ NEW TAG" drop** → inline create + assign.
4. _(later)_ Retire the Triage code.

## Approved defaults

- Drop is **additive** (keeps existing tags).
- Selection **persists** after a drop (continuous).
- Triage kept **dormant** (repoint entry, not deleted).
