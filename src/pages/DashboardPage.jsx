import DashboardLayout from '@/components/dashboard/DashboardLayout'
import ProjectsSection from '@/components/dashboard/ProjectsSection'
import MyTasks from '@/components/dashboard/MyTasks'

// Home: what needs you first (My tasks — review requests sent to you and
// conflicts you have to decide, most pressing first), then the project hub: one
// grid of every project (with create, grid/list and bulk select).
// Opening a project lands on its overview. It replaces the separate All
// projects page, which now redirects here.
function DashboardPage() {
  return (
    <DashboardLayout projectProportions>
      <MyTasks />
      <ProjectsSection />
    </DashboardLayout>
  )
}

export default DashboardPage
