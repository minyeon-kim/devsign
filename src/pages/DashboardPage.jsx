import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import ProjectProgressCards from '@/components/dashboard/ProjectProgressCards'
import ConflictChecklist from '@/components/dashboard/ConflictChecklist'
import TeamMembers from '@/components/dashboard/TeamMembers'
import ConflictActivityChart from '@/components/dashboard/ConflictActivityChart'
import MergeSchedule from '@/components/dashboard/MergeSchedule'
import { Skeleton } from '@/components/ui/skeleton'

// Brief, one-time skeleton pass on first mount — there's no real fetch
// behind any of this (mock data only), but a SaaS dashboard that renders
// instantly on every load reads as static; this is just enough delay to
// make the widgets feel loaded rather than baked into the page.
const INITIAL_LOAD_MS = 350

function DashboardSkeleton() {
  return (
    <DashboardLayout rightColumn={<Skeleton className="h-80 w-full rounded-xl" />}>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <div className="flex flex-col gap-6">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </div>
    </DashboardLayout>
  )
}

function DashboardPage() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), INITIAL_LOAD_MS)
    return () => clearTimeout(timer)
  }, [])

  if (loading) return <DashboardSkeleton />

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
