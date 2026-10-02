import { mergeAction } from '@/lib/mergeAction'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  Blocks,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Loader2,
  MessageSquare,
  Palette,
  Rocket,
  Send,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { allPeople, canvasPages, codeMergeVariants, designMergeVariants, mergeFilesFor } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { buildDrifts, buildSummary, buildOverrides } from '@/components/mergestudio/mergeSummary'
import ConflictResolver from '@/components/mergestudio/ConflictResolutionModal'
import { VariantCompareTab } from '@/components/mergestudio/BlockDeckPanel'
import { codeOverrides, workspaceCodeEdits } from '@/components/mergestudio/codeSync'
import { isSecondaryLayer } from '@/components/mergestudio/mockupContent'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { diffEffect, frameWithLayers, isCustomResolution } from '@/components/mergestudio/mergeEffects'
import { SOURCE_LABELS, componentOf, finalRowsFor, reviewSignature, reviewStatus } from '@/components/mergestudio/finalValues'

// Submitting ends at the review request — merging (and any deploy) only
// happens after the PR is approved, outside this flow.
const PROGRESS_STEPS = [
  { label: 'Committing changes', icon: GitBranch },
  { label: 'Opening pull request', icon: GitPullRequest },
  { label: 'Requesting team reviews', icon: Send },
]

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Section heading used across the wizard's steps: a quiet label (small
// muted icon + text) rather than a colored icon + bold title, matching the
// Check and Preview steps' labels.
function SectionTitle({ icon: Icon, children, aside, className }) {
  return (
    <div className={cn('mb-3 flex items-center gap-2', className)}>
      {Icon && <Icon className="size-3.5 text-slate-500" />}
      <h3 className="text-xs font-medium text-slate-300">{children}</h3>
      {aside && <span className="ml-auto">{aside}</span>}
    </div>
  )
}

// Linear-style form field: transparent, a single 1px border, 8px corners.
const FIELD = 'w-full rounded-lg border border-white/[0.1] bg-transparent px-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 hover:border-white/[0.16] focus:border-white/30'

