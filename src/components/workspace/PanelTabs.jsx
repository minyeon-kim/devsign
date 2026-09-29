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
// and starts a drag (drop on a pane's edge to split, its middle to move
// it there — see WorkspaceSplitLayout); dragging a file or page tab moves
// its whole panel (the editor, the canvas). The editor's last file tab
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
        icon: <FileImage className={cn('size-3.5 shrink-0', active && 'text-primary')} />,
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
        close: closeView,
      },
    ]
  }

  return items.map((item) => (
    <span
      key={item.key}
      className={cn(
        'group/tab flex h-7 items-center rounded-full text-xs transition-colors',
        panel.component === 'navigator' ? 'min-w-0 flex-1' : 'shrink-0',
        item.active ? 'bg-white/[0.09] text-white' : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
      )}
    >
      <button
        type="button"
        title={`${item.label} · Drag to split or move`}
        aria-label={item.label}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          item.select()
          activate()
          onDragStart?.({ groupId: group.id, panelId: pid }, event)
        }}
        onClick={() => {
          item.select()
          activate()
        }}
        className={cn('flex h-full items-center', panel.component === 'navigator' ? 'min-w-0 w-full justify-center gap-1 px-2' : ['gap-1.5 pl-3', item.close ? 'pr-1.5' : 'pr-3'])}
      >
        {panel.component === 'navigator' ? <span className="shrink-0 @max-[260px]/nav:hidden">{item.icon}</span> : item.icon}
        <span className="max-w-[160px] truncate">{item.label}</span>
      </button>
      {item.close && (
        <button
          type="button"
          aria-label={item.closeLabel ?? `Close ${item.label}`}
          title={item.closeLabel ?? 'Close'}
          onClick={item.close}
          className={cn(
            'mr-1.5 flex size-4 items-center justify-center rounded-full text-slate-500 transition-opacity hover:bg-white/10 hover:text-white',
            item.active ? 'opacity-100' : 'opacity-0 group-hover/tab:opacity-100 focus-visible:opacity-100'
          )}
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  ))
}

export default PanelTabs
