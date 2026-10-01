import { X } from 'lucide-react'
import { cn } from 'cn'
import { FLOATING_PANEL, PANEL_RADIUS } from '@/components/mergestudio/floatingStyles'

// Shared shell for Merge Studio's right-hand drawers (Version History,
// Inbox): a floating card (same style as the Merge List and Block Deck),
// inset from the edges and below the top toolbar row, sliding in over the
// canvas above the Block Deck.
function MergeDrawer({ icon: Icon, title, aside, onClose, children }) {
  return (
    <div
      className={cn(
        'absolute top-[60px] right-4 bottom-4 z-[700] flex w-[380px] max-w-[calc(100%-2rem)] flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200',
        PANEL_RADIUS,
        FLOATING_PANEL
      )}
    >
      <div className="flex h-12 shrink-0 items-center gap-2 px-5">
        <Icon className="size-4 text-emerald-400" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <div className="ml-auto flex items-center gap-1">
          {aside}
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}

export default MergeDrawer
