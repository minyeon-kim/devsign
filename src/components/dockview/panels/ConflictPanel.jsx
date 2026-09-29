import { Fragment, useState } from 'react'
import { toast } from 'sonner'
import { Check, CheckCheck, CircleAlert, CircleCheck, FileCode2, Info, TriangleAlert, X } from 'lucide-react'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { allPeople, currentUser } from '@/data/mockData'
import { STAGE_DOT_CLASS, STAGE_LABEL, conflictCounts, isOpen, isPendingMerge, needsReviewFrom, sortOpenFirst } from '@/lib/conflicts'
import { CATEGORY_TAB, CATEGORY_TAB_ACTIVE, CATEGORY_TAB_IDLE } from '@/components/mergestudio/floatingStyles'
import { diffLines } from '@/lib/lineDiff'
import { useWorkspace } from '@/state/WorkspaceProvider'

// One icon per row, chosen by severity and carried only inside the badge.
const severityConfig = {
  high: { label: 'High', icon: TriangleAlert, className: 'bg-destructive/15 text-destructive' },
  medium: { label: 'Medium', icon: CircleAlert, className: 'bg-amber-500/15 text-amber-500' },
  low: { label: 'Low', icon: Info, className: 'bg-sky-500/15 text-sky-500' },
}

// The bottom panel's Conflict Points tab: the one place a project's
// conflicts are inspected and merged (the workspace's `conflicts`).
// There's deliberately no one-click merge here — a row opens the
// conflict's review window, where merging is the last step of the
// review (see ConflictModal and the project's single ConflictReviewHost).
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

