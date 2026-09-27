import { cn } from 'cn'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export const CONFLICT_STATUSES = ['Pending', 'In Review', 'Resolved']

export const STATUS_DOT_CLASS = {
  Pending: 'bg-muted-foreground/40',
  'In Review': 'bg-sky-400',
  Resolved: 'bg-primary',
}

// Shared between the dashboard's "Active conflicts" widget and the full
// /conflicts page — both hold their own local copy of conflictChecklist
// (mock data, no shared store), but the detail view and status-change UI
// only need to exist once.
function ConflictStatusModal({ conflict, onOpenChange, onStatusChange, onOpenMergeStudio }) {
  return (
    <Dialog open={Boolean(conflict)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {conflict && (
          <>
            <DialogHeader>
              <DialogTitle>{conflict.token}</DialogTitle>
              <DialogDescription>
                {conflict.projectName} · {conflict.timestamp}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground">Status</span>
              <div className="flex flex-wrap gap-1.5">
                {CONFLICT_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={conflict.status === status}
                    onClick={() => onStatusChange(conflict.id, status)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      conflict.status === status
                        ? 'border-transparent bg-foreground text-background'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <span className={cn('size-1.5 rounded-full', STATUS_DOT_CLASS[status])} />
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button type="button" onClick={() => onOpenMergeStudio(conflict)}>
                Open Merge Studio
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ConflictStatusModal
