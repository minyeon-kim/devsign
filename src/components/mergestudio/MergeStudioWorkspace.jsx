import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { canvasPages, designMergeVariants, mergeHistoryEvents, openFiles } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import MergeListSidebar from '@/components/mergestudio/MergeListSidebar'
import MergeInfiniteCanvas from '@/components/mergestudio/MergeInfiniteCanvas'
import BlockDeckPanel, { DECK_WIDTH } from '@/components/mergestudio/BlockDeckPanel'
import { diffEffect } from '@/components/mergestudio/mergeEffects'
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
  } = useWorkspace()
  const [historyEvents, setHistoryEvents] = useState(mergeHistoryEvents)
  const [currentHistoryId, setCurrentHistoryId] = useState(mergeHistoryEvents[0].id)
  const [syncSelection, setSyncSelection] = useState(null)
  const [appliedPreset, setAppliedPreset] = useState(null)
  const [deckOpen, setDeckOpen] = useState(false)
  const [mergeModal, setMergeModal] = useState(null) // { annotations, step } snapshot while open
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
    setDeckOpen(false)
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
  const selectedLayer = item?.hasDesign
    ? canvasPages
        .find((p) => p.id === item.designPageId)
        ?.frames[0]?.layers.find((l) => l.id === syncSelection?.layerId)
    : null

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
          onMerge={(annotations, step = 0) => setMergeModal({ annotations, step })}
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
          onApplyPreset={setAppliedPreset}
        />
      )}

      {item && mergeModal && (
        <MergeExecutionModal
          item={item}
          resolutions={resolutions}
          annotations={mergeModal.annotations}
          initialStep={mergeModal.step}
          onStepChange={setWizardStage}
          onClose={() => {
            setMergeModal(null)
            setWizardStage('compare')
          }}
          onComplete={() => completeMerge(item.id)}
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
