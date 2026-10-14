import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { cn } from 'cn'
import { PAGE_PANEL, PageTitle } from '@/components/layout/PagePieces'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import ActivityFilterBar from '@/components/activity/ActivityFilterBar'
import ActivityRow from '@/components/activity/ActivityRow'
import ActivityOverview from '@/components/activity/ActivityOverview'
import MostActiveProjects from '@/components/activity/MostActiveProjects'
import StayInSync from '@/components/activity/StayInSync'
import { activities, activityDateGroups } from '@/data/mockData'

// The global feed — every project's activity in one place, as opposed to
// a project's own Archive → History (that project's local change log,
// with compare/restore). Filters live in the URL (`?type=`, `?project=`)
// so filtered views are linkable and survive a reload.
function ActivityPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeFilter = searchParams.get('type') ?? 'all'
  const projectFilter = searchParams.get('project')

  function updateParam(key, value) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true }
    )
  }

  const setActiveFilter = (filterId) => updateParam('type', filterId === 'all' ? null : filterId)

  const groupedActivities = useMemo(() => {
    const filtered = activities.filter(
      (a) =>
        (activeFilter === 'all' || a.type === activeFilter) && (!projectFilter || a.projectId === projectFilter)
    )

    return activityDateGroups
      .map((group) => ({
        ...group,
        items: filtered.filter((a) => a.dateGroup === group.id),
      }))
      .filter((group) => group.items.length > 0)
  }, [activeFilter, projectFilter])

  return (
    <DashboardLayout
      projectProportions
      rightColumn={
        <>
          <ActivityOverview />
          <MostActiveProjects />
          <StayInSync />
        </>
      }
    >
      {/* (The path in the top bar says where you are: no back arrow, no icon, no line of explanation.) */}
      <PageTitle title="All activities" />

      <ActivityFilterBar
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        projectFilter={projectFilter}
        onProjectChange={(projectId) => updateParam('project', projectId)}
      />

      <div className="flex flex-col gap-5">
        {groupedActivities.length === 0 ? (
          <p className={cn(PAGE_PANEL, 'px-3 py-10 text-center text-sm text-muted-foreground')}>
            No activity matches this filter.
          </p>
        ) : (
          groupedActivities.map((group) => (
            <section key={group.id}>
              <PageTitle as="h2" title={group.label} count={group.items.length} className="text-[13px] text-slate-300" />
              <div className={cn(PAGE_PANEL, 'mt-2 flex flex-col p-1.5')}>
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
