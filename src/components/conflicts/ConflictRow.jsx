import { ChevronRight, FileCode2 } from 'lucide-react'
import { cn } from 'cn'
import { RISK_LABEL } from '@/lib/conflicts'
import { SeverityPill } from '@/components/mergestudio/ConflictTag'
import { LocalizedText } from '@/i18n/runtime'

// Low severity is the default and doesn't need to occupy space in the queue.
export function RiskBadge({ severity }) {
  if (!severity || severity === 'low') return null
  return <SeverityPill bare quiet level={RISK_LABEL[severity]} />
}

// The whole row opens the conflict; the full path stays available on hover.
function ConflictRow({ conflict, showProject = false, note, onOpen }) {
  const fileName = conflict.file?.split('/').at(-1) ?? conflict.file
  return (
    <button
      type="button"
      onClick={() => onOpen(conflict)}
      className="group flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-emerald-300"
    >
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[13px] font-medium text-slate-100"><LocalizedText text={conflict.title} /></span>
          <RiskBadge severity={conflict.severity} />
          {note && <span className="shrink-0 text-[10.5px] text-slate-500"><LocalizedText text={note} /></span>}
        </span>
        <span className="mt-1 block min-w-0 truncate text-[11px] text-slate-500">
          {showProject && conflict.projectName && <span className="shrink-0 text-slate-400"><LocalizedText text={conflict.projectName} /> ·</span>}
          <span title={conflict.file} className="inline-flex min-w-0 items-center gap-1 font-mono">
            <FileCode2 className="size-3 shrink-0" />
            <span translate="no" className="truncate">{fileName}</span>
          </span>
        </span>
      </span>
      <ChevronRight aria-hidden className={cn('size-4 shrink-0 text-slate-500 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100')} />
    </button>
  )
}

export default ConflictRow
