import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { Activity, FolderKanban, House, PanelLeftClose, Settings, Users } from 'lucide-react'
import { cn } from 'cn'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import SidebarSubmenu from '@/components/dashboard/SidebarSubmenu'
import ProjectSwitcher from '@/components/dashboard/ProjectSwitcher'
import Logo from '@/components/layout/Logo'
import { projectTone } from '@/lib/projectTone'

// The activity bar's global destinations: Home, Activity, Team. Projects
// isn't in this list — its button (the project switcher) sits above
// these, directly under the logo, and is rendered separately. Home also
// owns /conflicts (the full list behind the dashboard's "Active
// conflicts" widget).
export const navItems = [
  {
    id: 'home',
    label: 'Home',
    icon: House,
    path: '/dashboard',
    match: (pathname) => pathname.startsWith('/dashboard') || pathname.startsWith('/conflicts'),
  },
  {
    id: 'activity',
    label: 'Activity',
    icon: Activity,
    path: '/activity',
    match: (pathname) => pathname.startsWith('/activity'),
  },
  {
    id: 'team',
    label: 'Team',
    icon: Users,
    path: '/team',
    match: (pathname) => pathname.startsWith('/team'),
  },
]

// Projects as a section for the drawer (the All projects page gets its
// projects sub-menu and "Projects" header) and for the Projects button's
// active state.
const projectsSection = {
  id: 'projects',
  label: 'Projects',
  path: '/projects',
  match: (pathname) => pathname.startsWith('/projects'),
}

// The section the current route belongs to. Shared with SidebarSubmenu,
// which picks the drawer's contextual sub-menu from the same `match`, so
// the activity bar and the drawer never disagree about where you are.
export function activeNavItem(pathname) {
  return [...navItems, projectsSection].find((item) => item.match(pathname)) ?? navItems[0]
}

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

