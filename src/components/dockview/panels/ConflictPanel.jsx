import { ChevronRight, CircleAlert, CircleCheck, FileCode2, Info, TriangleAlert } from 'lucide-react'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { allPeople } from '@/data/mockData'
import { STAGE_DOT_CLASS, STAGE_LABEL, isOpen, sortOpenFirst } from '@/lib/conflicts'
import { useWorkspace } from '@/state/WorkspaceProvider'

// One icon per row, chosen by severity and carried only inside the badge.
const severityConfig = {
  high: { label: 'High', icon: TriangleAlert, className: 'bg-destructive/15 text-destructive' },
  medium: { label: 'Medium', icon: CircleAlert, className: 'bg-amber-500/15 text-amber-500' },
  low: { label: 'Low', icon: Info, className: 'bg-sky-500/15 text-sky-500' },
}

// The bottom panel's Conflict Points tab: the same project-scoped conflict
// list as the activity bar's Conflicts drawer (both read the workspace's
// `conflicts`). There's deliberately no one-click Resolve here — a row
// opens the conflict's review window, where resolving is the last step
// of the review (see ConflictModal). The window itself is the project's
// single ConflictReviewHost, shared with the drawer.
function ConflictPanel() {
  const { conflicts, reviewConflictId, openConflictReview } = useWorkspace()
  const openCount = conflicts.filter(isOpen).length

  return (
    <div className="flex h-full flex-col bg-card">
      {/* No internal title bar here — the bottom panel's tab above already
          reads "Conflict Points". */}
      {conflicts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
          <CircleCheck className="size-6 text-emerald-500" />
          <p className="text-xs">No conflicts — design and code are in sync.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full min-w-[620px] border-collapse text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b text-left text-[11px] text-muted-foreground">
                <th className="px-3 py-2 font-medium">Severity</th>
                <th className="px-3 py-2 font-medium">Issue · {openCount} open</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Reviewers</th>
                <th className="w-0 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {sortOpenFirst(conflicts).map((conflict) => {
                const severity = severityConfig[conflict.severity] ?? severityConfig.medium
                const SeverityIcon = severity.icon
                const reviewers = conflict.reviewers
                  .map((r) => allPeople.find((p) => p.id === r.id))
                  .filter(Boolean)

                return (
                  <tr
                    key={conflict.id}
                    onClick={() => openConflictReview(conflict.id)}
                    aria-selected={reviewConflictId === conflict.id}
                    className={cn(
                      'group animate-in cursor-pointer border-b border-border/60 align-top fade-in slide-in-from-top-1 duration-300 last:border-0 hover:bg-muted/40 aria-selected:bg-muted/60',
                      !isOpen(conflict) && 'opacity-60'
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <Badge className={cn('gap-1 border-transparent', severity.className)}>
                        <SeverityIcon className="size-3" />
                        {severity.label}
                      </Badge>
                    </td>
                    <td className="max-w-72 px-3 py-2.5">
                      <p className="truncate font-medium text-foreground">{conflict.title}</p>
                      <p className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                        <FileCode2 className="size-3 shrink-0" />
                        <span className="truncate">{conflict.file}</span>
                      </p>
                      {conflict.message && (
                        <p className="mt-1 line-clamp-1 text-foreground/70">{conflict.message}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="flex items-center gap-1.5 text-foreground/80">
                        <span className={cn('size-1.5 rounded-full', STAGE_DOT_CLASS[conflict.reviewStage])} />
                        {STAGE_LABEL[conflict.reviewStage]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {reviewers.length ? (
                        <div className="flex -space-x-1.5">
                          {reviewers.map((person) => (
                            <Avatar key={person.id} size="sm" className="ring-2 ring-card" title={person.name}>
                              <AvatarFallback className={cn('text-[10px] font-medium text-white', person.colorClass)}>
                                {person.initials}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 pl-1 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          openConflictReview(conflict.id)
                        }}
                        className="inline-flex h-6 items-center gap-0.5 rounded-md px-2 text-[11px] font-medium text-muted-foreground transition-colors group-hover:text-foreground hover:bg-muted"
                      >
                        Review
                        <ChevronRight className="size-3" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default ConflictPanel
