import { useState } from 'react'
import { ChevronDown, Folder, LayoutGrid, List, Plus } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import ProjectCard from '@/components/projects/ProjectCard'
import { projects } from '@/data/mockData'

// Sort/filter dropdowns are visual-only — they don't actually reorder or
// filter `projects` (per the dashboard brief: "interactions only need to
// be visual"). The grid/list toggle is real, since it's a one-line
// layout swap rather than a stubbed data operation.
const typeOptions = ['All types', 'Has conflicts', 'No conflicts']
const sortOptions = ['Last modified', 'Name', 'Most conflicts']

function ProjectsSection() {
  const [view, setView] = useState('grid')

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Folder className="size-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">All projects</h1>
          <ChevronDown className="size-4 text-muted-foreground" />
        </div>

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

          <Button size="sm" className="gap-1">
            <Plus className="size-3.5" />
            New project
          </Button>
        </div>
      </div>

      <div
        className={cn(
          'mt-4 grid gap-4',
          view === 'grid' ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1 gap-2'
        )}
      >
        {projects.map((project, index) => (
          <ProjectCard key={project.id} project={project} index={index} view={view} />
        ))}
      </div>
    </section>
  )
}

export default ProjectsSection
