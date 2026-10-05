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
// `label` overrides the stage's own wording (a rollback agreement's stages
// read differently — see lib/rollbackImpact).
export function ReviewStageBadge({ stage, ready = false, label }) {
  return <span className={cn(CONFLICT_BADGE, tones[stage])}>
    <span className="size-1.5 shrink-0 rounded-full bg-current" />
    <span className="truncate"><LocalizedText text={label ?? (ready ? 'Decided · request review' : STAGE_LABEL[stage])} /></span>
  </span>
}
export function BranchInfo({ conflict, compact = false }) {
  const flow = gitFlowOf(conflict)
  if (!flow) return <span className="text-xs text-slate-500">—</span>
  return <div translate="no" className="min-w-0 space-y-1" title={`${flow.source} → ${flow.target}`}>
    <div className="flex min-w-0 items-center gap-1.5 text-xs text-slate-200">
      <span className="shrink-0 rounded bg-violet-400/15 px-1.5 py-0.5 text-[11px] font-semibold text-violet-200">{flow.source.split('/')[0]}</span>
      {!compact && <span className="min-w-0 break-all font-mono">{flow.source}</span>}
    </div>
    <p className={cn('text-[11.5px] text-slate-300', compact ? 'break-all' : 'truncate')}>{compact ? `${flow.source} → ${flow.target}` : `→ ${flow.target}`}</p>
  </div>
}
