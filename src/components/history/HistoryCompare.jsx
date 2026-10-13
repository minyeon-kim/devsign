import { useCallback, useMemo, useState } from 'react'
import { changeHref, sourceKeyOf } from '@/lib/changeLink'
import { Archive, ArchiveRestore, Check, ChevronDown, ChevronRight, Code2, Link2, MessageSquareText, MoreHorizontal, RotateCcw, SquareArrowOutUpRight, TriangleAlert } from 'lucide-react'
import { cn } from 'cn'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import PreviewPanelContent from '@/components/dockview/panels/PreviewPanelContent'
import PlaybackCode, { GUTTER } from '@/components/history/PlaybackCode'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { diffLines } from '@/lib/lineDiff'
import { DiffLayoutTabs, DiffView } from '@/components/diff/DiffView'
import { changedLineCount, codeViewOf, foldRows, numberRows } from '@/lib/diffHunks'
import { projectHistorySeeds } from '@/data/mockData'
import { KIND_LABEL, historyMeta } from '@/lib/historyMeta'
import { LocalizedText } from '@/i18n/runtime'
import { translateText } from '@/i18n/translate'
import { useLanguage } from '@/i18n/language'
import { deriveComponentOverride } from '@/lib/prototypeSync'
import { changedLayerIds } from '@/lib/devicePreview'
import { categoryFor, layoutDelta, layoutDeltaCode, problemsAt, renderOf } from '@/lib/codeRender'
import { referencePick, screenOf } from '@/lib/devicePresets'
import { useLocation, useNavigate } from 'react-router-dom'
import { EvidenceLinks, ReasonStrip, RulesDialog } from '@/components/conflicts/Rationale'
import { historyHref, readHistoryView, withHistoryView } from '@/lib/historyLink'
import { toast } from '@/i18n/toast'
import { foldConflictCheckpoints, withBranches } from '@/lib/historyBranches'
import { checkpointRationale } from '@/lib/rationale'

