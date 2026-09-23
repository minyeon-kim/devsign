import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Folder } from 'lucide-react'
import { cn } from 'cn'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getFileIconMeta } from '@/lib/fileIcons'
import { projects } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'

// Slack-style quick switcher — jump to another project's workspace
// without going back through the /projects grid. Projects other than
// the current one navigate straight to their workspace, which remounts
// WorkspaceProvider (see WorkspacePage's `key={projectId}`) and swaps in
// that project's file set immediately.
function ProjectSwitcher({ currentProjectId }) {
  const navigate = useNavigate()
  const currentProject = projects.find((p) => p.id === currentProjectId)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center justify-between gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted">
        <span className="truncate">{currentProject?.name ?? 'Select project'}</span>
        <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Projects</DropdownMenuLabel>
          {projects.map((project) => {
            const isActive = project.id === currentProjectId
            return (
              <DropdownMenuItem
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}/workspace`)}
              >
                <span
                  className={cn(
                    'mr-2 size-1.5 shrink-0 rounded-full',
                    isActive ? 'bg-primary' : 'border border-muted-foreground/50'
                  )}
                />
                <span className={cn('truncate', isActive && 'font-medium text-foreground')}>
                  {project.name}
                </span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ExplorerPanel() {
  const { projectId, workspaceFiles, activeFileId, setActiveFileId, getFileName, renameFile } =
    useWorkspace()
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
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b px-3 text-xs font-medium">
        <Folder className="size-3.5 text-muted-foreground" />
        Explorer
      </div>
      {projects.length > 1 && (
        <div className="shrink-0 border-b px-2 py-2">
          <ProjectSwitcher currentProjectId={projectId} />
        </div>
      )}
      <div className="flex-1 overflow-auto p-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 px-2 py-1 text-foreground/70">
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
                'flex w-full items-center gap-1.5 rounded-md py-1 pr-2 pl-6 text-left hover:bg-muted hover:text-foreground',
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
