import { ArrowLeft, X } from 'lucide-react'
import { cn } from 'cn'
import ReviewDetail from '@/components/conflicts/ReviewDetail'
import { LocalizedText } from '@/i18n/runtime'
import { RISK_LABEL, listStatusOf, shortDue } from '@/lib/conflicts'

// The Screens board's change list (Conflict Points, pressed while Screens
// shows): a panel floating over the board's left. It lists the open changes
// screen by screen, in the board's order; pressing one glides the board in
// on it (its element lit) and shows its detail here, in the same panel —
// Back returns to the list.
//
//   groups: [{ id, n, name, conflicts }] — the screens with changes, then
//   (id: null) those about no screen. picked: the change whose detail shows.
export const BOARD_PANEL_WIDTH = 380
const RISK_DOT = { high: 'bg-rose-400', medium: 'bg-amber-300', low: 'bg-sky-300' }
const HEADER_BUTTON = 'ds-intrinsic flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300'

export default function BoardConflicts({ groups, total, picked, onPick, onBack, onClose }) {
  return (
    <section
      data-board-chrome
      data-board-conflicts={picked ? 'detail' : 'list'}
      aria-label="Changes on these screens"
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      className="absolute inset-y-2 left-14 z-30 flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-background shadow-2xl shadow-black/50 animate-in fade-in slide-in-from-left-2 duration-200 motion-reduce:animate-none"
      style={{ width: BOARD_PANEL_WIDTH }}
    >
      <header className="flex h-11 shrink-0 items-center gap-1 border-b border-white/[0.06] pr-1.5 pl-2">
        {/* (On a change: the way back to the list — its title is the detail's own, right under.) */}
        {picked ? (
          <button type="button" data-board-conflicts-back onClick={onBack} className="ds-intrinsic flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-full px-2 text-left text-xs font-medium text-slate-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300">
            <ArrowLeft className="size-4 shrink-0" /><LocalizedText text="Back to the list" />
          </button>
        ) : (
          <h2 className="min-w-0 flex-1 truncate pl-1.5 text-[13px] font-semibold text-slate-100">
            <LocalizedText text="Conflicts" /> <span className="font-normal text-slate-500 tabular-nums">{total}</span>
          </h2>
        )}
        <button type="button" data-board-conflicts-close onClick={onClose} aria-label="Close" title="Close" className={HEADER_BUTTON}><X className="size-4" /></button>
      </header>
      {picked ? (
        // (The change's own detail — the same as the pane's, in this panel's column.)
        <div data-board-conflict-detail className="min-h-0 flex-1 overflow-hidden">
          <ReviewDetail page conflict={picked} />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {groups.length === 0 && <p className="px-3 py-6 text-center text-xs text-slate-500"><LocalizedText text="No open changes on these screens." /></p>}
          {groups.map((group) => (
            <section key={group.id ?? 'none'} data-board-conflicts-screen={group.id ?? 'none'} className="mb-1.5">
              <h3 className="flex items-center gap-1.5 px-2.5 pt-2 pb-1 text-[11px] font-medium text-slate-500">
                {group.n != null && <span className="tabular-nums">{group.n}</span>}
                {group.n != null && <span aria-hidden>·</span>}
                <span className="min-w-0 truncate"><LocalizedText text={group.name} /></span>
                <span className="ml-auto tabular-nums">{group.conflicts.length}</span>
              </h3>
              <ul className="m-0 flex list-none flex-col p-0">
                {group.conflicts.map((conflict) => {
                  const status = listStatusOf(conflict)
                  return (
                    <li key={conflict.id}>
                      <button type="button" data-board-conflict={conflict.id} onClick={() => onPick(conflict)}
                        className="ds-intrinsic flex w-full flex-col items-start gap-0.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-emerald-300">
                        <span className="flex w-full min-w-0 items-center gap-1.5 text-[12.5px] leading-5 font-medium text-slate-100">
                          <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', RISK_DOT[conflict.severity] ?? RISK_DOT.medium)} />
                          <span className="min-w-0 truncate"><LocalizedText text={conflict.title} /></span>
                          {shortDue(conflict.dueLabel) && <span className="ml-auto shrink-0 pl-2 text-[11px] font-normal text-slate-500"><LocalizedText text={shortDue(conflict.dueLabel)} /></span>}
                        </span>
                        <span className="flex items-center gap-1.5 pl-3 text-[11px] text-slate-400">
                          <LocalizedText text={`${RISK_LABEL[conflict.severity] ?? RISK_LABEL.medium} risk`} />
                          <span aria-hidden>·</span>
                          <LocalizedText text={status.label} />
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}
