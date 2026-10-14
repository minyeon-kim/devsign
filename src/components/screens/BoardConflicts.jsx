import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Check, ChevronDown, Layers3, X } from 'lucide-react'
import { cn } from 'cn'
import ReviewDetail from '@/components/conflicts/ReviewDetail'
import { LocalizedText } from '@/i18n/runtime'
import { useLanguage } from '@/i18n/language'
import { translateText } from '@/i18n/translate'
import { listStatusOf, shortDue } from '@/lib/conflicts'
import { conflictTypeOf } from '@/lib/conflictInsight'

// The Screens board's change list (Conflict Points, pressed while Screens
// shows): a panel at the right of the work area, docked in the same row as the board (it takes its width,
// the board gets the rest — `host`, BoardDockSlot); without a place there it floats over the board's right. It lists the open changes
// screen by screen, in the board's order; pressing one glides the board in
// on it (its element lit) and shows its detail here, in the same panel —
// Back returns to the list.
//
//   groups: [{ id, n, name, conflicts }] — the screens with changes, then
//   (id: null) those about no screen. picked: the change whose detail shows.
export const BOARD_PANEL_WIDTH = 380
export const BOARD_DETAIL_WIDTH = 460

// ── A row, as an issue list says it ──
// Its title in two parts — what it's about, and which property — whatever form the title came in
// ('Component / Property', or a sentence whose last part says what kind of clash it is, which moves to
// the second line: '주문 버튼 · 중복 결제 방지 · 겹치는 동작' → 주문 버튼 · 중복 결제 방지 / 동작 충돌).
const KIND_SUFFIX = [[/\s*·\s*(겹치는 동작|overlapping behaviou?r)$/i, 'Behavior conflict'], [/\s*·\s*(겹치는 계산식|overlapping calculation)$/i, 'Calculation conflict']]
export function rowTitleOf(conflict) {
  let title = String(conflict?.title ?? '').trim()
  let kind = null
  for (const [pattern, label] of KIND_SUFFIX) if (pattern.test(title)) { title = title.replace(pattern, ''); kind = label }
  const slash = title.indexOf(' / ')
  if (slash > 0) return { target: title.slice(0, slash), property: title.slice(slash + 3), kind }
  const dot = title.indexOf(' · ')
  if (dot > 0) return { target: title.slice(0, dot), property: title.slice(dot + 3), kind }
  return { target: title, property: '', kind }
}
// What kind of clash: 디자인 불일치 · 동작 충돌 · 계산 충돌 · 병합 충돌.
export function rowKindOf(conflict) {
  const fromTitle = rowTitleOf(conflict).kind
  if (fromTitle) return fromTitle
  const type = conflictTypeOf(conflict)?.id
  return type === 'code-conflict' ? 'Code merge conflict' : ['design-drift', 'production-priority', 'structural-drift'].includes(type) ? 'Design Drift' : conflictTypeOf(conflict)?.label ?? 'Design Drift'
}
// In a group: soonest due first, then the riskiest.
const DUE_ORDER = { overdue: 0, today: 1, soon: 2, week: 3, later: 4, none: 5 }
const RISK_ORDER = { high: 0, medium: 1, low: 2 }
export const sortRows = (conflicts) => [...conflicts].sort((a, b) => (DUE_ORDER[a.dueBucket] ?? 5) - (DUE_ORDER[b.dueBucket] ?? 5) || (RISK_ORDER[a.severity] ?? 1) - (RISK_ORDER[b.severity] ?? 1))
// Where it stands, as an icon (said in its tooltip): ○ not asked yet, ◐ under way, ✓ done.
function StatusIcon({ status, label }) {
  const done = status === 'done'
  const going = !done && status !== 'detected'
  return (
    <span data-row-status={status} title={label} aria-label={label} role="img" className="flex size-4 items-center justify-center">
      {done ? <span className="flex size-3.5 items-center justify-center rounded-full bg-[var(--ds-accent)] text-slate-950"><Check className="size-2.5" strokeWidth={3.5} /></span>
        : going ? <svg viewBox="0 0 14 14" className="size-3.5"><circle cx="7" cy="7" r="6" fill="none" stroke="var(--ds-accent)" strokeWidth="1.5" /><path d="M7 1 A6 6 0 0 1 7 13 Z" fill="var(--ds-accent)" /></svg>
          : <span className="size-3.5 rounded-full border-[1.5px] border-slate-500" />}
    </span>
  )
}
const RISK_CHIP = { high: ['Risk high', 'bg-rose-400/[0.14] text-rose-300'], medium: ['Risk medium', 'bg-amber-300/[0.14] text-amber-200'] }
const HEADER_BUTTON = 'ds-intrinsic flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300'

