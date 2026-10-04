import { BranchInfo, ReviewStageBadge } from '@/components/conflicts/ConflictBadges'
import CheckStatus from '@/components/mergestudio/CheckStatus'
import { Fragment, useEffect, useRef, useState } from 'react'
import {
  ArrowUpRight,
  Ban,
  Bell,
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  Clock3,
  GitMerge,
  Layers3,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  User,
  X,
} from 'lucide-react'
import { cn } from 'cn'
import { LocalizedText } from '@/i18n/runtime'
import { translateText } from '@/i18n/translate'
import { getLanguage } from '@/i18n/language'

// Text fields skip the JSX translation pass (what's typed is the user's),
// so their placeholders are translated here.
const tr = (text) => translateText(text, getLanguage())
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { allPeople, currentUserFor } from '@/data/mockData'
import { draftColumns, draftRows, driftRowsFor } from '@/lib/driftDecisions'
import {
  approvalStatus,
  requiredReviewers,
  authorOf,
} from '@/lib/conflicts'
import ChangePreview from '@/components/conflicts/ChangePreview'
import { diffLines } from '@/lib/lineDiff'
import { toast } from '@/i18n/toast'
import { useWorkspaceOptional } from '@/state/WorkspaceProvider'
import ConflictHistoryReplay from '@/components/dockview/panels/ConflictHistoryReplay'
import { openOrFocusPanel, panelById } from '@/components/dockview/dockPanels'
import ConflictCodeView, { placeChange } from '@/components/conflicts/ConflictCodeView'
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
// 20px radius, borderless content on a 20px inset, plain text tabs,
// sentence-case group labels and the single mint accent. One level of
// cards only: inside them, hierarchy comes from type and color, with
// spacing instead of rules. What to do next lives in one place — the
// single primary action in the header.

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

const REVIEW_INFO_GRID = 'grid min-w-0 items-start gap-x-3 gap-y-1 sm:grid-cols-[68px_minmax(0,1fr)]'
const REVIEW_GUTTER = 'gap-3'
const REVIEW_CARD = 'rounded-xl bg-white/[0.03]'
const REVIEW_CONTEXT_CARD = cn(REVIEW_CARD, 'ds-review-context')
const REVIEW_INFO_LABEL = 'text-[10px] leading-4 font-medium text-slate-500'
const REVIEW_DETAIL_COPY = 'text-xs leading-[18px] text-slate-200'

function EmptyNote({ children }) {
  return <p className="rounded-xl bg-white/[0.03] px-4 py-8 text-center text-xs text-slate-500">{children}</p>
}

// 20px — the same size as the header's presence avatars.
function PersonAvatar({ person }) {
  return (
    <Avatar size="xs">
      <AvatarFallback className={cn('font-semibold text-white', person.colorClass)}>
        <LocalizedText text={person.initials} />
      </AvatarFallback>
    </Avatar>
  )
}

function PersonRole({ person, viewerId }) {
  if (!person?.role || person.id === viewerId) return null
  return (
    <span className="text-[10px] text-slate-500">
      <LocalizedText text={person.role} />
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
            <span className="min-w-0 text-xs font-medium text-red-300"><LocalizedText text={field.current} /></span>
            <span className="min-w-0 text-xs font-medium text-emerald-200"><LocalizedText text={field.expected} /></span>
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
          <span className="min-w-0 text-[11px] leading-4 text-slate-200">
            {list.map((item, i) => (
              <span
                key={item}
                className={cn('break-words [overflow-wrap:anywhere]', label === 'Files' && 'font-mono text-[10.5px] text-slate-300')}
              >
                {i > 0 && <span className="font-sans text-slate-500">, </span>}
                <LocalizedText text={item} />
              </span>
            ))}
          </span>
        </Fragment>
      ))}
    </div>
  )
}

// A change's checks, as a status: they run on their own (see
// mergeChecks), so this only reports — all passing, or which need
// attention and why. Blocking ones (they keep it from merging) say so.
// The conflict's drifts as one decision each: ship the design's value or
// keep the code's (or, for an item with several drafts, any draft's) — the
// first thing to settle before asking for review. Shared with Merge Studio
// (WorkspaceProvider's decisionsFor / decideDrift), so a pick made here or
// on the canvas is the same pick. Undecided values keep the code.
function driftItemOf(conflict, workspace) {
  if (!workspace?.decisionsFor) return null
  const item = workspace.mergeItems?.find((m) => m.id === conflict.mergeItemId || m.conflictId === conflict.id)
  return item && driftRowsFor(conflict, item).length ? item : null
}

