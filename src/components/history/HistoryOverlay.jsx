import { toast } from '@/i18n/toast'
import { useHistoryPlayback } from '@/components/history/useHistoryPlayback'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from 'cn'
import { BREADCRUMB_COLUMN } from '@/components/layout/Breadcrumb'
import HistoryCompare from '@/components/history/HistoryCompare'
import HistoryTimeline from '@/components/history/HistoryTimeline'
import RollbackCheckpointModal from '@/components/history/RollbackCheckpointModal'
import { useSelectedCheckpoint } from '@/components/history/useSelectedCheckpoint'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { useLayerFrame } from '@/lib/useMainWindowFrame'
import { filterHistoryEntries } from '@/lib/historyMeta'
import { branchColors, foldConflictCheckpoints, withBranches } from '@/lib/historyBranches'

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
  const { aiChat, closeHistory, historyEntries, conflicts, historyFilter, archiveHistoryEntry, restoreHistoryEntry } = useWorkspace()
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

  // Esc closes the layer — at once, playing or not (playback stops with it) — unless a
  // dialog (the rollback confirmation), a menu or a listbox opened inside is up: that
  // goes first. Focus comes in on Close, and goes back to where it was on closing.
  const closeRef = useRef(null)
  // (Where the canvas's zoom goes: the foot's capsule.)
  const [zoomSlot, setZoomSlot] = useState(null)
  // (In the main window's place: AI Chat beside it stays — useLayerFrame.)
  const [layerRef, layerStyle] = useLayerFrame([aiChat.open])
  const close = useRef(closeHistory)
  useEffect(() => { close.current = closeHistory })
  useEffect(() => {
    const before = document.activeElement
    closeRef.current?.focus()
    function onKey(event) {
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('[data-slot="dialog-content"], [role="menu"], [role="listbox"]')) return
      // (Esc in the drawer's search clears the search.)
      if (event.target instanceof HTMLInputElement && event.target.type === 'search' && event.target.value) return
      close.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (before instanceof HTMLElement && before.isConnected) before.focus()
    }
  }, [])

  return (
    // (In the canvas window's place — under the app's top bar, 8px in from the right and the bottom, the windows'
    // 24px corners — not over the whole screen: the path, the search and the bell stay, as for any other view.)
    <div ref={(element) => { closeRef.current = element; layerRef.current = element }} style={layerStyle} tabIndex={-1} data-history-overlay role="dialog" aria-label="History" className="absolute top-[var(--ds-chrome-size)] right-2 bottom-2 left-0 z-[650] flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-white/10 bg-card outline-none text-foreground animate-in fade-in duration-150 motion-reduce:animate-none">
      {/* (No bar of its own: the app's top bar says where this is — … › 워크스페이스 › 히스토리, 워크스페이스
          closing it — and Esc closes it too.) */}

      {/* The viewer and the timeline, in the page's column: the same left line as the path, starting 8px
          under the bar — where a change's detail has its title row. The viewer takes the height that's
          left; the timeline stays at the foot. */}
      <div data-history-body className={cn(BREADCRUMB_COLUMN, 'relative flex min-h-0 flex-1 flex-col gap-3 pt-6 pb-4')}>
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
            zoomSlot={zoomSlot}
          />
        </div>
        {/* The foot: one capsule at the centre — play, ‹ n / total ›, and the canvas's zoom. (The list at the left is
            the timeline: no slider of dots to say it again.) */}
        <div className="flex shrink-0 justify-center">
          <HistoryTimeline
            capsule
            entries={timeline}
            selectedId={selectedId}
            onSelect={selectVersion}
            playing={playing}
            onTogglePlay={toggle}
          >
            <span ref={setZoomSlot} data-history-zoom className="flex items-center empty:hidden" />
          </HistoryTimeline>
        </div>
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
