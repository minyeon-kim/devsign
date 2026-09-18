import { useEffect, useState } from 'react'
import {
  AppWindow,
  Braces,
  Component,
  FileCode,
  Folder,
  History,
  Layers,
  Minimize2,
  Maximize2,
  MessageSquare,
  Monitor,
  ScanEye,
  ScrollText,
  Sparkles,
  SquareTerminal,
  TriangleAlert,
  X,
} from 'lucide-react'
import { cn } from 'cn'

const icons = {
  Folder,
  Layers,
  Component,
  AppWindow,
  FileCode,
  Braces,
  Monitor,
  ScrollText,
  Sparkles,
  SquareTerminal,
  TriangleAlert,
  MessageSquare,
  History,
  ScanEye,
}

function CustomTab({ api, containerApi, params }) {
  const [isMaximized, setIsMaximized] = useState(api.isMaximized())

  useEffect(() => {
    const disposable = containerApi.onDidMaximizedGroupChange(() => {
      setIsMaximized(api.isMaximized())
    })
    return () => disposable.dispose()
  }, [api, containerApi])

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
    </div>
  )
}

export default CustomTab
