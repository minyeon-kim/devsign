import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  GitBranch,
  GitPullRequest,
  ListChecks,
  Loader2,
  MessageSquare,
  Palette,
  Rocket,
  Send,
  Sparkles,
  TriangleAlert,
  MonitorPlay,
} from 'lucide-react'
import { cn } from 'cn'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { allPeople, canvasPages, codeMergeVariants, designMergeVariants, openFiles } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { buildDrifts, buildSummary } from '@/components/mergestudio/mergeSummary'
import ConflictResolutionModal from '@/components/mergestudio/ConflictResolutionModal'
import { codeOverrides } from '@/components/mergestudio/codeSync'
import { isSecondaryLayer } from '@/components/mergestudio/mockupContent'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { assemblyToOverride, diffEffect, frameWithLayers, isCustomResolution, mergeOverride, yieldToExact } from '@/components/mergestudio/mergeEffects'

const PROGRESS_STEPS = [
  { label: 'Committing changes', icon: GitBranch },
  { label: 'Opening pull request', icon: GitPullRequest },
  { label: 'Requesting team reviews', icon: Send },
  { label: 'Starting GitHub Actions deployment', icon: Rocket },
]

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function SectionTitle({ icon: Icon, children, aside }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="size-4 text-indigo-500" />
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</h3>
      {aside && <span className="ml-auto">{aside}</span>}
    </div>
  )
}

