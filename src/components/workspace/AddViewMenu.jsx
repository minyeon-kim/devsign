import { useState } from 'react'
import {
  AppWindow,
  Columns2,
  Component,
  FileCode,
  Files,
  Layers,
  Monitor,
  Plus,
  Rows2,
  ScrollText,
  Sparkles,
  SquarePlus,
  SquareTerminal,
} from 'lucide-react'
import { cn } from 'cn'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { addDockPanel, panelById } from '@/components/dockview/DockLayout'
import { useWorkspace } from '@/state/WorkspaceProvider'

const MODES = [
  { id: 'tab', label: 'Tab', icon: SquarePlus },
  { id: 'right', label: 'Split right', icon: Columns2 },
  { id: 'below', label: 'Split down', icon: Rows2 },
]

// Views that open as windows, and the navigator's (Files / Layers /
// Assets), which open its pane at the left instead.
const WINDOW_VIEWS = [
  { def: panelById.editor, label: 'Code Editor', icon: FileCode },
  { def: panelById.canvas, label: 'Canvas', icon: AppWindow },
  { def: panelById.preview, label: 'Browser', icon: Monitor },
  { def: panelById.chat, label: 'AI Chat', icon: Sparkles },
  { def: panelById.terminal, label: 'Terminal', icon: SquareTerminal },
  { def: panelById.console, label: 'Console', icon: ScrollText },
]
const NAVIGATOR_VIEWS = [
  { tab: 'files', label: 'Files', icon: Files },
  { tab: 'layers', label: 'Layers', icon: Layers },
  { tab: 'assets', label: 'Assets', icon: Component },
]

// Opens `def` relative to window `group`: as a tab of it, or as a new
// pane split off to its right / below it. A view already open elsewhere
// moves here (a panel lives in one window at a time).
function openView(dockApi, group, def, mode) {
  const existing = dockApi.getPanel(def.id)
  if (existing && existing.group?.id === group.id) {
    // Already here: a tab just comes forward; splitting it off only makes
    // sense when the window has other tabs to leave behind.
    if (mode === 'tab' || group.panelIds.length < 2) {
      existing.api.setActive()
      return
    }
  }
  existing?.api.close()
  if (mode === 'tab') {
    addDockPanel(dockApi, def, { position: { referenceGroup: group.id } })
  } else {
    const reference = group.panelIds.find((id) => id !== def.id) ?? group.activeId
    addDockPanel(dockApi, def, { position: { direction: mode, referencePanel: reference } })
  }
}

// The `+` in a window's header (Cursor style): open another view — Code
// Editor, Canvas, Browser, AI Chat, Terminal, … — here as a tab, or split
// this pane to the right or downward for it.
function AddViewMenu({ group, dockApi }) {
  const { setFilesWindow } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('tab')

  function pick(run) {
    run()
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        title="Open a view"
        aria-label="Open a view"
        className="flex size-7 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-white data-[popup-open]:bg-white/[0.06] data-[popup-open]:text-white"
      >
        <Plus className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-60 gap-1 rounded-2xl p-1.5">
        <div className="mb-1 flex items-center rounded-full bg-white/[0.04] p-0.5" role="radiogroup" aria-label="Open as">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={mode === id}
              title={label}
              onClick={() => setMode(id)}
              className={cn(
                'flex h-7 flex-1 items-center justify-center gap-1 rounded-full text-[11px] font-medium transition-colors',
                mode === id ? 'bg-white/[0.1] text-white' : 'text-slate-500 hover:text-slate-200'
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        {WINDOW_VIEWS.map(({ def, label, icon: Icon }) => (
          <button
            key={def.id}
            type="button"
            onClick={() => pick(() => openView(dockApi, group, def, mode))}
            className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <Icon className="size-4 shrink-0 text-slate-400" />
            {label}
          </button>
        ))}
        <p className="mt-1 px-2.5 pt-1 pb-0.5 text-[10.5px] font-semibold tracking-wide text-slate-500 uppercase">Navigator</p>
        {NAVIGATOR_VIEWS.map(({ tab, label, icon: Icon }) => (
          <button
            key={tab}
            type="button"
            onClick={() => pick(() => setFilesWindow({ open: true, tab }))}
            className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <Icon className="size-4 shrink-0 text-slate-400" />
            {label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

export default AddViewMenu
