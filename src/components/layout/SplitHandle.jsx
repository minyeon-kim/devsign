import { useState } from 'react'
import { cn } from 'cn'

// A splitter between two panes — 'vertical' (panes side by side) or
// 'horizontal' (stacked): drag it (the caller turns the pointer's travel
// since the drag started into a size), or focus it and use the arrow keys
// to nudge. Invisible at rest — a hairline shows on hover/drag, in keeping
// with the borderless panels around it.
function SplitHandle({ label, onResizeStart, onResize, onResizeEnd, onStep, className, orientation = 'vertical' }) {
  const vertical = orientation === 'vertical'
  const [dragging, setDragging] = useState(false)

  function handlePointerDown(event) {
    if (event.button !== 0) return
    event.preventDefault()
    const start = vertical ? event.clientX : event.clientY
    onResizeStart?.()
    setDragging(true)
    document.body.style.cursor = vertical ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'

    function onMove(moveEvent) {
      onResize((vertical ? moveEvent.clientX : moveEvent.clientY) - start)
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setDragging(false)
      onResizeEnd?.()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function handleKeyDown(event) {
    const [back, forward] = vertical ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown']
    if (!onStep || (event.key !== back && event.key !== forward)) return
    event.preventDefault()
    onStep(event.key === forward ? 16 : -16)
  }

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      aria-label={label}
      title={label}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      className={cn(
        'group relative shrink-0 touch-none outline-none',
        vertical ? 'w-2 cursor-col-resize' : 'h-2 cursor-row-resize',
        className
      )}
    >
      <span
        className={cn(
          'absolute rounded-full transition-colors',
          vertical ? 'inset-y-2 left-1/2 w-px -translate-x-1/2' : 'inset-x-2 top-1/2 h-px -translate-y-1/2',
          dragging ? 'bg-primary/70' : 'bg-transparent group-hover:bg-white/20 group-focus-visible:bg-primary/70'
        )}
      />
    </div>
  )
}

export default SplitHandle
