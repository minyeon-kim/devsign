import { useState } from 'react'
import { toast } from 'sonner'
import { Check, CheckCheck, ChevronRight, CircleAlert, CircleCheck, FileCode2, Info, TriangleAlert, X } from 'lucide-react'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { allPeople } from '@/data/mockData'
import { STAGE_DOT_CLASS, STAGE_LABEL, isOpen, sortOpenFirst } from '@/lib/conflicts'
import { useWorkspace } from '@/state/WorkspaceProvider'

// One icon per row, chosen by severity and carried only inside the badge.
const severityConfig = {
  high: { label: 'High', icon: TriangleAlert, className: 'bg-destructive/15 text-destructive' },
  medium: { label: 'Medium', icon: CircleAlert, className: 'bg-amber-500/15 text-amber-500' },
  low: { label: 'Low', icon: Info, className: 'bg-sky-500/15 text-sky-500' },
}

// The bottom panel's Conflict Points tab: the one place a project's
// conflicts are inspected and resolved (the workspace's `conflicts`).
// There's deliberately no one-click Resolve here — a row opens the
// conflict's review window, where resolving is the last step of the
// review (see ConflictModal and the project's single ConflictReviewHost).
// Low-risk items waiting on review can be checked and approved together
// from the floating batch bar (resolving each stays its own step).
function ConflictPanel() {
  const { conflicts, reviewConflictId, openConflictReview, batchApproveConflicts } = useWorkspace()
  const openCount = conflicts.filter(isOpen).length
  const [selected, setSelected] = useState([])
  const batchable = conflicts.filter(canBatchApprove)
  // Only what's still batchable stays selected (e.g. after a review moves on).
  const selection = selected.filter((id) => batchable.some((c) => c.id === id))
  const allSelected = batchable.length > 0 && selection.length === batchable.length

  function toggle(id) {
    setSelected(selection.includes(id) ? selection.filter((x) => x !== id) : [...selection, id])
  }

  function approveSelected() {
    const count = batchApproveConflicts(selection)
    setSelected([])
    if (count) toast(`${count} low-risk conflict${count === 1 ? '' : 's'} approved`, { description: 'Resolve each to apply its change.' })
  }

  return (
    <div className="flex h-full flex-col bg-card">
      {/* No internal title bar here — the bottom panel's tab above already
          reads "Conflict Points". */}
      {conflicts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
          <CircleCheck className="size-6 text-emerald-500" />
          <p className="text-xs">No conflicts — design and code are in sync.</p>
        </div>
      ) : (
        <div className="relative flex-1 overflow-auto">
          <table className="w-full min-w-[620px] border-collapse text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b text-left text-[11px] text-muted-foreground">
                <th className="w-0 py-2 pr-0 pl-3">
                  <Checkbox
                    checked={allSelected}
                    disabled={batchable.length === 0}
                    label={allSelected ? 'Clear selection' : 'Select all low-risk conflicts'}
                    onChange={() => setSelected(allSelected ? [] : batchable.map((c) => c.id))}
                  />
                </th>
                <th className="px-3 py-2 font-medium">Severity</th>
                <th className="px-3 py-2 font-medium">Issue · {openCount} open</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Reviewers</th>
                <th className="w-0 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {sortOpenFirst(conflicts).map((conflict) => {
                const severity = severityConfig[conflict.severity] ?? severityConfig.medium
                const SeverityIcon = severity.icon
                const reviewers = conflict.reviewers
                  .map((r) => allPeople.find((p) => p.id === r.id))
                  .filter(Boolean)

                return (
                  <tr
                    key={conflict.id}
                    onClick={() => openConflictReview(conflict.id)}
                    aria-selected={reviewConflictId === conflict.id}
                    className={cn(
                      'group animate-in cursor-pointer border-b border-border/60 align-top fade-in slide-in-from-top-1 duration-300 last:border-0 hover:bg-muted/40 aria-selected:bg-muted/60',
                      !isOpen(conflict) && 'opacity-60'
                    )}
                  >
                    <td className="py-2.5 pr-0 pl-3" onClick={(event) => event.stopPropagation()}>
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
                    <td className="px-3 py-2.5">
                      <Badge className={cn('gap-1 border-transparent', severity.className)}>
                        <SeverityIcon className="size-3" />
                        {severity.label}
                      </Badge>
                    </td>
                    <td className="max-w-72 px-3 py-2.5">
                      <p className="truncate font-medium text-foreground">{conflict.title}</p>
                      <p className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                        <FileCode2 className="size-3 shrink-0" />
                        <span className="truncate">{conflict.file}</span>
                      </p>
                      {conflict.message && (
                        <p className="mt-1 line-clamp-1 text-foreground/70">{conflict.message}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="flex items-center gap-1.5 text-foreground/80">
                        <span className={cn('size-1.5 rounded-full', STAGE_DOT_CLASS[conflict.reviewStage])} />
                        {STAGE_LABEL[conflict.reviewStage]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {reviewers.length ? (
                        <div className="flex -space-x-1.5">
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
                    <td className="py-2.5 pr-3 pl-1 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          openConflictReview(conflict.id)
                        }}
                        className="inline-flex h-6 items-center gap-0.5 rounded-md px-2 text-[11px] font-medium text-muted-foreground transition-colors group-hover:text-foreground hover:bg-muted"
                      >
                        Review
                        <ChevronRight className="size-3" />
                      </button>
                    </td>
                  </tr>
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
        'flex size-4 items-center justify-center rounded-[5px] transition-colors disabled:cursor-not-allowed disabled:opacity-30',
        checked ? 'bg-emerald-400 text-slate-950' : 'ring-1 ring-white/25 hover:ring-white/50'
      )}
    >
      {checked && <Check className="size-3" strokeWidth={3} />}
    </button>
  )
}

export default ConflictPanel
