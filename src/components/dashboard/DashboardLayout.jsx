import { cn } from 'cn'
import Sidebar from '@/components/dashboard/Sidebar'
import SidebarSecondary from '@/components/dashboard/SidebarSecondary'
import DashboardTopBar from '@/components/dashboard/DashboardTopBar'

// Shared chrome for every dashboard-level page (Dashboard, Projects,
// Activity, ...): the icon-only Sidebar plus SidebarSecondary's labeled
// panel beside it (Slack's icon-rail + always-open channel-list
// pattern), then top bar + content. The right rail column only reserves
// space when a page actually has one — a page with no `rightColumn`
// gets the full width instead of a blank 280/320px gap. Content is
// capped with `max-w` + `mx-auto` so it stays comfortable to scan on
// ultra-wide monitors instead of stretching edge to edge, with
// generous, responsive horizontal padding at every breakpoint.
function DashboardLayout({ children, rightColumn }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <SidebarSecondary />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardTopBar />

        <div className="flex-1 overflow-auto">
          <div
            className={cn(
              'mx-auto grid max-w-[1680px] grid-cols-1 gap-8 px-6 py-8 sm:px-10 lg:px-14',
              rightColumn && 'lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px]'
            )}
          >
            <div className="flex min-w-0 flex-col gap-8">{children}</div>
            {rightColumn && <div className="flex min-w-0 flex-col gap-6">{rightColumn}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardLayout
