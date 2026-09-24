import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { projects, teamMembers } from '@/data/mockData'

// What each teammate is currently working on: the most recently updated
// project they own, falling back to the most recently updated project
// they're a member of. Computed rather than hand-authored so it can't
// drift from the `projects` list.
function currentProjectFor(memberId) {
  const owned = projects.filter((p) => p.ownerId === memberId)
  if (owned.length > 0) return owned[0]
  return projects.find((p) => p.memberIds.includes(memberId))
}

function TeamMembers() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Members</h3>
        <button
          type="button"
          className="rounded-full border border-border px-3 py-1 text-[11px] font-medium text-foreground/70 transition-colors hover:bg-muted"
        >
          See more
        </button>
      </div>

      <ul className="mt-2 flex flex-col">
        {teamMembers.map((member) => {
          const project = currentProjectFor(member.id)
          return (
            <li
              key={member.id}
              className="flex items-center gap-3 border-b border-border/60 py-2.5 last:border-b-0"
            >
              <Avatar size="sm">
                <AvatarFallback className={cn('text-[10px] font-medium text-white', member.colorClass)}>
                  {member.initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground/90">{member.name}</p>
                <p className="text-[11px] text-muted-foreground">{member.role}</p>
              </div>
              {project && (
                <>
                  <span className="h-5 w-px shrink-0 bg-border" />
                  <span className="shrink-0 text-[11px] whitespace-nowrap text-muted-foreground">
                    Working on {project.name}
                  </span>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default TeamMembers
