import DashboardLayout from '@/components/dashboard/DashboardLayout'
import ProjectsSection from '@/components/dashboard/ProjectsSection'

// Home: the project hub. One clean grid of every project (with create,
// grid/list and bulk select) to pick where to work — no dashboard widgets.
// Opening a project lands on its overview. It replaces the separate All
// projects page, which now redirects here.
function DashboardPage() {
  return (
    <DashboardLayout>
      <ProjectsSection />
    </DashboardLayout>
  )
}

export default DashboardPage
