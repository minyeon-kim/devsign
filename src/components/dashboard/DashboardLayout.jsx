import { cn } from 'cn'
import Sidebar from '@/components/dashboard/Sidebar'
import DashboardTopBar from '@/components/dashboard/DashboardTopBar'

// Shared chrome for every dashboard-level page (Dashboard, Projects,
// Activity, ...): Sidebar + top bar + content. The right rail column
// only reserves space when a page actually has one — a page with no
// `rightColumn` gets the full width instead of a blank 280/320px gap.
function DashboardLayout({ children, rightColumn }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardTopBar />

        <div className="flex-1 overflow-auto">
          <div
            className={cn(
              'grid grid-cols-1 gap-6 px-8 py-6',
              rightColumn && 'lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_320px]'
            )}
          >
            <div className="flex min-w-0 flex-col gap-6">{children}</div>
            {rightColumn && <div className="flex min-w-0 flex-col gap-4">{rightColumn}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardLayout
