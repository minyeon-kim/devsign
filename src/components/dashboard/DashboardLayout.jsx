import Sidebar from '@/components/dashboard/Sidebar'
import DashboardTopBar from '@/components/dashboard/DashboardTopBar'

// Shared chrome for every dashboard-level page (Projects, Activity, ...):
// Sidebar + top bar + a two-column content grid (main column / right rail).
function DashboardLayout({ children, rightColumn }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardTopBar />

        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-1 gap-6 px-8 py-6 lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_320px]">
            <div className="flex min-w-0 flex-col gap-6">{children}</div>
            <div className="flex min-w-0 flex-col gap-4">{rightColumn}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardLayout
