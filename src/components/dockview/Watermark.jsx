import { LayoutPanelTop } from 'lucide-react'

function Watermark() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
      <LayoutPanelTop className="size-6" />
      <p className="text-xs">
        Open a panel from the toolbar, or drag a tab here to dock it.
      </p>
    </div>
  )
}

export default Watermark
