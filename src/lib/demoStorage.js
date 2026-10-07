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
// 7: a three-draft sample item for mixing drafts per element.
export const DEMO_VERSION = 15

export function readDemo(key, fallback) {
  try {
    const saved = JSON.parse(localStorage.getItem(DEMO_PREFIX + key))
    if (saved?.version !== DEMO_VERSION) return fallback
    const value = saved.value
    if (Array.isArray(fallback) ? !Array.isArray(value) : fallback !== null && typeof value !== typeof fallback) return fallback
    if (fallback && typeof fallback === 'object' && (value === null || Array.isArray(value) !== Array.isArray(fallback))) return fallback
    // Add the manual-adjustment example to existing sessions without
    // resetting their saved decisions, reviews, or history.
    // (Likewise the two precise-adjustment samples.)
    const addedIds = key === 'conflicts' ? ['cc-touch-adjusted', 'cc-tab-icon-size', 'cc-manual-target']
      : key === 'project:checkout-redesign:mergeItems' ? ['merge-checkout-touch-adjusted', 'merge-checkout-tab-icon', 'merge-checkout-manual-target'] : []
    if (addedIds.length && Array.isArray(value) && Array.isArray(fallback)) {
      const examples = addedIds.filter((id) => !value.some((row) => row.id === id)).map((id) => fallback.find((row) => row.id === id)).filter(Boolean)
      if (examples.length) return [...examples, ...value]
    }
    // A seeded draft (an already-adjusted sample) reaches a session that
    // has drafts saved but none for that item; a draft it has is kept as is.
    if (key.endsWith(':mergeDrafts') && value && fallback && !Array.isArray(value)) return { ...fallback, ...value }
    // History's branch-graph samples (see projectHistorySeeds): a session
    // saved before them gets the missing seed checkpoints put back in seed
    // order, ahead of whatever it recorded since — nothing it has is
    // dropped — and seeded checkpoints take the seed's current wording and
    // branch (a label reworded in the seed shouldn't stay stale forever).
    if (key === 'project:mobile-nav-revamp:historyEntries' && Array.isArray(value) && Array.isArray(fallback)) {
      const seeded = new Set(fallback.map((row) => row.id))
      // (the seed's code and preview values too — only `archived` is the session's)
      const fresh = (seed, saved) => (saved ? { ...seed, archived: saved.archived } : seed)
      return [...fallback.map((seed) => fresh(seed, value.find((row) => row.id === seed.id))), ...value.filter((row) => !seeded.has(row.id))]
    }
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
