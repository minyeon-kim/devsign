import { useState } from 'react'
import { AppWindow, FileCode, Files, Monitor, Plus, ScrollText, Sparkles, SquareTerminal } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { addDockPanel, panelById } from '@/components/dockview/DockLayout'
import { useWorkspace } from '@/state/WorkspaceProvider'

const VIEWS = [
  { def: panelById.editor, label: 'Code Editor', icon: FileCode },
  { def: panelById.canvas, label: 'Canvas', icon: AppWindow },
  { def: panelById.preview, label: 'Preview', icon: Monitor },
  { def: panelById.chat, label: 'AI Chat', icon: Sparkles },
  { def: panelById.terminal, label: 'Terminal', icon: SquareTerminal },
  { def: panelById.console, label: 'Console', icon: ScrollText },
  { def: panelById.navigator, label: 'Files', icon: Files },
]

// Opens `def` as a tab of window `group` — or brings it forward if it's
// already here. A view open elsewhere moves here (a panel lives in one
// window at a time).
function openHere(dockApi, group, def) {
  const existing = dockApi.getPanel(def.id)
  if (existing?.group?.id === group.id) {
    existing.api.setActive()
    return
  }
  existing?.api.close()
  addDockPanel(dockApi, def, { position: { referenceGroup: group.id } })
}

// The `+` right after a window's last tab (Cursor style): a small,
// non-blocking popover anchored under it listing the views to open here
// as a tab — Code Editor, Canvas, Preview, AI Chat, Terminal, Console,
// Files. The default tab bar has no Preview tab; this is where one is
// added as a pane tab. To give a view its own pane, drag its tab to a pane's edge.
function AddViewMenu({ group, dockApi }) {
  const { setFilesWindow } = useWorkspace()
  const [open, setOpen] = useState(false)

  function pick(def) {
    openHere(dockApi, group, def)
    if (def.id === panelById.navigator.id) setFilesWindow({ open: true })
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        title="Open a view"
        aria-label="Open a view"
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-white data-[popup-open]:bg-white/[0.08] data-[popup-open]:text-white"
      >
        <Plus className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-48 gap-0 rounded-xl p-1">
        {VIEWS.map(({ def, label, icon: Icon }) => {
          const here = group.panelIds.includes(def.id)
          return (
            <button
              key={def.id}
              type="button"
              onClick={() => pick(def)}
              className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <Icon className="size-4 shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {here && <span className="size-1.5 shrink-0 rounded-full bg-emerald-400" aria-label="Open here" />}
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}

export default AddViewMenu
