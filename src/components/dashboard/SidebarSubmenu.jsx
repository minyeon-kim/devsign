import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Activity, Archive, ChevronRight, FileText, GitBranch, History, LayoutDashboard, LayoutPanelLeft, Users } from 'lucide-react'
import { cn } from 'cn'
import { activeNavItem } from '@/components/dashboard/Sidebar'
import { activities, allPeople, projects, referenceDocs } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'

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

// How many history records the Archive tree lists before handing off to
// the full History tab.
const MAX_HISTORY_ITEMS = 5

const treeRowClass =
  'flex h-8 w-full items-center gap-2 rounded-lg pr-2.5 pl-2.5 text-left text-[12.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

// A group heading inside the Archive tree — itself a link that opens that
// Archive tab as a whole.
function TreeGroupLink({ to, state, children }) {
  return (
    <Link
      to={to}
      state={state}
      className="mt-1 flex h-7 items-center px-2.5 text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase transition-colors first:mt-0 hover:text-foreground"
    >
      {children}
    </Link>
  )
}

// Archive, disclosed progressively: its row expands a tree of the
// project's reference docs and recent history right here in the drawer
// instead of taking over the main view. Only picking an item (or a group
// heading) opens the Archive page — deep-linked to that tab and record,
// through the same `location.state` Workspace's save-status link uses.
function ArchiveTree({ project, pathname }) {
  const location = useLocation()
  const { historyEntries } = useWorkspace()
  const archivePath = `/projects/${project.id}/archive`
  const onArchive = pathname.startsWith(archivePath)
  const [expanded, setExpanded] = useState(onArchive)

  // Arriving on Archive from elsewhere (the save-status link, a
  // bookmark) opens the tree so the selected record is visible here too.
  const [wasOnArchive, setWasOnArchive] = useState(onArchive)
  if (onArchive !== wasOnArchive) {
    setWasOnArchive(onArchive)
    if (onArchive) setExpanded(true)
  }

  const selectedDocId = onArchive ? location.state?.docId : null
  const selectedHistoryId = onArchive ? location.state?.highlightId : null
  const history = historyEntries.filter((e) => !e.archived).reverse()
  const recentHistory = history.slice(0, MAX_HISTORY_ITEMS)

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className={cn(rowClass, 'w-full', onArchive && 'text-foreground')}
      >
        <Archive className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">Archive</span>
        <ChevronRight
          className={cn(
            'size-3.5 shrink-0 text-muted-foreground/70 transition-transform duration-200 motion-reduce:transition-none',
            expanded && 'rotate-90'
          )}
        />
      </button>

      <div
        inert={!expanded}
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none',
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <div className="mt-1 ml-[17px] flex flex-col border-l border-white/[0.06] pb-1 pl-2">
            <TreeGroupLink to={archivePath} state={{ tab: 'referenceDocs' }}>
              Reference Docs
            </TreeGroupLink>
            {referenceDocs.map((doc) => (
              <Link
                key={doc.id}
                to={archivePath}
                state={{ tab: 'referenceDocs', docId: doc.id }}
                aria-current={selectedDocId === doc.id ? 'page' : undefined}
                className={cn(treeRowClass, selectedDocId === doc.id && activeRowClass)}
              >
                <FileText className="size-3.5 shrink-0" />
                <span className="min-w-0 truncate">{doc.title}</span>
              </Link>
            ))}

            <TreeGroupLink to={archivePath} state={{ tab: 'history' }}>
              History
            </TreeGroupLink>
            {recentHistory.length === 0 ? (
              <p className="px-2.5 py-1.5 text-[12px] text-muted-foreground/70">No saved versions yet.</p>
            ) : (
              recentHistory.map((entry) => (
                <Link
                  key={entry.id}
                  to={archivePath}
                  state={{ tab: 'history', highlightId: entry.id }}
                  aria-current={selectedHistoryId === entry.id ? 'page' : undefined}
                  title={`${entry.label} · ${entry.timestamp}`}
                  className={cn(treeRowClass, selectedHistoryId === entry.id && activeRowClass)}
                >
                  <History className="size-3.5 shrink-0" />
                  <span className="min-w-0 truncate">{entry.label}</span>
                </Link>
              ))
            )}
            {history.length > MAX_HISTORY_ITEMS && (
              <Link
                to={archivePath}
                state={{ tab: 'history' }}
                className="flex h-7 items-center px-2.5 text-[12px] text-muted-foreground/70 transition-colors hover:text-foreground"
              >
                View all {history.length}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// A project's own pages — deliberately no per-project Settings. Workspace
// is a plain link; Archive is the expandable tree above.
function ProjectMenu({ project, pathname }) {
  const workspacePath = `/projects/${project.id}/workspace`

  return (
    <nav aria-label={project.name} className="flex flex-col gap-1">
      <NavRow to={workspacePath} active={pathname.startsWith(workspacePath)} icon={LayoutPanelLeft}>
        Workspace
      </NavRow>
      <ArchiveTree project={project} pathname={pathname} />
    </nav>
  )
}

// The body of the tier-2 contextual drawer (its header — section title,
// or a project's back arrow + switcher — lives in Sidebar). It never
// repeats the activity bar's global destinations: inside a project it's
// that project's Workspace and its expandable Archive tree; elsewhere it's the sub-menu of the
// active global section — Home → Overview/Conflicts, Projects → each
// project, Activity → the feed, Team → the member list.
function SidebarSubmenu({ project }) {
  const { pathname } = useLocation()
  if (project) return <ProjectMenu project={project} pathname={pathname} />

  const Menu = SECTION_MENUS[activeNavItem(pathname).id]
  return <Menu pathname={pathname} />
}

export default SidebarSubmenu
