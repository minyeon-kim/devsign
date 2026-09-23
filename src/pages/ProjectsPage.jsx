import DashboardLayout from '@/components/dashboard/DashboardLayout'
import HeroSection from '@/components/dashboard/HeroSection'
import StatsGrid from '@/components/dashboard/StatsGrid'
import ProjectsSection from '@/components/dashboard/ProjectsSection'
import RecentActivity from '@/components/dashboard/RecentActivity'
import AIInsights from '@/components/dashboard/AIInsights'
import GettingStarted from '@/components/dashboard/GettingStarted'

function ProjectsPage() {
  return (
    <DashboardLayout
      rightColumn={
        <>
          <RecentActivity />
          <AIInsights />
          <GettingStarted />
        </>
      }
    >
      <HeroSection />
      <StatsGrid />
      <ProjectsSection />
    </DashboardLayout>
  )
}

export default ProjectsPage