function ConflictPanel() {
  const { conflicts, reviewConflictId, openConflictReview, batchApproveConflicts, bottomPanel, setBottomPanel } =
    useWorkspace()
  const counts = conflictCounts(conflicts)
  const filter = FILTERS.find((f) => f.id === bottomPanel.conflictFilter) ?? FILTERS[0]
  const visible = sortOpenFirst(conflicts.filter(filter.test))
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

  return (
    <div className="flex h-full min-w-0 flex-col bg-card">
      {/* No internal title bar here — the bottom panel's tab above already
          reads "Conflict Points". */}
      {conflicts.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 px-6 pt-4 pb-3" role="group" aria-label="Filter conflicts">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={f.id === filter.id}
              onClick={() => setBottomPanel({ conflictFilter: f.id })}
              className={cn(CATEGORY_TAB, 'h-6 gap-1.5 px-2.5 text-[11px]', f.id === filter.id ? CATEGORY_TAB_ACTIVE : CATEGORY_TAB_IDLE)}
            >
              {f.label}
              <span className={cn('tabular-nums', f.id === 'mine' && counts.needsMyReview > 0 ? 'text-sky-300' : 'text-slate-500')}>
                {counts[f.count]}
              </span>
            </button>
          ))}
        </div>
      )}
      {conflicts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
          <CircleCheck className="size-6 text-emerald-500" />
          <p className="text-xs">No conflicts — design and code are in sync.</p>
        </div>
      ) : (
        <div className="relative min-h-0 min-w-0 flex-1 overflow-auto">
          <table className="w-full min-w-[860px] table-fixed border-collapse text-xs">
            {/* Shared widths keep the header, rows and expanded diff aligned.
                Only Issue grows; narrow panels scroll within the list. */}
            <colgroup>
              <col className="w-12" />
              <col className="w-28" />
              <col />
              <col className="w-44" />
              <col className="w-28" />
              <col className="w-[108px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b text-left text-[11px] text-muted-foreground">
                <th className="py-3 pr-2 pl-6">
                  <Checkbox
                    checked={allSelected}
                    disabled={batchable.length === 0}
                    label={allSelected ? 'Clear selection' : 'Select all low-risk conflicts'}
                    onChange={() => setSelected(allSelected ? [] : batchable.map((c) => c.id))}
                  />
                </th>
                <th className="px-3 py-3 font-medium whitespace-nowrap">Severity</th>
                <th className="px-3 py-3 font-medium">Issue</th>
                <th className="px-3 py-3 font-medium whitespace-nowrap">Status</th>
                <th className="py-3 pr-3 pl-1 text-right font-medium whitespace-nowrap">Reviewers</th>
                <th className="py-3 pr-6 pl-3" />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    {filter.id === 'mine' ? 'Nothing needs your review right now.' : 'No conflicts in this view.'}
                  </td>
                </tr>
              )}
              {visible.map((conflict) => {
                const severity = severityConfig[conflict.severity] ?? severityConfig.medium
                const SeverityIcon = severity.icon
                const reviewers = conflict.reviewers
                  .map((r) => allPeople.find((p) => p.id === r.id))
                  .filter(Boolean)

                const expandable = conflict.severity === 'low' && !!conflict.diff
                const expanded = expandable && expandedId === conflict.id
                return (
                  <Fragment key={conflict.id}>
                  <tr
                    onClick={() => (expandable ? setExpandedId(expanded ? null : conflict.id) : openConflictReview(conflict.id))}
                    aria-expanded={expandable ? expanded : undefined}
                    aria-selected={reviewConflictId === conflict.id}
                    className={cn(
                      'group animate-in cursor-pointer border-b border-border/60 align-middle fade-in slide-in-from-top-1 duration-300 last:border-0 hover:bg-muted/40 aria-selected:bg-muted/60',
                      !isOpen(conflict) && 'opacity-60'
                    )}
                  >
                    <td className="py-4 pr-2 pl-6" onClick={(event) => event.stopPropagation()}>
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
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <Badge className={cn('gap-1 border-transparent', severity.className)}>
                        <SeverityIcon className="size-3" />
                        {severity.label}
                      </Badge>
                    </td>
                    <td className="min-w-0 px-3 py-4">
                      <div className="min-w-0 space-y-1">
                        <p className="line-clamp-2 leading-5 font-medium break-words text-foreground">{conflict.title}</p>
                        <p className="flex min-w-0 items-start gap-1 text-[11px] leading-4 text-muted-foreground">
                          <FileCode2 className="mt-0.5 size-3 shrink-0" />
                          <span className="line-clamp-2 font-mono [overflow-wrap:anywhere]" title={conflict.file}>{conflict.file}</span>
                        </p>
                        {conflict.message && (
                          <p className="line-clamp-2 text-[11px] leading-4 break-words text-foreground/60" title={conflict.message}>
                            {conflict.message}
                          </p>
                        )}
                      </div>
                    </td>
                    {/* Status wraps within its own column, without pushing the CTA. */}
                    <td className="px-3 py-4 whitespace-nowrap">
                      <span className="flex flex-wrap items-center gap-1.5 text-foreground/80">
                        <span className={cn('size-1.5 shrink-0 rounded-full', STAGE_DOT_CLASS[conflict.reviewStage])} />
                        {STAGE_LABEL[conflict.reviewStage]}
                        {needsReviewFrom(conflict) && (
                          <span className="inline-flex h-5 items-center rounded-full bg-sky-400/10 px-2 text-[10.5px] font-medium text-sky-300">
                            Needs your review
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-4 pr-3 pl-1 text-right">
                      {reviewers.length ? (
                        <div className="flex flex-wrap justify-end gap-y-1 -space-x-1.5">
                          {reviewers.map((person) => (
                            <Avatar key={person.id} size="sm" className="ring-2 ring-card" title={person.name}>
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
                    <td className="py-4 pr-6 pl-3 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          openConflictReview(conflict.id)
                        }}
                        className={REVIEW_CTA}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                  {expanded && (
                    // Lined up under the row's own columns: the diff spans
                    // Issue → Reviewers; the checkbox, Severity and Review
                    // columns stay clear (the row's Review button is right
                    // above).
                    <tr className="border-b border-border/60 bg-white/[0.015]">
                      <td />
                      <td />
                      <td colSpan={3} className="min-w-0 px-3 pt-2 pb-4">
                        <MiniDiff conflict={conflict} />
                      </td>
                      <td />
                    </tr>
                  )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>

          {selection.length > 0 && (
            <div className="sticky bottom-3 z-10 mx-auto flex w-fit items-center gap-2 rounded-full bg-[#1c1c1f] py-1.5 pr-1.5 pl-4 text-xs shadow-[0_12px_32px_-8px_rgba(0,0,0,0.8)] ring-1 ring-white/10 animate-in fade-in slide-in-from-bottom-2 duration-150">
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
                className="inline-flex h-7 items-center gap-1.5 rounded-full bg-emerald-400 px-3 font-semibold text-slate-950 transition-colors hover:bg-emerald-300"
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

// The row's primary action: a filled accent pill (the studio's one accent),
// so "Review" reads as the thing to do next rather than a passing link.
const REVIEW_CTA =
  'inline-flex h-9 w-[72px] shrink-0 items-center justify-center rounded-full bg-emerald-400 px-3.5 text-xs font-semibold whitespace-nowrap text-slate-950 shadow-sm shadow-emerald-500/20 transition-colors hover:bg-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-300/60 focus-visible:outline-none'

const DIFF_TONES = {
  same: 'text-slate-400',
  add: 'bg-emerald-400/[0.08] text-emerald-300',
  remove: 'bg-destructive/[0.08] text-red-300',
}
const DIFF_MARKS = { same: ' ', add: '+', remove: '−' }

// A low-risk row's expansion: the proposed change as a compact inline diff,
// so what's being batch-approved can be checked in place. Capped in height
// with long lines scrolling horizontally. `w-0 min-w-full` keeps them from widening the
// table: it fills its cell without adding to the column widths.
function MiniDiff({ conflict }) {
  const rows = diffLines(conflict.diff.before ?? [], conflict.diff.after ?? [])
  return (
    <div className="max-h-32 w-0 min-w-full overflow-auto rounded-lg border border-border/60 bg-black/25 py-1.5 font-mono text-[11px] leading-5 [scrollbar-width:thin]">
      {rows.map((row, i) => (
        <div key={i} className={cn('flex min-w-full w-max px-3', DIFF_TONES[row.kind])} title={row.text}>
          <span className="w-4 shrink-0 opacity-70 select-none">{DIFF_MARKS[row.kind]}</span>
          <span className="whitespace-pre">{row.text || ' '}</span>
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
        'flex size-4 items-center justify-center rounded-[5px] transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        checked
          ? 'bg-emerald-400 text-slate-950'
          : 'bg-white/[0.06] ring-[1.5px] ring-slate-300/70 ring-inset hover:bg-white/[0.1] hover:ring-white'
      )}
    >
      {checked && <Check className="size-3" strokeWidth={3} />}
    </button>
  )
}

export default ConflictPanel