// `focusScreenId`: the screen it was opened for (its count, pressed) — brought into view.
// `currentScreenId`: the screen the board is on — its group's name in the plain text colour.
// `host`: where it's docked (BoardDockSlot's element). `marked`: the change another view has picked (Design
// Compare's) — its row is marked as the picked one is. `compareItem`/`onOpenCompare`: the picked change's design
// set, and the way into its comparison (the icon in the detail's header).
export default function BoardConflicts({ groups, total, picked, onPick, onBack, onClose, focusScreenId = null, currentScreenId = null, host = null, marked = null, compareItem = null, onOpenCompare = null }) {
  const language = useLanguage()
  const listRef = useRef(null)
  // (The row whose detail was last open stays marked once back on the list — and takes the focus.)
  const [lastId, setLastId] = useState(picked?.id ?? null)
  if (picked && picked.id !== lastId) setLastId(picked.id)
  const [folded, setFolded] = useState(() => new Set())
  const toggle = (id) => setFolded((now) => { const next = new Set(now); if (next.has(id)) next.delete(id); else next.add(id); return next })
  useEffect(() => {
    if (picked) return
    const list = listRef.current
    const row = lastId && list?.querySelector(`[data-board-conflict="${CSS.escape(lastId)}"]`)
    if (row) { row.focus({ preventScroll: true }); row.scrollIntoView({ block: 'nearest' }) }
    else if (focusScreenId) list?.querySelector(`[data-board-conflicts-screen="${CSS.escape(focusScreenId)}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [focusScreenId, picked]) // eslint-disable-line react-hooks/exhaustive-deps
  // ↑ / ↓ move between rows; Enter opens one (it's a button).
  const onListKey = (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const rows = [...listRef.current.querySelectorAll('[data-board-conflict]')]
    const at = rows.indexOf(document.activeElement)
    const next = rows[at === -1 ? 0 : Math.max(0, Math.min(rows.length - 1, at + (event.key === 'ArrowDown' ? 1 : -1)))]
    if (next) { event.preventDefault(); next.focus() }
  }
  const panel = (
    <section
      data-board-chrome
      data-board-conflicts={picked ? 'detail' : 'list'}
      data-docked={host ? '' : undefined}
      aria-label="Changes on these screens"
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      className={host
        ? 'relative flex h-full flex-col overflow-hidden border-l border-white/[0.06] bg-background'
        : 'absolute inset-y-2 right-2 z-30 flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-background shadow-2xl shadow-black/50 animate-in fade-in slide-in-from-right-2 duration-200 motion-reduce:animate-none'}
      style={{ width: picked ? BOARD_DETAIL_WIDTH : BOARD_PANEL_WIDTH, maxWidth: host ? undefined : 'calc(100% - 16px)', '--background': '#1C1C1C' }}
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
        {picked && compareItem && onOpenCompare && (
          <button type="button" data-board-conflicts-compare onClick={() => onOpenCompare(compareItem)} aria-label={translateText('Open in Design Compare', language)} title={translateText('Open in Design Compare', language)} className={HEADER_BUTTON}><Layers3 className="size-4" /></button>
        )}
        <button type="button" data-board-conflicts-close onClick={onClose} aria-label="Close" title="Close" className={HEADER_BUTTON}><X className="size-4" /></button>
      </header>
      {picked ? (
        // (The change's own detail — the same as the pane's, in this panel's column.)
        <div data-board-conflict-detail className="min-h-0 flex-1 overflow-hidden">
          <ReviewDetail page conflict={picked} />
        </div>
      ) : (
        // The list, as an issue list: a group per screen (its name, then its number and how many — folding,
        // its header held at the top while its rows scroll by), and rows on fixed columns — status · title ·
        // due — over a second line of what kind of clash it is, with the risk as a chip when it's medium or high.
        <div ref={listRef} data-board-conflicts-list onKeyDown={onListKey} className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
          {groups.length === 0 && <p className="px-3 py-6 text-center text-xs text-slate-500"><LocalizedText text="No open changes on these screens." /></p>}
          {groups.map((group) => {
            const key = group.id ?? 'none'
            const open = !folded.has(key)
            const here = group.id && group.id === currentScreenId
            return (
              <section key={key} data-board-conflicts-screen={key} data-focus={group.id && group.id === focusScreenId ? '' : undefined} data-current={here ? '' : undefined} className="mt-4 scroll-mt-0">
                <h3 className="sticky top-0 z-10 m-0 bg-[#1C1C1C]">
                  <button type="button" data-group-toggle={key} aria-expanded={open} onClick={() => toggle(key)} className="ds-intrinsic flex h-7 w-full items-center gap-1.5 rounded-md px-1.5 text-left text-[12px] transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-emerald-300">
                    <ChevronDown aria-hidden className={cn('size-3.5 shrink-0 text-slate-500 transition-transform duration-150 motion-reduce:transition-none', !open && '-rotate-90')} />
                    <span data-group-name className={cn('min-w-0 truncate font-semibold', here ? 'text-slate-100' : 'text-slate-400')}><LocalizedText text={group.name} /></span>
                    <span data-group-meta className="shrink-0 font-normal text-slate-500 tabular-nums">{group.n != null ? `${group.n} · ${group.conflicts.length}` : group.conflicts.length}</span>
                  </button>
                </h3>
                {open && (
                  <ul className="m-0 mt-0.5 flex list-none flex-col gap-0.5 p-0">
                    {sortRows(group.conflicts).map((conflict) => {
                      const status = listStatusOf(conflict)
                      const { target, property } = rowTitleOf(conflict)
                      const due = shortDue(conflict.dueLabel)
                      const chip = RISK_CHIP[conflict.severity]
                      const selected = conflict.id === (marked ?? lastId)
                      return (
                        <li key={conflict.id}>
                          <button type="button" data-board-conflict={conflict.id} data-selected={selected ? '' : undefined} onClick={() => onPick(conflict)}
                            className={cn('ds-intrinsic grid h-[52px] w-full grid-cols-[16px_minmax(0,1fr)_56px] grid-rows-2 items-center gap-x-2.5 rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-emerald-300', selected ? 'bg-[var(--ds-surface-2)] ring-1 ring-[var(--ds-border-strong)] ring-inset' : 'hover:bg-white/[0.04]')}>
                            <StatusIcon status={status?.id ?? 'detected'} label={translateText(status?.label ?? '', language)} />
                            {/* (As the change names them — a component and its property aren't words to translate.) */}
                            <span data-row-title translate="no" title={property ? `${target} · ${property}` : target} className="flex min-w-0 items-baseline gap-1.5 text-[13px] leading-5">
                              <span data-row-target className="min-w-0 shrink-0 truncate font-medium text-slate-100" style={{ maxWidth: property ? '62%' : '100%' }}>{target}</span>
                              {property && <span data-row-property className="min-w-0 truncate text-slate-400">{property}</span>}
                            </span>
                            <span data-row-due={conflict.dueBucket} className={cn('justify-self-end text-right text-[12px] tabular-nums', conflict.dueBucket === 'overdue' ? 'font-semibold text-rose-400' : conflict.dueBucket === 'today' ? 'text-rose-400' : 'text-slate-500')}>{due && <LocalizedText text={due} />}</span>
                            <span data-row-kind className="col-start-2 flex min-w-0 items-center gap-1.5 text-[12px] leading-4 text-slate-500">
                              <span className="truncate"><LocalizedText text={rowKindOf(conflict)} /></span>
                              {chip && <span data-row-risk={conflict.severity} className={cn('shrink-0 rounded px-1.5 text-[11px] leading-[18px] font-medium', chip[1])}><LocalizedText text={chip[0]} /></span>}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}
    </section>
  )
  return host ? createPortal(panel, host) : panel
}
