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
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold text-foreground">Your projects</h2>

        <div className="flex shrink-0 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground/80 transition-colors hover:bg-muted">
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

      <div className="mt-3 divide-y divide-border/60 overflow-hidden rounded-lg border border-border bg-card">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  )
}

export default ProjectsSection