function SummarySection({ summary }) {
  return (
    <section>
      <SectionTitle icon={Sparkles}>What will be merged</SectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-slate-800/70 p-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Palette className="size-4 text-violet-500" />
            Design
          </p>
          {summary.design.length ? (
            <ul className="space-y-2">
              {summary.design.map((d) => (
                <li key={d.key} className="text-[13px] leading-snug">
                  <span className="text-foreground">{d.text}</span>
                  <span className="block text-muted-foreground">{d.choice}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted-foreground">No variant options resolved.</p>
          )}
        </div>

        <div className="rounded-2xl border bg-slate-800/70 p-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Code2 className="size-4 text-violet-500" />
            Code
          </p>
          {summary.files.length ? (
            <ul className="space-y-2">
              {summary.files.map((f) => (
                <li key={f.id} className="text-[13px] leading-snug">
                  <span className="text-foreground">{f.name}</span>
                  <span className="block text-muted-foreground">
                    {f.changed} incoming line{f.changed === 1 ? '' : 's'}
                    {f.aiLines > 0 && ` · ${f.aiLines} AI edit${f.aiLines === 1 ? '' : 's'}`}
                    {f.manualLines > 0 && ` · ${f.manualLines} manual edit${f.manualLines === 1 ? '' : 's'}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted-foreground">No code files.</p>
          )}
        </div>

        <div className="rounded-2xl border bg-slate-800/70 p-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <MessageSquare className="size-4 text-violet-500" />
            AI annotations
          </p>
          {summary.applied.length ? (
            <ul className="space-y-2">
              {summary.applied.map((a) => (
                <li key={a.id} className="text-[13px] leading-snug">
                  <span className="text-foreground">“{a.text}”</span>
                  <span className="block text-muted-foreground">{a.summary}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted-foreground">No AI edits applied.</p>
          )}
          {summary.pending > 0 && (
            <p className="mt-2 flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-[13px] font-medium text-amber-500">
              <TriangleAlert className="size-3 shrink-0" />
              {summary.pending} note{summary.pending === 1 ? '' : 's'} not applied
            </p>
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
  { id: 'deploy', label: 'Deploy' },
]

const scopeMeta = {
  code: { label: 'Code', icon: Code2, className: 'bg-indigo-500 text-white', idle: 'text-indigo-400 ring-1 ring-indigo-500/40' },
  design: { label: 'Design', icon: Palette, className: 'bg-violet-500 text-white', idle: 'text-violet-400 ring-1 ring-violet-500/40' },
}

function ScopeBadge({ scope }) {
  const meta = scopeMeta[scope]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', meta.className)}>
      <meta.icon className="size-3" />
      {meta.label} review
    </span>
  )
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
function DriftReviewSection({ item, resolutions, onResolveDiff }) {
  const { requestMergeFocus } = useWorkspace()
  const frame = item.hasDesign ? canvasPages.find((p) => p.id === item.designPageId)?.frames[0] : null
  const drifts = useMemo(() => buildDrifts(item, frame), [item, frame])
  const [index, setIndex] = useState(0)
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

  // Land on the first drift as soon as there's something to review, so the
  // canvas is already pointing at it before the user touches < >.
  useEffect(() => {
    if (drifts.length) focusDrift(drifts[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

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
      <SectionTitle
        icon={ListChecks}
        aside={
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', resolvedCount === drifts.length ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-muted-foreground')}>
            {resolvedCount}/{drifts.length} resolved
          </span>
        }
      >
        Review Drifts
      </SectionTitle>

      <div className="rounded-2xl border bg-slate-800/70 p-4">
        <div className="mb-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-0 flex-1 truncate text-center text-sm font-medium text-foreground">
            Drift {index + 1}/{drifts.length} · {d.label}
          </span>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            disabled={index === drifts.length - 1}
            className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {d.kind === 'design' ? (
          <div className="space-y-2">
            {d.diffs.map((diff) => {
              const side = resolutions[`${d.layerId}:${diff.id}`]
              return (
                <div key={diff.id} className="flex items-center gap-2 rounded-xl bg-background/40 p-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{diff.label}</span>
                  <button
                    type="button"
                    onClick={() => onResolveDiff(d.layerId, diff.id, 'A')}
                    className={cn('shrink-0 truncate rounded-full px-2.5 py-1 text-[13px]', side === 'A' ? 'bg-slate-600 text-white' : 'bg-slate-700 text-muted-foreground hover:text-foreground')}
                  >
                    Original · {diff.optionA}
                  </button>
                  <button
                    type="button"
                    onClick={() => onResolveDiff(d.layerId, diff.id, 'B')}
                    className={cn('shrink-0 truncate rounded-full px-2.5 py-1 text-[13px]', side === 'B' ? 'bg-slate-600 text-white' : 'bg-slate-700 text-muted-foreground hover:text-foreground')}
                  >
                    Current · {diff.optionB}
                  </button>
                  {isCustomResolution(side) && (
                    <span className="shrink-0 truncate rounded-full bg-violet-500/20 px-2.5 py-1 text-[13px] text-violet-200">
                      Edited · {side.custom}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="rounded-xl bg-background/40 p-2 text-sm text-muted-foreground">
            {openFiles.find((f) => f.id === d.fileId)?.name} · line {d.line} — reviewed in the unified diff view.
          </p>
        )}

        <button
          type="button"
          onClick={() => markResolved(d)}
          disabled={resolved}
          className={cn(
            'mt-3 flex w-full items-center justify-center gap-1.5 rounded-full px-3 h-9 text-sm font-semibold transition-colors',
            resolved ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-white hover:bg-slate-600'
          )}
        >
          <Check className="size-4" />
          {resolved ? 'Resolved' : 'Mark Resolved'}
        </button>
      </div>
    </section>
  )
}

// Step 1 is only about readiness: can this be merged, and what must be
// fixed first. It leads with one status headline and a compact row of the
// key numbers; a merge conflict (the one thing worth stopping for) gets a
// distinct "Action required" card with the primary action; everything else
// is a quiet list of notes. The drift-by-drift review lives in Preview and
// the full "what will be merged" breakdown in Review.
function CheckStep({ item, resolutions, summary }) {
  // Conflict resolution opens from here — the pre-merge check is where a
  // flagged conflict matters (the Merge List cards show it as a tag only).
  const [conflictOpen, setConflictOpen] = useState(false)
  const frame = item.hasDesign ? canvasPages.find((p) => p.id === item.designPageId)?.frames[0] : null
  const drifts = buildDrifts(item, frame)
  const totalDiffs = Object.values(designMergeVariants[item.id]?.layerDiffs ?? {}).reduce((n, d) => n + d.length, 0)
  const decided = Math.min(Object.keys(resolutions).length, totalDiffs)
  const undecided = totalDiffs - decided
  const hasConflict = item.conflictLevel && item.conflictLevel !== 'None'
  const conflictTone = item.conflictLevel === 'High' ? 'border-destructive/40 bg-destructive/10' : 'border-amber-500/40 bg-amber-500/10'

  const notes = [
    !hasConflict && { id: 'conflict', ok: true, text: 'No merge conflicts' },
    totalDiffs > 0 &&
      (undecided === 0
        ? { id: 'options', ok: true, text: `All ${totalDiffs} design options decided` }
        : { id: 'options', ok: false, text: `${undecided} design option${undecided === 1 ? '' : 's'} undecided`, hint: 'They’ll use the Current Implementation — review them in Preview.' }),
    summary.pending === 0
      ? { id: 'ai', ok: true, text: summary.applied.length ? `${summary.applied.length} AI edit${summary.applied.length === 1 ? '' : 's'} applied` : 'No pending AI notes' }
      : { id: 'ai', ok: false, text: `${summary.pending} AI note${summary.pending === 1 ? '' : 's'} not applied`, hint: 'Use “Apply with AI” on the canvas to include them.' },
  ].filter(Boolean)
  const openNotes = notes.filter((n) => !n.ok).length

  const metrics = [
    [`${summary.files.length}`, summary.files.length === 1 ? 'file' : 'files'],
    [`${drifts.length}`, drifts.length === 1 ? 'drift' : 'drifts'],
    [`${decided}/${totalDiffs}`, 'decided'],
    [`${summary.applied.length}`, summary.applied.length === 1 ? 'AI edit' : 'AI edits'],
  ]

  return (
    <div className="space-y-5">
      {/* Status headline + key numbers. */}
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full',
              hasConflict ? 'bg-amber-500/15 text-amber-500' : 'bg-emerald-500/15 text-emerald-400'
            )}
          >
            {hasConflict ? <TriangleAlert className="size-4" /> : <Check className="size-4" />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {hasConflict ? 'Resolve the conflict first' : openNotes ? 'Ready to merge — a few notes' : 'Ready to merge'}
            </p>
            <p className="text-[13px] text-muted-foreground">
              {hasConflict ? 'You can still continue, but the merge may not combine cleanly.' : 'Nothing blocks this merge. Review the result in the next step.'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {metrics.map(([value, label]) => (
            <div key={label} className="rounded-xl bg-white/[0.03] px-2.5 py-2 ring-1 ring-inset ring-white/10">
              <p className="text-sm font-semibold text-foreground tabular-nums">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* The one thing to act on, when there is one. */}
      {hasConflict && (
        <section className={cn('rounded-2xl border p-3.5', conflictTone)}>
          <p className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Action required</p>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{item.conflictLevel} merge conflict</p>
              <p className="text-[13px] text-muted-foreground">Choose Current or Incoming for each conflicting block, or let AI resolve them.</p>
            </div>
            <button
              type="button"
              onClick={() => setConflictOpen(true)}
              className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-200"
            >
              Resolve conflicts
              <ArrowRight className="size-4" />
            </button>
          </div>
        </section>
      )}

      {/* Everything else: short, quiet notes. */}
      <ul className="space-y-1">
        {notes.map((n) => (
          <li key={n.id} className="flex items-start gap-2.5 rounded-xl px-1 py-1.5 text-sm">
            <span
              className={cn(
                'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full',
                n.ok ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-500'
              )}
            >
              {n.ok ? <Check className="size-3" /> : <TriangleAlert className="size-2.5" />}
            </span>
            <span className="min-w-0">
              <span className={n.ok ? 'text-muted-foreground' : 'text-foreground'}>{n.text}</span>
              {n.hint && <span className="block text-[13px] text-muted-foreground">{n.hint}</span>}
            </span>
          </li>
        ))}
      </ul>
      {conflictOpen && <ConflictResolutionModal item={item} onClose={() => setConflictOpen(false)} />}
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

// Staging view of the combined result: the Current Implementation with every
// resolved option and applied AI edit baked in, next to the merged code
// (incoming lines + AI edits, with hand-edited lines taking precedence).
function PreviewStep({ item, resolutions, annotations, preset, assemblies = {}, extraLayers = [], manualCode = {}, onResolveDiff }) {
  const { getFileLines } = useWorkspace()
  const files = openFiles.filter((f) => item.fileIds?.includes(f.id))
  const [fileId, setFileId] = useState(files[0]?.id)
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

  const previewW = 240
  const scale = frame ? previewW / frame.width : 1

  return (
    <div className="space-y-4">
      {/* Drift-by-drift review sits with the preview it changes. */}
      <DriftReviewSection item={item} resolutions={resolutions} onResolveDiff={onResolveDiff} />
      <div className="flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1.5 text-sm font-medium text-foreground">
        <MonitorPlay className="size-4 text-indigo-500" />
        Staging preview — the combined result that will be merged
        <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[13px] text-emerald-400">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
          Live
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        {frame && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
              <Palette className="size-4 text-violet-500" /> Design output
            </p>
            <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg" style={{ width: previewW, height: frame.height * scale }}>
              <div className="relative" style={{ width: frame.width, height: frame.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                {frame.layers.map((layer) => {
                  const o = overrides[layer.id]
                  const primary = layer.type === 'button' && !isSecondaryLayer(layer.id)
                  const override = o
                    ? { ...o, className: o.className ?? (primary ? 'bg-violet-500' : undefined), static: true }
                    : primary
                      ? { className: 'bg-violet-500', static: true }
                      : undefined
                  return <StaticLayer key={layer.id} layer={layer} override={override} onSelect={() => {}} />
                })}
              </div>
            </div>
          </div>
        )}

        <div className="min-w-0">
          <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
            <Code2 className="size-4 text-violet-500" /> Code output
          </p>
          <div className="overflow-hidden rounded-2xl border bg-slate-800/70">
            <div className="flex gap-0.5 overflow-x-auto border-b bg-muted/30 px-1.5 pt-1.5">
              {files.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFileId(f.id)}
                  className={cn(
                    'shrink-0 rounded-t-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                    f.id === activeFile?.id ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {f.name}
                </button>
              ))}
            </div>
            <div className="max-h-64 overflow-auto py-2 font-mono text-xs leading-relaxed">
              {lines.map((line, i) => {
                const n = i + 1
                const manual = manualCode[`${activeFile.id}:${n}`]
                const text = manual ?? (incoming.get(n) ?? line) + (aiLines.has(n) ? `  // AI: ${aiLines.get(n)}` : '')
                const changed = manual !== undefined || incoming.has(n) || aiLines.has(n)
                return (
                  <div key={i} className={cn('flex gap-3 border-l-2 px-3', changed ? 'border-violet-400' : 'border-transparent')}>
                    <span className="w-5 shrink-0 text-right text-muted-foreground/40 select-none">{n}</span>
                    <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-foreground/90">{text || ' '}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
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
      <SectionTitle icon={Send}>Reviewers</SectionTitle>

      <div className="mb-2 grid grid-cols-2 gap-2">
        {[
          ['code', codeNames, needCode],
          ['design', designNames, needDesign],
        ].map(([scope, names, needed]) => (
          <div key={scope} className="rounded-2xl border bg-slate-800/70 p-2.5">
            <ScopeBadge scope={scope} />
            <p className={cn('mt-1.5 text-[13px]', names.length ? 'text-foreground' : needed ? 'text-amber-500' : 'text-muted-foreground')}>
              {names.length ? names.join(', ') : needed ? 'Needs at least one reviewer' : 'Not required'}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        {allPeople.map((person) => {
          const scopes = reviewers[person.id]
          const selected = Boolean(scopes)
          return (
            <div
              key={person.id}
              className={cn(
                'flex items-center gap-2.5 rounded-full border py-1.5 pr-2 pl-1.5 transition-colors',
                selected ? 'border-indigo-500/60 bg-indigo-500/10' : 'border-border'
              )}
            >
              <button type="button" onClick={() => togglePerson(person.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                <Avatar size="sm">
                  <AvatarFallback className={cn('text-[9px] font-semibold text-white', person.colorClass)}>{person.initials}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-foreground">{person.name}</span>
                <span className="text-[13px] text-muted-foreground">{person.role}</span>
                {selected && <Check className="ml-auto size-3.5 shrink-0 text-indigo-500" />}
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
                      title={`${on ? 'Remove' : 'Add'} ${meta.label.toLowerCase()} review`}
                      className={cn(
                        'flex items-center justify-center gap-1 rounded-full px-2.5 h-5 text-[11px] font-semibold transition-colors',
                        on ? meta.className : cn('bg-transparent opacity-70 hover:opacity-100', meta.idle)
                      )}
                    >
                      <meta.icon className="size-3" />
                      {meta.label}
                    </button>
                  )
                })}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ProgressView({ step }) {
  return (
    <div className="flex flex-col items-center gap-5 py-6">
      <span className="flex size-12 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white">
        <Loader2 className="size-5 animate-spin" />
      </span>
      <div className="w-full max-w-sm space-y-2">
        {PROGRESS_STEPS.map((s, i) => {
          const done = i < step
          const active = i === step
          return (
            <div
              key={s.label}
              className={cn(
                'flex items-center gap-2.5 rounded-full border px-3 py-2 text-sm transition-all duration-300',
                done && 'border-emerald-500/40 bg-emerald-500/10 text-foreground',
                active && 'border-indigo-500/60 bg-indigo-500/10 text-foreground',
                !done && !active && 'border-border text-muted-foreground opacity-60'
              )}
            >
              {done ? (
                <Check className="size-3.5 text-emerald-400" />
              ) : active ? (
                <Loader2 className="size-3.5 animate-spin text-indigo-500" />
              ) : (
                <s.icon className="size-3.5" />
              )}
              {s.label}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SuccessView({ prTitle, reviewerNames, deploy, prNumber }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-8 ring-emerald-500/10">
        <CheckCircle2 className="size-7" />
      </span>
      <div>
        <p className="text-base font-semibold text-foreground">Review request sent</p>
        <p className="mt-1 text-sm text-muted-foreground">
          PR #{prNumber} “{prTitle}” is open.
        </p>
      </div>
      <div className="w-full max-w-sm space-y-2 text-left text-sm">
        <p className="flex items-center gap-2 rounded-full border px-3 py-2">
          <Send className="size-3.5 shrink-0 text-indigo-500" />
          <span className="text-foreground">Requested review from {reviewerNames.join(', ')}</span>
        </p>
        <p className="flex items-center gap-2 rounded-full border px-3 py-2">
          <Rocket className="size-3.5 shrink-0 text-violet-500" />
          <span className="text-foreground">
            {deploy ? 'GitHub Actions deployment started' : 'GitHub Actions deployment skipped'}
          </span>
          {deploy && (
            <span className="ml-auto flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-500">
              <Loader2 className="size-2.5 animate-spin" />
              Running
            </span>
          )}
        </p>
      </div>
    </div>
  )
}

// The same 5-step flow as the canvas header's stepper: Compare (always done
// by the time this opens — clicking it returns there) then the wizard's own
// Check → Preview → Review → Deploy.
const DISPLAY_STEPS = [{ id: 'compare', label: 'Compare' }, ...WIZARD_STEPS]

function WizardStepper({ step, run, onCompare }) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5">
      {DISPLAY_STEPS.map((s, i) => {
        const wizardIndex = i - 1
        const done = i === 0 || wizardIndex < step || (wizardIndex === step && run === 'success')
        const active = wizardIndex === step && run !== 'success'
        const chip = (
          <>
            {done ? <Check className="size-3.5" /> : <span className="text-[11px] opacity-80">{i + 1}</span>}
            {s.label}
          </>
        )
        const chipClass = cn(
          'flex h-7 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors',
          active && 'bg-slate-700 text-white',
          done && 'bg-emerald-500/15 text-emerald-400',
          !active && !done && 'bg-muted text-muted-foreground'
        )
        return (
          <li key={s.id} className="flex items-center gap-1.5">
            {i === 0 && onCompare && run !== 'progress' ? (
              <button type="button" title="Back to Compare" onClick={onCompare} className={cn(chipClass, 'hover:bg-emerald-500/25')}>
                {chip}
              </button>
            ) : (
              <span className={chipClass}>{chip}</span>
            )}
            {i < DISPLAY_STEPS.length - 1 && <ArrowRight className="size-3 text-muted-foreground/50" />}
          </li>
        )
      })}
    </ol>
  )
}

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
          className="shrink-0 cursor-grab gap-3.5 border-b px-6 py-5 active:cursor-grabbing"
        >
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white">
              <GitPullRequest className="size-3.5" />
            </span>
            {run === 'success' ? 'Merge in progress' : 'Merge changes'}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-sm">
            <GitBranch className="size-3.5" />
            {branch} → main
          </DialogDescription>
          <WizardStepper step={step} run={run} onCompare={busy ? undefined : onClose} />
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {step === 0 && <CheckStep item={item} resolutions={resolutions} summary={summary} />}
          {step === 1 && <PreviewStep item={item} resolutions={resolutions} annotations={annotations} preset={preset} assemblies={assemblies} extraLayers={extraLayers} manualCode={manualCode} onResolveDiff={onResolveDiff} />}

          {step === 2 && (
            <div className="space-y-7">
              {/* What will actually be merged, before assigning reviewers. */}
              <SummarySection summary={summary} />
              <ReviewerSection reviewers={reviewers} setReviewers={setReviewers} needCode={needCode} needDesign={needDesign} />

              <section>
                <SectionTitle
                  icon={GitPullRequest}
                  aside={
                    <button
                      type="button"
                      onClick={generateWithAi}
                      disabled={generating}
                      className="flex items-center justify-center gap-1 rounded-full border border-indigo-500/50 px-2.5 h-6 text-[11px] font-semibold tracking-normal text-foreground normal-case transition-colors hover:bg-indigo-500/15 disabled:opacity-60"
                    >
                      {generating ? <Loader2 className="size-3 animate-spin text-violet-500" /> : <Sparkles className="size-3 text-violet-500" />}
                      {generating ? 'Generating…' : 'Generate with AI'}
                    </button>
                  }
                >
                  Commit &amp; PR
                </SectionTitle>
                <div className="space-y-2">
                  <label className="block">
                    <span className="mb-1 block text-[13px] text-muted-foreground">Commit message</span>
                    <Input value={commit} onChange={(e) => setCommit(e.target.value)} className="rounded-full bg-slate-800 text-sm dark:bg-slate-800" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[13px] text-muted-foreground">PR title</span>
                    <Input value={prTitle} onChange={(e) => setPrTitle(e.target.value)} className="rounded-full bg-slate-800 text-sm dark:bg-slate-800" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[13px] text-muted-foreground">PR description</span>
                    <textarea
                      value={prBody}
                      onChange={(e) => setPrBody(e.target.value)}
                      rows={5}
                      placeholder="Describe this merge, or use Generate with AI…"
                      className="w-full resize-none rounded-2xl border bg-slate-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </label>
                  <label className="flex items-center gap-2 rounded-full border px-3 py-2 text-sm">
                    <Rocket className="size-4 text-violet-500" />
                    <span className="flex-1 text-foreground">Trigger GitHub Actions deployment after merge</span>
                    <Switch checked={deploy} onCheckedChange={setDeploy} />
                  </label>
                </div>
              </section>
            </div>
          )}

          {step === 3 && run === 'idle' && (
            <div className="space-y-4">
              <SectionTitle icon={Rocket}>Ready to merge &amp; deploy</SectionTitle>
              <ul className="space-y-2 text-sm">
                {/* The conflict check itself is surfaced early too (Check
                    step's Readiness section) so it can be acted on, but a
                    final go/no-go read of it belongs here as well — the
                    last checkpoint before the merge actually happens. */}
                <li className="flex items-center gap-2 rounded-2xl border bg-slate-800/70 px-4 py-3">
                  {item.conflictLevel === 'None' ? (
                    <Check className="size-4 shrink-0 text-emerald-400" />
                  ) : (
                    <TriangleAlert className="size-4 shrink-0 text-amber-500" />
                  )}
                  <span className="text-foreground">
                    {item.conflictLevel === 'None' ? 'No merge conflicts' : `${item.conflictLevel} conflict level — reviewed`}
                  </span>
                </li>
                <li className="flex items-center gap-2 rounded-2xl border bg-slate-800/70 px-4 py-3">
                  <GitBranch className="size-4 shrink-0 text-indigo-500" />
                  <span className="text-foreground">{branch} → main</span>
                </li>
                <li className="flex items-start gap-2 rounded-2xl border bg-slate-800/70 px-4 py-3">
                  <GitPullRequest className="mt-0.5 size-4 shrink-0 text-indigo-500" />
                  <span className="min-w-0">
                    <span className="block text-foreground">{prTitle}</span>
                    <span className="block truncate font-mono text-[13px] text-muted-foreground">{commit}</span>
                  </span>
                </li>
                <li className="flex flex-wrap items-center gap-2 rounded-2xl border bg-slate-800/70 px-4 py-3">
                  <Send className="size-3.5 shrink-0 text-indigo-500" />
                  <ScopeBadge scope="code" />
                  <span className="text-foreground">{scopeNames('code').join(', ') || '—'}</span>
                  <ScopeBadge scope="design" />
                  <span className="text-foreground">{scopeNames('design').join(', ') || '—'}</span>
                </li>
                <li className="flex items-center gap-2 rounded-2xl border bg-slate-800/70 px-4 py-3">
                  <Rocket className="size-3.5 shrink-0 text-violet-500" />
                  <span className="text-foreground">
                    {deploy ? 'GitHub Actions deployment will start after the PR is opened' : 'Deployment is turned off'}
                  </span>
                </li>
              </ul>
            </div>
          )}
          {step === 3 && run === 'progress' && <ProgressView step={Math.min(progress, PROGRESS_STEPS.length - 1)} />}
          {step === 3 && run === 'success' && (
            <SuccessView prTitle={prTitle} reviewerNames={reviewerNames} deploy={deploy} prNumber={prNumber} />
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t px-6 py-4">
          {run === 'success' ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-5 h-10 text-sm font-semibold text-white"
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
                  disabled={busy}
                  onClick={() => {
                    setProgress(0)
                    setRun('progress')
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-4 h-10 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:brightness-110 disabled:opacity-40"
                >
                  <Rocket className="size-4" />
                  Merge &amp; Deploy
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
