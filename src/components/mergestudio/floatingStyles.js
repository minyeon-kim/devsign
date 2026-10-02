// Merge Studio's two floating-surface styles, shared so every overlay over
// the canvas reads as one family: panels (Block Deck, Merge List window)
// and pill controls (Workspace, Merge List pill, notifications, presence,
// Preview, zoom, Changes log). Panels use the same 90% glass as the pills
// and the AI prompt bar — light enough to feel like glass, dense enough
// that text stays readable over the white artboards underneath.
// Floating panel surface (Merge List, Block Deck, drawers, Changes log): a
// solid, fully opaque dark charcoal (the theme's card color — no backdrop
// blur, no transparency, so the canvas never shows through and dense text
// stays crisp), a 10% white hairline border, a faint inner top highlight,
// and a layered soft shadow that lifts it off the canvas. Pair with
// PANEL_RADIUS.
export const FLOATING_PANEL =
  'border border-white/10 bg-card shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_24px_64px_-16px_rgba(0,0,0,0.7),0_8px_20px_-8px_rgba(0,0,0,0.5)]'
export const PANEL_RADIUS = 'rounded-[20px]'
// A page section or card outside the Workspace (Dashboard, Project home):
// the Workspace window's surface — card charcoal, 10% hairline, 20px
// corners — on the same app background (--ds-bg-base), minus the floating
// shadow since it sits in the page flow rather than over a canvas.
export const PAGE_CARD = 'rounded-[20px] border border-white/10 bg-card'
// A light lift only: enough to separate a pill from an artboard passing
// underneath, without the heavy drop of a full floating panel.
export const FLOATING_PILL = 'border border-white/10 bg-card/90 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.5)] backdrop-blur-md'

// Studio chrome has fixed geometry independent of compact workspace buttons.
export const STUDIO_PILL = 'ds-merge-pill'

// Shared sizing so every count badge in the studio is the same box,
// flex-centered (fixed height, not padding-derived).
// Count badge inside a button or title (Merge Changes, Changes log, …);
// callers add their own colors.
export const COUNT_BADGE = 'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] leading-none font-semibold tabular-nums'

// Category tabs — one style for the Inbox filters (All / Approvals / …), the
// Merge List's Files / Layers switch and the Block Deck's tabs: small
// left-aligned text pills; the active one is a soft fill (no outline).
export const CATEGORY_TAB = 'inline-flex h-8 shrink-0 items-center justify-center rounded-full px-2.5 text-[11px] font-medium whitespace-nowrap transition-colors'
export const CATEGORY_TAB_ACTIVE = 'bg-white/[0.08] text-[#FFFFFF]'
export const CATEGORY_TAB_IDLE = 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
// The row those tabs sit in: directly under the panel title — no divider
// above or below it, just spacing.
export const CATEGORY_TAB_ROW = 'flex shrink-0 items-center gap-1 px-5 pb-3'

// Stacked avatars (Figma-style): a thin ring in the color of the surface
// the stack sits on — not a dark outline — so each avatar looks cut out of
// the one it overlaps. Surfaces set `--avatar-ring` to their own tone
// (AVATAR_RING_ON_* below); it falls back to the panel color.
export const AVATAR_RING = 'ring-[1.5px] ring-[var(--avatar-ring,var(--card))]'
// Merge List rows sit straight on the panel (borderless lists), plus a
// card's hover / active fills. Written out in full so Tailwind picks the
// classes up.
export const AVATAR_RING_ON_SURFACE = '[--avatar-ring:var(--card)]'
export const AVATAR_RING_ON_HOVER = 'hover:[--avatar-ring:color-mix(in_oklab,var(--card),white_3%)]'
export const AVATAR_RING_ON_ACTIVE = '[--avatar-ring:color-mix(in_oklab,var(--card),white_6%)]'

// The teammate presence stack in the studio's top pill (the shared
// UserPresence component, styled from its Merge Studio wrapper only): the
// left-most avatar on top, each next one tucked beneath it, and the soft
// pill-colored ring in place of the avatars' outline.
export const PRESENCE_STACK = [
  'flex items-center',
  '[&_[data-slot=avatar-group]>*]:relative',
  '[&_[data-slot=avatar-group]>*:nth-child(1)]:z-[40]',
  '[&_[data-slot=avatar-group]>*:nth-child(2)]:z-[30]',
  '[&_[data-slot=avatar-group]>*:nth-child(3)]:z-[20]',
  '[&_[data-slot=avatar-group]>*:nth-child(4)]:z-[10]',
  '[&_[data-slot=avatar-group]_[data-slot=avatar]]:after:border-transparent',
  '[&_[data-slot=avatar-group]_[data-slot=avatar]]:ring-[1.5px]',
  '[&_[data-slot=avatar-group]_[data-slot=avatar]]:ring-[var(--card)]',
].join(' ')

// Flat panel language shared by the Merge List and the Block Deck: content
// sits on a 20px inset (px-5) with 16px between groups; a group is a
// sentence-case label (8px above its list) and, where it's a list, a run of
// rows with no lines at all — no card, no borders, no dividers. Rows are
// told apart by whitespace (4px apart) and a soft, rounded background shift
// on hover / selection. The list extends 12px into the gutter on each side
// and its rows pad 12px back in, so row text stays on the 20px inset.
export const PANEL_SURFACE = '-mx-3'
export const PANEL_LABEL = 'mb-2 flex h-7 items-center gap-2 text-xs font-medium text-slate-300'
// Rows: spaced, rounded (so hover / selected fills read as soft pills).
export const PANEL_ROWS = 'space-y-1 [&>*]:overflow-hidden [&>*]:rounded-lg'
// Borderless ghost button fill (the Merge List search's tone).
export const GHOST_BUTTON = 'bg-white/[0.05] text-slate-200 transition-colors hover:bg-white/[0.09] hover:text-white'

// ---- Brand accent: one mint family for the whole studio ----------------
// Every interactive accent — primary actions, active / selected states,
// indicators, count badges, focus rings — comes from this single mint
// scale (the same mint as the resolved checkmarks and canvas selection),
// never a mix of indigo / violet / blue. Semantic status colors (priority
// tints, warnings, destructive) and design content on the artboards are
// separate and unaffected.
// Primary action (solid mint, dark text for contrast).
export const ACCENT_CTA = 'ds-primary-cta'
// Soft tint for active pills / count badges / tags.
export const ACCENT_SOFT = 'bg-emerald-400/15 text-emerald-300'
// Solid count badge on a highlighted control.
export const ACCENT_BADGE = 'bg-emerald-400 text-slate-950'

// Severity badge at the front of a two-line row (Merge List cards, Compare
// drift rows): a fixed-width column, the badge filling it, so badges and
// the text after them form clean vertical lines down the list.
export const SEVERITY_COL = 'w-[46px]'
export const SEVERITY_BADGE = 'h-5 w-[46px] px-0 text-[10px]'

// Workspace tabs and their adjacent add button share a softer corner.
export const WORKSPACE_TAB_RADIUS = 'rounded-[var(--ds-radius-workspace-tab)]'
