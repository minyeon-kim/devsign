import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { Activity, FolderKanban, House, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Settings, Users } from 'lucide-react'
import { cn } from 'cn'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import SidebarSubmenu from '@/components/dashboard/SidebarSubmenu'
import ProjectSwitcher from '@/components/dashboard/ProjectSwitcher'
import Logo from '@/components/layout/Logo'

// The four global destinations — the activity bar's only nav items.
// Shared with SidebarSubmenu, which picks the drawer's contextual
// sub-menu from the same `match` so the two tiers never disagree about
// which section is active. Home also owns /conflicts (the full list behind the dashboard's
// "Active conflicts" widget), and Projects owns every project's own
// Workspace/Archive routes.
export const navItems = [
  {
    id: 'home',
    label: 'Home',
    icon: LayoutDashboard,
    path: '/dashboard',
    match: (pathname) => pathname.startsWith('/dashboard') || pathname.startsWith('/conflicts'),
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: FolderKanban,
    path: '/projects',
    match: (pathname) => pathname.startsWith('/projects'),
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

export function activeNavItem(pathname) {
  return navItems.find((item) => item.match(pathname)) ?? navItems[0]
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

// Tier 1 — the activity bar. Permanently slim and icon-only on every
// route: the Devsign logo on top (the Slack-style project switcher), the
// four global destinations, and Settings pinned to the bottom — with a
// "Show sidebar" button above Settings only while the drawer is
// collapsed. Nothing contextual ever lands here. It always sits on the
// page's own deep `bg-background` — open or collapsed, dashboard or
// project — so it's seamless with the canvas beside it and toggling the
// drawer never shifts its tone.
function ActivityBar({ project, drawerOpen, onOpenDrawer }) {
  const { pathname } = useLocation()
  const current = activeNavItem(pathname)

  return (
    <div className="flex h-full w-12 shrink-0 flex-col gap-1 bg-background pb-2">
      {/* Slack's workspace switcher: the logo opens the project menu
          right from the top-left corner, on every route. */}
      <div className="mb-1 flex h-14 shrink-0 items-center">
        <ProjectSwitcher currentProjectId={project?.id}>
          <Tooltip>
            <TooltipTrigger
              render={
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Switch project"
                      className="mx-1.5 flex size-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted data-[popup-open]:bg-muted"
                    />
                  }
                />
              }
            >
              <Logo iconOnly />
            </TooltipTrigger>
            <TooltipContent side="right">Switch project</TooltipContent>
          </Tooltip>
        </ProjectSwitcher>
      </div>

      <nav aria-label="Main" className="flex flex-col gap-1">
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
        {/* The logo is the project switcher now, so a collapsed drawer
            gets its own way back open. Closing stays with the drawer's
            close button. */}
        {!drawerOpen && <RailButton label="Show sidebar · ⌘B" icon={PanelLeftOpen} onClick={onOpenDrawer} />}
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
// activity bar logo's job (Slack's workspace switcher) — and no back
// arrow: getting back out is the activity bar's Home icon and the
// drawer's own "Back to Dashboard".
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
// The activity bar's "Show sidebar" button opens the drawer; only the
// drawer's close button (or ⌘B) closes it.
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

// The project drawer's way out: a dedicated, clearly labelled exit to the
// global dashboard, pinned to the drawer's foot (the header stays the
// project switcher alone). The activity bar's Home icon does the same
// from the slim column.
function DashboardExit() {
  return (
    <div className="shrink-0 px-2 pt-2">
      <Link
        to="/dashboard"
        className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <House className="size-3.5 shrink-0" />
        Back to Dashboard
      </Link>
    </div>
  )
}

function Sidebar({ project, drawerOpen = true, onToggleDrawer }) {
  const animateIn = useContextSwitchAnimation(project ? `project:${project.id}` : 'global')

  return (
    <div className="z-10 flex h-full shrink-0">
      {/* The expand button only shows while the drawer is collapsed, so
          toggling here always means "open". */}
      <ActivityBar project={project} drawerOpen={drawerOpen} onOpenDrawer={onToggleDrawer} />

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
            {project && <DashboardExit />}
          </div>
        </aside>
      </div>
    </div>
  )
}

export default Sidebar
