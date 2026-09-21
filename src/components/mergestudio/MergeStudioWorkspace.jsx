import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { designMergeVariants, openFiles } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import MergeInfiniteCanvas from '@/components/mergestudio/MergeInfiniteCanvas'
import BlockDeckPanel from '@/components/mergestudio/BlockDeckPanel'

// The right-hand side of Merge Studio — a single shared infinite canvas
// (MergeInfiniteCanvas) holding every code file and design artboard for the
// active item as its own positioned card, with the Block Deck panel
// floating on top of it. This component is just the orchestrator: it owns
// the code<->design sync selection (driven by clicking a layer on an
// artboard or a line in a code card — see `designMergeVariants[item.id]
// .layerCodeMap`) and hands it to both children, plus resets the shared
// activeFileId/activePageId whenever a different merge item is selected.
function MergeStudioWorkspace({ item }) {
  const { setActiveFileId, setActivePageId } = useWorkspace()
  const [syncSelection, setSyncSelection] = useState(null)

  useEffect(() => {
    if (!item) return
    setSyncSelection(null)
    if (item.fileIds?.[0]) setActiveFileId(item.fileIds[0])
    if (item.hasDesign && item.designPageId) setActivePageId(item.designPageId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id])

  function selectLayer(layerId) {
    const map = designMergeVariants[item.id]?.layerCodeMap ?? {}
    const target = map[layerId]
    setSyncSelection({ layerId, fileId: target?.fileId, line: target?.line })
    if (target?.fileId) setActiveFileId(target.fileId)
  }

  function selectLine(fileId, line) {
    const map = designMergeVariants[item.id]?.layerCodeMap ?? {}
    const layerId = Object.keys(map).find((id) => map[id].fileId === fileId && map[id].line === line)
    setSyncSelection({ layerId, fileId, line })
  }

  if (!item) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="size-5" />
        </span>
        <p className="max-w-sm text-xs text-muted-foreground">
          Select an item from the Merge List, or add your currently open files to start a new
          merge.
        </p>
      </div>
    )
  }

  const files = openFiles.filter((f) => item.fileIds?.includes(f.id))

  return (
    <div className="relative flex min-h-0 flex-1 bg-background p-4">
      <MergeInfiniteCanvas
        item={item}
        files={files}
        syncSelection={syncSelection}
        onSelectLayer={selectLayer}
        onSelectLine={selectLine}
      />
      <BlockDeckPanel item={item} selectedLayerId={syncSelection?.layerId} />
    </div>
  )
}

export default MergeStudioWorkspace