const CHIP = 'inline-flex h-5 shrink-0 items-center rounded-full bg-white/[0.07] px-2 text-[10.5px] font-medium text-slate-300'

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
// The renders come first, the whole width; the code that makes the
// difference sits under them, folded to a line until it's asked for.
// `footer` sits under the code (the timeline).
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
// `baseline` ('previous' | 'current'; `onBaselineChange`): the one thing this
// version is compared with — the checkpoint before it, or the current
// version. The change line, the renders and the code all read from it, so
// they can't say different things. A first checkpoint has nothing before
// it: it's compared with the current version whatever is picked.
// `embedded` (a change's replay, inside its detail): the same viewer without
// its own card and header — `header` is the caller's line in their place
// (back, which step, the way out to History). Everything under it is this
// component's, as on the History page.
function HistoryCompare({ entryId, onRollback, onArchive, onUnarchive, baseline = 'previous', onBaselineChange, footer, hideRestore = false, playing = false, baseEntryId, onStepDone, branch, position, embedded = false, header = null, codeOpenByDefault = false }) {
  const { historyEntries, activeHistoryId, getFileName, currentUser, projectId, conflicts, comments, projectPages, closeHistory } = useWorkspace()
  const navigate = useNavigate()
  const location = useLocation()
  const language = useLanguage()
  const [ruleFocus, setRuleFocus] = useState(null)
  // The diff: stacked or side by side, and the changed hunks or the whole file.
  const [diffLayout, setDiffLayoutState] = useState(storedLayout)
  const setDiffLayout = (layout) => { setDiffLayoutState(layout); try { localStorage.setItem(LAYOUT_KEY, layout) } catch { /* this visit only */ } }
  const [wholeFile, setWholeFile] = useState(false)
  // Whether the code is unfolded: the reader's choice, and only theirs — it
  // changes when they press it, never because playback started, paused or
  // ended (the step in view and whether it's playing are the caller's; this
  // is the third thing, on its own). A change's replay opens with it
  // unfolded (`codeOpenByDefault`); the History page starts on one line.
  const [codeOpen, setCodeOpen] = useState(codeOpenByDefault)
  const [reasonOpen, setReasonOpen] = useState(false)
  // The Screen tab was picked by hand (it isn't in the address: it's the default).
  const [screenPicked, setScreenPicked] = useState(false)
  // The problem line is under the pointer: its area on the render is drawn stronger.
  const [problemHover, setProblemHover] = useState(false)
  const entry = historyEntries.find((h) => h.id === entryId)
  const current = historyEntries.find((h) => h.id === activeHistoryId)
  const isCurrent = entryId === activeHistoryId
  const baseEntry = playing ? historyEntries.find((h) => h.id === baseEntryId) ?? null : null
  // Which checkpoint's typing has finished (the preview switches then).
  const [typedId, setTypedId] = useState(null)
  const typed = typedId === entryId
  const diffBase = current
  // The checkpoint before this one on the timeline — what it's compared with
  // on asking, and what its own change is measured against.
  const previousEntry = historyEntries.find((h) => h.id === baseEntryId) ?? null
  const number = position ? position.index + 1 : null
  const mineTitle = number ? `This version · #${number}` : 'This version'
  // Its code is the current version's: two renders of it side by side would
  // be the same picture twice — it's shown once, and can be compared with
  // the checkpoint before it instead.
  const sameAsCurrent = Boolean(entry && current) && snapshotLines(entry.snapshot).join('\n') === snapshotLines(current.snapshot).join('\n')
  // What it's compared with: the checkpoint before it, or the current version.
  const base = baseline === 'previous' && previousEntry ? 'previous' : 'current'
  const baseEntryOf = base === 'previous' ? previousEntry : current
  const sameAsBase = Boolean(entry && baseEntryOf) && snapshotLines(entry.snapshot).join('\n') === snapshotLines(baseEntryOf.snapshot).join('\n')
  // The two sides, left → right (or above → below). Against the checkpoint
  // before: in time order, that one then this. Against the current version:
  // this one then the current. Null: nothing to compare (playing, or the
  // two are the same code — one render then, not the same picture twice).
  // (`comparison`: what this step is compared with, playing or not — its
  // change line and its line count don't blink out while it plays. `pair`:
  // the two drawn side by side — not while playing, when the one render
  // follows the typing.)
  const comparison = useMemo(() => {
    if (!entry || !baseEntryOf || sameAsBase) return null
    return base === 'previous'
      ? { left: previousEntry, right: entry, leftTitle: number ? `Previous · #${number - 1}` : 'Previous version', rightTitle: mineTitle, thisSide: 'other' }
      : { left: entry, right: current, leftTitle: mineTitle, rightTitle: 'Current version', thisSide: 'mine' }
  }, [entry, baseEntryOf, sameAsBase, base, previousEntry, number, mineTitle, current])
  const pair = playing ? null : comparison

  const rows = useMemo(
    () => (comparison ? diffLines(snapshotLines(comparison.left.snapshot), snapshotLines(comparison.right.snapshot)) : []),
    [comparison]
  )
  // Playback shows the code itself, being typed — no diff.
  const showDiff = Boolean(pair)
  // The diff as shown: its changed hunks (the rest folded) or the whole
  // file; without a comparison, the file as it was.
  const codeRows = useMemo(() => {
    if (!showDiff) return numberRows(snapshotLines(entry?.snapshot).map((text) => ({ kind: 'same', text })))
    return wholeFile ? numberRows(rows) : foldRows(rows)
  }, [showDiff, rows, entry, wholeFile])
  const changedLines = useMemo(() => changedLineCount(rows), [rows])
  // Playing: the checkpoint before this one until its code is typed in,
  // then this one. Otherwise the latest (comparing) or this version.
  const shownSnapshot = playing ? (baseEntry && !typed ? baseEntry : entry) : pair ? pair.right : entry
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
    const specOf = (item) => (item ? renderOf(projectId, item.snapshot.fileId, snapshotLines(item.snapshot)) : null)
    const viewed = playing && baseEntry && !typed ? baseEntry : pair ? pair.left : entry
    const own = specOf(viewed)
    if (!own) return null
    const category = categoryFor(projectId, entry.snapshot.fileId)
    const reference = screenOf(referencePick(category), category)
    const other = pair ? specOf(pair.right)?.spec ?? null : null
    const mine = specOf(entry)?.spec ?? null
    return {
      ...own,
      // (One render: this version is the current one — said here, and only here.)
      title: pair ? pair.leftTitle : base === 'current' && !playing ? 'This version = current version' : mineTitle,
      category,
      thisSide: pair?.thisSide ?? 'mine',
      // The change between the two sides, in words and in code values — the
      // change alone (a problem it causes is the problem line's).
      delta: comparison ? layoutDelta(specOf(comparison.left)?.spec, specOf(comparison.right)?.spec, reference, { effects: false }) : null,
      deltaCode: comparison ? layoutDeltaCode(specOf(comparison.left)?.spec, specOf(comparison.right)?.spec, reference) : null,
      compare: other ? { title: pair.rightTitle, spec: other } : null,
      // The checkpoint before this one — what "바뀐 요소" is measured against when one render is shown
      // (with two, it's what differs between them); `unchanged`: its code is the same as that one's.
      // (While a step plays and its code hasn't been typed yet the render is still the one before, so
      // it's measured against the step's own — the same part stays in view through the step.)
      previous: specOf(playing && baseEntry && !typed ? entry : previousEntry)?.spec ?? null,
      previousIsNext: Boolean(playing && baseEntry && !typed),
      unchanged: Boolean(previousEntry && mine && JSON.stringify(specOf(previousEntry)?.spec) === JSON.stringify(mine)),
      // What's wrong with this version's own render, the checkpoint before
      // it and the current version — for the problem line.
      problems: mine ? problemsAt(mine, reference) : [],
      previousProblems: specOf(previousEntry)?.spec ? problemsAt(specOf(previousEntry).spec, reference) : [],
      currentProblems: specOf(current)?.spec ? problemsAt(specOf(current).spec, reference) : [],
      referenceWidth: reference.width,
    }
  }, [entry, baseEntry, typed, playing, pair, comparison, previousEntry, current, projectId, mineTitle, base])

  // The page's tab: the one the address names (&view=code), else the one picked
  // — kept through checkpoints and playback — else what the checkpoint changed:
  // the screen, unless it only changed code.
  const screenChanged = codeRender ? !codeRender.unchanged : changedIds.length > 0
  const view = embedded ? null : readHistoryView(location.search) ?? (screenPicked || screenChanged || changedLines === 0 ? 'screen' : 'code')
  const setView = (next) => {
    setScreenPicked(next === 'screen')
    navigate({ pathname: location.pathname, search: withHistoryView(location.search, next) }, { replace: true, state: location.state })
  }
  const codeView = codeViewOf({ open: embedded ? codeOpen : view === 'code', playing, comparing: Boolean(comparison), changedLines, wholeFile })

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
  // The change line: what differs between the two sides, in a person's
  // words — else the checkpoint's own summary (which describes the change
  // from the one before it, so only against that), else a count of the
  // lines. Nothing differs: said so.
  const ownSummary = entry.summary ?? projectHistorySeeds[projectId]?.find((seed) => seed.id === entry.id)?.summary ?? null
  // (The same while it plays: the line is the step's, not the playback's.)
  const summary = comparison ? codeRender?.delta ?? (base === 'previous' ? ownSummary : null) ?? `${changedLines} line${changedLines === 1 ? '' : 's'} of code changed`
    : base === 'previous' ? 'No difference from the previous checkpoint' : 'No difference from the current version'
  const summaryCode = comparison && codeRender?.delta ? codeRender.deltaCode : null
  const hasReason = Boolean(why.text) || why.evidence.some((item) => item.kind !== 'conflict')
  // The problem line: a rendering problem this version has — whether it
  // begins here, and whether the current version still has it.
  const problem = codeRender?.problems?.[0] ?? null
  const problemBeganHere = problem ? !codeRender.previousProblems.some((item) => item.id === problem.id) : false
  const problemRemains = problem ? codeRender.currentProblems.some((item) => item.id === problem.id) : false
  const problemConflict = why.evidence.find((item) => item.kind === 'conflict') ?? null
  // The problem as one sentence — the header chip's tooltip.
  const problemSentence = problem ? `${problemBeganHere ? '이 버전부터 ' : ''}${codeRender.referenceWidth}px에서 ${problem.id === 'overlap' ? `카드가 ${problem.label.replace(/^카드 겹침 /, '')} 겹쳐요` : problem.label}${isCurrent ? '' : problemRemains ? ' · 현재 버전에도 남아 있음' : ' · 현재 버전에서는 해결됨'}` : null
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
    // (The source goes by id — this checkpoint's, and which of its sources — and is found again there.)
    if (conflictId) navigate(changeHref(projectId, conflictId, item.kind === 'conflict' ? {} : { evidence: entry.id, source: sourceKeyOf(item) }))
  }
  function copyLink() {
    const url = new URL(historyHref(projectId, entry.id), window.location.origin).href
    Promise.resolve(navigator.clipboard?.writeText(url)).then(() => toast('Link copied')).catch(() => toast('Couldn’t copy the link'))
  }
  const propChanges = diffBase
    ? Object.keys({ ...diffBase.snapshot.previewProps, ...entry.snapshot.previewProps }).filter(
        (key) => diffBase.snapshot.previewProps?.[key] !== entry.snapshot.previewProps?.[key]
      )
    : []


  return (
    // A Merge Studio floating panel: the same surface as the Version
    // History drawer, borderless inside, the mint accent for Restore.
    <div data-history-compare={embedded ? 'embedded' : 'page'} className={cn('flex h-full min-h-0 flex-col overflow-hidden', embedded && 'rounded-xl bg-white/[0.03]')}>
      {embedded ? header : (
        // The one header, straight on the layer (no card): the title and its
        // actions; who · when · where · kind, with the one thing to check;
        // then why, as a plain line.
        <header data-checkpoint-header className="flex shrink-0 flex-col gap-1 pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <h2 data-checkpoint-title title={entry.label} className="min-w-0 truncate text-lg leading-7 font-semibold text-white">{entry.label}</h2>
            {isCurrent && !playing && <span data-checkpoint-current className={CHIP}><LocalizedText text="Current" /></span>}
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {!hideRestore && (
                // A quiet button (the screen's one strong action isn't going back
                // in time), and nothing to restore when this is the current code.
                <span title={sameAsCurrent ? translateText('It’s the same as the current version', language) : undefined} className="flex shrink-0">
                  <button
                    type="button"
                    data-restore-version
                    onClick={() => onRollback?.(entry.id)}
                    disabled={sameAsCurrent || !onRollback}
                    className="ds-pill inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-xs font-medium text-slate-100 transition-colors hover:bg-white/15 hover:text-white disabled:pointer-events-none disabled:bg-white/[0.05] disabled:text-slate-500"
                  >
                    <RotateCcw className="size-3.5" />
                    <LocalizedText text="Restore this version" />
                  </button>
                </span>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger aria-label={translateText('Version actions', language)} title={translateText('Version actions', language)} className="flex size-8 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white">
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {(onArchive || onUnarchive) && (entry.archived
                    ? <DropdownMenuItem onClick={() => onUnarchive?.(entry)}><ArchiveRestore /><LocalizedText text="Restore to History" /></DropdownMenuItem>
                    : <DropdownMenuItem disabled={isCurrent} onClick={() => onArchive?.(entry)}><Archive /><LocalizedText text="Archive checkpoint" /></DropdownMenuItem>)}
                  <DropdownMenuItem data-copy-link onClick={copyLink}><Link2 /><LocalizedText text="Copy link" /></DropdownMenuItem>
                  <DropdownMenuItem data-open-in-workspace onClick={closeHistory}><SquareArrowOutUpRight /><LocalizedText text="Open in Workspace" /></DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-x-1.5 text-xs text-slate-400">
            <span data-checkpoint-meta className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap">
              {who && <><span className="truncate"><LocalizedText text={who} /></span><span aria-hidden className="text-slate-600">·</span></>}
              <span className="shrink-0 tabular-nums"><LocalizedText text={entry.timestamp} /></span>
              {branch && <><span aria-hidden className="text-slate-600">·</span><span translate="no" className="truncate font-mono text-[11px]">{branch.name}</span></>}
              {KIND_LABEL[entry.kind] && <><span aria-hidden className="text-slate-600">·</span><span data-checkpoint-kind className="shrink-0"><LocalizedText text={KIND_LABEL[entry.kind]} /></span></>}
            </span>
            {/* The one thing to check — the whole sentence on hover, and the
                canvas marks where. Narrow: "⚠ 변경 확인". */}
            {problemConflict && (
              <button type="button" data-checkpoint-alert title={problemSentence ?? problemConflict.label} onClick={() => openEvidence(problemConflict)} className="ds-intrinsic ml-1 inline-flex shrink-0 items-center gap-1 rounded text-amber-300 transition-colors hover:text-amber-200">
                <TriangleAlert aria-hidden className="size-3" />
                <span className="min-[1440px]:hidden"><LocalizedText text="Check change" /></span>
                <span className="hidden min-[1440px]:inline"><LocalizedText text="Change needs checking" /> · <LocalizedText text="Open change" /> →</span>
              </button>
            )}
          </div>
          {(why.text || hasReason) && (
            <div data-checkpoint-why className="min-w-0 text-[13px] leading-5 text-slate-300">
              <p className="flex min-w-0 items-baseline gap-1.5">
                {why.text && <span data-checkpoint-reason title={why.text} className="min-w-0 truncate"><LocalizedText text={why.text} /></span>}
                {hasReason && (
                  <button type="button" data-checkpoint-reason-toggle aria-expanded={reasonOpen} onClick={() => setReasonOpen((open) => !open)} className="ds-intrinsic shrink-0 rounded text-slate-400 underline-offset-4 transition-colors hover:text-white hover:underline">
                    <LocalizedText text="Details" />
                  </button>
                )}
              </p>
              {reasonOpen && hasReason && <EvidenceLinks items={reasonEvidence} onOpen={openEvidence} className="mt-1.5" />}
            </div>
          )}
        </header>
      )}

      {/* The change line: what this version differs by from what it's
          compared with — in a person's words, then, fainter and in code, the
          values. Why it was made opens under it. */}
      {embedded && summary && (
        <div data-change-summary className="mx-3 mb-2 shrink-0 rounded-lg bg-white/[0.04] px-3 py-1.5 text-[12.5px] leading-5 text-slate-100">
          <p className="flex items-baseline gap-2">
            <MessageSquareText aria-hidden className="size-3.5 shrink-0 translate-y-[2px] text-emerald-300" />
            <span className="sr-only"><LocalizedText text="Change summary" />: </span>
            <span data-summary-text className={cn('min-w-0 shrink truncate', !comparison && 'text-slate-300')} title={summary}><LocalizedText text={summary} /></span>
            {summaryCode && <span data-summary-code translate="no" className="min-w-0 shrink-[2] truncate font-mono text-[11px] text-slate-500" title={summaryCode}>· {summaryCode}</span>}
            {hasReason && (
              <button type="button" data-checkpoint-reason-toggle aria-expanded={reasonOpen} onClick={() => setReasonOpen((open) => !open)} className="ds-intrinsic ml-auto shrink-0 rounded px-1 text-[11.5px] text-slate-400 transition-colors hover:text-white">
                <LocalizedText text="Reason for the change" />
              </button>
            )}
          </p>
          {reasonOpen && hasReason && <ReasonStrip text={why.text} evidence={reasonEvidence} onOpen={openEvidence} className="mt-1 border-t border-white/[0.06] pt-1.5" />}
        </div>
      )}
      {/* The problem line: something wrong with how this version renders —
          apart from the change, in a warning tone, with the way to its change. */}
      {embedded && problem && (
        <p data-problem-line role="status" onMouseEnter={() => setProblemHover(true)} onMouseLeave={() => setProblemHover(false)} className="mx-3 mb-2 flex shrink-0 flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg bg-amber-400/[0.08] px-3 py-1.5 text-[12.5px] leading-5 text-amber-100 ring-1 ring-amber-300/20 ring-inset">
          <TriangleAlert aria-hidden className="size-3.5 shrink-0 text-amber-300" />
          <span data-problem-text>{problemBeganHere ? '이 버전부터 ' : ''}{codeRender.referenceWidth}px에서 {problem.id === 'overlap' ? `카드가 ${problem.label.replace(/^카드 겹침 /, '')} 겹쳐요` : problem.label}</span>
          {!isCurrent && <><span aria-hidden className="text-amber-200/50">·</span><span data-problem-now>{problemRemains ? '현재 버전에도 남아 있음' : '현재 버전에서는 해결됨'}</span></>}
          {problemConflict && (
            <>
              <span aria-hidden className="text-amber-200/50">·</span>
              <button type="button" data-problem-open={problemConflict.id} title={problemConflict.label} onClick={() => openEvidence(problemConflict)} className="ds-intrinsic rounded text-amber-50 underline underline-offset-4 transition-colors hover:text-white">변경 확인 열기</button>
            </>
          )}
        </p>
      )}

      {/* The page: a Screen | Code tab under the header, and the tab taking
          all the height that's left. The replay (embedded) keeps its stack —
          the renders, the code folded or open under them. */}
      {!embedded && (
        <div role="tablist" aria-label={translateText('View', language)} data-history-tabs className="flex h-10 shrink-0 items-end gap-5 border-b border-white/[0.08]">
          {[['screen', 'Screen', null], ['code', 'Code', comparison ? `${changedLines} line${changedLines === 1 ? '' : 's'} in code` : null]].map(([id, label, count]) => (
            <button key={id} type="button" role="tab" data-history-tab={id} aria-selected={view === id} onClick={() => setView(id)}
              className={cn('ds-intrinsic -mb-px inline-flex h-9 items-center gap-1.5 border-b-2 text-[13px] font-medium whitespace-nowrap transition-colors', view === id ? 'border-white text-white' : 'border-transparent text-slate-400 hover:text-slate-200')}>
              <LocalizedText text={label} />
              {count && <span className="font-normal text-slate-500 tabular-nums"><LocalizedText text={count} /></span>}
            </button>
          ))}
        </div>
      )}

      {/* What it looks like — the main thing: the whole width, this version
          on the left and the current one on the right. */}
      {(embedded || view === 'screen') && (
      <div data-compare-render role={embedded ? undefined : 'tabpanel'} className={cn('relative flex min-h-[260px] flex-1 basis-0 flex-col overflow-hidden', embedded && 'mx-3 rounded-xl bg-black/35')}>
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
            variant="compare"
            emphasizeMark={problemHover && problem ? problem.id : null}
            flush={!embedded}
          toolbarExtra={(
            // What it's compared with — the one control for it: "비교: 이전 버전 ▾".
            <DropdownMenu>
              <DropdownMenuTrigger data-baseline={base} data-toolbar-control aria-label={translateText('Compared with', language)} className="ds-intrinsic inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium whitespace-nowrap text-slate-100 transition-colors hover:bg-white/[0.08] hover:text-white">
                <span className="font-normal text-slate-400"><LocalizedText text="Compare" />:</span>
                <LocalizedText text={base === 'previous' ? 'Previous version' : 'Current version'} />
                <ChevronDown className="size-3 shrink-0 text-slate-400" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-44">
                {[['previous', 'Previous version'], ['current', 'Current version']].map(([id, label]) => {
                  const unavailable = id === 'previous' && !previousEntry
                  return (
                    <span key={id} title={unavailable ? translateText('This is the first checkpoint: there’s none before it', language) : undefined} className="block">
                      <DropdownMenuItem data-baseline-option={id} aria-checked={base === id} disabled={unavailable || playing} onClick={() => onBaselineChange?.(id)} className="gap-2 text-xs">
                        <Check className={cn('size-3.5 shrink-0', base === id ? 'opacity-100' : 'opacity-0')} />
                        <LocalizedText text={label} />
                      </DropdownMenuItem>
                    </span>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          caption={
              <span className="shrink-0 text-slate-300">
                {/* (A code render names what it shows over its frame; "Current" is the header's badge.) */}
                {codeRender?.spec ? null : playing ? 'This step' : pair ? pair.rightTitle : base === 'current' ? 'This version = current version' : mineTitle}
              </span>
            }
          />
      </div>
      )}

      {/* The code, in its own tab: what changed (the rest folded) until the
          whole file is asked for — read the same way round, this version
          first. Playing on the Screen tab, it still types itself out, unseen. */}
      {!embedded && view === 'screen' && playing && <div hidden><PlaybackCode key={entryId} from={playFrom} to={playTo} onTyped={handleTyped} onDone={onStepDone} layout={diffLayout} /></div>}
      {!embedded && view === 'code' && (
        <section data-compare-code="open" data-code-view={codeView} role="tabpanel" aria-label="Code" className="flex min-h-0 flex-1 basis-0 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center gap-2 py-2 text-[11px] text-slate-500">
            <Code2 className="size-3 shrink-0" />
            <span translate="no" className="min-w-0 truncate font-mono">{getFileName(entry.snapshot.fileId)}</span>
            <span data-code-changed className="shrink-0 text-slate-300"><LocalizedText text={comparison ? `${changedLines} line${changedLines === 1 ? '' : 's'} changed` : 'No difference'} /></span>
            <span className="ml-auto flex shrink-0 items-center gap-2">
              {!playing && (
                <button type="button" data-code-whole-file aria-pressed={wholeFile} onClick={() => setWholeFile((current) => !current)} className={cn('ds-intrinsic inline-flex h-6 items-center rounded-md px-2 font-sans text-[10.5px] font-medium transition-colors', wholeFile ? 'bg-white/[0.12] text-white' : 'bg-white/[0.05] text-slate-300 hover:text-white')}>
                  <LocalizedText text="Show the whole file" />
                </button>
              )}
              <DiffLayoutTabs layout={diffLayout} onLayout={setDiffLayout} />
            </span>
          </div>
        <div className="min-h-0 flex-1 overflow-auto pb-2 text-[12px] leading-5">
          {codeView === 'typing' ? (
            // Keyed to the checkpoint: each step starts from the one
            // before it, exactly, and ends on this one, exactly.
            <div className="font-mono"><PlaybackCode key={entryId} from={playFrom} to={playTo} onTyped={handleTyped} onDone={onStepDone} layout={diffLayout} /></div>
          ) : codeView === 'hunks' || codeView === 'whole' ? (
            <DiffView rows={codeRows} layout={diffLayout} wrap={false} className="text-[12px]" labels={[pair.leftTitle, pair.rightTitle]} />
          ) : codeView === 'none' ? (
            // Nothing changed at this step: said, in the area's own place.
            <p data-code-none className="px-3 py-2 font-sans text-xs text-slate-400"><LocalizedText text="No code change" /></p>
          ) : codeRows.map((row, index) => (
            // (No difference: the file itself, as it is in both.)
            // (A line stays a line: the block scrolls sideways, the code doesn't wrap.)
            <div key={index} className="flex w-max min-w-full py-px pr-3 font-mono whitespace-pre text-slate-300">
              <span className={GUTTER}>{row.to ?? ''}</span>
              <span className="whitespace-pre">{row.text || ' '}</span>
            </div>
          ))}
        </div>
        </section>
      )}

      {/* The code behind it, under it: just what changed (the rest folded)
          until the whole file is asked for — read the same way round, this
          version first. */}
      {embedded && codeView === 'folded' ? (
        // One line: the file and how much of it differs (from what it's
        // compared with) — the code itself on asking. Folded stays folded
        // through playback (which goes on behind it).
        <button type="button" data-compare-code="folded" aria-expanded="false" onClick={() => setCodeOpen(true)} className="ds-intrinsic mx-3 mt-2 mb-3 flex h-9 shrink-0 items-center gap-2 rounded-xl bg-black/20 px-3 text-left text-[11px] text-slate-400 transition-colors hover:bg-black/30 hover:text-slate-200">
          <ChevronRight className="size-3.5 shrink-0" />
          <Code2 className="size-3 shrink-0" />
          <span translate="no" className="min-w-0 truncate font-mono">{getFileName(entry.snapshot.fileId)}</span>
          <span aria-hidden>·</span>
          <span data-code-changed className={cn('shrink-0', comparison && 'text-slate-200')}><LocalizedText text={comparison ? `${changedLines} line${changedLines === 1 ? '' : 's'} changed` : 'No difference'} /></span>
        </button>
      ) : null}
      {/* (Playing with the code folded: the step still types itself out, unseen, and moves on.) */}
      {embedded && codeView === 'folded' && playing && <div hidden><PlaybackCode key={entryId} from={playFrom} to={playTo} onTyped={handleTyped} onDone={onStepDone} layout={diffLayout} /></div>}
      {embedded && codeView !== 'folded' && (
      // Unfolded: one height whether it plays or stands still, so nothing
      // around it moves when playback starts, pauses or ends.
      <section data-compare-code="open" data-code-view={codeView} aria-label="Code" className="mx-3 mt-2 mb-3 flex min-h-[132px] shrink flex-col overflow-hidden rounded-xl bg-black/20" style={{ height: wholeFile ? '44%' : '36%' }}>
        <div className="flex shrink-0 items-center gap-2 px-3 pt-2 pb-1 text-[11px] text-slate-500">
          <button type="button" data-code-fold aria-expanded="true" aria-label="Fold the code" title="Fold the code" onClick={() => setCodeOpen(false)} className="ds-intrinsic -ml-1 flex size-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-white/[0.08] hover:text-white"><ChevronRight className="size-3.5 rotate-90" /></button>
          <Code2 className="size-3 shrink-0" />
          <span translate="no" className="min-w-0 truncate font-mono">{getFileName(entry.snapshot.fileId)}</span>
          <span data-code-changed className="shrink-0 text-slate-300"><LocalizedText text={comparison ? `${changedLines} line${changedLines === 1 ? '' : 's'} changed` : 'No difference'} /></span>
          <span className="ml-auto flex shrink-0 items-center gap-2">
            {!playing && (
              <button type="button" data-code-whole-file aria-pressed={wholeFile} onClick={() => setWholeFile((current) => !current)} className={cn('ds-intrinsic inline-flex h-6 items-center rounded-md px-2 font-sans text-[10.5px] font-medium transition-colors', wholeFile ? 'bg-white/[0.12] text-white' : 'bg-white/[0.05] text-slate-300 hover:text-white')}>
                <LocalizedText text="Show the whole file" />
              </button>
            )}
            {/* (Always there: it sets the replay's layout too.) */}
            <DiffLayoutTabs layout={diffLayout} onLayout={setDiffLayout} />
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto pb-2 text-[12px] leading-5">
          {codeView === 'typing' ? (
            // Keyed to the checkpoint: each step starts from the one
            // before it, exactly, and ends on this one, exactly.
            <div className="font-mono"><PlaybackCode key={entryId} from={playFrom} to={playTo} onTyped={handleTyped} onDone={onStepDone} layout={diffLayout} /></div>
          ) : codeView === 'hunks' || codeView === 'whole' ? (
            <DiffView rows={codeRows} layout={diffLayout} wrap={false} className="text-[12px]" labels={[pair.leftTitle, pair.rightTitle]} />
          ) : codeView === 'none' ? (
            // Nothing changed at this step: said, in the area's own place.
            <p data-code-none className="px-3 py-2 font-sans text-xs text-slate-400"><LocalizedText text="No code change" /></p>
          ) : codeRows.map((row, index) => (
            // (No difference: the file itself, as it is in both.)
            // (A line stays a line: the block scrolls sideways, the code doesn't wrap.)
            <div key={index} className="flex w-max min-w-full py-px pr-3 font-mono whitespace-pre text-slate-300">
              <span className={GUTTER}>{row.to ?? ''}</span>
              <span className="whitespace-pre">{row.text || ' '}</span>
            </div>
          ))}
        </div>
      </section>
      )}

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
