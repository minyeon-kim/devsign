// Merge List filter model: the extra per-item fields the filters need that
// the shared merge-item data doesn't carry yet, derived here so none of it
// leaks outside Merge Studio.

export function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

// Calendar-day arithmetic (setDate, not ms offsets, so DST can't shift it).
export function addDays(d, n) {
  const x = startOfDay(d)
  x.setDate(x.getDate() + n)
  return x
}

export function sameDay(a, b) {
  return a && b && startOfDay(a).getTime() === startOfDay(b).getTime()
}

// Concrete due date from the item's `dueBucket`, relative to today, so it
// agrees with the card's own `dueLabel` ("Overdue by 1 day", "Due
// tomorrow", "No due date").
const DUE_OFFSET = { overdue: -1, soon: 1 }
export function dueDateOf(item) {
  const offset = DUE_OFFSET[item.dueBucket]
  return offset == null ? null : addDays(new Date(), offset)
}

// Relative presets, Linear-style. "This week" runs from today through
// Sunday.
export const DUE_PRESETS = [
  { id: 'overdue', label: 'Overdue', test: (due, today) => due && due < today },
  { id: 'today', label: 'Due today', test: (due, today) => sameDay(due, today) },
  { id: 'week', label: 'Due this week', test: (due, today) => due && due >= today && due <= addDays(today, 6 - today.getDay()) },
  { id: 'none', label: 'No due date', test: (due) => !due },
]

// `{ presets: string[], range: { from: Date, to: Date } | null }` — an item
// passes when it matches any picked preset or falls inside the range.
export const EMPTY_DUE = { presets: [], range: null }

export function isDueActive(due) {
  return due.presets.length > 0 || !!due.range
}

export function matchesDue(item, due) {
  if (!isDueActive(due)) return true
  const date = dueDateOf(item)
  const today = startOfDay(new Date())
  if (due.presets.some((id) => DUE_PRESETS.find((p) => p.id === id)?.test(date, today))) return true
  if (due.range && date) {
    const from = startOfDay(due.range.from)
    const to = startOfDay(due.range.to ?? due.range.from)
    return date >= from && date <= to
  }
  return false
}

export function formatDay(d) {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Every Merge List filter in one value. Each list is an any-of match
// within its category; categories combine with AND.
export const EMPTY_FILTERS = { status: [], assignee: [], conflict: [], due: EMPTY_DUE }

export function activeFilterCount(f) {
  return f.status.length + f.assignee.length + f.conflict.length + f.due.presets.length + (f.due.range ? 1 : 0)
}

export function matchesFilters(item, f) {
  if (f.status.length && !f.status.includes(item.tag)) return false
  if (f.assignee.length && !f.assignee.includes(item.assigneeId)) return false
  if (f.conflict.length && !f.conflict.includes(item.conflictLevel)) return false
  return matchesDue(item, f.due)
}

// Who's on each merge item: its assignee first, then reviewers. The shared
// merge-item data only carries `assigneeId`, so the seeded items' reviewers
// live here (mirroring the merge wizard's default code/design reviewers);
// a new item starts with just its assignee.
const REVIEWERS_BY_ITEM = {
  'merge-flowbank': ['min', 'jane'],
  'merge-authmodal': ['james'],
  'merge-settings': [],
}

export function peopleOnItem(item) {
  const reviewers = (REVIEWERS_BY_ITEM[item.id] ?? []).filter((id) => id !== item.assigneeId)
  return [
    ...(item.assigneeId ? [{ id: item.assigneeId, role: 'Assignee' }] : []),
    ...reviewers.map((id) => ({ id, role: 'Reviewer' })),
  ]
}
