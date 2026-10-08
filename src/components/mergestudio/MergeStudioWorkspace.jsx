import { reviewTabFor } from '@/lib/conflicts'
import CheckStatus from '@/components/mergestudio/CheckStatus'
import { MergeCheckGuide } from '@/components/conflicts/CheckDecisions'
import { translateText } from '@/i18n/translate'
import { useLanguage } from '@/i18n/language'
import { toast } from '@/i18n/toast'
import { LocalizedText } from '@/i18n/runtime'
import { notificationDestination } from '@/lib/inboxNotifications'
import { createPortal } from 'react-dom'
import { MergeDeckSlotContext } from '@/components/mergestudio/MergeDeckSlot'
import { signature } from '@/lib/demoStorage'
import { studioAdjustmentsOf } from '@/lib/sizeAdjustment'
import { ADJUSTMENT_REASONS } from '@/lib/rationale'
import { InlineDeviationReason } from '@/components/conflicts/Rationale'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Fragment, useCallback, useContext, useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronDown, Ellipsis, Layers3, ListChecks, MousePointerClick, RotateCcw, TriangleAlert, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { canvasPages, codeMergeVariants, designMergeVariants, mergeFilesFor } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import MergeInfiniteCanvas, { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import DraftCompareBoard from '@/components/mergestudio/DraftCompareBoard'
import BlockDeckPanel from '@/components/mergestudio/BlockDeckPanel'
import { diffEffect, frameWithLayers, mergeOverride } from '@/components/mergestudio/mergeEffects'
import { buildSummary } from '@/components/mergestudio/mergeSummary'
import MergePreviewOverlay from '@/components/mergestudio/MergePreviewOverlay'
import MergeInboxDrawer from '@/components/mergestudio/MergeInboxDrawer'
import MergeHelp from '@/components/mergestudio/MergeHelp'
import PlacementOverlay from '@/components/mergestudio/PlacementOverlay'
import LayerTransformHandles from '@/components/mergestudio/LayerTransformHandles'
import { COPY_FILE_ID, copyEdits, copyEntries, copyFile, copyLineFor, formatCopyLine, parseCopyLine } from '@/components/mergestudio/copyFile'
import WorkspaceBottomPanel from '@/components/workspace/WorkspaceBottomPanel'
import ConflictPanel from '@/components/dockview/panels/ConflictPanel'
import MergeChangesPanel from '@/components/mergestudio/MergeChangesPanel'
import { DesignComparePanel, designCompareOptions, resolvedEffects } from '@/components/mergestudio/DesignComparison'
import { draftRows } from '@/lib/driftDecisions'
import { LAYOUT_KEY, composeDraftFrame, compositionChecks, draftFrame, draftScreens, layerSource, layoutDecision, regionKey, regionLayout, regionPicks } from '@/data/draftScreens'
import { checksFor } from '@/components/mergestudio/mergeChecks'
import { cn } from 'cn'
import { PANEL_RADIUS, STUDIO_PILL } from '@/components/mergestudio/floatingStyles'

// The whole right-hand side of Merge Studio — a single shared infinite
// canvas (MergeInfiniteCanvas) holding the merge item's unified code window
// and design artboards, with the Block Deck as a draggable window that opens
// only when a canvas element is clicked — the canvas itself spans this whole area
// underneath both. This component is the orchestrator: it owns the
// code<->design sync selection (driven by clicking a layer on an artboard
// or a line in the code window — see `designMergeVariants[item.id]
// .layerCodeMap`) plus the currently live-previewed AI Block Deck
// suggestion, and hands both to its children, resetting them whenever a
// different merge item or layer is selected.
// The Current Implementation artboard's per-layer look for every drifted
// layer: each property shows the Current Implementation's own value until a
// choice is made, then the chosen value (Original / Current / custom). The
// hovered option beats the committed choice for the same diff, so hovering
// previews without committing.
// Mixing drafts, under the comparison strip: the selected element's
// properties, each with every compared draft's value to take — or the
// whole element from one draft — and a summary of where each element's
// values come from. Picks are ordinary drift decisions (A / B / custom),
// so the Result artboard, the conflict's Decide row, checks and merging all follow.
// Mixing drafts, under the comparison strip: a row per thing to decide — a
// screen region when the drafts differ in layout (take that region from a
// draft, whatever's in it), else an element's property — and a column per
// compared draft. Clicking on a draft's artboard picks too (see the
// selection effect below). Picks are ordinary decisions, so the Result
// artboard, the conflict's review, checks and merging all follow.
// Mixing drafts one part at a time, from a slim floating bar: the part is
// picked from a dropdown (or by selecting it on the canvas, or ← / →), and
// its drafts are letters — pressing one uses it for that part, pressing it
// again takes it back. A whole draft for every part, and starting over, are
// in its ⋯ menu. Picks are ordinary decisions, so the Result, the
// conflict's review, checks and merging all follow.
function MixPanel({ item, options, decisions, selectedLayerId, onDecide, checks, onFix, requestedRegion, removedRegions = [], onGripPointerDown, onShowRegion }) {
  const language = useLanguage()
  const keys = new Set(options.map((o) => o.key))
  const rows = draftRows({}, item, decisions).map((row) => ({ ...row, options: row.options.filter((o) => keys.has(o.key)) }))
  const columns = rows[0]?.options ?? []
  const partName = (row) => [row.layer && translateText(row.layer, language), translateText(row.label, language)].filter(Boolean).join(' · ')
  const decided = rows.filter((row) => row.decided).length
  const [step, setStep] = useState(() => Math.max(0, rows.findIndex((row) => !row.decided)))
  const current = rows[Math.min(step, rows.length - 1)]
  // The parts dropdown.
  const [open, setOpen] = useState(false)
  const show = (index) => setStep(index)
  // Selecting a part on the canvas brings its step up.
  const source = layerSource(selectedLayerId)
  const activeKey = source ? regionKey(source.regionId) : rows.find((row) => row.key.startsWith(`${selectedLayerId}:`))?.key
  useEffect(() => {
    const index = rows.findIndex((row) => row.key === activeKey)
    if (index >= 0) show(index)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey])
  useEffect(() => {
    if (!requestedRegion) return
    const index = rows.findIndex((row) => row.region?.id === requestedRegion)
    if (index >= 0) show(index)
    // Region requests arrive from a failed check in the review panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedRegion])
  // What each choice would do to the checks — worked out for every option
  // up front, so nothing has to be picked just to find out. A check counts
  // against a part when that part is one of the ones it's about.
  const fallback = item.authorAId ?? columns[0]?.key
  const issuesWith = (picks) => compositionChecks(item.id, picks, fallback).filter((check) => !check.ok && check.id !== 'picked')
  const picksNow = regionPicks(item.id, decisions)
  const issuesNow = issuesWith(picksNow)
  const optionIssues = (row, option) => (row.region
    ? issuesWith({ ...picksNow, [row.region.id]: option.key }).filter((check) => check.regionIds?.includes(row.region.id))
    : [])
  const rowIssues = (row) => (row.region ? issuesNow.filter((check) => check.regionIds?.includes(row.region.id)) : [])
  const wholeFrom = (key) => rows.length > 0 && rows.every((row) => row.options.find((o) => o.key === key)?.picked)
  const takeAll = (key) => rows.forEach((row) => onDecide(row.key, row.options.find((o) => o.key === key).decision))
  // Used for this part, or taken back.
  function use(option) {
    onDecide(current.key, option.picked ? null : option.decision)
  }
  const stepRegion = useEffectEvent((direction) => setStep((value) => Math.max(0, Math.min(rows.length - 1, value + direction))))
  useEffect(() => {
    function onKey(event) {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName))) return
      event.preventDefault()
      stepRegion(event.key === 'ArrowLeft' ? -1 : 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  if (!current) return null
  const ko = language === 'ko'
  const screen = draftScreens[item.id]
  const pickedOf = (row) => row.options.find((option) => option.picked)
  // A draft's version of a part, drawn small — how a part, and each draft's
  // take on it, is recognized at a glance rather than by name.
  const thumb = (row, option, width) => (row.region && screen
    ? <RegionThumb part={screen.drafts[option.key]?.[row.region.id]} width={width} />
    : <span className="flex h-8 items-center justify-center truncate rounded-md bg-white px-1 text-[10px] text-slate-600" style={{ width }}>{option.literal ? option.value : translateText(String(option.value), language)}</span>)
  const fixCheck = (check) => {
    const index = rows.findIndex((row) => check.regionIds?.includes(row.region?.id))
    if (index >= 0) setStep(index)
    else onFix(check)
  }

  return (
    // A slim floating bar: the part (from a dropdown of thumbnails), that
    // part as each draft draws it — pick one by its picture — the checks,
    // and a menu with the rest. Drag it anywhere by its background.
    <div
      data-mix-panel
      onPointerDown={(event) => { if (onGripPointerDown && !event.target.closest('button, [role="menu"], [role="listbox"], [data-slot="popover-content"]')) onGripPointerDown(event) }}
      className="pointer-events-auto flex w-fit max-w-full cursor-grab items-center gap-2 rounded-2xl border border-white/10 bg-[#17191d]/95 p-1.5 shadow-2xl backdrop-blur-xl active:cursor-grabbing"
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          data-mix-region-trigger
          title={ko ? '요소 고르기' : 'Pick a part'}
          className="ds-intrinsic flex h-9 min-w-0 items-center gap-1 rounded-xl px-2 text-[12px] font-medium text-slate-100 transition-colors hover:bg-white/[0.06]"
        >
          <span className="max-w-24 truncate">{partName(current)}</span>
          <ChevronDown className="size-3.5 shrink-0 text-slate-500" />
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={8} className="w-64 gap-0 rounded-xl p-1">
          <ul role="listbox" aria-label={ko ? '요소' : 'Parts'} className="flex flex-col gap-0.5">
            {rows.map((row, i) => {
              const picked = pickedOf(row)
              return (
                <li key={row.key}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === step}
                    data-mix-region={row.region?.id ?? row.key}
                    onClick={() => { setStep(i); setOpen(false); if (row.region) onShowRegion?.(row.region.id) }}
                    className={cn('ds-intrinsic flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left text-[12px] transition-colors', i === step ? 'bg-white/[0.08] text-white' : 'text-slate-300 hover:bg-white/[0.05]')}
                  >
                    {/* The part as it is in the mix (or the first draft's, until picked). */}
                    {thumb(row, picked ?? row.options[0], 72)}
                    <span className="min-w-0 flex-1 truncate">{partName(row)}</span>
                    <span className={cn('text-[11px] font-semibold', picked ? (rowIssues(row).length ? 'text-amber-300' : 'text-emerald-300') : 'text-slate-600')}>{picked?.letter ?? '–'}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </PopoverContent>
      </Popover>
      {/* This part as each draft has it: its picture, the letter in the
          corner. The one in use is ringed; pressing it again takes it back. */}
      <div role="group" aria-label={ko ? `${partName(current)} 시안` : `${partName(current)} drafts`} className="flex items-center gap-1.5">
        {current.options.map((option) => {
          const issues = optionIssues(current, option)
          return (
            <button
              key={option.key}
              type="button"
              data-mix-option={option.key}
              aria-pressed={option.picked}
              onClick={() => use(option)}
              title={`${option.name} · ${option.literal ? option.value : translateText(String(option.value), language)}${issues.length ? ` · ${issues.map((check) => translateText(check.title, language)).join(' · ')}` : ''}`}
              className={cn('ds-intrinsic relative rounded-lg p-0.5 transition-[box-shadow,opacity]', option.picked ? 'ring-2 ring-emerald-300' : 'opacity-70 ring-1 ring-white/10 hover:opacity-100 hover:ring-white/30')}
            >
              {thumb(current, option, 64)}
              <span className={cn('absolute bottom-1 left-1 flex size-4 items-center justify-center rounded text-[9.5px] font-semibold', option.picked ? 'bg-emerald-300 text-slate-950' : issues.length ? 'bg-amber-300 text-slate-950' : 'bg-slate-900/80 text-white')}>{option.letter}</span>
            </button>
          )
        })}
      </div>
      <CheckStatus compact checks={checks} onFix={fixCheck} />
      {/* The rest, out of the way: a whole draft for every part, or start over. */}
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={ko ? '더 보기' : 'More'} title={ko ? '더 보기' : 'More'} className="ds-intrinsic flex size-7 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/[0.08] hover:text-white">
          <Ellipsis className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          {columns.map((column) => (
            <DropdownMenuItem key={column.key} data-draft-tab={column.key} onClick={() => (wholeFrom(column.key) ? rows.forEach((row) => onDecide(row.key, null)) : takeAll(column.key))}>
              {wholeFrom(column.key) ? <Check className="size-3.5 text-emerald-300" /> : <span className="size-3.5" />}
              {ko ? `모두 시안 ${column.letter}로` : `All from draft ${column.letter}`}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem
            disabled={decided === 0 && !decisions[LAYOUT_KEY]}
            onClick={() => { rows.forEach((row) => row.decided && onDecide(row.key, null)); onDecide(LAYOUT_KEY, null); setStep(0) }}
          >
            <RotateCcw className="size-3.5" />
            {ko ? '처음부터 다시' : 'Start over'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {current.region && removedRegions.includes(current.region.id) && (
        <span data-mix-removed className="sr-only">{ko ? '결과 화면에서 뺀 영역 · 시안을 고르면 다시 들어가요' : 'Taken out of the result · picking a draft puts it back'}</span>
      )}
    </div>
  )
}

// One draft's version of one screen region, drawn small (its whole width,
// scaled) — the picker's thumbnails.
function RegionThumb({ part, width }) {
  const height = Math.round(width * 0.62)
  if (!part?.layers.length) return <span className="block rounded-md bg-white/[0.06]" style={{ width, height }} />
  const h = (part.height ?? 0) + 16
  const scale = Math.min(width / 280, height / h)
  return (
    <span className="relative block overflow-hidden rounded-md bg-white" style={{ width, height }}>
      <span className="pointer-events-none absolute top-1/2 left-1/2 block origin-center" style={{ width: 280, height: h, transform: `translate(-50%, -50%) scale(${scale})` }}>
        {part.layers.map((layer) => <StaticLayer key={layer.id} layer={{ ...layer, y: layer.y + 8 }} onSelect={() => {}} />)}
      </span>
    </span>
  )
}

function buildVariantPreviews(itemId, resolutions, hoverDiff) {
  const layerDiffs = designMergeVariants[itemId]?.layerDiffs ?? {}
  const previews = {}
  for (const [layerId, diffs] of Object.entries(layerDiffs)) {
    let merged = {}
    for (const diff of diffs) {
      const hovered = hoverDiff?.layerId === layerId && hoverDiff.diffId === diff.id ? hoverDiff.side : null
      merged = mergeOverride(merged, diffEffect(diff, hovered ?? resolutions[`${layerId}:${diff.id}`] ?? 'B'))
    }
    previews[layerId] = merged
  }
  return previews
}

// A smart default target so the Block Deck never opens on "Nothing selected":
// the primary CTA (a button with variant options), else the first layer with
// options, else any button, else the first layer.
function defaultLayerFor(item) {
  if (!item?.hasDesign) return null
  const frame = canvasPages.find((p) => p.id === item.designPageId)?.frames[0]
  const diffs = designMergeVariants[item.id]?.layerDiffs ?? {}
  const layers = frame?.layers ?? []
  return (
    (layers.find((l) => l.type === 'button' && diffs[l.id]) ??
      layers.find((l) => diffs[l.id]) ??
      layers.find((l) => l.type === 'button') ??
      layers[0])?.id ?? null
  )
}

// Fallback for code-only data: the first incoming code diff.
function defaultLineFor(item) {
  for (const [fileId, diffs] of Object.entries(codeMergeVariants[item?.id] ?? {})) {
    if (diffs[0]) return { fileId, line: diffs[0].line, endLine: diffs[0].line }
  }
  return null
}

// Deck width plus its 16px right inset and 16px breathing room.

function MergeStudioWorkspace({ item }) {
  const {
    setActiveFileId,
    setFilesWindow,
    filesWindow,
    getFileLines,
    setActivePageId,
    mergeDrawer,
    setMergeDrawer,
    mergeFocus,
    linesOfFile,
    designCompareRequest,
    setDesignCompareRequest,
    requestMergeFocus,
    requestHistoryDrawer,
    mergePreviewOpen,
    setMergePreviewOpen,
    exitMergeStudio,
    setSelectedMergeItemId,
    openConflictReview,
    openConflictFromNotification,
    setBottomPanel,
    mergeDrafts,
    saveMergeDraft,
    setStudioDecisions,
    checkGuide,
    setCheckGuide,
    conflicts,
    updateConflict,
    createMergeRequest,
    currentUser,
    mergeItems,
  } = useWorkspace()
  const { element: deckElement } = useContext(MergeDeckSlotContext)
  const savedDraft = mergeDrafts.current[item?.id] ?? {}
  const [syncSelection, setSyncSelection] = useState(null)
  const [appliedPreset, setAppliedPreset] = useState(savedDraft.appliedPreset ?? null)
  // The Block Deck collapses into a toggle pill in the canvas header (next
  // to Share); any fresh selection re-expands it.
  const [annotationsSnap, setAnnotationsSnap] = useState(savedDraft.annotations ?? [])
  // Block Assemble: per-layer structural edits (shape, size, fill, border,
  // shadow, alignment, icon), previewed live on Option B and bundled into the
  // merge wizard.
  const [assemblies, setAssemblies] = useState(savedDraft.assemblies ?? {})
  // Where each Assemble field came from, recorded by the action that wrote
  // it (never inferred from values): { [layerId]: { [field]: source } }
  // with source { kind: 'custom' } for direct edits, or { kind:
  // 'designSystem', component?, token?, tokens? } for Library components
  // and design-system fill tokens. Preview's Final column reads it.
  const [assemblySources, setAssemblySources] = useState(savedDraft.assemblySources ?? {})
  // Preview's per-item review marks: { [driftId]: signature at review time }.
  // Lives here (not in the wizard, which remounts per open) so reviews
  // survive a round trip to Assemble; see finalValues.reviewStatus.
  const [reviewMarks, setReviewMarks] = useState(savedDraft.reviewMarks ?? {})
  // Asks the Block Deck to switch tabs (e.g. Preview's "Edit in Assemble").
  const [deckTabRequest, setDeckTabRequest] = useState(null)
  // Layers pulled from the Design System library onto both artboards.
  const [addedLayers, setAddedLayers] = useState(savedDraft.addedLayers ?? [])
  const [designCompareItemId, setDesignCompareItemId] = useState(item?.id ?? null)
  const [designCompareKeys, setDesignCompareKeys] = useState([])
  const [designComparison, setDesignComparison] = useState(null)
  // The adjustment's reason is entered in a dialog; saving closes it.
  const [adjustReasonOpen, setAdjustReasonOpen] = useState(false)
  const studioRootRef = useRef(null)
  // Comparing drafts: the share of the stage the drafts pane takes (the
  // Result has the rest), dragged on the divider between them.
  const [draftShare, setDraftShare] = useState(0.5)
  function startSplitDrag(event) {
    if (event.button !== 0) return
    event.preventDefault()
    const pane = event.currentTarget.parentElement.getBoundingClientRect()
    const move = (m) => setDraftShare(Math.min(0.8, Math.max(0.2, (m.clientX - pane.left) / pane.width)))
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.style.cursor = '' }
    document.body.style.cursor = 'col-resize'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  // The element picker floats: null is its spot at the Result's top left;
  // dragged by its grip, it stays where it's put ({ x, y } in the stage).
  const [mixPos, setMixPos] = useState(null)
  function startMixDrag(event) {
    if (event.button !== 0) return
    event.preventDefault()
    const pane = event.currentTarget.closest('[data-mix-pane]')
    const stage = pane.offsetParent.getBoundingClientRect()
    const box = pane.getBoundingClientRect()
    const start = { px: event.clientX, py: event.clientY, x: box.left - stage.left, y: box.top - stage.top }
    const move = (m) => setMixPos({
      x: Math.min(stage.width - 120, Math.max(0, start.x + m.clientX - start.px)),
      y: Math.min(stage.height - 40, Math.max(0, start.y + m.clientY - start.py)),
    })
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // While the deck sits in its default spot the canvas refits so Option B
  // isn't covered by it; once dragged it floats freely and no longer does.
  // Variant Compare state lives here (not in the deck) so choosing — or
  // merely hovering — an option can live-preview on the Option B artboard.
  const [resolutions, setResolutions] = useState(savedDraft.resolutions ?? {})
  const [hoverDiff, setHoverDiff] = useState(null) // { layerId, diffId, side }
  // Hand-typed code lines from the code window, keyed `fileId:line`. They
  // win over incoming and AI-edited text everywhere the merged code shows.
  const [manualCode, setManualCode] = useState(savedDraft.manualCode ?? {})

  const editSnapshot = useMemo(() => ({ resolutions, assemblies, assemblySources, addedLayers, manualCode, annotations: annotationsSnap, appliedPreset }), [resolutions, assemblies, assemblySources, addedLayers, manualCode, annotationsSnap, appliedPreset])
  const [editTimeline, setEditTimeline] = useState({ past: [], present: editSnapshot, future: [] })
  const restoringEdit = useRef(false)
  useEffect(() => {
    if (restoringEdit.current) { restoringEdit.current = false; return }
    setEditTimeline((timeline) => signature(timeline.present) === signature(editSnapshot) ? timeline : {
      past: [...timeline.past, timeline.present].slice(-100), present: editSnapshot, future: [],
    })
  }, [editSnapshot])
  function restoreEdit(direction) {
    const undo = direction === 'undo'
    const source = undo ? editTimeline.past : editTimeline.future
    if (!source.length || item?.tag === 'Merged') return
    const snapshot = undo ? source[source.length - 1] : source[0]
    restoringEdit.current = true
    setEditTimeline(undo
      ? { past: source.slice(0, -1), present: snapshot, future: [editTimeline.present, ...editTimeline.future] }
      : { past: [...editTimeline.past, editTimeline.present], present: snapshot, future: source.slice(1) })
    setResolutions(snapshot.resolutions)
    setAssemblies(snapshot.assemblies)
    setAssemblySources(snapshot.assemblySources)
    setAddedLayers(snapshot.addedLayers)
    setManualCode(snapshot.manualCode)
    setAnnotationsSnap(snapshot.annotations)
    setAppliedPreset(snapshot.appliedPreset)
    setReviewMarks({})
    setLiveCode(null)
  }

  useEffect(() => {
    setDesignCompareItemId(item?.id ?? null)
    setDesignCompareKeys([])
    // Only another item's comparison ends here — one just started for this
    // item (a compare request, see below) stays, even when effects re-run.
    setDesignComparison((current) => (current?.item.id === item?.id ? current : null))
  }, [item?.id])

  // Design Compare lists the screens that have several drafts to compare —
  // not every item with a design page.
  const designCompareItems = mergeItems.filter((candidate) => candidate.hasDesign && candidate.designPageId && draftScreens[candidate.id])
  const designCompareItem = designCompareItems.find((candidate) => candidate.id === designCompareItemId)
  function toggleDesignCompareOption(key) {
    setDesignCompareKeys((current) =>
      current.includes(key) ? current.filter((candidate) => candidate !== key) : [...current, key]
    )
  }
  // Comparing drafts is about one item, so the studio is on that item while
  // it does: another item's drafts switch to it first (the comparison is
  // picked up once it loads), and the compared element is selected.
  function openDesignComparison(compareItem, options) {
    setBottomPanel({ open: false })
    const layerId = Object.keys(designMergeVariants[compareItem.id]?.layerDiffs ?? {})[0]
    if (compareItem.id !== item.id) {
      setDesignCompareRequest({ itemId: compareItem.id, keys: options.map((option) => option.key) })
      requestMergeFocus({ itemId: compareItem.id, ...(layerId && { layerId }), noPan: true })
      return
    }
    setDesignComparison({ item: compareItem, options })
    if (layerId) requestMergeFocus({ itemId: item.id, layerId, noPan: true })
  }
  function backToDrafts() {
    const compared = designComparison
    endComparison()
    if (compared) {
      setDesignCompareItemId(compared.item.id)
      setDesignCompareKeys(compared.options.map((option) => option.key))
    }
    setBottomPanel({ tab: 'design-compare', open: true })
  }
  function endComparison() {
    setDesignComparison(null)
    setDesignCompareRequest(null)
  }
  useEffect(() => {
    if (!item || designCompareRequest?.itemId !== item.id) return
    // The request stays until the comparison is closed (endComparison):
    // the studio can remount while it opens, and the comparison has to
    // survive that.
    const options = designCompareOptions(item).filter((option) => designCompareRequest.keys.includes(option.key))
    if (!options.length) return
    // Same as starting it from the Design Compare tab: the canvas gets the
    // room (the mixing panel is up top; the conflict is a tab away).
    setDesignComparison((current) => (current?.item.id === item.id ? current : { item, options }))
    setBottomPanel({ open: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, designCompareRequest])
  // Submit the composition to its review, without applying it to the project.
  function finishMix() {
    if (item.tag === 'Merged') return
    const conflict = conflicts.find(c => c.mergeItemId === item.id || c.id === item.conflictId)
    // Drafts with no conflict of their own get their merge request made
    // here — otherwise the button had nothing to submit to and did nothing.
    const requestId = conflict?.id ?? createMergeRequest(item).id
    if (conflict) updateConflict(conflict.id, { submittedForMergeAt: Date.now(), ...(!conflict.submittedForMergeAt && { reviewStage: 'detected', reviewers: conflict.reviewers.map(reviewer => ({ ...reviewer, status: 'pending' })) }) })
    endComparison()
    exitMergeStudio()
    // Straight to the request just made — its review, with the merged
    // result — rather than the list to find it in.
    setBottomPanel({ tab: reviewTabFor(conflict ?? { id: requestId }), open: true })
    openConflictReview(requestId)
    toast('병합 요청을 만들었어요', { description: '조합한 결과를 확인한 뒤 검토 요청 → 승인 → 병합 순서로 진행하세요.' })
  }

  function openReviewFor(target) {
    const conflict = conflicts.find((c) => c.mergeItemId === target.id || c.id === target.conflictId)
    if (conflict) openConflictReview(conflict.id)
    setBottomPanel({ tab: 'conflict', open: true })
  }
  // The open conflict this item is being adjusted for (a draft merge is
  // finished with Request merge instead).
  const adjustingFor = item && item.tag !== 'Merged' && !draftScreens[item.id]
    ? conflicts.find((c) => c.reviewStage !== 'resolved' && !c.rollback && (c.mergeItemId === item.id || c.id === item.conflictId)) ?? null
    : null
  const adjustmentCount = studioAdjustmentsOf(item, { [item?.id]: { assemblies } }).reduce((sum, entry) => sum + entry.changes.length, 0)
  const mixPicked = designComparison && item ? draftRows({}, item, resolutions).filter((row) => row.decided).length : 0
  // Design Compare's selected drafts, reshaped as frames for
  // MergeInfiniteCanvas's own pan/zoom space — the same "one shared frame
  // + per-option overrides" shape Option A/B already use there, so the
  // drafts land as real, selectable, draggable artboards on the actual
  // infinite canvas instead of a separate static comparison view.
  // Memoized so toggling/leaving Design Compare doesn't hand
  // MergeInfiniteCanvas a new object identity on every unrelated
  // re-render, which would otherwise reset its pan/zoom/layout each time.
  const designCompare = useMemo(() => {
    if (!designComparison) return null
    const { item: compareItem } = designComparison
    const framePage = canvasPages.find((p) => p.id === compareItem.designPageId)
    const compareFrame = framePage?.frames[0]
    if (!compareFrame) return null
    return {
      frame: compareFrame,
      entries: [
        // (The drafts themselves are their own pane beside it:
        // DraftCompareBoard.)
        {
          // The mix so far, beside the drafts it's drawn from.
          key: 'result',
          label: 'Result — your picks',
          overrides: {},
        },
      ],
    }
  }, [designComparison])
  // The line being typed in the code window right now ({ key, text }), so
  // the canvas re-renders from code on every keystroke — deferred so typing
  // itself never waits on the canvas.
  const [liveCode, setLiveCode] = useState(null)
  const deferredLive = useDeferredValue(liveCode)

  // Unmerged edits are kept per item (in the project's WorkspaceProvider),
  // so switching items, going back to the Workspace or arriving from a
  // Conflict Point's "Open in Merge Studio" picks up where you left off.
  useEffect(() => {
    if (item?.id) saveMergeDraft(item.id, {
      resolutions, assemblies, assemblySources, reviewMarks, addedLayers, manualCode,
      annotations: annotationsSnap, appliedPreset, syncSelection,
    })
  }, [item?.id, saveMergeDraft, resolutions, assemblies, assemblySources, reviewMarks, addedLayers, manualCode, annotationsSnap, appliedPreset, syncSelection])

  useEffect(() => {
    if (!item) return
    const defLayer = defaultLayerFor(item)
    const t = designMergeVariants[item.id]?.layerCodeMap?.[defLayer]
    setSyncSelection(savedDraft.syncSelection ?? (defLayer
      ? { layerId: defLayer, fileId: t?.fileId, line: t?.line, endLine: t ? t.line + (t.span ?? 1) - 1 : undefined }
      : defaultLineFor(item)))
    if (item.fileIds?.[0]) setActiveFileId(item.fileIds[0])
    if (item.hasDesign && item.designPageId) setActivePageId(item.designPageId)
    // This workspace is keyed by item; switching items mounts its saved draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A layer's code block: its `layerCodeMap` span, else (for text-bearing
  // layers with no other code link) its lines in Merge Studio's copy.json.
  function copyTargetFor(layerId) {
    const lines = copyEntries(frame0)
      .map((e, i) => (e.layerId === layerId ? i + 2 : null))
      .filter(Boolean)
    return lines.length ? { fileId: COPY_FILE_ID, line: lines[0], span: lines.length } : null
  }
  function codeTargetFor(layerId) {
    const map = designMergeVariants[item.id]?.layerCodeMap ?? {}
    return map[layerId] ?? copyTargetFor(layerId)
  }

  function selectLayer(layerId, { openDeck = true } = {}) {
    const regionId = layerSource(layerId)?.regionId
    if (designComparison && draftScreens[item.id] && !regionId) return
    if (designComparison && regionId) {
      const first = frame0?.layers.find((layer) => layer.regionId === regionId)
      setSyncSelection({ layerId: first?.id ?? layerId })
      return
    }
    const target = codeTargetFor(layerId)
    setSyncSelection({
      layerId,
      fileId: target?.fileId,
      line: target?.line,
      endLine: target ? target.line + (target.span ?? 1) - 1 : undefined,
    })
    if (openDeck) setFilesWindow({ open: true, tab: 'inspect' })
    // copy.json is Merge Studio-only; never hand it to the main workspace.
    if (target?.fileId && target.fileId !== COPY_FILE_ID) setActiveFileId(target.fileId)
  }

  function selectFrame() {
    // Keep the current selection so the Block Deck still has a target.
    setFilesWindow({ open: true, tab: 'inspect' })
  }

  function selectLine(fileId, line, { openDeck = true } = {}) {
    const map = designMergeVariants[item.id]?.layerCodeMap ?? {}
    // Any line inside a layer's code block resolves to that layer and
    // selects the whole block.
    const layerId =
      fileId === COPY_FILE_ID
        ? copyEntries(frame0)[line - 2]?.layerId
        : Object.keys(map).find(
            (id) => map[id].fileId === fileId && line >= map[id].line && line <= map[id].line + (map[id].span ?? 1) - 1
          )
    // Clicking in copy.json keeps the selection there (so the line can be
    // edited in place) even when the layer also has a component code link.
    const t = layerId ? (fileId === COPY_FILE_ID ? copyTargetFor(layerId) : codeTargetFor(layerId)) : null
    setSyncSelection(
      t
        ? { layerId, fileId: t.fileId, line: t.line, endLine: t.line + (t.span ?? 1) - 1 }
        : { layerId: undefined, fileId, line, endLine: line }
    )
    if (openDeck) setFilesWindow({ open: true, tab: 'inspect' })
  }

  // Opens this item's conflict review in the bottom panel — where its
  // code, checks, review and merge all are.
  function openReview() {
    const conflict = conflicts.find((c) => c.mergeItemId === item?.id || c.id === item?.conflictId)
    if (conflict) openConflictReview(conflict.id)
    setBottomPanel({ tab: 'conflict', open: true })
  }





  // Records the source of each written Assemble field (see assemblySources).
  function recordSources(layerId, keys, source, { replace = false } = {}) {
    setAssemblySources((prev) => {
      const base = replace ? {} : { ...prev[layerId] }
      for (const k of keys) base[k] = source
      return { ...prev, [layerId]: base }
    })
  }
  function dropSources(layerId, keys) {
    setAssemblySources((prev) => {
      if (!prev[layerId]) return prev
      const next = { ...prev }
      if (!keys) delete next[layerId]
      else {
        const s = { ...next[layerId] }
        for (const k of keys) delete s[k]
        next[layerId] = s
      }
      return next
    })
  }

  // A direct Assemble edit: every field it writes is the user's own
  // (`custom`), including the ordinary color palette.
  function assemble(layerId, patch) {
    setAssemblies((prev) => ({ ...prev, [layerId]: { ...prev[layerId], ...patch } }))
    const keys = Object.keys(patch).filter((key) => signature(assemblies[layerId]?.[key]) !== signature(patch[key]))
    if (keys.length) recordSources(layerId, keys, { kind: 'custom', detail: 'Assemble' })
  }

  function resetAssembly(layerId) {
    setAssemblies((prev) => {
      const next = { ...prev }
      delete next[layerId]
      return next
    })
    dropSources(layerId)
  }

  // Code window inline edit: `text === null` drops the manual edit.
  function editCodeLine(fileId, line, text) {
    setManualCode((prev) => {
      const next = { ...prev }
      const key = `${fileId}:${line}`
      if (text === null) delete next[key]
      else next[key] = text
      return next
    })
  }

  // `source` says where the typing is happening: the code window renders
  // live text only from design-side edits, so a line being typed in the
  // code window itself never re-renders out from under its own input.
  function liveEditCodeLine(fileId, line, text, source = 'code') {
    setLiveCode(text === null ? null : { key: `${fileId}:${line}`, text, source })
  }

  // Design-side text edits (on the canvas or in the Block Deck) are written
  // to the layer's copy.json line — live while typing, as a manual edit on
  // commit (dropped again when typed back to the original) — so the code
  // window, Changes log, Preview and merge all pick them up. `value: null`
  // cancels an in-progress live edit.
  const [codeReveal, setCodeReveal] = useState(null)
  function editText(layerId, slot, value, { live = false } = {}) {
    const loc = copyLineFor(frame0, layerId, slot)
    if (!loc) return
    const text = value === null ? null : formatCopyLine(loc.entry.key, value, loc.last)
    setCodeReveal((prev) => (prev?.line === loc.line ? prev : { fileId: COPY_FILE_ID, line: loc.line }))
    if (live) liveEditCodeLine(COPY_FILE_ID, loc.line, text, 'design')
    else {
      setLiveCode(null)
      editCodeLine(COPY_FILE_ID, loc.line, value === loc.entry.value ? null : text)
    }
  }

  // Changes log → Undo (annotation undo is handled inside the canvas).
  function undoChange(entry) {
    if (entry.kind === 'code') {
      editCodeLine(entry.fileId, entry.line, null)
    } else if (entry.kind === 'variant') {
      setResolutions((prev) => {
        const next = { ...prev }
        delete next[entry.key]
        return next
      })
    } else if (entry.kind === 'assembly') {
      resetAssembly(entry.layerId)
    } else if (entry.kind === 'component') {
      setAddedLayers((prev) => prev.filter((l) => l.id !== entry.layerId))
      resetAssembly(entry.layerId)
      if (syncSelection?.layerId === entry.layerId) setSyncSelection(null)
    } else if (entry.kind === 'preset') {
      setAppliedPreset(null)
    }
  }

  // Design System library actions.
  // Apply: restyle the selected element with a component's look (size only
  // when the element is the same kind of component).
  function applyComponent(def) {
    if (!selectedLayer) return
    // Replace: the layer takes on the component's role, look and size.
    const next = {
      ...def.assembly,
      width: Math.min(def.width, Math.max(40, frame0.width - selectedLayer.x - 8)),
      height: def.height,
      ...(def.type !== selectedLayer.type && { asType: def.type, asLabel: def.label, asName: def.name }),
    }
    setAssemblies((prev) => ({ ...prev, [selectedLayer.id]: next }))
    // Every field now comes from this Library component (the assembly is
    // replaced wholesale), with its real name and token list.
    recordSources(selectedLayer.id, ['component', ...Object.keys(next)], { kind: 'designSystem', component: def.name, tokens: def.tokens ?? [] }, { replace: true })
  }

  // Insert: drop a component into the selected container element.
  function insertComponent(def) {
    if (selectedLayer) addComponent(def, selectedLayer)
  }

  // Add: pull a new instance onto both artboards, then select it. `at` is the
  // spot picked in placement mode (PlacementOverlay); without one (and no
  // parent) it falls back to centered below the existing content.
  function addComponent(def, parent = null, at = null) {
    if (!frame0) return
    const width = Math.min(def.width, (parent ? parent.width : frame0.width) - 24)
    const layer = {
      id: `${def.id}-${Date.now()}`,
      name: def.name,
      kind: 'component',
      type: def.type,
      label: def.label,
      ...(at
        ? { x: at.x, y: at.y }
        : parent
        ? parent.type === 'bar' || parent.type === 'tabs'
          ? { x: parent.x + parent.width - width - 12, y: parent.y + Math.round((parent.height - def.height) / 2) }
          : { x: parent.x + 12, y: parent.y + 12 }
        : { x: Math.max(8, Math.round((frame0.width - width) / 2)), y: frame0.height + 12 }),
      width,
      height: def.height,
    }
    setAddedLayers((prev) => [...prev, layer])
    setAssemblies((prev) => ({ ...prev, [layer.id]: { ...def.assembly } }))
    recordSources(layer.id, ['component', ...Object.keys(def.assembly ?? {})], { kind: 'designSystem', component: def.name, tokens: def.tokens ?? [] }, { replace: true })
    setSyncSelection({ layerId: layer.id })
  }

  // Placement mode for a Library component: { def, mode: 'click' | 'drag' }.
  // Selection guides (boxes, link lines, size readouts, drift / hover
  // outlines, resize handles) — toggled from the canvas tools' eye button.
  const [guidesVisible, setGuidesVisible] = useState(true)
  const [placing, setPlacing] = useState(null)
  const placingRef = useRef(null)
  placingRef.current = placing
  const addRef = useRef(addComponent)
  addRef.current = addComponent
  // Stable callbacks, so the overlay's window listeners aren't re-bound on
  // every render mid-drag.
  const placeComponent = useCallback((at) => {
    const p = placingRef.current
    setPlacing(null)
    if (p) addRef.current(p.def, null, at)
  }, [])
  const cancelPlacing = useCallback(() => setPlacing(null), [])

  useEffect(() => setPlacing(null), [item?.id])

  // The conflict review's Decide row reads and writes these live choices
  // while this item is open (see WorkspaceProvider's decideDrift).
  useEffect(() => {
    if (!item?.id) return
    setStudioDecisions({
      itemId: item.id,
      resolutions,
      resolve: (key, decision) => setResolutions((prev) => {
        const next = { ...prev }
        if (decision == null) delete next[key]
        else next[key] = decision
        return next
      }),
      // The review's "Undo adjustment" (and its undo): every hand-set
      // value at once.
      setAssemblies: (next) => setAssemblies(next),
      // A value set on the review's direct adjustment, written in the code.
      setManualCode: (next) => setManualCode(next),
    })
  }, [item?.id, resolutions, setStudioDecisions])
  useEffect(() => () => setStudioDecisions(null), [setStudioDecisions])

  function decide(key, decision) {
    setResolutions((prev) => {
      const next = { ...prev }
      if (decision == null) delete next[key]
      else next[key] = decision
      return next
    })
  }
  // The mix's regions, arranged on the Result: moved up or down, dragged to
  // a place, or taken out. Kept among the decisions (LAYOUT_KEY), so it's
  // undone and redone, saved and merged like a pick — and everything that
  // draws the Result (the code and checks with it) follows at once.
  const mixLayout = item && draftScreens[item.id] ? regionLayout(item.id, resolutions) : null
  // The region selected on the Result (through any of its elements).
  const selectedRegion = designComparison && mixLayout ? (() => {
    const id = layerSource(syncSelection?.layerId)?.regionId
    return id && !mixLayout.removed.includes(id) ? id : null
  })() : null
  const arrange = (next) => decide(LAYOUT_KEY, layoutDecision(item.id, next))
  const shown = (layout) => layout.order.filter((id) => !layout.removed.includes(id))
  function reorderRegion(id, index) {
    const rest = shown(mixLayout).filter((entry) => entry !== id)
    rest.splice(Math.max(0, Math.min(index, rest.length)), 0, id)
    arrange({ order: [...rest, ...mixLayout.removed], removed: mixLayout.removed })
  }
  function moveRegion(id, by) {
    const at = shown(mixLayout).indexOf(id)
    if (at >= 0) reorderRegion(id, at + by)
  }
  function removeRegion(id) {
    arrange({ order: mixLayout.order, removed: [...mixLayout.removed, id] })
    setSyncSelection(null)
  }
  // Using a draft for a region that was taken out puts the region back.
  function decideMix(key, decision) {
    const id = key.startsWith('region:') ? key.slice('region:'.length) : null
    if (!decision || !id || !mixLayout?.removed.includes(id)) { decide(key, decision); return }
    setResolutions((prev) => {
      const next = { ...prev, [key]: decision }
      const layout = layoutDecision(item.id, { order: mixLayout.order, removed: mixLayout.removed.filter((entry) => entry !== id) })
      if (layout) next[LAYOUT_KEY] = layout
      else delete next[LAYOUT_KEY]
      return next
    })
  }
  // Alt+↑ / ↓ move the selected region, Delete takes it out — not while
  // typing somewhere.
  const regionKeys = useEffectEvent((event) => {
    if (!selectedRegion || item?.tag === 'Merged') return
    const target = event.target
    if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault()
      moveRegion(selectedRegion, event.key === 'ArrowUp' ? -1 : 1)
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      event.stopPropagation()
      removeRegion(selectedRegion)
    }
  })
  useEffect(() => {
    window.addEventListener('keydown', regionKeys, true)
    return () => window.removeEventListener('keydown', regionKeys, true)
  }, [])
  // ⌘Z / Ctrl+Z undoes the last edit here, with Shift (or Ctrl+Y) redoing
  // it — not while typing somewhere (a field has its own).
  const historyKeys = useEffectEvent((event) => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return
    const key = event.key.toLowerCase()
    if (key !== 'z' && key !== 'y') return
    const target = event.target
    if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
    event.preventDefault()
    restoreEdit(key === 'y' || event.shiftKey ? 'redo' : 'undo')
  })
  useEffect(() => {
    window.addEventListener('keydown', historyKeys)
    return () => window.removeEventListener('keydown', historyKeys)
  }, [])

  function resolveDiff(layerId, diffId, side) {
    setResolutions((prev) => {
      const next = { ...prev }
      const key = `${layerId}:${diffId}`
      if (side) next[key] = side
      else delete next[key]
      return next
    })
  }

  // Inbox click -> select the target (without popping the Block Deck open);
  // the canvas itself pans to it via the `focus` prop.
  const handledFocus = useRef(null)
  useEffect(() => {
    if (!item || !mergeFocus || mergeFocus.target.itemId !== item.id) return
    if (handledFocus.current === mergeFocus.nonce) return
    handledFocus.current = mergeFocus.nonce
    // `openDeck: true` forces the deck open (used by the canvas's own
    // drift pager now that its floating popover is gone and the deck is
    // the only place left showing drift detail); `keepDeck: true` leaves
    // whatever the deck's current state is alone; neither set means the
    // old default — a plain jump closes the deck so the canvas is clear.
    const { layerId, fileId, line, keepDeck, openDeck: forceOpen } = mergeFocus.target
    if (layerId) selectLayer(layerId, { openDeck: forceOpen ?? !keepDeck })
    else if (fileId && line) selectLine(fileId, line, { openDeck: forceOpen ?? !keepDeck })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergeFocus, item?.id])

  const baseFrame = item?.hasDesign ? canvasPages.find((p) => p.id === item.designPageId)?.frames[0] : null
  // Drafts mixed by region work on the composed screen itself — the Block
  // Deck, Assets and text edits all act on its layers — so the mix can be
  // adjusted and added to like any design.
  const frame0 = baseFrame && draftScreens[item?.id]
    ? frameWithLayers(composeDraftFrame(item.id, baseFrame, regionPicks(item.id, resolutions), item.authorAId, regionLayout(item.id, resolutions)), addedLayers)
    : frameWithLayers(baseFrame, addedLayers)

  // Direct manipulation of the selected canvas element (LayerTransformHandles).
  // - A layer added from the Library is ours: moves / resizes are written
  //   into the layer itself (it shows on both artboards), and it can be
  //   deleted.
  // - An original design layer can't change on the Original Design, so the
  //   edit goes through its Assemble entry (dx / dy / width / height — the
  //   same values as the precision inputs) and renders on the Current
  //   Implementation; it can be reset but not deleted.
  const selId = syncSelection?.layerId
  const selLayer = selId ? frame0?.layers.find((l) => l.id === selId) : null
  const selIsAdded = Boolean(selId && addedLayers.some((l) => l.id === selId))
  const selAssembly = selId ? assemblies[selId] : null
  const selHasGeomEdit = Boolean(selAssembly && ['dx', 'dy', 'width', 'height'].some((k) => selAssembly[k] !== undefined))
  const changeSelectedGeom = useCallback(
    (g) => {
      if (!selLayer) return
      if (selIsAdded) {
        setAddedLayers((prev) => prev.map((l) => (l.id === selLayer.id ? { ...l, x: g.x, y: g.y, width: g.w, height: g.h } : l)))
        setAssemblies((prev) => {
          const a = prev[selLayer.id]
          if (!a || (a.dx === undefined && a.dy === undefined && a.width === undefined && a.height === undefined)) return prev
          // eslint-disable-next-line no-unused-vars
          const { dx, dy, width, height, ...rest } = a
          return { ...prev, [selLayer.id]: rest }
        })
        dropSources(selLayer.id, ['dx', 'dy', 'width', 'height'])
      } else {
        setAssemblies((prev) => ({
          ...prev,
          [selLayer.id]: { ...prev[selLayer.id], dx: g.x - selLayer.x, dy: g.y - selLayer.y, width: g.w, height: g.h },
        }))
        recordSources(selLayer.id, ['dx', 'dy', 'width', 'height'], { kind: 'custom', detail: 'Moved / resized on canvas' })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selLayer, selIsAdded]
  )
  const deleteAddedLayer = useCallback(() => {
    if (!selIsAdded) return
    setAddedLayers((prev) => prev.filter((l) => l.id !== selId))
    setAssemblies((prev) => {
      const next = { ...prev }
      delete next[selId]
      return next
    })
    dropSources(selId)
    setSyncSelection(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId, selIsAdded])
  const resetSelectedGeom = useCallback(() => {
    setAssemblies((prev) => {
      const a = prev[selId]
      if (!a) return prev
      // eslint-disable-next-line no-unused-vars
      const { dx, dy, width, height, ...rest } = a
      const next = { ...prev }
      if (Object.keys(rest).length) next[selId] = rest
      else delete next[selId]
      return next
    })
    dropSources(selId, ['dx', 'dy', 'width', 'height'])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId])
  const handleBoards = useMemo(() => designComparison ? ['result'] : (selIsAdded ? ['a', 'b'] : ['b']), [designComparison, selIsAdded])
  const copy = copyFile(frame0)
  const files = item ? [...mergeFilesFor(item).filter((f) => item.fileIds?.includes(f.id)).map((f) => ({ ...f, lines: getFileLines(f.id) })), ...(copy ? [copy] : [])] : []

  // Bottom panel's "Changes" tab: the same derivation MergeInfiniteCanvas's
  // floating Changes Log uses (see its `ChangesLog`/`entries` there) — kept
  // here too so the docked panel can show it without poking into the canvas
  // component's own render.
  const changesPreset = appliedPreset?.layerId ? appliedPreset : null
  const changesSummary = item ? buildSummary(item, resolutions, annotationsSnap, changesPreset, assemblies, addedLayers, manualCode, copy ? [copy] : []) : null
  const changesEntries = changesSummary
    ? [
        ...changesSummary.design.map((d) => {
          let kind = 'variant'
          let layerId = d.key.slice(0, d.key.indexOf(':'))
          if (d.key.startsWith('assembly-')) [kind, layerId] = ['assembly', d.key.slice(9)]
          else if (d.key.startsWith('added-')) [kind, layerId] = ['component', d.key.slice(6)]
          else if (d.key === 'preset') [kind, layerId] = ['preset', changesPreset?.layerId]
          return { id: d.key, key: d.key, kind, layerId, title: d.text, detail: d.choice }
        }),
        ...Object.entries(manualCode ?? {}).map(([key, text]) => {
          const split = key.lastIndexOf(':')
          const fileId = key.slice(0, split)
          const line = Number(key.slice(split + 1))
          const name = files.find((f) => f.id === fileId)?.name ?? fileId
          // copy.json lines read as the text they changed, not raw JSON.
          const entry = fileId === COPY_FILE_ID ? copyEntries(frame0)[line - 2] : null
          const parsed = entry ? parseCopyLine(text) : null
          if (entry && parsed) return { id: `code-${key}`, kind: 'code', layerId: entry.layerId, fileId, line, title: `${entry.name} · text`, detail: `“${parsed.value}”` }
          return { id: `code-${key}`, kind: 'code', fileId, line, title: `${name} · line ${line}`, detail: `Edited: ${text.trim() || '(empty line)'}` }
        }),
        ...annotationsSnap.map((a) => ({
          id: a.id,
          kind: 'annotation',
          layerId: a.layerId,
          fileId: a.fileId,
          line: a.line,
          title: `“${a.text}”`,
          detail: a.status === 'done' ? a.summary : a.status === 'thinking' ? 'AI is updating…' : 'Not applied yet',
        })),
      ]
    : []
  const changesCodeRows = changesSummary ? changesSummary.files.filter((f) => f.changed > 0 || f.aiLines > 0 || f.manualLines > 0) : []

  // This item's checks, live: from the choices on screen right now (not the
  // saved draft), so deciding a drift or editing updates them at once.
  const liveChecks = item ? checksFor(item, { resolutions, annotations: annotationsSnap, assemblies, addedLayers, manualCode, appliedPreset }, linesOfFile) : null
  // Block Deck target: the selected layer, or the smart default when the
  // selection is an unmapped code line / nothing.
  const deckLayerId = syncSelection?.layerId ?? defaultLayerFor(item)
  // Merge Studio's own bottom panel: Conflict Points plus this item's
  // Changes log, instead of Terminal/Console. Conflict Points is the
  // project-wide list (same as the Workspace's own tab); a conflict's
  // review there is where its code, checks, review and merge happen.
  // `Panel` is always the bare component reference (never an inline arrow
  // function here) — WorkspaceBottomPanel spreads `panelProps` onto it
  // separately. An inline `() => <X .../>` is a *new* function, and so a
  // new component type, on every render of this component (which happens
  // constantly — any edit, hover, or selection change), so React would
  // unmount and remount the tab's whole panel each time instead of just
  // re-rendering it with new props — exactly what broke the canvas focus
  // jump when selecting a conflict (the panel never stayed mounted long
  // enough for its effect to stick).
  const bottomPanelTabs = [
    {
      id: 'conflict',
      label: 'Conflict Points',
      icon: TriangleAlert,
      Panel: ConflictPanel,
      panelProps: { inMergeStudio: true },
    },
    {
      id: 'design-compare',
      label: 'Design Compare',
      icon: Layers3,
      Panel: DesignComparePanel,
      panelProps: {
        inMergeStudio: true,
        items: designCompareItems,
        itemId: designCompareItem?.id ?? null,
        selectedKeys: designCompareKeys,
        onSelectItem: (id) => {
          setDesignCompareItemId(id)
          setDesignCompareKeys([])
        },
        onToggleVariant: toggleDesignCompareOption,
        onSelectAll: setDesignCompareKeys,
        onCompare: openDesignComparison,
      },
    },
    {
      id: 'changes',
      label: 'Changes',
      icon: ListChecks,
      Panel: MergeChangesPanel,
      panelProps: {
        entries: changesEntries,
        codeRows: changesCodeRows,
        onJump: (e) =>
          item &&
          requestMergeFocus({
            itemId: item.id,
            keepDeck: true,
            label: e.title,
            ...(e.layerId ? { layerId: e.layerId } : { fileId: e.fileId, line: e.line }),
          }),
        onUndo: (e) => (e.kind === 'annotation' ? setAnnotationsSnap((prev) => prev.filter((a) => a.id !== e.id)) : undoChange(e)),
        onOpenHistory: requestHistoryDrawer,
      },
    },
  ]
  // A fresh selection re-expands a collapsed Block Deck, so its
  // context-aware content is visible right away.
  const selectedLayer = frame0?.layers.find((l) => l.id === deckLayerId) ?? null


  const deckReserve = 0
  // The step flow no longer floats over the canvas (it's docked in the
  // bottom panel), so it has nothing to reserve space for — only the Block
  // Deck does.
  const reserve = deckReserve
  // Committed manual code plus the in-progress keystrokes: what the canvas,
  // Preview and wizard render the Current Implementation from.
  const syncedCode = deferredLive ? { ...manualCode, [deferredLive.key]: deferredLive.text } : manualCode
  // The selected layer's text slots with their current (edited) values, for
  // the Block Deck's Text section.
  const layerCopy = deckLayerId ? copyEdits(frame0, syncedCode)[deckLayerId] : null
  const textSlots = copyEntries(frame0)
    .filter((e) => e.layerId === deckLayerId)
    .map((e) => ({ ...e, current: layerCopy?.[e.slot] ?? e.value }))
  const variantPreviews = item?.hasDesign ? buildVariantPreviews(item.id, resolutions, hoverDiff) : null

  return (
    <div ref={studioRootRef} className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <button
        type="button"
        onClick={exitMergeStudio}
        className={cn(STUDIO_PILL, 'absolute top-2 left-4 z-40 flex items-center justify-center gap-2 px-3')}
      >
        <ArrowLeft className="size-4" />
        Workspace
      </button>
        {item && designComparison && (
          // In the header row, above the canvas panel: the "what am I
          // looking at / how do I leave" strip for comparing drafts.
          // Three groups, divided: what's being compared (and leaving it),
          // the alternatives (other drafts, one whole draft), and the one
          // primary action — finishing the mix.
          <div className={cn(STUDIO_PILL, 'absolute top-2 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 px-1 font-normal')}>
            {/* Leaving goes back to picking drafts (the Design Compare tab,
                with these drafts still ticked) — picks so far are kept. */}
            <button
              type="button"
              title="Back to drafts"
              aria-label="Back to drafts"
              onClick={backToDrafts}
              className="ds-intrinsic flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              <X className="size-3.5" />
            </button>
            <span className="flex items-baseline gap-2 pr-2 pl-0.5 whitespace-nowrap">
              <span className="text-[13px] font-semibold text-white"><LocalizedText text={designComparison.item.title} /></span>
            </span>
            {/* The primary action: done mixing — enabled once anything's
                been picked from a draft. */}
            <button
              type="button"
              disabled={mixPicked === 0 || item.tag === 'Merged'}
              data-merge-request
              title={mixPicked === 0 ? 'Pick values from the drafts first' : undefined}
              onClick={finishMix}
              className="ds-intrinsic inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-emerald-400 px-3.5 text-[12px] font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-default disabled:bg-white/[0.06] disabled:font-medium disabled:text-slate-500"
            >
              <Check className="size-3.5" strokeWidth={2.5} />
              <LocalizedText text="병합 요청" />
            </button>
          </div>
        )}
      {/* The header row's right side: the canvas's session controls
          (presence, Share, Preview, Inbox) land here, left of the files pill. */}
      <div data-studio-header-slot className="absolute top-2 right-[104px] z-40 flex h-8 items-center" />
      {/* The canvas is a panel like the Workspace's: under the header row,
          rounded and bordered, ending where the bottom panel begins — not
          a full-bleed sheet the bottom panel slices across. */}
      <div data-studio-stage className={cn('relative mt-12 mr-2 flex min-h-0 flex-1 overflow-hidden border border-white/10', PANEL_RADIUS)}>

      {item ? (
        <div className="flex min-h-0 min-w-0 flex-1">
        {/* Adjusting for a conflict: what's been changed so far, and the
            one button that finishes — back to that conflict's review, where
            the adjustments are listed. Always here, guide open or not. */}
        {!designComparison && adjustingFor && (
          <div data-adjust-bar className={cn(STUDIO_PILL, 'absolute top-2 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 pr-1 pl-3 font-normal')}>
            <span className="max-w-56 truncate text-[13px] font-semibold text-white"><LocalizedText text={adjustingFor.title} /></span>
            <span className="text-xs whitespace-nowrap text-slate-400 tabular-nums">
              {adjustmentCount ? <LocalizedText text={`${adjustmentCount} adjusted`} /> : <LocalizedText text="Nothing adjusted yet" />}
            </span>
            {/* Why it was adjusted — chosen and changed here, in a dialog the
                pill opens (the review shows it as a line). */}
            {adjustmentCount > 0 && (
              <Dialog open={adjustReasonOpen} onOpenChange={setAdjustReasonOpen}>
                <DialogTrigger data-adjust-reason className={cn('ds-intrinsic inline-flex h-7 max-w-48 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium transition-colors hover:bg-white/[0.08]', adjustingFor.adjustmentReason?.text ? 'text-slate-200' : 'text-amber-200')}>
                  {adjustingFor.adjustmentReason?.text
                    ? <span className="truncate"><span className="text-slate-400"><LocalizedText text="Reason" /> · </span><LocalizedText text={adjustingFor.adjustmentReason.text.split(' · ')[0]} />{adjustingFor.adjustmentReason.text.includes(' · ') && ' …'}</span>
                    : <LocalizedText text="Reason needed" />}
                </DialogTrigger>
                <DialogContent data-adjust-reason-dialog className="gap-3 bg-card p-5 sm:max-w-[480px]">
                  <DialogTitle className="text-sm font-semibold text-white"><LocalizedText text="Reason for the adjustment" /></DialogTitle>
                  <InlineDeviationReason
                    key={adjustingFor.id}
                    value={adjustingFor.adjustmentReason?.text ?? null}
                    onSave={(reason) => { updateConflict(adjustingFor.id, { adjustmentReason: { text: reason, by: currentUser?.id ?? null, at: 'Just now' } }); setAdjustReasonOpen(false) }}
                    title="Why was it adjusted?"
                    reasons={ADJUSTMENT_REASONS}
                  />
                </DialogContent>
              </Dialog>
            )}
            <button
              type="button"
              data-adjust-done
              onClick={() => {
                setCheckGuide(null)
                exitMergeStudio()
                setBottomPanel({ tab: 'conflict', open: true })
                openConflictReview(adjustingFor.id)
                toast(adjustmentCount ? '조정 내용을 충돌 내역에 반영했어요' : '충돌 내역으로 돌아왔어요', adjustmentCount ? { description: adjustingFor.adjustmentReason?.text ? '검토 화면의 카드에 조정한 값이 표시돼요.' : '검토 화면의 카드에 조정한 값이 표시돼요. 조정한 이유를 선택하세요.' } : undefined)
              }}
              className="ds-intrinsic inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-emerald-400 px-3.5 text-[12px] font-semibold text-slate-950 transition-colors hover:bg-emerald-300"
            >
              <Check className="size-3.5" strokeWidth={2.5} />
              <LocalizedText text="Done adjusting" />
            </button>
          </div>
        )}
        {designComparison && (
          // A floating window: at first over the Result's top left (the drafts
          // pane keeps its side to itself); dragged, it stays where it's put —
          // kept inside the canvas when that shrinks (the bottom panel opening).
          <div className="pointer-events-none absolute z-40 w-[min(760px,calc(100%-24px))]" style={mixPos ? { left: `min(${mixPos.x}px, calc(100% - 120px))`, top: `min(${mixPos.y}px, calc(100% - 48px))` } : { left: `calc(${draftShare * 100}% + 12px)`, top: 52 }} data-mix-pane>
          <MixPanel
            onGripPointerDown={startMixDrag}
            // A part picked from the list is outlined on the Result too.
            onShowRegion={(regionId) => {
              const first = frame0?.layers.find((layer) => layer.regionId === regionId)
              if (first) setSyncSelection({ layerId: first.id })
            }}
            item={item}
            options={designComparison.options}
            decisions={resolutions}
            selectedLayerId={syncSelection?.layerId}
            onDecide={decideMix}
            removedRegions={mixLayout?.removed ?? []}
            checks={liveChecks}
            requestedRegion={designCompareRequest?.regionId}
            onFix={(check) => {
              if (check.fileId) { openReviewFor(item); return }
              const layerId = check.layerId ?? defaultLayerFor(item)
              // Says what to change and to what: the element marked on the
              // canvas, its size fields lit, the steps to finish.
              setCheckGuide({ itemId: item.id, check })
              if (layerId) { selectLayer(layerId); requestMergeFocus({ itemId: item.id, layerId, keepDeck: true, pulse: true }) }
            }}
          />
          </div>
        )}
        <MergeCheckGuide item={item} checks={liveChecks} low={Boolean(designComparison)} />
        <div className="flex min-h-0 min-w-0 flex-1" data-result-pane>
        {/* Comparing drafts: the drafts in a pane of their own, the Result
            artboard in the canvas beside it — each with its own zoom. */}
        {designCompare && (
          <>
            <DraftCompareBoard item={item} options={designComparison.options} frame={designCompare.frame} decisions={resolutions} share={draftShare} />
            {/* The divider: drag to give either side more room. */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize drafts and result"
              data-compare-divider
              onPointerDown={startSplitDrag}
              onDoubleClick={() => setDraftShare(0.5)}
              className="group relative z-30 -mx-1.5 w-3 shrink-0 cursor-col-resize"
            >
              <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/[0.08] transition-colors group-hover:w-0.5 group-hover:bg-emerald-300/70" />
              <span className="absolute top-1/2 left-1/2 h-8 w-1 -translate-1/2 rounded-full bg-white/25 group-hover:bg-emerald-300" />
            </div>
          </>
        )}
        <MergeInfiniteCanvas
          editHistory={{ canUndo: item.tag !== 'Merged' && editTimeline.past.length > 0, canRedo: item.tag !== 'Merged' && editTimeline.future.length > 0, undo: () => restoreEdit('undo'), redo: () => restoreEdit('redo') }}
          reserve={designComparison ? 0 : reserve}
          layoutReserve={designComparison ? 0 : deckReserve}
          guidesVisible={guidesVisible}
          onToggleGuides={() => setGuidesVisible((v) => !v)}
          focus={mergeFocus}
          resolutionCount={Object.keys(resolutions).length + Object.keys(manualCode).length}
          stage="compare"
          checks={liveChecks}
          designCompare={designCompare}
          compareOverrides={designCompare ? { result: resolvedEffects(item, resolutions) } : null}
          compareFrames={designCompare && draftScreens[item.id] ? { result: frame0 } : null}
          frameOverrideA={baseFrame && draftScreens[item.id] ? draftFrame(item.id, baseFrame, item.authorAId) : null}
          frameOverrideB={draftScreens[item.id] ? frame0 : null}
          composedResult={Boolean(draftScreens[item.id])}
          regionTools={designComparison && mixLayout && item.tag !== 'Merged' ? {
            selected: selectedRegion,
            onMove: moveRegion,
            onRemove: removeRegion,
            onReorder: reorderRegion,
            letterOf: (key) => { const at = designCompareOptions(item).findIndex((option) => option.key === key); return at < 0 ? null : String.fromCharCode(65 + at) },
          } : null}
          assemblies={assemblies}
          resolutions={resolutions}
          extraLayers={addedLayers}
          manualCode={manualCode}
          syncedCode={syncedCode}
          onOpenCodeReview={openReview}
          onEditCode={editCodeLine}
          onLiveEditCode={liveEditCodeLine}
          onEditText={editText}
          codeReveal={codeReveal}
          onUndoChange={undoChange}
          annotations={annotationsSnap}
          onAnnotationsChange={setAnnotationsSnap}
          item={item}
          files={files}
          syncSelection={syncSelection}
          appliedPreset={appliedPreset}
          variantPreviews={variantPreviews}
          onSelectLayer={selectLayer}
          onSelectLine={selectLine}
          onSelectFrame={selectFrame}
        />
        </div>
        </div>
      ) : (
        // Keep an explicit empty state only when this project has no saved
        // merge work to open.
        <div
          className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-center"
          style={{
            backgroundColor: 'var(--ds-bg-base)',
            backgroundImage: 'radial-gradient(color-mix(in oklch, var(--foreground) 14%, transparent) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        >
          <div className="flex size-11 items-center justify-center rounded-full bg-white/[0.06] text-slate-400">
            <MousePointerClick className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-300">No saved merge work</p>
            <p className="max-w-[260px] text-xs text-slate-500">
              Start a new merge from the currently open files to begin.
            </p>
          </div>
        </div>
      )}

      {item && deckElement && createPortal(
        <BlockDeckPanel
          embedded
          fieldGuide={checkGuide && (checkGuide.itemId === item.id || conflicts.some((conflict) => conflict.id === checkGuide.conflictId && (conflict.mergeItemId === item.id || item.conflictId === conflict.id)))
            ? liveChecks?.failing.find((check) => check.id === checkGuide.check?.id)?.editFields : null}
          activeTab={filesWindow.tab === 'assets' ? 'library' : 'assemble'}
          driftEffect={deckLayerId ? variantPreviews?.[deckLayerId] : undefined}
          textSlots={textSlots}
          onEditText={editText}
          open
          item={item}
          selectedLayerId={deckLayerId}
          selectedLayerName={selectedLayer?.name}
          appliedPresetId={appliedPreset?.id}
          manualCode={manualCode}
          onEditCode={editCodeLine}
          selectedLayer={selectedLayer}
          frameWidth={frame0?.width ?? 300}
          assembly={deckLayerId ? assemblies[deckLayerId] : undefined}
          onAssemble={(patch) => deckLayerId && assemble(deckLayerId, patch)}
          onAssembleReset={() => deckLayerId && resetAssembly(deckLayerId)}
          onApplyComponent={applyComponent}
          onAddComponent={(def) => setPlacing({ def, mode: 'click' })}
          onDragComponent={(def) => setPlacing({ def, mode: 'drag' })}
          onInsertComponent={insertComponent}
          onApplyPreset={(preset) => setAppliedPreset(preset ? { ...preset, layerId: deckLayerId } : null)}
          tabRequest={deckTabRequest}
          changeCounts={{
            assemble: Object.keys(assemblies).length,
            library: addedLayers.length,
          }}
        />,
        deckElement
      )}

      {/* The selected canvas element: bounding box handles to move / resize
          (plus delete for Library-added layers, reset for edited ones). */}
      {!selectedRegion && selLayer && frame0 && guidesVisible && !placing && !mergePreviewOpen && (
        <LayerTransformHandles
          layerId={selLayer.id}
          frame={frame0}
          boards={handleBoards}
          onChange={changeSelectedGeom}
          onDelete={selIsAdded ? deleteAddedLayer : undefined}
          onReset={!selIsAdded && selHasGeomEdit ? resetSelectedGeom : undefined}
        />
      )}

      {/* Library "Add" / drag: place the component where you want it. */}
      {placing && frame0 && (
        <PlacementOverlay
          def={placing.def}
          mode={placing.mode}
          frame={frame0}
          onPlace={placeComponent}
          onCancel={cancelPlacing}
        />
      )}

      {mergePreviewOpen && item && (
        <MergePreviewOverlay
          item={item}
          resolutions={resolutions}
          annotations={annotationsSnap}
          preset={
            appliedPreset?.layerId
              ? appliedPreset
              : null
          }
          assemblies={assemblies}
          extraLayers={addedLayers}
          manualCode={syncedCode}
          frameOverride={draftScreens[item.id] ? frame0 : null}
          onClose={() => setMergePreviewOpen(false)}
        />
      )}

      {mergeDrawer === 'inbox' && (
        <MergeInboxDrawer
          onJump={(n) => {
            const destination = notificationDestination(n.target, conflicts, mergeItems)
            if (!destination) return
            setMergeDrawer(null)
            if (destination.conflictId) {
              exitMergeStudio()
              openConflictFromNotification(destination.conflictId)
              return
            }
            requestMergeFocus(destination.mergeTarget)
          }}
          onClose={() => setMergeDrawer(null)}
        />
      )}

      {!item && <MergeHelp />}
      </div>

      <WorkspaceBottomPanel tabs={bottomPanelTabs} portal />
    </div>
  )
}

export default MergeStudioWorkspace
