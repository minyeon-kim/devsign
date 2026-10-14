import { cn } from 'cn'
import Breadcrumb from '@/components/layout/Breadcrumb'

// The one top bar, the same on every screen (Home, a project's home, the Workspace): 48px, three columns —
// where you are (the path) at the left, the search (⌘K) in the middle at up to 480px, and that screen's
// actions at the right (who else is here, then the bell, then what only that screen has). You are not in it:
// you're the rail's avatar at the bottom left.
export default function AppTopBar({ crumbs, search = null, actions = null, className, ...rest }) {
  return (
    <header data-app-top-bar className={cn('grid h-[var(--ds-chrome-size)] w-full shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,480px)_minmax(0,1fr)] items-center gap-3 px-4', className)} {...rest}>
      <div className="flex min-w-0 items-center"><Breadcrumb items={crumbs} className="text-[13px]" /></div>
      <div className="min-w-0">{search}</div>
      <div className="flex min-w-0 items-center justify-end gap-2">{actions}</div>
    </header>
  )
}
