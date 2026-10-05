import { useState } from 'react'
import { ArrowLeft, CalendarDays, Check, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react'
import { cn } from 'cn'
import { allPeople, mergeConflictLevels, mergeFilterTags } from '@/data/mockData'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CATEGORY_TAB, CATEGORY_TAB_ACTIVE, CATEGORY_TAB_IDLE, COUNT_BADGE } from '@/components/mergestudio/floatingStyles'
import { RangeCalendar, dueSummary } from '@/components/mergestudio/RangeCalendar'
import { DUE_PRESETS, EMPTY_DUE, EMPTY_FILTERS, activeFilterCount, isDueActive } from '@/components/mergestudio/mergeFilters'
import { LocalizedText } from '@/i18n/runtime'

// Plus "In Review" — the status an item gets once its PR is opened.
const STATUS_OPTIONS = [...new Set([...mergeFilterTags.filter((t) => t !== 'All'), 'In Review'])]
const CONFLICT_OPTIONS = mergeConflictLevels.filter((c) => c !== 'Any')

function toggle(list, v) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

// A small ghost toggle pill — the one control every filter section uses.
function Toggle({ on, onClick, className, children }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'flex h-7 min-w-0 items-center justify-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium whitespace-nowrap transition-colors',
        on ? 'bg-white/[0.08] text-foreground ring-1 ring-inset ring-white/20' : 'text-muted-foreground ring-1 ring-inset ring-white/10 hover:bg-white/[0.04] hover:text-foreground',
        className
      )}
    >
      {children}
    </button>
  )
}

// A quiet label over its options — the options are what's read first.
// `columns`: lay the chips out on an even grid instead of wrapping freely,
// so a row never ends with one stray chip.
const SECTION_LABEL = 'text-[10.5px] leading-4 font-medium text-slate-500'

function Section({ title, aside, columns, children }) {
  return (
    <section className="space-y-1.5">
      <div className="flex h-4 items-center justify-between">
        <span className={SECTION_LABEL}><LocalizedText text={title} /></span>
        {aside}
      </div>
      <div className={columns ? 'grid gap-1.5' : 'flex flex-wrap gap-1.5'} style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}>{children}</div>
    </section>
  )
}

function Avatar({ person, className }) {
  return (
    <span className={cn('flex size-4 shrink-0 items-center justify-center rounded-full text-[7px] font-semibold text-white', person.colorClass, className)}>
      <LocalizedText text={person.initials} />
    </span>
  )
}

// Everyone who can be an assignee: the workspace's members, plus anyone
// still assigned on an item who isn't one of them any more (shown by id),
// so the list grows with the team instead of being a fixed set of chips.
// Sorted by how many items each person has, then name.
function assigneeDirectory(items) {
  const counts = {}
  for (const item of items) if (item.assigneeId) counts[item.assigneeId] = (counts[item.assigneeId] ?? 0) + 1
  const known = allPeople.map((p) => ({ ...p, count: counts[p.id] ?? 0 }))
  const unknown = Object.keys(counts)
    .filter((id) => !allPeople.some((p) => p.id === id))
    .map((id) => ({ id, name: id, initials: id.slice(0, 2).toUpperCase(), colorClass: 'bg-slate-600', count: counts[id] }))
  return [...known, ...unknown].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

// Searchable, scrollable people picker (checkbox rows) — scales past a
// handful of teammates, unlike a row of chips.
// `plain`: avatar · name · count only — the row itself shows it's picked.
function AssigneePicker({ items, value, onChange, plain = false }) {
  const [q, setQ] = useState('')
  const people = assigneeDirectory(items)
  const shown = people.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <div className="space-y-1">
      {people.length > 5 && (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find people…"
            className="h-7 w-full rounded-full border border-white/10 bg-slate-900 pr-2.5 pl-7 text-[11px] outline-none focus:ring-1 focus:ring-emerald-400"
          />
        </div>
      )}
      <div className="max-h-36 space-y-0.5 overflow-y-auto">
        {shown.map((p) => {
          const on = value.includes(p.id)
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(toggle(value, p.id))}
              className={cn('flex h-8 w-full items-center gap-2 rounded-lg px-1.5 text-left text-xs text-foreground hover:bg-white/5', plain && on && 'bg-white/[0.08] ring-1 ring-white/15 ring-inset hover:bg-white/[0.1]')}
            >
              {!plain && <span className={cn('flex size-4 shrink-0 items-center justify-center rounded border', on ? 'border-foreground bg-foreground text-background' : 'border-white/20')}>
                {on && <Check className="size-3" />}
              </span>}
              <Avatar person={p} className="size-5 text-[8px]" />
              <span className="min-w-0 flex-1 truncate"><LocalizedText text={p.name} /></span>
              {/* Its own pill, not inline text — so a long name truncating
                  never takes the role with it, and "Designer"/"Developer"
                  stays a clearly separate, always-visible fact about who
                  you're filtering by, not an easy-to-miss suffix. */}
              {p.role && !plain && (
                <span className="shrink-0 rounded-full bg-white/[0.06] px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                  <LocalizedText text={p.role} />
                </span>
              )}
              <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">{p.count}</span>
            </button>
          )
        })}
        {shown.length === 0 && <p className="px-1.5 py-2 text-[11px] text-muted-foreground">No one matches “{q}”.</p>}
      </div>
    </div>
  )
}

