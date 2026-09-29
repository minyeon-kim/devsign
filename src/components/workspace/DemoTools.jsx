import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { resetDemo } from '@/lib/demoStorage'

export default function DemoTools() {
  const [confirming, setConfirming] = useState(false)
  useEffect(() => {
    const warn = () => toast('Local demo could not be saved', { description: 'Storage is unavailable or full. Changes remain in this tab; allow browser storage before refreshing.' })
    window.addEventListener('devsign:storage-error', warn)
    return () => window.removeEventListener('devsign:storage-error', warn)
  }, [])
  return (
    <Popover onOpenChange={() => setConfirming(false)}>
      <PopoverTrigger className="h-9 rounded-lg px-1 text-[10px] text-muted-foreground hover:bg-muted" title="Local demo tools">Demo</PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-72 space-y-3 p-4">
        <p className="text-sm font-medium">Local demo data</p>
        <p className="text-xs text-muted-foreground">Saved only in this browser. Approvals and edits are not synchronized with other users.</p>
        {confirming ? <>
          <p className="text-xs">Reset this prototype’s drafts, reviews and history for all projects?</p>
          <div className="flex gap-2">
            <button className="rounded-lg border px-3 py-2 text-xs" onClick={() => setConfirming(false)}>Cancel</button>
            <button className="rounded-lg bg-destructive px-3 py-2 text-xs text-white" onClick={() => {
              try { resetDemo(); window.location.reload() } catch { toast('Reset failed. Allow access to browser storage and try again.') }
            }}>Reset demo data</button>
          </div>
        </> : <button className="rounded-lg border px-3 py-2 text-xs" onClick={() => setConfirming(true)}>Reset demo data</button>}
      </PopoverContent>
    </Popover>
  )
}
