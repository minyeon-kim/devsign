import { useNavigate } from 'react-router-dom'
import { Check, FolderKanban } from 'lucide-react'
import { cn } from 'cn'
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from '@/components/ui/avatar'
import ProjectThumbnail from '@/components/dashboard/ProjectThumbnail'
import { allPeople } from '@/data/mockData'
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

// A file-browser-style card: the preview thumbnail does the work, and the
// footer stays to a name + last-edited timestamp — conflict/merge detail
// lives on the Dashboard's "Needs attention" list, not duplicated here.
// `selectable` (toggled from "All projects" in ProjectsSection) switches a
// click from navigating into the project to toggling its selection instead.
function ProjectCard({ project, view = 'grid', selectable = false, selected = false, onToggleSelect }) {
  const navigate = useNavigate()
  const tone = projectTone(project.id)
  const members = project.memberIds
    .map((id) => allPeople.find((p) => p.id === id))
    .filter(Boolean)
  const visibleMembers = members.slice(0, MAX_VISIBLE_AVATARS)
  const overflowCount = members.length - visibleMembers.length

  function handleActivate() {
    if (selectable) onToggleSelect(project.id)
    else navigate(`/projects/${project.id}/workspace`)
  }

  if (view === 'list') {
    return (
      <button
        type="button"
        onClick={handleActivate}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/50',
          selected && 'border-primary bg-primary/5'
        )}
      >
        {selectable && <SelectIndicator selected={selected} />}
        <span className={cn('flex size-6 shrink-0 items-center justify-center rounded', tone)}>
          <FolderKanban className="size-3.5 text-white" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{project.name}</span>
        <span className="shrink-0 text-[11px] text-muted-foreground">Edited {project.updatedAtLabel}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleActivate}
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-colors hover:border-primary/40',
        selected && 'border-primary ring-2 ring-primary/40'
      )}
    >
      <div className="relative">
        <ProjectThumbnail type={project.thumbnailType} className="h-36 w-full rounded-none border-0 border-b border-border" />
        {selectable && (
          <div className="absolute top-2 left-2">
            <SelectIndicator selected={selected} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', tone)}>
          <FolderKanban className="size-4 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-foreground">{project.name}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {project.type ? `${project.type} · Edited ${project.updatedAtLabel}` : `Edited ${project.updatedAtLabel}`}
          </p>
        </div>

        <AvatarGroup className="shrink-0">
          {visibleMembers.map((member) => (
            <Avatar key={member.id} size="sm">
              <AvatarFallback className={cn('text-[10px] font-medium text-white', member.colorClass)}>
                {member.initials}
              </AvatarFallback>
            </Avatar>
          ))}
          {overflowCount > 0 && <AvatarGroupCount>+{overflowCount}</AvatarGroupCount>}
        </AvatarGroup>
      </div>
    </button>
  )
}

export default ProjectCard
