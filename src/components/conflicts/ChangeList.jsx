import { cn } from 'cn'
import { StatusIcon, rowTitleOf, sortRows } from '@/components/screens/BoardConflicts'
import { listStatusOf, shortDue } from '@/lib/conflicts'
import { projects } from '@/data/mockData'
import { LocalizedText } from '@/i18n/runtime'
import { translateText } from '@/i18n/translate'
import { useLanguage } from '@/i18n/language'

// A short list of changes, as the Workspace's change list draws them but on one line each — status · what
// (component, then property) · [the project] · [yours] · when it's due — in the windows' card (24px-round
// panel surface). Used by Home (what's waiting on you, across projects) and a project's home (its changes).
//   withProject: say which project each is in.   mine(conflict): mark the ones waiting on you.
//   limit: how many rows; the rest are counted in a last line that opens `onMore`.
export default function ChangeList({ conflicts, onOpen, withProject = false, mine = null, limit = 5, onMore = null, label }) {
  const language = useLanguage()
  const rows = sortRows(conflicts)
  // (Yours first — then by when they're due, as the change list sorts.)
  if (mine) rows.sort((a, b) => Number(mine(b)) - Number(mine(a)))
  const shown = rows.slice(0, limit)
  const rest = rows.length - shown.length
  return (
    <ul aria-label={label} className="flex list-none flex-col rounded-[24px] border border-white/10 bg-card p-1.5">
      {shown.map((conflict) => {
        const status = listStatusOf(conflict)
        const { target, property } = rowTitleOf(conflict)
        const due = shortDue(conflict.dueLabel)
        const project = withProject ? projects.find((entry) => entry.id === conflict.projectId) : null
        const yours = mine?.(conflict)
        return (
          <li key={conflict.id}>
            <button type="button" data-change-list-row={conflict.id} onClick={() => onOpen(conflict)}
              className="ds-intrinsic flex h-11 w-full min-w-0 items-center gap-2.5 rounded-[18px] px-3 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-emerald-300">
              <StatusIcon status={status?.id ?? 'detected'} label={translateText(status?.label ?? '', language)} />
              <span translate="no" className="flex min-w-0 flex-1 items-baseline gap-1.5 text-[13px] leading-5">
                <span className="min-w-0 shrink-0 truncate font-medium text-slate-100" style={{ maxWidth: property ? '58%' : '100%' }}>{target}</span>
                {property && <span className="min-w-0 truncate text-slate-400">{property}</span>}
              </span>
              {project && <span className="max-w-[40%] shrink-0 truncate text-[12px] text-slate-500">{project.name}</span>}
              {yours && <span data-change-yours className="shrink-0 rounded-full bg-emerald-400/10 px-2 text-[11px] leading-[18px] font-medium text-emerald-200"><LocalizedText text="Your turn" /></span>}
              <span className={cn('w-14 shrink-0 text-right text-[12px] tabular-nums', conflict.dueBucket === 'overdue' ? 'font-semibold text-rose-400' : conflict.dueBucket === 'today' ? 'text-rose-400' : 'text-slate-500')}>{due && <LocalizedText text={due} />}</span>
            </button>
          </li>
        )
      })}
      {rest > 0 && (
        <li>
          <button type="button" onClick={onMore} disabled={!onMore} className="ds-intrinsic flex h-9 w-full items-center rounded-[18px] px-3 text-left text-[12px] text-slate-500 transition-colors enabled:hover:bg-white/[0.04] enabled:hover:text-slate-300">
            {language === 'ko' ? `외 ${rest}건` : `${rest} more`}
          </button>
        </li>
      )}
    </ul>
  )
}
