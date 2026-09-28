import { History as HistoryIcon, X } from 'lucide-react'
import { cn } from 'cn'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import RollbackHistoryList from '@/components/history/RollbackHistoryList'
import { FLOATING_PANEL, PANEL_RADIUS } from '@/components/mergestudio/floatingStyles'

// The Agent Log, as a Merge Studio panel (the Version History drawer's
// header and surface) around the shared history timeline.
function AgentHistoryModal({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn('flex max-h-[80vh] flex-col gap-0 bg-card p-0 ring-0 sm:max-w-[420px]', PANEL_RADIUS, FLOATING_PANEL)}
      >
        <div className="flex h-12 shrink-0 items-center gap-2 px-5">
          <HistoryIcon className="size-4 text-emerald-400" />
          <DialogTitle className="text-sm font-semibold text-foreground">Agent Log</DialogTitle>
          <DialogClose
            aria-label="Close"
            className="ml-auto flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </DialogClose>
        </div>
        <DialogDescription className="shrink-0 px-5 pb-2 text-xs text-slate-500">
          Every prompt you&apos;ve sent Devsign — roll the editor, preview and conflicts back to any of them.
        </DialogDescription>
        <div className="min-h-0 flex-1 overflow-auto px-5 pb-4">
          <RollbackHistoryList onRollback={() => onOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AgentHistoryModal
