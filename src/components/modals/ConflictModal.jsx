import { useRef, useState } from 'react'
import {
  Check,
  CircleAlert,
  Code2,
  Eye,
  FileCode2,
  GitBranch,
  GitMerge,
  Info,
  Palette,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react'
import { cn } from 'cn'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { allPeople, currentUser } from '@/data/mockData'
import { REVIEW_STAGES, allReviewersApproved } from '@/lib/conflicts'
import { useWorkspaceOptional } from '@/state/WorkspaceProvider'
import RollbackHistoryList from '@/components/history/RollbackHistoryList'

// ─── The one conflict review window ────────────────────────────────────
// Every entry point — the activity bar's Conflicts drawer, the terminal's
// Conflict Point tab, the dashboard widget and the /conflicts page — opens
// this same component with a shared conflict record (see lib/conflicts).
//
// It's a step-by-step review, GitHub-PR style: a conflict moves
// Pending → In Review → Approved → Resolved, and each step is gated on
// the one before it — you request review once reviewers are assigned,
// approve only after the code diff has been inspected and every reviewer
// has signed off, and resolve only once approved. There is deliberately
// no one-click "resolve" anywhere else.

const severityConfig = {
  high: { label: 'High', icon: TriangleAlert, className: 'bg-destructive/15 text-destructive' },
  medium: { label: 'Medium', icon: CircleAlert, className: 'bg-amber-500/15 text-amber-500' },
  low: { label: 'Low', icon: Info, className: 'bg-sky-500/15 text-sky-500' },
}

const REVIEWER_STATUS = {
  pending: { label: 'Pending', className: 'text-muted-foreground' },
  approved: { label: 'Approved', className: 'text-emerald-400' },
  changes_requested: { label: 'Changes requested', className: 'text-amber-400' },
}

const sectionLabelClass = 'text-[11px] font-semibold tracking-wide text-muted-foreground uppercase'

function EmptyNote({ children }) {
  return (
    <p className="rounded-xl border border-dashed px-3 py-6 text-center text-[11px] text-muted-foreground">
      {children}
    </p>
  )
}

// ─── Stage stepper ─────────────────────────────────────────────────────

function StageStepper({ stage }) {
  const currentIndex = Math.max(
    0,
    REVIEW_STAGES.findIndex((s) => s.id === stage)
  )

  return (
    <ol className="flex items-center gap-2 border-b px-5 py-3" aria-label="Review progress">
      {REVIEW_STAGES.map((s, i) => {
        const done = i < currentIndex || stage === 'resolved'
        const active = i === currentIndex && stage !== 'resolved'
        return (
          <li key={s.id} className="flex min-w-0 flex-1 items-center gap-2" aria-current={active ? 'step' : undefined}>
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                done && 'bg-primary text-primary-foreground',
                active && 'bg-primary/15 text-primary ring-1 ring-primary',
                !done && !active && 'bg-muted text-muted-foreground'
              )}
            >
              {done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
            </span>
            <span
              className={cn(
                'truncate text-xs',
                active ? 'font-semibold text-foreground' : done ? 'text-foreground/80' : 'text-muted-foreground'
              )}
            >
              {s.label}
            </span>
            {i < REVIEW_STAGES.length - 1 && (
              <span className={cn('h-px min-w-4 flex-1', i < currentIndex ? 'bg-primary/60' : 'bg-border')} />
            )}
          </li>
        )
      })}
    </ol>
  )
}

// ─── Left: working area ────────────────────────────────────────────────

function DiffBlock({ label, lines, tone }) {
  if (!lines?.length) return null
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <pre
        className={cn(
          'overflow-auto rounded-xl border p-2.5 font-mono text-[11px] leading-relaxed',
          tone === 'current'
            ? 'border-destructive/25 bg-destructive/5 text-destructive/90'
            : 'border-emerald-500/25 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
        )}
      >
        {lines.join('\n')}
      </pre>
    </div>
  )
}

