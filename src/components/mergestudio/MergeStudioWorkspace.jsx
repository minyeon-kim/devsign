import { signature } from '@/lib/demoStorage'
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Blocks } from 'lucide-react'
import { cn } from 'cn'
import { FLOATING_PILL } from '@/components/mergestudio/floatingStyles'
import { canvasPages, codeMergeVariants, designMergeVariants, mergeHistoryEvents, mergeFilesFor } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import MergeListSidebar from '@/components/mergestudio/MergeListSidebar'
import MergeInfiniteCanvas from '@/components/mergestudio/MergeInfiniteCanvas'
import BlockDeckPanel, { DECK_WIDTH } from '@/components/mergestudio/BlockDeckPanel'
import { diffEffect, frameWithLayers } from '@/components/mergestudio/mergeEffects'
import { buildDrifts } from '@/components/mergestudio/mergeSummary'
import MergePreviewOverlay from '@/components/mergestudio/MergePreviewOverlay'
import MergeExecutionModal, { WIZARD_RESERVE } from '@/components/mergestudio/MergeExecutionModal'
import MergeHistoryDrawer from '@/components/mergestudio/MergeHistoryDrawer'
import MergeInboxDrawer from '@/components/mergestudio/MergeInboxDrawer'
import MergeAiBar from '@/components/mergestudio/MergeAiBar'
import MergeGuide from '@/components/mergestudio/MergeGuide'
import PlacementOverlay from '@/components/mergestudio/PlacementOverlay'
import LayerTransformHandles from '@/components/mergestudio/LayerTransformHandles'
import { COPY_FILE_ID, copyEdits, copyEntries, copyFile, copyLineFor, formatCopyLine } from '@/components/mergestudio/copyFile'

// The whole right-hand side of Merge Studio — a single shared infinite
// canvas (MergeInfiniteCanvas) holding the merge item's unified code window
// and design artboards, with the Merge List panel floating on the left, the
// Block Deck as a draggable window that opens only when a canvas element is
// clicked, and a sticky AI bar at the bottom center — the canvas itself spans this whole area
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

// Once the guide is finished or skipped it stays gone for the rest of the
// session, even across leaving and re-entering Merge Studio.
let guideFinished = false

// Deck width plus its 16px right inset and 16px breathing room.
const DECK_RESERVE = DECK_WIDTH + 32

