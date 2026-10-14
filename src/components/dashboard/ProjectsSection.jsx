import { useState } from 'react'
import { toast } from '@/i18n/toast'
import { ChevronDown, LayoutGrid, List, MoreHorizontal, Plus, Trash2, X } from 'lucide-react'
import { LocalizedText } from '@/i18n/runtime'
import { CAPSULE_CONTROL } from '@/components/layout/PagePieces'
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
import { conflictCounts } from '@/lib/conflicts'
import { recentProjectIds } from '@/lib/recentProjects'
import { useConflictStore } from '@/state/ConflictStore'

// The filter and the sort both work on the list shown. "Recently viewed"
// is the order you last opened projects in (lib/recentProjects); a project
// never opened keeps its place after the ones that were.
const typeOptions = ['All types', 'Has conflicts', 'No conflicts']
const sortOptions = ['Last modified', 'Recently viewed', 'Name', 'Most conflicts']
// (Filters, sort and grid / list only once there are enough projects to need them.)
const TOOLS_FROM = 6

function ProjectsSection() {
  const [view, setView] = useState('grid')
  const [projectList, setProjectList] = useState(() => [...seedProjects])
  const [createOpen, setCreateOpen] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [type, setType] = useState(typeOptions[0])
  const [sort, setSort] = useState(sortOptions[0])
  const [recent] = useState(recentProjectIds)
  const { conflicts } = useConflictStore()
  // Each project's counts, by the same rules as its Conflict list.
  const countsOf = (project) => conflictCounts(conflicts.filter((c) => c.projectId === project.id))
  const recentRank = (project) => { const i = recent.indexOf(project.id); return i < 0 ? Infinity : i }
  const shown = projectList
    .filter((p) => type === 'All types' || (countsOf(p).open > 0) === (type === 'Has conflicts'))
    .map((project, index) => ({ project, index }))
    .sort((a, b) => (
      sort === 'Name' ? a.project.name.localeCompare(b.project.name)
        : sort === 'Most conflicts' ? countsOf(b.project).open - countsOf(a.project).open
          : sort === 'Recently viewed' ? recentRank(a.project) - recentRank(b.project)
            : 0
    ) || a.index - b.index)
    .map(({ project }) => project)

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
        {/* (A plain title and how many — selecting is in the ⋯ menu, not behind the title.) */}
        <h1 className="flex items-baseline gap-1.5 text-[15px] font-semibold text-foreground">
          <LocalizedText text="Projects" />
          <span className="font-normal text-slate-500 tabular-nums">{projectList.length}</span>
        </h1>

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
          {projectList.length >= TOOLS_FROM && (<>
          <DropdownMenu>
            <DropdownMenuTrigger className={CAPSULE_CONTROL}>
              {type}
              <ChevronDown className="size-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {typeOptions.map((option) => (
                <DropdownMenuItem key={option} onClick={() => setType(option)}>{option}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger className={CAPSULE_CONTROL}>
              {sort}
              <ChevronDown className="size-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" data-sort-options>
              {sortOptions.map((option) => (
                <DropdownMenuItem key={option} onClick={() => setSort(option)}>{option}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex h-8 items-center gap-0.5 rounded-full bg-white/[0.06] p-0.5">
            <button
              type="button"
              aria-label="Grid view"
              aria-pressed={view === 'grid'}
              onClick={() => setView('grid')}
              className={cn(
                'flex size-7 items-center justify-center rounded-full',
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
                'flex size-7 items-center justify-center rounded-full',
                view === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground'
              )}
            >
              <List className="size-3.5" />
            </button>
          </div>
          </>)}

          <DropdownMenu>
            <DropdownMenuTrigger aria-label="More" title="More" className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={toggleSelectMode}><LocalizedText text="Select projects" /></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" className="gap-1 rounded-full" aria-description="Create a new project" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            New project
          </Button>
        </div>
        )}
      </div>

      <div
        className={cn(
          'mt-4 grid gap-4',
          view === 'grid' ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1 gap-2'
        )}
      >
        {shown.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            counts={countsOf(project)}
            view={view}
            selectable={selectMode}
            selected={selected.has(project.id)}
            onToggleSelect={toggleSelectOne}
          />
        ))}
      </div>

      {shown.length === 0 && <p className="py-10 text-center text-xs text-slate-500">No projects match this filter.</p>}

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
