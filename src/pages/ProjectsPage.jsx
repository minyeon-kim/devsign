import DashboardLayout from '@/components/dashboard/DashboardLayout'
import ProjectProgressCards from '@/components/dashboard/ProjectProgressCards'
import ConflictChecklist from '@/components/dashboard/ConflictChecklist'
import TeamMembers from '@/components/dashboard/TeamMembers'
import ConflictActivityChart from '@/components/dashboard/ConflictActivityChart'
import ProjectsSection from '@/components/dashboard/ProjectsSection'
import ProfileCard from '@/components/dashboard/ProfileCard'
import MergeSchedule from '@/components/dashboard/MergeSchedule'

function ProjectsPage() {
  return (
    <DashboardLayout
      rightColumn={
        <>
          <ProfileCard />
          <MergeSchedule />
        </>
      }
    >
      <ProjectProgressCards />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ConflictChecklist />
        <div className="flex flex-col gap-4">
          <TeamMembers />
          <ConflictActivityChart />
        </div>
      </div>

      <ProjectsSection />
    </DashboardLayout>
  )
}

export default ProjectsPage
