import { useEffect, useMemo, useState } from 'react'
import { Check, CircleAlert, Code2, Crosshair, Palette, Sparkles, TriangleAlert, Info, Wand2 } from 'lucide-react'
import { cn } from 'cn'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { canvasPages, codeMergeVariants, designMergeVariants, openFiles } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'

const severity = {
  High: { icon: TriangleAlert, className: 'bg-destructive/15 text-destructive' },
  Medium: { icon: CircleAlert, className: 'bg-amber-500/15 text-amber-500' },
  Low: { icon: Info, className: 'bg-sky-500/15 text-sky-500' },
}

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
    blocks.push({
      id: 'c:fallback',
      kind: 'code',
      title: `${file?.name ?? 'File'} · lines 1–3`,
      current: lines.slice(0, 3),
      incoming: lines.slice(0, 3).map((l, i) => (i === 0 ? `${l}` : l)).concat('// merged: incoming handler signature'),
      recommended: 'B',
      reason: 'Keeps the incoming handler signature',
    })
  }
  return blocks
}

function Side({ label, lines, tone, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex min-w-0 flex-1 flex-col rounded-2xl border p-2.5 text-left transition-colors',
        selected ? 'border-primary bg-primary/10' : 'border-white/10 bg-background/30 hover:bg-muted/50'
      )}
    >
      <span className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
        {selected && <Check className="ml-auto size-3 text-primary" />}
      </span>
      <span
        className={cn(
          'block rounded-lg px-2 py-1.5 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap',
          tone === 'current' ? 'bg-destructive/10 text-destructive/90' : 'bg-emerald-500/10 text-emerald-400'
        )}
      >
        {lines.map((l, i) => (
          <span key={i} className="block">
            {l === '' ? ' ' : l}
          </span>
        ))}
      </span>
    </button>
  )
}

// Conflict Resolution view for a flagged merge item: conflicting token /
// code blocks side by side (Current vs Incoming), an AI one-click
// "auto-resolve" recommendation, and per-block manual choice. Applying the
// resolution clears the item's conflict badge.
function ConflictResolutionModal({ item, onClose }) {
  const { getFileLines, updateMergeItem, requestMergeFocus } = useWorkspace()
  const blocks = useMemo(() => buildBlocks(item, getFileLines), [item, getFileLines])
  const [choices, setChoices] = useState({})
  const [aiApplied, setAiApplied] = useState(false)
  const sev = severity[item.conflictLevel] ?? severity.Medium
  const SevIcon = sev.icon
  const resolved = blocks.filter((b) => choices[b.id]).length

  // Targeting a conflict = selecting its element on the canvas (which draws
  // the neon outline and pans there). Blocks without a target do nothing.
  function locate(b) {
    if (b.layerId) requestMergeFocus({ itemId: item.id, layerId: b.layerId, label: b.title })
    else if (b.fileId) requestMergeFocus({ itemId: item.id, fileId: b.fileId, line: b.line, label: b.title })
  }

  useEffect(() => {
    if (blocks[0]) locate(blocks[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function autoResolve() {
    setChoices(Object.fromEntries(blocks.map((b) => [b.id, b.recommended])))
    setAiApplied(true)
  }

  function choose(id, side) {
    setAiApplied(false)
    setChoices((prev) => ({ ...prev, [id]: side }))
  }

  return (
    <Dialog open modal={false} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        overlay={false}
        className="top-6 right-6 left-auto flex max-h-[calc(100vh-3rem)] translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-3xl p-0 shadow-2xl sm:max-w-2xl"
      >
        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            {item.title}
            <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', sev.className)}>
              <SevIcon className="size-3" />
              {item.conflictLevel} conflict
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Choose Current or Incoming for each conflicting block, or let AI resolve them all.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="rounded-2xl border border-indigo-500/40 bg-gradient-to-r from-indigo-500/10 to-violet-500/10 p-3.5">
            <div className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white">
                <Sparkles className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground">AI recommendation</p>
                <p className="text-[11px] text-muted-foreground">
                  Auto-resolve using latest Design System tokens · {blocks.length} block{blocks.length === 1 ? '' : 's'}
                </p>
              </div>
              <button
                type="button"
                onClick={autoResolve}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all',
                  aiApplied
                    ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                    : 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30 hover:brightness-110'
                )}
              >
                {aiApplied ? <Check className="size-3.5" /> : <Wand2 className="size-3.5" />}
                {aiApplied ? 'Applied' : 'Apply'}
              </button>
            </div>
          </div>

          {blocks.map((b) => (
            <section key={b.id}>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground">
                {b.kind === 'token' ? <Palette className="size-3.5 text-violet-500" /> : <Code2 className="size-3.5 text-violet-500" />}
                {b.title}
                <button
                  type="button"
                  onClick={() => locate(b)}
                  title="Show on canvas"
                  className="flex items-center gap-1 rounded-full border border-lime-400/60 px-2 py-0.5 text-[10px] font-medium text-lime-300 transition-colors hover:bg-lime-400/10"
                >
                  <Crosshair className="size-3" />
                  Locate
                </button>
                <span className="ml-auto flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  <Sparkles className="size-2.5 text-violet-500" />
                  AI: {b.recommended === 'B' ? 'Incoming' : 'Current'} — {b.reason}
                </span>
              </div>
              <div className="flex gap-2">
                <Side label="Current (A)" lines={b.current} tone="current" selected={choices[b.id] === 'A'} onSelect={() => choose(b.id, 'A')} />
                <Side label="Incoming (B)" lines={b.incoming} tone="incoming" selected={choices[b.id] === 'B'} onSelect={() => choose(b.id, 'B')} />
              </div>
            </section>
          ))}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t px-5 py-3">
          <span className="mr-auto text-[11px] text-muted-foreground">
            {resolved} of {blocks.length} resolved
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={resolved < blocks.length}
            onClick={() => {
              updateMergeItem(item.id, { conflictLevel: 'None', updatedLabel: 'Just now' })
              onClose()
            }}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:brightness-110 disabled:opacity-40"
          >
            <Check className="size-3.5" />
            Apply resolution
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ConflictResolutionModal
