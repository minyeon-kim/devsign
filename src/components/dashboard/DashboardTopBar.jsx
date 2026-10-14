import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AppTopBar from '@/components/layout/AppTopBar'
import { FileCode2, Folder } from 'lucide-react'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import SearchField from '@/components/layout/SearchField'
import { translateText } from '@/i18n/translate'
import NotificationsMenu from '@/components/layout/NotificationsMenu'
import { allPeople, projectFileSets, projects } from '@/data/mockData'

const MAX_RESULTS_PER_GROUP = 4

const searchableFiles = Object.entries(projectFileSets).flatMap(([projectId, files]) => {
  const project = projects.find((p) => p.id === projectId)
  return files.map((file) => ({ ...file, projectId, projectName: project?.name ?? projectId }))
})

function searchAll(query) {
  const q = query.trim().toLowerCase()
  if (!q) return { projectResults: [], fileResults: [], memberResults: [] }

  return {
    // A project is found by its name as shown, in either language.
    projectResults: projects
      .filter((p) => [p.name, translateText(p.name, 'ko')].some((name) => name.toLowerCase().includes(q)))
      .slice(0, MAX_RESULTS_PER_GROUP),
    fileResults: searchableFiles.filter((f) => f.name.toLowerCase().includes(q)).slice(0, MAX_RESULTS_PER_GROUP),
    memberResults: allPeople.filter((p) => p.name.toLowerCase().includes(q)).slice(0, MAX_RESULTS_PER_GROUP),
  }
}

// The dashboard's own top bar — distinct from the in-workspace `TopBar`
// (src/components/layout/TopBar.jsx). Search, notifications and profile
// are all wired to mock data + local state; nothing here touches a
// backend. Gemini-style floating header: no background, no border, no
// bounding box — it sits directly on the app background at the top of the
// content column, beside the full-height sidebar (whose own header holds
// the logo and the sidebar toggle). An empty left column, the search
// pill, and the notifications/profile controls on the right: equal 1fr
// side columns with symmetric padding keep the pill exactly centered
// over the content column.
// The top bar outside the Workspace (AppTopBar): the path, the search over projects, files and members, and
// the bell. `crumbs` / `actions`: a project's home sets its own path and its people + Inbox in their place.
const PAGE_CRUMB = { '/dashboard': 'Home', '/activity': 'Activity', '/team': 'Team' }
function DashboardTopBar({ crumbs = null, actions = null }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)

  const { projectResults, fileResults, memberResults } = useMemo(() => searchAll(query), [query])
  const totalResults = projectResults.length + fileResults.length + memberResults.length
  const showResults = focused && query.trim().length > 0

  function goTo(path) {
    setQuery('')
    setFocused(false)
    inputRef.current?.blur()
    navigate(path)
  }

  // ⌘K (Ctrl+K) puts the cursor in the search from anywhere on the page;
  // typing a project's name and pressing Enter goes straight to it.
  const inputRef = useRef(null)
  useEffect(() => {
    function onKey(event) {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  function onSearchKey(event) {
    if (event.key === 'Escape') { setQuery(''); event.currentTarget.blur(); return }
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    const project = projectResults[0]
    if (project) goTo(`/projects/${project.id}`)
  }

  return (
    <AppTopBar
      crumbs={crumbs ?? [{ label: PAGE_CRUMB[pathname.replace(/\/$/, '')] ?? 'Home' }]}
      actions={actions ?? <NotificationsMenu className="size-9 hover:bg-muted" />}
      search={
      <SearchField
        className="w-full"
        ref={inputRef}
        shortcut="⌘K"
        onKeyDown={onSearchKey}
        aria-keyshortcuts="Meta+K Control+K"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        placeholder="Search projects, files, or members..."
      >
        {showResults && (
          <div className="absolute top-full left-0 z-50 mt-2 max-h-96 w-full overflow-y-auto rounded-2xl border border-border bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10">
            {totalResults === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">No results found.</p>
            ) : (
              <>
                {projectResults.length > 0 && (
                  <div>
                    <p className="px-1.5 py-1 text-[11px] font-medium text-muted-foreground">Projects</p>
                    {projectResults.map((project, index) => (
                      <button
                        key={project.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => goTo(`/projects/${project.id}`)}
                        className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
                      >
                        <Folder className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{project.name}</span>
                        {/* Enter opens the first project. */}
                        {index === 0 && <kbd translate="no" aria-hidden className="shrink-0 rounded border border-white/[0.14] px-1 text-[10px] leading-4 text-slate-400">↵</kbd>}
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
                        <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" />
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
      </SearchField>
      }
    />
  )
}

export default DashboardTopBar
