import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { Activity, Archive, House, LayoutGrid, PanelLeftClose, Settings, Users } from 'lucide-react'
import { cn } from 'cn'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import ArchiveDrawer from '@/components/dashboard/ArchiveDrawer'
import ProjectSwitcher from '@/components/dashboard/ProjectSwitcher'
import { projectTone } from '@/lib/projectTone'

// The global destinations, shown only outside a project: Home (the
// project hub), Activity and Team. Inside a project they step aside so
// the rail only carries that project's own views.
const globalItems = [
  { id: 'home', label: 'Home', icon: House, path: '/dashboard' },
  { id: 'activity', label: 'Activity', icon: Activity, path: '/activity' },
  { id: 'team', label: 'Team', icon: Users, path: '/team' },
]

const iconButtonClass =
  'mx-1.5 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

// Deliberately restrained: a muted surface + a thin primary-tinted ring,
// not a saturated blue fill — the icon itself stays close to neutral.
const activeClass = 'bg-muted text-foreground ring-1 ring-primary/40'

// An icon-only activity bar button, named by its tooltip.
function RailButton({ label, icon: Icon, className, ...triggerProps }) {
  return (
    <Tooltip>
      <TooltipTrigger aria-label={label} className={cn(iconButtonClass, className)} {...triggerProps}>
        <Icon className="size-[18px]" />
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

// The Projects button's face: a grid icon on global pages, or — inside
// a project — that project's own color badge (its initial on its identity
// color, see projectTone), swapping in with a quick scale/fade whenever
// the project changes.
function ProjectsMark({ project }) {
  if (!project) return <LayoutGrid className="size-[18px]" />
  return (
    <span
      key={project.id}
      className={cn(
        'flex size-[22px] items-center justify-center rounded-md text-[11px] font-semibold text-white ring-1 ring-white/10 animate-in fade-in zoom-in-90 duration-200 motion-reduce:animate-none',
        projectTone(project.id)
      )}
    >
      {project.name.charAt(0)}
    </span>
  )
}

// The activity bar, permanently slim and icon-only, and contextual:
//   · at the top, always: Projects — the Slack-style project switcher,
//     wearing the current project's badge while you're in one;
//   · outside a project: Home (the project hub), Activity and Team;
//   · inside a project: just that project's views — Home (its overview)
//     and Archive (which opens its sub-navigation in the drawer). Activity
//     and Team step aside so the focused workspace isn't cluttered, and
//     Conflict Points live only in the Workspace's bottom panel.
// Settings is pinned to the bottom.
function ActivityBar({ project, drawer, onToggleDrawer }) {
  const { pathname } = useLocation()
  const path = pathname.replace(/\/$/, '')
  const overviewPath = project ? `/projects/${project.id}` : null
  const archivePath = project ? `/projects/${project.id}/archive` : null
  const onArchive = !!archivePath && path.startsWith(archivePath)

  return (
    <div className="flex h-full w-12 shrink-0 flex-col gap-1 bg-sidebar pb-2">
      <div className="mb-1 flex h-14 shrink-0 items-center">
        <ProjectSwitcher currentProjectId={project?.id}>
          <Tooltip>
            <TooltipTrigger
              render={
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      aria-label={project ? `Projects (current: ${project.name})` : 'Projects'}
                      className={cn(iconButtonClass, 'data-[popup-open]:bg-muted')}
                    />
                  }
                />
              }
            >
              <ProjectsMark project={project} />
            </TooltipTrigger>
            <TooltipContent side="right">{project ? `${project.name} · Switch project` : 'Projects'}</TooltipContent>
          </Tooltip>
        </ProjectSwitcher>
      </div>

      <nav aria-label="Main" className="flex flex-col gap-1">
        {project ? (
          <>
            <RailButton
              label={`${project.name} home`}
              icon={House}
              render={<Link to={overviewPath} />}
              aria-current={path === overviewPath ? 'page' : undefined}
              className={cn(path === overviewPath && !drawer && activeClass)}
            />
            <RailButton
              label="Archive"
              icon={Archive}
              onClick={() => onToggleDrawer('archive')}
              aria-expanded={drawer === 'archive'}
              className={cn((drawer === 'archive' || (onArchive && !drawer)) && activeClass)}
            />
          </>
        ) : (
          globalItems.map(({ id, label, icon, path: to }) => {
            const active = path.startsWith(to)
            return (
              <RailButton
                key={id}
                label={label}
                icon={icon}
                render={<Link to={to} />}
                aria-current={active ? 'page' : undefined}
                className={cn(active && activeClass)}
              />
            )
          })
        )}
      </nav>

      <div className="mt-auto flex flex-col gap-1">
        <RailButton
          label="Settings"
          icon={Settings}
          onClick={() => toast('Settings', { description: 'Workspace settings' })}
        />
      </div>
    </div>
  )
}

function CloseButton({ onClose }) {
  return (
    <Tooltip>
      <TooltipTrigger
        onClick={onClose}
        aria-label="Close drawer"
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <PanelLeftClose className="size-[18px]" />
      </TooltipTrigger>
      <TooltipContent side="bottom">Close</TooltipContent>
    </Tooltip>
  )
}

const DRAWER_TITLES = { archive: 'Archive' }

// The app's navigation: the always-slim ActivityBar, and beside it a
// drawer used by the Archive icon for its sub-navigation. It slides open
// (its width animates from 0; its content keeps a fixed w-68 so nothing
// re-wraps mid-animation) and closes from its own button or the Archive
// icon again. Every other destination is a plain full page.
function Sidebar({ project, drawer, onToggleDrawer, onCloseDrawer }) {
  // Keep showing the last panel while the drawer animates shut.
  const [shown, setShown] = useState(drawer)
  if (drawer && drawer !== shown) setShown(drawer)
  const panel = drawer ?? shown

  return (
    <div className="z-10 flex h-full shrink-0">
      <ActivityBar project={project} drawer={drawer} onToggleDrawer={onToggleDrawer} />

      <div
        inert={!drawer}
        aria-hidden={!drawer}
        className={cn(
          'h-full shrink-0 overflow-hidden transition-[width] duration-200 ease-out motion-reduce:transition-none',
          drawer ? 'w-68' : 'w-0'
        )}
      >
        <aside
          aria-label={DRAWER_TITLES[panel] ?? 'Drawer'}
          className="flex h-full w-68 flex-col border-x border-white/[0.06] bg-sidebar pb-2"
        >
          <div className="mb-1 flex h-14 shrink-0 items-center justify-between gap-2 pr-2 pl-2">
            <p className="min-w-0 flex-1 truncate px-2.5 text-[14px] font-semibold text-foreground">
              {DRAWER_TITLES[panel]}
            </p>
            <CloseButton onClose={onCloseDrawer} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2">
            {panel === 'archive' && project && <ArchiveDrawer project={project} onClose={onCloseDrawer} />}
          </div>
        </aside>
      </div>
    </div>
  )
}

export default Sidebar
