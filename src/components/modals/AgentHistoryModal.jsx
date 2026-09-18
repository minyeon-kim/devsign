import { History as HistoryIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import RollbackHistoryList from '@/components/history/RollbackHistoryList'

function AgentHistoryModal({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <HistoryIcon className="size-4 text-primary" />
            Agent Log (Devsign Log)
          </DialogTitle>
          <DialogDescription>
            Every prompt you&apos;ve sent Devsign, in order. Pick one to roll the editor, preview
            and conflicts back to that moment.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto pr-1">
          <RollbackHistoryList onRollback={() => onOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AgentHistoryModal
