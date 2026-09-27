import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Code2, Crosshair, Palette, Sparkles, Wand2 } from 'lucide-react'
import { cn } from 'cn'
import { canvasPages, codeMergeVariants, designMergeVariants, openFiles } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'

// Derives the conflicting blocks for a merge item from its real mock data:
// design token diffs (`designMergeVariants.layerDiffs`) and incoming code
// lines (`codeMergeVariants`). Falls back to one generic block so every
// flagged item has something to resolve.
function buildBlocks(item, getFileLines) {
  const blocks = []
  const layers = canvasPages.find((p) => p.id === item.designPageId)?.frames[0]?.layers ?? []

  for (const [layerId, diffs] of Object.entries(designMergeVariants[item.id]?.layerDiffs ?? {})) {
    const layer = layers.find((l) => l.id === layerId)
    for (const diff of diffs) {
      blocks.push({
        id: `t:${layerId}:${diff.id}`,
        kind: 'token',
        layerId,
        title: `${layer?.name ?? layerId} · ${diff.label}`,
        current: [diff.optionA],
        incoming: [diff.optionB],
        recommended: 'B',
        reason: 'Latest Design System token',
      })
    }
  }

  for (const [fileId, diffs] of Object.entries(codeMergeVariants[item.id] ?? {})) {
    const file = openFiles.find((f) => f.id === fileId)
    const lines = getFileLines(fileId)
    for (const d of diffs) {
      blocks.push({
        id: `c:${fileId}:${d.line}`,
        kind: 'code',
        fileId,
        line: d.line,
        title: `${file?.name ?? fileId} · line ${d.line}`,
        current: [lines[d.line - 1] ?? ''],
        incoming: [d.incoming],
        recommended: 'B',
        reason: 'Uses updated token references',
      })
    }
  }

  if (!blocks.length) {
    const file = openFiles.find((f) => item.fileIds?.includes(f.id))
    const lines = file ? getFileLines(file.id) : []
    // No mock diff data at all for this item — fall back to a realistic,
    // single-property change (a shared button style token) instead of a
    // generic multi-line dump, so the block still reads as a real decision.
    const idx = lines.findIndex((l) => l.includes('<Button'))
    const line = idx >= 0 ? lines[idx] : (lines[0] ?? '')
    const incomingLine = line.includes('className=')
      ? line.replace(/className="[^"]*"/, 'className="rounded-full bg-violet-500"')
      : line.replace('<Button', '<Button className="rounded-full bg-violet-500"')
    blocks.push({
      id: 'c:fallback',
      kind: 'code',
      fileId: file?.id,
      line: idx >= 0 ? idx + 1 : 1,
      title: `${file?.name ?? 'File'} · line ${idx >= 0 ? idx + 1 : 1}`,
      current: [line],
      incoming: [incomingLine],
      recommended: 'B',
      reason: 'Matches the shared button style token',
    })
  }
  return blocks
}

// One side of a conflict, as a radio row in the block's option list: the
// choice indicator, which version it is (+ "Recommended" for the AI pick),
// and the value itself in mono.
function OptionRow({ label, lines, selected, recommended, strong, onSelect }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn('flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors', selected ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]')}
    >
      <span
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ring-1 ring-inset transition-colors',
          selected ? 'bg-emerald-400 ring-emerald-400' : 'ring-white/25'
        )}
      >
        {selected && <Check strokeWidth={3.5} className="size-2.5 text-slate-950" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-xs text-slate-400">
          {label}
          {recommended && <span className="text-[11px] font-medium text-emerald-300">Recommended</span>}
        </span>
        <span className={cn('mt-1 block font-mono text-[12px] leading-relaxed break-words whitespace-pre-wrap', strong ? 'text-white' : 'text-slate-300')}>
          {lines.map((l, i) => (
            <span key={i} className="block">
              {l === '' ? ' ' : l}
            </span>
          ))}
        </span>
      </span>
    </button>
  )
}

