import { checkGuidance } from '@/components/conflicts/CheckExplanation'
import { historyHref } from '@/lib/historyLink'
import { PreviewFrame } from '@/components/conflicts/ElementPreview'
import { RecentTime } from '@/components/ui/RecentTime'
import { comparisonBlockers } from '@/lib/driftDecisions'
import { ListStatusLabel, NAV_BUTTON, NAV_BUTTON_ICON, REVIEW_HEADER_BADGE } from '@/components/conflicts/ConflictBadges'
import { BREADCRUMB_COLUMN } from '@/components/layout/Breadcrumb'
import { Fragment, useEffect, useEffectEvent, useId, useMemo, useRef, useState } from 'react'
import { ArrowRight, Ban, Bell, BookCheck, Check, ChevronDown, CircleCheck, FileCode2, ChevronLeft, Clock3, GitCompareArrows, GitMerge, Layers3, LoaderCircle, Pencil, MapPin, Minus, Plus, RotateCcw, Send, ShieldCheck, Sparkles, TriangleAlert, Users, X } from 'lucide-react'
import { cn } from 'cn'
import { LocalizedText } from '@/i18n/runtime'
import { translateText } from '@/i18n/translate'
import { getLanguage } from '@/i18n/language'

// Text fields skip the JSX translation pass (what's typed is the user's),
// so their placeholders are translated here.
const tr = (text) => translateText(text, getLanguage())
const personNameOf = (id) => allPeople.find((person) => person.id === id)?.name ?? null
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { allPeople, canvasPages, currentUserFor, projectFileSets, projects } from '@/data/mockData'
import { composeDraftFrame, draftScreens, regionLayout, regionPicks } from '@/data/draftScreens'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { mergedSizeAdjustment, sizeAdjustmentOf, studioAdjustmentsOf } from '@/lib/sizeAdjustment'
import { fieldControlsFor, handLinesOf, mergeResultOf, withHandLines, writeFieldValue } from '@/lib/mergeResult'
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
  TASK_LABEL,
  isDesignReview,
} from '@/lib/conflicts'
import ChangePreview from '@/components/conflicts/ChangePreview'
import { checksFor } from '@/components/mergestudio/mergeChecks'
import { CheckDecisions } from '@/components/conflicts/CheckDecisions'
import { diffLines } from '@/lib/lineDiff'
import { ROLLBACK_REASON, ROLLBACK_STAGE_LABEL } from '@/lib/rollbackImpact'
import { toast } from '@/i18n/toast'
import { useWorkspaceOptional } from '@/state/WorkspaceProvider'
import { isDeveloperViewer } from '@/lib/viewerRole'
import { decisionOutcomeOf } from '@/lib/designDecisions'
import DesignLinkThumb, { BreakpointScreen, DesignLinkChip, ScreenLocation, useDesignLink } from '@/components/conflicts/DesignLinkThumb'
import DesignDecisionFlow, { PRIMARY as DECISION_PRIMARY, differenceLineOf } from '@/components/conflicts/DesignDecisionFlow'
import { RECORD_ROWS, ReplayStepRail, StepProgressCount, StepRow, accordionToggle, useStepReveal } from '@/components/conflicts/StepTimeline'
import { canMerge, hasBody, reviewFixPhaseOf, reviewRecordOf, reviewStatusOf } from '@/lib/reviewRecord'
import { MERGE_REQUEST_LABEL, isMergeRequest, mergeRequestRecordOf, mergeRequestStateOf, mergeRequestStatusOf } from '@/lib/mergeRequest'
import { useFoldState } from '@/components/conflicts/Fold'
import { delayOf, moves as stepMoves } from '@/lib/stepProgress'
import { RECORD_STEPS, replayStates } from '@/lib/stepProgress'
import ConflictHistory from '@/components/conflicts/ConflictHistory'
import { eventsOf, formatTime, humanEventCount, sampleHistoryForCon002 } from '@/lib/conflictEvents'
import { ConflictActivityList, ConflictReplay, useConflictActivity } from '@/components/dockview/panels/ConflictHistoryReplay'
import { ReasonField, RulesDialog } from '@/components/conflicts/Rationale'
import { ConflictTypeTag, DifferenceSummary, CodeDifferenceSummary, FlowSteps } from '@/components/conflicts/ConflictInsight'
import MergeCancellationSummary from '@/components/conflicts/MergeCancellationSummary'
import { ADJUSTMENT_REASONS, DEVIATION_REASONS } from '@/lib/rationale'
import { rationaleOf, standardOf } from '@/lib/rationale'
import { openOrFocusPanel, panelById } from '@/components/dockview/dockPanels'
import ConflictCodeView, { placeChange } from '@/components/conflicts/ConflictCodeView'
import { DiffLayoutTabs, DiffView } from '@/components/diff/DiffView'
import { ReviewHeaderPortal } from '@/components/conflicts/ReviewHeaderSlot'
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

