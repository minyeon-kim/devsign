import { useEffect, useState } from 'react'
import {
  AppWindow,
  Braces,
  FileCode,
  Folder,
  History,
  Layers,
  Minimize2,
  Maximize2,
  MessageSquare,
  Monitor,
  Sparkles,
  SquareTerminal,
  TriangleAlert,
  X,
} from 'lucide-react'
import { cn } from 'cn'

const icons = {
  Folder,
  Layers,
  AppWindow,
  FileCode,
  Braces,
  Monitor,
  Sparkles,
  SquareTerminal,
  TriangleAlert,
  MessageSquare,
  History,
}

// Explorer/Layers are structural sidebar panels, not ad-hoc content tabs —
// like a real IDE's sidebar, they aren't meant to be maximized or closed
// from the tab itself, so they skip the action buttons every other panel
// (Editor, Terminal, Preview, Conflict, ...) still gets.
const STATIC_PANEL_IDS = ['explorer', 'layers']

function CustomTab({ api, containerApi, params }) {
  const [isMaximized, setIsMaximized] = useState(api.isMaximized())
  const showActions = !STATIC_PANEL_IDS.includes(api.id)

  useEffect(() => {
    if (!showActions) return
    const disposable = containerApi.onDidMaximizedGroupChange(() => {
      setIsMaximized(api.isMaximized())
    })
    return () => disposable.dispose()
  }, [api, containerApi, showActions])

  const Icon = icons[params?.iconName]

  function toggleMaximize(event) {
    event.stopPropagation()
    if (api.isMaximized()) {
      api.exitMaximized()
    } else {
      api.maximize()
    }
  }

  function close(event) {
    event.stopPropagation()
    api.close()
  }

  return (
    <div className="flex h-full items-center gap-1.5 px-2.5 text-xs">
      {Icon && <Icon className="size-3.5 shrink-0 text-muted-foreground" />}
      <span className="truncate">{api.title}</span>
      {showActions && (
        <div className="ml-1 flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={toggleMaximize}
            className={cn(
              'flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {isMaximized ? (
              <Minimize2 className="size-3" />
            ) : (
              <Maximize2 className="size-3" />
            )}
          </button>
          <button
            type="button"
            onClick={close}
            className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
          >
            <X className="size-3" />
          </button>
        </div>
      )}
    </div>
  )
}

export default CustomTab
