import { Search, X } from 'lucide-react'
import { cn } from 'cn'
import { Skeleton } from '@/components/ui/skeleton'
import { LocalizedText } from '@/i18n/runtime'
import { translateText } from '@/i18n/translate'
import { useLanguage } from '@/i18n/language'

// The parts both list drawers (Conflict Points, History) are made of, so they
// read as one product: a fixed top (search, one line of filters) over a list
// that alone scrolls — groups with a small sticky caption, rows of one height
// with a title line and a meta line.
//
// Color: a drawer says things in white and slate. The one exception is the
// caller's own (History's amber "check the change"); nothing here is green or
// yellow.

// One height for every row, so a rail drawn beside them (History's graph)
// lines up with the text: the title line's center is 20px down.
export const ROW_HEIGHT = 56
export const TITLE_CENTER = 20
// A group's caption.
export const GROUP_HEIGHT = 28

// The number beside a drawer's title.
export function DrawerCount({ count, ...rest }) {
  return <span {...rest} className="ml-1.5 font-normal text-slate-500 tabular-nums">{count}</span>
}

// The drawer: its top stays, its list scrolls. ↑ / ↓ move between the rows
// (from the search too); Enter or Space on a row opens it.
export function DrawerShell({ top, children, ...rest }) {
  function onKeyDown(event) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    if (event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return
    const rows = [...event.currentTarget.querySelectorAll('[data-drawer-row]')]
    if (!rows.length) return
    const at = rows.indexOf(document.activeElement)
    const next = at === -1 ? (event.key === 'ArrowDown' ? rows[0] : null) : rows[at + (event.key === 'ArrowDown' ? 1 : -1)]
    if (!next) return
    event.preventDefault()
    next.focus()
    next.scrollIntoView({ block: 'nearest' })
  }
  return (
    <div {...rest} onKeyDown={onKeyDown} className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0">{top}</div>
      <div data-drawer-scroll className="min-h-0 flex-1 overflow-y-auto pb-2">{children}</div>
    </div>
  )
}

// The same search in both: 32px, a quiet fill, no border.
export function DrawerSearch({ value, onChange, placeholder, label }) {
  const language = useLanguage()
  return (
    <div className="relative mb-2">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-500" />
      <input
        type="search"
        data-drawer-search
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Escape' && value) { event.stopPropagation(); onChange('') } }}
        className="h-8 w-full min-w-0 appearance-none rounded-full bg-white/[0.06] pr-8 pl-8 text-xs text-foreground outline-none placeholder:text-slate-500 focus-visible:bg-white/[0.08] [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && <button type="button" aria-label={translateText('Clear search', language)} onClick={() => onChange('')} className="absolute top-1/2 right-2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-slate-500 hover:text-white"><X className="size-3" /></button>}
    </div>
  )
}

// A filter: one shape for every one — a button or a menu's trigger. On, it's
// filled; off, a plain label (the menu's arrow says it can be opened).
// (Capsules, as every control in the Workspace's rows.)
export const chipClass = (on = false) => cn('ds-intrinsic inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-white/60', on ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/[0.06] hover:text-white')

// The filters, on one line.
export function DrawerFilters({ children, label, ...rest }) {
  // (`@container`: in the narrowest drawer a filter's count steps aside — `@max-[250px]:hidden` — so every filter stays.)
  return <div className="@container mb-1"><div role="group" aria-label={label} data-drawer-filters {...rest} className="flex h-7 flex-nowrap items-center gap-0.5 overflow-hidden">{children}</div></div>
}

// A group's caption: small, in view while its rows pass under it. `lead` is
// whatever stands in the row's left column (a rail).
export function DrawerGroup({ label, lead = null, children, ...rest }) {
  return (
    <section data-drawer-group={label} {...rest}>
      <h4 style={{ height: GROUP_HEIGHT }} className="sticky top-0 z-10 flex items-center bg-background text-[12px] leading-4 font-semibold text-slate-400">
        {lead}
        <span className="px-3"><LocalizedText text={label} /></span>
      </h4>
      {children}
    </section>
  )
}

// A title that says so when it's cut: the full text on hover.
function Title({ children, ...rest }) {
  return (
    <span
      data-row-title
      {...rest}
      onMouseEnter={(event) => { const el = event.currentTarget; el.title = el.scrollWidth > el.clientWidth ? el.textContent : '' }}
      className="min-w-0 flex-1 truncate text-[13px] leading-5 font-medium text-slate-100"
    >{children}</span>
  )
}

// A row: title and time on the first line, meta under it. 56px, 12px at the
// sides, no rule between rows; hover is a faint fill, the selected row a
// stronger one (no bar at its left) — nothing that moves its layout.
// `title` / `time` / `meta` are nodes; `timeStrong` lifts the time to white.
export function DrawerRow({ title, titleAdornment = null, time = null, timeStrong = false, meta, selected = false, onOpen, className, children, ...rest }) {
  return (
    <div
      role="button"
      tabIndex={0}
      data-drawer-row
      aria-current={selected ? 'true' : undefined}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return
        event.preventDefault()
        onOpen?.()
      }}
      style={{ height: ROW_HEIGHT }}
      {...rest}
      className={cn('relative flex w-full min-w-0 cursor-pointer flex-col justify-center rounded-[14px] px-3 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white/60 data-[pin-hover]:bg-white/[0.04] aria-[current=true]:bg-white/[0.08]', className)}
    >
      <span className="flex h-5 min-w-0 items-center gap-2">
        <Title>{title}</Title>
        {titleAdornment}
        {time != null && <span data-row-time className={cn('shrink-0 text-[11.5px] tabular-nums', timeStrong ? 'font-medium text-white' : 'text-slate-500')}>{time}</span>}
      </span>
      {/* (Under the title, a step down: smaller and quieter, so the title leads — as the change list's rows.) */}
      <span data-row-meta className="flex h-4 min-w-0 items-center gap-1.5 text-[11.5px] text-slate-500">{meta}</span>
      {children}
    </div>
  )
}

// Nothing to list: one line, and — when a filter or a search is what hides
// the rest — the way out of it.
export function DrawerEmpty({ children, onClear = null, icon: Icon = null }) {
  return (
    <div role="status" data-drawer-empty className="flex flex-col items-center gap-2 px-3 py-8 text-center text-xs text-slate-400">
      {Icon && <Icon className="size-5 text-slate-500" />}
      <p>{children}</p>
      {onClear && <button type="button" data-drawer-clear onClick={onClear} className={chipClass(false)}><LocalizedText text="Clear all filters" /></button>}
    </div>
  )
}

// While a list isn't there yet: rows of the same shape.
export function DrawerSkeleton({ count = 6 }) {
  return (
    <div data-drawer-skeleton aria-hidden className="flex flex-col">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} style={{ height: ROW_HEIGHT }} className="flex flex-col justify-center gap-1.5 px-3">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-2.5 w-1/2" />
        </div>
      ))}
    </div>
  )
}
