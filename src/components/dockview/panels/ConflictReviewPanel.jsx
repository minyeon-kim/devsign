import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  Bell,
  Bot,
  ArrowLeft,
  Check,
  Clock3,
  Code2,
  Eye,
  FileCode2,
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
import { LocalizedText } from '@/i18n/runtime'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { allPeople, currentUserFor } from '@/data/mockData'
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
import HistoryTimeline from '@/components/history/HistoryTimeline'
import PreviewPanelContent from '@/components/dockview/panels/PreviewPanelContent'
import { toast } from '@/i18n/toast'
import { useWorkspaceOptional } from '@/state/WorkspaceProvider'
import { SeverityPill } from '@/components/mergestudio/ConflictTag'
import {
  ACCENT_CTA,
  GHOST_BUTTON,
  PANEL_LABEL,
  WORKSPACE_TAB_RADIUS,
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

const REVIEW_INFO_GRID = 'grid items-start gap-x-3 gap-y-1 sm:grid-cols-[112px_minmax(0,1fr)]'
const REVIEW_GUTTER = 'gap-3'
const REVIEW_CARD = 'rounded-xl bg-white/[0.03]'
const REVIEW_CONTEXT_CARD = cn(REVIEW_CARD, 'ds-review-context')
const REVIEW_INFO_LABEL = 'text-[11px] leading-5 font-medium text-slate-500'
const REVIEW_DETAIL_CARD = 'rounded-2xl bg-white/[0.03] p-4'
const REVIEW_DETAIL_COPY = 'text-[13px] leading-5 text-slate-200'

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

function PersonRole({ person, viewerId }) {
  if (!person?.role || person.id === viewerId) return null
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
      <span className={cn('ds-status-dot rounded-full', STAGE_DOT_CLASS[stage])} />
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

function personName(id, viewerId) {
  if (id === viewerId) return 'You'
  return allPeople.find((p) => p.id === id)?.name ?? id
}

// Who (or which AI) made the change under review, what flagged it, and the
// screens / components / files it reaches — only what the record knows.
function Provenance({ conflict, className }) {
  const viewerId = currentUserFor(conflict.projectId).id
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
              {changedBy.type === 'ai' ? 'Devsign AI' : personName(changedBy.id, viewerId)}
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

function OverviewTab({ conflict }) {
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
        <section className={REVIEW_DETAIL_CARD}>
          {conflict.message && (
            <div className={REVIEW_INFO_GRID}>
              <p className={REVIEW_INFO_LABEL}>Issue summary</p>
              <p className={cn(REVIEW_DETAIL_COPY, 'font-medium')}>{conflict.message}</p>
            </div>
          )}
          {reviewImpact && (
            <div className={cn(REVIEW_INFO_GRID, conflict.message && 'mt-4 border-t border-white/[0.08] pt-4')}>
              <p className={REVIEW_INFO_LABEL}>Review impact</p>
              <p className="text-[13px] leading-5 text-slate-300">{reviewImpact}</p>
            </div>
          )}
          <Provenance
            conflict={conflict}
            className={cn((conflict.message || reviewImpact) && hasMetadata && 'mt-4 border-t border-white/[0.08] pt-4')}
          />
        </section>
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

function CodeDiffColumns({ rows }) {
  const columns = [
    { id: 'before', label: 'Before', kinds: new Set(['same', 'remove']) },
    { id: 'after', label: 'After', kinds: new Set(['same', 'add']) },
  ]

  return (
    <div className="grid grid-cols-2 gap-3">
      {columns.map((column) => (
        <div key={column.id} role="group" aria-label={`${column.label} code`} className="scroll-fade-bottom min-w-0 overflow-auto rounded-xl bg-black/25 py-2 font-mono text-[11px] leading-relaxed">
          <span className="sr-only">{column.label}</span>
          {rows.filter((row) => column.kinds.has(row.kind)).map((row, index) => (
            <div key={`${row.kind}-${index}`} className={cn('flex min-w-0 px-2 whitespace-pre-wrap [word-break:break-all]', DIFF_TONES[row.kind])}>
              <span className="w-3.5 shrink-0 opacity-70 select-none">{DIFF_MARKS[row.kind]}</span>
              <span className="min-w-0 flex-1 whitespace-pre-wrap [word-break:break-all]">{row.text || ' '}</span>
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
              <div className="rounded-xl bg-white/[0.03] p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <Sparkles className="size-3.5" />
                  AI suggestion
                </p>
                <dl className="mt-2 space-y-2">
                  <div className={REVIEW_INFO_GRID}>
                    <dt className={REVIEW_INFO_LABEL}>Proposal</dt>
                    <dd className={REVIEW_DETAIL_COPY}>{conflict.suggestion}</dd>
                  </div>
                  {conflict.suggestionReason && (
                    <div className={REVIEW_INFO_GRID}>
                      <dt className={REVIEW_INFO_LABEL}>Why</dt>
                      <dd className={REVIEW_DETAIL_COPY}>{conflict.suggestionReason}</dd>
                    </div>
                  )}
                  {conflict.expectedResult && (
                    <div className={REVIEW_INFO_GRID}>
                      <dt className={REVIEW_INFO_LABEL}>Expected result</dt>
                      <dd className={REVIEW_DETAIL_COPY}>{conflict.expectedResult}</dd>
                    </div>
                  )}
                </dl>
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
    <div className={cn('min-w-0', REVIEW_CONTEXT_CARD)}>
      <ol
        aria-label={`Review progress: ${REVIEW_STAGES.map((step) => step.label).join(' → ')}; current step ${currentStep + 1} of ${REVIEW_STAGES.length}`}
        className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_12px_minmax(0,1fr)_12px_minmax(0,1fr)_12px_minmax(0,1fr)] items-center gap-x-0"
      >
        {REVIEW_STAGES.map((step, index) => {
          const current = index === currentStep
          return (
            <Fragment key={step.id}>
              {index > 0 && <li aria-hidden="true" className="text-center text-[10px] text-slate-600">→</li>}
              <li aria-current={current ? 'step' : undefined} className="flex min-w-0 items-center justify-center">
                <span className={cn(
                  'max-w-full truncate text-[10px] leading-4 font-semibold whitespace-nowrap',
                  current ? 'inline-flex items-center rounded-full bg-emerald-300 px-1.5 py-0.5 text-[#050506]' : 'text-slate-400'
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
const REQUEST_REVIEW_BUTTON = 'inline-flex h-8 shrink-0 items-center rounded-full px-4 text-xs font-medium whitespace-nowrap ds-review-cta disabled:opacity-45'

const iconActionClass =
  'flex size-6 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/[0.08] hover:text-white'

// Reviewers sign off here. Assigning is open until the conflict is
// resolved — a new reviewer on an Approved conflict sends it back to In
// Review, since everyone has to sign off; removing is open before review
// starts, and in review for anyone who hasn't approved (never the last
// one). Your own sign-off is the window's primary action (Approve change /
// Request changes); everyone else's status is just shown, and anyone still
// pending can be reminded.
function ReviewersSection({ conflict, onUpdate, onApproveReviewer }) {
  const viewerId = currentUserFor(conflict.projectId).id
  const { reviewers, reviewStage } = conflict
  const assignable = allPeople.filter((p) => !reviewers.some((r) => r.id === p.id))
  const pending = reviewers.filter((r) => r.status !== 'approved' && r.id !== viewerId)
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
      <div className={cn(PANEL_LABEL, 'ds-review-context-heading justify-between')}>
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
                  {person.id === viewerId && <span className="text-muted-foreground">(you)</span>}
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
              <div key={reviewer.id} className="group/rev grid h-9 grid-cols-[minmax(0,1fr)_64px_72px] items-center gap-1 rounded-lg text-xs hover:bg-white/[0.03]">
                <div className="flex min-w-0 items-center gap-2.5">
                  <PersonAvatar person={person} />
                  <span className="min-w-0 truncate font-medium text-slate-200">
                    {person.name}
                    {person.id === viewerId && <span className="font-normal text-slate-500"> (you)</span>}
                  </span>
                </div>
                <span className={cn('w-16 truncate text-right text-[11px]', status.className)}>
                  {reviewer.status !== 'approved' && reviewer.remindedAt ? `Reminded ${reviewer.remindedAt}` : status.label}
                </span>
                <div className="flex w-[72px] shrink-0 items-center justify-end gap-0">
                  {canRemind && reviewer.status !== 'approved' && reviewer.id !== viewerId && (
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
                  {/* Records an approval obtained outside Devsign (in
                      person, on a call, in Slack) so the review stays
                      accurate without waiting on the reviewer to click
                      through themselves. */}
                  {reviewStage === 'in_review' && reviewer.status === 'pending' && reviewer.id !== viewerId && onApproveReviewer && (
                    <button
                      type="button"
                      aria-label={`Mark ${person.name}'s review as approved`}
                      title={`Mark ${person.name}'s review as approved`}
                      onClick={() => onApproveReviewer(reviewer.id)}
                      className={cn(iconActionClass, 'opacity-0 group-hover/rev:opacity-100 focus-visible:opacity-100')}
                    >
                      <Check className="size-3.5" />
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
  const viewerId = currentUserFor(conflict.projectId).id
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
        <div className="scroll-fade-bottom min-h-0 flex-1 space-y-3 overflow-auto">
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
                    <PersonRole person={author} viewerId={viewerId} />
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
                            <PersonRole person={replyAuthor} viewerId={viewerId} />
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
  const timeline = useMemo(() => entries.filter((entry) => !entry.archived), [entries])
  const [selectedId, setSelectedId] = useState(null)
  const [rollbackId, setRollbackId] = useState(null)
  const [compareLatest, setCompareLatest] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [historyView, setHistoryView] = useState('code')
  const active = entries.find((entry) => entry.id === activeId) ?? timeline.at(-1) ?? null
  const resolvedSelectedId = timeline.some((entry) => entry.id === selectedId) ? selectedId : active?.id
  const selected = entries.find((entry) => entry.id === resolvedSelectedId) ?? null
  const timelineIndex = timeline.findIndex((entry) => entry.id === resolvedSelectedId)
  const rows = useMemo(() => {
    if (!selected) return []
    const versionLines = selected.snapshot?.lines ?? []
    if (!compareLatest || !active || selected.id === active.id) return versionLines.map((text) => ({ kind: 'same', text }))
    return diffLines(active.snapshot?.lines ?? [], versionLines)
  }, [selected, active, compareLatest])

  useEffect(() => {
    if (!playing) return undefined
    const timer = window.setTimeout(() => {
      const next = timeline[timelineIndex + 1]
      if (next) setSelectedId(next.id)
      else setPlaying(false)
    }, 900)
    return () => window.clearTimeout(timer)
  }, [playing, timeline, timelineIndex])

  function selectVersion(id) {
    setPlaying(false)
    setSelectedId(id)
  }

  function togglePlay() {
    if (!playing && timelineIndex >= timeline.length - 1 && timeline[0]) setSelectedId(timeline[0].id)
    setPlaying((current) => !current)
  }

  if (entries.length === 0) {
    return <EmptyNote>No checkpoints have been saved for this project yet.</EmptyNote>
  }

  return (
    <div className={cn('flex h-full min-h-0 min-w-0 flex-col', REVIEW_GUTTER)}>
      <div className={cn('flex min-h-0 min-w-0 flex-1', REVIEW_GUTTER)}>
        <section aria-label="Project checkpoints" className={cn('flex w-[38%] min-w-[190px] max-w-[360px] shrink-0 flex-col overflow-hidden', REVIEW_CARD)}>
          <div className="flex shrink-0 items-center gap-1.5 px-3 py-3">
            <History className="size-3.5 text-slate-500" />
            <span className="text-xs font-medium text-slate-300">Checkpoints</span>
            <span className="ml-auto text-[10px] tabular-nums text-slate-500">{timeline.length}</span>
          </div>
          <div className="scroll-fade-bottom min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
          {[...timeline].reverse().map((entry) => {
            const person = allPeople.find((candidate) => candidate.id === entry.actorId)
            const author = entry.actorLabel ?? person?.name ?? 'Workspace'
            const isCurrent = entry.id === activeId
            const isRestored = Boolean(entry.restoredFrom || entry.kind === 'rollback' || /^(restored|rolled back)/i.test(entry.label))
            return (
              <button
                key={entry.id}
                type="button"
                aria-pressed={entry.id === resolvedSelectedId}
                onClick={() => selectVersion(entry.id)}
                className={cn(
                  'flex w-full min-w-0 flex-col gap-1.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[0.045]',
                  entry.id === resolvedSelectedId && 'bg-white/[0.06]'
                )}
              >
                <span className="flex w-full min-w-0 items-start gap-2">
                  <span className={cn('mt-1 ds-status-dot shrink-0 rounded-full', isCurrent ? 'bg-emerald-300' : isRestored ? 'bg-amber-300' : 'bg-slate-600')} />
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

        <section aria-label="Checkpoint version comparison" className={cn('flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden', REVIEW_CARD)}>
          {selected ? (
          <>
            <div className="flex shrink-0 items-start gap-3 px-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-200">{selected.label}</p>
                <p className="mt-1 truncate text-[10px] text-slate-500">
                  {relativeCheckpointTime(selected.timestamp)}{historyMeta(selected, workspace?.currentUser?.id) ? ` · ${historyMeta(selected, workspace?.currentUser?.id)}` : ''}
                  {selected.snapshot?.fileId ? ` · ${workspace.getFileName(selected.snapshot.fileId)}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center rounded-full bg-white/[0.05] p-0.5" role="tablist" aria-label="Checkpoint view">
                {[
                  ['code', Code2, 'Code'],
                  ['preview', Eye, 'Preview'],
                ].map(([id, Icon, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={historyView === id}
                    onClick={() => setHistoryView(id)}
                    className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2 text-[10px] font-medium transition-colors', historyView === id ? 'bg-white/[0.1] text-white' : 'text-slate-500 hover:text-slate-200')}
                  >
                    <Icon className="size-3" />
                    <LocalizedText text={label} />
                  </button>
                ))}
              </div>
            </div>
            {historyView === 'code' ? (
              <div className="min-h-0 flex-1 overflow-auto border-t border-white/[0.05] py-1.5 font-mono text-[10px] leading-relaxed">
                {rows.length === 0 ? <p className="px-3 py-3 text-slate-500">No file snapshot is available for this checkpoint.</p> : rows.map((row, index) => (
                  <div key={`${row.kind}-${index}`} className={cn('flex min-w-0 px-3 whitespace-pre-wrap [word-break:break-all]', row.kind === 'add' ? 'bg-emerald-400/[0.08] text-emerald-300' : row.kind === 'remove' ? 'bg-red-400/[0.08] text-red-300' : 'text-slate-500')}>
                    <span className="w-4 shrink-0 select-none opacity-70">{row.kind === 'add' ? '+' : row.kind === 'remove' ? '−' : ' '}</span>
                    <span className="min-w-0 flex-1 whitespace-pre-wrap [word-break:break-all]">{row.text || ' '}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-hidden border-t border-white/[0.05]">
                <PreviewPanelContent
                  key={`history-preview-${selected.id}`}
                  previewProps={selected.snapshot.previewProps}
                  prototypeEdits={selected.snapshot.prototypeEdits}
                  activePageId={selected.snapshot.activePageId}
                  showZoomControl
                  caption={<span className="text-emerald-300">{selected.id === activeId ? 'Current checkpoint' : 'Selected checkpoint'}</span>}
                />
              </div>
            )}
            <div className="shrink-0 border-t border-white/[0.06] p-2">
              <HistoryTimeline
                compact
                entries={timeline}
                selectedId={resolvedSelectedId}
                onSelect={selectVersion}
                playing={playing}
                onTogglePlay={togglePlay}
                compareLatest={compareLatest}
                onCompareLatestChange={setCompareLatest}
                onRestore={() => selected && setRollbackId(selected.id)}
                isCurrent={selected?.id === activeId}
              />
            </div>
          </>
          ) : <p className="p-3 text-xs text-slate-500">Select a checkpoint to inspect its file snapshot.</p>}
        </section>
      </div>
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
function ConflictModal({ conflict, onOpenChange, onUpdate, onApprove, onRequestChanges, onResolve, onOpenMergeStudio, mergeActionLabel = 'Open in Merge Studio' }) {
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
    toast(next.reviewStage === 'approved' ? 'All approvals received' : 'Approved by you', {
      description: next.reviewStage === 'approved' ? 'Ready to merge.' : `Waiting on ${waiting} more reviewer${waiting === 1 ? '' : 's'}.`,
    })
  }

  // Records a reviewer's approval on their behalf (e.g. obtained outside
  // Devsign) using the same rule as their own sign-off would.
  function handleApproveReviewer(reviewerId) {
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
        <button type="button" disabled={!conflict.reviewers.length} onClick={handleRequestReview} className={REQUEST_REVIEW_BUTTON}>
          Request review
        </button>
      )
    } else if (stage === 'in_review' && myReview) {
      primary = (
        <>
          <button
            type="button"
            onClick={() => onRequestChanges?.(conflict.id)}
            className={cn('inline-flex h-8 shrink-0 items-center rounded-full px-3 text-xs font-medium whitespace-nowrap', GHOST_BUTTON)}
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
          className={cn('inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium', GHOST_BUTTON)}
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
            <div className="flex min-h-11 shrink-0 items-center justify-between gap-5 border-b border-white/[0.07] bg-white/[0.02] px-5 py-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  title="Back to list"
                  aria-label="Back to list"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">{conflict.title}</h2>
                <div className="flex shrink-0 items-center gap-2.5">
                  {severity && <SeverityPill level={severity.label} className="ds-project-severity" data-level={severity.label.toLowerCase()} />}
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
                      className={cn(
                        'inline-flex h-7 shrink-0 items-center justify-center gap-1.5 px-2 text-xs font-medium whitespace-nowrap transition-colors',
                        WORKSPACE_TAB_RADIUS,
                        tab === id
                          ? 'bg-white/[0.09] text-white'
                          : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
                      )}
                    >
                      <LocalizedText text={label} />
                    </button>
                  ))}
                </div>
              </div>

              <div className={cn('grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,3fr)_minmax(280px,1fr)] p-3', REVIEW_GUTTER)}>
                <div className="min-h-0 min-w-0 overflow-auto" role="tabpanel">
                    {tab === 'overview' && (
                      <OverviewTab conflict={conflict} />
                    )}
                    {tab === 'diff' && <DiffTab conflict={conflict} />}
                    {tab === 'history' && (
                      <HistoryCheckpointTimeline workspace={workspace} />
                    )}
                </div>

                {/* Sidebar begins level with the main content beneath the shared tab bar. */}
                <div className={cn('flex min-h-0 min-w-0 flex-col overflow-hidden', REVIEW_GUTTER)}>
                  <StatusCard conflict={conflict} />
                  <div className={cn('scroll-fade-bottom min-h-0 max-h-[40%] overflow-y-auto', REVIEW_CONTEXT_CARD)}>
                    <ReviewersSection conflict={conflict} onUpdate={update} onApproveReviewer={handleApproveReviewer} />
                  </div>
                  <div className={cn('flex min-h-0 flex-1 flex-col', REVIEW_CONTEXT_CARD)}>
                    <p className={cn(PANEL_LABEL, 'ds-review-context-heading shrink-0')}>Comments</p>
                    <CommentThread key={conflict.id} conflict={conflict} workspace={workspace} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 px-5 py-2.5">
              <div className="min-w-0 flex-1" />
              {stage !== 'resolved' && (
                <Tooltip>
                  <TooltipTrigger
                    type="button"
                    onClick={() => onOpenMergeStudio?.(conflict)}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-emerald-400/15 px-3.5 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-400/25 hover:text-emerald-200"
                  >
                    <GitMerge className="size-3.5" />
                    {mergeActionLabel}
                  </TooltipTrigger>
                  <TooltipContent side="top">Edit or combine elements before merging.</TooltipContent>
                </Tooltip>
              )}
              <div className="flex shrink-0 items-center">
                {footerNote && <span className="mr-1.5 hidden text-right text-[10px] leading-snug text-slate-400 xl:block">{footerNote}</span>}
                {primary}
              </div>
            </div>
          </>
        )}
    </div>
  )
}

export default ConflictModal
