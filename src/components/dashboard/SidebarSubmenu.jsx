import { Link, useLocation } from 'react-router-dom'
import { Activity, Archive, GitBranch, LayoutDashboard, LayoutPanelLeft, Users } from 'lucide-react'
import { cn } from 'cn'
import { activeNavItem } from '@/components/dashboard/Sidebar'
import { activities, allPeople, projects } from '@/data/mockData'

// h-9 (not padding) so each row's pitch matches the top-level rows above.
const rowClass =
  'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
const activeRowClass = 'bg-muted text-foreground'

const totalOpenConflicts = projects.reduce((sum, p) => sum + p.conflicts, 0)

function Count({ value, tone = 'muted' }) {
  if (!value) return null
  return (
    <span
      className={cn(
        'ml-auto shrink-0 rounded-full px-1.5 text-[11px] tabular-nums',
        tone === 'alert' ? 'bg-destructive/10 text-destructive' : 'text-muted-foreground/70'
      )}
    >
      {value}
    </span>
  )
}

function NavRow({ to, active, icon: Icon, children, count, countTone }) {
  return (
    <Link to={to} aria-current={active ? 'page' : undefined} className={cn(rowClass, active && activeRowClass)}>
      {Icon && <Icon className="size-3.5 shrink-0" />}
      <span className="min-w-0 truncate">{children}</span>
      <Count value={count} tone={countTone} />
    </Link>
  )
}

function HomeMenu({ pathname }) {
  return (
    <nav className="flex flex-col gap-1">
      <NavRow to="/dashboard" active={pathname.startsWith('/dashboard')} icon={LayoutDashboard}>
        Overview
      </NavRow>
      <NavRow
        to="/conflicts"
        active={pathname.startsWith('/conflicts')}
        icon={GitBranch}
        count={totalOpenConflicts}
        countTone="alert"
      >
        Conflicts
      </NavRow>
    </nav>
  )
}

// Projects' sub-menu is the projects themselves (each opens straight into
// its Workspace) — not another "All projects" row, which is what the
// sidebar's own top-level Projects row already is.
function ProjectsMenu() {
  return (
    <nav className="flex flex-col gap-1">
      {projects.map((p) => (
        <NavRow key={p.id} to={`/projects/${p.id}/workspace`} count={p.conflicts} countTone="alert">
          {p.name}
        </NavRow>
      ))}
    </nav>
  )
}

// Activity and Team stay primary-navigation only. Their filters — the
// feed's type/project scope, the member list's team tabs — live in the
// pages themselves (ActivityFilterBar, TeamPage's tabs), so the drawer
// never grows into a long, overflowing list.
function ActivityMenu({ pathname }) {
  return (
    <nav className="flex flex-col gap-1">
      <NavRow to="/activity" active={pathname.startsWith('/activity')} icon={Activity} count={activities.length}>
        All activity
      </NavRow>
    </nav>
  )
}

function TeamMenu({ pathname }) {
  return (
    <nav className="flex flex-col gap-1">
      <NavRow to="/team" active={pathname.startsWith('/team')} icon={Users} count={allPeople.length}>
        All members
      </NavRow>
    </nav>
  )
}

const SECTION_MENUS = {
  home: HomeMenu,
  projects: ProjectsMenu,
  activity: ActivityMenu,
  team: TeamMenu,
}

// A project's own primary pages — deliberately no per-project Settings.
function ProjectMenu({ project, pathname }) {
  const links = [
    { id: 'workspace', label: 'Workspace', icon: LayoutPanelLeft, path: `/projects/${project.id}/workspace` },
    { id: 'archive', label: 'Archive', icon: Archive, path: `/projects/${project.id}/archive` },
  ]

  return (
    <nav aria-label={project.name} className="flex flex-col gap-1">
      {links.map(({ id, label, icon, path }) => (
        <NavRow key={id} to={path} active={pathname.startsWith(path)} icon={icon}>
          {label}
        </NavRow>
      ))}
    </nav>
  )
}

// The body of the tier-2 contextual drawer (its header — section title,
// or a project's back arrow + switcher — lives in Sidebar). It never
// repeats the activity bar's global destinations: inside a project it's
// that project's Workspace/Archive; elsewhere it's the sub-menu of the
// active global section — Home → Overview/Conflicts, Projects → each
// project, Activity → the feed, Team → the member list.
function SidebarSubmenu({ project }) {
  const { pathname } = useLocation()
  if (project) return <ProjectMenu project={project} pathname={pathname} />

  const Menu = SECTION_MENUS[activeNavItem(pathname).id]
  return <Menu pathname={pathname} />
}

export default SidebarSubmenu