// The Merge List's filters behind one pill button beside the search box
// (Linear-style): Status, Assignee, Conflict and Due. The main view stays
// compact — the custom-range calendar is its own view, opened from "Custom
// range…" with a Back button, rather than always taking up the menu. An
// item passes when it matches every category that has a selection.
// `simple` (the Conflict Points list): three sections only — Assignee,
// Severity, Due. Status is left to the tabs above the list, the level
// section is named like the list's column and has no "None", and the
// reset sits at the bottom.
export function MergeFilterButton({ value, onChange, items = [], markedDays = [], compact = false, simple = false, statusOptions = STATUS_OPTIONS }) {
  const [view, setView] = useState('main')
  const count = activeFilterCount(value)
  const set = (key, v) => onChange({ ...value, [key]: v })

  return (
    <Popover onOpenChange={(open) => !open && setView('main')}>
      <PopoverTrigger
        title="Filter"
        aria-label={count ? `Filter (${count} active)` : 'Filter'}
        className={
          compact
            ? // Sized to match the small category-tab chips it sits beside
              // (ConflictPanel's filter row) instead of its own, bulkier
              // 32px pill meant for standing next to a search field.
              cn(
                CATEGORY_TAB,
                'h-6 gap-1 px-2 text-xs',
                count ? CATEGORY_TAB_ACTIVE : CATEGORY_TAB_IDLE
              )
            : // A pill matching the search input beside it: same 32px height,
              // fully rounded, same borderless soft fill.
              cn(
                'flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
                count ? 'bg-white/[0.09] text-[#FFFFFF]' : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.08] hover:text-white'
              )
        }
      >
        <SlidersHorizontal className={compact ? 'size-3' : 'size-3.5'} />
        Filter
        {count > 0 && <span className={cn(COUNT_BADGE, 'h-4 min-w-4 bg-foreground px-1 text-[9px] text-background')}>{count}</span>}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-3.5 rounded-xl border border-white/10 bg-card/95 p-3 backdrop-blur-xl">
        {view === 'range' ? (
          <>
            <div className="flex h-7 items-center gap-1.5">
              <button
                type="button"
                title="Back to filters"
                onClick={() => setView('main')}
                className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-white/5 hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" />
              </button>
              <span className="flex-1 text-xs font-semibold text-foreground"><LocalizedText text="Custom due range" /></span>
              {value.due.range && (
                <button
                  type="button"
                  onClick={() => set('due', { ...value.due, range: null })}
                  className="flex h-6 items-center justify-center rounded-full px-2 text-[11px] text-muted-foreground hover:bg-white/5 hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
            <RangeCalendar range={value.due.range} onChange={(range) => set('due', { ...value.due, range })} markedDays={markedDays} />
            <button
              type="button"
              onClick={() => setView('main')}
              className="flex h-8 w-full items-center justify-center rounded-full border border-white/15 text-xs font-medium text-foreground hover:border-white/25 hover:bg-white/[0.07]"
            >
              Done
            </button>
          </>
        ) : (
          <>
            {!simple && (
              <Section title="Status">
                {statusOptions.map((s) => (
                  <Toggle key={s} on={value.status.includes(s)} onClick={() => set('status', toggle(value.status, s))}>
                    <LocalizedText text={s} />
                  </Toggle>
                ))}
              </Section>
            )}
            <section className="space-y-1.5">
              <div className="flex h-4 items-center">
                <span className={SECTION_LABEL}><LocalizedText text="Assignee" /></span>
              </div>
              <AssigneePicker plain={simple} items={items} value={value.assignee} onChange={(v) => set('assignee', v)} />
            </section>
            <Section title={simple ? 'Severity' : 'Conflict'} columns={simple ? 3 : undefined}>
              {CONFLICT_OPTIONS.filter((c) => !simple || c !== 'None').map((c) => (
                <Toggle key={c} on={value.conflict.includes(c)} onClick={() => set('conflict', toggle(value.conflict, c))}>
                  <LocalizedText text={c} />
                </Toggle>
              ))}
            </Section>
            <Section title={simple ? 'Due date' : 'Due'} columns={simple ? 2 : undefined}>
              {DUE_PRESETS.map((p) => (
                <Toggle key={p.id} on={value.due.presets.includes(p.id)} onClick={() => set('due', { ...value.due, presets: toggle(value.due.presets, p.id) })}>
                  <LocalizedText text={p.label} />
                </Toggle>
              ))}
              <Toggle on={!!value.due.range} onClick={() => setView('range')} className={simple ? 'col-span-2' : undefined}>
                <CalendarDays className="size-3" />
                {value.due.range
                  ? <LocalizedText text={dueSummary({ ...EMPTY_DUE, range: value.due.range })} />
                  : <LocalizedText text="Custom range…" />}
              </Toggle>
            </Section>
            {simple ? (
              // Always there, so it doesn't appear and shift the menu.
              <div className="-mx-3 -mb-3 flex items-center justify-between border-t border-white/[0.07] px-3 py-2">
                <span className="text-[11px] text-slate-500 tabular-nums">{count > 0 && <LocalizedText text={`${count} applied`} />}</span>
                <button
                  type="button"
                  disabled={count === 0}
                  onClick={() => onChange(EMPTY_FILTERS)}
                  className="flex h-7 items-center justify-center gap-1 rounded-full px-2.5 text-[11px] font-medium text-slate-200 transition-colors hover:bg-white/[0.07] hover:text-white disabled:pointer-events-none disabled:text-slate-600"
                >
                  <RotateCcw className="size-3" />
                  <LocalizedText text="Reset" />
                </button>
              </div>
            ) : count > 0 && (
              <button
                type="button"
                onClick={() => onChange(EMPTY_FILTERS)}
                className="flex h-7 w-full items-center justify-center rounded-full text-[11px] font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground"
              >
                Clear all filters
              </button>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}

// Active-filter bar under the search row, shown only while the list is
// narrowed (search text or any filter): "N of M" plus each criterion as a
// removable chip, and one "Clear filters" that resets everything,
// search included.
export function ActiveFilterChips({ value, onChange, query = '', onClearQuery, shown, total }) {
  const q = query.trim()
  const chips = [
    ...(q ? [{ key: 'q', label: `“${q}”`, remove: onClearQuery }] : []),
    ...value.status.map((s) => ({ key: `s:${s}`, label: s, remove: () => onChange({ ...value, status: value.status.filter((x) => x !== s) }) })),
    ...value.assignee.map((id) => ({
      key: `a:${id}`,
      label: allPeople.find((p) => p.id === id)?.name ?? id,
      remove: () => onChange({ ...value, assignee: value.assignee.filter((x) => x !== id) }),
    })),
    ...value.conflict.map((c) => ({ key: `c:${c}`, label: `${c} conflict`, remove: () => onChange({ ...value, conflict: value.conflict.filter((x) => x !== c) }) })),
    ...(isDueActive(value.due) ? [{ key: 'due', label: dueSummary(value.due), remove: () => onChange({ ...value, due: EMPTY_DUE }) }] : []),
  ]
  if (!chips.length) return null
  return (
    <div className="space-y-1.5">
      {/* Flat against the panel — no box: a count, and an inline link. */}
      <div className="flex h-5 items-center justify-between px-1">
        <span className="text-[11px] text-muted-foreground">
          Showing <span className="font-medium text-foreground tabular-nums">{shown}</span> of <span className="tabular-nums">{total}</span>
        </span>
        <button
          type="button"
          onClick={() => {
            onChange(EMPTY_FILTERS)
            onClearQuery?.()
          }}
          className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Clear filters
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {chips.map((c) => (
          <span key={c.key} className="flex h-6 max-w-full items-center gap-1 rounded-full bg-white/[0.06] pr-1 pl-2.5 text-[11px] text-foreground ring-1 ring-inset ring-white/10">
            <span className="truncate"><LocalizedText text={c.label} /></span>
            <button
              type="button"
              title={`Remove ${c.label}`}
              onClick={c.remove}
              className="flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}
