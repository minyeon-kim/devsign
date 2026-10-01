import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { cn } from 'cn'
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

// The compact severity badge — just the level word in a fixed-width pill.
// The Block Deck's drift rows and the Merge List cards both use it, so a
// "High" reads identically in either panel. Soft-tinted and borderless
// (Linear / Vercel style): a faint fill of the level's color with matching
// text — muted rose for High, muted amber for Medium, muted slate-blue for
// Low — no outline. `level` is case-insensitive: high / medium / low / none.
const SEVERITY_PILL_CLASS = {
  high: 'bg-[oklch(0.7_0.18_18_/_0.28)] font-semibold text-[oklch(0.9_0.16_18)]',
  medium: 'bg-[oklch(0.8_0.17_80_/_0.24)] font-semibold text-[oklch(0.92_0.15_80)]',
  low: 'bg-[oklch(0.72_0.14_245_/_0.28)] font-semibold text-[oklch(0.9_0.12_245)]',
  none: 'bg-white/[0.05] text-slate-500',
}

export function SeverityPill({ level, className, ...props }) {
  const key = String(level).toLowerCase()
  return (
    <span
      {...props}
      className={cn(
        'flex h-5 w-[58px] shrink-0 items-center justify-center rounded-full text-[11px] font-medium',
        SEVERITY_PILL_CLASS[key] ?? SEVERITY_PILL_CLASS.medium,
        className
      )}
    >
      <LocalizedText text={key.charAt(0).toUpperCase() + key.slice(1)} />
    </span>
  )
}

export default ConflictTag
