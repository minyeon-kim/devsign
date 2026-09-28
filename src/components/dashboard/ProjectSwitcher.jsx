import { useLocation, useNavigate } from 'react-router-dom'
import { Check, FolderKanban, House } from 'lucide-react'
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

const PROJECT_TONES = ['bg-indigo-500', 'bg-rose-500', 'bg-emerald-500', 'bg-sky-500', 'bg-amber-500']

// Slack's workspace switcher, opened from the brand logo at the very top
// of the activity bar: every project (the current one checked), then the
// ways out to the global views. `children` is the trigger subtree — it
// must contain a DropdownMenuTrigger (the logo button, wrapped in its
// tooltip). Switching projects keeps you on the same tab
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
          {projects.map((p, index) => (
            <DropdownMenuItem key={p.id} onClick={() => navigate(`/projects/${p.id}/${tab}`)} className="gap-2.5">
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold text-white',
                  PROJECT_TONES[index % PROJECT_TONES.length]
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
          <FolderKanban className="size-3.5" />
          All projects
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/dashboard')} className="gap-2.5">
          <House className="size-3.5" />
          Home
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ProjectSwitcher
