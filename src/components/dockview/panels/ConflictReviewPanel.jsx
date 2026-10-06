import { checkGuidance } from '@/components/conflicts/CheckExplanation'
import { comparisonBlockers } from '@/lib/driftDecisions'
import { NAV_BUTTON, NAV_BUTTON_ICON } from '@/components/conflicts/ConflictBadges'
import { Fragment, useEffect, useEffectEvent, useRef, useState } from 'react'
import {
  ArrowRight,
  Ban,
  Bell,
  Check,
  ChevronDown,
  CircleCheck,
  FileCode2,
  ChevronLeft,
  Clock3,
  GitMerge,
  Layers3,
  Pencil,
  MapPin,
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
const personNameOf = (id) => allPeople.find((person) => person.id === id)?.name ?? null
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { allPeople, canvasPages, currentUserFor, projectFileSets } from '@/data/mockData'
import { composeDraftFrame, draftScreens, regionPicks } from '@/data/draftScreens'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { mergedSizeAdjustment, sizeAdjustmentOf, studioAdjustmentsOf } from '@/lib/sizeAdjustment'
import { mergeResultOf } from '@/lib/mergeResult'
import { foldConflictCheckpoints, withBranches } from '@/lib/historyBranches'
import { useNavigate } from 'react-router-dom'
import { draftColumns, draftRows, driftRowsFor } from '@/lib/driftDecisions'
import {
  approvalStatus,
  requiredReviewers,
  authorOf,
  conflictRef,
  listStatusOf,
  gitFlowOf,
  shortDue,
} from '@/lib/conflicts'
import ChangePreview from '@/components/conflicts/ChangePreview'
import { checksFor } from '@/components/mergestudio/mergeChecks'
import { CheckDecisions } from '@/components/conflicts/CheckDecisions'
import { diffLines } from '@/lib/lineDiff'
import { ROLLBACK_REASON, ROLLBACK_STAGE_LABEL } from '@/lib/rollbackImpact'
import { toast } from '@/i18n/toast'
import { useWorkspaceOptional } from '@/state/WorkspaceProvider'
import { ConflictActivityList, ConflictReplay, useConflictActivity } from '@/components/dockview/panels/ConflictHistoryReplay'
import { InlineDeviationReason, ReasonField, RulesDialog } from '@/components/conflicts/Rationale'
import { ADJUSTMENT_REASONS, DEVIATION_REASONS } from '@/lib/rationale'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { rationaleOf, standardOf } from '@/lib/rationale'
import { openOrFocusPanel, panelById } from '@/components/dockview/dockPanels'
import ConflictCodeView, { placeChange } from '@/components/conflicts/ConflictCodeView'
import {
  ACCENT_CTA,
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
  pending: { label: 'Pending', className: 'text-slate-200' },
  approved: { label: 'Approved', className: 'text-emerald-300' },
  changes_requested: { label: 'Changes requested', className: 'text-amber-400' },
}

const REVIEW_GUTTER = 'gap-3'
const REVIEW_CARD = 'rounded-xl bg-white/[0.03]'
const REVIEW_CONTEXT_CARD = cn(REVIEW_CARD, 'ds-review-context')
const REVIEW_INFO_LABEL = 'text-xs leading-[18px] font-medium text-slate-400'

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

// `outcome`: on a card that can be picked, what picking it does — one line
// under the title.
function ComparisonSource({ label, source, outcome, strong = false }) {
  return (
    <div className="min-w-0">
      {/* One title line — which side, and what picking it does. */}
      <p className={cn('truncate font-medium', outcome || strong ? 'text-xs leading-5 text-white' : 'text-[10px] text-slate-300')}>
        <LocalizedText text={label} />
        {outcome && <span data-card-outcome className="font-normal text-slate-300"> · <LocalizedText text={outcome} /></span>}
      </p>
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

// Where the change is and where it came from — the review's folded
// Details: Location (branch, components, files). Who changed it and what
// detected it is part of its trail — the Activity tab's.
function ReviewDetails({ conflict, showProject, open }) {
  const { impact } = conflict
  const primaryFile = conflict.file ? `${conflict.file}${conflict.line ? `:${conflict.line}` : ''}` : null
  const files = [...new Set([primaryFile, ...(impact?.files ?? []).filter((file) => file !== conflict.file)].filter(Boolean))]
  const components = impact?.components ?? []
  const flow = gitFlowOf(conflict)
  const author = allPeople.find((person) => person.id === authorOf(conflict))?.name ?? (conflict.changedBy?.type === 'ai' ? 'Devsign AI' : 'Devsign')

  // Rows of the summary's own grid — the same label column and value
  // column as Cause and Impact above them, not a list indented under the
  // toggle. Every row is always there: an empty one reads "—". Only the
  // file paths are monospace.
  return [
    showProject && conflict.projectName && ['Project', <LocalizedText key="p" text={conflict.projectName} />],
    ['Branch', <span key="b" translate="no">{flow ? `${flow.source} → ${flow.target}` : '—'}</span>],
    ['Components', <span key="c" translate="no">{components.join(', ') || '—'}</span>],
    ['Files', <span key="f" translate="no" className={files.length > 0 ? 'font-mono text-[11.5px]' : undefined}>{files.join(', ') || '—'}</span>],
    ['Author · Updated', (
      <>
        <span translate="no">{author}</span>
        <span className="text-slate-500"> · <LocalizedText text={conflict.resolvedAtLabel ?? conflict.timestamp ?? conflict.detectedAt ?? '—'} /></span>
      </>
    )],
    ['Due date', open && shortDue(conflict.dueLabel) ? <LocalizedText key="d" text={conflict.dueLabel} /> : '—'],
  ].filter(Boolean).map(([label, value]) => (
    <Fragment key={label}>
      <dt data-detail-label className={SUMMARY_ROW_LABEL}><LocalizedText text={label} /></dt>
      <dd data-detail-value className={INFO_VALUE}>{value}</dd>
    </Fragment>
  ))
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
const RESULT_WIDTH = 180

function DraftTable({ conflict, workspace, item, editable, onCompare, compareLabel, decisionsOverride }) {
  const decisions = decisionsOverride ?? workspace.decisionsFor(item.id)
  const rows = draftRows(conflict, item, decisions)
  const decided = rows.filter((row) => row.decided).length
  const decide = (row, option) => workspace.decideDrift(item.id, row.key, option.picked ? null : option.decision)
  // Drafts mixed by screen region: the picks composed into the one screen
  // they make (parts not picked fall back to the first draft, as merging does).
  const base = draftScreens[item.id] && canvasPages.find((page) => page.id === item.designPageId)?.frames[0]
  const result = base ? composeDraftFrame(item.id, base, regionPicks(item.id, decisions), item.authorAId ?? item.variants?.[0]?.key) : null
  const resultHeight = result ? Math.max(120, ...result.layers.map((layer) => (layer.y ?? 0) + (layer.height ?? 0))) + 16 : 0
  const resultScale = RESULT_WIDTH / 280
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
      <div className="flex min-h-0 flex-1 gap-4 overflow-auto">
      {/* Where each part came from, then — at the card's right, like the
          Activity tab's preview — the mix as the one screen merging makes. */}
      {result && (
        <figure data-mix-result className="order-last shrink-0 border-l border-white/[0.06] pl-4">
          <figcaption className="mb-1.5 text-[11px] font-medium text-slate-400"><LocalizedText text="Merged result" /></figcaption>
          <div className="relative overflow-hidden rounded-xl bg-white" style={{ width: RESULT_WIDTH, height: resultHeight * resultScale }}>
            <div className="pointer-events-none absolute top-0 left-0 origin-top-left" style={{ width: 280, height: resultHeight, transform: `scale(${resultScale})` }}>
              {result.layers.map((layer) => <StaticLayer key={layer.id} layer={layer} onSelect={() => {}} />)}
            </div>
          </div>
        </figure>
      )}
      <div className="min-h-0 min-w-0 flex-1 divide-y divide-white/[0.05] overflow-auto">
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
// The summary's two text styles: body, and the small grey label over it.
const SUMMARY_ROW_LABEL = 'text-[11px] leading-[18px] whitespace-nowrap text-slate-500'

// One section of the Info tab: a hairline above (not on the first), a small
// grey title with an optional count, and — when it folds — the whole header
// as the toggle with its arrow at the right.
const INFO_SECTION = 'border-t border-white/[0.07] py-3 first:border-t-0 first:pt-0'
const INFO_TITLE = 'text-[11px] leading-4 text-slate-400'
const INFO_BADGE = 'inline-flex h-7 items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 text-xs font-semibold whitespace-nowrap'
const INFO_VALUE = 'text-xs leading-[18px] break-words text-slate-200 [overflow-wrap:anywhere]'
const STATUS_TEXT = { detected: 'text-slate-200', in_review: 'text-sky-300', pending_merge: 'text-emerald-300', pending_rollback: 'text-amber-300', done: 'text-violet-300' }
const RISK_TEXT = { high: 'text-rose-300', medium: 'text-amber-300', low: 'text-sky-300' }
// A value that goes somewhere — a Figma frame (the element on the canvas),
// a token (where it's defined), WCAG (its page) — as a quiet inline link.
function InfoLink({ item, onOpen, literal = false }) {
  return (
    <button type="button" data-info-link={item.kind} onClick={() => onOpen?.(item)} className="ds-intrinsic inline cursor-pointer text-left text-slate-200 underline decoration-white/25 underline-offset-2 transition-colors hover:text-white hover:decoration-white/60 focus-visible:outline-2 focus-visible:outline-emerald-300">
      {literal ? <span translate="no">{item.label}</span> : <LocalizedText text={item.label} />}
    </button>
  )
}

// A label and its value, as a row of the Info tab's grid.
function Row({ label, children, ...rest }) {
  return (
    <>
      <dt className={SUMMARY_ROW_LABEL}><LocalizedText text={label} /></dt>
      <dd className={INFO_VALUE} {...rest}>{children}</dd>
    </>
  )
}

function InfoSection({ title, count, open, onToggle, toggleProps, sectionRef, children, className }) {
  const heading = title && (
    <>
      <span className={INFO_TITLE}><LocalizedText text={title} /></span>
      {count != null && <span data-info-count className="text-[11px] leading-4 text-slate-200 tabular-nums">{count}</span>}
    </>
  )
  return (
    <section ref={sectionRef} data-info-section={title ?? 'Status'} className={cn(INFO_SECTION, 'scroll-mb-3', className)}>
      {title && (onToggle ? (
        <button type="button" aria-expanded={Boolean(open)} onClick={onToggle} {...toggleProps} className={cn('ds-intrinsic flex w-full cursor-pointer items-center gap-1.5 text-left transition-colors hover:text-white', open && 'mb-2')}>
          {heading}
          <ChevronDown className={cn('ml-auto size-3.5 text-slate-400 transition-transform', open && 'rotate-180')} />
        </button>
      ) : <div className="mb-1 flex items-center gap-1.5">{heading}</div>)}
      {children}
    </section>
  )
}

function OverviewTab({ conflict, severity, stage, showProject, blockedCount, adjustment, checks, rationale, onOpenEvidence, cause, onOpenCause, onUpdateReviewers, onDismissRequest, reasonNeeded = false }) {
  // Where it is and who made it: folded until asked for. Opening it brings
  // it into view — it sits at the foot of a panel that scrolls, so without
  // that the arrow turned and nothing seemed to happen.
  const [showDetails, setShowDetails] = useState(false)
  const detailsRef = useRef(null)
  useEffect(() => {
    if (showDetails) detailsRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [showDetails])
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
  // Why this difference matters: the conflict's own words, else what its
  // first failing check says. (How to resolve it is the comparison's line.)
  const why = conflict.effect ?? conflict.uxNote ?? rationale?.why?.text ?? riskExplanation ?? checkGuidance(checks?.failing[0])?.impact
  const standard = rationale ? standardOf(rationale.rules, checks) : null
  // Why it conflicts: its own account when it has one, else what was found.
  const cause_text = conflict.cause ?? conflict.message ?? summary

  // What the viewer has to do now — and only that: nothing shows when the
  // next move is someone else's. (A review that's yours to give is said on
  // the Review button itself.)
  const todo = stage === 'resolved' ? null
    : reasonNeeded ? null
      : blockedCount > 0 ? `Resolve ${blockedCount} required standard${blockedCount === 1 ? '' : 's'}`
        : stage === 'detected' ? 'Review request needed'
          : stage === 'approved' ? (conflict.rollback ? 'Ready to roll back' : 'Ready to merge') : null
  const status = listStatusOf(conflict)
  // One label column for the whole tab: every row's label starts at the
  // same x, and so does every value.
  const GRID = 'grid min-w-0 grid-cols-[minmax(64px,max-content)_minmax(0,1fr)] items-baseline gap-x-3 gap-y-2'
  const list = (items) => items.map((text, index) => <Fragment key={text}>{index > 0 && ' · '}<LocalizedText text={text} /></Fragment>)

  return (
    // The sidebar's Info tab, as four groups under equal hairlines — Status,
    // Problem, Evidence, Review — then Details. Labels are one small grey
    // column; values the default color.
    <div data-review-info className="flex min-h-full flex-col">
      {/* 1 · Status: where it stands, how risky, how binding — as badges —
          and, under them, the one thing to do (when there is one). */}
      <InfoSection>
        <div data-status-badges className="flex flex-wrap items-center gap-1.5">
          <span data-status-badge className={cn(INFO_BADGE, STATUS_TEXT[status.id])}>
            <span className={cn('size-1.5 shrink-0 rounded-full', status.dot)} />
            <LocalizedText text={conflict.rollback ? ROLLBACK_STAGE_LABEL[stage] : status.label} />
          </span>
          {severity && (
            <span data-risk-badge className={cn(INFO_BADGE, RISK_TEXT[severity.label.toLowerCase()])}>
              <span className="font-normal text-slate-400"><LocalizedText text="Risk" /></span>
              <LocalizedText text={severity.label} />
            </span>
          )}
          {/* Whether it can merge is said only when it can't: a red badge,
              with why on hover. (How binding the rule is sits quietly on
              the Rule line below.) */}
          {blockedCount > 0 && (
            <Tooltip>
              <TooltipTrigger render={<span data-blocked-badge tabIndex={0} className={cn(INFO_BADGE, 'bg-rose-500/15 text-rose-300')} />}>
                <LocalizedText text="Can’t merge" />
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" className="text-xs"><LocalizedText text="It can’t be merged: a required rule isn’t kept." /></TooltipContent>
            </Tooltip>
          )}
          {isAiDraft && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><Sparkles className="size-3 shrink-0" aria-hidden /><LocalizedText text="AI draft" /></span>
          )}
        </div>
        {todo && <p data-next-step className={cn(INFO_VALUE, 'mt-2')}><LocalizedText text={todo} /></p>}
        {conflict.rollback && open && shortDue(conflict.dueLabel) && <p className={cn(INFO_VALUE, 'mt-1 text-slate-400')}><DueDate label={conflict.dueLabel} /></p>}
        {conflict.rollback && summary && <p className={cn(INFO_VALUE, 'mt-2')}><LocalizedText text={summary} /></p>}
      </InfoSection>

      {/* 2 · Problem: why it conflicts — with a small link to the version
          it came in with, right under — and what goes wrong if it stays. */}
      {!conflict.rollback && (cause_text || why || standard) && (
        <InfoSection className="border-t-0 pt-1">
          <dl data-info-problem className={GRID}>
            {cause_text && (
              <Row label="Cause" data-summary-row="Cause">
                <LocalizedText text={cause_text} />
                {cause && (
                  <button
                    type="button"
                    data-cause-version
                    data-open-cause-history
                    onClick={onOpenCause}
                    title="View origin version in History"
                    className="ds-intrinsic group mt-1 flex w-fit cursor-pointer items-center gap-1 rounded py-0.5 text-left text-slate-400 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                  >
                    <span className="text-[11px] font-medium leading-4"><LocalizedText text="View origin version" /></span>
                    <ArrowRight className="size-3 shrink-0" />
                  </button>
                )}
              </Row>
            )}
            {(why || standard) && <Row label="Impact" data-summary-row="Impact">{list(why ? [why] : standard.consequence)}</Row>}
          </dl>
        </InfoSection>
      )}

      {/* 3 · Standard: always open, three lines — the rule (its token a
          link to where it's defined, its grade a quiet tag), where it comes
          from (the Figma frame a link) and what it's for. No chip list, no
          count; comments are the Comments tab's. */}
      {!conflict.rollback && standard && (
        <InfoSection title="Standard">
          <dl data-info-standard className={GRID}>
            <Row label="Rule">
              {standard.rules.map((rule, index) => (
                <Fragment key={rule.id}>
                  {index > 0 && ' · '}
                  <LocalizedText text={rule.name} />
                  {rule.tokens.map((token) => (
                    <Fragment key={token.label}>{' '}<InfoLink item={token} onOpen={onOpenEvidence} literal /></Fragment>
                  ))}
                </Fragment>
              ))}
              <span data-rule-grade className="ml-1.5 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10.5px] leading-none whitespace-nowrap text-slate-400">
                <LocalizedText text={standard.required ? 'Required rule' : 'Recommended rule'} />
              </span>
            </Row>
            <Row label="Source">
              {[...standard.origins.map((text) => <LocalizedText key={text} text={text} />), ...standard.links.map((link) => <InfoLink key={link.label} item={link} onOpen={onOpenEvidence} literal={link.kind === 'wcag'} />)]
                .flatMap((node, index) => (index ? [' · ', node] : [node]))}
            </Row>
            <Row label="What it’s for">{list(standard.purpose)}</Row>
          </dl>
        </InfoSection>
      )}

      {/* 4 · Review: one header — reviewers and approvals so far, + to add
          one — over the progress bar and the list. */}
      {!conflict.rollback && onUpdateReviewers && (
        <section data-info-section="Review" className={INFO_SECTION}>
          <ReviewersSection sectioned conflict={conflict} onUpdate={onUpdateReviewers} onDismiss={onDismissRequest} />
        </section>
      )}

      {/* Details: folded; its rows share the same label column. */}
      <InfoSection sectionRef={detailsRef} title="Details" open={showDetails} onToggle={() => setShowDetails((value) => !value)} toggleProps={{ 'data-details-toggle': '' }}>
        {showDetails && (
          <dl data-review-summary className={GRID}>
            {conflict.rollback ? [
              ['Target file', <span key="f" translate="no" className="font-mono text-[11.5px] break-all">{conflict.rollback.target}</span>],
              ['Roll back to', <><LocalizedText text={conflict.rollback.label} />{conflict.rollback.timestamp && <span className="text-slate-400"> · <LocalizedText text={conflict.rollback.timestamp} /></span>}</>],
              requester && ['Requested by', <>{requester.name}<span className="text-slate-400"> · <LocalizedText text={requester.role} /></span></>],
            ].filter(Boolean).map(([label, value]) => <Row key={label} label={label}>{value}</Row>) : <ReviewDetails conflict={conflict} showProject={showProject} open={open} />}
          </dl>
        )}
      </InfoSection>
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
function decisionStateOf({ conflict, item, workspace, checks, stage, mergedDecisions, onPickSide }) {
  const open = stage !== 'resolved'
  const rows = item ? driftRowsFor(conflict, item).filter((row) => row.diff) : []
  const decisions = item ? (open ? workspace.decisionsFor(item.id) : mergedDecisions ?? {}) : {}
  const all = (decision) => rows.length > 0 && rows.every((row) => decisions[row.key] === decision)
  // Two sides with the same values have no value to decide between — but
  // which side merges is still a choice. It's kept on the conflict itself
  // (`pickedSide`), so those cards work as radio options like any other.
  const sideOnly = rows.length === 0 && Boolean(conflict?.comparisonFields?.length)
  const side = sideOnly ? conflict.pickedSide ?? null : all('A') ? 'A' : all('B') ? 'B' : null
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
    rows, side, label, open, sideOnly,
    canPick: open && (rows.length > 0 || (sideOnly && Boolean(onPickSide))),
    pick: (decision) => (sideOnly ? onPickSide(decision) : rows.forEach((row) => workspace.decideDrift(item.id, row.key, decision))),
    undo: () => (sideOnly ? onPickSide(null) : rows.forEach((row) => workspace.decideDrift(item.id, row.key, null))),
    // Neither side passes what's required: picking a card can't settle it.
    bothFail: required.length > 0 && required.every((check) => resolvingSide(check.id) === null),
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
// `result` (lib/mergeResult): what merges — the picked side with whatever
// was set by hand in Merge Studio; the code below is read from it.
// `flow`: the resolution as one top-to-bottom pass — choose a way (three
// cards: the design reference, the current value, a value set by hand),
// say why, see the code, decide:
//   { choice, editing, decided, canChange, choose, custom, openStudio,
//     reason, decide, changeDecision }
const HAND_VALUE = 'flex min-w-0 flex-wrap items-baseline justify-end gap-x-1.5 text-right text-[13px] leading-5 font-semibold tabular-nums'
const TEXT_ACTION = 'ds-intrinsic inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-full px-1.5 text-xs font-medium whitespace-nowrap text-slate-400 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300'

function DiffTab({ conflict, code, flow, mergedLines, changeAfter, state, checks, checkActions, checkBlocks, codeChange }) {
  const readOnly = conflict.reviewStage === 'resolved'
  // Finished: the merged code around the change (the file's own lines when
  // there are any, else the change's result), and the toggle to the
  // conflict as it was.
  const [showBefore, setShowBefore] = useState(false)
  const mergedFile = mergedLines ?? conflict.mergedFileLines ?? code?.generated ?? null
  const mergedExcerpt = (() => {
    const after = conflict.diff?.after ?? []
    if (!mergedFile?.length) return after.map((text, index) => ({ number: (conflict.line ?? 1) + index, text }))
    // Where the merged lines actually are (the file may have shifted).
    const found = mergedFile.findIndex((text) => after.length && text.trim() === after[0].trim())
    const at = found >= 0 ? found : Math.max(0, (conflict.line ?? 1) - 1)
    const from = Math.max(0, at - 2)
    return mergedFile.slice(from, at + Math.max(after.length, 1) + 2).map((text, index) => ({ number: from + index + 1, text }))
  })()
  const waiting = requiredReviewers(conflict).filter((reviewer) => reviewer.status !== 'approved').length
  // (Terse, like the summary beside it — statements, not sentences.)
  const reviewState = conflict.reviewStage === 'detected' ? 'Before the review request'
    : conflict.reviewStage === 'approved' ? 'Every reviewer approved'
      : waiting ? `Waiting on ${waiting} reviewer${waiting === 1 ? '' : 's'}` : 'In review'
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
  // The three ways to resolve it, as cards. Each header is two lines: what
  // choosing it does, then where its values come from.
  const designReference = sources?.[1]?.label === 'Design reference'
  const custom = flow?.custom ?? null
  const cards = [
    { id: 'A', side: 'after', title: designReference ? 'Change to the design reference' : 'Remote branch', source: sources?.[1]?.source, value: (field) => field.expected },
    { id: 'B', side: 'before', title: designReference ? 'Keeps the current value' : 'Local branch', source: sources?.[0]?.source, value: (field) => field.current },
    { id: 'C', side: custom?.side === 'A' ? 'after' : 'before', title: 'Adjust by hand', source: 'You set the values yourself' },
  ]
  const choice = flow?.choice ?? null
  const chosen = cards.find((card) => card.id === choice) ?? null
  const editing = Boolean(flow?.editing)
  // Red only for a value that breaks the standard, green for one that
  // matches it, plain for anything else (a value both sides share, one set
  // by hand to something of its own).
  const toneOf = (text, field) => (readOnly || field.current === field.expected ? 'text-slate-200'
    : text === field.expected || String(field.expected).toLowerCase().includes(String(text).toLowerCase()) ? 'text-emerald-200'
      : text === field.current ? 'text-red-300' : 'text-slate-100')
  const swatchIn = (text) => /#[0-9a-fA-F]{3,8}\b/.exec(text ?? '')?.[0]
  const reasonCount = (flow?.reason?.value ?? '').split(' · ').filter(Boolean).length

  return (
    <div className="flex h-full flex-col">
      {/* ① The section's title: what to do here — fixed while choosing,
          the outcome once decided — and where the review stands. */}
      {pairedPreview && flow && !readOnly && (
        <div className="mb-3 flex min-w-0 items-center gap-2">
          <p data-pick-guide={choice ?? 'none'} className="min-w-0 flex-1 text-xs leading-5 text-slate-300">
            <span className="text-[13px] font-semibold text-white">
              {flow.decided ? <><LocalizedText text="Decided" />{chosen && <> · <LocalizedText text={chosen.title} /></>}</> : <LocalizedText text="Choose how to resolve it" />}
            </span>
            <span className="text-slate-500"> · </span><LocalizedText text={reviewState} />
          </p>
          {flow.canChange && (
            <button type="button" data-change-decision onClick={flow.changeDecision} className={TEXT_ACTION}>
              <LocalizedText text="Change decision" />
            </button>
          )}
        </div>
      )}
      {!pairedPreview && flow?.editing && flow.openStudio && (
        <div className="mb-3 flex min-w-0 items-center">
          <button type="button" title="Adjust the design in Merge Studio. This doesn't approve or merge the change." onClick={flow.openStudio} className={cn(NAV_BUTTON, 'ml-auto')}>
            <LocalizedText text="Adjust in Merge Studio" />
            {/* Merge Studio is a screen of this app: →, not ↗. */}
            <ArrowRight className={NAV_BUTTON_ICON} />
          </button>
        </div>
      )}
      {(conflict.preview || conflict.comparisonFields?.length > 0 || conflict.diff || conflict.suggestion) && (
        <section className="min-w-0 flex-1">
          <div className="flex flex-col gap-3">
            {pairedPreview ? (<>
              {/* ② One of three, like radio options, all the same height:
                  the picked one in green with a check, the others with an
                  empty ring. Decided: the chosen one stands, the rest fade. */}
              <div role="radiogroup" aria-label="해결 방법 선택" className="grid grid-cols-3 gap-2">
                {cards.map((card) => {
                  const on = choice === card.id
                  const isCustom = card.id === 'C'
                  const empty = isCustom && !custom
                  const choose = editing && !on ? () => flow.choose(card.id) : undefined
                  // A card with nothing to choose (no way into the studio).
                  const inert = !choose || (empty && !flow.openStudio)
                  return (
                  <div key={card.id} className={cn(
                    'min-w-0 overflow-hidden rounded-xl border transition-colors',
                    readOnly ? (on ? 'border-white/40 bg-white/[0.04]' : 'border-white/10 opacity-50')
                      : on ? 'border-emerald-300 bg-emerald-400/[0.06]'
                        : cn(empty ? 'border-dashed border-white/20' : 'border-white/10', !editing && 'opacity-50'),
                    !inert && 'hover:border-white/35'
                  )} data-applied={readOnly && on ? '' : undefined}>
                  <div
                    role="radio"
                    aria-checked={on}
                    aria-disabled={inert}
                    tabIndex={inert ? -1 : 0}
                    onClick={inert ? undefined : choose}
                    onKeyDown={(event) => {
                      if (inert || event.target !== event.currentTarget || (event.key !== ' ' && event.key !== 'Enter')) return
                      event.preventDefault()
                      choose()
                    }}
                    data-side={card.side}
                    data-decision={card.id}
                    className={cn(
                      // 16px inside, 12px between its parts.
                      'flex h-full min-w-0 flex-col gap-3 rounded-xl p-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-300',
                      !inert && 'cursor-pointer'
                    )}>
                    <div className="flex min-w-0 items-start gap-2">
                      {/* What choosing it does, then where the values are from. */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs leading-5 font-semibold text-white"><LocalizedText text={card.title} /></p>
                        <p className="truncate text-[10px] text-slate-500" title={card.source}><LocalizedText text={card.source} /></p>
                        {/* This side passes what the other one fails. (Under
                            the title — three across, there's no room beside it.) */}
                        {!isCustom && state.meets[card.id] && !readOnly && (
                          <span className="mt-1.5 inline-block rounded bg-white/[0.08] px-1.5 py-0.5 text-[10.5px] leading-none font-medium text-slate-200">
                            <LocalizedText text="Meets the design standard" />
                          </span>
                        )}
                      </div>
                      {/* Finished: which card it was merged with. */}
                      {readOnly && on && (
                        <span data-applied-tag className="shrink-0 rounded bg-white/[0.1] px-1.5 py-0.5 text-[10.5px] leading-none font-medium text-white">
                          <LocalizedText text="Applied" />
                        </span>
                      )}
                      {isCustom && custom && editing && flow.openStudio && (
                        <button type="button" data-adjust-edit onClick={(event) => { event.stopPropagation(); flow.openStudio() }} className={cn(TEXT_ACTION, '-my-1 h-7')}>
                          <Pencil className="size-3 shrink-0" />
                          <LocalizedText text="Edit" />
                        </button>
                      )}
                      {/* Picked: a check. Not picked: an empty ring. */}
                      {!readOnly && (
                        <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center">
                          {on ? <Check className="size-5 text-emerald-300" strokeWidth={2.5} /> : editing && <span className="size-4 rounded-full border border-white/30" />}
                        </span>
                      )}
                    </div>
                    {empty ? (
                      // Nothing set yet: the way into Merge Studio (the
                      // whole card does the same).
                      <div className="flex min-h-24 flex-1 items-center justify-center">
                        {editing && flow.openStudio && (
                          <span data-adjust-start className={cn(NAV_BUTTON, 'pointer-events-none bg-transparent')}>
                            <Plus className={NAV_BUTTON_ICON} />
                            <LocalizedText text="Set the values yourself" />
                          </span>
                        )}
                      </div>
                    ) : (<>
                    <ChangePreview preview={conflict.preview} side={card.side} showLabels={false} override={isCustom ? custom.preview : undefined} />
                    <dl className="min-w-0 space-y-2">
                      {conflict.comparisonFields.map((field, index) => {
                        // Set by hand: what it was → what it is.
                        const hand = isCustom && custom.rows[index]?.to ? custom.rows[index] : null
                        const text = isCustom ? custom.rows[index]?.base ?? field.current : card.value(field)
                        // A color value gets its swatch beside it.
                        const swatch = hand ? hand.swatch : swatchIn(text)
                        return (
                        <div key={field.label} className="flex min-w-0 items-baseline justify-between gap-3">
                          <dt className="min-w-0 truncate text-[11.5px] text-slate-400"><LocalizedText text={field.label} /></dt>
                          {hand ? (
                            <dd data-adjusted-value className={HAND_VALUE}>
                              <span className="font-normal text-slate-500 line-through"><LocalizedText text={hand.base} /></span>
                              <span aria-hidden className="font-normal text-slate-500">→</span>
                              {swatch && <span aria-hidden className="size-3 shrink-0 self-center rounded-full ring-1 ring-white/30" style={{ background: swatch }} />}
                              <span translate="no" className={toneOf(hand.to, field)}>{hand.to}</span>
                            </dd>
                          ) : (
                          <dd className={cn('flex min-w-0 items-center justify-end gap-1.5 text-right text-[13px] leading-5 font-semibold break-words tabular-nums', toneOf(text, field))}>
                            {swatch && <span aria-hidden className="size-3 shrink-0 rounded-full ring-1 ring-white/30" style={{ background: swatch }} />}
                            <span className="min-w-0"><LocalizedText text={text} /></span>
                          </dd>
                          )}
                        </div>
                        )
                      })}
                      {/* Set by hand on something the comparison doesn't
                          list (another property, another element) — the
                          same "old → new" form. */}
                      {isCustom && custom.extras.map((change) => (
                        <div key={`${change.layerName ?? ''}:${change.label}`} data-adjusted-row className="flex min-w-0 items-baseline justify-between gap-3">
                          <dt className="min-w-0 truncate text-[11.5px] text-slate-400">
                            {change.layerName && <><LocalizedText text={change.layerName} /> · </>}
                            <LocalizedText text={change.label} />
                          </dt>
                          <dd translate="no" className={HAND_VALUE}>
                            {change.from && <>
                              <span className="font-normal text-slate-500 line-through">{change.from}</span>
                              <span aria-hidden className="font-normal text-slate-500">→</span>
                            </>}
                            {change.swatch && <span aria-hidden className="size-3 shrink-0 self-center rounded-full ring-1 ring-white/30" style={{ background: change.swatch }} />}
                            <span className="text-slate-100">{change.to}</span>
                          </dd>
                        </div>
                      ))}
                    </dl>
                    </>)}
                    {/* The picked side breaks a required standard: say so on
                        this card, with what clears it. */}
                    {on && !isCustom && state.cardBlockers.length > 0 && (
                      <div onClick={(event) => event.stopPropagation()} className="cursor-default border-t border-amber-300/30 pt-3">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-200">
                          <TriangleAlert className="size-3.5 shrink-0" />
                          <LocalizedText text="Can’t merge · required standard not met" />
                        </p>
                        <CheckDecisions checks={checks} only={state.cardBlockers} {...checkActions} />
                        {state.otherClears && (
                          <p className="mt-2 text-xs leading-[18px] text-slate-200">
                            <LocalizedText text={card.side === 'before' ? 'Choosing the design reference clears it.' : 'Choosing the current implementation clears it.'} />
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  </div>
                  )
                })}
              </div>
              {/* ③ Why — under the cards, for the way that was chosen.
                  Following the standard needs no reason. No button of its
                  own: it's kept as it's entered, and settled by Decide. */}
              {flow?.reason && (!readOnly || flow.reason.value) && (
                <div data-decision-reason={choice} className="min-w-0">
                  <ReasonField key={`${conflict.id}:${choice}`} {...flow.reason} readOnly={!editing} />
                </div>
              )}
              {state.exceptionReason && <InlineDeviationReason key={state.exceptionReason.subject} onSave={state.saveExceptionReason} />}
            </>) : conflict.preview && (
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
            {/* Both sides miss a required standard: the cards still choose
                which side merges, but choosing can't fix it. */}
            {pairedPreview && state.bothFail && choice !== 'C' && editing && (
              <p className="flex items-center gap-1.5 text-xs leading-[18px] text-slate-300">
                <TriangleAlert className="size-3.5 shrink-0 text-slate-400" />
                <LocalizedText text="Both values miss the standard · it needs adjusting in Merge Studio" />
              </p>
            )}
            {checkBlocks}
            {state.exceptionReason && !pairedPreview && <InlineDeviationReason key={state.exceptionReason.subject} onSave={state.saveExceptionReason} />}
            {/* Finished: the code as it was merged. What it looked like
                before — the conflict itself, markers and all — is there to
                compare with, behind a toggle. */}
            {conflict.diff && readOnly && (
              <div data-merged-code className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                  <FileCode2 className="size-3 shrink-0" />
                  <span translate="no" className="min-w-0 truncate font-mono text-slate-300">{conflict.file}</span>
                  <span className="shrink-0 text-slate-400"><LocalizedText text={showBefore ? 'Before it was resolved' : 'Merged code'} /></span>
                  <button type="button" data-before-toggle aria-pressed={showBefore} onClick={() => setShowBefore((value) => !value)} className="ds-intrinsic ml-auto inline-flex h-5 shrink-0 items-center gap-1 text-[10.5px] text-slate-400 transition-colors hover:text-white">
                    <LocalizedText text={showBefore ? 'Show the merged code' : 'Show the conflict before it was resolved'} />
                  </button>
                </div>
                <div className="min-w-0 overflow-auto rounded-md bg-black/20 py-1 font-mono text-[11px] leading-relaxed">
                  {(showBefore ? conflict.diff.before ?? [] : mergedExcerpt).map((row, index) => (
                    <div key={index} className="flex min-w-0 pr-3 text-slate-300">
                      <span className="w-8 shrink-0 pr-2 text-right text-slate-600 tabular-nums select-none">{showBefore ? '' : row.number}</span>
                      <span className="min-w-0 flex-1 whitespace-pre-wrap [word-break:break-all]">{(showBefore ? row : row.text) || ' '}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* The code follows the card that's picked: its diff when the
                pick changes the code, a line saying it doesn't otherwise. */}
            {conflict.diff && !readOnly && codeChange !== 'diff' && (
              <div data-code-note={codeChange} className="min-w-0 space-y-1.5">
                <p className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                  <FileCode2 className="size-3 shrink-0" />
                  <span translate="no" className="min-w-0 truncate font-mono text-slate-300">{conflict.file}</span>
                </p>
                {/* Nothing changes: the code as it is, and a line saying so. */}
                <div className="min-w-0 overflow-auto rounded-md bg-black/20 py-1 font-mono text-[11px] leading-relaxed">
                  {(conflict.diff.before ?? []).map((text, index) => (
                    <div key={index} className="flex min-w-0 pr-3 text-slate-400">
                      <span className="w-8 shrink-0 pr-2 text-right text-slate-600 tabular-nums select-none">{(conflict.line ?? 1) + index}</span>
                      <span className="min-w-0 flex-1 whitespace-pre-wrap [word-break:break-all]">{text || ' '}</span>
                    </div>
                  ))}
                </div>
                <p data-code-unchanged className="text-[11px] text-slate-400">
                  <LocalizedText text={codeChange === 'unchanged' ? 'No change — the current code stays as it is.' : 'With nothing chosen, the code doesn’t change.'} />
                </p>
              </div>
            )}
            {conflict.diff && !readOnly && codeChange === 'diff' && (
              <div className="min-w-0 [&>div]:space-y-1.5">
                {code ? <ConflictCodeView {...code} context={2} /> : <CodeDiffColumns rows={rows} />}
              </div>
            )}
          </div>
        </section>
      )}
      {/* ⑤ The one place it's settled: what was chosen, and the button
          that decides it (and asks the reviewers). While it can't be
          pressed, the line over it says what's missing. */}
      {pairedPreview && editing && flow.decide && (
        <div data-decide-bar className="mt-3 flex min-w-0 items-end gap-3 border-t border-white/[0.07] pt-3">
          <p data-decide-summary className="min-w-0 flex-1 truncate pb-1.5 text-xs text-slate-300">
            {chosen ? <>
              <span className="font-medium text-white"><LocalizedText text={chosen.title} /></span>
              {flow.reason && reasonCount > 0 && <><span className="text-slate-500"> · </span><LocalizedText text={`${reasonCount} reason${reasonCount === 1 ? '' : 's'}`} /></>}
            </> : <LocalizedText text="Nothing chosen yet" />}
          </p>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {flow.decide.blocked && <p data-decide-hint className="text-[11px] text-slate-400"><LocalizedText text={flow.decide.blocked} /></p>}
            <button type="button" data-decide disabled={!choice || Boolean(flow.decide.blocked)} onClick={flow.decide.run} className={REQUEST_REVIEW_BUTTON}>
              <LocalizedText text="Decide on this" />
            </button>
          </div>
        </div>
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
function ReviewersSection({ conflict, onUpdate, onDismiss, sectioned = false }) {
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
  // `sectioned` (the sidebar's Info tab): its own header — title, how many,
  // and + at the right to add one — instead of the text action underneath.
  const addMenu = reviewStage !== 'resolved' && (assignable.length === 0 ? sectioned && (
    // Everyone who could review already is: the + stays, saying so.
    <span data-add-reviewer aria-disabled="true" title="Everyone on the project is already on this review" className="ml-auto flex size-5 items-center justify-center rounded text-slate-600"><Plus className="size-3.5" /></span>
  ) : (
    <DropdownMenu>
      <DropdownMenuTrigger data-add-reviewer aria-label="Add reviewer" title="Add reviewer" className={sectioned ? 'ds-intrinsic ml-auto flex size-5 items-center justify-center rounded text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white data-[popup-open]:text-white' : REVIEWER_TEXT_ACTION}>
        <Plus className="size-3.5" />
        {!sectioned && 'Add reviewer'}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={sectioned ? 'end' : 'start'} className="w-44">
        {assignable.map((person) => (
          <DropdownMenuItem key={person.id} onClick={() => assign(person)} className="gap-2">
            <PersonAvatar person={person} />
            {person.name}
            {person.id === viewerId && <span className="text-muted-foreground">(you)</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  ))
  return (
    <div className="min-w-0">
      {sectioned && (() => {
        const needed = requiredReviewers(conflict)
        const done = needed.filter((r) => r.status === 'approved').length
        return (
          <>
            <div data-review-header className="mb-2 flex items-center gap-1.5">
              <span className="text-[11px] leading-4 text-slate-400"><LocalizedText text="Reviewers" /></span>
              <span className="text-[11px] leading-4 text-slate-400">·</span>
              <span data-info-count className="text-[11px] leading-4 text-slate-200 tabular-nums"><LocalizedText text="Approvals" /> {done}/{needed.length}</span>
              {addMenu}
            </div>
            {needed.length > 0 && (
              <div data-approval-bar role="progressbar" aria-valuemin={0} aria-valuemax={needed.length} aria-valuenow={done} className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <div className={cn('h-full rounded-full transition-all', done === needed.length ? 'bg-emerald-400' : 'bg-sky-400')} style={{ width: `${(done / needed.length) * 100}%` }} />
              </div>
            )}
          </>
        )
      })()}
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
              {/* Three columns — avatar | name over role | status — every row
                  the same height. The role sits under the name, so names of
                  any length line up; the status is flush with the panel's
                  right edge (the hover actions sit just before it). */}
              <div className="group/rev -mx-1 flex h-11 min-w-0 items-center gap-2.5 rounded-md px-1 text-[13px] hover:bg-white/[0.03]">
                <PersonAvatar person={person} />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1.5 leading-[18px]">
                    <span className="min-w-0 truncate font-medium text-slate-100">{person.name}</span>
                    {person.id === viewerId && (
                      <span className="shrink-0 rounded bg-white/[0.08] px-1 py-0.5 text-[10px] leading-none font-medium text-slate-300"><LocalizedText text="You" /></span>
                    )}
                  </span>
                  {/* Their discipline: whose eyes are on it — a designer's
                      or a developer's. */}
                  {person.role && <span className="block truncate text-[11px] leading-4 text-slate-500"><LocalizedText text={person.role} /></span>}
                </span>
                <span className={cn('order-last shrink-0 truncate text-right text-xs font-medium', reviewer.id === author ? 'text-slate-200' : status.className)}>
                  {reviewer.id === author
                    ? 'Author'
                    : reviewer.status === 'pending' && reviewer.dismissedAt
                    ? 'Request dismissed'
                    : reviewer.status !== 'approved' && reviewer.remindedAt ? `Reminded ${reviewer.remindedAt}`
                      // Nobody's been asked yet: not "waiting" — that starts
                      // once the review is requested.
                      : reviewer.status === 'pending' && reviewStage === 'detected' && !conflict.rollback ? 'Not requested yet'
                        : statusLabels[reviewer.status] ?? status.label}
                </span>
                {/* Row actions, on hover, before the status (which stays at
                    the right edge either way). */}
                <div className="flex shrink-0 items-center justify-end opacity-0 transition-opacity group-hover/rev:opacity-100 focus-within:opacity-100 has-[[aria-expanded=true]]:opacity-100">
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
      {(canRemind && pending.length > 1) || (!sectioned && addMenu) ? (
        <div className="mt-0.5 flex items-center gap-3">
          {!sectioned && addMenu}
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
function CommentThread({ conflict, workspace, flashId }) {
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
            <div
              key={comment.id}
              data-comment-id={comment.id}
              // Arrived at from an evidence link: brought into view and lit.
              ref={comment.id === flashId ? (node) => node?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) : undefined}
              className={cn('-mx-1.5 space-y-2 rounded-lg px-1.5 py-1 text-xs transition-colors duration-500', comment.id === flashId && 'bg-emerald-400/[0.12] ring-1 ring-emerald-300/40')}
            >
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
                      <div key={reply.id} data-comment-id={reply.id}
                        ref={reply.id === flashId ? (node) => node?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) : undefined}
                        className={cn('flex gap-2.5 rounded-lg', reply.id === flashId && 'bg-emerald-400/[0.12] ring-1 ring-emerald-300/40')}>
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
// Comments either way. `needed`: it's your turn — the button says so, with
// a dot (that's the one place the to-do shows).
function ReviewButton({ onSubmit, authorName, needed = false }) {
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
      <PopoverTrigger data-review-needed={needed ? '' : undefined} className={cn(PRIMARY_BUTTON, 'gap-1')}>
        {needed && <span aria-hidden className="mr-0.5 size-1.5 shrink-0 rounded-full bg-current" />}
        <LocalizedText text={needed ? 'Review needed' : 'Review'} />
        <ChevronDown className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[320px] gap-0 rounded-xl p-3">
        <p className="mb-1 text-xs font-medium text-white"><LocalizedText text="Your review" /></p>
        {/* One line each: the choice, and what it means. What happens next
            is said once, for the picked one, over the submit button. */}
        <div role="radiogroup" aria-label="Your review" className="mb-2">
          {[
            ['approve', 'Approve', 'The change is right'],
            ['changes', 'Request changes', 'The author needs to fix it'],
          ].map(([id, label, meaning]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={decision === id}
              onClick={() => setDecision(id)}
              className="ds-intrinsic flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-1.5 text-left text-xs transition-colors hover:bg-white/[0.05]"
            >
              <span aria-hidden className={cn('flex size-3.5 shrink-0 items-center justify-center rounded-full border', decision === id ? 'border-emerald-300' : 'border-white/30')}>
                {decision === id && <span className="size-1.5 rounded-full bg-emerald-300" />}
              </span>
              <span className="min-w-0 truncate">
                <span className={cn('font-medium', decision === id ? 'text-white' : 'text-slate-200')}><LocalizedText text={label} /></span>
                <span className="text-slate-400"> · <LocalizedText text={meaning} /></span>
              </span>
            </button>
          ))}
        </div>
        <textarea
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); submit() } }}
          placeholder={tr(needsNote ? 'What needs to change? (required)' : 'Leave a comment (optional)')}
          className="block w-full resize-none rounded-lg bg-white/[0.04] px-2.5 py-2 text-xs leading-5 text-white outline-none placeholder:text-slate-500 focus:bg-white/[0.06]"
        />
        <p data-review-outcome className="mt-2 text-[11px] leading-4 text-slate-300">
          <LocalizedText text={decision === 'approve' ? 'It merges once everyone approves' : 'It goes back to the author and the merge stops'} />
        </p>
        <div className="mt-2 flex items-center gap-2">
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
  const navigate = useNavigate()

  const severity = conflict?.severity ? (severityConfig[conflict.severity] ?? severityConfig.medium) : null

  // The review itself ('overview') or the History behind it, reset to the
  // review whenever a different conflict loads.
  // The main area is the comparison — or, while one is being watched, a
  // step's replay (opened from the sidebar's Activity tab).
  const [replayId, setReplayId] = useState(null)
  const activity = useConflictActivity(conflict, workspace)
  // Evidence links and the one question a departure asks.
  const [ruleFocus, setRuleFocus] = useState(null)
  const [flashComment, setFlashComment] = useState(null)
  // The sidebar's tab, and how many comments there were when Comments was
  // last looked at (more than that since puts a dot on the tab).
  const [sideTab, setSideTab] = useState('info')
  const commentCount = conflict && workspace ? workspace.comments.filter((c) => c.id === conflict.linkedCommentId || c.target?.conflictId === conflict.id).length : 0
  const [seen, setSeen] = useState({ id: conflict?.id, count: commentCount })
  if (conflict && seen.id !== conflict.id) setSeen({ id: conflict.id, count: commentCount })
  const seenComments = sideTab === 'comments' ? commentCount : seen.count
  function openSideTab(value) {
    // Leaving or entering Comments: everything there has now been seen.
    if (value === 'comments' || sideTab === 'comments') setSeen({ id: conflict.id, count: commentCount })
    setSideTab(value)
  }
  const [reasonRequest, setReasonRequest] = useState(null)
  const [tabConflictId, setTabConflictId] = useState(conflict?.id)
  if (conflict && conflict.id !== tabConflictId) {
    setTabConflictId(conflict.id)
    setReplayId(null)
  }

  function update(patch) {
    onUpdate?.(conflict.id, patch)
  }

  // Opening a step's replay (the Activity tab's "View replay").
  function openReplay(id) {
    setReplayId(id)
    if (!conflict.historyInspected) update({ historyInspected: true })
  }

  // The Activity tab is this conflict's own activity, here in the panel
  // (see ConflictHistoryReplay). From there, "Project history" is the way out to the project's archive: it
  // goes to History itself, on the saved version this conflict came from —
  // selected (the link's `?v=`), scrolled to and lit for a moment in the
  // list (`flashCheckpoint`).
  // The saved version this difference first came in with (the one its
  // conflict is marked on in History).
  const causeVersion = conflict
    ? foldConflictCheckpoints(withBranches(workspace?.historyEntries ?? [], workspace?.conflicts ?? []))
      .find((entry) => !entry.archived && entry.conflictMarks.some((mark) => mark.conflictId === conflict.id)) ?? null
    : null
  function openProjectHistory() {
    const checkpoint = causeVersion
    navigate(`/projects/${conflict.projectId}/history${checkpoint ? `?v=${checkpoint.id}` : ''}`, { state: checkpoint ? { flashCheckpoint: checkpoint.id } : null })
  }

  function handleRequestReview() {
    if (decisionState.reasonNeeded || reasonRequest) return
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
    setReplayId(null)
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
  // An exception departs from the standard, so it's asked why first; the
  // reason travels with the request, for the reviewers to weigh.
  function requestException(check) {
    const request = {
      kind: 'exception',
      subject: check.title,
      run: (reason) => {
        update({
          exceptionChecks: [...new Set([...(conflict.exceptionChecks ?? []), check.id])],
          decidedBy: viewerId,
          deviation: { kind: 'exception', checkId: check.id, text: reason, by: viewerId, at: 'Just now' },
        })
        if (workspace) workspace.addComment(`Exception requested: ${check.title} — ${reason}`, { conflictId: conflict.id })
        toast('Exception requested', { description: 'It can merge once the reviewers approve the change.' })
      },
    }
    // The reason for departing from the standard is already on this
    // conflict (given when the current implementation was kept): it's the
    // exception's reason too, not asked a second time.
    const given = conflict.deviation?.text?.trim()
    if (given) request.run(given)
    else setReasonRequest(request)
  }

  function undoException(check) {
    update({
      exceptionChecks: (conflict.exceptionChecks ?? []).filter((id) => id !== check.id),
      ...(conflict.deviation?.checkId === check.id ? { deviation: null } : {}),
    })
  }

  // Ship the change with this check as it is: it stops counting against
  // the merge, and stays listed so the decision can be undone.
  function acceptCheck(check) {
    update({ acceptedChecks: [...new Set([...(conflict.acceptedChecks ?? []), check.id])] })
    if (workspace?.checkGuide?.check?.id === check.id) workspace.setCheckGuide(null)
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
    // Say that it happened: the merge itself only swaps the stage and the
    // button, which is easy to miss. (A blocked merge explains itself with
    // its own "Can't merge yet" toast and returns false.)
    // A size set by hand is part of what merges: kept on the conflict, so
    // the merged card goes on showing the value that was adopted.
    const kept = adjustment ? { layerId: adjustment.layerId, layerName: adjustment.layerName, from: adjustment.from, to: adjustment.to, size: adjustment.size } : null
    const merged = onResolve ? onResolve(conflict.id) : (update({ reviewStage: 'resolved' }), true)
    if (merged) {
      if (kept || studioAdjustments.length) update({ ...(kept ? { mergedAdjustment: kept } : {}), mergedAdjustments: studioAdjustments, mergedAssembly: handAssembly ?? null })
      toast('Change merged', { description: kept ? `${conflict.title} · ${kept.layerName} ${kept.to}` : conflict.title })
    }
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
    onPickSide: onUpdate && conflict ? (side) => update({ pickedSide: side }) : undefined,
    mergedDecisions: stage === 'resolved' && conflict ? mergedDecisionsForConflict(conflict, workspace) : undefined,
  })
  // What a finished conflict merged with, and who signed off — the banner's.
  const mergeConflict = Boolean(conflict?.diff?.before?.some((line) => line.startsWith('<<<<<<<')))
  const mergedSide = decisionState.side ?? conflict?.decidedSide ?? 'A'
  const mergedWith = !conflict ? null
    : mergeConflict ? `Merged with the ${mergedSide === 'A' ? 'remote' : 'local'} branch (${mergedSide === 'A' ? conflict.branches?.remote : conflict.branches?.local}) value`
      : mergedSide === 'A' ? 'Merged with the design reference value' : 'Merged with the current implementation value'
  const approvers = (conflict?.reviewers ?? []).filter((reviewer) => reviewer.status === 'approved').map((reviewer) => personNameOf(reviewer.id)).filter(Boolean)
  // The reasons linked to this conflict (lib/rationale): the rules it runs
  // into, its purpose and its comments — nothing here is typed in.
  const rationale = conflict ? rationaleOf(conflict, { comments: workspace?.comments ?? [], checks }) : null
  // Picking a side records who decided. Following the standard (the design
  // reference) uses the linked reasons as they are; keeping the current
  // implementation where a rule says otherwise is a departure, and is the
  // choice that requires an inline reason before requesting review.
  const pickSide = decisionState.pick
  const recordSide = (side, reason) => {
    pickSide(side)
    update({
      decidedSide: side,
      decidedBy: viewerId,
      deviation: reason ? { kind: 'keep-current', text: reason, by: viewerId, at: 'Just now' } : conflict.deviation?.kind === 'keep-current' ? null : conflict.deviation ?? null,
    })
  }
  decisionState.pick = (side) => {
    setReasonRequest(null)
    recordSide(side)
  }
  const undoSide = decisionState.undo
  decisionState.undo = () => {
    undoSide()
    setReasonRequest(null)
    update({ decidedSide: null, decidedBy: null, deviation: null })
  }
  // Choosing between cards (no drafts to mix, no rollback): keeping the
  // current value always says why.
  const cardFlow = Boolean(conflict?.comparisonFields?.length) && !conflict.rollback && !(driftItem && draftColumns(driftItem))
  decisionState.reasonApplies = decisionState.side === 'B' && (cardFlow || !decisionState.meets.B || conflict?.deviation?.kind === 'keep-current')
  decisionState.savedReason = conflict?.deviation?.kind === 'keep-current' ? conflict.deviation.text : null
  decisionState.reasonNeeded = stage !== 'resolved' && decisionState.reasonApplies && !decisionState.savedReason?.trim()
  decisionState.saveReason = (reason) => {
    recordSide('B', reason)
    // An exception waiting on a reason takes this one.
    if (reasonRequest) { reasonRequest.run(reason); setReasonRequest(null) }
  }
  decisionState.exceptionReason = reasonRequest
  decisionState.saveExceptionReason = (reason) => { reasonRequest?.run(reason); setReasonRequest(null) }
  // Evidence goes to the thing itself: the rule in the rule list, the Figma
  // frame on the canvas, the token where it's defined, the comment in the
  // thread beside the review (lit for a moment).
  function openEvidence(item) {
    if (item.kind === 'rule') { setRuleFocus(item.id); return }
    if (item.kind === 'wcag') { window.open(item.url, '_blank', 'noopener'); return }
    if (item.kind === 'comment') {
      openSideTab('comments')
      setFlashComment(item.id)
      window.setTimeout(() => setFlashComment((current) => (current === item.id ? null : current)), 1800)
      return
    }
    if (!workspace) return
    setRuleFocus(null)
    if (item.kind === 'token') {
      const file = (projectFileSets[conflict.projectId] ?? []).find((candidate) => candidate.path === item.source || item.source?.endsWith(candidate.name))
      if (!file) return
      const line = workspace.getFileLines(file.id).findIndex((text) => item.find && text.includes(`"${item.find}"`))
      workspace.focusChange({ fileId: file.id, line: line >= 0 ? line + 1 : 1 })
      if (workspace.dockApi) openOrFocusPanel(workspace.dockApi, panelById.editor)
      return
    }
    // A Figma frame: the element on the canvas.
    workspace.focusChange(conflict)
    if (workspace.dockApi) openOrFocusPanel(workspace.dockApi, panelById.canvas)
  }
  // Consume a History source link after the review and its workspace mount.
  const pendingEvidence = workspace?.bottomPanel?.evidence
  const consumeEvidence = useEffectEvent((item) => {
    openEvidence(item)
    workspace.setBottomPanel({ evidence: null })
  })
  useEffect(() => {
    if (!pendingEvidence || pendingEvidence.conflictId !== conflict?.id) return
    consumeEvidence(pendingEvidence)
  }, [pendingEvidence, conflict?.id])

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
  const adjustment = stage !== 'resolved' ? sizeAdjustmentOf(conflict, mergeItem, workspace?.mergeDrafts?.current) : mergedSizeAdjustment(conflict, mergeItem)
  // Everything adjusted by hand in Merge Studio on this item (any property,
  // any of its elements) — listed in the review so what was changed there
  // is seen here. Kept on the conflict at merge, so it stays after.
  const studioAdjustments = stage === 'resolved' ? conflict?.mergedAdjustments ?? [] : studioAdjustmentsOf(mergeItem, workspace?.mergeDrafts?.current)
  // What merges (lib/mergeResult): the side that merges — the picked one,
  // the current implementation with none — with those values laid over it.
  // The card's rows, its picture and the code below all read this.
  const handAssembly = stage === 'resolved' ? conflict?.mergedAssembly : workspace?.mergeDrafts?.current?.[mergeItem?.id]?.assemblies?.[conflict?.layerId]
  const adjustedByHand = Boolean(adjustment) || studioAdjustments.length > 0
  // (Decided with no side recorded: the design reference, which is what a
  // merge takes by default — unless it was adjusted by hand, which sits on
  // the current implementation.)
  const mergeSide = stage === 'resolved' ? mergedSide : decisionState.side ?? (stage !== 'detected' && !adjustedByHand ? mergedSide : 'B')
  const result = mergeResultOf(conflict, mergeItem, mergeSide, { assembly: handAssembly, adjustments: studioAdjustments })
  // Adjusted by hand: the reason to give is why it was adjusted (kept on the
  // conflict as `adjustmentReason`) — asked in place of the kept-value one,
  // and needed before a review request the same way.
  // The resolution as three choices: the design reference (A), the current
  // value (B), or a value set by hand (C — anything adjusted in Merge
  // Studio). Choosing A or B while adjusted sets the adjustment aside
  // (`stashedAssemblies`, on the conflict) rather than dropping it, so
  // choosing C again brings it back as it was.
  const stash = stage !== 'resolved' && conflict?.stashedAssemblies && Object.keys(conflict.stashedAssemblies).length ? conflict.stashedAssemblies : null
  const choice = !conflict ? null : adjustedByHand ? 'C' : stage === 'detected' ? decisionState.side : mergedSide
  const openStudio = stage !== 'resolved' && onOpenMergeStudio && !inMergeStudio ? () => {
    // Arriving there says what to do: the check to fix (its element
    // marked, the value to reach) or, with none failing, how a precise
    // adjustment works — and how to finish and come back.
    workspace?.setCheckGuide({ conflictId: conflict.id, check: checks?.blocking[0] ?? checks?.failing[0] ?? null })
    onOpenMergeStudio(conflict)
  } : null
  function chooseWay(next) {
    if (next === choice) return
    if (next === 'C') {
      if (!stash) { openStudio?.(); return }
      // Back on the current implementation, where it was set.
      workspace.setLayerAdjustments(mergeItem.id, stash)
      if (decisionState.side) undoSide()
      update({ stashedAssemblies: null, decidedSide: null, decidedBy: null })
      return
    }
    if (adjustedByHand && mergeItem && workspace?.setLayerAdjustments) {
      const set = workspace.mergeDrafts?.current?.[mergeItem.id]?.assemblies ?? {}
      workspace.setLayerAdjustments(mergeItem.id, {})
      // (A seeded "settled by hand" record reopens with it.)
      update({ stashedAssemblies: set, ...(conflict.resolution === 'manual' ? { resolution: null, adjustment: null } : null) })
    }
    decisionState.pick(next)
  }
  // The third card's values: what's set now, or what was set aside.
  const customResult = adjustedByHand ? result
    : stash && mergeItem ? mergeResultOf(conflict, mergeItem, 'B', { assembly: stash[conflict.layerId], adjustments: studioAdjustmentsOf(mergeItem, { [mergeItem.id]: { assemblies: stash } }) })
      : null
  if (adjustedByHand) {
    decisionState.adjustmentReason = true
    decisionState.reasonApplies = true
    decisionState.savedReason = conflict.adjustmentReason?.text ?? null
    decisionState.reasonNeeded = stage !== 'resolved' && !decisionState.savedReason?.trim()
  }
  // Why, for the way that's chosen — kept on the conflict as it's entered
  // (no save of its own; Decide settles it). Following the standard needs
  // none.
  const flowReason = choice === 'C' ? {
    title: 'Why was it adjusted?',
    reasons: ADJUSTMENT_REASONS,
    value: conflict.adjustmentReason?.text ?? '',
    onChange: (text) => update({ adjustmentReason: text ? { text, by: viewerId, at: 'Just now' } : null }),
  } : choice === 'B' && decisionState.reasonApplies ? {
    title: 'Why depart from the standard?',
    reasons: DEVIATION_REASONS,
    value: decisionState.savedReason ?? '',
    onChange: (text) => update({ deviation: text ? { kind: 'keep-current', text, by: viewerId, at: 'Just now' } : null }),
  } : null
  // Decided once review is asked for; whoever isn't there as a reviewer
  // (the author) can take it back to choose again.
  const reviewerOnly = Boolean(myReviewer && !ownChange)
  const flow = conflict && cardFlow ? {
    choice,
    editing: stage === 'detected' && Boolean(onUpdate),
    decided: stage !== 'detected',
    canChange: stage !== 'detected' && stage !== 'resolved' && !reviewerOnly && Boolean(onUpdate),
    choose: chooseWay,
    custom: customResult,
    openStudio,
    reason: flowReason,
    changeDecision: () => update({ reviewStage: 'detected', reviewers: conflict.reviewers.map((r) => ({ ...r, status: 'pending' })) }),
    decide: {
      run: handleRequestReview,
      blocked: !choice ? null
        : decisionState.reasonNeeded ? 'Choose at least one reason'
          : !requiredReviewers(conflict).length ? 'Assign a reviewer other than the author to request review.'
            : reasonRequest ? 'Reason needed' : null,
    },
  } : conflict ? { editing: stage !== 'resolved', openStudio } : null
  // The code that merges follows the card that's picked: the design
  // reference's lines, or the current ones — either with a hand-adjusted
  // size written in. So the diff's "−" is always the current
  // implementation's value and its "+" the chosen one. With nothing picked
  // (and nothing adjusted) the code doesn't change, and there is no diff.
  const pickedSide = stage === 'resolved' ? 'A' : decisionState.side ?? (stage !== 'detected' && !adjustedByHand ? mergedSide : null)
  const changeAfter = stage === 'resolved'
    ? (conflict?.diff?.after ?? []).map((line) => (adjustment ? adjustment.applyTo(line) : line))
    : result?.lines ?? []
  const codeChanges = changeAfter.join('\n') !== (conflict?.diff?.before ?? []).join('\n')
  const codeChange = !conflict?.diff ? null
    : pickedSide === 'A' || codeChanges ? 'diff'
      : pickedSide === 'B' ? 'unchanged' : 'unpicked'
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
    if (stage === 'detected' && cardFlow) {
      // Decided at the bottom of the choice itself ("Decide on this").
      primary = null
    } else if (stage === 'detected') {
      primary = (
        <>
          {!requiredReviewers(conflict).length && <span className={STATUS_NOTE}><LocalizedText text="Assign a reviewer other than the author to request review." /></span>}
          <button type="button" disabled={!requiredReviewers(conflict).length || decisionState.reasonNeeded || Boolean(reasonRequest)} onClick={handleRequestReview} className={REQUEST_REVIEW_BUTTON}>
            Request review
          </button>
        </>
      )
    } else if (stage === 'in_review' && (ownChange || conflict.requestedBy === viewerId) && requiredReviewers(conflict).some((reviewer) => reviewer.status === 'changes_requested')) {
      primary = <button type="button" disabled={decisionState.reasonNeeded || Boolean(reasonRequest)} onClick={handleRequestReview} className={REQUEST_REVIEW_BUTTON}><LocalizedText text="Request review again" /></button>
    } else if (stage === 'in_review' && canReview) {
      // Yours to decide — also after requesting changes, so you can approve
      // once they're fixed (or change your mind).
      primary = <ReviewButton onSubmit={handleReview} authorName={authorName} needed={myReviewer.status === 'pending'} />
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
                <h2 className="min-w-0 truncate text-sm font-semibold text-white">
                  <LocalizedText text={conflict.title} />
                </h2>
                {!conflict.rollback && <span translate="no" className="shrink-0 font-mono text-[10px] font-medium text-slate-500">#{conflictRef(conflict, workspace?.conflicts)}</span>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {primary}
              </div>
            </div>

            {/* Title, tabs and activity share the 44px content rail.
                The back button occupies the separate 32px gutter. */}
            {/* The header and the tabs above stay put. On a wide panel the
                three areas — comparison and diff, reasoning, reviewers and
                comments — each scroll on their own, so none of these
                wrappers scrolls; narrower, where they stack, the page does. */}
            <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col overflow-auto px-3 pt-1 pb-3 xl:overflow-hidden', 'pt-2')}>
              <div className={cn(
                'grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-auto pt-1 xl:grid-cols-[minmax(0,1fr)_320px] xl:overflow-hidden',
                REVIEW_GUTTER
              )}>
                <div className={cn('flex min-h-0 min-w-0 flex-col overflow-auto', !replayId && 'xl:overflow-hidden')}>
                  {/* Done is said outright, above everything: merged (or
                      rolled back), when and by whom — not left to be read
                      off a Revert button and the merged values. */}
                  {stage === 'resolved' && (
                    <div data-merged-banner role="status" className="mb-3 flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-emerald-400/10 py-2 pr-2 pl-3 ring-1 ring-emerald-300/30 ring-inset">
                      <CircleCheck className="size-4 shrink-0 text-emerald-300" />
                      <span className="text-[13px] font-semibold text-emerald-100"><LocalizedText text={conflict.rollback ? 'Rolled back' : 'Merged'} /></span>
                      {/* The decision, here rather than as a row of the
                          summary: which value it merged with, who approved,
                          and when. */}
                      <span className="min-w-0 text-xs text-emerald-100/80">
                        {[
                          conflict.rollback ? 'The rollback has run.' : mergedWith,
                          approvers.length ? `Sign-off from ${approvers.join(', ')}` : null,
                          conflict.resolvedAtLabel ?? conflict.timestamp ?? null,
                        ].filter(Boolean).map((part) => <Fragment key={part}><span className="text-emerald-100/50"> · </span><LocalizedText text={part} /></Fragment>)}
                      </span>
                      {/* Undoing it is a quiet button here, with the result it
                          undoes — not the header's main action. */}
                      {!conflict.rollback && (
                        <button type="button" data-banner-revert onClick={handleRevert} className={cn(NAV_BUTTON, 'ml-auto h-7')}>
                          <RotateCcw className="size-3.5 text-slate-400" />
                          <LocalizedText text="Revert" />
                        </button>
                      )}
                    </div>
                  )}
                  {!replayId ? (
                    <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 items-stretch gap-3 xl:flex xl:items-stretch xl:overflow-hidden">
                      {/* The difference itself, on the left with the most room:
                          the two cards compared, and the code diff under them. */}
                      <section data-review-diff className={cn('flex min-h-0 min-w-0 flex-col overflow-hidden p-3', REVIEW_CARD, 'xl:flex-1')}>
                        <div data-review-scroll="diff" className="min-h-0 min-w-0 flex-1 overflow-auto">
                          {/* (Listed here only where there's no comparison
                              card to carry them — the card shows its own.) */}
                          {studioAdjustments.length > 0 && !conflict.rollback && !(conflict.comparisonFields?.length && !(driftItem && draftColumns(driftItem))) && (
                            <section data-studio-adjustments className="mb-3 rounded-xl bg-emerald-400/[0.07] px-3 py-2.5 ring-1 ring-emerald-300/25 ring-inset">
                              <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-100">
                                <Check className="size-3.5 shrink-0 text-emerald-300" />
                                <LocalizedText text={stage === 'resolved' ? 'Merged with these adjustments' : 'Adjusted in Merge Studio'} />
                                <span className="font-normal text-emerald-100/70 tabular-nums">· {studioAdjustments.reduce((sum, entry) => sum + entry.changes.length, 0)}</span>
                              </p>
                              <ul className="mt-1.5 space-y-0.5 text-xs leading-[18px] text-slate-200">
                                {studioAdjustments.flatMap((entry) => entry.changes.map((change) => (
                                  <li key={`${entry.layerId}:${change.label}`} className="flex flex-wrap gap-x-1.5">
                                    <span className="text-slate-400"><LocalizedText text={entry.layerName} /> · <LocalizedText text={change.label} /></span>
                                    <span translate="no" className="tabular-nums">
                                      {change.from && <><span className="text-slate-500 line-through">{change.from}</span> → </>}
                                      <span className="font-medium text-emerald-200">{change.to}</span>
                                    </span>
                                  </li>
                                )))}
                              </ul>
                            </section>
                          )}
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
                            codeChange={codeChange}
                            conflict={conflict}
                            code={codeView}
                            mergedLines={mergedLinesForConflict(conflict, workspace)}
                            changeAfter={changeAfter}
                            state={decisionState}
                            checks={checks}
                            checkActions={checkActions}
                            checkBlocks={checkBlocks}
                            flow={flow}
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
                      <ConflictReplay conflict={conflict} rationale={rationale} activity={activity} replayId={replayId} onReplay={openReplay} onBack={() => setReplayId(null)} onOpenEvidence={openEvidence} />
                    </div>
                  )}
                </div>

                {/* One sidebar on the right, 320px: Info (status, cause,
                    impact, evidence, approvals, reviewers, details) and
                    Comments (the thread and its composer), as two tabs. The
                    comparison beside it takes all the rest. */}
                <aside data-review-sidebar className={cn('flex h-full min-h-0 min-w-0 flex-col', REVIEW_CONTEXT_CARD)}>
                  <div role="tablist" aria-label="Conflict sidebar" className="-mt-1 mb-2 flex shrink-0 items-stretch gap-4 border-b border-white/[0.07]">
                    {[['info', 'Info'], ['comments', 'Comments'], ...(conflict.rollback ? [] : [['activity', 'Activity']])].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="tab"
                        data-side-tab={value}
                        aria-selected={sideTab === value}
                        onClick={() => openSideTab(value)}
                        className="ds-intrinsic -mb-px inline-flex h-8 items-center gap-1.5 border-b-2 border-transparent text-xs font-medium text-slate-400 transition-colors hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-emerald-300 aria-selected:border-emerald-300 aria-selected:text-white"
                      >
                        <LocalizedText text={label} />
                        {value === 'activity' && <span data-activity-count className="text-[11px] font-normal text-slate-400 tabular-nums">{activity.timeline.length}</span>}
                        {value === 'comments' && (
                          <>
                            <span data-comment-count className="text-[11px] font-normal text-slate-400 tabular-nums">{commentCount}</span>
                            {/* Something new since the tab was last open. */}
                            {commentCount > seenComments && sideTab !== 'comments' && <span data-comment-dot aria-label="New comments" className="size-1.5 rounded-full bg-emerald-300" />}
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                  {sideTab === 'info' ? (
                    <div data-review-scroll="info" role="tabpanel" className="min-h-0 min-w-0 flex-1 overflow-y-auto">
                      <OverviewTab
                        key={conflict.id}
                        rationale={rationale}
                        onOpenEvidence={openEvidence}
                        checks={checks}
                        conflict={conflict}
                        severity={severity}
                        stage={stage}
                        showProject={!workspace}
                        blockedCount={decisionState.required.length}
                        adjustment={adjustment}
                        cause={causeVersion}
                        onOpenCause={openProjectHistory}
                        onUpdateReviewers={update}
                        reasonNeeded={decisionState.reasonNeeded}
                        onDismissRequest={workspace?.dismissChangeRequest}
                      />
                    </div>
                  ) : sideTab === 'activity' ? (
                    <div data-review-scroll="activity" role="tabpanel" className="min-h-0 min-w-0 flex-1 overflow-y-auto">
                      <ConflictActivityList conflict={conflict} rationale={rationale} activity={activity} replayId={replayId} onReplay={openReplay} onOpenProjectHistory={openProjectHistory} />
                    </div>
                  ) : (
                    <div role="tabpanel" className="flex min-h-0 flex-1 flex-col">
                      <CommentThread key={conflict.id} conflict={conflict} workspace={workspace} flashId={flashComment} />
                    </div>
                  )}
                </aside>
              </div>
            </div>
          </>
        )}
        <RulesDialog focusId={ruleFocus} onOpenChange={(open) => { if (!open) setRuleFocus(null) }} onOpenSource={openEvidence} />

    </div>
  )
}

export default ConflictModal