// What will be merged: a single row of compact summary chips — Design,
// Code, AI edits with their counts — collapsed by default so the step
// stays short. A chip opens its list right beneath the row (one at a
// time, capped height, scrolls), as one-line rows.
function SummarySection({ summary }) {
  const [open, setOpen] = useState(null)
  const groups = [
    {
      id: 'design',
      icon: Palette,
      label: 'Design',
      items: summary.design.map((d) => ({ key: d.key, primary: d.text, secondary: d.choice })),
      empty: 'No variant options resolved.',
    },
    {
      id: 'code',
      icon: Code2,
      label: 'Code',
      items: summary.files.map((f) => ({
        key: f.id,
        primary: f.name,
        secondary: `${f.changed} incoming line${f.changed === 1 ? '' : 's'}${f.aiLines > 0 ? ` · ${f.aiLines} AI edit${f.aiLines === 1 ? '' : 's'}` : ''}${f.manualLines > 0 ? ` · ${f.manualLines} manual edit${f.manualLines === 1 ? '' : 's'}` : ''}`,
      })),
      empty: 'No code files.',
    },
    {
      id: 'ai',
      icon: MessageSquare,
      label: 'AI edits',
      items: summary.applied.map((a) => ({ key: a.id, primary: `“${a.text}”`, secondary: a.summary })),
      empty: 'No AI edits applied.',
    },
  ]
  const current = groups.find((g) => g.id === open)

  return (
    <section>
      <SectionTitle className="mb-1">What will be merged</SectionTitle>
      <div className="flex flex-wrap items-center gap-1.5">
        {groups.map((g) => {
          const isOpen = open === g.id
          return (
            <button
              key={g.id}
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : g.id)}
              className={cn(
                'flex h-7 items-center gap-1 border-b-2 px-1.5 text-xs transition-colors',
                isOpen ? 'border-emerald-300 text-white' : 'border-transparent text-slate-400 hover:text-white'
              )}
            >
              <g.icon className="size-3 text-slate-500" />
              {g.label}
              <span className={cn('tabular-nums', g.items.length ? 'font-semibold text-white' : 'text-slate-500')}>{g.items.length}</span>
              <ChevronDown className={cn('size-3 text-slate-500 transition-transform duration-200', isOpen && 'rotate-180')} />
            </button>
          )
        })}
        {summary.pending > 0 && (
          <span className="flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-amber-300">
            <TriangleAlert className="size-3 shrink-0" />
            {summary.pending} note{summary.pending === 1 ? '' : 's'} not applied
          </span>
        )}
      </div>

      {/* The opened group, directly under the chips. */}
      <div className={cn('grid transition-[grid-template-rows] duration-200 ease-out', current ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
          {current && (
            <div className="pt-3">
              {current.items.length ? (
                <ul className="max-h-48 divide-y divide-white/[0.06] overflow-y-auto border-y border-white/[0.06]">
                  {current.items.map((it) => (
                    <li key={it.key} className="flex items-baseline gap-3 py-2 text-[13px]" title={`${it.primary} — ${it.secondary}`}>
                      <span className="min-w-0 flex-1 truncate text-white">{it.primary}</span>
                      <span className="max-w-[55%] shrink-0 truncate text-slate-400">{it.secondary}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-slate-500">{current.empty}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// The full flow, docked in the bottom panel's Conflict Points tab instead
// of a floating wizard: Compare (the Block Deck's old tab, now here) then
// Check → Preview → Review. The canvas's own `MacroStepper` mirrors this
// same list for its header stepper. The flow ends at Review with a PR +
// review request; there is no deploy step (deploying unapproved changes
// isn't possible here).
export const WIZARD_STEPS = [
  { id: 'compare', label: 'Compare' },
  { id: 'check', label: 'Check' },
  { id: 'preview', label: 'Preview' },
  { id: 'review', label: 'Review' },
]

const scopeMeta = {
  code: { label: 'Code', icon: Code2, className: 'bg-emerald-400 text-slate-950', idle: 'text-emerald-300 ring-1 ring-emerald-400/40' },
  design: { label: 'Design', icon: Palette, className: 'bg-emerald-400 text-slate-950', idle: 'text-emerald-300 ring-1 ring-emerald-400/40' },
}

// ----- Preview: review changes -----------------------------------------
// The item-by-item review walkthrough inside Preview: `< >` through every
// review item one at a time (one per changed element or code line — the
// same list the canvas's own pager uses, via `buildDrifts`; an element
// with several changed properties is still one item). Selecting an item
// pans the canvas live to it and highlights it there.
//
// Each design item shows its properties as Original | Current | Final,
// with where the Final value comes from (see finalValues.js), plus any
// Design System component behind it. The candidate buttons still pick
// Original or Current, exactly as before; "Edit in Assemble" hands the
// element to the Block Deck for anything else.
//
// "Mark as reviewed" only records that the user looked at this item's
// final result: it changes no design value or code, adopts no candidate,
// and doesn't touch Check's conflict resolution. A review holds only while
// the item's result is unchanged; any later change reopens it ("Changed
// since review").

const SOURCE_TONE = {
  original: 'bg-white/[0.06] text-slate-300',
  current: 'bg-sky-400/10 text-sky-300',
  custom: 'bg-emerald-400/10 text-emerald-300',
  designSystem: 'bg-violet-400/10 text-violet-300',
}

// The design-system token that's relevant to a property, when the
// component recorded one (e.g. radius.full for Corner Radius).
function tokenFor(source) {
  return source.token
}

function SourceBadge({ source, propLabel }) {
  const detail =
    source.kind === 'designSystem'
      ? [source.component, tokenFor(source, propLabel)].filter(Boolean).join(' · ')
      : source.kind === 'current' && source.defaulted
        ? 'default'
        : source.detail
  return (
    <span className="flex min-w-0 items-center gap-1.5" title={source.defaulted ? "No explicit selection. The current implementation will be used." : undefined}>
      <span className={cn('shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium', SOURCE_TONE[source.kind])}>{SOURCE_LABELS[source.kind]}</span>
      {detail && <span className="min-w-0 truncate text-[11px] text-slate-500">{detail}</span>}
    </span>
  )
}

function DriftReviewSection({ item, drifts, review, frame, resolutions, assemblies, assemblySources, onResolveDiff, onActiveChange, onSetReviewMark, onEditInAssemble, initialDriftId }) {
  const { requestMergeFocus } = useWorkspace()
  const [activeId, setActiveId] = useState(initialDriftId ?? drifts[0]?.id)
  const index = Math.max(0, drifts.findIndex((d) => d.id === activeId))
  // The item being reviewed drives the preview's spotlight.
  useEffect(() => {
    onActiveChange?.(drifts[index] ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, drifts])

  function focusDrift(d) {
    requestMergeFocus({
      itemId: item.id,
      keepDeck: true,
      label: d.label,
      ...(d.kind === 'design' ? { layerId: d.layerId } : { fileId: d.fileId, line: d.line }),
    })
  }

  function goTo(i) {
    const next = Math.min(Math.max(i, 0), drifts.length - 1)
    setActiveId(drifts[next].id)
    focusDrift(drifts[next])
  }

  // No auto-focus on mount: opening the wizard (or reaching this step) must
  // leave the canvas exactly where the user put it. The canvas only moves
  // when they explicitly step through items with < >.

  if (!drifts.length) return null
  const d = drifts[Math.min(index, drifts.length - 1)]
  const status = review.statusOf(d)
  const rows = d.kind === 'design' ? review.rowsFor(d) : []
  const component = d.kind === 'design' ? componentOf(assemblies[d.layerId], assemblySources[d.layerId]) : null
  const canAssemble = d.kind === 'design' && frame?.layers.some((l) => l.id === d.layerId)

  return (
    <section>
      {/* Flat: a label row, the item's title with its pager, then one
          hairline-divided row per property — no card, no inner boxes. */}
      <div className="mb-3 flex items-center gap-2">
        <p className="text-xs font-medium text-slate-300">Review changes</p>
        <span className={cn('ml-auto text-xs tabular-nums', review.reviewedCount === drifts.length ? 'font-medium text-emerald-300' : 'text-slate-400')}>
          {review.reviewedCount === drifts.length ? 'All changes reviewed' : `${review.reviewedCount} of ${drifts.length} reviewed`}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <p className="min-w-0 truncate text-[15px] font-semibold text-white">{d.label}</p>
        {status === 'stale' && (
          <span className="shrink-0 rounded-full bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">Changed since review</span>
        )}
        <span className="ml-auto shrink-0 text-xs text-slate-500 tabular-nums">
          {index + 1} of {drifts.length}
        </span>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            title="Previous change"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            className="flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            title="Next change"
            onClick={() => goTo(index + 1)}
            disabled={index === drifts.length - 1}
            className="flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {d.kind === 'design' ? (
        <>
          {component && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-slate-400">
              <span className={cn('rounded-full px-1.5 py-px text-[10px] font-medium', SOURCE_TONE.designSystem)}>Design system</span>
              {component.replaced ? 'Replaced with' : 'Styled with'}
              <span className="font-medium text-slate-200">{component.name}</span>
              {component.tokens.length > 0 && <span className="text-slate-500">· {component.tokens.join(', ')}</span>}
            </p>
          )}
          <table className="mt-2 w-full table-fixed text-[13px]">
            <thead>
              <tr className="text-left text-[11px] text-slate-500">
                <th className="w-[26%] pb-1 font-medium">Property</th>
                <th className="w-[22%] pb-1 font-medium">Original</th>
                <th className="w-[22%] pb-1 font-medium">Current</th>
                <th className="pb-1 font-medium">Final</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {rows.map((row) => {
                const side = resolutions[`${d.layerId}:${row.id}`]
                const choice = (id, text) => (
                  <button
                    type="button"
                    aria-pressed={side === id}
                    title={id === 'A' ? 'Keep the Original value' : 'Adopt the Current value'}
                    onClick={() => onResolveDiff(d.layerId, row.id, id)}
                    className={cn(
                      'h-7 max-w-full truncate rounded-full px-2.5 text-[12.5px] transition-colors',
                      side === id ? 'bg-white/[0.1] font-medium text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                    )}
                  >
                    {text}
                  </button>
                )
                return (
                  <tr key={row.id} className="align-middle">
                    <td className="truncate py-2 pr-2 text-slate-400">{row.label}</td>
                    <td className="py-2 pr-1">{choice('A', row.original)}</td>
                    <td className="py-2 pr-1">{choice('B', row.current)}</td>
                    <td className="py-2">
                      <span className="block truncate font-medium text-white">{row.final}</span>
                      <SourceBadge source={row.source} propLabel={row.label} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      ) : (
        <p className="mt-2 text-[13px] text-slate-400">
          {mergeFilesFor(item).find((f) => f.id === d.fileId)?.name} · line {d.line} — its final code is in the output below.
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        {canAssemble && (
          <button
            type="button"
            onClick={() => onEditInAssemble?.({ layerId: d.layerId, driftId: d.id })}
            title="Select this element in the Block Deck's Assemble tab to change its final result"
            className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <Blocks className="size-4 text-slate-500" />
            Edit in Assemble
          </button>
        )}
        <div className="ml-auto flex items-center gap-1">
          {status === 'reviewed' ? (
            <>
              <span className="flex h-8 items-center gap-1.5 px-2 text-[13px] font-medium text-emerald-300">
                <Check className="size-4" />
                Reviewed
              </span>
              <button
                type="button"
                onClick={() => onSetReviewMark(d.id, null)}
                className="flex h-8 items-center rounded-full px-3 text-[12px] text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-200"
              >
                Mark as unreviewed
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onSetReviewMark(d.id, review.signatureOf(d))}
              className="flex h-8 items-center gap-1.5 rounded-full bg-white/[0.07] px-3.5 text-[13px] font-medium text-slate-100 transition-colors hover:bg-white/[0.12]"
            >
              <Check className="size-4" />
              Mark as reviewed
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

// ----- Merge impact & health assessment (the Check step) --------------
// Everything is derived from the item's own data and the current choices,
// so the numbers move as options are decided.
//
// A property value is "on the token scale" when it matches the design
// system: 4px spacing grid, the radius scale, the type / weight scales, or
// a named color / surface token.
const RADIUS_SCALE = new Set([0, 2, 4, 6, 8, 12, 16, 20, 24, 999])
const TYPE_SCALE = new Set([12, 14, 16, 18, 20, 24, 28, 32, 40, 48])
const WEIGHT_SCALE = new Set([400, 500, 600, 700])
const LAYOUT_PROPS = /padding|spacing|font size|width|height|gap/i
const ACCENT_HEX = { 'Indigo 500': '#6366f1', 'Violet 500': '#8b5cf6' }
// Sections of the page, from layer ids (nav-…, hero-…): the screens a
// merge touches.
const SECTION_NAMES = { nav: 'Navigation', hero: 'Hero', signup: 'Sign-up', social: 'Social proof', avatar: 'Social proof', feature: 'Features', dash: 'Dashboard', cashflow: 'Dashboard', txn: 'Dashboard' }

function onTokenScale(label, value) {
  // A named color / surface token ("Violet 500", "Card Surface").
  if (/^[A-Z][a-z]+( [A-Z]?[a-z]+)*( \d{2,3})?$/.test(String(value).trim())) return true
  const nums = String(value).match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
  if (!nums.length) return false
  if (/radius/i.test(label)) return nums.every((n) => RADIUS_SCALE.has(n))
  if (/font size/i.test(label)) return nums.every((n) => TYPE_SCALE.has(n))
  if (/weight/i.test(label)) return nums.every((n) => WEIGHT_SCALE.has(n))
  return nums.every((n) => n % 4 === 0)
}

function relLuminance(hex) {
  const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const contrastOnWhite = (hex) => 1.05 / (relLuminance(hex) + 0.05)

function assessMerge(item, resolutions, summary) {
  const frame = item.hasDesign ? canvasPages.find((p) => p.id === item.designPageId)?.frames[0] : null
  const layers = frame?.layers ?? []
  const layerDiffs = designMergeVariants[item.id]?.layerDiffs ?? {}
  const drifts = buildDrifts(item, frame)

  // Every property decision, with the value that will actually ship
  // (undecided = the Current Implementation's value).
  const props = Object.entries(layerDiffs).flatMap(([layerId, diffs]) =>
    diffs.map((diff) => {
      const r = resolutions[`${layerId}:${diff.id}`]
      const value = isCustomResolution(r) ? r.custom : r === 'A' ? diff.optionA : diff.optionB
      return { layerId, diff, value, decided: Boolean(r), changed: value !== diff.optionA }
    })
  )
  const offScale = props.filter((p) => !onTokenScale(p.diff.label, p.value))
  const consistency = props.length ? Math.round(((props.length - offScale.length) / props.length) * 100) : 100
  const breaking = props.filter((p) => p.changed && LAYOUT_PROPS.test(p.diff.label))
  const risk = breaking.length === 0 ? 'Low' : breaking.length <= 2 ? 'Medium' : 'High'
  const undecided = props.filter((p) => !p.decided).length

  // Screens (page sections) touched, with element / property counts.
  const bySection = new Map()
  for (const [layerId, diffs] of Object.entries(layerDiffs)) {
    const name = SECTION_NAMES[layerId.split('-')[0]] ?? 'Other'
    const entry = bySection.get(name) ?? { name, elements: 0, props: 0 }
    entry.elements += 1
    entry.props += diffs.length
    bySection.set(name, entry)
  }
  const screens = [...bySection.values()]

  // Automated checks.
  const interactive = layers.filter((l) => ['button', 'input', 'iconbtn', 'chip', 'toggle'].includes(l.type))
  const smallTargets = interactive.filter((l) => Math.min(l.width, l.height) < 24)
  const accents = [...new Set(props.filter((p) => /accent/i.test(p.diff.label) && ACCENT_HEX[p.value]).map((p) => p.value))]
  const worstAccent = accents.map((a) => ({ a, ratio: contrastOnWhite(ACCENT_HEX[a]) })).sort((x, y) => x.ratio - y.ratio)[0]
  const fontSizes = props.filter((p) => /font size/i.test(p.diff.label)).map((p) => parseFloat(p.value))
  const hasConflict = item.conflictLevel && item.conflictLevel !== 'None'

  const checks = [
    {
      id: 'conflict',
      group: 'Merge',
      ok: !hasConflict,
      title: hasConflict ? `${item.conflictLevel} merge conflict` : 'No merge conflicts',
      hint: hasConflict ? 'Conflicting blocks need a version before this merges cleanly.' : null,
      action: hasConflict ? 'resolve' : null,
    },
    {
      id: 'decided',
      group: 'Merge',
      ok: undecided === 0,
      title: undecided === 0 ? `All ${props.length} design options decided` : `${undecided} design option${undecided === 1 ? '' : 's'} undecided`,
      hint: undecided ? 'They’ll ship the Current Implementation’s value — review them in Preview.' : null,
    },
    {
      id: 'tokens',
      group: 'Design system',
      ok: offScale.length === 0,
      title: offScale.length === 0 ? 'All values on the token scale' : `${offScale.length} value${offScale.length === 1 ? '' : 's'} off the token scale`,
      hint: offScale.length ? offScale.map((p) => `${layers.find((l) => l.id === p.layerId)?.name ?? p.layerId} ${p.diff.label.toLowerCase()} ${p.value}`).join(' · ') : null,
    },
    worstAccent && {
      id: 'contrast',
      group: 'Accessibility',
      ok: worstAccent.ratio >= 4.5,
      title: `Button text contrast ${worstAccent.ratio.toFixed(1)}:1`,
      hint: worstAccent.ratio >= 4.5 ? null : `${worstAccent.a} with white text is below WCAG AA (4.5:1).`,
    },
    {
      id: 'targets',
      group: 'Accessibility',
      ok: smallTargets.length === 0,
      title: smallTargets.length === 0 ? `Target size ≥ 24px on all ${interactive.length} controls` : `${smallTargets.length} control${smallTargets.length === 1 ? '' : 's'} under 24px`,
      hint: smallTargets.length ? 'WCAG 2.2 AA (2.5.8) target size.' : null,
    },
    fontSizes.length > 0 && {
      id: 'text',
      group: 'Accessibility',
      ok: fontSizes.every((n) => n >= 12),
      title: fontSizes.every((n) => n >= 12) ? 'Text sizes ≥ 12px' : 'Text below 12px',
      hint: null,
    },
    {
      id: 'ai',
      group: 'Merge',
      ok: summary.pending === 0,
      title: summary.pending === 0 ? (summary.applied.length ? `${summary.applied.length} AI edit${summary.applied.length === 1 ? '' : 's'} applied` : 'No pending AI notes') : `${summary.pending} AI note${summary.pending === 1 ? '' : 's'} not applied`,
      hint: summary.pending ? 'Use “Apply with AI” on the canvas to include them.' : null,
    },
  ].filter(Boolean)

  return { drifts, props, consistency, breaking, risk, screens, checks, codeFiles: summary.files.length }
}

const RISK_TONE = { Low: 'text-emerald-300', Medium: 'text-amber-300', High: 'text-rose-300' }

// Check: the merge's impact and the design system's health, before
// previewing — four headline numbers, which screens it touches, then the
// automated checks. Conflict resolution is one of the checks (its Resolve
// action swaps this step's content for the inline resolver).
function CheckStep({ item, resolutions, summary, onResolveDiff, onEditCode }) {
  const [conflictOpen, setConflictOpen] = useState(false)
  const a = assessMerge(item, resolutions, summary)
  const passed = a.checks.filter((c) => c.ok).length
  const attention = a.checks.length - passed

  if (conflictOpen) {
    return <ConflictResolver item={item} onResolveDiff={onResolveDiff} onEditCode={onEditCode} onBack={() => setConflictOpen(false)} onResolved={() => setConflictOpen(false)} />
  }

  const metrics = [
    { id: 'consistency', value: `${a.consistency}`, unit: '%', label: 'Token consistency' },
    { id: 'screens', value: a.screens.length, label: a.screens.length === 1 ? 'Screen impacted' : 'Screens impacted' },
    { id: 'breaking', value: a.breaking.length, label: a.breaking.length === 1 ? 'Breaking change' : 'Breaking changes', tag: `${a.risk} risk`, tone: RISK_TONE[a.risk] },
    { id: 'checks', value: passed, of: a.checks.length, label: 'Checks passed' },
  ]
  const groups = [...new Set(a.checks.map((c) => c.group))]

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(190px,22%)_minmax(0,1fr)_minmax(190px,22%)]">
      <section className="flex min-h-0 min-w-0 flex-col overflow-auto rounded-xl bg-white/[0.03] p-3">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-[11px] font-semibold text-slate-200">Merge impact</h2>
            <p className="mt-1 text-[10px] leading-4 text-slate-400">
              <span className={cn('font-medium', RISK_TONE[a.risk])}>{a.risk} risk</span>
              {' · '}
              {attention ? `${attention} checks need attention` : 'Checks pass'}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-white/[0.05] px-2 py-1 text-[9px] text-slate-400">
            {a.drifts.length} drift{a.drifts.length === 1 ? '' : 's'}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-2 xl:grid-cols-1">
          {metrics.map((m) => (
            <div key={m.id} className="flex min-w-0 items-center gap-2 rounded-lg bg-black/15 px-2.5 py-2 xl:justify-between">
              <div className="min-w-0">
                <dt className="truncate text-[9px] leading-3 text-slate-400">{m.label}</dt>
                {m.tag && <p className={cn('mt-0.5 text-[9px] font-medium', m.tone)}>{m.tag}</p>}
              </div>
              <dd className="shrink-0 text-base leading-none font-semibold text-white tabular-nums">
                {m.value}
                {m.unit && <span className="text-xs font-medium text-slate-400">{m.unit}</span>}
                {m.of != null && <span className="text-[10px] font-medium text-slate-500">/{m.of}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl bg-white/[0.03] p-3">
        <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
          <h2 className="text-[11px] font-semibold text-slate-200">Automated checks</h2>
          <span className="text-[9px] text-slate-500">{passed}/{a.checks.length} passed</span>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-auto md:grid-cols-2 2xl:grid-cols-3">
          {groups.map((g) => (
            <section key={g} className="min-w-0 rounded-lg bg-black/10 p-2">
              <p className="mb-1.5 text-[9px] font-medium text-slate-500">{g}</p>
              <ul className="space-y-1">
                {a.checks
                  .filter((c) => c.group === g)
                  .map((c) => (
                    <li key={c.id} className="flex items-start gap-1.5 rounded-md bg-white/[0.025] px-2 py-1.5">
                      {c.ok ? <CheckCircle2 className="mt-px size-3 shrink-0 text-emerald-400" /> : <TriangleAlert className="mt-px size-3 shrink-0 text-amber-300" />}
                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-[10px] leading-[14px]', c.ok ? 'text-slate-300' : 'font-medium text-white')}>{c.title}</span>
                        {c.hint && <span className="mt-0.5 block text-[9px] leading-3 text-slate-400">{c.hint}</span>}
                      </span>
                      {c.action === 'resolve' && (
                        <button
                          type="button"
                          onClick={() => setConflictOpen(true)}
                          className="flex h-6 shrink-0 items-center gap-1 rounded-full ds-primary-cta pr-1.5 pl-2 text-[9px] font-semibold text-slate-950"
                        >
                          Resolve
                          <ArrowRight className="size-2.5" />
                        </button>
                      )}
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      </section>

      <section className="min-h-0 min-w-0 overflow-auto rounded-xl bg-white/[0.03] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-[11px] font-semibold text-slate-200">Impact</h2>
          <span className="text-[9px] text-slate-500">{a.screens.length} screen · {a.codeFiles} file</span>
        </div>
        <ul className="divide-y divide-white/[0.06]">
          {a.screens.map((sc) => (
            <li key={sc.name} className="flex items-center gap-2 py-2 first:pt-0 last:pb-0">
              <Palette className="size-3.5 shrink-0 text-slate-500" />
              <span className="min-w-0 flex-1 truncate text-[10px] text-slate-100">{sc.name}</span>
              <span className="shrink-0 text-[9px] text-slate-400 tabular-nums">
                {sc.elements} · {sc.props}
              </span>
            </li>
          ))}
          {a.codeFiles > 0 && (
            <li className="flex items-center gap-2 py-2 last:pb-0">
              <Code2 className="size-3.5 shrink-0 text-slate-500" />
              <span className="min-w-0 flex-1 truncate text-[10px] text-slate-100">Code</span>
              <span className="shrink-0 text-[9px] text-slate-400 tabular-nums">{a.codeFiles} file{a.codeFiles === 1 ? '' : 's'}</span>
            </li>
          )}
          {!a.screens.length && a.codeFiles === 0 && (
            <li className="py-3 text-[10px] text-slate-500">No affected screens or files.</li>
          )}
        </ul>
        {a.screens.length > 0 && (
          <p className="mt-2 text-[9px] text-slate-500">Elements · properties</p>
        )}
      </section>
    </div>
  )
}

// ----- Step 2: Preview -------------------------------------------------
// Everything Preview's review needs, computed once from the studio's live
// state (shared with the wizard footer's "not yet reviewed" count): the
// review items, each design item's Original | Current | Final rows, and
// each item's review status against the recorded marks.
function buildReviewModel({ item, resolutions, annotations, preset, assemblies, assemblySources, extraLayers, manualCode, reviewMarks, getFileLines }) {
  manualCode = { ...workspaceCodeEdits(item, getFileLines), ...manualCode }
  const baseFrame = item.hasDesign ? canvasPages.find((p) => p.id === item.designPageId)?.frames[0] : null
  const frame = item.hasDesign ? frameWithLayers(baseFrame, extraLayers) : null
  const codeOv = codeOverrides(item.id, frame, manualCode, getFileLines)
  const drifts = buildDrifts(item, frame, { assemblies, code: codeOv, annotations, preset, manualCode })
  const codeMap = designMergeVariants[item.id]?.layerCodeMap ?? {}
  const aiEffectsFor = (layerId) => annotations.filter((a) => a.effect && (a.targets ?? []).includes(layerId)).map((a) => a.effect)
  const aiLineFor = (fileId, line) => annotations.find((a) => a.status === 'done' && a.fileId === fileId && a.line === line)?.summary ?? null
  const layerCodeLines = (layerId) => {
    const t = codeMap[layerId]
    if (!t) return null
    const out = []
    for (let n = t.line; n < t.line + (t.span ?? 1); n++) {
      out.push(manualCode[`${t.fileId}:${n}`] ?? codeMergeVariants[item.id]?.[t.fileId]?.find((d) => d.line === n)?.incoming ?? getFileLines(t.fileId)[n - 1] ?? '')
    }
    return out
  }
  const ctx = { resolutions, assemblies, assemblySources, codeOverrides: codeOv, aiEffectsFor, aiLineFor, layerCodeLines, preset, manualCode }
  ctx.rowsFor = (d) => finalRowsFor({ layerId: d.layerId, diffs: d.diffs, resolutions,
    assembly: assemblies[d.layerId], sources: assemblySources[d.layerId], aiEffects: aiEffectsFor(d.layerId), codeOverride: codeOv[d.layerId], preset, layer: frame?.layers.find((l) => l.id === d.layerId) })
  ctx.codeValueFor = (d) => manualCode[`${d.fileId}:${d.line}`] ?? d.incoming ?? getFileLines(d.fileId)[d.line - 1]
  const statusOf = (d) => reviewStatus(d, reviewMarks, ctx)
  return {
    drifts,
    frame,
    rowsFor: (d) =>
      finalRowsFor({
        layerId: d.layerId,
        diffs: d.diffs,
        resolutions,
        assembly: assemblies[d.layerId],
        sources: assemblySources[d.layerId],
        aiEffects: aiEffectsFor(d.layerId),
        codeOverride: codeOv[d.layerId],
        preset,
        layer: frame?.layers.find((l) => l.id === d.layerId),
      }),
    statusOf,
    signatureOf: (d) => reviewSignature(d, ctx),
    reviewedCount: drifts.filter((d) => statusOf(d) === 'reviewed').length,
  }
}

function mergeEffect(prev = {}, e) {
  return {
    ...prev,
    ...(e.className && { className: e.className }),
    ...(e.radius !== undefined && { radius: e.radius }),
    ...(e.fontWeight !== undefined && { fontWeight: e.fontWeight }),
    dw: (prev.dw ?? 0) + (e.dw ?? 0),
    dh: (prev.dh ?? 0) + (e.dh ?? 0),
  }
}

// Component macro zoom, as a pair: Original Design and the Merged result
// rendered at full resolution, then cropped onto the same element in each.
// Both panels share ONE scale — the largest that still fits the bigger of
// the two elements (plus padding) — and the same alignment (element
// centered), so a real size difference stays visible on screen: a 256px-
// wide result reads wider than a 240px original instead of each being
// fitted to its own panel. Boxes are measured where the element actually
// renders (frame units, unaffected by the zoom transform). Glides between
// elements as the reviewed item changes.
const ZOOM_H = 176
const ZOOM_PAD = 28
const ZOOM_MAX = 4
// Gap between the element's edge and its marker, so the marker never sits
// on (and hides) the corners or outline being compared.
const MARK_GAP = 5

function measureLayer(frameEl, layerId) {
  const el = frameEl?.querySelector(`[data-layer-id="${CSS.escape(layerId)}"]`)
  return el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : null
}

function ZoomPanel({ label, emphasized, frame, overrideFor, height, viewRef, frameRef, view }) {
  return (
    <figure className="min-w-0">
      <figcaption className={cn('mb-2 text-xs font-medium', emphasized ? 'text-white' : 'text-slate-400')}>{label}</figcaption>
      <div ref={viewRef} className="relative overflow-hidden rounded-lg bg-white" style={{ height }}>
        <div
          ref={frameRef}
          className="absolute top-0 left-0 transition-transform duration-300 ease-out"
          style={{ width: frame.width, height: frame.height, transform: view ? `translate(${view.tx}px, ${view.ty}px) scale(${view.k})` : undefined, transformOrigin: '0 0', opacity: view ? 1 : 0 }}
        >
          {frame.layers.map((layer) => (
            <StaticLayer key={layer.id} layer={layer} override={overrideFor(layer)} onSelect={() => {}} />
          ))}
        </div>
        {/* The element's bounds, marked a few px outside its edge (dashed)
            so its real corners and outline stay fully visible. */}
        {view && (
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-[4px] border border-dashed border-emerald-500/70 transition-all duration-300 ease-out"
            style={{
              left: view.tx + view.box.x * view.k - MARK_GAP,
              top: view.ty + view.box.y * view.k - MARK_GAP,
              width: view.box.w * view.k + MARK_GAP * 2,
              height: view.box.h * view.k + MARK_GAP * 2,
            }}
          />
        )}
      </div>
    </figure>
  )
}

function MacroZoomPair({ frame, layerId, originalOverride, mergedOverride, stacked, height = ZOOM_H }) {
  const aView = useRef(null)
  const aFrame = useRef(null)
  const bView = useRef(null)
  const bFrame = useRef(null)
  const [views, setViews] = useState(null)
  useLayoutEffect(() => {
    function measure() {
      const boxA = measureLayer(aFrame.current, layerId)
      const boxB = measureLayer(bFrame.current, layerId)
      const widthA = aView.current?.clientWidth
      const widthB = bView.current?.clientWidth
      if (!boxA || !boxB || !widthA || !widthB) return
      const k = Math.min(Math.min(widthA, widthB) / (Math.max(boxA.w, boxB.w) + ZOOM_PAD * 2),
        height / (Math.max(boxA.h, boxB.h) + ZOOM_PAD * 2), ZOOM_MAX)
      const place = (box, width) => ({ k, tx: width / 2 - (box.x + box.w / 2) * k,
        ty: height / 2 - (box.y + box.h / 2) * k, box })
      const next = { k, a: place(boxA, widthA), b: place(boxB, widthB) }
      setViews((prev) => JSON.stringify(prev) === JSON.stringify(next) ? prev : next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    for (const el of [aView.current, bView.current, aFrame.current?.querySelector(`[data-layer-id="${CSS.escape(layerId)}"]`), bFrame.current?.querySelector(`[data-layer-id="${CSS.escape(layerId)}"]`)]) {
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [layerId, height, stacked, frame, originalOverride, mergedOverride])

  return (
    <div>
      <div className={cn('grid gap-3', stacked ? 'grid-cols-1' : 'grid-cols-2')}>
        <ZoomPanel label="Original Design" frame={frame} overrideFor={originalOverride} height={height} viewRef={aView} frameRef={aFrame} view={views?.a} />
        <ZoomPanel label="Merged result" emphasized frame={frame} overrideFor={mergedOverride} height={height} viewRef={bView} frameRef={bFrame} view={views?.b} />
      </div>
      {views && (
        <p className="mt-2 text-[11px] text-slate-500 tabular-nums">
          Both at {views.k.toFixed(2)}× · {views.a.box.w}×{views.a.box.h} → {views.b.box.w}×{views.b.box.h}px
        </p>
      )}
    </div>
  )
}

// Staging view of the combined result: the Current Implementation with every
// resolved option and applied AI edit baked in, next to the merged code
// (incoming lines + AI edits, with hand-edited lines taking precedence).
function PreviewStep({ item, resolutions, annotations, preset, assemblies = {}, assemblySources = {}, extraLayers = [], manualCode = {}, onResolveDiff, review, onSetReviewMark, onEditInAssemble, initialDriftId }) {
  const { getFileLines } = useWorkspace()
  const files = mergeFilesFor(item).filter((f) => item.fileIds?.includes(f.id))
  const [fileId, setFileId] = useState(files[0]?.id)

  // Context-aware spotlight: the drift picked in the pager above is
  // highlighted in both outputs — its element in the design preview, and
  // its code lines (via the item's element → code map) in the code output.
  const [spot, setSpot] = useState(null)
  const codeMap = designMergeVariants[item.id]?.layerCodeMap ?? {}
  const spotLayerId =
    spot?.kind === 'design'
      ? spot.layerId
      : spot?.kind === 'code'
        ? Object.keys(codeMap).find((id) => codeMap[id].fileId === spot.fileId && spot.line >= codeMap[id].line && spot.line < codeMap[id].line + (codeMap[id].span ?? 1))
        : null
  const codeTarget = spot?.kind === 'code' ? { fileId: spot.fileId, line: spot.line, span: 1 } : spotLayerId ? codeMap[spotLayerId] : null
  useEffect(() => {
    if (codeTarget?.fileId && files.some((f) => f.id === codeTarget.fileId)) setFileId(codeTarget.fileId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spot?.id])

  const codeRef = useRef(null)
  const frame = item.hasDesign ? frameWithLayers(canvasPages.find((p) => p.id === item.designPageId)?.frames[0], extraLayers) : null
  const layerDiffs = designMergeVariants[item.id]?.layerDiffs ?? {}

  const { overrides } = buildOverrides(item, resolutions, annotations, preset, assemblies, extraLayers, manualCode, getFileLines)

  const activeFile = files.find((f) => f.id === fileId) ?? files[0]
  const lines = activeFile ? getFileLines(activeFile.id) : []
  const incoming = new Map((codeMergeVariants[item.id]?.[activeFile?.id] ?? []).map((d) => [d.line, d.incoming]))
  const aiLines = new Map(
    annotations.filter((a) => a.status === 'done' && a.fileId === activeFile?.id && a.line).map((a) => [a.line, a.summary])
  )

  // Overrides for the zoom panels: the merged result as staged, and the
  // Original Design for the focused element (its drifts at option A).
  const primaryOf = (layer) => layer.type === 'button' && !isSecondaryLayer(layer.id)
  const mergedOverride = (layer) => {
    const o = overrides[layer.id]
    const primary = primaryOf(layer)
    return o ? { ...o, className: o.className ?? (primary ? 'bg-violet-500' : undefined), static: true } : primary ? { className: 'bg-violet-500', static: true } : undefined
  }
  const originalOverride = (layer) => {
    if (layer.id !== spotLayerId) return mergedOverride(layer)
    let o
    for (const diff of layerDiffs[layer.id] ?? []) o = mergeEffect(o, diffEffect(diff, 'A'))
    const primary = primaryOf(layer)
    return o ? { ...o, className: o.className ?? (primary ? 'bg-indigo-500' : undefined), static: true } : primary ? { className: 'bg-indigo-500', static: true } : undefined
  }
  const spotLayer = frame?.layers.find((l) => l.id === spotLayerId)
  const wideSpot = Boolean(spotLayer && spotLayer.width > 200)
  const spotLines = codeTarget && codeTarget.fileId === activeFile?.id ? new Set(Array.from({ length: codeTarget.span ?? 1 }, (_, k) => codeTarget.line + k)) : null
  // Bring the spotlighted lines into view inside the code output only
  // (never scrolls the modal / page).
  useEffect(() => {
    const box = codeRef.current
    const first = spotLines && box?.querySelector(`[data-line="${codeTarget.line}"]`)
    if (first) box.scrollTo({ top: Math.max(0, first.offsetTop - 28), behavior: document.hidden ? 'auto' : 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spot?.id, activeFile?.id])

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(260px,28%)_minmax(0,1fr)_minmax(0,1fr)]">
      <section className="min-h-0 min-w-0 overflow-auto rounded-xl bg-white/[0.03] p-3">
        <DriftReviewSection
          item={item}
          drifts={review.drifts}
          review={review}
          frame={frame}
          resolutions={resolutions}
          assemblies={assemblies}
          assemblySources={assemblySources}
          onResolveDiff={onResolveDiff}
          onActiveChange={setSpot}
          onSetReviewMark={onSetReviewMark}
          onEditInAssemble={onEditInAssemble}
          initialDriftId={initialDriftId}
        />
      </section>

      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl bg-white/[0.03] p-3">
        <div className="mb-2 flex shrink-0 items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-slate-200">Design preview</p>
            <p className="mt-0.5 text-[10px] text-slate-500">Original and merged</p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-[10px] font-medium text-emerald-300">
            <span className="ds-status-dot animate-pulse rounded-full bg-emerald-400" />
            Live
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {frame && spotLayer ? (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-medium text-slate-300">
              <Palette className="size-3.5 text-slate-500" />
              {spotLayer.name}
              </p>
              <MacroZoomPair
                frame={frame}
                layerId={spotLayer.id}
                originalOverride={originalOverride}
                mergedOverride={mergedOverride}
                stacked={wideSpot}
                height={wideSpot ? 124 : ZOOM_H}
              />
            </div>
          ) : (
            <p className="text-[10px] leading-4 text-slate-400">
              {frame ? 'This change is in code and has no design element.' : 'No design preview for this item.'}
            </p>
          )}
        </div>
      </section>

      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl bg-white/[0.03] p-3">
        <div className="mb-2 flex shrink-0 items-center gap-1.5">
          <Code2 className="size-3.5 shrink-0 text-slate-500" />
          <div className="flex min-w-0 gap-0.5 overflow-x-auto [scrollbar-width:none]" role="tablist" aria-label="Output files">
            {files.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={f.id === activeFile?.id}
                onClick={() => setFileId(f.id)}
                className={cn(
                  'h-6 shrink-0 rounded-full px-2.5 text-[10px] font-medium transition-colors',
                  f.id === activeFile?.id ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:text-slate-200'
                )}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>
        <div ref={codeRef} className="relative min-h-0 flex-1 overflow-auto rounded-lg bg-white/[0.025] py-2 font-mono text-[10px] leading-relaxed">
              {lines.map((line, i) => {
                const n = i + 1
                const manual = manualCode[`${activeFile.id}:${n}`]
                const text = manual ?? (incoming.get(n) ?? line) + (aiLines.has(n) ? `  // AI: ${aiLines.get(n)}` : '')
                const changed = manual !== undefined || incoming.has(n) || aiLines.has(n)
                const spotlit = spotLines?.has(n)
                return (
                  <div
                    key={i}
                    data-line={n}
                    className={cn(
                      'flex gap-3 border-l-2 px-3 transition-colors duration-300',
                      spotlit ? 'border-emerald-300 bg-emerald-400/[0.16]' : changed ? 'border-emerald-400 bg-emerald-400/[0.05]' : 'border-transparent'
                    )}
                  >
                    <span className={cn('w-5 shrink-0 text-right select-none', spotlit ? 'text-emerald-300' : 'text-slate-600')}>{n}</span>
                    <span className={cn('min-w-0 flex-1 break-words whitespace-pre-wrap', spotlit || changed ? 'text-white' : 'text-slate-300')}>{text || ' '}</span>
                  </div>
                )
              })}
        </div>
      </section>
    </div>
  )
}

// ----- Step 3: Review --------------------------------------------------
function ReviewerSection({ reviewers, setReviewers, needCode, needDesign, approvalRecords = [], requested = false }) {
  function toggleScope(id, scope) {
    setReviewers((prev) => {
      const current = prev[id] ?? []
      const scopes = current.includes(scope) ? current.filter((t) => t !== scope) : [...current, scope]
      const next = { ...prev }
      if (scopes.length) next[id] = scopes
      else delete next[id]
      return next
    })
  }

  return (
    <section className="min-w-0">
      <SectionTitle className="mb-2">Reviewers</SectionTitle>
      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
        {[
          { scope: 'code', needed: needCode },
          { scope: 'design', needed: needDesign },
        ].map(({ scope, needed }) => {
          const meta = scopeMeta[scope]
          const Icon = meta.icon
          const assignedCount = allPeople.filter((person) => reviewers[person.id]?.includes(scope)).length
          return (
            <span key={scope} className={cn('inline-flex items-center gap-1', needed && assignedCount === 0 ? 'text-amber-300' : 'text-slate-500')}>
              <Icon className="size-3" />
              {meta.label} · {assignedCount}{needed ? ' required' : ''}
            </span>
          )
        })}
      </div>
      <ul className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
        {allPeople.map((person) => (
          <li key={person.id} className="flex min-w-0 items-center gap-2 py-1.5">
            <Avatar size="sm" className="size-6 shrink-0">
              <AvatarFallback className={cn('text-[8px] font-semibold text-white', person.colorClass)}>{person.initials}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-200" title={person.role}>{person.name}</span>
            <span className="text-[10px] text-slate-400">{!requested ? 'Not requested' : approvalRecords.some((r) => r.id === person.id && r.status === 'changes_requested') ? 'Changes requested' : approvalRecords.some((r) => r.id === person.id) ? approvalRecords.filter((r) => r.id === person.id).every((r) => r.status === 'approved') ? 'Approved' : 'Waiting' : 'Not requested'}</span>
            {['code', 'design'].map((scope) => {
              const selected = Boolean(reviewers[person.id]?.includes(scope))
              const meta = scopeMeta[scope]
              const Icon = meta.icon
              return (
                <button
                  key={scope}
                  type="button"
                  onClick={() => toggleScope(person.id, scope)}
                  disabled={requested}
                  aria-pressed={selected}
                  aria-label={`${selected ? 'Remove' : 'Assign'} ${person.name} for ${meta.label.toLowerCase()} review`}
                  title={`${meta.label} review`}
                  className={cn(
                    'flex h-6 shrink-0 items-center gap-1 px-1.5 text-[10px] transition-colors',
                    selected ? 'text-emerald-300' : 'text-slate-500 hover:text-slate-300'
                  )}
                >
                  <Icon className="size-3" />
                  {meta.label}
                </button>
              )
            })}
          </li>
        ))}
      </ul>
    </section>
  )
}

function ProgressView({ step }) {
  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <Loader2 className="size-7 animate-spin text-emerald-400" />
      <ul className="w-full max-w-xs space-y-3">
        {PROGRESS_STEPS.map((s, i) => {
          const done = i < step
          const active = i === step
          return (
            <li key={s.label} className={cn('flex items-center gap-3 text-sm transition-colors duration-300', done ? 'text-slate-300' : active ? 'font-medium text-white' : 'text-slate-500')}>
              {done ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
              ) : active ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-emerald-400" />
              ) : (
                <s.icon className="size-4 shrink-0" />
              )}
              {s.label}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// After "Open PR & Request Review": the PR is open and waiting — the item
// now reads "In review" in the Merge List until reviewers approve.
function SuccessView({ prTitle, reviewerNames, deploy, prNumber }) {
  const rows = [
    { icon: Send, text: `Review requested from ${reviewerNames.join(', ')}` },
    { icon: GitPullRequest, text: 'Shown as “In review” in the Merge List' },
    { icon: Rocket, text: deploy ? 'Deploys automatically once approved and merged' : 'Auto-deploy is off — deploy manually after merge' },
  ]
  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center animate-in fade-in zoom-in-95 duration-300">
      <span className="flex size-14 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300 ring-8 ring-emerald-400/[0.06]">
        <CheckCircle2 className="size-7" />
      </span>
      <div>
        <p className="text-base font-semibold text-white">Review requested</p>
        <p className="mt-1 text-[13px] text-slate-400">
          PR #{prNumber} “{prTitle}” is open and waiting for approval.
        </p>
      </div>
      <ul className="w-full max-w-sm space-y-3 text-left">
        {rows.map((r) => (
          <li key={r.text} className="flex items-start gap-3 text-[13px] text-slate-200">
            <r.icon className="mt-px size-4 shrink-0 text-slate-500" />
            {r.text}
          </li>
        ))}
      </ul>
    </div>
  )
}

// Compare → Check → Preview → Review, docked in the bottom panel's Conflict
// Points tab (the canvas's own `MacroStepper` is the primary way to jump
// between steps; this just renders whichever one is active). `step` is
// owned by the parent (MergeStudioWorkspace's `wizardStep`), not internal
// state — the panel is always mounted once an item is open, so there's no
// "open fresh every time" moment to seed an initial step/drift from
// anymore.
function MergeStepFlow({ item, resolutions, annotations, preset, assemblies, assemblySources = {}, extraLayers, manualCode = {}, onResolveDiff, onHoverDiff, selectedLayerId, reviewMarks = {}, onSetReviewMark, onEditInAssemble, step, onStepChange, onComplete, onRequestComplete, onFinalMerge, onEditCode, onBack }) {
  const merged = item.tag === 'Merged'
  const summary = useMemo(() => buildSummary(item, resolutions, annotations, preset, assemblies, extraLayers, manualCode), [item, resolutions, annotations, preset, assemblies, extraLayers, manualCode])
  const { getFileLines, conflicts, currentUser, approveConflict, updateMergeItem } = useWorkspace()
  const action = mergeAction(item, conflicts, currentUser.id)
  const linkedConflicts = conflicts.filter((c) => c.mergeItemId === item.id || c.id === item.conflictId)
  const review = useMemo(
    () => buildReviewModel({ item, resolutions, annotations, preset, assemblies, assemblySources, extraLayers, manualCode, reviewMarks, getFileLines }),
    [item, resolutions, annotations, preset, assemblies, assemblySources, extraLayers, manualCode, reviewMarks, getFileLines]
  )
  const unreviewedCount = review.drifts.length - review.reviewedCount
  const branch = `merge/${slugify(item.title)}`
  const [run, setRun] = useState('idle') // idle | progress | success (Deploy step)
  const [progress, setProgress] = useState(0)
  const [reviewers, setReviewers] = useState({ james: ['code'], min: ['design'] })
  const [commit, setCommit] = useState(`merge: ${item.title}`)
  const [prTitle, setPrTitle] = useState(`Merge: ${item.title}`)
  const [prBody, setPrBody] = useState('')
  const [deploy, setDeploy] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [prNumber] = useState(() => 100 + Math.floor(Math.random() * 90))

  const needCode = summary.files.length > 0
  const needDesign = item.hasDesign
  const hasScope = (scope) => Object.values(reviewers).some((s) => s.includes(scope))
  const reviewersOk = (!needCode || hasScope('code')) && (!needDesign || hasScope('design'))
  const reviewerIds = Object.keys(reviewers)
  const reviewerNames = reviewerIds.map((id) => allPeople.find((p) => p.id === id)?.name).filter(Boolean)
  const scopeNames = (scope) => allPeople.filter((p) => reviewers[p.id]?.includes(scope)).map((p) => p.name)
  const reviewValid = reviewersOk && commit.trim() && prTitle.trim()

  useEffect(() => {
    if (run !== 'progress') return
    const timer = setInterval(() => setProgress((s) => s + 1), 750)
    return () => clearInterval(timer)
  }, [run])

  useEffect(() => {
    if (run === 'progress' && progress >= PROGRESS_STEPS.length) {
      setRun('success')
      onComplete(reviewerIds)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, run])

  function generateWithAi() {
    setGenerating(true)
    setTimeout(() => {
      const d = summary.design.length
      const a = summary.applied.length
      setCommit(`merge(${slugify(item.title)}): reconcile ${d} design decision${d === 1 ? '' : 's'}, ${a} AI edit${a === 1 ? '' : 's'}`)
      setPrTitle(`Merge: ${item.title} — design & code reconciliation`)
      setPrBody(
        [
          '## Summary',
          `Reconciles the Original Design and the Current Implementation for **${item.title}**.`,
          '',
          '## Changes',
          ...summary.design.map((x) => `- Design: ${x.text} → ${x.choice}`),
          ...summary.files.map((f) => `- Code: ${f.name} (${f.changed} incoming line${f.changed === 1 ? '' : 's'}${f.manualLines ? `, ${f.manualLines} manual edit${f.manualLines === 1 ? '' : 's'}` : ''})`),
          ...summary.applied.map((x) => `- AI: ${x.summary} (“${x.text}”)`),
          '',
          '## Review',
          `Code: ${scopeNames('code').join(', ') || '—'} · Design: ${scopeNames('design').join(', ') || '—'}`,
        ].join('\n')
      )
      setGenerating(false)
    }, 900)
  }

  const busy = run === 'progress'
  const last = step === WIZARD_STEPS.length - 1
  const canNext = step === 3 ? reviewValid : true
  const approvalRecords = linkedConflicts.length
    ? linkedConflicts.flatMap((conflict) => conflict.reviewers.map((reviewer) => ({ ...reviewer, conflictId: conflict.id })))
    : item.reviewers ?? []

  return (
    <div className="flex h-full flex-col">
      {/* One wide row instead of a stacked title block: back (when this is
          a drill-in from the Conflict Points list), title + branch, and
          the step tabs, all on the same baseline — the panel is wide and
          short now, not a tall narrow dialog, so stacking them wasted the
          width and buried the steps behind the canvas's own stepper. */}
      <div className="flex shrink-0 items-center gap-3 px-4 py-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            title="Back to conflict list"
            aria-label="Back to conflict list"
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <ChevronLeft className="size-4" />
          </button>
        )}
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-slate-950">
            <GitPullRequest className="size-3" />
          </span>
          <div className="min-w-0">
            <p className="text-sm leading-tight font-semibold text-white">{merged ? 'Merge complete' : run === 'success' ? 'Review requested' : 'Merge changes'}</p>
            <p className="flex items-center gap-1 text-[11px] leading-tight text-slate-500">
              <GitBranch className="size-2.5" />
              {branch} → main
            </p>
          </div>
        </div>
        {!merged && <div className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-white/[0.025] p-1" role="tablist" aria-label="Merge steps">
          {WIZARD_STEPS.map((s, i) => {
            const active = i === step
            const done = i < step
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={busy || merged}
                onClick={() => onStepChange(i)}
                className={cn(
                  'flex h-7 items-center gap-1 rounded-full px-3 text-[12px] font-medium transition-colors disabled:opacity-40',
                  active ? 'bg-white/[0.1] text-white' : done ? 'text-emerald-400 enabled:hover:bg-white/[0.06]' : 'text-slate-500 enabled:hover:bg-white/[0.04] enabled:hover:text-slate-300'
                )}
              >
                {done && <Check className="size-3" />}
                {s.label}
              </button>
            )
          })}
        </div>}
      </div>

      {merged ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300">
            <CheckCircle2 className="size-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Changes already merged</p>
            <p className="mt-1 text-xs text-slate-500">This item is complete. It can’t be submitted or merged again.</p>
          </div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mt-1 flex h-7 items-center rounded-full bg-white/[0.06] px-3 text-xs font-medium text-slate-300 transition-colors hover:bg-white/[0.1] hover:text-white"
            >
              Back to conflict
            </button>
          )}
        </div>
      ) : (
      <>
      <div className={cn('min-h-0 flex-1 px-4', step === 0 || step === 1 || step === 2 ? 'overflow-hidden py-1' : step === 3 ? 'overflow-y-auto py-1 xl:overflow-hidden' : 'overflow-y-auto py-4')}>
        <div className={cn('mx-auto w-full', (step === 0 || step === 1 || step === 2 || step === 3) && 'flex h-full min-h-0 flex-col', step === 0 || step === 1 || step === 2 || step === 3 ? 'max-w-none' : 'max-w-[1440px]')}>
        <section className={cn(
          'flex flex-wrap items-center gap-x-3 gap-y-1',
          step === 1 || step === 2 || step === 3
            ? 'mb-2 min-h-7 shrink-0 px-1'
            : 'mb-4 rounded-xl bg-white/[0.035] px-4 py-3',
          item.tag !== 'In Review' && 'justify-between'
        )}>
          <div className="flex min-w-0 items-center">
            <p className={cn('shrink-0 font-semibold text-amber-300', step === 1 || step === 2 || step === 3 ? 'text-[10px]' : 'text-xs')}>Draft changes</p>
          </div>
        </section>
        {run === 'idle' && step === 0 && (
          item.hasDesign ? (
            <VariantCompareTab item={item} selectedLayerId={selectedLayerId} resolutions={resolutions} onResolve={onResolveDiff} onHoverDiff={onHoverDiff} />
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
              This merge item has no design page to compare.
            </div>
          )
        )}
        {run === 'idle' && step === 1 && <CheckStep item={item} resolutions={resolutions} summary={summary} onResolveDiff={onResolveDiff} onEditCode={onEditCode} />}
        {run === 'idle' && step === 2 && (
            <PreviewStep
              item={item}
              resolutions={resolutions}
              annotations={annotations}
              preset={preset}
              assemblies={assemblies}
              assemblySources={assemblySources}
              extraLayers={extraLayers}
              manualCode={manualCode}
              onResolveDiff={onResolveDiff}
              review={review}
              onSetReviewMark={onSetReviewMark}
              onEditInAssemble={onEditInAssemble}
            />
          )}

          {run === 'idle' && step === 3 && (
            <div className="grid min-h-0 grid-cols-1 gap-3 xl:flex xl:flex-1 xl:overflow-hidden">
              <div className="min-w-0 rounded-xl bg-white/[0.03] p-3 xl:min-h-0 xl:w-[28%] xl:shrink-0 xl:overflow-y-auto">
                <SummarySection summary={summary} />
              </div>
              <div className="min-w-0 rounded-xl bg-white/[0.03] p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <ReviewerSection approvalRecords={approvalRecords} requested={item.tag === 'In Review'} reviewers={reviewers} setReviewers={setReviewers} needCode={needCode} needDesign={needDesign} />
              </div>
              <section className="min-w-0 rounded-xl bg-white/[0.03] p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <SectionTitle
                  className="mb-2"
                  aside={
                    <button
                      type="button"
                      onClick={generateWithAi}
                      disabled={generating}
                      className="flex h-6 items-center justify-center gap-1 rounded-full bg-white/[0.06] px-2 text-[10px] font-medium text-slate-200 transition-colors hover:bg-white/[0.1] hover:text-white disabled:opacity-60"
                    >
                      {generating ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                      {generating ? 'Generating…' : 'AI draft'}
                    </button>
                  }
                >
                  Commit &amp; PR
                </SectionTitle>
                <div className="space-y-2">
                  <label className="block">
                    <span className="mb-0.5 block text-[10px] text-slate-400">Commit message</span>
                    <input value={commit} onChange={(e) => setCommit(e.target.value)} className={cn(FIELD, 'h-7 px-2 text-[11px] font-mono')} />
                  </label>
                  <label className="block">
                    <span className="mb-0.5 block text-[10px] text-slate-400">PR title</span>
                    <input value={prTitle} onChange={(e) => setPrTitle(e.target.value)} className={cn(FIELD, 'h-7 px-2 text-[11px]')} />
                  </label>
                  <label className="block">
                    <span className="mb-0.5 block text-[10px] text-slate-400">PR description</span>
                    <textarea
                      value={prBody}
                      onChange={(e) => setPrBody(e.target.value)}
                      rows={2}
                      placeholder="Describe this merge, or use Generate with AI…"
                      className={cn(FIELD, 'max-h-32 min-h-[3.5rem] resize-none px-2 py-1 text-[11px] leading-relaxed [field-sizing:content]')}
                    />
                  </label>
                  <label className="flex items-center gap-2 border-t border-white/[0.06] pt-2 text-[11px]">
                    <Rocket className="size-3.5 shrink-0 text-slate-500" />
                    <span className="flex-1 text-slate-300">Auto-deploy after merge</span>
                    <Switch checked={deploy} onCheckedChange={setDeploy} />
                  </label>
                </div>
              </section>
            </div>
          )}

          {run === 'progress' && <ProgressView step={Math.min(progress, PROGRESS_STEPS.length - 1)} />}
          {run === 'success' && (
            <SuccessView prTitle={prTitle} reviewerNames={reviewerNames} deploy={deploy} prNumber={prNumber} />
          )}
        </div>

        </div>

        <div className="flex shrink-0 flex-col px-4 py-3">
          <div className="flex items-center justify-end gap-2">
            {run === 'success' ? (
              <button
                type="button"
                onClick={() => {
                  setRun('idle')
                  onRequestComplete?.()
                }}
                className="inline-flex h-8 items-center justify-center rounded-full ds-primary-cta px-3.5 text-xs font-semibold text-slate-950"
              >
                Done
              </button>
            ) : (
              <>
                {step === 3 && action.kind === 'check' ? (
                  <span className="mr-auto text-xs text-amber-300">{action.reason}</span>
                ) : step === 3 && action.kind === 'request' && !reviewValid ? (
                  <span className="mr-auto text-[13px] text-amber-500">
                    {!reviewersOk ? 'Assign at least one Code and one Design reviewer.' : 'Commit message and PR title are required.'}
                  </span>
                ) : step === 2 && review.drifts.length > 0 ? (
                  // Preview never blocks moving on (the existing policy) — it
                  // just says plainly how much is left to look at. Continuing
                  // opens the Review step; nothing is merged until the PR
                  // there is opened and approved.
                  <span className={cn('mr-auto text-[13px] tabular-nums', unreviewedCount ? 'text-amber-300' : 'text-emerald-300')}>
                    {unreviewedCount
                      ? `${unreviewedCount} of ${review.drifts.length} change${review.drifts.length === 1 ? '' : 's'} not yet reviewed`
                      : 'All changes reviewed'}
                  </span>
                ) : (
                  <span className="mr-auto text-[13px] text-muted-foreground tabular-nums">
                    Step {step + 1} of {WIZARD_STEPS.length} · {WIZARD_STEPS[step].label}
                  </span>
                )}
                <button
                  type="button"
                  disabled={busy || step === 0}
                  onClick={() => onStepChange(step - 1)}
                  className="flex h-8 items-center justify-center gap-1 rounded-full px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" />
                  Back
                </button>
                {!last ? (
                  <button
                    type="button"
                    disabled={!canNext}
                    onClick={() => onStepChange(step + 1)}
                    className="flex h-8 items-center justify-center gap-1.5 rounded-full bg-slate-700 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-slate-600 disabled:opacity-40"
                  >
                    Continue to {WIZARD_STEPS[step + 1].label}
                    <ArrowRight className="size-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy || action.disabled || (action.kind === 'request' && !reviewValid)}
                    onClick={() => {
                      if (action.kind === 'approve') {
                        if (action.linked.length) action.linked.forEach((c) => approveConflict(c.id))
                        else updateMergeItem(item.id, { reviewers: item.reviewers.map((r) => r.id === currentUser.id ? { ...r, status: 'approved' } : r) })
                      } else if (action.kind === 'check') {
                        onStepChange(1)
                      } else if (action.kind === 'merge') {
                        onFinalMerge()
                      } else {
                        setProgress(0)
                        setRun('progress')
                      }
                    }}
                    className="flex h-8 items-center justify-center gap-1.5 rounded-full ds-primary-cta px-3.5 text-xs font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition-all hover:brightness-110 disabled:opacity-40"
                  >
                    <GitPullRequest className="size-4" />
                    {action.label} {action.progress}

                  </button>
                )}
              </>
            )}
          </div>
          {step === 3 && action.kind === 'waiting' && (
            <div className="mt-2 text-center text-xs text-slate-400">
              Awaiting approval · {action.pending.map((id) => allPeople.find((p) => p.id === id)?.name ?? id).join(', ')}
            </div>
          )}
        </div>
        </>
        )}
      </div>
  )
}

export default MergeStepFlow
