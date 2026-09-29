import { useState } from 'react'
import { cn } from 'cn'
import { inspectorSpecsByType } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { BlockAssembleTab, ComponentsTab } from '@/components/mergestudio/BlockDeckPanel'
import { CATEGORY_TAB, CATEGORY_TAB_ACTIVE, CATEGORY_TAB_IDLE } from '@/components/mergestudio/floatingStyles'

const SUB_TABS = [
  ['assemble', 'Assemble'],
  ['library', 'Library'],
]

// The navigator's Assets view, laid out like Merge Studio's Block Deck:
// sub-tabs for Assemble (the selected canvas element's shape / size /
// style inspector) and Library (the design system's components, filtered
// to what fits the selection). Project files — imported design files
// included — live in the Files tree, not here. Outside Merge Studio the
// Library is browse-only: placing components is Merge Studio's.
function AssetsPanel() {
  const [tab, setTab] = useState('library')

  return (
    <div className="flex h-full flex-col bg-card text-xs text-muted-foreground">
      <div className="flex shrink-0 items-center gap-1 px-3 pt-2 pb-3">
        {SUB_TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={cn(CATEGORY_TAB, tab === id ? CATEGORY_TAB_ACTIVE : CATEGORY_TAB_IDLE)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'assemble' && <AssembleView />}
      {tab === 'library' && <LibraryView />}
    </div>
  )
}

// The canvas's current selection, as the Block Deck tabs expect it: the
// layer plus the width of the frame it sits in.
function useSelectedLayer() {
  const { selectedLayerId, activePageId, projectPages } = useWorkspace()
  const page = projectPages.find((p) => p.id === activePageId) ?? projectPages[0]
  for (const frame of page?.frames ?? []) {
    const layer = frame.layers.find((l) => l.id === selectedLayerId)
    if (layer) return { layer, frameWidth: frame.width }
  }
  return { layer: null, frameWidth: 300 }
}

function AssembleView() {
  const { assetAssemblies, assembleAsset } = useWorkspace()
  const { layer, frameWidth } = useSelectedLayer()
  const [appliedPresetId, setAppliedPresetId] = useState(null)
  return (
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
  )
}

function LibraryView() {
  const { layer } = useSelectedLayer()
  return <ComponentsTab selectedLayer={layer} />
}

export default AssetsPanel
