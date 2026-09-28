import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useOutletContext } from 'react-router-dom'
import { toast } from 'sonner'
import { Archive, ArchiveRestore, Eye, FileCode2, History, RotateCcw, Sparkles } from 'lucide-react'
import { cn } from 'cn'
import HistoryCompare from '@/components/history/HistoryCompare'
import HistoryTimeline from '@/components/history/HistoryTimeline'
import RollbackCheckpointModal from '@/components/history/RollbackCheckpointModal'
import {
  ACCENT_SOFT,
  CATEGORY_TAB,
  CATEGORY_TAB_ACTIVE,
  CATEGORY_TAB_IDLE,
  GHOST_BUTTON,
} from '@/components/mergestudio/floatingStyles'
import { diffStats } from '@/lib/lineDiff'
import { useWorkspace } from '@/state/WorkspaceProvider'

// One checkpoint: what it was, when, how far its code is from now, and
// "Rollback here" (which asks for confirmation first). Clicking the card
// previews it in the pane beside the list.
function CheckpointCard({ entry, current, selected, highlighted, stats, fileName, onPreview, onRollback, onArchive, cardRef }) {
  return (
    <article
      ref={cardRef}
      onClick={onPreview}
      className={cn(
        'group cursor-pointer rounded-2xl p-4 transition-colors',
        highlighted ? 'bg-emerald-400/[0.07] ring-1 ring-emerald-400/30' : selected ? 'bg-white/[0.06]' : 'bg-white/[0.03] hover:bg-white/[0.045]'
      )}
    >
      <div className="flex items-center gap-2 text-[11px] text-slate-500">
        <span className="flex items-center gap-1 font-medium text-slate-400">
          <History className="size-3.5" />
          Checkpoint
        </span>
        <span>·</span>
        <span className="tabular-nums">{entry.timestamp}</span>
        {current && <span className={cn('rounded-full px-1.5 py-px text-[10px] font-semibold', ACCENT_SOFT)}>Current</span>}
      </div>

      <p className="mt-1.5 flex items-start gap-1.5 text-[14px] font-medium text-white">
        {entry.prompt && <Sparkles className="mt-0.5 size-3.5 shrink-0 text-emerald-300" />}
        <span className="min-w-0">{entry.label}</span>
      </p>
      {entry.prompt && <p className="mt-1 truncate text-xs text-slate-500">“{entry.prompt}”</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-lg bg-black/20 px-2 py-1 font-mono text-[11px] text-slate-400">
          <FileCode2 className="size-3 shrink-0" />
          {fileName}
          {!current && (
            <>
              <span className="text-emerald-300">+{stats.added}</span>
              <span className="text-red-300">−{stats.removed}</span>
            </>
          )}
        </span>

        <div className="ml-auto flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {!current && (
            <button
              type="button"
              title="Archive this checkpoint"
              aria-label="Archive this checkpoint"
              onClick={onArchive}
              className="flex size-8 items-center justify-center rounded-full text-slate-500 opacity-0 transition-[opacity,color] group-hover:opacity-100 hover:bg-white/[0.06] hover:text-white focus-visible:opacity-100"
            >
              <Archive className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onPreview}
            className={cn('inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium', GHOST_BUTTON)}
          >
            <Eye className="size-3.5" />
            Preview
          </button>
          <button
            type="button"
            disabled={current}
            onClick={onRollback}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors',
              current ? 'bg-white/[0.04] text-slate-500' : 'bg-white text-slate-950 hover:bg-slate-200'
            )}
          >
            <RotateCcw className="size-3.5" />
            {current ? 'You’re here' : 'Rollback here'}
          </button>
        </div>
      </div>
    </article>
  )
}

