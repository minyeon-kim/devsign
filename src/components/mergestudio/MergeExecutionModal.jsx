import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  GitBranch,
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { allPeople, canvasPages, codeMergeVariants, designMergeVariants, openFiles } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { buildDrifts, buildSummary } from '@/components/mergestudio/mergeSummary'
import ConflictResolver from '@/components/mergestudio/ConflictResolutionModal'
import { codeOverrides } from '@/components/mergestudio/codeSync'
import { isSecondaryLayer } from '@/components/mergestudio/mockupContent'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { assemblyToOverride, diffEffect, frameWithLayers, isCustomResolution, mergeOverride, yieldToExact } from '@/components/mergestudio/mergeEffects'

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
function SectionTitle({ icon: Icon, children, aside }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {Icon && <Icon className="size-3.5 text-slate-500" />}
      <h3 className="text-xs font-medium text-slate-300">{children}</h3>
      {aside && <span className="ml-auto">{aside}</span>}
    </div>
  )
}

// Linear-style form field: transparent, a single 1px border, 8px corners.
const FIELD = 'w-full rounded-lg border border-white/[0.1] bg-transparent px-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 hover:border-white/[0.16] focus:border-white/30'
const FIELD_LABEL = 'mb-1 block text-xs text-slate-400'

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
      <SectionTitle>What will be merged</SectionTitle>
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
                'flex h-8 items-center gap-1.5 rounded-full pr-2 pl-3 text-[13px] transition-colors',
                isOpen ? 'bg-white/[0.1] text-white' : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.07] hover:text-white'
              )}
            >
              <g.icon className="size-3.5 text-slate-500" />
              {g.label}
              <span className={cn('tabular-nums', g.items.length ? 'font-semibold text-white' : 'text-slate-500')}>{g.items.length}</span>
              <ChevronDown className={cn('size-3.5 text-slate-500 transition-transform duration-200', isOpen && 'rotate-180')} />
            </button>
          )
        })}
        {summary.pending > 0 && (
          <span className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-amber-300">
            <TriangleAlert className="size-3.5 shrink-0" />
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

// Reserved width for the canvas to shift clear of, while the wizard is open
// and docked to its default right-side spot (max-w-2xl + its right-6
// margin + breathing room). Matches the `reserve`/`DECK_RESERVE` pattern
// the Block Deck already uses for the same purpose — both dock right and
// share the same reserved zone, so neither the code comparison nor the
// artboards sit hidden behind either one.
export const WIZARD_RESERVE = 720

// Top edge the wizard docks at and can't be dragged above: just below the
// studio's top toolbar row (matches the Block Deck's DECK_TOP).
const WIZARD_TOP = 60

export const WIZARD_STEPS = [
  { id: 'check', label: 'Check' },
  { id: 'preview', label: 'Preview' },
  { id: 'review', label: 'Review' },
]

const scopeMeta = {
  code: { label: 'Code', icon: Code2, className: 'bg-emerald-400 text-slate-950', idle: 'text-emerald-300 ring-1 ring-emerald-400/40' },
  design: { label: 'Design', icon: Palette, className: 'bg-emerald-400 text-slate-950', idle: 'text-emerald-300 ring-1 ring-emerald-400/40' },
}

// ----- Step 1: Check ---------------------------------------------------
// The step-review walkthrough: `< >` through every drift one at a time
// (design property diffs, then raw code-line diffs — the exact same list
// the canvas's own pager uses, via `buildDrifts`). Selecting a drift here
// pans the canvas live to it (no `noPan` — unlike the canvas's own pager,
// the point here *is* to watch the element move into view while your
// attention is on this modal) and highlights it there in real time.
// "Mark Resolved" accepts Incoming for any undecided property and advances
// to the next un-resolved drift automatically.
function DriftReviewSection({ item, resolutions, onResolveDiff, onActiveChange }) {
  const { requestMergeFocus } = useWorkspace()
  const frame = item.hasDesign ? canvasPages.find((p) => p.id === item.designPageId)?.frames[0] : null
  const drifts = useMemo(() => buildDrifts(item, frame), [item, frame])
  const [index, setIndex] = useState(0)
  // The drift being reviewed drives the staging preview's spotlight.
  useEffect(() => {
    onActiveChange?.(drifts[index] ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, drifts])
  const [resolvedIds, setResolvedIds] = useState(() => new Set())

  const isDriftResolved = (d) =>
    resolvedIds.has(d.id) || (d.kind === 'design' && d.diffs.every((diff) => resolutions[`${d.layerId}:${diff.id}`]))
  const resolvedCount = drifts.filter(isDriftResolved).length

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
    setIndex(next)
    focusDrift(drifts[next])
  }

  // No auto-focus on mount: opening the wizard (or reaching this step) must
  // leave the canvas exactly where the user put it. The canvas only moves
  // when they explicitly step through drifts with < >.

  function markResolved(d) {
    if (d.kind === 'design') {
      for (const diff of d.diffs) {
        if (!resolutions[`${d.layerId}:${diff.id}`]) onResolveDiff(d.layerId, diff.id, 'B')
      }
    }
    setResolvedIds((prev) => new Set(prev).add(d.id))
    const nextUnresolved = drifts.findIndex((x, i) => i > index && !isDriftResolved(x))
    if (nextUnresolved >= 0) goTo(nextUnresolved)
    else if (index < drifts.length - 1) goTo(index + 1)
  }

  if (!drifts.length) return null
  const d = drifts[index]
  const resolved = isDriftResolved(d)

  return (
    <section>
      {/* Flat: a label row, the drift's title with its pager, then one
          hairline-divided row per property — no card, no inner boxes. */}
      <div className="mb-3 flex items-center gap-2">
        <p className="text-xs font-medium text-slate-300">Review drifts</p>
        <span className={cn('ml-auto text-xs tabular-nums', resolvedCount === drifts.length ? 'font-medium text-emerald-300' : 'text-slate-400')}>
          {resolvedCount}/{drifts.length} resolved
        </span>
      </div>

      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-white">{d.label}</p>
        <span className="shrink-0 text-xs text-slate-500 tabular-nums">
          {index + 1} of {drifts.length}
        </span>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            title="Previous drift"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            className="flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            title="Next drift"
            onClick={() => goTo(index + 1)}
            disabled={index === drifts.length - 1}
            className="flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {d.kind === 'design' ? (
        <ul className="mt-2 divide-y divide-white/[0.06]">
          {d.diffs.map((diff) => {
            const side = resolutions[`${d.layerId}:${diff.id}`]
            const choice = (id, text) => (
              <button
                type="button"
                aria-pressed={side === id}
                onClick={() => onResolveDiff(d.layerId, diff.id, id)}
                className={cn(
                  'h-7 min-w-0 truncate rounded-full px-3 text-[13px] transition-colors',
                  side === id ? 'bg-white/[0.1] font-medium text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                )}
              >
                {text}
              </button>
            )
            return (
              <li key={diff.id} className="flex items-center gap-2 py-2">
                <span className="w-28 shrink-0 truncate text-[13px] text-slate-400">{diff.label}</span>
                <span className="flex min-w-0 flex-1 items-center gap-1">
                  {choice('A', `Original · ${diff.optionA}`)}
                  {choice('B', `Current · ${diff.optionB}`)}
                </span>
                {isCustomResolution(side) && <span className="shrink-0 truncate text-[13px] font-medium text-emerald-300">Edited · {side.custom}</span>}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-2 text-[13px] text-slate-400">
          {openFiles.find((f) => f.id === d.fileId)?.name} · line {d.line} — reviewed in the code output below.
        </p>
      )}

      <div className="mt-3 flex justify-end">
        {resolved ? (
          <span className="flex h-8 items-center gap-1.5 text-[13px] font-medium text-emerald-300">
            <Check className="size-4" />
            Resolved
          </span>
        ) : (
          <button
            type="button"
            onClick={() => markResolved(d)}
            className="flex h-8 items-center gap-1.5 rounded-full bg-white/[0.07] px-3.5 text-[13px] font-medium text-slate-100 transition-colors hover:bg-white/[0.12]"
          >
            <Check className="size-4" />
            Mark resolved
          </button>
        )}
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
function CheckStep({ item, resolutions, summary }) {
  const [conflictOpen, setConflictOpen] = useState(false)
  const a = assessMerge(item, resolutions, summary)
  const passed = a.checks.filter((c) => c.ok).length
  const attention = a.checks.length - passed

  if (conflictOpen) {
    return <ConflictResolver item={item} onBack={() => setConflictOpen(false)} onResolved={() => setConflictOpen(false)} />
  }

  const metrics = [
    { id: 'consistency', value: `${a.consistency}`, unit: '%', label: 'Token consistency' },
    { id: 'screens', value: a.screens.length, label: a.screens.length === 1 ? 'Screen impacted' : 'Screens impacted' },
    { id: 'breaking', value: a.breaking.length, label: a.breaking.length === 1 ? 'Breaking change' : 'Breaking changes', tag: `${a.risk} risk`, tone: RISK_TONE[a.risk] },
    { id: 'checks', value: passed, of: a.checks.length, label: 'Checks passed' },
  ]
  const groups = [...new Set(a.checks.map((c) => c.group))]

  return (
    <div className="space-y-8">
      <div>
        <p className="text-base font-semibold text-white">Merge impact</p>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
          <span className={cn('font-medium', RISK_TONE[a.risk])}>{a.risk} risk</span>
          {' · '}
          {attention ? `${attention} of ${a.checks.length} checks need attention` : 'All automated checks pass'}
          {' · '}
          {a.drifts.length} drift{a.drifts.length === 1 ? '' : 's'} across {a.codeFiles} file{a.codeFiles === 1 ? '' : 's'}
        </p>
      </div>

      {/* Headline numbers: primary figures, secondary labels, hairline
          dividers — no per-metric boxes. */}
      <dl className="grid grid-cols-4 divide-x divide-white/[0.08]">
        {metrics.map((m) => (
          <div key={m.id} className="min-w-0 px-4 first:pl-0">
            <dd className="flex items-baseline gap-0.5 text-2xl leading-none font-semibold text-white tabular-nums">
              {m.value}
              {m.unit && <span className="text-base font-medium text-slate-400">{m.unit}</span>}
              {m.of != null && <span className="text-sm font-medium text-slate-500">/{m.of}</span>}
            </dd>
            <dt className="mt-1.5 text-xs leading-snug text-slate-400">{m.label}</dt>
            {m.tag && <p className={cn('mt-0.5 text-xs font-medium', m.tone)}>{m.tag}</p>}
          </div>
        ))}
      </dl>

      {/* Screen impact. */}
      <section>
        <p className="mb-2 text-xs font-medium text-slate-300">Impact</p>
        <ul className="divide-y divide-white/[0.06]">
          {a.screens.map((sc) => (
            <li key={sc.name} className="flex items-center gap-3 py-2.5">
              <Palette className="size-4 shrink-0 text-slate-500" />
              <span className="min-w-0 flex-1 truncate text-sm text-slate-100">{sc.name}</span>
              <span className="shrink-0 text-xs text-slate-400 tabular-nums">
                {sc.elements} element{sc.elements === 1 ? '' : 's'} · {sc.props} propert{sc.props === 1 ? 'y' : 'ies'}
              </span>
            </li>
          ))}
          {a.codeFiles > 0 && (
            <li className="flex items-center gap-3 py-2.5">
              <Code2 className="size-4 shrink-0 text-slate-500" />
              <span className="min-w-0 flex-1 truncate text-sm text-slate-100">Code</span>
              <span className="shrink-0 text-xs text-slate-400 tabular-nums">
                {a.codeFiles} file{a.codeFiles === 1 ? '' : 's'}
              </span>
            </li>
          )}
        </ul>
      </section>

      {/* Automated checks, grouped; what needs attention reads brighter
          and carries its hint. */}
      {groups.map((g) => (
        <section key={g}>
          <p className="mb-3 text-xs font-medium text-slate-300">{g}</p>
          <ul className="space-y-3">
            {a.checks
              .filter((c) => c.group === g)
              .map((c) => (
                <li key={c.id} className="flex items-start gap-3">
                  {c.ok ? <CheckCircle2 className="mt-px size-[18px] shrink-0 text-emerald-400" /> : <TriangleAlert className="mt-px size-[18px] shrink-0 text-amber-300" />}
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm', c.ok ? 'text-slate-300' : 'font-medium text-white')}>{c.title}</span>
                    {c.hint && <span className="mt-0.5 block text-[13px] leading-relaxed text-slate-400">{c.hint}</span>}
                  </span>
                  {c.action === 'resolve' && (
                    <button
                      type="button"
                      onClick={() => setConflictOpen(true)}
                      className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-emerald-400 pr-2.5 pl-3.5 text-xs font-semibold text-slate-950 shadow-md shadow-emerald-500/25 transition-colors hover:bg-emerald-300"
                    >
                      Resolve
                      <ArrowRight className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

// ----- Step 2: Preview -------------------------------------------------
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

// Component macro zoom: renders the frame at full resolution, then crops
// and scales it onto one element (with a little surrounding context), so
// its exact padding / radius / spacing can be inspected. The crop is
// measured from where the element actually renders (offsets are in frame
// units, unaffected by the zoom transform), so size changes are framed
// correctly. Glides between elements as the drift changes.
const ZOOM_H = 176
const ZOOM_PAD = 20
const ZOOM_MAX = 4

function MacroZoom({ frame, layerId, overrideFor, label, emphasized, height = ZOOM_H }) {
  const viewRef = useRef(null)
  const frameRef = useRef(null)
  const [view, setView] = useState(null)
  useLayoutEffect(() => {
    const vp = viewRef.current
    const el = frameRef.current?.querySelector(`[data-layer-id="${CSS.escape(layerId)}"]`)
    if (!vp || !el) return
    const box = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }
    const W = vp.clientWidth
    const k = Math.min(W / (box.w + ZOOM_PAD * 2), height / (box.h + ZOOM_PAD * 2), ZOOM_MAX)
    const next = { k, tx: W / 2 - (box.x + box.w / 2) * k, ty: height / 2 - (box.y + box.h / 2) * k, box }
    if (!view || ['k', 'tx', 'ty'].some((key) => Math.abs(view[key] - next[key]) > 0.01) || ['w', 'h'].some((key) => view.box[key] !== next.box[key])) setView(next)
  })

  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 flex items-center gap-2 text-xs">
        <span className={cn('font-medium', emphasized ? 'text-white' : 'text-slate-400')}>{label}</span>
        {view && <span className="ml-auto text-[11px] text-slate-500 tabular-nums">{view.k.toFixed(1)}×</span>}
      </figcaption>
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
        {/* The element's exact bounds, as a thin mint outline. */}
        {view && (
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-[2px] ring-1 ring-emerald-500/80 transition-all duration-300 ease-out"
            style={{ left: view.tx + view.box.x * view.k - 2, top: view.ty + view.box.y * view.k - 2, width: view.box.w * view.k + 4, height: view.box.h * view.k + 4 }}
          />
        )}
      </div>
    </figure>
  )
}

// Staging view of the combined result: the Current Implementation with every
// resolved option and applied AI edit baked in, next to the merged code
// (incoming lines + AI edits, with hand-edited lines taking precedence).
function PreviewStep({ item, resolutions, annotations, preset, assemblies = {}, extraLayers = [], manualCode = {}, onResolveDiff }) {
  const { getFileLines } = useWorkspace()
  const files = openFiles.filter((f) => item.fileIds?.includes(f.id))
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

  const overrides = {}
  // Undecided options default to the Current Implementation's value.
  for (const [layerId, diffs] of Object.entries(layerDiffs)) {
    for (const diff of diffs) {
      overrides[layerId] = mergeEffect(overrides[layerId], yieldToExact(diffEffect(diff, resolutions[`${layerId}:${diff.id}`] ?? 'B'), assemblies[layerId]))
    }
  }
  for (const a of annotations) {
    if (!a.effect) continue
    for (const t of a.targets ?? []) overrides[t] = mergeEffect(overrides[t], a.effect)
  }

  for (const [layerId, a] of Object.entries(assemblies)) {
    const layer = frame?.layers.find((l) => l.id === layerId)
    const o = layer && assemblyToOverride(a, layer)
    if (o) overrides[layerId] = mergeOverride(overrides[layerId], o)
  }
  for (const [layerId, o] of Object.entries(codeOverrides(item.id, frame, manualCode, getFileLines))) {
    overrides[layerId] = mergeOverride(overrides[layerId], o)
  }
  if (preset) overrides[preset.layerId] = mergeEffect(overrides[preset.layerId], { className: preset.previewClass })

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
    <div className="space-y-7">
      {/* Drift-by-drift review sits with the preview it changes. */}
      <DriftReviewSection item={item} resolutions={resolutions} onResolveDiff={onResolveDiff} onActiveChange={setSpot} />

      {/* Staging preview: a plain heading (no banner), then the two outputs
          side by side, captioned lightly — no competing borders. */}
      <section className="border-t border-white/[0.06] pt-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-white">Staging preview</p>
            <p className="mt-0.5 text-[13px] text-slate-400">The combined result that will be merged.</p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-xs font-medium text-emerald-300">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
            Live
          </span>
        </div>

        {/* Component macro zoom: the drift's element, cropped and scaled
            up, Original Design next to the merged result. */}
        {frame && spotLayer ? (
          <div className="mb-6">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-slate-300">
              <Palette className="size-3.5 text-slate-500" />
              {spotLayer.name}
            </p>
            {/* Wide elements (bars, headings) stack the two panels so each
                gets the full width instead of shrinking below 1×. */}
            <div className={cn('grid gap-3', wideSpot ? 'grid-cols-1' : 'grid-cols-2')}>
              <MacroZoom frame={frame} layerId={spotLayer.id} overrideFor={originalOverride} label="Original Design" height={wideSpot ? 112 : ZOOM_H} />
              <MacroZoom frame={frame} layerId={spotLayer.id} overrideFor={mergedOverride} label="Merged result" emphasized height={wideSpot ? 112 : ZOOM_H} />
            </div>
          </div>
        ) : (
          frame && <p className="mb-6 text-[13px] text-slate-400">This drift has no design element — its change is in the code below.</p>
        )}

        <div>
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-1.5">
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
                      'h-6 shrink-0 rounded-full px-2.5 text-xs font-medium transition-colors',
                      f.id === activeFile?.id ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:text-slate-200'
                    )}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>
            {/* One faint tint for readability — no border, no header strip;
                changed lines keep the mint edge marker. */}
            <div ref={codeRef} className="relative max-h-64 overflow-auto rounded-lg bg-white/[0.025] py-2 font-mono text-xs leading-relaxed">
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
          </div>
        </div>
      </section>
    </div>
  )
}

// ----- Step 3: Review --------------------------------------------------
function ReviewerSection({ reviewers, setReviewers, needCode, needDesign }) {
  function togglePerson(id) {
    setReviewers((prev) => {
      const next = { ...prev }
      if (next[id]) delete next[id]
      else next[id] = ['code', 'design']
      return next
    })
  }

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

  const byScope = (scope) => allPeople.filter((p) => reviewers[p.id]?.includes(scope)).map((p) => p.name)
  const codeNames = byScope('code')
  const designNames = byScope('design')

  return (
    <section>
      <SectionTitle>Reviewers</SectionTitle>

      {/* Who reviews what — two plain lines, no boxes. */}
      <dl className="mb-3 grid grid-cols-2 gap-5">
        {[
          ['code', 'Code review', codeNames, needCode],
          ['design', 'Design review', designNames, needDesign],
        ].map(([scope, label, names, needed]) => (
          <div key={scope} className="min-w-0">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className={cn('mt-0.5 truncate text-[13px]', names.length ? 'text-white' : needed ? 'text-amber-300' : 'text-slate-500')}>
              {names.length ? names.join(', ') : needed ? 'Needs at least one reviewer' : 'Not required'}
            </dd>
          </div>
        ))}
      </dl>

      {/* People: hairline-divided rows; selecting one reveals its review
          scopes. */}
      <ul className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
        {allPeople.map((person) => {
          const scopes = reviewers[person.id]
          const selected = Boolean(scopes)
          return (
            <li key={person.id} className="flex h-12 items-center gap-3">
              <button type="button" onClick={() => togglePerson(person.id)} aria-pressed={selected} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-[4px] ring-1 ring-inset transition-colors',
                    selected ? 'bg-emerald-400 ring-emerald-400' : 'ring-white/25'
                  )}
                >
                  {selected && <Check strokeWidth={3.5} className="size-2.5 text-slate-950" />}
                </span>
                <Avatar size="sm">
                  <AvatarFallback className={cn('text-[9px] font-semibold text-white', person.colorClass)}>{person.initials}</AvatarFallback>
                </Avatar>
                <span className={cn('text-sm', selected ? 'font-medium text-white' : 'text-slate-200')}>{person.name}</span>
                <span className="truncate text-[13px] text-slate-500">{person.role}</span>
              </button>
              {selected &&
                ['code', 'design'].map((scope) => {
                  const on = scopes.includes(scope)
                  const meta = scopeMeta[scope]
                  return (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => toggleScope(person.id, scope)}
                      aria-pressed={on}
                      title={`${on ? 'Remove' : 'Add'} ${meta.label.toLowerCase()} review`}
                      className={cn(
                        'flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium transition-colors',
                        on ? 'bg-emerald-400/15 text-emerald-300' : 'text-slate-500 hover:bg-white/[0.05] hover:text-slate-300'
                      )}
                    >
                      <meta.icon className="size-3" />
                      {meta.label}
                    </button>
                  )
                })}
            </li>
          )
        })}
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

// The full flow (Compare, then the wizard's Check → Preview → Review) —
// shown only on the canvas's top stepper; the modal's footer uses it for
// "Step N of 4". The flow ends at Review with a PR + review request; there
// is no deploy step (deploying unapproved changes isn't possible here).
const DISPLAY_STEPS = [{ id: 'compare', label: 'Compare' }, ...WIZARD_STEPS]


// The "Merge Changes" wizard: Check -> Preview -> Review -> Deploy. Rendered
// only while open (the parent mounts it per click), so every session starts
// fresh. `onStepChange` lets the canvas header stepper mirror the stage.
function MergeExecutionModal({ item, resolutions, annotations, preset, assemblies, extraLayers, manualCode = {}, onResolveDiff, initialStep = 0, onStepChange, onClose, onComplete }) {
  const summary = useMemo(() => buildSummary(item, resolutions, annotations, preset, assemblies, extraLayers, manualCode), [item, resolutions, annotations, preset, assemblies, extraLayers, manualCode])
  const branch = `merge/${slugify(item.title)}`
  const [step, setStep] = useState(initialStep)
  const [run, setRun] = useState('idle') // idle | progress | success (Deploy step)
  const [progress, setProgress] = useState(0)
  const [reviewers, setReviewers] = useState({ james: ['code'], min: ['design'] })
  const [commit, setCommit] = useState(`merge: ${item.title}`)
  const [prTitle, setPrTitle] = useState(`Merge: ${item.title}`)
  const [prBody, setPrBody] = useState('')
  const [deploy, setDeploy] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [prNumber] = useState(() => 100 + Math.floor(Math.random() * 90))

  // Free dragging: starts at the default docked spot (top-[60px]/right-6, via
  // CSS) until the user first drags the header, after which `pos` takes
  // over as an explicit viewport-relative left/top (the dialog is `fixed`,
  // so plain client coordinates work with no container/offset math needed).
  const [pos, setPos] = useState(null)
  function handleHeaderPointerDown(event) {
    if (event.button !== 0 || event.target.closest('button, a, input, textarea')) return
    const content = event.currentTarget.closest('[data-slot="dialog-content"]')
    if (!content) return
    event.preventDefault()
    const rect = content.getBoundingClientRect()
    const startX = event.clientX
    const startY = event.clientY
    const startLeft = rect.left
    const startTop = rect.top
    // Suppress text selection for the drag's duration — without this,
    // a fast drag starting on the title/branch text selects it instead of
    // tracking the cursor smoothly, which reads as the drag "sticking".
    const prevUserSelect = document.body.style.userSelect
    document.body.style.userSelect = 'none'
    function onMove(m) {
      setPos({
        left: Math.min(Math.max(8, startLeft + m.clientX - startX), window.innerWidth - rect.width - 8),
        top: Math.min(Math.max(WIZARD_TOP, startTop + m.clientY - startY), window.innerHeight - 60),
      })
    }
    function onUp() {
      document.body.style.userSelect = prevUserSelect
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const needCode = summary.files.length > 0
  const needDesign = item.hasDesign
  const hasScope = (scope) => Object.values(reviewers).some((s) => s.includes(scope))
  const reviewersOk = (!needCode || hasScope('code')) && (!needDesign || hasScope('design'))
  const reviewerIds = Object.keys(reviewers)
  const reviewerNames = reviewerIds.map((id) => allPeople.find((p) => p.id === id)?.name).filter(Boolean)
  const scopeNames = (scope) => allPeople.filter((p) => reviewers[p.id]?.includes(scope)).map((p) => p.name)
  const reviewValid = reviewersOk && commit.trim() && prTitle.trim()

  useEffect(() => {
    onStepChange?.(WIZARD_STEPS[step].id)
  }, [step, onStepChange])

  useEffect(() => {
    if (run !== 'progress') return
    const timer = setInterval(() => setProgress((s) => s + 1), 750)
    return () => clearInterval(timer)
  }, [run])

  useEffect(() => {
    if (run === 'progress' && progress >= PROGRESS_STEPS.length) {
      setRun('success')
      onComplete()
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
  const canNext = step === 2 ? reviewValid : true

  return (
    // No overlay / blur and non-modal: the canvas stays sharp and visible
    // behind the wizard, which docks to the right.
    <Dialog open modal={false} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent
        overlay={false}
        showCloseButton={!busy}
        style={pos ? { left: pos.left, top: pos.top, right: 'auto' } : undefined}
        className={cn(
          'flex max-h-[calc(100vh-76px)] translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-3xl p-0 shadow-2xl sm:max-w-2xl',
          // Default dock: `top-[60px]` — the same line as the Block Deck and
          // Merge List — so it opens below the studio's top toolbar row
          // (stepper, avatars, Preview) and never covers it; dragging
          // can't lift it above that line either. Docked toward the
          // *right* so it sits clear of the central code comparison /
          // artboards instead of covering them — free dragging (see `pos`
          // above) takes over as soon as the user drags the header.
          !pos && 'top-[60px] right-6 left-auto'
        )}
      >
        <DialogHeader
          onPointerDown={handleHeaderPointerDown}
          className="shrink-0 cursor-grab gap-1.5 border-b px-6 py-5 active:cursor-grabbing"
        >
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="flex size-7 items-center justify-center rounded-full bg-emerald-400 text-slate-950">
              <GitPullRequest className="size-3.5" />
            </span>
            {run === 'success' ? 'Review requested' : 'Merge changes'}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-sm">
            <GitBranch className="size-3.5" />
            {branch} → main
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {run === 'idle' && step === 0 && <CheckStep item={item} resolutions={resolutions} summary={summary} />}
          {run === 'idle' && step === 1 && <PreviewStep item={item} resolutions={resolutions} annotations={annotations} preset={preset} assemblies={assemblies} extraLayers={extraLayers} manualCode={manualCode} onResolveDiff={onResolveDiff} />}

          {run === 'idle' && step === 2 && (
            <div className="space-y-7">
              {/* What will actually be merged, before assigning reviewers. */}
              <SummarySection summary={summary} />
              <ReviewerSection reviewers={reviewers} setReviewers={setReviewers} needCode={needCode} needDesign={needDesign} />

              <section>
                <SectionTitle
                  aside={
                    <button
                      type="button"
                      onClick={generateWithAi}
                      disabled={generating}
                      className="flex h-7 items-center justify-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-xs font-medium text-slate-200 transition-colors hover:bg-white/[0.1] hover:text-white disabled:opacity-60"
                    >
                      {generating ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                      {generating ? 'Generating…' : 'Generate with AI'}
                    </button>
                  }
                >
                  Commit &amp; PR
                </SectionTitle>
                {/* Compact form: 32px single-line fields; the description
                    starts at 3 lines and grows with its content (capped). */}
                <div className="space-y-3">
                  <label className="block">
                    <span className={FIELD_LABEL}>Commit message</span>
                    <input value={commit} onChange={(e) => setCommit(e.target.value)} className={cn(FIELD, 'h-8 font-mono text-[12px]')} />
                  </label>
                  <label className="block">
                    <span className={FIELD_LABEL}>PR title</span>
                    <input value={prTitle} onChange={(e) => setPrTitle(e.target.value)} className={cn(FIELD, 'h-8 text-[13px]')} />
                  </label>
                  <label className="block">
                    <span className={FIELD_LABEL}>PR description</span>
                    <textarea
                      value={prBody}
                      onChange={(e) => setPrBody(e.target.value)}
                      rows={3}
                      placeholder="Describe this merge, or use Generate with AI…"
                      className={cn(FIELD, 'max-h-40 min-h-[4.5rem] resize-none py-1.5 text-[13px] leading-relaxed [field-sizing:content]')}
                    />
                  </label>
                  <label className="flex items-center gap-3 border-t border-white/[0.06] pt-3 text-[13px]">
                    <Rocket className="size-4 shrink-0 text-slate-500" />
                    <span className="flex-1 text-slate-200">Deploy automatically once approved and merged</span>
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

        <div className="flex shrink-0 items-center justify-end gap-2 border-t px-6 py-4">
          {run === 'success' ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-5 h-10 text-sm font-semibold text-slate-950"
            >
              Done
            </button>
          ) : (
            <>
              {step === 2 && !reviewValid ? (
                <span className="mr-auto text-[13px] text-amber-500">
                  {!reviewersOk ? 'Assign at least one Code and one Design reviewer.' : 'Commit message and PR title are required.'}
                </span>
              ) : (
                <span className="mr-auto text-[13px] text-muted-foreground tabular-nums">
                  Step {step + 2} of {DISPLAY_STEPS.length} · {WIZARD_STEPS[step].label}
                </span>
              )}
              {step === 0 ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center gap-1 rounded-full px-4 h-10 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ChevronLeft className="size-4" />
                  Back to Compare
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStep((s) => s - 1)}
                  className="flex items-center justify-center gap-1 rounded-full px-4 h-10 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" />
                  Back
                </button>
              )}
              {!last ? (
                <button
                  type="button"
                  disabled={!canNext}
                  onClick={() => setStep((s) => s + 1)}
                  className="flex items-center justify-center gap-1.5 rounded-full bg-slate-700 px-4 h-10 text-sm font-semibold text-white transition-colors hover:bg-slate-600 disabled:opacity-40"
                >
                  Continue to {WIZARD_STEPS[step + 1].label}
                  <ArrowRight className="size-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy || !reviewValid}
                  onClick={() => {
                    setProgress(0)
                    setRun('progress')
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-full bg-emerald-400 px-4 h-10 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition-all hover:brightness-110 disabled:opacity-40"
                >
                  <GitPullRequest className="size-4" />
                  Open PR &amp; Request Review
                </button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default MergeExecutionModal
