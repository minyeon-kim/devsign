import { useLocation, useNavigate } from 'react-router-dom'
import { Check, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { projects } from '@/data/mockData'

// The current project's title as a Slack-style selector — just the name
// and a small chevron, no icon tile — sitting in the drawer's header. Switching projects keeps you on the same
// tab (Workspace or Archive) you were on, just for the other project.
function ProjectSwitcher({ project }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const tab = pathname.endsWith('/archive') ? 'archive' : 'workspace'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Switch project (current: ${project.name})`}
            className="flex h-9 min-w-0 items-center gap-1.5 rounded-lg px-2.5 text-left transition-colors hover:bg-muted data-[popup-open]:bg-muted"
          >
            <span className="min-w-0 truncate text-[14px] font-semibold text-foreground">{project.name}</span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        }
      />
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Switch project</DropdownMenuLabel>
          {projects.map((p) => (
            <DropdownMenuItem key={p.id} onClick={() => navigate(`/projects/${p.id}/${tab}`)}>
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {p.id === project.id && <Check className="size-3.5 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ProjectSwitcher
