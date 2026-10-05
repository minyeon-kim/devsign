import { toast } from '@/i18n/toast'
import { useHistoryPlayback } from '@/components/history/useHistoryPlayback'
import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import HistoryCompare from '@/components/history/HistoryCompare'
import HistoryTimeline from '@/components/history/HistoryTimeline'
import RollbackCheckpointModal from '@/components/history/RollbackCheckpointModal'
import { useSelectedCheckpoint } from '@/components/history/useSelectedCheckpoint'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { KIND_LABEL, filterHistoryEntries } from '@/lib/historyMeta'
import { branchColors, foldConflictCheckpoints, withBranches } from '@/lib/historyBranches'

// History — the project's version control as checkpoints (Replit style),
// in two columns: the checkpoint list in the drawer beside it (which opens
// with this page, see AppShell / HistoryDrawer) and, here, one full-width
// viewer of the selected version — its code (an inline diff against the
// latest with "Compare latest" on, the plain file with it off) or its
// canvas — with the version slider and ▶ playback pinned to the bottom.
// The list, the slider, ← / → and playback all move the same selection
// (the URL's `?v=`). "Rollback here" opens the "Rollback to checkpoint"
// dialog; rollbacks never erase anything — the restored state lands on top
// as a new checkpoint.
function HistoryPage() {
  const { project } = useOutletContext()
  const { historyEntries, conflicts, activeHistoryId, historyFilter, archiveHistoryEntry, restoreHistoryEntry } = useWorkspace()
  const [selectedId, select] = useSelectedCheckpoint()
  const [rollbackId, setRollbackId] = useState(null)
  const [compareLatest, setCompareLatest] = useState(true)

  // Each checkpoint with its branch and that branch's color — the same
  // ones the drawer's graph uses (lib/historyBranches).
  const branched = useMemo(() => {
    // Saved versions only — a conflict's detection is a mark on a version,
    // not a step of its own (as in the drawer's graph).
    const entries = foldConflictCheckpoints(withBranches(historyEntries, conflicts))
    const colors = branchColors(entries)
    return entries.map((entry) => ({ ...entry, branchColor: colors.get(entry.branch) }))
  }, [historyEntries, conflicts])
  const selectedBranch = branched.find((entry) => entry.id === selectedId)

  // The timeline runs oldest → newest over the active checkpoints — filtered
  // the same way as the History drawer's list (see `historyFilter`), so
  // narrowing to one file or kind there also narrows what plays back here.
  const timeline = useMemo(
    () => filterHistoryEntries(branched.filter((e) => !e.archived), historyFilter),
    [branched, historyFilter]
  )
  const scopeLabel = historyFilter.target !== 'all' && historyFilter.kind !== 'all'
    ? `${KIND_LABEL[historyFilter.kind]} · ${historyFilter.target}`
    : historyFilter.target !== 'all'
      ? historyFilter.target
      : historyFilter.kind !== 'all'
        ? KIND_LABEL[historyFilter.kind]
        : null
  const timelineIndex = timeline.findIndex((e) => e.id === selectedId)

  const { playing, pause, toggle, advance } = useHistoryPlayback(timeline, selectedId, select)

  function selectVersion(id) {
    pause()
    select(id)
  }

  // ← / → step through versions anywhere on the page (not while typing,
  // on the slider itself, or with a dialog open).
  useEffect(() => {
    function onKey(event) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return
      if (event.target.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="slider"]')) return
      const from = timelineIndex === -1 ? timeline.length - 1 : timelineIndex
      const next = timeline[from + (event.key === 'ArrowRight' ? 1 : -1)]
      if (!next) return
      event.preventDefault()
      selectVersion(next.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
      <div className="shrink-0 border-b px-6 py-4">
        <div className="flex items-center gap-2 text-[15px] font-semibold">
          <span className="max-w-[240px] min-w-0 truncate text-muted-foreground">{project.name}</span>
          <span className="font-normal text-muted-foreground/60">/</span>
          <span className="text-foreground">History</span>
          <span className="ml-2 text-xs font-normal text-slate-500">{timeline.length} checkpoints</span>
        </div>
        {/* Every file/element this project touched shares one timeline —
            this line says whether that's what's currently playing back, or
            just the slice the History drawer's filters narrowed it to. */}
        <p className="mt-1 text-xs text-slate-500">
          {scopeLabel ? (
            <>Showing <span className="font-medium text-slate-300">{scopeLabel}</span> — every other checkpoint is filtered out of this playback.</>
          ) : (
            'Every checkpoint across every file in this project, oldest to newest. Filter by kind or file from the History drawer.'
          )}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div className="min-h-0 flex-1">
          <HistoryCompare
            entryId={selectedId}
            branch={selectedBranch ? { name: selectedBranch.branch, color: selectedBranch.branchColor } : null}
            compareLatest={compareLatest}
            // Restore sits up in the viewer's header, with the checkpoint
            // it applies to — not down at the end of the playback bar.
            onRollback={(id) => {
              pause()
              setRollbackId(id)
            }}
            onArchive={(entry) => {
              pause()
              archiveHistoryEntry(entry.id)
              toast('Checkpoint archived', { description: entry.label, action: { label: 'Undo', onClick: () => restoreHistoryEntry(entry.id) } })
            }}
            onUnarchive={(entry) => {
              pause()
              restoreHistoryEntry(entry.id)
              toast('Checkpoint restored to History', { description: entry.label })
            }}
            playing={playing}
            baseEntryId={timeline[timelineIndex - 1]?.id}
            onStepDone={advance}
            position={timelineIndex >= 0 ? { index: timelineIndex, total: timeline.length } : null}
          />
        </div>
        <HistoryTimeline
          entries={timeline}
          selectedId={selectedId}
          onSelect={selectVersion}
          playing={playing}
          onTogglePlay={toggle}
          compareLatest={compareLatest}
          onCompareLatestChange={setCompareLatest}
          isCurrent={selectedId === activeHistoryId}
          hideRestore
        />
      </div>

      <RollbackCheckpointModal
        key={rollbackId}
        entryId={rollbackId}
        onOpenChange={(open) => !open && setRollbackId(null)}
        onDone={(entry, restoredId) => {
          select(restoredId ?? entry.id)
        }}
      />
    </div>
  )
}

export default HistoryPage
