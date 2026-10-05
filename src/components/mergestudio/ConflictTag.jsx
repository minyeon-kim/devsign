import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { cn } from 'cn'
import { CONFLICT_BADGE } from '@/components/conflicts/ConflictBadges'
import { LocalizedText } from '@/i18n/runtime'

// The conflict-level tag for the conflict-resolution panel's header: a
// tinted pill with a severity icon and "<Level> conflict".
export const CONFLICT_SEVERITY = {
  High: { icon: TriangleAlert, className: 'bg-rose-400/25 text-rose-200' },
  Medium: { icon: CircleAlert, className: 'bg-amber-400/25 text-amber-200' },
  Low: { icon: Info, className: 'bg-sky-400/25 text-sky-200' },
  None: { icon: CircleCheck, className: 'bg-emerald-400/20 text-emerald-300', label: 'No conflicts' },
}

function ConflictTag({ level, className }) {
  const sev = CONFLICT_SEVERITY[level] ?? CONFLICT_SEVERITY.Medium
  const Icon = sev.icon
  return (
    <span className={cn('flex h-5 shrink-0 items-center justify-center gap-1 rounded-full px-2 text-[10px] font-medium whitespace-nowrap', sev.className, className)}>
      <Icon className="size-3" />
      {sev.label ?? `${level} conflict`}
    </span>
  )
}

// Level and review status share badge geometry; color identifies severity.
const SEVERITY_PILL_CLASS = { high: 'text-rose-300', medium: 'text-amber-300', low: 'text-sky-300', none: 'text-slate-400' }
// In lists color is kept for what needs acting on: only High is tinted.
const SEVERITY_QUIET_CLASS = { high: 'text-rose-300', medium: 'text-slate-200', low: 'text-slate-300', none: 'text-slate-400' }

// `bare`: just the level ("Medium"), for places whose column or context
// already says it's a level. `quiet`: color only for High.
export function SeverityPill({ level, className, bare = false, quiet = false, ...props }) {
  const key = String(level).toLowerCase()
  const tones = quiet ? SEVERITY_QUIET_CLASS : SEVERITY_PILL_CLASS
  return (
    <span
      {...props}
      className={cn(
        CONFLICT_BADGE,
        tones[key] ?? tones.medium,
        className
      )}
    >
      {!bare && <span className="text-slate-400">Level</span>}
      <LocalizedText text={key.charAt(0).toUpperCase() + key.slice(1)} />
    </span>
  )
}

export default ConflictTag
