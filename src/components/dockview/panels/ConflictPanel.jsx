import './ConflictPanel.css'
import { PLAIN_BADGE } from '@/components/conflicts/ConflictBadges'
import { ConflictTypeTag, MismatchLabel } from '@/components/conflicts/ConflictInsight'
import MergeCancellationSummary from '@/components/conflicts/MergeCancellationSummary'
import { conflictListRecord, isDesignReview } from '@/lib/conflicts'
import { Fragment, useEffect, useState } from 'react'
import { toast } from '@/i18n/toast'
import { ArrowRight, Check, CheckCheck, ChevronDown, CircleCheck, FileCode2, Layers3, MessageSquare, ScanSearch, TriangleAlert, X } from 'lucide-react'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { allPeople } from '@/data/mockData'
import { authorOf, gitFlowOf, isOpen, listStatusOf, needsReviewFrom, shortDue } from '@/lib/conflicts'
import { SeverityPill } from '@/components/mergestudio/ConflictTag'
import { MergeFilterButton } from '@/components/mergestudio/MergeFilterMenu'
import { CONFLICT_STATUS_FILTERS, useConflictList } from '@/components/conflicts/useConflictList'
import ChangePreview from '@/components/conflicts/ChangePreview'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LocalizedText } from '@/i18n/runtime'
import ReviewDetail from '@/components/conflicts/ReviewDetail'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { allDecided } from '@/lib/driftDecisions'
import { sizeAdjustmentOf } from '@/lib/sizeAdjustment'

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
// A merge request for a mix of design drafts has several drafts rather
// than one design ↔ code difference. Keep this predicate local to the
// panel because it is only used to label rows in the shared queue.
function isDraftMerge(conflict, mergeItems = []) {
  if (conflict.id.startsWith('mr-')) return true
  const item = mergeItems.find((m) => m.id === conflict.mergeItemId || m.conflictId === conflict.id)
  return (item?.variants?.length ?? 0) > 1
}

