import { useNavigate } from 'react-router-dom'
import { cn } from 'cn'
import { RISK_CHIP, StatusIcon, rowKindOf, rowTitleOf, sortRows } from '@/components/screens/BoardConflicts'
import { changeHref } from '@/lib/changeLink'
import { listStatusOf, needsReviewFrom, shortDue } from '@/lib/conflicts'
import { currentUserFor, projects } from '@/data/mockData'
import { LocalizedText } from '@/i18n/runtime'
import { translateText } from '@/i18n/translate'
import { useLanguage } from '@/i18n/language'
import { projectTone } from '@/lib/projectTone'
import { useConflictStore } from '@/state/ConflictStore'

// How many are listed before "and N more" (the rest are in each project's list).
const SHOWN = 5

// Home's first thing: what's waiting on you, across every project — the changes that need your review, the
// soonest due first. A row is the change list's row (status · title · due over its kind and risk) with the
// project it's in; it opens that change in its project. With nothing waiting, nothing is said.
export default function ReviewQueue() {
  const navigate = useNavigate()
  const language = useLanguage()
  const { conflicts } = useConflictStore()
  const waiting = sortRows(conflicts.filter((conflict) => needsReviewFrom(conflict, currentUserFor(conflict.projectId).id)))
  if (!waiting.length) return null
  const shown = waiting.slice(0, SHOWN)
  return (
    <section data-review-queue aria-labelledby="review-queue-title">
      <h2 id="review-queue-title" className="flex items-baseline gap-1.5 text-[15px] font-semibold text-foreground">
        <LocalizedText text="Waiting on your review" />
        <span className="font-normal text-slate-500 tabular-nums">{waiting.length}</span>
      </h2>
      <ul className="mt-3 flex list-none flex-col gap-0.5 rounded-[20px] border border-white/10 bg-card p-1.5">
        {shown.map((conflict) => {
          const project = projects.find((entry) => entry.id === conflict.projectId)
          const status = listStatusOf(conflict)
          const { target, property } = rowTitleOf(conflict)
          const due = shortDue(conflict.dueLabel)
          const chip = RISK_CHIP[conflict.severity]
          return (
            <li key={conflict.id}>
              <button type="button" data-review-queue-row={conflict.id} onClick={() => navigate(changeHref(conflict.projectId, conflict.id))}
                className="ds-intrinsic grid h-[52px] w-full grid-cols-[16px_minmax(0,1fr)_auto] grid-rows-2 items-center gap-x-2.5 rounded-[14px] px-3 py-2 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-emerald-300">
                <StatusIcon status={status?.id ?? 'detected'} label={translateText(status?.label ?? '', language)} />
                <span translate="no" className="flex min-w-0 items-baseline gap-1.5 text-[13px] leading-5">
                  <span className="min-w-0 shrink-0 truncate font-medium text-slate-100" style={{ maxWidth: property ? '62%' : '100%' }}>{target}</span>
                  {property && <span className="min-w-0 truncate text-slate-400">{property}</span>}
                </span>
                <span className={cn('justify-self-end text-right text-[12px] tabular-nums', conflict.dueBucket === 'overdue' ? 'font-semibold text-rose-400' : conflict.dueBucket === 'today' ? 'text-rose-400' : 'text-slate-500')}>{due && <LocalizedText text={due} />}</span>
                <span className="col-start-2 col-end-4 flex min-w-0 items-center gap-1.5 text-[12px] leading-4 text-slate-500">
                  {project && <span className="flex min-w-0 items-center gap-1.5"><span aria-hidden className={cn('size-2 shrink-0 rounded-[3px]', projectTone(project.id))} /><span className="truncate text-slate-400">{project.name}</span></span>}
                  <span aria-hidden>·</span>
                  <span className="truncate"><LocalizedText text={rowKindOf(conflict)} /></span>
                  {chip && <span className={cn('shrink-0 rounded px-1.5 text-[11px] leading-[18px] font-medium', chip[1])}><LocalizedText text={chip[0]} /></span>}
                </span>
              </button>
            </li>
          )
        })}
        {waiting.length > shown.length && (
          <li className="px-3 py-2 text-[12px] text-slate-500">{language === 'ko' ? `외 ${waiting.length - shown.length}건 — 각 프로젝트의 변경확인에서` : `and ${waiting.length - shown.length} more — in each project's list`}</li>
        )}
      </ul>
    </section>
  )
}