// One side of the Expected (Design System) vs Current (Code) comparison.
function ComparisonCard({ label, tone, icon: Icon, fields }) {
  return (
    <div
      className={cn(
        'flex-1 space-y-2.5 rounded-xl border p-3',
        tone === 'expected' ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-destructive/25 bg-destructive/5'
      )}
    >
      <div
        className={cn(
          'flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase',
          tone === 'expected' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
        )}
      >
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="space-y-1.5">
        {fields.map((field) => (
          <div key={field.label} className="flex items-start justify-between gap-2 text-xs">
            <span className="shrink-0 text-muted-foreground">{field.label}</span>
            <span className="text-right font-medium text-foreground">{field.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function OverviewTab({ conflict, onPreview }) {
  const fields = conflict.comparisonFields ?? []

  return (
    <div className="space-y-4 p-4">
      {conflict.message && <p className="text-xs leading-relaxed text-foreground/85">{conflict.message}</p>}

      {fields.length ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <ComparisonCard
            label="Expected · Design System"
            tone="expected"
            icon={Palette}
            fields={fields.map((f) => ({ label: f.label, value: f.expected }))}
          />
          <ComparisonCard
            label="Current · Code"
            tone="current"
            icon={Code2}
            fields={fields.map((f) => ({ label: f.label, value: f.current }))}
          />
        </div>
      ) : (
        <EmptyNote>No design ↔ code comparison captured for this conflict yet.</EmptyNote>
      )}

      {conflict.suggestion && (
        <div className="space-y-2.5 rounded-xl border border-primary/25 bg-primary/5 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-primary uppercase">
            <Sparkles className="size-3.5" />
            AI suggested change
          </div>
          <p className="text-xs leading-relaxed text-foreground/85">{conflict.suggestion}</p>
          {onPreview && (
            <Button type="button" size="sm" className="gap-1.5" onClick={onPreview}>
              <Eye className="size-3.5" />
              Preview change
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function DiffTab({ conflict }) {
  if (!conflict.branches && !conflict.diff) {
    return (
      <div className="p-4">
        <EmptyNote>No diff captured for this conflict yet.</EmptyNote>
      </div>
    )
  }

  return (
    <div className="space-y-3 p-4">
      {conflict.branches && (
        <div className="flex items-center gap-2 rounded-xl border bg-background p-2.5 text-xs">
          <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="font-medium text-foreground">{conflict.branches.local}</span>
          <span className="text-muted-foreground">vs</span>
          <span className="font-medium text-foreground">{conflict.branches.remote}</span>
        </div>
      )}
      {conflict.diff && (
        <>
          <DiffBlock label="Current (Code)" lines={conflict.diff.before} tone="current" />
          <DiffBlock label="Expected (Design System)" lines={conflict.diff.after} tone="expected" />
        </>
      )}
    </div>
  )
}

// ─── Right: review sidebar ─────────────────────────────────────────────

function ChecklistItem({ done, children }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <span
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-full',
          done ? 'bg-emerald-500/15 text-emerald-400' : 'ring-1 ring-border'
        )}
      >
        {done && <Check className="size-2.5" strokeWidth={3} />}
      </span>
      <span className={done ? 'text-foreground/85' : 'text-muted-foreground'}>{children}</span>
    </li>
  )
}

function ReviewChecklist({ conflict }) {
  const reviewers = conflict.reviewers
  const approved = reviewers.filter((r) => r.status === 'approved').length
  return (
    <ul className="flex flex-col gap-2">
      <ChecklistItem done={reviewers.length > 0}>Reviewer assigned</ChecklistItem>
      <ChecklistItem done={conflict.diffInspected}>Code diff inspected</ChecklistItem>
      <ChecklistItem done={allReviewersApproved(conflict)}>
        All reviewers approved{reviewers.length > 0 && ` (${approved}/${reviewers.length})`}
      </ChecklistItem>
    </ul>
  )
}

function PersonAvatar({ person }) {
  return (
    <Avatar size="sm">
      <AvatarFallback className={cn('text-[10px] font-medium text-white', person.colorClass)}>
        {person.initials}
      </AvatarFallback>
    </Avatar>
  )
}

const iconActionClass =
  'flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

// Reviewers sign off here. Assigning/removing is open until the conflict
// is resolved (removing only before review starts); approve / request
// changes are the in-review actions.
function ReviewersSection({ conflict, onUpdate }) {
  const { reviewers, reviewStage } = conflict
  const assignable = allPeople.filter((p) => !reviewers.some((r) => r.id === p.id))

  function setReviewers(next) {
    onUpdate({ reviewers: next })
  }

  function setStatus(id, status) {
    setReviewers(reviewers.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className={sectionLabelClass}>Reviewers</p>
        {reviewStage !== 'resolved' && assignable.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                />
              }
            >
              <Plus className="size-3" />
              Assign
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {assignable.map((person) => (
                <DropdownMenuItem
                  key={person.id}
                  onClick={() => setReviewers([...reviewers, { id: person.id, status: 'pending' }])}
                  className="gap-2"
                >
                  <PersonAvatar person={person} />
                  {person.name}
                  {person.id === currentUser.id && <span className="text-muted-foreground">(you)</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {reviewers.length === 0 ? (
        <p className="text-xs text-muted-foreground">No reviewers assigned yet.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {reviewers.map((reviewer) => {
            const person = allPeople.find((p) => p.id === reviewer.id)
            if (!person) return null
            const status = REVIEWER_STATUS[reviewer.status] ?? REVIEWER_STATUS.pending
            return (
              <div key={reviewer.id} className="flex h-7 items-center gap-2 text-xs">
                <PersonAvatar person={person} />
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                  {person.name}
                  {person.id === currentUser.id && <span className="font-normal text-muted-foreground"> (you)</span>}
                </span>
                <span className={cn('shrink-0 text-[11px]', status.className)}>{status.label}</span>
                {reviewStage === 'in_review' && (
                  <span className="flex shrink-0 items-center">
                    <button
                      type="button"
                      aria-label={`Approve as ${person.name}`}
                      title="Approve"
                      onClick={() => setStatus(reviewer.id, 'approved')}
                      className={cn(iconActionClass, reviewer.status === 'approved' && 'text-emerald-400')}
                    >
                      <Check className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Request changes as ${person.name}`}
                      title="Request changes"
                      onClick={() => setStatus(reviewer.id, 'changes_requested')}
                      className={cn(iconActionClass, reviewer.status === 'changes_requested' && 'text-amber-400')}
                    >
                      <RotateCcw className="size-3.5" />
                    </button>
                  </span>
                )}
                {reviewStage === 'detected' && (
                  <button
                    type="button"
                    aria-label={`Remove ${person.name}`}
                    title="Remove reviewer"
                    onClick={() => setReviewers(reviewers.filter((r) => r.id !== reviewer.id))}
                    className={iconActionClass}
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Comments live in a project's workspace; outside one (dashboard, the
// global conflict list) the thread says where to find it instead.
function CommentThread({ conflict, workspace }) {
  const [draft, setDraft] = useState('')

  if (!workspace) {
    return <p className="text-xs text-muted-foreground">Open the project's workspace to see and reply to its thread.</p>
  }

  const linked = workspace.comments.filter((c) => c.id === conflict.linkedCommentId)

  function handleSend() {
    if (!draft.trim()) return
    workspace.addComment(draft)
    setDraft('')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="min-h-0 flex-1 space-y-2 overflow-auto">
        {linked.length === 0 && <p className="text-xs text-muted-foreground">No linked comments yet.</p>}
        {linked.map((comment) => {
          const author = allPeople.find((p) => p.id === comment.authorId)
          return (
            <div key={comment.id} className="rounded-xl border bg-background p-2.5 text-xs">
              <div className="flex items-center gap-1.5">
                {author && <PersonAvatar person={author} />}
                <span className="font-medium text-foreground">{author?.name}</span>
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{comment.timeLabel}</span>
              </div>
              <p className="mt-1.5 leading-relaxed text-foreground/85">{comment.text}</p>
            </div>
          )
        })}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              handleSend()
            }
          }}
          placeholder="Reply..."
          className="h-8 flex-1 text-xs"
        />
        <Button type="button" size="icon-sm" onClick={handleSend} disabled={!draft.trim()}>
          <Send className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ─── Footer: the one next step ─────────────────────────────────────────

// What the primary action does at each stage, whether it's allowed yet,
// and — when it isn't — what's still missing.
function nextStep(conflict) {
  const { reviewStage, reviewers, diffInspected } = conflict
  if (reviewStage === 'detected') {
    return reviewers.length
      ? { label: 'Request review', enabled: true, hint: 'Send it to the assigned reviewers to start sign-off.' }
      : { label: 'Request review', enabled: false, hint: 'Assign at least one reviewer to request review.' }
  }
  if (reviewStage === 'in_review') {
    const approved = reviewers.filter((r) => r.status === 'approved').length
    const missing = []
    if (!diffInspected) missing.push('inspect the code diff')
    if (!allReviewersApproved(conflict)) missing.push(`${approved} of ${reviewers.length} approvals`)
    return missing.length
      ? { label: 'Approve', enabled: false, hint: `To approve: ${missing.join(' · ')}.` }
      : { label: 'Approve', enabled: true, hint: 'Diff inspected and every reviewer signed off.' }
  }
  if (reviewStage === 'approved') {
    return { label: 'Resolve conflict', enabled: true, hint: 'Approved — resolving applies the change and closes the conflict.' }
  }
  return null
}

// ─── Draggable window ──────────────────────────────────────────────────

// Lets the window be dragged by its header. The offset is applied on top
// of the dialog's centering translate, and clamped so the header can't be
// dragged fully off-screen. It persists while the modal stays mounted, so
// moving between conflicts keeps the window where you put it.
function useDraggable() {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef(null)

  function onPointerDown(event) {
    if (event.button !== 0 || event.target.closest('button, a, input, textarea, [role=tab]')) return
    const popup = event.currentTarget.closest('[data-slot=dialog-content]')
    drag.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      offset,
      rect: popup.getBoundingClientRect(),
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event) {
    const d = drag.current
    if (!d) return
    const clamp = (v, min, max) => Math.min(Math.max(v, min), max)
    const dx = clamp(event.clientX - d.pointerX, 120 - d.rect.right, window.innerWidth - 120 - d.rect.left)
    const dy = clamp(event.clientY - d.pointerY, -d.rect.top, window.innerHeight - 56 - d.rect.top)
    setOffset({ x: d.offset.x + dx, y: d.offset.y + dy })
  }

  function onPointerUp() {
    drag.current = null
  }

  return {
    // No transition, so the window tracks the pointer 1:1 (open/close
    // use keyframe animations, which this doesn't affect).
    style: { translate: `calc(-50% + ${offset.x}px) calc(-50% + ${offset.y}px)`, transition: 'none' },
    handleProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  }
}

// ─── The window ────────────────────────────────────────────────────────

// A floating window, not a blocking dialog: non-modal, no backdrop, and
// clicking the page behind it doesn't dismiss it — the workspace and
// canvas stay clear and fully interactive, and the window can be dragged
// anywhere by its header. Close / Esc / the ✕ close it.
//
// `onUpdate(id, patch)` applies review edits (stage, reviewers,
// diffInspected) to wherever the conflict lives; `onResolve(id)` is the
// final step (defaults to an onUpdate to 'resolved').
function ConflictModal({ conflict, onOpenChange, onUpdate, onResolve, onOpenMergeStudio }) {
  const workspace = useWorkspaceOptional()
  const open = Boolean(conflict)
  const { style: dragStyle, handleProps } = useDraggable()

  const severity = conflict?.severity ? (severityConfig[conflict.severity] ?? severityConfig.medium) : null
  const SeverityIcon = severity?.icon
  const step = conflict && nextStep(conflict)

  // The open tab, reset to Overview whenever a different conflict loads.
  const [tab, setTab] = useState('overview')
  const [tabConflictId, setTabConflictId] = useState(conflict?.id)
  if (conflict && conflict.id !== tabConflictId) {
    setTabConflictId(conflict.id)
    setTab('overview')
  }

  function update(patch) {
    onUpdate?.(conflict.id, patch)
  }

  function handleNextStep() {
    const { reviewStage, reviewers } = conflict
    if (reviewStage === 'detected') {
      // A fresh review round: earlier "changes requested" go back to pending.
      update({
        reviewStage: 'in_review',
        reviewers: reviewers.map((r) => (r.status === 'changes_requested' ? { ...r, status: 'pending' } : r)),
      })
    } else if (reviewStage === 'in_review') {
      update({ reviewStage: 'approved' })
    } else if (reviewStage === 'approved') {
      if (onResolve) onResolve(conflict.id)
      else update({ reviewStage: 'resolved' })
    }
  }

  function handleReopen() {
    update({
      reviewStage: 'detected',
      // Still looking at the diff counts as having inspected it.
      diffInspected: tab === 'diff',
      reviewers: conflict.reviewers.map((r) => ({ ...r, status: 'pending' })),
    })
  }

  // Opening the Diff tab is what counts as inspecting it.
  function handleTabChange(value) {
    setTab(value)
    if (value === 'diff' && !conflict.diffInspected && conflict.reviewStage !== 'resolved') {
      update({ diffInspected: true })
    }
  }

  function handlePreviewChange() {
    if (conflict.previewPrompt) workspace.sendChatMessage(conflict.previewPrompt)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false} disablePointerDismissal>
      <DialogContent
        overlay={false}
        style={dragStyle}
        className="flex h-[min(720px,88vh)] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0 shadow-2xl shadow-black/60 sm:max-w-4xl"
      >
        {conflict && (
          <>
            <DialogHeader
              {...handleProps}
              title="Drag to move"
              className="shrink-0 cursor-grab touch-none gap-1.5 border-b px-5 py-3.5 select-none active:cursor-grabbing"
            >
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                {severity && (
                  <Badge className={cn('gap-1 border-transparent', severity.className)}>
                    <SeverityIcon className="size-3" />
                    {severity.label}
                  </Badge>
                )}
                {conflict.projectName && <span>{conflict.projectName}</span>}
                {conflict.detectedAt && <span>· Detected {conflict.detectedAt}</span>}
              </div>
              <DialogTitle className="truncate pr-8 text-left">{conflict.title}</DialogTitle>
              <DialogDescription className="flex items-center gap-1.5 text-left font-mono text-[11px]">
                <FileCode2 className="size-3.5 shrink-0" />
                <span className="truncate">{conflict.file}</span>
              </DialogDescription>
            </DialogHeader>

            <StageStepper stage={conflict.reviewStage} />

            <div className="flex min-h-0 flex-1">
              {/* Left: working area */}
              <div className="flex min-h-0 flex-[1.6] flex-col border-r">
                <Tabs
                  value={tab}
                  onValueChange={handleTabChange}
                  className="flex min-h-0 flex-1 flex-col gap-0"
                >
                  <div className="flex h-10 shrink-0 items-center border-b px-4">
                    <TabsList variant="line">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="diff" className="gap-1.5">
                        Diff
                        {conflict.diffInspected ? (
                          <Check className="size-3 text-emerald-400" strokeWidth={3} />
                        ) : (
                          <span className="size-1.5 rounded-full bg-amber-400" aria-label="Not inspected yet" />
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="history">History</TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="overview" className="min-h-0 flex-1 overflow-auto">
                    <OverviewTab conflict={conflict} onPreview={workspace ? handlePreviewChange : null} />
                  </TabsContent>
                  <TabsContent value="diff" className="min-h-0 flex-1 overflow-auto">
                    <DiffTab conflict={conflict} />
                  </TabsContent>
                  <TabsContent value="history" className="min-h-0 flex-1 overflow-auto p-4">
                    {workspace ? (
                      <RollbackHistoryList />
                    ) : (
                      <EmptyNote>Version history lives in the project's workspace.</EmptyNote>
                    )}
                  </TabsContent>
                </Tabs>
              </div>

              {/* Right: review sidebar — checklist and reviewers stay
                  pinned, only the comment thread scrolls. */}
              <div className="flex w-80 shrink-0 flex-col gap-4 overflow-hidden p-4">
                <div className="shrink-0">
                  <p className={cn(sectionLabelClass, 'mb-2')}>Review checklist</p>
                  <ReviewChecklist conflict={conflict} />
                </div>

                <Separator className="shrink-0" />

                <div className="shrink-0">
                  <ReviewersSection conflict={conflict} onUpdate={update} />
                </div>

                <Separator className="shrink-0" />

                <div className="flex min-h-0 flex-1 flex-col">
                  <p className={cn(sectionLabelClass, 'mb-2 shrink-0')}>Comments</p>
                  <CommentThread key={conflict.id} conflict={conflict} workspace={workspace} />
                </div>
              </div>
            </div>

            <DialogFooter className="mx-0 mb-0 shrink-0 items-center sm:justify-between">
              <p className="min-w-0 truncate text-xs text-muted-foreground">
                {step ? step.hint : 'Resolved. Reopen it to run the review again.'}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => onOpenMergeStudio?.(conflict)}
                >
                  <GitMerge className="size-3.5" />
                  Open Merge Studio
                </Button>
                {step ? (
                  <Button type="button" disabled={!step.enabled} onClick={handleNextStep}>
                    {step.label}
                  </Button>
                ) : (
                  <Button type="button" variant="outline" className="gap-1.5" onClick={handleReopen}>
                    <RotateCcw className="size-3.5" />
                    Reopen
                  </Button>
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ConflictModal
