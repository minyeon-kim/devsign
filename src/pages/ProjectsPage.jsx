import DashboardLayout from '@/components/dashboard/DashboardLayout'
import HeroSection from '@/components/dashboard/HeroSection'
import StatsGrid from '@/components/dashboard/StatsGrid'
import ProjectsSection from '@/components/dashboard/ProjectsSection'
import AIInsights from '@/components/dashboard/AIInsights'
import GettingStarted from '@/components/dashboard/GettingStarted'

function ProjectsPage() {
  return (
    <DashboardLayout
      rightColumn={
        <>
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
