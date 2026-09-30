import { useHistoryPlayback } from '@/components/history/useHistoryPlayback'
import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { toast } from '@/i18n/toast'
import HistoryCompare from '@/components/history/HistoryCompare'
import HistoryTimeline from '@/components/history/HistoryTimeline'
import RollbackCheckpointModal from '@/components/history/RollbackCheckpointModal'
import { useSelectedCheckpoint } from '@/components/history/useSelectedCheckpoint'
import { useWorkspace } from '@/state/WorkspaceProvider'

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
  const { historyEntries, activeHistoryId } = useWorkspace()
  const [selectedId, select] = useSelectedCheckpoint()
  const [rollbackId, setRollbackId] = useState(null)
  const [compareLatest, setCompareLatest] = useState(true)

  // The timeline runs oldest → newest over the active checkpoints.
  const timeline = useMemo(() => historyEntries.filter((e) => !e.archived), [historyEntries])
  const timelineIndex = timeline.findIndex((e) => e.id === selectedId)

  const { playing, pause, toggle } = useHistoryPlayback(timeline, selectedId, select)

  function togglePlay() {
    // Replay shows each checkpoint itself, instead of keeping the latest
    // canvas selected in the comparison view.
    if (!playing) setCompareLatest(false)
    toggle()
  }

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
      <div className="flex shrink-0 items-center gap-2 border-b px-6 py-4 text-[15px] font-semibold">
        <span className="max-w-[240px] min-w-0 truncate text-muted-foreground">{project.name}</span>
        <span className="font-normal text-muted-foreground/60">/</span>
        <span className="text-foreground">History</span>
        <span className="ml-2 text-xs font-normal text-slate-500">{timeline.length} checkpoints</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div className="min-h-0 flex-1">
          <HistoryCompare entryId={selectedId} compareLatest={compareLatest} hideRestore />
        </div>
        <HistoryTimeline
          entries={timeline}
          selectedId={selectedId}
          onSelect={selectVersion}
          playing={playing}
          onTogglePlay={togglePlay}
          compareLatest={compareLatest}
          onCompareLatestChange={setCompareLatest}
          isCurrent={selectedId === activeHistoryId}
          onRestore={() => {
            pause()
            setRollbackId(selectedId)
          }}
        />
      </div>

      <RollbackCheckpointModal
        key={rollbackId}
        entryId={rollbackId}
        onOpenChange={(open) => !open && setRollbackId(null)}
        onDone={(entry, restoredId) => {
          select(restoredId ?? entry.id)
          toast('Rolled back to checkpoint', { description: `${entry.label} — saved as a new checkpoint` })
        }}
      />
    </div>
  )
}

export default HistoryPage