function MergeStudioWorkspace({ item }) {
  const {
    setActiveFileId,
    getFileLines,
    setActivePageId,
    updateMergeItem,
    mergeDrawer,
    setMergeDrawer,
    mergeFocus,
    requestMergeFocus,
    mergePreviewOpen,
    setMergePreviewOpen,
    setMergeCta,
    mergeListCollapsed,
    exitMergeStudio,
    openConflictReview,
    setBottomPanel,
    mergeDrafts,
    saveMergeDraft,
    completeMerge,
    conflicts,
    updateConflict,
  } = useWorkspace()
  const savedDraft = mergeDrafts.current[item?.id] ?? {}
  const [historyEvents, setHistoryEvents] = useState(savedDraft.historyEvents ?? mergeHistoryEvents)
  const [currentHistoryId, setCurrentHistoryId] = useState(savedDraft.currentHistoryId ?? mergeHistoryEvents[0].id)
  const [syncSelection, setSyncSelection] = useState(null)
  const [appliedPreset, setAppliedPreset] = useState(savedDraft.appliedPreset ?? null)
  const [deckOpen, setDeckOpen] = useState(false)
  // The Block Deck collapses into a toggle pill in the canvas header (next
  // to Share); any fresh selection re-expands it.
  const [deckCollapsed, setDeckCollapsed] = useState(false)
  const [mergeModal, setMergeModal] = useState(null) // { annotations, step } snapshot while open
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
  const [wizardStage, setWizardStage] = useState('compare') // macro stage shown in the canvas header
  // While the deck sits in its default spot the canvas refits so Option B
  // isn't covered by it; once dragged it floats freely and no longer does.
  const [deckFloating, setDeckFloating] = useState(false)
  // Variant Compare state lives here (not in the deck) so choosing — or
  // merely hovering — an option can live-preview on the Option B artboard.
  const [resolutions, setResolutions] = useState(savedDraft.resolutions ?? {})
  const [hoverDiff, setHoverDiff] = useState(null) // { layerId, diffId, side }
  // Hand-typed code lines from the code window, keyed `fileId:line`. They
  // win over incoming and AI-edited text everywhere the merged code shows.
  const [manualCode, setManualCode] = useState(savedDraft.manualCode ?? {})
  // The line being typed in the code window right now ({ key, text }), so
  // the canvas re-renders from code on every keystroke — deferred so typing
  // itself never waits on the canvas.
  const [liveCode, setLiveCode] = useState(null)
  // Which Merge List tab the user's last direct click points at — a design
  // element -> Layers, a code line -> Files. A nonce so repeat clicks of the
  // same kind still register; only direct canvas/code clicks set it, never
  // programmatic selection (defaults, drift pager, inbox jumps).
  const [listFocus, setListFocus] = useState(null)
  const deferredLive = useDeferredValue(liveCode)

  // Unmerged edits are kept per item (in the project's WorkspaceProvider),
  // so switching items, going back to the Workspace or arriving from a
  // Conflict Point's "Open in Merge Studio" picks up where you left off.
  useEffect(() => {
    if (item?.id) saveMergeDraft(item.id, {
      resolutions, assemblies, assemblySources, reviewMarks, addedLayers, manualCode,
      annotations: annotationsSnap, appliedPreset, syncSelection, historyEvents, currentHistoryId,
    })
  }, [item?.id, saveMergeDraft, resolutions, assemblies, assemblySources, reviewMarks, addedLayers, manualCode, annotationsSnap, appliedPreset, syncSelection, historyEvents, currentHistoryId])

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
    if (openDeck) setDeckOpen(true)
    // copy.json is Merge Studio-only; never hand it to the main workspace.
    if (target?.fileId && target.fileId !== COPY_FILE_ID) setActiveFileId(target.fileId)
  }

  function selectFrame() {
    // Keep the current selection so the Block Deck still has a target.
    setDeckOpen(true)
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
    if (openDeck) setDeckOpen(true)
  }

  // Opens the 4-step merge wizard with everything chosen so far bundled in:
  // Block Deck variant resolutions (via `resolutions`), the applied AI
  // preset, and the canvas annotations.
  function openWizard(annotations = annotationsSnap, step = 0) {
    const preset =
      appliedPreset?.layerId
        ? appliedPreset
        : null
    setMergeModal({ annotations, step, preset })
  }

  // Preview's "Edit in Assemble": park the wizard (kept, just not shown),
  // select the element being reviewed, bring it into view and open the
  // Block Deck on its Assemble tab — every edit so far stays as it is.
  // `returnToPreview` reopens the wizard on Preview at the same item, with
  // the latest edits (and review marks) reflected.
  function editInAssemble({ layerId, driftId }) {
    setMergeModal((m) => m && { ...m, parked: true, step: 1, returnDriftId: driftId })
    setWizardStage('preview')
    setDeckCollapsed(false)
    setDeckTabRequest({ tab: 'assemble', nonce: Date.now() })
    requestMergeFocus({ itemId: item.id, layerId, openDeck: true, label: 'Edit in Assemble' })
  }
  function returnToPreview() {
    setMergeModal((m) => m && { ...m, parked: false, step: 1, annotations: annotationsSnap })
  }
  const wizardParked = Boolean(mergeModal?.parked)

  function setReviewMark(driftId, signature) {
    setReviewMarks((prev) => {
      const next = { ...prev }
      if (signature == null) delete next[driftId]
      else next[driftId] = signature
      return next
    })
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
    if (!keepDeck && !forceOpen) setDeckOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergeFocus, item?.id])

  function rollbackTo(event) {
    const entry = {
      id: `mh-rb-${Date.now()}`,
      kind: 'rollback',
      title: `Rolled back to “${event.title}”`,
      branch: event.branch,
      authorId: 'jane',
      time: 'Just now',
      changes: [{ label: 'State restored', from: 'Current', to: event.time }],
    }
    setHistoryEvents((prev) => [entry, ...prev])
    setCurrentHistoryId(entry.id)
    setResolutions({})
    setManualCode({})
    setAppliedPreset(null)
    if (item?.tag === 'Merged') updateMergeItem(item.id, { tag: 'In Progress' })
  }

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
  // Block Deck target: the selected layer, or the smart default when the
  // selection is an unmapped code line / nothing.
  const deckLayerId = syncSelection?.layerId ?? defaultLayerFor(item)
  // A fresh selection re-expands a collapsed Block Deck, so its
  // context-aware content is visible right away.
  useEffect(() => setDeckCollapsed(false), [deckLayerId])
  const selectedLayer = frame0?.layers.find((l) => l.id === deckLayerId) ?? null

  // Publish the Merge Changes CTA to the top bar (latest openWizard via ref).
  const openWizardRef = useRef(null)
  openWizardRef.current = () => openWizard()
  const mergedNow = item?.tag === 'Merged'
  const ctaCount = Object.keys(resolutions).length + Object.keys(manualCode).length + annotationsSnap.filter((a) => a.status === 'done').length
  useEffect(() => {
    if (!item) {
      setMergeCta(null)
      return
    }
    setMergeCta({ merged: mergedNow, count: ctaCount, open: () => openWizardRef.current?.() })
    return () => setMergeCta(null)
  }, [item, mergedNow, ctaCount, setMergeCta])

  const deckReserve = deckOpen && !deckCollapsed && !deckFloating ? DECK_RESERVE : 0
  // The wizard docks right too (same side as the Block Deck) but floats as
  // an independent inspector: it doesn't refit the canvas or move the
  // canvas tools (those follow `deckReserve` only). Its width only counts
  // when centering a jump-to target, so a target being reviewed is never
  // hidden behind it. Takes whichever of the two reserves more, since both
  // dock to the same edge.
  const wizardReserve = mergeModal && !wizardParked ? WIZARD_RESERVE : 0
  const reserve = Math.max(deckReserve, wizardReserve)
  // Committed manual code plus the in-progress keystrokes: what the canvas,
  // Preview and wizard render the Current Implementation from.
  const syncedCode = deferredLive ? { ...manualCode, [deferredLive.key]: deferredLive.text } : manualCode
  const codeWindowCode = deferredLive?.source === 'design' ? syncedCode : manualCode
  // The selected layer's text slots with their current (edited) values, for
  // the Block Deck's Text section.
  const layerCopy = deckLayerId ? copyEdits(frame0, syncedCode)[deckLayerId] : null
  const textSlots = copyEntries(frame0)
    .filter((e) => e.layerId === deckLayerId)
    .map((e) => ({ ...e, current: layerCopy?.[e.slot] ?? e.value }))
  const variantPreviews = item?.hasDesign ? buildVariantPreviews(item.id, resolutions, hoverDiff) : null

  // Onboarding guide (MergeGuide), fully action-driven — no Next button:
  //   1 Merge List    → a tab / filter / search interaction  → 2
  //   2 Pick or add   → an item opens (selected or via Add Files) → 3
  //   3 Drift pager   → a ‹ › click, or the deck opening (the only way
  //                     forward when an item has a single drift)  → 4
  //   4 Block Deck    → a property edit or a deck tab switch    → 5
  //   5 Merge Changes → the merge wizard opens                  → done
  // Closing the item drops back to 2. Skip ends it for the session.
  const rootRef = useRef(null)
  const [guideStep, setGuideStep] = useState(() => (guideFinished ? null : item ? 3 : 1))
  function finishGuide() {
    guideFinished = true
    setGuideStep(null)
  }
  function advanceGuide(from) {
    setGuideStep((s) => (s === from ? from + 1 : s))
  }
  const editCount = Object.keys(resolutions).length + Object.keys(assemblies).length + Object.keys(manualCode).length + addedLayers.length
  useEffect(() => {
    setGuideStep((s) => (s == null ? s : item && s <= 2 ? 3 : !item && s >= 3 ? 2 : s))
  }, [item?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (deckOpen) advanceGuide(3)
  }, [deckOpen])
  useEffect(() => {
    if (editCount > 0) advanceGuide(4)
  }, [editCount])
  useEffect(() => {
    if (mergeModal && guideStep != null) finishGuide()
  }, [mergeModal]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={rootRef} className="relative flex min-h-0 flex-1 bg-canvas">

      {item ? (
        <div className="flex min-h-0 flex-1">
        <MergeInfiniteCanvas
          onDriftNav={() => advanceGuide(3)}
          reserve={reserve}
          layoutReserve={deckReserve}
          guidesVisible={guidesVisible}
          onToggleGuides={() => setGuidesVisible((v) => !v)}
          listCollapsed={mergeListCollapsed}
          focus={mergeFocus}
          resolutionCount={Object.keys(resolutions).length + Object.keys(manualCode).length}
          merged={item.tag === 'Merged'}
          inReview={item.tag === 'In Review'}
          headerAction={
            <>
              {/* While the wizard is parked for "Edit in Assemble": the way
                  back to Preview, where the latest edits are reflected. */}
              {wizardParked && (
                <button
                  type="button"
                  onClick={returnToPreview}
                  className="flex h-10 items-center gap-2 rounded-full bg-emerald-400 pr-4 pl-3 text-[13px] font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-300 animate-in fade-in zoom-in-95 duration-200"
                >
                  <ArrowLeft className="size-4" />
                  Back to Preview
                </button>
              )}
              {deckOpen && deckCollapsed && (
                <button
                  type="button"
                  data-guide="block-deck"
                  onClick={() => setDeckCollapsed(false)}
                  title="Show Block Deck"
                  className={cn(
                    'flex h-10 items-center gap-2 rounded-full pr-3.5 pl-3 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted animate-in fade-in zoom-in-95 duration-200',
                    FLOATING_PILL
                  )}
                >
                  <Blocks className="size-4 text-slate-400" />
                  Block Deck
                </button>
              )}
            </>
          }
          stage={mergeModal ? wizardStage : 'compare'}
          assemblies={assemblies}
          resolutions={resolutions}
          extraLayers={addedLayers}
          manualCode={manualCode}
          syncedCode={syncedCode}
          codeWindowCode={codeWindowCode}
          onEditCode={editCodeLine}
          onLiveEditCode={liveEditCodeLine}
          onEditText={editText}
          codeReveal={codeReveal}
          onUndoChange={undoChange}
          annotations={annotationsSnap}
          onAnnotationsChange={setAnnotationsSnap}
          onMerge={(annotations, step = 0) => openWizard(annotations, step)}
          item={item}
          files={files}
          syncSelection={syncSelection}
          appliedPreset={appliedPreset}
          variantPreviews={variantPreviews}
          onSelectLayer={selectLayer}
          onSelectLine={selectLine}
          onSelectFrame={selectFrame}
          onFocusSource={(source) => setListFocus({ tab: source === 'code' ? 'files' : 'layers', nonce: Date.now() })}
        />
        </div>
      ) : (
        // Nothing is auto-selected — but the empty state is the same canvas
        // surface as MergeInfiniteCanvas (bg-canvas + its dot grid at
        // 100% zoom), so selecting an item just fills the canvas in rather
        // than swapping a flat placeholder for a whole new background. The
        // "pick an item" guidance is the onboarding guide's job (MergeGuide),
        // keeping the canvas clean.
        <div
          className="min-h-0 flex-1 bg-canvas"
          style={{
            backgroundImage: 'radial-gradient(color-mix(in oklch, var(--foreground) 14%, transparent) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        />
      )}

      <MergeListSidebar
        onExplore={() => advanceGuide(1)}
        item={item}
        files={files}
        frame={frame0}
        selectedLayerId={syncSelection?.layerId}
        selectedFileId={syncSelection?.fileId}
        manualCode={manualCode}
        focusTab={listFocus}
        editedLayerIds={new Set([...Object.keys(assemblies), ...Object.keys(copyEdits(frame0, manualCode))])}
      />

      {item && (
        <BlockDeckPanel
          driftEffect={deckLayerId ? variantPreviews?.[deckLayerId] : undefined}
          textSlots={textSlots}
          onEditText={editText}
          open={deckOpen}
          onFloat={() => setDeckFloating(true)}
          onTabSwitch={() => advanceGuide(4)}
          collapsed={deckCollapsed}
          onCollapse={() => setDeckCollapsed(true)}
          item={item}
          selectedLayerId={deckLayerId}
          selectedLayerName={selectedLayer?.name}
          appliedPresetId={appliedPreset?.id}
          resolutions={resolutions}
          manualCode={manualCode}
          onEditCode={editCodeLine}
          onResolve={resolveDiff}
          onHoverDiff={setHoverDiff}
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
          onMerge={() => openWizard()}
          changeCounts={{
            compare: buildDrifts(item, frame0).length,
            assemble: Object.keys(assemblies).length,
            library: addedLayers.length,
          }}
        />
      )}

      {guideStep != null && !mergeModal && !mergePreviewOpen && (
        <MergeGuide
          containerRef={rootRef}
          step={guideStep}
          onSkip={finishGuide}
        />
      )}

      {item && mergeModal && !wizardParked && (
        <MergeExecutionModal
          item={item}
          resolutions={resolutions}
          annotations={mergeModal.annotations}
          preset={mergeModal.preset}
          assemblies={assemblies}
          assemblySources={assemblySources}
          extraLayers={addedLayers}
          manualCode={manualCode}
          onResolveDiff={resolveDiff}
          reviewMarks={reviewMarks}
          onSetReviewMark={setReviewMark}
          onEditInAssemble={editInAssemble}
          initialDriftId={mergeModal.returnDriftId}
          initialStep={mergeModal.step}
          onStepChange={setWizardStage}
          onClose={() => {
            setMergeModal(null)
            setWizardStage('compare')
          }}
          // Opening the PR hands the item to its reviewers: it reads
          // "In Review" in the Merge List until it's approved (merging and
          // deploying happen after approval, outside this flow).
          onComplete={(reviewerIds) => {
            updateMergeItem(item.id, { tag: 'In Review', reviewers: reviewerIds.map((id) => item.reviewers?.find((r) => r.id === id) ?? { id, status: 'pending' }), updatedLabel: 'Just now' })
            for (const conflict of conflicts.filter((c) => c.mergeItemId === item.id && c.reviewStage !== 'resolved')) {
              const reviewers = [...conflict.reviewers, ...reviewerIds.filter((id) => !conflict.reviewers.some((r) => r.id === id)).map((id) => ({ id, status: 'pending' }))]
              updateConflict(conflict.id, { reviewers, reviewStage: reviewers.every((r) => r.status === 'approved') ? 'approved' : 'in_review' })
            }
          }}
          onFinalMerge={() => completeMerge(item.id)}
          onEditCode={editCodeLine}
        />
      )}

      {/* The selected canvas element: bounding box handles to move / resize
          (plus delete for Library-added layers, reset for edited ones). */}
      {selLayer && frame0 && guidesVisible && !placing && (!mergeModal || wizardParked) && !mergePreviewOpen && (
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

      {mergeDrawer === 'history' && (
        <MergeHistoryDrawer
          events={historyEvents}
          currentId={currentHistoryId}
          onRollback={rollbackTo}
          onClose={() => setMergeDrawer(null)}
        />
      )}
      {mergeDrawer === 'inbox' && (
        <MergeInboxDrawer
          onJump={(n) => {
            // A Conflict Point item: back to the Workspace, its review open.
            if (n.target.conflictId) {
              setMergeDrawer(null)
              exitMergeStudio()
              setBottomPanel({ tab: 'conflict', open: true })
              openConflictReview(n.target.conflictId)
              return
            }
            requestMergeFocus({ ...n.target, pulse: true })
          }}
          onClose={() => setMergeDrawer(null)}
        />
      )}

      <MergeAiBar />
    </div>
  )
}

export default MergeStudioWorkspace
