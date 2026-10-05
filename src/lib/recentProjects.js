// Which projects you opened, most recent first — the Dashboard's "Recently
// viewed" order. Kept in this browser only; storage that's unavailable just
// means there's no order to offer.
const KEY = 'devsign:recent-projects:v1'

export function recentProjectIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(ids) ? ids : []
  } catch {
    return []
  }
}

export function markProjectViewed(projectId) {
  try {
    localStorage.setItem(KEY, JSON.stringify([projectId, ...recentProjectIds().filter((id) => id !== projectId)].slice(0, 50)))
  } catch {
    // Nothing to keep it in.
  }
}
