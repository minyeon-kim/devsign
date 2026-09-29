import { useRef, useState } from 'react'
import { Component, Files, Layers, X } from 'lucide-react'
import { cn } from 'cn'
import ExplorerPanel from '@/components/dockview/panels/ExplorerPanel'
import LayersPanel from '@/components/dockview/panels/LayersPanel'
import AssetsPanel from '@/components/dockview/panels/AssetsPanel'
import {
  CATEGORY_TAB,
  CATEGORY_TAB_ACTIVE,
  CATEGORY_TAB_IDLE,
  FLOATING_PANEL,
  PANEL_RADIUS,
} from '@/components/mergestudio/floatingStyles'
import { useWorkspace } from '@/state/WorkspaceProvider'

const TABS = [
  { id: 'files', label: 'Files', icon: Files },
  { id: 'layers', label: 'Layers', icon: Layers },
  { id: 'assets', label: 'Assets', icon: Component },
]

// The project's navigator as one independent floating window — the file
// tree (Files), the canvas's layer tree (Layers) and its Assets, one tab
// each, in a single tab row — instead of two drawers embedded inside the code editor and the
// canvas. It's a Merge Studio floating panel (the Merge List window's
// surface: opaque card, 20px radius, hairline border, soft layered
// shadow), opened from the header's tools pill or the editor / canvas
// header buttons, draggable by its title row, and closed with ✕.
// `docked` (the Workspace's split-pane layout): it's the leftmost pane
// instead, filling it — no dragging; the splitter beside it sizes it.
function FilesLayersWindow({ docked = false }) {
  const { filesWindow, setFilesWindow } = useWorkspace()
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef(null)

  if (!filesWindow.open) return null

  function onPointerDown(event) {
    if (docked || event.button !== 0 || event.target.closest('button, input')) return
    drag.current = { x: event.clientX, y: event.clientY, offset }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event) {
    const d = drag.current
    if (!d) return
    setOffset({ x: d.offset.x + event.clientX - d.x, y: Math.max(-48, d.offset.y + event.clientY - d.y) })
  }

  function onPointerUp() {
    drag.current = null
  }

  return (
    <section
      aria-label="Files and layers"
      // No transition, so it tracks the pointer 1:1 while dragged.
      style={docked ? undefined : { translate: `${offset.x}px ${offset.y}px`, transition: 'none' }}
      className={cn(
        'flex flex-col overflow-hidden animate-in fade-in slide-in-from-left-2 duration-200 motion-reduce:animate-none',
        docked ? 'relative size-full' : 'absolute top-16 left-4 z-30 h-[min(560px,calc(100%-9rem))] w-[300px]',
        PANEL_RADIUS,
        FLOATING_PANEL
      )}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        title={docked ? undefined : 'Drag to move'}
        className={cn(
          'flex h-11 shrink-0 touch-none items-center gap-1 px-2.5 select-none',
          !docked && 'cursor-grab active:cursor-grabbing'
        )}
      >
        <div role="tablist" aria-label="Navigator" className="flex items-center gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filesWindow.tab === id}
              onClick={() => setFilesWindow({ tab: id })}
              className={cn(CATEGORY_TAB, 'gap-1.5', filesWindow.tab === id ? CATEGORY_TAB_ACTIVE : CATEGORY_TAB_IDLE)}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={() => setFilesWindow({ open: false })}
          className="ml-auto flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div role="tabpanel" className="min-h-0 flex-1 border-t border-white/[0.06] font-sans [&_.bg-card]:bg-transparent">
        {filesWindow.tab === 'files' && <ExplorerPanel />}
        {filesWindow.tab === 'layers' && <LayersPanel />}
        {filesWindow.tab === 'assets' && <AssetsPanel />}
      </div>
    </section>
  )
}

export default FilesLayersWindow

// The button at the start of the editor's / canvas's header row (where
// their embedded drawer toggles used to be): opens the window on its tab,
// or closes it if that tab is already showing.
export function FilesLayersButton({ tab, icon: Icon, label }) {
  const { filesWindow, setFilesWindow } = useWorkspace()
  const active = filesWindow.open && filesWindow.tab === tab

  return (
    <button
      type="button"
      title={active ? `Hide ${label}` : `Show ${label}`}
      aria-label={active ? `Hide ${label}` : `Show ${label}`}
      aria-pressed={active}
      onClick={() => setFilesWindow(active ? { open: false } : { open: true, tab })}
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full transition-colors',
        active ? 'bg-white/[0.08] text-foreground' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
      )}
    >
      <Icon className="size-3.5" />
    </button>
  )
}
