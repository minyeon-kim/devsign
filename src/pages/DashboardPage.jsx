import DashboardLayout from '@/components/dashboard/DashboardLayout'
import ProjectsSection from '@/components/dashboard/ProjectsSection'
import ReviewQueue from '@/components/dashboard/ReviewQueue'

// Home: what's waiting on your review across projects (ReviewQueue), then the project hub — one grid of every project (with create,
// grid/list and bulk select). Opening a project lands on its overview. It
// replaces the separate All projects page, which now redirects here.
function DashboardPage() {
  return (
    <DashboardLayout projectProportions>
      {/* (What's waiting on you first, then every project.) */}
      <ReviewQueue />
      <ProjectsSection />
    </DashboardLayout>
  )
}

export default DashboardPage
