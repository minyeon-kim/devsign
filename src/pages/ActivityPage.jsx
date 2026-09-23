import { useMemo, useState } from 'react'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import ActivityFilterBar from '@/components/activity/ActivityFilterBar'
import ActivityRow from '@/components/activity/ActivityRow'
import ActivityOverview from '@/components/activity/ActivityOverview'
import MostActiveProjects from '@/components/activity/MostActiveProjects'
import StayInSync from '@/components/activity/StayInSync'
import { activities, activityDateGroups } from '@/data/mockData'

function ActivityPage() {
  const [activeFilter, setActiveFilter] = useState('all')

  const groupedActivities = useMemo(() => {
    const filtered =
      activeFilter === 'all' ? activities : activities.filter((a) => a.type === activeFilter)

    return activityDateGroups
      .map((group) => ({
        ...group,
        items: filtered.filter((a) => a.dateGroup === group.id),
      }))
      .filter((group) => group.items.length > 0)
  }, [activeFilter])

  return (
    <DashboardLayout
      rightColumn={
        <>
          <ActivityOverview />
          <MostActiveProjects />
          <StayInSync />
        </>
      }
    >
      <div>
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Activity
        </p>
        <h1 className="mt-1 text-[32px] font-semibold tracking-tight text-foreground">Activity</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Stay updated on your team&apos;s work across all projects.
        </p>
      </div>

      <ActivityFilterBar activeFilter={activeFilter} onFilterChange={setActiveFilter} />

      <div className="flex flex-col gap-5">
        {groupedActivities.length === 0 ? (
          <p className="rounded-xl border border-dashed px-3 py-10 text-center text-sm text-muted-foreground">
            No activity matches this filter.
          </p>
        ) : (
          groupedActivities.map((group) => (
            <section key={group.id}>
              <h2 className="text-base font-semibold text-foreground">{group.label}</h2>
              <div className="mt-2 flex flex-col gap-0.5">
                {group.items.map((activity) => (
                  <ActivityRow key={activity.id} activity={activity} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </DashboardLayout>
  )
}

export default ActivityPage
