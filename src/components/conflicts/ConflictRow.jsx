import { ChevronRight, FileCode2 } from 'lucide-react'
import { cn } from 'cn'
import { RISK_LABEL, STAGE_DOT_CLASS, STAGE_LABEL, nextActionFor } from '@/lib/conflicts'

const RISK_CLASS = {
  high: 'bg-destructive/15 text-red-300',
  medium: 'bg-amber-500/15 text-amber-300',
  low: 'bg-sky-500/15 text-sky-300',
}

export function RiskBadge({ severity }) {
  if (!severity) return null
  return (
    <span className={cn('inline-flex h-5 shrink-0 items-center rounded-full px-1.5 text-[10px] font-semibold', RISK_CLASS[severity])}>
      {RISK_LABEL[severity]} risk
    </span>
  )
}

// One Conflict Point as a list row (Dashboard queue, project overview):
// the concrete change, its file and project, risk and processing status as
// separate labels, and the next action — highlighted when it's yours.
function ConflictRow({ conflict, showProject = false, note, onOpen }) {
  const next = nextActionFor(conflict)
  return (
    <button
      type="button"
      onClick={() => onOpen(conflict)}
      className="group flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
    >
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[13px] font-medium text-slate-100">{conflict.title}</span>
          <RiskBadge severity={conflict.severity} />
          {note && <span className="shrink-0 text-[10.5px] text-slate-500">{note}</span>}
        </span>
        <span className="mt-1 flex min-w-0 items-center gap-1 text-[11px] text-slate-500">
          {showProject && conflict.projectName && <span className="shrink-0 text-slate-400">{conflict.projectName} ·</span>}
          <FileCode2 className="size-3 shrink-0" />
          <span className="truncate font-mono">{conflict.file}</span>
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="flex items-center gap-1.5 text-[11px] text-slate-300">
          <span className={cn('size-1.5 rounded-full', STAGE_DOT_CLASS[conflict.reviewStage])} />
          {STAGE_LABEL[conflict.reviewStage]}
        </span>
        <span className={cn('text-[11px]', next.mine ? 'font-medium text-sky-300' : 'text-slate-500')}>{next.label}</span>
      </span>
      <ChevronRight className="size-3.5 shrink-0 text-slate-600 transition-colors group-hover:text-slate-300" />
    </button>
  )
}

export default ConflictRow
