import { useMemo, useState } from 'react'
import { Code2, GitCompareArrows, LayoutTemplate, RotateCcw, Sparkles } from 'lucide-react'
import { cn } from 'cn'
import { toast } from 'sonner'
import { ACCENT_CTA, FLOATING_PANEL, PANEL_RADIUS } from '@/components/mergestudio/floatingStyles'
import PreviewPanelContent from '@/components/dockview/panels/PreviewPanelContent'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { diffLines } from '@/lib/lineDiff'

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
// With `onRollback`, the button hands off to the caller (History's
// "Rollback to checkpoint" confirmation) instead of restoring directly.
// `compareLatest` (Replit's "Compare latest" toggle, shown when
// `onCompareLatestChange` is given): on, an inline diff against the latest
// state; off, just the file as it was at this version — what History
// playback steps through. `footer` sits under the code (the timeline).
// Code / Canvas switches between that file and the design as it rendered at
// the version (beside the latest one while comparing).
function HistoryCompare({ entryId, onRollback, compareLatest = true, onCompareLatestChange, footer }) {
  const { historyEntries, activeHistoryId, rollbackTo, getFileName } = useWorkspace()
  const [view, setView] = useState('code')
  const entry = historyEntries.find((h) => h.id === entryId)
  const current = historyEntries.find((h) => h.id === activeHistoryId)
  const isCurrent = entryId === activeHistoryId

  const rows = useMemo(
    () => (entry && current ? diffLines(current.snapshot.lines, entry.snapshot.lines) : []),
    [entry, current]
  )
  const showDiff = compareLatest && !isCurrent
  const codeRows = useMemo(() => {
    const source = showDiff ? rows : (entry?.snapshot.lines ?? []).map((text) => ({ kind: 'same', text }))
    // Old (latest) / new (this version) line numbers, like a split gutter.
    let a = 0
    let b = 0
    return source.map((row) => ({
      ...row,
      from: row.kind === 'add' ? null : ++a,
      to: row.kind === 'remove' ? null : ++b,
    }))
  }, [showDiff, rows, entry])

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
    if (onRollback) {
      onRollback(entry.id)
      return
    }
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
            ) : !showDiff ? (
              'The file as it was at this version.'
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
        <div className="flex shrink-0 items-center gap-3">
          {onCompareLatestChange && (
            <div className="flex items-center rounded-full bg-white/[0.04] p-0.5" role="tablist" aria-label="View">
              {[
                ['code', 'Code', Code2],
                ['canvas', 'Canvas', LayoutTemplate],
              ].map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={view === id}
                  onClick={() => setView(id)}
                  className={cn(
                    'flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
                    view === id ? 'bg-white/[0.1] text-white' : 'text-slate-500 hover:text-slate-200'
                  )}
                >
                  <Icon className="size-3.5" />
                  {label}
                </button>
              ))}
            </div>
          )}
          {onCompareLatestChange && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400 select-none">
              Compare latest
              <button
                type="button"
                role="switch"
                aria-checked={compareLatest}
                aria-label="Compare latest"
                onClick={() => onCompareLatestChange(!compareLatest)}
                className={cn(
                  'relative h-[18px] w-8 rounded-full transition-colors',
                  compareLatest ? 'bg-emerald-400/80' : 'bg-white/[0.12]'
                )}
              >
                <span
                  className={cn(
                    'absolute top-[3px] left-[3px] size-3 rounded-full bg-white shadow transition-transform',
                    compareLatest && 'translate-x-3.5'
                  )}
                />
              </button>
            </label>
          )}
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
            {isCurrent ? 'Current' : onRollback ? 'Rollback here' : 'Restore this version'}
          </button>
        </div>
      </div>

      {view === 'canvas' ? (
        <div className={cn('mx-3 mb-3 grid min-h-0 flex-1 gap-3', showDiff && 'grid-cols-2')}>
          {showDiff && (
            <div className="min-h-0 overflow-hidden rounded-xl">
              <PreviewPanelContent previewProps={current?.snapshot.previewProps} caption={<span className="shrink-0">Latest</span>} />
            </div>
          )}
          <div key={entry.id} className="min-h-0 overflow-hidden rounded-xl">
            <PreviewPanelContent
              previewProps={entry.snapshot.previewProps}
              caption={<span className="shrink-0 text-emerald-300">{isCurrent ? 'Current' : `At ${entry.timestamp}`}</span>}
            />
          </div>
        </div>
      ) : (
        <div className="mx-3 mb-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-black/20">
          <p className="shrink-0 px-4 pt-2 pb-1 font-mono text-[11px] text-slate-500">{getFileName(entry.snapshot.fileId)}</p>
          <div className="min-h-0 flex-1 overflow-auto pb-2 font-mono text-[12px] leading-5">
            {showDiff && rows.every((r) => r.kind === 'same') && (
              <p className="px-4 pb-2 font-sans text-xs text-slate-500">No code changes between this version and the latest.</p>
            )}
            {codeRows.map((row, index) => (
              <div key={index} className={cn('flex pr-4 whitespace-pre', showDiff ? ROW_TONES[row.kind] : 'text-slate-300')}>
                {showDiff && <span className="w-9 shrink-0 pr-2 text-right text-slate-600 select-none tabular-nums">{row.from ?? ''}</span>}
                <span className="w-9 shrink-0 pr-2 text-right text-slate-600 select-none tabular-nums">{row.to ?? ''}</span>
                {showDiff && <span className="w-4 shrink-0 select-none opacity-70">{ROW_MARKS[row.kind]}</span>}
                <span>{row.text || ' '}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {footer}

      {propChanges.length > 0 && showDiff && (
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
