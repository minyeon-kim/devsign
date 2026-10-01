import { useMemo, useRef, useState } from 'react'
import { Code2, GitCompareArrows, RotateCcw, Sparkles } from 'lucide-react'
import { cn } from 'cn'
import { toast } from '@/i18n/toast'
import { ACCENT_CTA, FLOATING_PANEL, PANEL_RADIUS } from '@/components/mergestudio/floatingStyles'
import PreviewPanelContent from '@/components/dockview/panels/PreviewPanelContent'
import SplitHandle from '@/components/layout/SplitHandle'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { diffLines } from '@/lib/lineDiff'
import { historyMeta } from '@/lib/historyMeta'
import { deriveComponentOverride } from '@/lib/prototypeSync'

const ROW_TONES = {
  same: 'text-slate-500',
  add: 'bg-emerald-400/[0.08] text-emerald-300',
  remove: 'bg-destructive/[0.08] text-red-300',
}
const ROW_MARKS = { same: ' ', add: '+', remove: '−' }
const MIN_CODE = 280
const MIN_CANVAS = 260

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
function HistoryCompare({ entryId, onRollback, compareLatest = true, onCompareLatestChange, footer, hideRestore = false, playing = false, baseEntryId }) {
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
  // While replaying, each step diffs against the one before it — so the
  // diff and the canvas build up incrementally, step by step, instead of
  // always comparing back to the latest checkpoint. The first step in the
  // timeline has nothing before it, so it shows plain (no diff). Scrubbing
  // by hand keeps comparing against the latest, as before.
  const diffBase = playing ? historyEntries.find((h) => h.id === baseEntryId) ?? null : current

  const rows = useMemo(
    () => (entry && diffBase ? diffLines(diffBase.snapshot.lines, entry.snapshot.lines) : []),
    [entry, diffBase]
  )
  // While playing, the final step is still stepping forward from the one
  // before it — even though it lands on the current checkpoint. Gating on
  // `isCurrent` here too would collapse the diff and the canvas compare
  // right at the last step, an abrupt cut after every prior step built up
  // smoothly. Manual scrubbing keeps the old behavior: landing on the
  // actual current checkpoint shows it plainly, nothing to compare.
  const showDiff = compareLatest && Boolean(diffBase) && (playing || !isCurrent)
  const codeRows = useMemo(() => {
    const source = showDiff ? rows : (entry?.snapshot.lines ?? []).map((text) => ({ kind: 'same', text }))
    // Old (latest) / new (this version) line numbers, like a split gutter;
    // `addIndex` staggers the type-in animation across an added block.
    let a = 0
    let b = 0
    let addIndex = 0
    return source.map((row) => ({
      ...row,
      from: row.kind === 'add' ? null : ++a,
      to: row.kind === 'remove' ? null : ++b,
      addIndex: row.kind === 'add' ? addIndex++ : null,
    }))
  }, [showDiff, rows, entry])
  const shownSnapshot = showDiff ? diffBase : entry

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
          <p className="text-[11px] text-slate-500 tabular-nums">{entry.timestamp}</p>
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
                {playing ? 'Compared with the previous step ·' : 'Compared with current ·'}{' '}
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
          <p className="flex shrink-0 items-center gap-1.5 px-4 pt-2 pb-1 font-mono text-[11px] text-slate-500">
            <Code2 className="size-3" />
            {getFileName(entry.snapshot.fileId)}
          </p>
          <div className="min-h-0 flex-1 overflow-auto pb-2 font-mono text-[12px] leading-5">
            {showDiff && rows.every((r) => r.kind === 'same') && (
              <p className="px-4 pb-2 font-sans text-xs text-slate-500">
                {playing ? 'No code changes from the previous step.' : 'No code changes between this version and the latest.'}
              </p>
            )}
            {codeRows.map((row, index) => (
              // Keying on the entry too (not just the row's position) remounts every
              // row when the selected checkpoint changes, so each step's added lines
              // type themselves in (staggered by `addIndex`) and removed ones flash,
              // instead of a static list silently swapping text.
              <div
                key={`${entryId}-${index}`}
                style={row.kind === 'add' ? { animationDelay: `${Math.min(row.addIndex, 10) * 45}ms` } : undefined}
                className={cn(
                  'flex min-w-0 pr-4 whitespace-pre-wrap [word-break:break-all]',
                  showDiff ? ROW_TONES[row.kind] : 'text-slate-300',
                  showDiff && row.kind === 'add' && 'history-row-typein',
                  showDiff && row.kind === 'remove' && 'history-row-flash-remove'
                )}
              >
                {showDiff && <span className="w-9 shrink-0 pr-2 text-right text-slate-600 select-none tabular-nums">{row.from ?? ''}</span>}
                <span className="w-9 shrink-0 pr-2 text-right text-slate-600 select-none tabular-nums">{row.to ?? ''}</span>
                {showDiff && <span className="w-4 shrink-0 select-none opacity-70">{ROW_MARKS[row.kind]}</span>}
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
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl">
          <PreviewPanelContent
            key={showDiff ? 'latest' : 'checkpoint'}
            snapshotKey={shownSnapshot.id}
            previewProps={shownSnapshot.snapshot.previewProps ?? {}}
            // Seeded checkpoints don't carry their own `prototypeEdits` —
            // derive it from that checkpoint's own code instead of falling
            // back to no overrides at all, which reads as the canvas never
            // changing between checkpoints no matter what the code diff
            // shows (see lib/prototypeSync).
            prototypeEdits={
              shownSnapshot.snapshot.prototypeEdits ??
              deriveComponentOverride(projectId, shownSnapshot.snapshot.fileId, shownSnapshot.snapshot.lines) ??
              {}
            }
            activePageId={shownSnapshot.snapshot.activePageId ?? null}
            historical
            caption={
              <span className="shrink-0 text-emerald-300">
                {showDiff ? (playing ? 'Previous step' : 'Latest') : !playing && isCurrent ? 'Current' : `At ${entry.timestamp}`}
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
