import { Circle, Component, File, Frame, Group, Type } from 'lucide-react'
import { cn } from 'cn'
import { canvasPages } from '@/data/mockData'
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

// The dockview tab strip above this panel ("Layers" / "Assets", see
// AssetsPanel) is the *only* tab row for this section now — no internal
// Tabs component duplicating it underneath.
function LayersPanel() {
  const { selectCanvasLayer, selectedLayerId, activePageId } = useWorkspace()
  // Reflects whichever page/file is open in the Canvas panel's own file
  // tabs — switching pages there updates the frame tree shown here too.
  const page = canvasPages.find((p) => p.id === activePageId) ?? canvasPages[0]

  return (
    <div className="h-full overflow-auto bg-card p-2">
      <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-foreground/70">
        <File className="size-3.5" />
        {page?.name}
      </div>

      {page?.frames.map((frame) => (
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
    </div>
  )
}

export default LayersPanel
