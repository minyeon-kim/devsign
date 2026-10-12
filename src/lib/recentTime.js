// "방금" and what it turns into. Something that just changed says 방금 for a
// minute, then "N분 전" — and is lit once, when it first shows, never again.
// (The label's words are English here and put into Korean by the i18n
// runtime, as every other time label is.)
export const RECENT_MS = 60_000

export const isRecent = (at, now = Date.now()) => Number.isFinite(at) && now - at >= 0 && now - at < RECENT_MS

// "Just now" → "5m ago" → "2h ago" → "3d ago".
export function relativeLabelOf(at, now = Date.now()) {
  const minutes = Math.floor((now - at) / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
  return `${Math.floor(minutes / 1440)}d ago`
}

// Whether `key`'s highlight may play for the one asking (`owner`: whoever
// drew it first): true for that owner, false for anyone after — a row drawn
// again (re-opened, scrolled back to, its list re-made) doesn't light up
// twice, while the one that's lit stays lit through its own re-renders.
// Kept for the page's life.
const played = new Map()
export function playOnce(key, owner = key) {
  if (!played.has(key)) played.set(key, owner)
  return played.get(key) === owner
}
export const resetPlayed = () => played.clear() // (tests)
