import { useEffect, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { cn } from 'cn'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import ProjectProgressCards from '@/components/dashboard/ProjectProgressCards'
import ConflictChecklist from '@/components/dashboard/ConflictChecklist'
import TeamMembers from '@/components/dashboard/TeamMembers'
import ConflictActivityChart from '@/components/dashboard/ConflictActivityChart'
import MergeSchedule from '@/components/dashboard/MergeSchedule'
import DashboardCustomizeModal from '@/components/modals/DashboardCustomizeModal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const WIDGET_META = {
  projectCards: { title: 'Project cards' },
  activeConflicts: { title: 'Active conflicts' },
  members: { title: 'Members' },
  conflictActivity: { title: 'Conflict activity' },
  mergeSchedule: { title: 'Merge schedule' },
}

// Reproduces today's default look exactly (top-3-by-conflicts project
// cards, all conflicts/members shown, this week's activity) so turning
// the customizer on changes nothing until the user actually touches it.
const DEFAULT_CONFIG = {
  order: ['projectCards', 'activeConflicts', 'members', 'conflictActivity', 'mergeSchedule'],
  sizes: { projectCards: 'large', activeConflicts: 'medium', members: 'medium', conflictActivity: 'medium', mergeSchedule: 'small' },
  visibility: { projectCards: true, activeConflicts: true, members: true, conflictActivity: true, mergeSchedule: true },
  selectedProjectIds: ['design-system-v2', 'checkout-redesign', 'onboarding-flow'],
  conflictLimit: 'All',
  memberLimit: 'All',
  activityPeriod: 'thisWeek',
}

const SIZE_SPAN_CLASS = { small: '', medium: 'md:col-span-2', large: 'md:col-span-3' }

// Brief, one-time skeleton pass on first mount — there's no real fetch
// behind any of this (mock data only), but a SaaS dashboard that renders
// instantly on every load reads as static; this is just enough delay to
// make the widgets feel loaded rather than baked into the page.
const INITIAL_LOAD_MS = 350

function DashboardSkeleton() {
  return (
    <DashboardLayout>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Skeleton className="h-40 rounded-xl md:col-span-3" />
        <Skeleton className="h-72 rounded-xl md:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-56 rounded-xl md:col-span-2" />
      </div>
    </DashboardLayout>
  )
}

function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [customizeOpen, setCustomizeOpen] = useState(false)
  // Session-only (no localStorage elsewhere in this app to piggyback on) —
  // customization resets on reload, matching the rest of DevSign's mock
  // frontend-state-only pages.
  const [config, setConfig] = useState(DEFAULT_CONFIG)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), INITIAL_LOAD_MS)
    return () => clearTimeout(timer)
  }, [])

  if (loading) return <DashboardSkeleton />

  function renderWidget(id) {
    switch (id) {
      case 'projectCards':
        return <ProjectProgressCards selectedProjectIds={config.selectedProjectIds} />
      case 'activeConflicts':
        return <ConflictChecklist limit={config.conflictLimit} />
      case 'members':
        return <TeamMembers limit={config.memberLimit} />
      case 'conflictActivity':
        return <ConflictActivityChart period={config.activityPeriod} />
      case 'mergeSchedule':
        return <MergeSchedule />
      default:
        return null
    }
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCustomizeOpen(true)}>
          <SlidersHorizontal className="size-3.5" />
          Customize dashboard
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:[grid-auto-flow:dense]">
        {config.order
          .filter((id) => config.visibility[id])
          .map((id) => (
            <div key={id} className={cn('min-w-0', SIZE_SPAN_CLASS[config.sizes[id]])}>
              {renderWidget(id)}
            </div>
          ))}
      </div>

      <DashboardCustomizeModal
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        config={config}
        onConfigChange={setConfig}
        onReset={() => setConfig(DEFAULT_CONFIG)}
        widgetMeta={WIDGET_META}
      />
    </DashboardLayout>
  )
}

export default DashboardPage
