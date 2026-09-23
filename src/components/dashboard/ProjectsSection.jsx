import { ChevronDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import ProjectCard from '@/components/projects/ProjectCard'
import { projects } from '@/data/mockData'

// Sort order is visual-only — the dropdown items don't actually resort
// `projects` (per the dashboard brief: "interactions only need to be
// visual").
const sortOptions = ['Recent activity', 'Name', 'Most conflicts']

function ProjectsSection() {
  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Your projects</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pick a project to open its workspace.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-muted">
              Recent activity
              <ChevronDown className="size-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {sortOptions.map((option) => (
                <DropdownMenuItem key={option}>{option}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" className="gap-1">
            <Plus className="size-3.5" />
            New project
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  )
}

export default ProjectsSection
