import { useLocation, useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { cn } from 'cn'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { projects } from '@/data/mockData'
import { projectTone } from '@/lib/projectTone'

// Slack's workspace switcher, opened from the brand logo at the very top
// of the activity bar: every project (the current one checked) — and
// nothing else. Getting to the dashboard or the full project list is the
// Home / Projects icons' job, so the two never overlap. `children` is the trigger subtree — it
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
          {projects.map((p) => (
            <DropdownMenuItem key={p.id} onClick={() => navigate(`/projects/${p.id}/${tab}`)} className="gap-2.5">
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ProjectSwitcher
