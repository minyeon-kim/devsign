import { useState } from 'react'
import { inspectorSpecsByType } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { BlockAssembleTab } from '@/components/mergestudio/BlockDeckPanel'
import AssetsLibrary from './AssetsLibrary'

function AssetsPanel() {
  const { layer } = useSelectedLayer()
  return <div className="flex h-full flex-col bg-card text-xs text-muted-foreground"><AssetsLibrary layer={layer} /></div>
}

function useSelectedLayer() {
  const { selectedLayerId, activePageId, projectPages } = useWorkspace()
  const page = projectPages.find((p) => p.id === activePageId) ?? projectPages[0]
  for (const frame of page?.frames ?? []) {
    const layer = frame.layers.find((l) => l.id === selectedLayerId)
    if (layer) return { layer, frameWidth: frame.width }
  }
  return { layer: null, frameWidth: 300 }
}

export function WorkspaceProperties() {
  const { assetAssemblies, assembleAsset } = useWorkspace()
  const { layer, frameWidth } = useSelectedLayer()
  const [appliedPresetId, setAppliedPresetId] = useState(null)
  return (
    <div className="ds-compact-inspector flex h-full min-h-0 flex-1 flex-col">
      <BlockAssembleTab
        selectedLayer={layer}
        frameWidth={frameWidth}
        assembly={layer ? assetAssemblies[layer.id] : undefined}
        onAssemble={(patch) => layer && assembleAsset(layer.id, patch)}
        onAssembleReset={() => layer && assembleAsset(layer.id, null)}
        tokenSpec={layer ? inspectorSpecsByType[layer.type] : null}
        selectedLayerName={layer?.name}
        appliedPresetId={appliedPresetId}
        onApplyPreset={setAppliedPresetId}
      />
    </div>
  )
}


export default AssetsPanel
