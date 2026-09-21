import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { canvasPages, designMergeVariants, openFiles } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import MergeListSidebar from '@/components/mergestudio/MergeListSidebar'
import MergeInfiniteCanvas from '@/components/mergestudio/MergeInfiniteCanvas'
import BlockDeckPanel from '@/components/mergestudio/BlockDeckPanel'

// The whole right-hand side of Merge Studio — a single shared infinite
// canvas (MergeInfiniteCanvas) holding the merge item's unified code window
// and design artboards, with the Merge List and Block Deck panels floating
// on top of it (left and right respectively) instead of either being a
// layout-pushing fixed sidebar — the canvas itself spans this whole area
// underneath both. This component is the orchestrator: it owns the
// code<->design sync selection (driven by clicking a layer on an artboard
// or a line in the code window — see `designMergeVariants[item.id]
// .layerCodeMap`) plus the currently live-previewed AI Block Deck
// suggestion, and hands both to its children, resetting them whenever a
// different merge item or layer is selected.
function MergeStudioWorkspace({ item }) {
  const { setActiveFileId, setActivePageId } = useWorkspace()
  const [syncSelection, setSyncSelection] = useState(null)
  const [appliedPreset, setAppliedPreset] = useState(null)

  useEffect(() => {
    if (!item) return
    setSyncSelection(null)
    setAppliedPreset(null)
    if (item.fileIds?.[0]) setActiveFileId(item.fileIds[0])
    if (item.hasDesign && item.designPageId) setActivePageId(item.designPageId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id])

  function selectLayer(layerId) {
    const map = designMergeVariants[item.id]?.layerCodeMap ?? {}
    const target = map[layerId]
    setSyncSelection({ layerId, fileId: target?.fileId, line: target?.line })
    setAppliedPreset(null)
    if (target?.fileId) setActiveFileId(target.fileId)
  }

  function selectLine(fileId, line) {
    const map = designMergeVariants[item.id]?.layerCodeMap ?? {}
    const layerId = Object.keys(map).find((id) => map[id].fileId === fileId && map[id].line === line)
    setSyncSelection({ layerId, fileId, line })
    setAppliedPreset(null)
  }

  const files = item ? openFiles.filter((f) => item.fileIds?.includes(f.id)) : []
  const selectedLayer = item?.hasDesign
    ? canvasPages
        .find((p) => p.id === item.designPageId)
        ?.frames[0]?.layers.find((l) => l.id === syncSelection?.layerId)
    : null

  return (
    <div className="relative flex min-h-0 flex-1 bg-background p-4">
      {item ? (
        <MergeInfiniteCanvas
          item={item}
          files={files}
          syncSelection={syncSelection}
          appliedPreset={appliedPreset}
          onSelectLayer={selectLayer}
          onSelectLine={selectLine}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-2xl border bg-card p-6 text-center">
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
          item={item}
          selectedLayerId={syncSelection?.layerId}
          selectedLayerName={selectedLayer?.name}
          appliedPresetId={appliedPreset?.id}
          onApplyPreset={setAppliedPreset}
        />
      )}
    </div>
  )
}

export default MergeStudioWorkspace
