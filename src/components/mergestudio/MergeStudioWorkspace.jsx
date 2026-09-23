import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { canvasPages, codeMergeVariants, designMergeVariants, mergeHistoryEvents, openFiles } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import MergeListSidebar from '@/components/mergestudio/MergeListSidebar'
import MergeInfiniteCanvas from '@/components/mergestudio/MergeInfiniteCanvas'
import BlockDeckPanel, { DECK_WIDTH } from '@/components/mergestudio/BlockDeckPanel'
import { diffEffect, frameWithLayers } from '@/components/mergestudio/mergeEffects'
import MergePreviewOverlay from '@/components/mergestudio/MergePreviewOverlay'
import MergeExecutionModal, { WIZARD_RESERVE } from '@/components/mergestudio/MergeExecutionModal'
import MergeHistoryDrawer from '@/components/mergestudio/MergeHistoryDrawer'
import MergeInboxDrawer from '@/components/mergestudio/MergeInboxDrawer'
import MergeAiBar from '@/components/mergestudio/MergeAiBar'
import MergeGuide from '@/components/mergestudio/MergeGuide'
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
    setActivePageId,
    completeMerge,
    updateMergeItem,
    mergeDrawer,
    setMergeDrawer,
    mergeFocus,
    requestMergeFocus,
    mergePreviewOpen,
    setMergePreviewOpen,
    setMergeCta,
    mergeListCollapsed,
  } = useWorkspace()
  const [historyEvents, setHistoryEvents] = useState(mergeHistoryEvents)
  const [currentHistoryId, setCurrentHistoryId] = useState(mergeHistoryEvents[0].id)
  const [syncSelection, setSyncSelection] = useState(null)
  const [appliedPreset, setAppliedPreset] = useState(null)
  const [deckOpen, setDeckOpen] = useState(false)
  const [mergeModal, setMergeModal] = useState(null) // { annotations, step } snapshot while open
  const [annotationsSnap, setAnnotationsSnap] = useState([])
  // Block Assemble: per-layer structural edits (shape, size, fill, border,
  // shadow, alignment, icon), previewed live on Option B and bundled into the
  // merge wizard.
  const [assemblies, setAssemblies] = useState({})
  // Layers pulled from the Design System library onto both artboards.
  const [addedLayers, setAddedLayers] = useState([])
  const [wizardStage, setWizardStage] = useState('compare') // macro stage shown in the canvas header
  // While the deck sits in its default spot the canvas refits so Option B
  // isn't covered by it; once dragged it floats freely and no longer does.
  const [deckFloating, setDeckFloating] = useState(false)
  // Variant Compare state lives here (not in the deck) so choosing — or
  // merely hovering — an option can live-preview on the Option B artboard.
  const [resolutions, setResolutions] = useState({})
  const [hoverDiff, setHoverDiff] = useState(null) // { layerId, diffId, side }
  // Hand-typed code lines from the code window, keyed `fileId:line`. They
  // win over incoming and AI-edited text everywhere the merged code shows.
  const [manualCode, setManualCode] = useState({})
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

  useEffect(() => {
    if (!item) return
    setSyncSelection(null)
    setAppliedPreset(null)
    setDeckOpen(false)
    setMergeModal(null)
    setResolutions({})
    setAssemblies({})
    setAddedLayers([])
    setHoverDiff(null)
    setManualCode({})
    setLiveCode(null)
    setCodeReveal(null)
    // Uniform initialization: every item starts with a default selected element.
    const defLayer = defaultLayerFor(item)
    if (defLayer) {
      const t = designMergeVariants[item.id]?.layerCodeMap?.[defLayer]
      setSyncSelection({
        layerId: defLayer,
        fileId: t?.fileId,
        line: t?.line,
        endLine: t ? t.line + (t.span ?? 1) - 1 : undefined,
      })
    } else {
      setSyncSelection(defaultLineFor(item))
    }
    if (item.fileIds?.[0]) setActiveFileId(item.fileIds[0])
    if (item.hasDesign && item.designPageId) setActivePageId(item.designPageId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id])

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
    setAppliedPreset(null)
    if (openDeck) setDeckOpen(true)
    // copy.json is Merge Studio-only; never hand it to the main workspace.
    if (target?.fileId && target.fileId !== COPY_FILE_ID) setActiveFileId(target.fileId)
  }

  function selectFrame() {
    // Keep the current selection so the Block Deck still has a target.
    setAppliedPreset(null)
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
    setAppliedPreset(null)
    if (openDeck) setDeckOpen(true)
  }

  // Opens the 4-step merge wizard with everything chosen so far bundled in:
  // Block Deck variant resolutions (via `resolutions`), the applied AI
  // preset, and the canvas annotations.
  function openWizard(annotations = annotationsSnap, step = 0) {
    const preset =
      appliedPreset && syncSelection?.layerId
        ? { layerId: syncSelection.layerId, label: appliedPreset.label, previewClass: appliedPreset.previewClass }
        : null
    setMergeModal({ annotations, step, preset })
  }

  function assemble(layerId, patch) {
    setAssemblies((prev) => ({ ...prev, [layerId]: { ...prev[layerId], ...patch } }))
  }

  function resetAssembly(layerId) {
    setAssemblies((prev) => {
      const next = { ...prev }
      delete next[layerId]
      return next
    })
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
    setAssemblies((prev) => ({
      ...prev,
      [selectedLayer.id]: {
        ...def.assembly,
        width: Math.min(def.width, Math.max(40, frame0.width - selectedLayer.x - 8)),
        height: def.height,
        ...(def.type !== selectedLayer.type && { asType: def.type, asLabel: def.label, asName: def.name }),
      },
    }))
  }

  // Insert: drop a component into the selected container element.
  function insertComponent(def) {
    if (selectedLayer) addComponent(def, selectedLayer)
  }

  // Add: pull a new instance onto both artboards, below the existing content,
  // then select it.
  function addComponent(def, parent = null) {
    if (!frame0) return
    const width = Math.min(def.width, (parent ? parent.width : frame0.width) - 24)
    const layer = {
      id: `${def.id}-${Date.now()}`,
      name: def.name,
      kind: 'component',
      type: def.type,
      label: def.label,
      ...(parent
        ? parent.type === 'bar' || parent.type === 'tabs'
          ? { x: parent.x + parent.width - width - 12, y: parent.y + Math.round((parent.height - def.height) / 2) }
          : { x: parent.x + 12, y: parent.y + 12 }
        : { x: Math.max(8, Math.round((frame0.width - width) / 2)), y: frame0.height + 12 }),
      width,
      height: def.height,
    }
    setAddedLayers((prev) => [...prev, layer])
    setAssemblies((prev) => ({ ...prev, [layer.id]: { ...def.assembly } }))
    setSyncSelection({ layerId: layer.id })
    setAppliedPreset(null)
  }

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
  const copy = copyFile(frame0)
  const files = item ? [...openFiles.filter((f) => item.fileIds?.includes(f.id)), ...(copy ? [copy] : [])] : []
  // Block Deck target: the selected layer, or the smart default when the
  // selection is an unmapped code line / nothing.
  const deckLayerId = syncSelection?.layerId ?? defaultLayerFor(item)
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
  }, [item?.id, mergedNow, ctaCount, setMergeCta])

  const deckReserve = deckOpen && !deckFloating ? DECK_RESERVE : 0
  // The wizard docks right too (same side as the Block Deck), and reserves
  // space there whenever it's open (any step, not just Check) so a target
  // being reviewed is never hidden behind the floating wizard window.
  // Dragging the wizard elsewhere is the user taking over positioning
  // themselves; the reserve still holds so it doesn't snap back to
  // fighting for that space if they drag it back. Takes whichever of the
  // two reserves more, since both dock to the same edge.
  const wizardReserve = mergeModal ? WIZARD_RESERVE : 0
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
    <div ref={rootRef} className="relative flex min-h-0 flex-1 bg-background">

      {item ? (
        <div className="flex min-h-0 flex-1">
        <MergeInfiniteCanvas
          onDriftNav={() => advanceGuide(3)}
          reserve={reserve}
          headerReserve={wizardReserve}
          listCollapsed={mergeListCollapsed}
          focus={mergeFocus}
          resolutionCount={Object.keys(resolutions).length + Object.keys(manualCode).length}
          merged={item.tag === 'Merged'}
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
        // surface as MergeInfiniteCanvas (bg-slate-800 + its dot grid at
        // 100% zoom), so selecting an item just fills the canvas in rather
        // than swapping a flat placeholder for a whole new background. The
        // "pick an item" guidance is the onboarding guide's job (MergeGuide),
        // keeping the canvas clean.
        <div
          className="min-h-0 flex-1 bg-slate-800"
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
          onAddComponent={(def) => addComponent(def)}
          onInsertComponent={insertComponent}
          onApplyPreset={setAppliedPreset}
        />
      )}

      {guideStep != null && !mergeModal && !mergePreviewOpen && (
        <MergeGuide
          containerRef={rootRef}
          step={guideStep}
          onSkip={finishGuide}
        />
      )}

      {item && mergeModal && (
        <MergeExecutionModal
          item={item}
          resolutions={resolutions}
          annotations={mergeModal.annotations}
          preset={mergeModal.preset}
          assemblies={assemblies}
          extraLayers={addedLayers}
          manualCode={manualCode}
          onResolveDiff={resolveDiff}
          initialStep={mergeModal.step}
          onStepChange={setWizardStage}
          onClose={() => {
            setMergeModal(null)
            setWizardStage('compare')
          }}
          onComplete={() => completeMerge(item.id)}
        />
      )}

      {mergePreviewOpen && item && (
        <MergePreviewOverlay
          item={item}
          resolutions={resolutions}
          annotations={annotationsSnap}
          preset={
            appliedPreset && syncSelection?.layerId
              ? { layerId: syncSelection.layerId, label: appliedPreset.label, previewClass: appliedPreset.previewClass }
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
        <MergeInboxDrawer onJump={(n) => requestMergeFocus(n.target)} onClose={() => setMergeDrawer(null)} />
      )}

      <MergeAiBar />
    </div>
  )
}

export default MergeStudioWorkspace
