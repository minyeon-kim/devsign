import DashboardLayout from '@/components/dashboard/DashboardLayout'
import ProjectProgressCards from '@/components/dashboard/ProjectProgressCards'
import ConflictChecklist from '@/components/dashboard/ConflictChecklist'
import TeamMembers from '@/components/dashboard/TeamMembers'
import ConflictActivityChart from '@/components/dashboard/ConflictActivityChart'
import MergeSchedule from '@/components/dashboard/MergeSchedule'

function DashboardPage() {
  return (
    <DashboardLayout rightColumn={<MergeSchedule />}>
      <ProjectProgressCards />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ConflictChecklist />
        <div className="flex flex-col gap-6">
          <TeamMembers />
          <ConflictActivityChart />
        </div>
      </div>
    </DashboardLayout>
  )
}

export default DashboardPage
