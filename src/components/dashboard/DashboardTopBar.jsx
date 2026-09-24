import { Bell, ChevronDown, Search } from 'lucide-react'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { currentUser } from '@/data/mockData'

// The dashboard's own top bar — distinct from the in-workspace `TopBar`
// (src/components/layout/TopBar.jsx). Search and the notification icon are
// visual-only, per the dashboard brief.
function DashboardTopBar() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-card/60 px-6">
      <div className="relative w-full max-w-[520px]">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search projects, files, or members..."
          className="h-9 w-full pl-8 text-xs"
        />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-4">
        <button
          type="button"
          title="Notifications"
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Bell className="size-4" />
        </button>

        <button
          type="button"
          className="flex items-center gap-2 rounded-full py-1 pr-1 pl-1.5 transition-colors hover:bg-muted"
        >
          <Avatar size="sm">
            <AvatarFallback className={cn('text-[10px] font-medium text-white', currentUser.colorClass)}>
              {currentUser.initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden text-left leading-tight sm:block">
            <p className="text-[12px] font-medium text-foreground">{currentUser.name}</p>
            <p className="text-[11px] text-muted-foreground">{currentUser.team}</p>
          </div>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </div>
    </header>
  )
}

export default DashboardTopBar
