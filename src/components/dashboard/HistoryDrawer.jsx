import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from '@/i18n/toast'
import { Archive, ArchiveRestore, ChevronDown, RotateCcw, Search, X } from 'lucide-react'
import { cn } from 'cn'
import RollbackCheckpointModal from '@/components/history/RollbackCheckpointModal'
import { useSelectedCheckpoint } from '@/components/history/useSelectedCheckpoint'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ACCENT_SOFT } from '@/components/mergestudio/floatingStyles'
import { diffStats } from '@/lib/lineDiff'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { HISTORY_KINDS, KIND_ICON, KIND_LABEL, KIND_TONE, historyMeta, historyTargets, filterHistoryEntries } from '@/lib/historyMeta'

const ROW_ACTION =
  'flex size-6 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/[0.08] hover:text-white'

// A checkpoint's kind as a small icon badge, so the list reads at a glance
// without opening the row — Edit / AI edit / Merged / Rollback each get
// their own icon + color (see lib/historyMeta).
function KindBadge({ kind }) {
  const Icon = KIND_ICON[kind]
  if (!Icon) return null
  return (
    <span title={KIND_LABEL[kind]} className={cn('flex size-4 shrink-0 items-center justify-center', KIND_TONE[kind])}>
      <Icon className="size-3" />
    </span>
  )
}

// History opens this compact list beside the current page first, with the
// project's checkpoints newest first. Clicking one shows it in
// History's main viewer — the same selection the timeline slider and
// playback move through (see useSelectedCheckpoint). Hover a row for
// Archive and "Rollback here"; archived ones sit under their own tab.
//
// A project's checkpoints span every file/element it touches and every kind
// of change (a manual edit, an AI edit, a merge, a rollback) in one list —
// the kind pills and the target dropdown narrow that down; both apply to
// the History page's playback timeline too (shared via `historyFilter`).
function HistoryDrawer({ project }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { historyEntries, activeHistoryId, archiveHistoryEntry, restoreHistoryEntry, currentUser, historyFilter, setHistoryFilter } = useWorkspace()
  const [selectedId, select] = useSelectedCheckpoint()
  const [tab, setTab] = useState('active')
  const [query, setQuery] = useState('')
  const [rollbackId, setRollbackId] = useState(null)
  const historyPath = `/projects/${project.id}/history`
  const onHistoryPage = pathname.replace(/\/$/, '') === historyPath

  const current = historyEntries.find((e) => e.id === activeHistoryId)
  const targets = historyTargets(historyEntries)
  const filtered = filterHistoryEntries(historyEntries, historyFilter)
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const matches = filtered.filter((entry) => {
    const text = [entry.label, entry.timestamp, entry.prompt, historyMeta(entry, currentUser.id)].filter(Boolean).join(' ').toLocaleLowerCase()
    return terms.every((term) => text.includes(term))
  })
  const active = [...matches].filter((e) => !e.archived).reverse()
  const archived = [...matches].filter((e) => e.archived).reverse()
  const filtersActive = historyFilter.kind !== 'all' || historyFilter.target !== 'all'

  const open = (id) => {
    if (onHistoryPage && id === selectedId) {
      navigate(`/projects/${project.id}/workspace`, { state: { keepDrawer: 'history' } })
      return
    }
    if (onHistoryPage) select(id)
    else navigate(`${historyPath}?v=${id}`)
  }

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
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          aria-label="Search project history"
          placeholder="Search history..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Escape') setQuery('') }}
          className="h-8 w-full min-w-0 appearance-none rounded-full border border-white/10 bg-[#09090A] pr-8 pl-8 text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-primary/50 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {query && <button type="button" aria-label="Clear history search" onClick={() => setQuery('')} className="absolute top-1/2 right-2 flex size-4 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"><X className="size-3" /></button>}
      </div>

      {/* Kind + target filters — every checkpoint in this project's
          History, across every file it touched, otherwise shows in one
          undifferentiated list. Both also narrow the History page's
          playback timeline (see `historyFilter` in WorkspaceProvider). */}
      <div className="mb-2 flex flex-wrap items-center gap-1 px-1">
        {['all', ...HISTORY_KINDS].map((kind) => (
          <button
            key={kind}
            type="button"
            aria-pressed={historyFilter.kind === kind}
            onClick={() => setHistoryFilter({ kind })}
            className={cn(
              'flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-medium transition-colors',
              historyFilter.kind === kind ? 'bg-white/[0.1] text-white' : 'text-slate-500 hover:text-slate-200'
            )}
          >
            {kind !== 'all' && <KindBadge kind={kind} />}
            {kind === 'all' ? 'All kinds' : KIND_LABEL[kind]}
          </button>
        ))}
        {targets.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                'ml-auto flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-medium transition-colors',
                historyFilter.target !== 'all' ? 'bg-white/[0.1] text-white' : 'text-slate-500 hover:text-slate-200'
              )}
            >
              <span className="max-w-24 truncate font-mono">{historyFilter.target === 'all' ? 'All files' : historyFilter.target}</span>
              <ChevronDown className="size-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => setHistoryFilter({ target: 'all' })}>All files</DropdownMenuItem>
              {targets.map((target) => (
                <DropdownMenuItem key={target} onClick={() => setHistoryFilter({ target })} className="font-mono">
                  {target}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

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

      {tab === 'active' && active.length === 0 && (
        <p role="status" className="px-2.5 py-8 text-center text-xs text-slate-500">
          {query.trim() ? 'No matching checkpoints.' : filtersActive ? 'No checkpoints match this filter.' : 'No checkpoints yet.'}
        </p>
      )}
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
                  <KindBadge kind={entry.kind} />
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
                {historyMeta(entry, currentUser.id) && (
                  <span className="mt-0.5 block truncate text-[11px] text-slate-500" title={historyMeta(entry, currentUser.id)}>
                    {historyMeta(entry, currentUser.id)}
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
          <p role="status" className="px-2.5 py-8 text-center text-xs text-slate-500">{query.trim() ? 'No matching archived checkpoints.' : 'No archived checkpoints.'}</p>
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
