// "방금" and what it turns into. Something that just changed says 방금 for a
// minute, then "N분 전" — said in still text; nothing is lit or animated.
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
