import { useRef } from 'react'
import { Maximize2, Minimize2, X } from 'lucide-react'
import { cn } from 'cn'
import { FLOATING_PANEL, PANEL_RADIUS } from '@/components/mergestudio/floatingStyles'
import { PANEL_ICONS } from '@/components/workspace/panelIcons'

const DRAG_THRESHOLD = 4

// One floating window over the canvas — the Merge Studio "card" visual
// language (rounded-2xl, glass-free opaque panel, soft lifted shadow)
// wrapping whatever dockview panel content is its active tab. `group` is
// the raw layout record from floatingDockApi's store (read fresh every
// render, mutated imperatively by dockApi); `panelsById` resolves each of
// its tab ids to `{ component, title, params }`. `components` maps a
// panel's `component` string to the actual React component, same
// convention dockview used.
function FloatingWindow({ group, panelsById, dockApi, components }) {
  const dragRef = useRef(null)

  if (!group.open || group.panelIds.length === 0) return null

  const activePanel = panelsById[group.activeId]
  const ActiveContent = activePanel && components[activePanel.component]
  const activeHandle = dockApi.getPanel(group.activeId)
  const isMaximized = activeHandle?.api.isMaximized() ?? false

  function beginDrag(e) {
    if (e.button !== 0 || e.target.closest('button')) return
    dockApi.focusGroup(group.id)
    const start = { px: e.clientX, py: e.clientY, gx: group.x, gy: group.y }
    dragRef.current = { moved: false }
    function onMove(m) {
      const dx = m.clientX - start.px
      const dy = m.clientY - start.py
      if (!dragRef.current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      dragRef.current.moved = true
      dockApi.moveGroup(group.id, start.gx + dx, start.gy + dy)
    }
    function onUp() {
      dragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function beginResize(e) {
    e.stopPropagation()
    e.preventDefault()
    dockApi.focusGroup(group.id)
    const start = { px: e.clientX, py: e.clientY, w: group.w, h: group.h }
    function onMove(m) {
      dockApi.resizeGroup(group.id, start.w + (m.clientX - start.px), start.h + (m.clientY - start.py))
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const geom = isMaximized
    ? { left: 0, top: 0, width: '100%', height: '100%' }
    : { left: group.x, top: group.y, width: group.w, height: group.h }

  return (
    <div
      data-window={group.id}
      className={cn(
        'absolute flex flex-col overflow-hidden',
        FLOATING_PANEL,
        isMaximized ? 'rounded-none' : PANEL_RADIUS
      )}
      style={{ ...geom, zIndex: isMaximized ? 500 : group.z }}
      onPointerDownCapture={() => dockApi.focusGroup(group.id)}
    >
      {group.hideHeader ? (
        <div
          onPointerDown={beginDrag}
          className="flex h-8 shrink-0 cursor-grab items-center gap-1.5 border-b border-white/10 bg-black/10 px-3 text-[11px] font-medium text-muted-foreground select-none active:cursor-grabbing"
        >
          {activePanel?.title}
        </div>
      ) : (
        <div
          onPointerDown={beginDrag}
          className="flex h-9 shrink-0 cursor-grab items-center gap-0.5 overflow-x-auto border-b border-white/10 bg-black/20 px-1.5 active:cursor-grabbing"
        >
          {group.panelIds.map((pid) => {
            const p = panelsById[pid]
            if (!p) return null
            const Icon = PANEL_ICONS[p.params?.iconName]
            const active = pid === group.activeId
            return (
              <button
                key={pid}
                type="button"
                onClick={() => dockApi.setActiveTab(group.id, pid)}
                className={cn(
                  'flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
                  active ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {Icon && <Icon className="size-3.5 shrink-0" />}
                <span className="max-w-[140px] truncate">{p.title}</span>
              </button>
            )
          })}
          <div className="ml-auto flex shrink-0 items-center gap-0.5 pl-1">
            <button
              type="button"
              title={isMaximized ? 'Restore' : 'Maximize'}
              onClick={() => (isMaximized ? activeHandle?.api.exitMaximized() : activeHandle?.api.maximize())}
              className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
            >
              {isMaximized ? <Minimize2 className="size-3" /> : <Maximize2 className="size-3" />}
            </button>
            <button
              type="button"
              title="Close"
              onClick={() => activeHandle?.api.close()}
              className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden bg-card">
        {ActiveContent && <ActiveContent params={activePanel.params} />}
      </div>

      {!isMaximized && (
        <div
          onPointerDown={beginResize}
          title="Resize"
          data-resize-handle
          className="absolute right-0.5 bottom-0.5 z-20 flex size-4 cursor-nwse-resize items-end justify-end text-white/25 hover:text-white/50"
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path d="M8 1L1 8M8 4.5L4.5 8M8 8L8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </div>
  )
}

export default FloatingWindow
