import { Fragment, useRef, useState } from 'react'
import {
  Bell,
  Bot,
  Check,
  CircleAlert,
  Code2,
  Eye,
  FileCode2,
  FlaskConical,
  GitBranch,
  GitMerge,
  Info,
  Palette,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  TriangleAlert,
  User,
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
import {
  REVIEW_STAGES,
  STAGE_DOT_CLASS,
  STAGE_LABEL,
  approvalStatus,
  needsReviewFrom,
  nextActionFor,
} from '@/lib/conflicts'
import ChangePreview from '@/components/conflicts/ChangePreview'
import { diffLines } from '@/lib/lineDiff'
import { toast } from '@/i18n/toast'
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
// It's a step-by-step review, GitHub-PR style: Detected → In review →
// Approved → Merged. The Overview explains the change without code — a
// before/after preview, what changed, why it needs review, who changed it
// and what it reaches, and the AI's proposal. Your own sign-off ("Approve
// change") never merges: the conflict becomes Approved once every required
// reviewer has approved, and merging is a separate, explicit step.

// Visually it's a Merge Studio floating panel: the same opaque card,
// 20px radius, borderless content on a 20px inset, pill category tabs,
// sentence-case group labels and the single mint accent. What to do next
// lives in one place — the Status card at the top of the review column
// and the single primary action in the footer.

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

// Where the review is, as one compact pill: the stage's dot, its name and
// the step count ("In review · 2/4") — no full-width progress line.
function StagePill({ stage }) {
  const index = Math.max(
    0,
    REVIEW_STAGES.findIndex((s) => s.id === stage)
  )
  return (
    <span
      title="Review status"
      aria-label={`Review status: ${STAGE_LABEL[stage]}, step ${index + 1} of ${REVIEW_STAGES.length}`}
      className="inline-flex h-5 items-center gap-1.5 rounded-full bg-white/[0.06] px-2 text-[10px] font-semibold text-slate-200"
    >
      <span className={cn('size-1.5 rounded-full', STAGE_DOT_CLASS[stage])} />
      {STAGE_LABEL[stage]}
      <span className="font-medium text-slate-500 tabular-nums">
        {index + 1}/{REVIEW_STAGES.length}
      </span>
    </span>
  )
}

// ─── Left: what's in conflict ──────────────────────────────────────────

// Expected (design system) vs current (code), as one aligned table.
function ComparisonTable({ fields }) {
  return (
    <div className="overflow-hidden rounded-xl bg-white/[0.03]">
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-3 px-5 py-3 text-[11px] font-medium text-slate-500">
        <span>Property</span>
        <span className="flex items-center gap-1.5 text-emerald-300/80">
          <Palette className="size-3" />
          Design
        </span>
        <span className="flex items-center gap-1.5 text-red-300/80">
          <Code2 className="size-3" />
          Code before
        </span>
      </div>
      {fields.map((f) => (
        <div key={f.label} className="grid grid-cols-[1fr_1fr_1fr] gap-3 px-5 py-3 text-xs">
          <span className="text-slate-400">{f.label}</span>
          <span className="font-medium text-white">{f.expected}</span>
          <span className="font-medium text-red-300">{f.current}</span>
        </div>
      ))}
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div>
      <p className={cn(PANEL_LABEL, 'mb-3')}>{label}</p>
      {children}
    </div>
  )
}

function personName(id) {
  if (id === currentUser.id) return 'You'
  return allPeople.find((p) => p.id === id)?.name ?? id
}

// Who (or which AI) made the change under review, what flagged it, and the
// screens / components / files it reaches — only what the record knows.
function Provenance({ conflict }) {
  const { changedBy, detectedBy, impact } = conflict
  const impactRows = [
    ['Screens', impact?.screens],
    ['Components', impact?.components],
    ['Files', impact?.files],
  ].filter(([, list]) => list?.length)
  if (!changedBy && !detectedBy && !impactRows.length) return null

  return (
    <div className="grid gap-x-5 gap-y-3 rounded-xl bg-white/[0.03] px-5 py-4 text-xs sm:grid-cols-[96px_1fr]">
      {changedBy && (
        <>
          <span className="text-slate-500">Changed by</span>
          <span className="text-slate-200">
            <span className="inline-flex items-center gap-1 font-medium">
              {changedBy.type === 'ai' ? <Bot className="size-3.5 text-emerald-300" /> : <User className="size-3.5 text-slate-400" />}
              {changedBy.type === 'ai' ? 'Devsign AI' : personName(changedBy.id)}
            </span>
            {changedBy.what && <span className="text-slate-400"> · {changedBy.what}</span>}
          </span>
        </>
      )}
      {detectedBy && (
        <>
          <span className="text-slate-500">Detected by</span>
          <span className="text-slate-300">{detectedBy}</span>
        </>
      )}
      {impactRows.map(([label, list]) => (
        <Fragment key={label}>
          <span className="text-slate-500">{label}</span>
          <span className="flex flex-wrap gap-1">
            {list.map((item) => (
              <span
                key={item}
                className={cn('rounded-md bg-white/[0.05] px-1.5 py-0.5 text-slate-200', label === 'Files' && 'font-mono text-[11px]')}
              >
                {item}
              </span>
            ))}
          </span>
        </Fragment>
      ))}
    </div>
  )
}

// The AI's proposal, split into what it proposes, why, what it's based on
// (only references that exist in the project) and the expected result.
// Approving signs off on this proposal; nothing is applied until merge.
function SuggestionCard({ conflict, onViewDiff }) {
  const rows = [
    ['Proposal', conflict.suggestion],
    ['Why', conflict.suggestionReason],
    ['Expected result', conflict.expectedResult],
  ].filter(([, text]) => text)

  return (
    <div className="rounded-xl bg-emerald-400/[0.06] p-5">
      <p className="mb-4 flex items-center gap-1.5 text-xs font-medium text-emerald-300">
        <Sparkles className="size-3.5" />
        AI suggestion
      </p>
      <dl className="space-y-4">
        {rows.map(([label, text]) => (
          <div key={label}>
            <dt className="text-[11px] text-slate-500">{label}</dt>
            <dd className="mt-0.5 text-[13px] leading-relaxed text-slate-200">{text}</dd>
          </div>
        ))}
        {conflict.references?.length > 0 && (
          <div>
            <dt className="text-[11px] text-slate-500">References</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {conflict.references.map((ref) => (
                <span key={ref.label} className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[11px] text-slate-200">
                  <span className="font-mono">{ref.label}</span>
                  {ref.source && <span className="text-slate-500"> · {ref.source}</span>}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>
      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        {onViewDiff && (
          <button
            type="button"
            onClick={onViewDiff}
            className={cn('inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium', GHOST_BUTTON)}
          >
            <Code2 className="size-3.5" />
            View code diff
          </button>
        )}
        <p className="text-[11px] text-slate-500">Approving signs off on this proposal. It is applied to the code only when merged.</p>
      </div>
    </div>
  )
}

function OverviewTab({ conflict, onViewDiff }) {
  const fields = conflict.comparisonFields ?? []

  return (
    <div className="space-y-10">
      {conflict.reviewStage === 'resolved' && (
        <p className="flex items-center gap-1.5 rounded-xl bg-emerald-400/[0.06] px-4 py-2.5 text-xs text-emerald-200">
          <Check className="size-3.5" strokeWidth={2.5} />
          Merged — the code now matches the proposed change. Values below are as they were before the merge.
        </p>
      )}
      {conflict.reviewStage !== 'resolved' && conflict.changedBy?.type === 'ai' && (
        <p className="flex items-center gap-1.5 rounded-xl bg-sky-400/[0.07] px-4 py-2.5 text-xs text-sky-200">
          <Bot className="size-3.5 shrink-0" />
          Devsign AI already made this change in the workspace. It becomes final only when approved and merged.
        </p>
      )}
      {conflict.message && <p className="text-[13px] leading-relaxed text-slate-300">{conflict.message}</p>}

      {conflict.preview && (
        <Section label="Before and after">
          <ChangePreview preview={conflict.preview} />
          {conflict.uxNote && (
            <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-amber-200/90">
              <Eye className="mt-0.5 size-3.5 shrink-0" />
              {conflict.uxNote}
            </p>
          )}
        </Section>
      )}

      <Section label="What changed">
        {fields.length ? <ComparisonTable fields={fields} /> : <EmptyNote>No comparison captured yet.</EmptyNote>}
        {!conflict.preview && conflict.uxNote && <p className="mt-2 text-xs text-amber-200/90">{conflict.uxNote}</p>}
      </Section>

      {conflict.riskReason && (
        <Section label="Why review is needed">
          <p className="text-[13px] leading-relaxed text-slate-300">{conflict.riskReason}</p>
        </Section>
      )}

      <Provenance conflict={conflict} />

      {conflict.suggestion && <SuggestionCard conflict={conflict} onViewDiff={onViewDiff} />}
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
// applied: the fix reaches the workspace when the change is merged.
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
            Preview only — applied when the change is merged, after every required reviewer approves.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Right: the review ─────────────────────────────────────────────────

const STATUS_TONE = {
  action: 'bg-sky-400/[0.08]',
  waiting: 'bg-white/[0.04]',
  ready: 'bg-emerald-400/[0.07]',
  done: 'bg-emerald-400/[0.07]',
  idle: 'bg-white/[0.04]',
}

// Where the review stands, in plain lines from the actual required
// reviewers ("Approved by you", "Waiting for Min", "All required approvals
// received", "Pending merge", "Merged") — shown instead of a disabled
// button once there's nothing left for you to do.
function StatusCard({ conflict }) {
  const status = approvalStatus(conflict)
  const next = nextActionFor(conflict)
  return (
    <div className={cn('rounded-xl p-4', STATUS_TONE[status.tone])}>
      <p className="text-[11px] font-medium text-slate-500">Status</p>
      <ul className="mt-1 space-y-0.5">
        {status.lines.map((line) => (
          <li key={line} className="flex items-center gap-1.5 text-[13px] font-semibold text-white">
            {(line.startsWith('Approved') || line.startsWith('All required') || line === 'Merged') && (
              <Check className="size-3.5 text-emerald-300" strokeWidth={2.5} />
            )}
            {line}
          </li>
        ))}
      </ul>
      {conflict.reviewStage !== 'resolved' && (
        <p className={cn('mt-2 text-xs', next.mine ? 'text-sky-300' : 'text-slate-400')}>
          Next: {next.mine ? 'your review' : next.label}
        </p>
      )}
    </div>
  )
}

const PRIMARY_BUTTON = cn(
  'inline-flex h-9 shrink-0 items-center rounded-full px-5 text-[13px] font-semibold whitespace-nowrap',
  ACCENT_CTA,
  'disabled:bg-white/[0.06] disabled:text-slate-500 disabled:shadow-none'
)

const iconActionClass =
  'flex size-6 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/[0.08] hover:text-white'

// Reviewers sign off here. Assigning is open until the conflict is
// resolved — a new reviewer on an Approved conflict sends it back to In
// Review, since everyone has to sign off; removing is open before review
// starts, and in review for anyone who hasn't approved (never the last
// one). Your own sign-off is the window's primary action (Approve change /
// Request changes); everyone else's status is just shown, and anyone still
// pending can be reminded.
function ReviewersSection({ conflict, onUpdate, onSimulateApproval }) {
  const { reviewers, reviewStage } = conflict
  const assignable = allPeople.filter((p) => !reviewers.some((r) => r.id === p.id))
  const pending = reviewers.filter((r) => r.status !== 'approved' && r.id !== currentUser.id)
  const canRemind = reviewStage === 'in_review' || reviewStage === 'detected'

  function setReviewers(next, patch = {}) {
    onUpdate({ reviewers: next, ...patch })
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
                {/* Teammates aren't live: in this prototype their sign-off
                    is simulated, and labeled as such. */}
                {reviewStage === 'in_review' && reviewer.status === 'pending' && reviewer.id !== currentUser.id && onSimulateApproval && (
                  <button
                    type="button"
                    aria-label={`Simulate ${person.name}'s approval (demo)`}
                    title={`Simulate ${person.name}'s approval (demo — teammates aren't live)`}
                    onClick={() => onSimulateApproval(reviewer.id)}
                    className={cn(iconActionClass, 'opacity-0 group-hover/rev:opacity-100 focus-visible:opacity-100')}
                  >
                    <FlaskConical className="size-3.5" />
                  </button>
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

  // The conflict's seeded linked comment, plus everything posted here.
  const linked = workspace.comments.filter((c) => c.id === conflict.linkedCommentId || c.target?.conflictId === conflict.id)

  function handleSend(event) {
    event.preventDefault()
    if (!draft.trim()) return
    workspace.addComment(draft, { conflictId: conflict.id })
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
// `onUpdate(id, patch)` applies review edits (stage, reviewers) to
// wherever the conflict lives; `onApprove(id)` / `onRequestChanges(id)` are
// your own sign-off (approving never changes code); `onResolve(id)` merges
// an Approved conflict — the only step that applies the change.
function ConflictModal({ conflict, onOpenChange, onUpdate, onApprove, onRequestChanges, onResolve, onOpenMergeStudio }) {
  const workspace = useWorkspaceOptional()
  const navigate = useNavigate()
  const open = Boolean(conflict)
  const { style: dragStyle, handleProps } = useDraggable()

  const severity = conflict?.severity ? (severityConfig[conflict.severity] ?? severityConfig.medium) : null
  const SeverityIcon = severity?.icon

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

  function openTab(value) {
    setTab(value)
    if (value === 'diff' && !conflict.diffInspected && conflict.reviewStage !== 'resolved') {
      update({ diffInspected: true })
    }
  }

  function handleRequestReview() {
    // A fresh review round: earlier "changes requested" go back to pending.
    update({
      reviewStage: 'in_review',
      reviewers: conflict.reviewers.map((r) => (r.status === 'changes_requested' ? { ...r, status: 'pending' } : r)),
    })
  }

  function handleApprove() {
    const next = onApprove?.(conflict.id)
    if (!next) return
    const waiting = next.reviewers.filter((r) => r.status === 'pending').length
    toast(next.reviewStage === 'approved' ? 'All required approvals received' : 'Approved by you', {
      description:
        next.reviewStage === 'approved'
          ? 'Pending merge. Approval does not merge the changes.'
          : `Waiting for ${waiting} more reviewer${waiting === 1 ? '' : 's'}. Approval does not merge the changes.`,
    })
  }

  // Demo only: teammates aren't live, so their sign-off is simulated with
  // the same rule as a real one (Approved once every reviewer approved).
  function handleSimulateApproval(reviewerId) {
    const reviewers = conflict.reviewers.map((r) => (r.id === reviewerId ? { ...r, status: 'approved' } : r))
    const allApproved = reviewers.every((r) => r.status === 'approved')
    update({ reviewers, reviewStage: allApproved ? 'approved' : 'in_review' })
  }

  function handleMerge() {
    if (onResolve) onResolve(conflict.id)
    else update({ reviewStage: 'resolved' })
  }

  function handleReopen() {
    update({
      reviewStage: 'detected',
      diffInspected: false,
      reviewers: conflict.reviewers.map((r) => ({ ...r, status: 'pending' })),
    })
  }

  const stage = conflict?.reviewStage
  const myReview = conflict ? needsReviewFrom(conflict) : false

  // The one primary action for where the review is — or none, when it's
  // waiting on someone else (the Status card says who).
  let primary = null
  if (conflict) {
    if (stage === 'detected') {
      primary = (
        <button type="button" disabled={!conflict.reviewers.length} onClick={handleRequestReview} className={PRIMARY_BUTTON}>
          Request review
        </button>
      )
    } else if (stage === 'in_review' && myReview) {
      primary = (
        <>
          <button
            type="button"
            onClick={() => onRequestChanges?.(conflict.id)}
            className={cn('inline-flex h-9 shrink-0 items-center rounded-full px-4 text-[13px] font-medium whitespace-nowrap', GHOST_BUTTON)}
          >
            Request changes
          </button>
          <button type="button" onClick={handleApprove} className={PRIMARY_BUTTON}>
            Approve change
          </button>
        </>
      )
    } else if (stage === 'approved') {
      primary = (
        <button type="button" onClick={handleMerge} className={cn(PRIMARY_BUTTON, 'gap-1.5')}>
          <GitMerge className="size-3.5" />
          Merge change
        </button>
      )
    } else if (stage === 'resolved') {
      primary = (
        <button
          type="button"
          onClick={handleReopen}
          className={cn('inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium', GHOST_BUTTON)}
        >
          <RotateCcw className="size-3.5" />
          Reopen
        </button>
      )
    }
  }

  const footerNote =
    stage === 'in_review' && myReview
      ? 'Approval does not merge the changes.'
      : stage === 'approved'
        ? 'Merging applies the change and saves a History checkpoint.'
        : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false} disablePointerDismissal>
      <DialogContent
        overlay={false}
        showCloseButton={false}
        style={dragStyle}
        className={cn(
          'flex h-[min(760px,90vh)] w-full max-w-[1040px] flex-col gap-0 overflow-hidden bg-card p-0 ring-0 sm:max-w-[1040px]',
          PANEL_RADIUS,
          FLOATING_PANEL
        )}
      >
        {conflict && (
          <>
            {/* Header — the drag handle. Risk and processing status are two
                separate badges: how much it matters vs. where it is. */}
            <div
              {...handleProps}
              title="Drag to move"
              className="flex shrink-0 cursor-grab touch-none items-start gap-3 px-8 pt-6 pb-5 select-none active:cursor-grabbing"
            >
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-[15px] font-semibold text-white">{conflict.title}</DialogTitle>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {severity && (
                    <span
                      title="Risk"
                      className={cn('inline-flex h-5 items-center gap-1 rounded-full px-2 text-[10px] font-semibold', severity.className)}
                    >
                      <SeverityIcon className="size-3" />
                      {severity.label} risk
                    </span>
                  )}
                  <StagePill stage={stage} />
                  <DialogDescription className="ml-1 flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
                    <FileCode2 className="size-3.5 shrink-0" />
                    <span className="truncate font-mono text-slate-400">
                      {conflict.file}
                      {conflict.line ? `:${conflict.line}` : ''}
                    </span>
                    {conflict.projectName && <span className="shrink-0">· {conflict.projectName}</span>}
                    {conflict.detectedAt && <span className="shrink-0">· {conflict.detectedAt}</span>}
                  </DialogDescription>
                </div>
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

            <div className="flex min-h-0 flex-1 border-t border-white/[0.06]">
              {/* Left: what's in conflict */}
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <div className="flex shrink-0 items-center gap-1 px-8 pt-5 pb-5" role="tablist" aria-label="Conflict details">
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
                    </button>
                  ))}
                </div>
                <div className="min-h-0 flex-1 overflow-auto px-8 pb-8" role="tabpanel">
                  {tab === 'overview' && (
                    <OverviewTab conflict={conflict} onViewDiff={conflict.diff ? () => openTab('diff') : null} />
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

              {/* Right: the review — status, reviewers, comments — kept to
                  ~30% so the content under review (left, ~70%) gets the room. */}
              <div className="flex w-[30%] min-w-[280px] shrink-0 flex-col gap-7 overflow-hidden bg-white/[0.015] px-6 pt-6 pb-6">
                <StatusCard conflict={conflict} />
                <ReviewersSection conflict={conflict} onUpdate={update} onSimulateApproval={handleSimulateApproval} />
                <div className="flex min-h-0 flex-1 flex-col">
                  <p className={cn(PANEL_LABEL, 'shrink-0')}>Comments</p>
                  <CommentThread key={conflict.id} conflict={conflict} workspace={workspace} />
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3 border-t border-white/[0.06] px-8 py-4">
              {stage !== 'resolved' && (
                <div className="flex min-w-0 items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onOpenMergeStudio?.(conflict)}
                    className={cn('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium', GHOST_BUTTON)}
                  >
                    <GitMerge className="size-3.5" />
                    Open in Merge Studio
                  </button>
                  <span className="hidden max-w-[200px] text-[11px] leading-snug text-slate-500 xl:block">
                    Edit or combine elements in Merge Studio before merging.
                  </span>
                </div>
              )}
              <div className="ml-auto flex items-center gap-2">
                {footerNote && <span className="mr-1 text-right text-[11px] leading-snug text-slate-400">{footerNote}</span>}
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="inline-flex h-9 items-center rounded-full px-4 text-[13px] font-medium text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  Close
                </button>
                {primary}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ConflictModal
