import { useCallback, useMemo, useRef, useState } from 'react'
import { Code2, GitCompareArrows, RotateCcw, Sparkles } from 'lucide-react'
import { cn } from 'cn'
import { toast } from '@/i18n/toast'
import { ACCENT_CTA, FLOATING_PANEL, PANEL_RADIUS } from '@/components/mergestudio/floatingStyles'
import PreviewPanelContent from '@/components/dockview/panels/PreviewPanelContent'
import SplitHandle from '@/components/layout/SplitHandle'
import PlaybackCode, { GUTTER } from '@/components/history/PlaybackCode'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { diffLines } from '@/lib/lineDiff'
import { historyMeta } from '@/lib/historyMeta'
import { deriveComponentOverride } from '@/lib/prototypeSync'

const ROW_TONES = {
  same: 'text-slate-500',
  add: 'bg-emerald-500/[0.18] text-emerald-300',
  remove: 'bg-red-500/[0.18] text-red-300',
}
const ROW_MARKS = { same: ' ', add: '+', remove: '−' }
const MIN_CODE = 280
const MIN_CANVAS = 260

function snapshotLines(snapshot) {
  if (!snapshot) return []
  const exact = snapshot.fileId ? snapshot.files?.[snapshot.fileId] : null
  if (Array.isArray(exact)) return exact
  const available = Object.values(snapshot.files ?? {}).find(Array.isArray)
  return available ?? snapshot.lines ?? []
}

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
// The code and the design as it rendered at that version sit side by side,
// split by a draggable handle, so a change reads in both at a glance.
// `hideRestore` drops the header's restore button when the caller has its
// own (History's control bar).
// Playback (`playing`, with `baseEntryId` and `onStepDone`): this is the
// checkpoint being played. Whatever "Compare latest" says, the code types
// its way from the checkpoint before it (`baseEntryId`) to this one
// (PlaybackCode); the preview holds the previous checkpoint's state until
// the typing is in, then switches to this checkpoint's own recorded
// preview values, the element that changed ringed for a moment. Half a
// second later `onStepDone` moves on to the next checkpoint.
// `position` ({ index, total }) feeds the temporary debug readout.
function HistoryCompare({ entryId, onRollback, compareLatest = true, onCompareLatestChange, footer, hideRestore = false, playing = false, baseEntryId, onStepDone, branch, position }) {
  const { historyEntries, activeHistoryId, rollbackTo, getFileName, currentUser, projectId } = useWorkspace()
  // The code pane's width in px (null = its default share); the canvas
  // takes the rest.
  const [codeWidth, setCodeWidth] = useState(null)
  const splitRef = useRef(null)
  const codeRef = useRef(null)
  const dragStart = useRef(0)
  const resizeCode = (width) => {
    const total = splitRef.current?.clientWidth ?? 0
    setCodeWidth(Math.max(MIN_CODE, Math.min(total - MIN_CANVAS, width)))
  }
  const entry = historyEntries.find((h) => h.id === entryId)
  const current = historyEntries.find((h) => h.id === activeHistoryId)
  const isCurrent = entryId === activeHistoryId
  const baseEntry = playing ? historyEntries.find((h) => h.id === baseEntryId) ?? null : null
  // Which checkpoint's typing has finished (the preview switches then).
  const [typedId, setTypedId] = useState(null)
  const typed = typedId === entryId
  const diffBase = current

  const rows = useMemo(
    () => (entry && diffBase ? diffLines(snapshotLines(diffBase.snapshot), snapshotLines(entry.snapshot)) : []),
    [entry, diffBase]
  )
  // Playback shows the code itself, being typed — no diff against latest.
  const showDiff = compareLatest && Boolean(diffBase) && !playing && !isCurrent
  const codeRows = useMemo(() => {
    const source = showDiff ? rows : snapshotLines(entry?.snapshot).map((text) => ({ kind: 'same', text }))
    // Old (latest) / new (this version) line numbers, like a split gutter.
    let a = 0
    let b = 0
    return source.map((row) => ({
      ...row,
      from: row.kind === 'add' ? null : ++a,
      to: row.kind === 'remove' ? null : ++b,
    }))
  }, [showDiff, rows, entry])
  // Playing: the checkpoint before this one until its code is typed in,
  // then this one. Otherwise the latest (comparing) or this version.
  const shownSnapshot = playing ? (baseEntry && !typed ? baseEntry : entry) : showDiff ? diffBase : entry
  // A checkpoint about another file doesn't say what the screen looked
  // like, so its design is the last one before it that does — otherwise
  // the preview would snap back to the default between steps.
  const shownEdits = useMemo(() => {
    const upTo = historyEntries.findIndex((h) => h.id === shownSnapshot?.id)
    for (let i = upTo; i >= 0; i--) {
      const { snapshot } = historyEntries[i]
      const edits = snapshot.prototypeEdits ?? deriveComponentOverride(projectId, snapshot.fileId, snapshotLines(snapshot))
      if (edits) return edits
    }
    return {}
  }, [historyEntries, shownSnapshot?.id, projectId])

  const playFrom = useMemo(() => snapshotLines((baseEntry ?? entry)?.snapshot), [baseEntry, entry])
  const playTo = useMemo(() => snapshotLines(entry?.snapshot), [entry])
  const handleTyped = useCallback(() => setTypedId(entryId), [entryId])
  // What the step changed in the preview: its recorded values differ from
  // the previous checkpoint's — the element they belong to gets the ring.
  const shownProps = shownSnapshot?.snapshot.previewProps ?? {}
  const changedProps = playing && typed && baseEntry
    && JSON.stringify(baseEntry.snapshot.previewProps ?? {}) !== JSON.stringify(entry?.snapshot.previewProps ?? {})
  const highlightLayerId = changedProps ? entry.snapshot.selectedLayerId ?? null : null

  if (!entry) {
    return (
      <div className="flex h-full items-center justify-center rounded-[20px] bg-white/[0.03] text-xs text-slate-500">
        Select a version to compare it with the current one.
      </div>
    )
  }

  const added = rows.filter((r) => r.kind === 'add').length
  const removed = rows.filter((r) => r.kind === 'remove').length
  const propChanges = diffBase
    ? Object.keys({ ...diffBase.snapshot.previewProps, ...entry.snapshot.previewProps }).filter(
        (key) => diffBase.snapshot.previewProps?.[key] !== entry.snapshot.previewProps?.[key]
      )
    : []
  const conflictDelta = (entry.snapshot.conflicts?.length ?? 0) - (diffBase?.snapshot.conflicts?.length ?? 0)

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
          <p className="flex items-center gap-2 text-[11px] text-slate-500 tabular-nums">
            {entry.timestamp}
            {/* The branch this checkpoint is on, in its graph color. */}
            {branch && (
              <span translate="no" className="inline-flex h-5 items-center gap-1.5 rounded-full px-2 font-mono text-[10.5px] font-medium" style={{ color: branch.color, background: `${branch.color}1f` }}>
                <span className="size-1.5 rounded-full" style={{ background: branch.color }} />
                {branch.name}
              </span>
            )}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] font-semibold text-white">
            {entry.prompt && <Sparkles className="size-3.5 shrink-0 text-emerald-300" />}
            {entry.label}
          </p>
          {historyMeta(entry, currentUser.id) && <p className="mt-0.5 truncate text-[11px] text-slate-400">{historyMeta(entry, currentUser.id)}</p>}
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
            <GitCompareArrows className="size-3" />
            {!playing && isCurrent ? (
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
          {!hideRestore && (
          <button
            type="button"
            onClick={handleRestore}
            disabled={isCurrent}
            className={cn(
              'ds-pill inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold',
              ACCENT_CTA,
              'disabled:bg-white/[0.06] disabled:text-slate-500 disabled:shadow-none'
            )}
          >
            <RotateCcw className="size-3.5" />
            {isCurrent ? 'Current' : onRollback ? 'Rollback here' : 'Restore this version'}
          </button>
          )}
        </div>
      </div>

      <div ref={splitRef} className="mx-3 mb-3 flex min-h-0 flex-1">
        <div
          ref={codeRef}
          style={{ width: codeWidth ?? '58%', maxWidth: `calc(100% - ${MIN_CANVAS}px)` }}
          className="flex min-w-0 shrink-0 flex-col overflow-hidden rounded-xl bg-black/20"
        >
          <p className="flex shrink-0 items-center gap-1.5 px-3 pt-2 pb-1 font-mono text-[11px] text-slate-500">
            <Code2 className="size-3" />
            {getFileName(entry.snapshot.fileId)}
          </p>
          <div className="min-h-0 flex-1 overflow-auto pb-2 font-mono text-[12px] leading-5">
            {showDiff && rows.every((r) => r.kind === 'same') && (
              <p className="px-3 pb-2 font-sans text-xs text-slate-500">No code changes between this version and the latest.</p>
            )}
            {playing ? (
              // Keyed to the checkpoint: each step starts from the one
              // before it, exactly, and ends on this one, exactly.
              <PlaybackCode key={entryId} from={playFrom} to={playTo} onTyped={handleTyped} onDone={onStepDone} />
            ) : codeRows.map((row, index) => (
              <div
                key={index}
                className={cn(
                  'flex min-w-0 py-px pr-3 whitespace-pre-wrap [word-break:break-all]',
                  showDiff ? ROW_TONES[row.kind] : 'text-slate-300'
                )}
              >
                {/* Numbers in about 32px, 12px before the code. Comparing
                    with the latest adds the other side's number and the
                    +/− mark. */}
                {showDiff && <span className="w-7 shrink-0 text-right text-[11px] text-slate-600 tabular-nums select-none">{row.from ?? ''}</span>}
                <span className={cn(GUTTER, showDiff && 'mr-1.5 w-7')}>{row.to ?? ''}</span>
                {showDiff && <span className="mr-3 w-2.5 shrink-0 text-center opacity-70 select-none">{ROW_MARKS[row.kind]}</span>}
                <span className="min-w-0 flex-1 whitespace-pre-wrap [word-break:break-all]">{row.text || ' '}</span>
              </div>
            ))}
          </div>
        </div>

        <SplitHandle
          label="Resize code and canvas"
          onResizeStart={() => (dragStart.current = codeRef.current.offsetWidth)}
          onResize={(dx) => resizeCode(dragStart.current + dx)}
          onStep={(d) => resizeCode(codeRef.current.offsetWidth + d)}
        />

        {/* The design at this version, beside its code — one Compare-latest
            toggle now drives both: on, the code shows a diff and this
            shows the latest design; off, both just show this version
            plainly. Having the toggle and a separate This-version/Latest
            switch do overlapping jobs was confusing — one control. */}
        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl">
          {/* TEMP (debug): which checkpoint is showing and the values its
              preview is drawn from — to check that code, preview and this
              readout change together during playback. Remove when done. */}
          <p data-history-debug translate="no" className="pointer-events-none absolute top-11 left-2 z-10 max-w-[45%] rounded-md bg-black/70 px-2 py-1 font-mono text-[10.5px] leading-4 text-emerald-200">
            #{position ? `${position.index + 1}/${position.total}` : '–'}
            {playing && <span className="text-slate-400"> {typed || !baseEntry ? 'shown' : 'typing…'}</span>}
            {['iconSize', 'hitArea', 'badgeCount', 'badgeCap'].filter((key) => shownProps[key] !== undefined).map((key) => (
              <span key={key}> · {key} <span className="text-white">{String(shownProps[key])}</span></span>
            ))}
          </p>
          <PreviewPanelContent
            // A new key fades the preview over — on each checkpoint, and
            // during playback each time the typed code changes the design.
            // While playing the preview stays mounted and changes in
            // place (no fade between steps — two per step left it faint
            // half the time); the ring on what changed marks the moment.
            snapshotKey={playing ? 'playing' : shownSnapshot.id}
            highlightLayerId={highlightLayerId}
            highlightKey={entryId}
            previewProps={shownProps}
            prototypeEdits={shownEdits}
            activePageId={shownSnapshot.snapshot.activePageId ?? null}
            frames={shownSnapshot.snapshot.mergeOutput?.design?.frame ? [shownSnapshot.snapshot.mergeOutput.design.frame] : undefined}
            historical
            caption={
              <span className="shrink-0 text-emerald-300">
                {playing ? 'This step' : showDiff ? 'Latest' : isCurrent ? 'Current' : `At ${entry.timestamp}`}
              </span>
            }
          />
        </div>
      </div>

      {footer}

      {propChanges.length > 0 && showDiff && (
        <div className="shrink-0 px-5 pb-4">
          <p className="mb-1 text-xs font-medium text-slate-300">Preview props</p>
          {propChanges.map((key) => (
            <p key={key} className="font-mono text-[11px] text-slate-500">
              {key}: <span className="text-red-300 line-through">{String(diffBase.snapshot.previewProps?.[key] ?? '—')}</span>{' '}
              → <span className="text-emerald-300">{String(entry.snapshot.previewProps?.[key] ?? '—')}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

export default HistoryCompare
