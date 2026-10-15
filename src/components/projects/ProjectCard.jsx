import { useNavigate } from 'react-router-dom'
import { Check, FolderKanban } from 'lucide-react'
import { cn } from 'cn'
import { PAGE_PANEL } from '@/components/layout/PagePieces'
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from '@/components/ui/avatar'
import { allPeople } from '@/data/mockData'
import { prefetchProject } from '@/lib/projectPages'
import { projectTone } from '@/lib/projectTone'

const MAX_VISIBLE_AVATARS = 3

function SelectIndicator({ selected }) {
  return (
    <span
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
        selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background/80 text-transparent'
      )}
    >
      <Check className="size-3" strokeWidth={3} />
    </span>
  )
}

// A project, as a card: its mark, who's on it, its name and when it was last
// edited. The whole card opens the project. (`counts` is no longer drawn —
// what's waiting on you is Home's list.) Hovering (or focusing) the card loads
// the project's pages ahead of the click, so it opens at once.
// `selectable` (toggled from "Projects" in ProjectsSection) switches a
// click from opening the project to toggling its selection instead.
function ProjectCard({ project, view = 'grid', counts: _counts, selectable = false, selected = false, onToggleSelect }) {
  const navigate = useNavigate()
  const tone = projectTone(project.id)
  const members = project.memberIds
    .map((id) => allPeople.find((p) => p.id === id))
    .filter(Boolean)
  const visibleMembers = members.slice(0, MAX_VISIBLE_AVATARS)
  const overflowCount = members.length - visibleMembers.length

  function handleActivate() {
    if (selectable) onToggleSelect(project.id)
    else navigate(`/projects/${project.id}`)
  }
  // The card's click target covers the whole card (`after:inset-0` on the
  // card's box); the badges sit above it.
  const cover = 'cursor-pointer text-left after:absolute after:inset-0 after:content-[\'\'] focus-visible:outline-none'
  const prefetch = { onPointerEnter: prefetchProject, onFocus: prefetchProject }

  if (view === 'list') {
    return (
      <div
        data-project-card={project.id}
        {...prefetch}
        className={cn(
          'relative flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:bg-muted/50 focus-within:ring-1 focus-within:ring-emerald-300/50',
          selected && 'border-primary bg-primary/5'
        )}
      >
        {selectable && <SelectIndicator selected={selected} />}
        <span className={cn('flex size-6 shrink-0 items-center justify-center rounded', tone)}>
          <FolderKanban className="size-3.5 text-white" />
        </span>
        <button type="button" onClick={handleActivate} className={cn(cover, 'min-w-0 flex-1 truncate text-sm font-medium text-foreground')}>
          {project.name}
        </button>
        <span className="shrink-0 text-[11px] text-muted-foreground">{`Edited ${project.updatedAtLabel}`}</span>
      </div>
    )
  }

  // The card: the project's mark (as the rail shows it) and who's on it, then its name and when it was last
  // edited — nothing else (what's waiting on you is Home's list, above).
  return (
    <div
      data-project-card={project.id}
      {...prefetch}
      className={cn(
        PAGE_PANEL,
        'group relative flex min-w-0 flex-col gap-4 p-4 transition-colors hover:border-white/20 hover:bg-[#232323] focus-within:border-emerald-300/50',
        selected && 'border-primary ring-2 ring-primary/40'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-[10px] text-[15px] font-semibold text-white', tone)}>
          {project.name.charAt(0)}
        </span>
        {selectable ? <SelectIndicator selected={selected} /> : (
          // Overlapped just enough that every initial still reads.
          <AvatarGroup className="shrink-0 -space-x-0.5">
            {visibleMembers.map((member) => (
              <Avatar key={member.id} size="xs">
                <AvatarFallback className={cn('text-[8px] font-medium text-white', member.colorClass)}>
                  {member.initials}
                </AvatarFallback>
              </Avatar>
            ))}
            {overflowCount > 0 && <AvatarGroupCount>+{overflowCount}</AvatarGroupCount>}
          </AvatarGroup>
        )}
      </div>
      <div className="min-w-0">
        <button type="button" onClick={handleActivate} className={cn(cover, 'block max-w-full truncate text-[14px] font-semibold text-foreground')}>
          {project.name}
        </button>
        <p className="mt-0.5 truncate text-[12px] text-slate-500">{`Edited ${project.updatedAtLabel}`}</p>
      </div>
    </div>
  )
}

export default ProjectCard