// `inMergeStudio`: this is Merge Studio's own Conflict Points tab — the
// list is the project-wide one either way, but picking a conflict there
// also puts its item on the canvas (see the effect below).
function ConflictPanel({ inMergeStudio }) {
  const { conflicts, mergeItems, reviewConflictId, reviewView, batchApproveConflicts, currentUser, requestMergeFocus, mergeFocus } = useWorkspace()
  const reviewConflict = conflicts.find((c) => c.id === reviewConflictId && conflictListRecord(c)) ?? null
  // A conflict links to its merge item either way round — its own
  // `mergeItemId`, or the item's `conflictId` pointing back at it (most of
  // conflictChecklist only has the latter; see mockData). Resolve both so
  // "which item is this conflict's" works for any conflict in the list,
  // not just ones that happen to carry `mergeItemId` themselves.
  const reviewConflictItemId =
    reviewConflict && (reviewConflict.mergeItemId ?? mergeItems.find((mi) => mi.conflictId === reviewConflict.id)?.id ?? null)
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
    if (!inMergeStudio || !reviewConflict || !reviewConflictItemId || isDesignReview(reviewConflict)) return
    // Opened by the canvas's own drift pager, which already focused this
    // element (without panning) — don't refocus and yank the camera.
    const focused = mergeFocus?.target
    if (focused?.itemId === reviewConflictItemId && (
      (reviewConflict.layerId && focused.layerId === reviewConflict.layerId) ||
      (!reviewConflict.layerId && focused.fileId === reviewConflict.fileId && focused.line === reviewConflict.line)
    )) return
    // A conflict with neither still switches the item open (so it's at
    // least on canvas to look at) — it just lands without a pinpoint pan.
    requestMergeFocus({
      itemId: reviewConflictItemId,
      label: reviewConflict.title,
      // Both artboards in view, the element marked — not zoomed into one side.
      overview: true,
      ...(reviewConflict.layerId
        ? { layerId: reviewConflict.layerId }
        : reviewConflict.fileId && reviewConflict.line
          ? { fileId: reviewConflict.fileId, line: reviewConflict.line }
          : {}),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inMergeStudio, reviewConflict?.id, reviewConflictItemId])
  // What's listed, filtered and ordered — the same list the activity
  // bar's sidebar draws (useConflictList). Here a row opens its detail in
  // the full-screen viewer; in Merge Studio it stays in this panel, beside
  // the canvas it points at.
  const { queued, visible, filter, shownFilters, setFilter, countOf, advancedFilters, setAdvancedFilters, filterItems, markedDueDates, typeFilter, setTypeFilter, typeOptions, open: openRow } = useConflictList({ view: inMergeStudio ? 'panel' : 'overlay' })
  const [selected, setSelected] = useState([])
  // The confirm step before a batch approval (see BatchApproveDialog).
  const [confirming, setConfirming] = useState(false)
  const { comments, conflictChecks, decisionsFor, mergeDrafts } = useWorkspace()
  const blockerOf = (conflict) => batchBlocker(conflict, comments)
  const batchable = queued.filter((c) => !blockerOf(c))
  // Only what's still batchable stays selected (e.g. after a review moves on).
  const selection = selected.filter((id) => batchable.some((c) => c.id === id))
  const allSelected = batchable.length > 0 && selection.length === batchable.length

  function toggle(id) {
    setSelected(selection.includes(id) ? selection.filter((x) => x !== id) : [...selection, id])
  }

  function approveSelected() {
    const { approved, waiting } = batchApproveConflicts(selection)
    setSelected([])
    setConfirming(false)
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

  // (In the full-screen viewer, the list stays here behind it.)
  if (reviewConflict && reviewView === 'panel') return <ReviewDetail conflict={reviewConflict} inMergeStudio={inMergeStudio} />

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-card">
      {/* No internal title bar here — the bottom panel's tab above already
          reads "Conflict Points". */}
      {conflicts.length > 0 && (
        // Filters are plain text toggles, not pills — the pills belong to the
        // bottom panel's tabs above, and repeating them here read as a
        // second row of tabs instead of a filter on this one.
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-0 pb-1.5" role="group" aria-label="Filter conflicts">
          {shownFilters.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={f.id === filter.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'ds-intrinsic inline-flex h-6 shrink-0 items-center gap-1 text-xs whitespace-nowrap transition-colors',
                f.id === filter.id ? 'font-medium text-white' : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <LocalizedText text={f.label} />
              <FilterCount mine={f.id === 'mine'} count={countOf(f)} />
            </button>
          ))}
          {typeOptions.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger data-type-filter className={cn('ds-intrinsic inline-flex h-6 shrink-0 items-center gap-1 text-xs whitespace-nowrap transition-colors', typeFilter ? 'font-medium text-white' : 'text-slate-400 hover:text-slate-200')}>
                <LocalizedText text="Type" />
                {typeFilter && <><span className="text-slate-500">·</span><LocalizedText text={typeOptions.find((option) => option.id === typeFilter)?.label ?? ''} /></>}
                <ChevronDown className="size-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-44">
                <DropdownMenuRadioGroup value={typeFilter ?? 'all'} onValueChange={(value) => setTypeFilter(value === 'all' ? null : value)}>
                  <DropdownMenuRadioItem value="all" className="text-xs"><LocalizedText text="All types" /></DropdownMenuRadioItem>
                  {typeOptions.map((option) => (
                    <DropdownMenuRadioItem key={option.id} value={option.id} className="text-xs">
                      <LocalizedText text={option.label} />
                      <span className="ml-auto pl-3 text-slate-500 tabular-nums">{option.count}</span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <MergeFilterButton
            compact
            simple
            value={advancedFilters}
            onChange={setAdvancedFilters}
            items={filterItems}
            markedDays={markedDueDates}
            statusOptions={CONFLICT_STATUS_FILTERS}
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
            <thead className="sticky top-0 z-20 bg-card">
              <tr className="border-b text-left text-xs text-slate-300">
                <th className="py-1.5 text-left font-medium">
                  <Checkbox
                    checked={allSelected}
                    disabled={batchable.length === 0}
                    label={allSelected ? 'Clear selection' : 'Select all low-risk conflicts'}
                    onChange={() => setSelected(allSelected ? [] : batchable.map((c) => c.id))}
                  />
                </th>
                <th className="py-1.5 text-left font-medium whitespace-nowrap">Status</th>
                <th className="py-1.5 text-left font-medium whitespace-nowrap">Severity</th>
                <th className="py-1.5 text-left font-medium whitespace-nowrap">Type</th>
                <th className="py-1.5 text-left font-medium">Issue</th>
                <th className="py-1.5 text-left font-medium">Description</th>
                <th className="py-1.5 text-left font-medium whitespace-nowrap">Checks</th>
                <th className="py-1.5 text-left font-medium whitespace-nowrap">Reviewers</th>
                <th className="py-1.5 text-left font-medium whitespace-nowrap">Author · Updated</th>
                <th className="py-1.5 text-left font-medium whitespace-nowrap">Due date</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={10} className="conflict-list-empty px-3 py-8 text-center text-muted-foreground">
                    {filter.id === 'mine' ? 'Nothing needs your review right now.' : 'No conflicts in this view.'}
                  </td>
                </tr>
              )}
              {visible.map((conflict) => {
                const severity = severityConfig[conflict.severity] ?? severityConfig.medium
                // You first, so "waiting on you" (the ring) is always the
                // first avatar.
                const reviewers = conflict.reviewers
                  .map((r) => allPeople.find((p) => p.id === r.id))
                  .filter(Boolean)
                  .sort((a, b) => Number(b.id === currentUser.id) - Number(a.id === currentUser.id))

                const blocker = blockerOf(conflict)
                const author = allPeople.find((p) => p.id === authorOf(conflict))
                const commentCount = threadOf(conflict, comments).count
                const failingChecks = isOpen(conflict) ? (conflictChecks(conflict)?.failing.length ?? 0) : 0
                const flow = gitFlowOf(conflict)
                const updated = (conflict.resolvedAtLabel ?? conflict.timestamp ?? conflict.detectedAt ?? '—').replace(/, \d{1,2}:\d{2} (AM|PM)$/, '')
                const mine = isOpen(conflict) && needsReviewFrom(conflict)
                // Settled by resizing the element in Merge Studio: how it's
                // being handled, said under its status.
                const adjusted = isOpen(conflict) && Boolean(sizeAdjustmentOf(conflict, mergeItems.find((m) => m.id === conflict.mergeItemId || m.conflictId === conflict.id), mergeDrafts?.current))
                const readyToRequest = conflict.reviewStage === 'detected' && allDecided(conflict, mergeItems, decisionsFor)
                return (
                  <Fragment key={conflict.id}>
                  <tr
                    onClick={() => { openRow(conflict.id) }}
                    tabIndex={0}
                    aria-label={`Review ${conflict.title}`}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                    openRow(conflict.id)
                      }
                    }}
                    aria-selected={reviewConflictId === conflict.id}
                    className={cn(
                      'group animate-in cursor-pointer border-b border-border/60 align-middle fade-in slide-in-from-top-1 duration-300 transition-colors last:border-0 hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-2 focus-visible:outline-primary aria-selected:bg-muted/60',
                      // Done: the whole row steps back.
                      !isOpen(conflict) && 'opacity-45'
                    )}
                  >
                    {/* Every cell starts at the same top inset. Chips are
                        24px tall, so the checkbox (16px), avatars and text
                        (20px lines) are nudged onto the chip's center line. */}
                    <td className="py-3.5 pt-[18px]" onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={selection.includes(conflict.id)}
                        disabled={Boolean(blocker)}
                        label={blocker ?? `Select ${conflict.title}`}
                        onChange={() => toggle(conflict.id)}
                      />
                    </td>
                    {/* One short status — a dot and a word, the filter's own;
                        how far along it is shows on hover. */}
                    <td className="py-3.5 pt-4">
                      <ListStatus conflict={conflict} ready={readyToRequest} note={adjusted ? 'Adjusted manually' : null} />
                    </td>
                    <td className="py-3.5">
                      <SeverityPill bare quiet level={severity.label} />
                    </td>
                    {/* What kind of thing it is — one broad tag — and, under
                        it, the kind of difference. */}
                    <td className="min-w-0 py-3.5 pt-4">
                      <ConflictTypeTag conflict={conflict} />
                      <MismatchLabel conflict={conflict} className="mt-1 block truncate text-[11px] leading-4 text-slate-500" />
                    </td>
                    {/* The branch isn't a column — it's on hover here, and in
                        the review's Details. */}
                    <td className="min-w-0 py-3.5 pt-4" title={flow ? `${flow.source} → ${flow.target}` : undefined}>
                      <div className="min-w-0 space-y-px">
                        <p className="flex min-w-0 items-center gap-1.5 text-[13px] leading-5 font-medium text-white" title={conflict.title}>
                          <span className="min-w-0 break-words"><LocalizedText text={conflict.title} /></span>
                          {/* A mix of design drafts sent from Design Compare —
                              told apart from design ↔ code conflicts. */}
                          {isDraftMerge(conflict, mergeItems) && (
                            <span data-draft-merge className="inline-flex h-5 shrink-0 items-center gap-1 rounded-md bg-sky-400/15 px-1.5 text-[11px] font-medium whitespace-nowrap text-sky-200">
                              <Layers3 className="size-3" />
                              <LocalizedText text="Draft merge" />
                            </span>
                          )}
                          {/* Discussion at a glance (also what keeps a change out of batch approval). */}
                          {commentCount > 0 && (
                            <span className="inline-flex shrink-0 items-center gap-0.5 text-[11.5px] font-normal text-slate-300" aria-label={`${commentCount} comments`}>
                              <MessageSquare className="size-3" />{commentCount}
                            </span>
                          )}
                        </p>
                        <p className="flex min-w-0 items-start gap-1 text-[11.5px] leading-4 text-slate-300">
                          <FileCode2 className="mt-0.5 size-3 shrink-0" />
                          <span className="font-mono [overflow-wrap:anywhere]">{conflict.file}</span>
                        </p>
                      </div>
                    </td>
                    <td className="min-w-0 py-3.5 pt-4">
                      <div className="min-w-0 space-y-1">
                        {conflict.rollback ? (
                          // A rollback agreement: what's rolled back, who
                          // it affects, and how many of them have confirmed.
                          <p className="truncate text-[12.5px] leading-5 text-slate-300">
                            <span className="text-slate-400"><LocalizedText text="Rolling back" /> </span>
                            <LocalizedText text={conflict.rollback.target} />
                            <span className="text-slate-400"> · <LocalizedText text="Affected" /> </span>
                            <span className="tabular-nums">{conflict.reviewers.length}</span>
                            <span className="text-slate-400"> · <LocalizedText text="Confirmed" /> </span>
                            <span className="tabular-nums">{conflict.reviewers.filter((r) => r.status === 'approved').length}/{conflict.reviewers.length}</span>
                          </p>
                        ) : conflict.revertOf ? (
                          <MergeCancellationSummary conflict={conflict} conflicts={conflicts} />
                        ) : conflict.message ? (
                          <p className="truncate text-[12.5px] leading-5 text-slate-300" title={conflict.message}>
                            <LocalizedText text={conflict.message} />
                          </p>
                        ) : <span className="text-slate-500">—</span>}
                      </div>
                    </td>
                    <td className="py-3.5 pt-4 leading-5">
                      {/* Every row says something: a count when checks need
                          attention, a quiet dash when there's nothing to do. */}
                      {failingChecks > 0 ? (
                        <span className="inline-flex h-5 items-center gap-1 text-xs font-medium text-amber-300" title="Checks need attention — merging waits on them">
                          <TriangleAlert className="size-3.5" />
                          <span className="tabular-nums">{failingChecks}</span>
                        </span>
                      ) : <span className="text-xs text-slate-600">—</span>}
                    </td>
                    <td className="py-3.5 pt-4 text-left">
                      {reviewers.length ? (
                        <PeopleHover
                          people={reviewers.map((person) => {
                            const status = conflict.reviewers.find((r) => r.id === person.id)?.status
                            const yours = mine && person.id === currentUser.id
                            return {
                              person,
                              note: yours ? 'Needs your review' : (conflict.rollback ? ROLLBACK_NOTE : REVIEW_NOTE)[status],
                              tone: yours ? 'mine' : status,
                              className: cn('ring-2', yours ? 'z-10 ring-emerald-400' : 'ring-card'),
                            }
                          })}
                        />
                      ) : (
                        // Nobody yet: the empty seat, not a word that
                        // breaks the column of avatars.
                        <span title="Unassigned" aria-label="Unassigned" className="block size-5 rounded-full border border-dashed border-white/25" />
                      )}
                    </td>
                    {/* Who and when, together, in the same two places on every
                        row: a 20px mark — the author, or the automatic-
                        detection icon when no person made the change — then
                        the day (the exact time is on hover). */}
                    <td className="py-3.5 pt-4">
                      <span className="flex items-center gap-2 text-xs leading-5 whitespace-nowrap text-slate-300 tabular-nums">
                        <AuthorMark person={author} />
                        <span title={conflict.resolvedAtLabel ?? conflict.timestamp ?? conflict.detectedAt}><LocalizedText text={updated} /></span>
                      </span>
                    </td>
                    {/* (…and the row's own → at its far end, on hover: the
                        whole row is the way into its detail.) */}
                    <td className="py-3.5 pt-4 text-xs leading-5 whitespace-nowrap tabular-nums">
                      <span className="flex items-center justify-between gap-3">
                      {shortDue(conflict.dueLabel) ? (
                        // Just the when — the column already says "Due date".
                        <span className={cn('inline-flex items-center gap-1', /overdue|today/i.test(conflict.dueLabel) ? 'font-medium text-amber-300' : 'text-slate-300')}>
                          <LocalizedText text={shortDue(conflict.dueLabel)} />
                        </span>
                      ) : <span className="text-slate-500">—</span>}
                      <ArrowRight aria-hidden data-row-arrow className="size-3.5 shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                      </span>
                    </td>
                  </tr>
                  </Fragment>
                )
              })}
            </tbody>
          </table>

          {selection.length > 0 && (
            <div data-batch-actions className="sticky bottom-3 z-10 mx-auto flex w-fit items-center gap-2 rounded-full bg-[#1D1D1D] py-1.5 pr-1.5 pl-3 text-xs shadow-[0_12px_32px_-8px_rgba(0,0,0,0.8)] ring-1 ring-white/10 animate-in fade-in slide-in-from-bottom-2 duration-150">
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
                onClick={() => setConfirming(true)}
                className="ds-primary-cta inline-flex h-7 items-center gap-1.5 rounded-md px-3 font-medium"
              >
                <CheckCheck className="size-3.5" />
                Review & approve
              </button>
            </div>
          )}
          <BatchApproveDialog
            open={confirming}
            onOpenChange={setConfirming}
            conflicts={selection.map((id) => conflicts.find((c) => c.id === id)).filter(Boolean)}
            comments={comments}
            onApprove={approveSelected}
          />
        </div>
      )}
    </div>
  )
}

