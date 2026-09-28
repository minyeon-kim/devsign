import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  ChevronsUpDown,
  FolderKanban,
  GitBranch,
  LayoutDashboard,
  LayoutPanelLeft,
  PanelLeftClose,
  Users,
} from 'lucide-react'
import { cn } from 'cn'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { activeNavItem } from '@/components/dashboard/Sidebar'
import { ACTIVITY_FILTERS } from '@/components/activity/activityTypeMeta'
import { activities, projects, teams } from '@/data/mockData'

// h-9 (not padding) so each row's pitch exactly matches the icon rail's
// size-9 buttons + gap-1, keeping every row lined up with its icon.
const rowClass =
  'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
const activeRowClass = 'bg-muted text-foreground'

const totalOpenConflicts = projects.reduce((sum, p) => sum + p.conflicts, 0)

function CollapseButton({ onCollapse }) {
  return (
    <Tooltip>
      <TooltipTrigger
        onClick={onCollapse}
        aria-label="Hide sidebar"
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <PanelLeftClose className="size-4" />
      </TooltipTrigger>
      <TooltipContent side="right">Hide sidebar · ⌘B</TooltipContent>
    </Tooltip>
  )
}

// The drawer's first row — the section's name (or, inside a project, the
// way back out) plus the hide button. Same h-9 pitch as the rail's first
// icon beside it, so there's no spacer or divider line needed above it.
function DrawerHeader({ children, onCollapse }) {
  return (
    <div className="mb-3 flex h-9 shrink-0 items-center justify-between gap-2 pl-2.5">
      {children}
      <CollapseButton onCollapse={onCollapse} />
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <p className="mt-4 mb-1 px-2.5 text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase first:mt-0">
      {children}
    </p>
  )
}

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
// rail's own Projects icon already is.
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

// Filters for the global, cross-project Activity feed, kept in the URL
// (`?type=`, `?project=`) so the drawer and the page's own filter pills
// read and write the same state.
function ActivityMenu() {
  const [searchParams] = useSearchParams()
  const activeType = searchParams.get('type') ?? 'all'
  const activeProject = searchParams.get('project')

  function hrefWith(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    const query = next.toString()
    return query ? `/activity?${query}` : '/activity'
  }

  return (
    <nav className="flex flex-col gap-1">
      <SectionLabel>Type</SectionLabel>
      {ACTIVITY_FILTERS.map((filter) => (
        <NavRow
          key={filter.id}
          to={hrefWith('type', filter.id === 'all' ? null : filter.id)}
          active={activeType === filter.id}
          count={
            filter.id === 'all'
              ? activities.length
              : activities.filter((a) => a.type === filter.id).length
          }
        >
          {filter.label}
        </NavRow>
      ))}

      <SectionLabel>Project</SectionLabel>
      <NavRow to={hrefWith('project', null)} active={!activeProject}>
        All projects
      </NavRow>
      {projects.map((p) => (
        <NavRow
          key={p.id}
          to={hrefWith('project', p.id)}
          active={activeProject === p.id}
          count={activities.filter((a) => a.projectId === p.id).length}
        >
          {p.name}
        </NavRow>
      ))}
    </nav>
  )
}

function TeamMenu() {
  const [searchParams] = useSearchParams()
  const activeTeam = searchParams.get('team')

  return (
    <nav className="flex flex-col gap-1">
      <NavRow to="/team" active={!activeTeam} icon={Users}>
        All members
      </NavRow>
      <SectionLabel>Teams</SectionLabel>
      {teams.map((team) => (
        <NavRow
          key={team.id}
          to={`/team?team=${team.id}`}
          active={activeTeam === team.id}
          count={team.memberIds.length}
        >
          {team.name}
        </NavRow>
      ))}
    </nav>
  )
}

const SECTION_MENUS = {
  home: HomeMenu,
  projects: ProjectsMenu,
  activity: ActivityMenu,
  team: TeamMenu,
}

// Switching projects keeps you on the same tab (Workspace or Archive)
// you were on, just for the other project.
function ProjectSwitcher({ project, pathname }) {
  const navigate = useNavigate()
  const tab = pathname.endsWith('/archive') ? 'archive' : 'workspace'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="mb-3 flex h-10 w-full items-center gap-2.5 rounded-lg bg-muted/60 px-2.5 text-left transition-colors hover:bg-muted"
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
              <FolderKanban className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">{project.name}</span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        }
      />
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Switch project</DropdownMenuLabel>
          {projects.map((p) => (
            <DropdownMenuItem key={p.id} onClick={() => navigate(`/projects/${p.id}/${tab}`)}>
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {p.id === project.id && <Check className="size-3.5 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// The labeled drawer beside the icon-only rail. It never repeats the
// rail's own top-level destinations — it shows the sub-menu of whichever
// rail item is active: Home → Overview/Conflicts, Projects → each project,
// Activity → type/project filters, Team → members/teams. Inside a project
// (`project` set) it becomes that project's own menu instead: back to all
// projects, a project-switch dropdown, and Workspace/Archive (deliberately
// no per-project Settings).
function SidebarSecondary({ project, onCollapse }) {
  const { pathname } = useLocation()

  if (project) {
    const projectLinks = [
      { id: 'workspace', label: 'Workspace', icon: LayoutPanelLeft, path: `/projects/${project.id}/workspace` },
      { id: 'archive', label: 'Archive', icon: FolderKanban, path: `/projects/${project.id}/archive` },
    ]

    return (
      <aside className="flex h-full w-60 shrink-0 flex-col border-r bg-card px-3 py-2">
        <DrawerHeader onCollapse={onCollapse}>
          <Link
            to="/projects"
            className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5 shrink-0" />
            <span className="truncate">Back to all projects</span>
          </Link>
        </DrawerHeader>

        <ProjectSwitcher project={project} pathname={pathname} />

        <nav className="flex flex-col gap-1">
          {projectLinks.map(({ id, label, icon, path }) => (
            <NavRow key={id} to={path} active={pathname.startsWith(path)} icon={icon}>
              {label}
            </NavRow>
          ))}
        </nav>
      </aside>
    )
  }

  const section = activeNavItem(pathname)
  const Menu = SECTION_MENUS[section.id]

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r bg-card px-3 py-2">
      <DrawerHeader onCollapse={onCollapse}>
        <p className="truncate text-[13px] font-semibold text-foreground">{section.label}</p>
      </DrawerHeader>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Menu pathname={pathname} />
      </div>
    </aside>
  )
}

export default SidebarSecondary
