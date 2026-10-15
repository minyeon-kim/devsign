import { useState } from 'react'
import { inspectorSpecsByType } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { BlockAssembleTab } from '@/components/mergestudio/BlockDeckPanel'
import AssetsLibrary from './AssetsLibrary'
import { toast } from '@/i18n/toast'

// The design system's components, for the screen in view: with a layer selected (Layers), Replace it or Insert one
// into it; without, Add one to the screen — drawn on the board at once (ScreensBoard), kept with the project.
function AssetsPanel() {
  const { applyAssetComponent, addAssetComponent } = useWorkspace()
  const { layer, frame, pageId } = useSelectedLayer()
  return (
    <div className="flex h-full flex-col bg-card text-xs text-muted-foreground">
      <AssetsLibrary
        layer={layer}
        onApply={(def) => {
          applyAssetComponent(layer, def, frame?.width)
          toast('Component applied', { description: `${def.name} → ${layer?.name ?? ''}` })
        }}
        onInsert={(def) => {
          addAssetComponent(def, pageId, frame, layer)
          toast('Component inserted', { description: `${def.name} → ${layer?.name ?? ''}` })
        }}
        onAdd={frame ? (def) => {
          addAssetComponent(def, pageId, frame)
          toast('Added to the screen', { description: def.name })
        } : undefined}
      />
    </div>
  )
}

// The layer selected on the screen in view (its own, or a component added to it), and that screen.
function useSelectedLayer() {
  const { selectedLayerId, activePageId, projectPages, assetAdded } = useWorkspace()
  const page = projectPages.find((p) => p.id === activePageId) ?? projectPages[0]
  const frame = page?.frames?.[0] ?? null
  for (const candidate of page?.frames ?? []) {
    const layer = [...candidate.layers, ...(assetAdded?.[page.id] ?? [])].find((l) => l.id === selectedLayerId)
    if (layer) return { layer, frameWidth: candidate.width, frame: candidate, pageId: page.id }
  }
  return { layer: null, frameWidth: frame?.width ?? 300, frame, pageId: page?.id ?? null }
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
