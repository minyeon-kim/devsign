import { useState } from 'react'
import { ChevronRight, Circle, Component, Eye, EyeOff, File, Frame, Group, Lock, Type, Unlock } from 'lucide-react'
import { cn } from 'cn'
import { useWorkspace } from '@/state/WorkspaceProvider'

const kindIcons = {
  frame: Frame,
  component: Component,
  group: Group,
  vector: Circle,
  text: Type,
}

// A hover-revealed row action (lock, visibility) — same shape as the
// Explorer's: no button chrome, only the icon lightens on hover, with a
// small tooltip below it. `show` keeps it visible past hover (a locked or
// hidden layer stays marked once toggled, like Figma).
function RowAction({ icon: Icon, label, active, show, onClick }) {
  return (
    <span className="group/tip relative flex">
      <button
        type="button"
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation()
          onClick()
        }}
        className={cn(
          'flex items-center justify-center p-0.5 text-slate-500 hover:text-foreground',
          show ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100',
          active && 'text-foreground'
        )}
      >
        <Icon className="size-3.5" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute top-[calc(100%+5px)] left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-md border border-[color:var(--ds-border-subtle)] bg-card px-2 py-1 text-[11px] text-[#FAFAFA] opacity-0 shadow-lg transition-opacity duration-75 group-hover/tip:opacity-100"
      >
        {label}
      </span>
    </span>
  )
}

function LayerRow({ id, name, kind, depth, selected, expanded, collapsible, hidden, locked, onSelect, onToggle, onToggleHidden, onToggleLocked }) {
  const Icon = kindIcons[kind] ?? Group
  const Chevron = ChevronRight

  return (
    <div className="group/row flex items-center rounded-lg hover:bg-muted hover:text-foreground">
      <button
        type="button"
        onClick={() => onSelect(id)}
        style={{ paddingLeft: 6 + depth * 10 }}
        className={cn(
          'flex h-full min-w-0 flex-1 items-center gap-1.5 py-1 pr-1 text-left text-xs transition-colors',
          selected ? 'bg-[#0E1F1B] text-[#D1FAE5]' : 'text-muted-foreground',
          hidden && 'opacity-40'
        )}
      >
        {collapsible ? (
          <span
            role="button"
            aria-label={expanded ? 'Collapse' : 'Expand'}
            onClick={(event) => {
              event.stopPropagation()
              onToggle(id)
            }}
            className="flex size-3 shrink-0 items-center justify-center text-slate-500 hover:text-foreground"
          >
            <Chevron className={cn('size-3 transition-transform', expanded && 'rotate-90')} />
          </span>
        ) : (
          <span className="size-3 shrink-0" />
        )}
        <Icon className={cn('size-3.5 shrink-0', selected ? 'text-emerald-300' : kind === 'component' ? 'text-violet-300' : 'text-muted-foreground/80')} />
        <span className="truncate">{name}</span>
      </button>
      <div className="flex shrink-0 items-center gap-0.5 pr-1.5">
        <RowAction icon={locked ? Lock : Unlock} label="Toggle layer locking" show={locked} active={locked} onClick={() => onToggleLocked(id)} />
        <RowAction icon={hidden ? EyeOff : Eye} label="Toggle layer visibility" show={hidden} active={hidden} onClick={() => onToggleHidden(id)} />
      </div>
    </div>
  )
}

// The canvas's layer tree for whichever page is open — the Layers tab of
// the floating Files / Layers window (Assets is its own tab there).
// Locking and hiding are cosmetic here (this session only, not wired into
// the canvas) — the point is the row affordance, matching Figma's own.
function LayersPanel() {
  const { selectCanvasLayer, selectedLayerId, activePageId, projectPages } = useWorkspace()
  // The layer tree of whichever page is open on the canvas.
  const page = projectPages.find((p) => p.id === activePageId) ?? projectPages[0]
  const [collapsed, setCollapsed] = useState(new Set())
  const [locked, setLocked] = useState(new Set())
  const [hiddenLayers, setHiddenLayers] = useState(new Set())

  function toggle(id) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleIn(setter) {
    return (id) =>
      setter((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
  }
  const toggleLocked = toggleIn(setLocked)
  const toggleHidden = toggleIn(setHiddenLayers)

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="scroll-fade-bottom min-h-0 flex-1 overflow-auto p-2">
        <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-foreground/70">
          <File className="size-3.5" />
          {page?.name}
        </div>

        {page.frames.map((frame) => {
          const expanded = !collapsed.has(frame.id)
          return (
            <div key={frame.id}>
              <LayerRow
                id={frame.id}
                name={frame.name}
                kind={frame.kind}
                depth={1}
                collapsible
                expanded={expanded}
                selected={selectedLayerId === frame.id}
                hidden={hiddenLayers.has(frame.id)}
                locked={locked.has(frame.id)}
                onSelect={selectCanvasLayer}
                onToggle={toggle}
                onToggleHidden={toggleHidden}
                onToggleLocked={toggleLocked}
              />
              {expanded &&
                frame.layers.map((layer) => (
                  <LayerRow
                    key={layer.id}
                    id={layer.id}
                    name={layer.name}
                    kind={layer.kind}
                    depth={2}
                    selected={selectedLayerId === layer.id}
                    hidden={hiddenLayers.has(layer.id)}
                    locked={locked.has(layer.id)}
                    onSelect={selectCanvasLayer}
                    onToggleHidden={toggleHidden}
                    onToggleLocked={toggleLocked}
                  />
                ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default LayersPanel
