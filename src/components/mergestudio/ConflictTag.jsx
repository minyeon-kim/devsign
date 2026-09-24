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

// The compact severity pill — just the level word in a fixed-width ghost
// pill. The Block Deck's Detected Drifts rows and the Merge List cards both
// use it, so a "High" reads identically in either panel. No fill: a
// transparent pill whose text and hairline outline carry a soft, low-chroma
// semantic tint — muted rose for High, muted amber for Medium, muted
// slate-blue for Low — enough to scan priorities at a glance without the
// loud solid badges. (oklch values a notch more saturated than a pure
// pastel, so each level pops on the dark surface, but still softer than
// the stock palette steps.) `level` is case-insensitive: high / medium /
// low / none.
const SEVERITY_PILL_CLASS = {
  high: 'font-semibold text-[oklch(0.8_0.13_18)] ring-[oklch(0.7_0.15_18_/_0.65)]',
  medium: 'text-[oklch(0.86_0.12_80)] ring-[oklch(0.8_0.13_80_/_0.55)]',
  low: 'text-[oklch(0.8_0.08_245)] ring-[oklch(0.72_0.1_245_/_0.5)]',
  none: 'text-slate-500 ring-white/10',
}

export function SeverityPill({ level, className, ...props }) {
  const key = String(level).toLowerCase()
  return (
    <span
      {...props}
      className={cn(
        'flex h-5 w-[58px] shrink-0 items-center justify-center rounded-full bg-transparent text-[11px] font-medium ring-1 ring-inset',
        SEVERITY_PILL_CLASS[key] ?? SEVERITY_PILL_CLASS.medium,
        className
      )}
    >
      {key.charAt(0).toUpperCase() + key.slice(1)}
    </span>
  )
}

export default ConflictTag
