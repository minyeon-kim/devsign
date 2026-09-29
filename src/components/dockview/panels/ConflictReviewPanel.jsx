import { Fragment, useState } from 'react'
import {
  Bell,
  Bot,
  ArrowLeft,
  Check,
  Clock3,
  Code2,
  Eye,
  FileCode2,
  FlaskConical,
  GitMerge,
  History,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  User,
  X,
} from 'lucide-react'
import { cn } from 'cn'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
} from '@/lib/conflicts'
import ChangePreview from '@/components/conflicts/ChangePreview'
import { diffLines } from '@/lib/lineDiff'
import { historyMeta } from '@/lib/historyMeta'
import RollbackCheckpointModal from '@/components/history/RollbackCheckpointModal'
import { toast } from '@/i18n/toast'
import { useWorkspaceOptional } from '@/state/WorkspaceProvider'
import { SeverityPill } from '@/components/mergestudio/ConflictTag'
import {
  ACCENT_CTA,
  CATEGORY_TAB,
  CATEGORY_TAB_ACTIVE,
  CATEGORY_TAB_IDLE,
  GHOST_BUTTON,
  PANEL_LABEL,
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
  high: { label: 'High' },
  medium: { label: 'Medium' },
  low: { label: 'Low' },
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

const REVIEW_INFO_GRID = 'grid items-start gap-x-4 gap-y-2 sm:grid-cols-[104px_minmax(0,1fr)]'
const REVIEW_INFO_LABEL = 'text-[11px] leading-5 font-medium text-slate-500'

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

function PersonRole({ person }) {
  if (!person?.role || person.role === 'You') return null
  return (
    <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-medium text-slate-400">
      {person.role}
    </span>
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
      className="inline-flex h-5 items-center gap-1.5 rounded-full bg-white/[0.06] px-2 text-[11px] font-semibold text-slate-200"
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
    <div className="space-y-1.5">
      {fields.map((field) => (
        <div key={field.label} className="space-y-1.5">
          <p className="text-[11px] text-slate-500">{field.label}</p>
          <div className="grid grid-cols-2 gap-3">
            <span className="min-w-0 rounded-lg bg-white/[0.035] px-3 py-1.5 text-xs font-medium text-red-300">{field.current}</span>
            <span className="min-w-0 rounded-lg bg-white/[0.035] px-3 py-1.5 text-xs font-medium text-emerald-200">{field.expected}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function personName(id) {
  if (id === currentUser.id) return 'You'
  return allPeople.find((p) => p.id === id)?.name ?? id
}

// Who (or which AI) made the change under review, what flagged it, and the
// screens / components / files it reaches — only what the record knows.
function Provenance({ conflict, className }) {
  const { changedBy, detectedBy, impact } = conflict
  const primaryFile = conflict.file ? `${conflict.file}${conflict.line ? `:${conflict.line}` : ''}` : null
  const files = [...new Set([primaryFile, ...(impact?.files ?? []).filter((file) => file !== conflict.file)].filter(Boolean))]
  const impactRows = [
    ['Screens', impact?.screens],
    ['Components', impact?.components],
    ['Files', files],
  ].filter(([, list]) => list?.length)
  if (!changedBy && !detectedBy && !impactRows.length) return null

  return (
    <div className={cn(REVIEW_INFO_GRID, 'gap-y-3 text-xs', className)}>
      {changedBy && (
        <>
          <span className={REVIEW_INFO_LABEL}>Changed by</span>
          <span className="text-xs leading-5 text-slate-200">
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
          <span className={REVIEW_INFO_LABEL}>Detected by</span>
          <span className="text-xs leading-5 text-slate-300">{detectedBy}</span>
        </>
      )}
      {impactRows.map(([label, list]) => (
        <Fragment key={label}>
          <span className={REVIEW_INFO_LABEL}>{label}</span>
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
    <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.12] p-5 shadow-[inset_0_1px_0_rgba(110,231,183,0.08)]">
      <p className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-emerald-200">
        <Sparkles className="size-3.5" />
        AI suggestion
      </p>
      <dl className="space-y-4">
        {rows.map(([label, text]) => (
          <div key={label}>
            <dt className="text-[11px] text-slate-500">{label}</dt>
            <dd className="mt-1 text-[13px] leading-relaxed text-slate-200">{text}</dd>
          </div>
        ))}
        {conflict.references?.length > 0 && (
          <div>
            <dt className="text-[11px] text-slate-500">References</dt>
            <dd className="mt-2 flex flex-wrap gap-1.5">
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
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
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
  const riskPrefix = /^(Low|Medium|High):\s*/.exec(conflict.riskReason ?? '')
  const riskExplanation = riskPrefix
    ? conflict.riskReason.slice(riskPrefix[0].length)
    : conflict.riskReason
  const reviewImpact = riskExplanation && `This needs review because ${riskExplanation}`
  const hasMetadata = Boolean(
    conflict.changedBy ||
    conflict.detectedBy ||
    conflict.impact?.screens?.length ||
    conflict.impact?.components?.length ||
    conflict.impact?.files?.length
  )

  return (
    <div className="space-y-5">
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
      {(conflict.message || reviewImpact || hasMetadata) && (
        <section className="rounded-2xl bg-white/[0.03] p-5">
          {conflict.message && (
            <div className={REVIEW_INFO_GRID}>
              <p className={REVIEW_INFO_LABEL}>Issue summary</p>
              <p className="text-sm leading-6 font-medium text-slate-200">{conflict.message}</p>
            </div>
          )}
          {reviewImpact && (
            <div className={cn(REVIEW_INFO_GRID, conflict.message && 'mt-4 border-t border-white/[0.08] pt-4')}>
              <p className={REVIEW_INFO_LABEL}>Review impact</p>
              <p className="text-sm leading-6 text-slate-300">{reviewImpact}</p>
            </div>
          )}
          <Provenance
            conflict={conflict}
            className={cn((conflict.message || reviewImpact) && hasMetadata && 'mt-4 border-t border-white/[0.08] pt-4')}
          />
        </section>
      )}

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

function CodeDiffColumns({ rows }) {
  const columns = [
    { id: 'before', label: 'Before', kinds: new Set(['same', 'remove']) },
    { id: 'after', label: 'After', kinds: new Set(['same', 'add']) },
  ]

  return (
    <div className="grid grid-cols-2 gap-3">
      {columns.map((column) => (
        <div key={column.id} role="group" aria-label={`${column.label} code`} className="min-w-0 overflow-auto rounded-xl bg-black/25 py-2 font-mono text-[11px] leading-relaxed">
          <span className="sr-only">{column.label}</span>
          {rows.filter((row) => column.kinds.has(row.kind)).map((row, index) => (
            <div key={`${row.kind}-${index}`} className={cn('flex px-2 whitespace-pre', DIFF_TONES[row.kind])}>
              <span className="w-3.5 shrink-0 opacity-70 select-none">{DIFF_MARKS[row.kind]}</span>
              <span>{row.text || ' '}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// The proposed change as an inline diff — review only. Nothing here is
// applied: the fix reaches the workspace when the change is merged.
function DiffTab({ conflict }) {
  if (!conflict.branches && !conflict.diff && !conflict.suggestion && !conflict.preview && !conflict.comparisonFields?.length) {
    return <EmptyNote>No diff captured for this conflict yet.</EmptyNote>
  }
  const rows = conflict.diff ? diffLines(conflict.diff.before ?? [], conflict.diff.after ?? []) : []
  const pairedPreview = conflict.preview && conflict.preview.kind !== 'divider' && conflict.comparisonFields?.length > 0

  return (
    <div className="space-y-3">
      {(conflict.preview || conflict.comparisonFields?.length > 0 || conflict.diff || conflict.suggestion) && (
        <section className="rounded-xl bg-white/[0.025] p-4">
          <div className="flex flex-col gap-4">
            {conflict.suggestion && (
              <div className="rounded-xl bg-emerald-400/[0.07] px-3 py-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-200">
                  <Sparkles className="size-3.5" />
                  AI suggestion
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-200">{conflict.suggestion}</p>
                {conflict.suggestionReason && <p className="mt-1 text-xs leading-relaxed text-slate-400">{conflict.suggestionReason}</p>}
              </div>
            )}
            {pairedPreview ? (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { side: 'before', tone: 'text-red-300', value: (field) => field.current },
                  { side: 'after', tone: 'text-emerald-200', value: (field) => field.expected },
                ].map(({ side, tone, value }) => (
                  <div key={side} className="min-w-0">
                    <ChangePreview preview={conflict.preview} side={side} />
                    <dl className="mt-0.5 space-y-0.5">
                      {conflict.comparisonFields.map((field) => (
                        <div key={field.label} className="flex min-w-0 items-center justify-center gap-1.5 text-xs">
                          <dt className="truncate text-[10px] text-slate-500">{field.label}</dt>
                          <dd className={cn('shrink-0 font-medium', tone)}>{value(field)}</dd>
                        </div>
                      ))}
                    </dl>
                    {(side === 'before' ? conflict.branches?.local : conflict.branches?.remote) && (
                      <p className="mt-1 flex min-w-0 items-center justify-center gap-1 truncate text-[10px] text-slate-500" title={side === 'before' ? conflict.branches.local : conflict.branches.remote}>
                        <FileCode2 className="size-3 shrink-0" />
                        <span className="truncate">{side === 'before' ? conflict.branches.local : conflict.branches.remote}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : conflict.preview && (
              <div className="min-w-0">
                <ChangePreview preview={conflict.preview} />
              </div>
            )}
            {!pairedPreview && conflict.comparisonFields?.length > 0 && (
              <div className="min-w-0">
                <ComparisonTable fields={conflict.comparisonFields} />
              </div>
            )}
            {!pairedPreview && conflict.branches && (
              <div className="grid grid-cols-2 gap-3 text-[10px] text-slate-500">
                {[conflict.branches.local, conflict.branches.remote].map((source, index) => (
                  <p key={index} className="flex min-w-0 items-center gap-1" title={source}>
                    <FileCode2 className="size-3 shrink-0" />
                    <span className="truncate">{source}</span>
                  </p>
                ))}
              </div>
            )}
            {conflict.diff && (
              <div className="min-w-0">
                <p className={cn(PANEL_LABEL, 'mb-2 justify-between')}>
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-emerald-300" />
                    Proposed change
                  </span>
                  <span className="font-mono text-[10.5px] font-normal">{conflict.file}</span>
                </p>
                <CodeDiffColumns rows={rows} />
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Eye className="size-3" />
                  Preview only — applied when the change is merged, after every required reviewer approves.
                </p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

// ─── Right: the review ─────────────────────────────────────────────────

// Where the review stands, in plain lines from the actual required
// reviewers ("Approved by you", "Waiting for Min", "All required approvals
// received", "Pending merge", "Merged") — shown instead of a disabled
// button once there's nothing left for you to do.
function StatusCard({ conflict }) {
  const status = approvalStatus(conflict)
  const currentStep = REVIEW_STAGES.findIndex((step) => step.id === conflict.reviewStage)
  return (
    <div className="min-w-0 rounded-xl bg-white/[0.03] p-4">
      <ol
        aria-label={`Review progress: ${REVIEW_STAGES.map((step) => step.label).join(' → ')}; current step ${currentStep + 1} of ${REVIEW_STAGES.length}`}
        className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-1"
      >
        {REVIEW_STAGES.map((step, index) => {
          const current = index === currentStep
          return (
            <Fragment key={step.id}>
              {index > 0 && <li aria-hidden="true" className="px-1 text-[10px] text-slate-600">→</li>}
              <li aria-current={current ? 'step' : undefined} className="flex min-w-0 items-center justify-center">
                <span className={cn(
                  'max-w-full truncate text-xs leading-4 font-semibold whitespace-nowrap',
                  current ? 'inline-flex items-center rounded-full bg-emerald-300 px-1.5 py-1 text-[#050506]' : 'text-slate-400'
                )}>
                  {step.label}
                </span>
              </li>
            </Fragment>
          )
        })}
      </ol>
      {conflict.reviewStage === 'in_review' && status.lines.length > 0 && (
        <ul className="mt-2 space-y-1">
          {status.lines.map((line) => (
            <li key={line} className="text-xs leading-4 text-slate-300">{line}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

const PRIMARY_BUTTON = cn(
  'inline-flex h-8 shrink-0 items-center rounded-full px-4 text-xs font-semibold whitespace-nowrap',
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
        <div className="space-y-1">
          {reviewers.map((reviewer) => {
            const person = allPeople.find((p) => p.id === reviewer.id)
            if (!person) return null
            const status = REVIEWER_STATUS[reviewer.status] ?? REVIEWER_STATUS.pending
            return (
              <div key={reviewer.id} className="group/rev grid h-9 grid-cols-[minmax(0,1fr)_64px_72px] items-center gap-2.5 rounded-lg text-xs hover:bg-white/[0.03]">
                <div className="flex min-w-0 items-center gap-2.5">
                  <PersonAvatar person={person} />
                  <span className="min-w-0 truncate font-medium text-slate-200">
                    {person.name}
                    {person.id === currentUser.id && <span className="font-normal text-slate-500"> (you)</span>}
                  </span>
                </div>
                <span className={cn('w-16 truncate text-right text-[11px]', status.className)}>
                  {reviewer.status !== 'approved' && reviewer.remindedAt ? `Reminded ${reviewer.remindedAt}` : status.label}
                </span>
                <div className="flex w-[72px] shrink-0 items-center justify-end gap-0">
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
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyDraft, setReplyDraft] = useState('')

  if (!workspace) {
    return <p className="text-xs text-slate-500">Open the project's workspace to see and reply to its thread.</p>
  }

  // The conflict's seeded linked comment, plus everything posted here.
  const linked = workspace.comments.filter((c) => c.id === conflict.linkedCommentId || c.target?.conflictId === conflict.id)
  const comments = linked.filter((comment) => !comment.target?.replyTo)

  function handleSend(event) {
    event.preventDefault()
    if (!draft.trim()) return
    workspace.addComment(draft, { conflictId: conflict.id })
    setDraft('')
  }

  function handleReply(event, commentId) {
    event.preventDefault()
    if (!replyDraft.trim()) return
    workspace.addComment(replyDraft, { conflictId: conflict.id, replyTo: commentId })
    setReplyDraft('')
    setReplyingTo(null)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="min-h-0 flex-1 space-y-3 overflow-auto">
        {comments.length === 0 && <p className="text-xs text-slate-500">No comments yet.</p>}
        {comments.map((comment) => {
          const author = allPeople.find((p) => p.id === comment.authorId)
          const replies = linked.filter((reply) => reply.target?.replyTo === comment.id)
          return (
            <div key={comment.id} className="space-y-2 text-xs">
              <div className="flex gap-2.5">
                {author && <PersonAvatar person={author} />}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-slate-200">{author?.name}</span>
                    <PersonRole person={author} />
                    <span className="text-[11px] text-slate-500">{comment.timeLabel}</span>
                  </p>
                  <p className="mt-0.5 leading-relaxed text-slate-300">{comment.text}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyingTo(replyingTo === comment.id ? null : comment.id)
                      setReplyDraft('')
                    }}
                    className="mt-1 text-[11px] font-medium text-slate-400 transition-colors hover:text-white"
                  >
                    {replyingTo === comment.id ? 'Cancel reply' : 'Reply'}
                  </button>
                </div>
              </div>
              {replies.length > 0 && (
                <div className="ml-7 space-y-2 border-l border-white/[0.08] pl-3">
                  {replies.map((reply) => {
                    const replyAuthor = allPeople.find((person) => person.id === reply.authorId)
                    return (
                      <div key={reply.id} className="flex gap-2.5">
                        {replyAuthor && <PersonAvatar person={replyAuthor} />}
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-slate-200">{replyAuthor?.name}</span>
                            <PersonRole person={replyAuthor} />
                            <span className="text-[11px] text-slate-500">{reply.timeLabel}</span>
                          </p>
                          <p className="mt-0.5 leading-relaxed text-slate-300">{reply.text}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {replyingTo === comment.id && (
                <form onSubmit={(event) => handleReply(event, comment.id)} className="ml-7 flex h-8 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] pr-1 pl-3 focus-within:border-white/25">
                  <input
                    autoFocus
                    value={replyDraft}
                    onChange={(event) => setReplyDraft(event.target.value)}
                    placeholder="Write a reply"
                    aria-label={`Reply to ${author?.name ?? 'comment'}`}
                    className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-500"
                  />
                  <button
                    type="submit"
                    aria-label="Send reply"
                    disabled={!replyDraft.trim()}
                    className="flex size-6 items-center justify-center rounded-full bg-[#2c2c31] text-white ring-1 ring-white/10 ring-inset transition-colors hover:bg-[#38383e] disabled:text-slate-500"
                  >
                    <Send className="size-3" />
                  </button>
                </form>
              )}
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

const EMPTY_HISTORY = []

function relativeCheckpointTime(timestamp) {
  if (!timestamp) return 'Saved checkpoint'
  if (/^(just now|today|yesterday|last week|\d+\s*(?:m|h|d|w|mo|y) ago)/i.test(timestamp)) {
    return timestamp.split(',')[0]
  }
  const now = new Date()
  const weekday = timestamp.match(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat),?\s+(\d{1,2}:\d{2}\s*[AP]M)$/i)
  let date = null
  if (weekday) {
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const targetDay = weekdays.findIndex((day) => day.toLowerCase() === weekday[1].toLowerCase())
    const daysAgo = (now.getDay() - targetDay + 7) % 7 || 7
    date = new Date(now)
    date.setDate(now.getDate() - daysAgo)
    const time = new Date(`Jan 1, 2000 ${weekday[2]}`)
    date.setHours(time.getHours(), time.getMinutes(), 0, 0)
  } else {
    date = new Date(`${timestamp}, ${now.getFullYear()}`)
    if (Number.isNaN(date.getTime())) return timestamp
    if (date > now) date.setFullYear(date.getFullYear() - 1)
  }
  const days = Math.max(0, Math.floor((now - date) / 86_400_000))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return `${Math.floor(days / 365)} years ago`
}

function HistoryCheckpointTimeline({ workspace }) {
  const entries = workspace?.historyEntries ?? EMPTY_HISTORY
  const activeId = workspace?.activeHistoryId
  const [selectedId, setSelectedId] = useState(null)
  const [rollbackId, setRollbackId] = useState(null)
  const active = entries.find((entry) => entry.id === activeId) ?? entries.at(-1) ?? null
  const resolvedSelectedId = entries.some((entry) => entry.id === selectedId) ? selectedId : active?.id
  const selected = entries.find((entry) => entry.id === resolvedSelectedId) ?? null
  const rows = selected && active
    ? selected.id === active.id
      ? (selected.snapshot?.lines ?? []).map((text) => ({ kind: 'same', text }))
      : diffLines(active.snapshot?.lines ?? [], selected.snapshot?.lines ?? [])
    : []

  if (entries.length === 0) {
    return <EmptyNote>No checkpoints have been saved for this project yet.</EmptyNote>
  }

  return (
    <div className="flex h-full min-h-[280px] min-w-0 gap-3">
      <section aria-label="Project checkpoints" className="flex w-[38%] min-w-[190px] max-w-[360px] shrink-0 flex-col overflow-hidden rounded-xl bg-white/[0.025]">
        <div className="flex shrink-0 items-center gap-1.5 px-3 py-2.5">
          <History className="size-3.5 text-slate-500" />
          <span className="text-xs font-medium text-slate-300">Checkpoints</span>
          <span className="ml-auto text-[10px] tabular-nums text-slate-500">{entries.length}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
          {[...entries].reverse().map((entry) => {
            const person = allPeople.find((candidate) => candidate.id === entry.actorId)
            const author = entry.actorLabel ?? person?.name ?? 'Workspace'
            const isCurrent = entry.id === activeId
            const isRestored = Boolean(entry.restoredFrom || entry.kind === 'rollback' || /^(restored|rolled back)/i.test(entry.label))
            return (
              <button
                key={entry.id}
                type="button"
                aria-pressed={entry.id === resolvedSelectedId}
                onClick={() => setSelectedId(entry.id)}
                className={cn(
                  'flex w-full min-w-0 flex-col gap-1.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[0.045]',
                  entry.id === resolvedSelectedId && 'bg-white/[0.06]'
                )}
              >
                <span className="flex w-full min-w-0 items-start gap-2">
                  <span className={cn('mt-1 size-1.5 shrink-0 rounded-full', isCurrent ? 'bg-emerald-300' : isRestored ? 'bg-amber-300' : 'bg-slate-600')} />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-200" title={entry.label}>{entry.label}</span>
                  {isCurrent && <span className="shrink-0 rounded-full bg-emerald-400/10 px-1.5 py-0.5 text-[9px] text-emerald-300">Current</span>}
                  {!isCurrent && isRestored && <span className="shrink-0 rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[9px] text-amber-200">Restored</span>}
                  {!isCurrent && entry.archived && <span className="shrink-0 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-slate-400">Archived</span>}
                </span>
                <span className="flex min-w-0 items-center gap-1.5 pl-3.5">
                  {person ? <PersonAvatar person={person} /> : (
                    <Avatar size="sm"><AvatarFallback className="bg-emerald-400/15 text-[9px] font-medium text-emerald-200">{author.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                  )}
                  <span className="min-w-0 flex-1 truncate text-[10px] text-slate-500">{author}</span>
                  <span className="flex shrink-0 items-center gap-1 text-[10px] text-slate-500">
                    <Clock3 className="size-3" />
                    {relativeCheckpointTime(entry.timestamp)}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section aria-label="Checkpoint snapshot diff" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-white/[0.025]">
        {selected ? (
          <>
            <div className="flex shrink-0 items-start gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-200">{selected.label}</p>
                <p className="mt-1 truncate text-[10px] text-slate-500">
                  {relativeCheckpointTime(selected.timestamp)}{historyMeta(selected) ? ` · ${historyMeta(selected)}` : ''}
                  {selected.snapshot?.fileId ? ` · ${workspace.getFileName(selected.snapshot.fileId)}` : ''}
                </p>
              </div>
              {selected.id !== activeId && !selected.archived && (
                <button type="button" onClick={() => setRollbackId(selected.id)} className={cn('inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[10px] font-medium', GHOST_BUTTON)}>
                  <RotateCcw className="size-3" />
                  Roll back
                </button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-auto border-t border-white/[0.05] py-1.5 font-mono text-[10px] leading-relaxed">
              {rows.length === 0 ? <p className="px-3 py-3 text-slate-500">No file snapshot is available for this checkpoint.</p> : rows.map((row, index) => (
                <div key={`${row.kind}-${index}`} className={cn('flex min-w-max px-3 whitespace-pre', row.kind === 'add' ? 'bg-emerald-400/[0.08] text-emerald-300' : row.kind === 'remove' ? 'bg-red-400/[0.08] text-red-300' : 'text-slate-500')}>
                  <span className="w-4 shrink-0 select-none opacity-70">{row.kind === 'add' ? '+' : row.kind === 'remove' ? '−' : ' '}</span>
                  <span>{row.text || ' '}</span>
                </div>
              ))}
            </div>
          </>
        ) : <p className="p-3 text-xs text-slate-500">Select a checkpoint to inspect its file snapshot.</p>}
      </section>
      <RollbackCheckpointModal
        entryId={rollbackId}
        onOpenChange={(open) => !open && setRollbackId(null)}
        onDone={(_entry, restoredId) => setSelectedId(restoredId)}
      />
    </div>
  )
}

// ─── Inline review view ────────────────────────────────────────────────
//
// `onUpdate(id, patch)` applies review edits (stage, reviewers) to
// wherever the conflict lives; `onApprove(id)` / `onRequestChanges(id)` are
// your own sign-off (approving never changes code); `onResolve(id)` merges
// an Approved conflict — the only step that applies the change.
function ConflictModal({ conflict, onOpenChange, onUpdate, onApprove, onRequestChanges, onResolve, onOpenMergeStudio }) {
  const workspace = useWorkspaceOptional()

  const severity = conflict?.severity ? (severityConfig[conflict.severity] ?? severityConfig.medium) : null

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
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-card">
        {conflict && (
          <>
            {/* Primary header combines the issue identity and project context. */}
            <div className="flex min-h-14 shrink-0 items-center justify-between gap-5 border-b border-white/[0.07] bg-white/[0.02] px-5 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">{conflict.title}</h2>
                <div className="flex shrink-0 items-center gap-2.5">
                  {severity && <SeverityPill level={severity.label} />}
                  <StagePill stage={stage} />
                </div>
              </div>
              <div className="flex min-w-0 max-w-[52%] flex-wrap items-center justify-end gap-x-4 gap-y-1.5 text-xs text-slate-500">
                {conflict.projectName && <span className="text-slate-500">Project · <span className="text-slate-400">{conflict.projectName}</span></span>}
                {conflict.detectedAt && <span className="text-slate-500">Detected · <span className="text-slate-400">{conflict.detectedAt}</span></span>}
              </div>
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-5 py-2.5">
                <div className="flex items-center gap-1" role="tablist" aria-label="Conflict details">
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
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  <ArrowLeft className="size-3.5" />
                  Back to list
                </button>
              </div>

              <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,3fr)_minmax(300px,1fr)]">
                <div className="min-h-0 min-w-0 overflow-auto px-5 pt-4 pb-4" role="tabpanel">
                    {tab === 'overview' && (
                      <OverviewTab conflict={conflict} onViewDiff={conflict.diff ? () => openTab('diff') : null} />
                    )}
                    {tab === 'diff' && <DiffTab conflict={conflict} />}
                    {tab === 'history' && (
                      <HistoryCheckpointTimeline workspace={workspace} />
                    )}
                </div>

                {/* Sidebar begins level with the main content beneath the shared tab bar. */}
                <div className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden px-3 pt-4 pb-3">
                  <StatusCard conflict={conflict} />
                  <div className="min-w-0 rounded-xl bg-white/[0.03] p-4">
                    <ReviewersSection conflict={conflict} onUpdate={update} onSimulateApproval={handleSimulateApproval} />
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col rounded-xl bg-white/[0.03] p-4">
                    <p className={cn(PANEL_LABEL, 'shrink-0')}>Comments</p>
                    <CommentThread key={conflict.id} conflict={conflict} workspace={workspace} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3 border-t border-white/[0.06] bg-white/[0.02] px-5 py-2.5">
              <div className="min-w-0 flex-1" />
              {stage !== 'resolved' && (
                <div className="flex shrink-0 items-center">
                  <Tooltip>
                    <TooltipTrigger
                      type="button"
                      onClick={() => onOpenMergeStudio?.(conflict)}
                      className={cn('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium', GHOST_BUTTON)}
                    >
                      <GitMerge className="size-3.5" />
                      Open in Merge Studio
                    </TooltipTrigger>
                    <TooltipContent side="top">Edit or combine elements before merging.</TooltipContent>
                  </Tooltip>
                </div>
              )}
              <div className="flex shrink-0 items-center gap-1.5">
                {footerNote && <span className="mr-1 hidden text-right text-[10px] leading-snug text-slate-400 xl:block">{footerNote}</span>}
                {primary}
              </div>
            </div>
          </>
        )}
    </div>
  )
}

export default ConflictModal
