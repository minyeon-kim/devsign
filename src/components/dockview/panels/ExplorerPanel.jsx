import { Folder } from 'lucide-react'
import { cn } from 'cn'
import { openFiles } from '@/data/mockData'
import { getFileIconMeta } from '@/lib/fileIcons'
import { useWorkspace } from '@/state/WorkspaceProvider'

function ExplorerPanel() {
  const { activeFileId, setActiveFileId } = useWorkspace()

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b px-3 text-xs font-medium">
        <Folder className="size-3.5 text-muted-foreground" />
        Explorer
      </div>
      <div className="flex-1 overflow-auto p-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 px-2 py-1 text-foreground/70">
          <Folder className="size-3.5" />
          src
        </div>
        {openFiles.map((file) => {
          const { Icon, colorClass } = getFileIconMeta(file.name)
          const active = activeFileId === file.id
          return (
            <button
              key={file.id}
              type="button"
              onClick={() => setActiveFileId(file.id)}
              className={cn(
                'flex w-full items-center gap-1.5 rounded-md py-1 pr-2 pl-6 text-left hover:bg-muted hover:text-foreground',
                active && 'bg-primary/10 text-primary'
              )}
            >
              <Icon className={cn('size-3.5 shrink-0', !active && colorClass)} />
              <span className="truncate">{file.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default ExplorerPanel
