import { comparisonBlockers } from '@/lib/driftDecisions'
import { BranchInfo, ReviewStageBadge } from '@/components/conflicts/ConflictBadges'
import { Fragment, useEffect, useRef, useState } from 'react'
import {
  ArrowUpRight,
  Ban,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  Clock3,
  GitMerge,
  History,
  Layers3,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  TriangleAlert,
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
import { sizeAdjustmentOf } from '@/lib/sizeAdjustment'
import { draftColumns, draftRows, driftRowsFor } from '@/lib/driftDecisions'
import {
  approvalStatus,
  requiredReviewers,
  authorOf,
  shortDue,
} from '@/lib/conflicts'
import ChangePreview from '@/components/conflicts/ChangePreview'
import { checksFor } from '@/components/mergestudio/mergeChecks'
import { CheckDecisions } from '@/components/conflicts/CheckDecisions'
import { diffLines } from '@/lib/lineDiff'
import { ROLLBACK_REASON, ROLLBACK_STAGE_LABEL } from '@/lib/rollbackImpact'
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
  pending: { label: 'Pending', className: 'text-slate-300' },
  approved: { label: 'Approved', className: 'text-emerald-300' },
  changes_requested: { label: 'Changes requested', className: 'text-amber-400' },
}

const REVIEW_GUTTER = 'gap-3'
const REVIEW_CARD = 'rounded-xl bg-white/[0.03]'
const REVIEW_CONTEXT_CARD = cn(REVIEW_CARD, 'ds-review-context')
const REVIEW_INFO_LABEL = 'text-xs leading-[18px] font-medium text-slate-400'
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
      {fields.map((field, index) => (
        <div key={field.label} className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-[11px] text-slate-500"><span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[9px] font-semibold tabular-nums text-slate-300">{index + 1}</span><LocalizedText text={field.label} /></p>
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

// Where the change is and where it came from — the review's folded
// Details, as two short groups: Location (branch, components, files) and
// Record (who changed it and what detected it, on one line).
function ReviewDetails({ conflict, showProject }) {
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
  const components = impact?.components ?? []
  const record = [
    changedBy && (changedBy.type === 'ai' ? 'Devsign AI' : personName(changedBy.id, viewerId)),
    changedBy?.what,
    detectedBy,
    conflict.detectedAt,
  ].filter(Boolean)
  const GROUP = 'text-[11px] leading-4 font-medium text-slate-500'
  const ROW = 'grid min-w-0 grid-cols-[64px_minmax(0,1fr)] items-start gap-x-3'
  const LABEL = 'text-xs leading-[18px] text-slate-400'
  const VALUE = 'min-w-0 break-words text-xs leading-[18px] text-slate-200 [overflow-wrap:anywhere]'

  return (
    <div className="mt-2 space-y-3.5">
      <div className="space-y-1.5">
        <p className={GROUP}><LocalizedText text="Location" /></p>
        {showProject && conflict.projectName && (
          <div className={ROW}><span className={LABEL}>Project</span><span className={VALUE}><LocalizedText text={conflict.projectName} /></span></div>
        )}
        <div className={ROW}><span className={LABEL}>Branch</span><BranchInfo conflict={conflict} /></div>
        {components.length > 0 && (
          <div className={ROW}><span className={LABEL}>Components</span><span className={VALUE}>{components.join(', ')}</span></div>
        )}
        {files.length > 0 && (
          <div className={ROW}>
            <span className={LABEL}>Files</span>
            <span translate="no" className={cn(VALUE, 'font-mono text-[11.5px] text-slate-300')}>{files.join(', ')}</span>
          </div>
        )}
      </div>
      {record.length > 0 && (
        <div className="space-y-1.5">
          <p className={GROUP}><LocalizedText text="Record" /></p>
          <p className={VALUE}>
            {record.map((part, i) => (
              <Fragment key={i}>
                {i > 0 && <span className="text-slate-500"> · </span>}
                <LocalizedText text={part} />
              </Fragment>
            ))}
          </p>
        </div>
      )}
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
function DraftTable({ conflict, workspace, item, editable, onCompare, compareLabel, decisionsOverride }) {
  const decisions = decisionsOverride ?? workspace.decisionsFor(item.id)
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

function mergeHistoryForConflict(conflict, workspace) {
  return [...(workspace?.historyEntries ?? [])].reverse().find((entry) => entry.kind === 'merge'
    && (entry.conflictId === conflict.id || entry.conflictIds?.includes(conflict.id)))
}

function mergedLinesForConflict(conflict, workspace) {
  const entry = mergeHistoryForConflict(conflict, workspace)
  return conflict.mergedFileLines
    ?? entry?.snapshot?.mergeOutput?.files?.[conflict.fileId]
    ?? entry?.snapshot?.files?.[conflict.fileId]
    ?? (conflict.reviewStage === 'resolved' ? entry?.snapshot?.lines : null)
}

function mergedDecisionsForConflict(conflict, workspace) {
  return conflict.mergedDecisions ?? mergeHistoryForConflict(conflict, workspace)?.snapshot?.mergeOutput?.resolutions
}

// The due date reads the same in the list, the review's title row and its
// overview: a clock and the label, amber once it's today or overdue.
function DueDate({ label, className }) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1 tabular-nums', /overdue|today/i.test(label) ? 'text-amber-300' : 'text-slate-200', className)} title="Due date">
      <Clock3 className="size-3.5 shrink-0" />
      <LocalizedText text={shortDue(label) ?? label} />
    </span>
  )
}

// The review's left card is context only: where it stands (one line —
// stage · level · due · whether the merge is blocked), the summary sentence
// and the way into History, with Details folded under it. The values, the
// decision and every check live on the comparison card in the middle, so
// nothing is said twice.
// `adjustment`: a size set by hand in Merge Studio — the summary then says
// what was done (and that it's resolved, once nothing blocks the merge).
function OverviewTab({ conflict, severity, stage, showProject, blockedCount, onOpenHistory, adjustment }) {
  // A rollback's details (what, to which version, who asked) are the
  // whole of its left card, so they start open; a conflict's stay folded.
  const [showDetails, setShowDetails] = useState(Boolean(conflict.rollback))
  const open = stage !== 'resolved'
  const requester = conflict.rollback ? allPeople.find((p) => p.id === (conflict.rollback.requestedBy ?? conflict.requestedBy)) : null
  const riskPrefix = /^(Low|Medium|High):\s*/.exec(conflict.riskReason ?? '')
  const riskExplanation = riskPrefix
    ? conflict.riskReason.slice(riskPrefix[0].length)
    : conflict.riskReason
  // A rollback agreement says what it is in the middle — no sentence here.
  const summary = conflict.rollback ? null
    : adjustment && open ? `${adjustment.layerName} was adjusted to ${adjustment.to}${blockedCount ? '.' : ', which resolves it.'}`
      : conflict.message || riskExplanation
  const isAiDraft = open && (conflict.source === 'ai' || conflict.changedBy?.type === 'ai')

  return (
    <div className="flex h-full flex-col gap-3">
      <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-400">
        {/* Dots and text — no chips: this line already sits in a panel. */}
        <ReviewStageBadge plain stage={stage} label={conflict.rollback ? ROLLBACK_STAGE_LABEL[stage] : undefined} />
        {severity && (
          <>
            <span aria-hidden>·</span>
            <SeverityPill plain level={severity.label} />
          </>
        )}
        {open && shortDue(conflict.dueLabel) && (
          <>
            <span aria-hidden>·</span>
            <DueDate label={conflict.dueLabel} />
          </>
        )}
        {/* A chip of its own — no dot before it, so nothing dangles when it
            wraps onto the next line. */}
        {blockedCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-200">
            <span aria-hidden className="mr-0.5 font-normal text-slate-400">·</span>
            <TriangleAlert className="size-3 shrink-0" />
            <LocalizedText text={`Can’t merge ${blockedCount}`} />
          </span>
        )}
        {isAiDraft && (
          <>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1 text-slate-400">
              <Sparkles className="size-3 shrink-0" aria-hidden />
              <LocalizedText text="AI draft" />
            </span>
          </>
        )}
      </p>

      {summary && <p className={cn(REVIEW_DETAIL_COPY, 'min-w-0 break-words [overflow-wrap:anywhere] text-slate-300')}><LocalizedText text={summary} /></p>}

      {onOpenHistory && (
        <button
          type="button"
          onClick={onOpenHistory}
          className="ds-intrinsic inline-flex h-7 w-fit shrink-0 items-center gap-1.5 text-xs font-medium text-slate-300 underline-offset-4 transition-colors hover:text-white hover:underline"
        >
          <History className="size-3.5" />
          <LocalizedText text="Check the reasoning in History" />
          {conflict.historyInspected && <Check className="size-3.5 text-slate-400" strokeWidth={2.5} />}
        </button>
      )}

      <section className="min-w-0 flex-1">
        <button
          type="button"
          aria-expanded={showDetails}
          onClick={() => setShowDetails((v) => !v)}
          className="ds-intrinsic inline-flex h-7 w-fit items-center gap-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-white"
        >
          <LocalizedText text={showDetails ? 'Hide details' : 'Details'} />
          <ChevronDown className={cn('size-3.5 transition-transform', showDetails && 'rotate-180')} />
        </button>
        {showDetails && (conflict.rollback ? (
          <div className="mt-2 space-y-1.5">
            {[
              ['Target file', <span key="f" translate="no" className="font-mono text-[11.5px] break-all text-slate-300">{conflict.rollback.target}</span>],
              ['Roll back to', <><LocalizedText text={conflict.rollback.label} />{conflict.rollback.timestamp && <span className="text-slate-400"> · <LocalizedText text={conflict.rollback.timestamp} /></span>}</>],
              requester && ['Requested by', <>{requester.name}<span className="text-slate-400"> · <LocalizedText text={requester.role} /></span></>],
            ].filter(Boolean).map(([label, value]) => (
              <div key={label} className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-x-3">
                <span className="text-xs leading-[18px] text-slate-400"><LocalizedText text={label} /></span>
                <span className="min-w-0 text-xs leading-[18px] break-words text-slate-200">{value}</span>
              </div>
            ))}
          </div>
        ) : <ReviewDetails conflict={conflict} showProject={showProject} />)}
      </section>
    </div>
  )
}

// Everything the comparison card needs about the decision and the checks,
// worked out once:
//   · the decision so far (which side every value is on) and undoing it;
//   · the required checks the picked side breaks (`cardBlockers` — shown on
//     that card), and whether picking the other side would clear them
//     (the checks re-run with every value flipped);
//   · the remaining required checks, and the suggestions.
function decisionStateOf({ conflict, item, workspace, checks, stage, mergedDecisions }) {
  const open = stage !== 'resolved'
  const rows = item ? driftRowsFor(conflict, item).filter((row) => row.diff) : []
  const decisions = item ? (open ? workspace.decisionsFor(item.id) : mergedDecisions ?? {}) : {}
  const all = (decision) => rows.length > 0 && rows.every((row) => decisions[row.key] === decision)
  const side = all('A') ? 'A' : all('B') ? 'B' : null
  const decided = rows.filter((row) => decisions[row.key]).length
  const label = side === 'A' ? 'Merge with the design reference'
    : side === 'B' ? 'Merge with the current implementation'
      : decided ? `${decided} of ${rows.length} values decided` : null
  const required = checks && open ? checks.blocking : []
  const suggested = checks && open ? checks.failing.filter((check) => !checks.blocking.includes(check)) : []
  const cardBlockers = comparisonBlockers(required, side, rows)
  // What would still fail with every value on one side — the checks
  // re-run with the decisions flipped. Tells which choice clears a check.
  const settled = [...(conflict?.acceptedChecks ?? [])]
  const failingWith = (decision) => {
    if (!rows.length || !workspace?.mergeDrafts) return null
    const draft = workspace.mergeDrafts.current?.[item.id] ?? {}
    const run = checksFor(item, { ...draft, resolutions: { ...decisions, ...Object.fromEntries(rows.map((row) => [row.key, decision])) } }, workspace.linesOfFile)
    return new Set(run.failing.map((check) => check.id).filter((id) => !settled.includes(id)))
  }
  const failing = open ? { A: failingWith('A'), B: failingWith('B') } : { A: null, B: null }
  // The side that makes this check pass (the other one first, if a side is
  // already picked), or null when neither does.
  const resolvingSide = (checkId) => [side === 'A' ? 'B' : 'A', side === 'A' ? 'A' : 'B'].find((candidate) => failing[candidate] && !failing[candidate].has(checkId)) ?? null
  // A side "meets the design standard" when the other side fails a check
  // that this one passes.
  const meetsOver = (mine, theirs) => Boolean(failing[mine] && failing[theirs]) && [...failing[theirs]].some((id) => !failing[mine].has(id))
  const meets = { A: meetsOver('A', 'B'), B: meetsOver('B', 'A') }
  const other = side === 'A' ? 'B' : 'A'
  const otherClears = cardBlockers.length > 0 && Boolean(failing[other]) && !cardBlockers.some((check) => failing[other].has(check.id))
  return {
    rows, side, label, open,
    canPick: rows.length > 0 && open,
    pick: (decision) => rows.forEach((row) => workspace.decideDrift(item.id, row.key, decision)),
    undo: () => rows.forEach((row) => workspace.decideDrift(item.id, row.key, null)),
    required, suggested, cardBlockers, otherClears, resolvingSide, meets,
    otherBlockers: required.filter((check) => !cardBlockers.includes(check)),
  }
}

// The checks that aren't about the picked card, under the comparison:
// required ones as "can't merge" (amber), then each suggestion as a note.
function CheckBlocks({ checks, state, actions }) {
  if (!state.otherBlockers.length && !state.suggested.length) return null
  return (
    <div className="min-w-0 space-y-3">
      {state.otherBlockers.length > 0 && (
        <section className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-200">
            <TriangleAlert className="size-3.5 shrink-0" />
            <LocalizedText text="Can’t merge · required standard not met" />
            <span className="font-normal text-amber-200/80 tabular-nums">· {state.otherBlockers.length}</span>
          </p>
          <CheckDecisions checks={checks} only={state.otherBlockers} {...actions} />
        </section>
      )}
      {/* Suggestions are settled by the choice above, not by buttons of
          their own: one quiet line each, saying what it is. */}
      {state.suggested.map((check) => (
        <p key={check.id} className="min-w-0 text-xs leading-[18px] text-slate-400">
          <span className="mr-1.5 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10.5px] leading-none font-medium text-slate-300"><LocalizedText text="Suggestion" /></span>
          <span className="font-medium text-slate-300"><LocalizedText text={check.title} /></span>
          {check.hint && <> — <LocalizedText text={check.hint} /></>}
        </p>
      ))}
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
// `state`: the decision and checks (decisionStateOf). `checkBlocks`: the
// checks that aren't about the picked card, placed right under the
// comparison. `checkActions`: fix / apply-as-is for the ones on the card.
// `adjustment` (a size set by hand in Merge Studio): the card that merges
// shows that value as old → new and is tagged, with a way to undo it;
// `changeAfter` is the change's code with the adjustment in it.
function DiffTab({ conflict, code, studioAction, mergedLines, adjustment, changeAfter, onUndoAdjustment, state, checks, checkActions, checkBlocks }) {
  const readOnly = conflict.reviewStage === 'resolved'
  const { canPick } = state
  const picked = decision => state.side === decision
  // The card the adjustment shows on: the picked one — or, with nothing
  // picked, the current implementation, since that's what merges then.
  const adjusted = decision => (state.side ? state.side === decision : decision === 'B')
  function pick(decision) {
    if (canPick) state.pick(decision)
  }
  if (!conflict.branches && !conflict.diff && !conflict.suggestion && !conflict.preview && !conflict.comparisonFields?.length) {
    return (
      <div className="h-full">
        <EmptyNote>No diff captured for this conflict yet.</EmptyNote>
      </div>
    )
  }
  const rows = conflict.diff ? diffLines(conflict.diff.before ?? [], changeAfter ?? conflict.diff.after ?? []) : []
  const pairedPreview = Boolean(conflict.comparisonFields?.length)
  const sources = comparisonSources(conflict.branches)

  return (
    <div className="flex h-full flex-col">
      {/* One line over the comparison: how to choose (the choice itself
          is the radio cards below — no second place that shows or undoes
          it), and on the right the one way into Merge Studio. */}
      {(state.canPick || studioAction) && (
        <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2">
          {state.canPick && (
            <p className="min-w-0 text-xs leading-5 text-slate-300">
              <LocalizedText text="Pick which side to merge" />
              <span className="text-slate-500"> · </span>
              <span className="text-slate-400"><LocalizedText text="left unpicked, it merges with the current implementation" /></span>
            </p>
          )}
          {studioAction && (
            <button
              type="button"
              title="Adjust the design in Merge Studio. This doesn't approve or merge the change."
              onClick={studioAction.onClick}
              className="ds-intrinsic ml-auto inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.05] px-3 text-xs font-medium text-slate-200 transition-colors hover:bg-white/[0.09] hover:text-white"
            >
              <GitMerge className="size-3.5" />
              <LocalizedText text={studioAction.label} />
              <ArrowUpRight className="size-3.5 opacity-70" />
            </button>
          )}
        </div>
      )}
      {(conflict.preview || conflict.comparisonFields?.length > 0 || conflict.diff || conflict.suggestion) && (
        <section className="min-w-0 flex-1">
          <div className="flex flex-col gap-3">
            {pairedPreview ? (
              // Each card is an option, with a trailing check on the picked
              // side. Clicking the picked card again clears the choice.
              <div role="radiogroup" aria-label="적용할 버전 선택" className="grid grid-cols-2 gap-2">
                {[
                  { side: 'before', decision: 'B', source: sources?.[0], tone: 'text-red-300', value: (field) => field.current },
                  { side: 'after', decision: 'A', source: sources?.[1], tone: 'text-emerald-200', value: (field) => field.expected },
                ].map(({ side, decision, source, tone, value }) => {
                  const on = picked(decision)
                  const choose = () => (on ? state.undo() : pick(decision))
                  return (
                  <div key={side}
                    role="radio"
                    aria-checked={on}
                    aria-disabled={!canPick}
                    tabIndex={canPick ? 0 : -1}
                    onClick={canPick ? choose : undefined}
                    onKeyDown={(event) => {
                      if (!canPick || event.target !== event.currentTarget || (event.key !== ' ' && event.key !== 'Enter')) return
                      event.preventDefault()
                      choose()
                    }}
                    data-side={side}
                    data-decision={decision}
                    className={cn(
                      // Roomy: ~20px inside, 16px between its parts.
                      'flex min-w-0 flex-col gap-4 rounded-xl border p-5 transition-colors focus-visible:outline-2 focus-visible:outline-emerald-300',
                      on ? 'border-emerald-300 bg-emerald-400/[0.06]' : 'border-white/10',
                      canPick && !on && 'cursor-pointer hover:border-white/35',
                      canPick && on && 'cursor-pointer'
                    )}>
                    <div className="flex min-w-0 items-start gap-2.5">
                      <div className="min-w-0 flex-1">{source && <ComparisonSource {...source} />}</div>
                      {/* This side passes what the other one fails. */}
                      {state.meets[decision] && (
                        <span className="shrink-0 rounded bg-white/[0.08] px-1.5 py-0.5 text-[10.5px] leading-none font-medium text-slate-200">
                          <LocalizedText text="Meets the design standard" />
                        </span>
                      )}
                      {/* The side that merges carries the hand adjustment. */}
                      {adjustment && adjusted(decision) && (
                        <span className="shrink-0 rounded bg-emerald-400/15 px-1.5 py-0.5 text-[10.5px] leading-none font-medium text-emerald-200">
                          <LocalizedText text="Adjusted by hand" />
                        </span>
                      )}
                      <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center">
                        {on && <Check className="size-5 text-emerald-300" strokeWidth={2.5} />}
                      </span>
                    </div>
                    <ChangePreview preview={conflict.preview} side={side} showLabels={false} />
                    <dl className="min-w-0 space-y-3">
                      {conflict.comparisonFields.map((field) => {
                        // A color value gets its swatch beside it.
                        const swatch = /#[0-9a-fA-F]{3,8}\b/.exec(value(field) ?? '')?.[0]
                        return (
                        <div key={field.label} className="flex min-w-0 items-baseline justify-between gap-3">
                          <dt className="min-w-0 truncate text-[11.5px] text-slate-400"><LocalizedText text={field.label} /></dt>
                          {/* Red / green only where the two sides differ — a
                              value that's the same on both isn't a change. */}
                          {adjustment && adjusted(decision) && adjustment.display(value(field)) ? (
                            // Adjusted by hand: what it was, struck through,
                            // then what it is now.
                            <dd className="flex min-w-0 flex-wrap items-center justify-end gap-x-1.5 text-right text-[13px] leading-5 font-semibold tabular-nums">
                              <span className="font-normal text-slate-500 line-through">{adjustment.display(value(field)).from}</span>
                              <span aria-hidden className="font-normal text-slate-500">→</span>
                              <span className="text-emerald-300">{adjustment.display(value(field)).to}</span>
                            </dd>
                          ) : (
                          <dd className={cn('flex min-w-0 items-center justify-end gap-1.5 text-right text-[13px] leading-5 font-semibold break-words tabular-nums', field.current === field.expected ? 'text-slate-200' : tone)}>
                            {swatch && <span aria-hidden className="size-3 shrink-0 rounded-full ring-1 ring-white/30" style={{ background: swatch }} />}
                            <span className="min-w-0"><LocalizedText text={value(field)} /></span>
                          </dd>
                          )}
                        </div>
                        )
                      })}
                    </dl>
                    {adjustment && adjusted(decision) && onUndoAdjustment && !readOnly && (
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); onUndoAdjustment() }}
                        className="ds-intrinsic inline-flex h-7 w-fit items-center gap-1 rounded-full bg-white/[0.07] px-2.5 text-xs font-medium text-slate-200 transition-colors hover:bg-white/[0.12] hover:text-white"
                      >
                        <RotateCcw className="size-3" />
                        <LocalizedText text="Undo adjustment" />
                      </button>
                    )}
                    {/* The picked side breaks a required standard: say so on
                        this card, with what clears it. */}
                    {on && state.cardBlockers.length > 0 && (
                      <div onClick={(event) => event.stopPropagation()} className="cursor-default border-t border-amber-300/30 pt-3">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-200">
                          <TriangleAlert className="size-3.5 shrink-0" />
                          <LocalizedText text="Can’t merge · required standard not met" />
                        </p>
                        <CheckDecisions checks={checks} only={state.cardBlockers} {...checkActions} />
                        {state.otherClears && (
                          <p className="mt-2 text-xs leading-[18px] text-slate-200">
                            <LocalizedText text={side === 'before' ? 'Choosing the design reference clears it.' : 'Choosing the current implementation clears it.'} />
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  )
                })}
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
            {checkBlocks}
            {conflict.diff && (
              <div className="min-w-0 pt-2">
                {code ? <ConflictCodeView {...code} /> : <CodeDiffColumns rows={rows} />}
              </div>
            )}
            {readOnly && (mergedLines?.length || conflict.mergedFileLines?.length) && (() => {
              const lines = mergedLines ?? conflict.mergedFileLines
              const start = Math.max(0, (conflict.line ?? 1) - 2)
              const excerpt = lines.slice(start, start + 5)
              return (
                <div className="mt-3 min-w-0 rounded-lg bg-emerald-400/[0.06] p-3">
                  <p className="mb-1.5 text-[10px] font-medium text-emerald-200"><LocalizedText text="Merged value" /></p>
                  <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-4 text-slate-200">{excerpt.join('\n')}</pre>
                </div>
              )
            })()}
          </div>
        </section>
      )}
    </div>
  )
}

// A rollback that reaches other people, as the agreement it needs — kept
// to what's checked here: one line saying what goes back to which version,
// why it needs agreement (a badge per reason — or, once everyone has
// confirmed, one quiet badge saying so), what it changes (a table:
// property · now · after, colors as swatches), and the one list of who it
// affects with whether each has confirmed.
function RollbackValue({ value, color }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      {color && <span aria-hidden className="size-3.5 shrink-0 rounded-[4px] ring-1 ring-white/20" style={{ background: color }} />}
      <span translate="no" className="min-w-0 font-mono text-[12px] break-all">{value ?? '—'}</span>
    </span>
  )
}

function RollbackAgreement({ conflict }) {
  const { rollback, reviewers } = conflict
  const confirmed = reviewers.filter((r) => r.status === 'approved').length
  const allConfirmed = reviewers.length > 0 && confirmed === reviewers.length
  const changes = rollback.changes ?? []
  const names = reviewers.map((r) => allPeople.find((p) => p.id === r.id)?.name).filter(Boolean)
  const component = rollback.component ?? String(rollback.target ?? '').replace(/\.[a-z]+$/i, '')
  return (
    <div className="flex h-full min-w-0 flex-col gap-4">
      {/* What goes back to which version: component · checkpoint · time · file. */}
      <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs leading-5 text-slate-300">
        <span translate="no" className="text-[13px] font-semibold text-white">{component}</span>
        <span aria-hidden className="text-slate-500">→</span>
        <span className="min-w-0 font-medium break-words text-slate-100"><LocalizedText text={rollback.label} /></span>
        {rollback.timestamp && <><span aria-hidden className="text-slate-600">·</span><span className="text-slate-400"><LocalizedText text={rollback.timestamp} /></span></>}
        <span aria-hidden className="text-slate-600">·</span>
        <span translate="no" className="font-mono text-[11.5px] text-slate-400">{rollback.target}</span>
      </p>

      <div className="flex min-w-0 flex-wrap gap-1.5">
        {allConfirmed ? (
          // Everyone it touches has agreed — no longer a warning.
          <span className="inline-flex h-6 items-center gap-1 rounded-md bg-white/[0.06] px-2 text-[11px] font-medium text-slate-200">
            <Check className="size-3 text-slate-400" strokeWidth={2.5} />
            <LocalizedText text={`Affects ${names.join(', ')}’s work · confirmed`} />
          </span>
        ) : rollback.reasons.map((reason) => (
          <span key={reason.id} className="inline-flex h-6 items-center gap-1 rounded-md bg-amber-400/15 px-2 text-[11px] font-medium text-amber-200">
            <LocalizedText text={ROLLBACK_REASON[reason.id].short} />
          </span>
        ))}
      </div>

      {changes.length > 0 && (
        // Three columns sized to their content, so a value sits right
        // beside the one it's compared with.
        <table className="w-fit max-w-full border-collapse text-left text-slate-100">
          <thead>
            <tr className="border-b border-white/[0.07] text-xs font-medium text-slate-400">
              <th className="py-1.5 pr-6 font-medium"><LocalizedText text="Property" /></th>
              <th className="py-1.5 pr-6 font-medium"><LocalizedText text="Now" /></th>
              <th className="py-1.5 font-medium"><LocalizedText text="After rollback" /></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.07]">
            {changes.map((change) => (
              <tr key={change.label}>
                <td className="py-2 pr-6 align-top text-xs text-slate-400"><LocalizedText text={change.label} /></td>
                <td className="py-2 pr-6 align-top"><RollbackValue value={change.from} color={change.fromColor} /></td>
                <td className="py-2 align-top"><RollbackValue value={change.to} color={change.toColor} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <section className="min-w-0">
        <p className={cn(REVIEW_INFO_LABEL, 'flex items-center gap-2')}>
          <LocalizedText text="Affected people" />
          <span className={cn('tabular-nums', allConfirmed ? 'text-emerald-300' : 'text-slate-300')}>
            {confirmed}/{reviewers.length} <LocalizedText text="Confirmed" />
          </span>
        </p>
        <ul className="mt-1.5 divide-y divide-white/[0.07] border-y border-white/[0.07]">
          {reviewers.map((reviewer) => {
            const person = allPeople.find((p) => p.id === reviewer.id)
            if (!person) return null
            const done = reviewer.status === 'approved'
            return (
              <li key={reviewer.id} className="flex min-w-0 items-center gap-2.5 py-2">
                <PersonAvatar person={person} />
                <span className="min-w-0 flex-1 truncate text-[13px] text-slate-100">
                  {person.name}
                  <span className="ml-1.5 text-xs text-slate-400"><LocalizedText text={person.role} /></span>
                </span>
                <span className={cn('inline-flex shrink-0 items-center gap-1 text-xs font-medium', done ? 'text-emerald-300' : 'text-slate-300')}>
                  {done ? <Check className="size-3.5" strokeWidth={2.5} /> : <Clock3 className="size-3.5" />}
                  <LocalizedText text={done ? 'Confirmed' : 'Not confirmed yet'} />
                </span>
              </li>
            )
          })}
        </ul>
      </section>
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

const REVIEWER_TEXT_ACTION = 'ds-intrinsic inline-flex h-7 items-center gap-1 text-xs text-slate-400 transition-colors hover:text-white data-[popup-open]:text-white'

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
  // On a rollback agreement the reviewers are the people it affects, and
  // their sign-off is a confirmation.
  const statusLabels = conflict.rollback ? { pending: 'Not confirmed yet', approved: 'Confirmed' } : {}
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
        <p className="py-1.5 text-xs leading-[18px] text-slate-400">No reviewers yet</p>
      ) : (
        <div>
          {reviewers.map((reviewer) => {
            const person = allPeople.find((p) => p.id === reviewer.id)
            if (!person) return null
            const status = REVIEWER_STATUS[reviewer.status] ?? REVIEWER_STATUS.pending
            return (
              <Fragment key={reviewer.id}>
              <div className="group/rev -mx-1 flex h-8 min-w-0 items-center gap-2 rounded-md px-1 text-[13px] hover:bg-white/[0.03]">
                <PersonAvatar person={person} />
                <span className="min-w-0 flex-1 truncate font-medium text-slate-200">
                  {person.name}
                  {person.id === viewerId && <span className="font-normal text-slate-500"> (you)</span>}
                </span>
                <span className={cn('shrink-0 truncate text-xs font-medium', reviewer.id === author ? 'text-slate-400' : status.className)}>
                  {reviewer.id === author
                    ? 'Author'
                    : reviewer.status === 'pending' && reviewer.dismissedAt
                    ? 'Request dismissed'
                    : reviewer.status !== 'approved' && reviewer.remindedAt ? `Reminded ${reviewer.remindedAt}` : statusLabels[reviewer.status] ?? status.label}
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
                <Plus className="size-3.5" />
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
              <Bell className="size-3.5" />
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
// Waiting on someone else is the state people look for first, so it's a
// step up from the plain note: larger type and the in-review sky tint.
const WAITING_NOTE = 'inline-flex h-9 items-center gap-2 rounded-full bg-sky-400/[0.12] px-4 text-[13px] font-medium whitespace-nowrap text-sky-100 ring-1 ring-sky-400/35 ring-inset'

function ConflictModal({ conflict, onOpenChange, onUpdate, onApprove, onRequestChanges, onResolve, onRevert, onOpenMergeStudio, inMergeStudio = false }) {
  const workspace = useWorkspaceOptional()

  const severity = conflict?.severity ? (severityConfig[conflict.severity] ?? severityConfig.medium) : null

  // The review itself ('overview') or the History behind it, reset to the
  // review whenever a different conflict loads.
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

  // Apply a resolving side directly; otherwise open the relevant editor.
  function startFix(check) {
    if (!workspace) return
    setTab('overview')
    // Use the same decision path as selecting the named comparison card.
    const side = decisionState.resolvingSide(check.id)
    if (side) { decisionState.pick(side); return }
    // Nothing here does — it's adjusted on the canvas, where the same note
    // and a highlight on the element wait (see MergeCheckGuide).
    workspace.setCheckGuide({ conflictId: conflict.id, check })
    fixCheck(check)
  }

  // A required check can't be waived — an exception is asked of the
  // reviewers; it stops blocking once they've approved the change with it.
  function requestException(check) {
    update({ exceptionChecks: [...new Set([...(conflict.exceptionChecks ?? []), check.id])] })
    if (workspace) workspace.addComment(`Exception requested: ${check.title}`, { conflictId: conflict.id })
    toast('Exception requested', { description: 'It can merge once the reviewers approve the change.' })
  }

  function undoException(check) {
    update({ exceptionChecks: (conflict.exceptionChecks ?? []).filter((id) => id !== check.id) })
  }

  // Ship the change with this check as it is: it stops counting against
  // the merge, and stays listed so the decision can be undone.
  function acceptCheck(check) {
    update({ acceptedChecks: [...new Set([...(conflict.acceptedChecks ?? []), check.id])] })
    if (workspace?.checkGuide?.check.id === check.id) workspace.setCheckGuide(null)
    toast('Applying as is', { description: check.title })
  }

  function undoAcceptCheck(check) {
    update({ acceptedChecks: (conflict.acceptedChecks ?? []).filter((id) => id !== check.id) })
  }

  function fixCheck(check) {
    if (!workspace) return
    if (check.fileId || check.id === 'markers') { handleOpenFile(); return }
    if (driftItem && check.regionIds?.length && driftItem.variants?.length) {
      workspace.setDesignCompareRequest({ itemId: driftItem.id, keys: driftItem.variants.map((variant) => variant.key), regionId: check.regionIds[0] })
    } else if (driftItem) {
      workspace.requestMergeFocus({ itemId: driftItem.id, ...(check.layerId ? { layerId: check.layerId, pulse: true } : { overview: true }), keepDeck: true })
    }
    // Either way the panel steps aside: the canvas, the marked element and
    // the guide over it are what's needed now (the review is one click back).
    if (!inMergeStudio) onOpenMergeStudio?.(conflict, { collapsePanel: true })
    else workspace.setBottomPanel({ open: false })
  }

  function handleMerge() {
    if (onResolve) onResolve(conflict.id)
    else update({ reviewStage: 'resolved' })
  }

  function handleRunRollback() {
    if (!workspace?.runAgreedRollback(conflict.id)) return
    toast('Rolled back', { description: `${conflict.rollback.label} — everyone affected had confirmed.` })
  }

  function handleRevert() {
    if (onRevert) onRevert(conflict.id)
    else update({
      reviewStage: 'detected',
      diffInspected: false,
      reviewers: conflict.reviewers.map((r) => ({ ...r, status: 'pending' })),
    })
  }

  const stage = conflict?.reviewStage
  const checks = conflict && workspace?.conflictChecks ? workspace.conflictChecks(conflict) : null
  const driftItem = conflict ? driftItemOf(conflict, workspace) : null
  const decisionState = decisionStateOf({
    conflict, item: driftItem, workspace, checks, stage,
    mergedDecisions: stage === 'resolved' && conflict ? mergedDecisionsForConflict(conflict, workspace) : undefined,
  })
  const checkActions = {
    fixSideFor: (check) => decisionState.resolvingSide(check.id),
    onFix: stage !== 'resolved' && workspace ? startFix : undefined,
    onAccept: stage !== 'resolved' && onUpdate ? acceptCheck : undefined,
    onUndoAccept: stage !== 'resolved' && onUpdate ? undoAcceptCheck : undefined,
    onRequestException: stage !== 'resolved' && onUpdate ? requestException : undefined,
    onUndoException: stage !== 'resolved' && onUpdate ? undoException : undefined,
  }
  const checkBlocks = <CheckBlocks checks={checks} state={decisionState} actions={checkActions} />
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
  // A size adjusted in Merge Studio is part of the change: its lines carry
  // the new w-[…] / h-[…], so the diff below shows what will be merged.
  // (Its merge item is looked up directly: an element with the same size on
  // both sides has nothing to pick, but can still be resized.)
  const mergeItem = conflict ? workspace?.mergeItems?.find((m) => m.id === conflict.mergeItemId || m.conflictId === conflict.id) ?? null : null
  const adjustment = stage !== 'resolved' ? sizeAdjustmentOf(conflict, mergeItem, workspace?.mergeDrafts?.current) : null
  const changeAfter = adjustment ? (conflict?.diff?.after ?? []).map(adjustment.applyTo) : conflict?.diff?.after ?? []
  const generatedFile = fileLines && conflict.diff
    ? placeChange(fileLines, conflict.line, conflict.diff.before ?? [], changeAfter)
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
        <span className={WAITING_NOTE}>
          <Clock3 className="size-4 shrink-0 text-sky-300" />
          <LocalizedText text={waitingOn.join(' · ')} />
        </span>
      ) : null
    } else if (stage === 'approved' && conflict.rollback) {
      // Everyone affected confirmed — the rollback itself is the last step.
      primary = (
        <button type="button" onClick={handleRunRollback} className={cn(PRIMARY_BUTTON, 'gap-1.5')}>
          <RotateCcw className="size-3.5" />
          <LocalizedText text="Run rollback" />
        </button>
      )
    } else if (stage === 'resolved' && conflict.rollback) {
      primary = null
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
            <div className="flex h-12 shrink-0 items-center gap-3 bg-card px-3">
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
                {!conflict.rollback && <span className="shrink-0 font-mono text-[10px] font-medium text-slate-500">#{conflict.id}</span>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {/* History took the review's place — the way back sits up
                    here with the title, not on a row of its own. */}
                {tab === 'history' && (
                  <button
                    type="button"
                    onClick={() => openTab('overview')}
                    className="ds-intrinsic inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-white/[0.07] pr-3.5 pl-2 text-xs font-medium whitespace-nowrap text-slate-100 transition-colors hover:bg-white/[0.12] hover:text-white"
                  >
                    <ChevronLeft className="size-4" />
                    <LocalizedText text="Back to review" />
                  </button>
                )}
                {primary}
              </div>
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto px-3 pt-0 pb-3">
              <div className={cn(
                'grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-auto pt-1 xl:grid-cols-[minmax(0,1fr)_360px] xl:overflow-auto',
                REVIEW_GUTTER
              )}>
                <div className="flex min-h-0 min-w-0 flex-col overflow-auto" role="tabpanel">
                  {tab === 'overview' ? (
                    <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 items-stretch gap-3 xl:flex xl:items-stretch">
                      {/* A rollback with nothing to detail has no left card —
                          the middle takes the room. */}
                      {!(conflict.rollback && !conflict.rollback.target && !conflict.rollback.label) && <section className={cn('flex min-w-0 flex-col overflow-hidden p-3', REVIEW_CARD, 'xl:w-[30%] xl:min-w-[220px] xl:max-w-[320px] xl:shrink-0')}>
                        <div className="min-h-0 min-w-0 flex-1 overflow-auto">
                          <OverviewTab
                            conflict={conflict}
                            severity={severity}
                            stage={stage}
                            showProject={!workspace}
                            blockedCount={decisionState.required.length}
                            adjustment={adjustment}
                            onOpenHistory={conflict.rollback ? undefined : () => openTab('history')}
                          />
                        </div>
                      </section>}
                      <section className={cn('flex min-w-0 flex-col overflow-hidden p-3', REVIEW_CARD, 'xl:flex-1', )}>
                        <div className="min-h-0 min-w-0 flex-1 overflow-auto">
                          {conflict.rollback ? (
                            <RollbackAgreement conflict={conflict} />
                          ) : driftItem && draftColumns(driftItem) ? (
                            <DraftTable
                              conflict={conflict}
                              workspace={workspace}
                              item={driftItem}
                              editable={false}
                              decisionsOverride={stage === 'resolved' ? mergedDecisionsForConflict(conflict, workspace) ?? {} : undefined}
                              compareLabel={inMergeStudio ? 'Compare on canvas' : 'Compare in Merge Studio'}
                              onCompare={stage === 'resolved' ? null : () => {
                                // Merge Studio opens on the item with every draft side by side.
                                workspace.setDesignCompareRequest({ itemId: driftItem.id, keys: driftItem.variants.map((v) => v.key) })
                                if (!inMergeStudio) onOpenMergeStudio?.(conflict)
                              }}
                            />
                          ) : (
                          <DiffTab
                            conflict={conflict}
                            code={codeView}
                            mergedLines={mergedLinesForConflict(conflict, workspace)}
                            adjustment={adjustment}
                            changeAfter={changeAfter}
                            onUndoAdjustment={adjustment && workspace?.resetLayerSize ? () => {
                              workspace.resetLayerSize(mergeItem.id, conflict.layerId)
                              // A seeded "settled by hand" record goes back to open with it.
                              if (conflict.resolution === 'manual') update({ resolution: null, adjustment: null })
                            } : undefined}
                            state={decisionState}
                            checks={checks}
                            checkActions={checkActions}
                            checkBlocks={checkBlocks}
                            // The one way into Merge Studio. With a fix
                            // guide open it goes there for that check (the
                            // element marked, the guide kept on the canvas).
                            studioAction={stage !== 'resolved' && onOpenMergeStudio && !inMergeStudio
                              ? { label: 'Adjust in Merge Studio', onClick: () => onOpenMergeStudio(conflict) }
                              : null}
                          />
                          )}
                          {/* Drafts mixed by part have no comparison card —
                              their checks sit under the table instead. */}
                          {!conflict.rollback && driftItem && draftColumns(driftItem) && <div className="mt-3">{checkBlocks}</div>}
                        </div>
                      </section>
                    </div>
                  ) : (
                    <div className="flex min-h-0 flex-1">
                      <ConflictHistoryReplay conflict={conflict} workspace={workspace} />
                    </div>
                  )}
                </div>

                {/* One panel on the right: reviewers, a hairline, then the
                    discussion — not two boxes stacked. (A rollback agreement
                    lists who it affects in the middle, so this is comments
                    only.) */}
                <div className={cn('flex h-full min-h-0 min-w-0 flex-col', REVIEW_CONTEXT_CARD)}>
                  {!conflict.rollback && (
                    <section className="mb-3 max-h-48 shrink-0 overflow-auto border-b border-white/[0.07] pb-3">
                      <p className={cn(PANEL_LABEL, 'mb-2')}><LocalizedText text="Reviewers" /></p>
                      <ReviewersSection conflict={conflict} onUpdate={update} onDismiss={workspace?.dismissChangeRequest} />
                    </section>
                  )}
                  <div className="flex min-h-0 flex-1 flex-col">
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
