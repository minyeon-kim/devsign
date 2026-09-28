import { useLocation, useNavigate } from 'react-router-dom'
import { Check, LayoutGrid } from 'lucide-react'
import { cn } from 'cn'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { projects } from '@/data/mockData'
import { projectTone } from '@/lib/projectTone'

// Slack's workspace switcher, opened from the activity bar's Projects
// button (directly under the logo): every project (the current one
// checked), then "All projects" for the full projects page. Getting to
// the dashboard stays the Home icon's job. `children` is the trigger
// subtree — it must contain a DropdownMenuTrigger (the Projects button,
// wrapped in its tooltip). Switching projects keeps you on the same tab
// (Workspace or Archive) you were on; from a global page it opens the
// project's Workspace.
function ProjectSwitcher({ children, currentProjectId }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const tab = pathname.endsWith('/archive') ? 'archive' : 'workspace'

  return (
    <DropdownMenu>
      {children}
      <DropdownMenuContent side="bottom" align="start" sideOffset={6} className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Switch project</DropdownMenuLabel>
          {projects.map((p) => (
            <DropdownMenuItem
              key={p.id}
              // Re-picking the project you're in takes you to its default
              // view (Workspace); another project opens on the same tab.
              onClick={() => navigate(`/projects/${p.id}/${p.id === currentProjectId ? 'workspace' : tab}`)}
              className="gap-2.5"
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold text-white',
                  projectTone(p.id)
                )}
              >
                {p.name.charAt(0)}
              </span>
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {p.id === currentProjectId && <Check className="size-3.5 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/projects')} className="gap-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <LayoutGrid className="size-3.5" />
          </span>
          All projects
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ProjectSwitcher
