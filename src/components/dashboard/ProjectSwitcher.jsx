import { useLocation, useNavigate } from 'react-router-dom'
import { Check, House } from 'lucide-react'
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
// button (at the top of the activity bar): every project (the current one
// checked), then Home — the hub with every project. Inside a project the
// rail's Home icon goes to the project's overview, so the global Home is
// reached from here. `children` is the trigger subtree — it must contain a
// DropdownMenuTrigger (the Projects button, wrapped in its tooltip).
// Switching projects keeps you on the same view (overview, Workspace or
// Archive) you were on; from a global page it opens the project's overview.
function ProjectSwitcher({ children, currentProjectId }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // The project view you're on (overview, Workspace or Archive), kept when
  // switching to another project; from a global page, its overview.
  const tab = pathname.endsWith('/archive') ? '/archive' : pathname.endsWith('/workspace') ? '/workspace' : ''

  return (
    <DropdownMenu>
      {children}
      <DropdownMenuContent side="bottom" align="start" sideOffset={6} className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Switch project</DropdownMenuLabel>
          {projects.map((p) => (
            <DropdownMenuItem
              key={p.id}
              // Re-picking the project you're in takes you to its overview;
              // another project opens on the same view.
              onClick={() => navigate(`/projects/${p.id}${p.id === currentProjectId ? '' : tab}`)}
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
        <DropdownMenuItem onClick={() => navigate('/dashboard')} className="gap-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <House className="size-3.5" />
          </span>
          Home · All projects
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ProjectSwitcher
