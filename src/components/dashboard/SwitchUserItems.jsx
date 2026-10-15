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
      <p className="px-2.5 pt-1.5 pb-1 text-[11.5px] text-slate-400">Switch user</p>
      {viewerPersonas.map(({ person }) => (
        <DropdownMenuItem
          key={person.id}
          data-switch-user={person.id}
          className={cn('gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-white', person.id === current && 'bg-white/[0.06]')}
          onClick={() => {
            if (person.id === current) return
            setViewer(person.id)
            window.location.reload()
          }}
        >
          <Avatar size="sm">
            <AvatarFallback className={cn('text-[10px] font-medium text-white', person.colorClass)}>
              {person.initials}
            </AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate leading-5 font-medium">{person.name}</span>
            <span className="truncate text-[11.5px] leading-4 text-slate-400"><LocalizedText text={person.role} /></span>
          </span>
          <Check aria-hidden className={cn('size-4 shrink-0 text-white', person.id !== current && 'invisible')} />
        </DropdownMenuItem>
      ))}
    </>
  )
}
