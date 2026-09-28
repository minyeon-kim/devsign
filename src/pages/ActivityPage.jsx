import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Activity as ActivityIcon } from 'lucide-react'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import { Button } from '@/components/ui/button'
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
      rightColumn={
        <>
          <ActivityOverview />
          <MostActiveProjects />
          <StayInSync />
        </>
      }
    >
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" title="Back to dashboard" nativeButton={false} render={<Link to="/dashboard" />}>
          <ArrowLeft className="size-3.5" />
        </Button>
        <ActivityIcon className="size-5 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-semibold text-foreground">All activities</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            What your team is doing across every project. For one project&apos;s saved versions, open its Archive → History.
          </p>
        </div>
      </div>

      <ActivityFilterBar
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        projectFilter={projectFilter}
        onProjectChange={(projectId) => updateParam('project', projectId)}
      />

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
