import { Fragment, useState } from 'react'
import {
  Bell,
  Bot,
  Check,
  ChevronLeft,
  Clock3,
  GitMerge,
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
import { toast } from '@/i18n/toast'
import { useWorkspaceOptional } from '@/state/WorkspaceProvider'
import ConflictHistoryReplay from '@/components/dockview/panels/ConflictHistoryReplay'
import { SeverityPill } from '@/components/mergestudio/ConflictTag'
import {
  ACCENT_CTA,
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
  ['history', 'History'],
]

const REVIEW_INFO_GRID = 'grid min-w-0 items-start gap-x-2 gap-y-1 sm:grid-cols-[88px_minmax(0,1fr)]'
const REVIEW_GUTTER = 'gap-3'
const REVIEW_CARD = 'rounded-xl bg-white/[0.03]'
const REVIEW_CONTEXT_CARD = cn(REVIEW_CARD, 'ds-review-context')
const REVIEW_INFO_LABEL = 'text-[10px] leading-4 font-medium text-slate-500'
const REVIEW_DETAIL_COPY = 'text-xs leading-[18px] text-slate-200'

function EmptyNote({ children }) {
  return <p className="rounded-xl bg-white/[0.03] px-4 py-8 text-center text-xs text-slate-500">{children}</p>
}

function PersonAvatar({ person }) {
  return (
    <Avatar size="sm">
      <AvatarFallback className={cn('text-[10px] font-semibold text-white', person.colorClass)}>
        <LocalizedText text={person.initials} />
      </AvatarFallback>
    </Avatar>
  )
}

function PersonRole({ person, viewerId }) {
  if (!person?.role || person.id === viewerId) return null
  return (
    <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-medium text-slate-400">
      <LocalizedText text={person.role} />
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

function comparisonSources(branches) {
  if (!branches) return null
  const isDesignReference = /figma/i.test(branches.remote ?? '')
  return [
    {
      label: isDesignReference ? 'Current implementation' : 'Local branch',
      source: branches.local,
    },
    {
      label: isDesignReference ? 'Design reference' : 'Remote branch',
      source: branches.remote,
    },
  ]
}

function ComparisonSource({ label, source }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium text-slate-300"><LocalizedText text={label} /></p>
      <p className="truncate text-[10px] text-slate-500" title={source}><LocalizedText text={source} /></p>
    </div>
  )
}

// Expected (design system) vs current (code), with each source named above its values.
function ComparisonTable({ fields, sources }) {
  return (
    <div className="space-y-1.5">
      {sources && (
        <div className="grid grid-cols-2 gap-3">
          {sources.map((entry) => <ComparisonSource key={entry.label} {...entry} />)}
        </div>
      )}
      {fields.map((field) => (
        <div key={field.label} className="space-y-1.5">
          <p className="text-[11px] text-slate-500"><LocalizedText text={field.label} /></p>
          <div className="grid grid-cols-2 gap-3">
            <span className="min-w-0 rounded-lg bg-white/[0.035] px-3 py-1.5 text-xs font-medium text-red-300"><LocalizedText text={field.current} /></span>
            <span className="min-w-0 rounded-lg bg-white/[0.035] px-3 py-1.5 text-xs font-medium text-emerald-200"><LocalizedText text={field.expected} /></span>
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
  const { detectedBy, impact } = conflict
  // Older user-applied drafts stored AI as the actor; honor the recorded requester.
  const legacyRequester = conflict.changedBy?.type === 'ai' && !conflict.applicationMode
    ? allPeople.find((person) => conflict.changedBy.what?.includes(`(requested by ${person.name} in AI chat)`))
    : null
  const changedBy = legacyRequester
    ? { type: 'person', id: legacyRequester.id, what: conflict.changedBy.what.replace(/ \(requested by .* in AI chat\)$/, '') }
    : conflict.changedBy
  const primaryFile = conflict.file ? `${conflict.file}${conflict.line ? `:${conflict.line}` : ''}` : null
  const files = [...new Set([primaryFile, ...(impact?.files ?? []).filter((file) => file !== conflict.file)].filter(Boolean))]
  const impactRows = [
    ['Screens', impact?.screens],
    ['Components', impact?.components],
    ['Files', files],
  ].filter(([, list]) => list?.length)
  if (!changedBy && !detectedBy && !impactRows.length) return null

  return (
    <div className={cn(REVIEW_INFO_GRID, 'gap-y-2.5 text-[11px]', className)}>
      {changedBy && (
        <>
          <span className={REVIEW_INFO_LABEL}>Changed by</span>
          <span className="min-w-0 break-words text-[11px] leading-4 text-slate-200 [overflow-wrap:anywhere]">
            <span className="inline-flex items-center gap-1 font-medium">
              {changedBy.type === 'ai' ? <Bot className="size-3.5 text-emerald-300" /> : <User className="size-3.5 text-slate-400" />}
              <LocalizedText text={changedBy.type === 'ai' ? 'Devsign AI' : personName(changedBy.id, viewerId)} />
            </span>
            {changedBy.what && <span className="text-slate-400"> · <LocalizedText text={changedBy.what} /></span>}
          </span>
        </>
      )}
      {detectedBy && (
        <>
          <span className={REVIEW_INFO_LABEL}>Detected by</span>
          <span className="min-w-0 break-words text-[11px] leading-4 text-slate-300 [overflow-wrap:anywhere]"><LocalizedText text={detectedBy} /></span>
        </>
      )}
      {impactRows.map(([label, list]) => (
        <Fragment key={label}>
          <span className={REVIEW_INFO_LABEL}><LocalizedText text={label} /></span>
          <span className="flex min-w-0 flex-wrap gap-1">
            {list.map((item) => (
              <span
                key={item}
                className={cn('min-w-0 break-words rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[11px] leading-4 text-slate-200 [overflow-wrap:anywhere]', label === 'Files' && 'font-mono')}
              >
                <LocalizedText text={item} />
              </span>
            ))}
          </span>
        </Fragment>
      ))}
    </div>
  )
}

function OverviewTab({ conflict, severity, stage, showProject }) {
  const riskPrefix = /^(Low|Medium|High):\s*/.exec(conflict.riskReason ?? '')
  const riskExplanation = riskPrefix
    ? conflict.riskReason.slice(riskPrefix[0].length)
    : conflict.riskReason
  const summary = conflict.message || riskExplanation
  const hasMetadata = Boolean(
    conflict.changedBy ||
    conflict.detectedBy ||
    conflict.impact?.screens?.length ||
    conflict.impact?.components?.length ||
    conflict.impact?.files?.length
  )
  const severityTone = severity?.label === 'High'
    ? 'text-red-300'
    : severity?.label === 'Medium'
      ? 'text-amber-200'
      : 'text-sky-200'

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 min-w-0">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="inline-flex min-w-0 items-center gap-2 rounded-full bg-white/[0.055] px-2.5 py-1 text-[11px] font-semibold text-slate-100">
            <span className={cn('ds-status-dot shrink-0 rounded-full', STAGE_DOT_CLASS[stage])} />
            <span className="min-w-0 break-words [overflow-wrap:anywhere]"><LocalizedText text={STAGE_LABEL[stage]} /></span>
          </span>
          {conflict.reviewStage !== 'resolved' && (conflict.source === 'ai' || conflict.changedBy?.type === 'ai') && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/[0.035] px-2.5 py-1 text-[10px] font-medium text-slate-400">
              <Sparkles className="size-3 shrink-0" aria-hidden />
              <LocalizedText text="AI draft" />
            </span>
          )}
          </div>
          {severity && (
            <p className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.035] px-2.5 py-1 text-[10px]">
              <span className="text-slate-500"><LocalizedText text="Severity" /></span>
              <span className={cn('font-semibold', severityTone)}><LocalizedText text={severity.label} /></span>
            </p>
          )}
        </div>
        {((showProject && conflict.projectName) || conflict.detectedAt) && (
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
            {showProject && conflict.projectName && (
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                <LocalizedText text="Project" /> · <LocalizedText text={conflict.projectName} />
              </span>
            )}
            {conflict.detectedAt && (
              <span className="inline-flex items-center gap-1">
                <Clock3 className="size-3 shrink-0" />
                <LocalizedText text="Detected" /> · <LocalizedText text={conflict.detectedAt} />
              </span>
            )}
          </div>
        )}
      </div>
      {conflict.reviewStage === 'resolved' && (
        <p className="flex items-center gap-1.5 rounded-xl bg-emerald-400/[0.06] px-4 py-2.5 text-xs text-emerald-200">
          <Check className="size-3.5" strokeWidth={2.5} />
          Merged — the code now matches the proposed change. Values below are as they were before the merge.
        </p>
      )}
      {(summary || hasMetadata) && (
        <section className="min-w-0 flex-1">
          {summary && (
            <div className={REVIEW_INFO_GRID}>
              <p className={REVIEW_INFO_LABEL}>Summary</p>
              <p className={cn(REVIEW_DETAIL_COPY, 'min-w-0 break-words [overflow-wrap:anywhere] font-medium')}><LocalizedText text={summary} /></p>
            </div>
          )}
          <Provenance
            conflict={conflict}
            className={cn(summary && hasMetadata && 'mt-4 border-t border-white/[0.08] pt-4')}
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
    <div className="min-w-0 space-y-2">
      {/* Its own row, not a leading column beside the diff — a column
          there pushed the whole grid-cols-2 diff right of where the
          comparison cards above it start, so the two never lined up. */}
      <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
        <Sparkles className="size-3 shrink-0 text-emerald-300" />
        <LocalizedText text="AI suggestion" />
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-3">
        {columns.map((column) => (
          <div key={column.id} role="group" aria-label={`${column.label} code`} className="scroll-fade-bottom min-w-0 overflow-auto font-mono text-[11px] leading-relaxed">
            <span className="sr-only">{column.label}</span>
            {rows.filter((row) => column.kinds.has(row.kind)).map((row, index) => (
              <div key={`${row.kind}-${index}`} className="flex min-w-0 whitespace-pre-wrap [word-break:break-all]">
                <span className="w-3.5 shrink-0 opacity-70 select-none">{DIFF_MARKS[row.kind]}</span>
                <span className={cn(
                  'min-w-0 flex-1 whitespace-pre-wrap [word-break:break-all]',
                  DIFF_TONES[row.kind],
                  row.kind !== 'same' && 'box-decoration-clone px-1'
                )}>{row.text || ' '}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// The proposed change as an inline diff — review only. Nothing here is
// applied: the fix reaches the workspace when the change is merged.
function DiffTab({ conflict }) {
  if (!conflict.branches && !conflict.diff && !conflict.suggestion && !conflict.preview && !conflict.comparisonFields?.length) {
    return (
      <div className="h-full">
        <EmptyNote>No diff captured for this conflict yet.</EmptyNote>
      </div>
    )
  }
  const rows = conflict.diff ? diffLines(conflict.diff.before ?? [], conflict.diff.after ?? []) : []
  const pairedPreview = conflict.preview && conflict.preview.kind !== 'divider' && conflict.comparisonFields?.length > 0
  const sources = comparisonSources(conflict.branches)

  return (
    <div className="flex h-full flex-col">
      {(conflict.preview || conflict.comparisonFields?.length > 0 || conflict.diff || conflict.suggestion) && (
        <section className="min-w-0 flex-1">
          <div className="flex flex-col gap-3">
            {pairedPreview ? (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { side: 'before', source: sources?.[0], tone: 'text-red-300', value: (field) => field.current },
                  { side: 'after', source: sources?.[1], tone: 'text-emerald-200', value: (field) => field.expected },
                ].map(({ side, source, tone, value }) => (
                  <div key={side} className="flex min-w-0 flex-col gap-2 rounded-lg bg-white/[0.025] p-3">
                    {source && <ComparisonSource {...source} />}
                    <ChangePreview preview={conflict.preview} side={side} showLabels={false} />
                    <dl className="mt-1 min-w-0 space-y-1.5">
                      {conflict.comparisonFields.map((field) => (
                        <div key={field.label} className="flex min-w-0 items-center justify-between gap-2 border-t border-white/[0.06] pt-1.5 text-xs">
                          <dt className="min-w-0 truncate text-[10px] text-slate-500"><LocalizedText text={field.label} /></dt>
                          <dd className={cn('shrink-0 font-medium', tone)}><LocalizedText text={value(field)} /></dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            ) : conflict.preview && (
              <div className="min-w-0">
                {conflict.preview.kind === 'divider' && sources && (
                  <div className="mb-2 grid min-w-0 grid-cols-[minmax(48px,88px)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3">
                    <span />
                    {sources.map((entry) => <ComparisonSource key={entry.label} {...entry} />)}
                  </div>
                )}
                <ChangePreview preview={conflict.preview} />
              </div>
            )}
            {!pairedPreview && conflict.comparisonFields?.length > 0 && (
              <div className="min-w-0">
                {conflict.preview?.kind === 'divider' ? (
                  <div className="space-y-1.5">
                    {conflict.comparisonFields.map((field) => (
                      <div key={field.label} className="grid min-w-0 grid-cols-[minmax(48px,88px)_minmax(0,1fr)] items-center gap-3">
                        <span className="text-[11px] text-slate-400"><LocalizedText text={field.label} /></span>
                        <div className="grid min-w-0 grid-cols-2 gap-3">
                          <span className="min-w-0 truncate rounded-lg bg-white/[0.035] px-3 py-1.5 text-xs font-medium text-red-300" title={field.current}><LocalizedText text={field.current} /></span>
                          <span className="min-w-0 truncate rounded-lg bg-white/[0.035] px-3 py-1.5 text-xs font-medium text-emerald-200" title={field.expected}><LocalizedText text={field.expected} /></span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ComparisonTable fields={conflict.comparisonFields} sources={sources} />
                )}
              </div>
            )}
            {!pairedPreview && !conflict.comparisonFields?.length && sources && (
              <div className="grid grid-cols-2 gap-3">
                {sources.map((entry) => <ComparisonSource key={entry.label} {...entry} />)}
              </div>
            )}
            {conflict.diff && (
              <div className="min-w-0 border-t border-white/[0.06] pt-3">
                <CodeDiffColumns rows={rows} />
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
// reviewers ("Approved by you", "Waiting for Alex", "All required approvals
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
function ReviewersSection({ conflict, onUpdate }) {
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
            <DropdownMenuTrigger className="flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-medium text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white">
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
        <p className="text-[11px] leading-4 text-slate-500">No reviewers assigned</p>
      ) : (
        <div className="space-y-1">
          {reviewers.map((reviewer) => {
            const person = allPeople.find((p) => p.id === reviewer.id)
            if (!person) return null
            const status = REVIEWER_STATUS[reviewer.status] ?? REVIEWER_STATUS.pending
            return (
              <div key={reviewer.id} className="group/rev grid h-9 grid-cols-[minmax(0,1fr)_112px_72px] items-center gap-1 rounded-lg text-xs hover:bg-white/[0.03]">
                <div className="flex min-w-0 items-center gap-2.5">
                  <PersonAvatar person={person} />
                  <span className="min-w-0 truncate font-medium text-slate-200">
                    {person.name}
                    {person.id === viewerId && <span className="font-normal text-slate-500"> (you)</span>}
                  </span>
                </div>
                <span className={cn('w-28 truncate text-right text-[11px]', status.className)}>
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
        {comments.length === 0 && <p className="text-[11px] leading-4 text-slate-500">No comments yet</p>}
        {comments.map((comment) => {
          const author = allPeople.find((p) => p.id === comment.authorId)
          const replies = linked.filter((reply) => reply.target?.replyTo === comment.id)
          return (
            <div key={comment.id} className="space-y-2 text-xs">
              <div className="flex gap-2.5">
                {author && <PersonAvatar person={author} />}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-slate-200"><LocalizedText text={author?.name ?? ''} /></span>
                    <PersonRole person={author} viewerId={viewerId} />
                    <span className="text-[11px] text-slate-500"><LocalizedText text={comment.timeLabel} /></span>
                  </p>
                  <p className="mt-0.5 leading-relaxed text-slate-300"><LocalizedText text={comment.text} /></p>
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
                            <span className="font-medium text-slate-200"><LocalizedText text={replyAuthor?.name ?? ''} /></span>
                            <PersonRole person={replyAuthor} viewerId={viewerId} />
                            <span className="text-[11px] text-slate-500"><LocalizedText text={reply.timeLabel} /></span>
                          </p>
                          <p className="mt-0.5 leading-relaxed text-slate-300"><LocalizedText text={reply.text} /></p>
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

// ─── Inline review view ────────────────────────────────────────────────
//
// `onUpdate(id, patch)` applies review edits (stage, reviewers) to
// wherever the conflict lives; `onApprove(id)` / `onRequestChanges(id)` are
// your own sign-off (approving never changes code); `onResolve(id)` merges
// an Approved conflict — the only step that applies the change.
function ConflictModal({ conflict, onOpenChange, onUpdate, onApprove, onRequestChanges, onResolve, onRevert, onOpenMergeStudio, mergeActionLabel = 'Open in Merge Studio' }) {
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
    if (value === 'overview' && !conflict.diffInspected && conflict.reviewStage !== 'resolved') {
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

  function handleMerge() {
    if (onResolve) onResolve(conflict.id)
    else update({ reviewStage: 'resolved' })
  }

  function handleRevert() {
    if (onRevert) onRevert(conflict.id)
    else update({
      reviewStage: 'detected',
      diffInspected: false,
      reviewers: conflict.reviewers.map((r) => ({ ...r, status: 'pending' })),
    })
  }

  const detailTabs = (
    <div className="flex shrink-0 items-center gap-7 border-b border-white/[0.07]" role="tablist" aria-label="Conflict details">
      {TABS.map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          onClick={() => openTab(id)}
          className={cn(
            'relative -mb-px inline-flex h-9 shrink-0 items-center border-b-2 px-2 text-xs font-medium whitespace-nowrap transition-colors',
            tab === id
              ? 'border-emerald-300 text-white'
              : 'border-transparent text-slate-500 hover:text-slate-200'
          )}
        >
          <LocalizedText text={label} />
        </button>
      ))}
    </div>
  )

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
          onClick={handleRevert}
          className={cn('inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium', GHOST_BUTTON)}
        >
          <RotateCcw className="size-3.5" />
          Revert
        </button>
      )
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-card">
        {conflict && (
          <>
            <div className="flex h-11 shrink-0 items-center gap-3 bg-[#121212] px-2.5">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  title="Back to list"
                  aria-label="Back to list"
                  className="flex size-6 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <h2 className="min-w-0 truncate text-[13px] font-semibold text-white">
                  <LocalizedText text={conflict.title} />
                </h2>
                <span className="shrink-0 font-mono text-[10px] font-medium text-slate-500">#{conflict.id}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {primary}
              </div>
              {stage !== 'resolved' && (
                <div className="flex shrink-0 items-center gap-2 border-l border-white/[0.08] pl-2.5">
                  <Tooltip>
                    <TooltipTrigger
                      type="button"
                      onClick={() => onOpenMergeStudio?.(conflict)}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-slate-200"
                    >
                      <GitMerge className="size-3.5" />
                      {mergeActionLabel}
                    </TooltipTrigger>
                    <TooltipContent side="top">Review merge impact and automated checks. This does not approve or merge the change.</TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto px-3 pt-0 pb-3">
              <div className="shrink-0 px-1">
                {detailTabs}
              </div>
              <div className={cn(
                'grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-auto pt-2 xl:grid-cols-[minmax(0,1fr)_360px] xl:overflow-auto',
                REVIEW_GUTTER
              )}>
                <div className="flex min-h-0 min-w-0 flex-col overflow-auto" role="tabpanel">
                  {tab === 'overview' ? (
                    <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 items-stretch gap-3 xl:flex xl:items-stretch">
                      <section className={cn('flex min-w-0 flex-col overflow-hidden p-3', REVIEW_CARD, 'xl:w-[38%] xl:min-w-[190px] xl:max-w-[360px] xl:shrink-0')}>
                        <div className="min-h-0 min-w-0 flex-1 overflow-auto">
                          <OverviewTab conflict={conflict} severity={severity} stage={stage} showProject={!workspace} />
                        </div>
                      </section>
                      <section className={cn('flex min-w-0 flex-col overflow-hidden p-3', REVIEW_CARD, 'xl:flex-1')}>
                        <div className="min-h-0 min-w-0 flex-1 overflow-auto">
                          <DiffTab conflict={conflict} />
                        </div>
                      </section>
                    </div>
                  ) : (
                    <div className="flex min-h-0 flex-1">
                      <ConflictHistoryReplay conflict={conflict} workspace={workspace} />
                    </div>
                  )}
                </div>

                {/* All three review columns now start beneath the shared tab row. */}
                <div className={cn('flex h-full min-h-0 min-w-0 flex-col overflow-hidden', REVIEW_GUTTER)}>
                  <div className={cn('min-h-0 max-h-[48%] shrink-0 overflow-y-auto', REVIEW_CONTEXT_CARD)}>
                    <ReviewersSection conflict={conflict} onUpdate={update} />
                  </div>
                  <div className={cn('flex min-h-0 flex-1 flex-col', REVIEW_CONTEXT_CARD)}>
                    <p className={cn(PANEL_LABEL, 'ds-review-context-heading shrink-0')}>
                      <LocalizedText text="Comments" />
                    </p>
                    <CommentThread key={conflict.id} conflict={conflict} workspace={workspace} />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
    </div>
  )
}

export default ConflictModal
