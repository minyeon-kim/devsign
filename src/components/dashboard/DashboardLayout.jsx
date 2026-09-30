import { cn } from 'cn'
import AppShell from '@/components/dashboard/AppShell'
import DashboardTopBar from '@/components/dashboard/DashboardTopBar'

// Shared chrome for every dashboard-level page (Dashboard, Projects,
// Activity, ...): AppShell's full-width top bar over the icon rail +
// collapsible labeled drawer, then the page content. The right rail column only reserves
// space when a page actually has one — a page with no `rightColumn`
// gets the full width instead of a blank 280/320px gap. Content is
// capped with `max-w` + `mx-auto` so it stays comfortable to scan on
// ultra-wide monitors instead of stretching edge to edge, with
// generous, responsive horizontal padding at every breakpoint.
function DashboardLayout({ children, rightColumn, projectProportions = false }) {
  return (
    <AppShell topBar={<DashboardTopBar />}>
      <div className="flex-1 overflow-auto" style={{ backgroundColor: '#070708' }}>
        <div
          className={cn(
            'mx-auto grid grid-cols-1 px-6 py-8 sm:px-10',
            projectProportions ? 'max-w-[1180px] gap-6' : 'max-w-[1680px] gap-8 lg:px-14',
            rightColumn && !projectProportions && 'lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px]'
          )}
        >
          <div className={cn('flex min-w-0 flex-col', projectProportions ? 'gap-6' : 'gap-8')}>{children}</div>
          {rightColumn && (
            <div className={cn('min-w-0 gap-6', projectProportions ? 'grid grid-cols-1 md:grid-cols-3' : 'flex flex-col')}>
              {rightColumn}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

export default DashboardLayout
