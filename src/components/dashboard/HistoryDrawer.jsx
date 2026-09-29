import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from '@/i18n/toast'
import { Archive, ArchiveRestore, RotateCcw, Sparkles } from 'lucide-react'
import { cn } from 'cn'
import RollbackCheckpointModal from '@/components/history/RollbackCheckpointModal'
import { useSelectedCheckpoint } from '@/components/history/useSelectedCheckpoint'
import { ACCENT_SOFT } from '@/components/mergestudio/floatingStyles'
import { diffStats } from '@/lib/lineDiff'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { historyMeta } from '@/lib/historyMeta'

const ROW_ACTION =
  'flex size-6 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/[0.08] hover:text-white'

// The left column of the History view (it opens with it): the project's
// checkpoints, newest first, as a compact list. Clicking one shows it in
// History's main viewer — the same selection the timeline slider and
// playback move through (see useSelectedCheckpoint). Hover a row for
// Archive and "Rollback here"; archived ones sit under their own tab.
function HistoryDrawer({ project }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { historyEntries, activeHistoryId, archiveHistoryEntry, restoreHistoryEntry } = useWorkspace()
  const [selectedId, select] = useSelectedCheckpoint()
  const [tab, setTab] = useState('active')
  const [rollbackId, setRollbackId] = useState(null)
  const historyPath = `/projects/${project.id}/history`
  const onHistoryPage = pathname.replace(/\/$/, '') === historyPath

  const current = historyEntries.find((e) => e.id === activeHistoryId)
  const active = [...historyEntries].filter((e) => !e.archived).reverse()
  const archived = [...historyEntries].filter((e) => e.archived).reverse()

  const open = (id) => (onHistoryPage ? select(id) : navigate(`${historyPath}?v=${id}`))

  // Keep the selected row in view as the slider / playback moves it.
  const refs = useRef(new Map())
  useEffect(() => {
    refs.current.get(selectedId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedId])

  function archive(entry) {
    archiveHistoryEntry(entry.id)
    toast('Checkpoint archived', { description: entry.label, action: { label: 'Undo', onClick: () => restoreHistoryEntry(entry.id) } })
  }

  return (
    <div className="flex flex-col pb-2">
      <div className="mb-2 flex items-center gap-1 px-1" role="tablist" aria-label="Checkpoints">
        {[
          ['active', 'Checkpoints', active.length],
          ['archived', 'Archived', archived.length],
        ].map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition-colors',
              tab === id ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:text-slate-200'
            )}
          >
            {label}
            <span className="text-[10px] text-slate-500 tabular-nums">{count}</span>
          </button>
        ))}
      </div>

      {tab === 'active' &&
        active.map((entry) => {
          const isCurrent = entry.id === activeHistoryId
          const selected = onHistoryPage && entry.id === selectedId
          const stats = diffStats(current?.snapshot.lines, entry.snapshot.lines)
          return (
            <div
              key={entry.id}
              ref={(el) => (el ? refs.current.set(entry.id, el) : refs.current.delete(entry.id))}
              className={cn(
                'group relative rounded-lg transition-colors',
                selected ? 'bg-white/[0.07]' : 'hover:bg-white/[0.035]'
              )}
            >
              <button
                type="button"
                onClick={() => open(entry.id)}
                aria-current={selected ? 'true' : undefined}
                className="block w-full px-2.5 py-2 text-left"
              >
                <span className="flex items-center gap-1.5 text-[11px] text-slate-500 tabular-nums">
                  {entry.prompt && <Sparkles className="size-3 shrink-0 text-emerald-300" />}
                  {entry.restoredFrom && <RotateCcw className="size-3 shrink-0 text-sky-300" />}
                  <span className="min-w-0 truncate">{entry.timestamp}</span>
                  {!isCurrent && (
                    <span className="font-mono text-[10px] transition-opacity group-hover:opacity-0">
                      <span className="text-emerald-300/80">+{stats.added}</span> <span className="text-red-300/80">−{stats.removed}</span>
                    </span>
                  )}
                  {isCurrent && (
                    <span className={cn('ml-auto shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold', ACCENT_SOFT)}>Current</span>
                  )}
                </span>
                <span
                  className={cn('mt-0.5 line-clamp-2 block text-[12.5px] leading-snug', selected ? 'text-white' : 'text-slate-300')}
                  title={entry.label}
                >
                  {entry.label}
                </span>
                {historyMeta(entry) && (
                  <span className="mt-0.5 block truncate text-[11px] text-slate-500" title={historyMeta(entry)}>
                    {historyMeta(entry)}
                  </span>
                )}
              </button>
              {!isCurrent && (
                <div className="absolute top-1 right-1 flex items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <button type="button" title="Archive" aria-label="Archive this checkpoint" onClick={() => archive(entry)} className={ROW_ACTION}>
                    <Archive className="size-3" />
                  </button>
                  <button type="button" title="Rollback here" aria-label="Rollback here" onClick={() => setRollbackId(entry.id)} className={ROW_ACTION}>
                    <RotateCcw className="size-3" />
                  </button>
                </div>
              )}
            </div>
          )
        })}

      {tab === 'archived' &&
        (archived.length === 0 ? (
          <p className="px-2.5 py-8 text-center text-xs text-slate-500">No archived checkpoints.</p>
        ) : (
          archived.map((entry) => (
            <div key={entry.id} className="flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-white/[0.035]">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] text-slate-300">{entry.label}</p>
                <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">{entry.timestamp}</p>
              </div>
              <button
                type="button"
                title="Restore to History"
                aria-label="Restore to History"
                onClick={() => {
                  restoreHistoryEntry(entry.id)
                  toast('Checkpoint restored to History', { description: entry.label })
                }}
                className={ROW_ACTION}
              >
                <ArchiveRestore className="size-3.5" />
              </button>
            </div>
          ))
        ))}

      <RollbackCheckpointModal
        key={rollbackId}
        entryId={rollbackId}
        onOpenChange={(isOpen) => !isOpen && setRollbackId(null)}
        onDone={(entry, restoredId) => {
          if (onHistoryPage && restoredId) select(restoredId)
          toast('Rolled back to checkpoint', { description: `${entry.label} — saved as a new checkpoint` })
        }}
      />
    </div>
  )
}

export default HistoryDrawer