// Conflict resolution, inline in the Merge Changes modal's Check step (no
// separate dialog): one conflict at a time in a single grouped list —
// Original Design vs Current Implementation as radio rows, the AI pick
// marked "Recommended" — with a segmented progress bar (click a segment to
// jump), Previous / Next, and "Resolve all with AI". Picking a side moves
// on to the next open conflict; each conflict is also selected on the
// canvas. Applying the resolution clears the item's conflict.
function ConflictResolver({ item, onBack, onResolved }) {
  const { getFileLines, updateMergeItem, requestMergeFocus } = useWorkspace()
  const blocks = useMemo(() => buildBlocks(item, getFileLines), [item, getFileLines])
  const [choices, setChoices] = useState({})
  const [aiApplied, setAiApplied] = useState(false)
  const [active, setActive] = useState(0)
  const resolved = blocks.filter((b) => choices[b.id]).length
  const allDone = resolved === blocks.length
  const b = blocks[active]

  // Targeting a conflict = selecting its element on the canvas (which draws
  // the neon outline and pans there). Blocks without a target do nothing.
  function locate(block) {
    if (block.layerId) requestMergeFocus({ itemId: item.id, layerId: block.layerId, label: block.title })
    else if (block.fileId) requestMergeFocus({ itemId: item.id, fileId: block.fileId, line: block.line, label: block.title })
  }

  useEffect(() => {
    if (blocks[0]) locate(blocks[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function goTo(index) {
    setActive(index)
    locate(blocks[index])
  }

  function choose(side) {
    const next = { ...choices, [b.id]: side }
    setAiApplied(false)
    setChoices(next)
    // Step on to the next conflict that still needs a decision.
    const after = [...blocks.slice(active + 1), ...blocks.slice(0, active)].find((x) => !next[x.id])
    if (after) setTimeout(() => goTo(blocks.indexOf(after)), 180)
  }

  function autoResolve() {
    setChoices(Object.fromEntries(blocks.map((x) => [x.id, x.recommended])))
    setAiApplied(true)
  }

  function apply() {
    updateMergeItem(item.id, { conflictLevel: 'None', updatedLabel: 'Just now' })
    onResolved?.()
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-200">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="-ml-2 flex h-7 items-center gap-1 rounded-full pr-2.5 pl-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white">
          <ChevronLeft className="size-4" />
          Checks
        </button>
        <span className="ml-auto text-xs text-slate-400 tabular-nums">
          <span className="font-semibold text-white">{resolved}</span> of {blocks.length} resolved
        </span>
      </div>

      <div>
        <p className="text-base font-semibold text-white">Resolve the {item.conflictLevel.toLowerCase()} conflict</p>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-400">Pick a version for each conflicting value — or let AI resolve them all.</p>
        {/* Segmented progress: one segment per conflict; click to jump. */}
        <div className="mt-4 flex gap-1" role="tablist" aria-label="Conflicts">
          {blocks.map((x, i) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              title={x.title}
              onClick={() => goTo(i)}
              className={cn(
                'h-1.5 min-w-0 flex-1 rounded-full transition-colors',
                choices[x.id] ? 'bg-emerald-400' : i === active ? 'bg-white/50' : 'bg-white/[0.1] hover:bg-white/25'
              )}
            />
          ))}
        </div>
      </div>

      {/* AI shortcut: one quiet row, not a card. */}
      <div className="flex items-center gap-3">
        <Sparkles className="size-4 shrink-0 text-slate-400" />
        <p className="min-w-0 flex-1 text-[13px] text-slate-300">
          Resolve all {blocks.length} with AI
          <span className="block text-xs text-slate-500">Uses the latest Design System tokens</span>
        </p>
        {aiApplied ? (
          <span className="flex h-8 items-center gap-1.5 px-2 text-xs font-medium text-emerald-300">
            <Check className="size-3.5" />
            Applied
          </span>
        ) : (
          <button type="button" onClick={autoResolve} className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.07] px-3.5 text-xs font-medium text-slate-100 transition-colors hover:bg-white/[0.12]">
            <Wand2 className="size-3.5" />
            Resolve all
          </button>
        )}
      </div>

      {/* The current conflict. */}
      <section key={b.id} className="animate-in fade-in duration-200">
        <div className="mb-2.5 flex items-center gap-2">
          {b.kind === 'token' ? <Palette className="size-4 shrink-0 text-slate-400" /> : <Code2 className="size-4 shrink-0 text-slate-400" />}
          <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-white" title={b.title}>
            <span className="mr-1.5 text-slate-500 tabular-nums">{active + 1}.</span>
            {b.title}
          </p>
          {(b.layerId || b.fileId) && (
            <button type="button" onClick={() => locate(b)} title="Show on canvas" className="flex h-7 shrink-0 items-center gap-1 rounded-full px-2 text-xs text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white">
              <Crosshair className="size-3.5" />
              Locate
            </button>
          )}
        </div>
        <div role="radiogroup" aria-label={b.title} className="overflow-hidden rounded-xl bg-white/[0.025] ring-1 ring-inset ring-white/[0.07] divide-y divide-white/[0.06]">
          <OptionRow label="Original Design" lines={b.current} selected={choices[b.id] === 'A'} recommended={b.recommended === 'A'} onSelect={() => choose('A')} />
          <OptionRow label="Current Implementation" lines={b.incoming} strong selected={choices[b.id] === 'B'} recommended={b.recommended === 'B'} onSelect={() => choose('B')} />
        </div>
        <p className="mt-2 text-xs text-slate-500">AI: {b.reason}.</p>
      </section>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={blocks.length < 2}
          onClick={() => goTo((active - 1 + blocks.length) % blocks.length)}
          className="flex h-9 items-center gap-1 rounded-full pr-3.5 pl-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
          Previous
        </button>
        <span className="flex-1" />
        {allDone ? (
          <button type="button" onClick={apply} className="flex h-9 items-center gap-1.5 rounded-full bg-emerald-400 px-4 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition-colors hover:bg-emerald-300">
            <Check className="size-4" />
            Apply resolution
          </button>
        ) : (
          <button
            type="button"
            disabled={blocks.length < 2}
            onClick={() => goTo((active + 1) % blocks.length)}
            className="flex h-9 items-center gap-1 rounded-full bg-white/[0.07] pr-2.5 pl-3.5 text-sm font-medium text-slate-100 transition-colors hover:bg-white/[0.12] disabled:opacity-40"
          >
            Next
            <ChevronRight className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}

export default ConflictResolver
