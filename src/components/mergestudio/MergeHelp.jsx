import { X } from 'lucide-react'
import { cn } from 'cn'
import { FLOATING_PANEL, FLOATING_PILL, PANEL_RADIUS } from '@/components/mergestudio/floatingStyles'
import { Popover, PopoverClose, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'

const topics = [
  ['Explore the Merge List', 'Filter by status, conflict or due date.'],
  ['Open a merge item', 'Open an item, or add files to start a merge.'],
  ['Step through drifts', 'Use ‹ › to review each visual change.'],
  ['Edit & bind in the Block Deck', 'Select a canvas element to compare values and edit styles or tokens in the Block Deck.'],
  ['Finish the merge', 'Click Merge Changes to check conflicts, preview changes and request a review.'],
]

function MergeHelp() {
  return (
    <div className="absolute bottom-5 left-4 z-40">
      <Popover>
        <PopoverTrigger
          aria-label="Merge Studio help"
          title="Merge Studio help"
          className={cn('flex size-10 items-center justify-center rounded-full text-lg font-semibold text-foreground transition-colors hover:bg-muted data-[popup-open]:bg-muted', FLOATING_PILL)}
        >
          <span aria-hidden>?</span>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" sideOffset={12} className={cn('w-80 max-w-[calc(100vw-32px)] gap-4 p-4', FLOATING_PANEL, PANEL_RADIUS)}>
          <div className="flex items-center justify-between gap-2">
            <PopoverTitle>Merge Studio help</PopoverTitle>
            <PopoverClose aria-label="Close help" className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="size-4" />
            </PopoverClose>
          </div>
          <ul className="max-h-[min(480px,60vh)] space-y-4 overflow-y-auto">
            {topics.map(([title, body]) => (
              <li key={title}>
                <p className="text-[13px] font-semibold text-foreground">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default MergeHelp
