import './ConflictPanel.css'
import { Fragment, useEffect, useState } from 'react'
import { toast } from '@/i18n/toast'
import { Check, CheckCheck, CircleCheck, FileCode2, X } from 'lucide-react'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { allPeople } from '@/data/mockData'
import { STAGE_DOT_CLASS, STAGE_LABEL, conflictCounts, isOpen, isPendingMerge, needsReviewFrom, sortOpenFirst } from '@/lib/conflicts'
import { CATEGORY_TAB, CATEGORY_TAB_ACTIVE, CATEGORY_TAB_IDLE } from '@/components/mergestudio/floatingStyles'
import { SeverityPill } from '@/components/mergestudio/ConflictTag'
import { MergeFilterButton } from '@/components/mergestudio/MergeFilterMenu'
import { dueDateOf, EMPTY_FILTERS, matchesDue } from '@/components/mergestudio/mergeFilters'
import { diffLines } from '@/lib/lineDiff'
import { useNavigate } from 'react-router-dom'
import { LocalizedText } from '@/i18n/runtime'
import ConflictReviewPanel from '@/components/dockview/panels/ConflictReviewPanel'
import MergeStepFlow from '@/components/mergestudio/MergeStepFlow'
import { useWorkspace } from '@/state/WorkspaceProvider'

// One icon per row, chosen by severity and carried only inside the badge.
const severityConfig = {
  high: { label: 'High' },
  medium: { label: 'Medium' },
  low: { label: 'Low' },
}

// The bottom panel's Conflict Points tab: the one place a project's
// conflicts are inspected and merged (the workspace's `conflicts`).
// A row opens its inline review; merging remains the last review step.
// Low-risk items waiting on review can be checked and approved together
// from the floating batch bar (merging each stays its own step).
//
// Filters narrow the list with the same rules the counts use (lib/
// conflicts), so a chip's number is always the rows it shows. The filter
// lives in the bottom panel's state, so the tab's "Needs your review"
// shortcut can open the list already filtered.
const FILTERS = [
  { id: 'all', label: 'All', test: () => true, count: 'total' },
  { id: 'mine', label: 'Needs your review', test: (c) => needsReviewFrom(c), count: 'needsMyReview' },
  { id: 'open', label: 'Open', test: isOpen, count: 'open' },
  { id: 'pending_merge', label: 'Pending merge', test: isPendingMerge, count: 'pendingMerge' },
  { id: 'merged', label: 'Merged', test: (c) => !isOpen(c), count: 'merged' },
]

function matchesConflictFilters(conflict, filters) {
  const stageMatches = {
    'In Progress': conflict.reviewStage === 'approved',
    'Needs Review': needsReviewFrom(conflict),
    Draft: conflict.reviewStage === 'detected',
    Merged: conflict.reviewStage === 'resolved',
    'In Review': conflict.reviewStage === 'in_review',
  }

  if (filters.status.length && !filters.status.some((status) => stageMatches[status])) return false
  if (filters.assignee.length && !filters.assignee.includes(conflict.assigneeId)) return false
  const severity = conflict.severity
    ? conflict.severity.charAt(0).toUpperCase() + conflict.severity.slice(1)
    : 'None'
  if (filters.conflict.length && !filters.conflict.includes(severity)) return false
  return matchesDue(conflict, filters.due)
}

