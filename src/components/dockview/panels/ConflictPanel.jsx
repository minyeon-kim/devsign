import { useState } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { allPeople } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import ConflictDetailModal from '@/components/modals/ConflictDetailModal'

// One icon per row, chosen by severity and carried only inside the badge —
// avoids the old layout's duplicate "TriangleAlert next to TriangleAlert"
// look once the row grew a dedicated severity column.
const severityConfig = {
  high: { label: 'High', icon: TriangleAlert, className: 'bg-destructive/15 text-destructive' },
  medium: { label: 'Medium', icon: CircleAlert, className: 'bg-amber-500/15 text-amber-500' },
  low: { label: 'Low', icon: Info, className: 'bg-sky-500/15 text-sky-500' },
}

function ConflictPanel() {
  const { conflicts, resolveConflict } = useWorkspace()
  const [detailId, setDetailId] = useState(null)
  const detailConflict = conflicts.find((c) => c.id === detailId) ?? null

  return (
    <div className="flex h-full flex-col bg-card">
      {/* No internal title bar here — the dockview tab above already reads
          "Conflict Point", so repeating it as a panel header would just be a
          duplicate label. */}
      {conflicts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
          <CircleCheck className="size-6 text-emerald-500" />
          <p className="text-xs">No conflicts — design and code are in sync.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full min-w-[560px] border-collapse text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b text-left text-[11px] text-muted-foreground">
                <th className="px-3 py-2 font-medium">Severity</th>
                <th className="px-3 py-2 font-medium">Issue</th>
                <th className="px-3 py-2 font-medium">Assignee</th>
                <th className="px-3 py-2 font-medium">Linked to</th>
                <th className="px-3 py-2 text-right font-medium">Action</th>
                <th className="w-0 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {conflicts.map((conflict) => {
                const severity = severityConfig[conflict.severity] ?? severityConfig.medium
                const SeverityIcon = severity.icon
                const assignee = allPeople.find((p) => p.id === conflict.assigneeId)

                return (
                  <tr
                    key={conflict.id}
                    className="animate-in border-b border-border/60 align-top fade-in slide-in-from-top-1 duration-300 last:border-0"
                  >
                    <td className="px-3 py-2.5">
                      <Badge className={cn('gap-1 border-transparent', severity.className)}>
                        <SeverityIcon className="size-3" />
                        {severity.label}
                      </Badge>
                    </td>
                    <td className="max-w-56 px-3 py-2.5">
                      <p className="truncate font-medium text-foreground">{conflict.file}</p>
                      <p className="mt-0.5 text-foreground/70">{conflict.message}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      {assignee ? (
                        <div className="flex items-center gap-1.5">
                          <Avatar size="sm">
                            <AvatarFallback
                              className={cn(
                                'text-[10px] font-medium text-white',
                                assignee.colorClass
                              )}
                            >
                              {assignee.initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="whitespace-nowrap text-foreground/80">
                            {assignee.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                      {conflict.linkedTo ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => resolveConflict(conflict.id)}
                      >
                        Resolve
                      </Button>
                    </td>
                    <td className="py-2.5 pr-3 pl-1 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => setDetailId(conflict.id)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConflictDetailModal
        conflict={detailConflict}
        open={!!detailConflict}
        onOpenChange={(open) => !open && setDetailId(null)}
        onResolve={(id) => {
          resolveConflict(id)
          setDetailId(null)
        }}
      />
    </div>
  )
}

export default ConflictPanel
