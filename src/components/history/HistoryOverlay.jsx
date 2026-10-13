import { toast } from '@/i18n/toast'
import { useHistoryPlayback } from '@/components/history/useHistoryPlayback'
import { useEffect, useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import Breadcrumb, { BreadcrumbBar, projectCrumbs } from '@/components/layout/Breadcrumb'
import HistoryCompare from '@/components/history/HistoryCompare'
import HistoryTimeline from '@/components/history/HistoryTimeline'
import RollbackCheckpointModal from '@/components/history/RollbackCheckpointModal'
import { useSelectedCheckpoint } from '@/components/history/useSelectedCheckpoint'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { KIND_LABEL, filterHistoryEntries } from '@/lib/historyMeta'
import { branchColors, foldConflictCheckpoints, withBranches } from '@/lib/historyBranches'
import { projects } from '@/data/mockData'

// History — the project's version control as checkpoints (Replit style) —
// as a layer over the Workspace (the address's `?history`, lib/historyLink),
// the way a change's detail and Docs are. Two columns: the checkpoint list in
// the drawer beside it (which opens with the layer, see HistoryDrawer) and,
// here, one viewer of the selected version — its code (an inline diff against the
// latest with "Compare latest" on, the plain file with it off) or its
// canvas — with the version slider and ▶ playback pinned to the bottom.
// The list, the slider, ← / → and playback all move the same selection
// (the address's `?history=<id>`). "Rollback here" opens the "Rollback to checkpoint"
// dialog; rollbacks never erase anything — the restored state lands on top
// as a new checkpoint.
// (Mounted only while the layer is open: nothing here runs — no keys, no playback — when it isn't.)
function HistoryLayer() {
  const { projectId, historyEntries, conflicts, activeHistoryId, historyFilter, archiveHistoryEntry, restoreHistoryEntry } = useWorkspace()
  const project = projects.find((candidate) => candidate.id === projectId) ?? { id: projectId, name: projectId }
  const [selectedId, select] = useSelectedCheckpoint()
  const [rollbackId, setRollbackId] = useState(null)
  // What the checkpoint in view is compared with — the one before it, or the
  // current version. One state for the whole viewer (its change line, its
  // renders, its code), kept as checkpoints are stepped through.
  const [baseline, setBaseline] = useState('previous')

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
    <div data-history-overlay role="dialog" aria-label="History" className="absolute inset-0 z-[650] flex min-h-0 flex-col overflow-hidden bg-card text-foreground animate-in fade-in duration-150 motion-reduce:animate-none">
      {/* The path, and how many versions. What the page is sits behind the
          ⓘ; a filter narrowing the playback says so here. */}
      <BreadcrumbBar data-history-title>
        <Breadcrumb
          items={[...projectCrumbs(project), { label: 'History' }]}
          meta={(
            <>
              <span>{`${timeline.length} checkpoints`}</span>
              <span data-history-info tabIndex={0} role="img" aria-label="Every checkpoint across every file in this project, oldest to newest. Filter by kind or file from the History drawer." title="Every checkpoint across every file in this project, oldest to newest. Filter by kind or file from the History drawer." className="flex size-4 shrink-0 cursor-help items-center justify-center rounded-full hover:text-white">
                <Info className="size-3" />
              </span>
              {scopeLabel && (
                <span data-history-scope title="Every other checkpoint is filtered out of this playback." className="inline-flex h-4 items-center rounded-full bg-amber-400/15 px-1.5 text-amber-200">
                  {scopeLabel}
                </span>
              )}
            </>
          )}
        />
      </BreadcrumbBar>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div className="min-h-0 flex-1">
          <HistoryCompare
            entryId={selectedId}
            branch={selectedBranch ? { name: selectedBranch.branch, color: selectedBranch.branchColor } : null}
            baseline={baseline}
            onBaselineChange={setBaseline}
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

// The layer itself: there when the address names History.
function HistoryOverlay() {
  const { historyOpen } = useWorkspace()
  return historyOpen ? <HistoryLayer /> : null
}

export default HistoryOverlay
