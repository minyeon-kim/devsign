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
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { assemblyToOverride, diffEffect, frameWithLayers, isCustomResolution, mergeOverride } from '@/components/mergestudio/mergeEffects'

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
    <div className="mb-2 flex items-center gap-1.5">
      <Icon className="size-4 text-indigo-500" />
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</h3>
      {aside && <span className="ml-auto">{aside}</span>}
    </div>
  )
}

function SummarySection({ summary }) {
  return (
    <section>
      <SectionTitle icon={Sparkles}>Pre-flight summary</SectionTitle>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border bg-slate-800/70 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Palette className="size-4 text-violet-500" />
            Design
          </p>
          {summary.design.length ? (
            <ul className="space-y-1.5">
              {summary.design.map((d) => (
                <li key={d.key} className="text-xs leading-snug">
                  <span className="text-foreground">{d.text}</span>
                  <span className="block text-muted-foreground">{d.choice}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No variant options resolved.</p>
          )}
        </div>

        <div className="rounded-2xl border bg-slate-800/70 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Code2 className="size-4 text-violet-500" />
            Code
          </p>
          {summary.files.length ? (
            <ul className="space-y-1.5">
              {summary.files.map((f) => (
                <li key={f.id} className="text-xs leading-snug">
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
            <p className="text-xs text-muted-foreground">No code files.</p>
          )}
        </div>

        <div className="rounded-2xl border bg-slate-800/70 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <MessageSquare className="size-4 text-violet-500" />
            AI annotations
          </p>
          {summary.applied.length ? (
            <ul className="space-y-1.5">
              {summary.applied.map((a) => (
                <li key={a.id} className="text-xs leading-snug">
                  <span className="text-foreground">“{a.text}”</span>
                  <span className="block text-muted-foreground">{a.summary}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No AI edits applied.</p>
          )}
          {summary.pending > 0 && (
            <p className="mt-2 flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-500">
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
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', meta.className)}>
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
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', resolvedCount === drifts.length ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-muted-foreground')}>
            {resolvedCount}/{drifts.length} resolved
          </span>
        }
      >
        Review Drifts
      </SectionTitle>

      <div className="rounded-2xl border bg-slate-800/70 p-3">
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
          <div className="space-y-1.5">
            {d.diffs.map((diff) => {
              const side = resolutions[`${d.layerId}:${diff.id}`]
              return (
                <div key={diff.id} className="flex items-center gap-2 rounded-xl bg-background/40 p-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{diff.label}</span>
                  <button
                    type="button"
                    onClick={() => onResolveDiff(d.layerId, diff.id, 'A')}
                    className={cn('shrink-0 truncate rounded-full px-2.5 py-1 text-xs', side === 'A' ? 'bg-slate-600 text-white' : 'bg-slate-700 text-muted-foreground hover:text-foreground')}
                  >
                    Original · {diff.optionA}
                  </button>
                  <button
                    type="button"
                    onClick={() => onResolveDiff(d.layerId, diff.id, 'B')}
                    className={cn('shrink-0 truncate rounded-full px-2.5 py-1 text-xs', side === 'B' ? 'bg-slate-600 text-white' : 'bg-slate-700 text-muted-foreground hover:text-foreground')}
                  >
                    Current · {diff.optionB}
                  </button>
                  {isCustomResolution(side) && (
                    <span className="shrink-0 truncate rounded-full bg-violet-500/20 px-2.5 py-1 text-xs text-violet-200">
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
            'mt-3 flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition-colors',
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

function CheckStep({ item, resolutions, summary, onResolveDiff }) {
  const totalDiffs = Object.values(designMergeVariants[item.id]?.layerDiffs ?? {}).reduce((n, d) => n + d.length, 0)
  const resolved = Object.keys(resolutions).length
  const checks = [
    item.conflictLevel === 'None'
      ? { id: 'conflict', ok: true, title: 'No merge conflicts', note: 'Current and Incoming can be combined cleanly.' }
      : { id: 'conflict', ok: false, title: `${item.conflictLevel} conflict flagged`, note: 'Resolve it from the Merge List badge, or continue and review the result in Preview.' },
    totalDiffs === 0 || resolved >= totalDiffs
      ? { id: 'options', ok: true, title: totalDiffs === 0 ? 'No variant differences' : 'All variant options decided', note: `${resolved} of ${totalDiffs} design decisions made.` }
      : { id: 'options', ok: false, title: `${totalDiffs - resolved} design option${totalDiffs - resolved === 1 ? '' : 's'} undecided`, note: 'Undecided options default to the Current Implementation.' },
    summary.pending === 0
      ? { id: 'ai', ok: true, title: 'AI annotations applied', note: `${summary.applied.length} applied.` }
      : { id: 'ai', ok: false, title: `${summary.pending} annotation${summary.pending === 1 ? '' : 's'} not applied`, note: 'Use “Apply with AI” on the canvas to include them.' },
  ]
  const warnings = checks.filter((c) => !c.ok).length

  return (
    <div className="space-y-5">
      <section>
        <SectionTitle icon={CheckCircle2}>Readiness</SectionTitle>
        <div
          className={cn(
            'mb-2 flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium',
            warnings ? 'bg-amber-500/15 text-amber-500' : 'bg-emerald-500/15 text-emerald-400'
          )}
        >
          {warnings ? <TriangleAlert className="size-4" /> : <Check className="size-4" />}
          {warnings ? `${warnings} warning${warnings === 1 ? '' : 's'} — you can still continue` : 'Ready to merge'}
        </div>
        <ul className="space-y-1.5">
          {checks.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5 rounded-2xl border bg-slate-800/70 px-3 py-2">
              <span
                className={cn(
                  'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full',
                  c.ok ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-500'
                )}
              >
                {c.ok ? <Check className="size-3" /> : <TriangleAlert className="size-2.5" />}
              </span>
              <span className="text-sm">
                <span className="font-medium text-foreground">{c.title}</span>
                <span className="block text-xs text-muted-foreground">{c.note}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <DriftReviewSection item={item} resolutions={resolutions} onResolveDiff={onResolveDiff} />
      <SummarySection summary={summary} />
    </div>
  )
}

// ----- Step 2: Preview -------------------------------------------------
function mergeEffect(prev = {}, e) {
  return {
    ...prev,
    ...(e.className && { className: e.className }),
    ...(e.radius !== undefined && { radius: e.radius }),
    dw: (prev.dw ?? 0) + (e.dw ?? 0),
    dh: (prev.dh ?? 0) + (e.dh ?? 0),
  }
}

// Staging view of the combined result: the Current Implementation with every
// resolved option and applied AI edit baked in, next to the merged code
// (incoming lines + AI edits, with hand-edited lines taking precedence).
function PreviewStep({ item, resolutions, annotations, preset, assemblies = {}, extraLayers = [], manualCode = {} }) {
  const { getFileLines } = useWorkspace()
  const files = openFiles.filter((f) => item.fileIds?.includes(f.id))
  const [fileId, setFileId] = useState(files[0]?.id)
  const frame = item.hasDesign ? frameWithLayers(canvasPages.find((p) => p.id === item.designPageId)?.frames[0], extraLayers) : null
  const layerDiffs = designMergeVariants[item.id]?.layerDiffs ?? {}

  const overrides = {}
  for (const [key, side] of Object.entries(resolutions)) {
    const [layerId, diffId] = key.split(':')
    const diff = layerDiffs[layerId]?.find((d) => d.id === diffId)
    if (diff) overrides[layerId] = mergeEffect(overrides[layerId], diffEffect(diff, side))
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
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1.5 text-sm font-medium text-foreground">
        <MonitorPlay className="size-4 text-indigo-500" />
        Staging preview — the combined result that will be merged
        <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
          Live
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        {frame && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Palette className="size-4 text-violet-500" /> Design output
            </p>
            <div className="overflow-hidden rounded-md border bg-card shadow-lg" style={{ width: previewW, height: frame.height * scale }}>
              <div className="relative" style={{ width: frame.width, height: frame.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                {frame.layers.map((layer) => {
                  const o = overrides[layer.id]
                  const override = o
                    ? { ...o, className: o.className ?? (layer.type === 'button' ? 'bg-violet-500' : undefined), static: true }
                    : layer.type === 'button'
                      ? { className: 'bg-violet-500', static: true }
                      : undefined
                  return <StaticLayer key={layer.id} layer={layer} override={override} onSelect={() => {}} />
                })}
              </div>
            </div>
          </div>
        )}

        <div className="min-w-0">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
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
                    'shrink-0 rounded-t-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                    f.id === activeFile?.id ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {f.name}
                </button>
              ))}
            </div>
            <div className="max-h-64 overflow-auto py-2 font-mono text-[11px] leading-relaxed">
              {lines.map((line, i) => {
                const n = i + 1
                const manual = manualCode[`${activeFile.id}:${n}`]
                const text = manual ?? (incoming.get(n) ?? line) + (aiLines.has(n) ? `  // AI: ${aiLines.get(n)}` : '')
                const changed = manual !== undefined || incoming.has(n) || aiLines.has(n)
                return (
                  <div key={i} className={cn('flex gap-3 border-l-2 px-3', changed ? 'border-lime-400' : 'border-transparent')}>
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
            <p className={cn('mt-1.5 text-xs', names.length ? 'text-foreground' : needed ? 'text-amber-500' : 'text-muted-foreground')}>
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
                <span className="text-xs text-muted-foreground">{person.role}</span>
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
                        'flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-colors',
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
            <span className="ml-auto flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-500">
              <Loader2 className="size-2.5 animate-spin" />
              Running
            </span>
          )}
        </p>
      </div>
    </div>
  )
}

function WizardStepper({ step, run }) {
  return (
    <ol className="flex items-center gap-1.5">
      {WIZARD_STEPS.map((s, i) => {
        const done = i < step || (i === step && run === 'success')
        const active = i === step && run !== 'success'
        return (
          <li key={s.id} className="flex items-center gap-1.5">
            <span
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors',
                active && 'bg-slate-700 text-white',
                done && 'bg-emerald-500/15 text-emerald-400',
                !active && !done && 'bg-muted text-muted-foreground'
              )}
            >
              {done ? <Check className="size-3" /> : <span className="text-[10px] opacity-80">{i + 1}</span>}
              {s.label}
            </span>
            {i < WIZARD_STEPS.length - 1 && <ArrowRight className="size-3 text-muted-foreground/50" />}
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

  // Free dragging: starts at the default docked spot (top-16/right-6, via
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
        top: Math.min(Math.max(8, startTop + m.clientY - startY), window.innerHeight - 60),
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
          'flex max-h-[calc(100vh-3rem)] translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-3xl p-0 shadow-2xl sm:max-w-2xl',
          // Default dock: `top-16` (not `top-6`) so it opens clear of the
          // 44px app header instead of covering it. Docked toward the
          // *right* so it sits clear of the central code comparison /
          // artboards instead of covering them — free dragging (see `pos`
          // above) takes over as soon as the user drags the header.
          !pos && 'top-16 right-6 left-auto'
        )}
      >
        <DialogHeader
          onPointerDown={handleHeaderPointerDown}
          className="shrink-0 cursor-grab gap-3 border-b px-5 py-4 active:cursor-grabbing"
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
          <WizardStepper step={step} run={run} />
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {step === 0 && <CheckStep item={item} resolutions={resolutions} summary={summary} onResolveDiff={onResolveDiff} />}
          {step === 1 && <PreviewStep item={item} resolutions={resolutions} annotations={annotations} preset={preset} assemblies={assemblies} extraLayers={extraLayers} manualCode={manualCode} />}

          {step === 2 && (
            <div className="space-y-5">
              <ReviewerSection reviewers={reviewers} setReviewers={setReviewers} needCode={needCode} needDesign={needDesign} />

              <section>
                <SectionTitle
                  icon={GitPullRequest}
                  aside={
                    <button
                      type="button"
                      onClick={generateWithAi}
                      disabled={generating}
                      className="flex items-center gap-1 rounded-full border border-indigo-500/50 px-2.5 py-1 text-[10px] font-semibold tracking-normal text-foreground normal-case transition-colors hover:bg-indigo-500/15 disabled:opacity-60"
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
                    <span className="mb-1 block text-xs text-muted-foreground">Commit message</span>
                    <Input value={commit} onChange={(e) => setCommit(e.target.value)} className="rounded-full bg-slate-800 text-sm dark:bg-slate-800" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">PR title</span>
                    <Input value={prTitle} onChange={(e) => setPrTitle(e.target.value)} className="rounded-full bg-slate-800 text-sm dark:bg-slate-800" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">PR description</span>
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
            <div className="space-y-3">
              <SectionTitle icon={Rocket}>Ready to merge &amp; deploy</SectionTitle>
              <ul className="space-y-1.5 text-sm">
                {/* The conflict check itself is surfaced early too (Check
                    step's Readiness section) so it can be acted on, but a
                    final go/no-go read of it belongs here as well — the
                    last checkpoint before the merge actually happens. */}
                <li className="flex items-center gap-2 rounded-2xl border bg-slate-800/70 px-3 py-2">
                  {item.conflictLevel === 'None' ? (
                    <Check className="size-4 shrink-0 text-emerald-400" />
                  ) : (
                    <TriangleAlert className="size-4 shrink-0 text-amber-500" />
                  )}
                  <span className="text-foreground">
                    {item.conflictLevel === 'None' ? 'No merge conflicts' : `${item.conflictLevel} conflict level — reviewed`}
                  </span>
                </li>
                <li className="flex items-center gap-2 rounded-2xl border bg-slate-800/70 px-3 py-2">
                  <GitBranch className="size-4 shrink-0 text-indigo-500" />
                  <span className="text-foreground">{branch} → main</span>
                </li>
                <li className="flex items-start gap-2 rounded-2xl border bg-slate-800/70 px-3 py-2">
                  <GitPullRequest className="mt-0.5 size-4 shrink-0 text-indigo-500" />
                  <span className="min-w-0">
                    <span className="block text-foreground">{prTitle}</span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">{commit}</span>
                  </span>
                </li>
                <li className="flex flex-wrap items-center gap-2 rounded-2xl border bg-slate-800/70 px-3 py-2">
                  <Send className="size-3.5 shrink-0 text-indigo-500" />
                  <ScopeBadge scope="code" />
                  <span className="text-foreground">{scopeNames('code').join(', ') || '—'}</span>
                  <ScopeBadge scope="design" />
                  <span className="text-foreground">{scopeNames('design').join(', ') || '—'}</span>
                </li>
                <li className="flex items-center gap-2 rounded-2xl border bg-slate-800/70 px-3 py-2">
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

        <div className="flex shrink-0 items-center justify-end gap-2 border-t px-5 py-3">
          {run === 'success' ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Done
            </button>
          ) : (
            <>
              {step === 2 && !reviewValid && (
                <span className="mr-auto text-xs text-amber-500">
                  {!reviewersOk ? 'Assign at least one Code and one Design reviewer.' : 'Commit message and PR title are required.'}
                </span>
              )}
              {step === 0 ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStep((s) => s - 1)}
                  className="flex items-center gap-1 rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
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
                  className="flex items-center gap-1.5 rounded-full bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-600 disabled:opacity-40"
                >
                  Next: {WIZARD_STEPS[step + 1].label}
                  {/* Running total of what will actually be merged, so it's
                      visible at every step, not just buried in a summary. */}
                  <span className="rounded-full bg-white/20 px-1.5 text-xs">
                    {summary.design.length + summary.applied.length}
                  </span>
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
                  className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:brightness-110 disabled:opacity-40"
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
