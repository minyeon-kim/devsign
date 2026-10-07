import { useCallback, useMemo, useRef, useState } from 'react'
import { Archive, ArchiveRestore, MoreHorizontal, Code2, GitCompareArrows, RotateCcw, Sparkles } from 'lucide-react'
import { cn } from 'cn'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { ACCENT_CTA, FLOATING_PANEL, PANEL_RADIUS } from '@/components/mergestudio/floatingStyles'
import PreviewPanelContent from '@/components/dockview/panels/PreviewPanelContent'
import SplitHandle from '@/components/layout/SplitHandle'
import PlaybackCode, { GUTTER } from '@/components/history/PlaybackCode'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { diffLines } from '@/lib/lineDiff'
import { DiffLayoutTabs, DiffView, useDiffLayout } from '@/components/diff/DiffView'
import { historyMeta } from '@/lib/historyMeta'
import { LocalizedText } from '@/i18n/runtime'
import { deriveComponentOverride } from '@/lib/prototypeSync'
import { useNavigate } from 'react-router-dom'
import { ReasonStrip, RulesDialog } from '@/components/conflicts/Rationale'
import { foldConflictCheckpoints, withBranches } from '@/lib/historyBranches'
import { checkpointRationale } from '@/lib/rationale'

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
// rollback the Workspace would do. The restore button always hands off
// to the caller's checkpoint confirmation; it never restores directly.
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
function HistoryCompare({ entryId, onRollback, onArchive, onUnarchive, compareLatest = true, onCompareLatestChange, footer, hideRestore = false, playing = false, baseEntryId, onStepDone, branch, position }) {
  const { historyEntries, activeHistoryId, getFileName, currentUser, projectId, conflicts, comments, projectPages } = useWorkspace()
  const navigate = useNavigate()
  const [ruleFocus, setRuleFocus] = useState(null)
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
  // Stacked or side by side — the diff and its replay alike.
  const [diffLayout] = useDiffLayout()
  const editsAt = useCallback((id) => {
    const upTo = historyEntries.findIndex((h) => h.id === id)
    for (let i = upTo; i >= 0; i--) {
      const { snapshot } = historyEntries[i]
      const edits = snapshot.prototypeEdits ?? deriveComponentOverride(projectId, snapshot.fileId, snapshotLines(snapshot))
      if (edits) return edits
    }
    return {}
  }, [historyEntries, projectId])
  const shownEdits = useMemo(() => editsAt(shownSnapshot?.id), [editsAt, shownSnapshot?.id])
  // What this version changed on the screen — the preview's "Changed
  // element" view: the element it was made on, else every element whose
  // edits differ from the version just before it, and a tab bar when the
  // nav values it records differ.
  const changedLayerIds = useMemo(() => {
    if (!entry) return []
    if (entry.snapshot.selectedLayerId) return [entry.snapshot.selectedLayerId]
    const at = historyEntries.findIndex((h) => h.id === entry.id)
    const other = baseEntry ?? historyEntries[at - 1] ?? null
    const mine = editsAt(entry.id)
    const theirs = other ? editsAt(other.id) : {}
    const ids = [...new Set([...Object.keys(mine), ...Object.keys(theirs)])].filter((id) => JSON.stringify(mine[id]) !== JSON.stringify(theirs[id]))
    const props = entry.snapshot.previewProps ?? {}
    const otherProps = other?.snapshot.previewProps ?? {}
    const differs = (keys) => keys.some((key) => props[key] !== otherProps[key])
    const frame = projectPages.find((page) => page.id === (entry.snapshot.activePageId ?? projectPages[0]?.id))?.frames[0]
    if (differs(['iconSize', 'hitArea', 'badgeCount', 'badgeCap'])) ids.push(...(frame?.layers ?? []).filter((layer) => layer.type === 'tabs').map((layer) => layer.id))
    if (differs(['buttonPadding'])) ids.push('primary-button')
    return [...new Set(ids)]
  }, [entry, historyEntries, baseEntry, editsAt, projectPages])

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
  // The conflicts this version is tied to: its own, and the ones marked on
  // it in the list (lib/historyBranches).
  const marks = foldConflictCheckpoints(withBranches(historyEntries, conflicts)).find((version) => version.id === entry.id)?.conflictMarks ?? []
  const relatedIds = new Set([entry.conflictId, ...(entry.conflictIds ?? []), ...marks.map((mark) => mark.conflictId)].filter(Boolean))
  const why = checkpointRationale(entry, conflicts.filter((conflict) => relatedIds.has(conflict.id)), comments)
  // A rule opens in the rule list; everything else lives in the Workspace,
  // on that conflict's review.
  function openEvidence(item) {
    if (item.kind === 'rule') { setRuleFocus(item.id); return }
    if (item.kind === 'wcag') { window.open(item.url, '_blank', 'noopener'); return }
    setRuleFocus(null)
    const conflictId = item.conflictId ?? [...relatedIds][0]
    if (conflictId) navigate(`/projects/${projectId}/workspace`, { state: { openConflictId: conflictId, evidence: item } })
  }
  const propChanges = diffBase
    ? Object.keys({ ...diffBase.snapshot.previewProps, ...entry.snapshot.previewProps }).filter(
        (key) => diffBase.snapshot.previewProps?.[key] !== entry.snapshot.previewProps?.[key]
      )
    : []
  const conflictDelta = (entry.snapshot.conflicts?.length ?? 0) - (diffBase?.snapshot.conflicts?.length ?? 0)


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
          {/* Why this version exists and what backs it — the same reasons
              its conflicts carry — with the way to those conflicts and
              their comments. */}
          <ReasonStrip text={why.text} evidence={why.evidence} onOpen={openEvidence} className="mt-1.5" />
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
                {/* Each as its own string, so it's translated (a leading
                    " · " glued on kept them in English). */}
                {propChanges.length > 0 && <> · <LocalizedText text={`${propChanges.length} preview prop${propChanges.length === 1 ? '' : 's'}`} /></>}
                {conflictDelta !== 0 && <> · <LocalizedText text={`${conflictDelta > 0 ? '+' : ''}${conflictDelta} conflicts`} /></>}
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
            onClick={() => onRollback?.(entry.id)}
            disabled={isCurrent || !onRollback}
            className={cn(
              'ds-pill inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold',
              ACCENT_CTA,
              'disabled:bg-white/[0.06] disabled:text-slate-500 disabled:shadow-none'
            )}
          >
            <RotateCcw className="size-3.5" />
            Restore this state
          </button>
          )}
          {(onArchive || onUnarchive) && <DropdownMenu>
            <DropdownMenuTrigger aria-label="Version actions" title="Version actions" className="flex size-8 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white">
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {entry.archived ? <DropdownMenuItem onClick={() => onUnarchive?.(entry)}><ArchiveRestore />Restore to History</DropdownMenuItem>
                : <DropdownMenuItem disabled={isCurrent} onClick={() => onArchive?.(entry)}><Archive />Archive checkpoint</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>}
        </div>
      </div>

      <div ref={splitRef} className="mx-3 mb-3 flex min-h-0 flex-1">
        <div
          ref={codeRef}
          style={{ width: codeWidth ?? '58%', maxWidth: `calc(100% - ${MIN_CANVAS}px)` }}
          className="flex min-w-0 shrink-0 flex-col overflow-hidden rounded-xl bg-black/20"
        >
          <div className="flex shrink-0 items-center gap-1.5 px-3 pt-2 pb-1 text-[11px] text-slate-500">
            <Code2 className="size-3" />
            <span translate="no" className="min-w-0 truncate font-mono">{getFileName(entry.snapshot.fileId)}</span>
            {/* (Always there: it sets the replay's layout too.) */}
            <DiffLayoutTabs className="ml-auto" />
          </div>
          <div className="min-h-0 flex-1 overflow-auto pb-2 text-[12px] leading-5">
            {showDiff && rows.every((r) => r.kind === 'same') && (
              <p className="px-3 pb-2 font-sans text-xs text-slate-500">No code changes between this version and the latest.</p>
            )}
            {playing ? (
              // Keyed to the checkpoint: each step starts from the one
              // before it, exactly, and ends on this one, exactly.
              <div className="font-mono"><PlaybackCode key={entryId} from={playFrom} to={playTo} onTyped={handleTyped} onDone={onStepDone} layout={diffLayout} /></div>
            ) : showDiff ? (
              <DiffView rows={codeRows} className="text-[12px]" labels={['Current version', 'This version']} />
            ) : codeRows.map((row, index) => (
              <div key={index} className="flex min-w-0 py-px pr-3 font-mono whitespace-pre-wrap text-slate-300 [word-break:break-all]">
                <span className={GUTTER}>{row.to ?? ''}</span>
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
          <p data-history-debug translate="no" className="pointer-events-none absolute bottom-2 left-2 z-10 max-w-[45%] rounded-md bg-black/70 px-2 py-1 font-mono text-[10.5px] leading-4 text-emerald-200">
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
            viewControls
            focusLayerIds={changedLayerIds}
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
      <RulesDialog focusId={ruleFocus} onOpenChange={(open) => { if (!open) setRuleFocus(null) }} onOpenSource={openEvidence} />
    </div>
  )
}

export default HistoryCompare
