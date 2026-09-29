import DashboardLayout from '@/components/dashboard/DashboardLayout'
import ProjectsSection from '@/components/dashboard/ProjectsSection'
import ReviewQueue from '@/components/dashboard/ReviewQueue'

// Home: what needs you first (Your queue — reviews you owe, high-risk
// items, approved changes waiting to merge), then the project hub: one
// grid of every project (with create, grid/list and bulk select).
// Opening a project lands on its overview. It replaces the separate All
// projects page, which now redirects here.
function DashboardPage() {
  return (
    <DashboardLayout>
      <ReviewQueue />
      <ProjectsSection />
    </DashboardLayout>
  )
}

export default DashboardPage
