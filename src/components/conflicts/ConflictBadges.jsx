import { CircleCheck } from 'lucide-react'
import { cn } from 'cn'
import { LocalizedText } from '@/i18n/runtime'
import { STAGE_LABEL, gitFlowOf, listStatusOf } from '@/lib/conflicts'

// The review's secondary "go somewhere" buttons — to the conflict's
// activity, Merge Studio, the project's History, and back to the review —
// are one style: same height, radius, fill, edge, type, padding and hover.
// No function icon in front of any of them; only the direction: a forward
// button is its label then → (NAV_BUTTON_ICON), a back button ← then its
// label. (↗ would mean a new window or leaving the app — none of these do.)
// Quieter than the header's main action.
export const NAV_BUTTON = 'ds-intrinsic inline-flex h-8 w-fit shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-white/[0.14] bg-white/[0.04] px-3 text-xs font-medium whitespace-nowrap text-slate-200 transition-colors hover:border-white/25 hover:bg-white/[0.09] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300'
export const NAV_BUTTON_ICON = 'size-3.5 shrink-0 text-slate-400'

export const REVIEW_HEADER_BADGE = 'inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs leading-4 font-medium whitespace-nowrap'

export const CONFLICT_BADGE = 'inline-flex h-6 max-w-full shrink-0 items-center justify-center gap-1.5 rounded-md bg-white/[0.05] px-2 text-[11px] font-medium whitespace-nowrap'
const tones = {
  detected: 'text-slate-300',
  in_review: 'text-sky-300',
  approved: 'text-emerald-300',
  resolved: 'text-violet-300',
}
const dots = {
  detected: 'bg-slate-400',
  in_review: 'bg-sky-400',
  approved: 'bg-emerald-400',
  resolved: 'bg-violet-400',
}
// The same badge without its box — a dot and text — for a line that already
// sits inside a panel.
export const PLAIN_BADGE = 'inline-flex max-w-full shrink-0 items-center gap-1.5 text-xs font-medium whitespace-nowrap'
// `label` overrides the stage's own wording (a rollback agreement's stages
// read differently — see lib/rollbackImpact). `quiet` (lists): the dot
// carries the color, the text stays neutral. `plain`: no box.
export function ReviewStageBadge({ stage, ready = false, label, quiet = false, plain = false }) {
  return <span className={cn(plain ? PLAIN_BADGE : CONFLICT_BADGE, quiet || plain ? 'text-slate-200' : tones[stage])}>
    <span className={cn('size-1.5 shrink-0 rounded-full', quiet || plain ? dots[stage] : 'bg-current')} />
    <span className="truncate"><LocalizedText text={label ?? (ready ? 'Decided · request review' : STAGE_LABEL[stage])} /></span>
  </span>
}
// A conflict's status wherever it's listed (the Conflict list, the
// Dashboard's queue, a project's home): a color dot and one short word —
// the list's five statuses (lib/conflicts), never a boxed chip.
export function ListStatusLabel({ conflict, className }) {
  const status = listStatusOf(conflict)
  const resolvedLabel = conflict.reviewStage === 'resolved'
    ? conflict.rollback ? 'Rolled back' : 'Merged'
    : status.label
  return (
    <span data-list-status={status.id} className={cn(PLAIN_BADGE, 'leading-5', conflict.reviewStage === 'resolved' && !conflict.rollback ? 'text-emerald-200' : 'text-slate-200', className)}>
      {conflict.reviewStage === 'resolved' && !conflict.rollback
        ? <CircleCheck aria-hidden className="size-3.5 shrink-0 text-emerald-300" />
        : <span className={cn('size-1.5 shrink-0 rounded-full', status.dot)} />}
      <LocalizedText text={resolvedLabel} />
    </span>
  )
}

export function BranchInfo({ conflict, compact = false }) {
  const flow = gitFlowOf(conflict)
  if (!flow) return <span className="text-xs text-slate-500">—</span>
  return <div translate="no" className="min-w-0 space-y-1" title={`${flow.source} → ${flow.target}`}>
    <div className="flex min-w-0 items-center gap-1.5 text-xs text-slate-200">
      {!compact && <span className="min-w-0 break-all font-mono">{flow.source}</span>}
    </div>
    <p className={cn('text-[11.5px] text-slate-300', compact ? 'break-all' : 'truncate')}>{compact ? `${flow.source} → ${flow.target}` : `→ ${flow.target}`}</p>
  </div>
}
