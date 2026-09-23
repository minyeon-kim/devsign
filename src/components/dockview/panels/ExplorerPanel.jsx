import { useState } from 'react'
import { Folder } from 'lucide-react'
import { cn } from 'cn'
import { getFileIconMeta } from '@/lib/fileIcons'
import { useWorkspace } from '@/state/WorkspaceProvider'

function ExplorerPanel() {
  const { workspaceFiles, activeFileId, setActiveFileId, getFileName, renameFile } = useWorkspace()
  const [renamingId, setRenamingId] = useState(null)
  const [draftName, setDraftName] = useState('')

  function startRename(file) {
    setRenamingId(file.id)
    setDraftName(getFileName(file.id))
  }

  function commitRename(fileId) {
    renameFile(fileId, draftName)
    setRenamingId(null)
  }

  return (
    <div className="flex h-full flex-col bg-card">
      {/* No in-panel "Explorer" header here — the dockview tab above
          already reads "Explorer", so repeating it would just be a
          redundant label and an extra hard-edged divider. */}
      <div className="flex-1 overflow-auto p-2.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 px-2 py-1.5 text-foreground/70">
          <Folder className="size-3.5" />
          src
        </div>
        {workspaceFiles.map((file) => {
          const name = getFileName(file.id)
          const { Icon, colorClass } = getFileIconMeta(name)
          const active = activeFileId === file.id
          const isRenaming = renamingId === file.id

          if (isRenaming) {
            return (
              <div key={file.id} className="flex w-full items-center gap-1.5 py-1 pr-2 pl-6">
                <Icon className={cn('size-3.5 shrink-0', colorClass)} />
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={() => commitRename(file.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(file.id)
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  className="w-full truncate rounded-sm bg-transparent px-1 text-xs text-foreground outline-none ring-1 ring-primary/50"
                />
              </div>
            )
          }

          return (
            <button
              key={file.id}
              type="button"
              onClick={() => setActiveFileId(file.id)}
              onDoubleClick={() => startRename(file)}
              title="Double-click to rename"
              className={cn(
                'flex w-full items-center gap-1.5 rounded-lg py-1.5 pr-2 pl-6 text-left transition-colors hover:bg-muted hover:text-foreground',
                active && 'bg-primary/10 text-primary'
              )}
            >
              <Icon className={cn('size-3.5 shrink-0', !active && colorClass)} />
              <span className="truncate">{name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default ExplorerPanel