// Batch approval is for changes with nothing left to look into: low risk,
// waiting on review, nobody has asked for changes, and no comment left
// unanswered. Anything else is reviewed on its own — the reason shows on
// its (disabled) checkbox.
function threadOf(conflict, comments) {
  const linked = comments.filter((c) => c.id === conflict.linkedCommentId || c.target?.conflictId === conflict.id)
  const top = linked.filter((c) => !c.target?.replyTo)
  return { count: linked.length, unanswered: top.filter((c) => !linked.some((r) => r.target?.replyTo === c.id)).length }
}

function batchBlocker(conflict, comments) {
  if (conflict.severity !== 'low') return 'Only low-risk changes can be batch-approved'
  if (conflict.reviewStage !== 'detected' && conflict.reviewStage !== 'in_review') return 'Not waiting on review'
  if (conflict.reviewers.some((r) => r.status === 'changes_requested')) return 'Changes were requested — review it on its own'
  if (threadOf(conflict, comments).unanswered) return 'Has an unanswered comment — review it on its own'
  return null
}

// The last look before a batch approval: each selected change as what a
// reviewer would check — the before / after design, the values that
// change, and its comments — then one Approve for all of them.
function BatchApproveDialog({ open, onOpenChange, conflicts, comments, onApprove }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-h-[80vh] gap-0 overflow-hidden bg-card p-0 sm:max-w-[560px]">
        <div className="px-5 pt-4 pb-3">
          <DialogTitle className="text-sm font-semibold text-white">
            <LocalizedText text={`Approve ${conflicts.length} low-risk change${conflicts.length === 1 ? '' : 's'}`} />
          </DialogTitle>
          <p className="mt-1 text-xs text-slate-400"><LocalizedText text="Check each change before approving them together." /></p>
        </div>
        <ul className="max-h-[56vh] space-y-2 overflow-y-auto px-5 pb-2">
          {conflicts.map((conflict) => {
            const thread = threadOf(conflict, comments)
            const author = allPeople.find((p) => p.id === authorOf(conflict))
            const screens = conflict.impact?.screens ?? []
            return (
              <li key={conflict.id} className="rounded-xl bg-white/[0.03] p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate text-[12.5px] font-medium text-white"><LocalizedText text={conflict.title} /></p>
                  <span className="shrink-0 text-[10.5px] text-slate-500">
                    <LocalizedText text={thread.count ? `${thread.count} comments` : 'No comments'} />
                  </span>
                </div>
                {/* Who, where, and what it touches. */}
                <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-[10.5px] text-slate-500">
                  {author && <span className="text-slate-400"><LocalizedText text={author.name} /></span>}
                  {author && <span aria-hidden>·</span>}
                  <span translate="no" className="font-mono">{conflict.file}{conflict.line ? `:${conflict.line}` : ''}</span>
                  {screens.length > 0 && <><span aria-hidden>·</span><LocalizedText text={screens.join(', ')} /></>}
                </p>
                {conflict.comparisonFields?.length > 0 && (
                  <dl className="mt-1.5 space-y-0.5">
                    {conflict.comparisonFields.map((field) => (
                      <div key={field.label} className="flex min-w-0 items-baseline gap-2 text-[11px]">
                        <dt className="shrink-0 text-slate-500"><LocalizedText text={field.label} /></dt>
                        <dd className="min-w-0 truncate">
                          <span className="text-red-300"><LocalizedText text={field.current} /></span>
                          <span className="px-1 text-slate-500">→</span>
                          <span className="text-emerald-200"><LocalizedText text={field.expected} /></span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {conflict.preview && (
                  <div className="mt-2 rounded-lg bg-black/20 p-2">
                    <ChangePreview preview={conflict.preview} />
                  </div>
                )}
                {/* The code that's being approved, as written. */}
                {Array.isArray(conflict.diff?.before) && (
                  <div className="mt-2 space-y-px overflow-hidden rounded-md bg-black/25 py-1 font-mono text-[10.5px] leading-4">
                    {(conflict.diff.before ?? []).map((line, i) => (
                      <p key={`b${i}`} className="truncate bg-red-500/[0.18] px-2 text-red-300" title={line}>− {line.trim()}</p>
                    ))}
                    {(conflict.diff.after ?? []).map((line, i) => (
                      <p key={`a${i}`} className="truncate bg-emerald-500/[0.18] px-2 text-emerald-300" title={line}>+ {line.trim()}</p>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        <div className="flex justify-end gap-2 px-5 pt-2 pb-4">
          <button type="button" onClick={() => onOpenChange(false)} className="h-8 rounded-full px-3 text-xs text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white">
            <LocalizedText text="Cancel" />
          </button>
          <button type="button" onClick={onApprove} className="ds-primary-cta inline-flex h-8 items-center gap-1.5 rounded-full px-4 text-xs font-semibold">
            <CheckCheck className="size-3.5" />
            <LocalizedText text={`Approve ${conflicts.length}`} />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const REVIEW_NOTE = { approved: 'Approved', changes_requested: 'Changes requested', pending: 'Pending' }
// On a rollback agreement the people listed are the ones it affects.
const ROLLBACK_NOTE = { approved: 'Confirmed', changes_requested: 'Objected', pending: 'Not confirmed yet' }

const NOTE_TONE = {
  approved: 'bg-emerald-400/15 text-emerald-200',
  mine: 'bg-emerald-400/15 text-emerald-200',
  changes_requested: 'bg-amber-400/15 text-amber-200',
}

// People in the list are only initials — hovering the stack says who they
// are, one line each: avatar · name · role · where they stand on this row.
// It opens under the avatars, so it never covers the column headers.
// Who made the change, as one 20px mark: their avatar ("Alex · Designer" on
// hover), or — for a conflict a check found on its own — a small system
// icon ("Detected automatically"). Never an empty seat.
function AuthorMark({ person }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span data-author-mark={person ? 'person' : 'auto'} className="flex size-5 shrink-0 items-center justify-center rounded-full" />} onClick={(event) => event.stopPropagation()}>
        {person ? (
          <Avatar size="xs">
            <AvatarFallback className="bg-[#3A3A3D] font-medium text-slate-100">{person.initials}</AvatarFallback>
          </Avatar>
        ) : (
          <span className="flex size-5 items-center justify-center rounded-full bg-white/[0.07] text-slate-300"><ScanSearch className="size-3" /></span>
        )}
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="block px-2.5 py-1.5 text-left text-xs leading-5 whitespace-nowrap">
        {person
          ? <><span translate="no" className="font-semibold">{person.fullName ?? person.name}</span> <span className="opacity-60">· <LocalizedText text={person.role} /></span></>
          : <LocalizedText text="Detected automatically" />}
      </TooltipContent>
    </Tooltip>
  )
}

function FilterCount({ mine, count }) {
  return <span className={cn('tabular-nums', mine && count > 0 ? 'text-emerald-300' : 'text-slate-500')}>{count}</span>
}

// A row's status: the dot and the short word. The detail the label used to
// carry — decided or not, how many have signed off, merged or rolled back —
// is its tooltip.
function ListStatus({ conflict, ready, note }) {
  const status = listStatusOf(conflict)
  const rollback = Boolean(conflict.rollback)
  const cancellation = Boolean(conflict.revertOf)
  const signed = `${conflict.reviewers.filter((r) => r.status === 'approved').length}/${conflict.reviewers.length}`
  const tally = <><LocalizedText text={rollback ? 'Confirmed' : 'Approvals'} /> <span className="tabular-nums">{signed}</span></>
  const detail = {
    detected: <LocalizedText text={rollback ? 'Confirmation not requested' : ready ? 'Decided, review request needed' : 'Not decided yet'} />,
    in_review: conflict.reviewers.some((r) => r.status === 'changes_requested') ? <>{tally}, <LocalizedText text="Changes requested" /></> : tally,
    pending_merge: <>{tally}, <LocalizedText text="Ready to merge" /></>,
    pending_rollback: <>{tally}, <LocalizedText text="Ready to restore previous version" /></>,
    done: <LocalizedText text={rollback ? 'Previous version restored' : cancellation ? 'Merge canceled' : 'Merged'} />,
  }[status.id]
  const label = status.id === 'done' ? rollback ? 'Previous version restored' : cancellation ? 'Merge canceled' : 'Merged' : status.label
  const merged = status.id === 'done'
  return (
    <>
    <Tooltip>
      <TooltipTrigger render={<span data-list-status={status.id} className={cn(PLAIN_BADGE, 'leading-5', merged ? 'text-emerald-200' : 'text-slate-200')} />}>
        {merged ? <CircleCheck aria-hidden className="size-3.5 shrink-0 text-emerald-300" /> : <span className={cn('size-1.5 shrink-0 rounded-full', status.dot)} />}
        <LocalizedText text={label} />
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="block px-2.5 py-1.5 text-left text-xs leading-5 whitespace-nowrap">{detail}</TooltipContent>
    </Tooltip>
    {/* How it's being handled — not a type, so it sits with the status. */}
    {note && <span data-status-note className="mt-1 block text-[11px] leading-4 whitespace-nowrap text-slate-500"><LocalizedText text={status.label} /> · <LocalizedText text={note} /></span>}
    </>
  )
}

function PeopleHover({ people }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex flex-wrap justify-start gap-y-1 -space-x-1.5 rounded-full" />} onClick={(event) => event.stopPropagation()}>
        {/* Neutral in the list — a person's color isn't a status. */}
        {people.map(({ person, className }) => (
          <Avatar key={person.id} size="xs" className={className}>
            <AvatarFallback className="bg-[#3A3A3D] font-medium text-slate-100">{person.initials}</AvatarFallback>
          </Avatar>
        ))}
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="block space-y-1.5 px-2.5 py-2 text-left">
        {people.map(({ person, note, tone }) => (
          <div key={person.id} className="flex items-center gap-2 text-xs leading-5 whitespace-nowrap">
            <Avatar size="xs">
              <AvatarFallback className={cn('font-medium text-white', person.colorClass)}>{person.initials}</AvatarFallback>
            </Avatar>
            <span className="font-semibold"><LocalizedText text={person.fullName ?? person.name} /></span>
            <span className="opacity-60"><LocalizedText text={person.role} /></span>
            {note && (
              <span className={cn('ml-auto rounded-full px-1.5 py-0.5 text-[10.5px] leading-none font-medium', NOTE_TONE[tone] ?? 'bg-current/10')}>
                <LocalizedText text={note} />
              </span>
            )}
          </div>
        ))}
      </TooltipContent>
    </Tooltip>
  )
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
