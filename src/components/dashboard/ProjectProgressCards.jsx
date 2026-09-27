import { useNavigate } from 'react-router-dom'
import { GitBranch, History } from 'lucide-react'
import { cn } from 'cn'
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from '@/components/ui/avatar'
import { allPeople, projects } from '@/data/mockData'

const MAX_VISIBLE_AVATARS = 3
const CARD_STYLES = [
  { bg: 'bg-gradient-to-br from-indigo-500 to-indigo-700', ring: 'stroke-white' },
  { bg: 'bg-gradient-to-br from-rose-500 to-rose-700', ring: 'stroke-white' },
  { bg: 'bg-gradient-to-br from-emerald-500 to-emerald-700', ring: 'stroke-white' },
]

const CIRCUMFERENCE = 2 * Math.PI * 24

function ProgressRing({ percent }) {
  const dash = (percent / 100) * CIRCUMFERENCE
  return (
    <svg width="52" height="52" viewBox="0 0 60 60" className="shrink-0">
      <circle cx="30" cy="30" r="24" fill="none" strokeWidth="5" className="stroke-white/25" />
      <circle
        cx="30"
        cy="30"
        r="24"
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
        transform="rotate(-90 30 30)"
        className="stroke-white"
      />
      <text x="30" y="30" textAnchor="middle" dominantBaseline="central" className="fill-white text-[13px] font-semibold">
        {percent}%
      </text>
    </svg>
  )
}

// The three projects that most need attention (highest conflict count),
// each shown as a sync-progress ring rather than a generic stat tile —
// the ring is the % of the project's design tokens that are actually in
// sync with code, so "progress" here means the same thing Detect ->
// Review -> Merge does everywhere else in the app.
function ProjectProgressCards() {
  const navigate = useNavigate()
  const highlighted = [...projects].sort((a, b) => b.conflicts - a.conflicts).slice(0, 3)

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
      {highlighted.map((project, index) => {
        const members = project.memberIds
          .map((id) => allPeople.find((p) => p.id === id))
          .filter(Boolean)
        const visibleMembers = members.slice(0, MAX_VISIBLE_AVATARS)
        const overflowCount = members.length - visibleMembers.length
        const style = CARD_STYLES[index % CARD_STYLES.length]

        return (
          <button
            key={project.id}
            type="button"
            onClick={() => navigate(`/projects/${project.id}/workspace`)}
            className={cn(
              'flex flex-col rounded-2xl p-5 text-left text-white shadow-sm transition-transform duration-150 hover:-translate-y-0.5',
              style.bg
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold">{project.name}</p>
              <ProgressRing percent={project.syncProgress} />
            </div>

            <AvatarGroup className="mt-3">
              {visibleMembers.map((member) => (
                <Avatar key={member.id} size="sm">
                  <AvatarFallback className={cn('text-[10px] font-medium text-white', member.colorClass)}>
                    {member.initials}
                  </AvatarFallback>
                </Avatar>
              ))}
              {overflowCount > 0 && <AvatarGroupCount>+{overflowCount}</AvatarGroupCount>}
            </AvatarGroup>

            <div className="mt-4 flex items-center gap-2 text-[12.5px] text-white/90">
              <GitBranch className="size-3.5 shrink-0" />
              {project.conflicts > 0
                ? `${project.conflicts} conflict${project.conflicts === 1 ? '' : 's'} remaining`
                : 'No conflicts remaining'}
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-[12.5px] text-white/90">
              <History className="size-3.5 shrink-0" />
              Updated {project.updatedAtLabel}
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default ProjectProgressCards
