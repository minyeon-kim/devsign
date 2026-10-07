import DashboardLayout from '@/components/dashboard/DashboardLayout'
import ProjectsSection from '@/components/dashboard/ProjectsSection'

// Home: the project hub — one grid of every project (with create,
// grid/list and bulk select). Opening a project lands on its overview. It
// replaces the separate All projects page, which now redirects here.
function DashboardPage() {
  return (
    <DashboardLayout projectProportions>
      <ProjectsSection />
    </DashboardLayout>
  )
}

export default DashboardPage
