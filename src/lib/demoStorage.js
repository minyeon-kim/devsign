// Only this prototype's versioned namespace is read or reset.
export const DEMO_PREFIX = 'devsign:demo:'
// Bump this whenever a mock data shape/seed changes in a way existing
// localStorage demo state wouldn't reflect — readDemo below discards
// anything saved under an older version instead of silently keeping a
// browser on data from before the change (e.g. History's seed checkpoints
// changed several times this session; without this, a browser that had
// already loaded the app once kept its *original* historyEntries from
// localStorage forever, never picking up any of it — including Playback's
// own position in that array, so it looked unrelated to it).
// 6: Card / Radius (cc-3) gained its design page — stored merge items and
// conflicts from before would keep it code-only.
export const DEMO_VERSION = 6

export function readDemo(key, fallback) {
  try {
    const saved = JSON.parse(localStorage.getItem(DEMO_PREFIX + key))
    if (saved?.version !== DEMO_VERSION) return fallback
    const value = saved.value
    if (Array.isArray(fallback) ? !Array.isArray(value) : fallback !== null && typeof value !== typeof fallback) return fallback
    if (fallback && typeof fallback === 'object' && (value === null || Array.isArray(value) !== Array.isArray(fallback))) return fallback
    return value
  } catch {
    return fallback
  }
}

let warned = false
export function writeDemo(key, value) {
  try {
    localStorage.setItem(DEMO_PREFIX + key, JSON.stringify({ version: DEMO_VERSION, value }))
    return true
  } catch {
    if (!warned && typeof window !== 'undefined') {
      warned = true
      window.dispatchEvent(new CustomEvent('devsign:storage-error'))
    }
    return false
  }
}

export function resetDemo() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(DEMO_PREFIX)) localStorage.removeItem(key)
  }
}

// Stable ordering prevents object insertion order from invalidating reviews.
export function signature(value) {
  return JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v)
}
