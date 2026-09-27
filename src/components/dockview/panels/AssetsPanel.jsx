import { assets } from '@/data/mockData'

// Split out from LayersPanel so "Layers" and "Assets" are two native
// dockview tabs in one row (Chrome-style) instead of a second internal Tabs
// strip stacked underneath the dockview tab.
function AssetsPanel() {
  return (
    <div className="h-full overflow-auto bg-card p-2 text-xs text-muted-foreground">
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