const REVIEW_GUTTER = 'gap-4 xl:gap-5'
const REVIEW_CARD = 'rounded-xl bg-white/[0.03]'
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
  const codeConflict = conflict.kind === 'code-conflict'
  const primaryFile = conflict.file && !codeConflict ? `${conflict.file}${conflict.line ? `:${conflict.line}` : ''}` : null
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
    !codeConflict && ['Branch', <span key="b" translate="no">{flow ? `${flow.source} → ${flow.target}` : '—'}</span>],
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
// `active`: the region the list points at — lit on the screen, the rest
// dimmed, with the draft it comes from beside it. Each region is also a
// target: pointing at it here lights its row in the list.
// The whole screen fits the room it's given (width and height), so a lit
// region is never below the fold of a short panel; where the room has no
// height of its own, it fits the width and scrolls the lit region in.
function DraftResultPreview({ result, height, active, onHover, onPick }) {
  const boxRef = useRef(null)
  const viewportRef = useRef(null)
  const [room, setRoom] = useState({ width: result.width, height: 0 })
  useEffect(() => {
    const element = boxRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setRoom({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const scale = Math.min(room.width / result.width, room.height > 40 ? room.height / height : Infinity)
  useEffect(() => {
    if (!active?.id) return
    viewportRef.current?.querySelector(`[data-mix-region="${active.id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [active?.id])
  return (
    <div ref={boxRef} data-mix-preview-room className="flex min-h-0 w-full flex-1 justify-center">
    <div ref={viewportRef} className="relative shrink-0 overflow-hidden rounded-xl bg-white" style={{ width: result.width * scale, height: height * scale }}>
      <div className="pointer-events-none absolute top-0 left-0 origin-top-left" style={{ width: result.width, height, transform: `scale(${scale})` }}>
        {result.layers.map((layer) => <StaticLayer key={layer.id} layer={layer} onSelect={() => {}} />)}
      </div>
      {result.regions?.map((region) => {
        const on = region.id === active?.id
        return (
          <button
            key={region.id}
            type="button"
            data-mix-region={region.id}
            data-active={on || undefined}
            aria-label={region.label}
            onMouseEnter={() => onHover?.(region.id)}
            onMouseLeave={() => onHover?.(null)}
            onClick={() => onPick?.(region.id)}
            className={cn('ds-intrinsic absolute inset-x-0 cursor-pointer transition-[box-shadow,background-color] duration-150',
              on ? 'z-10 shadow-[0_0_0_9999px_rgba(15,23,42,0.45),inset_0_0_0_2px_rgb(110,231,183)]' : 'hover:bg-emerald-400/[0.05]')}
            style={{ top: region.y * scale, height: region.height * scale }}
          >
            {on && active.option && (
              <span className="absolute top-1 right-1 inline-flex items-center gap-1 rounded-md bg-slate-950/85 px-1.5 py-0.5 text-[10.5px] font-medium text-emerald-100">
                <span className="flex size-3.5 items-center justify-center rounded bg-emerald-300 text-[9px] font-semibold text-slate-950">{active.option.letter}</span>
                <LocalizedText text={region.label} />
              </span>
            )}
          </button>
        )
      })}
    </div>
    </div>
  )
}

// A part as its draft draws it, small — the slice of the screen a row is about.
function PartThumb({ part, width = 72 }) {
  const height = Math.round(width * 0.5)
  if (!part?.layers?.length) return <span aria-hidden className="block shrink-0 rounded-md bg-white/[0.06]" style={{ width, height }} />
  const tall = (part.height ?? 0) + 16
  const scale = Math.min(width / 280, height / tall)
  return (
    <span aria-hidden className="relative block shrink-0 overflow-hidden rounded-md bg-white" style={{ width, height }}>
      <span className="pointer-events-none absolute top-1/2 left-1/2 block origin-center" style={{ width: 280, height: tall, transform: `translate(-50%, -50%) scale(${scale})` }}>
        {part.layers.map((layer) => <StaticLayer key={layer.id} layer={{ ...layer, y: layer.y + 8 }} onSelect={() => {}} />)}
      </span>
    </span>
  )
}

// `request`: on a merge request's page — { canEdit, onEdit(regionId?) } — the
// card reports the mix (the status block above it says where the request
// stands): a thumbnail, the part, its draft and that draft's name a row; a
// row and its place on the preview light each other; while it can still be
// changed, a row goes to that part in Merge Studio.
function DraftTable({ conflict, workspace, item, editable, onCompare, compareLabel, decisionsOverride, request = null }) {
  const decisions = decisionsOverride ?? workspace.decisionsFor(item.id)
  const rows = draftRows(conflict, item, decisions)
  const decided = rows.filter((row) => row.decided).length
  const decide = (row, option) => workspace.decideDrift(item.id, row.key, option.picked ? null : option.decision)
  // The region pointed at (hovered) or picked (clicked) — in the list or on
  // the result — is lit in both, so a row and the part of the screen it
  // made are seen together.
  const [hovered, setHovered] = useState(null)
  const [pinned, setPinned] = useState(null)
  const focusId = hovered ?? pinned
  const focusRow = rows.find((row) => row.region?.id === focusId)
  const choicesRef = useRef(null)
  const pin = (id) => setPinned((current) => (current === id ? null : id))
  const pinFromPreview = (id) => {
    pin(id)
    choicesRef.current?.querySelector(`[data-mix-choice="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
  // Drafts mixed by screen region: the picks composed into the one screen
  // they make (parts not picked fall back to the first draft, as merging does).
  const base = draftScreens[item.id] && canvasPages.find((page) => page.id === item.designPageId)?.frames[0]
  const result = base ? composeDraftFrame(item.id, base, regionPicks(item.id, decisions), item.authorAId ?? item.variants?.[0]?.key, regionLayout(item.id, decisions)) : null
  const resultHeight = result ? Math.max(120, ...result.layers.map((layer) => (layer.y ?? 0) + (layer.height ?? 0))) + 16 : 0
  const Letter = ({ option, on }) => (
    <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold', on ? 'bg-emerald-300 text-slate-950' : 'bg-white/[0.08] text-slate-300')}>{option.letter}</span>
  )
  const Value = ({ option }) => (
    <span className="truncate" {...(option.literal && { translate: 'no' })}>{option.literal ? option.value : <LocalizedText text={option.value} />}</span>
  )

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="mb-4 flex items-start gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2">
            <span data-mix-title className="text-[15px] font-semibold text-slate-50"><LocalizedText text={rows[0]?.region ? 'Mix of drafts' : 'Values from drafts'} /></span>
            {/* (On a merge request's page, how far along is the status block's to say.) */}
            {!request && <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums', decided === rows.length ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/[0.06] text-slate-400')}>
              <LocalizedText text={decided === rows.length ? 'All picked' : `${decided} of ${rows.length} picked`} />
            </span>}
          </p>
          {/* What this view is, said up front where it's read. */}
          {!editable && !request && <p data-mix-note className="mt-1 text-[12.5px] leading-5 text-slate-300"><LocalizedText text="Drafts are compared and mixed in Merge Studio — this shows what’s picked." /></p>}
        </div>
        {request?.canEdit && (
          // (Neutral: the page's one strong color is its status block's.)
          <button type="button" data-mix-edit onClick={() => request.onEdit()} className="ds-intrinsic ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-xs font-medium text-slate-200 transition-colors hover:bg-white/[0.1] hover:text-white">
            <Layers3 className="size-3.5" />
            병합 스튜디오에서 수정
          </button>
        )}
        {onCompare && !request && (
          <button
            type="button"
            onClick={onCompare}
            className="ds-intrinsic ml-auto inline-flex shrink-0 h-7 items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 text-xs font-medium text-emerald-200 ring-1 ring-emerald-400/40 ring-inset transition-colors hover:bg-emerald-400/15"
          >
            <Layers3 className="size-3.5" />
            <LocalizedText text={compareLabel} />
          </button>
        )}
      </div>
      <div data-draft-review-split className={cn("grid min-h-0 flex-1 gap-4 overflow-hidden", result ? "grid-cols-2" : "grid-cols-1", request && "h-[420px] flex-none items-stretch")}>
      {/* Equal columns keep the composition and its result visible together. */}
      {result && (
        <figure data-mix-result className="order-last flex min-h-0 min-w-0 flex-col overflow-auto border-l border-white/[0.06] pl-4">
          <figcaption className="mb-3 shrink-0 text-xs font-medium text-slate-400"><LocalizedText text={conflict.reviewStage === 'resolved' ? 'Merged result' : '조합 미리보기'} /></figcaption>
          <DraftResultPreview
            result={result}
            height={resultHeight}
            active={focusRow ? { id: focusId, option: focusRow.options.find((option) => option.picked) ?? null } : null}
            onHover={setHovered}
            onPick={pinFromPreview}
          />
        </figure>
      )}
      <div ref={choicesRef} data-draft-review-choices className={cn("min-h-0 min-w-0 divide-y divide-white/[0.05] overflow-auto", request && "flex flex-col justify-center")}>
        {rows.map((row) => {
          const picked = row.options.find((option) => option.picked)
          const region = result && row.region ? row.region.id : null
          const on = region != null && region === focusId
          return (
            <div
              key={row.key}
              data-mix-choice={region ?? undefined}
              data-active={on || undefined}
              {...(region && {
                role: 'button',
                tabIndex: 0,
                'aria-pressed': pinned === region,
                onMouseEnter: () => setHovered(region),
                onMouseLeave: () => setHovered(null),
                onFocus: () => setHovered(region),
                onBlur: () => setHovered(null),
                // (Picking a draft in the row keeps it lit; the row itself toggles —
                // on a request that can still be changed, it goes to that part in Merge Studio.)
                onClick: (event) => (request?.canEdit ? request.onEdit(region) : event.target.closest('button') ? setPinned(region) : pin(region)),
                onKeyDown: (event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); if (request?.canEdit) request.onEdit(region); else pin(region) } },
                ...(request?.canEdit && { title: '병합 스튜디오에서 이 항목 수정' }),
              })}
              className={cn('grid items-center gap-3', request ? 'grid-cols-[72px_112px_minmax(0,1fr)] py-3' : 'grid-cols-[120px_minmax(0,1fr)] py-2.5',
                region && '-mx-2 cursor-pointer rounded-md px-2 transition-colors focus-visible:outline-2 focus-visible:outline-emerald-300',
                on ? 'bg-emerald-400/[0.08]' : region && 'hover:bg-white/[0.03]')}
            >
              {/* The part itself, as its draft draws it. */}
              {request && <PartThumb part={picked && row.region ? draftScreens[item.id]?.drafts[picked.key]?.[row.region.id] : null} />}
              <span className={cn('truncate text-[13px]', on ? 'text-emerald-200' : 'text-slate-300')}>
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
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium text-slate-50">
                  <Letter option={picked} on />
                  <Value option={picked} />
                  {/* (Its draft is the letter before it: not said again on a request's page.) */}
                  {!request && <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11.5px] font-normal text-slate-300"><LocalizedText text={picked.name} /></span>}
                </span>
              ) : (
                <span className="text-[11.5px] text-slate-500">{request ? '아직 고르지 않음' : <LocalizedText text="Not picked — keeps the code" />}</span>
              )}
            </div>
          )
        })}
      </div>
      </div>
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
const RISK_TONE = { high: 'bg-rose-400/20 text-rose-100', medium: 'bg-amber-400/20 text-amber-100', low: 'bg-sky-400/20 text-sky-100' }
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

// (`gist`: what a folded section holds, in a line beside its title — enough to judge by without opening it.)
function InfoSection({ title, count, gist = null, open, onToggle, toggleProps, sectionRef, children, className }) {
  const heading = title && (
    <>
      <span className={cn(INFO_TITLE, 'shrink-0')}><LocalizedText text={title} /></span>
      {count != null && <span data-info-count className="text-[11px] leading-4 text-slate-200 tabular-nums">{count}</span>}
      {gist != null && !open && <span data-info-gist className="min-w-0 truncate text-[11px] leading-4 text-slate-500">{gist}</span>}
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

// A section folded until it's asked for — its title and a line of what's in it (`gist`).
function FoldSection({ title, gist, count, defaultOpen = false, className, children, ...rest }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <InfoSection title={title} count={count} gist={gist} open={open} onToggle={() => setOpen((value) => !value)} toggleProps={{ 'data-fold-toggle': title, ...rest }} className={className}>
      {open && children}
    </InfoSection>
  )
}

// `page`: the full-page detail's order — where it is on the screen first (a block of
// its own, across the panel), then what it is, then `reviewers`, then the details.
function OverviewTab({ conflict, stage, showProject, blockedCount, adjustment, checks, rationale, onOpenEvidence, cause, onOpenCause, reasonNeeded = false, mix = null, hideTodo, page = false, reviewers = null }) {
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
  // Why it conflicts. With compared values, that's the summary over the
  // choice cards (each differing value, once) — not said again here. Only
  // a conflict with nothing to compare gives its own account.
  const cause_text = conflict.comparisonFields?.length ? null : conflict.cause ?? conflict.message ?? summary

  // What the viewer has to do now — and only that: nothing shows when the
  // next move is someone else's. (A review that's yours to give is said on
  // the Review button itself.)
  // (A design decision's next step is the main view's status block — not here.)
  const todo = stage === 'resolved' || hideTodo || conflict.decisionFlow ? null
    : reasonNeeded ? null
        : stage === 'detected' ? 'Review request needed'
          : stage === 'approved' ? (conflict.rollback ? 'Ready to restore previous version' : 'Ready to merge') : null
  const status = listStatusOf(conflict)
  // The design screen it is about (a design-decision review shows its own comparison).
  const designLink = (useDesignLink(conflict).link || conflict.layerId || conflict.decisionFlow) && !isDesignReview(conflict)
  // One label column for the whole tab: every row's label starts at the
  // same x, and so does every value.
  const GRID = 'grid min-w-0 grid-cols-[minmax(64px,max-content)_minmax(0,1fr)] items-baseline gap-x-3 gap-y-2'
  const list = (items) => items.map((text, index) => <Fragment key={text}>{index > 0 && ' · '}<LocalizedText text={text} /></Fragment>)
  // What each section says — the same rows whether it's laid out as the panel's sections or the page's cards.
  const problemRows = (<>
            {designLink && !page && (
              <Row label="Where on the screen" data-summary-row="Screen">
                {conflict.decisionFlow && conflict.layouts ? <BreakpointScreen conflict={conflict} /> : (
                  <div className="flex min-w-0 flex-col items-start gap-1.5">
                    <DesignLinkChip conflict={conflict} />
                    <DesignLinkThumb conflict={conflict} size="md" placeholder />
                  </div>
                )}
              </Row>
            )}
            {(cause_text || cause) && (
              <Row label="Cause" data-summary-row="Cause">
                {cause_text && <LocalizedText text={cause_text} />}
                {cause && (
                  <button
                    type="button"
                    data-cause-version
                    data-open-cause-history
                    onClick={onOpenCause}
                    title="View the version where this conflict started"
                    className="ds-intrinsic group mt-1 flex w-fit cursor-pointer items-center gap-1 rounded py-0.5 text-left text-slate-400 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                  >
                    <span className="text-[11px] font-medium leading-4"><LocalizedText text="View the version where this conflict started" /></span>
                    <ArrowRight className="size-3 shrink-0" />
                  </button>
                )}
              </Row>
            )}
            {(why || standard) && <Row label="Impact" data-summary-row="Impact">{list(why ? [why] : standard.consequence)}</Row>}
            {/* (What was proposed and decided is the main view's — the status
                block and the record under it — not repeated here.) */}
</>)
  const standardRows = standard ? (<>
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
                <LocalizedText text={standard.required || blockedCount > 0 ? 'Required rule' : 'Recommended rule'} />
              </span>
            </Row>
            <Row label="Source">
              {[...standard.origins.map((text) => <LocalizedText key={text} text={text} />), ...standard.links.map((link) => <InfoLink key={link.label} item={link} onOpen={onOpenEvidence} literal={link.kind === 'wcag'} />)]
                .flatMap((node, index) => (index ? [' · ', node] : [node]))}
            </Row>
            <Row label="What it’s for">{list(standard.purpose)}</Row>
</>) : null
  const detailsRows = (<>
            {conflict.rollback ? [
              ['Target file', <span key="f" translate="no" className="font-mono text-[11.5px] break-all">{conflict.rollback.target}</span>],
              ['Roll back to', <><LocalizedText text={conflict.rollback.label} />{conflict.rollback.timestamp && <span className="text-slate-400"> · <LocalizedText text={conflict.rollback.timestamp} /></span>}</>],
              requester && ['Requested by', <>{requester.name}<span className="text-slate-400"> · <LocalizedText text={requester.role} /></span></>],
            ].filter(Boolean).map(([label, value]) => <Row key={label} label={label}>{value}</Row>) : <ReviewDetails conflict={conflict} showProject={showProject} open={open} />}
</>)

  // The page's impact & evidence: each section a card — the record's own (StepRow) — its head saying
  // enough to judge by without opening it (a chip). The one that decides it is open to start with (what
  // conflicts, and what it does); any can be opened alongside the others, and the cards stay as they're
  // left when the tab is left.
  const folds = useFoldState(`evidence:${conflict.id}`)
  if (page) {
    const differs = (conflict.comparisonFields ?? []).find((field) => field.current !== field.expected)
    const short = (value) => String(value ?? '').replace(/\s*\(.*\)\s*$/, '')
    const cards = [
      !mix && !conflict.rollback && designLink && { key: 'where', title: 'Where on the screen', icon: <MapPin />, chip: conflict.layerName ?? conflict.title?.split(' / ')[0], body: <ScreenLocation conflict={conflict} /> },
      !mix && !conflict.rollback && (cause_text || cause || why || standard) && { key: 'problem', title: 'Conflict information', icon: <GitCompareArrows />, chip: differs ? `${short(differs.current)} → ${short(differs.expected)}` : null, body: <dl data-info-problem className={RECORD_ROWS}>{problemRows}</dl>, open: true },
      !conflict.rollback && standard && { key: 'standard', title: 'Standard', icon: <BookCheck />, chip: standard.rules.map((rule) => tr(rule.name)).join(' · '), body: <dl data-info-standard className={RECORD_ROWS}>{standardRows}</dl> },
      reviewers && { key: 'reviewers', title: 'Reviewers', icon: <Users />, chip: reviewers.count ? `${reviewers.approved}/${reviewers.count} ${tr('approved')}` : tr('None yet'), body: reviewers.body, open: reviewers.open },
      { key: 'details', title: 'Developer details', icon: <FileCode2 />, chip: conflict.rollback ? conflict.rollback.target?.split('/').pop() : conflict.file ? `${conflict.file.split('/').pop()}${conflict.line ? `:${conflict.line}` : ''}` : null, body: <dl data-review-summary className={RECORD_ROWS}>{detailsRows}</dl> },
    ].filter(Boolean)
    const isOpen = (key) => folds.get(key, Boolean(cards.find((card) => card.key === key)?.open))
    const allOpen = cards.every((card) => isOpen(card.key))
    return (
      <div data-review-info className="flex min-h-full flex-col">
        {(conflict.rollback || isAiDraft || todo) && <InfoSection>
          <div data-status-badges className="flex flex-wrap items-center gap-1.5">
            {conflict.rollback && (
              <span data-status-badge className={cn(INFO_BADGE, STATUS_TEXT[status.id])}>
                <span className={cn('size-1.5 shrink-0 rounded-full', status.dot)} />
                <LocalizedText text={ROLLBACK_STAGE_LABEL[stage]} />
              </span>
            )}
            {isAiDraft && <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><Sparkles className="size-3 shrink-0" aria-hidden /><LocalizedText text="AI draft" /></span>}
          </div>
          {todo && <p data-next-step className={cn(INFO_VALUE, 'mt-2')}><LocalizedText text={todo} /></p>}
          {conflict.rollback && open && shortDue(conflict.dueLabel) && <p className={cn(INFO_VALUE, 'mt-1 text-slate-400')}><DueDate label={conflict.dueLabel} /></p>}
          {conflict.rollback && summary && <p className={cn(INFO_VALUE, 'mt-2')}><LocalizedText text={summary} /></p>}
        </InfoSection>}
        <section data-step-record data-evidence-record aria-label={tr('Impact & evidence')} className="shrink-0 pb-2">
          <div data-step-list-head className="mb-3 flex items-center gap-2">
            <h3 className="text-[12px] font-semibold tracking-wide text-slate-400"><LocalizedText text="Impact & evidence" /></h3>
            <span data-evidence-count className="text-xs text-slate-400 tabular-nums">· {cards.length}</span>
            <button type="button" data-fold-all onClick={() => folds.setMany(cards.map((card) => card.key), !allOpen)} className="ml-auto cursor-pointer text-xs font-medium text-slate-400 underline-offset-2 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-emerald-300">
              {allOpen ? '모두 접기' : '모두 펼치기'}
            </button>
          </div>
          <ol data-step-list className="m-0 flex list-none flex-col gap-2 p-0">
            {cards.map((card) => (
              <StepRow key={card.key} data-fold={card.key} data-evidence={card.key} section state="done" title={tr(card.title)} icon={card.icon} chip={card.chip} open={isOpen(card.key)} onToggle={() => folds.set(card.key, !isOpen(card.key))} last={false}>
                {card.body}
              </StepRow>
            ))}
          </ol>
        </section>
      </div>
    )
  }

  return (
    // The sidebar's Info tab, as four groups under equal hairlines — Status,
    // Problem, Evidence, Review — then Details. Labels are one small grey
    // column; values the default color.
    <div data-review-info className="flex min-h-full flex-col">
      {/* Required rules and rollback status, followed by the next action.
          The title row carries the review status and risk. */}
      {/* (Nothing to say here — a design decision's status is the main view's — no empty section.) */}
      {(conflict.rollback || isAiDraft || todo) && <InfoSection>
        <div data-status-badges className="flex flex-wrap items-center gap-1.5">
          {/* (A conflict's status is the badge beside its title; only a
              rollback agreement, which has none, says it here.) */}
          {conflict.rollback && (
            <span data-status-badge className={cn(INFO_BADGE, STATUS_TEXT[status.id])}>
              <span className={cn('size-1.5 shrink-0 rounded-full', status.dot)} />
              <LocalizedText text={ROLLBACK_STAGE_LABEL[stage]} />
            </span>
          )}
          {isAiDraft && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><Sparkles className="size-3 shrink-0" aria-hidden /><LocalizedText text="AI draft" /></span>
          )}
        </div>
        {todo && <p data-next-step className={cn(INFO_VALUE, 'mt-2')}><LocalizedText text={todo} /></p>}
        {conflict.rollback && open && shortDue(conflict.dueLabel) && <p className={cn(INFO_VALUE, 'mt-1 text-slate-400')}><DueDate label={conflict.dueLabel} /></p>}
        {conflict.rollback && summary && <p className={cn(INFO_VALUE, 'mt-2')}><LocalizedText text={summary} /></p>}
      </InfoSection>}

      {/* (A mix of drafts lists its picks in the main view, beside the
          result — not again here.) */}

      {/* 2 · Problem: why it conflicts — with a small link to the version
          it came in with, right under — and what goes wrong if it stays. */}
      {/* (The page: the screen it's on comes first, the first thing under the tabs.) */}
      {/* (Where it is on the screen: the canvas beside the pane lights the element itself — so here it's folded.) */}
      {page && !mix && !conflict.rollback && designLink && (
        <FoldSection title="Where on the screen" gist={conflict.layerName ?? conflict.title?.split(' / ')[0]} className="border-t-0 pt-0">
          <ScreenLocation conflict={conflict} />
        </FoldSection>
      )}
      {!mix && !conflict.rollback && (cause_text || cause || why || standard || (designLink && !page)) && (
        <InfoSection title="Conflict information">
          <dl data-info-problem className={GRID}>{problemRows}</dl>
        </InfoSection>
      )}

      {/* 3 · Standard: always open, three lines — the rule (its token a
          link to where it's defined, its grade a quiet tag), where it comes
          from (the Figma frame a link) and what it's for. No chip list, no
          count; comments are the Comments tab's. */}
      {/* (Folded: the rule's name says enough to judge by; its source and purpose are there when opened.) */}
      {!conflict.rollback && standard && (
        <FoldSection title="Standard" gist={<>{standard.rules.map((rule, index) => <Fragment key={rule.id}>{index > 0 && ' · '}<LocalizedText text={rule.name} /></Fragment>)}</>}>
          <dl data-info-standard className={GRID}>{standardRows}</dl>
        </FoldSection>
      )}

      {/* (The page: who reviews it, after what it is — before the details.) */}
      {reviewers}
      {/* Details: folded; its rows share the same label column. */}
      <InfoSection sectionRef={detailsRef} title="Developer details" open={showDetails} onToggle={() => setShowDetails((value) => !value)} toggleProps={{ 'data-details-toggle': '' }}>
        {showDetails && (
          <dl data-review-summary className={GRID}>{detailsRows}</dl>
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
  const runWith = (decision) => {
    if (!rows.length || !workspace?.mergeDrafts) return null
    const draft = workspace.mergeDrafts.current?.[item.id] ?? {}
    return checksFor(item, { ...draft, resolutions: { ...decisions, ...Object.fromEntries(rows.map((row) => [row.key, decision])) } }, workspace.linesOfFile)
  }
  const runs = open ? { A: runWith('A'), B: runWith('B') } : { A: null, B: null }
  const failingOf = (run) => run && new Set(run.failing.map((check) => check.id).filter((id) => !settled.includes(id)))
  const failing = { A: failingOf(runs.A), B: failingOf(runs.B) }
  // The required checks each side would break (null: the sides can't be
  // told apart — whatever is required now holds for either).
  const blockingOf = (run) => run && run.blocking.filter((check) => !settled.includes(check.id))
  const blockingWith = { A: blockingOf(runs.A), B: blockingOf(runs.B) }
  // …and the checks each side would fail without being blocked by them
  // (suggestions: consistency with the design system, not a required
  // rule). "Options undecided" isn't one — that's the choice itself.
  const suggestedOf = (run) => run && run.failing.filter((check) => !run.blocking.includes(check) && check.id !== 'decided' && !settled.includes(check.id))
  const suggestedWith = { A: suggestedOf(runs.A), B: suggestedOf(runs.B) }
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
    required, suggested, suggestedWith, cardBlockers, otherClears, resolvingSide, meets, blockingWith,
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


// `location`: the file and line, said at the left of the row the layout tabs are on.
function CodeDiffColumns({ rows, codeConflict = false, location = null }) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-medium text-slate-400">
        {!codeConflict && <><Sparkles className="size-3 shrink-0 text-emerald-300" /><LocalizedText text="AI suggestion" /></>}
        {location && <span data-conflict-code-location translate="no" title={location} className="min-w-0 truncate font-mono text-[11px] font-normal text-slate-500">{location.split('/').at(-1)}</span>}
        {/* (How the diff is laid out is a view control: up in the detail's header, beside Close.) */}
        <ReviewHeaderPortal fallbackClassName="ml-auto"><DiffLayoutTabs /></ReviewHeaderPortal>
      </div>
      <div className="scroll-fade-bottom min-w-0 overflow-auto rounded-md bg-black/20 py-1">
        <DiffView rows={rows} lit={!codeConflict} labels={codeConflict ? ['Conflicting code', 'Proposed resolution'] : ['Before', 'After']} />
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

function ReviewerPicker({ people, onSelect, children, align = 'start', triggerProps = {} }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger {...triggerProps}>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-48">
        {people.map((person) => (
          <DropdownMenuItem key={person.id} onClick={() => onSelect(person)} className="gap-2">
            <PersonAvatar person={person} />
            <span>{person.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// The review's main column is three sections — what's different, how to
// resolve it, the code that changes — each under the same kind of title,
// with more room between sections than inside one, so the groups show.
const SECTION_TITLE = 'text-[13px] leading-5 font-semibold text-white'
const SECTION_HEAD = 'mb-4 flex min-w-0 items-center gap-2' // 16px to its content
const STATE_CHIP = 'inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap'

// A rule a way of resolving it runs into, on that way's own card: one line
// saying how much it matters — required (it can't merge without the
// reviewers' exception) or recommended (it can) — opening to which rule it
// is and why it's there. Nothing shows for a way that breaks no rule.
function RuleNote({ check, required, action, checks = [check] }) {
  const [open, setOpen] = useState(false)
  const why = checkGuidance(check)?.impact ?? check.hint ?? null
  // A required rule: one quiet line with the action at its end — what and
  // why on hover or focus, not in the card.
  if (required) {
    const tip = checks.map((item) => [item.title, checkGuidance(item)?.impact ?? item.hint].filter(Boolean).join(' — ')).join('\n')
    return (
      <div data-rule-note="required" className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] leading-4 text-slate-400">
        <span tabIndex={0} title={tip} className="flex min-w-0 cursor-help items-center gap-1 focus-visible:outline-2 focus-visible:outline-emerald-300">
          <TriangleAlert aria-hidden className="size-3 shrink-0 text-amber-300" />
          <span className="min-w-0 truncate"><LocalizedText text="Exception needed" />{checks.length > 1 && ` · ${checks.length}`}</span>
        </span>
        {action}
      </div>
    )
  }
  return (
    <div data-rule-note="recommended" className="min-w-0 rounded-lg bg-white/[0.04] text-[11px] leading-4 text-slate-300">
      <button
        type="button"
        aria-expanded={open}
        // (On a card that's itself a choice: opening the note isn't choosing it.)
        onClick={(event) => { event.stopPropagation(); setOpen((value) => !value) }}
        onKeyDown={(event) => event.stopPropagation()}
        className="ds-intrinsic flex w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-emerald-300"
      >
        <span className="min-w-0 flex-1 truncate font-medium"><LocalizedText text="Recommended · can merge" /></span>
        <ChevronDown aria-hidden className={cn('size-3 shrink-0 opacity-70 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <dl className="space-y-1 px-2 pb-2 text-[11px] leading-4">
          <div><dt className="inline opacity-70"><LocalizedText text="Rule" /> · </dt><dd className="inline"><LocalizedText text={check.title} /></dd></div>
          {why && <div><dt className="inline opacity-70"><LocalizedText text="Why it matters" /> · </dt><dd className="inline"><LocalizedText text={why} /></dd></div>}
        </dl>
      )}
    </div>
  )
}

// A merge conflict's ways out: each side's lines from between the markers,
// and the suggested mix (the diff's "after").
function codeConflictOptions(conflict) {
  const before = conflict.diff?.before ?? []
  const mid = before.findIndex((line) => /^={7}$/.test(line))
  const end = before.findIndex((line) => /^>{7}/.test(line))
  const sides = mid > 0 && end > mid ? { local: before.slice(1, mid), remote: before.slice(mid + 1, end) } : null
  return [
    ...(sides ? [
      { id: 'local', title: conflict.codeComparison?.localTitle ?? 'Keep local', note: conflict.branches?.local, desc: conflict.codeComparison?.local, lines: sides.local },
      { id: 'remote', title: conflict.codeComparison?.remoteTitle ?? 'Take remote', note: conflict.branches?.remote, desc: conflict.codeComparison?.remote, lines: sides.remote },
    ] : []),
    { id: 'both', title: 'Apply both', note: 'Suggested', plain: true, desc: conflict.codeComparison?.resolution ?? conflict.suggestion, lines: conflict.diff?.after ?? [] },
  ]
}

// `page`: on the full-screen detail it's one card of natural height, laid out
// as a design decision's is (DesignDecisionFlow's 해결 방법): what's built
// beside what the way picked gives, the ways as a list under them, and the
// one action (`action`) at the card's foot.
function DiffTab({ conflict, code, flow, mergedLines, changeAfter, state, checkBlocks, codeChange, reviewerNeeded = false, reviewerCandidates = [], onAssignReviewer, onCodeChoice, page = false, action = null }) {
  const readOnly = conflict.reviewStage === 'resolved'
  // Finished: the merged code around the change (the file's own lines when
  // there are any, else the change's result), and the toggle to the
  // conflict as it was.
  const [showBefore, setShowBefore] = useState(false)
  // (The merged code: folded behind its file's line until asked for.)
  const [mergedCodeOpen, setMergedCodeOpen] = useState(false)
  // The code section: open by default; folding it is remembered.
  // (Designers start with it folded, developers with it open; whichever they choose is kept.)
  const [showCode, setShowCode] = useState(() => {
    try {
      const kept = localStorage.getItem('devsign.review.showCode')
      if (kept === '0' || kept === '1') return kept === '1'
    } catch { /* not kept */ }
    return isDeveloperViewer(conflict.projectId)
  })
  const toggleCode = () => setShowCode((value) => { try { localStorage.setItem('devsign.review.showCode', value ? '0' : '1') } catch { /* not kept */ } return !value })
  const [showAlternatives, setShowAlternatives] = useState(false)
  // A merge conflict: which side's code to take — the suggested mix by default.
  const codeChoice = conflict.codeChoice ?? 'both'
  const setCodeChoice = (id) => onCodeChoice?.(id)
  // The card under the pointer: the code block shows its result meanwhile.
  const [hover, setHover] = useState(null)
  // The third card's dropdown (choosing the card opens it), and the value
  // in it under the pointer — tried on in the card and the code meanwhile.
  const [exceptionEditor, setExceptionEditor] = useState(null)
  const mergedFile = mergedLines ?? conflict.mergedFileLines ?? code?.generated ?? null
  const codeConflict = conflict.kind === 'code-conflict' || conflict.diff?.before?.some((line) => /^<{7}|^={7}$|^>{7}/.test(line))
  const mergedExcerpt = (() => {
    // A merge conflict merges with the way picked for it.
    if (codeConflict) {
      const options = codeConflictOptions(conflict)
      const lines = (options.find((option) => option.id === codeChoice) ?? options.at(-1)).lines
      return lines.map((text, index) => ({ number: (conflict.line ?? 1) + index, text }))
    }
    const after = conflict.diff?.after ?? []
    if (!mergedFile?.length) return after.map((text, index) => ({ number: (conflict.line ?? 1) + index, text }))
    // Where the merged lines actually are (the file may have shifted).
    const found = mergedFile.findIndex((text) => after.length && text.trim() === after[0].trim())
    const at = found >= 0 ? found : Math.max(0, (conflict.line ?? 1) - 1)
    const from = Math.max(0, at - 2)
    return mergedFile.slice(from, at + Math.max(after.length, 1) + 2).map((text, index) => ({ number: from + index + 1, text }))
  })()
  if (!conflict.branches && !conflict.diff && !conflict.suggestion && !conflict.preview && !conflict.comparisonFields?.length) {
    return (
      <div className="h-full">
        <EmptyNote>No diff captured for this conflict yet.</EmptyNote>
      </div>
    )
  }
  const rows = conflict.diff ? diffLines(conflict.diff.before ?? [], changeAfter ?? conflict.diff.after ?? []) : []
  const pairedPreview = !codeConflict && Boolean(conflict.comparisonFields?.length)
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
  // The reference is exactly what's there now: choosing it changes nothing,
  // so it isn't offered — two cards, what's there and a value of one's own.
  // (Unless it's what was decided: that still has to show.)
  const sameSides = !conflict.comparisonFields?.some((field) => field.current !== field.expected)
  const hideReference = sameSides && choice !== 'A'
  const offered = hideReference ? cards.filter((card) => card.id !== 'A') : cards
  const editing = Boolean(flow?.editing)
  // Red only for a value that breaks the standard, green for one that
  // matches it, plain for anything else (a value both sides share, one set
  // by hand to something of its own).
  const toneOf = (text, field) => (readOnly || field.current === field.expected ? 'text-slate-200'
    : text === field.expected || String(field.expected).toLowerCase().includes(String(text).toLowerCase()) ? 'text-emerald-200'
      : text === field.current ? 'text-red-300' : 'text-slate-100')
  const swatchIn = (text) => /#[0-9a-fA-F]{3,8}\b/.exec(text ?? '')?.[0]
  // The same on both sides: nothing to choose between for this property.
  const same = (field) => field.current === field.expected
  // The required rules each way would break — never "can't merge": going
  // that way needs the reviewers' exception approval, asked for with a
  // reason. (Said once, under the cards, for the way that's chosen.)
  const breaks = (id) => flow?.violations?.[id] ?? []
  const exception = Boolean(choice) && breaks(choice).length > 0
  const differs = conflict.comparisonFields?.some((field) => field.current !== field.expected)
  // One badge a card: how it stands with the standard.
  const MEETS = { tone: 'bg-emerald-400/10 text-emerald-200', icon: Check, text: 'Meets the design standard' }
  const DIFFERS = { tone: 'bg-white/[0.07] text-slate-300', text: 'Differs from the standard' }
  // (A broken rule is said quietly on a card — an outline, a small amber
  // mark: the one loud place is what has to be done about it, below.)
  const badgeOf = (id) => (breaks(id).length ? { tone: 'border border-white/15 text-slate-300', icon: TriangleAlert, iconTone: 'text-amber-300', text: 'Breaks the standard · exception needed' }
    // (The only way that keeps the rule: a value of one's own.)
    : id === 'C' && (hideReference || breaks('A').length > 0) && breaks('B').length > 0 ? { ...MEETS, text: 'Recommended' }
    // (The reference, where keeping the current value breaks a required
    // rule: recommended — that says it meets the standard, too.)
    : id === 'A' && differs ? (breaks('B').length ? { ...MEETS, text: 'Recommended' } : MEETS)
      : id === 'B' && differs ? DIFFERS
        // (Nothing until a value is chosen; a value being tried on isn't one.)
        : id === 'C' && flow?.custom ? (flow.customIsReference ? MEETS : DIFFERS) : null)
  // What each way does to the code — shown in one place, the block under
  // the cards (for the way chosen, or the card under the pointer).
  const codeBefore = conflict.diff?.before ?? []
  const linesOf = (id) => (id === 'A' ? conflict.diff?.after : id === 'B' ? codeBefore : custom?.lines) ?? null
  const shown = hover && hover !== choice && linesOf(hover) ? hover : choice
  const shownCard = cards.find((card) => card.id === shown) ?? null
  // What it breaks, in a line: each compared value against the standard's.


  // A way's values, a line each: its name, then it (set on the row itself
  // where it's a value of one's own).
  const valuesOf = (card, { isCustom, empty, picks }) => (
                    <dl className={cn('@container min-w-0 space-y-2', empty && !picks && 'hidden')}>
                      {conflict.comparisonFields.map((field, index) => {
                        // Set by hand: what it was → what it is.
                        const hand = isCustom && custom?.rows[index]?.to ? custom.rows[index] : null
                        const text = isCustom ? custom?.rows[index]?.base ?? field.current : card.value(field)
                        // A color value gets its swatch beside it.
                        const swatch = hand ? hand.swatch : swatchIn(text)
                        // (Every card's rows are one height — 28px, the
                        // editor's — so the cards line up row for row.)
                        const editorHere = picks && editing && Boolean(flow.controls[index])
                        return (
                        <div key={field.label} className="flex min-h-7 min-w-0 items-center justify-between gap-2">
                          <dt className="min-w-0 truncate text-[11.5px] text-slate-400"><LocalizedText text={field.label} /></dt>
                          {editorHere ? (
                            <dd data-value-editor={flow.controls[index].mode} className="-mr-[7px] flex shrink-0"><ValueEditor control={flow.controls[index]} /></dd>
                          ) : picks && hand ? (
                            // (Decided: the value it was set to, as the
                            // other cards show theirs.)
                            <dd data-adjusted-value className={cn('flex min-w-0 items-baseline justify-end gap-1.5 text-right text-[13px] leading-5 font-semibold tabular-nums', toneOf(hand.to, field))}><ValueText text={hand.to} /></dd>
                          ) : hand ? (
                            <dd data-adjusted-value className={HAND_VALUE}>
                              <span className="font-normal text-slate-500 line-through"><LocalizedText text={hand.base} /></span>
                              <span aria-hidden className="font-normal text-slate-500">→</span>
                              {swatch && <span aria-hidden className="size-3 shrink-0 self-center rounded-full ring-1 ring-white/30" style={{ background: swatch }} />}
                              <span translate="no" className={toneOf(hand.to, field)}>{hand.to}</span>
                            </dd>
                          ) : (
                          // A value both sides share isn't a difference:
                          // quiet, and marked "Same". One that differs from
                          // the standard is the one in color.
                          <dd data-value={same(field) ? 'same' : 'differs'} className={cn('flex min-w-0 items-baseline justify-end gap-1.5 text-right text-[13px] leading-5 break-words tabular-nums', same(field) ? 'font-normal text-slate-500' : cn('font-semibold', toneOf(text, field)))}>
                            {swatch && <span aria-hidden className="size-3 shrink-0 self-center rounded-full ring-1 ring-white/30" style={{ background: swatch }} />}
                            <ValueText text={text} />
                            {same(field) && <span data-same className="text-[10.5px] font-normal text-slate-500"><LocalizedText text="Same" /></span>}
                          </dd>
                          )}
                        </div>
                        )
                      })}
                      {/* Set by hand on something the comparison doesn't
                          list (another property, another element) — the
                          same "old → new" form. */}
                      {isCustom && custom?.extras.map((change) => (
                        <div key={`${change.layerName ?? ''}:${change.label}`} data-adjusted-row className="flex min-h-7 min-w-0 items-center justify-between gap-2">
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
  )
  // The rules a way runs into, said under it.
  const rulesOf = (card, { on, isCustom, required, advisories }) => (!readOnly && (required.length > 0 || advisories.length > 0) ? (
                      <div data-card-rules className="min-w-0 space-y-1">
                        {required.slice(0, 1).map((check) => (
                          <RuleNote key={check.id} check={check} checks={required} required action={editing ? (
                            <button type="button" data-request-card-exception={card.id} disabled={isCustom && !flow.custom} onClick={(event) => { event.stopPropagation(); if (!on) flow.choose(card.id); setExceptionEditor(`${conflict.id}:${card.id}`) }} onKeyDown={(event) => event.stopPropagation()} className="ds-intrinsic inline-flex h-5 shrink-0 cursor-pointer items-center gap-0.5 rounded px-1 text-[10.5px] text-amber-200/80 transition-colors hover:bg-white/[0.06] hover:text-amber-100 focus-visible:outline-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-40">
                              <LocalizedText text="Apply exception" />
                              <ArrowRight aria-hidden className="size-3" />
                            </button>
                          ) : null} />
                        ))}
                        {advisories.map((check) => <RuleNote key={check.id} check={check} />)}
                      </div>
  ) : null)
  // ── The page's layout of the same choice ──
  // A way's values in a line (those that differ; all of them when none do).
  const valueLine = (card) => {
    const fields = conflict.comparisonFields ?? []
    const told = fields.some((field) => !same(field)) ? fields.map((field, index) => [field, index]).filter(([field]) => !same(field)) : fields.map((field, index) => [field, index])
    if (card.id === 'C') return custom ? told.map(([field, index]) => custom.rows[index]?.to ?? custom.rows[index]?.base ?? field.current).join(', ') : null
    return told.map(([field]) => card.value(field)).join(', ')
  }
  // What's on the right of the picture: the way under the pointer, else the
  // one picked, else the reference (never an empty box).
  const afterId = (hover && hover !== choice ? hover : choice) ?? (offered.some((card) => card.id === 'A') ? 'A' : offered[0]?.id ?? null)
  const afterCard = cards.find((card) => card.id === afterId) ?? null
  const PICTURE = 'grid h-[240px] min-w-0 grid-rows-[minmax(0,1fr)_40px] overflow-hidden rounded-xl border-2 bg-black/20 p-4'
  const pageChoices = () => (
    <>
      {/* Before → After: what's built, beside what the way gives. */}
      {conflict.preview && (
        <div data-before-after className="grid grid-cols-1 items-stretch gap-3 min-[769px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <figure data-picture="before" className={cn(PICTURE, 'border-transparent')}>
            {/* (A frame of fixed ratio, the drawing set in its middle: a 24px button beside a 20px one moves nothing.) */}
            <div className="mx-auto w-full max-w-[300px] self-center"><PreviewFrame ratio={2}><span className="block w-56"><ChangePreview preview={conflict.preview} side="before" showLabels={false} /></span></PreviewFrame></div>
            <figcaption className="min-w-0 self-end text-center">
              <span className="block h-5 truncate text-[13px] leading-5 font-medium text-slate-200"><LocalizedText text={readOnly ? 'Before the change' : 'What’s built now'} /></span>
            </figcaption>
          </figure>
          <ArrowRight aria-hidden data-before-after-arrow className="mx-auto size-4 shrink-0 rotate-90 self-center text-slate-500 min-[769px]:rotate-0" />
          <figure data-picture="after" data-after={afterId ?? 'none'} className={cn(PICTURE, choice && afterId === choice && !readOnly ? 'border-emerald-400' : 'border-transparent')}>
            {/* (The same picture throughout — given the way's values, re-drawn in place; never keyed by the way.) */}
            <div className="contents">
              <div className="mx-auto w-full max-w-[300px] self-center"><PreviewFrame ratio={2}><span className="block w-56"><ChangePreview preview={conflict.preview} side={afterCard?.side ?? 'after'} showLabels={false} override={afterCard?.id === 'C' && custom ? custom.preview : undefined} /></span></PreviewFrame></div>
              <figcaption className="min-w-0 self-end text-center">
                <span data-after-title className="block h-5 truncate text-[13px] leading-5 font-medium text-slate-200"><LocalizedText text={readOnly ? 'After the change' : choice && afterId === choice ? '선택한 결과' : hover ? '미리보기' : 'Design reference'} /></span>
              </figcaption>
            </div>
          </figure>
        </div>
      )}
      {/* The ways forward, a line each: text first, how it stands with the standard at its end. */}
      <div role={readOnly ? undefined : 'radiogroup'} aria-label="해결 방법 선택" data-choice-list className={cn('flex flex-col', conflict.preview && 'mt-6')}>
        {offered.filter((card) => !readOnly || showAlternatives || card.id === choice).map((card) => {
          const on = choice === card.id
          const isCustom = card.id === 'C'
          const empty = isCustom && !custom
          const picks = isCustom && Boolean(flow?.controls)
          const choose = !editing ? undefined : !on ? () => flow.choose(card.id) : undefined
          const inert = !choose
          const required = breaks(card.id)
          const advisories = required.length ? [] : flow?.advisories?.[card.id] ?? []
          const badge = required.length || advisories.length ? null : badgeOf(card.id)
          const line = valueLine(card)
          return (
            <div key={card.id} data-applied={readOnly && on ? '' : undefined} className={cn(!readOnly && !editing && !on && 'opacity-50')} onMouseEnter={editing ? () => setHover(card.id) : undefined} onMouseLeave={editing ? () => setHover(null) : undefined}>
              <div
                role={readOnly ? undefined : 'radio'}
                aria-checked={readOnly ? undefined : on}
                aria-disabled={!editing}
                tabIndex={inert ? -1 : 0}
                onClick={inert ? undefined : (event) => { if (event.currentTarget.contains(event.target)) choose() }}
                onKeyDown={(event) => {
                  if (inert || event.target !== event.currentTarget || (event.key !== ' ' && event.key !== 'Enter')) return
                  event.preventDefault()
                  choose()
                }}
                onFocus={editing ? () => setHover(card.id) : undefined}
                onBlur={editing ? () => setHover(null) : undefined}
                data-side={card.side}
                data-decision={card.id}
                data-choice-tone={card.id}
                className={cn(
                  'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-300',
                  on ? (readOnly ? 'bg-white/[0.05]' : 'bg-emerald-400/[0.08]') : !inert && 'hover:bg-white/[0.04]',
                  !inert && 'cursor-pointer'
                )}
              >
                {!readOnly && (
                  <span aria-hidden className={cn('flex size-4 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-emerald-400' : 'border-white/30')}>
                    {on && <span className="size-2 rounded-full bg-emerald-400" />}
                  </span>
                )}
                <span className="min-w-0 flex-1 text-[13px] leading-5">
                  <span className="font-medium text-slate-100"><LocalizedText text={card.title} /></span>
                  <span className="text-slate-400"> · {line ? <ValueText text={line} /> : <LocalizedText text={card.source ?? ''} />}</span>
                  {badge && !readOnly && (
                    <span data-card-recommendation={badge.text === 'Recommended' ? '' : undefined} data-card-badge className={cn('ml-2 inline-flex h-[18px] items-center gap-1 rounded px-1.5 align-middle text-[10.5px] leading-none font-medium whitespace-nowrap', badge.tone)}>
                      {badge.icon && <badge.icon className={cn('size-3 shrink-0', badge.iconTone)} />}
                      <LocalizedText text={badge.text} />
                    </span>
                  )}
                </span>
                {readOnly && on && <span data-applied-tag className="shrink-0 rounded bg-white/[0.1] px-1.5 py-0.5 text-[10.5px] leading-none font-medium text-white"><LocalizedText text="Applied" /></span>}
                {/* (Where its values come from, quiet, at the row's end.) */}
                {!isCustom && card.source && <span className="hidden max-w-[38%] shrink-0 truncate text-[11px] text-slate-500 lg:block" title={card.source}><LocalizedText text={card.source} /></span>}
              </div>
              {/* A value of one's own is set right under its row — only there. */}
              {isCustom && on && (editing || custom) && (
                <div data-choice-controls className="mt-1 mb-2 ml-10 flex max-w-[360px] flex-col gap-2.5">
                  {valuesOf(card, { isCustom, empty, picks })}
                  {editing && !flow.controls && empty && (flow.openStudio ? (
                    <button type="button" data-adjust-start onClick={(event) => { event.stopPropagation(); flow.openStudio() }} className={cn(NAV_BUTTON, 'w-fit justify-center bg-transparent')}>
                      <Plus className={NAV_BUTTON_ICON} />
                      <LocalizedText text="Set it in Merge Studio" />
                    </button>
                  ) : <p data-adjust-start className="text-xs leading-[18px] text-slate-400"><LocalizedText text="Set it on the canvas above: select the element and change its values." /></p>)}
                  {editing && flow.openStudio && (picks || custom) && (
                    <button type="button" data-adjust-more onClick={(event) => { event.stopPropagation(); flow.openStudio() }} className="ds-intrinsic inline-flex h-6 w-fit cursor-pointer items-center gap-1 rounded-md px-2 text-[11px] font-medium text-slate-300 ring-1 ring-white/[0.14] transition-colors ring-inset hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300">
                      <Pencil className="size-3 shrink-0" />
                      <LocalizedText text="Edit in Merge Studio" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )

  return (
    <div className={cn('flex flex-col', !page && 'h-full')}>
      {/* ② How to resolve it: the title, and one chip saying whether a way
          is chosen. Which way shows on the cards (the check, the border);
          who's reviewing is the sidebar's; a rule a way breaks is on that
          way's card — none of it is repeated here. */}
      {pairedPreview && flow && !readOnly && (
        <div className={SECTION_HEAD}>
          <h3 data-pick-guide={choice ?? 'none'} className={SECTION_TITLE}><LocalizedText text="How to resolve it" /></h3>
          {/* (Decided as soon as a way is chosen — sending it for review is
              the header button's step, not this one's.) */}
          <span data-decision-chip={choice ? 'decided' : 'open'} className={cn(STATE_CHIP, choice ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/[0.07] text-slate-300')}>
            <LocalizedText text={choice ? 'Decided' : 'Not chosen yet'} />
          </span>
          {flow.canChange && (
            <button type="button" data-change-decision onClick={flow.changeDecision} className={cn(TEXT_ACTION, 'ml-auto')}>
              <LocalizedText text="Change decision" />
            </button>
          )}
        </div>
      )}
      {/* Decided: why, right under what was decided. */}
      {pairedPreview && flow?.reason?.value && !editing && (
        <div data-decision-reason={choice} className="-mt-2 mb-4 min-w-0"><ReasonField key={`${conflict.id}:${choice}`} {...flow.reason} readOnly /></div>
      )}
      {/* The decision's button and the title above stay put; only what's
          compared scrolls, so neither is ever pushed out of view. */}
      <div data-choice-scroll className={cn('min-w-0', pairedPreview && !page && 'min-h-0 flex-1 overflow-auto')}>
      {pairedPreview && flow && !readOnly && hideReference && breaks('B').length > 0 && (
        <p data-no-reference className="-mt-1.5 mb-3 text-xs leading-[18px] text-slate-400"><LocalizedText text="The design reference doesn’t keep the rule either. Adjusting it by hand can." /></p>
      )}
      {/* (Not for a merge conflict in code: there's nothing to adjust in Merge Studio.) */}
      {!pairedPreview && !codeConflict && flow?.editing && flow.openStudio && (
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
              {readOnly && offered.length > 1 && (
                <button type="button" data-alternatives-toggle aria-expanded={showAlternatives} onClick={() => setShowAlternatives((value) => !value)} className="inline-flex w-fit items-center gap-1 text-xs text-slate-400 hover:text-white">
                  <LocalizedText text={showAlternatives ? 'Hide other choices' : 'View other choices'} />
                  <ChevronDown className={cn('size-3.5 transition-transform', showAlternatives && 'rotate-180')} />
                </button>
              )}
              {/* ② One of three, like radio options, all the same height:
                  the picked one in green with a check, the others with an
                  empty ring. Decided: the chosen one stands, the rest fade. */}
              {page ? pageChoices() : (
              <div role={readOnly ? undefined : 'radiogroup'} aria-label="해결 방법 선택" className={cn('grid gap-2', (readOnly && !showAlternatives ? 1 : offered.length) === 2 ? 'grid-cols-2' : (readOnly && !showAlternatives ? 1 : offered.length) === 3 ? 'grid-cols-3' : '')}>
                {offered.filter((card) => !readOnly || showAlternatives || card.id === choice).map((card) => {
                  const on = choice === card.id
                  const isCustom = card.id === 'C'
                  const empty = isCustom && !custom
                  // (The third card, with a value to choose on it: choosing
                  // the card opens that, picked already or not.)
                  const picks = isCustom && Boolean(flow?.controls)
                  const choose = !editing ? undefined : !on ? () => flow.choose(card.id) : undefined
                  // A card with nothing to choose (no way into the studio).
                  // Any card can be chosen while choosing — the third one
                  // with no value yet too (it's set on the card).
                  const inert = !choose
                  // A rule this way runs into is said by its own note
                  // (below the badge row) — and then there's no badge
                  // claiming the opposite.
                  const required = breaks(card.id)
                  const advisories = required.length ? [] : flow?.advisories?.[card.id] ?? []
                  const badge = required.length || advisories.length ? null : badgeOf(card.id)
                  return (
                  <div key={card.id} className={cn(
                    'min-w-0 overflow-hidden rounded-xl border transition-colors',
                    readOnly ? (on ? 'border-white/40 bg-white/[0.04]' : 'border-white/10 opacity-50')
                      : on ? 'border-emerald-300/40 bg-white/[0.025]'
                        : cn(empty ? 'border-dashed border-white/20' : 'border-white/10', !editing && 'opacity-50'),
                    !inert && 'hover:border-white/35'
                  )} data-applied={readOnly && on ? '' : undefined} onMouseEnter={editing ? () => setHover(card.id) : undefined} onMouseLeave={editing ? () => setHover(null) : undefined}>
                  <div
                    role={readOnly ? undefined : 'radio'}
                    aria-checked={readOnly ? undefined : on}
                    aria-disabled={!editing}
                    tabIndex={inert ? -1 : 0}
                    // (Not a click in the dropdown's list: that's drawn
                    // elsewhere on the page, but still bubbles up to here.)
                    onClick={inert ? undefined : (event) => { if (event.currentTarget.contains(event.target)) choose() }}
                    onKeyDown={(event) => {
                      if (inert || event.target !== event.currentTarget || (event.key !== ' ' && event.key !== 'Enter')) return
                      event.preventDefault()
                      choose()
                    }}
                    data-side={card.side}
                    data-decision={card.id}
                data-choice-tone={card.id}
                    className={cn(
                      // 16px inside, 12px between its parts.
                      'flex h-full min-w-0 flex-col gap-2.5 rounded-xl p-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-300',
                      !inert && 'cursor-pointer'
                    )}>
                    {/* 1 · What choosing it does, where its values are from. */}
                    <div className="flex min-w-0 items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <p className="truncate text-xs leading-5 font-semibold text-white"><LocalizedText text={card.title} /></p>
                      {badge?.text === 'Recommended' && !readOnly && (
                        <span data-card-recommendation className={cn('inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded px-1.5 text-[10.5px] leading-none font-medium', badge.tone)}>
                          {badge.icon && <badge.icon className={cn('size-3 shrink-0', badge.iconTone)} />}
                          <LocalizedText text={badge.text} />
                        </span>
                      )}
                        </div>
                        <p className="truncate text-[10px] text-slate-500" title={card.source}><LocalizedText text={card.source} /></p>
                        {/* The current value is the baseline: the branch its
                            code is on — marked when that's production. */}
                      </div>
                      {/* Finished: which card it was merged with. */}
                      {readOnly && on && (
                        <span data-applied-tag className="shrink-0 rounded bg-white/[0.1] px-1.5 py-0.5 text-[10.5px] leading-none font-medium text-white">
                          <LocalizedText text="Applied" />
                        </span>
                      )}
                      {isCustom && custom && editing && flow.openStudio && !flow.controls && (
                        <button type="button" data-adjust-edit onClick={(event) => { event.stopPropagation(); flow.openStudio() }} className={cn(TEXT_ACTION, '-my-1 h-7')}>
                          <Pencil className="size-3 shrink-0" />
                          <LocalizedText text="Edit" />
                        </button>
                      )}
                      {/* Compact selection indicator, matching the progress checklist. */}
                      {!readOnly && (
                        <span aria-hidden="true" className={cn('mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-[3px]', on ? 'bg-[#5EEAB5] text-[#06281D]' : 'border border-white/25')}>
                          {on && <Check className="size-2.5" strokeWidth={2.5} />}
                        </span>
                      )}
                    </div>
                    {/* 2 · One badge: how it stands with the standard. (Its
                        row is always there, so the cards line up.) */}
                    <div data-card-badge className="flex min-h-5 min-w-0 flex-wrap items-center gap-1.5">
                      {badge && badge.text !== 'Recommended' && !readOnly && (
                        <span className={cn('inline-flex h-5 items-center gap-1 rounded px-1.5 text-[10.5px] leading-none font-medium', badge.tone)}>
                          {badge.icon && <badge.icon className={cn('size-3 shrink-0', badge.iconTone)} />}
                          <LocalizedText text={badge.text} />
                        </span>
                      )}
                    </div>
                    {/* 3 · The picture. (No value of one's own yet: what's
                        there now, faint — the same place on every card.) */}
                    {conflict.preview && (
                      <div className={cn('min-w-0', empty && !picks && 'opacity-40')}>
                        <ChangePreview preview={conflict.preview} side={card.side} showLabels={false} override={isCustom && custom ? custom.preview : undefined} />
                      </div>
                    )}
                    {/* Several values, or one a number can't say (a color,
                        a shadow): set in Merge Studio. Never left empty. */}
                    {/* (In the middle of what's left between the picture and
                        the code line — both ways — at its own width.) */}
                    {isCustom && editing && !flow.controls && empty && (
                      <div className="flex min-w-0 flex-1 items-center justify-center">
                        {flow.openStudio ? (
                          <button type="button" data-adjust-start onClick={(event) => { event.stopPropagation(); flow.openStudio() }} className={cn(NAV_BUTTON, 'justify-center bg-transparent')}>
                            <Plus className={NAV_BUTTON_ICON} />
                            <LocalizedText text="Set it in Merge Studio" />
                          </button>
                        ) : <p data-adjust-start className="text-center text-xs leading-[18px] text-slate-400"><LocalizedText text="Set it on the canvas above: select the element and change its values." /></p>}
                      </div>
                    )}
                    {/* 4 · The value, one line: its name, then it (and the
                        token it comes from, short). On the third card the
                        value is the dropdown that sets it. */}
                    {valuesOf(card, { isCustom, empty, picks })}
                    {/* More than the compared values — another property, another
                        element, the code itself — is set in Merge Studio,
                        whose property panel and code view edit the same
                        adjustment. */}
                    {picks && editing && flow.openStudio && (
                      <button type="button" data-adjust-more onClick={(event) => { event.stopPropagation(); flow.openStudio() }} onKeyDown={(event) => event.stopPropagation()} className="ds-intrinsic inline-flex h-6 w-fit cursor-pointer items-center gap-1 rounded-md px-2 text-[11px] font-medium text-slate-300 ring-1 ring-white/[0.14] transition-colors ring-inset hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300">
                        <Pencil className="size-3 shrink-0" />
                        <LocalizedText text="Edit in Merge Studio" />
                      </button>
                    )}
                  </div>
                  </div>
                  )
                })}
              </div>
              )}
              {choice && !readOnly && (() => {
                const card = cards.find((entry) => entry.id === choice)
                const required = breaks(choice)
                const advisories = required.length ? [] : flow?.advisories?.[choice] ?? []
                return card && (required.length > 0 || advisories.length > 0) ? (
                  <div data-selected-rules className="mt-2 min-w-0">
                    {rulesOf(card, { on: true, isCustom: choice === 'C', required, advisories })}
                  </div>
                ) : null
              })()}
              {/* ③ The code that changes, right under the cards — the value
                  picked, its picture and its code read as one: the diff for
                  the way that's chosen, or the one under the pointer. Open
                  unless it's been folded. */}
              {conflict.diff && !readOnly && (
                <section data-code-section className="mt-4 min-w-0">
                  <div className={SECTION_HEAD}>
                    <h3 className={SECTION_TITLE}><LocalizedText text="Change summary" /></h3>
                    <button type="button" data-code-toggle aria-expanded={showCode} aria-label={showCode ? 'Hide code' : 'Show code'} onClick={toggleCode} className={cn(TEXT_ACTION, 'ml-auto')}>
                      <LocalizedText text={showCode ? 'Hide' : 'Show'} />
                      <ChevronDown className={cn('size-3.5 transition-transform', !showCode && '-rotate-90')} />
                    </button>
                  </div>
                  {conflict.comparisonFields?.length > 0 && <DifferenceSummary compact className="mb-3 bg-transparent !px-0 !py-0" conflict={conflict} />}
                  {showCode && <ChoiceCode conflict={conflict} lines={shown ? linesOf(shown) : null} title={shownCard?.title} preview={Boolean(shown) && shown !== choice} onOpenFile={code?.onOpenFile} />}
                </section>
              )}
              {pairedPreview && !readOnly && editing && flow?.reason && choice && exception && exceptionEditor === `${conflict.id}:${choice}` && (
                <section data-decision-reason={choice} data-exception-editor className="mt-3 min-w-0 space-y-3 rounded-xl border border-amber-300/25 px-4 py-3">
                  <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-amber-100">
                    <TriangleAlert aria-hidden className="size-3.5 shrink-0 text-amber-300" />
                    <span className="min-w-0"><LocalizedText text="Exception request" /> · {breaks(choice).map((check) => check.title).join(', ')}</span>
                  </p>
                  <ReasonField key={`${conflict.id}:${choice}:exception`} {...flow.reason} tone="warning" />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setExceptionEditor(null)} className="text-xs text-slate-400 hover:text-white"><LocalizedText text="Cancel" /></button>
                    <button type="button" disabled={!flow.reason.value.trim() || reviewerNeeded} onClick={flow.submitException} className="ds-intrinsic inline-flex h-7 items-center gap-1.5 rounded-full bg-amber-400/10 px-2.5 text-xs font-medium text-amber-100 hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-40">
                      <Send className="size-3" /><LocalizedText text="Send exception request" />
                    </button>
                  </div>
                </section>
              )}
              {pairedPreview && !readOnly && choice && reviewerNeeded && (
                <section data-next-step="reviewer" className="mt-3 min-w-0 rounded-xl border border-emerald-300/35 bg-emerald-400/[0.045] px-4 py-3">
                  <h3 className="text-xs font-semibold text-emerald-100"><LocalizedText text="Next step · Assign a reviewer" /></h3>
                  <p className="mt-1 text-[11px] leading-4 text-slate-300"><LocalizedText text="Requesting a review needs at least one reviewer other than the author" /></p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {reviewerCandidates.slice(0, 3).map((person) => (
                      <button key={person.id} type="button" data-suggested-reviewer={person.id} onClick={() => onAssignReviewer(person)} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 text-xs text-slate-200 transition-colors hover:bg-white/[0.12] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300">
                        <PersonAvatar person={person} />
                        {person.name}
                      </button>
                    ))}
                    {reviewerCandidates.length > 0 ? (
                      <ReviewerPicker people={reviewerCandidates} onSelect={onAssignReviewer}>
                        <span className="inline-flex h-7 cursor-pointer items-center rounded-full px-2 text-xs text-slate-400 hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300">+ <LocalizedText text="Find someone else" /></span>
                      </ReviewerPicker>
                    ) : <span className="text-xs text-slate-400"><LocalizedText text="No other project members available" /></span>}
                  </div>
                </section>
              )}
              {/* ④ What the chosen way needs said — one thing at a time.
                  Following the standard: nothing. Breaking a required rule:
                  that it needs an exception, what it breaks, and why.
                  Otherwise why. Kept as it's entered; ⑤ settles it. */}
              {/* (One place for every way: under the cards, once the way
                  chosen needs a reason — keeping the code's value, or a
                  value actually set by hand; never before.) */}
              {flow?.reason && editing && !exception && (choice !== 'C' || flow.custom) && (
                // Suggested reasons and the input share the comparison's full width.
                <div data-decision-reason={choice} className="mt-4 w-full min-w-0 space-y-3">
                  <ReasonField key={`${conflict.id}:${choice}`} {...flow.reason} readOnly={!editing} />
                </div>
              )}
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
            {!pairedPreview && !codeConflict && !conflict.comparisonFields?.length && sources && (
              <div className="grid grid-cols-2 gap-3">
                {sources.map((entry) => <ComparisonSource key={entry.label} {...entry} />)}
              </div>
            )}
            {/* Both sides miss a required standard: the cards still choose
                which side merges, but choosing can't fix it. */}
            {!pairedPreview && checkBlocks}
            {/* Finished: the code as it was merged. What it looked like
                before — the conflict itself, markers and all — is there to
                compare with, behind a toggle. */}
            {conflict.diff && readOnly && (
              <div data-merged-code className="min-w-0 space-y-1.5">
                {/* (No title of its own — the step, 병합, names it: what was merged in a line and a short list, then
                    the code folded behind its file's line.) */}
                {codeConflict ? <CodeDifferenceSummary conflict={conflict} /> : conflict.comparisonFields?.length > 0 && <DifferenceSummary compact conflict={conflict} resolved mergedSide={choice ?? 'A'} />}
                <button type="button" data-merged-code-toggle aria-expanded={mergedCodeOpen} onClick={() => setMergedCodeOpen((open) => !open)} className="ds-intrinsic mt-1 flex w-full min-w-0 items-center gap-1.5 rounded-lg py-1 text-left text-[11.5px] text-slate-400 transition-colors hover:text-white">
                  <ChevronDown aria-hidden className={cn('size-3.5 shrink-0 transition-transform', !mergedCodeOpen && '-rotate-90')} />
                  <FileCode2 className="size-3 shrink-0" />
                  <span translate="no" className="min-w-0 truncate font-mono">{conflict.file}</span>
                </button>
                {mergedCodeOpen && <>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="shrink-0"><LocalizedText text={showBefore ? 'Before it was resolved' : 'Merged code'} /></span>
                  <button type="button" data-before-toggle aria-pressed={showBefore} onClick={() => setShowBefore((value) => !value)} className="ds-intrinsic ml-auto inline-flex h-5 shrink-0 items-center gap-1 text-[11px] text-slate-400 transition-colors hover:text-white">
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
                </>}
              </div>
            )}
            {codeConflict && conflict.diff && !readOnly && (
              <section data-code-conflict className="min-w-0 space-y-3">
                {/* (One line on what overlaps; what each way does is said on the one picked.) */}
                <p className="text-xs leading-5 text-slate-300"><LocalizedText text={conflict.codeComparison?.conflict ?? conflict.cause ?? conflict.message} /></p>
                {(() => {
                  const before = conflict.diff.before ?? []
                  const options = codeConflictOptions(conflict)
                  const picked = options.find((option) => option.id === codeChoice) ?? options.at(-1)
                  return <>
                    <div role="radiogroup" aria-label="How to resolve the conflict" className="grid min-w-0 gap-1.5">
                      {options.map((option) => {
                        const on = option.id === picked.id
                        return (
                          <button key={option.id} type="button" role="radio" aria-checked={on} data-code-choice={option.id} onClick={() => setCodeChoice(option.id)} className={cn('ds-intrinsic flex min-w-0 cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-emerald-300', on ? 'border-emerald-300/50 bg-emerald-400/[0.08]' : 'border-white/10 hover:border-white/25 hover:bg-white/[0.04]')}>
                            <span aria-hidden className={cn('mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border', on ? 'border-[#5EEAB5] bg-[#5EEAB5] text-[#06281D]' : 'border-white/25')}>{on && <Check className="size-2.5" strokeWidth={3} />}</span>
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="min-w-0 truncate text-[13px] font-medium text-white"><LocalizedText text={option.title} /></span>
                                {option.note && (option.plain
                                  ? <span className="shrink-0 rounded bg-emerald-400/10 px-1.5 text-[10.5px] leading-4 font-medium text-emerald-200"><LocalizedText text={option.note} /></span>
                                  : <span translate="no" className="ml-auto min-w-0 truncate font-mono text-[10.5px] text-slate-500" title={option.note}>{option.note}</span>)}
                              </span>
                              {on && option.desc && <span className="text-xs leading-5 text-slate-400"><LocalizedText text={option.desc} /></span>}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    <CodeDiffColumns rows={diffLines(before, picked.lines)} codeConflict location={`${conflict.file}:${conflict.line ?? 1}`} />
                  </>
                })()}
              </section>
            )}
            {/* The code follows the card that's picked: its diff when the
                pick changes the code, a line saying it doesn't otherwise. */}
            {conflict.diff && !readOnly && !pairedPreview && !codeConflict && codeChange !== 'diff' && (
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
            {conflict.diff && !readOnly && !pairedPreview && !codeConflict && codeChange === 'diff' && (
              <div className="min-w-0 [&>div]:space-y-1.5">
                {code ? <ConflictCodeView {...code} context={2} /> : <CodeDiffColumns rows={rows} />}
              </div>
            )}
          </div>
        </section>
      )}
      </div>
      {/* The one action, at the card's lower right: 24px over it, no rule. */}
      {page && action && <div data-resolution-action className="mt-5 flex flex-wrap items-center justify-end gap-3">{action}</div>}
    </div>
  )
}

// A compared value as it's shown on a card: the value, then — when it comes
// with a token or a class ("40px (--button-height-md)") — that name kept
// short ("md"), the whole of it on hover. Anything else in brackets is
// part of the value's own wording and stays with it.
const shortName = (name) => (name.startsWith('--') ? name.split('-').at(-1) : name.includes('.') ? name.split('.').at(-1) : name)
function valueParts(text) {
  const match = /^(.*?)\s*\(([^()]+)\)$/.exec(String(text ?? ''))
  if (!match || !/^(--[\w-]+|\w+(\.\w+)+|[a-z]\w*-[\w[\].-]+)$/i.test(match[2])) return { value: text, note: null }
  return { value: match[1], note: match[2], short: shortName(match[2]) }
}
function ValueText({ text }) {
  const { value, note, short } = valueParts(text)
  return <>
    <span className="min-w-0"><LocalizedText text={value} /></span>
    {note && <span translate="no" title={note} className="shrink-0 font-mono text-[11px] font-normal text-slate-500">{short}</span>}
  </>
}

// A number of the element's own, set where the card shows it: typed, or
// stepped with − / + (↑ / ↓ too).
// Every valid change is put on the element at once — the picture and the
// code follow as it's set. `control`: lib/mergeResult's valueControlsFor,
// with the value so far and `set(px)`.
// Every editor on the third card is the same box — one width, one height,
// one border — whatever it edits (a number, a color, a value picked).
// (Sized to its card: a narrow card's box drops the −/+ — typing and
// ↑/↓ still step it — so the label beside it keeps its room.)
const VALUE_BOX = 'group/value flex h-7 w-[60px] @[180px]:w-[92px] shrink-0 items-center rounded-md border border-transparent transition-colors hover:border-white/[0.14] hover:bg-white/[0.03] focus-within:border-emerald-300/60 focus-within:bg-white/[0.03]'
function ValueStepper({ control }) {
  const value = control.value ?? control.current
  const step = control.step ?? 1
  const unit = control.unit ?? 'px'
  const [text, setText] = useState(String(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => { if (!focused) setText(String(value)) }, [value, focused])
  const number = text.trim() === '' ? null : Number(text)
  const invalid = number == null || !Number.isFinite(number) || number < control.min || number > control.max
  // (Kept to the step — whole pixels, or a quarter for a stroke.)
  const snap = (next) => Math.round(Math.round(next / step) * step * 100) / 100
  const apply = (next) => {
    const px = Math.min(control.max, Math.max(control.min, snap(next)))
    setText(String(px))
    if (px !== control.value) control.set(px)
  }
  const stop = (event) => event.stopPropagation()
  const button = 'ds-intrinsic hidden @[180px]:flex size-5 shrink-0 cursor-pointer opacity-0 group-hover/value:opacity-100 group-focus-within/value:opacity-100 items-center justify-center rounded text-slate-400 transition-colors hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-30'
  return (
    <span data-value-stepper={control.property} onClick={stop} onKeyDown={stop} className="flex cursor-default">
      <span title={invalid ? translateText(`Enter a value from ${control.min} to ${control.max}${unit}`, getLanguage()) : undefined} className={cn(VALUE_BOX, 'pr-1.5 pl-0.5', invalid && 'border-red-400/60')}>
        <button type="button" aria-label={`${control.label} −${step}`} disabled={value <= control.min} onClick={() => apply(value - step)} className={button}><Minus className="size-2.5" /></button>
        <button type="button" aria-label={`${control.label} +${step}`} disabled={value >= control.max} onClick={() => apply(value + step)} className={button}><Plus className="size-2.5" /></button>
        <input
          data-value-select
          inputMode={step < 1 ? 'decimal' : 'numeric'}
          aria-label={control.label}
          aria-invalid={invalid}
          value={text}
          onFocus={(event) => { setFocused(true); event.target.select() }}
          onBlur={() => { setFocused(false); setText(String(value)) }}
          onChange={(event) => {
            const next = event.target.value.replace(step < 1 ? /[^\d.]/g : /[^\d]/g, '')
            setText(next)
            const typed = next === '' || next.endsWith('.') ? NaN : Number(next)
            if (typed >= control.min && typed <= control.max && typed !== control.value) control.set(typed)
          }}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              event.preventDefault()
              apply(value + (event.key === 'ArrowUp' ? 1 : -1) * step * (event.shiftKey ? 4 : 1))
            }
          }}
          className="h-full min-w-0 flex-1 cursor-text bg-transparent text-right text-[13px] font-semibold text-white tabular-nums underline decoration-white/25 decoration-dotted underline-offset-4 outline-none focus:no-underline"
        />
        {unit && <span className="shrink-0 text-[13px] font-semibold text-white">{unit}</span>}
      </span>
    </span>
  )
}

// A value picked from what's on offer — each side's, and the kind's usual
// ones (letter spacings) — or typed. Typing is applied on Enter or leaving
// the field; Escape takes it back. `swatches`: a color value, with its
// swatch and a color picker beside the text.
const hexIn = (text) => /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})\b/i.exec(text ?? '')?.[0] ?? null
function ValueChoice({ control, swatches = false }) {
  const value = String(control.value ?? control.current ?? '')
  const [text, setText] = useState(value)
  const [focused, setFocused] = useState(false)
  const listId = useId()
  useEffect(() => { if (!focused) setText(value) }, [value, focused])
  const commit = (next = text) => { if (next.trim() && next.trim() !== value) control.set(next.trim()) }
  const stop = (event) => event.stopPropagation()
  const swatch = swatches ? hexIn(text) ?? hexIn(value) : null
  // (A picker needs a full #rrggbb to start from.)
  const pickerValue = /^#[0-9a-f]{6}$/i.test(swatch ?? '') ? swatch : /^#[0-9a-f]{3}$/i.test(swatch ?? '') ? `#${swatch.slice(1).split('').map((c) => c + c).join('')}` : '#000000'
  const options = control.options?.length > 1 ? control.options : null
  return (
    <span data-value-choice={control.kind ?? control.type} onClick={stop} onKeyDown={stop} className="flex cursor-default">
      <span title={value} className={cn(VALUE_BOX, 'gap-1 pr-1.5 pl-1')}>
        {swatches && (
          <label className="relative size-3.5 shrink-0 cursor-pointer overflow-hidden rounded-full ring-1 ring-white/30" style={{ background: swatch ?? 'transparent' }} title="Pick a color">
            <input type="color" aria-label={`${control.label} color`} value={pickerValue} onChange={(event) => { setText(event.target.value); control.set(event.target.value) }} className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
        )}
        <input
          data-value-select
          aria-label={control.label}
          list={options ? listId : undefined}
          value={text}
          spellCheck={false}
          translate="no"
          onFocus={(event) => { setFocused(true); event.target.select() }}
          onBlur={() => { setFocused(false); commit() }}
          onChange={(event) => {
            setText(event.target.value)
            // (Picked from the suggestions: applied at once.)
            if (options?.includes(event.target.value)) commit(event.target.value)
          }}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === 'Enter') { event.preventDefault(); commit(); event.currentTarget.blur() }
            else if (event.key === 'Escape') { setText(value); event.currentTarget.blur() }
          }}
          className="h-full min-w-0 flex-1 cursor-text bg-transparent text-right text-[13px] font-semibold text-white underline decoration-white/25 decoration-dotted underline-offset-4 outline-none focus:no-underline"
        />
        {options && <datalist id={listId}>{options.map((option) => <option key={option} value={option}>{option === control.standard ? translateText('Standard', getLanguage()) : undefined}</option>)}</datalist>}
      </span>
    </span>
  )
}

// The third card's editor for one compared value, by its kind: a number
// stepped or typed, a color, or a value picked or typed.
const firstNumber = (text) => Number(/-?\d+(?:\.\d+)?/.exec(String(text ?? '').split('(')[0])?.[0] ?? NaN)
function ValueEditor({ control }) {
  if (control.mode === 'layer') return <ValueStepper control={control} />
  if (control.type === 'number') {
    // Written as a side writes it when it's that side's number.
    const wording = (n) => (firstNumber(control.standard) === n ? control.standard : firstNumber(control.current) === n ? control.current : `${n}${control.unit ?? ''}`)
    const number = firstNumber(control.value)
    const start = Number.isFinite(number) ? number : firstNumber(control.current)
    return <ValueStepper control={{ ...control, value: start, current: start, set: (n) => control.set(wording(n)) }} />
  }
  return <ValueChoice control={control} swatches={control.type === 'color'} />
}

// The code for one way of resolving it, in full — the one block under the
// cards. Nothing changes: the line as it is, marked so. Something does: the
// line removed and the line added, the part that differs lit. `preview`:
// it's a card being hovered, not the chosen one.
function ChoiceCode({ conflict, lines, title, preview = false, onOpenFile }) {
  const before = conflict.diff.before ?? []
  const rows = diffLines(before, lines ?? before)
  const changed = rows.some((row) => row.kind !== 'same')
  return (
    <div data-choice-code={preview ? 'preview' : title ? 'chosen' : 'none'} className="min-w-0 space-y-2">
      <p className="flex min-w-0 items-center gap-1.5 text-[10px] font-medium text-slate-400">
        <FileCode2 className="size-3 shrink-0" />
        <span translate="no" className="min-w-0 truncate font-mono text-slate-300">{conflict.file}{conflict.line ? `:${conflict.line}` : ''}</span>
        {title && <span data-choice-code-title className="shrink-0"><span className="text-slate-500">· </span><LocalizedText text={title} /> <LocalizedText text={preview ? 'Preview' : 'Selected'} /></span>}
        {!changed && <span data-code-unchanged className="shrink-0 text-slate-500">· <LocalizedText text={title ? 'No change' : 'With nothing chosen, the code doesn’t change.'} /></span>}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {changed && <DiffLayoutTabs />}
          {onOpenFile && (
            <button type="button" onClick={onOpenFile} className="ds-intrinsic inline-flex h-5 shrink-0 items-center text-[10.5px] text-slate-400 transition-colors hover:text-white">
              <LocalizedText text="Open in editor" />
            </button>
          )}
        </span>
      </p>
      {/* (Re-keyed per way, so switching fades in.) */}
      <div key={`${title ?? ''}:${preview}`} className="min-w-0 animate-in overflow-auto rounded-md bg-black/20 py-2 duration-150 fade-in">
        <DiffView rows={rows} startLine={conflict.line ?? 1} layout={changed ? undefined : 'unified'} labels={['Current code', title ?? 'Chosen']} />
      </div>
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
const REQUEST_REVIEW_BUTTON = 'inline-flex h-8 shrink-0 items-center rounded-full px-4 text-xs font-medium whitespace-nowrap ds-review-cta disabled:cursor-not-allowed disabled:opacity-100'

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
// `quiet`: an approval is said in the text color, not in green (a page whose
// one green is its status block).
function ReviewersSection({ conflict, onUpdate, onDismiss, sectioned = false, expanded = false, onReviewerAssigned, quiet = false }) {
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
  const projectMemberIds = projects.find((project) => project.id === conflict.projectId)?.memberIds ?? allPeople.map((person) => person.id)
  const assignable = projectMemberIds.map((id) => allPeople.find((person) => person.id === id)).filter((person) =>
    person && !reviewers.some((reviewer) => reviewer.id === person.id) && person.id !== author)
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
    onReviewerAssigned?.()
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
  // `sectioned` (the sidebar's Info tab): its own header and a text action.
  const addMenu = reviewStage !== 'resolved' && (assignable.length === 0 ? sectioned && (
    <span data-add-reviewer aria-disabled="true" className="ml-auto text-xs text-slate-500"><LocalizedText text="No other project members available" /></span>
  ) : (
    <DropdownMenu>
      <DropdownMenuTrigger data-add-reviewer aria-label="Add reviewer" className={sectioned ? cn(REVIEWER_TEXT_ACTION, 'ml-auto') : REVIEWER_TEXT_ACTION}>
        {!sectioned && <Plus className="size-3.5" />}
        <LocalizedText text="Add reviewer" />
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
      {sectioned && (
        <div data-review-header className="mb-2 flex w-full items-center gap-1.5 py-0.5">
          <span className="text-[11px] leading-4 text-slate-400"><LocalizedText text="Reviewers" /></span>
          {addMenu}
        </div>
      )}
      {!sectioned || expanded ? (
        <>
          {reviewers.length === 0 ? (
            <p className="py-1.5 text-xs leading-[18px] text-slate-400"><LocalizedText text="No reviewer has been assigned" /></p>
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
                <span className={cn('order-last shrink-0 truncate text-right text-xs font-medium', reviewer.id === author ? 'text-slate-200' : quiet && reviewer.status === 'approved' ? 'text-slate-100' : status.className)}>
                  {reviewer.id === author
                    ? 'Author'
                    : reviewer.status === 'pending' && reviewer.dismissedAt
                    ? 'Request dismissed'
                    : reviewer.status !== 'approved' && reviewer.remindedAt ? `Reminded ${reviewer.remindedAt}`
                      // Nobody's been asked yet: not "waiting" — that starts
                      // once the review is requested.
                      : reviewer.status === 'pending' && reviewStage === 'detected' && !conflict.rollback ? 'Not requested yet'
                        : <><LocalizedText text={statusLabels[reviewer.status] ?? status.label} />{reviewer.reviewedAt && reviewer.status !== 'pending' && <span className="font-normal text-slate-400"> · <RecentTime at={reviewer.reviewedAt} /></span>}</>}
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
              {/* What they said with it, in a line. */}
              {reviewer.note && reviewer.status !== 'pending' && (
                <p data-review-note className="-mt-1 mb-1.5 truncate pl-[34px] text-xs leading-[18px] text-slate-400" title={reviewer.note}>“<LocalizedText text={reviewer.note} />”</p>
              )}
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
        </>
      ) : null}
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
        {/* (Nothing yet: said in the middle of the room the thread will take, the composer under it.) */}
        {comments.length === 0 && (
          <div data-comments-empty className="flex h-full min-h-[160px] flex-col items-center justify-center gap-1 text-center">
            <p className="text-[13px] font-medium text-slate-300"><LocalizedText text="No comments yet" /></p>
            <p className="text-[11.5px] text-slate-500"><LocalizedText text="Leave a note on this change for the team." /></p>
          </div>
        )}
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

// Where the approvals stand, worked out once: which of the states it's in,
// who it's waiting on, and the line that says so — the same line beside
// the header's approval area and after the steps under the title.
function approvalStateOf(conflict, canReview) {
  const viewerId = currentUserFor(conflict.projectId).id
  const stage = conflict.reviewStage
  const required = requiredReviewers(conflict)
  const nameOf = (id) => allPeople.find((person) => person.id === id)?.name ?? id
  const asked = required.filter((reviewer) => reviewer.status === 'changes_requested')
  const waiting = required.filter((reviewer) => reviewer.status === 'pending' && reviewer.id !== viewerId)
  const approved = required.filter((reviewer) => reviewer.status === 'approved')
  const mine = required.some((reviewer) => reviewer.id === viewerId && reviewer.status === 'pending') && canReview
  const mode = stage === 'resolved' ? 'merged' : stage === 'approved' ? 'approved' : stage === 'detected' ? 'idle' : asked.length ? 'changes' : mine ? 'mine' : 'waiting'
  const when = conflict.resolvedAtLabel ?? conflict.timestamp ?? null
  const line = mode === 'idle' ? <LocalizedText text={required.length ? 'Review request not sent' : 'Assign a reviewer other than the author to request review.'} />
    : mode === 'waiting' ? (waiting.length
      ? <>{waiting.map((reviewer) => nameOf(reviewer.id)).join(', ')} <LocalizedText text="review pending" /> · <LocalizedText text={`${waiting.length} left`} /></>
      : <LocalizedText text="In review" />)
      : mode === 'mine' ? <LocalizedText text="It needs your approval" />
        : mode === 'changes' ? <>{asked.map((reviewer) => nameOf(reviewer.id)).join(', ')} · <LocalizedText text="Changes requested" /></>
          : mode === 'approved' ? <><LocalizedText text="Approvals" /> <span className="tabular-nums">{approved.length}/{required.length}</span> <LocalizedText text="complete" /></>
            : approved.length
              ? <><LocalizedText text={`${approved.map((reviewer) => nameOf(reviewer.id)).join(', ')} approved`} />{when && <> · <LocalizedText text={when} /></>}</>
              : <><LocalizedText text="Merged" />{when && <> · <LocalizedText text={when} /></>}</>
  return { mode, line, waiting, asked, required, nameOf, viewerId }
}

// Approval, at the header's right, on the title's line: who has to sign
// off (their avatars, each marked with where they stand — hover for the
// name, role, status and when), the line that says where it stands, and
// the one action that state calls for:
//   · not requested — send the review request: the review's one filled
//                     button, which settles the choice and asks for review
//                     in one go, named after the way that's chosen;
//   · waiting       — remind whoever hasn't answered;
//   · yours         — request changes, or approve (each asks for a comment
//                     in a popover under its button; a change request
//                     needs one);
//   · changes asked — fix it and request again;
//   · all approved  — merge;
//   · merged        — revert.
// Approving and merging happen here and nowhere else. The avatars open the
// reviewers themselves: adding or removing one, reminding, dismissing a
// change request.
function ApprovalBar({ conflict, state, canReview, blockingCount = 0, onUpdate, request, revise, onReview, onMerge, onRevert, requireApproveNote = false }) {
  const { mode, waiting, nameOf, viewerId } = state
  const author = authorOf(conflict)
  // The sign-off being given: which way, and what's said with it.
  const [deciding, setDeciding] = useState(null)
  const [note, setNote] = useState('')
  const needsNote = deciding === 'changes'
  // (`requireApproveNote`: an approval says why too.)
  const noteRequired = needsNote || (requireApproveNote && deciding === 'approve')
  function submit(event) {
    event.preventDefault()
    if (!deciding || (noteRequired && !note.trim())) return
    onReview(deciding, note.trim())
    setDeciding(null)
    setNote('')
  }
  function remind() {
    const ids = waiting.map((reviewer) => reviewer.id)
    const stamp = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    onUpdate({ reviewers: conflict.reviewers.map((reviewer) => (ids.includes(reviewer.id) ? { ...reviewer, remindedAt: stamp, reminderRequestedAt: Date.now() } : reviewer)) })
    toast(`Reminder sent to ${ids.map(nameOf).join(', ')}`, { description: conflict.title })
  }
  const CTA = cn(PRIMARY_BUTTON, 'gap-1.5')
  const QUIET = cn(NAV_BUTTON, 'h-8')
  // The sign-off's form, in a popover hung from the button that opens it:
  // 8px under the button, right edges aligned. It flips above only when
  // there's no room below, shifts to stay on screen, and scrolls inside
  // itself rather than run past the window. Open, its button reads as
  // pressed; a click outside or Escape closes it.
  const reviewPopover = (kind, trigger) => (
    <Popover open={deciding === kind} onOpenChange={(open) => setDeciding(open ? kind : null)}>
      {trigger}
      <PopoverContent data-review-popover={kind} side="bottom" align="end" sideOffset={8} className="max-h-(--available-height) w-[340px] max-w-(--available-width) gap-0 overflow-y-auto rounded-xl p-0">
        <form onSubmit={submit}>
          <div className="space-y-2.5 px-4 pt-4 pb-3">
            <p className="text-sm font-semibold text-white"><LocalizedText text={needsNote ? 'Request changes' : 'Approve it'} /></p>
            <p className="text-xs leading-[18px] text-slate-400">
              <LocalizedText text={needsNote ? 'It goes back to the author and the merge stops' : 'It merges once everyone approves'} />
              {author && author !== viewerId && <> · <LocalizedText text={`${nameOf(author)} (author) will be notified.`} /></>}
            </p>
            <textarea
              autoFocus
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit(event) }}
              aria-label={tr(needsNote ? 'What needs to change? (required)' : noteRequired ? 'Why approve it? (required)' : 'Leave a comment (optional)')}
              placeholder={tr(needsNote ? 'What needs to change? (required)' : noteRequired ? 'Why approve it? (required)' : 'Leave a comment (optional)')}
              className="block w-full resize-none rounded-xl border border-white/15 bg-white/[0.02] px-3 py-2 text-xs leading-[18px] text-white outline-none transition-colors placeholder:text-slate-500 hover:border-white/25 focus:border-emerald-300/60"
            />
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-white/[0.07] px-4 py-3">
            <button type="button" onClick={() => setDeciding(null)} className="ds-intrinsic inline-flex h-8 items-center rounded-full px-3 text-xs font-medium text-slate-300 hover:bg-white/[0.07] hover:text-white"><LocalizedText text="Cancel" /></button>
            <button type="submit" disabled={noteRequired && !note.trim()} className={cn('ds-intrinsic inline-flex h-8 items-center rounded-full px-3.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-slate-500', needsNote ? 'bg-amber-400 text-slate-950 hover:bg-amber-300' : 'bg-emerald-400 text-emerald-950 hover:bg-emerald-300')}>
              <LocalizedText text={needsNote ? 'Request changes' : 'Submit approval'} />
            </button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
  return (
    <div data-approval-bar={mode} className="flex min-w-0 shrink-0 items-center gap-2.5">
      <div data-approval-actions className="flex shrink-0 items-center gap-2">
        {mode === 'idle' && request && (
          <>
            {request.assignReviewer && request.assignable.length > 0 ? (
              <ReviewerPicker
                people={request.assignable}
                onSelect={request.onAssign}
                align="end"
                triggerProps={{ ref: request.buttonRef, 'data-approval-request': '', 'data-choice-label': request.label, className: cn(PRIMARY_BUTTON, 'gap-1.5') }}
              >
                <><Plus className="size-3.5" /><LocalizedText text={request.label} /></>
              </ReviewerPicker>
            ) : (
              <button
                ref={request.buttonRef}
                type="button"
                data-approval-request
                data-choice-label={request.label ?? 'Send review request'}
                disabled={request.disabled}
                onClick={request.run}
                className={request.assignReviewer ? cn(PRIMARY_BUTTON, 'gap-1.5') : REQUEST_REVIEW_BUTTON}
              >
                <LocalizedText text={request.label ?? 'Send review request'} />
              </button>
            )}
            {request.helper && <span data-approval-helper className="max-w-40 text-[11px] leading-4 text-slate-400"><LocalizedText text={request.helper} /></span>}
          </>
        )}
        {mode === 'waiting' && waiting.length > 0 && onUpdate && (
          <button type="button" data-approval-remind onClick={remind} className={QUIET}><Bell className="size-3.5 text-slate-400" /><LocalizedText text="Remind again" /></button>
        )}
        {(mode === 'mine' || (mode === 'changes' && canReview)) && <>
          {mode === 'mine' && reviewPopover('changes', (
            <PopoverTrigger data-approval-changes aria-pressed={deciding === 'changes'} className={cn(QUIET, 'aria-pressed:border-white/30 aria-pressed:bg-white/[0.12] aria-pressed:text-white')}><LocalizedText text="Request changes" /></PopoverTrigger>
          ))}
          {reviewPopover('approve', (
            <PopoverTrigger data-approval-approve aria-pressed={deciding === 'approve'} className={cn(CTA, 'aria-pressed:brightness-90 aria-pressed:ring-2 aria-pressed:ring-emerald-200/60')}><Check className="size-3.5" /><LocalizedText text="Approve it" /></PopoverTrigger>
          ))}
        </>}
        {mode === 'changes' && revise && (
          <button type="button" data-approval-revise onClick={revise.run} className={REQUEST_REVIEW_BUTTON}><LocalizedText text="Fix and request again" /></button>
        )}
        {mode === 'approved' && onMerge && (
          <button type="button" data-approval-merge onClick={onMerge} disabled={blockingCount > 0} title={blockingCount > 0 ? tr('Resolve the failing checks before merging.') : undefined} className={CTA}><GitMerge className="size-3.5" /><LocalizedText text={TASK_LABEL.merge} /></button>
        )}
        {mode === 'merged' && onRevert && (
          <button type="button" data-approval-revert onClick={onRevert} className={TEXT_ACTION}><RotateCcw className="size-3.5 text-slate-400" /><LocalizedText text="Cancel merge" /></button>
        )}
      </div>
    </div>
  )
}

const STATUS_NOTE = 'inline-flex h-8 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-xs text-slate-200'
// Waiting on someone else is the state people look for first, so it's a
// step up from the plain note: larger type and the in-review sky tint.
const WAITING_NOTE = 'inline-flex h-9 items-center gap-2 rounded-full bg-sky-400/[0.12] px-4 text-[13px] font-medium whitespace-nowrap text-sky-100 ring-1 ring-sky-400/35 ring-inset'

// A value change once approved: what the fix is doing and the one button —
// 병합하고 해결하기, pressable once the fix has been checked — in one block at
// the top, as a design decision's status block has them (DesignDecisionFlow).
function FixStatusBlock({ phase, text, blocked, onMerge }) {
  const passed = phase === 'verified'
  return (
    <section data-status-block={phase} data-fix-phase={phase} className={cn('shrink-0 scroll-mt-3 rounded-lg px-3 py-2.5 ring-1 ring-inset', passed ? 'bg-emerald-400/[0.07] ring-emerald-400/30' : 'bg-white/[0.04] ring-white/[0.08]')}>
      <div className="flex flex-wrap items-center gap-3">
        <p data-status-text role="status" aria-live="polite" className="flex min-w-0 flex-1 items-center gap-2 text-[13px] leading-5 font-medium text-white">
          {passed ? <ShieldCheck className="size-3.5 shrink-0 text-emerald-300" /> : <LoaderCircle className="size-3.5 shrink-0 animate-spin text-sky-300 motion-reduce:animate-none" />}
          <span className="min-w-0">{text}</span>
        </p>
        {onMerge && (
          <button type="button" data-decision-primary data-approval-merge disabled={!passed || blocked} title={blocked ? tr('Resolve the failing checks before merging.') : undefined} onClick={onMerge} className={cn(DECISION_PRIMARY, 'min-w-[148px] justify-center')}>
            <GitMerge className="size-3.5" />
            병합하고 해결하기
          </button>
        )}
      </div>
    </section>
  )
}

// The page's record of a change, under what there is to act on: the same thin
// timeline a design decision keeps (StepTimeline) — a line a step with who,
// what and when, the one under way outlined, those to come as empty rings;
// a step that has something to show opens in place (lib/reviewRecord). It
// takes the place of the side panel's progress card there.
// `choice` / `choiceLabel` / `reason`: the way picked on the page, and why.
const ROW_TONE = { accent: 'font-medium text-sky-200', done: 'font-medium text-emerald-200', warn: 'font-medium text-amber-200' }
// `given`: the steps to draw, when they aren't a value change's (a merge request's own).
// `current`: what's done in the step under way — the ways forward — drawn in that step (the last one, once
// every step is done); that step is open to start with, the others folded.
function ReviewRecord({ conflict, choice, choiceLabel, reason, given = null, current = null }) {
  const steps = given ?? reviewRecordOf(conflict, { t: tr, nameOf: personNameOf, roleOf: (id) => { const person = allPeople.find((entry) => entry.id === id); return person?.jobRole ?? (person?.role === 'You' ? 'Designer' : person?.role) ?? null }, choice, choiceLabel, reason })
  const states = steps.map((step) => step.state)
  const { reveal, ref } = useStepReveal(conflict.id, states)
  const [hovered, setHovered] = useState(null)
  const folds = useFoldState(`record:${conflict.id}:${states.join(',')}`)
  if (!steps.length) return null
  const host = (steps.find((step) => step.state === 'current') ?? steps.at(-1))?.key
  const foldable = steps.filter((step) => hasBody(step) || (current && step.key === host)).map((step) => step.key)
  // (The step under way is open to start with — the others folded — and one step is open at a time.)
  const isOpen = (key) => folds.get(key, key === host && (Boolean(current) || steps.find((step) => step.key === host)?.state !== 'done'))
  const toggle = accordionToggle(folds, foldable, isOpen, host)
  const allOpen = foldable.length > 0 && foldable.every(isOpen)
  return (
    // (40px under what's above it; 24px to the first step; 48px from step to step.)
    <section data-step-record aria-label="진행 기록" className="mt-1 shrink-0 pb-2">
      <div data-step-list-head className="mb-3 flex items-center gap-2">
        <h3 className="text-[12px] font-semibold tracking-wide text-slate-400"><LocalizedText text="Progress record" /></h3>
        <StepProgressCount states={states} ticks={reveal.live} />
        {foldable.length > 0 && (
          <button type="button" data-fold-all onClick={() => folds.setMany(foldable, !allOpen)} className="ml-auto cursor-pointer text-xs font-medium text-slate-400 underline-offset-2 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-emerald-300">
            {allOpen ? '모두 접기' : '모두 펼치기'}
          </button>
        )}
      </div>
      <ol ref={ref} data-step-list className="m-0 flex list-none flex-col gap-2 p-0">
        {steps.map((step, index) => (
          <StepRow
            key={step.key}
            data-fold={step.key}
            state={step.state}
            title={step.title}
            who={step.who}
            summary={step.summary}
            time={step.time}
            open={isOpen(step.key)}
            onToggle={() => toggle(step.key)}
            last={index === steps.length - 1}
            moves={stepMoves(reveal, index)}
            anim={stepMoves(reveal, index) ? reveal.phase : undefined}
            delay={delayOf(reveal, index)}
            arrive={reveal.live && step.state === 'current' && index === reveal.to}
            strong={hovered != null && index < hovered}
            onHover={(on) => setHovered(on ? index : null)}
          >
            {(hasBody(step) || (current && step.key === host)) && (
              <>
                {current && step.key === host && <div data-record-current className="min-w-0">{current}</div>}
                {/* What was found, drawn: what's built beside the reference (24px apart, 12px to their labels). */}
                {step.preview && (
                  <div data-record-preview className="grid max-w-[560px] grid-cols-2 gap-6">
                    {[['before', '현재 구현', 'text-rose-300'], ['after', '기준', 'text-emerald-300']].map(([side, label, tone]) => (
                      <figure key={side} className="min-w-0">
                        <ChangePreview preview={conflict.preview} side={side} showLabels={false} />
                        <figcaption className={cn('mt-3 text-center text-xs font-semibold', tone)}>{label}</figcaption>
                      </figure>
                    ))}
                  </div>
                )}
                {step.rows.length > 0 && (
                  // (32px under the pictures: 24px between blocks, and 8 more.)
                  <dl data-record-rows className={cn(RECORD_ROWS, step.preview && 'mt-2')}>
                    {step.rows.map((row) => (
                      <Fragment key={row.label}>
                        <dt className="text-slate-400">{row.label}</dt>
                        {/* (A path is one line, cut short, its line number after it as ":8" — the whole of it on hover.) */}
                        {row.mono
                          ? (() => { const value = String(row.value).replace(/ · (\d+)행$/, ':$1'); return <dd translate="no" title={value} className="min-w-0 truncate font-mono text-slate-200">{value}</dd> })()
                          : <dd className={cn('min-w-0 break-words', ROW_TONE[row.tone] ?? 'text-slate-100')}>{row.value}</dd>}
                      </Fragment>
                    ))}
                  </dl>
                )}
                {step.code && (
                  <div data-record-code>
                    <p className="text-[12px] text-slate-300">바뀌는 코드<span translate="no" className="ml-2 font-mono text-[11px] text-slate-400">{step.code.file?.split('/').pop()}{step.code.line ? ` · ${step.code.line}행` : ''}</span></p>
                    {/* (16px inside, 8px under its label — as a design decision's fix shows its code.) */}
                    <div translate="no" className="mt-2 overflow-x-auto rounded-lg bg-black/25 py-4 font-mono text-[11px] leading-[1.7]">
                      {step.code.before.map((line, at) => <p key={`b${at}`} className="flex bg-red-500/[0.14] px-4 whitespace-pre text-red-200"><span className="mr-2 w-3 shrink-0 select-none">−</span>{line.trim()}</p>)}
                      {step.code.after.map((line, at) => <p key={`a${at}`} className="flex bg-emerald-500/[0.14] px-4 whitespace-pre text-emerald-100"><span className="mr-2 w-3 shrink-0 select-none">+</span>{line.trim()}</p>)}
                    </div>
                  </div>
                )}
                {step.note && <p data-record-note className="text-[12px] leading-[18px] text-slate-300">{step.note}</p>}
              </>
            )}
          </StepRow>
        ))}
      </ol>
    </section>
  )
}

// `page`: the full-screen detail, under the page's path (ConflictReviewOverlay).
// Everything then sits in the path's own column — the title, the body and the
// side panel start and end on its lines — and there's no back arrow (the
// path's row has Close).
// `onBack` / `headerAside` (the page): a way back before the title, and controls at the title line's end — the
// docked detail's, so it needs no row of its own above the title.
function ConflictModal({ conflict, onOpenChange, onUpdate, onApprove, onRequestChanges, onResolve, onRevert, onOpenMergeStudio, inMergeStudio = false, page = false, onBack = null, headerAside = null }) {
  const workspace = useWorkspaceOptional()
  const navigate = useNavigate()

  const severity = conflict?.severity ? (severityConfig[conflict.severity] ?? severityConfig.medium) : null

  // The review itself ('overview') or the History behind it, reset to the
  // review whenever a different conflict loads.
  // The main area is the comparison — or, while one is being watched, a
  // step's replay (opened from the sidebar's Activity tab).
  const [replayId, setReplayId] = useState(null)
  const [replayAutoplay, setReplayAutoplay] = useState(null)
  const activity = useConflictActivity(conflict, workspace)
  // Evidence links and the one question a departure asks.
  const [ruleFocus, setRuleFocus] = useState(null)
  const [flashComment, setFlashComment] = useState(null)
  // The sidebar's tab, and how many comments there were when Comments was
  // last looked at (more than that since puts a dot on the tab).
  // (On the page the tabs are at its top, the change itself — 'details' — first and open.)
  const [sideTab, setSideTab] = useState(page ? 'details' : 'info')
  // A design decision's page: its header says what differs in a line and keeps the meta to plain words.
  const decisionPage = Boolean(page && conflict?.decisionFlow)
  // (Scrolled: a hairline under the tabs, so what passes under them reads as going under — not cut off.)
  const [scrolled, setScrolled] = useState(false)
  // A design decision's History: its events, in order (lib/conflictEvents)
  // — and the step the progress card asked to see. `?historySeed` shows the
  // sample history for CON-002 in their place (`=rejected`: the decision
  // turned down), for looking at the screen only.
  const [historyFocus, setHistoryFocus] = useState(null)
  const historyPreview = conflict?.id === 'CON-002' ? new URLSearchParams(window.location.search).get('historySeed') : null
  const historyEvents = useMemo(
    () => (!conflict?.decisionFlow ? [] : historyPreview != null ? sampleHistoryForCon002({ rejected: historyPreview === 'rejected' }) : eventsOf(conflict)),
    [conflict, historyPreview]
  )
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
  const [confirmRevert, setConfirmRevert] = useState(false)
  const [exceptionReasonDraft, setExceptionReasonDraft] = useState('')
  const requestActionRef = useRef(null)
  const [tabConflictId, setTabConflictId] = useState(conflict?.id)
  if (conflict && conflict.id !== tabConflictId) {
    setTabConflictId(conflict.id)
    setReplayId(null)
    if (page) setSideTab('details')
  }

  // Esc while the replay is open closes the replay, back to the review — not
  // the page (that's the next Esc). A full-screen preview, a dialog or a menu
  // open over it closes first, by its own.
  useEffect(() => {
    if (!replayId) return undefined
    function onKey(event) {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (document.querySelector('[data-preview-fullscreen-layer], [data-slot="dialog-content"], [role="menu"], [role="listbox"]')) return
      event.preventDefault()
      event.stopPropagation()
      setReplayId(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [replayId])
  // The activity follows the replay: the step in view is scrolled to.
  useEffect(() => {
    if (!replayId || !conflict?.decisionFlow) return
    const entries = activity.entries
    const entry = entries.find((item) => item.id === replayId)
    if (!entry) return
    const at = entries.findIndex((item) => item.kind === 'conflict')
    const step = entry.kind === 'merge' ? 5 : entry.kind === 'decision' ? (entries.filter((item) => item.kind === 'decision').indexOf(entry) === 0 ? 2 : 3) : at >= 0 && entries.indexOf(entry) > at ? 4 : 1
    setHistoryFocus({ step, nonce: Date.now() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayId])

  function update(patch) {
    onUpdate?.(conflict.id, patch)
  }

  // The replay — one thing, opened at a step: from the record's ▶ (the first
  // step, playing), a step's own row, an activity item, or the merged
  // banner (the last step). It takes the main area; the side panel turns to
  // the activity, on the step in view.
  function openReplay(id, { autoplay = false } = {}) {
    if (!id) return
    setReplayId(id)
    setReplayAutoplay(autoplay ? id : null)
    // (The replay is the change's own view: on the page it plays in Details.)
    setSideTab(page ? 'details' : conflict.decisionFlow ? 'history' : 'activity')
    if (!conflict.historyInspected) update({ historyInspected: true })
  }
  // Which of the change's saved steps a part of its record is: its
  // detection, the request, the decision, the fix, the merge.
  function replayEntryFor(key) {
    const entries = activity.entries
    if (!entries.length) return null
    const at = entries.findIndex((entry) => entry.kind === 'conflict')
    const decisions = entries.filter((entry) => entry.kind === 'decision')
    const picked = {
      start: entries[0],
      end: entries.at(-1),
      detect: entries[at] ?? entries[0],
      // (No checkpoint of its own — nothing was saved between asking and
      // deciding: the code as it was then, where the change was found.)
      request: decisions[0] ?? entries[at],
      decision: decisions[1] ?? decisions[0] ?? entries[at],
      fix: entries.filter((entry, index) => index > at && (entry.kind === 'edit' || entry.kind === 'ai-edit')).at(-1),
      resolve: entries.find((entry) => entry.kind === 'merge'),
    }[key]
    return (picked ?? entries.at(-1)).id
  }
  // …and the other way: the record's step (1–5) a saved step belongs to.
  function recordStepOf(entryId) {
    const entries = activity.entries
    const entry = entries.find((item) => item.id === entryId)
    if (!entry) return null
    if (entry.kind === 'merge') return 5
    const at = entries.findIndex((item) => item.kind === 'conflict')
    const index = entries.indexOf(entry)
    if (entry.kind === 'decision') return entries.filter((item) => item.kind === 'decision').indexOf(entry) === 0 ? 2 : 3
    return at >= 0 && index > at ? 4 : 1
  }
  // The record's four steps as the replay has reached them: how many of them
  // sit at or before the saved step in view.
  const replayRailSteps = (() => {
    if (!replayId) return null
    const at = activity.entries.findIndex((entry) => entry.id === replayId)
    if (at < 0) return null
    const reached = RECORD_STEPS.filter((step) => activity.entries.findIndex((entry) => entry.id === replayEntryFor(step.key)) <= at).length
    const states = replayStates(RECORD_STEPS.length, reached, at === activity.entries.length - 1)
    return RECORD_STEPS.map((step, index) => ({ ...step, state: states[index] }))
  })()
  const EVENT_STEP_KEY = { detected: 'detect', requested: 'request', decided: 'decision', fixed: 'fix', verified: 'fix', resolved: 'resolve', reopened: 'detect' }

  // The Activity tab is this conflict's own activity, here in the panel
  // (see ConflictHistoryReplay). From there, "Project history" is the way out to the project's archive: it
  // goes to History itself, on the saved version this conflict came from —
  // selected (the address's `?history=<id>`), scrolled to and lit for a moment in the
  // list (`flashCheckpoint`).
  // The saved version this difference first came in with (the one its
  // conflict is marked on in History).
  const causeVersion = conflict
    ? foldConflictCheckpoints(withBranches(workspace?.historyEntries ?? [], workspace?.conflicts ?? []))
      .find((entry) => !entry.archived && entry.conflictMarks.some((mark) => mark.conflictId === conflict.id)) ?? null
    : null
  function openProjectHistory() {
    const checkpoint = causeVersion
    // (Inside the Workspace: the History layer, a step of its own. Elsewhere — a panel with no workspace — its address.)
    if (workspace?.openHistory) workspace.openHistory(checkpoint?.id ?? null, { flash: true })
    else navigate(historyHref(conflict.projectId, checkpoint?.id ?? null), { state: checkpoint ? { flashCheckpoint: checkpoint.id } : null })
  }

  function handleRequestReview({ quiet = false, exceptionSubmitted = false } = {}) {
    if (!exceptionSubmitted && (decisionState.reasonNeeded || reasonRequest)) return
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
    if (quiet) return
    toast(to.length ? `Review requested from ${to.join(', ')}` : 'Review requested', {
      description: failing ? `${failing} check${failing === 1 ? '' : 's'} still need attention — merging waits on them.` : conflict.title,
    })
  }

  function handleApprove(note) {
    const next = onApprove?.(conflict.id, note)
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
    if (decision === 'approve') handleApprove(note)
    else onRequestChanges?.(conflict.id, note)
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
    setExceptionReasonDraft(conflict.deviation?.text ?? '')
    setReasonRequest(request)
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
      if (kept || studioAdjustments.length || handWritten) update({ ...(kept ? { mergedAdjustment: kept } : {}), mergedAdjustments: studioAdjustments, mergedAssembly: handAssembly ?? null, mergedHandLines: handLines, mergedHandValues: handValues })
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
    // (A design decision says what was decided and applied.)
    : conflict.decisionFlow ? (conflict.decisionFix ? decisionOutcomeOf(conflict)?.resolvedLine ?? null : null)
    : mergeConflict ? (conflict.codeChoice === 'both' || !conflict.codeChoice ? 'Resolved by applying both changes'
        : `Resolved with the ${conflict.codeChoice === 'remote' ? 'remote' : 'local'} branch (${conflict.codeChoice === 'remote' ? conflict.branches?.remote : conflict.branches?.local}) value`)
      : mergedSide === 'A' ? 'Resolved with the design reference' : 'Resolved by keeping the current implementation'
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
  const projectMemberIds = projects.find((project) => project.id === conflict?.projectId)?.memberIds ?? allPeople.map((person) => person.id)
  const reviewerCandidates = projectMemberIds.map((id) => allPeople.find((person) => person.id === id)).filter((person) =>
    person && person.id !== authorId && !(conflict?.reviewers ?? []).some((reviewer) => reviewer.id === person.id))
  const ownChange = Boolean(authorId && authorId === viewerId)
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
  // The conflict's code as written by hand — in Merge Studio's code view, or
  // by a value set on the third card — and values set as text for what the
  // code doesn't spell. Both are the adjustment as much as a size is.
  const manualCode = workspace?.mergeDrafts?.current?.[mergeItem?.id]?.manualCode ?? {}
  const handLines = stage === 'resolved' ? conflict?.mergedHandLines ?? null : handLinesOf(conflict, manualCode)
  const handValues = stage === 'resolved' ? conflict?.mergedHandValues ?? null : conflict?.handValues ?? null
  const handWritten = Boolean(handLines) || Object.values(handValues ?? {}).some((value) => value != null && value !== '')
  // (A height set to a token counts even when it's the layer's own px.)
  const adjustedByHand = Boolean(adjustment) || studioAdjustments.length > 0 || Boolean(handAssembly?.heightToken) || handWritten
  // (Decided with no side recorded: the design reference, which is what a
  // merge takes by default — unless it was adjusted by hand, which sits on
  // the current implementation.)
  const mergeSide = stage === 'resolved' ? mergedSide : decisionState.side ?? (stage !== 'detected' && !adjustedByHand ? mergedSide : 'B')
  const result = mergeResultOf(conflict, mergeItem, mergeSide, { assembly: handAssembly, adjustments: studioAdjustments, handLines, handValues })
  // Adjusted by hand: the reason to give is why it was adjusted (kept on the
  // conflict as `adjustmentReason`) — asked in place of the kept-value one,
  // and needed before a review request the same way.
  // The resolution as three choices: the design reference (A), the current
  // value (B), or a value set by hand (C — anything adjusted in Merge
  // Studio). Choosing A or B while adjusted sets the adjustment aside
  // (`stashedAssemblies`, on the conflict) rather than dropping it, so
  // choosing C again brings it back as it was.
  const stash = stage !== 'resolved' && conflict?.stashedAssemblies && Object.keys(conflict.stashedAssemblies).length ? conflict.stashedAssemblies : null
  // (…and the code and text values, set aside with it.)
  const stashedCode = stage !== 'resolved' ? conflict?.stashedCode ?? null : null
  const stashedValues = stage !== 'resolved' ? conflict?.stashedValues ?? null : null
  const hasStash = Boolean(stash || stashedCode || stashedValues)
  const writeHandLines = (lines) => mergeItem && workspace?.setManualCode
    && workspace.setManualCode(mergeItem.id, withHandLines(conflict, workspace.mergeDrafts?.current?.[mergeItem.id]?.manualCode ?? {}, lines, fileLines ?? []))
  // (The third way can be chosen before its value is set: `customChosen`.)
  const choice = !conflict ? null : adjustedByHand || (stage === 'detected' && conflict.customChosen) ? 'C' : stage === 'detected' ? decisionState.side : mergedSide
  const hasReviewers = conflict ? requiredReviewers(conflict).length > 0 : false
  const needsReviewer = stage === 'detected' && Boolean(choice) && !hasReviewers
  function focusNextAction() {
    window.requestAnimationFrame(() => {
      const target = !choice
        ? document.querySelector('[data-decision="A"]')
        : choice === 'C' && !adjustedByHand
          ? document.querySelector('[data-decision="C"] [data-value-select], [data-decision="C"] [data-adjust-start]')
          : decisionState.reasonNeeded
            ? document.querySelector('[data-decision-reason] textarea, [data-decision-reason] input')
            : requestActionRef.current
      target?.focus()
    })
  }
  function assignReviewer(person) {
    if (!reviewerCandidates.some((candidate) => candidate.id === person.id) || person.id === authorId) return
    update({ reviewers: [...conflict.reviewers, { id: person.id, status: 'pending' }] })
    focusNextAction()
  }
  const openStudio = stage !== 'resolved' && onOpenMergeStudio && !inMergeStudio ? () => {
    // Arriving there says what to do: the check to fix (its element
    // marked, the value to reach) or, with none failing, how a precise
    // adjustment works — and how to finish and come back.
    workspace?.setCheckGuide({ conflictId: conflict.id, check: checks?.blocking[0] ?? checks?.failing[0] ?? null })
    onOpenMergeStudio(conflict)
  } : null
  function chooseWay(next) {
    if (stage === 'resolved' || !onUpdate || next === choice) return
    if (stage !== 'detected') update({
      reviewStage: 'detected', exceptionChecks: [], decidedSide: null, decidedBy: null,
      reviewers: conflict.reviewers.map((reviewer) => ({ id: reviewer.id, status: 'pending' })),
    })
    const focusNext = () => window.requestAnimationFrame(() => {
      const target = (next === 'C' && !adjustedByHand ? document.querySelector('[data-decision="C"] [data-value-select], [data-decision="C"] [data-adjust-start]') : null)
        ?? document.querySelector('[data-decision-reason] textarea, [data-decision-reason] input')
        ?? requestActionRef.current
      target?.focus()
    })
    if (next === 'C') {
      // Chosen with or without a value; one set aside before comes back,
      // on the current implementation, where it was set.
      if (stash) workspace.setLayerAdjustments(mergeItem.id, stash)
      if (stashedCode) writeHandLines(stashedCode)
      if (decisionState.side) undoSide()
      update({ customChosen: true, stashedAssemblies: null, stashedCode: null, stashedValues: null, ...(stashedValues ? { handValues: stashedValues } : null), decidedSide: null, decidedBy: null })
      focusNext()
      return
    }
    if (adjustedByHand && mergeItem && workspace?.setLayerAdjustments) {
      const set = workspace.mergeDrafts?.current?.[mergeItem.id]?.assemblies ?? {}
      workspace.setLayerAdjustments(mergeItem.id, {})
      if (handLines) writeHandLines(null)
      // (A seeded "settled by hand" record reopens with it.)
      update({ stashedAssemblies: set, stashedCode: handLines, stashedValues: handValues, handValues: null, ...(conflict.resolution === 'manual' ? { resolution: null, adjustment: null } : null) })
    }
    if (conflict.customChosen) update({ customChosen: false })
    decisionState.pick(next)
    focusNext()
  }
  // The third card's values: what's set now, or what was set aside.
  const customResult = adjustedByHand ? result
    : hasStash && mergeItem ? mergeResultOf(conflict, mergeItem, 'B', { assembly: stash?.[conflict.layerId], adjustments: studioAdjustmentsOf(mergeItem, { [mergeItem.id]: { assemblies: stash ?? {} } }), handLines: stashedCode, handValues: stashedValues })
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
  // The required rules each way would break. Going that way isn't blocked:
  // it becomes an exception request, which the reviewers approve. (Checks
  // already asked an exception for still count — that's what was asked.)
  const customIsReference = Boolean(customResult && conflict?.diff && (customResult.isReference || customResult.lines.join('\n') === (conflict.diff.after ?? []).join('\n')))
  const requiredNow = conflict ? [...decisionState.required, ...(checks?.exceptions ?? []).filter((check) => !decisionState.required.includes(check))] : []
  // (The two sides as they are — without what's set by hand, which is the
  // third way's: a value that fixes the rule doesn't fix it for them.)
  const plainRequired = adjustedByHand && mergeItem && workspace?.linesOfFile
    ? checksFor(mergeItem, { ...workspace.mergeDrafts?.current?.[mergeItem.id], assemblies: {}, manualCode: withHandLines(conflict, manualCode, null) }, workspace.linesOfFile).blocking.filter((check) => !(conflict.acceptedChecks ?? []).includes(check.id))
    : requiredNow
  const violations = {
    A: decisionState.blockingWith.A ?? plainRequired,
    B: decisionState.blockingWith.B ?? plainRequired,
    // (Set to exactly what the design reference is: it stands as that does.)
    C: !adjustedByHand ? [] : customIsReference ? decisionState.blockingWith.A ?? [] : requiredNow,
  }
  const broken = choice ? violations[choice] : []
  const reasonOf = (kind) => (conflict?.deviation?.kind === kind ? conflict.deviation.text ?? '' : '')
  const flowReason = choice === 'C' ? {
    title: broken.length ? 'Reason for adjustment and exception' : 'Why was it adjusted?',
    hint: 'Required · choose all that apply',
    reasons: ADJUSTMENT_REASONS,
    value: conflict.adjustmentReason?.text ?? '',
    onChange: (text) => update({ adjustmentReason: text ? { text, by: viewerId, at: 'Just now' } : null }),
  } : choice === 'B' ? {
    title: broken.length ? 'Reason for the exception request' : 'Why depart from the standard?',
    hint: broken.length ? 'Required · choose all that apply' : 'Required',
    reasons: DEVIATION_REASONS,
    value: reasonOf('keep-current'),
    onChange: (text) => update({ deviation: text ? { kind: 'keep-current', text, by: viewerId, at: 'Just now' } : null }),
  } : choice === 'A' && broken.length ? {
    // (Both sides break it: following the reference still needs one.)
    title: 'Reason for the exception request',
    hint: 'Required · choose all that apply',
    reasons: DEVIATION_REASONS,
    value: reasonOf('exception'),
    onChange: (text) => update({ deviation: text ? { kind: 'exception', text, by: viewerId, at: 'Just now' } : null }),
  } : null
  if (cardFlow) decisionState.reasonNeeded = stage !== 'resolved' && Boolean(flowReason) && !flowReason.value.trim()
  // The decision, settled: review is requested — and, breaking a required
  // rule, the exception is asked for with it (`reason` is the one given).
  function finishDecision(reason = '', { quiet = false, exceptionSubmitted = false } = {}) {
    // A value set by hand that is the design reference's: decided as
    // the design reference (the same code, with nothing left set).
    if (choice === 'C' && customIsReference && adjustedByHand && mergeItem && workspace?.setLayerAdjustments) {
      workspace.setLayerAdjustments(mergeItem.id, {})
      if (handLines) writeHandLines(null)
      update({ stashedAssemblies: null, stashedCode: null, stashedValues: null, handValues: null })
      decisionState.pick('A')
    }
    if (broken.length) {
      update({ exceptionChecks: [...new Set([...(conflict.exceptionChecks ?? []), ...broken.map((check) => check.id)])], decidedBy: viewerId })
      if (workspace) workspace.addComment(`Exception requested: ${broken.map((check) => check.title).join(', ')} — ${reason}`, { conflictId: conflict.id })
    }
    handleRequestReview({ quiet, exceptionSubmitted })
  }
  // Every compared value is set on the third card itself: the element's
  // own numbers on the element (as in Merge Studio), every other value in
  // the code (Merge Studio's code view shows it), and what the code
  // doesn't spell as text.
  const valueControls = cardFlow && stage !== 'resolved' && onUpdate ? fieldControlsFor(conflict, mergeItem) : []
  // Setting a value is choosing this way — on the current implementation;
  // anything set aside before comes back with it.
  function adjustWith({ assemblies = null, lines = null, values = null }) {
    if (stage === 'resolved' || !onUpdate) return
    if (stage !== 'detected') update({ reviewStage: 'detected', exceptionChecks: [], reviewers: conflict.reviewers.map((reviewer) => ({ id: reviewer.id, status: 'pending' })) })
    if (assemblies) workspace.setLayerAdjustments(mergeItem.id, assemblies)
    else if (!adjustedByHand && stash) workspace.setLayerAdjustments(mergeItem.id, stash)
    if (lines) writeHandLines(lines)
    else if (!adjustedByHand && stashedCode) writeHandLines(stashedCode)
    if (decisionState.side) undoSide()
    update({ customChosen: true, stashedAssemblies: null, stashedCode: null, stashedValues: null, decidedSide: null, decidedBy: null,
      handValues: values ?? (adjustedByHand ? handValues : stashedValues) ?? null })
  }
  const controlOf = (control) => {
    const field = conflict.comparisonFields[control.index]
    const shown = customResult?.rows[control.index]
    if (control.mode === 'layer') {
      return {
        ...control,
        value: control.valueOf(adjustedByHand ? handAssembly : stash?.[conflict.layerId]),
        set: (px) => {
          const set = workspace.mergeDrafts?.current?.[mergeItem.id]?.assemblies ?? {}
          const base = adjustedByHand ? set : stash ?? {}
          adjustWith({ assemblies: { ...base, [conflict.layerId]: { ...base[conflict.layerId], ...control.assemblyFor(px) } } })
        },
      }
    }
    // (In the code: only where there's a merge draft to write it to.)
    const inCode = control.mode === 'code' && Boolean(mergeItem && workspace?.setManualCode)
    return {
      ...control,
      mode: inCode ? 'code' : 'text',
      value: shown?.to ?? shown?.base ?? field.current,
      set: (value) => {
        const text = String(value ?? '').trim()
        if (!text) return
        const values = { ...((adjustedByHand ? handValues : stashedValues) ?? {}) }
        if (inCode) {
          const from = (adjustedByHand ? handLines : stashedCode) ?? conflict.diff.before
          delete values[field.label]
          adjustWith({ lines: writeFieldValue(conflict, from, field, text), values })
        } else {
          if (text === field.current) delete values[field.label]
          else values[field.label] = text
          adjustWith({ values })
        }
      },
    }
  }
  // Decided once review is asked for; whoever isn't there as a reviewer
  // (the author) can take it back to choose again.
  const reviewerOnly = Boolean(myReviewer && !ownChange)
  const flow = conflict && cardFlow ? {
    choice,
    editing: stage !== 'resolved' && Boolean(onUpdate),
    decided: stage !== 'detected',
    // An exception asked for, with the reviewers yet to answer.
    exceptionSent: stage === 'in_review' && (conflict.exceptionChecks?.length ?? 0) > 0,
    canChange: stage !== 'detected' && stage !== 'resolved' && !reviewerOnly && Boolean(onUpdate),
    choose: chooseWay,
    custom: customResult,
    openStudio,
    violations,
    customIsReference,
    // The suggestions each way would leave unmet, for that way's card.
    // (Where the sides can't be told apart, what's failing now belongs to
    // the current value — it's the code as it is that was checked.)
    advisories: {
      A: decisionState.suggestedWith.A ?? [],
      B: decisionState.suggestedWith.B ?? decisionState.suggested.filter((check) => check.id !== 'decided'),
      C: [],
    },
    // (The picture and the code follow each value at once.)
    controls: valueControls.length ? valueControls.map(controlOf) : null,
    requestException: (side) => {
      if (side !== choice) chooseWay(side)
      setExceptionReasonDraft('')
      setReasonRequest({ kind: 'card-exception', subject: violations[side].map((check) => check.title).join(', ') })
    },
    submitException: () => {
      const reason = flowReason?.value.trim()
      if (!choice || (choice === 'C' && !adjustedByHand) || !broken.length || !reason || !hasReviewers || stage !== 'detected') return
      finishDecision(reason, { exceptionSubmitted: true })
    },
    reason: flowReason,
    changeDecision: () => update({ reviewStage: 'detected', exceptionChecks: [], customChosen: adjustedByHand, reviewers: conflict.reviewers.map((r) => ({ ...r, status: 'pending' })) }),
    decide: {
      // The chosen way and its reason (entered under the cards) are on
      // the conflict already: this sends them for review, in one go.
      run: () => finishDecision(flowReason?.value ?? ''),
      blocked: !choice ? null
        : choice === 'C' && !adjustedByHand ? 'Set a value first'
          : decisionState.reasonNeeded ? (choice === 'B' ? 'Enter why you’re keeping it' : choice === 'C' ? 'Enter why it was adjusted' : 'Enter the reason for the exception')
          : !requiredReviewers(conflict).length ? 'Assign a reviewer other than the author to request review.' : null,
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
      // (Merging is the approval block's, under the choice.)
      primary = null
    }
  }

  // A value change on its page follows the reference's approval (lib/reviewRecord):
  // asked → decided → fixed and checked by itself → merged.
  const alignedFlow = page && Boolean(conflict) && cardFlow && !conflict.decisionFlow && !conflict.rollback
  const alignedPhase = alignedFlow ? reviewFixPhaseOf(conflict) : null
  // (Approved and not merged yet: the merge is the status block's, at the top.)
  const fixUnderWay = ['applying', 'verifying', 'verified'].includes(alignedPhase)
  // Step 2's time, and step 4 running by itself once the decision is in: the
  // fix is applied, then checked — a moment each, so both are seen.
  const alignedStage = alignedFlow ? stage : null
  const hasRequestTime = Boolean(conflict?.requestedAtMs)
  const runAligned = useEffectEvent((patch) => { if (onUpdate) update(patch) })
  // (Stamped when it's asked for here — a sample already in review keeps the time it came with, or none.)
  const stageSeen = useRef({ id: conflict?.id, stage: alignedStage })
  useEffect(() => {
    const before = stageSeen.current
    stageSeen.current = { id: conflict?.id, stage: alignedStage }
    if (before.id === conflict?.id && before.stage === 'detected' && alignedStage === 'in_review' && !hasRequestTime) { runAligned({ requestedAtMs: Date.now() }); return undefined }
    if (alignedPhase !== 'applying' && alignedPhase !== 'verifying') return undefined
    const timer = window.setTimeout(() => runAligned(alignedPhase === 'applying'
      ? { autoFix: { appliedAtMs: Date.now(), verified: false } }
      : { autoFix: { ...conflict.autoFix, verified: true, verifiedAtMs: Date.now() } }), 1400)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alignedStage, alignedPhase, hasRequestTime, conflict?.id])

  // Approval: where it stands (the same line after the steps) and the one
  // action that calls for, at the header's right (ApprovalBar) — approving
  // and merging happen only there.
  const approvalState = conflict && !conflict.rollback ? approvalStateOf(conflict, canReview) : null
  // A mix of drafts just sent to merge asks for approval from a bar of its
  // own under the title (below), so the header doesn't say it twice.
  // (Not on the page: there the status block says it, once.)
  const approvalNudge = !page && Boolean(conflict && conflict.kind === 'design-review' && stage === 'detected' && conflict.submittedForMergeAt && approvalState?.mode === 'idle' && onUpdate && !cardFlow)
  const approvalBar = approvalState ? (
    <ApprovalBar
      conflict={conflict}
      state={approvalState}
      canReview={canReview}
      blockingCount={checks?.blocking.length ?? 0}
      onUpdate={onUpdate ? update : undefined}
      onDismiss={workspace?.dismissChangeRequest}
      request={!onUpdate || approvalNudge ? null : cardFlow
        ? {
          run: flow.decide.run,
          onAssign: assignReviewer,
          assignable: reviewerCandidates,
          assignReviewer: needsReviewer && Boolean(choice),
          disabled: !choice || Boolean(decisionState.reasonNeeded) || (hasReviewers && Boolean(flow.decide.blocked)) || (needsReviewer && reviewerCandidates.length === 0),
          buttonRef: requestActionRef,
          helper: !choice ? 'Choose a resolution first' : needsReviewer && reviewerCandidates.length === 0 ? 'No other project members available' : null,
          label: needsReviewer ? 'Assign reviewer' : choice === 'A' ? 'Request review with design values' : choice === 'B' ? 'Request review keeping code values' : choice === 'C' ? 'Request review with adjusted values' : 'Request review',
        }
        : { run: handleRequestReview, disabled: !requiredReviewers(conflict).length || decisionState.reasonNeeded || Boolean(reasonRequest) }}
      revise={onUpdate && (ownChange || conflict.requestedBy === viewerId) ? { run: cardFlow && flow.canChange ? flow.changeDecision : handleRequestReview } : null}
      onReview={handleReview}
      // (Only a checked fix merges; approving says why, as the reference's decision does.)
      onMerge={alignedFlow && !canMerge(conflict) ? undefined : handleMerge}
      requireApproveNote={alignedFlow}
      onRevert={() => setConfirmRevert(true)}
    />
  ) : null

  // The way picked, as the record says it: the way's name and its value.
  const recordChoiceLabel = (() => {
    if (!conflict || !cardFlow || !choice) return null
    const reference = comparisonSources(conflict.branches)?.[1]?.label === 'Design reference'
    const name = tr(choice === 'A' ? (reference ? 'Change to the design reference' : 'Remote branch') : choice === 'B' ? (reference ? 'Keeps the current value' : 'Local branch') : 'Adjust by hand')
    const fields = (conflict.comparisonFields ?? []).filter((field) => field.current !== field.expected)
    const values = choice === 'C' ? [] : fields.map((field) => tr(choice === 'A' ? field.expected : field.current))
    return [name, values.join(', ')].filter(Boolean).join(' · ')
  })()

  // A merge request's page: one state (lib/mergeRequest), and everything it
  // says — the status block, the meta, the record — worked out from that.
  const mergeRequest = page && Boolean(conflict) && isMergeRequest(conflict) && Boolean(driftItem && draftColumns(driftItem))
  const requestDecisions = mergeRequest ? ((stage === 'resolved' ? mergedDecisionsForConflict(conflict, workspace) : null) ?? workspace?.decisionsFor?.(driftItem.id) ?? {}) : null
  const requestRows = mergeRequest ? draftRows(conflict, driftItem, requestDecisions) : []
  const requestState = mergeRequest ? mergeRequestStateOf(conflict, requestRows) : null
  const requestStatus = mergeRequest ? mergeRequestStatusOf(conflict, requestRows, { nameOf: personNameOf }) : null
  // Back to Merge Studio, on the drafts (at a part, when one is named).
  const editInStudio = (regionId) => {
    workspace.setDesignCompareRequest({ itemId: driftItem.id, keys: driftItem.variants.map((variant) => variant.key), ...(regionId && { regionId }) })
    if (!inMergeStudio) onOpenMergeStudio?.(conflict)
  }

  // On the page the action belongs to the 해결 방법 card (its foot), as a
  // design decision's does — not to the header's corner.
  const actionInCard = page && Boolean(conflict) && !conflict.rollback && !conflict.decisionFlow && !(driftItem && draftColumns(driftItem))

  // The merge, said once: a banner at the top of the review.
  const mergedBanner = conflict && stage === 'resolved' && (
                    // (The same shape as the other status blocks: a line of what it is, a smaller one of how.)
                    <div data-merged-banner role="status" className="mb-3 flex shrink-0 items-start gap-2 rounded-lg bg-emerald-400/[0.08] px-3 py-2.5 ring-1 ring-emerald-300/25 ring-inset">
                      <CircleCheck className="mt-[3px] size-3.5 shrink-0 text-emerald-300" />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-baseline gap-2 text-[13px] leading-5 font-medium text-emerald-100">
                          <LocalizedText text={conflict.rollback ? 'Previous version restored' : conflict.revertOf ? 'Merge canceled' : 'Merged'} />
                          {!conflict.rollback && conflict.fileId && <button type="button" data-merged-code-link onClick={() => (activity.entries.length ? openReplay(replayEntryFor('end')) : handleOpenFile())} className="ml-auto shrink-0 text-[11.5px] font-medium text-emerald-200 underline-offset-2 hover:text-white hover:underline"><LocalizedText text="View merged code" /></button>}
                        </p>
                        {/* The decision: which value it merged with, who approved, who merged and when. */}
                        <p className="text-[11.5px] leading-4 text-emerald-100/70">
                          {[
                            conflict.rollback ? null : mergedWith,
                            approvers.length ? `Sign-off from ${approvers.join(', ')}` : null,
                            conflict.mergedBy && !conflict.rollback ? `Merged by ${personNameOf(conflict.mergedBy)}` : null,
                          ].filter(Boolean).map((part, index) => <Fragment key={part}>{index > 0 && <span className="text-emerald-100/40"> · </span>}<LocalizedText text={part} /></Fragment>)}
                          {/* (When it merged: 방금 for a minute, then "N분 전"; older, as the app writes times — "10월 8일 오전 11:30".) */}
                          {(Number.isFinite(conflict.resolvedAtMs) || conflict.resolvedAtLabel || conflict.timestamp) && <><span className="text-emerald-100/40"> · </span><RecentTime at={conflict.resolvedAtMs} fallback={Number.isFinite(conflict.resolvedAtMs) ? formatTime(conflict.resolvedAtMs) : conflict.resolvedAtLabel ?? conflict.timestamp} /></>}
                        </p>
                      </div>
                    </div>
                  )
  // Who reviews it: before the rest in the panel; on the page, after what the change is.
  // (Folded, with who and how far in a line — open only while there's no one to review it: one has to be picked.)
  const reviewerNames = conflict && !conflict.rollback ? conflict.reviewers.map((reviewer) => allPeople.find((person) => person.id === reviewer.id)?.name).filter(Boolean) : []
  const reviewersApproved = conflict && !conflict.rollback ? conflict.reviewers.filter((reviewer) => reviewer.status === 'approved').length : 0
  const reviewersBody = conflict && !conflict.rollback ? (
    <>
      <ReviewersSection
        conflict={conflict}
        onUpdate={onUpdate ? update : undefined}
        onDismiss={workspace?.dismissChangeRequest}
        onReviewerAssigned={focusNextAction}
        quiet={page && Boolean(conflict.decisionFlow)}
      />
      <p className="mt-1 text-[11px] leading-4 text-slate-500"><LocalizedText text="You can't assign yourself as a reviewer." /></p>
    </>
  ) : null
  const reviewersGist = conflict?.reviewers?.length ? `${reviewerNames.join(', ')} · ${reviewersApproved}/${conflict.reviewers.length}` : null
  const reviewersSection = reviewersBody ? (
    <FoldSection key={`reviewers:${conflict.id}`} title="Reviewers" count={conflict.reviewers.length || null} defaultOpen={!conflict.reviewers.length} gist={reviewersGist} className="mb-5">
      {reviewersBody}
    </FoldSection>
  ) : null
  // The ways forward (the comparison, the diff, the choices and their action): in the page's record, in
  // the step that's under way; in the bottom panel's review, as its main block.
  const diffArea = conflict ? (
                    <div className={page ? 'min-w-0 shrink-0' : 'grid min-h-0 min-w-0 flex-1 grid-cols-1 items-stretch gap-3 xl:flex xl:items-stretch xl:overflow-hidden'}>
                      {/* The difference itself, on the left with the most room:
                          the two cards compared, and the code diff under them. */}
                      {/* (A section under a hairline on the page — no card around it, so nothing inside is a card in a card.) */}
                      <section data-review-diff className={cn('flex min-w-0 flex-col', page ? 'border-t border-white/[0.07] pt-5' : cn(REVIEW_CARD, 'min-h-0 overflow-hidden p-4 sm:p-5 xl:flex-1'))}>
                        {/* ① What's different: the summary, under the same kind
                            of title as the sections below it. */}
                        <div data-review-scroll="diff" className={page ? 'min-w-0' : 'min-h-0 min-w-0 flex-1 overflow-auto'}>
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
                              // (Changed only before it's asked for, or once it's sent back.)
                              request={mergeRequest ? { canEdit: ['mixing', 'ready', 'rejected'].includes(requestState), onEdit: editInStudio } : null}
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
                            checkBlocks={checkBlocks}
                            flow={flow}
                            reviewerNeeded={needsReviewer}
                            reviewerCandidates={reviewerCandidates}
                            onAssignReviewer={assignReviewer}
                            onCodeChoice={(id) => update({ codeChoice: id })}
                            page={page}
                            action={actionInCard && !fixUnderWay ? approvalBar : null}
                          />
                          )}
                          {/* Drafts mixed by part have no comparison card —
                              their checks sit under the table instead. */}
                          {!conflict.rollback && driftItem && draftColumns(driftItem) && <div className="mt-3">{checkBlocks}</div>}
                        </div>
                      </section>
                    </div>
  ) : null
  // The detail's tabs: on the page, at its top — the change itself (Details) first, then its impact and
  // evidence, comments, activity; in the bottom panel's review, over the sidebar as before.
  const reviewTabs = !conflict ? [] : [
    ...(page ? [['details', 'Change details']] : []),
    ...(conflict.decisionFlow ? [['info', 'Impact & evidence'], ['history', '활동']] : [['info', 'Impact & evidence'], ['comments', 'Comments'], ...(conflict.rollback ? [] : [['activity', 'Activity']])]),
  ]
  const reviewTabBar = (className) => (
    <div role="tablist" aria-label="Conflict sidebar" data-review-tabs={page ? 'top' : 'side'} className={className}>
      {reviewTabs.map(([value, label]) => (
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
                        {/* (What people did: the system's own notes aren't counted.) */}
                        {value === 'history' && <span data-history-count className="text-[11px] font-normal text-slate-400 tabular-nums">{humanEventCount(historyEvents)}</span>}
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
  )
  return (
    <div style={{ '--review-ground': page ? 'var(--background)' : 'var(--card)' }} className={cn('flex h-full min-h-0 w-full flex-col overflow-hidden', page ? 'bg-background' : 'bg-card')}>
        {conflict && (
          <>
            <div data-review-header className={cn('flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3', page ? 'bg-background' : 'bg-card', page ? cn(BREADCRUMB_COLUMN, 'min-h-0 pt-1 pb-3') : 'min-h-[76px] px-4 py-4 sm:px-6')}>
              <div className={cn('flex min-w-0 flex-1 flex-col', page ? 'gap-2' : 'gap-3')}>
                <div className={cn('flex min-w-0 gap-2.5', page ? 'items-baseline' : 'flex-wrap items-center')}>
                  {!page && <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    title="Back to list"
                    aria-label="Back to list"
                    className="ds-intrinsic flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
                  >
                    <ChevronLeft className="size-5" />
                  </button>}
                  {page && onBack && <button type="button" data-review-back onClick={onBack} title="Back to the list" aria-label="Back to the list" className="ds-intrinsic flex size-7 shrink-0 items-center justify-center self-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300"><ChevronLeft className="size-4" /></button>}
                  {/* (On the page the whole title shows — over two lines when it needs them, never cut short.) */}
                  <h2 data-review-title title={conflict.rollback ? undefined : conflict.title} className={cn('min-w-0 font-semibold tracking-tight text-white', page ? 'text-[15px] leading-[22px] break-words [overflow-wrap:anywhere]' : 'truncate text-lg leading-7 sm:text-xl')}>
                    <LocalizedText text={conflict.rollback ? (conflict.rollback.component ?? conflict.rollback.target ?? conflict.title) : conflict.title} />
                  </h2>
                  {!page && (!conflict.rollback || stage === 'resolved') && <span translate="no" className="shrink-0 font-mono text-base font-medium text-slate-400">#{conflictRef(conflict, workspace?.conflicts)}</span>}
                  {/* (On the page its code sits on the title's line, right after it — a quiet mono label, not a line of its own.) */}
                  {page && (!conflict.rollback || stage === 'resolved') && <span data-review-ref translate="no" className="shrink-0 font-mono text-[11px] font-medium text-slate-500">#{conflictRef(conflict, workspace?.conflicts)}</span>}
                  {page && headerAside && <span className="ml-auto flex shrink-0 items-center gap-0.5 self-center">{headerAside}</span>}
                </div>
                {/* A decision's page: what differs, in one sentence, right under the title. */}
                {decisionPage && differenceLineOf(conflict) && <p data-difference-line className={cn('m-0 text-[13px] leading-5 text-slate-300 [word-break:keep-all]', onBack && 'pl-[38px]')}><LocalizedText text={differenceLineOf(conflict)} /></p>}
                {/* (On the page, a size down: 20px badges, 11px words — the title leads.) */}
                {/* (On the page one quiet line: the kind its one chip; the risk, when, and where it stands as words.) */}
                <div data-conflict-meta className={cn('flex flex-wrap items-center', page ? cn('gap-x-2 gap-y-1 text-[12px]', onBack && 'pl-[38px]', decisionPage && "[&>*+*]:before:mr-2 [&>*+*]:before:text-slate-600 [&>*+*]:before:content-['·']") : 'gap-1.5 pl-10')}>
                  <ConflictTypeTag conflict={conflict} header={!page} quiet={page} plain={decisionPage} />
                  {severity && (
                    <span data-risk-badge className={page ? cn('inline-flex items-center gap-1 text-xs', severity.label.toLowerCase() === 'high' ? 'text-rose-300' : 'text-slate-400') : cn(REVIEW_HEADER_BADGE, RISK_TONE[severity.label.toLowerCase()])}>
                        {decisionPage && <span aria-hidden className={cn('size-1.5 rounded-full', severity.label.toLowerCase() === 'high' ? 'bg-rose-400' : severity.label.toLowerCase() === 'medium' ? 'bg-amber-400' : 'bg-slate-500')} />}
                        <span className="font-normal opacity-80"><LocalizedText text="Risk" /></span>
                        <LocalizedText text={severity.label} />
                      </span>
                  )}
                  {/* (The page's meta line: when it's due and where it stands.) */}
                  {page && stage !== 'resolved' && shortDue(conflict.dueLabel) && <DueDate label={conflict.dueLabel} className="text-xs" />}
                  {page && !conflict.rollback && stage !== 'resolved' && (mergeRequest
                    ? <span data-request-state={requestState} className="inline-flex items-center gap-1.5 text-xs text-slate-300"><span aria-hidden className={cn('size-1.5 rounded-full', requestState === 'approved' ? 'bg-emerald-300' : requestState === 'rejected' ? 'bg-amber-300' : requestState === 'waiting' ? 'bg-sky-300' : 'bg-slate-500')} />{MERGE_REQUEST_LABEL[requestState]}</span>
                    : <ListStatusLabel conflict={conflict} className="text-xs" />)}
                  {conflict.revertOf && <MergeCancellationSummary conflict={conflict} conflicts={workspace?.conflicts ?? []} />}
                </div>
              </div>
              {/* Align the review action with the lower metadata row (on the page: with the title's line). */}
              <div data-review-actions className={cn('flex min-w-0 shrink-0 items-center gap-2', page ? 'self-start' : 'relative top-2 self-end')}>
                {/* (A design decision's actions are its status block's; its replay opens from its record.) */}
                {conflict.rollback ? primary : conflict.decisionFlow || actionInCard || mergeRequest ? null : approvalBar}
              </div>
            </div>
            {/* A mix of drafts just sent to merge: its next step — asking the
                reviewers for approval — said plainly, with the button, right
                under the title, rather than left to the header's corner. */}
            {approvalNudge && (() => {
              const reviewers = requiredReviewers(conflict).map((reviewer) => personNameOf(reviewer.id ?? reviewer)).filter(Boolean)
              const blocked = !reviewers.length || decisionState.reasonNeeded || Boolean(reasonRequest)
              return (
                <div data-request-approval-bar className="mx-4 mb-2 flex flex-wrap items-center gap-3 rounded-xl bg-emerald-400/10 px-4 py-3 ring-1 ring-emerald-400/30 sm:mx-6">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-emerald-100"><LocalizedText text="The merge request is ready" /></p>
                    <p className="mt-0.5 text-xs text-emerald-200/70">
                      {reviewers.length
                        ? <><LocalizedText text="Ask for approval from" /> <span translate="no" className="font-medium text-emerald-100">{reviewers.join(', ')}</span></>
                        : <LocalizedText text="No other project members available" />}
                    </p>
                  </div>
                  <button
                    type="button"
                    data-request-approval
                    disabled={blocked}
                    onClick={() => handleRequestReview()}
                    className="ds-intrinsic inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-emerald-400 px-4 text-[13px] font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-slate-500"
                  >
                    <Send className="size-3.5" />
                    <LocalizedText text="Request approval" />
                  </button>
                </div>
              )
            })()}
            {/* Shared outer padding aligns the header and content. */}
            {/* One column that scrolls as a whole, under the header: what to decide first, then — at its
                foot — its impact and evidence, the comments and the activity (no column of its own beside
                it: the pane stays narrow, so the canvas next to it keeps its room). */}
            <div data-review-body className={cn('flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden', page ? cn(BREADCRUMB_COLUMN, 'pb-6') : 'px-4 pt-2 pb-4 sm:px-6 sm:pb-6')}>
              {/* (No hairline under them: the selected tab's underline is the only line there.) */}
              {page && reviewTabBar(cn('flex shrink-0 items-stretch gap-4 border-b transition-colors', scrolled ? 'border-white/[0.08]' : 'border-transparent'))}
              <div data-review-scroll="main" data-scrolled={scrolled ? '' : undefined} onScroll={page ? (event) => setScrolled(event.currentTarget.scrollTop > 0) : undefined} className={cn(
                'flex min-h-0 min-w-0 flex-1 flex-col overflow-auto',
                page ? 'pt-4' : 'pt-1',
                REVIEW_GUTTER
              )}>
                {/* (Stacked, a replay keeps its height — the page scrolls —
                    rather than sharing the window with the sidebar below:
                    its preview would shrink to nothing.) */}
                <div data-review-tab-panel="details" className={cn('flex min-w-0 shrink-0 flex-col', replayId && 'min-h-[576px]', page && sideTab !== 'details' && 'hidden')}>
                  {/* (A merge is said by the title's badge and the approval
                      area; a rollback, which has neither, says it here.) */}
                  {!conflict.decisionFlow && !mergeRequest && mergedBanner}
                  {!replayId && conflict.decisionFlow ? (
                    // A structural drift: a design decision to ask for and
                    // make, not values to pick (DesignDecisionFlow).
                    <div data-review-section="decision" className="min-w-0">
                      {/* (Keyed by the change: what's being picked for one is never carried to the next.) */}
                      <DesignDecisionFlow key={conflict.id} conflict={conflict} workspace={workspace} viewer={currentUserFor(conflict.projectId)} banner={mergedBanner} onReplay={activity.entries.length ? (key) => openReplay(replayEntryFor(key), { autoplay: key === 'start' }) : undefined} />
                    </div>
                  ) : !replayId ? (
                    // (On the page: one column that scrolls as a whole, 12px
                    // between its cards — status, what differs, the ways
                    // forward, then the record — as a design decision's is.)
                    <div className={page ? 'flex min-w-0 flex-col gap-3' : 'contents'}>
                    {/* What's needed now, first (the page's status block): the
                        next action in words — what to act on is right under it. */}
                    {/* Approved, the fix under way or checked: the status and the
                        merge in one block, where a design decision has them. */}
                    {page && fixUnderWay && (
                      <FixStatusBlock
                        phase={alignedPhase}
                        text={reviewStatusOf(conflict, { nameOf: personNameOf, viewerId })}
                        blocked={(checks?.blocking.length ?? 0) > 0}
                        onMerge={onUpdate ? handleMerge : null}
                      />
                    )}
                    {/* A merge request: its one status block — where it stands and
                        the one thing to do about it. The page's strong green is
                        here alone (approved, merged). */}
                    {mergeRequest && (
                      <section data-status-block={requestState} data-request-status role="status" className={cn('flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-2 rounded-lg px-3 py-2.5 ring-1 ring-inset',
                        requestStatus.tone === 'success' ? 'bg-emerald-400/[0.07] ring-emerald-400/30' : requestStatus.tone === 'warning' ? 'bg-amber-400/[0.07] ring-amber-400/30' : 'bg-white/[0.04] ring-white/[0.08]')}>
                        <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', requestStatus.tone === 'success' ? 'bg-emerald-300' : requestStatus.tone === 'warning' ? 'bg-amber-300' : requestStatus.tone === 'waiting' ? 'bg-sky-300' : 'bg-slate-400')} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] leading-5 font-medium text-white">{requestStatus.text}</p>
                          {(requestStatus.detail || requestStatus.note) && <p data-request-detail className="text-[11.5px] leading-4 text-slate-400">{requestStatus.detail ?? requestStatus.note}</p>}
                        </div>
                        {/* The reviewer's own answer, and the author's next step, are the approval bar's (remind, approve, merge). */}
                        {requestStatus.action === 'continue' || requestStatus.action === 'fix'
                          ? <button type="button" data-request-action={requestStatus.action} onClick={() => editInStudio()} className={cn(PRIMARY_BUTTON, 'gap-1.5')}><Layers3 className="size-3.5" />{requestStatus.actionLabel}</button>
                          : requestStatus.action === 'request'
                            ? <button type="button" data-request-action="request" title={requestStatus.actionTitle} onClick={() => handleRequestReview()} className={cn(PRIMARY_BUTTON, 'gap-1.5')}><Send className="size-3.5" />{requestStatus.actionLabel}</button>
                            : approvalBar}
                      </section>
                    )}
                    {/* (No "what to do next" line on the page: the record's current step says it, with the ways forward in it.) */}
                    {/* What was found, in a card of its own (the page). */}
                    {/* (On the page the ways forward are in the record's current step — ReviewRecord's `current`.) */}
                    {(!page || conflict.rollback) && diffArea}
                    {/* Then how far it has come: the record, light — a line a step. */}
                    {page && !conflict.rollback && <ReviewRecord key={`record:${conflict.id}`} conflict={conflict} current={diffArea} choice={cardFlow ? choice : null} choiceLabel={recordChoiceLabel} reason={flowReason?.value ?? ''} 
                      given={mergeRequest ? mergeRequestRecordOf(conflict, requestRows.map((row) => ({ ...row, label: tr(row.label), options: row.options.map((option) => ({ ...option, value: option.literal ? option.value : tr(String(option.value)) })) })), {
                        nameOf: personNameOf,
                        drafts: (requestRows[0]?.options ?? []).map((option) => ({ letter: option.letter, name: tr(option.name) })),
                        clock: (ms) => (Number.isFinite(ms) ? formatTime(ms) : null),
                      }) : null} />}
                    </div>
                  ) : (
                    <div className="flex min-h-0 flex-1 flex-col gap-3">
                      {/* The record, kept in view: the step being replayed is under way, those before it done. */}
                      {conflict.decisionFlow && replayRailSteps && <ReplayStepRail steps={replayRailSteps} />}
                      <div className="flex min-h-0 flex-1">
                      <ConflictReplay key={`${conflict.id}:${replayAutoplay ?? 'open'}`} conflict={conflict} activity={activity} replayId={replayId} onReplay={setReplayId} onBack={() => setReplayId(null)} autoplay={replayAutoplay != null}
                        onOpenHistory={(entryId) => (workspace?.openHistory ? workspace.openHistory(entryId, { flash: true }) : navigate(historyHref(conflict.projectId, entryId), { state: { flashCheckpoint: entryId } }))} />
                      </div>
                    </div>
                  )}
                </div>

                {/* One sidebar on the right, 320px: Info (status, cause,
                    impact, evidence, approvals, reviewers, details) and
                    Comments (the thread and its composer), as two tabs. The
                    comparison beside it takes all the rest. */}
                {/* (In the grid's own row beside the main view: its top is the first container's top,
                    whatever the header's height. Each scrolls on its own, so it stays put.) */}
                <section data-review-sidebar data-review-evidence aria-label="Impact & evidence" className={cn('flex min-w-0 shrink-0 flex-col', page ? (sideTab === 'details' ? 'hidden' : sideTab === 'comments' || sideTab === 'history' ? 'min-h-0 flex-1' : '') : 'border-t border-white/[0.07] pt-4')}>
                  {/* (On the page the tabs are at its top — reviewTabBar — not here.) */}
                  {!page && reviewTabBar('mb-4 flex shrink-0 items-stretch gap-4 border-b border-white/[0.07]')}
                  {sideTab === 'info' ? (
                    <div data-review-tab="info" role="tabpanel" className={cn('min-w-0', page && '[&_[data-info-section]]:mb-0 [&_[data-info-section]+[data-info-section]]:border-t [&_[data-info-section]+[data-info-section]]:pt-3')}>
                      {/* (A design decision's steps are the cards in the main view — not repeated here.) */}
                      {/* (On the page the steps are the record in the main view.) */}
                      {!page && !conflict.rollback && !conflict.decisionFlow && <FlowSteps key={`flow:${conflict.id}`} conflict={conflict} className="mb-5" />}
                      {!page && reviewersSection}
                      <OverviewTab
                        key={`overview:${conflict.id}`}
                        page={page}
                        reviewers={page && reviewersBody ? { body: reviewersBody, count: conflict.reviewers.length, approved: reviewersApproved, open: !conflict.reviewers.length } : null}
                        rationale={rationale}
                        onOpenEvidence={openEvidence}
                        checks={checks}
                        conflict={conflict}
                        stage={stage}
                        showProject={!workspace}
                        blockedCount={decisionState.required.length}
                        adjustment={adjustment}
                        cause={causeVersion}
                        onOpenCause={openProjectHistory}
                        reasonNeeded={decisionState.reasonNeeded}
                        hideTodo={approvalNudge}
                        mix={!conflict.rollback && driftItem && draftColumns(driftItem)
                          ? draftRows(conflict, driftItem, (stage === 'resolved' ? mergedDecisionsForConflict(conflict, workspace) : null) ?? workspace?.decisionsFor?.(driftItem.id) ?? {})
                          : null}
                      />
                    </div>
                  ) : sideTab === 'history' && conflict.decisionFlow ? (
                    <div role="tabpanel" className={cn('flex min-h-0 flex-col', page ? 'min-h-[280px] flex-1' : 'h-[480px]')}>
                      <ConflictHistory
                        key={conflict.id}
                        events={historyEvents}
                        viewerId={viewerId}
                        focus={historyFocus}
                        // (The sample history is for looking at: nothing is written to it.)
                        canWrite={!historyPreview && Boolean(workspace?.addConflictOpinion)}
                        onSend={(body, replyTo) => workspace.addConflictOpinion(conflict.id, body, replyTo)}
                        // A record opens the replay at its step; while it plays, the
                        // step it's on is lit here.
                        onOpenStep={activity.entries.length ? (event) => openReplay(replayEntryFor(EVENT_STEP_KEY[event.type] ?? 'start')) : undefined}
                        activeStep={replayId ? recordStepOf(replayId) : null}
                      />
                    </div>
                  ) : sideTab === 'activity' ? (
                    <div data-review-tab="activity" role="tabpanel" className="min-w-0">
                      <ConflictActivityList conflict={conflict} rationale={rationale} activity={activity} replayId={replayId} onReplay={openReplay} onOpenProjectHistory={openProjectHistory} />
                    </div>
                  ) : (
                    <div role="tabpanel" className={cn('flex min-h-0 flex-col', page ? 'min-h-[280px] flex-1' : 'h-[480px]')}>
                      <CommentThread key={conflict.id} conflict={conflict} workspace={workspace} flashId={flashComment} />
                    </div>
                  )}
                </section>
              </div>
            </div>
          </>
        )}
        <Dialog open={confirmRevert} onOpenChange={setConfirmRevert}>
          <DialogContent className="gap-0 bg-card p-0 sm:max-w-[420px]">
            <div className="px-5 pt-5 pb-3">
              <DialogTitle className="text-sm font-semibold text-white"><LocalizedText text="Cancel this merge?" /></DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-[18px] text-slate-400">
                <LocalizedText text="Do you want to cancel this merge? A request to restore the previous values will be created and applied after review and approval." />
              </DialogDescription>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-white/[0.07] px-5 py-4">
              <button type="button" onClick={() => setConfirmRevert(false)} className="ds-intrinsic inline-flex h-8 items-center rounded-full px-3 text-xs font-medium text-slate-300 hover:bg-white/[0.07] hover:text-white">
                <LocalizedText text="Cancel" />
              </button>
              <button type="button" onClick={() => { setConfirmRevert(false); handleRevert() }} className="ds-intrinsic inline-flex h-8 items-center gap-1.5 rounded-full bg-emerald-400 px-3.5 text-xs font-semibold text-emerald-950 transition-colors hover:bg-emerald-300">
                <RotateCcw className="size-3.5" />
                <LocalizedText text="Cancel the merge" />
              </button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={Boolean(reasonRequest)} onOpenChange={(open) => { if (!open) setReasonRequest(null) }}>
          <DialogContent className="gap-0 bg-card p-0 sm:max-w-[480px]">
            <form onSubmit={(event) => {
              event.preventDefault()
              const reason = exceptionReasonDraft.trim()
              if (!reason || !reasonRequest) return
              if (reasonRequest.kind === 'card-exception') {
                if (!requiredReviewers(conflict).length || !broken.length) return
                flowReason?.onChange(reason)
                finishDecision(reason, { exceptionSubmitted: true })
              } else reasonRequest.run(reason)
              setReasonRequest(null)
              setExceptionReasonDraft('')
            }}>
              <div className="px-5 pt-5 pb-3">
                <DialogTitle className="text-sm font-semibold text-white"><LocalizedText text="Send exception request" /></DialogTitle>
                <DialogDescription className="mt-1 text-xs leading-[18px] text-slate-400">
                  <LocalizedText text="Reason for the exception request" /> · <LocalizedText text={reasonRequest?.subject ?? ''} />
                </DialogDescription>
              </div>
              <div className="space-y-3 px-5 pb-4">
                {reasonRequest?.kind === 'card-exception' && !requiredReviewers(conflict).length && <p role="status" className="text-xs text-amber-200"><LocalizedText text="Assign a reviewer other than the author to request review." /></p>}
                <ReasonField
                  key={`${conflict.id}:${reasonRequest?.subject ?? ''}`}
                  title="Reason for the exception request"
                  hint="Required · choose all that apply"
                  reasons={DEVIATION_REASONS}
                  value={exceptionReasonDraft}
                  onChange={setExceptionReasonDraft}
                />
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-white/[0.07] px-5 py-4">
                <button type="button" onClick={() => { setReasonRequest(null); setExceptionReasonDraft('') }} className="ds-intrinsic inline-flex h-8 items-center rounded-full px-3 text-xs font-medium text-slate-300 hover:bg-white/[0.07] hover:text-white">
                  <LocalizedText text="Cancel" />
                </button>
                <button type="submit" disabled={!exceptionReasonDraft.trim() || (reasonRequest?.kind === 'card-exception' && !requiredReviewers(conflict).length)} className="ds-intrinsic inline-flex h-8 items-center rounded-full bg-emerald-400 px-3.5 text-xs font-semibold text-emerald-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-slate-500">
                  <Send className="mr-1.5 size-3.5" />
                  <LocalizedText text="Send exception request" />
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        <RulesDialog focusId={ruleFocus} onOpenChange={(open) => { if (!open) setRuleFocus(null) }} onOpenSource={openEvidence} />

    </div>
  )
}

export default ConflictModal
