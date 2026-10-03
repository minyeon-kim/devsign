import { toast } from '@/i18n/toast'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LocalizedText } from '@/i18n/runtime'
import { notificationDestination } from '@/lib/inboxNotifications'
import { createPortal } from 'react-dom'
import { MergeDeckSlotContext } from '@/components/mergestudio/MergeDeckSlot'
import { signature } from '@/lib/demoStorage'
import { useCallback, useContext, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ChevronDown, Layers3, ListChecks, MousePointerClick, TriangleAlert, X } from 'lucide-react'
import { canvasPages, codeMergeVariants, designMergeVariants, mergeFilesFor } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import MergeInfiniteCanvas from '@/components/mergestudio/MergeInfiniteCanvas'
import BlockDeckPanel from '@/components/mergestudio/BlockDeckPanel'
import { diffEffect, frameWithLayers } from '@/components/mergestudio/mergeEffects'
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
import { DesignComparePanel, decidedValue, decisionFor, designCompareOptions, draftValue, optionEffects, resolvedEffects } from '@/components/mergestudio/DesignComparison'
import { checksFor } from '@/components/mergestudio/mergeChecks'
import { cn } from 'cn'
import { STUDIO_PILL } from '@/components/mergestudio/floatingStyles'

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
const shortLabel = (option) => option.label.replace(/[’']s draft$/, '')
// Which draft each drifted element's decided values match (one, or
// "mixed"); undecided elements are left out. `total` counts them all.
function mixSources(item, options, resolutions) {
  const layerDiffs = designMergeVariants[item.id]?.layerDiffs ?? {}
  const sources = Object.entries(layerDiffs).map(([layerId, list]) => {
    const values = list.map((diff) => decidedValue(diff, resolutions[`${layerId}:${diff.id}`]))
    if (values.some((v) => v === undefined)) return null
    const from = options.find((option) => list.every((diff, i) => draftValue(diff, option) === values[i]))
    return { layerId, from: from ? shortLabel(from) : 'mixed' }
  }).filter(Boolean)
  return { sources, total: Object.keys(layerDiffs).length }
}

function MixPanel({ item, options, layers, selectedLayerId, resolutions, onPick }) {
  const layerDiffs = designMergeVariants[item.id]?.layerDiffs ?? {}
  const diffs = selectedLayerId ? layerDiffs[selectedLayerId] : null
  const nameOf = (layerId) => layers.find((l) => l.id === layerId)?.name ?? layerId
  const { sources, total } = mixSources(item, options, resolutions)
  const pickAll = (layerId, option) => layerDiffs[layerId].forEach((diff) => onPick(layerId, diff.id, decisionFor(diff, draftValue(diff, option))))

  return (
    <div className="absolute top-12 left-1/2 z-40 w-[min(560px,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-white/10 bg-popover p-3 shadow-xl">
      {!diffs ? (
        <p className="text-center text-xs text-slate-400">
          <LocalizedText text="Click an element on a draft to take it from that draft — or mix its properties." />
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-xs font-semibold text-white"><LocalizedText text={nameOf(selectedLayerId)} /></p>
            <span className="shrink-0 text-[10.5px] text-slate-500"><LocalizedText text="Whole element from" /></span>
            {options.map((option) => (
              <button key={option.key} type="button" onClick={() => pickAll(selectedLayerId, option)} className="ds-intrinsic h-6 shrink-0 rounded-full bg-white/[0.06] px-2.5 text-[11px] text-slate-200 transition-colors hover:bg-white/[0.12]">
                <LocalizedText text={shortLabel(option)} />
              </button>
            ))}
          </div>
          {diffs.map((diff) => {
            const current = decidedValue(diff, resolutions[`${selectedLayerId}:${diff.id}`])
            return (
              <div key={diff.id} className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-[11px] text-slate-500"><LocalizedText text={diff.label} /></span>
                <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                  {options.map((option) => {
                    const value = draftValue(diff, option)
                    const on = current === value
                    return (
                      <button
                        key={option.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onPick(selectedLayerId, diff.id, decisionFor(diff, value))}
                        className={cn('ds-intrinsic h-7 rounded-lg px-2.5 text-[11px] transition-colors', on ? 'bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-400/50 ring-inset' : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]')}
                      >
                        <span className="font-medium tabular-nums">{value}</span>
                        <span className="ml-1 text-slate-500"><LocalizedText text={shortLabel(option)} /></span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {sources.length > 0 && (
        <p className="mt-2 border-t border-white/[0.06] pt-2 text-[10.5px] text-slate-500">
          <span className="mr-2 font-medium text-slate-400"><LocalizedText text={`${sources.length}/${total} picked`} /></span>
          {sources.map((source, i) => (
            <span key={source.layerId}>
              {i > 0 && ' · '}
              <span className="text-slate-300"><LocalizedText text={nameOf(source.layerId)} /></span> ← <LocalizedText text={source.from} />
            </span>
          ))}
        </p>
      )}
    </div>
  )
}

function buildVariantPreviews(itemId, resolutions, hoverDiff) {
  const layerDiffs = designMergeVariants[itemId]?.layerDiffs ?? {}
  const previews = {}
  for (const [layerId, diffs] of Object.entries(layerDiffs)) {
    const merged = {}
    for (const diff of diffs) {
      const hovered = hoverDiff?.layerId === layerId && hoverDiff.diffId === diff.id ? hoverDiff.side : null
      const e = diffEffect(diff, hovered ?? resolutions[`${layerId}:${diff.id}`] ?? 'B')
      if (e.className) merged.className = e.className
      if (e.radius !== undefined) merged.radius = e.radius
      if (e.fontWeight !== undefined) merged.fontWeight = e.fontWeight
      merged.dw = (merged.dw ?? 0) + (e.dw ?? 0)
      merged.dh = (merged.dh ?? 0) + (e.dh ?? 0)
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
    setBottomPanel,
    mergeDrafts,
    saveMergeDraft,
    setStudioDecisions,
    conflicts,
    updateConflict,
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
    setDesignComparison(null)
  }, [item?.id])

  const designCompareItems = mergeItems.filter((candidate) => candidate.hasDesign && candidate.designPageId)
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
  useEffect(() => {
    if (!item || designCompareRequest?.itemId !== item.id) return
    const options = designCompareOptions(item).filter((option) => designCompareRequest.keys.includes(option.key))
    setDesignCompareRequest(null)
    if (options.length) setDesignComparison({ item, options })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, designCompareRequest])
  // "Use this design": every drift takes the chosen draft's value — the
  // design's own (A), the current implementation's (B), or the draft's
  // value as a custom one — the same decisions the conflict's Decide row records,
  // made in one go. Not a commit: it's the item's working choices, and
  // the checks re-run on them; merging is what records it.
  // Comparing another item's drafts: its choices are saved to that item's
  // draft and the studio switches to it (they're applied on load).
  function applyDesignOption(option) {
    const target = designComparison?.item ?? item
    const layerDiffs = designMergeVariants[target.id]?.layerDiffs ?? {}
    const picks = {}
    for (const [layerId, diffs] of Object.entries(layerDiffs)) {
      for (const diff of diffs) {
        const value = option.side ? null : diff.values?.[option.key]
        picks[`${layerId}:${diff.id}`] = option.side
          ?? (value === undefined || value === diff.optionA ? 'A' : value === diff.optionB ? 'B' : { custom: value })
      }
    }
    if (target.id === item.id) {
      setResolutions((prev) => ({ ...prev, ...picks }))
    } else {
      const saved = mergeDrafts.current[target.id] ?? {}
      saveMergeDraft(target.id, { ...saved, resolutions: { ...(saved.resolutions ?? {}), ...picks } })
      requestMergeFocus({ itemId: target.id, overview: true })
    }
    setDesignComparison(null)
    openReviewFor(target)
    if (target.id === item.id) requestMergeFocus({ itemId: item.id, overview: true })
    const count = Object.keys(picks).length
    toast(`Using ${option.label}`, { description: `${count} value${count === 1 ? '' : 's'} set — adjust them in the conflict’s Decide row.` })
  }
  // Finishing a mix: back to the item's own canvas (the original next to
  // the result) with its conflict review open — the Decide row lists what
  // was taken from where, and requesting review is the next step there.
  function finishMix() {
    const { sources, total } = mixSources(item, designComparison.options, resolutions)
    setDesignComparison(null)
    openReviewFor(item)
    requestMergeFocus({ itemId: item.id, overview: true })
    toast('Mix applied', {
      description: sources.length === total
        ? 'Check the values in Decide, then request review.'
        : `${sources.length} of ${total} elements picked — the rest keep the code.`,
    })
  }
  function openReviewFor(target) {
    const conflict = conflicts.find((c) => c.mergeItemId === target.id || c.id === target.conflictId)
    if (conflict) openConflictReview(conflict.id)
    setBottomPanel({ tab: 'conflict', open: true })
  }
  const mixPicked = designComparison && item ? mixSources(item, designComparison.options, resolutions).sources.length : 0
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
    const { item: compareItem, options } = designComparison
    const framePage = canvasPages.find((p) => p.id === compareItem.designPageId)
    const compareFrame = framePage?.frames[0]
    if (!compareFrame) return null
    return {
      frame: compareFrame,
      entries: options.map((option) => ({
        key: option.key,
        // The draft's values next to its name — what actually differs.
        label: [option.label, ...Object.values(designMergeVariants[compareItem.id]?.layerDiffs ?? {}).flat().map((diff) => {
          const value = option.side ? (option.side === 'A' ? diff.optionA : diff.optionB) : diff.values?.[option.key] ?? diff.optionA
          return `${diff.label} ${value}`
        })].join(' · '),
        overrides: optionEffects(compareItem, option),
      })).concat({
        // The mix so far, beside the drafts it's drawn from.
        key: 'result',
        label: 'Result — your picks',
        overrides: {},
      }),
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
    })
  }, [item?.id, resolutions, setStudioDecisions])
  useEffect(() => () => setStudioDecisions(null), [setStudioDecisions])

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
  const frame0 = frameWithLayers(baseFrame, addedLayers)

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
  const handleBoards = useMemo(() => (selIsAdded ? ['a', 'b'] : ['b']), [selIsAdded])
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
  const liveChecks = item ? checksFor(item, { resolutions, annotations: annotationsSnap }, linesOfFile) : null
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
        items: designCompareItems,
        itemId: designCompareItem?.id ?? null,
        selectedKeys: designCompareKeys,
        onSelectItem: (id) => {
          setDesignCompareItemId(id)
          setDesignCompareKeys([])
        },
        onToggleVariant: toggleDesignCompareOption,
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
    <div className="relative flex min-h-0 flex-1 flex-col bg-background">
      <button
        type="button"
        onClick={exitMergeStudio}
        className={cn(STUDIO_PILL, 'absolute top-2 left-4 z-40 flex items-center justify-center gap-2 px-3')}
      >
        <ArrowLeft className="size-4" />
        Workspace
      </button>
      <div className="relative flex min-h-0 flex-1">

      {item ? (
        <div className="flex min-h-0 flex-1">
        {designComparison && (
          // Floating over the canvas rather than its own screen — Design
          // Compare's drafts now render as real frames on the infinite
          // canvas below (see `designCompare`), so this is just the "what
          // am I looking at / how do I leave" strip for that mode.
          <div className={cn(STUDIO_PILL, 'absolute top-2 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 pr-0.5 pl-4 font-normal')}>
            <span className="whitespace-nowrap text-slate-200">
              <span className="font-semibold text-white">Comparing:</span> {designComparison.item.title}
              <span className="ml-1.5 text-slate-500">{`· ${designComparison.options.length} designs`}</span>
            </span>
            {/* One primary action (pick a draft); changing the drafts is a
                quiet text action, and leaving is the close button. */}
            <DropdownMenu>
              <DropdownMenuTrigger className="ds-intrinsic flex h-7 shrink-0 items-center gap-1 rounded-full bg-white/[0.06] px-3 text-[12px] font-medium text-slate-200 transition-colors hover:bg-white/[0.12] data-[popup-open]:bg-white/[0.12]">
                <LocalizedText text="Use a design" />
                <ChevronDown className="size-3 opacity-80" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-52">
                {designComparison.options.map((option) => (
                  <DropdownMenuItem key={option.key} onClick={() => applyDesignOption(option)}>
                    <LocalizedText text={option.label} />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {/* The primary action: done mixing — enabled once anything's
                been picked from a draft. */}
            <button
              type="button"
              disabled={mixPicked === 0}
              title={mixPicked === 0 ? 'Pick values from the drafts first' : undefined}
              onClick={finishMix}
              className="ds-intrinsic h-7 shrink-0 rounded-full bg-emerald-400/15 px-3 text-[12px] font-medium text-emerald-200 transition-colors hover:bg-emerald-400/25 disabled:cursor-default disabled:bg-white/[0.04] disabled:text-slate-500"
            >
              <LocalizedText text="Finish mix" />
            </button>
            <button
              type="button"
              onClick={() => {
                setDesignComparison(null)
                setBottomPanel({ tab: 'design-compare', open: true })
              }}
              className="ds-intrinsic h-7 shrink-0 rounded-full px-2.5 text-[12px] text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              <LocalizedText text="Change drafts" />
            </button>
            <button
              type="button"
              title="Exit comparison"
              aria-label="Exit comparison"
              onClick={() => setDesignComparison(null)}
              className="ds-intrinsic flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
        {designComparison && (
          <MixPanel
            item={item}
            options={designComparison.options}
            layers={frame0?.layers ?? []}
            selectedLayerId={syncSelection?.layerId}
            resolutions={resolutions}
            onPick={resolveDiff}
          />
        )}
        <MergeInfiniteCanvas
          editHistory={{ canUndo: item.tag !== 'Merged' && editTimeline.past.length > 0, canRedo: item.tag !== 'Merged' && editTimeline.future.length > 0, undo: () => restoreEdit('undo'), redo: () => restoreEdit('redo') }}
          reserve={reserve}
          layoutReserve={deckReserve}
          guidesVisible={guidesVisible}
          onToggleGuides={() => setGuidesVisible((v) => !v)}
          focus={mergeFocus}
          resolutionCount={Object.keys(resolutions).length + Object.keys(manualCode).length}
          stage="compare"
          checks={liveChecks}
          designCompare={designCompare}
          compareOverrides={designCompare ? { result: resolvedEffects(item, resolutions) } : null}
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
      {selLayer && frame0 && guidesVisible && !placing && !mergePreviewOpen && (
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
              setBottomPanel({ tab: 'conflict', open: true })
              openConflictReview(destination.conflictId)
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
