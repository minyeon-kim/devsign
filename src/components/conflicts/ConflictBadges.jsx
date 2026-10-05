import { cn } from 'cn'
import { LocalizedText } from '@/i18n/runtime'
import { STAGE_LABEL, gitFlowOf } from '@/lib/conflicts'

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
