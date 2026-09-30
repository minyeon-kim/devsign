import { WORKSPACE_TAB_RADIUS } from '@/components/mergestudio/floatingStyles'
import { orderedTabs } from '@/lib/tabOrder'
import { Component, FileImage, Files, Layers, X } from 'lucide-react'
import { cn } from 'cn'
import { getFileIconMeta } from '@/lib/fileIcons'
import { PANEL_ICONS } from '@/components/workspace/panelIcons'
import { useWorkspace } from '@/state/WorkspaceProvider'

const NAVIGATOR_TABS = [
  { id: 'files', label: 'Files', icon: Files },
  { id: 'layers', label: 'Layers', icon: Layers },
  { id: 'assets', label: 'Assets', icon: Component },
]

// One panel's tabs in a docked window's header — the real things open in
// it, not a view title: the editor's open files, the canvas's design
// pages, the navigator's Files / Layers / Assets, and any other view as
// its own single tab. A tab is active when its panel is the window's
// active one and it's that panel's current item. Pressing a tab selects it
// and starts a drag: within its own header it reorders that tab; dropping
// on another pane docks its panel there (see WorkspaceSplitLayout). The editor's last file tab
// and the canvas's active page tab close their view (reopen from `+`).
// Navigator tabs are permanent navigation choices without close controls.
function PanelTabs({ pid, panel, group, dockApi, onDragStart }) {
  const workspace = useWorkspace()
  const panelActive = group.activeId === pid
  const activate = () => dockApi.setActiveTab(group.id, pid)
  const closeView = () => dockApi.getPanel(pid)?.api.close()

  let items
  if (panel.component === 'editor') {
    items = workspace.openFileIds.map((fileId) => {
      const name = workspace.getFileName(fileId)
      const { Icon, colorClass } = getFileIconMeta(name)
      return {
        key: fileId,
        label: name,
        dirty: Boolean(workspace.draftChanges[fileId] || workspace.editorDirtyFiles[fileId]),
        icon: <Icon className={cn('size-3.5 shrink-0', colorClass)} />,
        active: panelActive && workspace.activeFileId === fileId,
        select: () => workspace.setActiveFileId(fileId),
        close: workspace.openFileIds.length > 1 ? () => workspace.closeFileTab(fileId) : closeView,
      }
    })
  } else if (panel.component === 'canvas') {
    items = workspace.projectPages.map((page) => {
      const active = panelActive && workspace.activePageId === page.id
      return {
        key: page.id,
        label: page.name,
        icon: <FileImage className={cn('size-3.5 shrink-0', active && 'text-emerald-300')} />,
        active,
        select: () => workspace.setActivePageId(page.id),
        close: workspace.activePageId === page.id ? closeView : null,
        closeLabel: 'Close Canvas',
      }
    })
  } else if (panel.component === 'navigator') {
    items = NAVIGATOR_TABS.map(({ id, label, icon: Icon }) => ({
      key: id,
      label,
      icon: <Icon className="size-3.5 shrink-0" />,
      active: panelActive && workspace.filesWindow.tab === id,
      select: () => workspace.setFilesWindow({ tab: id }),
      close: null,
    }))
  } else {
    const Icon = PANEL_ICONS[panel.params?.iconName]
    items = [
      {
        key: pid,
        label: panel.title,
        icon: Icon && <Icon className="size-3.5 shrink-0" />,
        active: panelActive,
        select: () => {},
        close: ['assets', 'layers', 'explorer'].includes(panel.component) ? null : closeView,
      },
    ]
  }

  items = orderedTabs(items, workspace.tabOrders?.[panel.component])
  const reorder = (source, target, after) => workspace.reorderWorkspaceTab(panel.component, source, target, after, items.map((item) => item.key))

  return items.map((item) => (
    <span
      key={item.key}
      data-tab-id={item.key}
      data-panel-id={pid}
      className={cn(
        'workspace-header-tab group/tab relative flex h-7 items-center text-xs transition-colors',
        WORKSPACE_TAB_RADIUS,
        panel.component === 'navigator' ? 'min-w-0 flex-1' : 'shrink-0',
        item.active ? 'bg-white/[0.09] text-white' : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
      )}
    >
      <button
        type="button"
        title={`${item.label} · Drag to reorder or move`}
        aria-label={item.label}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          event.stopPropagation()
          item.select()
          activate()
          onDragStart?.({ groupId: group.id, panelId: pid, tabId: item.key, reorder }, event)
        }}
        onKeyDown={(event) => {
          if (!event.altKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return
          const direction = event.key === 'ArrowRight' ? 1 : -1
          const target = items[items.indexOf(item) + direction]
          if (!target) return
          event.preventDefault()
          reorder(item.key, target.key, direction > 0)
        }}
        onClick={() => {
          item.select()
          activate()
        }}
        className={cn('flex h-full items-center', panel.component === 'navigator' ? 'min-w-0 w-full justify-center gap-1 px-1.5' : 'gap-1.5 px-2')}
      >
        {panel.component === 'navigator' ? <span className="shrink-0 @max-[340px]/nav:hidden">{item.icon}</span> : item.icon}
        <span className="max-w-[160px] truncate">{item.label}</span>
        {item.dirty && (
          <span
            className={cn(
              'ds-status-dot ml-1 shrink-0 rounded-full bg-[#5EEAB5] transition-opacity duration-150',
              item.close && 'group-hover/tab:opacity-0'
            )}
            role="img"
            aria-label="Uncommitted or unsaved changes"
          />
        )}
      </button>
      {item.close && (
        <>
          {/* Fades in on hover and fades the tab's own background over the trailing label/dot so the close button reads as covering the tab's content, not floating beside it. */}
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r-[var(--ds-radius-workspace-tab)] opacity-0 transition-opacity duration-150 group-hover/tab:opacity-100 group-focus-within/tab:opacity-100 motion-reduce:transition-none',
              item.active
                ? 'bg-[linear-gradient(to_left,color-mix(in_srgb,var(--card),white_9%)_30%,transparent)]'
                : 'bg-[linear-gradient(to_left,color-mix(in_srgb,var(--card),white_5%)_30%,transparent)]'
            )}
          />
          <button
            type="button"
            aria-label={item.closeLabel ?? `Close ${item.label}`}
            title={item.closeLabel ?? 'Close'}
            onClick={item.close}
            className={cn(
              'workspace-tab-close absolute top-1/2 right-1.5 -translate-y-1/2 flex size-4 shrink-0 items-center justify-center rounded-full p-0.5 text-slate-500 transition-opacity duration-150 motion-reduce:transition-none hover:bg-white/10 hover:text-white',
              'pointer-events-none opacity-0 group-hover/tab:pointer-events-auto group-hover/tab:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100'
            )}
          >
            <X className="size-3" />
          </button>
        </>
      )}
    </span>
  ))
}

export default PanelTabs
