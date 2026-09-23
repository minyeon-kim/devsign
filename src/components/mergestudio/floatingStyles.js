// Merge Studio's two floating-surface styles, shared so every overlay over
// the canvas reads as one family: panels (Block Deck, Merge List window)
// and pill controls (Workspace, Merge List pill, notifications, presence,
// Preview, zoom, Changes log). Panels use the same 90% glass as the pills
// and the AI prompt bar — light enough to feel like glass, dense enough
// that text stays readable over the white artboards underneath.
export const FLOATING_PANEL = 'border border-white/10 bg-card/90 shadow-2xl shadow-black/40 backdrop-blur-xl backdrop-saturate-150'
export const FLOATING_PILL = 'border border-white/10 bg-card/90 shadow-lg backdrop-blur-md'

// Shared sizing so every segmented tab and count badge in the studio is
// the same box, flex-centered (fixed height, not padding-derived).
// Segmented tab: sits in the panels' 48px tab bars (Merge List, Block Deck).
export const SEGMENT_TAB = 'flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium whitespace-nowrap'
// Count badge inside a button or title (Merge Changes, Changes log, …);
// callers add their own colors.
export const COUNT_BADGE = 'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] leading-none font-semibold tabular-nums'

// Category tabs — one style for the Inbox filters (All / Approvals / …) and
// the Merge List's sub-navigation (Merges / Files / Layers): small
// left-aligned text pills; the active one is a soft fill (no outline).
export const CATEGORY_TAB = 'inline-flex h-7 shrink-0 items-center justify-center rounded-full px-3 text-xs font-medium whitespace-nowrap transition-colors'
export const CATEGORY_TAB_ACTIVE = 'bg-white/[0.08] text-[#FFFFFF]'
export const CATEGORY_TAB_IDLE = 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
// The row those tabs sit in: directly under the panel title — no divider
// above or below it, just spacing.
export const CATEGORY_TAB_ROW = 'flex shrink-0 items-center gap-1 px-5 pb-3'
