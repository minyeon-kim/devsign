import { X } from 'lucide-react'

// Shared shell for Merge Studio's right-hand glass drawers (Version History,
// Inbox): slides in over the canvas, above the Block Deck.
function MergeDrawer({ icon: Icon, title, aside, onClose, children }) {
  return (
    <div className="absolute top-0 right-0 bottom-0 z-40 flex w-[380px] max-w-full flex-col border-l border-white/10 bg-card/90 shadow-2xl shadow-black/40 backdrop-blur-xl animate-in slide-in-from-right duration-200">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 px-4">
        <Icon className="size-4 text-indigo-500" />
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
