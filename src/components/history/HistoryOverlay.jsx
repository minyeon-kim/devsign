import { toast } from '@/i18n/toast'
import { useHistoryPlayback } from '@/components/history/useHistoryPlayback'
import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from 'cn'
import Breadcrumb, { BREADCRUMB_COLUMN, BreadcrumbBar } from '@/components/layout/Breadcrumb'
import { translateText } from '@/i18n/translate'
import { useLanguage } from '@/i18n/language'
import HistoryCompare from '@/components/history/HistoryCompare'
import HistoryTimeline from '@/components/history/HistoryTimeline'
import RollbackCheckpointModal from '@/components/history/RollbackCheckpointModal'
import { useSelectedCheckpoint } from '@/components/history/useSelectedCheckpoint'
import { useWorkspace } from '@/state/WorkspaceProvider'
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
  const { closeHistory, requestHistoryDrawer, historyEntries, conflicts, historyFilter, archiveHistoryEntry, restoreHistoryEntry } = useWorkspace()
  const language = useLanguage()
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
    <div data-history-overlay role="dialog" aria-label="History" className="absolute inset-0 z-[650] flex min-h-0 flex-col overflow-hidden bg-card text-foreground animate-in fade-in duration-150 motion-reduce:animate-none">
      {/* The same top bar as the other layers: against the top, a 48px row in a
          64px place, Close at its right. The path says where this is —
          워크스페이스 › 히스토리 — its first item going where Close goes; "히스토리"
          is where you are, and pressing it brings the drawer up when it's been
          closed. Nothing after the path: how many versions there are, and the
          filter narrowing the playback, are the drawer's to say. */}
      <BreadcrumbBar data-history-title className="h-16 pt-0" rowClassName="h-12">
        <Breadcrumb
          items={[{ label: 'Workspace', onClick: closeHistory }, { label: 'History', onClick: requestHistoryDrawer }]}
        />
        <button
          ref={closeRef}
          type="button"
          data-history-overlay-close
          aria-label="Close"
          title={`${translateText('Close', language)} · Esc`}
          onClick={closeHistory}
          className="ds-intrinsic ml-auto flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300"
        >
          <X className="size-4" />
        </button>
      </BreadcrumbBar>

      {/* The viewer and the timeline, in the page's column: the same left line as the path, starting 8px
          under the bar — where a change's detail has its title row. The viewer takes the height that's
          left; the timeline stays at the foot. */}
      <div data-history-body className={cn(BREADCRUMB_COLUMN, 'flex min-h-0 flex-1 flex-col gap-3 pt-2 pb-4')}>
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
