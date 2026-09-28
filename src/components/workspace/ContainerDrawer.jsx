import { cn } from 'cn'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// A container's own side drawer (VS Code's Explorer beside the editor,
// Figma's Layers beside the canvas): the component that owns the content
// hosts its navigator, instead of it floating as a separate window. The
// toggle sits at the start of the container's header row; the drawer
// slides in below that header, pushing the content over rather than
// covering it.

export function ContainerDrawerToggle({ open, onToggle, icon: Icon, label }) {
  return (
    <Tooltip>
      <TooltipTrigger
        onClick={onToggle}
        aria-pressed={open}
        aria-label={`${open ? 'Hide' : 'Show'} ${label}`}
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full transition-colors',
          open ? 'bg-white/[0.08] text-foreground' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
        )}
      >
        <Icon className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent side="bottom">{`${open ? 'Hide' : 'Show'} ${label}`}</TooltipContent>
    </Tooltip>
  )
}

// The width animates between 0 and 208px; the content keeps a fixed w-52
// so it's revealed rather than re-wrapped mid-slide, and it's inert (out
// of the tab order) while closed.
export function ContainerDrawer({ open, label, children }) {
  return (
    <div
      inert={!open}
      aria-hidden={!open}
      className={cn(
        'h-full shrink-0 overflow-hidden transition-[width] duration-200 ease-out motion-reduce:transition-none',
        open ? 'w-52' : 'w-0'
      )}
    >
      <aside aria-label={label} className="h-full w-52 border-r border-white/[0.06] bg-card font-sans">
        {children}
      </aside>
    </div>
  )
}
