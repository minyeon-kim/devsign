import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { cn } from 'cn'

// The conflict-level tag for the conflict-resolution panel's header: a
// tinted pill with a severity icon and "<Level> conflict".
export const CONFLICT_SEVERITY = {
  High: { icon: TriangleAlert, className: 'bg-destructive/15 text-destructive' },
  Medium: { icon: CircleAlert, className: 'bg-amber-500/15 text-amber-500' },
  Low: { icon: Info, className: 'bg-sky-500/15 text-sky-500' },
  None: { icon: CircleCheck, className: 'bg-emerald-500/15 text-emerald-400', label: 'No conflicts' },
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
  high: 'bg-[oklch(0.7_0.15_18_/_0.18)] font-semibold text-[oklch(0.82_0.12_18)]',
  medium: 'bg-[oklch(0.8_0.13_80_/_0.15)] text-[oklch(0.87_0.11_80)]',
  low: 'bg-[oklch(0.72_0.1_245_/_0.18)] text-[oklch(0.82_0.07_245)]',
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
      {key.charAt(0).toUpperCase() + key.slice(1)}
    </span>
  )
}

export default ConflictTag
