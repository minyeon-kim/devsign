import { useMemo } from 'react'
import { GitCompareArrows, RotateCcw, Sparkles } from 'lucide-react'
import { cn } from 'cn'
import { toast } from 'sonner'
import { ACCENT_CTA, FLOATING_PANEL, PANEL_RADIUS } from '@/components/mergestudio/floatingStyles'
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
  same: 'text-slate-500',
  add: 'bg-emerald-400/[0.08] text-emerald-300',
  remove: 'bg-destructive/[0.08] text-red-300',
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
      <div className="flex h-full items-center justify-center rounded-[20px] bg-white/[0.03] text-xs text-slate-500">
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
    // A Merge Studio floating panel: the same surface as the Version
    // History drawer, borderless inside, the mint accent for Restore.
    <div className={cn('flex h-full min-h-0 flex-col overflow-hidden', PANEL_RADIUS, FLOATING_PANEL)}>
      <div className="flex shrink-0 items-start justify-between gap-4 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <p className="text-[11px] text-slate-500 tabular-nums">{entry.timestamp}</p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] font-semibold text-white">
            {entry.prompt && <Sparkles className="size-3.5 shrink-0 text-emerald-300" />}
            {entry.label}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
            <GitCompareArrows className="size-3" />
            {isCurrent ? (
              'This is the current version.'
            ) : (
              <>
                Compared with current ·{' '}
                <span className="text-emerald-300">+{added}</span>
                <span className="text-red-300">−{removed}</span> lines
                {propChanges.length > 0 && ` · ${propChanges.length} preview prop${propChanges.length === 1 ? '' : 's'}`}
                {conflictDelta !== 0 && ` · ${conflictDelta > 0 ? '+' : ''}${conflictDelta} conflicts`}
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRestore}
          disabled={isCurrent}
          className={cn(
            'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold',
            ACCENT_CTA,
            'disabled:bg-white/[0.06] disabled:text-slate-500 disabled:shadow-none'
          )}
        >
          <RotateCcw className="size-3.5" />
          {isCurrent ? 'Current' : 'Restore this version'}
        </button>
      </div>

      <div className="mx-3 mb-3 min-h-0 flex-1 overflow-auto rounded-xl bg-black/20 py-2 font-mono text-[12px] leading-5">
        {rows.map((row, index) => (
          <div key={index} className={cn('flex px-4 whitespace-pre', ROW_TONES[row.kind])}>
            <span className="w-4 shrink-0 select-none opacity-70">{ROW_MARKS[row.kind]}</span>
            <span>{row.text || ' '}</span>
          </div>
        ))}
      </div>

      {propChanges.length > 0 && !isCurrent && (
        <div className="shrink-0 px-5 pb-4">
          <p className="mb-1 text-xs font-medium text-slate-300">Preview props</p>
          {propChanges.map((key) => (
            <p key={key} className="font-mono text-[11px] text-slate-500">
              {key}: <span className="text-red-300 line-through">{String(current.snapshot.previewProps?.[key] ?? '—')}</span>{' '}
              → <span className="text-emerald-300">{String(entry.snapshot.previewProps?.[key] ?? '—')}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

export default HistoryCompare