// Several drafts: what the mix takes from where — a row per part (a screen
// region, or an element's value) naming the draft it comes from. Picking
// is design work, so it's Merge Studio's: there each row also offers every
// draft to switch to, beside the canvas. Elsewhere the list only reports,
// and its action opens the drafts side by side in Merge Studio.
function DraftTable({ conflict, workspace, item, editable, onCompare, compareLabel }) {
  const decisions = workspace.decisionsFor(item.id)
  const rows = draftRows(conflict, item, decisions)
  const decided = rows.filter((row) => row.decided).length
  const decide = (row, option) => workspace.decideDrift(item.id, row.key, option.picked ? null : option.decision)
  const Letter = ({ option, on }) => (
    <span className={cn('flex size-4 shrink-0 items-center justify-center rounded text-[9.5px] font-semibold', on ? 'bg-emerald-300 text-slate-950' : 'bg-white/[0.08] text-slate-300')}>{option.letter}</span>
  )
  const Value = ({ option }) => (
    <span className="truncate" {...(option.literal && { translate: 'no' })}>{option.literal ? option.value : <LocalizedText text={option.value} />}</span>
  )

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="mb-3 flex items-center gap-2">
        <p className="text-xs font-medium text-slate-200"><LocalizedText text={rows[0]?.region ? 'Mix of drafts' : 'Values from drafts'} /></p>
        <span className={cn('text-[11px] tabular-nums', decided === rows.length ? 'text-emerald-300' : 'text-slate-500')}>
          <LocalizedText text={decided === rows.length ? 'All picked' : `${decided} of ${rows.length} picked`} />
        </span>
        {onCompare && (
          <button
            type="button"
            onClick={onCompare}
            className="ds-intrinsic ml-auto inline-flex h-7 items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 text-xs font-medium text-emerald-200 ring-1 ring-emerald-400/40 ring-inset transition-colors hover:bg-emerald-400/15"
          >
            <Layers3 className="size-3.5" />
            <LocalizedText text={compareLabel} />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 divide-y divide-white/[0.05] overflow-auto">
        {rows.map((row) => {
          const picked = row.options.find((option) => option.picked)
          return (
            <div key={row.key} className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 py-2">
              <span className="truncate text-[11.5px] text-slate-400">
                {row.element && <><LocalizedText text={row.element} /> · </>}
                <LocalizedText text={row.label} />
              </span>
              {editable ? (
                <div className="flex min-w-0 flex-wrap gap-1">
                  {row.options.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      aria-pressed={option.picked}
                      title={option.name}
                      onClick={() => decide(row, option)}
                      className={cn(
                        'ds-intrinsic inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-md px-2 text-[11.5px] transition-colors',
                        option.picked ? 'bg-emerald-400/15 text-emerald-100 ring-1 ring-emerald-400/50 ring-inset' : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.09] hover:text-white'
                      )}
                    >
                      <Letter option={option} on={option.picked} />
                      <Value option={option} />
                    </button>
                  ))}
                </div>
              ) : picked ? (
                <span className="flex min-w-0 items-center gap-2 text-xs text-slate-100">
                  <Letter option={picked} on />
                  <Value option={picked} />
                  <span className="shrink-0 text-[11px] text-slate-500"><LocalizedText text={`from ${picked.name}`} /></span>
                </span>
              ) : (
                <span className="text-[11.5px] text-slate-500"><LocalizedText text="Not picked — keeps the code" /></span>
              )}
            </div>
          )
        })}
      </div>
      {!editable && (
        <p className="mt-2 text-[10.5px] text-slate-500"><LocalizedText text="Drafts are compared and mixed in Merge Studio — this shows what’s picked." /></p>
      )}
    </div>
  )
}

function OverviewTab({ conflict, severity, stage, showProject, checks, onFixCheck }) {
  const [showDetails, setShowDetails] = useState(false)
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

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 min-w-0">
        {/* Stage · severity · AI draft on the left, when it was detected on
            the right — one line, the card's header. */}
        <div className="flex min-w-0 items-center gap-3">
          <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-slate-500">
            <ReviewStageBadge stage={stage} />
            {severity && (
              <>
                <span aria-hidden>·</span>
                <SeverityPill level={severity.label} />
              </>
            )}
            {conflict.reviewStage !== 'resolved' && (conflict.source === 'ai' || conflict.changedBy?.type === 'ai') && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <Sparkles className="size-3 shrink-0" aria-hidden />
                  <LocalizedText text="AI draft" />
                </span>
              </>
            )}
          </p>
          {conflict.detectedAt && (
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-slate-500" title="Detected">
              <Clock3 className="size-3 shrink-0" />
              <LocalizedText text={conflict.detectedAt} />
            </span>
          )}
        </div>
        {showProject && conflict.projectName && (
          <p className="mt-1.5 min-w-0 break-words text-[11px] text-slate-500 [overflow-wrap:anywhere]">
            <LocalizedText text="Project" /> · <LocalizedText text={conflict.projectName} />
          </p>
        )}
      </div>
      {/* The stage line above already says Merged — this only notes what
          the values below are, as one quiet line, not a banner. */}
      {conflict.reviewStage === 'resolved' && (
        <p className="mb-4 flex items-center gap-1.5 text-[11px] leading-4 text-slate-400">
          <Check className="size-3 shrink-0 text-emerald-300" strokeWidth={2.5} />
          Values below are from before the merge.
        </p>
      )}
      <div className={cn(REVIEW_INFO_GRID, 'mb-4')}>
        <p className={REVIEW_INFO_LABEL}>Branch</p>
        <BranchInfo conflict={conflict} />
      </div>
      {checks && stage !== 'resolved' && (
        <div className={cn(REVIEW_INFO_GRID, 'mb-4')}>
          <p className={cn(REVIEW_INFO_LABEL, 'sm:pt-1')}>Checks</p>
          <CheckStatus checks={checks} onFix={onFixCheck} />
        </div>
      )}
      {(summary || hasMetadata) && (
        <section className="min-w-0 flex-1">
          {summary && (
            <div className={REVIEW_INFO_GRID}>
              <p className={REVIEW_INFO_LABEL}>Summary</p>
              <p className={cn(REVIEW_DETAIL_COPY, 'min-w-0 break-words [overflow-wrap:anywhere] font-medium')}><LocalizedText text={summary} /></p>
            </div>
          )}
          {/* Who changed it, what found it, what it touches — useful, but
              not what you act on, so folded under one quiet toggle. */}
          {hasMetadata && (
            <div className={cn(summary && 'mt-3')}>
              {/* In the label column, like Reviewers / Checks / Summary above. */}
              <button
                type="button"
                aria-expanded={showDetails}
                onClick={() => setShowDetails((v) => !v)}
                className={cn(REVIEW_INFO_LABEL, 'ds-intrinsic inline-flex h-6 w-fit items-center gap-1 transition-colors hover:text-white')}
              >
                <LocalizedText text={showDetails ? 'Hide details' : 'Details'} />
                <ChevronDown className={cn('size-3 transition-transform', showDetails && 'rotate-180')} />
              </button>
            </div>
          )}
          {showDetails && (
            <Provenance
              conflict={conflict}
              className="mt-2"
            />
          )}
        </section>
      )}
    </div>
  )
}

