import { ChevronRight, FileCode2 } from 'lucide-react'
import { cn } from 'cn'
import { RISK_LABEL, STAGE_DOT_CLASS, STAGE_LABEL, nextActionFor } from '@/lib/conflicts'
import { SeverityPill } from '@/components/mergestudio/ConflictTag'
import { LocalizedText } from '@/i18n/runtime'

export function RiskBadge({ severity }) {
  if (!severity) return null
  return <SeverityPill level={RISK_LABEL[severity]} className="ds-project-severity" data-level={severity.toLowerCase()} />
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
          <span className="truncate text-[13px] font-medium text-slate-100"><LocalizedText text={conflict.title} /></span>
          <RiskBadge severity={conflict.severity} />
          {note && <span className="shrink-0 text-[10.5px] text-slate-500"><LocalizedText text={note} /></span>}
        </span>
        <span className="mt-1 flex min-w-0 items-center gap-1 text-[11px] text-slate-500">
          {showProject && conflict.projectName && <span className="shrink-0 text-slate-400"><LocalizedText text={conflict.projectName} /> ·</span>}
          <FileCode2 className="size-3 shrink-0" />
          <span className="truncate font-mono">{conflict.file}</span>
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="flex items-center gap-1.5 text-[11px] text-slate-300">
          <span className={cn('ds-status-dot rounded-full', STAGE_DOT_CLASS[conflict.reviewStage])} />
          <LocalizedText text={STAGE_LABEL[conflict.reviewStage]} />
        </span>
        <span className={cn('text-[11px]', next.mine ? 'font-medium text-emerald-300' : 'text-slate-500')}><LocalizedText text={next.label} /></span>
      </span>
      <ChevronRight className="size-3.5 shrink-0 text-slate-600 transition-colors group-hover:text-slate-300" />
    </button>
  )
}

export default ConflictRow
