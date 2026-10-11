import { Fragment, useCallback, useMemo, useState } from 'react'
import { Archive, ArchiveRestore, ChevronDown, MoreHorizontal, Code2, MessageSquareText, RotateCcw, Sparkles, TriangleAlert } from 'lucide-react'
import { cn } from 'cn'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { ACCENT_CTA, FLOATING_PANEL, PANEL_RADIUS } from '@/components/mergestudio/floatingStyles'
import PreviewPanelContent from '@/components/dockview/panels/PreviewPanelContent'
import PlaybackCode, { GUTTER } from '@/components/history/PlaybackCode'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { diffLines } from '@/lib/lineDiff'
import { DiffLayoutTabs, DiffView } from '@/components/diff/DiffView'
import { changedLineCount, foldRows, numberRows } from '@/lib/diffHunks'
import { projectHistorySeeds } from '@/data/mockData'
import { KIND_LABEL, historyMeta } from '@/lib/historyMeta'
import { LocalizedText } from '@/i18n/runtime'
import { deriveComponentOverride } from '@/lib/prototypeSync'
import { changedLayerIds } from '@/lib/devicePreview'
import { categoryFor, layoutDelta, renderOf } from '@/lib/codeRender'
import { referencePick, screenOf } from '@/lib/devicePresets'
import { useNavigate } from 'react-router-dom'
import { ReasonStrip, RulesDialog } from '@/components/conflicts/Rationale'
import { foldConflictCheckpoints, withBranches } from '@/lib/historyBranches'
import { checkpointRationale } from '@/lib/rationale'

