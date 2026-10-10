import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { cn } from 'cn'
import { CONFLICT_BADGE, PLAIN_BADGE } from '@/components/conflicts/ConflictBadges'
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
// Risk reads the same everywhere: high red, medium yellow, low blue.
const SEVERITY_QUIET_CLASS = SEVERITY_PILL_CLASS

// `bare`: just the level ("Medium"), for places whose column or context
// already says it's a level. `quiet`: color only for High.
const RISK_TINT_CLASS = { high: 'bg-rose-400/15', medium: 'bg-amber-400/15' }
const SEVERITY_DOT_CLASS = { high: 'bg-rose-400', medium: 'bg-amber-400', low: 'bg-sky-400', none: 'bg-slate-500' }

// The risk icon: red (danger) for High, yellow (caution) for Medium; Low
// gets none, so the two that need attention stand out from the rest.
const RISK_ICON_CLASS = { high: 'text-rose-400', medium: 'text-amber-300' }
const RISK_ICON_LABEL = { high: 'High risk', medium: 'Medium risk' }

export function RiskIcon({ level, className }) {
  const key = String(level ?? '').toLowerCase()
  if (!RISK_ICON_CLASS[key]) return null
  return <TriangleAlert role="img" aria-label={RISK_ICON_LABEL[key]} data-risk-icon={key} className={cn('size-3.5 shrink-0', RISK_ICON_CLASS[key], className)} />
}

// `icon`: lead with the risk icon (High red, Medium yellow), on a tint of
// the same color — for the conflict lists, where risk is what to scan for.
// `plain`: no box — a dot in the level's color and the level as text.
// `labeled` (with `plain`): says what the word is — "Risk High" — with the
// level in its color.
export function SeverityPill({ level, className, bare = false, quiet = false, plain = false, labeled = false, icon = false, ...props }) {
  const key = String(level).toLowerCase()
  const tones = quiet ? SEVERITY_QUIET_CLASS : SEVERITY_PILL_CLASS
  if (plain) {
    return (
      <span {...props} className={cn(PLAIN_BADGE, 'text-slate-200', className)}>
        {!labeled && <span className={cn('size-1.5 shrink-0 rounded-full', SEVERITY_DOT_CLASS[key] ?? SEVERITY_DOT_CLASS.medium)} />}
        {labeled && <span className="font-normal text-slate-400"><LocalizedText text="Risk" /></span>}
        <span data-risk={key} className={labeled ? SEVERITY_PILL_CLASS[key] ?? SEVERITY_PILL_CLASS.medium : undefined}><LocalizedText text={key.charAt(0).toUpperCase() + key.slice(1)} /></span>
      </span>
    )
  }
  return (
    <span
      {...props}
      className={cn(
        CONFLICT_BADGE,
        tones[key] ?? tones.medium,
        icon && RISK_TINT_CLASS[key],
        className
      )}
    >
      {icon && <RiskIcon level={key} className="size-3" />}
      {!bare && <span className="text-slate-400">Level</span>}
      <LocalizedText text={key.charAt(0).toUpperCase() + key.slice(1)} />
    </span>
  )
}

export default ConflictTag
