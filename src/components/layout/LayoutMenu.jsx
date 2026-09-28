import { useEffect, useState } from 'react'
import { Check, Columns2, Folder, Layers, LayoutGrid, Maximize, Rows2 } from 'lucide-react'
import { cn } from 'cn'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { layoutPresets } from '@/data/mockData'
import { addDockPanel, buildInitialLayout, panelById, toggleSidebarPanel } from '@/components/dockview/DockLayout'

const presetIcons = { LayoutGrid, Maximize, Columns2, Rows2 }

// The floating windows that used to have their own always-on toolbar
// pill over the canvas — now shown/hidden from here instead.
const TOGGLEABLE_PANELS = [
  { def: panelById.explorer, icon: Folder },
  { def: panelById.layers, icon: Layers },
]

// Which of TOGGLEABLE_PANELS currently exist in the layout — "is it
// open", not "is it focused".
function useOpenPanelIds(dockApi) {
  const [openIds, setOpenIds] = useState(() => new Set())

  useEffect(() => {
    if (!dockApi) return
    const sync = () =>
      setOpenIds(new Set(TOGGLEABLE_PANELS.map(({ def }) => def.id).filter((id) => !!dockApi.getPanel(id))))
    sync()
    const disposable = dockApi.onDidLayoutChange(sync)
    return () => disposable.dispose()
  }, [dockApi])

  return openIds
}

function applyLayoutPreset(dockApi, presetId) {
  if (!dockApi) return
  const editor = dockApi.getPanel(panelById.editor.id)

  switch (presetId) {
    case 'default': {
      dockApi.panels.forEach((panel) => panel.api.close())
      buildInitialLayout(dockApi)
      break
    }
    case 'focus-editor': {
      editor?.api.setActive()
      editor?.api.maximize()
      break
    }
    case 'split-preview': {
      if (editor?.api.isMaximized?.()) editor.api.exitMaximized()
      const preview = dockApi.getPanel(panelById.preview.id)
      if (preview) {
        preview.api.setActive()
      } else if (editor) {
        addDockPanel(dockApi, panelById.preview, {
          position: { direction: 'right', referencePanel: editor.id },
          initialWidth: 380,
        })
      }
      break
    }
    case 'stacked-terminal': {
      if (editor?.api.isMaximized?.()) editor.api.exitMaximized()
      dockApi.getPanel(panelById.terminal.id)?.api.setActive()
      break
    }
    default:
      break
  }
}

// Layout icon in the top nav — a contextual pop-up with show/hide toggles
// for the Explorer/Layers windows, plus a Mac-style window/grid picker so
// a preset arrangement of the panels can be applied in one click.
function LayoutMenu({ dockApi }) {
  const openIds = useOpenPanelIds(dockApi)

  return (
    <Popover>
      <PopoverTrigger
        title="Layout"
        className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <LayoutGrid className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="w-64 gap-1 rounded-2xl p-2">
        <p className="px-1 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Panels
        </p>
        <div className="mb-2 flex flex-col gap-0.5">
          {TOGGLEABLE_PANELS.map(({ def, icon: Icon }) => {
            const isOpen = openIds.has(def.id)
            return (
              <button
                key={def.id}
                type="button"
                onClick={() => toggleSidebarPanel(dockApi, def)}
                aria-pressed={isOpen}
                className={cn(
                  'flex h-8 items-center gap-2.5 rounded-lg px-2 text-left text-xs font-medium transition-colors hover:bg-muted',
                  isOpen ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                <span className="flex-1">{def.title}</span>
                {isOpen && <Check className="size-3.5 text-primary" />}
              </button>
            )
          })}
        </div>

        <p className="px-1 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Window Layout
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {layoutPresets.map((preset) => {
            const Icon = presetIcons[preset.iconName]
            return (
              <PopoverClose
                key={preset.id}
                type="button"
                onClick={() => applyLayoutPreset(dockApi, preset.id)}
                className="flex flex-col items-start gap-1 rounded-xl border border-transparent p-2 text-left transition-colors hover:border-border hover:bg-muted"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-muted text-foreground/80">
                  {Icon && <Icon className="size-4" />}
                </span>
                <span className="text-xs font-medium text-foreground">{preset.label}</span>
                <span className="text-[10px] leading-tight text-muted-foreground">
                  {preset.description}
                </span>
              </PopoverClose>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default LayoutMenu