// This view's diff layout: top to bottom until side by side is picked (kept
// between visits, apart from the app's other diffs).
const LAYOUT_KEY = 'devsign.historyDiffLayout'
const storedLayout = () => { try { return localStorage.getItem(LAYOUT_KEY) === 'split' ? 'split' : 'unified' } catch { return 'unified' } }

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
// `position` ({ index, total }) names the checkpoint in the preview's caption.
function HistoryCompare({ entryId, onRollback, onArchive, onUnarchive, compareLatest = true, onCompareLatestChange, footer, hideRestore = false, playing = false, baseEntryId, onStepDone, branch, position }) {
  const { historyEntries, activeHistoryId, getFileName, currentUser, projectId, conflicts, comments, projectPages } = useWorkspace()
  const navigate = useNavigate()
  const [ruleFocus, setRuleFocus] = useState(null)
  const [reasonOpen, setReasonOpen] = useState(false)
  // The diff: stacked or side by side, and the changed hunks or the whole file.
  const [diffLayout, setDiffLayoutState] = useState(storedLayout)
  const setDiffLayout = (layout) => { setDiffLayoutState(layout); try { localStorage.setItem(LAYOUT_KEY, layout) } catch { /* this visit only */ } }
  const [wholeFile, setWholeFile] = useState(false)
  const entry = historyEntries.find((h) => h.id === entryId)
  const current = historyEntries.find((h) => h.id === activeHistoryId)
  const isCurrent = entryId === activeHistoryId
  const baseEntry = playing ? historyEntries.find((h) => h.id === baseEntryId) ?? null : null
  // Which checkpoint's typing has finished (the preview switches then).
  const [typedId, setTypedId] = useState(null)
  const typed = typedId === entryId
  const diffBase = current

  // This version → the current version: this version is the old side (left,
  // or above), the current one the new — the way the renders above it read.
  const rows = useMemo(
    () => (entry && diffBase ? diffLines(snapshotLines(entry.snapshot), snapshotLines(diffBase.snapshot)) : []),
    [entry, diffBase]
  )
  // Playback shows the code itself, being typed — no diff against latest.
  const showDiff = compareLatest && Boolean(diffBase) && !playing && !isCurrent
  // The diff as shown: its changed hunks (the rest folded) or the whole
  // file; without a comparison, the file as it was.
  const codeRows = useMemo(() => {
    if (!showDiff) return numberRows(snapshotLines(entry?.snapshot).map((text) => ({ kind: 'same', text })))
    return wholeFile ? numberRows(rows) : foldRows(rows)
  }, [showDiff, rows, entry, wholeFile])
  const changedLines = useMemo(() => changedLineCount(rows), [rows])
  // Playing: the checkpoint before this one until its code is typed in,
  // then this one. Otherwise the latest (comparing) or this version.
  const shownSnapshot = playing ? (baseEntry && !typed ? baseEntry : entry) : showDiff ? diffBase : entry
  // A checkpoint about another file doesn't say what the screen looked
  // like, so its design is the last one before it that does — otherwise
  // the preview would snap back to the default between steps.
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
  // What this version changed on the screen — what the preview's "Show
  // changed elements" rings: the element it was made on, else whatever
  // differs from the version just before it (lib/devicePreview).
  const changedIds = useMemo(() => {
    if (!entry) return []
    if (entry.snapshot.selectedLayerId) return [entry.snapshot.selectedLayerId]
    const at = historyEntries.findIndex((h) => h.id === entry.id)
    const other = baseEntry ?? historyEntries[at - 1] ?? null
    const frame = projectPages.find((page) => page.id === (entry.snapshot.activePageId ?? projectPages[0]?.id))?.frames[0]
    return changedLayerIds({ edits: editsAt(entry.id), previousEdits: other ? editsAt(other.id) : {}, props: entry.snapshot.previewProps ?? {}, previousProps: other?.snapshot.previewProps ?? {}, frame })
  }, [entry, historyEntries, baseEntry, editsAt, projectPages])

  // The preview as this checkpoint's code on a screen (lib/codeRender), for
  // a file that can be read into one: the checkpoint in view (while playing,
  // the one before it until its code is typed in) — never the latest in its
  // place; with "Compare latest" on, the latest is a second render beside it.
  // Null for a file with no renderer: the preview is then the design
  // prototype with what the code implies, as before.
  const codeRender = useMemo(() => {
    if (!entry) return null
    const viewed = playing && baseEntry && !typed ? baseEntry : entry
    const own = renderOf(projectId, viewed.snapshot.fileId, snapshotLines(viewed.snapshot))
    if (!own) return null
    const at = historyEntries.findIndex((h) => h.id === entry.id)
    const before = baseEntry ?? historyEntries.slice(0, at).findLast((h) => h.snapshot.fileId === entry.snapshot.fileId) ?? null
    const previous = before ? renderOf(projectId, before.snapshot.fileId, snapshotLines(before.snapshot))?.spec ?? null : null
    const latest = compareLatest && !playing && current && current.id !== entry.id ? renderOf(projectId, current.snapshot.fileId, snapshotLines(current.snapshot)) : null
    // The two sides' one name each, everywhere: "This version · Checkpoint
    // #N" and "Current version".
    const mine = renderOf(projectId, entry.snapshot.fileId, snapshotLines(entry.snapshot))?.spec
    return {
      ...own,
      title: isCurrent && !playing ? 'Current version' : position ? `This version · Checkpoint #${position.index + 1}` : 'This version',
      // The change from this version to the current one, in words (on the
      // kind's reference screen).
      delta: latest?.spec && mine ? layoutDelta(mine, latest.spec, screenOf(referencePick(categoryFor(projectId, entry.snapshot.fileId)), categoryFor(projectId, entry.snapshot.fileId))) : null,
      category: categoryFor(projectId, entry.snapshot.fileId),
      previous,
      // (Recorded without a code change — a decision request, a detection.)
      unchanged: Boolean(before) && snapshotLines(before.snapshot).join('\n') === snapshotLines(entry.snapshot).join('\n'),
      compare: latest?.spec ? { title: 'Current version', spec: latest.spec } : null,
    }
  }, [entry, baseEntry, typed, playing, compareLatest, current, historyEntries, projectId, position, isCurrent])

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
  // The change in a person's words, as one line over the comparison. While
  // two versions are compared it's what differs between them, read the way
  // they're shown (this version → the current one) — a checkpoint's own
  // summary says what *it* changed, which can run the other way. Otherwise
  // the checkpoint's summary, else why it was made. None of them: no line.
  const ownSummary = entry.summary ?? projectHistorySeeds[projectId]?.find((seed) => seed.id === entry.id)?.summary ?? null
  const comparedSummary = showDiff ? codeRender?.delta ?? null : null
  const summary = comparedSummary ?? ownSummary ?? why.text ?? null
  // (The change itself is on the meta line; the rest backs the reason.)
  const reasonEvidence = why.evidence.filter((item) => item.kind !== 'conflict')
  // Who made it (and who approved) — without its kind or file, said elsewhere.
  const who = historyMeta({ ...entry, kind: null, target: null }, currentUser.id)
  // A rule opens in the rule list; everything else lives in the Workspace,
  // on that conflict's review.
  function openEvidence(item) {
    if (item.kind === 'rule') { setRuleFocus(item.id); return }
    if (item.kind === 'wcag') { window.open(item.url, '_blank', 'noopener'); return }
    setRuleFocus(null)
    const conflictId = item.conflictId ?? [...relatedIds][0]
    if (conflictId) navigate(`/projects/${projectId}/workspace`, { state: { openConflictId: conflictId, evidence: item, reviewView: 'overlay' } })
  }
  const propChanges = diffBase
    ? Object.keys({ ...diffBase.snapshot.previewProps, ...entry.snapshot.previewProps }).filter(
        (key) => diffBase.snapshot.previewProps?.[key] !== entry.snapshot.previewProps?.[key]
      )
    : []


  return (
    // A Merge Studio floating panel: the same surface as the Version
    // History drawer, borderless inside, the mint accent for Restore.
    <div className={cn('flex h-full min-h-0 flex-col overflow-hidden', PANEL_RADIUS, FLOATING_PANEL)}>
      <div className="flex shrink-0 items-start justify-between gap-4 px-5 pt-4 pb-3">
        {/* Two lines. What it is and where it stands (its kind, "Current");
            then when, where, who and the change it belongs to — each said
            once (the file is the code pane's tab, not here). Why it was made
            opens on asking. */}
        <div data-checkpoint-header className="min-w-0">
          <p className="flex min-w-0 items-center gap-2">
            {entry.prompt && <Sparkles className="size-3.5 shrink-0 text-emerald-300" />}
            <span data-checkpoint-title className="min-w-0 truncate text-[14px] leading-5 font-semibold text-white">{entry.label}</span>
            {KIND_LABEL[entry.kind] && <span data-checkpoint-kind className="inline-flex h-5 shrink-0 items-center rounded-full bg-white/[0.07] px-2 text-[10.5px] font-medium text-slate-300"><LocalizedText text={KIND_LABEL[entry.kind]} /></span>}
            {isCurrent && !playing && <span data-checkpoint-current className="inline-flex h-5 shrink-0 items-center rounded-full bg-emerald-400/15 px-2 text-[10.5px] font-medium text-emerald-200"><LocalizedText text="Current" /></span>}
          </p>
          <div data-checkpoint-meta className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] leading-5 text-slate-400">
            <span className="shrink-0 tabular-nums">{entry.timestamp}</span>
            {/* The branch this checkpoint is on, in its graph color. */}
            {branch && (
              <>
                <span aria-hidden className="text-slate-600">·</span>
                <span translate="no" className="inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full px-2 font-mono text-[10.5px] font-medium" style={{ color: branch.color, background: `${branch.color}1f` }}>
                  <span className="size-1.5 rounded-full" style={{ background: branch.color }} />
                  {branch.name}
                </span>
              </>
            )}
            {who && <><span aria-hidden className="text-slate-600">·</span><span className="shrink-0"><LocalizedText text={who} /></span></>}
            {/* The change it belongs to: the way to that change's detail. */}
            {why.evidence.filter((item) => item.kind === 'conflict').map((item) => (
              <Fragment key={item.id}>
                <span aria-hidden className="text-slate-600">·</span>
                <button type="button" data-checkpoint-conflict={item.id} onClick={() => openEvidence(item)} className="ds-intrinsic inline-flex h-5 max-w-[280px] min-w-0 items-center gap-1 rounded-md px-1 text-amber-200 transition-colors hover:bg-white/[0.07] hover:text-amber-100">
                  <TriangleAlert className="size-3 shrink-0" />
                  <span className="min-w-0 truncate"><LocalizedText text={item.label} /></span>
                </button>
              </Fragment>
            ))}
            {showDiff && (
              <>
                <span aria-hidden className="text-slate-600">·</span>
                {/* (+0 −0 isn't a broken comparison: say what it is.) */}
                {added + removed === 0
                  ? <span data-checkpoint-diff title={codeRender?.unchanged ? 'This checkpoint recorded no code change.' : undefined}><LocalizedText text="The code is the same as the current version." /></span>
                  : <span data-checkpoint-diff title="Compared with current" className="shrink-0 tabular-nums"><span className="text-emerald-300">+{added}</span> <span className="text-red-300">−{removed}</span></span>}
              </>
            )}
            {((why.text && why.text !== summary) || reasonEvidence.length > 0) && (
              <button type="button" data-checkpoint-reason-toggle aria-expanded={reasonOpen} onClick={() => setReasonOpen((current) => !current)} className="ds-intrinsic ml-1 inline-flex h-5 shrink-0 items-center gap-0.5 rounded-md px-1 text-slate-300 transition-colors hover:bg-white/[0.07] hover:text-white">
                <LocalizedText text="Reason for the change" />
                <ChevronDown className={cn('size-3 transition-transform', reasonOpen && 'rotate-180')} />
              </button>
            )}
          </div>
          {reasonOpen && <ReasonStrip text={why.text !== summary ? why.text : null} evidence={reasonEvidence} onOpen={openEvidence} className="mt-1.5" />}
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

      {/* The change, in a person's words. */}
      {summary && (
        <p data-change-summary className="mx-3 mb-2 flex shrink-0 items-start gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-[12.5px] leading-5 text-slate-100">
          <MessageSquareText aria-hidden className="mt-[3px] size-3.5 shrink-0 text-emerald-300" />
          <span className="sr-only"><LocalizedText text="Change summary" />: </span>
          <span className="min-w-0">
            {comparedSummary && <span data-summary-direction className="mr-1.5 text-slate-400"><LocalizedText text="This version → current version" /> ·</span>}
            <LocalizedText text={summary} />
          </span>
        </p>
      )}

      {/* What it looks like — the main thing: the whole width, this version
          on the left and the current one on the right. */}
      <div data-compare-render className="relative mx-3 flex min-h-[260px] flex-1 basis-0 flex-col overflow-hidden rounded-xl bg-black/15">
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
          embedded
          viewControls
          focusLayerIds={changedIds}
          codeRender={codeRender}
          caption={
            <span className="shrink-0 text-emerald-300">
              {/* (A code render names what it shows over its frame; "Current" is the header's badge.) */}
              {codeRender?.spec || isCurrent ? null : playing ? 'This step' : showDiff ? 'Current version' : 'This version'}
            </span>
          }
        />
      </div>

      {/* The code behind it, under it: just what changed (the rest folded)
          until the whole file is asked for — read the same way round, this
          version first. */}
      <section data-compare-code aria-label="Code" className="mx-3 mt-2 mb-3 flex min-h-[92px] shrink flex-col overflow-hidden rounded-xl bg-black/20" style={{ maxHeight: playing || wholeFile ? '44%' : '36%' }}>
        <div className="flex shrink-0 items-center gap-2 px-3 pt-2 pb-1 text-[11px] text-slate-500">
          <Code2 className="size-3 shrink-0" />
          <span translate="no" className="min-w-0 truncate font-mono">{getFileName(entry.snapshot.fileId)}</span>
          {showDiff && <span data-code-changed className="shrink-0 text-slate-300"><LocalizedText text={`${changedLines} line${changedLines === 1 ? '' : 's'} of code changed`} /></span>}
          {!showDiff && !playing && <span className="shrink-0"><LocalizedText text="The file as it was at this version" /></span>}
          <span className="ml-auto flex shrink-0 items-center gap-2">
            {showDiff && changedLines > 0 && (
              <button type="button" data-code-whole-file aria-pressed={wholeFile} onClick={() => setWholeFile((current) => !current)} className={cn('ds-intrinsic inline-flex h-6 items-center rounded-md px-2 font-sans text-[10.5px] font-medium transition-colors', wholeFile ? 'bg-white/[0.12] text-white' : 'bg-white/[0.05] text-slate-300 hover:text-white')}>
                <LocalizedText text="Show the whole file" />
              </button>
            )}
            {/* (Always there: it sets the replay's layout too.) */}
            <DiffLayoutTabs layout={diffLayout} onLayout={setDiffLayout} />
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto pb-2 text-[12px] leading-5">
          {showDiff && changedLines === 0 && (
            <p className="px-3 pb-2 font-sans text-xs text-slate-500">No code changes between this version and the latest.</p>
          )}
          {playing ? (
            // Keyed to the checkpoint: each step starts from the one
            // before it, exactly, and ends on this one, exactly.
            <div className="font-mono"><PlaybackCode key={entryId} from={playFrom} to={playTo} onTyped={handleTyped} onDone={onStepDone} layout={diffLayout} /></div>
          ) : showDiff ? (
            changedLines > 0 && <DiffView rows={codeRows} layout={diffLayout} className="text-[12px]" labels={[position ? `This version · Checkpoint #${position.index + 1}` : 'This version', 'Current version']} />
          ) : codeRows.map((row, index) => (
            <div key={index} className="flex min-w-0 py-px pr-3 font-mono whitespace-pre-wrap text-slate-300 [word-break:break-all]">
              <span className={GUTTER}>{row.to ?? ''}</span>
              <span className="min-w-0 flex-1 whitespace-pre-wrap [word-break:break-all]">{row.text || ' '}</span>
            </div>
          ))}
        </div>
      </section>

      {footer}

      {propChanges.length > 0 && showDiff && !codeRender && (
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
