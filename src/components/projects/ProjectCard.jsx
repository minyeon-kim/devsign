import { useNavigate } from 'react-router-dom'
import { Check, FolderKanban } from 'lucide-react'
import { cn } from 'cn'
import { PAGE_CARD } from '@/components/mergestudio/floatingStyles'
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from '@/components/ui/avatar'
import ProjectThumbnail from '@/components/dashboard/ProjectThumbnail'
import { allPeople } from '@/data/mockData'
import { LocalizedText } from '@/i18n/runtime'
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

// A count on a card that is also a way in: "Review requests 2" filters My
// tasks to this project (or, without that, opens its Conflict list on that filter). Not shown at zero. It sits above
// the card's own click target (see ProjectCard), so it takes the click.
function CountBadge({ label, count, accent = false, pressed, onClick }) {
  if (!count) return null
  return (
    <button
      type="button"
      data-card-badge
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'ds-intrinsic relative z-10 inline-flex h-6 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-emerald-300',
        accent
          ? cn('border-emerald-400/25 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20', pressed && 'border-emerald-300/60 bg-emerald-400/25 text-white')
          : 'border-white/[0.14] bg-white/[0.04] text-slate-200 hover:border-white/25 hover:bg-white/[0.09]'
      )}
    >
      <LocalizedText text={label} />
      <span className="tabular-nums">{count}</span>
    </button>
  )
}

// A project, as a card: the preview thumbnail, its name and members, and —
// when there's something waiting — the counts that matter ("Needs your
// review", "Conflicts"). The whole card opens the project; a count opens
// its Conflict list on that filter. Hovering (or focusing) the card loads
// the project's pages ahead of the click, so it opens at once.
// `selectable` (toggled from "Projects" in ProjectsSection) switches a
// click from opening the project to toggling its selection instead.
function ProjectCard({ project, view = 'grid', counts, selectable = false, selected = false, onToggleSelect, taskFiltered = false, onFilterTasks }) {
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
  const openList = (conflictFilter) => navigate(`/projects/${project.id}/workspace`, { state: { conflictFilter } })
  const badges = !selectable && (
    <>
      <CountBadge accent label="Review requests" count={counts?.needsMyReview} pressed={onFilterTasks ? taskFiltered : undefined} onClick={() => (onFilterTasks ? onFilterTasks(project.id) : openList('mine'))} />
      <CountBadge label="Conflicts" count={counts?.open} onClick={() => openList('open')} />
    </>
  )
  const hasBadges = !selectable && Boolean(counts?.needsMyReview || counts?.open)
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
        {badges}
        <span className="shrink-0 text-[11px] text-muted-foreground">{`Edited ${project.updatedAtLabel}`}</span>
      </div>
    )
  }

  return (
    <div
      data-project-card={project.id}
      {...prefetch}
      className={cn(
        PAGE_CARD,
        'group relative flex min-w-0 flex-col overflow-hidden transition-colors hover:border-white/25 hover:bg-white/[0.03] focus-within:border-emerald-300/50',
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
          <button type="button" onClick={handleActivate} className={cn(cover, 'block max-w-full truncate text-[13px] font-semibold text-foreground')}>
            {project.name}
          </button>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {project.type ? `${project.type} · Edited ${project.updatedAtLabel}` : `Edited ${project.updatedAtLabel}`}
          </p>
        </div>

        {/* Overlapped just enough that every initial still reads. */}
        <AvatarGroup className="shrink-0 -space-x-0.5">
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

      {hasBadges && <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3.5">{badges}</div>}
    </div>
  )
}

export default ProjectCard
