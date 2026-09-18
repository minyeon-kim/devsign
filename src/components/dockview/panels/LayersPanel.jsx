import { Circle, Component, File, Frame, Group, Layers as LayersIcon, Type } from 'lucide-react'
import { cn } from 'cn'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { assets, canvasFrames, layerPages } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'

const kindIcons = {
  frame: Frame,
  component: Component,
  group: Group,
  vector: Circle,
  text: Type,
}

function LayerRow({ id, name, kind, depth, selected, onSelect }) {
  const Icon = kindIcons[kind] ?? Group

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      style={{ paddingLeft: 8 + depth * 16 }}
      className={cn(
        'flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-xs hover:bg-muted hover:text-foreground',
        selected ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
      )}
    >
      <Icon className={cn('size-3.5 shrink-0', selected ? 'text-primary' : 'text-muted-foreground/80')} />
      <span className="truncate">{name}</span>
    </button>
  )
}

function LayersPanel() {
  const { selectCanvasLayer, selectedLayerId } = useWorkspace()
  const page = layerPages[0]

  return (
    <Tabs defaultValue="layers" className="flex h-full flex-col gap-0 bg-card">
      <div className="flex h-9 shrink-0 items-center border-b px-2">
        <TabsList variant="line">
          <TabsTrigger value="layers" className="gap-1.5">
            <LayersIcon className="size-3.5" />
            Layers
          </TabsTrigger>
          <TabsTrigger value="assets" className="gap-1.5">
            <Component className="size-3.5" />
            Assets
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="layers" className="flex-1 overflow-auto p-2">
        <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-foreground/70">
          <File className="size-3.5" />
          {page?.name}
        </div>

        {canvasFrames.map((frame) => (
          <div key={frame.id}>
            <LayerRow
              id={frame.id}
              name={frame.name}
              kind={frame.kind}
              depth={1}
              selected={selectedLayerId === frame.id}
              onSelect={selectCanvasLayer}
            />
            {frame.layers.map((layer) => (
              <LayerRow
                key={layer.id}
                id={layer.id}
                name={layer.name}
                kind={layer.kind}
                depth={2}
                selected={selectedLayerId === layer.id}
                onSelect={selectCanvasLayer}
              />
            ))}
          </div>
        ))}
      </TabsContent>

      <TabsContent
        value="assets"
        className="flex-1 overflow-auto p-2 text-xs text-muted-foreground"
      >
        {assets.map((asset) => (
          <div
            key={asset.id}
            className="cursor-default rounded-md px-2 py-1.5 hover:bg-muted hover:text-foreground"
          >
            {asset.name}
          </div>
        ))}
      </TabsContent>
    </Tabs>
  )
}

export default LayersPanel
