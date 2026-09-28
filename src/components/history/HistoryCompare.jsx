import { useMemo } from 'react'
import { GitCompareArrows, RotateCcw, Sparkles } from 'lucide-react'
import { cn } from 'cn'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useWorkspace } from '@/state/WorkspaceProvider'

// Plain LCS line diff — snapshots are a few dozen lines at most, so the
// O(n·m) table is cheap. Returns rows tagged 'same' | 'add' | 'remove',
// reading `from` → `to`.
function diffLines(from, to) {
  const n = from.length
  const m = to.length
  const lcs = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = from[i] === to[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const rows = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (from[i] === to[j]) {
      rows.push({ kind: 'same', text: from[i] })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      rows.push({ kind: 'remove', text: from[i++] })
    } else {
      rows.push({ kind: 'add', text: to[j++] })
    }
  }
  while (i < n) rows.push({ kind: 'remove', text: from[i++] })
  while (j < m) rows.push({ kind: 'add', text: to[j++] })
  return rows
}

const ROW_TONES = {
  same: 'text-muted-foreground',
  add: 'bg-emerald-500/10 text-emerald-300',
  remove: 'bg-destructive/10 text-destructive',
}
const ROW_MARKS = { same: ' ', add: '+', remove: '−' }

// Archive → History's detail pane: what restoring the selected version
// would change relative to the current one (code, preview props,
// conflicts), with the explicit Restore action. Reads the same
// WorkspaceProvider the Workspace uses, so a restore here is exactly the
// rollback the Workspace would do.
function HistoryCompare({ entryId }) {
  const { historyEntries, activeHistoryId, rollbackTo } = useWorkspace()
  const entry = historyEntries.find((h) => h.id === entryId)
  const current = historyEntries.find((h) => h.id === activeHistoryId)
  const isCurrent = entryId === activeHistoryId

  const rows = useMemo(
    () => (entry && current ? diffLines(current.snapshot.lines, entry.snapshot.lines) : []),
    [entry, current]
  )

  if (!entry) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed text-xs text-muted-foreground">
        Select a version to compare it with the current one.
      </div>
    )
  }

  const added = rows.filter((r) => r.kind === 'add').length
  const removed = rows.filter((r) => r.kind === 'remove').length
  const propChanges = current
    ? Object.keys({ ...current.snapshot.previewProps, ...entry.snapshot.previewProps }).filter(
        (key) => current.snapshot.previewProps?.[key] !== entry.snapshot.previewProps?.[key]
      )
    : []
  const conflictDelta = (entry.snapshot.conflicts?.length ?? 0) - (current?.snapshot.conflicts?.length ?? 0)

  function handleRestore() {
    rollbackTo(entry.id)
    toast('Restored this version', { description: entry.label })
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-card">
      <div className="flex shrink-0 items-start justify-between gap-4 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">{entry.timestamp}</p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] font-semibold text-foreground">
            {entry.prompt && <Sparkles className="size-3.5 shrink-0 text-primary" />}
            {entry.label}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <GitCompareArrows className="size-3" />
            {isCurrent ? (
              'This is the current version.'
            ) : (
              <>
                Compared with current ·{' '}
                <span className="text-emerald-400">+{added}</span>
                <span className="text-destructive">−{removed}</span> lines
                {propChanges.length > 0 && ` · ${propChanges.length} preview prop${propChanges.length === 1 ? '' : 's'}`}
                {conflictDelta !== 0 && ` · ${conflictDelta > 0 ? '+' : ''}${conflictDelta} conflicts`}
              </>
            )}
          </p>
        </div>
        <Button size="sm" onClick={handleRestore} disabled={isCurrent} className="shrink-0 gap-1.5">
          <RotateCcw className="size-3.5" />
          {isCurrent ? 'Current' : 'Restore this version'}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto py-2 font-mono text-[12px] leading-5">
        {rows.map((row, index) => (
          <div key={index} className={cn('flex px-4 whitespace-pre', ROW_TONES[row.kind])}>
            <span className="w-4 shrink-0 select-none opacity-70">{ROW_MARKS[row.kind]}</span>
            <span>{row.text || ' '}</span>
          </div>
        ))}
      </div>

      {propChanges.length > 0 && !isCurrent && (
        <div className="shrink-0 border-t px-4 py-2.5">
          <p className="mb-1 text-[11px] font-medium text-muted-foreground">Preview props</p>
          {propChanges.map((key) => (
            <p key={key} className="font-mono text-[11px] text-muted-foreground">
              {key}: <span className="text-destructive line-through">{String(current.snapshot.previewProps?.[key] ?? '—')}</span>{' '}
              → <span className="text-emerald-400">{String(entry.snapshot.previewProps?.[key] ?? '—')}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

export default HistoryCompare