// `mergeStudioItem`/`mergeStepFlowProps` are set only when this panel is
// Merge Studio's own Conflict Points tab (see MergeStudioWorkspace) — the
// list stays the project-wide one either way, but reviewing a conflict
// linked to the item currently open there shows its full Compare → Check
// → Preview → Review flow instead of the plain conflict review, since
// Merge Studio already has that item's edit session loaded. Everything
// else falls back to the ordinary review, same as the Workspace's own tab.
function ConflictPanel({ mergeStudioItem, inMergeStudio, mergeStepFlowProps }) {
  const navigate = useNavigate()
  const { projectId, conflicts, mergeItems, reviewConflictId, openConflictReview, batchApproveConflicts, bottomPanel, setBottomPanel,
    updateConflict, approveConflict, requestChanges, resolveConflict, currentUser, requestMergeFocus } =
    useWorkspace()
  const reviewConflict = conflicts.find((c) => c.id === reviewConflictId) ?? null
  // A conflict links to its merge item either way round — its own
  // `mergeItemId`, or the item's `conflictId` pointing back at it (most of
  // conflictChecklist only has the latter; see mockData). Resolve both so
  // "which item is this conflict's" works for any conflict in the list,
  // not just ones that happen to carry `mergeItemId` themselves.
  const reviewConflictItemId =
    reviewConflict && (reviewConflict.mergeItemId ?? mergeItems.find((mi) => mi.conflictId === reviewConflict.id)?.id ?? null)
  const reviewConflictIsOpenItem = Boolean(mergeStudioItem && reviewConflictItemId === mergeStudioItem.id)
  // Selecting a conflict in Merge Studio's own Conflict Points tab doesn't
  // just swap the panel to its step flow — the canvas needs to jump to the
  // element it's actually about, the same "pick it, see it" the Merge List
  // already does. If the conflict belongs to a *different* item than the
  // one open here, `requestMergeFocus` switches to it (it sets the
  // selected merge item too), so any conflict in the list lands somewhere
  // concrete instead of only ones already matching what's open. This must
  // key off `inMergeStudio` (always true for this tab), not
  // `mergeStudioItem` — the Conflict Points list shows up even before any
  // merge item has been opened (empty canvas), and gating on
  // `mergeStudioItem` meant the very first click from that empty state
  // never called `requestMergeFocus` at all, so the canvas never populated.
  useEffect(() => {
    if (!inMergeStudio || !reviewConflict || !reviewConflictItemId) return
    // A conflict with neither still switches the item open (so it's at
    // least on canvas to look at) — it just lands without a pinpoint pan.
    requestMergeFocus({
      itemId: reviewConflictItemId,
      label: reviewConflict.title,
      ...(reviewConflict.layerId
        ? { layerId: reviewConflict.layerId }
        : reviewConflict.fileId && reviewConflict.line
          ? { fileId: reviewConflict.fileId, line: reviewConflict.line }
          : {}),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inMergeStudio, reviewConflict?.id, reviewConflictItemId])
  const counts = conflictCounts(conflicts)
  const filter = FILTERS.find((f) => f.id === bottomPanel.conflictFilter) ?? FILTERS[0]
  const [advancedFilters, setAdvancedFilters] = useState(EMPTY_FILTERS)
  const filterItems = conflicts.map((conflict) => ({
    ...conflict,
    tag: conflict.reviewStage === 'resolved'
      ? 'Merged'
      : conflict.reviewStage === 'detected'
        ? 'Draft'
        : conflict.reviewStage === 'approved'
          ? 'In Progress'
          : needsReviewFrom(conflict)
            ? 'Needs Review'
            : 'In Review',
    conflictLevel: conflict.severity
      ? conflict.severity.charAt(0).toUpperCase() + conflict.severity.slice(1)
      : 'None',
  }))
  const markedDueDates = conflicts.map(dueDateOf).filter(Boolean)
  const visible = sortOpenFirst(
    conflicts.filter(filter.test).filter((conflict) => matchesConflictFilters(conflict, advancedFilters))
  )
  const [selected, setSelected] = useState([])
  // The low-risk row expanded to its mini diff (a click on a low-risk row
  // shows what it changes, for checking before batch-approving).
  const [expandedId, setExpandedId] = useState(null)
  const batchable = conflicts.filter(canBatchApprove)
  // Only what's still batchable stays selected (e.g. after a review moves on).
  const selection = selected.filter((id) => batchable.some((c) => c.id === id))
  const allSelected = batchable.length > 0 && selection.length === batchable.length

  function toggle(id) {
    setSelected(selection.includes(id) ? selection.filter((x) => x !== id) : [...selection, id])
  }

  function approveSelected() {
    const { approved, waiting } = batchApproveConflicts(selection)
    setSelected([])
    if (approved + waiting === 0) return
    toast(`Approved ${approved + waiting} as ${currentUser.name}`, {
      description: [
        approved && `${approved} ready to resolve`,
        waiting && `${waiting} still waiting on other reviewers`,
      ]
        .filter(Boolean)
        .join(' · '),
    })
  }

  if (reviewConflict) {
    return (
      <div className="h-full min-h-0 min-w-0 bg-card">
        {reviewConflictIsOpenItem && bottomPanel.conflictMode === 'check' ? (
          <MergeStepFlow
            {...mergeStepFlowProps}
            onBack={() => {
              setBottomPanel({ conflictMode: 'overview' })
              openConflictReview(null)
            }}
          />
        ) : (
          <ConflictReviewPanel
            conflict={reviewConflict}
            mergeActionLabel={inMergeStudio && reviewConflictItemId ? 'Review impact & checks' : undefined}
            onOpenChange={(open) => !open && openConflictReview(null)}
            onUpdate={updateConflict}
            onApprove={approveConflict}
            onRequestChanges={requestChanges}
            onResolve={resolveConflict}
            onOpenMergeStudio={(conflict) => {
              if (inMergeStudio && reviewConflictIsOpenItem) {
                mergeStepFlowProps.onStepChange(1)
                setBottomPanel({ conflictMode: 'check', open: true })
                return
              }
              openConflictReview(null)
              // `conflict` here is always `reviewConflict`, so its item id
              // is `reviewConflictItemId` — most conflicts only carry the
              // reverse link (see its definition above), never their own
              // `mergeItemId`, so reading that field directly left Merge
              // Studio with nothing selected (a near-black empty canvas)
              // for most conflicts.
              navigate(`/projects/${projectId}/workspace`, {
                state: { openMergeStudio: true, mergeItemId: reviewConflictItemId, layerId: conflict.layerId, fileId: conflict.fileId, line: conflict.line },
              })
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-card">
      {/* No internal title bar here — the bottom panel's tab above already
          reads "Conflict Points". */}
      {conflicts.length > 0 && (
        <div className="mt-1 flex shrink-0 flex-wrap items-center gap-2 border-t border-white/[0.06] px-4 pt-2 pb-2" role="group" aria-label="Filter conflicts">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={f.id === filter.id}
              onClick={() => setBottomPanel({ conflictFilter: f.id })}
              className={cn(CATEGORY_TAB, 'h-6 gap-1 px-2 text-[10.5px]', f.id === filter.id ? CATEGORY_TAB_ACTIVE : CATEGORY_TAB_IDLE)}
            >
              <LocalizedText text={f.label} />
              <span className={cn('tabular-nums', f.id === 'mine' && counts.needsMyReview > 0 ? 'text-emerald-300' : 'text-slate-500')}>
                {counts[f.count]}
              </span>
            </button>
          ))}
          <MergeFilterButton
            value={advancedFilters}
            onChange={setAdvancedFilters}
            items={filterItems}
            markedDays={markedDueDates}
          />
        </div>
      )}
      {conflicts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
          <CircleCheck className="size-6 text-emerald-500" />
          <p className="text-xs">No conflicts — design and code are in sync.</p>
        </div>
      ) : (
        <div className="scroll-fade-bottom relative min-h-0 min-w-0 flex-1 overflow-auto">
          <table className="conflict-list-table text-xs">
            {/* Headers, rows and expanded diffs share the same grid tracks. */}
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b text-left text-[11px] text-muted-foreground">
                <th className="py-1.5 text-left font-medium">
                  <div className="flex items-center gap-4">
                  <Checkbox
                    checked={allSelected}
                    disabled={batchable.length === 0}
                    label={allSelected ? 'Clear selection' : 'Select all low-risk conflicts'}
                    onChange={() => setSelected(allSelected ? [] : batchable.map((c) => c.id))}
                  />
                    <span className="w-[58px] shrink-0 text-center">Severity</span>
                  </div>
                </th>
                <th className="px-1.5 py-1.5 text-left font-medium">Issue</th>
                <th className="px-1.5 py-1.5 text-left font-medium">Description</th>
                <th className="px-1.5 py-1.5 text-left font-medium whitespace-nowrap">Status</th>
                <th className="py-1.5 pr-3 pl-1 text-left font-medium whitespace-nowrap">Reviewers</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="conflict-list-empty px-3 py-8 text-center text-muted-foreground">
                    {filter.id === 'mine' ? 'Nothing needs your review right now.' : 'No conflicts in this view.'}
                  </td>
                </tr>
              )}
              {visible.map((conflict) => {
                const severity = severityConfig[conflict.severity] ?? severityConfig.medium
                const reviewers = conflict.reviewers
                  .map((r) => allPeople.find((p) => p.id === r.id))
                  .filter(Boolean)

                const expandable = conflict.severity === 'low' && !!conflict.diff
                const expanded = expandable && expandedId === conflict.id
                return (
                  <Fragment key={conflict.id}>
                  <tr
                    onClick={() => { setBottomPanel({ conflictMode: 'overview' }); openConflictReview(conflict.id) }}
                    tabIndex={0}
                    aria-label={`Review ${conflict.title}`}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setBottomPanel({ conflictMode: 'overview' })
                    openConflictReview(conflict.id)
                      }
                    }}
                    aria-selected={reviewConflictId === conflict.id}
                    className={cn(
                      'group animate-in cursor-pointer border-b border-border/60 align-middle fade-in slide-in-from-top-1 duration-300 transition-colors last:border-0 hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-2 focus-visible:outline-primary aria-selected:bg-muted/60',
                      !isOpen(conflict) && 'opacity-60'
                    )}
                  >
                    <td className="py-2">
                      <div className="flex items-center gap-4">
                      <span onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={selection.includes(conflict.id)}
                        disabled={!canBatchApprove(conflict)}
                        label={
                          canBatchApprove(conflict)
                            ? `Select ${conflict.title}`
                            : 'Only low-risk conflicts waiting on review can be batch-approved'
                        }
                        onChange={() => toggle(conflict.id)}
                      />
                      </span>
                      <SeverityPill level={severity.label} className="ds-project-severity" data-level={severity.label.toLowerCase()} />
                      </div>
                    </td>
                    <td className="min-w-0 px-1.5 py-2">
                      <div className="min-w-0 space-y-px">
                        <p className="line-clamp-1 text-[11.5px] leading-4 font-medium break-words text-white" title={conflict.title}><LocalizedText text={conflict.title} /></p>
                        <p className="flex min-w-0 items-start gap-1 text-[10px] leading-3 text-slate-400">
                          <FileCode2 className="mt-0.5 size-2.5 shrink-0" />
                          <span className="line-clamp-1 font-mono [overflow-wrap:anywhere]" title={conflict.file}>{conflict.file}</span>
                        </p>
                      </div>
                    </td>
                    <td className="min-w-0 px-1.5 py-2">
                      <div className="min-w-0 space-y-1">
                        {conflict.message && (
                          <p className="line-clamp-2 text-[11px] leading-4 text-slate-400" title={conflict.message}>
                            <LocalizedText text={conflict.message} />
                          </p>
                        )}
                        {expandable && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              setExpandedId(expanded ? null : conflict.id)
                            }}
                            className="text-[10px] leading-3 text-slate-500 transition-colors hover:text-slate-300"
                          >
                            {expanded ? 'Hide quick diff' : 'Quick diff'}
                          </button>
                        )}
                        {!conflict.message && !expandable && <span className="text-slate-500">—</span>}
                      </div>
                    </td>
                    {/* Status wraps within its own column. */}
                    <td className="px-1.5 py-2">
                      <span className="flex flex-wrap items-center gap-1.5 text-foreground/80">
                        <span className={cn('ds-status-dot shrink-0 rounded-full', STAGE_DOT_CLASS[conflict.reviewStage])} />
                        <LocalizedText text={STAGE_LABEL[conflict.reviewStage]} />
                        {needsReviewFrom(conflict) && (
                            <span className="inline-flex h-4 items-center rounded-full bg-emerald-400/10 px-1.5 text-[9.5px] font-medium text-emerald-300">
                            Needs your review
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-2 pr-3 pl-1 text-left">
                      {reviewers.length ? (
                        <div className="flex flex-wrap justify-start gap-y-1 -space-x-1.5">
                          {reviewers.map((person) => (
                            <Avatar key={person.id} size="sm" className="size-5 ring-2 ring-card" title={person.name}>
                              <AvatarFallback className={cn('text-[10px] font-medium text-white', person.colorClass)}>
                                {person.initials}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </td>

                  </tr>
                  {expanded && (
                    // The diff spans Issue → Reviewers; selection and
                    // severity columns stay aligned above.
                    <tr className="border-b border-border/60 bg-white/[0.015]">
                      <td />
                      <td colSpan={4} className="conflict-list-diff min-w-0 px-3 pt-2 pb-4">
                        <MiniDiff conflict={conflict} />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>

          {selection.length > 0 && (
            <div data-batch-actions className="sticky bottom-3 z-10 mx-auto flex w-fit items-center gap-2 rounded-full bg-[#1c1c1f] py-1.5 pr-1.5 pl-3 text-xs shadow-[0_12px_32px_-8px_rgba(0,0,0,0.8)] ring-1 ring-white/10 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <span className="text-slate-300 tabular-nums">
                <span className="font-semibold text-white">{selection.length}</span> low-risk selected
              </span>
              <button
                type="button"
                onClick={() => setSelected([])}
                aria-label="Clear selection"
                className="flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                <X className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={approveSelected}
                className="ds-primary-cta inline-flex h-7 items-center gap-1.5 rounded-md px-3 font-medium"
              >
                <CheckCheck className="size-3.5" />
                Batch Approve Selected
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const DIFF_TONES = {
  same: 'text-slate-400',
  add: 'bg-emerald-400/[0.08] text-emerald-300',
  remove: 'bg-destructive/[0.08] text-red-300',
}
const DIFF_MARKS = { same: ' ', add: '+', remove: '−' }

// A low-risk row's expansion: the proposed change as a compact inline diff,
// so what's being batch-approved can be checked in place. Capped in height
// with long lines wrapping to the available cell width.
function MiniDiff({ conflict }) {
  const rows = diffLines(conflict.diff.before ?? [], conflict.diff.after ?? [])
  return (
    <div className="max-h-32 w-full min-w-0 overflow-y-auto overflow-x-hidden rounded-lg border border-border/60 bg-black/25 py-1.5 font-mono text-[11px] leading-5">
      {rows.map((row, i) => (
        <div key={i} className={cn('flex min-w-0 w-full px-3 whitespace-pre-wrap [word-break:break-all]', DIFF_TONES[row.kind])} title={row.text}>
          <span className="w-4 shrink-0 opacity-70 select-none">{DIFF_MARKS[row.kind]}</span>
          <span className="min-w-0 flex-1 whitespace-pre-wrap [word-break:break-all]">{row.text || ' '}</span>
        </div>
      ))}
    </div>
  )
}

// Batch approval is for low-risk conflicts still waiting on review.
function canBatchApprove(conflict) {
  return conflict.severity === 'low' && (conflict.reviewStage === 'detected' || conflict.reviewStage === 'in_review')
}

function Checkbox({ checked, disabled, label, onChange }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        'conflict-checkbox flex size-4 shrink-0 items-center justify-center rounded-[4px] p-0 transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        checked
          ? 'text-emerald-300'
          : 'text-slate-400'
      )}
    >
      {checked && <Check className="size-3" strokeWidth={2} />}
    </button>
  )
}

export default ConflictPanel
