import { Columns2, LayoutGrid, Maximize, Rows2 } from 'lucide-react'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { layoutPresets } from '@/data/mockData'
import { addDockPanel, buildInitialLayout, panelById } from '@/components/dockview/DockLayout'

const presetIcons = { LayoutGrid, Maximize, Columns2, Rows2 }

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

// Layout icon in the top nav — opens a Mac-style window/grid picker popover
// so a preset arrangement of the dockview panels can be applied in one click.
function LayoutMenu({ dockApi }) {
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
