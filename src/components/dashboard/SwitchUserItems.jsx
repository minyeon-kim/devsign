import { useNavigate } from 'react-router-dom'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { LocalizedText } from '@/i18n/runtime'
import { projects, projectViewerOptions, setProjectViewer, viewerPersonas } from '@/data/mockData'

// UT-only: each persona has a fully scripted project — picking one takes you
// straight there instead of leaving you to find the right project for the
// role you're testing. Shared by the profile menu and the activity bar's
// user badge.
// (A project tested by more than one persona — Dashboard Redesign —
// remembers which one you are; a full reload so every screen of it starts
// over as that person.)
export default function SwitchUserItems() {
  const navigate = useNavigate()
  return (
    <>
      <p className="px-2 pt-1 pb-0.5 text-[10.5px] font-medium tracking-wide text-muted-foreground uppercase">Switch user</p>
      {viewerPersonas.map(({ projectId, person }) => (
        <DropdownMenuItem
          key={`${projectId}:${person.id}`}
          onClick={() => {
            if (projectViewerOptions[projectId]) {
              setProjectViewer(projectId, person.id)
              window.location.assign(`${import.meta.env.BASE_URL}projects/${projectId}/workspace`)
            } else navigate(`/projects/${projectId}`)
          }}
        >
          <Avatar size="sm">
            <AvatarFallback className={cn('text-xs font-medium text-white', person.colorClass)}>
              {person.initials}
            </AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-col leading-tight">
            <span>{person.name} · <LocalizedText text={person.role} /></span>
            <span className="truncate text-[11px] text-muted-foreground">{projects.find((project) => project.id === projectId)?.name}</span>
          </span>
        </DropdownMenuItem>
      ))}
    </>
  )
}
