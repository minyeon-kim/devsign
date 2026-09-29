import { useRef, useState } from 'react'
import {
  Bell,
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
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { allPeople, currentUser } from '@/data/mockData'
import { REVIEW_STAGES, allReviewersApproved } from '@/lib/conflicts'
import { diffLines } from '@/lib/lineDiff'
import { toast } from 'sonner'
import { useWorkspaceOptional } from '@/state/WorkspaceProvider'
import { useNavigate } from 'react-router-dom'
import {
  ACCENT_CTA,
  CATEGORY_TAB,
  CATEGORY_TAB_ACTIVE,
  CATEGORY_TAB_IDLE,
  FLOATING_PANEL,
  GHOST_BUTTON,
  PANEL_LABEL,
  PANEL_RADIUS,
} from '@/components/mergestudio/floatingStyles'

// ─── The one conflict review window ────────────────────────────────────
// Opened from the Workspace bottom panel's Conflict Points tab (via the
// project's ConflictReviewHost) with a shared conflict record (see
// lib/conflicts).
//
// It's a step-by-step review, GitHub-PR style: a conflict moves
// Pending → In Review → Approved → Resolved, and each step is gated on
// the one before it — you request review once reviewers are assigned,
// approve only after the code diff has been inspected and every reviewer
// has signed off, and resolve only once approved. There is deliberately
// no one-click "resolve" anywhere else.
//
// Visually it's a Merge Studio floating panel: the same opaque card,
// 20px radius, borderless content on a 20px inset, pill category tabs,
// sentence-case group labels and the single mint accent. What to do next
// lives in one place — the "Next step" card at the top of the review
// column — instead of being split across a checklist and a footer hint.

const severityConfig = {
  high: { label: 'High', icon: TriangleAlert, className: 'bg-destructive/15 text-destructive' },
  medium: { label: 'Medium', icon: CircleAlert, className: 'bg-amber-500/15 text-amber-400' },
  low: { label: 'Low', icon: Info, className: 'bg-sky-500/15 text-sky-400' },
}

const REVIEWER_STATUS = {
  pending: { label: 'Pending', className: 'text-slate-500' },
  approved: { label: 'Approved', className: 'text-emerald-300' },
  changes_requested: { label: 'Changes requested', className: 'text-amber-400' },
}

const TABS = [
  ['overview', 'Overview'],
  ['diff', 'Diff'],
  ['history', 'History'],
]

function EmptyNote({ children }) {
  return <p className="rounded-xl bg-white/[0.03] px-4 py-8 text-center text-xs text-slate-500">{children}</p>
}

function PersonAvatar({ person }) {
  return (
    <Avatar size="sm">
      <AvatarFallback className={cn('text-[10px] font-semibold text-white', person.colorClass)}>
        {person.initials}
      </AvatarFallback>
    </Avatar>
  )
}

// ─── Stage progress ────────────────────────────────────────────────────

// A slim progress line instead of a full stepper: four hairline segments
// (done / current / to do) and the stage as text.
function StageProgress({ stage }) {
  const currentIndex = Math.max(
    0,
    REVIEW_STAGES.findIndex((s) => s.id === stage)
  )
  const allDone = stage === 'resolved'

  return (
    <div className="flex items-center gap-3 px-5 pb-3" aria-label="Review progress">
      <ol className="flex flex-1 items-center gap-1">
        {REVIEW_STAGES.map((s, i) => (
          <li
            key={s.id}
            title={s.label}
            aria-current={i === currentIndex && !allDone ? 'step' : undefined}
            className={cn(
              'h-1 flex-1 rounded-full',
              i < currentIndex || allDone ? 'bg-emerald-400/70' : i === currentIndex ? 'bg-emerald-400/35' : 'bg-white/[0.08]'
            )}
          />
        ))}
      </ol>
      <span className="shrink-0 text-[11px] text-slate-500 tabular-nums">
        <span className="font-medium text-slate-200">{REVIEW_STAGES[currentIndex]?.label}</span> · {currentIndex + 1}/{REVIEW_STAGES.length}
      </span>
    </div>
  )
}

// ─── Left: what's in conflict ──────────────────────────────────────────

// Expected (design system) vs current (code), as one aligned table.
function ComparisonTable({ fields }) {
  return (
    <div className="overflow-hidden rounded-xl bg-white/[0.03]">
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-3 px-4 py-2.5 text-[11px] font-medium text-slate-500">
        <span>Property</span>
        <span className="flex items-center gap-1.5 text-emerald-300/80">
          <Palette className="size-3" />
          Design system
        </span>
        <span className="flex items-center gap-1.5 text-red-300/80">
          <Code2 className="size-3" />
          Code
        </span>
      </div>
      {fields.map((f) => (
        <div key={f.label} className="grid grid-cols-[1fr_1fr_1fr] gap-3 px-4 py-2.5 text-xs">
          <span className="text-slate-400">{f.label}</span>
          <span className="font-medium text-white">{f.expected}</span>
          <span className="font-medium text-red-300">{f.current}</span>
        </div>
      ))}
    </div>
  )
}

function OverviewTab({ conflict, onPreview }) {
  const fields = conflict.comparisonFields ?? []

  return (
    <div className="space-y-5">
      {conflict.message && <p className="text-[13px] leading-relaxed text-slate-300">{conflict.message}</p>}

      <div>
        <p className={PANEL_LABEL}>Design vs. code</p>
        {fields.length ? <ComparisonTable fields={fields} /> : <EmptyNote>No comparison captured yet.</EmptyNote>}
      </div>

      {conflict.suggestion && (
        <div className="rounded-xl bg-emerald-400/[0.06] p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-emerald-300">
            <Sparkles className="size-3.5" />
            AI suggestion
          </p>
          <p className="text-[13px] leading-relaxed text-slate-200">{conflict.suggestion}</p>
          {onPreview && (
            <button
              type="button"
              onClick={onPreview}
              className={cn('mt-3 inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium', GHOST_BUTTON)}
            >
              <Eye className="size-3.5" />
              Preview change
            </button>
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

// The proposed change as an inline diff — review only. Nothing here is
// applied: the fix reaches the workspace when the conflict is resolved,
// after every reviewer has signed off.
function DiffTab({ conflict }) {
  if (!conflict.branches && !conflict.diff) return <EmptyNote>No diff captured for this conflict yet.</EmptyNote>
  const rows = conflict.diff ? diffLines(conflict.diff.before ?? [], conflict.diff.after ?? []) : []

  return (
    <div className="space-y-5">
      {conflict.branches && (
        <div className="flex items-center gap-2 text-xs">
          <GitBranch className="size-3.5 shrink-0 text-slate-500" />
          <span className="rounded-md bg-white/[0.05] px-2 py-0.5 font-medium text-slate-200">{conflict.branches.local}</span>
          <span className="text-slate-500">vs</span>
          <span className="rounded-md bg-white/[0.05] px-2 py-0.5 font-medium text-slate-200">{conflict.branches.remote}</span>
        </div>
      )}
      {conflict.diff && (
        <div>
          <p className={cn(PANEL_LABEL, 'justify-between')}>
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-emerald-300" />
              Proposed change
            </span>
            <span className="font-mono text-[10.5px] font-normal">{conflict.file}</span>
          </p>
          <div className="overflow-auto rounded-xl bg-black/25 py-2 font-mono text-[11.5px] leading-relaxed">
            {rows.map((row, i) => (
              <div key={i} className={cn('flex px-3 whitespace-pre', DIFF_TONES[row.kind])}>
                <span className="w-4 shrink-0 opacity-70 select-none">{DIFF_MARKS[row.kind]}</span>
                <span>{row.text || ' '}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
            <Eye className="size-3" />
            Preview only — applied when this conflict is resolved, after every reviewer approves.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Right: the review ─────────────────────────────────────────────────

// What the primary action does at each stage, what it needs, and whether
// it's allowed yet. `checks` feed the Next step card.
function nextStep(conflict) {
  const { reviewStage, reviewers, diffInspected } = conflict
  const approved = reviewers.filter((r) => r.status === 'approved').length

  if (reviewStage === 'detected') {
    return {
      title: 'Request a review',
      label: 'Request review',
      checks: [{ id: 'reviewer', label: 'Assign at least one reviewer', done: reviewers.length > 0 }],
    }
  }
  if (reviewStage === 'in_review') {
    return {
      title: 'Collect sign-offs',
      label: 'Approve',
      checks: [
        { id: 'diff', label: 'Inspect the code diff', done: diffInspected },
        {
          id: 'approvals',
          label: `Every reviewer approves (${approved}/${reviewers.length})`,
          done: allReviewersApproved(conflict),
        },
      ],
    }
  }
  if (reviewStage === 'approved') {
    return {
      title: 'Ready to resolve',
      label: 'Resolve conflict',
      note: 'Every reviewer approved. Resolving applies the change, closes the conflict and saves a History checkpoint.',
      checks: [],
    }
  }
  return null
}

function NextStepCard({ step, onViewDiff }) {
  if (!step) {
    return (
      <div className="rounded-xl bg-emerald-400/[0.06] p-4">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-300">
          <Check className="size-4" strokeWidth={2.5} />
          Resolved
        </p>
        <p className="mt-1 text-xs text-slate-400">Reopen it to run the review again.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-white/[0.04] p-4">
      <p className="text-[11px] font-medium text-slate-500">Next step</p>
      <p className="mt-0.5 text-[13px] font-semibold text-white">{step.title}</p>
      {step.note && <p className="mt-1 text-xs text-slate-400">{step.note}</p>}
      {step.checks.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {step.checks.map((check) => (
            <li key={check.id} className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded-full',
                  check.done ? 'bg-emerald-400 text-slate-950' : 'ring-1 ring-white/20'
                )}
              >
                {check.done && <Check className="size-2.5" strokeWidth={3.5} />}
              </span>
              <span className={cn('min-w-0 flex-1', check.done ? 'text-slate-400 line-through decoration-slate-600' : 'text-slate-200')}>
                {check.label}
              </span>
              {check.id === 'diff' && !check.done && (
                <button type="button" onClick={onViewDiff} className="shrink-0 text-[11px] font-medium text-emerald-300 hover:underline">
                  View diff
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const iconActionClass =
  'flex size-6 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/[0.08] hover:text-white'

// Reviewers sign off here. Assigning is open until the conflict is
// resolved — a new reviewer on an Approved conflict sends it back to In
// Review, since everyone has to sign off; removing is open before review
// starts, and in review for anyone who hasn't approved (never the last
// one). Approve / request changes are the in-review actions — and only on
// your own row (you sign off for yourself; everyone else's status is just
// shown) — and anyone else still pending can be reminded.
function ReviewersSection({ conflict, onUpdate }) {
  const { reviewers, reviewStage } = conflict
  const assignable = allPeople.filter((p) => !reviewers.some((r) => r.id === p.id))
  const pending = reviewers.filter((r) => r.status !== 'approved' && r.id !== currentUser.id)
  const canRemind = reviewStage === 'in_review' || reviewStage === 'detected'

  function setReviewers(next, patch = {}) {
    onUpdate({ reviewers: next, ...patch })
  }

  function setStatus(id, status) {
    setReviewers(reviewers.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  function assign(person) {
    setReviewers(
      [...reviewers, { id: person.id, status: 'pending' }],
      reviewStage === 'approved' ? { reviewStage: 'in_review' } : {}
    )
  }

  function remind(ids) {
    const stamp = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    setReviewers(reviewers.map((r) => (ids.includes(r.id) ? { ...r, remindedAt: stamp } : r)))
    const names = ids.map((id) => allPeople.find((p) => p.id === id)?.name).filter(Boolean)
    toast(`Reminder sent to ${names.join(', ')}`, { description: conflict.title })
  }

  return (
    <div>
      <div className={cn(PANEL_LABEL, 'justify-between')}>
        <span>Reviewers</span>
        <span className="flex items-center gap-1">
        {canRemind && pending.length > 1 && (
          <button
            type="button"
            onClick={() => remind(pending.map((r) => r.id))}
            className="flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-medium text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <Bell className="size-3" />
            Remind all
          </button>
        )}
        {reviewStage !== 'resolved' && assignable.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-medium text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
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
                  onClick={() => assign(person)}
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
        </span>
      </div>

      {reviewers.length === 0 ? (
        <p className="text-xs text-slate-500">No reviewers yet.</p>
      ) : (
        <div className="-mx-2 space-y-0.5">
          {reviewers.map((reviewer) => {
            const person = allPeople.find((p) => p.id === reviewer.id)
            if (!person) return null
            const status = REVIEWER_STATUS[reviewer.status] ?? REVIEWER_STATUS.pending
            return (
              <div key={reviewer.id} className="group/rev flex h-9 items-center gap-2.5 rounded-lg px-2 text-xs hover:bg-white/[0.03]">
                <PersonAvatar person={person} />
                <span className="min-w-0 flex-1 truncate font-medium text-slate-200">
                  {person.name}
                  {person.id === currentUser.id && <span className="font-normal text-slate-500"> (you)</span>}
                </span>
                <span className={cn('shrink-0 text-[11px]', status.className)}>
                  {reviewer.status !== 'approved' && reviewer.remindedAt ? `Reminded ${reviewer.remindedAt}` : status.label}
                </span>
                {canRemind && reviewer.status !== 'approved' && reviewer.id !== currentUser.id && (
                  <button
                    type="button"
                    aria-label={`Remind ${person.name}`}
                    title="Remind"
                    onClick={() => remind([reviewer.id])}
                    className={iconActionClass}
                  >
                    <Bell className="size-3.5" />
                  </button>
                )}
                {reviewStage === 'in_review' && reviewer.id === currentUser.id && (
                  <span className="flex shrink-0 items-center">
                    <button
                      type="button"
                      aria-label={`Approve as ${person.name}`}
                      title="Approve"
                      onClick={() => setStatus(reviewer.id, 'approved')}
                      className={cn(iconActionClass, reviewer.status === 'approved' && 'text-emerald-300')}
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
                {(reviewStage === 'detected' ||
                  (reviewStage === 'in_review' && reviewer.status !== 'approved' && reviewers.length > 1)) && (
                  <button
                    type="button"
                    aria-label={`Remove ${person.name}`}
                    title="Remove reviewer"
                    onClick={() => setReviewers(reviewers.filter((r) => r.id !== reviewer.id))}
                    className={cn(iconActionClass, 'opacity-0 group-hover/rev:opacity-100 focus-visible:opacity-100')}
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
    return <p className="text-xs text-slate-500">Open the project's workspace to see and reply to its thread.</p>
  }

  const linked = workspace.comments.filter((c) => c.id === conflict.linkedCommentId)

  function handleSend(event) {
    event.preventDefault()
    if (!draft.trim()) return
    workspace.addComment(draft)
    setDraft('')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="min-h-0 flex-1 space-y-3 overflow-auto">
        {linked.length === 0 && <p className="text-xs text-slate-500">No comments yet.</p>}
        {linked.map((comment) => {
          const author = allPeople.find((p) => p.id === comment.authorId)
          return (
            <div key={comment.id} className="flex gap-2.5 text-xs">
              {author && <PersonAvatar person={author} />}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5">
                  <span className="font-medium text-slate-200">{author?.name}</span>
                  <span className="text-[11px] text-slate-500">{comment.timeLabel}</span>
                </p>
                <p className="mt-0.5 leading-relaxed text-slate-300">{comment.text}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Merge Studio's pill input: Write a comment · Send. */}
      <form
        onSubmit={handleSend}
        className="flex h-10 shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] pr-1 pl-4 transition-colors focus-within:border-white/25"
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write a comment"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-slate-500"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!draft.trim()}
          className="flex size-8 items-center justify-center rounded-full bg-[#2c2c31] text-white ring-1 ring-white/10 ring-inset transition-colors hover:bg-[#38383e] disabled:text-slate-500"
        >
          <Send className="size-3.5" />
        </button>
      </form>
    </div>
  )
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
  const navigate = useNavigate()
  const open = Boolean(conflict)
  const { style: dragStyle, handleProps } = useDraggable()

  const severity = conflict?.severity ? (severityConfig[conflict.severity] ?? severityConfig.medium) : null
  const SeverityIcon = severity?.icon
  const step = conflict && nextStep(conflict)
  const stepReady = step?.checks.every((c) => c.done)

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

  // Opening the Diff tab is what counts as inspecting it.
  function openTab(value) {
    setTab(value)
    if (value === 'diff' && !conflict.diffInspected && conflict.reviewStage !== 'resolved') {
      update({ diffInspected: true })
    }
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
      if (!stepReady) return
      update({ reviewStage: 'approved' })
    } else if (reviewStage === 'approved') {
      if (!allReviewersApproved(conflict)) return
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

  // Review-gated: previewing the AI suggestion only shows its diff (which
  // counts as inspecting it) — nothing is applied until the conflict is
  // resolved after every reviewer's sign-off.
  function handlePreviewChange() {
    openTab('diff')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false} disablePointerDismissal>
      <DialogContent
        overlay={false}
        showCloseButton={false}
        style={dragStyle}
        className={cn(
          'flex h-[min(720px,88vh)] w-full max-w-[1040px] flex-col gap-0 overflow-hidden bg-card p-0 ring-0 sm:max-w-[1040px]',
          PANEL_RADIUS,
          FLOATING_PANEL
        )}
      >
        {conflict && (
          <>
            {/* Header — the drag handle. */}
            <div
              {...handleProps}
              title="Drag to move"
              className="flex shrink-0 cursor-grab touch-none items-start gap-3 px-5 pt-4 pb-4 select-none active:cursor-grabbing"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {severity && (
                    <span
                      className={cn(
                        'inline-flex h-5 items-center gap-1 rounded-full px-2 text-[10px] font-semibold',
                        severity.className
                      )}
                    >
                      <SeverityIcon className="size-3" />
                      {severity.label}
                    </span>
                  )}
                  <DialogTitle className="truncate text-[15px] font-semibold text-white">{conflict.title}</DialogTitle>
                </div>
                <DialogDescription className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                  <FileCode2 className="size-3.5 shrink-0" />
                  <span className="truncate font-mono text-slate-400">{conflict.file}</span>
                  {conflict.projectName && <span className="shrink-0">· {conflict.projectName}</span>}
                  {conflict.detectedAt && <span className="shrink-0">· {conflict.detectedAt}</span>}
                </DialogDescription>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => onOpenChange(false)}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <StageProgress stage={conflict.reviewStage} />

            <div className="flex min-h-0 flex-1 border-t border-white/[0.06]">
              {/* Left: what's in conflict */}
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <div className="flex shrink-0 items-center gap-1 px-5 pt-4 pb-3" role="tablist" aria-label="Conflict details">
                  {TABS.map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={tab === id}
                      onClick={() => openTab(id)}
                      className={cn(CATEGORY_TAB, 'gap-1.5', tab === id ? CATEGORY_TAB_ACTIVE : CATEGORY_TAB_IDLE)}
                    >
                      {label}
                      {id === 'diff' &&
                        (conflict.diffInspected ? (
                          <Check className="size-3 text-emerald-300" strokeWidth={3} />
                        ) : (
                          <span className="size-1.5 rounded-full bg-amber-400" aria-label="Not inspected yet" />
                        ))}
                    </button>
                  ))}
                </div>
                <div className="min-h-0 flex-1 overflow-auto px-5 pb-5" role="tabpanel">
                  {tab === 'overview' && (
                    <OverviewTab conflict={conflict} onPreview={conflict.diff ? handlePreviewChange : null} />
                  )}
                  {tab === 'diff' && <DiffTab conflict={conflict} />}
                  {/* History lives in one place — the project's History menu
                      (checkpoints with rollback) — so this tab points there. */}
                  {tab === 'history' && (
                    <div className="flex flex-col items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-8 text-center">
                      <p className="text-xs text-slate-400">Checkpoints and rollbacks for this project are in History.</p>
                      {workspace && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenChange(false)
                            navigate(`/projects/${workspace.projectId}/history`)
                          }}
                          className={cn('inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium', GHOST_BUTTON)}
                        >
                          Open History
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: the review — next step, reviewers, comments — kept to
                  ~30% so the content under review (left, ~70%) gets the room. */}
              <div className="flex w-[30%] min-w-[260px] shrink-0 flex-col gap-4 overflow-hidden bg-white/[0.015] px-4 pt-4 pb-5">
                <NextStepCard step={step} onViewDiff={() => openTab('diff')} />
                <ReviewersSection conflict={conflict} onUpdate={update} />
                <div className="flex min-h-0 flex-1 flex-col">
                  <p className={cn(PANEL_LABEL, 'shrink-0')}>Comments</p>
                  <CommentThread key={conflict.id} conflict={conflict} workspace={workspace} />
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 border-t border-white/[0.06] px-5 py-3.5">
              <button
                type="button"
                onClick={() => onOpenMergeStudio?.(conflict)}
                className={cn('inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium', GHOST_BUTTON)}
              >
                <GitMerge className="size-3.5" />
                Open in Merge Studio
              </button>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="inline-flex h-9 items-center rounded-full px-4 text-[13px] font-medium text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  Close
                </button>
                {step ? (
                  <button
                    type="button"
                    disabled={!stepReady}
                    onClick={handleNextStep}
                    className={cn(
                      'inline-flex h-9 items-center rounded-full px-5 text-[13px] font-semibold',
                      ACCENT_CTA,
                      'disabled:bg-white/[0.06] disabled:text-slate-500 disabled:shadow-none'
                    )}
                  >
                    {step.label}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleReopen}
                    className={cn('inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium', GHOST_BUTTON)}
                  >
                    <RotateCcw className="size-3.5" />
                    Reopen
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ConflictModal
