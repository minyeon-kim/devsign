import { useState } from 'react'
import { conflictListRecord, isOpen, isQueuedConflict, LIST_STATUSES, listStatusOf, needsReviewFrom, sortOpenFirst } from '@/lib/conflicts'
import { dueDateOf, EMPTY_FILTERS, matchesDue } from '@/components/mergestudio/mergeFilters'
import { CONFLICT_TYPES, conflictTypeOf } from '@/lib/conflictInsight'
import { useWorkspace } from '@/state/WorkspaceProvider'

// The Conflict Points list as data — what's listed, how it's filtered and
// ordered, and how a row opens — shared by every place the list is drawn
// (the bottom panel's table, the activity bar's sidebar), so the two can't
// disagree about what's in it or what a filter means.
//
// Filters narrow the list with the same rules the counts use (lib/
// conflicts), so a filter's number is always the rows it shows. The chosen
// filter lives in the bottom panel's state: a count elsewhere can open the
// list already filtered, and both lists stay on the same one.
// The status filters are the list's own five statuses, so a filter and the
// status a row shows are always the same word.
export const CONFLICT_FILTERS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'mine', label: 'Needs your review', test: (c) => needsReviewFrom(c) },
  ...LIST_STATUSES.map((status) => ({ id: status.id, label: status.label, test: (c) => listStatusOf(c).id === status.id })),
]
// Filter ids from before the statuses were unified.
const FILTER_ALIAS = { merged: 'done' }
// "Everything not done yet" — where a count of open conflicts links to (a
// project card's badge, a project home's stat). Not one of the standing
// filters: it shows as one only while it's the filter in use.
const OPEN_FILTER = { id: 'open', label: 'Open', test: isOpen }
export const CONFLICT_STATUS_FILTERS = CONFLICT_FILTERS.filter((filter) => filter.id !== 'all').map((filter) => filter.label)

function matchesConflictFilters(conflict, filters) {
  const stageMatches = { 'Needs your review': needsReviewFrom(conflict), [listStatusOf(conflict).label]: true }

  if (filters.status.length && !filters.status.some((status) => stageMatches[status])) return false
  if (filters.assignee.length && !filters.assignee.includes(conflict.assigneeId)) return false
  const severity = conflict.severity
    ? conflict.severity.charAt(0).toUpperCase() + conflict.severity.slice(1)
    : 'None'
  if (filters.conflict.length && !filters.conflict.includes(severity)) return false
  return matchesDue(conflict, filters.due)
}

// `view`: where a row's detail opens — 'overlay' (the full-screen viewer
// over the work area) or 'panel' (in the bottom panel, beside the canvas).
export function useConflictList({ view = 'overlay' } = {}) {
  const { conflicts, reviewConflictId, openConflictReview, bottomPanel, setBottomPanel } = useWorkspace()
  const queued = conflicts.filter(isQueuedConflict)
  const listRecords = conflicts.filter(conflictListRecord)
  const filterId = FILTER_ALIAS[bottomPanel.conflictFilter] ?? bottomPanel.conflictFilter
  const picked = filterId === OPEN_FILTER.id ? OPEN_FILTER : CONFLICT_FILTERS.find((f) => f.id === filterId) ?? null
  const filter = picked ?? CONFLICT_FILTERS[0]
  const shownFilters = filter === OPEN_FILTER ? [CONFLICT_FILTERS[0], OPEN_FILTER, ...CONFLICT_FILTERS.slice(1)] : CONFLICT_FILTERS
  const [advancedFilters, setAdvancedFilters] = useState(EMPTY_FILTERS)
  // By what kind of thing it is (lib/conflictInsight) — only the kinds the
  // list actually has are offered. Null: every type.
  const [typeFilter, setTypeFilter] = useState(null)
  const typeOptions = Object.entries(CONFLICT_TYPES)
    .map(([id, type]) => ({ id, label: type.label, count: listRecords.filter((conflict) => conflictTypeOf(conflict).id === id).length }))
    .filter((option) => option.count > 0)
  const filterItems = listRecords.map((conflict) => ({
    ...conflict,
    tag: needsReviewFrom(conflict) && isOpen(conflict) ? 'Needs your review' : listStatusOf(conflict).label,
    conflictLevel: conflict.severity
      ? conflict.severity.charAt(0).toUpperCase() + conflict.severity.slice(1)
      : 'None',
  }))
  const markedDueDates = listRecords.map(dueDateOf).filter(Boolean)
  // Open first, and among those the ones waiting on your review on top —
  // the list stays "All", but what you're asked to do leads it.
  const visible = sortOpenFirst(
    listRecords.filter(filter.test).filter((conflict) => matchesConflictFilters(conflict, advancedFilters)).filter((conflict) => !typeFilter || conflictTypeOf(conflict).id === typeFilter)
  ).sort((a, b) => Number(isOpen(b) && needsReviewFrom(b)) - Number(isOpen(a) && needsReviewFrom(a)))
  return {
    conflicts,
    queued,
    listRecords,
    visible,
    filter,
    shownFilters,
    setFilter: (id) => setBottomPanel({ conflictFilter: id }),
    countOf: (entry) => listRecords.filter(entry.test).length,
    advancedFilters,
    setAdvancedFilters,
    filterItems,
    markedDueDates,
    typeFilter,
    setTypeFilter,
    typeOptions,
    // The row whose detail is open, wherever it's showing.
    selectedId: reviewConflictId,
    open: (id) => openConflictReview(id, { view }),
  }
}
