import { useNavigate } from 'react-router-dom'
import { ArrowRight, CircleCheck, GitBranch, GitMerge } from 'lucide-react'
import { cn } from 'cn'
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from '@/components/ui/avatar'
import ProjectThumbnail from '@/components/dashboard/ProjectThumbnail'
import { allPeople } from '@/data/mockData'

const MAX_VISIBLE_AVATARS = 3

function StatusPill({ icon: Icon, tone, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        tone
      )}
    >
      <Icon className="size-3" />
      {children}
    </span>
  )
}

function ProjectCard({ project }) {
  const navigate = useNavigate()
  const members = project.memberIds
    .map((id) => allPeople.find((p) => p.id === id))
    .filter(Boolean)
  const visibleMembers = members.slice(0, MAX_VISIBLE_AVATARS)
  const overflowCount = members.length - visibleMembers.length

  return (
    <button
      type="button"
      onClick={() => navigate(`/projects/${project.id}/workspace`)}
      className="group flex gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/50"
    >
      <ProjectThumbnail type={project.thumbnailType} className="h-auto w-32 shrink-0" />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground">{project.name}</p>
          <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {project.conflicts > 0 ? (
            <StatusPill icon={GitBranch} tone="bg-destructive/10 text-destructive ring-1 ring-destructive/20">
              {project.conflicts} conflict{project.conflicts === 1 ? '' : 's'}
            </StatusPill>
          ) : (
            <StatusPill icon={CircleCheck} tone="bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
              No conflicts
            </StatusPill>
          )}
          {project.pendingMerges > 0 && (
            <StatusPill icon={GitMerge} tone="bg-muted text-foreground/80">
              {project.pendingMerges} pending merge{project.pendingMerges === 1 ? '' : 's'}
            </StatusPill>
          )}
        </div>

        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{project.description}</p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <AvatarGroup>
            {visibleMembers.map((member) => (
              <Avatar key={member.id} size="sm">
                <AvatarFallback
                  className={cn('text-[10px] font-medium text-white', member.colorClass)}
                >
                  {member.initials}
                </AvatarFallback>
              </Avatar>
            ))}
            {overflowCount > 0 && (
              <AvatarGroupCount>+{overflowCount}</AvatarGroupCount>
            )}
          </AvatarGroup>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            Updated {project.updatedAtLabel}
          </span>
        </div>
      </div>
    </button>
  )
}

export default ProjectCard