// History — the project's version control as checkpoints (Replit style):
// every saved state is a card with "Rollback here", which opens the
// "Rollback to checkpoint" dialog (target, preview, and what gets rolled
// back). Selecting a card previews it against the current version in the
// pane beside the list, with a version slider under it to scrub or play
// back the history, and a "Compare latest" toggle between an inline diff
// and the plain file at that version. Rollbacks never erase anything: the
// restored state lands on top as a new checkpoint.
function HistoryPage() {
  const { project } = useOutletContext()
  const location = useLocation()
  const { historyEntries, activeHistoryId, archiveHistoryEntry, restoreHistoryEntry, getFileName } = useWorkspace()
  const highlightId = location.state?.highlightId
  const [selectedId, setSelectedId] = useState(highlightId ?? activeHistoryId)
  const [rollbackId, setRollbackId] = useState(null)
  const [tab, setTab] = useState(() => (historyEntries.find((e) => e.id === highlightId)?.archived ? 'archived' : 'active'))

  const current = historyEntries.find((e) => e.id === activeHistoryId)
  const active = [...historyEntries].filter((e) => !e.archived).reverse()
  const archived = [...historyEntries].filter((e) => e.archived).reverse()

  const refs = useRef(new Map())
  useEffect(() => {
    if (highlightId) refs.current.get(highlightId)?.scrollIntoView({ block: 'center' })
  }, [highlightId])

  // The timeline runs oldest → newest over the active checkpoints.
  const timeline = useMemo(() => historyEntries.filter((e) => !e.archived), [historyEntries])
  const [compareLatest, setCompareLatest] = useState(true)
  const [playing, setPlaying] = useState(false)

  // Keep the list following the scrubber / playback.
  useEffect(() => {
    refs.current.get(selectedId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedId])

  // Playback: step forward one version at a time like a timelapse, and stop
  // on the latest. Playing from the end starts over from the first.
  const timelineIndex = timeline.findIndex((e) => e.id === selectedId)
  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(() => {
      const next = timeline[timelineIndex + 1]
      if (next) setSelectedId(next.id)
      else setPlaying(false)
    }, 900)
    return () => clearTimeout(timer)
  }, [playing, timelineIndex, timeline])

  function togglePlay() {
    if (!playing && timelineIndex >= timeline.length - 1 && timeline[0]) setSelectedId(timeline[0].id)
    setPlaying((p) => !p)
  }

  function selectVersion(id) {
    setPlaying(false)
    setSelectedId(id)
  }

  // ← / → step through versions anywhere on the page (not while typing,
  // on the slider itself, or with a dialog open).
  useEffect(() => {
    function onKey(event) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return
      const t = event.target
      if (t.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="slider"]')) return
      const i = timeline.findIndex((e) => e.id === selectedId)
      const from = i === -1 ? timeline.length - 1 : i
      const next = timeline[from + (event.key === 'ArrowRight' ? 1 : -1)]
      if (!next) return
      event.preventDefault()
      selectVersion(next.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function archive(entry) {
    archiveHistoryEntry(entry.id)
    toast('Checkpoint archived', { description: entry.label, action: { label: 'Undo', onClick: () => restoreHistoryEntry(entry.id) } })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
      <div className="flex shrink-0 items-center gap-2 border-b px-6 py-4 text-[15px] font-semibold">
        <span className="max-w-[240px] min-w-0 truncate text-muted-foreground">{project.name}</span>
        <span className="font-normal text-muted-foreground/60">/</span>
        <span className="text-foreground">History</span>
        <span className="ml-2 text-xs font-normal text-slate-500">{active.length} checkpoints</span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 px-6 py-5 lg:grid-cols-[minmax(360px,520px)_1fr]">
        <div className="flex min-h-0 flex-col">
          <div className="mb-3 flex shrink-0 items-center gap-1" role="tablist" aria-label="Checkpoints">
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
                className={cn(CATEGORY_TAB, 'gap-1.5', tab === id ? CATEGORY_TAB_ACTIVE : CATEGORY_TAB_IDLE)}
              >
                {label}
                <span className="text-[10px] text-slate-500 tabular-nums">{count}</span>
              </button>
            ))}
          </div>

          <div className="-mr-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-2">
            {tab === 'active' &&
              active.map((entry) => (
                <CheckpointCard
                  key={entry.id}
                  cardRef={(el) => (el ? refs.current.set(entry.id, el) : refs.current.delete(entry.id))}
                  entry={entry}
                  current={entry.id === activeHistoryId}
                  selected={entry.id === selectedId}
                  highlighted={entry.id === highlightId}
                  stats={diffStats(current?.snapshot.lines, entry.snapshot.lines)}
                  fileName={getFileName(entry.snapshot.fileId)}
                  onPreview={() => selectVersion(entry.id)}
                  onRollback={() => setRollbackId(entry.id)}
                  onArchive={() => archive(entry)}
                />
              ))}
            {tab === 'archived' &&
              (archived.length === 0 ? (
                <p className="rounded-2xl bg-white/[0.03] px-4 py-10 text-center text-xs text-slate-500">No archived checkpoints.</p>
              ) : (
                archived.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.03] px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-slate-300">{entry.label}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">{entry.timestamp}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        restoreHistoryEntry(entry.id)
                        toast('Checkpoint restored to History', { description: entry.label })
                      }}
                      className={cn('inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium', GHOST_BUTTON)}
                    >
                      <ArchiveRestore className="size-3.5" />
                      Restore
                    </button>
                  </div>
                ))
              ))}
          </div>
        </div>

        <div className="hidden min-h-0 lg:block">
          <HistoryCompare
            entryId={selectedId}
            onRollback={(id) => {
              setPlaying(false)
              setRollbackId(id)
            }}
            compareLatest={compareLatest}
            onCompareLatestChange={setCompareLatest}
            footer={
              <HistoryTimeline
                entries={timeline}
                selectedId={selectedId}
                onSelect={selectVersion}
                playing={playing}
                onTogglePlay={togglePlay}
              />
            }
          />
        </div>
      </div>

      <RollbackCheckpointModal
        key={rollbackId}
        entryId={rollbackId}
        onOpenChange={(open) => !open && setRollbackId(null)}
        onDone={(entry, restoredId) => {
          setSelectedId(restoredId ?? entry.id)
          toast('Rolled back to checkpoint', { description: `${entry.label} — saved as a new checkpoint` })
        }}
      />
    </div>
  )
}

export default HistoryPage
