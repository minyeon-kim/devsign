import { cn } from 'cn'
import { Check } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { LocalizedText } from '@/i18n/runtime'
import { setViewer, viewerIdFor, viewerPersonas } from '@/data/mockData'

// UT-only: who you are — Taylor (designer), Alex or Jordan (developers) — on whatever project you're on. Picking one
// reloads the page as that person, so every screen of it starts over as them. Shared by the profile menu and the
// activity bar's user badge.
export default function SwitchUserItems() {
  const projectId = window.location.pathname.match(/projects\/([^/]+)/)?.[1] ?? null
  const current = viewerIdFor(projectId)
  return (
    <>
      <p className="px-2 pt-1 pb-0.5 text-[10.5px] font-medium tracking-wide text-muted-foreground uppercase">Switch user</p>
      {viewerPersonas.map(({ person }) => (
        <DropdownMenuItem
          key={person.id}
          data-switch-user={person.id}
          onClick={() => {
            if (person.id === current) return
            setViewer(person.id)
            window.location.reload()
          }}
        >
          <Avatar size="sm">
            <AvatarFallback className={cn('text-xs font-medium text-white', person.colorClass)}>
              {person.initials}
            </AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span>{person.name} · <LocalizedText text={person.role} /></span>
          </span>
          {person.id === current && <Check aria-hidden className="size-3.5 text-muted-foreground" />}
        </DropdownMenuItem>
      ))}
    </>
  )
}
