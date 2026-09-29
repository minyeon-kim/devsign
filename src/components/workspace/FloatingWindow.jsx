import { useRef, useState } from 'react'
import { Maximize2, Minimize2, X } from 'lucide-react'
import { cn } from 'cn'
import {
  CATEGORY_TAB,
  CATEGORY_TAB_ACTIVE,
  CATEGORY_TAB_IDLE,
  FLOATING_PANEL,
  PANEL_RADIUS,
} from '@/components/mergestudio/floatingStyles'
import { PANEL_ICONS } from '@/components/workspace/panelIcons'
import { WindowHeaderSlotContext, WindowTabsContext } from '@/components/workspace/WindowHeaderSlot'
import PanelTabs from '@/components/workspace/PanelTabs'
import AddViewMenu from '@/components/workspace/AddViewMenu'

const DRAG_THRESHOLD = 4

// One floating window over the canvas — the Merge Studio "card" visual
// language (PANEL_RADIUS, the opaque FLOATING_PANEL surface, soft lifted
// shadow) wrapping whatever dockview panel content is its active tab. Its
// header matches Merge Studio's panels too: no divider or tinted bar, the
// shared category-tab pills for tabs, and 28px round window controls. The
// active panel can put its own toolbar on that same line (the editor's file
// tabs, the canvas's page tabs) through the header slot, so a window has a
// single header row rather than a title row plus a tab row. `group` is
// the raw layout record from floatingDockApi's store (read fresh every
// render, mutated imperatively by dockApi); `panelsById` resolves each of
// its tab ids to `{ component, title, params }`. `components` maps a
// panel's `component` string to the actual React component, same
// convention dockview used.
// `docked` (the Workspace's split-pane layout, see WorkspaceSplitLayout):
// the window fills its pane instead of floating at x/y — no corner resize
// (the splitters between panes do that); dragging its header hands off to
// `onDockDragStart` (drop it beside / into another pane), and so does
// dragging one of its tabs (just that tab moves) — and its header holds
// only its tabs (each closes itself) and the `+` view menu: no window
// controls.
function FloatingWindow({ group, panelsById, dockApi, components, docked = false, onDockDragStart }) {
  const dragRef = useRef(null)
  // The header's slot for the active panel's own toolbar (see
  // WindowHeaderSlot) — file tabs / page tabs sit on the title line.
  const [headerSlot, setHeaderSlot] = useState(null)

  if (!group.open || group.panelIds.length === 0) return null

  const activePanel = panelsById[group.activeId]
  const ActiveContent = activePanel && components[activePanel.component]
  const activeHandle = dockApi.getPanel(group.activeId)
  const isMaximized = activeHandle?.api.isMaximized() ?? false

  function beginDrag(e) {
    if (e.button !== 0 || e.target.closest('button, input, [role="tablist"] *, [role="dialog"]')) return
    if (docked) {
      onDockDragStart?.({ groupId: group.id }, e)
      return
    }
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
    : docked
      ? { position: 'relative', width: '100%', height: '100%' }
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
          className="flex h-10 shrink-0 cursor-grab items-center gap-1.5 px-4 text-xs font-medium text-slate-300 select-none active:cursor-grabbing"
        >
          {activePanel?.title}
        </div>
      ) : (
        <div
          onPointerDown={beginDrag}
          data-window-header={docked ? group.id : undefined}
          className="@container/nav flex h-11 shrink-0 cursor-grab items-center gap-1 border-b border-white/[0.06] px-2.5 active:cursor-grabbing"
        >
          {docked ? (
            // The real tabs — open files, canvas pages, the navigator's
            // views, other views by name (PanelTabs) — then `+` right after
            // the last one.
            <>
              <div className={cn("flex min-w-0 items-center gap-1", group.panelIds.every((pid) => panelsById[pid]?.component === 'navigator') ? 'flex-1 overflow-hidden' : 'shrink overflow-x-auto [scrollbar-width:none]')}>
                {group.panelIds.map((pid) =>
                  panelsById[pid] ? (
                    <PanelTabs
                      key={pid}
                      pid={pid}
                      panel={panelsById[pid]}
                      group={group}
                      dockApi={dockApi}
                      onDragStart={onDockDragStart}
                    />
                  ) : null
                )}
              </div>
              <AddViewMenu group={group} dockApi={dockApi} />
            </>
          ) : (
          <div className="flex shrink-0 items-center gap-1">
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
                  onPointerDown={(e) => docked && e.button === 0 && onDockDragStart?.({ groupId: group.id, panelId: pid }, e)}
                  title={docked ? 'Drag to split or move' : undefined}
                  className={cn(CATEGORY_TAB, 'gap-1.5', active ? CATEGORY_TAB_ACTIVE : CATEGORY_TAB_IDLE)}
                >
                  {Icon && <Icon className="size-3.5 shrink-0" />}
                  <span className="max-w-[140px] truncate">{p.title}</span>
                </button>
              )
            })}
          </div>
          )}
          <div
            ref={setHeaderSlot}
            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] empty:hidden"
          />
          {docked ? (
            // Docked panes carry no window controls — each tab closes
            // itself. The one exception: a maximized pane (Layout: Focus
            // Editor) needs a way back.
            isMaximized && (
              <button
                type="button"
                title="Restore"
                aria-label="Restore"
                onClick={() => activeHandle?.api.exitMaximized()}
                className="ml-auto flex size-7 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <Minimize2 className="size-3.5" />
              </button>
            )
          ) : (
            <div className="ml-auto flex shrink-0 items-center gap-0.5 pl-1">
              <button
                type="button"
                title={isMaximized ? 'Restore' : 'Maximize'}
                aria-label={isMaximized ? 'Restore' : 'Maximize'}
                onClick={() => (isMaximized ? activeHandle?.api.exitMaximized() : activeHandle?.api.maximize())}
                className="flex size-7 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                {isMaximized ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
              </button>
              <button
                type="button"
                title="Close"
                aria-label="Close"
                onClick={() => activeHandle?.api.close()}
                className="flex size-7 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-destructive/15 hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden bg-card">
        <WindowHeaderSlotContext.Provider value={group.hideHeader ? null : headerSlot}>
          <WindowTabsContext.Provider value={docked}>
            {ActiveContent && <ActiveContent params={activePanel.params} />}
          </WindowTabsContext.Provider>
        </WindowHeaderSlotContext.Provider>
      </div>

      {!isMaximized && !docked && (
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
