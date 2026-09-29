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
// handlers, placeholder, …) passes straight to the input.
function SearchField({ className, children, ...inputProps }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 z-10 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        {...inputProps}
        className="h-8 w-full rounded-full border-0! bg-muted/60 pr-3 pl-8 text-xs transition-colors hover:bg-muted dark:bg-muted/60 dark:hover:bg-muted dark:focus-visible:bg-muted"
      />
      {children}
    </div>
  )
}

export default SearchField
