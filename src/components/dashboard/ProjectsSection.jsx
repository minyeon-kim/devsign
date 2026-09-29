import { useState } from 'react'
import { toast } from '@/i18n/toast'
import { ChevronDown, Folder, LayoutGrid, List, Plus, Trash2, X } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import ProjectCard from '@/components/projects/ProjectCard'
import CreateProjectModal from '@/components/modals/CreateProjectModal'
import { projects as seedProjects } from '@/data/mockData'

// Sort/filter dropdowns are visual-only — they don't actually reorder or
// filter `projects` (per the dashboard brief: "interactions only need to
// be visual"). The grid/list toggle is real, since it's a one-line
// layout swap rather than a stubbed data operation.
const typeOptions = ['All types', 'Has conflicts', 'No conflicts']
const sortOptions = ['Last modified', 'Name', 'Most conflicts']

function ProjectsSection() {
  const [view, setView] = useState('grid')
  const [projectList, setProjectList] = useState(() => [...seedProjects])
  const [createOpen, setCreateOpen] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(() => new Set())

  function handleCreate(project) {
    // Keep the shared mockData array in sync too, so navigating straight
    // into the new project's workspace (which reads `projects` on its own)
    // still resolves it.
    seedProjects.push(project)
    setProjectList((prev) => [...prev, project])
    toast('Project created', { description: project.name })
  }

  function toggleSelectMode() {
    setSelectMode((prev) => !prev)
    setSelected(new Set())
  }

  function toggleSelectOne(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === projectList.length ? new Set() : new Set(projectList.map((p) => p.id))))
  }

  function handleDeleteSelected() {
    const removedNames = projectList.filter((p) => selected.has(p.id)).map((p) => p.name)
    setProjectList((prev) => prev.filter((p) => !selected.has(p.id)))

    // Keep the shared mockData array in sync (same reasoning as handleCreate).
    const kept = seedProjects.filter((p) => !selected.has(p.id))
    seedProjects.length = 0
    seedProjects.push(...kept)

    toast(`Deleted ${removedNames.length} project${removedNames.length === 1 ? '' : 's'}`, {
      description: removedNames.join(', '),
    })
    setSelected(new Set())
    setSelectMode(false)
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={toggleSelectMode}
          aria-pressed={selectMode}
          className="flex items-center gap-2 rounded-md py-1 pr-2 pl-1 transition-colors hover:bg-muted"
        >
          <Folder className="size-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">Projects</h1>
          <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', selectMode && 'rotate-180')} />
        </button>

        {selectMode ? (
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {selected.size > 0 ? `${selected.size} selected` : 'Select projects'}
            </span>
            <Button variant="outline" size="sm" onClick={toggleSelectAll}>
              {selected.size === projectList.length ? 'Deselect all' : 'Select all'}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              disabled={selected.size === 0}
              onClick={handleDeleteSelected}
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
            <Button variant="ghost" size="icon-sm" title="Cancel" onClick={toggleSelectMode}>
              <X className="size-3.5" />
            </Button>
          </div>
        ) : (
        <div className="flex shrink-0 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-muted">
              All types
              <ChevronDown className="size-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {typeOptions.map((option) => (
                <DropdownMenuItem key={option}>{option}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-muted">
              Last modified
              <ChevronDown className="size-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {sortOptions.map((option) => (
                <DropdownMenuItem key={option}>{option}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
            <button
              type="button"
              aria-label="Grid view"
              aria-pressed={view === 'grid'}
              onClick={() => setView('grid')}
              className={cn(
                'flex size-6 items-center justify-center rounded',
                view === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground'
              )}
            >
              <LayoutGrid className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="List view"
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
              className={cn(
                'flex size-6 items-center justify-center rounded',
                view === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground'
              )}
            >
              <List className="size-3.5" />
            </button>
          </div>

          <Button size="sm" className="gap-1" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            New project
          </Button>
        </div>
        )}
      </div>

      <div
        className={cn(
          'mt-6 grid gap-6',
          view === 'grid' ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1 gap-2'
        )}
      >
        {projectList.map((project, index) => (
          <ProjectCard
            key={project.id}
            project={project}
            index={index}
            view={view}
            selectable={selectMode}
            selected={selected.has(project.id)}
            onToggleSelect={toggleSelectOne}
          />
        ))}
      </div>

      <CreateProjectModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
        existingNames={projectList.map((p) => p.name)}
      />
    </section>
  )
}

export default ProjectsSection
