import { useState } from 'react'
import { cn } from 'cn'
import { assets, inspectorSpecsByType } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { assetIcon } from '@/lib/fileIcons'
import { BlockAssembleTab, ComponentsTab } from '@/components/mergestudio/BlockDeckPanel'
import { CATEGORY_TAB, CATEGORY_TAB_ACTIVE, CATEGORY_TAB_IDLE } from '@/components/mergestudio/floatingStyles'

const SUB_TABS = [
  ['assemble', 'Assemble'],
  ['library', 'Library'],
  ['project', 'Project'],
]

// The navigator's Assets view, laid out like Merge Studio's Block Deck:
// sub-tabs for Assemble (the selected canvas element's shape / size /
// style inspector), Library (the design system's components, filtered to
// what fits the selection) and Project (this project's own assets — design
// files brought in with the file tree's Import first). Outside Merge
// Studio the Library is browse-only: placing components is Merge Studio's.
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
      {tab === 'project' && <ProjectAssets />}
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

function ProjectAssets() {
  const { importedAssets } = useWorkspace()

  return (
    <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
      {importedAssets.length > 0 && (
        <div className="mb-2">
          <p className="px-2 pt-1 pb-1 text-[11px] font-medium text-slate-500">Imported</p>
          {importedAssets.map((asset) => {
            const Icon = assetIcon(asset.kind)
            return (
              <div key={asset.id} title={asset.url ?? asset.name} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-muted hover:text-foreground">
                <Icon className="size-3.5 shrink-0 text-violet-300" />
                <span className="truncate">{asset.name}</span>
              </div>
            )
          })}
        </div>
      )}
      {assets.map((asset) => (
        <div key={asset.id} className="cursor-default rounded-md px-2 py-1.5 hover:bg-muted hover:text-foreground">
          {asset.name}
        </div>
      ))}
    </div>
  )
}

export default AssetsPanel
