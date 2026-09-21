import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { canvasPages, designMergeVariants, mergeHistoryEvents, openFiles } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import MergeListSidebar from '@/components/mergestudio/MergeListSidebar'
import MergeInfiniteCanvas from '@/components/mergestudio/MergeInfiniteCanvas'
import BlockDeckPanel, { DECK_WIDTH } from '@/components/mergestudio/BlockDeckPanel'
import { diffEffect, frameWithLayers } from '@/components/mergestudio/mergeEffects'
import MergePreviewOverlay from '@/components/mergestudio/MergePreviewOverlay'
import MergeExecutionModal from '@/components/mergestudio/MergeExecutionModal'
import MergeHistoryDrawer from '@/components/mergestudio/MergeHistoryDrawer'
import MergeInboxDrawer from '@/components/mergestudio/MergeInboxDrawer'
import MergeAiBar from '@/components/mergestudio/MergeAiBar'

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
// The hovered option (if it belongs to this layer) beats the committed
// choice for the same diff, so hovering previews without committing.
function buildVariantPreview(itemId, layerId, resolutions, hoverDiff) {
  const diffs = designMergeVariants[itemId]?.layerDiffs?.[layerId]
  if (!layerId || !diffs) return null
  const merged = {}
  let active = false
  for (const diff of diffs) {
    const hovered = hoverDiff?.layerId === layerId && hoverDiff.diffId === diff.id ? hoverDiff.side : null
    const side = hovered ?? resolutions[`${layerId}:${diff.id}`]
    if (!side) continue
    active = true
    const e = diffEffect(diff, side)
    if (e.className) merged.className = e.className
    if (e.radius !== undefined) merged.radius = e.radius
    merged.dw = (merged.dw ?? 0) + (e.dw ?? 0)
    merged.dh = (merged.dh ?? 0) + (e.dh ?? 0)
  }
  return active ? { layerId, ...merged } : null
}

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
    if (item.fileIds?.[0]) setActiveFileId(item.fileIds[0])
    if (item.hasDesign && item.designPageId) setActivePageId(item.designPageId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id])

  function selectLayer(layerId) {
    const map = designMergeVariants[item.id]?.layerCodeMap ?? {}
    const target = map[layerId]
    setSyncSelection({
      layerId,
      fileId: target?.fileId,
      line: target?.line,
      endLine: target ? target.line + (target.span ?? 1) - 1 : undefined,
    })
    setAppliedPreset(null)
    setDeckOpen(true)
    if (target?.fileId) setActiveFileId(target.fileId)
  }

  function selectFrame() {
    setSyncSelection(null)
    setAppliedPreset(null)
    setDeckOpen(true)
  }

  function selectLine(fileId, line) {
    const map = designMergeVariants[item.id]?.layerCodeMap ?? {}
    // Any line inside a layer's code block resolves to that layer and
    // selects the whole block.
    const layerId = Object.keys(map).find(
      (id) => map[id].fileId === fileId && line >= map[id].line && line <= map[id].line + (map[id].span ?? 1) - 1
    )
    const t = layerId ? map[layerId] : null
    setSyncSelection(
      t
        ? { layerId, fileId, line: t.line, endLine: t.line + (t.span ?? 1) - 1 }
        : { layerId: undefined, fileId, line, endLine: line }
    )
    setAppliedPreset(null)
    setDeckOpen(true)
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

  // Changes log → Undo (annotation undo is handled inside the canvas).
  function undoChange(entry) {
    if (entry.kind === 'variant') {
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
    setResolutions((prev) => ({ ...prev, [`${layerId}:${diffId}`]: side }))
  }

  // Inbox click -> select the target (without popping the Block Deck open);
  // the canvas itself pans to it via the `focus` prop.
  const handledFocus = useRef(null)
  useEffect(() => {
    if (!item || !mergeFocus || mergeFocus.target.itemId !== item.id) return
    if (handledFocus.current === mergeFocus.nonce) return
    handledFocus.current = mergeFocus.nonce
    const { layerId, fileId, line } = mergeFocus.target
    if (layerId) selectLayer(layerId)
    else if (fileId && line) selectLine(fileId, line)
    if (!mergeFocus.target.keepDeck) setDeckOpen(false)
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
    setAppliedPreset(null)
    if (item?.tag === 'Merged') updateMergeItem(item.id, { tag: 'In Progress' })
  }

  const files = item ? openFiles.filter((f) => item.fileIds?.includes(f.id)) : []
  const baseFrame = item?.hasDesign ? canvasPages.find((p) => p.id === item.designPageId)?.frames[0] : null
  const frame0 = frameWithLayers(baseFrame, addedLayers)
  const selectedLayer = frame0?.layers.find((l) => l.id === syncSelection?.layerId) ?? null

  const deckReserve = deckOpen && !deckFloating ? DECK_RESERVE : 0
  const variantPreview = item?.hasDesign ? buildVariantPreview(item.id, syncSelection?.layerId, resolutions, hoverDiff) : null

  return (
    <div className="relative flex min-h-0 flex-1 bg-background">
      {item ? (
        <div className="flex min-h-0 flex-1">
        <MergeInfiniteCanvas
          reserve={deckReserve}
          focus={mergeFocus}
          resolutionCount={Object.keys(resolutions).length}
          merged={item.tag === 'Merged'}
          stage={mergeModal ? wizardStage : 'compare'}
          assemblies={assemblies}
          resolutions={resolutions}
          extraLayers={addedLayers}
          onUndoChange={undoChange}
          onAnnotationsChange={setAnnotationsSnap}
          onMerge={(annotations, step = 0) => openWizard(annotations, step)}
          item={item}
          files={files}
          syncSelection={syncSelection}
          appliedPreset={appliedPreset}
          variantPreview={variantPreview}
          onSelectLayer={selectLayer}
          onSelectLine={selectLine}
          onSelectFrame={selectFrame}
        />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-card p-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </span>
          <p className="max-w-sm text-xs text-muted-foreground">
            Select an item from the Merge List, or add your currently open files to start a new
            merge.
          </p>
        </div>
      )}

      <MergeListSidebar />

      {item && (
        <BlockDeckPanel
          open={deckOpen}
          onClose={() => setDeckOpen(false)}
          onFloat={() => setDeckFloating(true)}
          item={item}
          selectedLayerId={syncSelection?.layerId}
          selectedLayerName={selectedLayer?.name}
          appliedPresetId={appliedPreset?.id}
          resolutions={resolutions}
          onResolve={resolveDiff}
          onHoverDiff={setHoverDiff}
          onMerge={() => openWizard()}
          selectedLayer={selectedLayer}
          frameWidth={frame0?.width ?? 300}
          assembly={syncSelection?.layerId ? assemblies[syncSelection.layerId] : undefined}
          onAssemble={(patch) => syncSelection?.layerId && assemble(syncSelection.layerId, patch)}
          onAssembleReset={() => syncSelection?.layerId && resetAssembly(syncSelection.layerId)}
          onApplyComponent={applyComponent}
          onAddComponent={(def) => addComponent(def)}
          onInsertComponent={insertComponent}
          onApplyPreset={setAppliedPreset}
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
