import { Search } from 'lucide-react'
import { cn } from 'cn'
import { Input } from '@/components/ui/input'

// The app's one search bar — the Home dashboard's design, shared by the
// dashboard top bar and the Workspace header so both read identically:
// a compact 32px capsule, soft muted fill that brightens on hover/focus, a faint
// white hairline for crisp separation from whatever sits behind it (page
// or canvas), 13px text, and the icon inset on the left. `className`
// sizes/positions the wrapper; extra `children` (e.g. a results popover)
// render inside it, anchored below the field. Everything else (value,
// handlers, placeholder, …) passes straight to the input. `shortcut` shows
// the key that focuses it ("⌘K") at its right, while it's empty.
function SearchField({ className, children, shortcut, ...inputProps }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 z-10 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        {...inputProps}
        className={cn('ds-header-search h-8 w-full rounded-full border-0! bg-muted/60 pl-8', shortcut ? 'pr-12' : 'pr-3', ' text-xs transition-colors hover:bg-muted dark:bg-muted/60 dark:hover:bg-muted dark:focus-visible:bg-muted')}
      />
      {shortcut && !inputProps.value && (
        <kbd translate="no" aria-hidden className="pointer-events-none absolute top-1/2 right-2.5 z-10 -translate-y-1/2 rounded-md border border-white/[0.14] bg-white/[0.04] px-1.5 py-px font-sans text-[10.5px] leading-4 font-medium text-slate-400">{shortcut}</kbd>
      )}
      {children}
    </div>
  )
}

export default SearchField