// The Projects button's face: a folder icon on global pages, or — inside
// a project — that project's own color badge (its initial on its identity
// color, see projectTone), sized to sit at the same visual weight as the
// 18px icons around it and swapping in with a quick scale/fade whenever
// the project changes.
function ProjectsMark({ project }) {
  if (!project) return <FolderKanban className="size-[18px]" />
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

// Tier 1 — the activity bar. Permanently slim and icon-only on every
// route, top to bottom:
//   1. the Devsign logo — the brand mark and the drawer's toggle;
//   2. Projects, right under it — opens the Slack-style project switcher
//      (every project, plus "All projects"), and wears the current
//      project's badge while you're in one;
//   3. Home, Activity, Team;
// with Settings pinned to the bottom. Nothing contextual ever lands here.
// It always sits on the page's own deep `bg-background` — open or
// collapsed, dashboard or project — so it's seamless with the canvas
// beside it and toggling the drawer never shifts its tone.
function ActivityBar({ project, drawerOpen, onToggleDrawer }) {
  const { pathname } = useLocation()
  const current = activeNavItem(pathname)
  const inProjects = current.id === 'projects'

  return (
    <div className="flex h-full w-12 shrink-0 flex-col gap-1 bg-background pb-2">
      <div className="mb-1 flex h-14 shrink-0 items-center">
        <Tooltip>
          <TooltipTrigger
            onClick={onToggleDrawer}
            aria-expanded={drawerOpen}
            aria-label={drawerOpen ? 'Hide sidebar' : 'Show sidebar'}
            className="mx-1.5 flex size-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted"
          >
            <Logo iconOnly />
          </TooltipTrigger>
          <TooltipContent side="right">{`${drawerOpen ? 'Hide' : 'Show'} sidebar · ⌘B`}</TooltipContent>
        </Tooltip>
      </div>

      <nav aria-label="Main" className="flex flex-col gap-1">
        <ProjectSwitcher currentProjectId={project?.id}>
          <Tooltip>
            <TooltipTrigger
              render={
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      aria-label={project ? `Projects (current: ${project.name})` : 'Projects'}
                      aria-current={inProjects ? 'page' : undefined}
                      className={cn(iconButtonClass, 'data-[popup-open]:bg-muted', inProjects && activeClass)}
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

        {navItems.map(({ id, label, icon, path }) => {
          const isActive = id === current.id
          return (
            <RailButton
              key={id}
              label={label}
              icon={icon}
              render={<Link to={path} />}
              aria-current={isActive ? 'page' : undefined}
              className={cn(isActive && activeClass)}
            />
          )
        })}
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
        aria-label="Hide sidebar"
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <PanelLeftClose className="size-[18px]" />
      </TooltipTrigger>
      <TooltipContent side="bottom">Hide sidebar · ⌘B</TooltipContent>
    </Tooltip>
  )
}

// Tier 2 — the contextual drawer's header, same h-14 as the logo row and
// the top bar beside it, and deliberately sparse: just the current
// project's name (or, outside a project, the active section's name) and
// the close button. No dropdown here — switching projects is the
// activity bar's Projects button (Slack's workspace switcher) — and no
// back arrow: getting back out is the activity bar's Home icon.
function DrawerHeader({ project, onClose }) {
  const { pathname } = useLocation()

  return (
    <div className="mb-1 flex h-14 shrink-0 items-center justify-between gap-2 pr-2 pl-2">
      <p className="min-w-0 flex-1 truncate px-2.5 text-[14px] font-semibold text-foreground">
        {project ? project.name : activeNavItem(pathname).label}
      </p>
      <CloseButton onClose={onClose} />
    </div>
  )
}

// The app's navigation, in two strict tiers side by side (see AppShell):
// the always-slim ActivityBar with the global destinations, and beside it
// the contextual drawer, which slides open (its width animates from 0;
// its content keeps a fixed w-68 so nothing re-wraps mid-animation) to
// show what belongs to the current view — a project's switcher and
// Workspace/Archive, or the active section's sub-menu. Global and
// contextual items never share a column. Everything shares the page's
// one deep background tone; faint hairlines on either side of the drawer
// mark where one tier ends and the next begins.
// The activity bar's logo toggles the drawer, the drawer's own close
// button closes it, and ⌘B toggles it too.
//
// Every page mounts its own shell, so the drawer can't tell a context
// switch from a plain page change by its own state alone. The last
// context seen ("global", or one specific project) is remembered here so
// the drawer's contents fade/slide in only when that context actually
// changes — entering a project, switching projects, or heading back to
// the dashboard — and stay still when moving between pages of the same
// context.
let lastShellContext = null

function useContextSwitchAnimation(contextKey) {
  const [animate] = useState(() => lastShellContext !== null && lastShellContext !== contextKey)
  useEffect(() => {
    lastShellContext = contextKey
  }, [contextKey])
  return animate
}

function Sidebar({ project, drawerOpen = true, onToggleDrawer }) {
  const animateIn = useContextSwitchAnimation(project ? `project:${project.id}` : 'global')

  return (
    <div className="z-10 flex h-full shrink-0">
      <ActivityBar project={project} drawerOpen={drawerOpen} onToggleDrawer={onToggleDrawer} />

      <div
        inert={!drawerOpen}
        aria-hidden={!drawerOpen}
        className={cn(
          'h-full shrink-0 overflow-hidden transition-[width] duration-200 ease-out motion-reduce:transition-none',
          drawerOpen ? 'w-68' : 'w-0'
        )}
      >
        <aside
          aria-label={project ? `${project.name} navigation` : 'Section navigation'}
          className="flex h-full w-68 flex-col border-x border-white/[0.06] bg-background pb-2"
        >
          <div
            className={cn(
              'flex min-h-0 flex-1 flex-col',
              animateIn && 'animate-in fade-in slide-in-from-left-2 duration-200 motion-reduce:animate-none'
            )}
          >
            <DrawerHeader project={project} onClose={onToggleDrawer} />
            <div className="min-h-0 flex-1 overflow-y-auto px-2">
              <SidebarSubmenu project={project} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default Sidebar