const DIFF_TONES = {
  same: 'text-slate-400',
  add: 'bg-emerald-500/[0.18] text-emerald-300',
  remove: 'bg-red-500/[0.18] text-red-300',
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

// The proposed change. Its code shows in its file (`code`, see
// ConflictCodeView) — editable, and what merging applies — or, when the
// change can't be placed in the file, as the plain Before / After snippet.
// Nothing reaches the workspace before the change is merged.
function DiffTab({ conflict, code, studioAction, workspace, item }) {
  const decisionRows = item ? driftRowsFor(conflict, item).filter(row => row.diff) : []
  const decisions = item ? workspace.decisionsFor(item.id) : {}
  const readOnly = conflict.reviewStage === 'resolved'
  const canPick = decisionRows.length > 0 && !readOnly
  const picked = decision => decisionRows.length > 0 && decisionRows.every(row => decisions[row.key] === decision)
  function pick(decision) {
    if (!canPick) return
    decisionRows.forEach(row => workspace.decideDrift(item.id, row.key, decision))
  }
  if (!conflict.branches && !conflict.diff && !conflict.suggestion && !conflict.preview && !conflict.comparisonFields?.length) {
    return (
      <div className="h-full">
        <EmptyNote>No diff captured for this conflict yet.</EmptyNote>
      </div>
    )
  }
  const rows = conflict.diff ? diffLines(conflict.diff.before ?? [], conflict.diff.after ?? []) : []
  const pairedPreview = Boolean(conflict.comparisonFields?.length)
  const sources = comparisonSources(conflict.branches)

  return (
    <div className="flex h-full flex-col">
      {/* Going to work on it, not a decision: a secondary button by the
          comparison it's about — clearly a button, but quieter than the
          header's one primary action. `emphasize` (the change is approved
          and this is the next step) gives it the mint outline. Not shown
          inside Merge Studio — the canvas is already right there. */}
      {studioAction && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            title="Adjust the design in Merge Studio. This doesn't approve or merge the change."
            onClick={studioAction.onClick}
            className={cn(
              'ds-intrinsic inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
              studioAction.emphasize
                ? 'bg-emerald-400/10 text-emerald-200 ring-1 ring-emerald-400/50 ring-inset hover:bg-emerald-400/15'
                : 'bg-white/[0.05] text-slate-200 hover:bg-white/[0.09] hover:text-white'
            )}
          >
            <GitMerge className="size-3.5" />
            <LocalizedText text={studioAction.label} />
            <ArrowUpRight className="size-3.5 opacity-70" />
          </button>
        </div>
      )}
      {(conflict.preview || conflict.comparisonFields?.length > 0 || conflict.diff || conflict.suggestion) && (
        <section className="min-w-0 flex-1">
          <div className="flex flex-col gap-3">
            {pairedPreview ? (
              <div role="radiogroup" aria-label="적용할 버전 선택" className="grid grid-cols-2 gap-2">
                {[
                  { side: 'before', decision: 'B', source: sources?.[0], tone: 'text-red-300', value: (field) => field.current },
                  { side: 'after', decision: 'A', source: sources?.[1], tone: 'text-emerald-200', value: (field) => field.expected },
                ].map(({ side, decision, source, tone, value }) => (
                  // Each side keeps one soft surface so its source, preview and
                  // values read as a group; the values inside stay plain text.
                  <div key={side}
                    onClick={() => pick(decision)}
                    data-side={side}
                    className={cn('flex min-w-0 flex-col gap-2 rounded-xl border p-3 transition-colors focus-visible:outline-2 focus-visible:outline-emerald-300', picked(decision) ? 'border-emerald-300 bg-emerald-400/10' : 'border-white/10 bg-white/[0.03]', canPick && 'cursor-pointer hover:border-emerald-300/60')}>
                    {source && <ComparisonSource {...source} />}
                    <ChangePreview preview={conflict.preview} side={side} showLabels={false} />
                    <dl className="mt-1 min-w-0 space-y-1.5">
                      {conflict.comparisonFields.map((field) => (
                        <div key={field.label} className="flex min-w-0 items-center justify-between gap-2 text-xs">
                          <dt className="min-w-0 truncate text-[10px] text-slate-500"><LocalizedText text={field.label} /></dt>
                          <dd className={cn('shrink-0 font-medium', tone)}><LocalizedText text={value(field)} /></dd>
                        </div>
                      ))}
                    </dl>
                    <button type="button" role="radio" aria-checked={picked(decision)} disabled={!canPick}
                      onClick={event => { event.stopPropagation(); pick(decision) }}
                      className={cn('mt-2 flex h-8 w-full items-center justify-center gap-2 rounded-md text-xs font-medium transition-colors disabled:cursor-default', picked(decision) ? 'bg-emerald-300 text-slate-950' : 'bg-white/[0.07] text-slate-200 hover:bg-white/[0.12]')}>
                      {picked(decision) && <Check className="size-3.5" />}
                      {picked(decision) ? '이 내용으로 합치기 · 선택됨' : readOnly ? '미선택' : side === 'before' ? '현재 구현으로 합치기' : '디자인 기준으로 합치기'}
                    </button>
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
                          <span className="min-w-0 truncate text-xs font-medium text-red-300" title={field.current}><LocalizedText text={field.current} /></span>
                          <span className="min-w-0 truncate text-xs font-medium text-emerald-200" title={field.expected}><LocalizedText text={field.expected} /></span>
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
              <div className="min-w-0 pt-2">
                {code ? <ConflictCodeView {...code} /> : <CodeDiffColumns rows={rows} />}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

// ─── Right: the review ─────────────────────────────────────────────────

const PRIMARY_BUTTON = cn(
  'inline-flex h-8 shrink-0 items-center rounded-full px-4 text-xs font-semibold whitespace-nowrap',
  ACCENT_CTA,
  'disabled:bg-white/[0.06] disabled:text-slate-500 disabled:shadow-none'
)
const REQUEST_REVIEW_BUTTON = 'inline-flex h-8 shrink-0 items-center rounded-full px-4 text-xs font-medium whitespace-nowrap ds-review-cta disabled:opacity-45'

const REVIEWER_TEXT_ACTION = 'ds-intrinsic inline-flex h-6 items-center gap-1 text-[10.5px] text-slate-500 transition-colors hover:text-white data-[popup-open]:text-white'

const iconActionClass =
  'ds-intrinsic flex size-6 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/[0.08] hover:text-white'

// Reviewers sign off here. Assigning is open until the conflict is
// resolved — a new reviewer on an Approved conflict sends it back to In
// Review, since everyone has to sign off; removing is open before review
// starts, and in review for anyone who hasn't approved (never the last
// one). Your own sign-off is the window's primary action (Approve change /
// Request changes); everyone else's status is just shown, and anyone still
// pending can be reminded.
function ReviewersSection({ conflict, onUpdate, onDismiss }) {
  const viewerId = currentUserFor(conflict.projectId).id
  // The change request being dismissed (its reviewer id) and the reason.
  const [dismissing, setDismissing] = useState(null)
  const [reason, setReason] = useState('')
  const { reviewers, reviewStage } = conflict
  // The author can't review their own change, so they're never offered.
  const author = authorOf(conflict)
  const assignable = allPeople.filter((p) => !reviewers.some((r) => r.id === p.id) && p.id !== author)
  const pending = reviewers.filter((r) => r.status !== 'approved' && r.id !== viewerId && r.id !== authorOf(conflict))
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

  // Only someone who hasn't reviewed yet can be taken off — a change
  // request or an approval is a decision, not a slot to clear. Undo for a
  // few seconds, in case the X was hit by accident.
  function removeReviewer(reviewer, name) {
    const before = reviewers
    setReviewers(reviewers.filter((r) => r.id !== reviewer.id))
    toast(`Removed ${name} as a reviewer`, {
      description: conflict.title,
      action: { label: 'Undo', onClick: () => onUpdate({ reviewers: before }) },
    })
  }

  function confirmDismiss() {
    if (!reason.trim()) return
    onDismiss(conflict.id, dismissing, reason)
    setDismissing(null)
    setReason('')
  }

  function remind(ids) {
    const stamp = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    setReviewers(reviewers.map((r) => (ids.includes(r.id) ? { ...r, remindedAt: stamp, reminderRequestedAt: Date.now() } : r)), reviewStage === 'detected' ? { reviewStage: 'in_review', requestedBy: viewerId } : {})
    const names = ids.map((id) => allPeople.find((p) => p.id === id)?.name).filter(Boolean)
    toast(`Reminder sent to ${names.join(', ')}`, { description: conflict.title })
  }

  // Compact, for the overview's label grid (the "Reviewers" label sits in
  // the grid's own label column): one short row per reviewer — avatar,
  // name, status — with its actions on hover, and Add reviewer / Remind all as
  // quiet text actions underneath.
  return (
    <div className="min-w-0">
      {reviewers.length === 0 ? (
        <p className="py-1.5 text-[11px] leading-4 text-slate-500">No reviewers yet</p>
      ) : (
        <div>
          {reviewers.map((reviewer) => {
            const person = allPeople.find((p) => p.id === reviewer.id)
            if (!person) return null
            const status = REVIEWER_STATUS[reviewer.status] ?? REVIEWER_STATUS.pending
            return (
              <Fragment key={reviewer.id}>
              <div className="group/rev -mx-1 flex h-7 min-w-0 items-center gap-2 rounded-md px-1 text-xs hover:bg-white/[0.03]">
                <PersonAvatar person={person} />
                <span className="min-w-0 flex-1 truncate font-medium text-slate-200">
                  {person.name}
                  {person.id === viewerId && <span className="font-normal text-slate-500"> (you)</span>}
                </span>
                <span className={cn('shrink-0 truncate text-[10.5px]', reviewer.id === author ? 'text-slate-500' : status.className)}>
                  {reviewer.id === author
                    ? 'Author'
                    : reviewer.status === 'pending' && reviewer.dismissedAt
                    ? 'Request dismissed'
                    : reviewer.status !== 'approved' && reviewer.remindedAt ? `Reminded ${reviewer.remindedAt}` : status.label}
                </span>
                {/* A fixed slot (room for two actions) on every row, so the
                    statuses line up whether or not a row has actions. */}
                <div className="flex w-12 shrink-0 items-center justify-end opacity-0 transition-opacity group-hover/rev:opacity-100 focus-within:opacity-100 has-[[aria-expanded=true]]:opacity-100">
                  {canRemind && reviewer.status !== 'approved' && reviewer.id !== viewerId && reviewer.id !== author && (
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
                  {reviewer.status === 'changes_requested' && reviewStage === 'in_review' && onDismiss && reviewer.id !== viewerId && (
                    <button
                      type="button"
                      aria-label={`Dismiss ${person.name}'s change request`}
                      title="Dismiss change request…"
                      aria-expanded={dismissing === reviewer.id}
                      onClick={() => { setDismissing(dismissing === reviewer.id ? null : reviewer.id); setReason('') }}
                      className={iconActionClass}
                    >
                      <Ban className="size-3.5" />
                    </button>
                  )}
                  {reviewer.status === 'pending' &&
                    (reviewStage === 'detected' || (reviewStage === 'in_review' && reviewers.length > 1)) && (
                    <button
                      type="button"
                      aria-label={`Remove ${person.name}`}
                      title="Remove reviewer"
                      onClick={() => removeReviewer(reviewer, person.name)}
                      className={iconActionClass}
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {dismissing === reviewer.id && (
                // Dismissing a change request needs a reason: it's posted to
                // Comments and logged in History, and the reviewer stays on
                // the change (back to pending).
                <div className="mb-1 space-y-1.5 rounded-lg bg-white/[0.03] p-2">
                  <textarea
                    autoFocus
                    rows={2}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setDismissing(null)
                      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); confirmDismiss() }
                    }}
                    placeholder={tr(`Why dismiss ${person.name}'s request? (required)`)}
                    className="block w-full resize-none bg-transparent text-xs leading-5 text-white outline-none placeholder:text-slate-500"
                  />
                  <div className="flex items-center justify-end gap-1">
                    <button type="button" onClick={() => setDismissing(null)} className="h-7 rounded-md px-2.5 text-xs text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white">
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!reason.trim()}
                      onClick={confirmDismiss}
                      className="h-7 rounded-md bg-amber-400/15 px-2.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-400/25 disabled:opacity-40"
                    >
                      Dismiss request
                    </button>
                  </div>
                </div>
              )}
              </Fragment>
            )
          })}
        </div>
      )}
      {(canRemind && pending.length > 1) || (reviewStage !== 'resolved' && assignable.length > 0) ? (
        <div className="mt-0.5 flex items-center gap-3">
          {reviewStage !== 'resolved' && assignable.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger className={REVIEWER_TEXT_ACTION}>
                <Plus className="size-3" />
                Add reviewer
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                {assignable.map((person) => (
                  <DropdownMenuItem key={person.id} onClick={() => assign(person)} className="gap-2">
                    <PersonAvatar person={person} />
                    {person.name}
                    {person.id === viewerId && <span className="text-muted-foreground">(you)</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {canRemind && pending.length > 1 && (
            <button type="button" onClick={() => remind(pending.map((r) => r.id))} className={REVIEWER_TEXT_ACTION}>
              <Bell className="size-3" />
              Remind all
            </button>
          )}
        </div>
      ) : null}
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
  const composerRef = useRef(null)

  // A note drafted in AI Chat (its "Use as comment") lands here to review
  // and send — the composer is where every comment is sent from.
  const request = workspace?.commentDraftRequest
  useEffect(() => {
    if (!request || request.conflictId !== conflict.id) return
    setDraft(request.text)
    requestAnimationFrame(() => composerRef.current?.focus())
  }, [request?.nonce, conflict.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
                  {comment.target?.anchor && (
                    <p className="mt-1 inline-flex max-w-full items-center gap-1 truncate rounded-md bg-emerald-400/10 px-1.5 py-0.5 text-[10px] text-emerald-200">
                      <MapPin className="size-2.5 shrink-0" />
                      <span className="truncate"><LocalizedText text={comment.target.anchor} /></span>
                    </p>
                  )}
                  <p className="mt-0.5 leading-relaxed whitespace-pre-line text-slate-300"><LocalizedText text={comment.text} /></p>
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
                <div className="ml-[34px] space-y-2">
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
                <form onSubmit={(event) => handleReply(event, comment.id)} className="ml-[34px] flex h-8 items-center gap-1 rounded-full bg-white/[0.04] pr-1 pl-3 transition-colors focus-within:bg-white/[0.07]">
                  <input
                    autoFocus
                    value={replyDraft}
                    onChange={(event) => setReplyDraft(event.target.value)}
                    placeholder={tr('Write a reply')}
                    aria-label={`Reply to ${author?.name ?? 'comment'}`}
                    className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-500"
                  />
                  <button
                    type="submit"
                    aria-label="Send reply"
                    disabled={!replyDraft.trim()}
                    className="flex size-6 items-center justify-center rounded-full bg-[#2E2E2E] text-white ring-1 ring-white/10 ring-inset transition-colors hover:bg-[#3A3A3A] disabled:text-slate-500"
                  >
                    <Send className="size-3" />
                  </button>
                </form>
              )}
            </div>
          )
        })}
      </div>

      {/* Write a comment · Send. Grows with what's typed up to four lines
          (a pill at one line, a rounded box past it), then scrolls; Enter
          sends, Shift+Enter breaks a line. */}
      <form
        onSubmit={handleSend}
        className={cn(
          'flex shrink-0 items-end gap-1 bg-white/[0.04] py-1 pr-1 pl-4 transition-colors focus-within:bg-white/[0.07]',
          draft.includes('\n') ? 'rounded-2xl' : 'rounded-[20px]'
        )}
      >
        <textarea
          ref={composerRef}
          value={draft}
          rows={Math.min(4, Math.max(1, draft.split('\n').length))}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              handleSend(event)
            }
          }}
          placeholder={tr('Write a comment')}
          className="max-h-[88px] min-w-0 flex-1 resize-none self-center overflow-y-auto bg-transparent py-1.5 text-[13px] leading-5 text-white outline-none placeholder:text-slate-500"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!draft.trim()}
          className="flex size-8 items-center justify-center rounded-full bg-[#2E2E2E] text-white ring-1 ring-white/10 ring-inset transition-colors hover:bg-[#3A3A3A] disabled:text-slate-500"
        >
          <Send className="size-3.5" />
        </button>
      </form>
    </div>
  )
}

// Your sign-off, as one button (GitHub's "Review changes"): pick Approve or
// Request changes and leave a note. Requesting changes needs one — the
// author has to know what to fix — and the note goes to the conflict's
// Comments either way.
function ReviewButton({ onSubmit, authorName }) {
  const [open, setOpen] = useState(false)
  const [decision, setDecision] = useState('approve')
  const [note, setNote] = useState('')
  const needsNote = decision === 'changes'
  const ready = !needsNote || note.trim()

  function submit() {
    if (!ready) return
    onSubmit(decision, note.trim())
    setOpen(false)
    setNote('')
    setDecision('approve')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={cn(PRIMARY_BUTTON, 'gap-1')}>
        <LocalizedText text="Review" />
        <ChevronDown className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80 gap-0 rounded-xl p-3">
        {/* One choice as two equal buttons, then the note, then who hears
            about it beside the send button. */}
        <p className="mb-2 text-xs font-medium text-white"><LocalizedText text="Your review" /></p>
        <div role="radiogroup" aria-label="Your review" className="grid grid-cols-2 gap-1 rounded-lg bg-white/[0.04] p-1">
          {[
            ['approve', 'Approve', Check, 'bg-emerald-400/15 text-emerald-200'],
            ['changes', 'Request changes', Pencil, 'bg-amber-400/15 text-amber-200'],
          ].map(([id, label, Icon, on]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={decision === id}
              onClick={() => setDecision(id)}
              className={cn('ds-intrinsic flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors', decision === id ? on : 'text-slate-400 hover:bg-white/[0.05] hover:text-white')}
            >
              <Icon className="size-3.5" />
              <LocalizedText text={label} />
            </button>
          ))}
        </div>
        <p className="mt-1.5 mb-2 px-0.5 text-[11px] leading-4 text-slate-500">
          <LocalizedText text={decision === 'approve' ? 'The change is good to merge.' : 'Something needs fixing before it merges.'} />
        </p>
        <textarea
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); submit() } }}
          placeholder={tr(needsNote ? 'What needs to change? (required)' : 'Leave a comment (optional)')}
          className="block w-full resize-none rounded-lg bg-white/[0.04] px-2.5 py-2 text-xs leading-5 text-white outline-none placeholder:text-slate-500 focus:bg-white/[0.06]"
        />
        <div className="mt-2.5 flex items-center gap-2">
          {authorName && (
            <span className="inline-flex min-w-0 items-center gap-1 text-[11px] text-slate-500">
              <Bell className="size-3 shrink-0" />
              <span className="truncate"><LocalizedText text={`${authorName} (author) will be notified.`} /></span>
            </span>
          )}
          <button
            type="button"
            disabled={!ready}
            onClick={submit}
            className={cn('ml-auto inline-flex h-8 shrink-0 items-center rounded-full px-3.5 text-xs font-semibold', decision === 'approve' ? ACCENT_CTA : 'bg-amber-400 text-slate-950 hover:bg-amber-300', 'disabled:bg-white/[0.06] disabled:text-slate-500 disabled:shadow-none')}
          >
            <LocalizedText text={decision === 'approve' ? 'Submit approval' : 'Request changes'} />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─── Inline review view ────────────────────────────────────────────────
//
// `onUpdate(id, patch)` applies review edits (stage, reviewers) to
// wherever the conflict lives; `onApprove(id)` / `onRequestChanges(id)` are
// your own sign-off (approving never changes code); `onResolve(id)` merges
// an Approved conflict — the only step that applies the change.
// Not your move: who it's waiting on, as a quiet pill the size of the
// buttons it stands in for.
const STATUS_NOTE = 'inline-flex h-8 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-xs text-slate-200'

function ConflictModal({ conflict, onOpenChange, onUpdate, onApprove, onRequestChanges, onResolve, onRevert, onOpenMergeStudio, inMergeStudio = false }) {
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
    if (value === 'history' && !conflict.historyInspected) update({ historyInspected: true })
    if (value === 'overview' && !conflict.diffInspected && conflict.reviewStage !== 'resolved') {
      update({ diffInspected: true })
    }
  }

  function handleRequestReview() {
    // A fresh review round: earlier "changes requested" go back to pending.
    // The request goes to the other reviewers — never back to you, and never
    // to the author — so you're recorded as the requester (no alert for you).
    update({
      reviewStage: 'in_review',
      requestedBy: viewerId,
      reviewers: conflict.reviewers.map((r) => (r.status === 'changes_requested' ? { ...r, status: 'pending' } : r)),
    })
    const to = conflict.reviewers
      .filter((r) => r.id !== viewerId && r.id !== authorId)
      .map((r) => allPeople.find((p) => p.id === r.id)?.name)
      .filter(Boolean)
    // Checks don't gate the request (reviewers can see them) — only the merge.
    const failing = checks?.failing.length ?? 0
    toast(to.length ? `Review requested from ${to.join(', ')}` : 'Review requested', {
      description: failing ? `${failing} check${failing === 1 ? '' : 's'} still need attention — merging waits on them.` : conflict.title,
    })
  }

  function handleApprove() {
    const next = onApprove?.(conflict.id)
    if (!next) return
    const waiting = requiredReviewers(next).filter((r) => r.status !== 'approved').length
    toast(next.reviewStage === 'approved' ? 'All approvals received' : 'Approved by you', {
      description: next.reviewStage === 'approved' ? (checks?.blocking.length ? 'Approvals received. Resolve the failing checks before merging.' : 'Ready to merge.') : `Waiting on ${waiting} more reviewer${waiting === 1 ? '' : 's'}.`,
    })
  }

  // Editing the change's code (its file, in the review's code view). A
  // change already in review or approved goes back to review with every
  // sign-off reset — what gets merged must be what was approved. The AI's
  // own suggestion (`diff`) is left as it was; the edited file is kept as
  // the conflict's `workingFile`, and that's what merging applies.
  function handleSaveCode(lines) {
    const reviewed = stage === 'in_review' || stage === 'approved'
    const hadSignOffs = conflict.reviewers.some((r) => r.status !== 'pending')
    update({
      workingFile: lines ?? undefined,
      ...(reviewed && {
        reviewStage: 'in_review',
        reviewers: conflict.reviewers.map((r) => ({ ...r, status: 'pending', remindedAt: undefined })),
      }),
    })
    toast('Code updated', {
      description: reviewed && hadSignOffs ? 'Approvals were reset — the change is back in review.' : conflict.title,
    })
  }

  function handleOpenFile() {
    workspace.focusChange({ fileId: conflict.fileId, line: conflict.line })
    if (workspace.dockApi) openOrFocusPanel(workspace.dockApi, panelById.editor)
  }

  function handleReview(decision, note) {
    if (note && workspace) workspace.addComment(note, { conflictId: conflict.id })
    if (decision === 'approve') handleApprove()
    else onRequestChanges?.(conflict.id)
  }

  function fixCheck(check) {
    if (!workspace) return
    if (check.fileId || check.id === 'markers') { handleOpenFile(); return }
    if (driftItem && check.regionIds?.length && driftItem.variants?.length) {
      workspace.setDesignCompareRequest({ itemId: driftItem.id, keys: driftItem.variants.map((variant) => variant.key), regionId: check.regionIds[0] })
    } else if (driftItem) {
      workspace.requestMergeFocus({ itemId: driftItem.id, ...(check.layerId ? { layerId: check.layerId } : { overview: true }), keepDeck: true })
    }
    if (!inMergeStudio) onOpenMergeStudio?.(conflict)
    else workspace.setBottomPanel({ open: false })
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
    // A view switch, not part of the title: a small segmented control on
    // the right, ahead of the stage's action.
    <div className="flex shrink-0 items-center rounded-full bg-white/[0.05] p-0.5" role="tablist" aria-label="Conflict details">
      {TABS.map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          onClick={() => openTab(id)}
          className={cn(
            'ds-intrinsic inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs whitespace-nowrap transition-colors',
            tab === id ? 'bg-white/[0.1] font-medium text-white' : 'text-slate-400 hover:text-white'
          )}
        >
          <LocalizedText text={label} />
        </button>
      ))}
    </div>
  )

  const stage = conflict?.reviewStage
  const checks = conflict && workspace?.conflictChecks ? workspace.conflictChecks(conflict) : null
  const driftItem = conflict ? driftItemOf(conflict, workspace) : null
  const viewerId = conflict ? currentUserFor(conflict.projectId).id : null
  const myReviewer = conflict ? conflict.reviewers.find((r) => r.id === viewerId) : null
  const authorId = conflict ? authorOf(conflict) : null
  const ownChange = Boolean(authorId && authorId === viewerId)
  const authorName = authorId && !ownChange ? allPeople.find((p) => p.id === authorId)?.name : null
  // Never your own change (the GitHub rule) — someone else signs off.
  const canReview = Boolean(myReviewer && myReviewer.status !== 'approved' && !ownChange)

  // The change placed in its file, for the editable code view — only
  // inside a workspace (which has the files) and while the file still
  // holds the original lines (a merged change no longer does).
  const fileLines = workspace && conflict?.fileId ? workspace.getFileLines(conflict.fileId) : null
  const generatedFile = fileLines && conflict.diff
    ? placeChange(fileLines, conflict.line, conflict.diff.before ?? [], conflict.diff.after ?? [])
    : null
  // Already merged: the file holds the change, so rebuild the file as it
  // was before (the change placed in reverse) and show the merge read-only.
  const preMergeFile = !generatedFile && stage === 'resolved' && fileLines && conflict.diff
    ? placeChange(fileLines, conflict.line, conflict.diff.after ?? [], conflict.diff.before ?? [])
    : null
  const codeView = generatedFile
    ? {
        fileName: conflict.file,
        base: fileLines,
        generated: generatedFile,
        working: conflict.workingFile ?? null,
        onSave: stage !== 'resolved' ? handleSaveCode : undefined,
        onOpenFile: handleOpenFile,
      }
    : preMergeFile
      ? { fileName: conflict.file, base: preMergeFile, generated: fileLines, working: null, merged: true, onOpenFile: handleOpenFile }
      : null

  // The one primary action for where the review is — or none, when it's
  // waiting on someone else (the Status card says who).
  let primary = null
  if (conflict) {
    if (stage === 'detected') {
      primary = (
        <>
          {!requiredReviewers(conflict).length && <span className={STATUS_NOTE}><LocalizedText text="Assign a reviewer other than the author to request review." /></span>}
          <button type="button" disabled={!requiredReviewers(conflict).length} onClick={handleRequestReview} className={REQUEST_REVIEW_BUTTON}>
            Request review
          </button>
        </>
      )
    } else if (stage === 'in_review' && (ownChange || conflict.requestedBy === viewerId) && requiredReviewers(conflict).some((reviewer) => reviewer.status === 'changes_requested')) {
      primary = <button type="button" onClick={handleRequestReview} className={REQUEST_REVIEW_BUTTON}><LocalizedText text="Request review again" /></button>
    } else if (stage === 'in_review' && canReview) {
      // Yours to decide — also after requesting changes, so you can approve
      // once they're fixed (or change your mind).
      primary = <ReviewButton onSubmit={handleReview} authorName={authorName} />
    } else if (stage === 'in_review' && myReviewer && ownChange) {
      primary = <span className={STATUS_NOTE}><LocalizedText text="You can’t review your own change" /></span>
    } else if (stage === 'in_review') {
      // Not your move: say whose it is instead of leaving the slot empty.
      const waitingOn = approvalStatus(conflict).lines.filter((line) => !/^(Approved by you|You requested changes)$/.test(line))
      primary = waitingOn.length ? (
        <span className={STATUS_NOTE}>
          <Clock3 className="size-3.5 shrink-0 text-sky-300" />
          <LocalizedText text={waitingOn.join(' · ')} />
        </span>
      ) : null
    } else if (stage === 'approved') {
      // Approved but a check blocks it: say so before the click, not after.
      const blocking = checks?.blocking ?? []
      primary = (
        <>
          <button type="button" onClick={handleMerge} disabled={blocking.length > 0} className={cn(PRIMARY_BUTTON, 'gap-1.5')}>
            <GitMerge className="size-3.5" />
            Merge change
          </button>
        </>
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
            <div className="flex h-10 shrink-0 items-center gap-3 bg-card px-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  title="Back to list"
                  aria-label="Back to list"
                  className="ds-intrinsic flex size-6 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <h2 className="min-w-0 truncate text-[13px] font-semibold text-white">
                  <LocalizedText text={conflict.title} />
                </h2>
                <span className="shrink-0 font-mono text-[10px] font-medium text-slate-500">#{conflict.id}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {detailTabs}
                {primary}
              </div>
            </div>

            <div className="mx-3 mb-2 flex shrink-0 flex-wrap items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-[11px] text-slate-400">
              <span>1. 검토 내용 확인</span><span>→</span>
              <button type="button" onClick={() => openTab('history')} className="text-emerald-200 hover:underline">2. History에서 변경 근거 확인{conflict.historyInspected ? ' ✓' : ''}</button><span>→</span>
              <button type="button" onClick={() => openTab('overview')} className="text-slate-200 hover:underline">3. 카드에서 합칠 내용 선택</button><span>→</span><span>4. 검토 요청 · 승인 · 병합</span>
            </div>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto px-3 pt-0 pb-3">
              <div className={cn(
                'grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-auto pt-1 xl:grid-cols-[minmax(0,1fr)_360px] xl:overflow-auto',
                REVIEW_GUTTER
              )}>
                <div className="flex min-h-0 min-w-0 flex-col overflow-auto" role="tabpanel">
                  {tab === 'overview' ? (
                    <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 items-stretch gap-3 xl:flex xl:items-stretch">
                      <section className={cn('flex min-w-0 flex-col overflow-hidden p-3', REVIEW_CARD, 'xl:w-[46%] xl:min-w-[240px] xl:max-w-[460px] xl:shrink-0')}>
                        <div className="min-h-0 min-w-0 flex-1 overflow-auto">
                          <OverviewTab
                            conflict={conflict}
                            severity={severity}
                            stage={stage}
                            showProject={!workspace}
                            checks={checks}
                            onFixCheck={stage !== 'resolved' && workspace ? fixCheck : undefined}
                          />
                        </div>
                      </section>
                      <section className={cn('flex min-w-0 flex-col overflow-hidden p-3', REVIEW_CARD, 'xl:flex-1')}>
                        <div className="min-h-0 min-w-0 flex-1 overflow-auto">
                          {driftItem && draftColumns(driftItem) ? (
                            <DraftTable
                              conflict={conflict}
                              workspace={workspace}
                              item={driftItem}
                              editable={false}
                              compareLabel={inMergeStudio ? 'Compare on canvas' : 'Compare in Merge Studio'}
                              onCompare={stage === 'resolved' ? null : () => {
                                // Merge Studio opens on the item with every draft side by side.
                                workspace.setDesignCompareRequest({ itemId: driftItem.id, keys: driftItem.variants.map((v) => v.key) })
                                if (!inMergeStudio) onOpenMergeStudio?.(conflict)
                              }}
                            />
                          ) : (
                          <>
                          <DiffTab
                            conflict={conflict}
                            code={codeView}
                            workspace={workspace}
                            item={driftItem}
                            studioAction={stage !== 'resolved' && onOpenMergeStudio && !inMergeStudio
                              ? { label: 'Adjust in Merge Studio', onClick: () => onOpenMergeStudio(conflict) }
                              : null}
                          />
                          </>
                          )}
                        </div>
                      </section>
                    </div>
                  ) : (
                    <div className="flex min-h-0 flex-1">
                      <ConflictHistoryReplay conflict={conflict} workspace={workspace} />
                    </div>
                  )}
                </div>

                {/* Reviewers stay above the discussion beside the central diff. */}
                <div className={cn('flex h-full min-h-0 min-w-0 flex-col', REVIEW_GUTTER)}>
                  <section className={cn("shrink-0 max-h-48 overflow-auto", REVIEW_CONTEXT_CARD)}>
                    <p className={cn(PANEL_LABEL, "mb-2")}><LocalizedText text="Reviewers" /></p>
                    <ReviewersSection conflict={conflict} onUpdate={update} onDismiss={workspace?.dismissChangeRequest} />
                  </section>
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
