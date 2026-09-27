import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Bell, ChevronDown, File, Folder, Search, User as UserIcon } from 'lucide-react'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { activities, allPeople, currentUser, projectFileSets, projects } from '@/data/mockData'

const MAX_RESULTS_PER_GROUP = 4

const searchableFiles = Object.entries(projectFileSets).flatMap(([projectId, files]) => {
  const project = projects.find((p) => p.id === projectId)
  return files.map((file) => ({ ...file, projectId, projectName: project?.name ?? projectId }))
})

function searchAll(query) {
  const q = query.trim().toLowerCase()
  if (!q) return { projectResults: [], fileResults: [], memberResults: [] }

  return {
    projectResults: projects.filter((p) => p.name.toLowerCase().includes(q)).slice(0, MAX_RESULTS_PER_GROUP),
    fileResults: searchableFiles.filter((f) => f.name.toLowerCase().includes(q)).slice(0, MAX_RESULTS_PER_GROUP),
    memberResults: allPeople.filter((p) => p.name.toLowerCase().includes(q)).slice(0, MAX_RESULTS_PER_GROUP),
  }
}

const recentNotifications = activities.slice(0, 4)

// The dashboard's own top bar — distinct from the in-workspace `TopBar`
// (src/components/layout/TopBar.jsx). Search/notifications/profile are
// all wired to mock data + local state; nothing here touches a backend.
function DashboardTopBar() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [hasUnread, setHasUnread] = useState(true)

  const { projectResults, fileResults, memberResults } = useMemo(() => searchAll(query), [query])
  const totalResults = projectResults.length + fileResults.length + memberResults.length
  const showResults = focused && query.trim().length > 0

  function goTo(path) {
    setQuery('')
    setFocused(false)
    navigate(path)
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card/60 px-6">
      <div className="flex-1" />

      {/* Splitting the flanking space 50/50 puts the search box at the
          header's exact geometric center, but the right cluster's own
          content (bell + avatar + name + chevron, ~177px) hugs the far
          edge rather than filling its whole flex-1 share — so the empty
          space immediately next to the search box reads as bigger on the
          left than the right. `mr` nudges the box left by half that
          content width so the *visible* gap on each side matches, not
          just the flex math. */}
      <div className="relative mr-[201px] w-full max-w-[420px] shrink-0">
        <Search className="pointer-events-none absolute top-1/2 left-3 z-10 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          placeholder="Search projects, files, or members..."
          className="h-8 w-full pl-8 text-xs"
        />

        {showResults && (
          <div className="absolute top-full left-0 z-50 mt-1 max-h-96 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10">
            {totalResults === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">No results found.</p>
            ) : (
              <>
                {projectResults.length > 0 && (
                  <div>
                    <p className="px-1.5 py-1 text-[11px] font-medium text-muted-foreground">Projects</p>
                    {projectResults.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => goTo(`/projects/${project.id}/workspace`)}
                        className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
                      >
                        <Folder className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{project.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {fileResults.length > 0 && (
                  <div>
                    <p className="px-1.5 py-1 text-[11px] font-medium text-muted-foreground">Files</p>
                    {fileResults.map((file) => (
                      <button
                        key={`${file.projectId}-${file.path}`}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => goTo(`/projects/${file.projectId}/workspace`)}
                        className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
                      >
                        <File className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{file.name}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{file.projectName}</span>
                      </button>
                    ))}
                  </div>
                )}

                {memberResults.length > 0 && (
                  <div>
                    <p className="px-1.5 py-1 text-[11px] font-medium text-muted-foreground">Members</p>
                    {memberResults.map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => goTo('/team')}
                        className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
                      >
                        <Avatar size="sm" className="size-5">
                          <AvatarFallback className={cn('text-[9px] font-medium text-white', person.colorClass)}>
                            {person.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{person.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-1 items-center justify-end gap-4">
        <DropdownMenu onOpenChange={(open) => open && setHasUnread(false)}>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                title="Notifications"
                className="relative flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Bell className="size-4" />
                {hasUnread && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" />}
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-72">
            <p className="px-1.5 py-1 text-xs font-medium text-muted-foreground">Notifications</p>
            <DropdownMenuSeparator />
            {recentNotifications.map((activity) => (
              <DropdownMenuItem
                key={activity.id}
                className="flex-col items-start gap-0.5"
                onClick={() => navigate('/activity')}
              >
                <span className="text-xs text-foreground">
                  {activity.actorName} {activity.action} {activity.target}
                </span>
                <span className="text-[11px] text-muted-foreground">{activity.timestamp}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex items-center gap-2 rounded-full py-1 pr-1 pl-1.5 transition-colors hover:bg-muted"
              >
                <Avatar size="sm">
                  <AvatarFallback className={cn('text-[10px] font-medium text-white', currentUser.colorClass)}>
                    {currentUser.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden text-left leading-tight sm:block">
                  <p className="text-[12px] font-medium text-foreground">{currentUser.name}</p>
                  <p className="text-[11px] text-muted-foreground">{currentUser.team}</p>
                </div>
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => toast('Viewing profile', { description: currentUser.name })}>
              <UserIcon />
              View profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast('Settings', { description: 'Workspace settings' })}>
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => toast('Signed out', { description: 'This is a demo — no account was affected.' })}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

export default DashboardTopBar
