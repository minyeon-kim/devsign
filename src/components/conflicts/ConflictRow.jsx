import { ListStatusLabel, NAV_BUTTON, NAV_BUTTON_ICON } from '@/components/conflicts/ConflictBadges'
import { ArrowRight, FileCode2 } from 'lucide-react'
import { cn } from 'cn'
import { RISK_LABEL, taskFor } from '@/lib/conflicts'
import { SeverityPill } from '@/components/mergestudio/ConflictTag'
import { LocalizedText } from '@/i18n/runtime'

// Risk as the Conflict list shows it: the word alone (Low / Medium / High).
export function RiskBadge({ severity }) {
  if (!severity) return null
  return <SeverityPill bare quiet level={RISK_LABEL[severity]} />
}

// One conflict as a list row (Dashboard queue, project home), in the
// Conflict list's own terms: the change, its risk, its file and project,
// its status as a dot and a short word. The whole row is the way in — it
// opens that conflict's review in its project — and says so with one
// button at its right, named after what's yours to do there (taskFor:
// "Review the request", "Merge now", … — "View" when nothing is).
function ConflictRow({ conflict, showProject = false, note, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(conflict)}
      className="group flex w-full cursor-pointer items-center gap-4 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-white/[0.05] focus-visible:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-emerald-300"
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
          <span translate="no" className="truncate font-mono">{conflict.file}</span>
        </span>
      </span>
      <ListStatusLabel conflict={conflict} />
      {/* Part of the row's one click target, so a span — styled as the
          button it reads as. */}
      <span className={cn(NAV_BUTTON, 'group-hover:border-white/25 group-hover:bg-white/[0.09] group-hover:text-white')}>
        <LocalizedText text={taskFor(conflict)?.label ?? 'View'} />
        <ArrowRight className={NAV_BUTTON_ICON} />
      </span>
    </button>
  )
}

export default ConflictRow
