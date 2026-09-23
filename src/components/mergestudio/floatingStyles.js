// Merge Studio's two floating-surface styles, shared so every overlay over
// the canvas reads as one family: panels (Block Deck, Merge List window)
// and pill controls (Workspace, Merge List pill, notifications, presence,
// Preview, zoom, Changes log). Panels use the same 90% glass as the pills
// and the AI prompt bar — light enough to feel like glass, dense enough
// that text stays readable over the white artboards underneath.
export const FLOATING_PANEL = 'border border-white/10 bg-card/90 shadow-2xl shadow-black/40 backdrop-blur-xl backdrop-saturate-150'
export const FLOATING_PILL = 'border border-white/10 bg-card/90 shadow-lg backdrop-blur-md'
