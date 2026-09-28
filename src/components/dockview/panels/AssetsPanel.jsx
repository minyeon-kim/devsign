import { assets } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { assetIcon } from '@/lib/fileIcons'

// Split out from LayersPanel so "Layers" and "Assets" are two native
// dockview tabs in one row (Chrome-style) instead of a second internal Tabs
// strip stacked underneath the dockview tab. Design files brought in with
// the file tree's Import (Figma, Illustrator, SVG, images) are listed first.
function AssetsPanel() {
  const { importedAssets } = useWorkspace()

  return (
    <div className="h-full overflow-auto bg-card p-2 text-xs text-muted-foreground">
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
        <div
          key={asset.id}
          className="cursor-default rounded-md px-2 py-1.5 hover:bg-muted hover:text-foreground"
        >
          {asset.name}
        </div>
      ))}
    </div>
  )
}

export default AssetsPanel
