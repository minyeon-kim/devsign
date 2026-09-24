// Merge Studio's two floating-surface styles, shared so every overlay over
// the canvas reads as one family: panels (Block Deck, Merge List window)
// and pill controls (Workspace, Merge List pill, notifications, presence,
// Preview, zoom, Changes log). Panels use the same 90% glass as the pills
// and the AI prompt bar — light enough to feel like glass, dense enough
// that text stays readable over the white artboards underneath.
export const FLOATING_PANEL = 'border border-white/10 bg-card/90 shadow-2xl shadow-black/40 backdrop-blur-xl backdrop-saturate-150'
export const FLOATING_PILL = 'border border-white/10 bg-card/90 shadow-lg backdrop-blur-md'

// Shared sizing so every count badge in the studio is the same box,
// flex-centered (fixed height, not padding-derived).
// Count badge inside a button or title (Merge Changes, Changes log, …);
// callers add their own colors.
export const COUNT_BADGE = 'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] leading-none font-semibold tabular-nums'

// Category tabs — one style for the Inbox filters (All / Approvals / …), the
// Merge List's Files / Layers switch and the Block Deck's tabs: small
// left-aligned text pills; the active one is a soft fill (no outline).
export const CATEGORY_TAB = 'inline-flex h-7 shrink-0 items-center justify-center rounded-full px-3 text-xs font-medium whitespace-nowrap transition-colors'
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
// Merge List group surface (white 2.5% over the panel), and a card's
// hover / active fills stacked on top of it. Written out in full so
// Tailwind picks the classes up.
export const AVATAR_RING_ON_SURFACE = '[--avatar-ring:color-mix(in_oklab,var(--card),white_2.5%)]'
export const AVATAR_RING_ON_HOVER = 'hover:[--avatar-ring:color-mix(in_oklab,var(--card),white_5.5%)]'
export const AVATAR_RING_ON_ACTIVE = '[--avatar-ring:color-mix(in_oklab,var(--card),white_8.5%)]'

// The teammate presence stack in the studio's top pill (the shared
// UserPresence component, styled from its Merge Studio wrapper only): the
// left-most avatar on top, each next one tucked beneath it, and the soft
// pill-colored ring in place of the avatars' outline.
export const PRESENCE_STACK = [
  'flex items-center',
  '[&_[data-slot=avatar-group]>*]:relative',
  '[&_[data-slot=avatar-group]>*:nth-child(1)]:z-[4]',
  '[&_[data-slot=avatar-group]>*:nth-child(2)]:z-[3]',
  '[&_[data-slot=avatar-group]>*:nth-child(3)]:z-[2]',
  '[&_[data-slot=avatar-group]>*:nth-child(4)]:z-[1]',
  '[&_[data-slot=avatar-group]_[data-slot=avatar]]:after:border-transparent',
  '[&_[data-slot=avatar-group]_[data-slot=avatar]]:ring-[1.5px]',
  '[&_[data-slot=avatar-group]_[data-slot=avatar]]:ring-[var(--card)]',
].join(' ')

// Flat panel language shared by the Merge List and the Block Deck: content
// sits on a 20px inset (px-5) with 16px between groups; a group is an
// sentence-case label (8px above its surface) and, where it's a list, one
// grouped surface — a faint tonal lift + hairline ring — with rows split by
// hairlines instead of separate bordered boxes.
export const PANEL_SURFACE = 'overflow-hidden rounded-xl bg-white/[0.025] ring-1 ring-inset ring-white/[0.07]'
export const PANEL_LABEL = 'mb-2 flex h-7 items-center gap-2 text-xs font-medium text-slate-300'
export const PANEL_ROWS = 'divide-y divide-white/[0.06]'
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
export const ACCENT_CTA = 'bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-300'
// Soft tint for active pills / count badges / tags.
export const ACCENT_SOFT = 'bg-emerald-400/15 text-emerald-300'
// Solid count badge on a highlighted control.
export const ACCENT_BADGE = 'bg-emerald-400 text-slate-950'
